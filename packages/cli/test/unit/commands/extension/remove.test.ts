import { describe, it, expect, beforeEach, vi } from 'vitest';
import { client } from '../../../mocks/client';
import extension from '../../../../src/commands/extension';

const mockGetInstalledExtension = vi.hoisted(() => vi.fn());
const mockGetExtensionsDir = vi.hoisted(() => vi.fn(() => '/tmp/extensions'));
const mockRmSync = vi.hoisted(() => vi.fn());

vi.mock('../../../../src/util/extension/registry', () => ({
  listInstalledExtensions: vi.fn(() => []),
  getInstalledExtension: mockGetInstalledExtension,
  getExtensionsDir: mockGetExtensionsDir,
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
    mockGetInstalledExtension.mockReturnValue(null);
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
    mockGetInstalledExtension.mockReturnValue({
      name: 'hello',
      path: '/tmp/extensions/vercel-hello',
      binPath: '/tmp/extensions/vercel-hello/bin.js',
    });
    client.setArgv('extension', 'rm', 'hello', '--yes');
    const exitCode = await extension(client);
    expect(exitCode).toBe(0);
    expect(mockGetExtensionsDir).toHaveBeenCalled();
    expect(mockRmSync).toHaveBeenCalled();
    await expect(client.stderr).toOutput('removed');
  });

  it('tracks telemetry', async () => {
    mockGetInstalledExtension.mockReturnValue({
      name: 'hello',
      path: '/tmp/extensions/vercel-hello',
      binPath: '/tmp/extensions/vercel-hello/bin.js',
    });
    client.setArgv('extension', 'remove', 'hello', '--yes');
    await extension(client);
    expect(client.telemetryEventStore).toHaveTelemetryEvents([
      { key: 'subcommand:remove', value: 'remove' },
    ]);
  });
});
