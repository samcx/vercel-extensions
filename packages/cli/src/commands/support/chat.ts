import { bold, cyan } from 'chalk';
import { packageName } from '../../util/pkg-name';
import cmd from '../../util/output/cmd';
import type Client from '../../util/client';
import { parseArguments } from '../../util/get-args';
import { printError } from '../../util/error';
import { getFlagsSpecification } from '../../util/get-flags-specification';
import { chatSubcommand } from './command';
import { validateJsonOutput } from '../../util/output-format';
import output from '../../output-manager';

interface ChatMessage {
  role?: string;
  content?: string;
  [key: string]: unknown;
}

interface GetChatResponse {
  messages: (ChatMessage | null)[];
  hasMore: boolean;
  nextCursor?: number;
}

export default async function chat(
  client: Client,
  argv: string[]
): Promise<number> {
  let parsedArgs;
  const flagsSpecification = getFlagsSpecification(chatSubcommand.options);
  try {
    parsedArgs = parseArguments(argv, flagsSpecification);
  } catch (error) {
    printError(error);
    return 1;
  }

  const formatResult = validateJsonOutput(parsedArgs.flags);
  if (!formatResult.valid) {
    output.error(formatResult.error);
    return 1;
  }
  const asJson = formatResult.jsonOutput;

  const caseId = parsedArgs.args[0];
  if (!caseId) {
    output.error('Missing required argument: caseId');
    return 1;
  }

  const limit = parsedArgs.flags['--limit'] as number | undefined;
  const cursor = parsedArgs.flags['--cursor'] as number | undefined;

  if (limit !== undefined && (limit < 1 || limit > 200)) {
    output.error('Limit must be between 1 and 200');
    return 1;
  }

  const params = new URLSearchParams();
  if (limit !== undefined) params.set('limit', String(limit));
  if (cursor !== undefined) params.set('cursor', String(cursor));

  const query = params.toString();
  const url = `/v1/support/cases/${encodeURIComponent(caseId)}/chat${query ? `?${query}` : ''}`;

  output.spinner('Fetching chat messages');
  const response = await client.fetch<GetChatResponse>(url);
  output.stopSpinner();

  if (asJson) {
    client.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
    return 0;
  }

  const messages = response.messages.filter(
    (m): m is ChatMessage => m !== null
  );

  if (messages.length === 0) {
    output.log('No chat messages found.');
    return 0;
  }

  const lines: string[] = [''];

  for (const msg of messages) {
    const role = msg.role ?? 'unknown';
    const content =
      typeof msg.content === 'string' ? msg.content : JSON.stringify(msg);

    if (role === 'user') {
      lines.push(`  ${bold(cyan('You'))}:`);
    } else if (role === 'assistant') {
      lines.push(`  ${bold('Assistant')}:`);
    } else {
      lines.push(`  ${bold(role)}:`);
    }

    lines.push(`  ${content}`);
    lines.push('');
  }

  client.stderr.write(lines.join('\n'));

  if (response.hasMore && response.nextCursor !== undefined) {
    const nextCmd = `${packageName} support chat ${caseId} --cursor ${response.nextCursor}`;
    output.log(`To display the next page run ${cmd(nextCmd)}`);
  }

  return 0;
}
