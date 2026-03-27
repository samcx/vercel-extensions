import { describe, it, expect, beforeEach, vi } from 'vitest';
import { client } from '../../../mocks/client';
import extension from '../../../../src/commands/extension';

const mockGetInstalledExtension = vi.hoisted(() => vi.fn(() => null));
const mockIsNameConflict = vi.hoisted(() => vi.fn(() => false));
const mockEnsureExtensionsDir = vi.hoisted(() =>
  vi.fn(() => '/tmp/extensions')
);
const mockExeca = vi.hoisted(() => vi.fn());
const mockRenameSync = vi.hoisted(() => vi.fn());
const mockRmSync = vi.hoisted(() => vi.fn());
const mockMkdtempSync = vi.hoisted(() => vi.fn(() => '/tmp/vercel-ext-abc123'));
const mockReadFileSync = vi.hoisted(() => vi.fn());
const mockCpSync = vi.hoisted(() => vi.fn());
const mockExistsSync = vi.hoisted(() => vi.fn(() => false));

vi.mock('../../../../src/util/extension/registry', () => ({
  listInstalledExtensions: vi.fn(() => []),
  getInstalledExtension: mockGetInstalledExtension,
  getExtensionsDir: vi.fn(() => '/tmp/extensions'),
  isNameConflict: mockIsNameConflict,
  ensureExtensionsDir: mockEnsureExtensionsDir,
}));

vi.mock('execa', () => ({ default: mockExeca }));

vi.mock('fs', async importOriginal => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    mkdtempSync: mockMkdtempSync,
    renameSync: mockRenameSync,
    rmSync: mockRmSync,
    readFileSync: mockReadFileSync,
    cpSync: mockCpSync,
    existsSync: mockExistsSync,
  };
});

describe('extension install', () => {
  beforeEach(() => {
    client.reset();
    vi.clearAllMocks();
    mockGetInstalledExtension.mockReturnValue(null);
    mockIsNameConflict.mockReturnValue(false);
    mockEnsureExtensionsDir.mockReturnValue('/tmp/extensions');
    mockExeca.mockResolvedValue({ exitCode: 0 });
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ bin: { 'vercel-hello': 'bin.js' } })
    );
    mockMkdtempSync.mockReturnValue('/tmp/vercel-ext-abc123');
  });

  it('errors when no source argument', async () => {
    client.setArgv('extension', 'install');
    const exitCode = await extension(client);
    expect(exitCode).toBe(1);
    await expect(client.stderr).toOutput('Missing required argument');
  });

  it('errors on name collision with core command', async () => {
    mockIsNameConflict.mockReturnValue(true);
    client.setArgv('extension', 'install', 'owner/vercel-deploy', '--yes');
    const exitCode = await extension(client);
    expect(exitCode).toBe(1);
    await expect(client.stderr).toOutput('conflicts with a built-in command');
  });

  it('errors when already installed', async () => {
    mockGetInstalledExtension.mockReturnValue({
      name: 'hello',
      path: '/ext',
      binPath: '/ext/bin.js',
    });
    client.setArgv('extension', 'install', 'owner/vercel-hello', '--yes');
    const exitCode = await extension(client);
    expect(exitCode).toBe(1);
    await expect(client.stderr).toOutput('already installed');
  });

  it('GitHub install: clones, validates, moves to managed dir', async () => {
    client.setArgv('extension', 'install', 'owner/vercel-hello', '--yes');
    const exitCode = await extension(client);
    expect(exitCode).toBe(0);
    expect(mockExeca).toHaveBeenCalledWith(
      'git',
      [
        'clone',
        '--depth',
        '1',
        'https://github.com/owner/vercel-hello.git',
        '/tmp/vercel-ext-abc123',
      ],
      expect.any(Object)
    );
    expect(mockRenameSync).toHaveBeenCalledWith(
      '/tmp/vercel-ext-abc123',
      '/tmp/extensions/vercel-hello'
    );
    await expect(client.stderr).toOutput('Installed extension');
  });

  it('GitHub install: cleans up temp dir on clone failure', async () => {
    mockExeca.mockRejectedValue(new Error('git clone failed'));
    client.setArgv('extension', 'install', 'owner/vercel-hello', '--yes');
    const exitCode = await extension(client);
    expect(exitCode).toBe(1);
    expect(mockRmSync).toHaveBeenCalledWith(
      '/tmp/vercel-ext-abc123',
      expect.objectContaining({ recursive: true })
    );
  });

  it('tracks telemetry', async () => {
    client.setArgv('extension', 'install', 'owner/vercel-hello', '--yes');
    await extension(client);
    expect(client.telemetryEventStore).toHaveTelemetryEvents([
      { key: 'subcommand:install', value: 'install' },
    ]);
  });

  it('copies extension from local path', async () => {
    client.setArgv('extension', 'install', '.', '--yes');
    const exitCode = await extension(client);
    expect(exitCode).toBe(0);
    expect(mockCpSync).toHaveBeenCalled();
    await expect(client.stderr).toOutput('Installed extension');
  });
});
