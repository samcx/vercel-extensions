import { printError } from '../../util/error';
import type Client from '../../util/client';
import { parseArguments } from '../../util/get-args';
import getSubcommand from '../../util/get-subcommand';
import { type Command, help } from '../help';
import list from './list';
import show from './show';
import close from './close';
import timeline from './timeline';
import chat from './chat';
import {
  supportCaseCommand,
  listSubcommand,
  showSubcommand,
  closeSubcommand,
  timelineSubcommand,
  chatSubcommand,
} from './command';
import { getFlagsSpecification } from '../../util/get-flags-specification';
import { SupportCaseTelemetryClient } from '../../util/telemetry/commands/support-case';
import output from '../../output-manager';
import { getCommandAliases } from '..';

const COMMAND_CONFIG = {
  list: getCommandAliases(listSubcommand),
  show: getCommandAliases(showSubcommand),
  close: getCommandAliases(closeSubcommand),
  timeline: getCommandAliases(timelineSubcommand),
  chat: getCommandAliases(chatSubcommand),
};

export default async function supportCase(client: Client) {
  const telemetry = new SupportCaseTelemetryClient({
    opts: {
      store: client.telemetryEventStore,
    },
  });

  let parsedArguments;
  const flagsSpecification = getFlagsSpecification(supportCaseCommand.options);

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
    telemetry.trackCliFlagHelp('support-case');
    output.print(help(supportCaseCommand, { columns: client.stderr.columns }));
    return 2;
  }

  function printHelp(command: Command) {
    output.print(
      help(command, {
        parent: supportCaseCommand,
        columns: client.stderr.columns,
      })
    );
  }

  switch (subcommand) {
    case 'show':
      if (needHelp) {
        telemetry.trackCliFlagHelp('support-case', subcommandOriginal);
        printHelp(showSubcommand);
        return 2;
      }
      telemetry.trackCliSubcommandShow(subcommandOriginal);
      return show(client, args);
    case 'close':
      if (needHelp) {
        telemetry.trackCliFlagHelp('support-case', subcommandOriginal);
        printHelp(closeSubcommand);
        return 2;
      }
      telemetry.trackCliSubcommandClose(subcommandOriginal);
      return close(client, args);
    case 'timeline':
      if (needHelp) {
        telemetry.trackCliFlagHelp('support-case', subcommandOriginal);
        printHelp(timelineSubcommand);
        return 2;
      }
      telemetry.trackCliSubcommandTimeline(subcommandOriginal);
      return timeline(client, args);
    case 'chat':
      if (needHelp) {
        telemetry.trackCliFlagHelp('support-case', subcommandOriginal);
        printHelp(chatSubcommand);
        return 2;
      }
      telemetry.trackCliSubcommandChat(subcommandOriginal);
      return chat(client, args);
    default:
      if (needHelp) {
        telemetry.trackCliFlagHelp('support-case', subcommandOriginal);
        printHelp(listSubcommand);
        return 2;
      }
      telemetry.trackCliSubcommandList(subcommandOriginal ?? 'list');
      return list(client, args);
  }
}
