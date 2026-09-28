/**
 * Build a "green" (portable / direct-run) Electron app directory.
 *
 * `electron-forge package` produces `resources/app.asar` **and** flips the
 * `OnlyLoadAppFromAsar` / `EnableEmbeddedAsarIntegrityValidation` fuses inside
 * the packaged executable (see `forge.config.mjs` -> `FusesPlugin`). That exe
 * ignores a loose `resources/app` folder, and on Windows the forge packaging
 * step itself tends to fail because of the `node_modules` symlink created by
 * the `prePackage` hook.
 *
 * A portable build therefore has to be assembled by hand:
 *
 *  1. the Electron runtime files (un-flipped `electron.exe` renamed to the
 *     product name, so a loose `resources/app` is loaded),
 *  2. the compiled main/preload/helper layers in `resources/app/dist`,
 *  3. the renderer bundle in `resources/app/resources/web-static`,
 *  4. the *runtime* `node_modules` closure, because `scripts/common.ts` marks
 *     `electron-updater`, `yjs` and `semver` as esbuild `external`s and they
 *     are therefore NOT inlined into `dist/main.js`,
 *  5. the AFFiNE icon + PE version strings patched into the copied exe with
 *     `rcedit` (`scripts/embed-exe-icon.mjs`), because a verbatim `electron.exe`
 *     copy keeps Electron's icon in the Windows taskbar.
 *
 * Missing step 4 is what makes the green exe die with
 * `Error: Cannot find module 'electron-updater'` right after launch.
 */
import { spawnSync } from 'node:child_process';
import { builtinModules, createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

import debug from 'debug';
import fs from 'fs-extra';

import {
  arch,
  buildType,
  platform,
  productName,
  REPO_ROOT,
  ROOT,
} from './make-env.js';

const log = debug('affine:package-green');

/** Bundles produced by `scripts/build-layers.ts`. */
const distDir = path.resolve(ROOT, 'dist');
const resourcesDir = path.resolve(ROOT, 'resources');
const repoNodeModules = path.resolve(REPO_ROOT, 'node_modules');
const electronDist = path.resolve(repoNodeModules, 'electron', 'dist');

const appDirectory = path.resolve(
  ROOT,
  'out',
  buildType,
  `${productName}-${platform}-${arch}`
);
const resourcesApp = path.join(appDirectory, 'resources', 'app');

/**
 * Files copied verbatim from the electron distribution next to the exe.
 * Everything else that is not a locale or an app resource is skipped.
 */
const ELECTRON_ROOT_FILES = new Set([
  'icudtl.dat',
  'snapshot_blob.bin',
  'v8_context_snapshot.bin',
  'resources.pak',
  'chrome_100_percent.pak',
  'chrome_200_percent.pak',
  'LICENSE',
  'LICENSES.chromium.html',
  'version',
  'vk_swiftshader_icd.json',
]);

/**
 * Collect every bare module specifier that the compiled layers resolve at
 * runtime. Everything that is not a node builtin, not `electron`, and not one
 * of the optional napi platform packages has to ship inside
 * `resources/app/node_modules`.
 */
const collectRuntimeDependencies = async (targetDistDir: string) => {
  const builtins = new Set<string>(
    builtinModules.flatMap(name => [name, `node:${name}`])
  );

  const specifiers = new Set<string>();
  const pattern =
    /(?:require|import)\s*\(\s*["']([^"'\s]+)["']\s*\)|\brequire\s*\(\s*["']([^"'\s]+)["']\s*\)/g;

  for (const file of await fs.readdir(targetDistDir)) {
    if (!file.endsWith('.js')) continue;
    const source = await fs.readFile(path.join(targetDistDir, file), 'utf8');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source))) {
      const specifier = match[1] ?? match[2];
      if (!specifier || specifier.startsWith('.') || specifier.startsWith('/'))
        continue;
      const root = specifier.startsWith('@')
        ? specifier.split('/').slice(0, 2).join('/')
        : specifier.split('/')[0];
      if (builtins.has(root) || builtins.has(specifier) || root === 'electron')
        continue;
      // napi-rs optional platform packages, only used as a fallback when the
      // bundled `affine.<platform>.node` asset cannot be loaded.
      if (root === '@affine/native' || root.startsWith('@affine/native-'))
        continue;
      specifiers.add(root);
    }
  }

  return [...specifiers].sort();
};

/**
 * Resolve a package directory the same way node would when requiring it from
 * the electron package, but always report the *real* path so the yarn / pnpm
 * symlink gets dereferenced while copying.
 */
const resolvePackageDir = (name: string) => {
  const nodeRequire = createRequire(import.meta.url);
  try {
    const manifest = nodeRequire.resolve(`${name}/package.json`, {
      paths: [ROOT, REPO_ROOT],
    });
    return path.dirname(fs.realpathSync(manifest));
  } catch {
    const candidate = path.join(repoNodeModules, name);
    return fs.pathExistsSync(candidate)
      ? fs.realpathSync(candidate)
      : undefined;
  }
};

const copyPackage = async (name: string, sourceDir: string) => {
  const destination = path.join(resourcesApp, 'node_modules', name);
  log('staging runtime dependency %s -> %s', name, destination);
  await fs.copy(sourceDir, destination, {
    overwrite: true,
    dereference: true,
    filter: (src: string) =>
      !/(^|[\\/])(\.git|\.cache|\.turbo)($|[\\/])/.test(src),
  });
};

/**
 * Copy the runtime `node_modules` closure into `resources/app`.
 */
const stageRuntimeDependencies = async () => {
  const roots = await collectRuntimeDependencies(distDir);
  log('runtime dependencies: %o', roots);

  const staged = new Set<string>();
  const queue = [...roots];

  while (queue.length) {
    const name = queue.shift();
    if (name === undefined) break;
    if (staged.has(name)) continue;

    const sourceDir = resolvePackageDir(name);
    if (!sourceDir) {
      throw new Error(
        `Unable to resolve runtime dependency "${name}" from ${REPO_ROOT}. Did you run an install?`
      );
    }
    staged.add(name);

    await copyPackage(name, sourceDir);

    const manifest = await fs.readJson(path.join(sourceDir, 'package.json'));
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (!staged.has(dependency)) queue.push(dependency);
    }

    // Packages that ship their own pinned nested dependencies, e.g.
    // `electron-updater/node_modules/semver`, must keep them: node prefers the
    // nested copy over the hoisted one.
    const nested = path.join(sourceDir, 'node_modules');
    if (await fs.pathExists(nested)) {
      for (const entry of await fs.readdir(nested)) {
        if (entry.startsWith('.')) continue;
        if (!entry.startsWith('@')) {
          queue.push(entry);
          continue;
        }
        for (const scoped of await fs.readdir(path.join(nested, entry))) {
          queue.push(`${entry}/${scoped}`);
        }
      }
    }
  }

  return [...staged].sort();
};

/**
 * Stage the fuse-free Electron runtime: `electron.exe` renamed to the product
 * name plus everything chromium needs next to it.
 */
const copyElectronRuntime = async () => {
  await fs.copy(
    path.join(electronDist, 'electron.exe'),
    path.join(appDirectory, `${productName}.exe`),
    { overwrite: true }
  );

  await fs.copy(
    path.join(electronDist, 'locales'),
    path.join(appDirectory, 'locales'),
    { overwrite: true }
  );

  for (const entry of await fs.readdir(electronDist)) {
    const isRuntimeFile =
      ELECTRON_ROOT_FILES.has(entry) || entry.endsWith('.dll');
    if (!isRuntimeFile) continue;
    await fs.copy(
      path.join(electronDist, entry),
      path.join(appDirectory, entry),
      { overwrite: true }
    );
  }
};

/**
 * `copyElectronRuntime` copies `electron.exe` verbatim, so the packaged exe
 * still carries Electron's own icon resource — which is exactly what Windows
 * shows for the window/taskbar (`browserWindow.setIcon` is only called on
 * Linux). Patch the PE resources with `scripts/embed-exe-icon.mjs` (rcedit) on
 * every run, otherwise a re-package silently loses the AFFiNE icon again.
 */
const embedExeIcon = () => {
  const exePath = path.join(appDirectory, `${productName}.exe`);
  const iconName =
    buildType === 'stable' ? 'icon.ico' : `icon_${buildType}.ico`;
  const iconPath = path.join(resourcesDir, 'icons', iconName);
  const script = path.resolve(ROOT, 'scripts', 'embed-exe-icon.mjs');

  if (!fs.existsSync(iconPath)) {
    console.warn(`  icon: skipped, ${iconPath} does not exist`);
    return 'skipped (icon file missing)';
  }

  const result = spawnSync(
    process.execPath,
    [script, exePath, '--icon', iconPath, '--product-name', productName],
    { stdio: 'inherit' }
  );
  if (result.status !== 0) {
    console.warn(
      `  icon: NOT embedded, ${path.basename(exePath)} still shows Electron's icon in the taskbar.` +
        `\n  re-run manually: node ./scripts/embed-exe-icon.mjs "${exePath}" --icon "${iconPath}" --product-name ${productName}`
    );
    return 'NOT embedded (see warning)';
  }
  return 'embedded';
};

const packageGreen = async () => {
  const requiredSources = [
    path.join(distDir, 'main.js'),
    path.join(distDir, 'helper.js'),
    path.join(distDir, 'preload.js'),
    path.join(resourcesDir, 'web-static', 'index.html'),
    path.join(electronDist, 'electron.exe'),
  ];
  for (const file of requiredSources) {
    if (!(await fs.pathExists(file))) {
      throw new Error(
        `Missing ${file}. Build the renderer bundle and run "yarn affine @affine/electron build" first.`
      );
    }
  }

  await fs.ensureDir(resourcesApp);

  // A loose `resources/app` directory is only honoured when the executable was
  // not built with the `OnlyLoadAppFromAsar` fuse, so never keep an asar
  // around: a stale one silently wins and the green build runs old code.
  for (const stale of ['app.asar', 'app.asar.unpacked', 'default_app.asar']) {
    await fs.remove(path.join(appDirectory, 'resources', stale));
  }

  // 1. main / preload / helper layers, including the native `.node` binding
  await fs.copy(distDir, path.join(resourcesApp, 'dist'), { overwrite: true });

  // 2. package.json with the productName forge would have injected, otherwise
  //    app.name falls back to "@affine/electron" and the window title follows.
  const packageJson = await fs.readJson(path.resolve(ROOT, 'package.json'));
  packageJson.productName = productName;
  await fs.outputFile(
    path.join(resourcesApp, 'package.json'),
    `${JSON.stringify(packageJson, null, 2)}\n`
  );

  // 3. icons for tray/window and the renderer bundle served by the main process
  await fs.copy(
    path.join(resourcesDir, 'icons'),
    path.join(resourcesApp, 'resources', 'icons'),
    { overwrite: true }
  );
  await fs.copy(
    path.join(resourcesDir, 'web-static'),
    path.join(resourcesApp, 'resources', 'web-static'),
    { overwrite: true }
  );
  // `extraResource` equivalent: electron-updater reads it in packaged builds
  await fs.copy(
    path.join(resourcesDir, 'app-update.yml'),
    path.join(appDirectory, 'resources', 'app-update.yml'),
    { overwrite: true }
  );

  // 4. runtime node_modules for the esbuild `external`s
  const staged = await stageRuntimeDependencies();

  // 5. the electron runtime itself
  await copyElectronRuntime();

  // 6. embed the AFFiNE icon + PE version strings into the copied exe
  const iconStatus = embedExeIcon();

  const verification = [
    path.join(resourcesApp, 'dist', 'main.js'),
    path.join(resourcesApp, 'dist', 'helper.js'),
    path.join(resourcesApp, 'resources', 'web-static', 'index.html'),
    path.join(resourcesApp, 'node_modules', 'electron-updater', 'package.json'),
    path.join(appDirectory, `${productName}.exe`),
    path.join(appDirectory, 'v8_context_snapshot.bin'),
  ];
  for (const file of verification) {
    if (!(await fs.pathExists(file))) {
      throw new Error(`Green build is incomplete, missing: ${file}`);
    }
  }

  console.log(`Green build ready: ${appDirectory}`);
  console.log(`  run ${productName}.exe directly, no installer required`);
  console.log(`  staged runtime dependencies: ${staged.join(', ')}`);
  console.log(`  exe icon/version resources: ${iconStatus}`);
};

packageGreen().catch(error => {
  console.error(error);
  process.exit(1);
});
