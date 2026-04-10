import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { analyzeFlags } from '../src/index.js';

const FIXTURES = path.resolve(import.meta.dirname, 'fixtures');

describe('integration: analyzeFlags', () => {
  it('scans repo-mixed and classifies all flags correctly', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-mixed'));

    const byName = new Map(result.flags.map((f) => [f.name, f]));

    // ENABLE_NEW_CHECKOUT: true in all 3 envs → DEAD
    expect(byName.get('ENABLE_NEW_CHECKOUT')?.classification.status).toBe('dead');
    expect(byName.get('ENABLE_NEW_CHECKOUT')?.classification.value).toBe(true);

    // FEATURE_DARK_MODE: true in dev+staging, false in prod → ACTIVE
    expect(byName.get('FEATURE_DARK_MODE')?.classification.status).toBe('active');

    // FF_GRADUAL_ROLLOUT: false in all 3 envs → DEAD
    expect(byName.get('FF_GRADUAL_ROLLOUT')?.classification.status).toBe('dead');
    expect(byName.get('FF_GRADUAL_ROLLOUT')?.classification.value).toBe(false);

    // ENABLE_MAINTENANCE_MODE: only in env files, never in source → ORPHAN
    expect(byName.get('ENABLE_MAINTENANCE_MODE')?.classification.status).toBe('orphan');

    // ENABLE_MYSTERY_FEATURE: in code but not in any env → PHANTOM
    expect(byName.get('ENABLE_MYSTERY_FEATURE')?.classification.status).toBe('phantom');

    // USE_V2_PARSER: hardcoded const true → DEAD
    expect(byName.get('USE_V2_PARSER')?.classification.status).toBe('dead');
    expect(byName.get('USE_V2_PARSER')?.classification.value).toBe(true);

    // ENABLE_LEGACY_COMPAT: hardcoded const false → DEAD
    expect(byName.get('ENABLE_LEGACY_COMPAT')?.classification.status).toBe('dead');
    expect(byName.get('ENABLE_LEGACY_COMPAT')?.classification.value).toBe(false);
  });

  it('summary counts are correct for repo-mixed', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-mixed'));
    const { summary } = result;

    // ENABLE_NEW_CHECKOUT, FF_GRADUAL_ROLLOUT, USE_V2_PARSER, ENABLE_LEGACY_COMPAT = 4 dead
    expect(summary.deadFlags).toBe(4);
    expect(summary.activeFlags).toBe(1); // FEATURE_DARK_MODE
    expect(summary.phantomFlags).toBe(1); // ENABLE_MYSTERY_FEATURE
    // +1 orphan (ENABLE_MAINTENANCE_MODE) = 7 total
    expect(summary.totalFlags).toBe(7);
  });

  it('classifies Python flags correctly', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-python'));

    const byName = new Map(result.flags.map((f) => [f.name, f]));

    // Both flags true in both envs → DEAD
    expect(byName.get('ENABLE_NEW_AUTH')?.classification.status).toBe('dead');
    expect(byName.get('FEATURE_SEARCH_V2')?.classification.status).toBe('dead');
  });

  it('classifies Go flags correctly', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-go'));

    const byName = new Map(result.flags.map((f) => [f.name, f]));
    expect(byName.get('ENABLE_NEW_ROUTER')?.classification.status).toBe('dead');
  });

  it('classifies Ruby flags correctly', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-ruby'));

    const byName = new Map(result.flags.map((f) => [f.name, f]));
    expect(byName.get('FEATURE_NEW_BILLING')?.classification.status).toBe('dead');
  });

  it('returns empty result for empty repo', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-empty'));
    expect(result.flags.length).toBe(0);
    expect(result.summary.totalFlags).toBe(0);
  });

  it('repo with code but no env files → phantom flags', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-no-envs'));

    const byName = new Map(result.flags.map((f) => [f.name, f]));
    expect(byName.get('ENABLE_SOMETHING')?.classification.status).toBe('phantom');
  });

  it('respects ignoreFlags config', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-mixed'), {
      ignoreFlags: ['ENABLE_MAINTENANCE_MODE'],
    });

    const names = result.flags.map((f) => f.name);
    expect(names).not.toContain('ENABLE_MAINTENANCE_MODE');
  });

  it('respects custom envPrefixes', async () => {
    // Only look for ENABLE_ prefixed flags
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-mixed'), {
      envPrefixes: ['ENABLE_'],
    });

    const names = result.flags.map((f) => f.name);
    expect(names).toContain('ENABLE_NEW_CHECKOUT');
    expect(names).not.toContain('FF_GRADUAL_ROLLOUT');
    expect(names).not.toContain('FEATURE_DARK_MODE');
  });

  it('JSON output is parseable', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-mixed'));
    // Verify the result can be serialized and deserialized
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(parsed.flags).toBeDefined();
    expect(parsed.summary).toBeDefined();
    expect(parsed.summary.totalFlags).toBe(result.summary.totalFlags);
  });

  it('dead flags are sorted before active flags', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-mixed'));
    const statuses = result.flags.map((f) => f.classification.status);
    const deadIdx = statuses.indexOf('dead');
    const activeIdx = statuses.indexOf('active');
    if (deadIdx !== -1 && activeIdx !== -1) {
      expect(deadIdx).toBeLessThan(activeIdx);
    }
  });

  // Template file exclusion (BUG 1 fix)
  it('flags only in .env.example → NOT classified as dead', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-templates'));
    const byName = new Map(result.flags.map((f) => [f.name, f]));

    // ENABLE_ASYNC_TASKER is in code + .env.example only
    // .env.example is a template → excluded from real envs → flag is phantom
    const tasker = byName.get('ENABLE_ASYNC_TASKER');
    expect(tasker).toBeDefined();
    expect(tasker!.classification.status).not.toBe('dead');

    // FEATURE_BETA in code + .env.example only → also not dead
    const beta = byName.get('FEATURE_BETA');
    expect(beta).toBeDefined();
    expect(beta!.classification.status).not.toBe('dead');
  });

  it('flag in single .env only → NOT dead (insufficient data)', async () => {
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-single-env'));
    const byName = new Map(result.flags.map((f) => [f.name, f]));

    const flag = byName.get('ENABLE_FEATURE');
    expect(flag).toBeDefined();
    expect(flag!.classification.status).not.toBe('dead');
  });

  it('hardcoded const flags are still dead despite no real env files', async () => {
    // repo-mixed has USE_V2_PARSER and ENABLE_LEGACY_COMPAT as hardcoded consts
    const result = await analyzeFlags(path.join(FIXTURES, 'repo-mixed'));
    const byName = new Map(result.flags.map((f) => [f.name, f]));

    expect(byName.get('USE_V2_PARSER')?.classification.status).toBe('dead');
    expect(byName.get('ENABLE_LEGACY_COMPAT')?.classification.status).toBe('dead');
  });
});
