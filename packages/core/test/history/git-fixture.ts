import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';

export interface CommitStep {
  date: string;
  author?: string;
  files: Record<string, string>;
  message: string;
}

/**
 * Create a temporary git repository with a scripted history.
 *
 * Each step creates a commit at the specified date with the given files.
 * Files not mentioned in a step retain their content from previous steps.
 * Set a file's content to `null` to delete it.
 *
 * Returns the absolute path to the temporary repo. The caller should
 * clean up via `cleanupFixtureRepo()`.
 */
export async function createFixtureRepo(steps: CommitStep[]): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'staleflags-test-'));

  git(tmpDir, ['init', '-b', 'main']);
  git(tmpDir, ['config', 'user.email', 'test@staleflags.dev']);
  git(tmpDir, ['config', 'user.name', 'Test']);

  for (const step of steps) {
    const author = step.author ?? 'test@staleflags.dev';

    for (const [filePath, content] of Object.entries(step.files)) {
      const absPath = path.join(tmpDir, filePath);

      if (content === null) {
        if (fs.existsSync(absPath)) {
          fs.unlinkSync(absPath);
          git(tmpDir, ['rm', filePath]);
        }
        continue;
      }

      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content);
      git(tmpDir, ['add', filePath]);
    }

    git(tmpDir, ['commit', '--allow-empty', '-m', step.message], {
      GIT_AUTHOR_DATE: step.date,
      GIT_COMMITTER_DATE: step.date,
      GIT_AUTHOR_EMAIL: author,
      GIT_COMMITTER_EMAIL: author,
    });
  }

  return tmpDir;
}

export function cleanupFixtureRepo(repoPath: string): void {
  fs.rmSync(repoPath, { recursive: true, force: true });
}

function git(
  cwd: string,
  args: string[],
  env?: Record<string, string>,
): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, ...env },
  });
}
