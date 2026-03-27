import { beforeEach, describe, expect, it, vi } from 'vitest';

type InstalledExtension = {
  name: string;
  description: string;
  path: string;
  commands: Array<{
    name: string;
    description: string;
  }>;
};

const mockListInstalledExtensions = vi.hoisted(() =>
  vi.fn<() => InstalledExtension[]>(() => [])
);

vi.mock('../../src/util/extension/registry', () => ({
  listInstalledExtensions: mockListInstalledExtensions,
}));

import { help } from '../../src/args';

describe('base level help output', () => {
  beforeEach(() => {
    mockListInstalledExtensions.mockReturnValue([]);
  });

  it('help', () => {
    expect(help()).toMatchSnapshot();
  });

  it('shows installed extensions with descriptions', () => {
    mockListInstalledExtensions.mockReturnValue([
      {
        name: 'tennis',
        description:
          'A Node-based tennis-flavored extension for the Vercel CLI.',
        path: '/tmp/extensions/vercel-tennis',
        commands: [],
      },
    ]);

    expect(help()).toContain('Installed Extensions:');
    expect(help()).toContain(
      'tennis  A Node-based tennis-flavored extension for the Vercel CLI.'
    );
  });

  it('shows installed extension subcommands', () => {
    mockListInstalledExtensions.mockReturnValue([
      {
        name: 'tennis',
        description:
          'A Node-based tennis-flavored extension for the Vercel CLI.',
        path: '/tmp/extensions/vercel-tennis',
        commands: [
          {
            name: 'livescores',
            description: 'Fetch live tennis scores',
          },
        ],
      },
    ]);

    expect(help()).toContain('tennis livescores  Fetch live tennis scores');
  });
});
