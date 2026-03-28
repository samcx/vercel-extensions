import { TelemetryClient } from '../..';
import type { TelemetryMethods } from '../../types';
import type { supportCaseCommand } from '../../../../commands/support-case/command';

export class SupportCaseTelemetryClient
  extends TelemetryClient
  implements TelemetryMethods<typeof supportCaseCommand>
{
  trackCliSubcommandList(actual: string) {
    this.trackCliSubcommand({ subcommand: 'list', value: actual });
  }

  trackCliSubcommandShow(actual: string) {
    this.trackCliSubcommand({ subcommand: 'show', value: actual });
  }

  trackCliSubcommandClose(actual: string) {
    this.trackCliSubcommand({ subcommand: 'close', value: actual });
  }

  trackCliSubcommandTimeline(actual: string) {
    this.trackCliSubcommand({ subcommand: 'timeline', value: actual });
  }

  trackCliSubcommandChat(actual: string) {
    this.trackCliSubcommand({ subcommand: 'chat', value: actual });
  }
}
