import { describe, it, expect, afterEach } from 'vitest';
import { createFixtureRepo, cleanupFixtureRepo } from './git-fixture.js';
import { getFlagAge } from '../../src/history/flag-age.js';
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

describe('getFlagAge', () => {
  it('flag introduced 6 months ago → correct age', async () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const dateStr = sixMonthsAgo.toISOString();

    const repo = await createFixtureRepo([
      { date: dateStr, files: { '.env': 'ENABLE_X=true\n' }, message: 'add flag' },
    ]);
    repos.push(repo);

    const result = await getFlagAge(repo, envFlag('ENABLE_X'));
    expect(result.introducedAt).toBeDefined();
    expect(result.ageInDays).toBeGreaterThanOrEqual(175);
    expect(result.ageInDays).toBeLessThanOrEqual(190);
  });

  it('flag introduced in initial commit → age = repo age', async () => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const repo = await createFixtureRepo([
      { date: oneYearAgo.toISOString(), files: { '.env': 'FEATURE_A=true\n', 'index.ts': 'console.log(process.env.FEATURE_A)\n' }, message: 'init' },
    ]);
    repos.push(repo);

    const result = await getFlagAge(repo, envFlag('FEATURE_A'));
    expect(result.introducedAt).toBeDefined();
    expect(result.ageInDays!).toBeGreaterThanOrEqual(360);
  });

  it('flag with no git history → age = null', async () => {
    const repo = await createFixtureRepo([
      { date: new Date().toISOString(), files: { 'README.md': '# hello\n' }, message: 'init' },
    ]);
    repos.push(repo);

    const result = await getFlagAge(repo, envFlag('ENABLE_NONEXISTENT'));
    expect(result.introducedAt).toBeNull();
    expect(result.ageInDays).toBeNull();
  });

  it('flag introduced in .env → finds correct date', async () => {
    const date1 = '2025-01-15T10:00:00Z';
    const date2 = '2025-06-01T10:00:00Z';

    const repo = await createFixtureRepo([
      { date: date1, files: { '.env': 'OTHER_KEY=val\n' }, message: 'init' },
      { date: date2, files: { '.env': 'OTHER_KEY=val\nENABLE_NEW=true\n' }, message: 'add flag' },
    ]);
    repos.push(repo);

    const result = await getFlagAge(repo, envFlag('ENABLE_NEW'));
    expect(result.introducedAt).toBeDefined();
    expect(result.introducedAt!.toISOString()).toContain('2025-06-01');
  });

  it('flag introduced as const → finds correct date', async () => {
    const date = '2025-03-01T10:00:00Z';

    const repo = await createFixtureRepo([
      { date: date, files: { 'src/index.ts': 'const USE_V2_PARSER = true;\n' }, message: 'add const flag' },
    ]);
    repos.push(repo);

    const result = await getFlagAge(repo, constFlag('USE_V2_PARSER'));
    expect(result.introducedAt).toBeDefined();
    expect(result.introducedAt!.toISOString()).toContain('2025-03-01');
  });

  it('flag introduced in JSON config → finds correct date', async () => {
    const date = '2025-04-01T10:00:00Z';

    const repo = await createFixtureRepo([
      {
        date: date,
        files: { 'config/prod.json': JSON.stringify({ ENABLE_CACHE: true }) + '\n' },
        message: 'add config',
      },
    ]);
    repos.push(repo);

    const flag: DiscoveredFlag = {
      name: 'ENABLE_CACHE',
      source: 'config',
      locations: [{ file: 'config/prod.json', line: 1, column: 1, snippet: '"ENABLE_CACHE": true', language: 'config', kind: 'config-key' }],
    };
    const result = await getFlagAge(repo, flag);
    expect(result.introducedAt).toBeDefined();
    expect(result.introducedAt!.toISOString()).toContain('2025-04-01');
  });

  it('multiple flags with different ages → each has correct age', async () => {
    const date1 = '2025-01-01T10:00:00Z';
    const date2 = '2025-06-01T10:00:00Z';

    const repo = await createFixtureRepo([
      { date: date1, files: { '.env': 'ENABLE_ALPHA=true\n' }, message: 'add alpha' },
      { date: date2, files: { '.env': 'ENABLE_ALPHA=true\nENABLE_BETA=true\n' }, message: 'add beta' },
    ]);
    repos.push(repo);

    const resultA = await getFlagAge(repo, envFlag('ENABLE_ALPHA'));
    const resultB = await getFlagAge(repo, envFlag('ENABLE_BETA'));

    expect(resultA.introducedAt!.toISOString()).toContain('2025-01-01');
    expect(resultB.introducedAt!.toISOString()).toContain('2025-06-01');
    expect(resultA.ageInDays!).toBeGreaterThan(resultB.ageInDays!);
  });

  it('records author email', async () => {
    const repo = await createFixtureRepo([
      {
        date: '2025-02-01T10:00:00Z',
        author: 'alice@company.com',
        files: { '.env': 'ENABLE_X=true\n' },
        message: 'alice adds flag',
      },
    ]);
    repos.push(repo);

    const result = await getFlagAge(repo, envFlag('ENABLE_X'));
    expect(result.introducedBy).toBe('alice@company.com');
  });

  it('records commit hash', async () => {
    const repo = await createFixtureRepo([
      { date: '2025-02-01T10:00:00Z', files: { '.env': 'ENABLE_X=true\n' }, message: 'add flag' },
    ]);
    repos.push(repo);

    const result = await getFlagAge(repo, envFlag('ENABLE_X'));
    expect(result.introducedIn).toBeDefined();
    expect(result.introducedIn!).toMatch(/^[0-9a-f]{40}$/);
  });
});
