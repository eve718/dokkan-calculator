Project orientation
- **Purpose:** Single-page Dokkan Battle ATK calculator. Data-driven UI renders events → stages → battles → phases → enemies.
- **Files to inspect first:** `package.json`, `index.html`, `js/data.js`, `js/formulas.js`, `js/navigation.js`, `js/calculator.js`, `js/app.js`.

How the app is structured
- **Data-driven core:** `js/data.js` defines `gameData` with nested arrays: events → stages → battles (or legacy phases) → phases → enemies. Each enemy includes `id`, `inputs`, `outputs`, `image`, and `formula` (string id).
- **Formulas:** `js/formulas.js` exposes a `formulaFunctions` object keyed by numeric ids (e.g. `1722001511`) that return results for outputs used by the UI.
- **UI & routing:** `js/navigation.js` contains SPA navigation functions (`showPage`, `showStagesPage`, `showBattlesPage`, `showEnemiesPage`) and builds DOM nodes dynamically. It expects `gameData` shape from `js/data.js`.
- **Calculator logic:** `js/calculator.js` reads input DOM elements by id pattern `${enemy.id}_${input.id}`, evaluates `formulaFunctions[enemy.formula]`, and writes results to `${enemy.id}_${output.id}` elements. Input validation and debouncing live here.
- **Bootstrap:** `js/app.js` runs `showPage('events')` on DOMContentLoaded. Script load order matters: `data.js`, `formulas.js` must be loaded before `navigation.js`/`calculator.js`.

Developer workflows & commands
- Local dev: no bundler. Open `index.html` in a browser (or run a static server). The page references plain JS files under `js/`.
- Obfuscation: `npm run obfuscate` uses `javascript-obfuscator` to produce `js/data-obfuscated.js` and `js/formulas-obfuscated.js`. This is wired into `precommit` in `package.json`.
- Netlify: `package.json` has a `netlify-build` script that is a no-op (site uses pre-obfuscated files for deployed builds). There is no other build step.

Important conventions & gotchas
- IDs are significant: event/stage/battle/phase/enemy ids are used as DOM id prefixes. Do not change id formats without updating DOM selectors in `js/navigation.js` and `js/calculator.js`.
- Input/output DOM id pattern: `${enemy.id}_${input.id}` and `${enemy.id}_${output.id}` — code relies on these exact names to find fields and results.
- `formulaFunctions` keys are numbers but accessed via `formulaFunctions[enemy.formula]` where `enemy.formula` is a string in `data.js`. JavaScript converts keys to strings, but be careful if refactoring to ES modules.
- Legacy data shape: some stages use `phases` directly (legacy) while others use `battles[].phases`. Use `getStageBattles(stage)` in `navigation.js` as the compatibility example.
- Images and static assets: referenced as relative paths (e.g., `images/enemies/...`). Keep those paths intact when moving files.

Editing guidance & examples
- To add a new enemy: add its entry under a phase in `js/data.js`, give it a unique `id`, define `inputs` (with `id`, `type`, `default`), and reference the formula id under `formula`.
- To implement calculation for that enemy: add an entry to `formulaFunctions` in `js/formulas.js` with the same id (e.g., `1723001234: function(inputs) { return { normal_atk: ..., super_atk: ... } }`).
- Example: input element lookup in `js/calculator.js`:
  - `const inputField = document.getElementById(`${enemy.id}_${input.id}`)`
  - Output element id: `${enemy.id}_${output.id}`

Debugging tips
- If UI shows no content, confirm `js/data.js` and `js/formulas.js` loaded before `navigation.js` in `index.html`.
- If a formula doesn't run, check console for `Formula not found for Enemy ${enemyId}` and verify the `formula` id in `data.js` matches a key in `formulas.js`.
- When adding tests manually, emulate DOM element ids used by `calculator.js` to verify calculation functions.

What an AI assistant should do first
- Inspect `js/data.js` to understand the id structure and sample enemy entries.
- Open `js/formulas.js` to find the corresponding numeric formula implementations.
- Read `js/navigation.js` and `js/calculator.js` to learn DOM id conventions and UI flow before changing data shapes or formulas.

If anything is unclear, tell me which file or area you'd like expanded and I will update this guidance.
