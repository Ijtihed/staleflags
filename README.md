# staleflags

**Your feature flags served their purpose. staleflags finds the dead code they left behind.**

> You already lint your code. staleflags audits your feature flags. It scans your `.env` files, compares values across environments, checks git history, and tells you which flags are dead, aging, or still doing their job. Same value in dev, staging, and prod? That flag is dead, and the else branch is unreachable. staleflags finds it, counts the dead lines, and tells you exactly what to remove.

## Quick Start

```bash
npx staleflags
```

Run in any project with `.env` files. No install, no config. Results in seconds.

```
  staleflags v0.1.0 — scanning for feature flags

  Found 5 flags across 4 files · 17 lines of dead code

  ⚰️  DEAD FLAGS (same value in every environment)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    ENABLE_NEW_CHECKOUT
      Value: true in .env.development, .env.staging, .env.production (all 3 environments)
      Introduced: 14 months ago
      Value unchanged: 14 months ago
      Dead code: src/checkout.ts:4-15 (else branch, 12 lines)
      Total: 12 lines of dead code

    USE_V2_PARSER
      Value: const USE_V2_PARSER = true (hardcoded in src/config.ts:1)
      Dead code: src/config.ts:7-9 (else branch, 3 lines)
      Total: 3 lines of dead code

  ✅ ACTIVE FLAGS (doing their job)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    FEATURE_DARK_MODE    true in .env.development · false in .env.production

  👻 PHANTOM FLAGS (read in code, never defined)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    FF_SECRET_FEATURE
      Referenced in code but never defined in any environment file

  SUMMARY: 5 flags · 2 dead · 1 active
  DEAD CODE: 17 lines across 2 files (removable today)
```

---

## How It Works

1. **Scans your codebase** — finds env var flags, hardcoded constants, and config flags across JS/TS/Python/Go/Ruby.

2. **Compares across environments** — checks if each flag has the same value in every `.env` file. Same everywhere = dead.

3. **Quantifies the damage** — finds the if/else blocks controlled by dead flags, counts the dead branch lines, gives you the total.

---

## What It Checks

| # | Signal | What it catches |
|---|--------|----------------|
| 1 | **Cross-environment consistency** | Is this flag the same value in dev, staging, and prod? Same everywhere = dead. **This is the one no other tool does.** |
| 2 | **Hardcoded constants** | `const ENABLE_X = true` unchanged for months. Not a flag anymore — it's dead code with a name. |
| 3 | **Flag age** | How long since this flag was introduced (git history). Older flags are more likely to be done. |
| 4 | **Value age** | How long since the value last changed. A flag that hasn't been toggled in 6 months is suspicious. |
| 5 | **Dead code quantification** | Exact line ranges of unreachable code behind dead flags. Not just "this flag is stale" — how many lines can you delete. |
| 6 | **Phantom detection** | Code reads a flag that no config defines. Evaluates to `undefined` everywhere. |
| 7 | **Orphan detection** | Config defines a flag that no code reads. Leftover config clutter. |

---

## Classifications

| Status | Meaning |
|--------|---------|
| ⚰️ **Dead** | Same value in every environment. The other branch is unreachable. Remove the flag and the dead code. |
| 🕰️ **Aging** | Different in at least one env, but code behind it hasn't changed in months. Probably done. |
| 👻 **Phantom** | Code reads the flag but no config defines it. Evaluates to undefined everywhere. |
| 🔇 **Orphan** | Config defines it but no code reads it. Leftover config clutter. |
| ✅ **Active** | Different values across environments, recently toggled. Doing its job. |

---

## Why Not X?

| Tool | What it does | What it misses |
|------|--------------|----------------|
| **Piranha (Uber)** | Removes stale flag code | Only works with specific SDKs. YOU tell it which flags are stale. |
| **FlagShark** | Tracks flag lifecycle | Tied to LaunchDarkly/Unleash/Split. SaaS. |
| **LaunchDarkly Code Refs** | Finds LD SDK calls | Only LaunchDarkly. Not homegrown flags. |
| **ESLint** | Lints code quality | Doesn't know your `.env` files or flag values. |
| **dotenvcheck** | Cross-refs env vars | Doesn't quantify dead code. Doesn't check cross-env consistency. |

staleflags is the only tool that reads your `.env` files, compares flag values across environments, and quantifies the dead code behind stale flags.

---

## GitHub Action

Create `.github/workflows/staleflags.yml`:

```yaml
name: staleflags
on:
  pull_request:
  schedule:
    - cron: '0 9 * * 1'

jobs:
  flags:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: Ijtihed/staleflags@v1
        with:
          fail-on: dead
```

---

## CLI Reference

```
staleflags [options]              Scan current directory
staleflags explain <FLAG_NAME>    Deep-dive a single flag

Options:
  --path <dir>             Directory to scan (default: cwd)
  --json                   Output JSON
  --markdown               Output Markdown
  --fail-on <level>        Exit non-zero if flags found: dead | aging | all | none
  --env-prefixes <list>    Comma-separated flag prefixes
                           (default: ENABLE_,FEATURE_,FF_,USE_,DISABLE_,TOGGLE_)
  -h, --help               Show this help
  -v, --version            Show version
```

---

## Get Started

**Terminal:**

```bash
npx staleflags
```

`--json` `--markdown` `--fail-on dead`

**GitHub Action:**

```yaml
name: staleflags
on:
  pull_request:
  schedule:
    - cron: '0 9 * * 1'
jobs:
  flags:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: Ijtihed/staleflags@v1
        with:
          fail-on: dead
```

**AI Prompt:**

```
Add staleflags to this project. Create .github/workflows/staleflags.yml that runs on every PR using Ijtihed/staleflags@v1. Then run npx staleflags locally and clean up any dead flags it finds.
```

---

[MIT](LICENSE) · Built by [Ijtihed](https://github.com/Ijtihed)
