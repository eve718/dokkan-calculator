/**
 * Damage Taken Calculation Formulas
 *
 * Each formula receives:
 *   characterInputs  – { char_defense, char_stacked_def, char_damage_reduction,
 *                         char_type, char_class, char_type_def_boost, char_passive_guard }
 *   enemyAttackResults – { normal_atk, super_atk, … }  (from formulas.js)
 *   enemyProperties  – { enemy_type, enemy_class,
 *                         [atkKey]_def_ignore, [atkKey]_def_lower }
 *
 * Returns damage keys derived from ATK keys:  normal_atk → normal_damage, etc.
 *
 * Type cycle (each type is strong against the next):
 *   STR → PHY → INT → TEQ → AGL → STR
 *
 * Relationship logic (from enemy's perspective):
 *   enemy type BEATS char type  → type advantage
 *   char type BEATS enemy type  → type disadvantage
 *   otherwise                   → neutral
 *
 * Class: 'Super' or 'Extreme'. Opposite class = different; same class = same.
 *
 * ─── Type multipliers (normal / crit attacks) ────────────────────────────────
 *
 * NORMAL ATTACKS:
 *   - advantage,  opposite class : 1.50
 *   - advantage,  same class     : 1.25
 *   - neutral,    opposite class : 1.15
 *   - neutral,    same class     : 1.00
 *   - disadvantage, opposite cls : 1.00
 *   - disadvantage, same class   : 0.90
 *
 * CRIT ATTACKS (def-ignoring):
 *   - advantage or neutral        : 1.00
 *   - disadvantage, opposite cls  : 1.00 − typeDefBoostLv × 0.01
 *   - disadvantage, same class    : 0.90 − typeDefBoostLv × 0.01
 *   Note: no ×0.5 at the end for crits.
 *
 * PASSIVE GUARD:
 *   Replaces the type multiplier with 0.80 for all attacks.
 *   Final result is halved (×0.5).
 *   If enemy is type disadvantage: effective multiplier = 0.80 − typeDefBoostLv × 0.01
 *   (still ×0.5 at the end, even for crits against guard chars)
 *
 * ─── DEF mechanics ───────────────────────────────────────────────────────────
 *
 * Base defense formula (for enemies with a def-lowering attack):
 *   effectiveDEF = baseDEF / (1 + stackedDefPct/100) * (1 + stackedDefPct/100 − defLowerPct/100)
 * Otherwise, effectiveDEF = baseDEF.
 * (stackedDefPct is only relevant when the enemy has DEF-lowering mechanics.)
 *
 * ─── Final damage formulas ───────────────────────────────────────────────────
 *
 * Normal attack (no crit / no guard):
 *   damage = enemyATK × typeMulti × (1 − dmgReductionPct/100) − effectiveDEF
 *
 * Type-disadvantage normal attack (no crit / no guard):
 *   damage = (enemyATK × (typeMulti − typeDefBoostLv × 0.01) × (1 − dmgReductionPct/100) − effectiveDEF) × 0.5
 *
 * Crit attack:
 *   damage = enemyATK × typeMulti × (1 − dmgReductionPct/100) − effectiveDEF × (1 − defIgnorePct/100)
 *   (typeMulti absorbs disadvantage penalty; no ×0.5)
 *
 * Passive-guard (any attack):
 *   damage = (enemyATK × guardMulti × (1 − dmgReductionPct/100) − effectiveDEF) × 0.5
 *   where guardMulti = 0.80, or 0.80 − typeDefBoostLv × 0.01 if type disadvantage.
 *   For crit attacks: effectiveDEF is reduced by defIgnorePct as above.
 *   Guard still halves at the end even for crits.
 *
 * All results floored at 1.
 */

// ─── Type helpers ─────────────────────────────────────────────────────────────

const TYPE_CYCLE = { STR: 'PHY', PHY: 'INT', INT: 'TEQ', TEQ: 'AGL', AGL: 'STR' };

/**
 * Returns 'advantage' | 'neutral' | 'disadvantage' from the enemy's perspective.
 */
function getTypeRelation(enemyType, charType) {
    if (!enemyType || !charType) return 'neutral';
    if (TYPE_CYCLE[enemyType] === charType) return 'advantage';
    if (TYPE_CYCLE[charType] === enemyType) return 'disadvantage';
    return 'neutral';
}

/**
 * Whether enemy and character are in the same class ('Super'/'Extreme').
 */
function isSameClass(enemyClass, charClass) {
    return (enemyClass || 'Super').toLowerCase() === (charClass || 'Super').toLowerCase();
}

// ─── Core formula ─────────────────────────────────────────────────────────────

const createDefaultDamageFormula = () => function (data) {
    const { characterInputs, enemyAttackResults, enemyProperties } = data;

    const baseDEF = characterInputs.char_defense || 0;
    const stackedDefPct = characterInputs.char_stacked_def || 0;   // % (0–100)
    const dmgReductionPct = characterInputs.char_damage_reduction || 0;   // % (0–100)
    const typeDefBoostLv = characterInputs.char_type_def_boost || 0;   // level (integer)
    const passiveGuard = characterInputs.char_passive_guard || false;
    const charType = (characterInputs.char_type || 'STR').toUpperCase();
    const charClass = (characterInputs.char_class || 'Super');

    const enemyType = (enemyProperties.enemy_type || null);
    const enemyClass = (enemyProperties.enemy_class || 'Super');

    const relation = getTypeRelation(enemyType, charType);
    const sameClass = isSameClass(enemyClass, charClass);
    const dmgMult = 1 - dmgReductionPct / 100;

    const result = {};

    for (const [atkKey, atkValue] of Object.entries(enemyAttackResults)) {
        if (typeof atkValue !== 'number' || atkValue <= 0) continue;

        const damageKey = atkKey.replace(/_atk\d*$/, (m) => m.replace('_atk', '_damage'));
        const defIgnorePct = enemyProperties[atkKey + '_def_ignore'] || 0;   // % (0–100)
        const defLowerPct = enemyProperties[atkKey + '_def_lower'] || 0;   // % (0–100)
        const isCrit = defIgnorePct > 0;

        // — Effective DEF —
        // totalDEF = base boosted by any stacking (0% stacking → just baseDEF).
        // DEF-lowering reduces totalDEF by defLowerPct % even when stacked DEF is 0.
        const effectiveDEF = baseDEF / (1 + stackedDefPct / 100) * (1 + stackedDefPct/100 - defLowerPct / 100);

        // Apply ±variance: ATK ranges from base×1.0 to base×1.03
        const atkMin = atkValue;
        const atkMax = atkValue * 1.03;

        // Compute raw damage for a given atk value
        const computeDamage = (atk) => {
            let dmg;
            if (passiveGuard) {
                let guardMulti = 0.80;
                if (relation === 'disadvantage') guardMulti -= typeDefBoostLv * 0.01;
                const defForGuard = isCrit ? effectiveDEF * (1 - defIgnorePct / 100) : effectiveDEF;
                dmg = (atk * guardMulti * dmgMult - defForGuard) * 0.5;
            } else if (isCrit) {
                let typeMulti;
                if (relation === 'disadvantage') {
                    typeMulti = sameClass ? 0.90 - typeDefBoostLv * 0.01 : 1.00 - typeDefBoostLv * 0.01;
                } else {
                    typeMulti = 1.00;
                }
                const defAfterIgnore = effectiveDEF * (1 - defIgnorePct / 100);
                dmg = atk * typeMulti * dmgMult - defAfterIgnore;
            } else if (relation === 'disadvantage') {
                const typeMulti = sameClass ? 0.90 : 1.00;
                dmg = (atk * (typeMulti - typeDefBoostLv * 0.01) * dmgMult - effectiveDEF) * 0.5;
            } else {
                let typeMulti;
                if (relation === 'advantage') {
                    typeMulti = sameClass ? 1.25 : 1.50;
                } else {
                    typeMulti = sameClass ? 1.00 : 1.15;
                }
                dmg = atk * typeMulti * dmgMult - effectiveDEF;
            }
            return dmg;
        };

        const rawMin = computeDamage(atkMin);
        const rawMax = computeDamage(atkMax);

        // Values ≤ 0 map to DD (random 1–255)
        const finalMin = rawMin <= 0 ? 'DD' : Math.round(rawMin);
        const finalMax = rawMax <= 0 ? 'DD' : Math.round(rawMax);

        result[damageKey] = { min: finalMin, max: finalMax };
    }

    return result;
};

// Registry – add enemy-specific overrides here when needed.
const damageTakenFunctions = {};

/**
 * Returns the damage formula for the given formula ID,
 * falling back to the default formula if none is registered.
 * @param {string} formulaId
 * @returns {Function}
 */
const getDamageTakenFormulaById = (formulaId) =>
    damageTakenFunctions[formulaId] || createDefaultDamageFormula();

