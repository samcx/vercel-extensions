import type Client from '../../util/client';
import { listInstalledExtensions } from '../../util/extension/registry';
import table from '../../util/output/table';
import output from '../../output-manager';

export default async function list(_client: Client): Promise<number> {
  const extensions = listInstalledExtensions();

  if (extensions.length === 0) {
    output.log('No extensions installed.');
    return 0;
  }

  const rows = extensions.map(ext => [ext.name, ext.description]);
  output.print(table([['Name', 'Description'], ...rows], { hsep: 3 }));
  return 0;
}
