/**
 * Embed the AFFiNE icon (and PE version strings) into the packaged Electron exe.
 *
 * Why this is needed: both `package-green` and the manual flow copy
 * `node_modules/electron/dist/electron.exe` verbatim, so the packaged exe keeps
 * Electron's own icon resource. On Windows the taskbar / window icon is taken
 * from the *executable's* icon resource — the app only calls
 * `browserWindow.setIcon(...)` on Linux (`src/main/windows-manager/main-window.ts`)
 * — therefore a plain copy shows the Electron logo in the taskbar.
 *
 * Order matters: run this **after** the exe has been copied into
 * `out/<buildType>/<productName>-<platform>-<arch>` and **before** `make`
 * (Squirrel copies the exe into the installer, so a late rcedit is invisible in
 * the installed build). `package-green` calls this script automatically.
 *
 * The trimmed `electron-winstaller/vendor/rcedit.exe` only understands
 * `--set-icon`; the four `--set-version-string` flags need the full build at
 * `vendor/rcedit-full/package/bin/rcedit-x64.exe`.
 *
 * Usage:
 *   node ./scripts/embed-exe-icon.mjs <exe> --icon <ico> [--product-name <name>]
 *     [--company <name>] [--description <text>] [--internal-name <name>] [--rcedit <path>]
 *     [--verify-only]   # only check that the icon images are embedded, do not patch
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const electronDir = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = path.resolve(electronDir, '..', '..', '..', '..');

const argv = process.argv.slice(2);
const readFlag = name => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? undefined : argv[index + 1];
};

const exe = argv[0];
if (!exe || exe.startsWith('--')) {
  console.error(
    'usage: node ./scripts/embed-exe-icon.mjs <exe> --icon <ico> [--product-name <name>]'
  );
  process.exit(1);
}

const productName = readFlag('product-name');
const company = readFlag('company') ?? 'AFFiNE';
const description = readFlag('description') ?? productName;
const internalName = readFlag('internal-name') ?? productName;
const icon = readFlag('icon');

const REDIT_CANDIDATES = [
  // full build: supports --set-icon *and* --set-version-string
  path.join(
    repoRoot,
    'node_modules',
    'electron-winstaller',
    'vendor',
    'rcedit-full',
    'package',
    'bin',
    'rcedit-x64.exe'
  ),
  path.join(
    repoRoot,
    'node_modules',
    'electron-winstaller',
    'vendor',
    'rcedit-full',
    'package',
    'bin',
    'rcedit.exe'
  ),
  // trimmed build shipped with electron-winstaller: --set-icon only
  path.join(
    repoRoot,
    'node_modules',
    'electron-winstaller',
    'vendor',
    'rcedit.exe'
  ),
];

const resolveRcedit = () => {
  const explicit = readFlag('rcedit');
  if (explicit) return path.resolve(explicit);
  const found = REDIT_CANDIDATES.find(candidate => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      'rcedit not found. Expected node_modules/electron-winstaller/vendor/rcedit-full/package/bin/rcedit-x64.exe (see AGENT.md step 4.5).'
    );
  }
  return found;
};

const isFullRcedit = rcedit => /rcedit-full/i.test(rcedit);

const run = (rcedit, args) => {
  const result = spawnSync(rcedit, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `rcedit ${args.join(' ')} failed with exit code ${result.status}`
    );
  }
};

/** Read the byte ranges of every image stored in an .ico file. */
const readIcoEntries = icoPath => {
  const ico = fs.readFileSync(icoPath);
  if (ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) {
    throw new Error(`${icoPath} is not an .ico file`);
  }
  const count = ico.readUInt16LE(4);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const base = 6 + i * 16;
    const size = ico.readUInt32LE(base + 8);
    const offset = ico.readUInt32LE(base + 12);
    entries.push({
      width: ico[base] === 0 ? 256 : ico[base],
      height: ico[base + 1] === 0 ? 256 : ico[base + 1],
      image: ico.subarray(offset, offset + size),
    });
  }
  return entries;
};

/**
 * Verify the icon really landed in the PE resource section by looking for every
 * image payload of the source .ico inside the patched exe.
 */
const verifyIcon = (exePath, icoPath) => {
  const buffer = fs.readFileSync(exePath);
  const entries = readIcoEntries(icoPath);
  const missing = [];
  for (const entry of entries) {
    if (buffer.includes(entry.image)) continue;
    missing.push(`${entry.width}x${entry.height}`);
  }
  if (missing.length) {
    throw new Error(
      `icon verification failed: ${missing.length}/${entries.length} images of ${icoPath} are not embedded in ${exePath} (${missing.join(', ')})`
    );
  }
  return entries.length;
};

const main = () => {
  const exePath = path.resolve(exe);
  if (!fs.existsSync(exePath)) {
    throw new Error(`${exePath} does not exist`);
  }
  if (!icon) throw new Error('--icon <ico> is required');
  const iconPath = path.resolve(icon);
  if (!fs.existsSync(iconPath)) {
    throw new Error(`${iconPath} does not exist`);
  }

  const verifyOnly = argv.includes('--verify-only');
  const sizeBefore = fs.statSync(exePath).size;

  if (!verifyOnly) {
    const rcedit = resolveRcedit();

    run(rcedit, [exePath, '--set-icon', iconPath]);
    console.log(`embedded icon ${path.basename(iconPath)} (rcedit: ${rcedit})`);

    if (isFullRcedit(rcedit) && productName) {
      const strings = {
        CompanyName: company,
        FileDescription: description,
        InternalName: internalName,
        ProductName: productName,
      };
      for (const [key, value] of Object.entries(strings)) {
        run(rcedit, [exePath, '--set-version-string', key, value]);
      }
      console.log(
        `set PE version strings: ${Object.entries(strings)
          .map(([key, value]) => `${key}=${value}`)
          .join(', ')}`
      );
    } else if (!isFullRcedit(rcedit)) {
      console.warn(
        'warning: using the trimmed rcedit, PE version strings are NOT updated (needs vendor/rcedit-full)'
      );
    }
  } else {
    console.log(`verify-only: not touching ${path.basename(exePath)}`);
  }

  const images = verifyIcon(exePath, iconPath);
  const sizeAfter = fs.statSync(exePath).size;
  console.log(
    `verified: ${images} icon image(s) present in ${path.basename(exePath)} (size ${sizeBefore} -> ${sizeAfter})`
  );
};

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
