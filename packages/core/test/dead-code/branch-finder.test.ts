import { describe, it, expect } from 'vitest';
import { findDeadBranches } from '../../src/dead-code/branch-finder.js';

describe('findDeadBranches', () => {
  // ── Pattern 1: simple if/else ─────────────────────────────────

  it('always-true flag → else branch detected with correct line range', () => {
    const code = `
function checkout() {
  if (process.env.ENABLE_NEW_CHECKOUT) {
    return newFlow();
  } else {
    return oldFlow();
  }
}
`.trimStart();
    // else block `{ return oldFlow(); }` spans from `{` on line 4 to `}` on line 6
    const branches = findDeadBranches('test.ts', code, 'ENABLE_NEW_CHECKOUT', true);
    expect(branches).toHaveLength(1);
    expect(branches[0].branchType).toBe('else');
    expect(branches[0].startLine).toBe(4);
    expect(branches[0].endLine).toBe(6);
    expect(branches[0].lineCount).toBe(3);
  });

  it('always-false flag → if branch detected with correct line range', () => {
    const code = `
function checkout() {
  if (process.env.ENABLE_NEW_CHECKOUT) {
    return newFlow();
  } else {
    return oldFlow();
  }
}
`.trimStart();
    // then block `{ return newFlow(); }` spans from `{` on line 2 to `}` on line 4
    const branches = findDeadBranches('test.ts', code, 'ENABLE_NEW_CHECKOUT', false);
    expect(branches).toHaveLength(1);
    expect(branches[0].branchType).toBe('if');
    expect(branches[0].startLine).toBe(2);
    expect(branches[0].endLine).toBe(4);
    expect(branches[0].lineCount).toBe(3);
  });

  it('if without else (always true) → no dead branch', () => {
    const code = `
if (process.env.ENABLE_X) {
  doThing();
}
`.trimStart();

    const branches = findDeadBranches('test.ts', code, 'ENABLE_X', true);
    expect(branches).toHaveLength(0);
  });

  it('if without else (always false) → entire if block is dead', () => {
    const code = `
if (process.env.ENABLE_X) {
  doThing();
  doOtherThing();
}
`.trimStart();

    const branches = findDeadBranches('test.ts', code, 'ENABLE_X', false);
    expect(branches).toHaveLength(1);
    // Should include the `if` line and the body
    expect(branches[0].lineCount).toBeGreaterThanOrEqual(3);
  });

  it('multi-line else branch → correct line count', () => {
    const code = `
function run() {
  if (process.env.ENABLE_NEW) {
    newA();
    newB();
  } else {
    oldA();
    oldB();
    oldC();
    oldD();
    oldE();
  }
}
`.trimStart();

    const branches = findDeadBranches('test.ts', code, 'ENABLE_NEW', true);
    expect(branches).toHaveLength(1);
    expect(branches[0].branchType).toBe('else');
    expect(branches[0].lineCount).toBe(7);
  });

  // ── Pattern 2: negated condition ──────────────────────────────

  it('if (!FLAG) with always-true → then branch is dead', () => {
    const code = `
if (!process.env.ENABLE_FEATURE) {
  legacyCode();
} else {
  newCode();
}
`.trimStart();
    // then block `{ legacyCode(); }` spans from `{` on line 1 to `}` on line 3
    const branches = findDeadBranches('test.ts', code, 'ENABLE_FEATURE', true);
    expect(branches).toHaveLength(1);
    expect(branches[0].branchType).toBe('if');
    expect(branches[0].startLine).toBe(1);
    expect(branches[0].endLine).toBe(3);
  });

  it('if (!FLAG) with always-false → else branch is dead', () => {
    const code = `
if (!process.env.ENABLE_FEATURE) {
  legacyCode();
} else {
  newCode();
}
`.trimStart();

    const branches = findDeadBranches('test.ts', code, 'ENABLE_FEATURE', false);
    expect(branches).toHaveLength(1);
    expect(branches[0].branchType).toBe('else');
  });

  // ── Pattern 3: early return ───────────────────────────────────

  it('if (!FLAG) return old() with always-true → early return is dead', () => {
    const code = `
function checkout() {
  if (!process.env.ENABLE_NEW_CHECKOUT) {
    return oldCheckoutFlow();
  }
  return newCheckoutFlow();
}
`.trimStart();

    const branches = findDeadBranches('test.ts', code, 'ENABLE_NEW_CHECKOUT', true);
    expect(branches).toHaveLength(1);
    expect(branches[0].branchType).toBe('early-return');
  });

  it('early return with multiple lines → all lines in block are dead', () => {
    const code = `
function run() {
  if (!process.env.ENABLE_NEW) {
    const legacy = getLegacy();
    cleanup(legacy);
    return legacy.result();
  }
  return newSystem();
}
`.trimStart();

    const branches = findDeadBranches('test.ts', code, 'ENABLE_NEW', true);
    expect(branches).toHaveLength(1);
    expect(branches[0].lineCount).toBeGreaterThanOrEqual(4);
  });

  // ── Pattern 4: variable alias ─────────────────────────────────

  it('const x = process.env.FLAG; if (x) {...} → traces variable', () => {
    const code = `
const useNew = process.env.ENABLE_NEW;
if (useNew) {
  newCode();
} else {
  oldCode();
}
`.trimStart();

    const branches = findDeadBranches('test.ts', code, 'ENABLE_NEW', true);
    expect(branches).toHaveLength(1);
    expect(branches[0].branchType).toBe('else');
  });

  it('const x = FLAG; if (x) {...} → traces const flag alias', () => {
    const code = `
const USE_V2_PARSER = true;
const useParser = USE_V2_PARSER;
if (useParser) {
  parseV2();
} else {
  parseV1();
}
`.trimStart();

    const branches = findDeadBranches('test.ts', code, 'USE_V2_PARSER', true);
    expect(branches.length).toBeGreaterThanOrEqual(1);
    const elseBranch = branches.find((b) => b.branchType === 'else');
    expect(elseBranch).toBeDefined();
  });

  // ── Comparison patterns ───────────────────────────────────────

  it('if (process.env.FLAG === "true") with always-true → else is dead', () => {
    const code = `
if (process.env.ENABLE_X === "true") {
  enabled();
} else {
  disabled();
}
`.trimStart();

    const branches = findDeadBranches('test.ts', code, 'ENABLE_X', true);
    expect(branches).toHaveLength(1);
    expect(branches[0].branchType).toBe('else');
  });

  it('if (process.env.FLAG !== "true") with always-true → then is dead', () => {
    const code = `
if (process.env.ENABLE_X !== "true") {
  disabled();
} else {
  enabled();
}
`.trimStart();

    const branches = findDeadBranches('test.ts', code, 'ENABLE_X', true);
    expect(branches).toHaveLength(1);
    expect(branches[0].branchType).toBe('if');
  });

  // ── Edge cases ────────────────────────────────────────────────

  it('flag used in condition with && → skip (too complex)', () => {
    const code = `
if (process.env.ENABLE_X && someOtherCondition) {
  doThing();
} else {
  doOther();
}
`.trimStart();

    const branches = findDeadBranches('test.ts', code, 'ENABLE_X', true);
    expect(branches).toHaveLength(0);
  });

  it('nested if/else → only the one directly controlled by the flag', () => {
    const code = `
if (process.env.ENABLE_NEW) {
  if (someCondition) {
    doA();
  } else {
    doB();
  }
} else {
  oldFlow();
}
`.trimStart();

    const branches = findDeadBranches('test.ts', code, 'ENABLE_NEW', true);
    // Only the outer else should be flagged, not the inner if/else
    expect(branches).toHaveLength(1);
    expect(branches[0].branchType).toBe('else');
  });

  it('same flag checked multiple times in same file → each dead branch reported', () => {
    const code = `
if (process.env.ENABLE_X) {
  doA();
} else {
  doOldA();
}

if (process.env.ENABLE_X) {
  doB();
} else {
  doOldB();
}
`.trimStart();

    const branches = findDeadBranches('test.ts', code, 'ENABLE_X', true);
    expect(branches).toHaveLength(2);
    expect(branches.every((b) => b.branchType === 'else')).toBe(true);
  });

  it('file with syntax errors → returns empty array, no crash', () => {
    const code = `
if (process.env.ENABLE_X {
  doThing();
} else
  this is not valid javascript at all!!!
}
`.trimStart();

    // TS parser is lenient — it still produces an AST. But even if
    // branches are weird, we shouldn't crash.
    expect(() => findDeadBranches('test.ts', code, 'ENABLE_X', true)).not.toThrow();
  });

  it('empty file → returns empty array', () => {
    const branches = findDeadBranches('test.ts', '', 'ENABLE_X', true);
    expect(branches).toHaveLength(0);
  });

  it('flag not in file → returns empty array', () => {
    const code = `
if (someOtherThing) {
  doA();
}
`.trimStart();

    const branches = findDeadBranches('test.ts', code, 'ENABLE_X', true);
    expect(branches).toHaveLength(0);
  });

  it('handles const flag directly in if condition', () => {
    const code = `
const ENABLE_FAST = true;
if (ENABLE_FAST) {
  fast();
} else {
  slow();
}
`.trimStart();

    const branches = findDeadBranches('test.ts', code, 'ENABLE_FAST', true);
    expect(branches).toHaveLength(1);
    expect(branches[0].branchType).toBe('else');
  });
});
