#!/usr/bin/env node

const D0_DEFAULT_URL = 'https://d0.vercel.dev';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  console.log(`
Usage: vercel d0 <question> [options]

  Ask d0 a natural-language question about your data.

Options:

  --chat-id <ID>   Continue a multi-turn conversation
  --no-stream      Wait for the full JSON response instead of streaming
  --help, -h       Show this help message

Environment Variables:

  D0_API_KEY                   Bearer token (d0_sk_live_...)
  D0_API_URL                   Base URL (default: ${D0_DEFAULT_URL})
  D0_PROTECTION_BYPASS_SECRET  Vercel deployment protection bypass

Examples:

  $ vercel d0 "What is our MRR this month?"
  $ vercel d0 "Break that down by plan" --chat-id <id>
  $ vercel d0 "What is our MRR?" --no-stream
`);
  process.exit(0);
}

// Parse args
let question = null;
let chatId = null;
let noStream = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--chat-id' && args[i + 1]) {
    chatId = args[++i];
  } else if (args[i] === '--no-stream') {
    noStream = true;
  } else if (!args[i].startsWith('--')) {
    question = args[i];
  }
}

if (!question) {
  console.error('Error: Missing required argument <question>');
  console.error('Usage: vercel d0 "your question here"');
  process.exit(1);
}

const apiKey = process.env.D0_API_KEY;
if (!apiKey) {
  console.error('Error: Missing D0_API_KEY environment variable. Set it to your d0 API key (d0_sk_live_...).');
  process.exit(1);
}

const baseUrl = process.env.D0_API_URL ?? D0_DEFAULT_URL;
const bypassSecret = process.env.D0_PROTECTION_BYPASS_SECRET;

const headers = {
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
};
if (bypassSecret) {
  headers['x-vercel-protection-bypass'] = bypassSecret;
}

async function main() {
  let response;
  try {
    response = await fetch(`${baseUrl}/api/v1/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question,
        ...(chatId ? { chat_id: chatId } : {}),
        stream: !noStream,
      }),
    });
  } catch (err) {
    console.error(`Error: Failed to connect to d0 at ${baseUrl}: ${err.message}`);
    process.exit(1);
  }

  if (!response.ok) {
    let errorMsg = `d0 API returned ${response.status}`;
    try {
      const body = await response.json();
      errorMsg = body.error ?? body.message ?? errorMsg;
    } catch {}
    console.error(`Error: ${errorMsg}`);
    process.exit(1);
  }

  const responseChatId = response.headers.get('x-chat-id');

  if (noStream) {
    const data = await response.json();
    const answer = data.answer;
    if (answer?.narrative) process.stdout.write(answer.narrative + '\n');
    if (answer?.sql) process.stdout.write('\nSQL:\n' + answer.sql + '\n');
    if (answer?.confidence) process.stdout.write(`\nConfidence: ${answer.confidence}\n`);
    if (answer?.assumptions?.length) {
      process.stdout.write('\nAssumptions:\n');
      for (const a of answer.assumptions) process.stdout.write(`  - ${a}\n`);
    }
    if (responseChatId) console.error(`> Chat ID: ${responseChatId}`);
    return;
  }

  // Streaming SSE
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const lines = part.split('\n');
      let eventName = '';
      let dataLine = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) eventName = line.slice(7).trim();
        else if (line.startsWith('data: ')) dataLine = line.slice(6).trim();
      }

      if (!eventName || !dataLine || dataLine === '[DONE]') continue;

      let data;
      try { data = JSON.parse(dataLine); } catch { continue; }

      switch (data.type) {
        case 'text_delta':
          process.stdout.write(data.delta);
          break;
        case 'finalize_report':
          if (data.sql) process.stdout.write('\n\nSQL:\n' + data.sql + '\n');
          if (data.confidence) process.stdout.write(`\nConfidence: ${data.confidence}\n`);
          if (data.assumptions?.length) {
            process.stdout.write('\nAssumptions:\n');
            for (const a of data.assumptions) process.stdout.write(`  - ${a}\n`);
          }
          break;
        case 'message_complete':
          process.stdout.write('\n');
          if (responseChatId) console.error(`> Chat ID: ${responseChatId}`);
          break;
        case 'error':
          console.error(`\nError: ${data.message}`);
          reader.releaseLock();
          process.exit(1);
      }
    }
  }
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
