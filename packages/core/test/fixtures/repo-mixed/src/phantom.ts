export function maybeDoThing() {
  if (process.env.ENABLE_MYSTERY_FEATURE) {
    doTheThing();
  }
}

function doTheThing() {}
