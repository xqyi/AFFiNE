import cp from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('.');
const yarnBin = path.join(repoRoot, '.yarn', 'releases', 'yarn-4.18.0.cjs');
const targetVersion = process.argv[2] || '0.27.4';

const raw = cp.execFileSync(
  process.execPath,
  [yarnBin, 'workspaces', 'list', '--json'],
  {
    cwd: repoRoot,
    encoding: 'utf8',
  }
);

let updated = 0;
for (const line of raw.trim().split('\n')) {
  if (!line.trim()) continue;
  const { location } = JSON.parse(line);
  const pkgJsonPath = path.join(repoRoot, location, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    if (pkg.version !== targetVersion) {
      pkg.version = targetVersion;
      fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
      updated++;
    }
  }
}

console.log(`Updated ${updated} workspaces to version ${targetVersion}`);
