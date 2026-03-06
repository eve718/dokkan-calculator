#!/usr/bin/env node
/**
 * Dokkan Calculator – New Entry Wizard
 *
 * Interactively collects data for a new event/stage and generates:
 *   - A ready-to-paste data.js entry block
 *   - A ready-to-fill formula stub for formulas.js
 *
 * Output is saved to scripts/output/entry-<eventId>-stage<N>.txt
 *
 * Usage:
 *   npm run new-entry
 */

const readline = require('readline');
const path     = require('path');
const fs       = require('fs');

// ─── readline helpers ─────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question, defaultVal) {
    return new Promise(resolve => {
        const suffix = defaultVal !== undefined ? ` [${defaultVal}]` : '';
        rl.question(`${question}${suffix}: `, ans => {
            const t = ans.trim();
            resolve(t !== '' ? t : (defaultVal !== undefined ? String(defaultVal) : ''));
        });
    });
}

async function askInt(question, defaultVal, min, max) {
    while (true) {
        const raw = await ask(question, defaultVal);
        const n = parseInt(raw, 10);
        const okMin = min === undefined || n >= min;
        const okMax = max === undefined || n <= max;
        if (!isNaN(n) && okMin && okMax) return n;
        const range = [min !== undefined ? `>= ${min}` : '', max !== undefined ? `<= ${max}` : ''].filter(Boolean).join(' and ');
        console.log(`  ⚠  Please enter a whole number${range ? ' ' + range : ''}.`);
    }
}

async function pickOne(title, options) {
    console.log(`\n  ${title}`);
    options.forEach((o, i) => console.log(`    ${i + 1}. ${o.label}`));
    while (true) {
        const raw = await ask('  Choice');
        const n = parseInt(raw, 10);
        if (!isNaN(n) && n >= 1 && n <= options.length) return options[n - 1];
        console.log('  ⚠  Invalid — enter a number from the list.');
    }
}

async function pickMany(title, options) {
    console.log(`\n  ${title}`);
    console.log('  (Enter numbers separated by spaces, e.g. "1 3 5")');
    options.forEach((o, i) => console.log(`    ${i + 1}. ${o.label}`));
    while (true) {
        const raw = await ask('  Choices');
        const nums = raw.split(/\s+/).map(s => parseInt(s, 10)).filter(n => !isNaN(n));
        if (nums.length > 0 && nums.every(n => n >= 1 && n <= options.length)) {
            return nums.map(n => options[n - 1]);
        }
        console.log('  ⚠  Invalid — enter space-separated numbers from the list.');
    }
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
        label: 'Custom checkbox input',
        build: async () => {
            const id    = await ask('  Input ID (underscores, no spaces)');
            const label = await ask('  Label text');
            const def   = (await ask('  Default checked?', 'true')) === 'true';
            return { id, label, type: 'checkbox', default: def };
        }
    },
];

const OUTPUT_OPTIONS = [
    { label: 'Normal ATK',                 id: 'normal_atk',  defaultLabel: 'Normal ATK' },
    { label: 'Normal ATK after supering',  id: 'normal_atk2', defaultLabel: 'Normal ATK after supering' },
    { label: 'AOE ATK 2+',                 id: 'aoe_atk',     defaultLabel: 'AOE ATK 2+' },
    { label: 'AOE ATK 2+ after supering',  id: 'aoe_atk2',    defaultLabel: 'AOE ATK 2+ after supering' },
    { label: 'Super ATK',                  id: 'super_atk',   defaultLabel: 'Super ATK' },
    { label: 'Super ATK (custom label)',   id: 'super_atk',   customLabel: true },
];

// ─── ID helpers ───────────────────────────────────────────────────────────────

const stageId  = (eventId, n) => `${eventId}00${n}5`;
const phaseId  = (sId, n)     => `${sId}${n}`;
const enemyId  = (phId, n)    => `${phId}${n}`;

// ─── code generators ─────────────────────────────────────────────────────────

function indentBlock(str, spaces) {
    const pad = ' '.repeat(spaces);
    return str.split('\n').map(l => pad + l).join('\n');
}

function fmtInput(inp) {
    if (inp.type === 'checkbox') {
        return `{ id: "${inp.id}", label: "${inp.label}", type: "checkbox", default: ${inp.default} }`;
    }
    return `{ id: "${inp.id}", label: "${inp.label}", type: "number", min: ${inp.min}, max: ${inp.max}, default: ${inp.default} }`;
}

function fmtOutput(out) {
    return `{ id: "${out.id}", label: "${out.label}" }`;
}

function generateEnemyBlock(enemy, indent) {
    const p = n => ' '.repeat(n);
    const baseIndent = indent;
    const propIndent = indent + 4;
    const listIndent = indent + 8;

    const inputLines = enemy.inputs.length
        ? '\n' + enemy.inputs.map(i => `${p(listIndent)}${fmtInput(i)}`).join(',\n') + `\n${p(propIndent)}`
        : '';

    const outputLines = enemy.outputs.length
        ? '\n' + enemy.outputs.map(o => `${p(listIndent)}${fmtOutput(o)}`).join(',\n') + `\n${p(propIndent)}`
        : '';

    return [
        `${p(baseIndent)}{`,
        `${p(propIndent)}id: "${enemy.id}",`,
        `${p(propIndent)}name: "${enemy.name}",`,
        `${p(propIndent)}image: "images/enemies/${enemy.imageFile}",`,
        `${p(propIndent)}typeIcon: 'images/types/${enemy.typeIcon}.jpg',`,
        `${p(propIndent)}rarityIcon: 'images/rarity/${enemy.rarity}.jpg',`,
        `${p(propIndent)}background: 'images/bgs/${enemy.bg}.jpg',`,
        `${p(propIndent)}inputs: [${inputLines}],`,
        `${p(propIndent)}formula: "${enemy.id}",`,
        `${p(propIndent)}outputs: [${outputLines}],`,
        `${p(baseIndent)}}`,
    ].join('\n');
}

function generateDataSnippet(event, stage, phases) {
    const p = n => ' '.repeat(n);

    const phasesBlock = phases.map(ph => {
        const enemiesBlock = ph.enemies.map(e => generateEnemyBlock(e, 48)).join(',\n');
        return [
            `${p(32)}{`,
            `${p(36)}id: "${ph.id}",`,
            `${p(36)}name: "${ph.name}",`,
            `${p(36)}enemies: [`,
            enemiesBlock,
            `${p(36)}],`,
            `${p(32)}}`,
        ].join('\n');
    }).join(',\n');

    return [
        `        // ─── Paste inside the events: [ ... ] array ───`,
        `        {`,
        `            id: "${event.id}",`,
        `            name: "${event.name}",`,
        `            image: "${event.image}",`,
        `            stages: [`,
        `                {`,
        `                    id: "${stage.id}",`,
        `                    name: "${stage.name}",`,
        `                    battles: [`,
        `                        {`,
        `                            id: "${stage.id}",`,
        `                            name: "${stage.name}",`,
        `                            phases: [`,
        phasesBlock,
        `                            ]`,
        `                        }`,
        `                    ]`,
        `                },`,
        `            ]`,
        `        },`,
    ].join('\n');
}

function generateFormulaStub(enemy, eventName, stageName) {
    const varLines = enemy.inputs.map(inp => {
        if (inp.type === 'checkbox') {
            return `        const ${inp.id} = inputs.${inp.id} !== undefined ? inputs.${inp.id} : ${inp.default};`;
        }
        return `        const ${inp.id} = (inputs.${inp.id} !== undefined && inputs.${inp.id} !== null) ? inputs.${inp.id} : ${inp.default};`;
    });

    const returnLines = enemy.outputs.map(o => `            ${o.id}: 0, // TODO`);

    const lines = [
        `    // ${eventName} – ${stageName} – ${enemy.name}`,
        `    ${enemy.id}: function (inputs) {`,
    ];

    if (varLines.length) {
        lines.push(...varLines);
        lines.push('');
    }

    lines.push(
        `        const baseAtk = 0; // TODO: set base ATK`,
        ``,
        `        return {`,
        ...returnLines,
        `        };`,
        `    },`,
    );

    return lines.join('\n');
}

// ─── collection helpers ───────────────────────────────────────────────────────

async function collectInputs() {
    const inputs = [];
    console.log('\n  ── Inputs ──');

    while (true) {
        console.log('\n  Add input:');
        const menuOptions = [...INPUT_PRESETS, { label: '(done – no more inputs)' }];
        menuOptions.forEach((o, i) => console.log(`    ${i + 1}. ${o.label}`));

        const raw = await ask('  Choice');
        const n = parseInt(raw, 10);

        if (isNaN(n) || n === menuOptions.length) break;
        if (n < 1 || n > menuOptions.length - 1) { console.log('  ⚠  Invalid.'); continue; }

        const inp = await INPUT_PRESETS[n - 1].build();
        inputs.push(inp);
        console.log(`  ✓ Added: ${inp.id}`);
    }

    return inputs;
}

async function collectOutputs() {
    console.log('\n  ── Outputs ──');
    const selected = await pickMany('Select outputs (all that apply):', OUTPUT_OPTIONS);

    const results = [];
    for (const opt of selected) {
        if (opt.customLabel) {
            const label = await ask('  Super ATK label (e.g. "Super ATK (ignores 70% DEF)")', 'Super ATK');
            results.push({ id: opt.id, label });
        } else {
            results.push({ id: opt.id, label: opt.defaultLabel });
        }
    }
    return results;
}

async function collectEnemy(phId, n, totalInPhase) {
    console.log(`\n  ── Enemy ${n}${totalInPhase > 1 ? ` of ${totalInPhase}` : ''} ──`);
    const name      = await ask('  Enemy name');
    const imageFile = await ask('  Image filename (e.g. card_1234567_thumb.jpg)');
    const type      = await pickOne('Type:', TYPES);
    const rarity    = await pickOne('Rarity:', RARITIES);
    const inputs    = await collectInputs();
    const outputs   = await collectOutputs();

    return {
        id: enemyId(phId, n),
        name,
        imageFile,
        typeIcon: type.typeIcon,
        bg:       type.bg,
        rarity:   rarity.value,
        inputs,
        outputs,
    };
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n╔═════════════════════════════════════════╗');
    console.log('║   Dokkan Battle – New Entry Wizard      ║');
    console.log('╚═════════════════════════════════════════╝');
    console.log('\nLeave a field blank to accept the [default].\n');

    // ── Event ──
    console.log('── Event ──────────────────────────────────');
    const eventId   = await ask('Event ID (4 digits, e.g. 1730)');
    const eventName = await ask('Event name');
    const event     = { id: eventId, name: eventName, image: `images/events/${eventId}.jpg` };

    // ── Stage ──
    console.log('\n── Stage ──────────────────────────────────');
    const stageNum  = await askInt('Stage number (1 for first, 2 for second…)', 1, 1);
    const stageName = await ask('Stage name');
    const sId       = stageId(eventId, stageNum);
    const stage     = { id: sId, name: stageName };

    // ── Phases ──
    console.log('\n── Phases ─────────────────────────────────');
    const numPhases = await askInt('Number of phases in this stage', 1, 1);

    const phases    = [];
    const allEnemies = [];

    for (let p = 1; p <= numPhases; p++) {
        console.log(`\n── Phase ${p} ${'─'.repeat(35 - String(p).length)}`);
        const phaseName = numPhases === 1 ? 'Phase 1' : await ask(`Phase ${p} name`, `Phase ${p}`);
        const phId      = phaseId(sId, p);
        const numEnemies = await askInt('Number of enemies in this phase', 1, 1);

        const enemies = [];
        for (let e = 1; e <= numEnemies; e++) {
            const enemy = await collectEnemy(phId, e, numEnemies);
            enemies.push(enemy);
            allEnemies.push({ ...enemy, phaseName, stageName });
        }
        phases.push({ id: phId, name: phaseName, enemies });
    }

    // ── Generate output ──
    console.log('\n\nGenerating snippets…');

    const dataBlock    = generateDataSnippet(event, stage, phases);
    const formulaBlock = allEnemies.map(e => generateFormulaStub(e, eventName, e.stageName)).join('\n\n');

    const divider = '='.repeat(64);
    const output = [
        divider,
        'DATA.JS ENTRY',
        'Paste inside the  events: [ ... ]  array in js/data.js.',
        divider,
        '',
        dataBlock,
        '',
        divider,
        'FORMULAS.JS STUBS',
        'Paste inside the  formulaFunctions = { ... }  object in js/formulas.js.',
        'Then fill in the TODOs.',
        divider,
        '',
        formulaBlock,
    ].join('\n');

    // Write to file
    const outDir  = path.join(__dirname, 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `entry-${eventId}-stage${stageNum}.txt`);
    fs.writeFileSync(outFile, output, 'utf8');

    console.log('\n╔═════════════════════════════════════════╗');
    console.log('║   Done!                                 ║');
    console.log('╚═════════════════════════════════════════╝');
    console.log('\nSnippets saved to:');
    console.log(`  ${outFile}`);
    console.log('\nNext steps:');
    console.log('  1. Open the file above and copy the DATA.JS block');
    console.log('     → paste into js/data.js (inside events: [ ... ])');
    console.log('  2. Copy the FORMULAS.JS block');
    console.log('     → paste into js/formulas.js (inside formulaFunctions)');
    console.log('  3. Fill in baseAtk and the formula logic (TODOs)');
    console.log('  4. Run:  npm run obfuscate\n');

    rl.close();
}

main().catch(err => {
    console.error('\n✗ Fatal error:', err.message);
    rl.close();
    process.exit(1);
});
