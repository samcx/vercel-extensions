import { cpSync, existsSync, mkdirSync, statSync } from 'fs';
import path from 'path';
import type Client from '../../util/client';
import { listInstalledExtensions } from '../../util/extension/registry';
import output from '../../output-manager';

export default async function skills(
  _client: Client,
  args: string[]
): Promise<number> {
  const target = args[0];

  if (!target) {
    output.error('Missing required argument: target directory');
    return 1;
  }

  const targetDir = path.resolve(target);
  mkdirSync(targetDir, { recursive: true });
  const extensions = listInstalledExtensions();

  if (extensions.length === 0) {
    output.log('No extensions installed.');
    return 0;
  }

  let copied = 0;

  for (const ext of extensions) {
    const candidates = [
      path.join(ext.path, 'skills'),
      path.join(ext.path, '.agents', 'skills'),
    ];

    const skillsDir = candidates.find(dir => {
      try {
        return existsSync(dir) && statSync(dir).isDirectory();
      } catch {
        return false;
      }
    });

    if (!skillsDir) {
      continue;
    }

    const dest = path.join(targetDir, ext.name);
    cpSync(skillsDir, dest, { recursive: true });
    output.log(`Copied skills from "${ext.name}" to ${dest}`);
    copied++;
  }

  if (copied === 0) {
    output.log('No installed extensions contain a skills directory.');
    return 0;
  }

  output.success(
    `Copied skills from ${copied} extension${copied > 1 ? 's' : ''} into ${targetDir}`
  );
  return 0;
}
