import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cpSync, mkdtempSync, mkdirSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { client } from '../../../mocks/client';
import extension from '../../../../src/commands/extension';
import { listInstalledExtensions } from '../../../../src/util/extension/registry';

const FIXTURE_DIR = path.resolve(
  __dirname,
  '../../../fixtures/unit/extension-hello'
);

const mockGetGlobalPathConfig = vi.hoisted(() =>
  vi.fn(() => '/tmp/vercel-e2e-default')
);
const mockExeca = vi.hoisted(() => vi.fn());

vi.mock('../../../../src/util/config/global-path', () => ({
  default: mockGetGlobalPathConfig,
}));

vi.mock('execa', () => ({ default: mockExeca }));

describe('extension lifecycle (e2e)', () => {
  let tmpGlobalConfig: string;

  beforeEach(() => {
    client.reset();
    tmpGlobalConfig = mkdtempSync(path.join(os.tmpdir(), 'vercel-e2e-'));
    mkdirSync(path.join(tmpGlobalConfig, 'extensions'), { recursive: true });
    mockGetGlobalPathConfig.mockReturnValue(tmpGlobalConfig);
    mockExeca.mockImplementation(async (_cmd: string, args: string[]) => {
      const cloneDest = args[4];
      cpSync(FIXTURE_DIR, cloneDest, { recursive: true });
      return { exitCode: 0 };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    rmSync(tmpGlobalConfig, { recursive: true, force: true });
  });

  it('install → list → remove → list empty', async () => {
    client.setArgv('extension', 'install', 'owner/vercel-hello', '--yes');
    const installCode = await extension(client);
    expect(installCode, 'install exit code').toBe(0);
    await expect(client.stderr).toOutput('Installed extension');

    client.reset();
    mockGetGlobalPathConfig.mockReturnValue(tmpGlobalConfig);
    client.setArgv('extension', 'ls');
    const listCode = await extension(client);
    expect(listCode, 'list exit code').toBe(0);

    const listed = listInstalledExtensions();
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe('hello');
    expect(listed[0].description).toBe('A test extension that says hello');

    client.reset();
    mockGetGlobalPathConfig.mockReturnValue(tmpGlobalConfig);
    client.setArgv('extension', 'remove', 'hello', '--yes');
    const removeCode = await extension(client);
    expect(removeCode, 'remove exit code').toBe(0);
    await expect(client.stderr).toOutput('removed');

    const afterRemove = listInstalledExtensions();
    expect(afterRemove).toHaveLength(0);
  });
});
