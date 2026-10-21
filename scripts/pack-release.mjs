import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readPackage = (directory) => JSON.parse(readFileSync(`${directory}/package.json`, 'utf8'));
const version = readPackage('packages/core').version;
if (readPackage('packages/vite-plugin').version !== version) throw new Error('Package versions must match');
const destination = resolve('release-dist');
rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
for (const directory of ['packages/core', 'packages/vite-plugin']) {
  execFileSync('pnpm', ['pack', '--pack-destination', destination], { cwd: directory, stdio: 'inherit' });
}
cpSync('packages/core/dist/annotoo.js', `${destination}/annotoo.js`);
// Commit immutable browser builds so later Pages deployments retain old script URLs.
const browserArchive = `site/public/releases/v${version}/annotoo.js`;
const browserBytes = readFileSync('packages/core/dist/annotoo.js');
if (existsSync(browserArchive) && !readFileSync(browserArchive).equals(browserBytes)) {
  throw new Error('The browser build changed for an existing release. Bump the package version before packing.');
}
mkdirSync(`site/public/releases/v${version}`, { recursive: true });
writeFileSync(browserArchive, browserBytes);

const checksums = readdirSync(destination).sort().map((file) =>
  `${createHash('sha256').update(readFileSync(`${destination}/${file}`)).digest('hex')}  ${file}`,
);
writeFileSync(`${destination}/SHA256SUMS`, checksums.join('\n') + '\n');
console.log(`Release v${version} packages and checksums are in ${destination}`);
