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
    if (!formulaId) {
        console.warn('calculateEnemyATK called with null/undefined formulaId');
        return {};
    }

    // formulaFunctions uses numeric keys but they're stored as strings in JS
    const formula = formulaFunctions[formulaId];

    if (!formula || typeof formula !== 'function') {
        console.error(`Formula not found for ID ${formulaId}`);
        return {};
    }

    try {
        return formula(inputs) || {};
    } catch (error) {
        console.error(`Error executing formula ${formulaId}:`, error);
        return {};
    }
}

/**
 * Display calculation results for an enemy
 * Updates or creates result elements based on formula output
 * @param {Object} enemy - Enemy data object (must have id, outputs)
 */
function calculateATK(enemy) {
    // Defensive checks for required data
    if (!enemy) {
        console.error('calculateATK: enemy parameter is required');
        return;
    }

    if (!enemy.id) {
        console.error('calculateATK: enemy must have an id property');
        return;
    }

    // Collect inputs from DOM elements or use defaults
    let inputs = {};
    if (enemy.inputs && Array.isArray(enemy.inputs)) {
        for (const input of enemy.inputs) {
            const inputElement = AppConfig.getInputElement(enemy.id, input.id);

            if (!inputElement) {
                // Element doesn't exist, use default value
                inputs[input.id] = input.default ?? AppConfig.defaults.emptyInputValue;
                continue;
            }

            // Extract value based on input type
            if (input.type === 'checkbox') {
                inputs[input.id] = inputElement.checked;
            } else {
                const rawValue = inputElement.value.trim();
                if (rawValue === '') {
                    inputs[input.id] = input.default ?? AppConfig.defaults.emptyInputValue;
                } else {
                    const parsedValue = parseFloat(rawValue);
                    inputs[input.id] = isNaN(parsedValue) ? (input.default ?? AppConfig.defaults.emptyInputValue) : parsedValue;
                }
            }
        }
    }

    // Execute the calculation formula
    const results = calculateEnemyATK(enemy.formula, inputs);

    // Display all results if enemy has output definitions
    if (enemy.outputs && Array.isArray(enemy.outputs)) {
        for (const output of enemy.outputs) {
            const resultElement = AppConfig.getOutputElement(enemy.id, output.id);

            if (!resultElement) {
                // Result element doesn't exist yet - create it
                createResultElement(enemy, output, results[output.id]);
                continue;
            }

            // Determine if this result should be shown
            let shouldShow = true;
            if (output.condition) {
                try {
                    // Safely evaluate conditional visibility (e.g., "inputs.hasBonus > 0")
                    shouldShow = new Function('inputs', `return ${output.condition}`)(inputs);
                } catch (error) {
                    console.error(`Error evaluating condition for output ${output.id}:`, error);
                    shouldShow = false;
                }
            }

            // Update or hide the result element
            if (shouldShow && results[output.id] !== undefined && results[output.id] !== null) {
                resultElement.style.display = 'block';
                resultElement.textContent = `${output.label}: ${formatNumber(results[output.id])}`;
            } else {
                resultElement.style.display = 'none';
            }
        }
    }
}

/**
 * Create a missing result element and add it to the results container
 * Called when a result div doesn't exist yet but needs to be displayed
 * @param {Object} enemy - Enemy data object
 * @param {Object} output - Output definition
 * @param {number} value - The calculated value
 */
function createResultElement(enemy, output, value) {
    const enemyForm = document.getElementById(AppConfig.idPatterns.enemy(enemy.id));

    if (!enemyForm) {
        // Enemy form not yet in DOM - retry after delay
        setTimeout(() => createResultElement(enemy, output, value), AppConfig.retryCheckDelay);
        return;
    }

    const resultsContainer = enemyForm.querySelector('.results-container');
    if (!resultsContainer) {
        console.warn(`No results container found for enemy ${enemy.id}`);
        return;
    }

    // Ensure the result div doesn't already exist
    const existingElement = AppConfig.getOutputElement(enemy.id, output.id);
    if (existingElement) {
        // Element already exists, just update it
        existingElement.textContent = `${output.label}: ${formatNumber(value)}`;
        return;
    }

    // Create and add new result element
    const resultDiv = document.createElement('div');
    resultDiv.id = AppConfig.idPatterns.output(enemy.id, output.id);
    resultDiv.className = 'result';
    resultDiv.textContent = `${output.label}: ${formatNumber(value || 0)}`;
    resultsContainer.appendChild(resultDiv);
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
