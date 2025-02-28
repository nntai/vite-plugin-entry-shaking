import { resolve } from 'path';
import type { ResolvedConfig } from 'vite';
import { describe, it, expect } from 'vitest';

import type { FinalPluginOptions } from '../src/types';
import { analyzeEntries, transformRequired } from '../src';

describe('analyzeEntries', () => {
  it('should correctly analyze entries', async () => {
    const aPath = resolve(__dirname, '__mocks__/entry-a');
    const bPath = resolve(__dirname, '__mocks__/entry-b');
    const entries = await analyzeEntries([aPath, bPath]);

    expect(entries.size).toStrictEqual(2);
    expect(entries.has(aPath)).toStrictEqual(true);
    expect(entries.has(bPath)).toStrictEqual(true);
  });
});

describe('transformRequired', () => {
  it('should return false if served file is not located within the configured root', () => {
    const id = '/path/to/another-project/file.ext';
    const config = { root: '/path/to/project' } as ResolvedConfig;
    const options = { extensions: ['ext'] } as FinalPluginOptions;
    expect(transformRequired(id, config, options)).toStrictEqual(false);
  });

  it('should return false if served file extension is not within config extension list', () => {
    const id = '/path/to/project/file.anotherext';
    const config = { root: '/path/to/project' } as ResolvedConfig;
    const options = { extensions: ['ext'] } as FinalPluginOptions;

    expect(transformRequired(id, config, options)).toStrictEqual(false);
  });

  it('should return true if served file must be transformed by the plugin', () => {
    const id = '/path/to/project/file.ext';
    const config = { root: '/path/to/project' } as ResolvedConfig;
    const options = { extensions: ['ext'] } as FinalPluginOptions;

    expect(transformRequired(id, config, options)).toStrictEqual(true);
  });
});
