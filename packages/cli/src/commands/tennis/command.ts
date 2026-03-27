import { packageName } from '../../util/pkg-name';

export const tennisCommand = {
  name: 'tennis',
  aliases: [],
  description: 'Outputs "tennis > pickleball".',
  arguments: [],
  options: [],
  examples: [
    {
      name: 'Print the tennis test message',
      value: `${packageName} tennis`,
    },
  ],
} as const;
