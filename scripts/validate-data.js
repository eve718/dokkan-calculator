const fs = require('fs');
const vm = require('vm');

const context = { console };
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/data.js', 'utf8') + '\nthis.gameData = gameData;', context, { filename: 'js/data.js' });
vm.runInContext(fs.readFileSync('js/formulas.js', 'utf8') + '\nthis.formulaFunctions = formulaFunctions;', context, { filename: 'js/formulas.js' });

const enemies = [];
const enemyIds = new Set();
const duplicateIds = [];

for (const event of context.gameData.events || []) {
    for (const stage of event.stages || []) {
        const battles = stage.battles && stage.battles.length
            ? stage.battles
            : [{ phases: stage.phases || [] }];
        for (const battle of battles) {
            for (const phase of battle.phases || []) {
                for (const enemy of phase.enemies || []) {
                    const id = String(enemy.id);
                    if (enemyIds.has(id)) duplicateIds.push(id);
                    enemyIds.add(id);
                    enemies.push(enemy);
                }
            }
        }
    }
}

const failures = [];
for (const enemy of enemies) {
    const formula = context.formulaFunctions[enemy.formula];
    if (typeof formula !== 'function') {
        failures.push(`${enemy.id}: missing formula ${enemy.formula}`);
        continue;
    }

    const inputs = {};
    for (const input of enemy.inputs || []) inputs[input.id] = input.default ?? 0;

    let results;
    try {
        results = formula(inputs) || {};
    } catch (error) {
        failures.push(`${enemy.id}: ${error.message}`);
        continue;
    }

    const declaredOutputs = new Set((enemy.outputs || []).map(output => output.id));
    for (const outputId of Object.keys(results)) {
        if (outputId !== '_labels' && !declaredOutputs.has(outputId)) {
            failures.push(`${enemy.id}: undeclared output ${outputId}`);
        }
    }
}

if (duplicateIds.length) failures.push(`duplicate enemy IDs: ${duplicateIds.join(', ')}`);
if (failures.length) {
    console.error(failures.map(failure => `FAIL: ${failure}`).join('\n'));
    process.exit(1);
}

console.log(`PASS: validated ${enemies.length} enemies and their formula/output contracts`);
