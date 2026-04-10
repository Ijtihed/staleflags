import type {
  DiscoveredFlag,
  EnvironmentMap,
  FlagAgeInfo,
  FlagReport,
  ScanResult,
  ScanSummary,
  StaleflagsConfig,
} from './types.js';
import { loadConfig } from './config.js';
import { discoverEnvFlags } from './discovery/env-flags.js';
import { discoverConstFlags } from './discovery/const-flags.js';
import { discoverConfigFlags } from './discovery/config-flags.js';
import { parseEnvFiles } from './environment/dotenv.js';
import { parseJsonConfigs } from './environment/json-config.js';
import { parseYamlConfigs } from './environment/yaml-config.js';
import {
  classifyFlag,
  mergeEnvironmentMaps,
  injectConstValues,
} from './environment/consistency.js';
import { isGitRepo } from './history/git.js';
import { getFlagAge } from './history/flag-age.js';
import { getValueAge } from './history/value-age.js';
import { formatRelativeTime } from './history/format.js';
import { analyzeAllDeadCode } from './dead-code/reporter.js';

export type {
  StaleflagsConfig,
  DiscoveredFlag,
  FlagReport,
  ScanResult,
  ScanSummary,
  FlagClassification,
  FlagAgeInfo,
  FlagLocation,
  FlagStatus,
  EnvironmentMap,
  DeadBranch,
} from './types.js';
export { DEFAULT_CONFIG } from './types.js';
export { loadConfig } from './config.js';
export { parseDotenv, isTemplateFile } from './environment/dotenv.js';
export { classifyFlag, mergeEnvironmentMaps } from './environment/consistency.js';
export { buildEnvReadPatterns, buildConstPatterns } from './discovery/patterns.js';
export { getFlagAge } from './history/flag-age.js';
export { getValueAge } from './history/value-age.js';
export { isGitRepo } from './history/git.js';
export { formatRelativeTime, formatMonthYear, formatFullDate } from './history/format.js';
export { findDeadBranches } from './dead-code/branch-finder.js';
export { measureDeadCode, branchPreview } from './dead-code/branch-measurer.js';
export { analyzeDeadCodeForFlag, analyzeAllDeadCode } from './dead-code/reporter.js';

/**
 * Main entry point. Scan a repository for stale feature flags.
 */
export async function analyzeFlags(
  repoPath: string,
  overrides?: Partial<StaleflagsConfig>,
): Promise<ScanResult> {
  const config = loadConfig(repoPath, overrides);

  // Phase 1: Discover flags in source code
  const [envFlags, constFlags, configFlags] = await Promise.all([
    discoverEnvFlags(repoPath, config),
    discoverConstFlags(repoPath, config),
    discoverConfigFlags(repoPath, config),
  ]);

  // Merge all discovered flags, deduplicating by name
  const allFlags = mergeDiscoveredFlags(envFlags, constFlags, configFlags);

  // Remove ignored flags
  for (const ignored of config.ignoreFlags) {
    allFlags.delete(ignored);
  }

  // Phase 2: Parse environment files
  const [dotenvMap, jsonMap, yamlMap] = await Promise.all([
    parseEnvFiles(repoPath, config),
    parseJsonConfigs(repoPath, config),
    parseYamlConfigs(repoPath, config),
  ]);

  const envMap = mergeEnvironmentMaps(dotenvMap, jsonMap, yamlMap);

  // Inject hardcoded const values into the environment map
  injectConstValues(allFlags, envMap);

  // Phase 3: Classify each flag
  const reports: FlagReport[] = [];

  for (const [, flag] of allFlags) {
    const classification = classifyFlag(flag, envMap);

    reports.push({
      name: flag.name,
      classification,
      locations: flag.locations,
      deadBranches: [],
      totalDeadLines: 0,
    });
  }

  // Phase 4: Dead code quantification (dead flags only)
  analyzeAllDeadCode(repoPath, reports);

  // Phase 5: Git history analysis (dead/aging flags only — skip for active)
  const hasGit = await isGitRepo(repoPath);
  if (hasGit) {
    const historyTargets = reports.filter(
      (r) => r.classification.status === 'dead' || r.classification.status === 'aging',
    );

    const CONCURRENCY = 5;
    for (let i = 0; i < historyTargets.length; i += CONCURRENCY) {
      const batch = historyTargets.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((report) => populateAge(repoPath, report, allFlags)));
    }
  }

  // Check for orphan flags (defined in env but never read in code)
  for (const [flagName, envValues] of envMap) {
    if (allFlags.has(flagName)) continue;
    if (config.ignoreFlags.includes(flagName)) continue;
    if (!config.envPrefixes.some((p) => flagName.startsWith(p))) continue;

    reports.push({
      name: flagName,
      classification: {
        status: 'orphan',
        environments: Object.fromEntries(envValues),
        note: 'Defined in environment files but never referenced in code',
      },
      locations: [],
      deadBranches: [],
      totalDeadLines: 0,
    });
  }

  // Sort: dead first, then aging, then active, then phantom/orphan
  const statusOrder: Record<string, number> = {
    dead: 0,
    aging: 1,
    active: 2,
    phantom: 3,
    orphan: 4,
  };
  reports.sort(
    (a, b) =>
      (statusOrder[a.classification.status] ?? 5) -
      (statusOrder[b.classification.status] ?? 5),
  );

  const summary = buildSummary(reports);

  return { flags: reports, summary };
}

function mergeDiscoveredFlags(
  ...maps: Map<string, DiscoveredFlag>[]
): Map<string, DiscoveredFlag> {
  const merged = new Map<string, DiscoveredFlag>();

  for (const map of maps) {
    for (const [name, flag] of map) {
      const existing = merged.get(name);
      if (existing) {
        // Merge locations, avoid duplicates
        for (const loc of flag.locations) {
          const isDup = existing.locations.some(
            (l) => l.file === loc.file && l.line === loc.line,
          );
          if (!isDup) existing.locations.push(loc);
        }
      } else {
        merged.set(name, { ...flag });
      }
    }
  }

  return merged;
}

async function populateAge(
  repoPath: string,
  report: FlagReport,
  allFlags: Map<string, DiscoveredFlag>,
): Promise<void> {
  const flag = allFlags.get(report.name);
  if (!flag) return;

  const now = new Date();
  const age: FlagAgeInfo = {};

  try {
    const flagAgeResult = await getFlagAge(repoPath, flag);
    if (flagAgeResult.introducedAt) {
      age.introducedDate = flagAgeResult.introducedAt;
      age.introducedAgo = formatRelativeTime(flagAgeResult.introducedAt, now);
      age.introducedBy = flagAgeResult.introducedBy ?? undefined;
      age.introducedIn = flagAgeResult.introducedIn ?? undefined;
    }
  } catch {
    // Git history unavailable — leave age fields empty
  }

  if (report.classification.status === 'dead' && report.classification.value !== undefined) {
    try {
      const currentValue = String(report.classification.value);
      const valueAgeResult = await getValueAge(repoPath, flag, currentValue);
      if (valueAgeResult.valueUnchangedSince) {
        age.valueUnchangedSince = valueAgeResult.valueUnchangedSince;
        age.valueUnchangedAgo = formatRelativeTime(valueAgeResult.valueUnchangedSince, now);
        age.valueChangedBy = valueAgeResult.lastChangedBy ?? undefined;
        age.valueChangedIn = valueAgeResult.lastChangedIn ?? undefined;
      }
    } catch {
      // Value history unavailable
    }
  }

  if (age.introducedDate || age.valueUnchangedSince) {
    report.age = age;
  }
}

function buildSummary(reports: FlagReport[]): ScanSummary {
  const deadFiles = new Set<string>();

  for (const r of reports) {
    for (const b of r.deadBranches) {
      deadFiles.add(b.file);
    }
  }

  const allFiles = new Set<string>();
  for (const r of reports) {
    for (const l of r.locations) {
      allFiles.add(l.file);
    }
  }

  return {
    totalFlags: reports.length,
    deadFlags: reports.filter((r) => r.classification.status === 'dead').length,
    agingFlags: reports.filter((r) => r.classification.status === 'aging').length,
    activeFlags: reports.filter((r) => r.classification.status === 'active').length,
    phantomFlags: reports.filter((r) => r.classification.status === 'phantom').length,
    totalDeadLines: reports.reduce((sum, r) => sum + r.totalDeadLines, 0),
    totalDeadFiles: deadFiles.size,
    totalFilesScanned: allFiles.size,
  };
}
