if (process.env.ENABLE_FEATURE) {
  doThing();
} else {
  doOldThing();
}

function doThing() {}
function doOldThing() {}
