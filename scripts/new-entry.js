#!/usr/bin/env node
/**
 * Dokkan Calculator – New Entry Wizard  (v7)
 *
 * Generates ready-to-paste data.js and formulas.js snippets for new event entries.
 *
 * Features:
 *   - PHASE-WIDE INPUTS: inputs shared by every enemy of a phase are collected
 *     once and stored in the phase's  globalInputs  array; the site renders them
 *     in a single panel above the enemy forms and merges their values into every
 *     enemy's ATK formula automatically.
 *   - DATA-DRIVEN CATALOGS: inputs and outputs are pulled live from js/data.js.
 *     The menus lead with the statistically most-used ids (×count shown) to keep
 *     the interface clean; rare ones stay reachable via "More inputs…" (full
 *     categorized browser) / "(show all)", and the list updates automatically
 *     as data.js grows. The "★ usually phase-wide" hint only appears while
 *     collecting phase-wide inputs.
 *   - EDIT MODE: edit an EXISTING event at every level — event name/visibility/
 *     id, stage & battle names, phase names & phase-wide inputs, enemy
 *     name/image/type/rarity and their inputs & outputs (add/remove/edit), plus
 *     add/remove of stages/battles/phases/enemies. Produces paste-ready
 *     replacement snippets (whole event or a single sub-entity) + a diff report
 *     and formula-safety notes.
 *   - CUSTOM FIELDS ALWAYS AVAILABLE: custom number/checkbox inputs — and a
 *     custom output id — can be created at any point, for anything not yet in
 *     data.js.

 *   - Two modes: create a brand-new event OR append new stages to an EXISTING event
 *     (existing events are read live from js/data.js; stage numbering continues
 *      automatically and ID collisions are skipped)
 *   - Draft saving & resume: unfinished work is saved as JSON under
 *     scripts/output/drafts/. On the next run the wizard lists incomplete events
 *     and you can continue right where you left off.
 *       · Auto-saved at every section boundary (event confirmed, stage header,
 *         battle defs, each completed battle, each completed stage)
 *       · [s] at section prompts = save & exit immediately
 *       · Ctrl+C is safe: the draft is saved before exiting
 *       · Granularity: within an open battle, phases/enemies re-ask on resume
 *   - Multi-stage generation: generate any number of stages in one run
 *   - Custom label prompt for every output field (not just Super ATK)
 *   - super_atk2 output supported
 *   - Battle-level entries (multi-battle stages supported)
 *   - Full go-back / redo history at every section boundary
 *
 * At every section confirmation prompt:
 *   [Enter]  Continue to next section
 *   [r]      Redo the current section from scratch
 *   [b]      Go back to the previous section
 *   [s]      Save the draft and exit (resume it on the next run)
 *
 * Output: scripts/output/entry-<eventId>.txt   (new events – full event block)
 *         scripts/output/append-<eventId>.txt  (append mode – extra stages only)
 * Drafts: scripts/output/drafts/draft-<mode>-<eventId>.json
 * Usage:  npm run new-entry
 */

'use strict';

const readline = require('readline');
const path     = require('path');
const fs       = require('fs');

const GO_BACK = Symbol('GO_BACK');

// ─── readline helpers ─────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question, defaultVal) {
    return new Promise(resolve => {
        const hint = defaultVal !== undefined ? ` [${defaultVal}]` : '';
        rl.question(`${question}${hint}: `, ans => {
            resolve(ans.trim() || (defaultVal !== undefined ? String(defaultVal) : ''));
        });
    });
}

async function askInt(question, defaultVal, min, max) {
    for (;;) {
        const n = parseInt(await ask(question, defaultVal), 10);
        if (!isNaN(n) && (min === undefined || n >= min) && (max === undefined || n <= max)) return n;
        const hint = [min != null && `>= ${min}`, max != null && `<= ${max}`].filter(Boolean).join(', ');
        console.log(`  ⚠  Whole number required${hint ? ` (${hint})` : ''}.`);
    }
}

async function pickOne(title, options) {
    console.log(`\n  ${title}`);
    options.forEach((o, i) => console.log(`    ${i + 1}. ${o.label}`));
    for (;;) {
        const n = parseInt(await ask('  Choice'), 10);
        if (!isNaN(n) && n >= 1 && n <= options.length) return options[n - 1];
        console.log('  ⚠  Enter a number from the list.');
    }
}

async function pickMany(title, options) {
    console.log(`\n  ${title}`);
    console.log('  (space-separated numbers, e.g.  1 3 5)');
    options.forEach((o, i) => console.log(`    ${i + 1}. ${o.label}`));
    for (;;) {
        const nums = (await ask('  Choices')).split(/\s+/).map(Number).filter(n => !isNaN(n));
        if (nums.length && nums.every(n => n >= 1 && n <= options.length)) return nums.map(n => options[n - 1]);
        console.log('  ⚠  Enter space-separated numbers from the list.');
    }
}

/**
 * After a section is collected, show a summary and prompt for navigation.
 * Returns 'ok' | 'redo' | 'back'.
 * When `saveData` is provided, an extra [s] option merges that data into the
 * draft and exits the wizard immediately (progress resumes on the next run).
 */
async function navPrompt(summary, saveData) {
    console.log(`\n  ✓  ${summary}`);
    console.log(saveData
        ? '  [Enter] Continue   [r] Redo this section   [b] Back   [s] Save & exit'
        : '  [Enter] Continue   [r] Redo this section   [b] Back');
    const ans = (await ask('  >', '')).toLowerCase();
    if (saveData && ans.startsWith('s')) {
        saveInProgress(saveData);
        saveAndExit();
    }
    if (ans.startsWith('b')) return 'back';
    if (ans.startsWith('r')) return 'redo';
    return 'ok';
}

// ─── constants ────────────────────────────────────────────────────────────────

const TYPES = [
    { label: 'SUP STR', typeIcon: 'sup_str', bg: 'str' },
    { label: 'SUP AGL', typeIcon: 'sup_agl', bg: 'agl' },
    { label: 'SUP TEQ', typeIcon: 'sup_teq', bg: 'teq' },
    { label: 'SUP INT', typeIcon: 'sup_int', bg: 'int' },
    { label: 'SUP PHY', typeIcon: 'sup_phy', bg: 'phy' },
    { label: 'EX  STR', typeIcon: 'ex_str',  bg: 'str' },
    { label: 'EX  AGL', typeIcon: 'ex_agl',  bg: 'agl' },
    { label: 'EX  TEQ', typeIcon: 'ex_teq',  bg: 'teq' },
    { label: 'EX  INT', typeIcon: 'ex_int',  bg: 'int' },
    { label: 'EX  PHY', typeIcon: 'ex_phy',  bg: 'phy' },
];

const RARITIES = [
    { label: 'LR',  value: 'lr'  },
    { label: 'UR',  value: 'ur'  },
    { label: 'SSR', value: 'ssr' },
    { label: 'SR',  value: 'sr'  },
    { label: 'R',   value: 'r'   },
    { label: 'N',   value: 'n'   },
];

/**
 * Static metadata for the input ids known today: categories, the phase-wide
 * hint and extra questions. The MENUS themselves are data-driven —
 * getCatalogStats() counts real usage in js/data.js and the pickers show the
 * statistically most-used ids first, merging this metadata with anything new
 * found in the data file (which surfaces under "Other (from data.js)").
 * Scope is decided by WHERE an input is added (phase-wide section vs an
 * enemy's inputs), never by a per-input question.
 */
const INPUT_CATALOG = [
    {
        category: 'ATK debuffs',
        presets: [
            { id: 'atk_debuff_passive', label: 'ATK debuff from passives (%)', type: 'number', min: 0, max: 100, default: 0, defaultScope: 'enemy' },
            { id: 'atk_debuff_super', label: 'ATK debuff from supers (%)', type: 'number', min: 0, max: 100, default: 0, defaultScope: 'enemy' },
        ],
    },
    {
        category: 'Attacks received / performed',
        presets: [
            { id: 'num_atks_received', label: 'ATKs received (num_atks_received)', type: 'number', min: 0, default: 0, defaultScope: 'enemy', asksMax: { question: '  Max ATKs received', def: 10 }, outLabel: 'Total ATKs received' },
            { id: 'atks_received', label: 'ATKs received within the turn', type: 'number', min: 0, max: 11, default: 0, defaultScope: 'enemy' },
            { id: 'num_ki_blasts_received', label: 'Total Ki Blast Supers received', type: 'number', min: 0, default: 0, defaultScope: 'enemy', asksMax: { question: '  Max Ki Blast Supers received', def: 3 } },
            { id: 'atks_performed', label: 'Attacks performed', type: 'number', min: 0, default: 0, defaultScope: 'enemy', asksMax: { question: '  Max attacks performed', def: 20 } },
            { id: 'sa_performed', label: 'Super ATKs performed', type: 'number', min: 0, max: 99, default: 0, defaultScope: 'enemy' },
            { id: 'turn_count', label: 'Current turn', type: 'number', min: 1, default: 1, defaultScope: 'global', asksMax: { question: '  Max turns (inclusive)', def: 6 } },
        ],
    },
    {
        category: 'Boss ally / field state',
        presets: [
            { id: 'zamasu', label: 'Is Zamasu alive at the start of turn?', type: 'checkbox', default: true, defaultScope: 'global' },
            { id: 'vegeta', label: 'Is Vegeta alive at the start of turn?', type: 'checkbox', default: true, defaultScope: 'global' },
            { id: 'territory_skill', label: 'Territory boost', type: 'checkbox', default: true, defaultScope: 'global' },
        ],
    },
    {
        category: 'Enemy HP conditions',
        presets: [
            { id: 'hp_condition', label: "Is enemy's HP at {%} or less?", type: 'checkbox', default: false, defaultScope: 'global', asksPick: { question: '  HP threshold (%)', options: [50, 70] } },
            { id: 'hp_condition1', label: "Is enemy's HP at {%} or less?", type: 'checkbox', default: false, defaultScope: 'global', asksPick: { question: '  HP threshold (%)', options: [75, 77] } },
            { id: 'hp_condition2', label: "Is enemy's HP at {%} or less?", type: 'checkbox', default: false, defaultScope: 'global', asksPick: { question: '  HP threshold (%)', options: [50] } },
        ],
    },
    {
        category: 'Team categories',
        presets: [
            { id: 'pure_saiyans', label: 'Is a character in the "Pure Saiyans" Category in the team?', type: 'checkbox', default: false, defaultScope: 'global' },
            { id: 'hybrid_saiyans', label: 'Is a character in the "Hybrid Saiyans" Category in the team?', type: 'checkbox', default: false, defaultScope: 'global' },
            { id: 'artificial_life_forms', label: 'Is a character in the "Artificial Life Forms" Category in the team?', type: 'checkbox', default: false, defaultScope: 'global' },
            { id: 'goku', label: 'Is a character whose name includes "Goku" in the team?', type: 'checkbox', default: false, defaultScope: 'global' },
        ],
    },
    {
        category: 'Present / not-present bosses',
        presets: [
            { id: 'kakunsa_or_rozie', label: 'Are Kakunsa or Rozie not present at the start of turn?', type: 'checkbox', default: false, defaultScope: 'global' },
            { id: 'kakunsa_and_rozie', label: 'Are Kakunsa and Rozie not present at the start of turn?', type: 'checkbox', default: false, defaultScope: 'global' },
            { id: 'goten_or_trunks', label: 'Are Goten or Trunks not present at the start of turn?', type: 'checkbox', default: false, defaultScope: 'global' },
            { id: 'goten_and_trunks', label: 'Are Goten and Trunks not present at the start of turn?', type: 'checkbox', default: false, defaultScope: 'global' },
            { id: 'gohan_or_trunks', label: 'Are Gohan or Trunks not present at the start of turn?', type: 'checkbox', default: false, defaultScope: 'global' },
            { id: 'gohan_or_goten', label: 'Are Gohan or Goten not present at the start of turn?', type: 'checkbox', default: false, defaultScope: 'global' },
        ],
    },
];

const CUSTOM_INPUT_BUILDERS = [
    {
        label: 'Custom number input',
        build: async () => {
            const id    = await ask('  Input ID (underscores, no spaces)');
            const label = await ask('  Label text');
            const min   = await askInt('  Min', 0);
            const max   = await askInt('  Max', 100, min);
            const def   = await askInt('  Default', min, min, max);
            return { id, label, type: 'number', min, max, default: def, defaultScope: 'enemy' };
        }
    },
    {
        label: 'Custom checkbox',
        build: async () => {
            const id    = await ask('  Input ID (underscores, no spaces)');
            const label = await ask('  Label text');
            const def   = (await ask('  Default checked?', 'true')) === 'true';
            return { id, label, type: 'checkbox', default: def, defaultScope: 'enemy' };
        }
    },
];

/** Asks a preset's extra questions (max / HP threshold) and returns the input def. */
async function buildPreset(preset) {
    const inp = { ...preset };
    delete inp.count;   // live usage metadata is not part of the data definition
    if (inp.asksMax) {
        inp.max = await askInt(inp.asksMax.question, inp.asksMax.def, inp.min ?? 0);
        delete inp.asksMax;
    }
    if (inp.asksPick) {
        const opts = inp.asksPick.options.map(v => ({ label: `${v}%`, value: v }));
        const chosen = await pickOne(inp.asksPick.question, opts);
        inp.label = inp.label.replace('{%}', String(chosen.value));
        delete inp.asksPick;
    }
    return inp;
}

// ─── data-driven catalogs (most-used inputs/outputs, live from js/data.js) ───

const TOP_INPUTS_LIMIT = 8;    // "most used" inputs shown before "More inputs…"
const TOP_OUTPUTS_LIMIT = 8;   // "most used" outputs shown before "(show all)"

let _catalogStats = undefined; // undefined = not computed yet

/**
 * Scans js/data.js and counts how often every input/output id is actually
 * used (per enemy; phase-wide inputs counted separately). Powers the dynamic
 * menus: most-used presets first, rare ones reachable via "More…" / "show all".
 * Cached for the session; empty maps when data.js cannot be parsed.
 */
function getCatalogStats() {
    if (_catalogStats) return _catalogStats;
    const inputs = new Map();   // id -> { count, globalCount, labels, shapes }
    const outputs = new Map();  // id -> { count, labels }
    let totalEnemies = 0;

    const bumpInput = (def, isGlobal) => {
        if (!def || !def.id) return;
        let e = inputs.get(def.id);
        if (!e) { e = { count: 0, globalCount: 0, labels: new Map(), shapes: new Map() }; inputs.set(def.id, e); }
        e.count++;
        if (isGlobal) e.globalCount++;
        e.labels.set(def.label, (e.labels.get(def.label) || 0) + 1);
        const shape = JSON.stringify({ type: def.type, min: def.min, max: def.max, default: def.default });
        e.shapes.set(shape, (e.shapes.get(shape) || 0) + 1);
    };
    const bumpOutput = (def) => {
        if (!def || !def.id) return;
        let e = outputs.get(def.id);
        if (!e) { e = { count: 0, labels: new Map() }; outputs.set(def.id, e); }
        e.count++;
        e.labels.set(def.label, (e.labels.get(def.label) || 0) + 1);
    };

    for (const ev of loadEvents() || []) {
        for (const st of ev.stages || []) {
            for (const b of getBattlesOf(st)) {
                for (const ph of b.phases || []) {
                    (ph.globalInputs || []).forEach(d => bumpInput(d, true));
                    for (const en of ph.enemies || []) {
                        totalEnemies++;
                        (en.inputs || []).forEach(d => bumpInput(d, false));
                        (en.outputs || []).forEach(o => bumpOutput(o));
                    }
                }
            }
        }
    }
    _catalogStats = { inputs, outputs, totalEnemies };
    return _catalogStats;
}

/** Most common label seen for an id (falls back to the provided default). */
function mostCommonLabel(entry, fallback) {
    if (!entry || !entry.labels || entry.labels.size === 0) return fallback;
    let best = null, bestN = -1;
    for (const [label, n] of entry.labels) {
        if (n > bestN) { best = label; bestN = n; }
    }
    return best;
}

/** Most common {type,min,max,default} shape seen for an input id. */
function mostCommonShape(entry) {
    if (!entry || !entry.shapes || entry.shapes.size === 0) return null;
    let best = null, bestN = -1;
    for (const [shape, n] of entry.shapes) {
        if (n > bestN) { best = JSON.parse(shape); bestN = n; }
    }
    return best;
}

/** Static catalog entry for an input id (undefined when data-only). */
function findStaticInput(id) {
    for (const g of INPUT_CATALOG) {
        const p = g.presets.find(p => p.id === id);
        if (p) return p;
    }
    return undefined;
}

/** Build a selectable preset for an input id: static metadata + live usage. */
function inputPresetById(id) {
    const entry = getCatalogStats().inputs.get(id);
    const staticDef = findStaticInput(id);
    const shape = staticDef || mostCommonShape(entry) || { type: 'number', min: 0, max: 100, default: 0 };
    const preset = { ...shape, id, label: (staticDef && staticDef.label) || mostCommonLabel(entry, id) };
    if (staticDef) {
        if (staticDef.defaultScope) preset.defaultScope = staticDef.defaultScope;
        if (staticDef.asksMax) preset.asksMax = staticDef.asksMax;
        if (staticDef.asksPick) preset.asksPick = staticDef.asksPick;
    } else {
        // ids only found in data.js: recommend phase-wide when they already are
        preset.defaultScope = (entry && entry.globalCount > 0) ? 'global' : 'enemy';
    }
    if (entry) preset.count = entry.count;
    return preset;
}

/** Top most-used input presets in js/data.js, excluding already-used ids. */
function getTopInputs(excludeIds = new Set(), limit = TOP_INPUTS_LIMIT) {
    const stats = getCatalogStats();
    return [...stats.inputs.keys()]
        .filter(id => !excludeIds.has(id))
        .sort((a, b) => (stats.inputs.get(b).count - stats.inputs.get(a).count))
        .slice(0, limit)
        .map(id => inputPresetById(id));
}

/**
 * Full categorized browser list: static catalog groups (annotated with live
 * usage counts) plus an "Other (from data.js)" group for ids that exist only
 * in the data file — so new inputs show up automatically.
 */
function getInputCategoriesFull(excludeIds = new Set()) {
    const stats = getCatalogStats();
    const staticIds = new Set();
    const groups = INPUT_CATALOG
        .map(g => ({
            category: g.category,
            presets: g.presets
                .filter(p => !excludeIds.has(p.id))
                .map(p => ({ ...p, count: (stats.inputs.get(p.id) || {}).count || 0 })),
        }))
        .filter(g => g.presets.length > 0);
    groups.forEach(g => g.presets.forEach(p => staticIds.add(p.id)));

    const other = [...stats.inputs.keys()]
        .filter(id => !excludeIds.has(id) && !staticIds.has(id))
        .map(id => inputPresetById(id))
        .sort((a, b) => (b.count || 0) - (a.count || 0));
    if (other.length > 0) groups.push({ category: 'Other (from data.js)', presets: other });
    return groups;
}

/** Merges live usage stats + the static catalog into a selectable output. */
function outputOptionById(id) {
    const entry = getCatalogStats().outputs.get(id);
    const staticDef = OUTPUT_PRESETS.find(o => o.id === id);
    const label = (staticDef && staticDef.label) || mostCommonLabel(entry, id);
    const opt = { id, label, defaultLabel: (staticDef && staticDef.defaultLabel) || label };
    if (entry) opt.count = entry.count;
    return opt;
}

/** All output ids seen in data.js plus the static catalog ids (deduped). */
function allOutputIds() {
    const ids = new Set(getCatalogStats().outputs.keys());
    OUTPUT_PRESETS.forEach(o => ids.add(o.id));
    return [...ids];
}

/** Top most-used outputs in js/data.js, excluding already-selected ids. */
function getTopOutputs(excludeIds = new Set(), limit = TOP_OUTPUTS_LIMIT) {
    const stats = getCatalogStats();
    return [...stats.outputs.keys()]
        .filter(id => !excludeIds.has(id))
        .sort((a, b) => (stats.outputs.get(b).count - stats.outputs.get(a).count))
        .slice(0, limit)
        .map(id => outputOptionById(id));
}

/** Every selectable output (dynamic ∪ static), most-used first. */
function getAllOutputOptions(excludeIds = new Set()) {
    return allOutputIds()
        .filter(id => !excludeIds.has(id))
        .map(id => outputOptionById(id))
        .sort((a, b) => (b.count || 0) - (a.count || 0));
}

/** Custom output builder (always available in the outputs menu). */
async function buildCustomOutput() {
    const id = await ask('  Output ID (underscores, no spaces, e.g. crit_atk)');
    const label = await ask('  Label text');
    return { id, label };
}

/**
 * Interactive input picker, data-driven: the most-used inputs in js/data.js
 * are offered first (with ×count) to keep the menu short; rare ones stay
 * reachable via "More inputs…" (full categorized browser, which also includes
 * ids that exist only in the data file). Custom builders always available.
 * The "★ usually phase-wide" hint is only shown while collecting phase-wide
 * inputs (showScopeTag) — it is just noise during per-enemy collection.
 * Returns a fresh input definition, or null when the user is done.
 * `excludeIds` hides input ids that are already used.
 */
async function pickInputPreset(excludeIds = new Set(), showScopeTag = false) {
    const tagFor = (p) => {
        const count = p.count ? `  ×${p.count}` : '';
        const scope = showScopeTag && p.defaultScope === 'global' ? '  ★ usually phase-wide' : '';
        return `${count}${scope}`;
    };

    const top = getTopInputs(excludeIds);
    const options = [
        ...top.map(p => ({ label: `${p.label}  [${p.id}]${tagFor(p)}`, preset: p })),
        { label: 'More inputs… (browse all by category)', more: true },
        ...CUSTOM_INPUT_BUILDERS.map(b => ({ label: b.label, custom: b })),
        { label: '(done — no more inputs)', done: true },
    ];

    const choice = await pickOne('Input (most used in js/data.js):', options);
    if (choice.done) return null;
    if (choice.custom) return await choice.custom.build();
    if (choice.more) return await browseAllInputs(excludeIds, showScopeTag);
    return await buildPreset(choice.preset);
}

/**
 * Full categorized browser over every known input (static catalog + anything
 * found in js/data.js, most-used first). Backing out returns to the main
 * input picker.
 */
async function browseAllInputs(excludeIds = new Set(), showScopeTag = false) {
    const groups = getInputCategoriesFull(excludeIds);
    if (groups.length === 0) {
        console.log('  (every known input is already added)');
        return await pickInputPreset(excludeIds, showScopeTag);
    }

    const options = [
        ...groups.map(g => ({ label: `${g.category}  (${g.presets.length} preset${g.presets.length === 1 ? '' : 's'})`, group: g })),
        { label: '(back — no more inputs)', done: true },
    ];
    const choice = await pickOne('Input category:', options);
    if (choice.done || !choice.group) return await pickInputPreset(excludeIds, showScopeTag);

    const presetChoices = choice.group.presets.map(p => ({
        label: `${p.label}  [${p.id}]${p.count ? `  ×${p.count}` : ''}${showScopeTag && p.defaultScope === 'global' ? '  ★ usually phase-wide' : ''}`,
        value: p,
    }));
    const picked = await pickOne(`Which input?  (${choice.group.category})`, presetChoices);
    return await buildPreset(picked.value);
}

const OUTPUT_PRESETS = [
    { label: 'Normal ATK',                     id: 'normal_atk',  defaultLabel: 'Normal ATK' },
    { label: 'Normal ATK after supering',      id: 'normal_atk2', defaultLabel: 'Normal ATK after supering' },
    { label: 'Normal ATK after supering 2',    id: 'normal_atk3', defaultLabel: 'Normal ATK after supering 2' },
    { label: 'Crit Normal ATK after supering', id: 'normal_atk4', defaultLabel: 'Crit Normal ATK after supering (ignores 30% DEF)' },
    { label: 'AOE ATK 2+',                     id: 'aoe_atk',     defaultLabel: 'AOE ATK 2+' },
    { label: 'AOE ATK 2+ after supering',      id: 'aoe_atk2',    defaultLabel: 'AOE ATK 2+ after supering' },
    { label: 'Super ATK',                      id: 'super_atk',   defaultLabel: 'Super ATK' },
    { label: 'Super ATK 2 / second hit',       id: 'super_atk2',  defaultLabel: 'Second Super ATK' },
    { label: 'Super ATK 3 / third hit',        id: 'super_atk3',  defaultLabel: 'Second Super ATK 2+' },
];

// ─── ID helpers ───────────────────────────────────────────────────────────────

const mkStageId  = (eventId, n)         => `${eventId}00${n}5`;
// Single-battle stages reuse the stage ID as the battle ID (existing convention).
// Multi-battle stages append the battle number.
const mkBattleId = (stageId, n, single) => single ? stageId : `${stageId}${n}`;
const mkPhaseId  = (battleId, n)        => `${battleId}${n}`;
const mkEnemyId  = (phaseId, n)         => `${phaseId}${n}`;

// ─── data.js access (existing events, ID collision checks) ───────────────────

let _eventsCache;   // undefined = not loaded yet, null = load failed

/**
 * Loads the events array from js/data.js (evaluated in isolation).
 * Cached for the session. Returns null when data.js cannot be read or parsed —
 * existing-event (append) mode is then disabled, new events still work.
 */
function loadEvents() {
    if (_eventsCache !== undefined) return _eventsCache;
    try {
        const dataPath = path.join(__dirname, '..', 'js', 'data.js');
        const src = fs.readFileSync(dataPath, 'utf8');
        const events = new Function(`${src}\n;return gameData && gameData.events;`)();
        _eventsCache = Array.isArray(events) ? events : null;
    } catch (err) {
        console.warn(`  ⚠  Could not parse js/data.js (${err.message}). Existing-event mode disabled.`);
        _eventsCache = null;
    }
    return _eventsCache;
}

function findEventById(eventId) {
    const events = loadEvents();
    if (!events) return null;
    return events.find(e => String(e.id) === String(eventId)) || null;
}

/**
 * Battles of a stage, with the legacy phases-only fallback
 * (mirrors getStageBattles() in js/navigation.js).
 */
function getBattlesOf(stage) {
    if (stage.battles && Array.isArray(stage.battles) && stage.battles.length > 0) return stage.battles;
    if (stage.phases && Array.isArray(stage.phases) && stage.phases.length > 0) {
        return [{ id: 'legacy-battle', name: 'Battle', phases: stage.phases }];
    }
    return [];
}

/** Every stage/battle/phase/enemy id used by an event (for collision checks). */
function collectIdsDeep(event) {
    const ids = new Set();
    for (const st of event.stages || []) {
        ids.add(String(st.id));
        for (const b of getBattlesOf(st)) {
            ids.add(String(b.id));
            for (const ph of b.phases || []) {
                ids.add(String(ph.id));
                for (const en of ph.enemies || []) ids.add(String(en.id));
            }
        }
    }
    return ids;
}

/**
 * First free stage number for an event: starts at 1 and skips every stage id
 * already used in js/data.js or already collected in the current draft.
 */
function nextStageNumber(eventId, draftStages) {
    const existing = findEventById(eventId);
    const taken = existing ? collectIdsDeep(existing) : new Set();
    (draftStages || []).forEach(s => taken.add(String(s.stage.id)));
    let n = 1;
    while (taken.has(mkStageId(eventId, n))) n++;
    return n;
}

// ─── draft persistence (save / resume unfinished events) ─────────────────────

const DRAFTS_DIR = path.join(__dirname, 'output', 'drafts');
const DRAFT_FORMAT = 1;

/** Session draft: { format, mode, event, stages, inProgress, updatedAt } */
let draft = null;

function draftFilePath(mode, eventId) {
    return path.join(DRAFTS_DIR, `draft-${mode}-${eventId}.json`);
}

function newDraft(mode, event) {
    draft = {
        format: DRAFT_FORMAT,
        mode,                        // 'new' | 'append'
        event,                       // { id, name, image, existing? }
        stages: [],                  // completed: [{ stage, battles }]
        inProgress: null,            // partial stage: { stage, battleDefs, battles }
        updatedAt: null,
    };
    saveDraft();
    return draft;
}

function draftPathOf(d) {
    // Edit drafts keep their file name anchored to the ORIGINAL event id, so
    // renaming the event id mid-edit doesn't orphan the draft file.
    return draftFilePath(d.mode, d.origId || d.event.id);
}

function saveDraft() {
    if (!draft) return;
    try {
        fs.mkdirSync(DRAFTS_DIR, { recursive: true });
        draft.updatedAt = new Date().toISOString();
        fs.writeFileSync(draftPathOf(draft), JSON.stringify(draft, null, 2), 'utf8');
    } catch (err) {
        console.warn(`  ⚠  Could not save draft: ${err.message}`);
    }
}

/** All parseable drafts on disk, most recently updated first. */
function loadDrafts() {
    if (!fs.existsSync(DRAFTS_DIR)) return [];
    const drafts = [];
    for (const f of fs.readdirSync(DRAFTS_DIR)) {
        if (!/^draft-.*\.json$/.test(f)) continue;
        try {
            const d = JSON.parse(fs.readFileSync(path.join(DRAFTS_DIR, f), 'utf8'));
            if (d && d.event && d.event.id && Array.isArray(d.stages)) drafts.push(d);
        } catch { /* ignore unreadable drafts */ }
    }
    return drafts.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

function deleteDraft(d) {
    try { fs.rmSync(draftPathOf(d), { force: true }); } catch { /* ignore */ }
}

/** Human-readable progress summary (draft menus / save messages). */
function describeDraft(d) {
    if (d.mode === 'edit') {
        const stages = (d.event.stages || []).length;
        const when = d.updatedAt ? new Date(d.updatedAt).toLocaleString() : 'unknown time';
        return `working copy — ${stages} stage${stages === 1 ? '' : 's'} (saved ${when})`;
    }
    const parts = [`${d.stages.length} stage${d.stages.length === 1 ? '' : 's'} complete`];
    const ip = d.inProgress;
    if (ip && ip.stage) {
        let what = `in progress: Stage "${ip.stage.name}"`;
        if (ip.battleDefs) {
            const done = (ip.battles || []).length;
            what += ` — battles ${done}/${ip.battleDefs.length} collected`;
        } else {
            what += ' — header only';
        }
        parts.push(what);
    }
    const when = d.updatedAt ? new Date(d.updatedAt).toLocaleString() : 'unknown time';
    return `${parts.join(' · ')} (saved ${when})`;
}

/** Merge a partial section into the draft's in-progress stage and persist. */
function saveInProgress(data) {
    if (!draft) return;
    draft.inProgress = { ...(draft.inProgress || { stage: null, battleDefs: null, battles: [] }), ...data };
    saveDraft();
}

/** Persist the draft and terminate the wizard (used by [s] prompts and Ctrl+C). */
function saveAndExit() {
    saveDraft();
    if (draft) {
        console.log(`\n💾  Draft saved: ${draftPathOf(draft)}`);
        console.log(`   ${describeDraft(draft)}`);
        console.log('   Run `npm run new-entry` again to resume.');
    }
    rl.close();
    process.exit(0);
}

// ─── input / output collectors ────────────────────────────────────────────────

/**
 * Collects inputs, either phase-wide (globalMode) or per-enemy.
 * In enemy mode, picking a preset that is usually phase-wide offers to hoist
 * it into opts.phaseInputs (the phase's globalInputs list) instead.
 * Returns the list of enemy-level inputs collected (phase-wide ones live in
 * opts.phaseInputs and are NOT returned here).
 */
async function collectInputs(opts = {}) {
    const { globalMode = false, phaseInputs = null } = opts;
    const collected = [];
    const exclude = new Set();
    if (phaseInputs) phaseInputs.forEach(i => exclude.add(i.id));

    console.log(globalMode
        ? '\n  ── Phase-wide inputs (shown once, shared by ALL enemies of this phase) ──'
        : '\n  ── Inputs (presets or custom; leave empty for static enemy) ──');

    if (!globalMode && phaseInputs && phaseInputs.length > 0) {
        console.log(`  Phase-wide (already shared with this enemy): ${phaseInputs.map(i => i.id).join(', ')}`);
    }

    for (;;) {
        if (collected.length) console.log(`  Collected: ${collected.map(i => i.id).join(', ')}`);
        const preset = await pickInputPreset(exclude, !!opts.globalMode);
        if (!preset) break;

        if (globalMode) {
            collected.push(preset);
            exclude.add(preset.id);
            console.log(`  ✓ Added phase-wide: ${preset.id}`);
            continue;
        }

        // Enemy mode: an input added here ALWAYS belongs to this enemy —
        // phase-wide scope is chosen by adding it in the phase-wide section
        // instead (no per-input confirmation).
        collected.push(preset);
        exclude.add(preset.id);
        console.log(`  ✓ Added: ${preset.id}`);
    }
    return collected;
}

async function collectOutputs() {
    console.log('\n  ── Outputs ──');
    const results = [];
    const exclude = new Set();
    let showAll = false;

    // Data-driven: most-used outputs in js/data.js first (×count shown);
    // rare ids via "(show all)", anything new via "(custom output…)".
    for (;;) {
        const list = showAll ? getAllOutputOptions(exclude) : getTopOutputs(exclude);
        const menu = [
            ...list.map(o => ({ label: `${o.label}  [${o.id}]${o.count ? `  ×${o.count}` : ''}`, out: o })),
            { label: showAll ? '(back to most-used outputs)' : '(show all outputs — rare ones)', toggleAll: true },
            { label: '(custom output…)', custom: true },
            { label: '(done)', done: true },
        ];
        const picked = await pickMany('Select outputs:', menu);

        const chosen = picked.filter(o => o.out);
        const toggle = picked.some(o => o.toggleAll);
        const wantCustom = picked.some(o => o.custom);
        const done = picked.some(o => o.done);

        for (const o of chosen) {
            const label = await ask(`  Label for "${o.out.defaultLabel}"`, o.out.defaultLabel);
            results.push({ id: o.out.id, label });
            exclude.add(o.out.id);
        }

        if (wantCustom) {
            const o = await buildCustomOutput();
            if (o && o.id) { results.push(o); exclude.add(o.id); }
        }

        if (toggle) { showAll = !showAll; continue; }
        if (wantCustom && !done) continue;   // after a custom output, show the menu again
        break;
    }
    return results;
}

// ─── section collectors (each returns data or GO_BACK) ────────────────────────

/**
 * Collects one enemy.
 * navPrompt 'redo' restarts the outer for(;;) loop — re-asks everything for this enemy.
 * navPrompt 'back' returns GO_BACK to the phase collector.
 * `phaseInputs` (optional) lists the phase-wide inputs already available to
 * this enemy; they are excluded from the menu and new ones can be hoisted.
 */
async function collectEnemy(phaseId, enemyNum, totalInPhase, phaseInputs = null, idOverride = null) {
    for (;;) {
        console.log(`\n  ── Enemy ${enemyNum}${totalInPhase > 1 ? ` of ${totalInPhase}` : ''} ──`);
        if (phaseInputs && phaseInputs.length > 0) {
            console.log(`  (Phase-wide inputs in effect: ${phaseInputs.map(i => i.id).join(', ')})`);
        }
        const name      = await ask('  Enemy name');
        const imageFile = await ask('  Image file (e.g. card_1234567_thumb.jpg)');
        const type      = await pickOne('Type:', TYPES);
        const rarity    = await pickOne('Rarity:', RARITIES);
        const inputs    = await collectInputs({ phaseInputs });
        const outputs   = await collectOutputs();
        const id        = idOverride || mkEnemyId(phaseId, enemyNum);

        const nav = await navPrompt(`Enemy "${name}" (id: ${id})`);
        if (nav === 'back') return GO_BACK;
        if (nav === 'redo') continue;
        return { id, name, imageFile, typeIcon: type.typeIcon, bg: type.bg, rarity: rarity.value, inputs, outputs };
    }
}

/**
 * Collects all enemies for one phase, plus optional phase-wide inputs.
 * GO_BACK from enemy 0 propagates up; from enemy N>0 steps back one enemy.
 */
async function collectPhase(battleId, phaseNum, numPhases) {
    for (;;) {
        const phaseName  = numPhases === 1 ? 'Phase 1' : await ask(`Phase ${phaseNum} name`, `Phase ${phaseNum}`);
        const phaseId    = mkPhaseId(battleId, phaseNum);

        // Phase-wide inputs are optional and shared by every enemy of the phase
        const globalInputs = await collectInputs({ globalMode: true });

        const numEnemies = await askInt('Number of enemies in this phase', 1, 1);

        const enemies  = [];
        let ei         = 0;
        let wentBack   = false;

        while (ei < numEnemies) {
            const res = await collectEnemy(phaseId, ei + 1, numEnemies, globalInputs);
            if (res === GO_BACK) {
                if (ei > 0) { enemies.pop(); ei--; }   // step back one enemy
                else { wentBack = true; break; }        // propagate to phase level
                continue;
            }
            enemies.push(res);
            ei++;
        }

        if (wentBack) return GO_BACK;

        const globalsNote = globalInputs.length ? `, ${globalInputs.length} phase-wide input(s)` : '';
        const nav = await navPrompt(`Phase "${phaseName}" — ${enemies.length} enemy(ies)${globalsNote}`);
        if (nav === 'back') return GO_BACK;
        if (nav === 'redo') continue;
        return globalInputs.length
            ? { id: phaseId, name: phaseName, globalInputs, enemies }
            : { id: phaseId, name: phaseName, enemies };
    }
}

/**
 * Collects all phases for one battle.
 * GO_BACK from phase 0 propagates up; from phase N>0 steps back one phase.
 */
async function collectBattle(battleId, battleName) {
    for (;;) {
        console.log(`\n── Battle: "${battleName}" ${'─'.repeat(Math.max(2, 40 - battleName.length))}`);
        const numPhases = await askInt('Number of phases', 1, 1);

        const phases   = [];
        let pi         = 0;
        let wentBack   = false;

        while (pi < numPhases) {
            const res = await collectPhase(battleId, pi + 1, numPhases);
            if (res === GO_BACK) {
                if (pi > 0) { phases.pop(); pi--; }    // step back one phase
                else { wentBack = true; break; }        // propagate to battle level
                continue;
            }
            phases.push(res);
            pi++;
        }

        if (wentBack) return GO_BACK;

        const totalEnemies = phases.reduce((s, p) => s + p.enemies.length, 0);
        const nav = await navPrompt(`Battle "${battleName}" — ${phases.length} phase(s), ${totalEnemies} enemy(ies)`);
        if (nav === 'back') return GO_BACK;
        if (nav === 'redo') continue;
        return { id: battleId, name: battleName, phases };
    }
}

/**
 * Collects content for all battles.
 * GO_BACK from battle 0 propagates up; from battle N>0 steps back one battle.
 * `already` holds battles restored from a draft (collection continues after
 * them); `onBattlesChange` is invoked with the current list after every change
 * so the wizard can persist progress.
 */
async function collectAllContent(battleDefs, already = [], onBattlesChange = null) {
    const collected = already.slice();
    let bi = collected.length;
    const notify = () => { if (onBattlesChange) onBattlesChange(collected.slice()); };

    while (bi < battleDefs.length) {
        const { id, name } = battleDefs[bi];
        const res = await collectBattle(id, name);
        if (res === GO_BACK) {
            if (bi > 0) { collected.pop(); bi--; notify(); }   // step back one battle
            else return GO_BACK;                               // propagate to top-level
            continue;
        }
        collected.push(res);
        bi++;
        notify();
    }

    return collected;
}

// ─── code generators ─────────────────────────────────────────────────────────

function fmtInput(inp) {
    return inp.type === 'checkbox'
        ? `{ id: "${inp.id}", label: "${inp.label}", type: "checkbox", default: ${inp.default} }`
        : `{ id: "${inp.id}", label: "${inp.label}", type: "number", min: ${inp.min}, max: ${inp.max}, default: ${inp.default} }`;
}

function fmtOutput(out) {
    return `{ id: "${out.id}", label: "${out.label}" }`;
}

const pad = n => ' '.repeat(n);

function enemyBlock(enemy, indent) {
    const ip = indent, pp = indent + 4, lp = indent + 8;
    const ins  = enemy.inputs.length
        ? '\n' + enemy.inputs.map(i  => `${pad(lp)}${fmtInput(i)}`).join(',\n')  + `\n${pad(pp)}`
        : '';
    const outs = enemy.outputs.length
        ? '\n' + enemy.outputs.map(o => `${pad(lp)}${fmtOutput(o)}`).join(',\n') + `\n${pad(pp)}`
        : '';
    return [
        `${pad(ip)}{`,
        `${pad(pp)}id: "${enemy.id}",`,
        `${pad(pp)}name: "${enemy.name}",`,
        `${pad(pp)}image: "images/enemies/${enemy.imageFile}",`,
        `${pad(pp)}typeIcon: 'images/types/${enemy.typeIcon}.webp',`,
        `${pad(pp)}rarityIcon: 'images/rarity/${enemy.rarity}.webp',`,
        `${pad(pp)}background: 'images/bgs/${enemy.bg}.webp',`,
        `${pad(pp)}inputs: [${ins}],`,
        `${pad(pp)}formula: "${enemy.id}",`,
        `${pad(pp)}outputs: [${outs}],`,
        `${pad(ip)}}`,
    ].join('\n');
}

/** The `stages: [...]` inner block, shared by both snippet generators.
 *  Supports both shapes: stages with `battles` and legacy stages whose
 *  `phases` sit directly on the stage (no battles array). */
function generateStagesBlock(stagesWithBattles) {
    return stagesWithBattles.map(({ stage, battles }) => {
        if (battles && battles.length > 0) {
            return [
                `                {`,
                `                    id: "${stage.id}",`,
                `                    name: "${stage.name}",`,
                `                    battles: [`,
                generateBattlesBlock(battles),
                `                    ]`,
                `                }`,
            ].join('\n');
        }
        return [
            `                {`,
            `                    id: "${stage.id}",`,
            `                    name: "${stage.name}",`,
            `                    phases: [`,
            generatePhasesBlock(stage.phases || []),
            `                    ]`,
            `                }`,
        ].join('\n');
    }).join(',\n');
}

/** The `battles: [...]` inner block for one or more battles. */
function generateBattlesBlock(battles) {
    return battles.map(b => [
        `${pad(24)}{`,
        `${pad(28)}id: "${b.id}",`,
        `${pad(28)}name: "${b.name}",`,
        `${pad(28)}phases: [`,
        generatePhasesBlock(b.phases || []),
        `${pad(28)}],`,
        `${pad(24)}}`,
    ].join('\n')).join(',\n');
}

/** The `phases: [...]` inner block for one or more phases (incl. globalInputs). */
function generatePhasesBlock(phases) {
    return phases.map(ph => {
        const enemiesBlock = ph.enemies.map(e => enemyBlock(e, 52)).join(',\n');
        const globalInputsBlock = (ph.globalInputs && ph.globalInputs.length)
            ? `${pad(40)}globalInputs: [` +
              '\n' + ph.globalInputs.map(i => `${pad(44)}${fmtInput(i)}`).join(',\n') +
              `\n${pad(40)}],`
            : null;
        return [
            `${pad(36)}{`,
            `${pad(40)}id: "${ph.id}",`,
            `${pad(40)}name: "${ph.name}",`,
            ...(globalInputsBlock ? [globalInputsBlock] : []),
            `${pad(40)}enemies: [`,
            enemiesBlock,
            `${pad(40)}],`,
            `${pad(36)}}`,
        ].filter(l => l !== null).join('\n');
    }).join(',\n');
}

/** Full event object block (honors ev.visible, defaults to true). */
function generateEventBlock(ev, stagesWithBattles) {
    return [
        `        {`,
        `            id: "${ev.id}",`,
        `            name: "${ev.name}",`,
        `            image: "${ev.image}",`,
        `            visible: ${ev.visible !== false},`,
        `            stages: [`,
        generateStagesBlock(stagesWithBattles),
        `            ]`,
        `        },`,
    ].join('\n');
}

function generateDataSnippet(event, stagesWithBattles) {
    return [
        `        // ─── Paste inside  events: [ ... ]  in js/data.js ───`,
        generateEventBlock(event, stagesWithBattles),
    ].join('\n');
}

/**
 * Stages-only snippet for appending to an existing event's stages array.
 * Uses the same indentation as generateDataSnippet so it pastes cleanly
 * right after the last existing stage.
 */
function generateAppendSnippet(event, stagesWithBattles) {
    return [
        `        // ─── Paste inside event ${event.id}'s  stages: [ ... ]  in js/data.js ───`,
        `        // (after the last existing stage — add a comma after it)`,
        generateStagesBlock(stagesWithBattles),
    ].join('\n');
}

function formulaStub(enemy, eventName, battleName, globalInputs = []) {
    const ownIds           = new Set(enemy.inputs.map(i => i.id));
    const phaseOnly        = (globalInputs || []).filter(g => g && g.id && !ownIds.has(g.id));
    const hasDebuffPassive = [...phaseOnly, ...enemy.inputs].some(i => i.id === 'atk_debuff_passive');
    const hasDebuffSuper   = [...phaseOnly, ...enemy.inputs].some(i => i.id === 'atk_debuff_super');
    const outputIds        = new Set(enemy.outputs.map(o => o.id));
    const hasTwoSupers     = outputIds.has('super_atk2');
    const hasThirdSuper    = outputIds.has('super_atk3');
    const needsStackSuper  = outputIds.has('normal_atk2') || outputIds.has('normal_atk3') ||
                             outputIds.has('normal_atk4') || outputIds.has('aoe_atk') || outputIds.has('aoe_atk2');

    // Input extraction lines (match actual formulas.js patterns)
    const varLine = (inp) => {
        if (inp.type === 'checkbox') {
            return `        const ${inp.id} = inputs.${inp.id} || false;`;
        }
        const divisor = (inp.id === 'atk_debuff_passive' || inp.id === 'atk_debuff_super') ? ' / 100' : '';
        return `        const ${inp.id} = (inputs.${inp.id} !== undefined && inputs.${inp.id} !== null) ? inputs.${inp.id}${divisor} : ${inp.default};`;
    };
    const varLines = [
        ...phaseOnly.map(inp => `${varLine(inp)} // phase-wide input`),
        ...enemy.inputs.map(inp => varLine(inp)),
    ];

    // Constant declarations
    const constLines = [`        const baseAtk = 0; // TODO`];
    if (hasTwoSupers) {
        constLines.push(`        const saMulti1 = 0; // TODO`);
        constLines.push(`        const saMulti2 = 0; // TODO`);
    } else {
        constLines.push(`        const saMulti = 0; // TODO`);
    }
    if (hasThirdSuper) constLines.push(`        const saMulti3 = 0; // TODO`);
    if (needsStackSuper) constLines.push(`        const stackSuper = 0; // TODO`);

    // Computation stubs (mirror the variable names used in formulas.js)
    const calcLines = [];

    if (outputIds.has('normal_atk')) {
        if (hasDebuffPassive && hasDebuffSuper) {
            calcLines.push(`        const normalAtk = baseAtk * (1 - atk_debuff_passive) * (1 - atk_debuff_super > 0 ? 1 - atk_debuff_super : 0); // TODO`);
        } else if (hasDebuffPassive) {
            calcLines.push(`        const normalAtk = baseAtk * (1 - atk_debuff_passive); // TODO`);
        } else {
            calcLines.push(`        const normalAtk = baseAtk; // TODO`);
        }
    } else if (outputIds.has('normal_atk2') || outputIds.has('normal_atk3') || outputIds.has('normal_atk4')) {
        // Chained outputs below build on normalAtk — emit a base line when the
        // plain normal_atk output was not selected so the stub stays runnable.
        calcLines.push(`        const normalAtk = baseAtk; // TODO`);
    }
    if (outputIds.has('normal_atk2')) calcLines.push(`        const normalAtk2 = normalAtk * (1 + stackSuper); // TODO`);
    if (outputIds.has('normal_atk3')) {
        const base = outputIds.has('normal_atk2') ? 'normalAtk2' : 'normalAtk';
        calcLines.push(`        const normalAtk3 = ${base} * (1 + stackSuper); // TODO`);
    }
    if (outputIds.has('normal_atk4')) {
        const base = outputIds.has('normal_atk3') ? 'normalAtk3'
                   : outputIds.has('normal_atk2') ? 'normalAtk2' : 'normalAtk';
        calcLines.push(`        const normalAtk4 = ${base} * (1 + stackSuper); // TODO`);
    }
    if (outputIds.has('aoe_atk'))     calcLines.push(`        const aoeAtk = normalAtk * 0.5; // TODO`);
    if (outputIds.has('aoe_atk2'))    calcLines.push(`        const aoeAtk2 = normalAtk2 * 0.5; // TODO`);

    if (outputIds.has('super_atk')) {
        const multi = hasTwoSupers ? 'saMulti1' : 'saMulti';
        if (hasDebuffPassive && hasDebuffSuper) {
            calcLines.push(`        const superAtk = baseAtk * (1 - atk_debuff_passive) * (${multi} - atk_debuff_super > 0 ? ${multi} - atk_debuff_super : 0); // TODO`);
        } else if (hasDebuffPassive) {
            calcLines.push(`        const superAtk = baseAtk * (1 - atk_debuff_passive) * ${multi}; // TODO`);
        } else {
            calcLines.push(`        const superAtk = baseAtk * ${multi}; // TODO`);
        }
    }
    if (outputIds.has('super_atk2')) {
        if (hasDebuffPassive && hasDebuffSuper) {
            calcLines.push(`        const superAtk2 = baseAtk * (1 - atk_debuff_passive) * (saMulti2 - atk_debuff_super > 0 ? saMulti2 - atk_debuff_super : 0); // TODO`);
        } else {
            calcLines.push(`        const superAtk2 = baseAtk * saMulti2; // TODO`);
        }
    }
    if (outputIds.has('super_atk3')) {
        if (hasDebuffPassive && hasDebuffSuper) {
            calcLines.push(`        const superAtk3 = baseAtk * (1 - atk_debuff_passive) * (saMulti3 - atk_debuff_super > 0 ? saMulti3 - atk_debuff_super : 0); // TODO`);
        } else {
            calcLines.push(`        const superAtk3 = baseAtk * saMulti3; // TODO`);
        }
    }

    // Return keys map to the named variables above
    const varMap = {
        normal_atk:  'normalAtk',
        normal_atk2: 'normalAtk2',
        normal_atk3: 'normalAtk3',
        normal_atk4: 'normalAtk4',
        aoe_atk:     'aoeAtk',
        aoe_atk2:    'aoeAtk2',
        super_atk:   'superAtk',
        super_atk2:  'superAtk2',
        super_atk3:  'superAtk3',
    };
    // Custom output ids (not in varMap) get their own TODO variable so the
    // generated stub stays runnable until the formula is implemented.
    const camel = (id) => id.replace(/_([a-z0-9])/g, (m, c) => c.toUpperCase());
    const customVars = [];
    const knownVars = new Set(Object.values(varMap));
    for (const o of enemy.outputs) {
        if (varMap[o.id]) continue;
        const v = camel(o.id);
        if (!knownVars.has(v)) {
            knownVars.add(v);
            customVars.push(`        const ${v} = 0; // TODO (custom output)`);
        }
    }
    const retLines = enemy.outputs.map(o => `            ${o.id}: ${varMap[o.id] || camel(o.id)},`);

    return [
        `    // ${eventName} – ${battleName} – ${enemy.name}`,
        `    ${enemy.id}: function (inputs) {`,
        `        throw new Error('Formula stub: implement this formula before using it');`,
        ...varLines,
        varLines.length ? '' : null,
        ...constLines,
        ``,
        ...calcLines,
        ...customVars,
        ``,
        `        return {`,
        ...retLines,
        `        };`,
        `    },`,
    ].filter(l => l !== null).join('\n');
}

// ─── single-stage collector (stage header + battles + content) ───────────────

/**
 * Collects one complete stage: header (name/id) → battle defs → content.
 * `resume` (optional) restores a partially collected stage from a saved draft:
 *   { stage?, battleDefs?, battles? }
 * Returns { stage, battles } or GO_BACK if the user backs past the stage header.
 */
async function collectOneStage(event, stageNum, resume = null) {
    let stage         = (resume && resume.stage)      || null;
    let battleDefs    = (resume && resume.battleDefs) || null;
    let resumeBattles = (resume && resume.battles)    || [];
    let step = stage ? (battleDefs ? 2 : 1) : 0;   // 0 = stage header, 1 = battle defs, 2 = content

    if (stage) console.log(`\n  ↩  Resuming Stage ${stageNum} "${stage.name}" from draft…`);

    // ── Steps 0 & 1: stage header and battle definitions ──────────────────────
    while (step < 2) {
        if (step === 0) {
            console.log(`\n── Stage ${stageNum} ────────────────────────────────`);
            const name = await ask('Stage name', stage && stage.name);
            const sId  = mkStageId(event.id, stageNum);
            const nav  = await navPrompt(`Stage "${name}" (id: ${sId})`, { stage: { id: sId, name, num: stageNum }, battleDefs: null, battles: [] });
            if (nav === 'back') return GO_BACK;   // propagate: before stage 1
            if (nav === 'redo') continue;
            stage = { id: sId, name, num: stageNum };
            step  = 1;

        } else {   // step === 1
            console.log('\n── Battles ────────────────────────────────────');
            const prevCount = battleDefs ? battleDefs.length : 1;
            const count     = await askInt('Number of battles in this stage', prevCount, 1);
            const single    = count === 1;
            const defs      = [];
            for (let b = 1; b <= count; b++) {
                const prev  = battleDefs && battleDefs[b - 1];
                const bId   = mkBattleId(stage.id, b, single);
                const bName = single ? stage.name : await ask(`Battle ${b} name`, prev ? prev.name : `Battle ${b}`);
                defs.push({ id: bId, name: bName });
            }
            const summary = single
                ? `1 battle: "${defs[0].name}"`
                : defs.map((d, i) => `Battle ${i + 1}: "${d.name}"`).join('  |  ');
            const nav = await navPrompt(summary, { battleDefs: defs, battles: [] });
            if (nav === 'back') { step = 0; continue; }
            if (nav === 'redo') continue;
            battleDefs = defs;
            resumeBattles = [];
            step = 2;
        }
    }

    // ── Content collection with back-into-battle-defs support ─────────────────
    for (;;) {
        const result = await collectAllContent(
            battleDefs,
            resumeBattles,
            battles => saveInProgress({ battles })
        );
        if (result !== GO_BACK) return { stage, battles: result };

        // User backed past the first battle → re-enter step machine at battle defs
        resumeBattles = [];   // battle defs may change → collected battles are stale
        step = 1;
        while (step < 2) {
            if (step === 1) {
                console.log('\n── Battles (edit) ─────────────────────────────');
                const count  = await askInt('Number of battles in this stage', battleDefs.length, 1);
                const single = count === 1;
                const defs   = [];
                for (let b = 1; b <= count; b++) {
                    const prev  = battleDefs && battleDefs[b - 1];
                    const bId   = mkBattleId(stage.id, b, single);
                    const bName = single ? stage.name : await ask(`Battle ${b} name`, prev ? prev.name : `Battle ${b}`);
                    defs.push({ id: bId, name: bName });
                }
                const summary = single
                    ? `1 battle: "${defs[0].name}"`
                    : defs.map((d, i) => `Battle ${i + 1}: "${d.name}"`).join('  |  ');
                const nav = await navPrompt(summary, { battleDefs: defs, battles: [] });
                if (nav === 'back') { step = 0; continue; }
                if (nav === 'redo') continue;
                battleDefs = defs;
                step = 2;

            } else {   // step === 0
                console.log('\n── Stage (edit) ───────────────────────────────');
                const name = await ask('Stage name', stage.name);
                const sId  = mkStageId(event.id, stageNum);
                const nav  = await navPrompt(`Stage "${name}" (id: ${sId})`, { stage: { id: sId, name, num: stageNum }, battleDefs: null, battles: [] });
                if (nav === 'back') return GO_BACK;   // propagate up
                if (nav === 'redo') continue;
                stage = { id: sId, name, num: stageNum };
                step  = 1;
            }
        }
    }
}

// ─── draft-aware startup flows ────────────────────────────────────────────────

/** Startup menu: resume a saved draft, delete drafts, or start something new. */
async function resumeMenuOrNew() {
    const drafts = loadDrafts();
    if (drafts.length === 0) return await collectNewDraft();

    console.log(`\n── Unfinished drafts (${drafts.length}) ──────────────`);
    const listDrafts = () => drafts.forEach((d, i) => {
        const mode = d.mode === 'append' ? 'append' : (d.mode === 'edit' ? 'edit' : 'new');
        console.log(`    ${i + 1}. [${mode}] Event ${d.event.id} "${d.event.name}" — ${describeDraft(d)}`);
    });
    listDrafts();
    console.log('\n  Enter a number to resume · n = start new · d <num> = delete a draft');

    for (;;) {
        const ans = await ask('  >', '');
        if (!ans) continue;
        if (ans.toLowerCase() === 'n') return await collectNewDraft();

        const del = ans.match(/^d\s+(\d+)$/i);
        if (del) {
            const idx = parseInt(del[1], 10) - 1;
            if (idx < 0 || idx >= drafts.length) { console.log('  ⚠  No such draft.'); continue; }
            console.log(`  ✓ Deleted draft for event ${drafts[idx].event.id}.`);
            deleteDraft(drafts[idx]);
            drafts.splice(idx, 1);
            if (drafts.length === 0) return await collectNewDraft();
            listDrafts();
            continue;
        }

        const idx = parseInt(ans, 10) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < drafts.length) {
            const d = drafts[idx];
            const what = d.mode === 'append' ? 'stages for existing event'
                : d.mode === 'edit' ? 'editing of event' : 'new event';
            console.log(`\n  ↩  Resuming ${what} ${d.event.id} "${d.event.name}"`);
            return d;
        }
        console.log('  ⚠  Enter a draft number, "n", or "d <num>".');
    }
}

/** Mode selection: brand-new event, appending stages, or EDITING an existing one. */
async function collectNewDraft() {
    const events = loadEvents();

    console.log('\n── What are you adding? ───────────────────────');
    const modes = [{ label: 'New event', value: 'new' }];
    if (events) {
        modes.push({ label: 'New stages for an EXISTING event', value: 'append' });
        modes.push({ label: 'EDIT an EXISTING event (rename, restructure, tweak inputs…)', value: 'edit' });
    }
    const mode = (await pickOne('Mode:', modes)).value;

    if (mode === 'append') return await collectAppendDraft(events, null);
    if (mode === 'edit') return await collectEditDraft(events, null);
    return await collectFreshEventDraft(events);
}

/** Collects a brand-new event (validates 4-digit ids and data.js collisions). */
async function collectFreshEventDraft(events) {
    for (;;) {
        console.log('\n── Event ──────────────────────────────────────');
        let id;
        for (;;) {
            id = await ask('Event ID (4 digits, e.g. 1730)');
            if (/^\d{4}$/.test(id)) break;
            console.log('  ⚠  Event IDs in js/data.js are 4 digits (e.g. "1768").');
        }

        const existing = events ? events.find(e => String(e.id) === id) : null;
        if (existing) {
            console.log(`\n  ⚠  Event ${id} "${existing.name}" already exists in js/data.js (${(existing.stages || []).length} stage(s)).`);
            const choice = await pickOne('What now?', [
                { label: `Append new stages to event ${id} instead`, value: 'append' },
                { label: 'Enter a different event ID', value: 'retry' },
            ]);
            if (choice.value === 'append') return await collectAppendDraft(events, id);
            continue;
        }

        const name = await ask('Event name');

        if (events && !fs.existsSync(path.join(__dirname, '..', 'images', 'events', `${id}.webp`))) {
            console.log(`  ⚠  Reminder: images/events/${id}.webp does not exist yet — add it before deploying.`);
        }

        // Draft is created before confirmation so [s] / Ctrl+C never lose input
        newDraft('new', { id, name, image: `images/events/${id}.webp` });

        const nav = await navPrompt(`Event "${name}" (id: ${id}, image: images/events/${id}.webp)`);
        if (nav === 'redo') { deleteDraft(draft); continue; }
        // 'back' at step 0 → treat as proceed (nowhere further back)
        return draft;
    }
}

/** Collects an existing event to append stages to (list read from js/data.js). */
async function collectAppendDraft(events, forcedId) {
    for (;;) {
        if (!events.length) {
            console.log('  ⚠  js/data.js contains no events.');
            return await collectFreshEventDraft(events);
        }

        let target = null;
        if (forcedId) {
            target = events.find(e => String(e.id) === String(forcedId)) || null;
            forcedId = null;
        }
        if (!target) {
            console.log('\n── Existing events (from js/data.js, newest first) ──');
            const list = events.slice().reverse().map(ev => ({
                label: `${ev.id} — ${ev.name}  (${(ev.stages || []).length} stage(s))`,
                value: ev,
            }));
            target = (await pickOne('Append stages to which event?', list)).value;
        }

        const stageCount = (target.stages || []).length;
        const nextNum = nextStageNumber(String(target.id), []);
        console.log(`\n  Event ${target.id} "${target.name}" has ${stageCount} existing stage(s).`);
        console.log(`  New stages will start at number ${nextNum} (stage id base ${mkStageId(String(target.id), nextNum)}).`);

        // Draft is created before confirmation so [s] / Ctrl+C never lose input
        newDraft('append', {
            id: String(target.id),
            name: target.name,
            image: target.image || `images/events/${target.id}.webp`,
            existing: true,
            existingStageCount: stageCount,
        });

        const nav = await navPrompt(`Append stages to "${target.name}" (id: ${target.id})`);
        if (nav === 'redo') { deleteDraft(draft); target = null; continue; }
        return draft;   // 'back' here → nothing further back, proceed
    }
}

/** Collects an existing event to EDIT (works on a deep clone of its data). */
async function collectEditDraft(events, forcedId) {
    for (;;) {
        if (!events.length) {
            console.log('  ⚠  js/data.js contains no events.');
            return await collectFreshEventDraft(events);
        }

        let target = null;
        if (forcedId) {
            target = events.find(e => String(e.id) === String(forcedId)) || null;
            forcedId = null;
        }
        if (!target) {
            console.log('\n── Existing events (from js/data.js, newest first) ──');
            const list = events.slice().reverse().map(evc => ({
                label: `${evc.id} — ${evc.name}  (${(evc.stages || []).length} stage(s))`,
                value: evc,
            }));
            target = (await pickOne('Edit which event?', list)).value;
        }

        // The wizard never touches js/data.js directly: it edits a deep clone
        // and generates a replacement snippet you paste over the old block.
        const working = cloneData(target);
        newDraft('edit', working);
        draft.origId = String(target.id);
        saveDraft();

        const nav = await navPrompt(`Edit "${working.name}" (id: ${working.id}) — changes are kept in a resumable draft`);
        if (nav === 'redo') { deleteDraft(draft); target = null; continue; }
        return draft;   // 'back' here → nothing further back, proceed
    }
}

// ─── edit mode (edit pre-existing events at every level) ──────────────────────

/** Deep clone for plain-JSON game data. */
function cloneData(o) { return JSON.parse(JSON.stringify(o)); }

/** First free id among candidateFn(1), candidateFn(2), … not present in taken. */
function nextFreeId(candidateFn, taken) {
    let n = 1;
    let id = candidateFn(n);
    while (taken.has(id)) { n++; id = candidateFn(n); }
    return id;
}

/** Flattened enemies with their phase/battle context (for pickers & stubs). */
function flattenEventTree(ev) {
    const out = [];
    for (const st of ev.stages || []) {
        for (const b of getBattlesOf(st)) {
            for (const ph of b.phases || []) {
                for (const en of ph.enemies || []) {
                    out.push({ enemy: en, phase: ph, battleName: b.name, stage: st });
                }
            }
        }
    }
    return out;
}

/**
 * Rewrites the event id and every descendant id — stage/battle/phase/enemy ids
 * all embed the event id, so a rename is a prefix swap across the whole tree.
 * The image path is updated too when it follows the default convention.
 */
function rewriteEventIds(ev, oldId, newId) {
    const swap = (id) => (String(id).startsWith(oldId) ? newId + String(id).slice(oldId.length) : id);
    ev.id = swap(ev.id);
    if (ev.image === `images/events/${oldId}.webp`) ev.image = `images/events/${newId}.webp`;
    for (const st of ev.stages || []) {
        st.id = swap(st.id);
        for (const b of getBattlesOf(st)) {
            if (b.id === 'legacy-battle') continue;
            b.id = swap(b.id);
            for (const ph of b.phases || []) {
                ph.id = swap(ph.id);
                for (const en of ph.enemies || []) en.id = swap(en.id);
            }
        }
    }
}

/** pickOne where Enter keeps the currently-selected option. */
async function pickOneWithCurrent(title, options, currentIndex) {
    console.log(`\n  ${title}`);
    options.forEach((o, i) => console.log(`    ${i + 1}. ${o.label}${i === currentIndex ? '   ← current' : ''}`));
    for (;;) {
        const ans = await ask('  Choice (Enter = keep current)', '');
        if (!ans) return options[currentIndex];
        const n = parseInt(ans, 10);
        if (!isNaN(n) && n >= 1 && n <= options.length) return options[n - 1];
        console.log('  ⚠  Enter a number or press Enter to keep the current one.');
    }
}

/** Edit-mode entry point: tree editor over a working copy, then generation. */
async function runEditMode() {
    const ev = draft.event;
    // The pristine diff base is the event as it currently exists in js/data.js
    // (by the original id) — NOT the draft, which holds the edited working copy.
    const pristine = findEventById(draft.origId || ev.id);
    const original = pristine ? cloneData(pristine) : cloneData(ev);
    console.log(`\n  Editing event ${ev.id} "${ev.name}" — ${(ev.stages || []).length} stage(s).`);
    console.log('  Every change is saved to the draft automatically (resumable).');
    await editEventMenu(ev, original);
    await generateEditOutput(ev, original);
}

async function editEventMenu(ev, original) {
    for (;;) {
        console.log(`\n── Editing event ${ev.id} "${ev.name}" ──`);
        const choice = await pickOne('What do you want to edit?', [
            { label: 'Event details (name, visibility, image, id)', value: 'details' },
            { label: 'Stages…', value: 'stages' },
            { label: '(done — generate the replacement snippet)', value: 'done' },
        ]);
        if (choice.value === 'details') await editEventDetails(ev, original);
        else if (choice.value === 'stages') await editStagesMenu(ev);
        else return;
    }
}

async function editEventDetails(ev, original) {
    for (;;) {
        console.log('\n── Event details ──');
        const choice = await pickOne('Edit which field?', [
            { label: `Name  [${ev.name}]`, value: 'name' },
            { label: `Visible  [${ev.visible !== false}]`, value: 'visible' },
            { label: `Image  [${ev.image}]`, value: 'image' },
            { label: `Event ID  [${ev.id}]  (advanced — rewrites every child id)`, value: 'id' },
            { label: '(back)', value: 'back' },
        ]);
        if (choice.value === 'back') return;
        if (choice.value === 'name') {
            ev.name = await ask('Event name', ev.name);
        } else if (choice.value === 'visible') {
            ev.visible = (await ask('Visible? (true/false)', String(ev.visible !== false))) !== 'false';
        } else if (choice.value === 'image') {
            ev.image = await ask('Image path', ev.image);
        } else if (choice.value === 'id') {
            const newId = await ask('New event ID (4 digits)');
            if (!/^\d{4}$/.test(newId) || newId === String(ev.id)) {
                console.log('  ⚠  Must be a NEW 4-digit id.');
                continue;
            }
            if (findEventById(newId)) {
                console.log(`  ⚠  Event ${newId} already exists in js/data.js — pick another id.`);
                continue;
            }
            const oldId = String(ev.id);
            rewriteEventIds(ev, oldId, newId);
            console.log(`  ✓ Rewrote every id: ${oldId} → ${newId}`);
            console.log('  ⚠  The formula keys in js/formulas.js still use the OLD ids —');
            console.log('     the generated diff lists the old → new mapping.');
        }
        saveDraft();
    }
}

async function editStagesMenu(ev) {
    for (;;) {
        console.log('\n── Stages ──');
        const opts = ev.stages.map(st => ({ label: `${st.id} — ${st.name}`, stage: st }));
        opts.push({ label: '(add a stage…)', add: true });
        opts.push({ label: '(remove a stage…)', remove: true });
        opts.push({ label: '(back)', back: true });
        const pick = await pickOne('Stages:', opts);
        if (pick.back) return;
        if (pick.add) {
            const taken = collectIdsDeep(ev);
            let stageNum = 1;
            while (taken.has(mkStageId(ev.id, stageNum))) stageNum++;
            const result = await collectOneStage(ev, stageNum, null);
            ev.stages.push({ id: result.stage.id, name: result.stage.name, battles: result.battles });
            saveDraft();
            console.log(`  ✓ Added stage ${result.stage.id}.`);
            continue;
        }
        if (pick.remove) {
            const target = (await pickOne('Remove which stage?',
                ev.stages.map(s => ({ label: `${s.id} — ${s.name}`, value: s })))).value;
            const sure = (await ask(`  Type "y" to remove stage ${target.id}`, '')).toLowerCase() === 'y';
            if (!sure) { console.log('  cancelled'); continue; }
            ev.stages.splice(ev.stages.indexOf(target), 1);
            saveDraft();
            console.log(`  ✓ Removed stage ${target.id} (its enemies' formulas stay unused in js/formulas.js).`);
            continue;
        }
        await editStageMenu(pick.stage, ev);
    }
}

async function editStageMenu(st, ev) {
    for (;;) {
        console.log(`\n── Stage ${st.id} "${st.name}" ──`);
        const choice = await pickOne('Edit what?', [
            { label: `Name  [${st.name}]`, value: 'name' },
            { label: 'Battles…', value: 'battles' },
            { label: '(back)', value: 'back' },
        ]);
        if (choice.value === 'back') return;
        if (choice.value === 'name') { st.name = await ask('Stage name', st.name); saveDraft(); continue; }
        await editBattlesMenu(st, ev);
    }
}

async function editBattlesMenu(st, ev) {
    const legacy = !(st.battles && st.battles.length > 0);
    if (legacy) {
        // Legacy format: phases sit directly on the stage — no battle layer.
        for (;;) {
            console.log(`\n── Stage ${st.id} (legacy format: phases directly on the stage) ──`);
            const c = await pickOne('Options:', [
                { label: 'Edit phases directly…', value: 'phases' },
                { label: '(back)', value: 'back' },
            ]);
            if (c.value === 'back') return;
            await editPhasesMenu({ id: st.id, name: st.name, phases: st.phases || [] }, ev);
        }
    }
    for (;;) {
        console.log(`\n── Battles of stage ${st.id} ──`);
        const opts = st.battles.map(b => ({ label: `${b.id} — ${b.name}`, battle: b }));
        opts.push({ label: '(add a battle…)', add: true });
        opts.push({ label: '(remove a battle…)', remove: true });
        opts.push({ label: '(back)', back: true });
        const pick = await pickOne('Battles:', opts);
        if (pick.back) return;
        if (pick.add) {
            const taken = collectIdsDeep(ev);
            const id = nextFreeId(n => mkBattleId(st.id, n, false), taken);
            const name = await ask('Battle name', `Battle ${id.slice(st.id.length) || '?'}`);
            st.battles.push({ id, name, phases: [] });
            saveDraft();
            console.log(`  ✓ Added battle ${id} — add phases to it next.`);
            continue;
        }
        if (pick.remove) {
            const target = (await pickOne('Remove which battle?',
                st.battles.map(b => ({ label: `${b.id} — ${b.name}`, value: b })))).value;
            const sure = (await ask(`  Type "y" to remove battle ${target.id}`, '')).toLowerCase() === 'y';
            if (!sure) { console.log('  cancelled'); continue; }
            st.battles.splice(st.battles.indexOf(target), 1);
            saveDraft();
            console.log(`  ✓ Removed battle ${target.id}.`);
            continue;
        }
        await editBattleMenu(pick.battle, st, ev);
    }
}

async function editBattleMenu(b, st, ev) {
    for (;;) {
        console.log(`\n── Battle ${b.id} "${b.name}" ──`);
        const choice = await pickOne('Edit what?', [
            { label: `Name  [${b.name}]`, value: 'name' },
            { label: 'Phases…', value: 'phases' },
            { label: '(back)', value: 'back' },
        ]);
        if (choice.value === 'back') return;
        if (choice.value === 'name') { b.name = await ask('Battle name', b.name); saveDraft(); continue; }
        await editPhasesMenu(b, ev);
    }
}

async function editPhasesMenu(b, ev) {
    for (;;) {
        console.log(`\n── Phases of battle ${b.id} ──`);
        const opts = (b.phases || []).map(ph => ({ label: `${ph.id} — ${ph.name}`, phase: ph }));
        opts.push({ label: '(add a phase…)', add: true });
        opts.push({ label: '(remove a phase…)', remove: true });
        opts.push({ label: '(back)', back: true });
        const pick = await pickOne('Phases:', opts);
        if (pick.back) return;
        if (pick.add) {
            const taken = collectIdsDeep(ev);
            const id = nextFreeId(n => mkPhaseId(b.id, n), taken);
            const phaseNum = Number(String(id).slice(String(b.id).length)) || 1;
            const result = await collectPhase(b.id, phaseNum, 1);
            (b.phases = b.phases || []).push({
                id: result.id, name: result.name,
                ...(result.globalInputs ? { globalInputs: result.globalInputs } : {}),
                enemies: result.enemies,
            });
            saveDraft();
            console.log(`  ✓ Added phase ${result.id}.`);
            continue;
        }
        if (pick.remove) {
            const target = (await pickOne('Remove which phase?',
                (b.phases || []).map(ph => ({ label: `${ph.id} — ${ph.name}`, value: ph })))).value;
            const sure = (await ask(`  Type "y" to remove phase ${target.id}`, '')).toLowerCase() === 'y';
            if (!sure) { console.log('  cancelled'); continue; }
            b.phases.splice(b.phases.indexOf(target), 1);
            saveDraft();
            console.log(`  ✓ Removed phase ${target.id}.`);
            continue;
        }
        await editPhaseMenu(pick.phase, ev);
    }
}

async function editPhaseMenu(ph, ev) {
    for (;;) {
        console.log(`\n── Phase ${ph.id} "${ph.name}" ──`);
        const choice = await pickOne('Edit what?', [
            { label: `Name  [${ph.name}]`, value: 'name' },
            { label: `Phase-wide inputs…  [${(ph.globalInputs || []).length} current]`, value: 'inputs' },
            { label: `Enemies…  [${(ph.enemies || []).length}]`, value: 'enemies' },
            { label: '(back)', value: 'back' },
        ]);
        if (choice.value === 'back') return;
        if (choice.value === 'name') { ph.name = await ask('Phase name', ph.name); saveDraft(); continue; }
        if (choice.value === 'inputs') await editPhaseInputsMenu(ph);
        else await editEnemiesMenu(ph, ev);
    }
}

async function editPhaseInputsMenu(ph) {
    ph.globalInputs = ph.globalInputs || [];
    for (;;) {
        console.log(`\n── Phase-wide inputs of ${ph.id} ──`);
        if (ph.globalInputs.length === 0) console.log('  (none yet)');
        else ph.globalInputs.forEach((gi, i) => console.log(`    ${i + 1}. [${gi.id}] ${gi.label} (${gi.type})`));
        const choice = await pickOne('Options:', [
            { label: 'Add a phase-wide input…', value: 'add' },
            { label: 'Remove a phase-wide input…', value: 'remove' },
            { label: '(back)', value: 'back' },
        ]);
        if (choice.value === 'back') return;
        if (choice.value === 'add') {
            const added = await collectInputs({ globalMode: true, phaseInputs: ph.globalInputs });
            ph.globalInputs.push(...added);
            saveDraft();
            console.log(`  ✓ ${added.length} input(s) added.`);
            continue;
        }
        if (ph.globalInputs.length === 0) { console.log('  ⚠  Nothing to remove.'); continue; }
        const idx = (await pickOne('Remove which input?',
            ph.globalInputs.map((gi, i) => ({ label: `[${gi.id}] ${gi.label}`, value: i })))).value;
        const removed = ph.globalInputs.splice(idx, 1)[0];
        saveDraft();
        console.log(`  ✓ Removed phase-wide input ${removed.id}.`);
    }
}

async function editEnemiesMenu(ph, ev) {
    for (;;) {
        console.log(`\n── Enemies of phase ${ph.id} ──`);
        const opts = (ph.enemies || []).map(en => ({ label: `${en.id} — ${en.name}`, enemy: en }));
        opts.push({ label: '(add an enemy…)', add: true });
        opts.push({ label: '(remove an enemy…)', remove: true });
        opts.push({ label: '(back)', back: true });
        const pick = await pickOne('Enemies:', opts);
        if (pick.back) return;
        if (pick.add) {
            const taken = collectIdsDeep(ev);
            const id = nextFreeId(n => mkEnemyId(ph.id, n), taken);
            const enemy = await collectEnemy(ph.id, 1, 1, ph.globalInputs || [], id);
            (ph.enemies = ph.enemies || []).push(enemy);
            saveDraft();
            console.log(`  ✓ Added enemy ${id} (a formula stub will be generated).`);
            continue;
        }
        if (pick.remove) {
            const target = (await pickOne('Remove which enemy?',
                (ph.enemies || []).map(en => ({ label: `${en.id} — ${en.name}`, value: en })))).value;
            const sure = (await ask(`  Type "y" to remove enemy ${target.id}`, '')).toLowerCase() === 'y';
            if (!sure) { console.log('  cancelled'); continue; }
            ph.enemies.splice(ph.enemies.indexOf(target), 1);
            saveDraft();
            console.log(`  ✓ Removed enemy ${target.id} (its formula key stays unused in js/formulas.js).`);
            continue;
        }
        await editEnemyMenu(pick.enemy, ph, ev);
    }
}

async function editEnemyMenu(en, ph, ev) {
    for (;;) {
        console.log(`\n── Enemy ${en.id} "${en.name}" ──`);
        const choice = await pickOne('Edit what?', [
            { label: `Name  [${en.name}]`, value: 'name' },
            { label: `Image file  [${en.imageFile}]`, value: 'image' },
            { label: `Type  [${(TYPES.find(t => t.typeIcon === en.typeIcon) || {}).label || en.typeIcon}]`, value: 'type' },
            { label: `Rarity  [${String(en.rarity || '').toUpperCase()}]`, value: 'rarity' },
            { label: `Inputs…  [${(en.inputs || []).length}]`, value: 'inputs' },
            { label: `Outputs…  [${(en.outputs || []).length}]`, value: 'outputs' },
            { label: '(back)', value: 'back' },
        ]);
        if (choice.value === 'back') return;
        if (choice.value === 'name') {
            en.name = await ask('Enemy name', en.name);
        } else if (choice.value === 'image') {
            en.imageFile = await ask('Image file (e.g. card_1234567_thumb.webp)', en.imageFile);
        } else if (choice.value === 'type') {
            const idx = TYPES.findIndex(t => t.typeIcon === en.typeIcon);
            const t = await pickOneWithCurrent('Type:', TYPES, Math.max(0, idx));
            en.typeIcon = t.typeIcon;
            en.bg = t.bg;
        } else if (choice.value === 'rarity') {
            const idx = RARITIES.findIndex(r => r.value === en.rarity);
            const r = await pickOneWithCurrent('Rarity:', RARITIES, Math.max(0, idx));
            en.rarity = r.value;
        } else if (choice.value === 'inputs') {
            await editEnemyInputsMenu(en, ph);
            continue;
        } else if (choice.value === 'outputs') {
            await editEnemyOutputsMenu(en);
            continue;
        }
        saveDraft();
    }
}

async function editEnemyInputsMenu(en, ph) {
    en.inputs = en.inputs || [];
    for (;;) {
        console.log(`\n── Inputs of enemy ${en.id} ──`);
        if (en.inputs.length === 0) console.log('  (none yet — a static enemy)');
        else en.inputs.forEach((inp, i) => console.log(`    ${i + 1}. [${inp.id}] ${inp.label} (${inp.type})`));
        if (ph && (ph.globalInputs || []).length) {
            console.log(`  Phase-wide (shared by the whole phase): ${ph.globalInputs.map(i => i.id).join(', ')}`);
        }
        const choice = await pickOne('Options:', [
            { label: 'Add an input…', value: 'add' },
            { label: 'Edit an input…', value: 'edit' },
            { label: 'Remove an input…', value: 'remove' },
            { label: '(back)', value: 'back' },
        ]);
        if (choice.value === 'back') return;
        if (choice.value === 'add') {
            const added = await collectInputs({ phaseInputs: ph ? (ph.globalInputs || []) : [] });
            en.inputs.push(...added);
            saveDraft();
            console.log(`  ✓ ${added.length} input(s) added.`);
            continue;
        }
        if (en.inputs.length === 0) { console.log('  ⚠  Nothing to edit/remove.'); continue; }
        if (choice.value === 'edit') {
            const inp = (await pickOne('Edit which input?',
                en.inputs.map((x, i) => ({ label: `[${x.id}] ${x.label}`, value: i })))).value;
            const target = en.inputs[inp];
            if (target.type === 'checkbox') {
                target.label = await ask('  Label text', target.label);
                target.default = (await ask('  Default checked? (true/false)', String(!!target.default))) === 'true';
            } else {
                target.label = await ask('  Label text', target.label);
                target.min = await askInt('  Min', target.min ?? 0);
                target.max = await askInt('  Max', target.max ?? 100, target.min);
                target.default = await askInt('  Default', target.default ?? target.min ?? 0, target.min, target.max);
            }
            saveDraft();
            console.log(`  ✓ Updated input ${target.id}.`);
            continue;
        }
        const idx = (await pickOne('Remove which input?',
            en.inputs.map((x, i) => ({ label: `[${x.id}] ${x.label}`, value: i })))).value;
        const removed = en.inputs.splice(idx, 1)[0];
        saveDraft();
        console.log(`  ✓ Removed input ${removed.id} (its formula may still reference inputs.${removed.id}).`);
    }
}

async function editEnemyOutputsMenu(en) {
    en.outputs = en.outputs || [];
    for (;;) {
        console.log(`\n── Outputs of enemy ${en.id} ──`);
        if (en.outputs.length === 0) console.log('  (none yet)');
        else en.outputs.forEach((o, i) => console.log(`    ${i + 1}. [${o.id}] ${o.label}`));
        const choice = await pickOne('Options:', [
            { label: 'Add an output…', value: 'add' },
            { label: 'Edit a label…', value: 'edit' },
            { label: 'Remove an output…', value: 'remove' },
            { label: '(back)', value: 'back' },
        ]);
        if (choice.value === 'back') return;
        if (choice.value === 'add') {
            const o = await pickOutputDef(new Set(en.outputs.map(x => x.id)));
            if (!o) continue;
            const label = await ask(`  Label for "${o.id}"`, o.defaultLabel);
            en.outputs.push({ id: o.id, label });
            saveDraft();
            console.log(`  ✓ Added output ${o.id}.`);
            continue;
        }
        if (en.outputs.length === 0) { console.log('  ⚠  Nothing to edit/remove.'); continue; }
        if (choice.value === 'edit') {
            const o = (await pickOne('Edit which label?',
                en.outputs.map((x, i) => ({ label: `[${x.id}] ${x.label}`, value: i })))).value;
            en.outputs[o].label = await ask('  New label', en.outputs[o].label);
            saveDraft();
            console.log('  ✓ Label updated.');
            continue;
        }
        const idx = (await pickOne('Remove which output?',
            en.outputs.map((x, i) => ({ label: `[${x.id}] ${x.label}`, value: i })))).value;
        const removed = en.outputs.splice(idx, 1)[0];
        saveDraft();
        console.log(`  ✓ Removed output ${removed.id} (review its formula's return keys).`);
    }
}

/** Single-output picker for edit mode: dynamic top list + show-all + custom. */
async function pickOutputDef(excludeIds = new Set()) {
    let showAll = false;
    for (;;) {
        const list = showAll ? getAllOutputOptions(excludeIds) : getTopOutputs(excludeIds);
        const menu = [
            ...list.map(o => ({ label: `${o.label}  [${o.id}]${o.count ? `  ×${o.count}` : ''}`, out: o })),
            { label: showAll ? '(back to most-used outputs)' : '(show all outputs — rare ones)', toggleAll: true },
            { label: '(custom output…)', custom: true },
            { label: '(done)', done: true },
        ];
        const picked = await pickMany('Select one output:', menu);
        const out = picked.find(o => o.out);
        if (picked.some(o => o.toggleAll)) { showAll = !showAll; continue; }
        if (picked.some(o => o.custom)) return await buildCustomOutput();
        if (picked.some(o => o.done)) return null;
        if (out) return { id: out.out.id, defaultLabel: out.out.defaultLabel || out.out.label };
    }
}

/** Edit-mode generation: diff report + paste-ready replacement snippet. */
async function generateEditOutput(ev, original) {
    console.log('\n\nGenerating the replacement snippet…');

    // ── diff original ↔ edited (ids normalized across an event-id rename) ──
    const renamed = String(ev.id) !== String(original.id);
    const newIdFor = (oldId) => (renamed && String(oldId).startsWith(String(original.id)))
        ? String(ev.id) + String(oldId).slice(String(original.id).length)
        : String(oldId);

    const originalIds = [...collectIdsDeep(original)].map(newIdFor);
    const editedIds = [...collectIdsDeep(ev)];
    const addedIds = editedIds.filter(id => !originalIds.includes(id));
    const removedIds = originalIds.filter(id => !editedIds.includes(id));

    const originalFlat = flattenEventTree(original)
        .map(x => ({ ...x, enemy: { ...x.enemy, id: newIdFor(x.enemy.id) } }));
    const editedFlat = flattenEventTree(ev);
    const editedById = new Map(editedFlat.map(x => [String(x.enemy.id), x]));
    const originalById = new Map(originalFlat.map(x => [String(x.enemy.id), x]));

    const notes = [];
    if (renamed) {
        notes.push(`EVENT ID RENAMED: ${original.id} → ${ev.id}.`);
        const renames = originalFlat
            .filter(x => editedById.has(String(x.enemy.id)))
            .map(x => `${newIdFor(x.enemy.id)}  (was ${x.enemy.id})`);
        if (renames.length) {
            notes.push('RENAME these formula keys in js/formulas.js (new ← old):');
            renames.forEach(r => notes.push(`  - ${r}`));
        }
    }
    removedIds.forEach(id => notes.push(`Removed id ${id}: its formula key (if any) is now unused in js/formulas.js (harmless — delete at will).`));
    for (const x of editedFlat) {
        const before = originalById.get(String(x.enemy.id));
        if (!before) continue;
        const beforeIn = (before.enemy.inputs || []).map(i => i.id);
        const nowIn = (x.enemy.inputs || []).map(i => i.id);
        beforeIn.filter(id => !nowIn.includes(id))
            .forEach(id => notes.push(`Enemy ${x.enemy.id}: input "${id}" removed — its formula may still reference inputs.${id}.`));
        if (JSON.stringify(before.enemy.outputs || []) !== JSON.stringify(x.enemy.outputs || [])) {
            notes.push(`Enemy ${x.enemy.id}: outputs changed — review the return keys/logic of its formula.`);
        }
    }
    const newEnemies = editedFlat.filter(x => addedIds.includes(String(x.enemy.id)));

    // ── choose the export scope ──
    const scope = (await pickOne('Generate the replacement snippet for:', [
        { label: `Whole event  ${ev.id} "${ev.name}"  (recommended)`, value: 'event' },
        { label: 'A single stage…', value: 'stage' },
        { label: 'A single battle…', value: 'battle' },
        { label: 'A single phase…', value: 'phase' },
        { label: 'A single enemy…', value: 'enemy' },
    ])).value;

    let snippet = '';
    let pasteHint = '';
    if (scope === 'event') {
        snippet = generateDataSnippet(ev, ev.stages.map(st => ({ stage: st, battles: st.battles || [] })));
        pasteHint = `Replace the WHOLE block of event ${ev.id} inside  events: [ ... ]  with this.`;
    } else if (scope === 'stage') {
        const st = (await pickOne('Which stage?',
            ev.stages.map(s => ({ label: `${s.id} — ${s.name}`, value: s })))).value;
        snippet = generateStagesBlock([{ stage: st, battles: st.battles || [] }]);
        pasteHint = `Replace the block of stage ${st.id} inside its  stages: [ ... ]  with this.`;
    } else if (scope === 'battle') {
        const battles = [];
        for (const st of ev.stages || []) getBattlesOf(st).forEach(b => { if (b.id !== 'legacy-battle') battles.push(b); });
        const b = (await pickOne('Which battle?',
            battles.map(x => ({ label: `${x.id} — ${x.name}`, value: x })))).value;
        snippet = generateBattlesBlock([b]);
        pasteHint = `Replace the block of battle ${b.id} inside its  battles: [ ... ]  with this.`;
    } else if (scope === 'phase') {
        const phases = [];
        for (const st of ev.stages || []) getBattlesOf(st).forEach(b => (b.phases || []).forEach(ph => phases.push(ph)));
        const ph = (await pickOne('Which phase?',
            phases.map(x => ({ label: `${x.id} — ${x.name}`, value: x })))).value;
        snippet = generatePhasesBlock([ph]);
        pasteHint = `Replace the block of phase ${ph.id} inside its  phases: [ ... ]  with this.`;
    } else {
        const flat = flattenEventTree(ev);
        const en = (await pickOne('Which enemy?',
            flat.map(x => ({ label: `${x.enemy.id} — ${x.enemy.name}`, value: x.enemy })))).value;
        snippet = enemyBlock(en, 40);
        pasteHint = `Replace the block of enemy ${en.id} inside its  enemies: [ ... ]  with this.`;
    }

    const D = '═'.repeat(64);
    const output = [
        D,
        'EDIT MODE — DATA.JS REPLACEMENT',
        pasteHint,
        D, '', snippet, '',
        D,
        'CHANGES vs js/data.js (informational)',
        ...(notes.length ? notes.map(n => `  ${n}`) : ['  (no differences detected)']),
        ...(newEnemies.length ? [
            '',
            D,
            'FORMULAS.JS STUBS FOR NEWLY ADDED ENEMIES',
            'Paste inside the  formulaFunctions = { ... }  object in js/formulas.js.',
            D, '',
            newEnemies.map(x => formulaStub(x.enemy, ev.name, x.battleName, x.phase.globalInputs || [])).join('\n\n'),
        ] : []),
    ].join('\n');

    const outDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `edit-${ev.id}.txt`);
    fs.writeFileSync(outFile, output, 'utf8');

    const draftPath = draftPathOf(draft);
    deleteDraft(draft);
    draft = null;

    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║   Done!                                   ║');
    console.log('╚═══════════════════════════════════════════╝');
    console.log(`\nSaved to: ${outFile}`);
    console.log(`Draft cleared: ${draftPath}`);
    console.log(`Notes: ${notes.length} · New enemies: ${newEnemies.length}`);
    console.log('\nNext steps:');
    console.log('  1. Open js/data.js and replace the old block with the generated one.');
    if (newEnemies.length) console.log('  2. Paste the new formula stubs into js/formulas.js and fill in the TODOs.');
    console.log('  3. npm run obfuscate (data.js / formulas.js changed!).');

    rl.close();
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║  Dokkan Battle – New Entry Wizard  (v7)  ║');
    console.log('╚═══════════════════════════════════════════╝');
    console.log('\nAt every section prompt:  [Enter] continue  [r] redo  [b] back  [s] save & exit\n');

    // ── Step A: resume an unfinished draft or start a new one ─────────────────
    draft = await resumeMenuOrNew();

    if (draft.mode === 'edit') return await runEditMode();

    let event = draft.event;

    if (draft.mode === 'append') {
        if (!findEventById(event.id)) {
            console.log(`\n  ⚠  Event ${event.id} is no longer in js/data.js — stage numbering may restart at 1.`);
        }
        console.log(`  Appending to event ${event.id} "${event.name}" — ${draft.stages.length} stage(s) collected so far.`);
    } else {
        console.log(`  New event ${event.id} "${event.name}" — ${draft.stages.length} stage(s) collected so far.`);
    }

    // ── Stage loop: collect one or more stages ─────────────────────────────────
    // draft.stages: array of { stage, battles }
    for (;;) {
        const stageNum = nextStageNumber(event.id, draft.stages);

        // Resume the partial stage from the draft only when it belongs to this slot
        const ip        = draft.inProgress;
        const ipMatches = !!(ip && ip.stage && ip.stage.id === mkStageId(event.id, stageNum));
        const result    = await collectOneStage(event, stageNum, ipMatches ? ip : null);

        if (result === GO_BACK) {
            if (draft.stages.length > 0) {
                // Back past stage N header → redo stage N-1 (pop and re-collect it).
                // A partially collected stage stays parked in the draft and is
                // resumed automatically once its slot comes up again.
                draft.stages.pop();
                saveDraft();
                continue;
            }
            // Back before stage 1 → re-collect event
            for (;;) {
                console.log('\n── Event (edit) ───────────────────────────────');
                const id   = await ask('Event ID', event.id);
                const name = await ask('Event name', event.name);
                const nav  = await navPrompt(`Event "${name}" (id: ${id})`);
                if (nav === 'redo') continue;
                if (id !== String(event.id)) {
                    // Stage ids derive from the event id → collected stages are stale
                    draft.stages = [];
                    draft.inProgress = null;
                }
                event = { ...event, id, name, image: `images/events/${id}.webp` };
                draft.event = event;
                saveDraft();
                break;
            }
            continue;
        }

        draft.stages.push(result);
        draft.inProgress = null;
        saveDraft();

        // Ask whether to add another stage
        console.log(`\n  ✓  Stage "${result.stage.name}" complete.`);
        console.log('  [Enter / n] Done   [y] Add another stage   [b] Redo this stage   [s] Save & exit');
        const ans = (await ask('  >', 'n')).toLowerCase();
        if (ans.startsWith('s')) saveAndExit();
        if (ans.startsWith('b')) {
            draft.stages.pop();
            saveDraft();
            continue;
        }
        if (ans.startsWith('y')) continue;
        break;   // done
    }

    // ── Generate and write output ──────────────────────────────────────────────
    console.log('\n\nGenerating snippets…');

    const allStages = draft.stages;
    const isAppend  = draft.mode === 'append';
    const dataBlock = isAppend
        ? generateAppendSnippet(event, allStages)
        : generateDataSnippet(event, allStages);
    const allEnemies = allStages.flatMap(({ battles }) =>
        battles.flatMap(b => b.phases.flatMap(ph => ph.enemies.map(e => ({
            enemy: e,
            battleName: b.name,
            globalInputs: ph.globalInputs || [],
        }))))
    );
    const formulasBlock = allEnemies
        .map(({ enemy, battleName, globalInputs }) => formulaStub(enemy, event.name, battleName, globalInputs))
        .join('\n\n');

    const D = '═'.repeat(64);
    const stageCount = allStages.length;
    const pasteTarget = isAppend
        ? `Paste inside the  stages: [ ... ]  array of event ${event.id} in js/data.js\n(after the last existing stage).`
        : `Paste inside the  events: [ ... ]  array in js/data.js.`;
    const output = [
        D,
        isAppend ? 'DATA.JS EXTRA STAGES' : 'DATA.JS ENTRY',
        pasteTarget,
        `(Contains ${stageCount} new stage${stageCount > 1 ? 's' : ''})`,
        D, '', dataBlock, '',
        D,
        'FORMULAS.JS STUBS',
        'Paste inside the  formulaFunctions = { ... }  object in js/formulas.js.',
        'Then fill in baseAtk, saMulti, stackSuper and the formula logic (TODOs).',
        D, '', formulasBlock,
    ].join('\n');

    const outDir  = path.join(__dirname, 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, isAppend ? `append-${event.id}.txt` : `entry-${event.id}.txt`);
    fs.writeFileSync(outFile, output, 'utf8');

    // Draft fully consumed → remove it
    const draftPath = draftPathOf(draft);
    deleteDraft(draft);
    draft = null;

    if (isAppend && findEventById(event.id)) {
        console.log(`\n  ⚠  Note: this file contains only the NEW stages/enemies for event ${event.id}.`);
        console.log('     The existing event data in js/data.js stays untouched.');
    }

    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║   Done!                                   ║');
    console.log('╚═══════════════════════════════════════════╝');
    console.log(`\nSaved to: ${outFile}`);
    console.log(`Draft cleared: ${draftPath}`);
    console.log(`\nGenerated: ${stageCount} stage${stageCount > 1 ? 's' : ''}, ${allEnemies.length} formula stub${allEnemies.length !== 1 ? 's' : ''}`);
    console.log('\nNext steps:');
    if (isAppend) {
        console.log(`  1. Open js/data.js → event ${event.id} "${event.name}" → stages: [ ... ]`);
        console.log('  2. Paste the DATA.JS block after the last existing stage (add a comma).');
        console.log('  3. Copy FORMULAS.JS stubs      → paste into js/formulas.js (inside formulaFunctions)');
        console.log('  4. Fill in baseAtk, saMulti, stackSuper and formula logic (TODOs)');
        console.log('  5. npm run obfuscate');
    } else {
        console.log('  1. Copy DATA.JS block        → paste into js/data.js (inside events: [ ... ])');
        console.log('  2. Copy FORMULAS.JS stubs    → paste into js/formulas.js (inside formulaFunctions)');
        console.log('  3. Fill in baseAtk, saMulti, stackSuper and formula logic (TODOs)');
        console.log('  4. npm run obfuscate');
    }
    console.log('');

    rl.close();
}

// Ctrl+C is safe: persist the draft before exiting
rl.on('SIGINT', () => {
    if (draft) {
        saveDraft();
        console.log(`\n\n💾  Draft saved: ${draftPathOf(draft)}`);
        console.log(`   ${describeDraft(draft)}`);
        console.log('   Run `npm run new-entry` again to resume.');
    }
    process.exit(0);
});

main().catch(err => {
    console.error('\n✗ Fatal error:', err.message);
    rl.close();
    process.exit(1);
});