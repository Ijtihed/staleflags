const USE_V2_PARSER = true;
const ENABLE_LEGACY_COMPAT = false;

export function parse(input: string) {
  if (USE_V2_PARSER) {
    return parseV2(input);
  } else {
    return parseV1(input);
  }
}

function parseV2(input: string) { return input; }
function parseV1(input: string) { return input; }
