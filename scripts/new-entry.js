#!/usr/bin/env node
/**
 * Dokkan Calculator – New Entry Wizard  (v3)
 *
 * Generates ready-to-paste data.js and formulas.js snippets for a new event entry.
 *
 * Features:
 *   - Multi-stage generation: generate any number of stages for one event in a single run
 *   - Custom label prompt for every output field (not just Super ATK)
 *   - super_atk2 output supported
 *   - Battle-level entries (multi-battle stages supported)
 *   - Full go-back / redo history at every section boundary
 *
 * At every section confirmation prompt:
 *   [Enter]  Continue to next section
 *   [r]      Redo the current section from scratch
 *   [b]      Go back to the previous section
 *
 * Output: scripts/output/entry-<eventId>.txt  (all stages in one file)
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
 * Returns 'ok' | 'redo' | 'back'
 */
async function navPrompt(summary) {
    console.log(`\n  ✓  ${summary}`);
    console.log('  [Enter] Continue   [r] Redo this section   [b] Back');
    const ans = (await ask('  >', '')).toLowerCase();
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

const INPUT_PRESETS = [
    {
        label: 'Turn count',
        build: async () => {
            const max = await askInt('  Max turns (inclusive)', 6, 1);
            return { id: 'turn_count', label: 'Current turn', type: 'number', min: 1, max, default: 1 };
        }
    },
    {
        label: 'ATK debuff from passives (%)',
        build: async () => ({ id: 'atk_debuff_passive', label: 'ATK debuff from passives (%)', type: 'number', min: 0, max: 100, default: 0 })
    },
    {
        label: 'ATK debuff from supers (%)',
        build: async () => ({ id: 'atk_debuff_super', label: 'ATK debuff from supers (%)', type: 'number', min: 0, max: 100, default: 0 })
    },
    {
        label: 'Number of ATKs received',
        build: async () => {
            const max = await askInt('  Max ATKs received', 10, 1);
            return { id: 'num_atks_received', label: 'Total ATKs received', type: 'number', min: 0, max, default: 0 };
        }
    },
    {
        label: 'Custom number input',
        build: async () => {
            const id    = await ask('  Input ID (underscores, no spaces)');
            const label = await ask('  Label text');
            const min   = await askInt('  Min', 0);
            const max   = await askInt('  Max', 100, min);
            const def   = await askInt('  Default', min, min, max);
            return { id, label, type: 'number', min, max, default: def };
        }
    },
    {
        label: 'Custom checkbox',
        build: async () => {
            const id    = await ask('  Input ID (underscores, no spaces)');
            const label = await ask('  Label text');
            const def   = (await ask('  Default checked?', 'true')) === 'true';
            return { id, label, type: 'checkbox', default: def };
        }
    },
];

const OUTPUT_PRESETS = [
    { label: 'Normal ATK',                id: 'normal_atk',  defaultLabel: 'Normal ATK' },
    { label: 'Normal ATK after supering', id: 'normal_atk2', defaultLabel: 'Normal ATK after supering' },
    { label: 'AOE ATK 2+',                id: 'aoe_atk',     defaultLabel: 'AOE ATK 2+' },
    { label: 'AOE ATK 2+ after supering', id: 'aoe_atk2',    defaultLabel: 'AOE ATK 2+ after supering' },
    { label: 'Super ATK',                 id: 'super_atk',   defaultLabel: 'Super ATK' },
    { label: 'Super ATK 2 / second hit',  id: 'super_atk2',  defaultLabel: 'Super ATK 2+' },
];

// ─── ID helpers ───────────────────────────────────────────────────────────────

const mkStageId  = (eventId, n)         => `${eventId}00${n}5`;
// Single-battle stages reuse the stage ID as the battle ID (existing convention).
// Multi-battle stages append the battle number.
const mkBattleId = (stageId, n, single) => single ? stageId : `${stageId}${n}`;
const mkPhaseId  = (battleId, n)        => `${battleId}${n}`;
const mkEnemyId  = (phaseId, n)         => `${phaseId}${n}`;

// ─── input / output collectors ────────────────────────────────────────────────

async function collectInputs() {
    const inputs = [];
    console.log('\n  ── Inputs (presets or custom; leave empty for static enemy) ──');
    for (;;) {
        if (inputs.length) console.log(`  Collected: ${inputs.map(i => i.id).join(', ')}`);
        const menu = [...INPUT_PRESETS, { label: '(done — no more inputs)' }];
        menu.forEach((o, i) => console.log(`    ${i + 1}. ${o.label}`));
        const n = parseInt(await ask('  Add input'), 10);
        if (n === menu.length || isNaN(n)) break;
        if (n < 1 || n > menu.length - 1) { console.log('  ⚠  Invalid.'); continue; }
        const inp = await INPUT_PRESETS[n - 1].build();
        inputs.push(inp);
        console.log(`  ✓ Added: ${inp.id}`);
    }
    return inputs;
}

async function collectOutputs() {
    console.log('\n  ── Outputs ──');
    const selected = await pickMany('Select all outputs that apply:', OUTPUT_PRESETS);
    const results = [];
    for (const opt of selected) {
        const label = await ask(`  Label for "${opt.label}"`, opt.defaultLabel);
        results.push({ id: opt.id, label });
    }
    return results;
}

// ─── section collectors (each returns data or GO_BACK) ────────────────────────

/**
 * Collects one enemy.
 * navPrompt 'redo' restarts the outer for(;;) loop — re-asks everything for this enemy.
 * navPrompt 'back' returns GO_BACK to the phase collector.
 */
async function collectEnemy(phaseId, enemyNum, totalInPhase) {
    for (;;) {
        console.log(`\n  ── Enemy ${enemyNum}${totalInPhase > 1 ? ` of ${totalInPhase}` : ''} ──`);
        const name      = await ask('  Enemy name');
        const imageFile = await ask('  Image file (e.g. card_1234567_thumb.jpg)');
        const type      = await pickOne('Type:', TYPES);
        const rarity    = await pickOne('Rarity:', RARITIES);
        const inputs    = await collectInputs();
        const outputs   = await collectOutputs();
        const id        = mkEnemyId(phaseId, enemyNum);

        const nav = await navPrompt(`Enemy "${name}" (id: ${id})`);
        if (nav === 'back') return GO_BACK;
        if (nav === 'redo') continue;
        return { id, name, imageFile, typeIcon: type.typeIcon, bg: type.bg, rarity: rarity.value, inputs, outputs };
    }
}

/**
 * Collects all enemies for one phase.
 * GO_BACK from enemy 0 propagates up; from enemy N>0 steps back one enemy.
 */
async function collectPhase(battleId, phaseNum, numPhases) {
    for (;;) {
        const phaseName  = numPhases === 1 ? 'Phase 1' : await ask(`Phase ${phaseNum} name`, `Phase ${phaseNum}`);
        const phaseId    = mkPhaseId(battleId, phaseNum);
        const numEnemies = await askInt('Number of enemies in this phase', 1, 1);

        const enemies  = [];
        let ei         = 0;
        let wentBack   = false;

        while (ei < numEnemies) {
            const res = await collectEnemy(phaseId, ei + 1, numEnemies);
            if (res === GO_BACK) {
                if (ei > 0) { enemies.pop(); ei--; }   // step back one enemy
                else { wentBack = true; break; }        // propagate to phase level
                continue;
            }
            enemies.push(res);
            ei++;
        }

        if (wentBack) return GO_BACK;

        const nav = await navPrompt(`Phase "${phaseName}" — ${enemies.length} enemy(ies)`);
        if (nav === 'back') return GO_BACK;
        if (nav === 'redo') continue;
        return { id: phaseId, name: phaseName, enemies };
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
 */
async function collectAllContent(battleDefs) {
    const collected = [];
    let bi = 0;

    while (bi < battleDefs.length) {
        const { id, name } = battleDefs[bi];
        const res = await collectBattle(id, name);
        if (res === GO_BACK) {
            if (bi > 0) { collected.pop(); bi--; }   // step back one battle
            else return GO_BACK;                      // propagate to top-level
            continue;
        }
        collected.push(res);
        bi++;
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
        `${pad(pp)}typeIcon: 'images/types/${enemy.typeIcon}.jpg',`,
        `${pad(pp)}rarityIcon: 'images/rarity/${enemy.rarity}.jpg',`,
        `${pad(pp)}background: 'images/bgs/${enemy.bg}.jpg',`,
        `${pad(pp)}inputs: [${ins}],`,
        `${pad(pp)}formula: "${enemy.id}",`,
        `${pad(pp)}outputs: [${outs}],`,
        `${pad(ip)}}`,
    ].join('\n');
}

function generateDataSnippet(event, stagesWithBattles) {
    const stagesBlock = stagesWithBattles.map(({ stage, battles }) => {
        const battlesBlock = battles.map(b => {
            const phasesBlock = b.phases.map(ph => {
                const enemiesBlock = ph.enemies.map(e => enemyBlock(e, 52)).join(',\n');
                return [
                    `${pad(36)}{`,
                    `${pad(40)}id: "${ph.id}",`,
                    `${pad(40)}name: "${ph.name}",`,
                    `${pad(40)}enemies: [`,
                    enemiesBlock,
                    `${pad(40)}],`,
                    `${pad(36)}}`,
                ].join('\n');
            }).join(',\n');
            return [
                `${pad(24)}{`,
                `${pad(28)}id: "${b.id}",`,
                `${pad(28)}name: "${b.name}",`,
                `${pad(28)}phases: [`,
                phasesBlock,
                `${pad(28)}],`,
                `${pad(24)}}`,
            ].join('\n');
        }).join(',\n');

        return [
            `                {`,
            `                    id: "${stage.id}",`,
            `                    name: "${stage.name}",`,
            `                    battles: [`,
            battlesBlock,
            `                    ]`,
            `                }`,
        ].join('\n');
    }).join(',\n');

    return [
        `        // ─── Paste inside  events: [ ... ]  in js/data.js ───`,
        `        {`,
        `            id: "${event.id}",`,
        `            name: "${event.name}",`,
        `            image: "${event.image}",`,
        `            stages: [`,
        stagesBlock,
        `            ]`,
        `        },`,
    ].join('\n');
}

function formulaStub(enemy, eventName, battleName) {
    const hasDebuffPassive = enemy.inputs.some(i => i.id === 'atk_debuff_passive');
    const hasDebuffSuper   = enemy.inputs.some(i => i.id === 'atk_debuff_super');
    const outputIds        = new Set(enemy.outputs.map(o => o.id));
    const hasTwoSupers     = outputIds.has('super_atk2');
    const needsStackSuper  = outputIds.has('normal_atk2') || outputIds.has('aoe_atk') || outputIds.has('aoe_atk2');

    // Input extraction lines (match actual formulas.js patterns)
    const varLines = enemy.inputs.map(inp =>
        inp.type === 'checkbox'
            ? `        const ${inp.id} = inputs.${inp.id} || false;`
            : `        const ${inp.id} = (inputs.${inp.id} !== undefined && inputs.${inp.id} !== null) ? inputs.${inp.id} : ${inp.default};`
    );

    // Constant declarations
    const constLines = [`        const baseAtk = 0; // TODO`];
    if (hasTwoSupers) {
        constLines.push(`        const saMulti1 = 0; // TODO`);
        constLines.push(`        const saMulti2 = 0; // TODO`);
    } else {
        constLines.push(`        const saMulti = 0; // TODO`);
    }
    if (needsStackSuper) constLines.push(`        const stackSuper = 0; // TODO`);

    // Computation stubs (mirror the variable names used in formulas.js)
    const calcLines = [];

    if (outputIds.has('normal_atk')) {
        if (hasDebuffPassive && hasDebuffSuper) {
            calcLines.push(`        const normalAtk = baseAtk * (1 - atkDebuffPassive) * (1 - atkDebuffSuper > 0 ? 1 - atkDebuffSuper : 0); // TODO`);
        } else if (hasDebuffPassive) {
            calcLines.push(`        const normalAtk = baseAtk * (1 - atkDebuffPassive); // TODO`);
        } else {
            calcLines.push(`        const normalAtk = baseAtk; // TODO`);
        }
    }
    if (outputIds.has('normal_atk2')) calcLines.push(`        const normalAtk2 = normalAtk * (1 + stackSuper); // TODO`);
    if (outputIds.has('aoe_atk'))     calcLines.push(`        const aoeAtk = normalAtk * 0.5; // TODO`);
    if (outputIds.has('aoe_atk2'))    calcLines.push(`        const aoeAtk2 = normalAtk2 * 0.5; // TODO`);

    if (outputIds.has('super_atk')) {
        const multi = hasTwoSupers ? 'saMulti1' : 'saMulti';
        if (hasDebuffPassive && hasDebuffSuper) {
            calcLines.push(`        const superAtk = baseAtk * (1 - atkDebuffPassive) * (${multi} - atkDebuffSuper > 0 ? ${multi} - atkDebuffSuper : 0); // TODO`);
        } else if (hasDebuffPassive) {
            calcLines.push(`        const superAtk = baseAtk * (1 - atkDebuffPassive) * ${multi}; // TODO`);
        } else {
            calcLines.push(`        const superAtk = baseAtk * ${multi}; // TODO`);
        }
    }
    if (outputIds.has('super_atk2')) {
        if (hasDebuffPassive && hasDebuffSuper) {
            calcLines.push(`        const superAtk2 = baseAtk * (1 - atkDebuffPassive) * (saMulti2 - atkDebuffSuper > 0 ? saMulti2 - atkDebuffSuper : 0); // TODO`);
        } else {
            calcLines.push(`        const superAtk2 = baseAtk * saMulti2; // TODO`);
        }
    }

    // Return keys map to the named variables above
    const varMap = {
        normal_atk:  'normalAtk',
        normal_atk2: 'normalAtk2',
        aoe_atk:     'aoeAtk',
        aoe_atk2:    'aoeAtk2',
        super_atk:   'superAtk',
        super_atk2:  'superAtk2',
    };
    const retLines = enemy.outputs.map(o => `            ${o.id}: ${varMap[o.id] || o.id},`);

    return [
        `    // ${eventName} – ${battleName} – ${enemy.name}`,
        `    ${enemy.id}: function (inputs) {`,
        ...varLines,
        varLines.length ? '' : null,
        ...constLines,
        ``,
        ...calcLines,
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
 * Returns { stage, battles } or GO_BACK if the user backs past the stage header.
 */
async function collectOneStage(event, stageNum) {
    let stage, battleDefs;
    let step = 0;   // 0 = stage header, 1 = battle defs

    // ── Steps 0 & 1: stage header and battle definitions ──────────────────────
    while (step < 2) {
        if (step === 0) {
            console.log(`\n── Stage ${stageNum} ────────────────────────────────`);
            const name = await ask('Stage name', stage && stage.name);
            const sId  = mkStageId(event.id, stageNum);
            const nav  = await navPrompt(`Stage "${name}" (id: ${sId})`);
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
            const nav = await navPrompt(summary);
            if (nav === 'back') { step = 0; continue; }
            if (nav === 'redo') continue;
            battleDefs = defs;
            step = 2;
        }
    }

    // ── Content collection with back-into-battle-defs support ─────────────────
    for (;;) {
        const result = await collectAllContent(battleDefs);
        if (result !== GO_BACK) return { stage, battles: result };

        // User backed past the first battle → re-enter step machine at battle defs
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
                const nav = await navPrompt(summary);
                if (nav === 'back') { step = 0; continue; }
                if (nav === 'redo') continue;
                battleDefs = defs;
                step = 2;

            } else {   // step === 0
                console.log('\n── Stage (edit) ───────────────────────────────');
                const name = await ask('Stage name', stage.name);
                const sId  = mkStageId(event.id, stageNum);
                const nav  = await navPrompt(`Stage "${name}" (id: ${sId})`);
                if (nav === 'back') return GO_BACK;   // propagate up
                if (nav === 'redo') continue;
                stage = { id: sId, name, num: stageNum };
                step  = 1;
            }
        }
    }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║  Dokkan Battle – New Entry Wizard  (v3)  ║');
    console.log('╚═══════════════════════════════════════════╝');
    console.log('\nAt every section prompt:  [Enter] continue  [r] redo  [b] back\n');

    // ── Step 0: collect event (once per run) ──────────────────────────────────
    let event;
    for (;;) {
        console.log('── Event ──────────────────────────────────────');
        const id   = await ask('Event ID (4 digits, e.g. 1730)', event && event.id);
        const name = await ask('Event name', event && event.name);
        const nav  = await navPrompt(`Event "${name}" (id: ${id}, image: images/events/${id}.jpg)`);
        if (nav === 'redo') continue;
        // 'back' at step 0 → treat as redo (nowhere further back)
        event = { id, name, image: `images/events/${id}.jpg` };
        break;
    }

    // ── Stage loop: collect one or more stages ─────────────────────────────────
    // allStages: array of { stage, battles }
    const allStages = [];

    outer: for (;;) {
        const stageNum = allStages.length + 1;
        const result   = await collectOneStage(event, stageNum);

        if (result === GO_BACK) {
            if (allStages.length > 0) {
                // Back past stage N header → redo stage N-1 (pop and re-collect it)
                allStages.pop();
                continue;
            }
            // Back before stage 1 → re-collect event
            for (;;) {
                console.log('\n── Event (edit) ───────────────────────────────');
                const id   = await ask('Event ID', event.id);
                const name = await ask('Event name', event.name);
                const nav  = await navPrompt(`Event "${name}" (id: ${id})`);
                if (nav === 'redo') continue;
                event = { id, name, image: `images/events/${id}.jpg` };
                break;
            }
            continue;
        }

        allStages.push(result);

        // Ask whether to add another stage
        console.log(`\n  ✓  Stage ${stageNum} "${result.stage.name}" complete.`);
        console.log('  [Enter / n] Done   [y] Add another stage   [b] Redo this stage');
        const ans = (await ask('  >', 'n')).toLowerCase();
        if (ans.startsWith('b')) {
            allStages.pop();    // redo current stage
            continue;
        }
        if (ans.startsWith('y')) continue;
        break;   // done
    }

    // ── Generate and write output ──────────────────────────────────────────────
    console.log('\n\nGenerating snippets…');

    const dataBlock     = generateDataSnippet(event, allStages);
    const allEnemies    = allStages.flatMap(({ battles }) =>
        battles.flatMap(b => b.phases.flatMap(ph => ph.enemies.map(e => ({ ...e, battleName: b.name }))))
    );
    const formulasBlock = allEnemies
        .map(e => formulaStub(e, event.name, e.battleName))
        .join('\n\n');

    const D = '═'.repeat(64);
    const stageCount = allStages.length;
    const output = [
        D,
        'DATA.JS ENTRY',
        `Paste inside the  events: [ ... ]  array in js/data.js.`,
        `(Contains ${stageCount} stage${stageCount > 1 ? 's' : ''})`,
        D, '', dataBlock, '',
        D,
        'FORMULAS.JS STUBS',
        'Paste inside the  formulaFunctions = { ... }  object in js/formulas.js.',
        'Then fill in baseAtk, saMulti, stackSuper and the formula logic (TODOs).',
        D, '', formulasBlock,
    ].join('\n');

    const outDir  = path.join(__dirname, 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `entry-${event.id}.txt`);
    fs.writeFileSync(outFile, output, 'utf8');

    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║   Done!                                   ║');
    console.log('╚═══════════════════════════════════════════╝');
    console.log(`\nSaved to: ${outFile}`);
    console.log(`\nGenerated: ${stageCount} stage${stageCount > 1 ? 's' : ''}, ${allEnemies.length} formula stub${allEnemies.length !== 1 ? 's' : ''}`);
    console.log('\nNext steps:');
    console.log('  1. Copy DATA.JS block        → paste into js/data.js (inside events: [ ... ])');
    console.log('  2. Copy FORMULAS.JS stubs    → paste into js/formulas.js (inside formulaFunctions)');
    console.log('  3. Fill in baseAtk, saMulti, stackSuper and formula logic (TODOs)');
    console.log('  4. npm run obfuscate\n');

    rl.close();
}

main().catch(err => {
    console.error('\n✗ Fatal error:', err.message);
    rl.close();
    process.exit(1);
});