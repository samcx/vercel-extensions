import { packageName } from '../../util/pkg-name';
import { yesOption } from '../../util/arg-common';

export const installSubcommand = {
  name: 'install',
  aliases: [],
  description: 'Install a Vercel CLI extension',
  arguments: [{ name: 'source', required: true }],
  options: [{ ...yesOption, description: 'Skip confirmation prompt' }],
  examples: [
    {
      name: 'Install from GitHub',
      value: `${packageName} extension install owner/vercel-hello`,
    },
    {
      name: 'Install from local path',
      value: `${packageName} extension install .`,
    },
  ],
} as const;

export const listSubcommand = {
  name: 'list',
  aliases: ['ls'],
  description: 'List installed extensions',
  arguments: [],
  options: [],
  examples: [
    {
      name: 'List all installed extensions',
      value: `${packageName} extension list`,
    },
  ],
} as const;

export const removeSubcommand = {
  name: 'remove',
  aliases: ['rm'],
  description: 'Remove an installed extension',
  arguments: [{ name: 'name', required: true }],
  options: [{ ...yesOption, description: 'Skip confirmation prompt' }],
  examples: [
    {
      name: 'Remove an extension',
      value: `${packageName} extension remove hello`,
    },
  ],
} as const;

export const upgradeSubcommand = {
  name: 'upgrade',
  aliases: ['update'],
  description: 'Upgrade installed extensions',
  arguments: [{ name: 'name', required: false }],
  options: [],
  examples: [
    {
      name: 'Upgrade all installed extensions',
      value: `${packageName} extension upgrade`,
    },
    {
      name: 'Upgrade one extension',
      value: `${packageName} extension upgrade hello`,
    },
  ],
} as const;

export const extensionCommand = {
  name: 'extension',
  aliases: ['ext'],
  description: 'Manage Vercel CLI extensions',
  arguments: [],
  subcommands: [
    installSubcommand,
    listSubcommand,
    removeSubcommand,
    upgradeSubcommand,
  ],
  options: [],
  examples: [],
} as const;
