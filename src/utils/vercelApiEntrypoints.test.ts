import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function collectFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  });
}

describe('Vercel API entrypoints', () => {
  it('não expõe testes como Serverless Functions', () => {
    const invalidEntrypoints = collectFiles(join(process.cwd(), 'api'))
      .filter((path) => path.endsWith('.test.ts'))
      .filter((path) => !path.split(/[\\/]/).at(-1)?.startsWith('_'));

    expect(invalidEntrypoints).toEqual([]);
  });
});
