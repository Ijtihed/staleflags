import type { ScanResult } from '@staleflags/core';

export function formatJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}
