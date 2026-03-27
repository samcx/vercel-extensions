import { describe, expect, it } from 'vitest';
import tennis from '../../../../src/commands/tennis';
import { client } from '../../../mocks/client';

describe('tennis', () => {
  it('prints the tennis test message to stdout', async () => {
    client.setArgv('tennis');

    const exitCode = await tennis(client);

    expect(exitCode).toBe(0);
    expect(client.stdout.getFullOutput()).toBe('tennis > pickleball\n');
  });

  it('tracks help telemetry', async () => {
    client.setArgv('tennis', '--help');

    await expect(tennis(client)).resolves.toBe(0);
    expect(client.telemetryEventStore).toHaveTelemetryEvents([
      {
        key: 'flag:help',
        value: 'tennis',
      },
    ]);
  });
});
