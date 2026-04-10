"use client";

import Header from "@/components/header";
import Footer from "@/components/footer";
import CopyBlock from "@/components/copy-block";

const ACTION_YAML = `name: staleflags
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
          fail-on: dead`;

const AI_PROMPT = `Add staleflags to this project. Create .github/workflows/staleflags.yml that runs on every PR using Ijtihed/staleflags@v1. Then run npx staleflags locally and clean up any dead flags it finds.`;

const CHECKS = [
  {
    name: "Cross-environment consistency",
    emphasis: true,
    desc: "Is this flag the same value in dev, staging, and prod? Same everywhere = dead. The other branch is unreachable.",
  },
  {
    name: "Hardcoded constants",
    emphasis: false,
    desc: "const ENABLE_X = true unchanged for months. Not a flag anymore — it's dead code with a name.",
  },
  {
    name: "Flag age",
    emphasis: false,
    desc: "How long since this flag was introduced (git history). Older flags are more likely to be done.",
  },
  {
    name: "Value age",
    emphasis: false,
    desc: "How long since the value last changed. A flag that hasn't been toggled in 6 months is suspicious.",
  },
  {
    name: "Dead code quantification",
    emphasis: false,
    desc: "Exact line ranges of unreachable code behind dead flags. Not just \"this flag is stale\" — how many lines can you delete.",
  },
  {
    name: "Phantom detection",
    emphasis: false,
    desc: "Code reads a flag that no config defines. Evaluates to undefined everywhere.",
  },
  {
    name: "Orphan detection",
    emphasis: false,
    desc: "Config defines a flag that no code reads. Leftover config clutter.",
  },
];

const COMPETITORS = [
  { tool: "Piranha (Uber)", does: "Removes stale flag code", missing: "Only works with specific SDKs. YOU tell it which flags are stale." },
  { tool: "FlagShark", does: "Tracks flag lifecycle", missing: "Tied to LaunchDarkly/Unleash/Split. SaaS." },
  { tool: "LD Code Refs", does: "Finds LaunchDarkly SDK calls", missing: "Only LaunchDarkly. Not homegrown flags." },
  { tool: "ESLint", does: "Lints code quality", missing: "Doesn't know your .env files or flag values." },
  { tool: "dotenvcheck", does: "Cross-refs env vars", missing: "Doesn't quantify dead code. Doesn't check cross-env consistency." },
];

const TERMINAL_OUTPUT = `  staleflags v0.1.0 — scanning for feature flags

  Found 5 flags across 4 files · 17 lines of dead code

  ⚰️  DEAD FLAGS (same value in every environment)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    ENABLE_NEW_CHECKOUT
      Value: true in .env.development, .env.staging, .env.production
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
  DEAD CODE: 17 lines across 2 files (removable today)`;

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col">

        {/* Hero */}
        <section className="min-h-dvh flex flex-col items-center justify-center px-6 shrink-0 pt-20 pb-24 md:pt-0 md:pb-32">
          <div className="w-full max-w-2xl mx-auto text-center">
            <h1 className="font-[Manrope] font-extrabold text-[clamp(2.5rem,11vw,8rem)] leading-[0.9] tracking-tighter text-white select-none mb-10">
              staleflags.
            </h1>
            <p className="font-[JetBrains_Mono] text-xs sm:text-sm text-neutral-400 uppercase tracking-[0.25em] mb-4 max-w-md mx-auto">
              your feature flags served their purpose. staleflags finds the dead code they left behind.
            </p>
            <p className="font-[JetBrains_Mono] text-[0.7rem] text-neutral-500 leading-relaxed mb-8 md:mb-10 max-w-lg mx-auto">
              You already lint your code. staleflags audits your feature flags.
              It scans your .env files, compares values across environments,
              and tells you which flags are dead, aging, or still doing their job.
            </p>
            <a
              href="https://www.npmjs.com/package/staleflags"
              target="_blank"
              rel="noreferrer"
              className="inline-block border border-neutral-700 px-8 py-3 bg-neutral-950 hover:border-neutral-400 hover:bg-neutral-900 transition-all duration-300"
            >
              <code className="font-[JetBrains_Mono] text-base text-white tracking-wider">
                npx staleflags
              </code>
            </a>
            <p className="mt-4 font-[JetBrains_Mono] text-[0.7rem] text-neutral-600 uppercase tracking-[0.15em]">
              run in any project with .env files. zero config.
            </p>
          </div>
        </section>

        {/* Terminal preview */}
        <section className="px-4 sm:px-6 pb-16 md:pb-24">
          <div className="max-w-3xl mx-auto">
            <pre className="border border-neutral-800 bg-neutral-950/80 p-5 sm:p-8 overflow-x-auto">
              <code className="font-[JetBrains_Mono] text-[0.7rem] sm:text-[0.8rem] leading-relaxed whitespace-pre text-neutral-400">
                {TERMINAL_OUTPUT}
              </code>
            </pre>
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 py-16 md:py-28">
          <div className="max-w-4xl mx-auto">
            <p className="font-[JetBrains_Mono] text-xs text-neutral-600 uppercase tracking-[0.3em] mb-4 md:mb-6 text-center">
              How it works
            </p>
            <h2 className="font-[Manrope] text-2xl sm:text-3xl md:text-4xl font-light text-white tracking-tight text-center mb-12 md:mb-20">
              One command. Every flag classified.
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4">
              <div className="text-center">
                <div className="w-12 h-12 border border-neutral-800 flex items-center justify-center mx-auto mb-5">
                  <span className="font-[Manrope] text-lg font-light text-neutral-500">1</span>
                </div>
                <p className="font-[Manrope] text-base text-white mb-2">Scans your codebase</p>
                <p className="font-[JetBrains_Mono] text-xs text-neutral-500 leading-relaxed max-w-[240px] mx-auto">
                  Finds env var flags, hardcoded constants, and config flags across
                  <span className="text-neutral-300"> JS/TS/Python/Go/Ruby</span>.
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 border border-neutral-800 flex items-center justify-center mx-auto mb-5">
                  <span className="font-[Manrope] text-lg font-light text-neutral-500">2</span>
                </div>
                <p className="font-[Manrope] text-base text-white mb-2">Compares across environments</p>
                <p className="font-[JetBrains_Mono] text-xs text-neutral-500 leading-relaxed max-w-[240px] mx-auto">
                  Checks if each flag has the same value in every
                  <span className="text-neutral-300"> .env</span> file.
                  Same everywhere = dead.
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 border border-neutral-800 flex items-center justify-center mx-auto mb-5">
                  <span className="font-[Manrope] text-lg font-light text-neutral-500">3</span>
                </div>
                <p className="font-[Manrope] text-base text-white mb-2">Quantifies the damage</p>
                <p className="font-[JetBrains_Mono] text-xs text-neutral-500 leading-relaxed max-w-[240px] mx-auto">
                  Finds the if/else blocks controlled by dead flags,
                  counts the dead branch lines, gives you the total.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* What it checks */}
        <section className="px-4 sm:px-6 py-16 md:py-28">
          <div className="max-w-3xl mx-auto">
            <p className="font-[JetBrains_Mono] text-xs text-neutral-600 uppercase tracking-[0.3em] mb-4 md:mb-6 text-center">
              What it checks
            </p>
            <h2 className="font-[Manrope] text-2xl sm:text-3xl md:text-4xl font-light text-white tracking-tight text-center mb-12 md:mb-16">
              7 checks. Zero config.
            </h2>

            <div className="space-y-0">
              {CHECKS.map((check, i) => (
                <div
                  key={check.name}
                  className="flex items-start gap-4 sm:gap-6 py-5 border-b border-neutral-800/50 last:border-0"
                >
                  <span className="font-[Manrope] text-sm text-neutral-700 tabular-nums shrink-0 pt-0.5 w-5 text-right">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-4 mb-1">
                      <p className="font-[Manrope] text-sm sm:text-base text-white">
                        {check.name}
                      </p>
                      {check.emphasis && (
                        <span className="font-[JetBrains_Mono] text-[0.65rem] shrink-0 text-staleflags-accent">
                          the novel one
                        </span>
                      )}
                    </div>
                    <p className="font-[JetBrains_Mono] text-[0.7rem] sm:text-xs text-neutral-500 leading-relaxed">
                      {check.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="w-16 h-px bg-neutral-800 mx-auto" />

        {/* Why not X */}
        <section className="px-4 sm:px-6 py-16 md:py-28">
          <div className="max-w-3xl mx-auto">
            <p className="font-[JetBrains_Mono] text-xs text-neutral-600 uppercase tracking-[0.3em] mb-4 md:mb-6 text-center">
              Why not X?
            </p>
            <h2 className="font-[Manrope] text-2xl sm:text-3xl md:text-4xl font-light text-white tracking-tight text-center mb-12 md:mb-16">
              Nothing else does this.
            </h2>

            <div className="space-y-0">
              {COMPETITORS.map((c) => (
                <div
                  key={c.tool}
                  className="flex items-start gap-4 sm:gap-6 py-5 border-b border-neutral-800/50 last:border-0"
                >
                  <span className="font-[Manrope] text-sm text-neutral-400 shrink-0 pt-0.5 w-28 sm:w-36">
                    {c.tool}
                  </span>
                  <div className="min-w-0">
                    <p className="font-[JetBrains_Mono] text-xs text-neutral-400 mb-0.5">
                      {c.does}
                    </p>
                    <p className="font-[JetBrains_Mono] text-[0.7rem] text-neutral-600">
                      {c.missing}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="w-16 h-px bg-neutral-800 mx-auto" />

        {/* Classifications */}
        <section className="px-4 sm:px-6 py-16 md:py-28">
          <div className="max-w-3xl mx-auto">
            <p className="font-[JetBrains_Mono] text-xs text-neutral-600 uppercase tracking-[0.3em] mb-4 md:mb-6 text-center">
              Classifications
            </p>
            <h2 className="font-[Manrope] text-2xl sm:text-3xl md:text-4xl font-light text-white tracking-tight text-center mb-12 md:mb-16">
              What each status means.
            </h2>
            <div className="space-y-0">
              {[
                { icon: "⚰️", status: "Dead", label: "text-red-500", desc: "Same value in every environment. The other branch is unreachable. Remove the flag and the dead code." },
                { icon: "🕰️", status: "Aging", label: "text-yellow-400", desc: "Different in at least one env, but code behind it hasn't changed in months. Probably done." },
                { icon: "👻", status: "Phantom", label: "text-violet-400", desc: "Code reads the flag but no config defines it. Evaluates to undefined everywhere." },
                { icon: "🔇", status: "Orphan", label: "text-neutral-400", desc: "Config defines it but no code reads it. Leftover config clutter." },
                { icon: "✅", status: "Active", label: "text-emerald-400", desc: "Different values across environments, recently toggled. Doing its job." },
              ].map(({ icon, status, label, desc }) => (
                <div key={status} className="flex items-start gap-6 py-5 border-b border-neutral-800/50 last:border-0">
                  <span className="text-xl shrink-0 w-8 text-center">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-4 mb-1">
                      <p className={`font-[Manrope] text-base font-semibold ${label}`}>{status}</p>
                    </div>
                    <p className="font-[JetBrains_Mono] text-xs text-neutral-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="w-16 h-px bg-neutral-800 mx-auto" />

        {/* Get started */}
        <section className="px-4 sm:px-6 py-16 md:py-28">
          <div className="max-w-5xl mx-auto">
            <p className="font-[JetBrains_Mono] text-xs text-neutral-600 uppercase tracking-[0.3em] mb-4 md:mb-6 text-center">
              Get started
            </p>
            <h2 className="font-[Manrope] text-2xl sm:text-3xl md:text-4xl font-light text-white tracking-tight text-center mb-10 md:mb-20">
              Pick how you want to use it.
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

              {/* Terminal */}
              <div className="border border-neutral-800 p-5 sm:p-7 flex flex-col">
                <p className="font-[Manrope] text-lg text-white mb-2">Terminal</p>
                <p className="font-[JetBrains_Mono] text-[0.75rem] text-neutral-500 leading-relaxed mb-5">
                  Run once in any project. Nothing to install, nothing to configure.
                </p>
                <div className="mt-auto space-y-3">
                  <CopyBlock code="npx staleflags" lang="bash" />
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                    <span className="font-[JetBrains_Mono] text-[0.6rem] text-neutral-600">--json</span>
                    <span className="font-[JetBrains_Mono] text-[0.6rem] text-neutral-600">--markdown</span>
                    <span className="font-[JetBrains_Mono] text-[0.6rem] text-neutral-600">--fail-on dead</span>
                  </div>
                </div>
              </div>

              {/* GitHub Action */}
              <div className="border border-neutral-800 p-5 sm:p-7 flex flex-col">
                <p className="font-[Manrope] text-lg text-white mb-2">GitHub Action</p>
                <p className="font-[JetBrains_Mono] text-[0.75rem] text-neutral-500 leading-relaxed mb-3">
                  Add one file. Runs on every PR and weekly on schedule. Uses <span className="text-neutral-300">fetch-depth: 0</span> for git history.
                </p>
                <div className="mt-auto">
                  <CopyBlock code={ACTION_YAML} lang=".github/workflows/staleflags.yml" />
                </div>
              </div>

              {/* AI Prompt */}
              <div className="border border-neutral-800 p-5 sm:p-7 flex flex-col">
                <p className="font-[Manrope] text-lg text-white mb-2">AI Prompt</p>
                <p className="font-[JetBrains_Mono] text-[0.75rem] text-neutral-500 leading-relaxed mb-5">
                  Paste into Cursor, Claude Code, or Copilot. AI does the rest.
                </p>
                <div className="mt-auto">
                  <CopyBlock code={AI_PROMPT} lang="prompt" />
                </div>
              </div>

            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
