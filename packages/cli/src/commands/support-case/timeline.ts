import { bold, gray, cyan, yellow } from 'chalk';
import type Client from '../../util/client';
import { parseArguments } from '../../util/get-args';
import { printError } from '../../util/error';
import { getFlagsSpecification } from '../../util/get-flags-specification';
import { timelineSubcommand } from './command';
import { validateJsonOutput } from '../../util/output-format';
import output from '../../output-manager';
import { getSupportScopeParams } from './scope';

interface TimelineAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  source: string;
  downloadUrl: string;
}

interface UserMessage {
  role: 'user';
  id: string;
  user: { id: string | null; name: string | null };
  origin: string;
  content: string;
  timestamp: number;
  attachments?: TimelineAttachment[];
}

interface AssistantMessage {
  role: 'assistant';
  id: string;
  actor: { id: string | null; name: string | null; type: string };
  origin: string;
  content: string;
  timestamp: number;
  attachments?: TimelineAttachment[];
}

interface SystemEvent {
  role: 'system';
  id: string;
  actor: { id: string | null; name: string | null; type: string } | null;
  timestamp: number;
  type: string;
  metadata: Record<string, unknown>;
}

type TimelineEntry = UserMessage | AssistantMessage | SystemEvent;

interface GetTimelineResponse {
  timeline: TimelineEntry[];
}

const HIDDEN_SYSTEM_EVENTS = new Set([
  'csatSurveySent',
  'reminderEmailSent',
  'autoCloseEmailSent',
]);

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

function formatSystemEvent(entry: SystemEvent): string | null {
  if (HIDDEN_SYSTEM_EVENTS.has(entry.type)) return null;

  const time = gray(formatTimestamp(entry.timestamp));
  const actorName = entry.actor?.name ?? 'System';

  switch (entry.type) {
    case 'statusChange': {
      const meta = entry.metadata as { from: string | null; to: string | null };
      return `${time} ${yellow('Status changed')}: ${meta.from ?? '?'} -> ${meta.to ?? '?'} (by ${actorName})`;
    }
    case 'priorityChange': {
      const meta = entry.metadata as {
        from: number | null;
        to: number | null;
      };
      return `${time} ${yellow('Priority changed')}: ${meta.from ?? '?'} -> ${meta.to ?? '?'} (by ${actorName})`;
    }
    case 'assignmentChange': {
      const meta = entry.metadata as {
        previousAssignee: { name: string } | null;
        nextAssignee: { name: string } | null;
      };
      const from = meta.previousAssignee?.name ?? 'unassigned';
      const to = meta.nextAssignee?.name ?? 'unassigned';
      return `${time} ${yellow('Reassigned')}: ${from} -> ${to}`;
    }
    default:
      return `${time} ${yellow(entry.type)}`;
  }
}

export default async function timeline(
  client: Client,
  argv: string[]
): Promise<number> {
  let parsedArgs;
  const flagsSpecification = getFlagsSpecification(timelineSubcommand.options);
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

  const params = await getSupportScopeParams(client);
  const query = params.toString();

  output.spinner('Fetching case timeline');
  const response = await client.fetch<GetTimelineResponse>(
    `/v1/support/cases/${encodeURIComponent(caseId)}/timeline${query ? `?${query}` : ''}`
  );
  output.stopSpinner();

  if (asJson) {
    client.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
    return 0;
  }

  const entries = response.timeline;

  if (entries.length === 0) {
    output.log('No timeline entries found.');
    return 0;
  }

  const lines: string[] = [''];

  for (const entry of entries) {
    if (entry.role === 'user') {
      const name = entry.user.name ?? 'User';
      const time = gray(formatTimestamp(entry.timestamp));
      lines.push(`${time} ${bold(cyan(name))} (via ${entry.origin}):`);
      lines.push(`  ${entry.content}`);
      if (entry.attachments && entry.attachments.length > 0) {
        for (const att of entry.attachments) {
          lines.push(`  ${gray(`📎 ${att.filename} (${att.contentType})`)}`);
        }
      }
      lines.push('');
    } else if (entry.role === 'assistant') {
      const name = entry.actor.name ?? 'Support';
      const time = gray(formatTimestamp(entry.timestamp));
      lines.push(`${time} ${bold(name)} (via ${entry.origin}):`);
      lines.push(`  ${entry.content}`);
      if (entry.attachments && entry.attachments.length > 0) {
        for (const att of entry.attachments) {
          lines.push(`  ${gray(`📎 ${att.filename} (${att.contentType})`)}`);
        }
      }
      lines.push('');
    } else if (entry.role === 'system') {
      const formatted = formatSystemEvent(entry);
      if (formatted) {
        lines.push(formatted);
        lines.push('');
      }
    }
  }

  client.stderr.write(lines.join('\n'));
  return 0;
}
