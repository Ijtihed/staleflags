const useDarkMode = process.env.FEATURE_DARK_MODE === 'true';

export function getTheme() {
  if (useDarkMode) {
    return 'dark';
  }
  return 'light';
}
