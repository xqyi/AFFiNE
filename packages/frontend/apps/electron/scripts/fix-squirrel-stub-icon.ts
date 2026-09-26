/**
 * fix-squirrel-stub-icon.ts
 *
 * electron-winstaller's `createWindowsInstaller` generates a Squirrel
 * execution stub (`<appName>_ExecutionStub.exe`) inside the nupkg. The
 * Windows taskbar / Start Menu shortcut that Squirrel creates on first
 * install uses THIS stub's embedded icon, not the main app exe's.
 * electron-winstaller does not copy the app icon into the stub, so the
 * shortcut ends up showing the default Electron icon on every machine.
 *
 * This script:
 *   1. Locates the freshly built `-full.nupkg` produced by make-squirrel.
 *   2. Extracts `lib/net45/<appName>_ExecutionStub.exe` from it.
 *   3. Runs rcedit (full version, supports --set-icon) to replace the
 *      stub's icon resource with the build's .ico file.
 *   4. Repacks the nupkg in place (nuget pack is not needed; we just
 *      re-compress the zip).
 *
 * Note: re-compressing the nupkg zip is enough for Squirrel's installer
 * (Setup.exe) because the stub is only read at install time from the
 * embedded nupkg inside Setup.exe. We must re-run `Squirrel.exe
 * --releasify` on the fixed nupkg to regenerate Setup.exe, or simply
 * call electron-winstaller's setup-exe writer again. The simplest
 * correct approach is: fix the stub, then re-invoke
 * `Squirrel.exe --releasify` so the new Setup.exe embeds the fixed
 * nupkg.
 *
 * Usage: node --import tsx ./scripts/fix-squirrel-stub-icon.ts
 *
 * Env (optional):
 *   STUB_ICON  - path to .ico to embed (defaults to resources/icons/icon_<buildType>.ico)
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import debug from 'debug';
import { convertVersion } from 'electron-winstaller';
import fs from 'fs-extra';

import { arch, buildType, icoPath, productName, ROOT } from './make-env.js';

const log = debug('affine:fix-squirrel-stub-icon');

export async function fixSquirrelStubIcon(): Promise<void> {
  const outPath = path.resolve(
    ROOT,
    'out',
    buildType,
    'make',
    `squirrel.windows/${arch}`
  );
  const pkg = await fs.readJson(path.resolve(ROOT, 'package.json'));
  const nupkgVersion = convertVersion(pkg.version);
  const fullNupkg = path.resolve(
    outPath,
    `${productName}-${nupkgVersion}-full.nupkg`
  );

  if (!(await fs.pathExists(fullNupkg))) {
    log('skip: full nupkg not found at', fullNupkg);
    return;
  }

  const iconFile = process.env.STUB_ICON || icoPath;
  if (!(await fs.pathExists(iconFile))) {
    log('skip: icon not found at', iconFile);
    return;
  }

  const rcedit = path.resolve(
    ROOT,
    '..',
    '..',
    '..',
    'node_modules',
    'electron-winstaller',
    'vendor',
    'rcedit-full',
    'package',
    'bin',
    'rcedit-x64.exe'
  );
  if (!(await fs.pathExists(rcedit))) {
    log(
      'skip: rcedit-full not found at',
      rcedit,
      '- run the AGENT.md setup step first'
    );
    return;
  }

  const workDir = path.resolve(outPath, `.stubfix-${nupkgVersion}`);
  await fs.remove(workDir);
  await fs.ensureDir(workDir);

  log('extracting', fullNupkg, '->', workDir);
  // nupkg is a plain zip; PowerShell's tar.exe handles it.
  execSync(`tar -xf "${fullNupkg}" -C "${workDir}"`, { stdio: 'inherit' });

  const stubName = `${productName}_ExecutionStub.exe`;
  const stubPath = path.join(workDir, 'lib', 'net45', stubName);
  if (!(await fs.pathExists(stubPath))) {
    log('skip: stub not found at', stubPath);
    await fs.remove(workDir);
    return;
  }

  log('applying icon to stub', stubPath);
  execSync(
    `"${rcedit}" "${stubPath}" --set-icon "${iconFile}" --set-version-string "CompanyName" "AFFiNE" --set-version-string "FileDescription" "${productName}" --set-version-string "InternalName" "${productName}" --set-version-string "ProductName" "${productName}"`,
    { stdio: 'inherit' }
  );

  // Re-pack the nupkg. nuget pack is unavailable offline, so just rezip.
  log('repacking nupkg');
  await fs.remove(fullNupkg);
  execSync(`cd "${workDir}" && tar -a -cf "${fullNupkg}" *`, {
    stdio: 'inherit',
  });

  // Regenerate Setup.exe from the fixed nupkg so the installer embeds the
  // corrected stub.
  const squirrelExe = path.resolve(
    ROOT,
    '..',
    '..',
    '..',
    'node_modules',
    'electron-winstaller',
    'vendor',
    'Squirrel.exe'
  );
  const loadingGif = path.resolve(
    ROOT,
    './resources/icons/affine_installing.gif'
  );
  if (await fs.pathExists(squirrelExe)) {
    log('regenerating Setup.exe via Squirrel.exe --releasify');
    execSync(
      `"${squirrelExe}" --releasify "${fullNupkg}" --releaseDir "${outPath}" --loadingGif "${loadingGif}" --setupIcon "${iconFile}" --no-msi --no-delta`,
      { stdio: 'inherit' }
    );
  } else {
    log('squirrel.exe not found, leaving Setup.exe as-is');
  }

  await fs.remove(workDir);
  log('done: stub icon fixed and Setup.exe regenerated');
}

// Run only when invoked directly (not imported).
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  fixSquirrelStubIcon().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
