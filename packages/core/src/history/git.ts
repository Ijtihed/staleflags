import { execFile } from 'node:child_process';

const GIT_TIMEOUT_MS = 15_000;

export interface GitLogEntry {
  hash: string;
  authorDate: Date;
  authorEmail: string;
  diff: string;
}

/**
 * Check whether a directory is inside a git repository.
 */
export async function isGitRepo(repoPath: string): Promise<boolean> {
  try {
    await runGit(repoPath, ['rev-parse', '--is-inside-work-tree']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pickaxe search: find all commits where `searchString` was added or removed
 * in files matching `filePatterns`. Returns entries in chronological order
 * (oldest first).
 */
export async function gitPickaxeLog(
  repoPath: string,
  searchString: string,
  filePatterns: string[],
): Promise<GitLogEntry[]> {
  const args = [
    'log',
    '--all',
    '--format=%H|%aI|%ae',
    '-p',
    '-S', searchString,
    '--reverse',
    '--',
    ...filePatterns,
  ];

  let stdout: string;
  try {
    stdout = await runGit(repoPath, args);
  } catch {
    return [];
  }

  return parseGitLogOutput(stdout);
}

/**
 * Parse the combined format+patch output from git log.
 * Each commit block starts with a line matching hash|date|email.
 */
export function parseGitLogOutput(stdout: string): GitLogEntry[] {
  const entries: GitLogEntry[] = [];
  const lines = stdout.split('\n');
  const headerPattern = /^([0-9a-f]{40})\|(.+)\|(.+)$/;

  let current: { hash: string; date: string; email: string; diffLines: string[] } | null = null;

  for (const line of lines) {
    const match = headerPattern.exec(line);
    if (match) {
      if (current) {
        entries.push({
          hash: current.hash,
          authorDate: new Date(current.date),
          authorEmail: current.email,
          diff: current.diffLines.join('\n'),
        });
      }
      current = {
        hash: match[1],
        date: match[2],
        email: match[3],
        diffLines: [],
      };
    } else if (current) {
      current.diffLines.push(line);
    }
  }

  if (current) {
    entries.push({
      hash: current.hash,
      authorDate: new Date(current.date),
      authorEmail: current.email,
      diff: current.diffLines.join('\n'),
    });
  }

  return entries;
}

/**
 * Grep search: find all commits where any diff line matches the regex pattern.
 * Unlike pickaxe (-S), this catches value changes where the key stays the same
 * but the value changes (e.g. ENABLE_X=false → ENABLE_X=true).
 * Returns entries in chronological order (oldest first).
 */
export async function gitGrepLog(
  repoPath: string,
  pattern: string,
  filePatterns: string[],
): Promise<GitLogEntry[]> {
  const args = [
    'log',
    '--all',
    '--format=%H|%aI|%ae',
    '-p',
    '-G', pattern,
    '--reverse',
    '--',
    ...filePatterns,
  ];

  let stdout: string;
  try {
    stdout = await runGit(repoPath, args);
  } catch {
    return [];
  }

  return parseGitLogOutput(stdout);
}

/**
 * Check if the repo is a shallow clone.
 */
export async function isShallowRepo(repoPath: string): Promise<boolean> {
  try {
    const result = await runGit(repoPath, ['rev-parse', '--is-shallow-repository']);
    return result.trim() === 'true';
  } catch {
    return false;
  }
}

function runGit(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'git',
      args,
      { cwd, maxBuffer: 10 * 1024 * 1024, timeout: GIT_TIMEOUT_MS },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`git ${args[0]} failed: ${stderr || error.message}`));
        } else {
          resolve(stdout);
        }
      },
    );
  });
}
