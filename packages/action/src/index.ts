import * as core from '@actions/core';
import * as github from '@actions/github';
import { analyzeFlags } from '@staleflags/core';

async function run(): Promise<void> {
  try {
    const failOn = core.getInput('fail-on') || 'none';
    const ageThreshold = parseInt(core.getInput('age-threshold') || '90', 10);

    const result = await analyzeFlags(process.cwd(), { ageThresholdDays: ageThreshold });
    const { summary } = result;

    core.setOutput('total-flags', summary.totalFlags);
    core.setOutput('dead-flags', summary.deadFlags);
    core.setOutput('aging-flags', summary.agingFlags);
    core.setOutput('active-flags', summary.activeFlags);
    core.setOutput('dead-lines', summary.totalDeadLines);

    // Post PR comment if in pull_request context
    const context = github.context;
    if (context.payload.pull_request) {
      const token = core.getInput('github-token');
      if (token) {
        const octokit = github.getOctokit(token);
        const body = buildPrComment(result);

        await octokit.rest.issues.createComment({
          ...context.repo,
          issue_number: context.payload.pull_request.number,
          body,
        });
      }
    }

    core.info(`Found ${summary.totalFlags} flags: ${summary.deadFlags} dead, ${summary.agingFlags} aging, ${summary.activeFlags} active`);

    if (failOn !== 'none') {
      const shouldFail =
        (failOn === 'dead' && summary.deadFlags > 0) ||
        (failOn === 'aging' && summary.agingFlags > 0) ||
        (failOn === 'all' && (summary.deadFlags > 0 || summary.agingFlags > 0));

      if (shouldFail) {
        core.setFailed(`staleflags: found ${summary.deadFlags} dead and ${summary.agingFlags} aging flags`);
      }
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

function buildPrComment(result: import('@staleflags/core').ScanResult): string {
  const { summary } = result;
  const lines: string[] = [];

  lines.push('## staleflags');
  lines.push('');

  if (summary.deadFlags === 0 && summary.agingFlags === 0) {
    lines.push('No dead or aging flags detected.');
    return lines.join('\n');
  }

  const parts: string[] = [];
  if (summary.deadFlags > 0) parts.push(`**${summary.deadFlags} dead flags**`);
  if (summary.agingFlags > 0) parts.push(`**${summary.agingFlags} aging flags**`);
  if (summary.totalDeadLines > 0) parts.push(`**${summary.totalDeadLines} lines of removable code**`);
  lines.push(parts.join(' · '));
  lines.push('');

  const deadFlags = result.flags.filter((f) => f.classification.status === 'dead');
  if (deadFlags.length > 0) {
    lines.push('| Flag | Value | Environments | Dead Code |');
    lines.push('|------|-------|-------------|-----------|');

    for (const flag of deadFlags) {
      const envCount = Object.keys(flag.classification.environments).length;
      const envStr = flag.classification.note?.includes('Hardcoded')
        ? 'hardcoded'
        : `${envCount} envs`;
      const deadStr = flag.totalDeadLines > 0
        ? `${flag.totalDeadLines} lines`
        : '—';
      lines.push(
        `| \`${flag.name}\` | ${flag.classification.value} everywhere | ${envStr} | ${deadStr} |`,
      );
    }
    lines.push('');
  }

  if (summary.totalDeadLines > 0) {
    const deadFlags2 = result.flags.filter((f) => f.deadBranches.length > 0);
    if (deadFlags2.length > 0) {
      lines.push('<details>');
      lines.push('<summary>Dead code locations</summary>');
      lines.push('');
      for (const flag of deadFlags2) {
        for (const branch of flag.deadBranches) {
          lines.push(
            `- \`${branch.file}:${branch.startLine}-${branch.endLine}\` (${branch.lineCount} lines, ${branch.branchType} branch of ${flag.name})`,
          );
        }
      }
      lines.push('');
      lines.push('</details>');
    }
  }

  return lines.join('\n');
}

run();
