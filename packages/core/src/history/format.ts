/**
 * Format a Date into a human-readable relative time string.
 * e.g. "3 days ago", "2 months ago", "1 year ago"
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const ms = now.getTime() - date.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30.44);
  const years = Math.floor(days / 365.25);

  if (years >= 1) {
    return years === 1 ? '1 year ago' : `${years} years ago`;
  }
  if (months >= 1) {
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  if (days >= 1) {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }
  if (hours >= 1) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  return 'just now';
}

/**
 * Format a Date as "Mon YYYY" e.g. "Feb 2025"
 */
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Format a Date as "Mon DD, YYYY" e.g. "Feb 12, 2025"
 */
export function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
