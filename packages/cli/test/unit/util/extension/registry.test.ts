import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

const mockGetGlobalPathConfig = vi.hoisted(() => vi.fn());
const mockCommands = vi.hoisted(
  () =>
    new Map([
      ['deploy', 'deploy'],
      ['env', 'env'],
    ])
);

vi.mock('../../../../src/util/config/global-path', () => ({
  default: mockGetGlobalPathConfig,
}));

vi.mock('../../../../src/commands/index', () => ({
  commands: mockCommands,
}));

import {
  getExtensionsDir,
  getInstalledExtension,
  getInstalledExtensionNames,
  isNameConflict,
  listInstalledExtensions,
} from '../../../../src/util/extension/registry';

describe('extension registry util', () => {
  let tempGlobalConfigDir: string;

  beforeEach(() => {
    tempGlobalConfigDir = mkdtempSync(
      path.join(os.tmpdir(), 'vercel-ext-registry-')
    );
    mockGetGlobalPathConfig.mockReturnValue(tempGlobalConfigDir);
  });

  afterEach(() => {
    vi.clearAllMocks();
    rmSync(tempGlobalConfigDir, { recursive: true, force: true });
  });

  describe('getExtensionsDir()', () => {
    it('returns a path ending in /extensions', () => {
      expect(getExtensionsDir()).toBe(
        path.join(tempGlobalConfigDir, 'extensions')
      );
    });
  });

  describe('getInstalledExtensionNames()', () => {
    it('returns [] when extensions dir does not exist', () => {
      expect(getInstalledExtensionNames()).toEqual([]);
    });

    it('returns [] when extensions dir is empty', () => {
      mkdirSync(getExtensionsDir(), { recursive: true });
      expect(getInstalledExtensionNames()).toEqual([]);
    });

    it('returns names without vercel- prefix, sorted', () => {
      const extensionsDir = getExtensionsDir();
      mkdirSync(path.join(extensionsDir, 'vercel-zeta'), { recursive: true });
      mkdirSync(path.join(extensionsDir, 'vercel-alpha'), { recursive: true });
      mkdirSync(path.join(extensionsDir, 'not-an-extension'), {
        recursive: true,
      });

      expect(getInstalledExtensionNames()).toEqual(['alpha', 'zeta']);
    });

    it('does not throw when package.json is missing', () => {
      const extensionsDir = getExtensionsDir();
      mkdirSync(path.join(extensionsDir, 'vercel-no-package'), {
        recursive: true,
      });

      expect(() => getInstalledExtensionNames()).not.toThrow();
      expect(getInstalledExtensionNames()).toEqual(['no-package']);
    });

    it('returns [] when dir read fails', () => {
      writeFileSync(getExtensionsDir(), 'not a directory');
      expect(getInstalledExtensionNames()).toEqual([]);
    });
  });

  describe('listInstalledExtensions()', () => {
    it('returns [] when extensions dir does not exist', () => {
      expect(listInstalledExtensions()).toEqual([]);
    });

    it('returns [] when extensions dir is empty', () => {
      mkdirSync(getExtensionsDir(), { recursive: true });
      expect(listInstalledExtensions()).toEqual([]);
    });

    it('returns entries with name, description, and path', () => {
      const extensionDir = path.join(getExtensionsDir(), 'vercel-hello');
      mkdirSync(extensionDir, { recursive: true });
      writeFileSync(
        path.join(extensionDir, 'package.json'),
        JSON.stringify({ description: 'Hello extension' })
      );

      expect(listInstalledExtensions()).toEqual([
        {
          name: 'hello',
          description: 'Hello extension',
          path: extensionDir,
        },
      ]);
    });

    it('falls back to (no description) when package.json has no description', () => {
      const extensionDir = path.join(getExtensionsDir(), 'vercel-empty');
      mkdirSync(extensionDir, { recursive: true });
      writeFileSync(
        path.join(extensionDir, 'package.json'),
        JSON.stringify({})
      );

      expect(listInstalledExtensions()).toEqual([
        {
          name: 'empty',
          description: '(no description)',
          path: extensionDir,
        },
      ]);
    });

    it('falls back to (no description) when package.json is missing', () => {
      const extensionDir = path.join(getExtensionsDir(), 'vercel-missing');
      mkdirSync(extensionDir, { recursive: true });

      expect(listInstalledExtensions()).toEqual([
        {
          name: 'missing',
          description: '(no description)',
          path: extensionDir,
        },
      ]);
    });

    it('returns entries sorted alphabetically by name', () => {
      const alphaDir = path.join(getExtensionsDir(), 'vercel-alpha');
      const zetaDir = path.join(getExtensionsDir(), 'vercel-zeta');
      mkdirSync(zetaDir, { recursive: true });
      mkdirSync(alphaDir, { recursive: true });

      writeFileSync(
        path.join(zetaDir, 'package.json'),
        JSON.stringify({ description: 'Zeta' })
      );
      writeFileSync(
        path.join(alphaDir, 'package.json'),
        JSON.stringify({ description: 'Alpha' })
      );

      expect(listInstalledExtensions()).toEqual([
        {
          name: 'alpha',
          description: 'Alpha',
          path: alphaDir,
        },
        {
          name: 'zeta',
          description: 'Zeta',
          path: zetaDir,
        },
      ]);
    });
  });

  describe('getInstalledExtension()', () => {
    it('returns null when extension dir does not exist', () => {
      expect(getInstalledExtension('missing')).toBeNull();
    });

    it('returns name, path, and binPath when bin is a string', () => {
      const extensionDir = path.join(getExtensionsDir(), 'vercel-hello');
      mkdirSync(extensionDir, { recursive: true });
      writeFileSync(
        path.join(extensionDir, 'package.json'),
        JSON.stringify({ bin: 'bin/cli.js' })
      );

      expect(getInstalledExtension('hello')).toEqual({
        name: 'hello',
        path: extensionDir,
        binPath: path.join(extensionDir, 'bin/cli.js'),
      });
    });

    it('returns name, path, and binPath when bin is an object map', () => {
      const extensionDir = path.join(getExtensionsDir(), 'vercel-world');
      mkdirSync(extensionDir, { recursive: true });
      writeFileSync(
        path.join(extensionDir, 'package.json'),
        JSON.stringify({
          bin: {
            'vercel-world': 'dist/index.js',
            other: 'dist/other.js',
          },
        })
      );

      expect(getInstalledExtension('world')).toEqual({
        name: 'world',
        path: extensionDir,
        binPath: path.join(extensionDir, 'dist/index.js'),
      });
    });
  });

  describe('isNameConflict()', () => {
    it('returns true for deploy', () => {
      expect(isNameConflict('deploy')).toBe(true);
    });

    it('returns true for env', () => {
      expect(isNameConflict('env')).toBe(true);
    });

    it('returns false for my-custom-tool', () => {
      expect(isNameConflict('my-custom-tool')).toBe(false);
    });
  });
});
