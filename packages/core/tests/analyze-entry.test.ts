import type { MockedFunction } from 'vitest';
import fs from 'fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import dedent from 'ts-dedent';

import type { EntryExports, EntryImports, PluginEntries } from '../src/types';
import EntryAnalyzer from '../src/analyze-entry';

vi.mock('fs');

describe('parseImportStatement', () => {
  describe('aggregated export statements', () => {
    it('should correctly parse aggregated export statement', () => {
      const parsed = EntryAnalyzer.parseImportStatement(`export { UserId, UserName } from '@model/user';`);
      expect(parsed).toMatchObject({
        namedImports: ['UserId', 'UserName'],
        defaultImport: null,
      });
    });

    it('should correctly parse aggregated export statement with alias', () => {
      const parsed = EntryAnalyzer.parseImportStatement(`export { UserId as UserIdentifier, UserName } from '@model/user';`);
      expect(parsed).toMatchObject({
        namedImports: ['UserId as UserIdentifier', 'UserName'],
        defaultImport: null,
      });
    });

    it('should correctly parse aggregated export statement with only aliased default export', () => {
      const parsed = EntryAnalyzer.parseImportStatement(`export { default as User } from '@model/user';`);
      expect(parsed).toMatchObject({
        namedImports: [],
        defaultImport: 'User',
      });
    });

    it('should correctly parse aggregated export statement with aliased default export', () => {
      const parsed = EntryAnalyzer.parseImportStatement(`export { default as User, UserName } from '@model/user';`);
      expect(parsed).toMatchObject({
        namedImports: ['UserName'],
        defaultImport: 'User',
      });
    });
  });

  describe('import statements', () => {
    it('should correctly parse import statement when only importing named exports', () => {
      const parsed = EntryAnalyzer.parseImportStatement(`import { UserId, UserName } from '@model/user';`);
      expect(parsed).toMatchObject({
        namedImports: ['UserId', 'UserName'],
        defaultImport: null,
      });
    });

    it('should correctly parse import statement when only importing default export', () => {
      const parsed = EntryAnalyzer.parseImportStatement(`import User from '@model/user';`);
      expect(parsed).toMatchObject({
        namedImports: [],
        defaultImport: 'User',
      });
    });

    it('should correctly parse import statement when importing default export then named exports', () => {
      const parsed = EntryAnalyzer.parseImportStatement(`import User, { UserId, UserName } from '@model/user';`);
      expect(parsed).toMatchObject({
        namedImports: ['UserId', 'UserName'],
        defaultImport: 'User',
      });
    });

    it('should correctly parse import statement when importing named exports then default export', () => {
      const parsed = EntryAnalyzer.parseImportStatement(`import { UserId, UserName }, User from '@model/user';`);
      expect(parsed).toMatchObject({
        namedImports: ['UserId', 'UserName'],
        defaultImport: 'User',
      });
    });

    it('should correctly parse import statement when importing named exports with aliases', () => {
      const parsed = EntryAnalyzer.parseImportStatement(`import { UserId as UserIdentifier, UserName }, User from '@model/user';`);
      expect(parsed).toMatchObject({
        namedImports: ['UserId as UserIdentifier', 'UserName'],
        defaultImport: 'User',
      });
    });

    it('should correctly parse import statement when importing default export with alias', () => {
      const parsed = EntryAnalyzer.parseImportStatement(`import { default as User, UserName } from '@model/user';`);
      expect(parsed).toMatchObject({
        namedImports: ['UserName'],
        defaultImport: 'User',
      });
    });
  });
});

describe('analyzeEntryImport', () => {
  const path = '@any/path';

  const run = (input: string) => {
    const analyzedImports: EntryImports = new Map([]);
    const statementStartPosition = 0;
    const statementEndPosition: number = input.length;
    EntryAnalyzer.analyzeEntryImport(
      input,
      analyzedImports,
      path,
      statementStartPosition,
      statementEndPosition,
    );

    return {
      analyzedImports,
      statementStartPosition,
      statementEndPosition,
    };
  };

  describe('aggregated export statements', () => {
    it('should feed the `analyzedImports` map if this is an aggregated export', () => {
      const output = run(`export { UserId } from '${path}'`);

      expect(output.analyzedImports.size).toStrictEqual(1);
      expect(output.analyzedImports.get('UserId')).toStrictEqual({ path, importDefault: false });
    });

    it('should feed the `analyzedImports` map if this is an aggregated default export with alias', () => {
      const output = run(`export { default as User } from '${path}'`);

      expect(output.analyzedImports.size).toStrictEqual(1);
      expect(output.analyzedImports.get('User')).toStrictEqual({ path, importDefault: true });
    });

    it('should feed the `analyzedImports` map if this is an aggregated export with alias', () => {
      const output = run(`export { UserId as UserIdentifier } from '${path}'`);

      expect(output.analyzedImports.size).toStrictEqual(1);
      expect(output.analyzedImports.get('UserId as UserIdentifier')).toStrictEqual({ path, importDefault: false });
    });
  });

  describe('import statements', () => {
    it('should feed the `analyzedImports` map if it imports named exports', () => {
      const namedImport = `GroupId`;
      const output = run(`import { ${namedImport} } from "${path}"`);

      expect(output.analyzedImports.size).toStrictEqual(1);
      expect(output.analyzedImports.get(namedImport)).toStrictEqual({ path, importDefault: false });
    });

    it('should feed the `analyzedImports` map if it imports a module', () => {
      const moduleImport = `User`;
      const output = run(`import ${moduleImport} from "${path}"`);

      expect(output.analyzedImports.size).toStrictEqual(1);
      expect(output.analyzedImports.get(moduleImport)).toStrictEqual({ path, importDefault: true });
    });

    it('should feed the `analyzedImports` map if it imports a named export with an alias', () => {
      const moduleImport = `User`;
      const importAlias = `MyUser`;
      const importString = `${moduleImport} as ${importAlias}`;
      const output = run(`import { ${importString} } from "${path}"`);

      expect(output.analyzedImports.size).toStrictEqual(1);
      expect(output.analyzedImports.get(importString)).toStrictEqual({ path, importDefault: false });
    });

    it('should feed the `analyzedImports` map if it imports a default export with an alias', () => {
      const importAlias = `MyUser`;
      const output = run(`import { default as ${importAlias} } from "${path}"`);

      expect(output.analyzedImports.size).toStrictEqual(1);
      expect(output.analyzedImports.get(importAlias)).toStrictEqual({ path, importDefault: true });
    });
  });
});

describe('analyzeEntryExport', () => {
  it('should correctly feed the `entryMap` when the export relies on a named import statement', () => {
    const path = `@any/path`;
    const importedName = `UserId`;
    const importedParams = { path, importDefault: false };

    const entryMap: EntryExports = new Map([]);
    const analyzedImports = new Map([[importedName, importedParams]]);

    EntryAnalyzer.analyzeEntryExport(
      entryMap,
      analyzedImports,
      importedName,
    );

    expect(entryMap.size).toStrictEqual(1);
    expect(entryMap.get(importedName)).toMatchObject(importedParams);
  });

  it('should correctly feed the `entryMap` when the export relies on a default import statement', () => {
    const path = `@any/path`;
    const importedName = `UserId`;
    const importedParams = { path, importDefault: true };

    const entryMap: EntryExports = new Map([]);
    const analyzedImports = new Map([[importedName, importedParams]]);

    EntryAnalyzer.analyzeEntryExport(
      entryMap,
      analyzedImports,
      importedName,
    );

    expect(entryMap.size).toStrictEqual(1);
    expect(entryMap.get(importedName)).toMatchObject(importedParams);
  });
});

describe('doAnalyzeEntry', () => {
  const run = async (entrySource: string) => {
    const entries: PluginEntries = new Map([]);
    const targetPath = '@entry/path';
    const targetAbsolutePath = '/path/to/entry';
    (fs.readFileSync as MockedFunction<any>).mockReturnValueOnce(entrySource);

    await EntryAnalyzer.doAnalyzeEntry(entries, targetPath);

    return { entries, targetPath, targetAbsolutePath };
  };

  it('should feed the `entries` map even though it does not export anything', async () => {
    const output = await run(``);
    expect(output.entries.size).toStrictEqual(1);
  });

  it('should feed the `entries` map with simple import/exports', async () => {
    const output = await run(dedent(`
      import User from '@models/User';
      import { Group } from '@models/Group';
      import Article from '../models/Article';

      export { Article };
      export { User, Group };
    `));
    expect(output.entries.size).toStrictEqual(1);
    expect(output.entries.get(output.targetPath)?.exports.get('User')).toMatchObject({ path: '@models/User', importDefault: true });
    expect(output.entries.get(output.targetPath)?.exports.get('Group')).toMatchObject({ path: '@models/Group', importDefault: false });
    expect(output.entries.get(output.targetPath)?.exports.get('Article')).toMatchObject({ path: '../models/Article', importDefault: true });
  });

  it('should feed the `entries` map with renamed import/exports', async () => {
    const output = await run(dedent(`
      import { User as MyUser } from '@models/User';

      export { MyUser };
    `));
    expect(output.entries.size).toStrictEqual(1);
    expect(output.entries.get(output.targetPath)?.exports.has('User')).toStrictEqual(false);
  });

  it('should feed the `entries` map with aggregated exports', async () => {
    const output = await run(dedent(`
      export { User, UserId } from '@models/User';
      export { Group } from '../models/Group';
    `));
    expect(output.entries.size).toStrictEqual(1);
    expect(output.entries.get(output.targetPath)?.exports.get('UserId')).toMatchObject({ path: '@models/User', importDefault: false });
    expect(output.entries.get(output.targetPath)?.exports.get('User')).toMatchObject({ path: '@models/User', importDefault: false });
    expect(output.entries.get(output.targetPath)?.exports.get('Group')).toMatchObject({ path: '../models/Group', importDefault: false });
  });

  it('should ignore exports which are not direct re-exports of imports', async () => {
    const output = await run(dedent(`
      import { User, UserName, UserId } from '@models/User';
      import Group from '../models/Group';
      export { User, UserName };
      export { Test } from '../models/Test';
      export let TestValue = 'value';
      export const MyGroup = Group;
      export function TestFunction() {
        return User;
      };
    `));
    expect(output.entries.size).toStrictEqual(1);
    expect(output.entries.get(output.targetPath)?.exports.get('User')).toMatchObject({ path: '@models/User', importDefault: false });
    expect(output.entries.get(output.targetPath)?.exports.get('UserName')).toMatchObject({ path: '@models/User', importDefault: false });
    expect(output.entries.get(output.targetPath)?.exports.has('UserId')).toStrictEqual(false);
    expect(output.entries.get(output.targetPath)?.exports.has('Group')).toStrictEqual(false);
    expect(output.entries.get(output.targetPath)?.exports.has('TestValue')).toStrictEqual(false);
    expect(output.entries.get(output.targetPath)?.exports.has('MyGroup')).toStrictEqual(false);
    expect(output.entries.get(output.targetPath)?.exports.has('TestFunction')).toStrictEqual(false);
  });
});

describe('analyzeEntry', () => {
  const path = '@entry/path';

  beforeEach(() => {
    vi.spyOn(EntryAnalyzer, 'doAnalyzeEntry').mockImplementation(() => Promise.resolve());
  });

  it('should directly return void if entry was already parsed', async () => {
    await EntryAnalyzer.analyzeEntry(new Map([[path, {}]]) as any, path);

    expect(EntryAnalyzer.doAnalyzeEntry).not.toHaveBeenCalled();
  });

  it('should call doAnalyzeEntry if entry was not already parsed', async () => {
    await EntryAnalyzer.analyzeEntry(new Map([]), path);

    expect(EntryAnalyzer.doAnalyzeEntry).toHaveBeenCalledWith(
      expect.anything(),
      path,
    );
  });
});
