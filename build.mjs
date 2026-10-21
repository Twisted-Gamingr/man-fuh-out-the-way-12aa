import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const publicFiles = ['index.html', 'app.js', 'styles.css', 'icon.svg', 'manifest.webmanifest', 'sw.js'];

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });
for (const name of publicFiles) {
  const source = path.join(root, name);
  const target = path.join(dist, name);
  try {
    await fs.copyFile(source, target);
  } catch (error) {
    throw new Error(`Could not copy ${name} into dist: ${error.message}`);
  }
}
console.log(`Built Atmos static site to ${dist} (${publicFiles.length} files).`);
