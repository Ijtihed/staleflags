import { describe, it, expect } from 'vitest';
import { measureDeadCode, branchPreview } from '../../src/dead-code/branch-measurer.js';
import type { DeadBranch } from '../../src/types.js';

function branch(file: string, start: number, end: number, type: DeadBranch['branchType'] = 'else'): DeadBranch {
  return { file, startLine: start, endLine: end, lineCount: end - start + 1, branchType: type };
}

describe('measureDeadCode', () => {
  it('single dead branch → correct line count', () => {
    const result = measureDeadCode([branch('a.ts', 10, 20)]);
    expect(result.totalDeadLines).toBe(11);
    expect(result.totalDeadFiles).toBe(1);
  });

  it('multiple non-overlapping branches → correct total', () => {
    const result = measureDeadCode([
      branch('a.ts', 10, 20),
      branch('a.ts', 30, 40),
    ]);
    expect(result.totalDeadLines).toBe(22);
    expect(result.totalDeadFiles).toBe(1);
  });

  it('branches in different files → correct file count', () => {
    const result = measureDeadCode([
      branch('a.ts', 10, 20),
      branch('b.ts', 5, 15),
    ]);
    expect(result.totalDeadLines).toBe(22);
    expect(result.totalDeadFiles).toBe(2);
  });

  it('overlapping branches → deduplicated', () => {
    const result = measureDeadCode([
      branch('a.ts', 10, 20),
      branch('a.ts', 15, 25),
    ]);
    // Lines 10-25 = 16 unique lines, not 22
    expect(result.totalDeadLines).toBe(16);
    expect(result.totalDeadFiles).toBe(1);
  });

  it('dead branch with 1 line → count = 1', () => {
    const result = measureDeadCode([branch('a.ts', 42, 42)]);
    expect(result.totalDeadLines).toBe(1);
  });

  it('dead branch with 500 lines → count = 500', () => {
    const result = measureDeadCode([branch('a.ts', 1, 500)]);
    expect(result.totalDeadLines).toBe(500);
  });

  it('empty input → zero', () => {
    const result = measureDeadCode([]);
    expect(result.totalDeadLines).toBe(0);
    expect(result.totalDeadFiles).toBe(0);
  });
});

describe('branchPreview', () => {
  const content = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');

  it('shows first 3 lines of a branch', () => {
    const preview = branchPreview(content, branch('a.ts', 5, 15));
    expect(preview).toHaveLength(4); // 3 lines + "more" indicator
    expect(preview[0]).toContain('line 5');
    expect(preview[1]).toContain('line 6');
    expect(preview[2]).toContain('line 7');
    expect(preview[3]).toContain('more lines');
  });

  it('short branch shows all lines without "more" indicator', () => {
    const preview = branchPreview(content, branch('a.ts', 5, 6), 3);
    expect(preview).toHaveLength(2);
    expect(preview[0]).toContain('line 5');
    expect(preview[1]).toContain('line 6');
  });
});
