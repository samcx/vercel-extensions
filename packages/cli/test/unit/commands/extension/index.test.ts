import { describe, it, expect, beforeEach, vi } from 'vitest';
import { client } from '../../../mocks/client';
import extension from '../../../../src/commands/extension';

vi.mock('../../../../src/util/extension/registry', () => ({
  listInstalledExtensions: vi.fn(() => []),
  getInstalledExtension: vi.fn(() => null),
  getExtensionsDir: vi.fn(() => '/tmp/extensions'),
  isNameConflict: vi.fn(() => false),
  ensureExtensionsDir: vi.fn(() => '/tmp/extensions'),
}));

describe('extension (routing)', () => {
  beforeEach(() => {
    client.reset();
  });

  it('defaults to list when no subcommand given', async () => {
    client.setArgv('extension');
    const exitCode = await extension(client);
    expect(exitCode).toBe(0);
  });

  it('routes "ls" alias to list', async () => {
    client.setArgv('extension', 'ls');
    const exitCode = await extension(client);
    expect(exitCode).toBe(0);
  });

  it('shows parent help with --help', async () => {
    client.setArgv('extension', '--help');
    const exitCode = await extension(client);
    expect(exitCode).toBe(2);
    expect(client.telemetryEventStore).toHaveTelemetryEvents([
      { key: 'flag:help', value: 'extension' },
    ]);
  });

  it('shows install subcommand help', async () => {
    client.setArgv('extension', 'install', '--help');
    const exitCode = await extension(client);
    expect(exitCode).toBe(2);
  });
});
