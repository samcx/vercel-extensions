import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
} from 'fs';
import os from 'os';
import path from 'path';
import execa from 'execa';
import type Client from '../../util/client';
import {
  ensureExtensionsDir,
  getInstalledExtension,
  isNameConflict,
} from '../../util/extension/registry';
import output from '../../output-manager';

function parseSource(
  source: string
):
  | { type: 'github'; owner: string; repo: string }
  | { type: 'local'; absPath: string }
  | null {
  const ghMatch = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/.exec(source);
  if (ghMatch) {
    return { type: 'github', owner: ghMatch[1], repo: ghMatch[2] };
  }

  if (source === '.' || source.startsWith('./') || source.startsWith('/')) {
    return { type: 'local', absPath: path.resolve(source) };
  }

  return null;
}

function getExtensionNameFromRepo(repo: string): string {
  return repo.startsWith('vercel-') ? repo.slice('vercel-'.length) : repo;
}

function validatePackageJson(dir: string, expectedName: string): string | null {
  const pkgPath = path.join(dir, 'package.json');
  let pkg: { bin?: unknown };

  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    return null;
  }

  const binKey = `vercel-${expectedName}`;
  const { bin } = pkg;

  if (typeof bin === 'string') {
    return path.join(dir, bin);
  }

  if (bin && typeof bin === 'object') {
    const bins = bin as Record<string, unknown>;
    if (typeof bins[binKey] === 'string') {
      return path.join(dir, bins[binKey] as string);
    }
  }

  return null;
}

export default async function install(
  client: Client,
  args: string[]
): Promise<number> {
  const source = args[0];

  if (!source) {
    output.error('Missing required argument: source');
    return 1;
  }

  const parsed = parseSource(source);
  if (!parsed) {
    output.error(`Invalid source "${source}". Use owner/repo or a local path.`);
    return 1;
  }

  const yes = client.argv.includes('--yes') || client.argv.includes('-y');
  const extensionsDir = ensureExtensionsDir();

  if (parsed.type === 'github') {
    const { owner, repo } = parsed;
    const name = getExtensionNameFromRepo(repo);

    if (isNameConflict(name)) {
      output.error(
        `Cannot install extension "${name}": conflicts with a built-in command.`
      );
      return 1;
    }

    if (getInstalledExtension(name)) {
      output.error(`Extension "${name}" is already installed.`);
      return 1;
    }

    if (!yes) {
      if (!client.stdin.isTTY) {
        output.error(`Pass --yes to install "${name}" non-interactively.`);
        return 1;
      }

      output.warn(
        `Installing "${name}" from ${owner}/${repo} will execute code on your machine.`
      );
      const confirmed = await client.input.confirm(
        `Install extension "${name}" from ${owner}/${repo}?`,
        false
      );

      if (!confirmed) {
        output.log('Cancelled.');
        return 0;
      }
    }

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'vercel-ext-'));
    const destDir = path.join(extensionsDir, `vercel-${name}`);

    try {
      const url = `https://github.com/${owner}/${repo}.git`;
      await execa('git', ['clone', '--depth', '1', url, tmpDir], {
        stdio: 'inherit',
      });

      const binPath = validatePackageJson(tmpDir, name);
      if (!binPath) {
        output.error(
          `Repository ${owner}/${repo} does not have a valid package.json with a "vercel-${name}" bin entry.`
        );
        return 1;
      }

      renameSync(tmpDir, destDir);
      output.success(`Installed extension "${name}" from ${owner}/${repo}.`);
      return 0;
    } catch (err: unknown) {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {}

      output.error(
        `Failed to install extension "${name}": ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return 1;
    }
  }

  const { absPath } = parsed;
  let pkg: { bin?: unknown };

  try {
    pkg = JSON.parse(readFileSync(path.join(absPath, 'package.json'), 'utf8'));
  } catch {
    output.error(`No package.json found at ${absPath}.`);
    return 1;
  }

  const { bin } = pkg;
  let name: string | null = null;

  if (typeof bin === 'object' && bin !== null) {
    const binKey = Object.keys(bin).find(key => key.startsWith('vercel-'));
    if (binKey) {
      name = binKey.slice('vercel-'.length);
    }
  }

  if (!name) {
    output.error(
      `package.json at ${absPath} has no bin entry starting with "vercel-".`
    );
    return 1;
  }

  if (isNameConflict(name)) {
    output.error(
      `Cannot install extension "${name}": conflicts with a built-in command.`
    );
    return 1;
  }

  const destDir = path.join(extensionsDir, `vercel-${name}`);
  if (existsSync(destDir)) {
    output.error(`Extension "${name}" is already installed.`);
    return 1;
  }

  cpSync(absPath, destDir, { recursive: true });
  output.success(`Installed extension "${name}" from ${absPath}.`);
  return 0;
}
