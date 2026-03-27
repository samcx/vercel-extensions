import { describe, it, expect, beforeEach, vi } from 'vitest';
import { client } from '../../../mocks/client';
import extension from '../../../../src/commands/extension';

type InstalledExtension = {
  name: string;
  description: string;
  path: string;
  commands: Array<{
    name: string;
    description: string;
  }>;
};

type ExtensionInstall = {
  name: string;
  path: string;
  binPath: string;
} | null;

const mockGetInstalledExtension = vi.hoisted(() =>
  vi.fn<(name: string) => ExtensionInstall>()
);
const mockListInstalledExtensions = vi.hoisted(() =>
  vi.fn<() => InstalledExtension[]>(() => [])
);
const mockExeca = vi.hoisted(() => vi.fn());

vi.mock('../../../../src/util/extension/registry', () => ({
  listInstalledExtensions: mockListInstalledExtensions,
  getInstalledExtension: mockGetInstalledExtension,
  getExtensionsDir: vi.fn(),
  isNameConflict: vi.fn(),
  ensureExtensionsDir: vi.fn(),
}));

vi.mock('execa', () => ({ default: mockExeca }));

describe('extension upgrade', () => {
  beforeEach(() => {
    client.reset();
    vi.clearAllMocks();
    mockGetInstalledExtension.mockReturnValue(null);
    mockListInstalledExtensions.mockReturnValue([]);
    mockExeca.mockResolvedValue({ exitCode: 0 });
  });

  it('errors when the named extension is not installed', async () => {
    client.setArgv('extension', 'upgrade', 'missing');
    const exitCode = await extension(client);
    expect(exitCode).toBe(1);
    await expect(client.stderr).toOutput('not installed');
  });

  it('upgrades one installed extension', async () => {
    mockGetInstalledExtension.mockReturnValue({
      name: 'hello',
      path: '/tmp/extensions/vercel-hello',
      binPath: '/tmp/extensions/vercel-hello/bin.js',
    });

    client.setArgv('extension', 'upgrade', 'hello');
    const exitCode = await extension(client);

    expect(exitCode).toBe(0);
    expect(mockExeca).toHaveBeenCalledWith(
      'git',
      ['-C', '/tmp/extensions/vercel-hello', 'pull', '--ff-only'],
      expect.any(Object)
    );
    await expect(client.stderr).toOutput('Upgraded extension "hello".');
  });

  it('upgrades all installed extensions when no name is provided', async () => {
    mockListInstalledExtensions.mockReturnValue([
      {
        name: 'hello',
        description: 'Hello',
        path: '/tmp/extensions/vercel-hello',
        commands: [],
      },
      {
        name: 'world',
        description: 'World',
        path: '/tmp/extensions/vercel-world',
        commands: [],
      },
    ]);

    client.setArgv('extension', 'upgrade');
    const exitCode = await extension(client);

    expect(exitCode).toBe(0);
    expect(mockExeca).toHaveBeenCalledTimes(2);
    await expect(client.stderr).toOutput('Upgraded 2 extensions.');
  });

  it('shows a no-op message when no extensions are installed', async () => {
    client.setArgv('extension', 'upgrade');
    const exitCode = await extension(client);
    expect(exitCode).toBe(0);
    await expect(client.stderr).toOutput('No extensions installed.');
  });

  it('returns a failing exit code when one upgrade fails', async () => {
    mockListInstalledExtensions.mockReturnValue([
      {
        name: 'hello',
        description: 'Hello',
        path: '/tmp/extensions/vercel-hello',
        commands: [],
      },
      {
        name: 'world',
        description: 'World',
        path: '/tmp/extensions/vercel-world',
        commands: [],
      },
    ]);
    mockExeca
      .mockRejectedValueOnce(new Error('pull failed'))
      .mockResolvedValueOnce({ exitCode: 0 });

    client.setArgv('extension', 'upgrade');
    const exitCode = await extension(client);

    expect(exitCode).toBe(1);
    expect(mockExeca).toHaveBeenCalledTimes(2);
    await expect(client.stderr).toOutput(
      'Failed to upgrade extension "hello": pull failed'
    );
    await expect(client.stderr).toOutput('Upgraded extension "world".');
  });

  it('tracks telemetry for the update alias', async () => {
    mockListInstalledExtensions.mockReturnValue([
      {
        name: 'hello',
        description: 'Hello',
        path: '/tmp/extensions/vercel-hello',
        commands: [],
      },
    ]);

    client.setArgv('extension', 'update');
    await extension(client);

    expect(client.telemetryEventStore).toHaveTelemetryEvents([
      { key: 'subcommand:upgrade', value: 'update' },
    ]);
  });
});
