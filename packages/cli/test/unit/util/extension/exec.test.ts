import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockScanParentDirs = vi.hoisted(() => vi.fn());
const mockWalkParentDirs = vi.hoisted(() => vi.fn());
const mockWhichSync = vi.hoisted(() => vi.fn());
const mockGetInstalledExtension = vi.hoisted(() => vi.fn());
const mockExeca = vi.hoisted(() => vi.fn());
const mockListen = vi.hoisted(() => vi.fn());
const mockCreateProxy = vi.hoisted(() => vi.fn());
const mockServer = vi.hoisted(() => ({ once: vi.fn(), close: vi.fn() }));

vi.mock(
  '@vercel/build-utils',
  () => ({
    scanParentDirs: mockScanParentDirs,
    walkParentDirs: mockWalkParentDirs,
  }),
  {
    virtual: true,
  }
);

vi.mock('which', () => ({
  default: {
    sync: mockWhichSync,
  },
}));

vi.mock('../../../../src/util/extension/registry', () => ({
  getInstalledExtension: mockGetInstalledExtension,
}));

vi.mock('execa', () => ({
  default: mockExeca,
}));

vi.mock('../../../../src/util/extension/proxy', () => ({
  createProxy: mockCreateProxy,
}));

vi.mock('async-listen', () => ({
  listen: mockListen,
}));

import { execExtension } from '../../../../src/util/extension/exec';

const client = {} as Parameters<typeof execExtension>[0];

describe(execExtension, () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockScanParentDirs.mockResolvedValue({
      packageJsonPath: '/project/package.json',
      lockfilePath: null,
    });
    mockWalkParentDirs.mockResolvedValue(null);
    mockGetInstalledExtension.mockReturnValue(null);
    mockWhichSync.mockReturnValue(null);
    mockCreateProxy.mockReturnValue(mockServer);
    mockListen.mockResolvedValue(new URL('http://127.0.0.1:12345'));
    mockExeca.mockResolvedValue({ exitCode: 0 });
  });

  it('prefers node_modules/.bin discovery', async () => {
    mockWalkParentDirs.mockResolvedValue(
      '/project/node_modules/.bin/vercel-hello'
    );

    const exitCode = await execExtension(
      client,
      'hello',
      ['--flag'],
      '/project/subdir'
    );

    expect(exitCode).toBe(0);
    expect(mockGetInstalledExtension).not.toHaveBeenCalled();
    expect(mockWhichSync).not.toHaveBeenCalled();
    expect(mockExeca).toHaveBeenCalledWith(
      '/project/node_modules/.bin/vercel-hello',
      ['--flag'],
      expect.any(Object)
    );
  });

  it('falls back to managed extensions dir', async () => {
    mockWalkParentDirs.mockResolvedValue(null);
    mockGetInstalledExtension.mockReturnValue({
      name: 'hello',
      path: '/ext',
      binPath: '/ext/bin/hello.js',
    });

    const exitCode = await execExtension(
      client,
      'hello',
      ['arg1'],
      '/project/subdir'
    );

    expect(exitCode).toBe(0);
    expect(mockGetInstalledExtension).toHaveBeenCalledWith('hello');
    expect(mockWhichSync).not.toHaveBeenCalled();
    expect(mockExeca).toHaveBeenCalledWith(
      '/ext/bin/hello.js',
      ['arg1'],
      expect.any(Object)
    );
  });

  it('falls back to $PATH discovery', async () => {
    mockWalkParentDirs.mockResolvedValue(null);
    mockGetInstalledExtension.mockReturnValue(null);
    mockWhichSync.mockReturnValue('/usr/local/bin/vercel-hello');

    const exitCode = await execExtension(
      client,
      'hello',
      ['--from-path'],
      '/project/subdir'
    );

    expect(exitCode).toBe(0);
    expect(mockGetInstalledExtension).toHaveBeenCalledWith('hello');
    expect(mockWhichSync).toHaveBeenCalledWith('vercel-hello', {
      nothrow: true,
    });
    expect(mockExeca).toHaveBeenCalledWith(
      '/usr/local/bin/vercel-hello',
      ['--from-path'],
      expect.any(Object)
    );
  });

  it('throws ENOENT when extension cannot be found', async () => {
    mockWalkParentDirs.mockResolvedValue(null);
    mockGetInstalledExtension.mockReturnValue(null);
    mockWhichSync.mockReturnValue(null);

    await expect(
      execExtension(client, 'hello', ['--missing'], '/project/subdir')
    ).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('passes VERCEL_API env var to extension process', async () => {
    mockWalkParentDirs.mockResolvedValue(
      '/project/node_modules/.bin/vercel-hello'
    );

    const exitCode = await execExtension(
      client,
      'hello',
      ['--env'],
      '/project/subdir'
    );

    expect(exitCode).toBe(0);
    expect(mockExeca).toHaveBeenCalledWith(
      '/project/node_modules/.bin/vercel-hello',
      ['--env'],
      expect.objectContaining({
        env: expect.objectContaining({
          VERCEL_API: 'http://127.0.0.1:12345',
        }),
      })
    );
  });
});
