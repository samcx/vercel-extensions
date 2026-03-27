import type Client from '../../util/client';
import { parseArguments } from '../../util/get-args';
import { printError } from '../../util/error';
import { getFlagsSpecification } from '../../util/get-flags-specification';
import { closeSubcommand } from './command';
import output from '../../output-manager';

interface SupportCase {
  id: string | null;
  title: string;
  status: string;
  createdAt: number;
}

interface UpdateCaseResponse {
  case: SupportCase;
}

export default async function close(
  client: Client,
  argv: string[]
): Promise<number> {
  let parsedArgs;
  const flagsSpecification = getFlagsSpecification(closeSubcommand.options);
  try {
    parsedArgs = parseArguments(argv, flagsSpecification);
  } catch (error) {
    printError(error);
    return 1;
  }

  const caseId = parsedArgs.args[0];
  if (!caseId) {
    output.error('Missing required argument: caseId');
    return 1;
  }

  const yes = parsedArgs.flags['--yes'];

  if (!yes) {
    if (!client.stdin.isTTY) {
      output.error('Pass --yes to close a case non-interactively.');
      return 1;
    }

    const confirmed = await client.input.confirm(
      `Close support case "${caseId}"?`,
      false
    );
    if (!confirmed) {
      output.log('Cancelled.');
      return 0;
    }
  }

  output.spinner('Closing support case');
  const response = await client.fetch<UpdateCaseResponse>(
    `/v1/support/cases/${encodeURIComponent(caseId)}`,
    {
      method: 'PATCH',
      body: { status: 'closed' },
    }
  );
  output.stopSpinner();

  output.success(
    `Support case "${response.case.title}" (${response.case.id}) has been closed.`
  );
  return 0;
}
