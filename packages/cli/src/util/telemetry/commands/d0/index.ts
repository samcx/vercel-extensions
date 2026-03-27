import { TelemetryClient } from '../..';

export class D0TelemetryClient extends TelemetryClient {
  trackCliOptionChatId(v: string | undefined) {
    if (v) {
      this.trackCliOption({
        option: 'chat-id',
        value: this.redactedValue,
      });
    }
  }

  trackCliFlagNoStream(v: boolean | undefined) {
    if (v) {
      this.trackCliFlag('no-stream');
    }
  }

  trackCliOptionFormat(v: string | undefined) {
    if (v) {
      this.trackCliOption({
        option: 'format',
        value: v,
      });
    }
  }
}
