// Function to format numbers with dots as thousands separators
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Calculate ATK based on enemy formula
function calculateATK(enemy) {
    // Collect input values
    const inputs = {};
    enemy.inputs.forEach(input => {
        const inputField = document.getElementById(`${enemy.id}_${input.id}`);

        if (input.type === 'checkbox') {
            // For checkboxes, store boolean value
            inputs[input.id] = inputField.checked;
        } else {
            // For number inputs, parse as float
            inputs[input.id] = parseFloat(inputField.value) || 0;
        }
    });

    // Calculate using the formula function
    const results = calculateEnemyATK(enemy.formula, inputs);

    // Display all results
    enemy.outputs.forEach(output => {
        const resultDiv = document.getElementById(`${enemy.id}_${output.id}`);
        if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.textContent = `${output.label}: ${Math.round(results[output.id])}`;

            if (results[output.id] !== undefined) {
                resultDiv.style.display = 'block';
                // Format the number with dots as thousands separators
                resultDiv.textContent = `${output.label}: ${formatNumber(Math.round(results[output.id]))}`;
            } else {
                resultDiv.style.display = 'none';
            }
        }
    });
}