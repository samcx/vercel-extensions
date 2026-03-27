import { TelemetryClient } from '../..';
import type { TelemetryMethods } from '../../types';
import type { extensionCommand } from '../../../../commands/extension/command';

export class ExtensionTelemetryClient
  extends TelemetryClient
  implements TelemetryMethods<typeof extensionCommand>
{
  trackCliSubcommandInstall(actual: string) {
    this.trackCliSubcommand({ subcommand: 'install', value: actual });
  }

  trackCliSubcommandList(actual: string) {
    this.trackCliSubcommand({ subcommand: 'list', value: actual });
  }

  trackCliSubcommandRemove(actual: string) {
    this.trackCliSubcommand({ subcommand: 'remove', value: actual });
  }

  trackCliSubcommandSkills(actual: string) {
    this.trackCliSubcommand({ subcommand: 'skills', value: actual });
  }

  trackCliSubcommandUpgrade(actual: string) {
    this.trackCliSubcommand({ subcommand: 'upgrade', value: actual });
  }
}
