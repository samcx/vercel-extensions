import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import getGlobalPathConfig from '../config/global-path';
import { commands } from '../../commands/index';

const EXTENSION_PREFIX = 'vercel-';

type ExtensionCommand = {
  name: string;
  description: string;
};

type InstalledExtension = {
  name: string;
  description: string;
  path: string;
  commands: ExtensionCommand[];
};

export function getExtensionsDir(): string {
  return path.join(getGlobalPathConfig(), 'extensions');
}

export function ensureExtensionsDir(): string {
  const extensionsDir = getExtensionsDir();
  mkdirSync(extensionsDir, { recursive: true });
  return extensionsDir;
}

export function getInstalledExtensionNames(): string[] {
  try {
    const extensionDirs = readdirSync(getExtensionsDir(), {
      withFileTypes: true,
    }).filter(
      entry =>
        (entry.isDirectory() || entry.isSymbolicLink()) &&
        entry.name.startsWith(EXTENSION_PREFIX)
    );

    return extensionDirs
      .map(entry => entry.name.slice(EXTENSION_PREFIX.length))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export function listInstalledExtensions(): InstalledExtension[] {
  try {
    const extensionsDir = getExtensionsDir();

    if (!existsSync(extensionsDir)) {
      return [];
    }

    const extensionDirs = readdirSync(extensionsDir, {
      withFileTypes: true,
    }).filter(
      entry =>
        (entry.isDirectory() || entry.isSymbolicLink()) &&
        entry.name.startsWith(EXTENSION_PREFIX)
    );

    return extensionDirs
      .map(entry => {
        const extensionPath = path.join(extensionsDir, entry.name);
        const packageJsonPath = path.join(extensionPath, 'package.json');

        let description = '(no description)';
        let commands: ExtensionCommand[] = [];

        try {
          const packageJson = JSON.parse(
            readFileSync(packageJsonPath, 'utf8')
          ) as {
            description?: unknown;
            vercelExtension?: {
              commands?: Array<{
                name?: unknown;
                description?: unknown;
              }>;
            };
          };
          if (typeof packageJson.description === 'string') {
            description = packageJson.description;
          }
          if (Array.isArray(packageJson.vercelExtension?.commands)) {
            commands = packageJson.vercelExtension.commands.flatMap(command => {
              if (
                typeof command.name !== 'string' ||
                typeof command.description !== 'string'
              ) {
                return [];
              }

              return [
                {
                  name: command.name,
                  description: command.description,
                },
              ];
            });
          }
        } catch {}

        return {
          name: entry.name.slice(EXTENSION_PREFIX.length),
          description,
          path: extensionPath,
          commands,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export function getInstalledExtension(
  name: string
): { name: string; path: string; binPath: string } | null {
  const packageName = `${EXTENSION_PREFIX}${name}`;
  const extensionPath = path.join(getExtensionsDir(), packageName);

  if (!existsSync(extensionPath)) {
    return null;
  }

  try {
    if (!statSync(extensionPath).isDirectory()) {
      return null;
    }
  } catch {
    return null;
  }

  const packageJsonPath = path.join(extensionPath, 'package.json');

  let packageJson: { bin?: unknown };
  try {
    packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      bin?: unknown;
    };
  } catch {
    return null;
  }

  const { bin } = packageJson;
  let binEntry: string | null = null;

  if (typeof bin === 'string') {
    binEntry = bin;
  } else if (bin && typeof bin === 'object') {
    const bins = bin as Record<string, unknown>;
    const commandBin = bins[packageName];
    if (typeof commandBin === 'string') {
      binEntry = commandBin;
    }
  }

  if (!binEntry) {
    return null;
  }

  return {
    name,
    path: extensionPath,
    binPath: path.join(extensionPath, binEntry),
  };
}

export function isNameConflict(name: string): boolean {
  return commands.has(name);
}
