import { describe, it, expect, afterEach } from 'vitest';
import { createFixtureRepo, cleanupFixtureRepo } from './git-fixture.js';
import { getValueAge } from '../../src/history/value-age.js';
import type { DiscoveredFlag } from '../../src/types.js';

let repos: string[] = [];

afterEach(() => {
  for (const r of repos) cleanupFixtureRepo(r);
  repos = [];
});

function envFlag(name: string): DiscoveredFlag {
  return {
    name,
    source: 'env',
    locations: [{ file: '.env', line: 1, column: 1, snippet: `${name}=true`, language: 'config', kind: 'env-read' }],
  };
}

function constFlag(name: string): DiscoveredFlag {
  return {
    name,
    source: 'const',
    locations: [{ file: 'src/index.ts', line: 1, column: 1, snippet: `const ${name} = true`, language: 'typescript', kind: 'const-assignment' }],
  };
}

describe('getValueAge', () => {
  it('flag value never changed → valueAge = flagAge (same date)', async () => {
    const date = '2025-01-15T10:00:00Z';

    const repo = await createFixtureRepo([
      { date, files: { '.env': 'ENABLE_X=true\n' }, message: 'add flag' },
    ]);
    repos.push(repo);

    const result = await getValueAge(repo, envFlag('ENABLE_X'), 'true');
    expect(result.valueUnchangedSince).toBeDefined();
    expect(result.valueUnchangedSince!.toISOString()).toContain('2025-01-15');
  });

  it('flag value changed 3 months ago → correct valueAgeInDays', async () => {
    const date1 = '2025-01-01T10:00:00Z';
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const date2 = threeMonthsAgo.toISOString();

    const repo = await createFixtureRepo([
      { date: date1, files: { '.env': 'ENABLE_X=false\n' }, message: 'add flag as false' },
      { date: date2, files: { '.env': 'ENABLE_X=true\n' }, message: 'flip to true' },
    ]);
    repos.push(repo);

    const result = await getValueAge(repo, envFlag('ENABLE_X'), 'true');
    expect(result.valueUnchangedSince).toBeDefined();
    expect(result.valueAgeInDays).toBeGreaterThanOrEqual(85);
    expect(result.valueAgeInDays).toBeLessThanOrEqual(100);
  });

  it('flag value changed multiple times → reports most recent change', async () => {
    const repo = await createFixtureRepo([
      { date: '2024-01-01T10:00:00Z', files: { '.env': 'ENABLE_X=false\n' }, message: 'start false' },
      { date: '2024-06-01T10:00:00Z', files: { '.env': 'ENABLE_X=true\n' }, message: 'flip to true' },
      { date: '2024-09-01T10:00:00Z', files: { '.env': 'ENABLE_X=false\n' }, message: 'back to false' },
      { date: '2025-01-01T10:00:00Z', files: { '.env': 'ENABLE_X=true\n' }, message: 'final flip to true' },
    ]);
    repos.push(repo);

    const result = await getValueAge(repo, envFlag('ENABLE_X'), 'true');
    expect(result.valueUnchangedSince).toBeDefined();
    // Should be the most recent flip to true (2025-01-01), not the earlier one
    expect(result.valueUnchangedSince!.toISOString()).toContain('2025-01-01');
  });

  it('flag value "changed" by formatting only → ignored, reports actual value change', async () => {
    const repo = await createFixtureRepo([
      { date: '2025-01-01T10:00:00Z', files: { '.env': 'ENABLE_X=true\n' }, message: 'add flag' },
      // Same value but whitespace/formatting change (e.g. added comment, moved line)
      { date: '2025-06-01T10:00:00Z', files: { '.env': '# flags\nENABLE_X=true\n' }, message: 'add comment' },
    ]);
    repos.push(repo);

    const result = await getValueAge(repo, envFlag('ENABLE_X'), 'true');
    expect(result.valueUnchangedSince).toBeDefined();
    // Should report the original introduction, not the formatting change
    expect(result.valueUnchangedSince!.toISOString()).toContain('2025-01-01');
  });

  it('const flag set to true, was false before → valueAge = time since flip', async () => {
    const repo = await createFixtureRepo([
      { date: '2025-01-01T10:00:00Z', files: { 'src/index.ts': 'const USE_V2 = false;\n' }, message: 'add const false' },
      { date: '2025-03-01T10:00:00Z', files: { 'src/index.ts': 'const USE_V2 = true;\n' }, message: 'flip to true' },
    ]);
    repos.push(repo);

    const result = await getValueAge(repo, constFlag('USE_V2'), 'true');
    expect(result.valueUnchangedSince).toBeDefined();
    expect(result.valueUnchangedSince!.toISOString()).toContain('2025-03-01');
  });

  it('const flag always been true since introduction → valueAge = flagAge', async () => {
    const date = '2025-02-15T10:00:00Z';

    const repo = await createFixtureRepo([
      { date, files: { 'src/index.ts': 'const ENABLE_FAST = true;\n' }, message: 'add const' },
    ]);
    repos.push(repo);

    const result = await getValueAge(repo, constFlag('ENABLE_FAST'), 'true');
    expect(result.valueUnchangedSince).toBeDefined();
    expect(result.valueUnchangedSince!.toISOString()).toContain('2025-02-15');
  });

  it('records author and commit hash of value change', async () => {
    const repo = await createFixtureRepo([
      { date: '2025-01-01T10:00:00Z', author: 'alice@co.com', files: { '.env': 'ENABLE_X=false\n' }, message: 'init' },
      { date: '2025-03-01T10:00:00Z', author: 'bob@co.com', files: { '.env': 'ENABLE_X=true\n' }, message: 'flip' },
    ]);
    repos.push(repo);

    const result = await getValueAge(repo, envFlag('ENABLE_X'), 'true');
    expect(result.lastChangedBy).toBe('bob@co.com');
    expect(result.lastChangedIn).toMatch(/^[0-9a-f]{40}$/);
  });

  it('flag not in git history → returns nulls', async () => {
    const repo = await createFixtureRepo([
      { date: new Date().toISOString(), files: { 'README.md': '# hi\n' }, message: 'init' },
    ]);
    repos.push(repo);

    const result = await getValueAge(repo, envFlag('ENABLE_GHOST'), 'true');
    expect(result.valueUnchangedSince).toBeNull();
    expect(result.valueAgeInDays).toBeNull();
  });
});
