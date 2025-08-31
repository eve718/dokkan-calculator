// Data structure for events, stages, and enemies
const gameData = {
    events: [
        {
            id: "1722",
            name: "Special Battle 2025",
            image: "images/events/1722.jpg",
            stages: [
                {
                    id: "17220015",
                    name: "Level 1: Stage 1",
                    phases: [
                        {
                            id: "172200151",
                            name: "Phase 1",
                            enemies: [
                                {
                                    id: "1722001511",
                                    name: "Goku Black (Super Saiyan Rosé) + Zamasu",
                                    image: "images/enemies/card_1031430_thumb.jpg",
                                    inputs: [
                                        { id: "num_atks_received", label: "Total ATKs received", type: "number", min: 0, max: 10, default: 0 },
                                        { id: "atk_debuff_passive", label: "ATK debuff from passives (%)", type: "number", min: 0, max: 100, default: 0 },
                                        { id: "atk_debuff_super", label: "ATK debuff from supers (%)", type: "number", min: 0, max: 9999, default: 0 },
                                        { id: "zamasu", label: "Is Zamasu alive at the start of turn?", type: "checkbox", default: true },
                                    ],
                                    formula: "1722001511",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "normal_atk2", label: "Normal ATK after one super" },
                                        { id: "aoe_atk", label: "AOE ATK 2+" },
                                        { id: "aoe_atk2", label: "AOE ATK 2+ after one super" },
                                        { id: "super_atk", label: "Super ATK" },
                                    ]
                                },
                            ],
                        },
                    ]
                },
                {
                    id: "17220025",
                    name: "Level 2: Stage 2",
                    phases: [
                        {
                            id: "172200251",
                            name: "Phase 1",
                            enemies: [
                                {
                                    id: "1722002511",
                                    name: "Super Saiyan God SS Goku + Super Saiyan God SS Vegeta",
                                    image: "images/enemies/card_1031390_thumb.jpg",
                                    inputs: [
                                        { id: "turn_count", label: "Current turn", type: "number", min: 1, max: 3, default: 1 },
                                        { id: "vegeta", label: "Is Vegeta alive at the start of turn?", type: "checkbox", default: true },
                                    ],
                                    formula: "1722002511",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "normal_atk2", label: "Normal ATK after one super" },
                                        { id: "normal_atk3", label: "Normal ATK after two supers" },
                                        { id: "super_atk", label: "First Super ATK" },
                                        { id: "super_atk2", label: "Second Super ATK" },
                                    ]
                                },
                            ],
                        },
                    ]
                },
                {
                    id: "17220035",
                    name: "Level 3: Stage 3",
                    phases: [
                        {
                            id: "172200351",
                            name: "Phase 1",
                            enemies: [
                                {
                                    id: "1722003511",
                                    name: "Omega Shenron",
                                    image: "images/enemies/card_1031500_thumb.jpg",
                                    inputs: [
                                        { id: "territory_skill", label: "Territory boost", type: "checkbox", default: true },
                                    ],
                                    formula: "1722003511",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "normal_atk2", label: "Normal ATK after one super" },
                                        { id: "aoe_atk", label: "AOE ATK 2+" },
                                        { id: "aoe_atk2", label: "AOE ATK 2+ after one super" },
                                        { id: "super_atk", label: "Super ATK" },
                                    ]
                                },
                            ],
                        },
                    ]
                },
                {
                    id: "17220045",
                    name: "Level 4: Stage 4",
                    phases: [
                        {
                            id: "172200451",
                            name: "Phase 1",
                            enemies: [
                                {
                                    id: "1722004511",
                                    name: "Super Saiyan 4 Gogeta",
                                    image: "images/enemies/card_1031470_thumb.jpg",
                                    inputs: [
                                        { id: "turn_count", label: "Current turn", type: "number", min: 1, max: 4, default: 1 },
                                    ],
                                    formula: "1722004511",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "normal_atk2", label: "Normal ATK after one super" },
                                        { id: "normal_atk3", label: "Normal ATK after two supers" },
                                        { id: "super_atk", label: "First Super ATK" },
                                        { id: "super_atk2", label: "Second Super ATK" },
                                    ]
                                },
                            ],
                        },
                    ]
                },
            ]
        },
        {
            id: "1725",
            name: "Dokkan Ultimate Players' Choice Battle",
            image: "images/events/1725.jpg",
            stages: [
                {
                    id: "17250035",
                    name: "Level 3: Dokkan Ultimate Players' Choice Battle",
                    phases: [
                        {
                            id: "172500352",
                            name: "Phase 2",
                            enemies: [
                                {
                                    id: "1725003521",
                                    name: "Pan (GT)",
                                    image: "images/enemies/card_1014150_thumb.jpg",
                                    inputs: [
                                        { id: "turn_count", label: "Current turn", type: "number", min: 1, max: 3, default: 1 },
                                    ],
                                    formula: "1725003521",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "super_atk", label: "Super ATK" },
                                    ]
                                },
                            ],
                        },
                        {
                            id: "172500353",
                            name: "Phase 3",
                            enemies: [
                                {
                                    id: "1725003531",
                                    name: "Trunks (GT)",
                                    image: "images/enemies/card_1022660_thumb.jpg",
                                    inputs: [
                                        { id: "num_atks_received", label: "ATKs received within the turn", type: "number", min: 0, max: 4, default: 0 },
                                    ],
                                    formula: "1725003531",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "super_atk", label: "Super ATK" },
                                    ]
                                },
                            ],
                        },
                        {
                            id: "172500354",
                            name: "Phase 4",
                            enemies: [
                                {
                                    id: "1725003541",
                                    name: "Goku (GT)",
                                    image: "images/enemies/card_1007300_thumb.jpg",
                                    inputs: [
                                        { id: "turn_count", label: "Current turn", type: "number", min: 1, max: 3, default: 1 },
                                    ],
                                    formula: "1725003541",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "normal_atk2", label: "Normal ATK after one super" },
                                        { id: "super_atk", label: "Super ATK" },
                                    ]
                                },
                            ],
                        },
                    ]
                },
            ]
        },
        {
            id: "1726",
            name: "Supreme Magnificent Battle [Next-Generation Saiyans Edition]",
            image: "images/events/1726.jpg",
            stages: [
                {
                    id: "17260015",
                    name: "Level 1: Vs. Goten (Kid)",
                    phases: [
                        {
                            id: "172600151",
                            name: "Phase 1",
                            enemies: [
                                {
                                    id: "1726001511",
                                    name: "Goten (Kid) + Trunks (Kid)",
                                    image: "images/enemies/card_4030620_thumb.jpg",
                                    inputs: [
                                        { id: "turn_count", label: "Current turn", type: "number", min: 1, max: 2, default: 1 },
                                        { id: "atk_debuff_passive", label: "ATK debuff from passives (%)", type: "number", min: 0, max: 100, default: 0 },
                                        { id: "atk_debuff_super", label: "ATK debuff from supers (%)", type: "number", min: 0, max: 9999, default: 0 },
                                    ],
                                    formula: "1726001511",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "super_atk", label: "Super ATK" },
                                    ]
                                },
                            ],
                        },
                        {
                            id: "172600152",
                            name: "Phase 2",
                            enemies: [
                                {
                                    id: "1726001521",
                                    name: "Super Saiyan Goten (Kid)",
                                    image: "images/enemies/card_1005090_thumb.jpg",
                                    inputs: [
                                        { id: "turn_count", label: "Current turn", type: "number", min: 1, max: 5, default: 1 },
                                        { id: "atk_debuff_passive", label: "ATK debuff from passives (%)", type: "number", min: 0, max: 100, default: 0 },
                                        { id: "atk_debuff_super", label: "ATK debuff from supers (%)", type: "number", min: 0, max: 9999, default: 0 },
                                    ],
                                    formula: "1726001521",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "normal_atk2", label: "Normal ATK after supering" },
                                        { id: "super_atk", label: "Super ATK" },
                                    ]
                                }
                            ],
                        },
                    ]
                },
                {
                    id: "17260025",
                    name: "Level 2: Vs. Trunks (Kid)",
                    phases: [
                        {
                            id: "172600251",
                            name: "Phase 1",
                            enemies: [
                                {
                                    id: "1726002511",
                                    name: "Trunks (Kid) + Goten (Kid)",
                                    image: "images/enemies/card_1030610_thumb.jpg",
                                    inputs: [
                                        { id: "atk_debuff_passive", label: "ATK debuff from passives (%)", type: "number", min: 0, max: 100, default: 0 },
                                        { id: "atk_debuff_super", label: "ATK debuff from supers (%)", type: "number", min: 0, max: 9999, default: 0 },
                                    ],
                                    formula: "1726002511",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "super_atk", label: "Super ATK" },
                                    ]
                                },
                            ],
                        },
                        {
                            id: "172600252",
                            name: "Phase 2",
                            enemies: [
                                {
                                    id: "1726002521",
                                    name: "Super Saiyan Trunks (Kid)",
                                    image: "images/enemies/card_1005100_thumb.jpg",
                                    inputs: [
                                        { id: "turn_count", label: "Current turn", type: "number", min: 1, max: 5, default: 1 },
                                        { id: "atk_debuff_passive", label: "ATK debuff from passives (%)", type: "number", min: 0, max: 100, default: 0 },
                                        { id: "atk_debuff_super", label: "ATK debuff from supers (%)", type: "number", min: 0, max: 9999, default: 0 },
                                    ],
                                    formula: "1726002521",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "super_atk", label: "Super ATK" },
                                    ]
                                }
                            ],
                        },
                    ]
                },
                {
                    id: "17260035",
                    name: "Level 3: Vs. Gohan (Teen)",
                    phases: [
                        {
                            id: "172600351",
                            name: "Phase 1",
                            enemies: [
                                {
                                    id: "1726003511",
                                    name: "Gohan (Teen)",
                                    image: "images/enemies/card_1003250_thumb.jpg",
                                    inputs: [
                                        { id: "num_atks_received", label: "ATKs received within the turn", type: "number", min: 0, max: 7, default: 0 },
                                    ],
                                    formula: "1726003511",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "normal_atk2", label: "Normal ATK after supering" },
                                        { id: "super_atk", label: "Super ATK" },
                                    ]
                                },
                            ],
                        },
                        {
                            id: "172600352",
                            name: "Phase 2",
                            enemies: [
                                {
                                    id: "1726003521",
                                    name: "Super Saiyan Gohan (Teen)",
                                    image: "images/enemies/card_1008540_thumb.jpg",
                                    inputs: [
                                        { id: "num_atks_received", label: "Total ATKs received", type: "number", min: 0, max: 10, default: 0 },
                                    ],
                                    formula: "1726003521",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "normal_atk2", label: "Normal ATK after one super" },
                                        { id: "normal_atk3", label: "Normal ATK after two supers" },
                                        { id: "super_atk", label: "First Super ATK" },
                                        { id: "super_atk2", label: "Second Super ATK" },
                                    ]
                                }
                            ],
                        },
                    ]
                },
                {
                    id: "17260045",
                    name: "Level 4: Vs. Gohan & Goten & Trunks Part 1",
                    phases: [
                        {
                            id: "172600451",
                            name: "Phase 1",
                            enemies: [
                                {
                                    id: "1726004511",
                                    name: "Gohan (Teen) & Goten (Kid) & Trunks (Kid)",
                                    image: "images/enemies/card_1023890_thumb.jpg",
                                    inputs: [
                                        { id: "atk_debuff_passive", label: "ATK debuff from passives (%)", type: "number", min: 0, max: 100, default: 0 },
                                        { id: "atk_debuff_super", label: "ATK debuff from supers (%)", type: "number", min: 0, max: 9999, default: 0 },
                                    ],
                                    formula: "1726004511",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "super_atk", label: "Super ATK" },
                                    ]
                                },
                            ],
                        }
                    ]
                },
                {
                    id: "17260055",
                    name: "Level 5: Vs. Gohan & Goten & Trunks Part 2",
                    phases: [
                        {
                            id: "172600551",
                            name: "Phase 1",
                            enemies: [
                                {
                                    id: "1726005511",
                                    name: "Super Saiyan Gohan (Teen) + Super Saiyan Trunks (Kid) & Super Saiyan Goten (Kid)",
                                    image: "images/enemies/card_1031590_thumb.jpg",
                                    inputs: [
                                        { id: "turn_count", label: "Current turn", type: "number", min: 1, max: 6, default: 1 },
                                    ],
                                    formula: "1726005511",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "super_atk", label: "Super ATK (ignores 70% DEF)" },
                                    ]
                                },
                                {
                                    id: "1726005512",
                                    name: "Super Saiyan Trunks (Kid) & Super Saiyan Goten (Kid) + Super Saiyan Gohan (Teen)",
                                    image: "images/enemies/card_4031600_thumb.jpg",
                                    inputs: [
                                        { id: "turn_count", label: "Current turn", type: "number", min: 1, max: 4, default: 1 },
                                    ],
                                    formula: "1726005512",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "normal_atk2", label: "Normal ATK after one super" },
                                        { id: "normal_atk3", label: "Normal ATK after two supers" },
                                        { id: "normal_atk4", label: "Normal ATK after three supers" },
                                        { id: "aoe_atk2", label: "AOE ATK 2+ after one super" },
                                        { id: "aoe_atk3", label: "AOE ATK 2+ after two supers" },
                                        { id: "aoe_atk4", label: "AOE ATK 2+ after three supers" },
                                        { id: "super_atk", label: "First Super ATK" },
                                        { id: "super_atk2", label: "Second Super ATK" },
                                        { id: "super_atk3", label: "Third Super ATK" },
                                    ]
                                },
                            ],
                        }
                    ]
                },
            ]
        },
        {
            id: "1729",
            name: "Ultimate Red Zone [Pure Saiyans Edition]",
            image: "images/events/1729.jpg",
            stages: [
                {
                    id: "17290025",
                    name: "Level 2: Vs. Nappa & Vegeta",
                    phases: [
                        {
                            id: "172900251",
                            name: "Phase 1",
                            enemies: [
                                {
                                    id: "1729002511",
                                    name: "Nappa",
                                    image: "images/enemies/card_1019390_thumb.jpg",
                                    inputs: [
                                        { id: "turn_count", label: "Current turn", type: "number", min: 1, max: 5, default: 1 },
                                    ],
                                    formula: "1729002511",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "normal_atk2", label: "Normal ATK after one super" },
                                        { id: "super_atk", label: "Super ATK" },
                                    ]
                                },
                            ],
                        },
                        {
                            id: "172900252",
                            name: "Phase 2",
                            enemies: [
                                {
                                    id: "1729002521",
                                    name: "Vegeta (Giant Ape)",
                                    image: "images/enemies/card_1023520_thumb.jpg",
                                    inputs: [
                                        { id: "num_atks_received", label: "ATKs received within the turn", type: "number", min: 0, max: 5, default: 0 },
                                    ],
                                    formula: "1729002521",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "super_atk", label: "Super ATK" },
                                    ]
                                },
                            ],
                        },
                        {
                            id: "172900253",
                            name: "Phase 3",
                            enemies: [
                                {
                                    id: "1729002531",
                                    name: "Vegeta (Giant Ape)",
                                    image: "images/enemies/card_4023520_thumb.jpg",
                                    inputs: [
                                        { id: "turn_count", label: "Current turn", type: "number", min: 1, max: 4, default: 1 },
                                        { id: "atk_debuff_passive", label: "ATK debuff from passives (%)", type: "number", min: 0, max: 100, default: 0 },
                                        { id: "atk_debuff_super", label: "ATK debuff from supers (%)", type: "number", min: 0, max: 9999, default: 0 },
                                    ],
                                    formula: "1729002531",
                                    outputs: [
                                        { id: "normal_atk", label: "Normal ATK" },
                                        { id: "super_atk", label: "Super ATK" },
                                    ]
                                },
                            ],
                        },
                    ]
                },
            ]
        },
    ]
};