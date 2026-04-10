export interface StaleflagsConfig {
  envPrefixes: string[];
  customPatterns: string[];
  envFiles: string[];
  configFiles: string[];
  exclude: string[];
  ageThresholdDays: number;
  ignoreFlags: string[];
  languages: Language[];
}

export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'ruby';

export interface DiscoveredFlag {
  name: string;
  source: FlagSource;
  locations: FlagLocation[];
}

export interface FlagLocation {
  file: string;
  line: number;
  column: number;
  snippet: string;
  language: Language | 'config';
  kind: 'env-read' | 'const-assignment' | 'config-key';
}

export type FlagSource = 'env' | 'const' | 'config';

/**
 * Environment name → value string.
 * e.g. { ".env.dev": "true", ".env.staging": "true", ".env.prod": "true" }
 * For hardcoded consts, key is "hardcoded" or the source file path.
 */
export type EnvironmentValues = Map<string, string>;

/**
 * Flag name → environment values.
 */
export type EnvironmentMap = Map<string, EnvironmentValues>;

export type FlagStatus = 'dead' | 'active' | 'phantom' | 'orphan' | 'aging';

export interface FlagClassification {
  status: FlagStatus;
  value?: boolean;
  deadBranch?: 'if' | 'else';
  environments: Record<string, string>;
  note?: string;
}

export interface FlagAgeInfo {
  introducedDate?: Date;
  introducedAgo?: string;
  introducedBy?: string;
  introducedIn?: string;
  valueUnchangedSince?: Date;
  valueUnchangedAgo?: string;
  valueChangedBy?: string;
  valueChangedIn?: string;
}

export interface DeadBranch {
  file: string;
  startLine: number;
  endLine: number;
  lineCount: number;
  branchType: 'else' | 'if' | 'early-return' | 'ternary';
}

export interface FlagReport {
  name: string;
  classification: FlagClassification;
  locations: FlagLocation[];
  age?: FlagAgeInfo;
  deadBranches: DeadBranch[];
  totalDeadLines: number;
}

export interface ScanResult {
  flags: FlagReport[];
  summary: ScanSummary;
}

export interface ScanSummary {
  totalFlags: number;
  deadFlags: number;
  agingFlags: number;
  activeFlags: number;
  phantomFlags: number;
  totalDeadLines: number;
  totalDeadFiles: number;
  totalFilesScanned: number;
}

export const DEFAULT_CONFIG: StaleflagsConfig = {
  envPrefixes: ['ENABLE_', 'FEATURE_', 'FF_', 'USE_', 'DISABLE_', 'TOGGLE_'],
  customPatterns: [],
  envFiles: ['.env*'],
  configFiles: ['config/**/*.json', 'config/**/*.yaml'],
  exclude: ['node_modules', 'dist', 'coverage', '.git', 'vendor', 'build', '.next', '__pycache__'],
  ageThresholdDays: 90,
  ignoreFlags: [],
  languages: ['typescript', 'javascript', 'python', 'go', 'ruby'],
};
