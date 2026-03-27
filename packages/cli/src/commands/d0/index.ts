import type Client from '../../util/client';
import { parseArguments } from '../../util/get-args';
import { getFlagsSpecification } from '../../util/get-flags-specification';
import { help } from '../help';
import { d0Command } from './command';
import { printError } from '../../util/error';
import output from '../../output-manager';
import { D0TelemetryClient } from '../../util/telemetry/commands/d0';
import { validateJsonOutput } from '../../util/output-format';

const D0_DEFAULT_URL = 'https://d0.vercel.dev';

interface D0TextDeltaEvent {
  type: 'text_delta';
  delta: string;
}

interface D0ToolCallStartEvent {
  type: 'tool_call_start';
  tool: string;
  input: unknown;
}

interface D0ToolResultEvent {
  type: 'tool_result';
  tool: string;
  output: unknown;
}

interface D0FinalizeReportEvent {
  type: 'finalize_report';
  sql: string | null;
  narrative: string | null;
  confidence: string | null;
  assumptions: string[] | null;
}

interface D0MessageCompleteEvent {
  type: 'message_complete';
  response_time_ms: number;
}

interface D0ErrorEvent {
  type: 'error';
  message: string;
}

type D0SseEvent =
  | D0TextDeltaEvent
  | D0ToolCallStartEvent
  | D0ToolResultEvent
  | D0FinalizeReportEvent
  | D0MessageCompleteEvent
  | D0ErrorEvent;

export default async function d0(client: Client): Promise<number> {
  const telemetry = new D0TelemetryClient({
    opts: { store: client.telemetryEventStore },
  });

  let parsedArgs;
  const flagsSpecification = getFlagsSpecification(d0Command.options);
  try {
    parsedArgs = parseArguments(client.argv.slice(2), flagsSpecification);
  } catch (err) {
    printError(err);
    return 1;
  }

  if (parsedArgs.flags['--help']) {
    telemetry.trackCliFlagHelp('d0');
    output.print(help(d0Command, { columns: client.stderr.columns }));
    return 0;
  }

  const formatResult = validateJsonOutput(parsedArgs.flags);
  if (!formatResult.valid) {
    output.error(formatResult.error);
    return 1;
  }
  const jsonOutput = formatResult.jsonOutput;

  telemetry.trackCliOptionChatId(parsedArgs.flags['--chat-id']);
  telemetry.trackCliFlagNoStream(parsedArgs.flags['--no-stream']);
  telemetry.trackCliOptionFormat(parsedArgs.flags['--format']);

  // Extract positional question (args[0] is the command name 'd0')
  const question = parsedArgs.args[1];

  if (!question) {
    if (!client.stdin.isTTY) {
      output.error(
        'Missing required argument. Use: vercel d0 "your question here"'
      );
      return 1;
    }
    output.print(help(d0Command, { columns: client.stderr.columns }));
    return 2;
  }

  const apiKey = process.env.D0_API_KEY;
  if (!apiKey) {
    output.error(
      'Missing D0_API_KEY environment variable. Set it to your d0 API key (d0_sk_live_...).'
    );
    return 1;
  }

  const baseUrl = process.env.D0_API_URL ?? D0_DEFAULT_URL;
  const bypassSecret = process.env.D0_PROTECTION_BYPASS_SECRET;
  const chatId = parsedArgs.flags['--chat-id'];
  const noStream = parsedArgs.flags['--no-stream'] ?? false;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (bypassSecret) {
    headers['x-vercel-protection-bypass'] = bypassSecret;
  }

  const body = JSON.stringify({
    question,
    ...(chatId ? { chat_id: chatId } : {}),
    stream: !noStream,
  });

  let response: Response;
  try {
    output.spinner('Asking d0...');
    response = await fetch(`${baseUrl}/api/v1/query`, {
      method: 'POST',
      headers,
      body,
    });
    output.stopSpinner();
  } catch (err) {
    output.stopSpinner();
    output.error(
      `Failed to connect to d0 at ${baseUrl}: ${(err as Error).message}`
    );
    return 1;
  }

  if (!response.ok) {
    let errorMsg = `d0 API returned ${response.status}`;
    try {
      const errBody = (await response.json()) as {
        error?: string;
        message?: string;
      };
      errorMsg = errBody.error ?? errBody.message ?? errorMsg;
    } catch {
      // ignore parse error
    }
    output.error(errorMsg);
    return 1;
  }

  const responseChatId = response.headers.get('X-Chat-Id');

  if (noStream) {
    return handleJsonResponse(response, responseChatId, jsonOutput, client);
  }

  return handleStreamResponse(response, responseChatId, jsonOutput, client);
}

async function handleJsonResponse(
  response: Response,
  chatId: string | null,
  jsonOutput: boolean,
  client: Client
): Promise<number> {
  let data: {
    chat_id?: string;
    turn_id?: string;
    question?: string;
    answer?: {
      sql: string | null;
      narrative: string | null;
      confidence: string | null;
      assumptions: string[] | null;
    } | null;
    response_time_ms?: number;
  };
  try {
    data = await response.json();
  } catch {
    output.error('Failed to parse d0 response');
    return 1;
  }

  if (jsonOutput) {
    output.stopSpinner();
    client.stdout.write(JSON.stringify(data, null, 2) + '\n');
  } else {
    const answer = data.answer;
    if (answer?.narrative) {
      output.print(answer.narrative + '\n');
    }
    if (answer?.sql) {
      output.print('\nSQL:\n' + answer.sql + '\n');
    }
    if (answer?.confidence) {
      output.print(`\nConfidence: ${answer.confidence}\n`);
    }
    if (answer?.assumptions && answer.assumptions.length > 0) {
      output.print('\nAssumptions:\n');
      for (const assumption of answer.assumptions) {
        output.print(`  - ${assumption}\n`);
      }
    }
    if (chatId) {
      output.log(`Chat ID: ${chatId}`);
    }
  }

  return 0;
}

async function handleStreamResponse(
  response: Response,
  chatId: string | null,
  jsonOutput: boolean,
  client: Client
): Promise<number> {
  if (!response.body) {
    output.error('d0 returned an empty streaming response');
    return 1;
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();

  // Accumulate events for JSON output mode
  const events: D0SseEvent[] = [];
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      // SSE messages are separated by '\n\n'
      const parts = buffer.split('\n\n');
      // Keep the last (possibly incomplete) part in the buffer
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const parsed = parseSseMessage(part);
        if (!parsed) {
          continue;
        }

        if (jsonOutput) {
          events.push(parsed);
          continue;
        }

        const exitCode = await handleSseEvent(parsed, chatId, client);
        if (exitCode !== null) {
          return exitCode;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (jsonOutput) {
    output.stopSpinner();
    client.stdout.write(
      JSON.stringify({ chat_id: chatId, events }, null, 2) + '\n'
    );
  }

  return 0;
}

function parseSseMessage(raw: string): D0SseEvent | null {
  const lines = raw.split('\n');
  let eventName = '';
  let dataLine = '';

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      eventName = line.slice('event: '.length).trim();
    } else if (line.startsWith('data: ')) {
      dataLine = line.slice('data: '.length).trim();
    }
  }

  if (!eventName || !dataLine || dataLine === '[DONE]') {
    return null;
  }

  try {
    const data = JSON.parse(dataLine) as D0SseEvent;
    return data;
  } catch {
    return null;
  }
}

async function handleSseEvent(
  event: D0SseEvent,
  chatId: string | null,
  client: Client
): Promise<number | null> {
  switch (event.type) {
    case 'text_delta': {
      output.stopSpinner();
      client.stdout.write(event.delta);
      break;
    }
    case 'tool_call_start': {
      output.spinner(`Running ${event.tool}...`);
      break;
    }
    case 'tool_result': {
      output.stopSpinner();
      break;
    }
    case 'finalize_report': {
      output.stopSpinner();
      if (event.sql) {
        output.print('\n\nSQL:\n' + event.sql + '\n');
      }
      if (event.confidence) {
        output.print(`\nConfidence: ${event.confidence}\n`);
      }
      if (event.assumptions && event.assumptions.length > 0) {
        output.print('\nAssumptions:\n');
        for (const assumption of event.assumptions) {
          output.print(`  - ${assumption}\n`);
        }
      }
      break;
    }
    case 'message_complete': {
      // Ensure we end on a new line after streamed text
      client.stdout.write('\n');
      if (chatId) {
        output.log(`Chat ID: ${chatId}`);
      }
      return 0;
    }
    case 'error': {
      output.stopSpinner();
      output.error(event.message);
      return 1;
    }
  }
  return null;
}
