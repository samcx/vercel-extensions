import { formatOption } from '../../util/arg-common';
import { packageName } from '../../util/pkg-name';

export const d0Command = {
  name: 'd0',
  aliases: [],
  description: 'Ask d0 a natural-language question about your data.',
  arguments: [{ name: 'question', required: true }],
  options: [
    {
      name: 'chat-id',
      shorthand: null,
      type: String,
      argument: 'ID',
      deprecated: false,
      description: 'Continue a multi-turn conversation by providing a chat ID',
    },
    {
      name: 'no-stream',
      shorthand: null,
      type: Boolean,
      deprecated: false,
      description: 'Wait for the full response instead of streaming',
    },
    formatOption,
  ],
  examples: [
    {
      name: 'Ask d0 a question',
      value: `${packageName} d0 "What is our MRR this month?"`,
    },
    {
      name: 'Continue a multi-turn conversation',
      value: `${packageName} d0 "Break that down by plan" --chat-id <id>`,
    },
    {
      name: 'Get a full JSON response',
      value: `${packageName} d0 "What is our MRR?" --no-stream --format json`,
    },
  ],
} as const;
