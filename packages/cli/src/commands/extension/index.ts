import { printError } from '../../util/error';
import type Client from '../../util/client';
import { parseArguments } from '../../util/get-args';
import getSubcommand from '../../util/get-subcommand';
import { type Command, help } from '../help';
import list from './list';
import remove from './remove';
import install from './install';
import upgrade from './upgrade';
import {
  extensionCommand,
  installSubcommand,
  listSubcommand,
  removeSubcommand,
  upgradeSubcommand,
} from './command';
import { getFlagsSpecification } from '../../util/get-flags-specification';
import { ExtensionTelemetryClient } from '../../util/telemetry/commands/extension';
import output from '../../output-manager';
import { getCommandAliases } from '..';

const COMMAND_CONFIG = {
  install: getCommandAliases(installSubcommand),
  ls: getCommandAliases(listSubcommand),
  rm: getCommandAliases(removeSubcommand),
  update: getCommandAliases(upgradeSubcommand),
};

export default async function extension(client: Client) {
  const telemetry = new ExtensionTelemetryClient({
    opts: {
      store: client.telemetryEventStore,
    },
  });

  let parsedArguments;
  const flagsSpecification = getFlagsSpecification(extensionCommand.options);

  try {
    parsedArguments = parseArguments(client.argv.slice(2), flagsSpecification, {
      permissive: true,
    });
  } catch (err) {
    printError(err);
    return 1;
  }

  const { subcommand, args, subcommandOriginal } = getSubcommand(
    parsedArguments.args.slice(1),
    COMMAND_CONFIG
  );

  const needHelp = parsedArguments.flags['--help'];

  if (!subcommand && needHelp) {
    telemetry.trackCliFlagHelp('extension');
    output.print(help(extensionCommand, { columns: client.stderr.columns }));
    return 2;
  }

  function printHelp(command: Command) {
    output.print(
      help(command, {
        parent: extensionCommand,
        columns: client.stderr.columns,
      })
    );
  }

  switch (subcommand) {
    case 'install':
      if (needHelp) {
        telemetry.trackCliFlagHelp('extension', subcommandOriginal);
        printHelp(installSubcommand);
        return 2;
      }
      telemetry.trackCliSubcommandInstall(subcommandOriginal);
      return install(client, args);
    case 'rm':
      if (needHelp) {
        telemetry.trackCliFlagHelp('extension', subcommandOriginal);
        printHelp(removeSubcommand);
        return 2;
      }
      telemetry.trackCliSubcommandRemove(subcommandOriginal);
      return remove(client, args);
    case 'update':
      if (needHelp) {
        telemetry.trackCliFlagHelp('extension', subcommandOriginal);
        printHelp(upgradeSubcommand);
        return 2;
      }
      telemetry.trackCliSubcommandUpgrade(subcommandOriginal);
      return upgrade(client, args);
    default:
      if (needHelp) {
        telemetry.trackCliFlagHelp('extension', subcommandOriginal);
        printHelp(listSubcommand);
        return 2;
      }
      telemetry.trackCliSubcommandList(subcommandOriginal ?? 'ls');
      return list(client);
  }
}
