import type { FlagReport, ScanResult } from 'staleflags-core';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

const SEPARATOR = '━'.repeat(70);

export function formatConsole(result: ScanResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(
    `  ${BOLD}staleflags v0.1.0${RESET} — scanning for feature flags`,
  );
  lines.push('');

  const { summary } = result;
  const deadCodeSuffix =
    summary.totalDeadLines > 0
      ? ` · ${BOLD}${summary.totalDeadLines} lines of dead code${RESET}`
      : '';
  lines.push(
    `  Found ${BOLD}${summary.totalFlags} flags${RESET} across ${summary.totalFilesScanned} files${deadCodeSuffix}`,
  );
  lines.push('');

  // Dead flags
  const deadFlags = result.flags.filter((f) => f.classification.status === 'dead');
  if (deadFlags.length > 0) {
    lines.push(`  ${RED}⚰️  DEAD FLAGS (same value in every environment)${RESET}`);
    lines.push(`  ${DIM}${SEPARATOR}${RESET}`);
    lines.push('');

    for (const flag of deadFlags) {
      lines.push(...formatDeadFlag(flag));
      lines.push('');
    }
  }

  // Aging flags
  const agingFlags = result.flags.filter((f) => f.classification.status === 'aging');
  if (agingFlags.length > 0) {
    lines.push(`  ${YELLOW}🕰️  AGING FLAGS (probably done, different in at least one env)${RESET}`);
    lines.push(`  ${DIM}${SEPARATOR}${RESET}`);
    lines.push('');

    for (const flag of agingFlags) {
      lines.push(...formatAgingFlag(flag));
      lines.push('');
    }
  }

  // Active flags
  const activeFlags = result.flags.filter((f) => f.classification.status === 'active');
  if (activeFlags.length > 0) {
    lines.push(`  ${GREEN}✅ ACTIVE FLAGS (doing their job)${RESET}`);
    lines.push(`  ${DIM}${SEPARATOR}${RESET}`);
    lines.push('');

    for (const flag of activeFlags) {
      lines.push(...formatActiveFlag(flag));
    }
    lines.push('');
  }

  // Phantom flags
  const phantomFlags = result.flags.filter((f) => f.classification.status === 'phantom');
  if (phantomFlags.length > 0) {
    lines.push(`  ${CYAN}👻 PHANTOM FLAGS (read in code, never defined)${RESET}`);
    lines.push(`  ${DIM}${SEPARATOR}${RESET}`);
    lines.push('');

    for (const flag of phantomFlags) {
      lines.push(`    ${BOLD}${flag.name}${RESET}`);
      lines.push(`      ${DIM}${flag.classification.note}${RESET}`);
      const locs = flag.locations.slice(0, 3);
      for (const loc of locs) {
        lines.push(`      ${GRAY}${loc.file}:${loc.line}${RESET}`);
      }
      if (flag.locations.length > 3) {
        lines.push(`      ${GRAY}...and ${flag.locations.length - 3} more${RESET}`);
      }
      lines.push('');
    }
  }

  // Orphan flags
  const orphanFlags = result.flags.filter((f) => f.classification.status === 'orphan');
  if (orphanFlags.length > 0) {
    lines.push(`  ${GRAY}🗑️  ORPHAN FLAGS (defined in env, never read in code)${RESET}`);
    lines.push(`  ${DIM}${SEPARATOR}${RESET}`);
    lines.push('');

    for (const flag of orphanFlags) {
      const envs = Object.keys(flag.classification.environments).join(', ');
      lines.push(`    ${BOLD}${flag.name}${RESET}    ${DIM}${envs}${RESET}`);
    }
    lines.push('');
  }

  // Summary line
  lines.push(`  ${DIM}${SEPARATOR}${RESET}`);
  const parts = [
    `${summary.totalFlags} flags`,
    summary.deadFlags > 0 ? `${RED}${summary.deadFlags} dead${RESET}` : null,
    summary.agingFlags > 0 ? `${YELLOW}${summary.agingFlags} aging${RESET}` : null,
    `${summary.activeFlags} active`,
  ].filter(Boolean);
  lines.push(`  ${BOLD}SUMMARY:${RESET} ${parts.join(' · ')}`);

  if (summary.totalDeadLines > 0) {
    lines.push(
      `  ${RED}${BOLD}DEAD CODE:${RESET} ${summary.totalDeadLines} lines across ${summary.totalDeadFiles} files ${DIM}(removable today)${RESET}`,
    );
  }
  lines.push('');

  return lines.join('\n');
}

function formatDeadFlag(flag: FlagReport): string[] {
  const lines: string[] = [];
  const { classification } = flag;

  lines.push(`    ${BOLD}${flag.name}${RESET}`);

  const envEntries = Object.entries(classification.environments);
  if (envEntries.length > 0) {
    if (classification.note?.includes('Hardcoded')) {
      const loc = flag.locations.find((l) => l.kind === 'const-assignment');
      lines.push(
        `      Value: ${BOLD}const ${flag.name} = ${classification.value}${RESET} ${DIM}(hardcoded in ${loc?.file ?? 'unknown'}:${loc?.line ?? '?'})${RESET}`,
      );
    } else {
      const envNames = envEntries.map(([e]) => e).join(', ');
      const envCount = envEntries.length;
      lines.push(
        `      Value: ${BOLD}${classification.value}${RESET} in ${envNames} ${DIM}(all ${envCount} environments)${RESET}`,
      );
    }
  }

  if (flag.age) {
    if (flag.age.introducedAgo) {
      lines.push(`      Introduced: ${flag.age.introducedAgo}`);
    }
    if (flag.age.valueUnchangedAgo) {
      lines.push(`      Value unchanged: ${flag.age.valueUnchangedAgo}`);
    }
  }

  if (flag.deadBranches.length > 0) {
    for (const branch of flag.deadBranches) {
      lines.push(
        `      Dead code: ${CYAN}${branch.file}:${branch.startLine}-${branch.endLine}${RESET} (${branch.branchType} branch, ${branch.lineCount} lines)`,
      );
    }
    lines.push(
      `      Total: ${RED}${BOLD}${flag.totalDeadLines} lines${RESET} of dead code`,
    );
  }

  return lines;
}

function formatAgingFlag(flag: FlagReport): string[] {
  const lines: string[] = [];
  const { classification } = flag;

  lines.push(`    ${BOLD}${flag.name}${RESET}`);

  const envEntries = Object.entries(classification.environments);
  const envStr = envEntries
    .map(([env, val]) => `${val} in ${env}`)
    .join(', ');
  lines.push(`      Value: ${envStr}`);

  if (classification.note) {
    lines.push(`      ${DIM}${classification.note}${RESET}`);
  }

  return lines;
}

function formatActiveFlag(flag: FlagReport): string[] {
  const envEntries = Object.entries(flag.classification.environments);
  const envStr = envEntries
    .map(([env, val]) => `${val} in ${env}`)
    .join(' · ');
  return [
    `    ${BOLD}${flag.name}${RESET}    ${DIM}${envStr}${RESET}`,
  ];
}
