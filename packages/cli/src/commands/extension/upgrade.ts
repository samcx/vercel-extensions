import execa from 'execa';
import type Client from '../../util/client';
import {
  getInstalledExtension,
  listInstalledExtensions,
} from '../../util/extension/registry';
import output from '../../output-manager';

export default async function upgrade(
  _client: Client,
  args: string[]
): Promise<number> {
  const name = args[0];
  const targets = name
    ? [getInstalledExtension(name)].filter(
        (
          extension
        ): extension is NonNullable<ReturnType<typeof getInstalledExtension>> =>
          extension !== null
      )
    : listInstalledExtensions().map(extension => ({
        name: extension.name,
        path: extension.path,
      }));

  if (name && targets.length === 0) {
    output.error(`Extension "${name}" is not installed.`);
    return 1;
  }

  if (targets.length === 0) {
    output.log('No extensions installed.');
    return 0;
  }

  let failures = 0;

  for (const extension of targets) {
    try {
      await execa('git', ['-C', extension.path, 'pull', '--ff-only'], {
        stdio: 'inherit',
      });
      output.success(`Upgraded extension "${extension.name}".`);
    } catch (err: unknown) {
      failures++;
      output.error(
        `Failed to upgrade extension "${extension.name}": ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  if (targets.length > 1 && failures === 0) {
    output.success(`Upgraded ${targets.length} extensions.`);
  }

  return failures === 0 ? 0 : 1;
}
