/**
 * Calculator Module - ATK Calculation and Input Management
 * 
 * Handles real-time validation, ATK calculations, and result display.
 * All magic numbers and DOM selectors are centralized in AppConfig.
 */

/**
 * Format a number with comma separators for display
 * @param {number} num - The number to format
 * @returns {string} Formatted number string (e.g., "1,234,567")
 */
function formatNumber(num) {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Debounce function to limit function execution frequency
 * Prevents rapid successive calls, commonly used for input validation
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait before executing
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    if (typeof func !== 'function') {
        console.error('debounce expects a function as first argument');
        return () => {};
    }

    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Get ATK calculation results for an enemy based on inputs
 * Safely retrieves formula function and executes with error handling
 * @param {string} formulaId - Enemy formula ID (string key in formulaFunctions)
 * @param {Object} inputs - Input values object
 * @returns {Object} Calculation results object, or empty object on failure
 */
function calculateEnemyATK(formulaId, inputs) {
    if (!formulaId) return {};

    const formula = formulaFunctions[formulaId];
    if (!formula || typeof formula !== 'function') {
        console.error(`[calculateEnemyATK] Formula not found for ID ${formulaId}`);
        return {};
    }

    try {
        return formula(inputs) || {};
    } catch (error) {
        console.error(`[calculateEnemyATK] Error executing formula ${formulaId}:`, error);
        return {};
    }
}

/**
 * Display calculation results for an enemy
 * Updates or creates result elements based on formula output
 * Populates both old results display and new results card
 * @param {Object} enemy - Enemy data object (must have id, outputs)
 * @param {HTMLElement} enemyFormElement - Optional: the enemy form container to search within (for detached DOM)
 */
function calculateATK(enemy, enemyFormElement) {
    if (!enemy || !enemy.id) return;

    // Collect inputs
    const inputs = {};
    if (enemy.inputs && Array.isArray(enemy.inputs)) {
        for (const input of enemy.inputs) {
            const el = enemyFormElement
                ? (enemyFormElement.querySelector(`[id="${AppConfig.idPatterns.input(enemy.id, input.id)}"]`) ||
                   document.getElementById(AppConfig.idPatterns.input(enemy.id, input.id)))
                : AppConfig.getInputElement(enemy.id, input.id);

            if (!el) {
                inputs[input.id] = input.default ?? AppConfig.defaults.emptyInputValue;
            } else if (input.type === 'checkbox') {
                inputs[input.id] = el.checked;
            } else {
                const raw = el.value.trim();
                inputs[input.id] = raw === ''
                    ? (input.default ?? AppConfig.defaults.emptyInputValue)
                    : (parseFloat(raw) || 0);
            }
        }
    }

    const results    = calculateEnemyATK(enemy.formula, inputs);
    const currentMode = AppConfig.getMode();

    // Locate the results card (created by createEnemyForm before this is called)
    const resultsCard = enemyFormElement
        ? (enemyFormElement.querySelector(`#results-card-${enemy.id}`) || document.getElementById(`results-card-${enemy.id}`))
        : document.getElementById(`results-card-${enemy.id}`);
    const resultsValuesContainer = resultsCard
        ? resultsCard.querySelector(`#results-values-${enemy.id}`)
        : null;

    if (resultsCard && resultsValuesContainer && enemy.outputs) {
        resultsValuesContainer.innerHTML = '';
        let hasResults = false;

        for (const output of enemy.outputs) {
            if (results[output.id] == null) continue;
            hasResults = true;

            const item = document.createElement('div');
            item.className = 'result-value';

            const lbl = document.createElement('div');
            lbl.className = 'result-value-label';
            lbl.textContent = output.label || 'Result';

            const amt = document.createElement('div');
            amt.className = 'result-value-amount';
            amt.textContent = formatNumber(results[output.id]);

            item.appendChild(lbl);
            item.appendChild(amt);
            resultsValuesContainer.appendChild(item);
        }

        resultsCard.style.display = (hasResults && currentMode === 'atk') ? 'block' : 'none';
    }

    // Always keep damage values fresh so switching to damage mode shows current results
    calculateDamage(enemy);
}

/**
 * Validate and correct a single input value
 * Ensures value is within min/max bounds and updates the DOM
 * @param {HTMLElement} inputElement - Input field to validate
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @param {number} defaultValue - Value to use if input is empty
 * @param {Object} enemy - Enemy data object
 */
function validateAndCorrectInput(inputElement, min, max, defaultValue, enemy) {
    if (!inputElement || !enemy) {
        console.error('validateAndCorrectInput: missing required parameters');
        return;
    }

    let value = inputElement.value.trim();

    // Handle empty input
    if (value === '') {
        inputElement.style.borderColor = AppConfig.inputValidation.normalBorderColor;
        calculateATK(enemy);
        return;
    }

    value = parseFloat(value);

    // Validate that it's a number
    if (isNaN(value)) {
        inputElement.value = '';
        inputElement.style.borderColor = AppConfig.inputValidation.normalBorderColor;
        calculateATK(enemy);
        return;
    }

    // Clamp value to valid range
    if (value < min) {
        inputElement.value = (min === defaultValue) ? '' : min;
    } else if (value > max) {
        inputElement.value = (max === defaultValue) ? '' : max;
    }
    // Note: if value === defaultValue, keep it as-is (user explicitly entered it)

    // Clear error styling and recalculate
    inputElement.style.borderColor = AppConfig.inputValidation.normalBorderColor;
    calculateATK(enemy);
}

/**
 * Calculate damage taken by the player's character for a single enemy.
 * Reads character inputs from the shared panel, runs the enemy's ATK formula
 * with current enemy-form inputs, then applies all defence modifiers.
 * @param {Object} enemy - Enemy data object
 */
function calculateDamage(enemy) {
    if (!enemy || !enemy.id) return;

    // --- Character inputs (shared panel, plain IDs) ---
    const charInputs = {
        char_defense:         parseCharInputValue('char_defense',         0),
        char_stacked_def:     parseCharInputValue('char_stacked_def',     0),
        char_damage_reduction:parseCharInputValue('char_damage_reduction',0),
        char_type:            parseCharInputValue('char_type',            'STR'),
        char_class:           parseCharInputValue('char_class',           'Super'),
        char_type_def_boost:  parseCharInputValue('char_type_def_boost',  0),
        char_passive_guard:   parseCharInputValue('char_passive_guard',   false),
    };

    // --- Enemy ATK values: re-run formula with current enemy-form inputs ---
    const enemyInputs = {};
    if (enemy.inputs && Array.isArray(enemy.inputs)) {
        for (const input of enemy.inputs) {
            const el = AppConfig.getInputElement(enemy.id, input.id);
            if (!el) {
                enemyInputs[input.id] = input.default ?? AppConfig.defaults.emptyInputValue;
            } else if (input.type === 'checkbox') {
                enemyInputs[input.id] = el.checked;
            } else {
                const raw = el.value.trim();
                enemyInputs[input.id] = raw === '' ? (input.default ?? 0) : (parseFloat(raw) || 0);
            }
        }
    }
    const enemyAtkResults = calculateEnemyATK(enemy.formula, enemyInputs);

    // --- Enemy properties: type/class from typeIcon, DEF-ignore from output labels ---
    const enemyInfo = getEnemyInfoFromIcon(enemy.typeIcon);
    const enemyProps = {
        enemy_type:  enemyInfo.type,
        enemy_class: enemyInfo.class,
    };
    if (enemy.outputs && Array.isArray(enemy.outputs)) {
        for (const output of enemy.outputs) {
            const defIgnorePct = extractDefIgnoreFromLabel(output.label);
            if (defIgnorePct > 0) {
                enemyProps[output.id + '_def_ignore'] = defIgnorePct; // raw %
            }
            const defLowerPct = extractDefLowerFromLabel(output.label);
            if (defLowerPct > 0) {
                enemyProps[output.id + '_def_lower'] = defLowerPct; // raw %
            }
        }
    }

    // --- Run damage formula ---
    const damageFormula = getDamageTakenFormula(enemy.formula);
    let damageResults = {};
    if (damageFormula) {
        try {
            damageResults = damageFormula({
                characterInputs:  charInputs,
                enemyAttackResults: enemyAtkResults,
                enemyProperties:  enemyProps,
            }) || {};
        } catch (err) {
            console.error(`[calculateDamage] Error for enemy ${enemy.id}:`, err);
        }
    }

    displayDamageResults(enemy, damageResults);
}

/**
 * Parse a character-panel input value by its plain element ID.
 * Character input IDs are unprefixed (e.g. "char_defense", "char_type").
 * @param {string} inputId - The element ID
 * @param {*} defaultValue - Returned when element is absent or empty
 * @returns {*} Parsed value
 */
function parseCharInputValue(inputId, defaultValue) {
    const el = document.getElementById(inputId)
        || (AppConfig.currentCharInputsSection
            ? AppConfig.currentCharInputsSection.querySelector(`#${inputId}`)
            : null);
    if (!el) return defaultValue;
    if (el.type === 'checkbox') return el.checked;
    if (el.tagName === 'SELECT') return el.value;
    const val = parseFloat(el.value);
    return isNaN(val) ? defaultValue : val;
}

/**
 * Get the damage formula function for an enemy
 * Damage formulas are keyed by enemy formula ID in damageTakenFunctions
 * @param {string} formulaId - The enemy's formula ID
 * @returns {Function|null} Damage calculation function or null
 */
function getDamageTakenFormula(formulaId) {
    if (!formulaId) {
        return null;
    }
    
    // Try to get formula directly, or use default formula handler
    if (typeof getDamageTakenFormulaById === 'function') {
        return getDamageTakenFormulaById(formulaId);
    }
    
    // Fallback to direct lookup
    if (typeof damageTakenFunctions === 'undefined') {
        return null;
    }
    return damageTakenFunctions[formulaId] || null;
}

/**
 * Display damage results for one enemy inside the shared "Damage Received" panel.
 * Uses the enemy's own output definitions for human-readable labels.
 * @param {Object} enemy - Enemy data object
 * @param {Object} damageResults - { normal_damage: n, super_damage: n, … }
 */
function displayDamageResults(enemy, damageResults) {
    const container = document.getElementById('damage-results-section')
        || AppConfig.currentDamageResultsSection;
    if (!container) return;

    // Only reveal the section when in damage mode
    if (container.style.display === 'none' && AppConfig.getMode() === 'damage') {
        container.style.display = 'block';
    }

    // Find or create the per-enemy block inside the shared panel.
    // Use querySelector-within-container as fallback for detached DOM.
    let enemyResultDiv = document.getElementById(`phase-damage-result-${enemy.id}`)
        || container.querySelector(`#phase-damage-result-${enemy.id}`);
    if (!enemyResultDiv) {
        enemyResultDiv = document.createElement('div');
        enemyResultDiv.id = `phase-damage-result-${enemy.id}`;
        enemyResultDiv.style.marginBottom = '15px';
        enemyResultDiv.style.padding = '15px';
        enemyResultDiv.style.backgroundColor = 'rgba(255, 71, 87, 0.08)';
        enemyResultDiv.style.border = '1.5px solid rgba(255, 71, 87, 0.4)';
        enemyResultDiv.style.borderRadius = '8px';
        container.appendChild(enemyResultDiv);
    }

    const nameEl = document.createElement('h5');
    nameEl.textContent = enemy.name;
    nameEl.style.margin = '0 0 10px 0';
    nameEl.style.color = '#ff6b6b';
    nameEl.style.fontSize = '0.95rem';

    const valuesGrid = document.createElement('div');
    valuesGrid.style.display = 'grid';
    valuesGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(160px, 1fr))';
    valuesGrid.style.gap = '10px';

    if (!damageResults || Object.keys(damageResults).length === 0) {
        const msg = document.createElement('div');
        msg.style.color = 'var(--color-text-muted)';
        msg.style.fontSize = '0.85rem';
        msg.textContent = 'No damage calculated';
        valuesGrid.appendChild(msg);
    } else {
        for (const [damageKey, value] of Object.entries(damageResults)) {
            // Derive label from the matching ATK output definition
            const atkOutputId = damageKey.replace(/_damage(\d*)$/, '_atk$1');
            const matchingOutput = enemy.outputs?.find(o => o.id === atkOutputId);
            const labelText = matchingOutput
                ? matchingOutput.label.replace(/\batk\b/gi, 'Damage')
                : damageKey.replace(/_/g, ' ');

            const card = document.createElement('div');
            card.style.backgroundColor = 'rgba(26, 32, 44, 0.7)';
            card.style.border = '1px solid rgba(255, 107, 107, 0.3)';
            card.style.borderRadius = '6px';
            card.style.padding = '8px';
            card.style.textAlign = 'center';

            const labelEl = document.createElement('div');
            labelEl.style.fontSize = '0.75rem';
            labelEl.style.color = 'var(--color-text-muted)';
            labelEl.style.marginBottom = '4px';
            labelEl.textContent = labelText;

            // value is { min, max } — each is a number or 'DD'
            const { min, max } = (value && typeof value === 'object') ? value : { min: value, max: value };
            const isDDmin = min === 'DD';
            const isDDmax = max === 'DD';

            const amountEl = document.createElement('div');
            amountEl.style.fontSize = '1.1rem';
            amountEl.style.fontWeight = '700';
            amountEl.style.color = '#ff6b6b';
            amountEl.style.fontFamily = "'Courier New', monospace";

            if (isDDmin && isDDmax) {
                amountEl.textContent = 'DD (1\u2013255)';
            } else if (isDDmin) {
                amountEl.textContent = `DD \u2013 ${formatNumber(max)}`;
            } else if (isDDmax || min === max) {
                amountEl.textContent = formatNumber(min);
            } else {
                amountEl.textContent = `${formatNumber(min)} \u2013 ${formatNumber(max)}`;
            }

            card.appendChild(labelEl);
            card.appendChild(amountEl);
            valuesGrid.appendChild(card);
        }
    }

    enemyResultDiv.innerHTML = '';
    enemyResultDiv.appendChild(nameEl);
    enemyResultDiv.appendChild(valuesGrid);
}

/**
 * Extract type and class from a typeIcon image path.
 * Example: "images/types/ex_int.jpg" → { type: 'INT', class: 'Extreme' }
 * @param {string} typeIconPath
 * @returns {{ type: string|null, class: string }}
 */
function getEnemyInfoFromIcon(typeIconPath) {
    if (!typeIconPath) return { type: null, class: 'Super' };
    const filename = typeIconPath.split('/').pop().toLowerCase();
    const typeMatch = filename.match(/_(str|teq|int|phy|agl)/);
    return {
        type:  typeMatch ? typeMatch[1].toUpperCase() : null,
        class: filename.startsWith('ex_') ? 'Extreme' : 'Super',
    };
}

/**
 * Parse DEF-ignore percentage from an output label.
 * Handles labels such as "Super ATK (ignores 70% DEF)".
 * @param {string} label
 * @returns {number} 0–100
 */
function extractDefIgnoreFromLabel(label) {
    const match = (label || '').match(/ignores?\s+(\d+)%/i);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Parse DEF-lower percentage from an output label.
 * Handles labels such as "Super ATK (lowers 40% stacked DEF for 1 turn)".
 * @param {string} label
 * @returns {number} 0–100
 */
function extractDefLowerFromLabel(label) {
    const match = (label || '').match(/lowers?\s+(\d+)%\s*(?:stacked\s+)?def/i);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Setup real-time input validation with visual feedback
 * Attaches event listeners for validation and calculation updates
 * @param {HTMLElement} inputField - Input element to attach listeners to
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @param {number} defaultValue - Default value if input is empty
 * @param {Object} enemy - Enemy data object
 */
function setupInputValidation(inputField, min, max, defaultValue, enemy) {
    if (!inputField) {
        console.error('setupInputValidation: inputField is required');
        return;
    }

    if (!enemy) {
        console.error('setupInputValidation: enemy is required');
        return;
    }

    let validationTimeout = null;

    inputField.addEventListener('input', function () {
        const value = this.value.trim();

        // Clear previous timeout
        if (validationTimeout) {
            clearTimeout(validationTimeout);
        }

        // Empty input: use default and recalculate immediately
        if (value === '') {
            this.style.borderColor = AppConfig.inputValidation.normalBorderColor;
            calculateATK(enemy);
            return;
        }

        const numValue = parseFloat(value);

        // Valid number within range: recalculate immediately
        if (!isNaN(numValue) && numValue >= min && numValue <= max) {
            this.style.borderColor = AppConfig.inputValidation.normalBorderColor;
            calculateATK(enemy);
        } else {
            // Invalid value: show error styling and schedule correction
            this.style.borderColor = AppConfig.inputValidation.errorBorderColor;
            validationTimeout = setTimeout(() => {
                validateAndCorrectInput(this, min, max, defaultValue, enemy);
            }, AppConfig.inputCorrectionDelay);
        }
    });

    // Validate when user leaves the field
    inputField.addEventListener('blur', function () {
        validateAndCorrectInput(this, min, max, defaultValue, enemy);
    });
}

/**
 * Attach change/input listeners to all character-panel inputs.
 * Uses a flag on the container so listeners aren't duplicated when phases switch.
 * Saves each value to sessionStorage so it persists across phase navigation.
 */
function setupCharacterInputListeners() {
    const panel = document.getElementById('char-inputs-section')
        || AppConfig.currentCharInputsSection;
    if (!panel || panel.dataset.listenersAttached) return;
    panel.dataset.listenersAttached = '1';

    const charInputIds = [
        'char_defense', 'char_stacked_def', 'char_damage_reduction',
        'char_type', 'char_class', 'char_type_def_boost', 'char_passive_guard',
    ];

    charInputIds.forEach(inputId => {
        const el = panel.querySelector(`#${inputId}`) || document.getElementById(inputId);
        if (!el) return;

        const saveToSession = () => {
            if (el.type === 'checkbox') {
                sessionStorage.setItem('charInput_' + inputId, el.checked ? '__true__' : '__false__');
            } else {
                sessionStorage.setItem('charInput_' + inputId, el.value);
            }
        };

        const recalcAll = debounce(() => {
            document.querySelectorAll('[id^="enemy-form-"]').forEach(form => {
                const enemy = findEnemyById(form.id.replace('enemy-form-', ''));
                if (enemy) calculateDamage(enemy);
            });
        }, 150);

        const eventType = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
        el.addEventListener(eventType, () => {
            saveToSession();
            recalcAll();
        });
    });
}

/**
 * Find an enemy object by ID in gameData
 * @param {string} enemyId - The enemy ID to search for
 * @returns {Object|null} Enemy object or null if not found
 */
function findEnemyById(enemyId) {
    if (!gameData || !gameData.events) return null;
    
    for (const event of gameData.events) {
        if (!event.stages) continue;
        for (const stage of event.stages) {
            if (!stage.battles) continue;
            for (const battle of stage.battles) {
                if (!battle.phases) continue;
                for (const phase of battle.phases) {
                    if (!phase.enemies) continue;
                    for (const enemy of phase.enemies) {
                        if (enemy.id === enemyId) return enemy;
                    }
                }
            }
        }
    }
    return null;
}
