import { packageName } from '../../util/pkg-name';
import { formatOption, yesOption } from '../../util/arg-common';

export const listSubcommand = {
  name: 'list',
  aliases: ['ls'],
  description: 'List support cases for the authenticated team',
  arguments: [],
  options: [
    {
      name: 'status',
      shorthand: null,
      type: String,
      argument: 'STATUS',
      description:
        'Filter by status (open, closed, transferred). Defaults to all.',
      deprecated: false,
    },
    {
      name: 'sort',
      shorthand: null,
      type: String,
      argument: 'FIELD',
      description: 'Sort by field (createdAt, updatedAt, severity)',
      deprecated: false,
    },
    {
      name: 'limit',
      shorthand: null,
      type: Number,
      argument: 'NUMBER',
      description: 'Number of results to return (default: 10, max: 100)',
      deprecated: false,
    },
    {
      name: 'offset',
      shorthand: null,
      type: Number,
      argument: 'NUMBER',
      description: 'Offset for pagination (default: 0)',
      deprecated: false,
    },
    {
      name: 'project',
      shorthand: null,
      type: String,
      argument: 'ID',
      description: 'Filter by project ID',
      deprecated: false,
    },
    formatOption,
  ],
  examples: [
    {
      name: 'List all open support cases',
      value: `${packageName} support list --status open`,
    },
    {
      name: 'List cases sorted by severity',
      value: `${packageName} support list --sort severity`,
    },
    {
      name: 'List cases as JSON',
      value: `${packageName} support list --format json`,
    },
  ],
} as const;

export const showSubcommand = {
  name: 'show',
  aliases: ['inspect'],
  description: 'Get details for a specific support case',
  arguments: [{ name: 'caseId', required: true }],
  options: [formatOption],
  examples: [
    {
      name: 'Show case details',
      value: `${packageName} support show <caseId>`,
    },
    {
      name: 'Show case details as JSON',
      value: `${packageName} support show <caseId> --format json`,
    },
  ],
} as const;

export const closeSubcommand = {
  name: 'close',
  aliases: [],
  description: 'Close a support case',
  arguments: [{ name: 'caseId', required: true }],
  options: [{ ...yesOption, description: 'Skip confirmation prompt' }],
  examples: [
    {
      name: 'Close a support case',
      value: `${packageName} support close <caseId>`,
    },
    {
      name: 'Close without confirmation',
      value: `${packageName} support close <caseId> --yes`,
    },
  ],
} as const;

export const timelineSubcommand = {
  name: 'timeline',
  aliases: [],
  description: 'View the timeline of messages and events for a support case',
  arguments: [{ name: 'caseId', required: true }],
  options: [formatOption],
  examples: [
    {
      name: 'View case timeline',
      value: `${packageName} support timeline <caseId>`,
    },
    {
      name: 'View timeline as JSON',
      value: `${packageName} support timeline <caseId> --format json`,
    },
  ],
} as const;

export const chatSubcommand = {
  name: 'chat',
  aliases: [],
  description: 'View Vertex AI chat messages for a support case',
  arguments: [{ name: 'caseId', required: true }],
  options: [
    {
      name: 'limit',
      shorthand: null,
      type: Number,
      argument: 'NUMBER',
      description: 'Number of messages to return (default: 100, max: 200)',
      deprecated: false,
    },
    {
      name: 'cursor',
      shorthand: null,
      type: Number,
      argument: 'ID',
      description: 'Cursor for pagination (message ID)',
      deprecated: false,
    },
    formatOption,
  ],
  examples: [
    {
      name: 'View chat messages',
      value: `${packageName} support chat <caseId>`,
    },
    {
      name: 'View chat messages as JSON',
      value: `${packageName} support chat <caseId> --format json`,
    },
  ],
} as const;

export const supportCommand = {
  name: 'support',
  aliases: [],
  description: 'Manage Vercel support cases',
  arguments: [],
  subcommands: [
    listSubcommand,
    showSubcommand,
    closeSubcommand,
    timelineSubcommand,
    chatSubcommand,
  ],
  options: [],
  examples: [],
} as const;
