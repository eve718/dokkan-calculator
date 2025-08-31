// Current page state
let currentPage = 'events';
let currentEventId = null;
let currentStageId = null;

// Function to show different pages
function showPage(page, eventId = null, stageId = null) {
    currentPage = page;
    currentEventId = eventId;
    currentStageId = stageId;

    const contentDiv = document.getElementById('content');
    const breadcrumbDiv = document.getElementById('breadcrumb');

    // Update breadcrumb
    updateBreadcrumb();

    // Clear content
    contentDiv.innerHTML = '';

    // Load appropriate content
    switch (page) {
        case 'events':
            showEventsPage(contentDiv);
            break;
        case 'stages':
            showStagesPage(contentDiv, eventId);
            break;
        case 'enemies':
            showEnemiesPage(contentDiv, eventId, stageId);
            break;
    }
}

// Update breadcrumb based on current page
function updateBreadcrumb() {
    const breadcrumbDiv = document.getElementById('breadcrumb');
    let html = '<a href="#" onclick="showPage(\'events\')">Home</a>';

    if (currentPage === 'stages' || currentPage === 'enemies') {
        const event = gameData.events.find(e => e.id === currentEventId);
        html += ` &gt; <a href="#" onclick="showPage('stages', '${currentEventId}')">${event.name}</a>`;
    }

    if (currentPage === 'enemies') {
        const event = gameData.events.find(e => e.id === currentEventId);
        const stage = event.stages.find(s => s.id === currentStageId);
        html += ` &gt; ${stage.name}`;
    }

    breadcrumbDiv.innerHTML = html;
}

// Show events page
function showEventsPage(container) {
    const title = document.createElement('h2');
    title.textContent = 'Select an Event';
    container.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'card-grid';

    gameData.events.forEach(event => {
        const card = document.createElement('div');
        card.className = 'card event-card';
        card.style.backgroundImage = `url('${event.image}')`;
        card.style.backgroundSize = 'cover';
        card.style.backgroundPosition = 'center';
        card.style.backgroundRepeat = 'no-repeat';

        const cardContent = document.createElement('div');
        cardContent.className = 'card-content';
        cardContent.innerHTML = `<h3>${event.name}</h3>`;

        card.appendChild(cardContent);
        card.addEventListener('click', () => showPage('stages', event.id));
        grid.appendChild(card);
    });

    container.appendChild(grid);
}

// Show stages page
function showStagesPage(container, eventId) {
    const event = gameData.events.find(e => e.id === eventId);

    const title = document.createElement('h2');
    title.textContent = `${event.name} - Select a Stage`;
    container.appendChild(title);

    const backButton = document.createElement('button');
    backButton.className = 'back-button';
    backButton.textContent = 'Back to Events';
    backButton.addEventListener('click', () => showPage('events'));
    container.appendChild(backButton);

    const grid = document.createElement('div');
    grid.className = 'card-grid';

    event.stages.forEach(stage => {
        const card = document.createElement('div');
        card.className = 'card';

        const cardContent = document.createElement('div');
        cardContent.className = 'card-content';
        cardContent.innerHTML = `<h3>${stage.name}</h3>`;

        card.appendChild(cardContent);
        card.addEventListener('click', () => showPage('enemies', eventId, stage.id));
        grid.appendChild(card);
    });

    container.appendChild(grid);
}

// Show enemies page with phase selection
function showEnemiesPage(container, eventId, stageId) {
    const event = gameData.events.find(e => e.id === eventId);
    const stage = event.stages.find(s => s.id === stageId);

    // Clear the container first
    container.innerHTML = '';

    const title = document.createElement('h2');
    title.textContent = `${event.name} - ${stage.name}`;
    container.appendChild(title);

    const backButton = document.createElement('button');
    backButton.className = 'back-button';
    backButton.textContent = 'Back to Stages';
    backButton.addEventListener('click', () => showPage('stages', eventId));
    container.appendChild(backButton);

    // Create phase selection dropdown
    const phaseSelectContainer = document.createElement('div');
    phaseSelectContainer.className = 'phase-select-container';

    const phaseLabel = document.createElement('label');
    phaseLabel.textContent = 'Select Phase:';
    phaseLabel.setAttribute('for', 'phase-select');

    const phaseSelect = document.createElement('select');
    phaseSelect.id = 'phase-select';

    // Add options for each phase
    stage.phases.forEach(phase => {
        const option = document.createElement('option');
        option.value = phase.id;
        option.textContent = phase.name;
        phaseSelect.appendChild(option);
    });

    // Create a container for enemy forms
    const enemyFormsContainer = document.createElement('div');
    enemyFormsContainer.id = 'enemy-forms-container';

    // Event listener for phase selection
    phaseSelect.addEventListener('change', function () {
        const selectedPhaseId = this.value;
        const selectedPhase = stage.phases.find(p => p.id === selectedPhaseId);
        displayEnemiesForPhase(enemyFormsContainer, selectedPhase);
    });

    phaseSelectContainer.appendChild(phaseLabel);
    phaseSelectContainer.appendChild(phaseSelect);
    container.appendChild(phaseSelectContainer);
    container.appendChild(enemyFormsContainer);

    // Display enemies for the first phase by default
    if (stage.phases.length > 0) {
        displayEnemiesForPhase(enemyFormsContainer, stage.phases[0]);
    }
}

// Function to display enemies for a specific phase
function displayEnemiesForPhase(container, phase) {
    // Clear previous enemies
    container.innerHTML = '';

    // Add phase title
    const phaseTitle = document.createElement('h3');
    phaseTitle.textContent = phase.name;
    container.appendChild(phaseTitle);

    // Create forms for each enemy in the phase
    phase.enemies.forEach(enemy => {
        const enemyForm = document.createElement('div');
        enemyForm.className = 'enemy-form';
        enemyForm.innerHTML = `
            <h4>${enemy.name}</h4>
            <img src="${enemy.image}" alt="${enemy.name}" class="enemy-image">
        `;

        const form = document.createElement('div');

        enemy.inputs.forEach(input => {
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group';

            const label = document.createElement('label');
            label.textContent = input.label;
            label.setAttribute('for', input.id);

            let inputField;
            if (input.type === 'checkbox') {
                const checkboxContainer = document.createElement('div');
                checkboxContainer.className = 'checkbox-container';

                // Create a span (not a label) for the text above the checkbox
                const textSpan = document.createElement('span');
                textSpan.textContent = input.label;
                textSpan.className = 'checkbox-text';

                // Create the checkbox input
                inputField = document.createElement('input');
                inputField.type = 'checkbox';
                inputField.id = `${enemy.id}_${input.id}`;
                inputField.checked = input.default || false;

                // Add event listener
                inputField.addEventListener('change', function () {
                    calculateATK(enemy);
                });

                // Add elements to container in order (text first, then checkbox)
                checkboxContainer.appendChild(textSpan);
                checkboxContainer.appendChild(inputField);

                // Add the complete checkbox container to the form group
                formGroup.appendChild(checkboxContainer);
            } else {
                inputField = document.createElement('input');
                inputField.type = input.type;
                inputField.id = `${enemy.id}_${input.id}`;
                inputField.min = input.min || 0;
                inputField.max = input.max || 100;
                inputField.value = input.default || 0;

                formGroup.appendChild(label);
                formGroup.appendChild(inputField);
            }

            // Add input validation for number inputs
            if (input.type === 'number') {
                inputField.addEventListener('input', function () {
                    validateInputRange(this, input.min, input.max);
                    calculateATK(enemy);
                });

                inputField.addEventListener('change', function () {
                    validateInputRange(this, input.min, input.max);
                    calculateATK(enemy);
                });
            } else if (input.type === 'checkbox') {
                inputField.addEventListener('change', function () {
                    calculateATK(enemy);
                });
            }

            form.appendChild(formGroup);
        });

        // Create result containers for all outputs
        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'results-container';

        enemy.outputs.forEach(output => {
            const resultDiv = document.createElement('div');
            resultDiv.id = `${enemy.id}_${output.id}`;
            resultDiv.className = 'result';
            resultDiv.textContent = `${output.label}: 0`;
            resultsContainer.appendChild(resultDiv);
        });

        enemyForm.appendChild(form);
        enemyForm.appendChild(resultsContainer);
        container.appendChild(enemyForm);

        // Initial calculation
        calculateATK(enemy);
    });
}

// Function to validate input range
function validateInputRange(inputElement, min, max) {
    let value = parseFloat(inputElement.value);

    // If not a number, set to minimum
    if (isNaN(value)) {
        inputElement.value = min;
        return;
    }

    // Clamp value to min/max range
    if (value < min) {
        inputElement.value = min;
    } else if (value > max) {
        inputElement.value = max;
    }
}