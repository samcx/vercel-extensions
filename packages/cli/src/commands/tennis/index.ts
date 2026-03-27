import { help } from '../help';
import { tennisCommand } from './command';
import { parseArguments } from '../../util/get-args';
import type Client from '../../util/client';
import { getFlagsSpecification } from '../../util/get-flags-specification';
import { printError } from '../../util/error';
import output from '../../output-manager';
import { TennisTelemetryClient } from '../../util/telemetry/commands/tennis';

export default async function tennis(client: Client): Promise<number> {
  let parsedArgs = null;

  const flagsSpecification = getFlagsSpecification(tennisCommand.options);

  const telemetry = new TennisTelemetryClient({
    opts: {
      store: client.telemetryEventStore,
    },
  });

  try {
    parsedArgs = parseArguments(client.argv.slice(2), flagsSpecification);
  } catch (error) {
    printError(error);
    return 1;
  }

  if (parsedArgs.flags['--help']) {
    telemetry.trackCliFlagHelp('tennis');
    output.print(help(tennisCommand, { columns: client.stderr.columns }));
    return 0;
  }

  client.stdout.write('tennis > pickleball\n');
  return 0;
}
