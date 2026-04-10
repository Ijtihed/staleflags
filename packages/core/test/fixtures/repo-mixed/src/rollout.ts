export function getRollout() {
  if (process.env.FF_GRADUAL_ROLLOUT === 'true') {
    return 'new-system';
  }
  return 'legacy-system';
}
