if (process.env.ENABLE_ASYNC_TASKER === 'true') {
  runAsync();
} else {
  runSync();
}

if (process.env.FEATURE_BETA) {
  betaFeature();
}

function runAsync() {}
function runSync() {}
function betaFeature() {}
