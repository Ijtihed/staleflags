import { describe, it, expect } from 'vitest';
import { formatRelativeTime, formatMonthYear, formatFullDate } from '../../src/history/format.js';

describe('formatRelativeTime', () => {
  const now = new Date('2026-04-09T12:00:00Z');

  it('1 day ago', () => {
    const date = new Date('2026-04-08T12:00:00Z');
    expect(formatRelativeTime(date, now)).toBe('1 day ago');
  });

  it('15 days ago', () => {
    const date = new Date('2026-03-25T12:00:00Z');
    expect(formatRelativeTime(date, now)).toBe('15 days ago');
  });

  it('1 month ago', () => {
    const date = new Date('2026-03-05T12:00:00Z');
    expect(formatRelativeTime(date, now)).toBe('1 month ago');
  });

  it('6 months ago', () => {
    const date = new Date('2025-10-01T12:00:00Z');
    expect(formatRelativeTime(date, now)).toBe('6 months ago');
  });

  it('1 year ago', () => {
    const date = new Date('2025-04-01T12:00:00Z');
    expect(formatRelativeTime(date, now)).toBe('1 year ago');
  });

  it('2 years ago', () => {
    const date = new Date('2024-03-01T12:00:00Z');
    expect(formatRelativeTime(date, now)).toBe('2 years ago');
  });

  it('just now (< 1 hour)', () => {
    const date = new Date('2026-04-09T11:30:00Z');
    expect(formatRelativeTime(date, now)).toBe('just now');
  });

  it('3 hours ago', () => {
    const date = new Date('2026-04-09T09:00:00Z');
    expect(formatRelativeTime(date, now)).toBe('3 hours ago');
  });
});

describe('formatMonthYear', () => {
  it('formats correctly', () => {
    const date = new Date('2025-02-15T10:00:00Z');
    expect(formatMonthYear(date)).toBe('Feb 2025');
  });
});

describe('formatFullDate', () => {
  it('formats correctly', () => {
    const date = new Date('2025-02-15T10:00:00Z');
    expect(formatFullDate(date)).toBe('Feb 15, 2025');
  });
});
