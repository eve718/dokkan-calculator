// Function to format numbers with dots as thousands separators
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Debounce function to limit how often a function can be called
function debounce(func, wait) {
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

// Enhanced input validation function
function validateInputWithDebounce(inputElement, min, max, enemy, defaultValue) {
    let value = parseFloat(inputElement.value);

    // If not a number, clear the field
    if (isNaN(value)) {
        inputElement.value = '';
    } else if (value < min) {
        inputElement.value = min === defaultValue ? '' : min;
    } else if (value > max) {
        inputElement.value = max === defaultValue ? '' : max;
    } else if (value === defaultValue) {
        // If value equals default, keep it as is (user explicitly entered default)
        inputElement.value = value;
    }

    // Recalculate ATK after validation
    calculateATK(enemy);
}

// Create a debounced version of the validation
const debouncedValidation = debounce(validateInputWithDebounce, 500);

// Calculate ATK based on enemy formula
function calculateATK(enemy) {
    // Collect input values
    const inputs = {};
    let allInputsFound = true;

    enemy.inputs.forEach(input => {
        const inputField = document.getElementById(`${enemy.id}_${input.id}`);

        // Skip if input field doesn't exist yet
        if (!inputField) {
            console.warn(`Input field ${enemy.id}_${input.id} not found`);
            // Use the default value from the input definition
            inputs[input.id] = input.default || 0;
            allInputsFound = false;
            return;
        }

        if (input.type === 'checkbox') {
            inputs[input.id] = inputField.checked;
        } else {
            // Use the default value if input is empty, otherwise use the input value
            const value = inputField.value.trim();
            inputs[input.id] = value === '' ?
                (input.default || 0) :
                parseFloat(value) || 0;
        }
    });

    // If not all inputs were found, try again after a short delay
    if (!allInputsFound) {
        setTimeout(() => calculateATK(enemy), 50);
        return;
    }

    // Calculate using the formula function
    const results = calculateEnemyATK(enemy.formula, inputs);

    // Display all results
    enemy.outputs.forEach(output => {
        const resultDiv = document.getElementById(`${enemy.id}_${output.id}`);
        if (resultDiv) {
            // Check if we should show this result based on condition
            let shouldShow = true;
            if (output.condition) {
                // Simple condition evaluation
                try {
                    shouldShow = new Function('inputs', `return ${output.condition}`)(inputs);
                } catch (e) {
                    console.error("Error evaluating condition:", e);
                    shouldShow = false;
                }
            }

            if (shouldShow && results[output.id] !== undefined) {
                resultDiv.style.display = 'block';
                // Format the number with dots as thousands separators
                resultDiv.textContent = `${output.label}: ${formatNumber(Math.round(results[output.id]))}`;
            } else {
                resultDiv.style.display = 'none';
            }
        }
    });
}

// Function to calculate ATK with retry for missing inputs
function calculateATKWithRetry(enemy, retryCount = 0) {
    const maxRetries = 5;

    // Check if all input fields exist
    const allInputsExist = enemy.inputs.every(input => {
        return document.getElementById(`${enemy.id}_${input.id}`);
    });

    if (!allInputsExist && retryCount < maxRetries) {
        setTimeout(() => calculateATKWithRetry(enemy, retryCount + 1), 100);
        return;
    }

    // If we have all inputs or reached max retries, proceed with calculation
    calculateATK(enemy);
}

// Real-time input validation with instant updates
function setupInputValidation(inputField, min, max, defaultValue, enemy) {
    let validationTimeout = null;

    inputField.addEventListener('input', function () {
        const value = this.value.trim();

        // Clear any previous validation timeout
        if (validationTimeout) {
            clearTimeout(validationTimeout);
        }

        // If empty, use default value and calculate immediately
        if (value === '') {
            calculateATK(enemy);
            this.style.borderColor = '';
            return;
        }

        const numValue = parseFloat(value);

        // Check if value is within range
        if (!isNaN(numValue) && numValue >= min && numValue <= max) {
            // Valid value - update immediately
            this.style.borderColor = '';

            // If value equals default, keep it as is (user explicitly entered default)
            if (numValue === defaultValue) {
                this.value = numValue;
            }

            calculateATK(enemy);
        } else {
            // Invalid value - show visual feedback
            this.style.borderColor = '#ff4757';

            // Schedule validation after user stops typing
            validationTimeout = setTimeout(() => {
                validateAndCorrectInput(this, min, max, defaultValue, enemy);
            }, 800); // Adjust this delay as needed
        }
    });

    // Also validate when user leaves the field
    inputField.addEventListener('blur', function () {
        validateAndCorrectInput(this, min, max, defaultValue, enemy);
    });
}

// Function to validate and correct input
function validateAndCorrectInput(inputElement, min, max, defaultValue, enemy) {
    let value = inputElement.value.trim();

    // If empty, use default value
    if (value === '') {
        inputElement.style.borderColor = '';
        calculateATK(enemy);
        return;
    }

    value = parseFloat(value);

    // If not a number, clear the field (will use default)
    if (isNaN(value)) {
        inputElement.value = '';
    } else if (value < min) {
        inputElement.value = min === defaultValue ? '' : min;
    } else if (value > max) {
        inputElement.value = max === defaultValue ? '' : max;
    } else if (value === defaultValue) {
        // If value equals default, keep it as is (user explicitly entered default)
        inputElement.value = value;
    }

    // Remove error styling and recalculate
    inputElement.style.borderColor = '';
    calculateATK(enemy);
}