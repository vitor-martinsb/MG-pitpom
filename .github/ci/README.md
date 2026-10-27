# Validation pipeline

The previous staging run (40534626254) spent about 11 minutes building and
validating the Linux container, followed by almost 15 minutes in the browser
course group. The workflow now separates compilation from test execution:

- Asset/generator checks and CI coverage contracts run first.
- WebAssembly and native executables build in parallel, with independent
  BuildKit GitHub Actions cache scopes. Only runtime assets and executables
  are uploaded; no CMake caches or compiler outputs cross runner paths.
- Five CTest shards execute every native test exactly once (`-I index,,5`).
  The first shard also executes all three unit tests.
- Two Node test shards validate the full server/protocol suite.
- Twelve browser groups retain all 18 original browser scripts. Campaign
  validation is divided into four disjoint sets of 20 maps. Every map still
  runs on desktop and mobile, with unchanged rendering/authority assertions.
- The browser container pins the same Playwright version as the lockfile,
  avoiding a separate browser and system-dependency installation per group.
- The production container smoke check assembles the cached build stages and
  checks health, assets and deployment headers. Native tests are required in
  their own jobs; a regular `docker build .` still runs them inside Docker.
- `All validation passed` requires every job, including every matrix shard.
  Render's `after CI checks pass` must remain enabled on `staging`.

New pushes cancel obsolete runs on the same branch. Dev and staging runs have
different concurrency groups. Caches accelerate later builds; a cold run still
compiles everything. Parallel jobs consume runner capacity, so GitHub queue
time can affect elapsed time. Compare complete runs after caches are warm,
including time queued, rather than promising a fixed duration.

Local checks (Node 22.23.3):

```sh
node --test .github/ci/contracts.test.mjs
# From server/, with the normal game/server build available:
node test/campaign-browser.mjs --shard 1/4
node test/campaign-browser.mjs # all 80 maps, unchanged default
# From repository root, with compiled game/server:
node .github/ci/run-browser.mjs menu-motion
```

Each browser script prints elapsed time; native jobs retain JUnit XML and test
logs, and browser jobs retain screenshots and campaign budgets for two days.
`bot-updates-browser.mjs` keeps the responsiveness probe on a different bot
from the three-stroke DNF fixture, so an early successful hole by the probe
cannot make a later fixture shot unavailable.
