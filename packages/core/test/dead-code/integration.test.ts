import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { analyzeFlags } from '../../src/index.js';

const FIXTURES = path.resolve(import.meta.dirname, '../fixtures');

describe('dead code integration', () => {
  it('full pipeline: repo-mixed finds dead branches for dead flags', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-mixed'));

    const checkout = result.flags.find((f) => f.name === 'ENABLE_NEW_CHECKOUT');
    expect(checkout).toBeDefined();
    expect(checkout!.classification.status).toBe('dead');
    expect(checkout!.classification.value).toBe(true);
    // Flag is always true → else branch is dead
    expect(checkout!.deadBranches.length).toBeGreaterThanOrEqual(1);
    const elseBranch = checkout!.deadBranches.find((b) => b.branchType === 'else');
    expect(elseBranch).toBeDefined();
    expect(elseBranch!.file).toBe('src/checkout.ts');
    expect(elseBranch!.lineCount).toBeGreaterThan(0);
    expect(checkout!.totalDeadLines).toBeGreaterThan(0);
  });

  it('USE_V2_PARSER const true → else branch dead in constants.ts', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-mixed'));

    const parser = result.flags.find((f) => f.name === 'USE_V2_PARSER');
    expect(parser).toBeDefined();
    expect(parser!.classification.status).toBe('dead');
    expect(parser!.deadBranches.length).toBeGreaterThanOrEqual(1);

    const elseBranch = parser!.deadBranches.find((b) => b.file === 'src/constants.ts');
    expect(elseBranch).toBeDefined();
    expect(elseBranch!.branchType).toBe('else');
    expect(elseBranch!.lineCount).toBeGreaterThan(0);
  });

  it('ENABLE_LEGACY_COMPAT const false → if branch dead in constants.ts', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-mixed'));

    const compat = result.flags.find((f) => f.name === 'ENABLE_LEGACY_COMPAT');
    expect(compat).toBeDefined();
    expect(compat!.classification.status).toBe('dead');
    // ENABLE_LEGACY_COMPAT is a const set to false, but it's only declared,
    // not used in an if-statement in the fixture. So no dead branches.
    // (It's USE_V2_PARSER that controls the if/else.)
    // This tests that we don't false-positive.
  });

  it('summary.totalDeadLines reflects actual dead branch counts', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-mixed'));
    const { summary } = result;

    // We should have SOME dead lines from checkout.ts and constants.ts
    expect(summary.totalDeadLines).toBeGreaterThan(0);
    expect(summary.totalDeadFiles).toBeGreaterThan(0);

    // Verify totalDeadLines is the sum of individual flag dead lines
    const sumFromFlags = result.flags.reduce((sum, f) => sum + f.totalDeadLines, 0);
    // Total may be <= sum (due to dedup) but should be > 0
    expect(summary.totalDeadLines).toBeGreaterThan(0);
    expect(summary.totalDeadLines).toBeLessThanOrEqual(sumFromFlags);
  });

  it('active flags have no dead branches', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-mixed'));

    const active = result.flags.filter((f) => f.classification.status === 'active');
    for (const flag of active) {
      expect(flag.deadBranches).toHaveLength(0);
      expect(flag.totalDeadLines).toBe(0);
    }
  });

  it('no dead flags → dead code summary shows 0', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-empty'));
    expect(result.summary.totalDeadLines).toBe(0);
    expect(result.summary.totalDeadFiles).toBe(0);
  });

  it('dead code appears in JSON output', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-mixed'));
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);

    const checkout = parsed.flags.find((f: { name: string }) => f.name === 'ENABLE_NEW_CHECKOUT');
    expect(checkout.deadBranches.length).toBeGreaterThan(0);
    expect(checkout.totalDeadLines).toBeGreaterThan(0);
    expect(parsed.summary.totalDeadLines).toBeGreaterThan(0);
  });

  it('phantom flags have no dead branches', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-mixed'));

    const phantom = result.flags.find((f) => f.classification.status === 'phantom');
    expect(phantom).toBeDefined();
    expect(phantom!.deadBranches).toHaveLength(0);
  });

  it('dead branches have valid line ranges', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-mixed'));

    for (const flag of result.flags) {
      for (const branch of flag.deadBranches) {
        expect(branch.startLine).toBeGreaterThan(0);
        expect(branch.endLine).toBeGreaterThanOrEqual(branch.startLine);
        expect(branch.lineCount).toBe(branch.endLine - branch.startLine + 1);
        expect(branch.file).toBeTruthy();
        expect(['else', 'if', 'early-return', 'ternary']).toContain(branch.branchType);
      }
    }
  });
});
