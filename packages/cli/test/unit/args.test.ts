import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListInstalledExtensions = vi.hoisted(() => vi.fn(() => []));

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
        description: 'A Node-based tennis-flavored extension for the Vercel CLI.',
        path: '/tmp/extensions/vercel-tennis',
      },
    ]);

    expect(help()).toContain('Installed Extensions:');
    expect(help()).toContain(
      'tennis  A Node-based tennis-flavored extension for the Vercel CLI.'
    );
  });
});
