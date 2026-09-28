/**
 * Stage the runtime `node_modules` closure of an already assembled Electron app
 * directory (`resources/app`).
 *
 * `scripts/common.ts` marks `electron-updater`, `yjs` and `semver` as esbuild
 * `external`s, so they are never inlined into `dist/main.js` / `dist/helper.js`
 * and they are *not* part of the forge output either (`asar` packaging hides
 * them / the Windows symlink issue makes `electron-packager` skip them). The
 * app therefore needs a real copy of their transitive dependency closure inside
 * `resources/app/node_modules`, otherwise the exe dies right after launch with
 *
 *   A JavaScript error occurred in the main process
 *   Error: Cannot find module 'electron-updater'
 *
 * Note that on a dev machine the missing module often still resolves by
 * accident: `resources/app/dist` sits a few levels below the monorepo root, so
 * node's "walk up the parent directories" resolution ends up using
 * `<repo>/node_modules`. As soon as the app directory is moved, copied to
 * another path or installed by Squirrel into `%LOCALAPPDATA%`, that fallback is
 * gone and the error above is guaranteed.
 *
 * Usage:
 *   node ./scripts/stage-runtime-deps.mjs <resources/app dir> [repo root]
 */
import { cp, readdir, readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const electronDir = fileURLToPath(new URL('..', import.meta.url));
const defaultRepoRoot = path.resolve(electronDir, '..', '..', '..', '..');

if (!process.argv[2]) {
  console.error(
    'usage: node ./scripts/stage-runtime-deps.mjs <resources/app dir> [repo root]'
  );
  process.exit(1);
}

const appDir = path.resolve(process.argv[2]);
const repoRoot = path.resolve(process.argv[3] ?? defaultRepoRoot);
const distDir = path.join(appDir, 'dist');

const resolverRoots = [electronDir, repoRoot].map(dir =>
  createRequire(path.join(dir, 'package.json'))
);
const builtins = new Set(
  createRequire(import.meta.url)('node:module').builtinModules.flatMap(name => [
    name,
    `node:${name}`,
  ])
);

/** Collect every bare specifier that the compiled layers require at runtime. */
const collectRuntimeDependencies = async () => {
  const pattern = /(?:require|import)\s*\(\s*["']([^"'\s]+)["']\s*\)/g;
  const roots = new Set();
  for (const file of await readdir(distDir)) {
    if (!file.endsWith('.js')) continue;
    const source = await readFile(path.join(distDir, file), 'utf8');
    let match;
    while ((match = pattern.exec(source))) {
      const specifier = match[1];
      if (
        !specifier ||
        specifier.startsWith('.') ||
        specifier.startsWith('/')
      ) {
        continue;
      }
      const root = specifier.startsWith('@')
        ? specifier.split('/').slice(0, 2).join('/')
        : specifier.split('/')[0];
      if (
        builtins.has(root) ||
        builtins.has(specifier) ||
        root === 'electron'
      ) {
        continue;
      }
      // napi-rs optional platform packages: only a fallback for the bundled
      // `affine.<platform>.node` asset.
      if (root === '@affine/native' || root.startsWith('@affine/native-')) {
        continue;
      }
      roots.add(root);
    }
  }
  return [...roots].sort();
};

/**
 * Resolve a package the way node would when requiring it from `fromDir`: a copy
 * nested inside the requiring package wins over the hoisted one.
 */
const resolvePackageDir = (name, fromDir) => {
  try {
    const fromParent = createRequire(path.join(fromDir, 'package.json'));
    return path.dirname(fromParent.resolve(`${name}/package.json`));
  } catch {
    // fall through to the workspace roots
  }
  for (const resolver of resolverRoots) {
    try {
      return path.dirname(resolver.resolve(`${name}/package.json`));
    } catch {
      // try the next root
    }
  }
  return undefined;
};

const stage = async () => {
  const roots = await collectRuntimeDependencies();
  console.log(`runtime dependency roots: ${roots.join(', ')}`);

  const staged = new Set();
  const queue = roots.map(name => ({ name, fromDir: electronDir }));
  while (queue.length) {
    const { name, fromDir } = queue.shift();
    if (staged.has(name)) continue;

    const sourceDir = resolvePackageDir(name, fromDir);
    if (!sourceDir) {
      throw new Error(
        `Unable to resolve runtime dependency "${name}" from ${fromDir}. Did you run an install?`
      );
    }
    staged.add(name);

    const destination = path.join(appDir, 'node_modules', name);
    await cp(await realpath(sourceDir), destination, {
      recursive: true,
      dereference: true,
      force: true,
    });

    const manifest = JSON.parse(
      await readFile(path.join(sourceDir, 'package.json'), 'utf8')
    );
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (!staged.has(dependency)) {
        queue.push({ name: dependency, fromDir: sourceDir });
      }
    }
  }

  console.log(
    `staged ${staged.size} packages: ${[...staged].sort().join(', ')}`
  );
};

/** Fail loudly when a dependency still resolves outside of the app directory. */
const verify = async () => {
  const appRequire = createRequire(path.join(appDir, 'package.json'));
  const resolved = [];
  for (const name of await collectRuntimeDependencies()) {
    let target;
    try {
      target = appRequire.resolve(name);
    } catch (error) {
      throw new Error(`"${name}" does not resolve from ${appDir}: ${error}`);
    }
    if (!target.startsWith(appDir)) {
      throw new Error(
        `"${name}" resolves to ${target}, outside of ${appDir}. The app directory is not self contained.`
      );
    }
    resolved.push(`${name} -> ${path.relative(appDir, target)}`);
  }
  console.log('self contained check passed:');
  for (const line of resolved) console.log(`  ${line}`);
};

stage()
  .then(verify)
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
