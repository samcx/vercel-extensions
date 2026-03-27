import { rmSync } from 'fs';
import path from 'path';
import type Client from '../../util/client';
import {
  getExtensionsDir,
  getInstalledExtension,
} from '../../util/extension/registry';
import output from '../../output-manager';

export default async function remove(
  client: Client,
  args: string[]
): Promise<number> {
  const name = args[0];

  if (!name) {
    output.error('Missing required argument: name');
    return 1;
  }

  const ext = getInstalledExtension(name);

  if (!ext) {
    output.error(`Extension "${name}" is not installed.`);
    return 1;
  }

  const yes = client.argv.includes('--yes') || client.argv.includes('-y');

  if (!yes) {
    if (!client.stdin.isTTY) {
      output.error(`Pass --yes to remove "${name}" non-interactively.`);
      return 1;
    }

    const confirmed = await client.input.confirm(
      `Remove extension "${name}"?`,
      false
    );

    if (!confirmed) {
      output.log('Cancelled.');
      return 0;
    }
  }

  const extDir = path.join(getExtensionsDir(), `vercel-${name}`);
  rmSync(extDir, { recursive: true, force: true });
  output.success(`Extension "${name}" removed.`);
  return 0;
}
