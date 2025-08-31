// Formula functions for each enemy type
const formulaFunctions = {
    //Supreme Magnificent Battle [Next-Generation Saiyans Edition] Level 1: Vs. Goten (Kid)
    1726001511: function (inputs) {
        const turnCount = (inputs.turn_count !== undefined && inputs.turn_count !== null) ? inputs.turn_count : 1;
        const atkDebuffPassive = (inputs.atk_debuff_passive !== undefined && inputs.atk_debuff_passive !== null) ? inputs.atk_debuff_passive / 100 : 0;
        const atkDebuffSuper = (inputs.atk_debuff_super !== undefined && inputs.atk_debuff_super !== null) ? inputs.atk_debuff_super / 100 : 0;
        const baseAtk = 1350000;
        const saMulti = 2.2;

        const sotPassive = 1 + turnCount * 0.5;
        const normalAtk = baseAtk * sotPassive * (1 - atkDebuffPassive) * (1 - atkDebuffSuper > 0 ? 1 - atkDebuffSuper : 0);
        const superAtk = baseAtk * sotPassive * (1 - atkDebuffPassive) * (saMulti - atkDebuffSuper > 0 ? saMulti - atkDebuffSuper : 0);

        return {
            normal_atk: normalAtk,
            super_atk: superAtk,
        };
    },

    1726001521: function (inputs) {
        const turnCount = (inputs.turn_count !== undefined && inputs.turn_count !== null) ? inputs.turn_count : 1;
        const atkDebuffPassive = (inputs.atk_debuff_passive !== undefined && inputs.atk_debuff_passive !== null) ? inputs.atk_debuff_passive / 100 : 0;
        const atkDebuffSuper = (inputs.atk_debuff_super !== undefined && inputs.atk_debuff_super !== null) ? inputs.atk_debuff_super / 100 : 0;
        const baseAtk = 1410000;
        const saMulti = 2.8;
        const stackSuper = 0.5;

        const sotPassive = 1 + turnCount * 0.9;
        const normalAtk = baseAtk * sotPassive * (1 - atkDebuffPassive) * (1 - atkDebuffSuper > 0 ? 1 - atkDebuffSuper : 0);
        const superAtk = baseAtk * sotPassive * (1 - atkDebuffPassive) * (saMulti + stackSuper - atkDebuffSuper > 0 ? saMulti + stackSuper - atkDebuffSuper : 0);
        const normalAtk2 = baseAtk * sotPassive * (1 - atkDebuffPassive) * (1 + stackSuper - atkDebuffSuper > 0 ? 1 + stackSuper - atkDebuffSuper : 0);

        return {
            normal_atk: normalAtk,
            normal_atk2: normalAtk2,
            super_atk: superAtk,
        };
    },

    //Supreme Magnificent Battle [Next-Generation Saiyans Edition] Level 2: Vs. Trunks (Kid)
    1726002511: function (inputs) {
        const atkDebuffPassive = (inputs.atk_debuff_passive !== undefined && inputs.atk_debuff_passive !== null) ? inputs.atk_debuff_passive / 100 : 0;
        const atkDebuffSuper = (inputs.atk_debuff_super !== undefined && inputs.atk_debuff_super !== null) ? inputs.atk_debuff_super / 100 : 0;
        const baseAtk = 5500000;
        const saMulti = 2.2;

        const normalAtk = baseAtk * (1 - atkDebuffPassive) * (1 - atkDebuffSuper > 0 ? 1 - atkDebuffSuper : 0);
        const superAtk = baseAtk * (1 - atkDebuffPassive) * (saMulti - atkDebuffSuper > 0 ? saMulti - atkDebuffSuper : 0);

        return {
            normal_atk: normalAtk,
            super_atk: superAtk,
        };
    },

    1726002521: function (inputs) {
        const turnCount = (inputs.turn_count !== undefined && inputs.turn_count !== null) ? inputs.turn_count : 1;
        const atkDebuffPassive = (inputs.atk_debuff_passive !== undefined && inputs.atk_debuff_passive !== null) ? inputs.atk_debuff_passive / 100 : 0;
        const atkDebuffSuper = (inputs.atk_debuff_super !== undefined && inputs.atk_debuff_super !== null) ? inputs.atk_debuff_super / 100 : 0;
        const baseAtk = 6000000;
        const saMulti = 2.8;

        const sotPassive = 1 - 0.2 * turnCount;
        const normalAtk = baseAtk * sotPassive * (1 - atkDebuffPassive) * (1 - atkDebuffSuper > 0 ? 1 - atkDebuffSuper : 0);
        const superAtk = baseAtk * sotPassive * (1 - atkDebuffPassive) * (saMulti - atkDebuffSuper > 0 ? saMulti - atkDebuffSuper : 0);

        return {
            normal_atk: normalAtk,
            super_atk: superAtk,
        };
    },

    //Supreme Magnificent Battle [Next-Generation Saiyans Edition] Level 3: Vs. Gohan (Teen)
    1726003511: function (inputs) {
        const numAtksReceived = (inputs.num_atks_received !== undefined && inputs.num_atks_received !== null) ? inputs.num_atks_received : 1;
        const baseAtk = 4000000;
        const saMulti = 2.8;
        const stackSuper = 0.5;

        const sotPassive = 1 - numAtksReceived * 0.05;
        const normalAtk = baseAtk * sotPassive;
        const superAtk = baseAtk * sotPassive * (saMulti + stackSuper);
        const normalAtk2 = baseAtk * sotPassive * (1 + stackSuper);

        return {
            normal_atk: normalAtk,
            normal_atk2: normalAtk2,
            super_atk: superAtk,
        };
    },

    1726003521: function (inputs) {
        const numAtksReceived = (inputs.num_atks_received !== undefined && inputs.num_atks_received !== null) ? inputs.num_atks_received : 1;
        const baseAtk = 600000;
        const saMulti = 2.8;
        const stackSuper = 0.5;

        const sotPassive = 1 + numAtksReceived;
        const normalAtk = baseAtk * sotPassive;
        const superAtk = baseAtk * sotPassive * (saMulti + stackSuper);
        const normalAtk2 = baseAtk * sotPassive * (1 + stackSuper);
        const superAtk2 = baseAtk * sotPassive * (saMulti + stackSuper * 2);
        const normalAtk3 = baseAtk * sotPassive * (1 + stackSuper * 2);

        return {
            normal_atk: normalAtk,
            normal_atk2: normalAtk2,
            normal_atk3: normalAtk3,
            super_atk: superAtk,
            super_atk2: superAtk2,
        };
    },

    //Supreme Magnificent Battle [Next-Generation Saiyans Edition] Level 4: Vs. Gohan & Goten & Trunks Part 1
    1726004511: function (inputs) {
        const atkDebuffPassive = (inputs.atk_debuff_passive !== undefined && inputs.atk_debuff_passive !== null) ? inputs.atk_debuff_passive / 100 : 0;
        const atkDebuffSuper = (inputs.atk_debuff_super !== undefined && inputs.atk_debuff_super !== null) ? inputs.atk_debuff_super / 100 : 0;
        const baseAtk = 2120000;
        const saMulti = 3.5;

        const normalAtk = baseAtk * (1 - atkDebuffPassive) * (1 - atkDebuffSuper > 0 ? 1 - atkDebuffSuper : 0);
        const superAtk = baseAtk * (1 - atkDebuffPassive) * (saMulti - atkDebuffSuper > 0 ? saMulti - atkDebuffSuper : 0);

        return {
            normal_atk: normalAtk,
            super_atk: superAtk,
        };
    },

    //Supreme Magnificent Battle [Next-Generation Saiyans Edition] Level 5: Vs. Gohan & Goten & Trunks Part 2
    1726005511: function (inputs) {
        const turnCount = (inputs.turn_count !== undefined && inputs.turn_count !== null) ? inputs.turn_count : 1;
        const baseAtk = 300000;
        const saMulti = 3;

        const sotPassive = turnCount < 4 ? 1 : 1 + (turnCount - 3) * 2;
        const normalAtk = baseAtk * sotPassive;
        const superAtk = baseAtk * sotPassive * saMulti * 1.5;

        return {
            normal_atk: normalAtk,
            super_atk: superAtk,
        };
    },

    1726005512: function (inputs) {
        const turnCount = (inputs.turn_count !== undefined && inputs.turn_count !== null) ? inputs.turn_count : 1;
        const baseAtk = 1100000;
        const saMulti = 3;
        const stackSuper = 0.3;

        const sotPassive = turnCount < 2 ? 1 : turnCount;
        const normalAtk = baseAtk * sotPassive;
        const superAtk = baseAtk * sotPassive * (saMulti + stackSuper);
        const normalAtk2 = baseAtk * sotPassive * (1 + stackSuper);
        const aoeAtk2 = normalAtk2 * 0.5;
        const superAtk2 = baseAtk * sotPassive * (saMulti + stackSuper * 2);
        const normalAtk3 = baseAtk * sotPassive * (1 + stackSuper * 2);
        const aoeAtk3 = normalAtk3 * 0.5;
        const superAtk3 = baseAtk * sotPassive * (saMulti + stackSuper * 3);
        const normalAtk4 = baseAtk * sotPassive * (1 + stackSuper * 3);
        const aoeAtk4 = normalAtk4 * 0.5;

        return {
            normal_atk: normalAtk,
            normal_atk2: normalAtk2,
            normal_atk3: normalAtk3,
            normal_atk4: normalAtk4,
            aoe_atk2: aoeAtk2,
            aoe_atk3: aoeAtk3,
            aoe_atk4: aoeAtk4,
            super_atk: superAtk,
            super_atk2: superAtk2,
            super_atk3: superAtk3,
        };
    },

    //Special Battle 2025 Level 1: Stage 1
    1722001511: function (inputs) {
        const numAtksReceived = (inputs.num_atks_received !== undefined && inputs.num_atks_received !== null) ? inputs.num_atks_received : 1;
        const atkDebuffPassive = (inputs.atk_debuff_passive !== undefined && inputs.atk_debuff_passive !== null) ? inputs.atk_debuff_passive / 100 : 0;
        const atkDebuffSuper = (inputs.atk_debuff_super !== undefined && inputs.atk_debuff_super !== null) ? inputs.atk_debuff_super / 100 : 0;
        const zamasu = inputs.zamasu || false;
        const baseAtk = 1250000;
        const saMulti = 3;
        const stackSuper = 0.5;

        const sotPassive = zamasu ? 1.5 : 1;
        const onAtkPassive = 1 + 0.3 * numAtksReceived;
        const normalAtk = baseAtk * sotPassive * (1 - atkDebuffPassive) * onAtkPassive * (1 - atkDebuffSuper > 0 ? 1 - atkDebuffSuper : 0);
        const aoeAtk = normalAtk * 0.5;
        const superAtk = baseAtk * sotPassive * (1 - atkDebuffPassive) * onAtkPassive * (saMulti + stackSuper - atkDebuffSuper > 0 ? saMulti + stackSuper - atkDebuffSuper : 0);
        const normalAtk2 = baseAtk * sotPassive * (1 - atkDebuffPassive) * onAtkPassive * (1 + stackSuper - atkDebuffSuper > 0 ? 1 + stackSuper - atkDebuffSuper : 0);
        const aoeAtk2 = normalAtk2 * 0.5;

        return {
            normal_atk: normalAtk,
            normal_atk2: normalAtk2,
            aoe_atk: aoeAtk,
            aoe_atk2: aoeAtk2,
            super_atk: superAtk,
        };
    },

    //Special Battle 2025 Level 2: Stage 2
    1722002511: function (inputs) {
        const turnCount = (inputs.turn_count !== undefined && inputs.turn_count !== null) ? inputs.turn_count : 1;
        const vegeta = inputs.vegeta || false;
        const baseAtk = 800000;
        const saMulti = 3.5;
        const stackSuper = 0.5;

        const sotPassive = (vegeta ? 1.5 : 1) + (turnCount < 3 ? 0 : 1.6);
        const normalAtk = baseAtk * sotPassive;
        const superAtk = baseAtk * sotPassive * (saMulti + stackSuper);
        const normalAtk2 = baseAtk * sotPassive * (1 + stackSuper);
        const superAtk2 = baseAtk * sotPassive * (saMulti + stackSuper * 2);
        const normalAtk3 = baseAtk * sotPassive * (1 + stackSuper * 2);

        return {
            normal_atk: normalAtk,
            normal_atk2: normalAtk2,
            normal_atk3: normalAtk3,
            super_atk: superAtk,
            super_atk2: superAtk2,
        };
    },

    //Special Battle 2025 Level 3: Stage 3
    1722003511: function (inputs) {
        const territorySkill = inputs.territory_skill || false;
        const baseAtk = 800000;
        const saMulti = 3;
        const stackSuper = 0.5;

        const sotPassive = territorySkill ? 2 : 1;
        const normalAtk = baseAtk * sotPassive;
        const superAtk = baseAtk * sotPassive * (saMulti + stackSuper);
        const aoeAtk = normalAtk * 0.5;
        const normalAtk2 = baseAtk * sotPassive * (1 + stackSuper);
        const aoeAtk2 = normalAtk2 * 0.5;

        return {
            normal_atk: normalAtk,
            normal_atk2: normalAtk2,
            aoe_atk: aoeAtk,
            aoe_atk2: aoeAtk2,
            super_atk: superAtk,
        };
    },

    //Special Battle 2025 Level 4: Stage 4
    1722004511: function (inputs) {
        const turnCount = (inputs.turn_count !== undefined && inputs.turn_count !== null) ? inputs.turn_count : 1;
        const baseAtk = 900000;
        const saMulti = 3;
        const stackSuper = 1;

        const sotPassive = 1 + turnCount * 0.4;
        const normalAtk = baseAtk * sotPassive;
        const superAtk = baseAtk * sotPassive * (saMulti + stackSuper);
        const normalAtk2 = baseAtk * sotPassive * (1 + stackSuper);
        const superAtk2 = baseAtk * sotPassive * (saMulti + stackSuper * 2);
        const normalAtk3 = baseAtk * sotPassive * (1 + stackSuper * 2);

        return {
            normal_atk: normalAtk,
            normal_atk2: normalAtk2,
            normal_atk3: normalAtk3,
            super_atk: superAtk,
            super_atk2: superAtk2,
        };
    },

    //Dokkan Ultimate Players' Choice Battle Level 3: Dokkan Ultimate Players' Choice Battle
    1725003521: function (inputs) {
        const turnCount = (inputs.turn_count !== undefined && inputs.turn_count !== null) ? inputs.turn_count : 1;
        const baseAtk = 800000;
        const saMulti = 2.8;

        const sotPassive = 1 + turnCount * 0.4;
        const normalAtk = baseAtk * sotPassive;
        const superAtk = baseAtk * sotPassive * saMulti;

        return {
            normal_atk: normalAtk,
            super_atk: superAtk,
        };
    },

    1725003531: function (inputs) {
        const numAtksReceived = (inputs.num_atks_received !== undefined && inputs.num_atks_received !== null) ? inputs.num_atks_received : 1;
        const baseAtk = 1200000;
        const saMulti = 2.8;

        const sotPassive = 1 + numAtksReceived * 0.3;
        const normalAtk = baseAtk * sotPassive;
        const superAtk = baseAtk * sotPassive * saMulti;

        return {
            normal_atk: normalAtk,
            super_atk: superAtk,
        };
    },

    1725003541: function (inputs) {
        const turnCount = (inputs.turn_count !== undefined && inputs.turn_count !== null) ? inputs.turn_count : 1;
        const baseAtk = 1400000;
        const saMulti = 3.5;
        const stackSuper = 0.5;

        const sotPassive = turnCount < 3 ? 1 : 2;
        const normalAtk = baseAtk * sotPassive;
        const superAtk = baseAtk * sotPassive * (saMulti + stackSuper);
        const normalAtk2 = baseAtk * sotPassive * (1 + stackSuper);

        return {
            normal_atk: normalAtk,
            normal_atk2: normalAtk2,
            super_atk: superAtk,
        };
    },

    //Ultimate Red Zone [Pure Saiyans Edition] Level 2: Vs. Nappa & Vegeta
    1729002511: function (inputs) {
        const turnCount = (inputs.turn_count !== undefined && inputs.turn_count !== null) ? inputs.turn_count : 1;
        const baseAtk = 820000;
        const saMulti = 2.8;
        const stackSuper = 0.3;

        const sotPassive = turnCount < 5 ? 1 : 3;
        const normalAtk = baseAtk * sotPassive;
        const superAtk = baseAtk * sotPassive * (saMulti + stackSuper);
        const normalAtk2 = baseAtk * sotPassive * (1 + stackSuper);

        return {
            normal_atk: normalAtk,
            normal_atk2: normalAtk2,
            super_atk: superAtk,
        };
    },

    1729002521: function (inputs) {
        const numAtksReceived = (inputs.num_atks_received !== undefined && inputs.num_atks_received !== null) ? inputs.num_atks_received : 1;
        const baseAtk = 850000;
        const saMulti = 3;

        const sotPassive = 1 + 0.3 * numAtksReceived;
        const normalAtk = baseAtk * sotPassive;
        const superAtk = baseAtk * sotPassive * saMulti;

        return {
            normal_atk: normalAtk,
            super_atk: superAtk,
        };
    },

    1729002531: function (inputs) {
        const turnCount = (inputs.turn_count !== undefined && inputs.turn_count !== null) ? inputs.turn_count : 1;
        const atkDebuffPassive = (inputs.atk_debuff_passive !== undefined && inputs.atk_debuff_passive !== null) ? inputs.atk_debuff_passive / 100 : 0;
        const atkDebuffSuper = (inputs.atk_debuff_super !== undefined && inputs.atk_debuff_super !== null) ? inputs.atk_debuff_super / 100 : 0;
        const baseAtk = 1200000;
        const saMulti = 3.5;

        const sotPassive = 1 + 0.5 * turnCount;
        const normalAtk = baseAtk * sotPassive * (1 - atkDebuffPassive) * (1 - atkDebuffSuper > 0 ? 1 - atkDebuffSuper : 0);;
        const superAtk = baseAtk * sotPassive * (1 - atkDebuffPassive) * (saMulti - atkDebuffSuper > 0 ? saMulti - atkDebuffSuper : 0);

        return {
            normal_atk: normalAtk,
            super_atk: superAtk,
        };
    },
};

// Function to calculate ATK based on enemy ID and inputs
function calculateEnemyATK(enemyId, inputs) {
    if (formulaFunctions[enemyId]) {
        return formulaFunctions[enemyId](inputs);
    }
    return {}; // Return empty object if formula not found
}