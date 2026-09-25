import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDirectory = resolve(projectRoot, 'dist');

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  copyFile(resolve(projectRoot, '.nojekyll'), resolve(outputDirectory, '.nojekyll')),
  copyFile(resolve(projectRoot, 'test.html'), resolve(outputDirectory, 'test.html')),
]);
