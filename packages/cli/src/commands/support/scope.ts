import type Client from '../../util/client';
import getScope from '../../util/get-scope';

export async function getSupportScopeParams(
  client: Client
): Promise<URLSearchParams> {
  const params = new URLSearchParams();
  const { team } = await getScope(client);
  if (team) {
    params.set('teamId', team.id);
    params.set('slug', team.slug);
  }
  return params;
}
