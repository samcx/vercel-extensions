import { describe, it, expect, beforeEach, vi } from 'vitest';
import { client } from '../../../mocks/client';
import extension from '../../../../src/commands/extension';

const mockListInstalledExtensions = vi.hoisted(() => vi.fn(() => []));
const mockRmSync = vi.hoisted(() => vi.fn());

vi.mock('../../../../src/util/extension/registry', () => ({
  listInstalledExtensions: mockListInstalledExtensions,
  getInstalledExtension: vi.fn(),
  getExtensionsDir: vi.fn(),
  isNameConflict: vi.fn(),
  ensureExtensionsDir: vi.fn(),
}));

vi.mock('fs', async importOriginal => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, rmSync: mockRmSync };
});

describe('extension remove', () => {
  beforeEach(() => {
    client.reset();
    mockListInstalledExtensions.mockReturnValue([]);
  });

  it('errors when no name argument provided', async () => {
    client.setArgv('extension', 'rm');
    const exitCode = await extension(client);
    expect(exitCode).toBe(1);
    await expect(client.stderr).toOutput('Missing required argument');
  });

  it('errors when extension not installed', async () => {
    client.setArgv('extension', 'rm', 'missing');
    const exitCode = await extension(client);
    expect(exitCode).toBe(1);
    await expect(client.stderr).toOutput('not installed');
  });

  it('removes extension with --yes flag', async () => {
    mockListInstalledExtensions.mockReturnValue([
      {
        name: 'hello',
        description: 'A hello extension',
        path: '/tmp/extensions/vercel-hello',
        commands: [],
      },
    ]);
    client.setArgv('extension', 'rm', 'hello', '--yes');
    const exitCode = await extension(client);
    expect(exitCode).toBe(0);
    expect(mockRmSync).toHaveBeenCalledWith('/tmp/extensions/vercel-hello', {
      recursive: true,
      force: true,
    });
    await expect(client.stderr).toOutput('removed');
  });

  it('removes listed extensions even when they are not runnable', async () => {
    mockListInstalledExtensions.mockReturnValue([
      {
        name: 'broken',
        description: '(no description)',
        path: '/tmp/extensions/vercel-broken',
        commands: [],
      },
    ]);
    client.setArgv('extension', 'rm', 'broken', '--yes');
    const exitCode = await extension(client);
    expect(exitCode).toBe(0);
    expect(mockRmSync).toHaveBeenCalledWith('/tmp/extensions/vercel-broken', {
      recursive: true,
      force: true,
    });
    await expect(client.stderr).toOutput('removed');
  });

  it('tracks telemetry', async () => {
    mockListInstalledExtensions.mockReturnValue([
      {
        name: 'hello',
        description: 'A hello extension',
        path: '/tmp/extensions/vercel-hello',
        commands: [],
      },
    ]);
    client.setArgv('extension', 'remove', 'hello', '--yes');
    await extension(client);
    expect(client.telemetryEventStore).toHaveTelemetryEvents([
      { key: 'subcommand:remove', value: 'remove' },
    ]);
  });
});
