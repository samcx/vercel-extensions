import { bold, gray, cyan } from 'chalk';
import type Client from '../../util/client';
import { parseArguments } from '../../util/get-args';
import { printError } from '../../util/error';
import { getFlagsSpecification } from '../../util/get-flags-specification';
import { showSubcommand } from './command';
import { validateJsonOutput } from '../../util/output-format';
import output from '../../output-manager';
import { getSupportScopeParams } from './scope';

interface SupportCase {
  id: string | null;
  salesforceCaseNumber: string | null;
  title: string;
  description: string | null;
  status: string;
  severity: number | null;
  creatorUserId: string | null;
  teamId: string | null;
  teamSlug: string | null;
  projectId: string | null;
  createdAt: number;
  updatedAt: number | null;
  lockedAt: number | null;
}

interface GetCaseResponse {
  case: SupportCase;
}

function formatTimestamp(ts: number | null): string {
  if (ts === null) return '-';
  return new Date(ts).toLocaleString();
}

function severityLabel(severity: number | null): string {
  if (severity === null) return '-';
  const labels: Record<number, string> = {
    1: '1 (Critical)',
    2: '2 (High)',
    3: '3 (Normal)',
    4: '4 (Low)',
  };
  return labels[severity] ?? String(severity);
}

export default async function show(
  client: Client,
  argv: string[]
): Promise<number> {
  let parsedArgs;
  const flagsSpecification = getFlagsSpecification(showSubcommand.options);
  try {
    parsedArgs = parseArguments(argv, flagsSpecification);
  } catch (error) {
    printError(error);
    return 1;
  }

  const formatResult = validateJsonOutput(parsedArgs.flags);
  if (!formatResult.valid) {
    output.error(formatResult.error);
    return 1;
  }
  const asJson = formatResult.jsonOutput;

  const caseId = parsedArgs.args[0];
  if (!caseId) {
    output.error('Missing required argument: caseId');
    return 1;
  }

  const params = await getSupportScopeParams(client);
  const query = params.toString();

  output.spinner('Fetching support case');
  const response = await client.fetch<GetCaseResponse>(
    `/v1/support/cases/${encodeURIComponent(caseId)}${query ? `?${query}` : ''}`
  );
  output.stopSpinner();

  const supportCase = response.case;

  if (asJson) {
    client.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
  } else {
    const lines: string[] = [
      '',
      `  ${bold(supportCase.title)}`,
      '',
      `  ${gray('Case ID')}         ${supportCase.id ?? '-'}`,
      `  ${gray('Status')}          ${supportCase.status}`,
      `  ${gray('Severity')}        ${severityLabel(supportCase.severity)}`,
      `  ${gray('Created')}         ${formatTimestamp(supportCase.createdAt)}`,
      `  ${gray('Updated')}         ${formatTimestamp(supportCase.updatedAt)}`,
    ];

    if (supportCase.salesforceCaseNumber) {
      lines.push(
        `  ${gray('SF Case #')}       ${supportCase.salesforceCaseNumber}`
      );
    }
    if (supportCase.teamSlug) {
      lines.push(`  ${gray('Team')}            ${supportCase.teamSlug}`);
    }
    if (supportCase.projectId) {
      lines.push(`  ${gray('Project')}         ${supportCase.projectId}`);
    }

    if (supportCase.description) {
      lines.push('');
      lines.push(`  ${cyan('Description')}`);
      lines.push(
        ...supportCase.description.split('\n').map(line => `  ${line}`)
      );
    }

    lines.push('');
    client.stderr.write(lines.join('\n'));
  }

  return 0;
}
