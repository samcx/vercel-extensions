import { describe, it, expect, beforeEach, vi } from 'vitest';
import { client } from '../../../mocks/client';
import extension from '../../../../src/commands/extension';

const mockListInstalledExtensions = vi.hoisted(() => vi.fn());

vi.mock('../../../../src/util/extension/registry', () => ({
  listInstalledExtensions: mockListInstalledExtensions,
  getInstalledExtension: vi.fn(),
  getExtensionsDir: vi.fn(),
  isNameConflict: vi.fn(),
  ensureExtensionsDir: vi.fn(),
}));

describe('extension list', () => {
  beforeEach(() => {
    client.reset();
    mockListInstalledExtensions.mockReturnValue([]);
  });

  it('shows "No extensions installed." when empty', async () => {
    client.setArgv('extension', 'ls');
    const exitCode = await extension(client);
    expect(exitCode).toBe(0);
    await expect(client.stderr).toOutput('No extensions installed.');
  });

  it('lists installed extensions', async () => {
    mockListInstalledExtensions.mockReturnValue([
      {
        name: 'hello',
        description: 'A hello extension',
        path: '/ext/vercel-hello',
      },
    ]);
    client.setArgv('extension', 'ls');
    const exitCode = await extension(client);
    expect(exitCode).toBe(0);
  });

  it('tracks telemetry', async () => {
    client.setArgv('extension', 'ls');
    await extension(client);
    expect(client.telemetryEventStore).toHaveTelemetryEvents([
      { key: 'subcommand:list', value: 'ls' },
    ]);
  });

  it('shows help with --help', async () => {
    client.setArgv('extension', 'list', '--help');
    const exitCode = await extension(client);
    expect(exitCode).toBe(2);
  });
});
