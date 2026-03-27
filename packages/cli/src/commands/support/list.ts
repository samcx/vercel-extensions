import table from '../../util/output/table';
import { gray } from 'chalk';
import type Client from '../../util/client';
import { parseArguments } from '../../util/get-args';
import { printError } from '../../util/error';
import { getFlagsSpecification } from '../../util/get-flags-specification';
import { listSubcommand } from './command';
import { validateJsonOutput } from '../../util/output-format';
import output from '../../output-manager';

const VALID_STATUSES = ['open', 'closed', 'transferred'];
const VALID_SORTS = ['createdAt', 'updatedAt', 'severity'];

interface SupportCase {
  id: string | null;
  title: string;
  status: string;
  severity: number | null;
  createdAt: number;
  updatedAt: number | null;
}

interface ListCasesResponse {
  data: SupportCase[];
}

export default async function list(
  client: Client,
  argv: string[]
): Promise<number> {
  let parsedArgs;
  const flagsSpecification = getFlagsSpecification(listSubcommand.options);
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

  const status = parsedArgs.flags['--status'] as string | undefined;
  const sort = parsedArgs.flags['--sort'] as string | undefined;
  const limit = parsedArgs.flags['--limit'] as number | undefined;
  const offset = parsedArgs.flags['--offset'] as number | undefined;
  const project = parsedArgs.flags['--project'] as string | undefined;

  if (status && !VALID_STATUSES.includes(status)) {
    output.error(
      `Invalid status "${status}". Must be one of: ${VALID_STATUSES.join(', ')}`
    );
    return 1;
  }

  if (sort && !VALID_SORTS.includes(sort)) {
    output.error(
      `Invalid sort "${sort}". Must be one of: ${VALID_SORTS.join(', ')}`
    );
    return 1;
  }

  if (limit !== undefined && (limit < 1 || limit > 100)) {
    output.error('Limit must be between 1 and 100');
    return 1;
  }

  if (offset !== undefined && offset < 0) {
    output.error('Offset must be 0 or greater');
    return 1;
  }

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (sort) params.set('sort', sort);
  if (limit !== undefined) params.set('limit', String(limit));
  if (offset !== undefined) params.set('offset', String(offset));
  if (project) params.set('project', project);

  const query = params.toString();
  const url = `/v1/support/cases${query ? `?${query}` : ''}`;

  output.spinner('Fetching support cases');
  const response = await client.fetch<ListCasesResponse>(url);
  output.stopSpinner();

  const cases = response.data;

  if (asJson) {
    client.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
  } else {
    if (cases.length === 0) {
      output.log('No support cases found.');
      return 0;
    }

    const caseTable = table(
      [
        ['Case ID', 'Title', 'Status', 'Severity', 'Created'].map(str =>
          gray(str)
        ),
        ...cases.map(c => [
          c.id ?? '-',
          c.title.length > 50 ? `${c.title.slice(0, 47)}...` : c.title,
          c.status,
          c.severity !== null ? String(c.severity) : '-',
          new Date(c.createdAt).toLocaleDateString(),
        ]),
      ],
      { hsep: 3 }
    );
    client.stderr.write(`\n${caseTable}\n`);
  }

  return 0;
}
