/**
 * Navigation Module - Single Page Application Routing
 * 
 * Manages page navigation, state, and dynamic UI rendering
 * All magic numbers and selectors are in AppConfig for maintainability
 */

/**
 * Application state manager
 * Centralizes and tracks navigation state for cleaner code
 */
const NavigationState = {
    currentPage: 'events',
    currentEventId: null,
    currentStageId: null,
    currentBattleId: null,
    currentContentView: null,

    update(updates) {
        Object.assign(this, updates);
    },

    reset() {
        this.currentPage = 'events';
        this.currentEventId = null;
        this.currentStageId = null;
        this.currentBattleId = null;
    }
};

// State object properly initialized
/**
 * Retrieves battles from a stage, with fallback to legacy phases structure
 * Ensures backward compatibility with older data format
 * @param {Object} stage - Stage object from gameData (can have battles or phases)
 * @returns {Array} Array of battle objects
 */
function getStageBattles(stage) {
    if (!stage) {
        console.warn('getStageBattles called with null/undefined stage');
        return [];
    }

    // Modern format: stages have battles array
    if (stage.battles && Array.isArray(stage.battles) && stage.battles.length > 0) {
        return stage.battles;
    }

    // Legacy format: stages have phases array directly
    if (stage.phases && Array.isArray(stage.phases) && stage.phases.length > 0) {
        return [{ id: 'legacy-battle', name: 'Battle', phases: stage.phases }];
    }

    return [];
}

/**
 * Check if current selected stage has only one battle
 * Used to skip battle selection page when unnecessary
 * @returns {boolean} True if stage has exactly one battle
 */
function isSingleBattleStage() {
    const { currentEventId, currentStageId } = NavigationState;

    if (!currentEventId || !currentStageId) {
        return false;
    }

    const event = gameData.events?.find(e => e.id === currentEventId);
    const stage = event?.stages?.find(s => s.id === currentStageId);

    if (!stage) {
        return false;
    }

    return getStageBattles(stage).length === 1;
}

/**
 * Main SPA router - displays pages with smooth fade transitions
 * Manages state and renders appropriate content based on page type
 * @param {string} page - Page type: 'events', 'stages', 'battles', 'enemies'
 * @param {string|null} eventId - Selected event ID
 * @param {string|null} stageId - Selected stage ID
 * @param {string|null} battleId - Selected battle ID
 */
function showPage(page, eventId = null, stageId = null, battleId = null) {
    // Validate page type
    const validPages = ['events', 'stages', 'battles', 'enemies'];
    if (!validPages.includes(page)) {
        console.warn(`Invalid page type: ${page}. Defaulting to 'events'`);
        page = 'events';
    }

    // Update navigation state
    NavigationState.update({
        currentPage: page,
        currentEventId: eventId,
        currentStageId: stageId,
        currentBattleId: battleId
    });

    // Update breadcrumb and get content container
    updateBreadcrumb();
    const contentDiv = AppConfig.getContentContainer();

    if (!contentDiv) {
        console.error('Content container not found in DOM');
        return;
    }

    // Create new page content
    const newContent = document.createElement('div');
    newContent.className = AppConfig.cssClasses.pageContent;

    // Render content based on page type
    switch (page) {
        case 'events':
            showEventsPage(newContent);
            break;
        case 'stages':
            showStagesPage(newContent, eventId);
            break;
        case 'battles':
            showBattlesPage(newContent, eventId, stageId);
            break;
        case 'enemies':
            showEnemiesPage(newContent, eventId, stageId, battleId);
            break;
    }

    // Perform page transition with fade effect
    performPageTransition(contentDiv, newContent);
}

/**
 * Handle page transition animation with fade in/out
 * @param {HTMLElement} container - Parent container for content
 * @param {HTMLElement} newContent - New content to display
 */
function performPageTransition(container, newContent) {
    const { currentContentView } = NavigationState;

    if (currentContentView) {
        // Fade out existing content
        currentContentView.classList.remove(AppConfig.cssClasses.pageActive);

        setTimeout(() => {
            container.innerHTML = '';
            container.appendChild(newContent);

            // Trigger reflow to ensure CSS animation fires
            void newContent.offsetWidth;

            // Fade in new content
            newContent.classList.add(AppConfig.cssClasses.pageActive);
            NavigationState.currentContentView = newContent;
        }, AppConfig.pageTransitionDuration);
    } else {
        // First page load: no transition needed
        container.innerHTML = '';
        container.appendChild(newContent);
        void newContent.offsetWidth;
        newContent.classList.add(AppConfig.cssClasses.pageActive);
        NavigationState.currentContentView = newContent;
    }
}

/**
 * Update breadcrumb navigation based on current page state
 * Builds: Home > Event > Stage > Battle (with smart linking)
 */
function updateBreadcrumb() {
    const breadcrumbDiv = AppConfig.getBreadcrumbContainer();
    if (!breadcrumbDiv) {
        console.warn('Breadcrumb container not found');
        return;
    }

    const { currentPage, currentEventId, currentStageId, currentBattleId } = NavigationState;

    let html = '<a href="#" onclick="showPage(\'events\')">Home</a>';

    // Add event link if not on home page
    if (currentPage !== 'events' && currentEventId) {
        const event = gameData.events?.find(e => e.id === currentEventId);
        if (event) {
            html += ` &gt; <a href="#" onclick="showPage('stages', '${currentEventId}')">${escapeHtml(event.name)}</a>`;
        }
    }

    // Add stage link if viewing battles or enemies
    if ((currentPage === 'battles' || currentPage === 'enemies') && currentEventId && currentStageId) {
        const event = gameData.events?.find(e => e.id === currentEventId);
        const stage = event?.stages?.find(s => s.id === currentStageId);

        if (stage) {
            const battles = getStageBattles(stage);
            // Only link to battles page if there are multiple battles
            if (battles.length > 1) {
                html += ` &gt; <a href="#" onclick="showPage('battles', '${currentEventId}', '${currentStageId}')">${escapeHtml(stage.name)}</a>`;
            } else {
                html += ` &gt; ${escapeHtml(stage.name)}`;
            }
        }
    }

    // Add battle name if viewing enemies (no link, just text)
    if (currentPage === 'enemies' && currentBattleId && !isSingleBattleStage()) {
        const event = gameData.events?.find(e => e.id === currentEventId);
        const stage = event?.stages?.find(s => s.id === currentStageId);
        const battle = stage ? getStageBattles(stage).find(b => b.id === currentBattleId) : null;

        if (battle) {
            html += ` &gt; ${escapeHtml(battle.name)}`;
        }
    }

    breadcrumbDiv.innerHTML = html;
}

/**
 * Safely escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Renders the event selection page
 * Displays all available events as clickable image cards
 * @param {HTMLElement} container - DOM element to render events into
 */
function showEventsPage(container) {
    const title = document.createElement('h2');
    title.textContent = 'Choose Event';
    container.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'card-grid';

    gameData.events.forEach(event => {
        const card = document.createElement('div');
        card.className = 'card';
        
        // Display event image
        if (event.image) {
            const img = document.createElement('img');
            img.src = event.image;
            img.alt = event.name || 'Event';
            img.className = 'event-image';
            img.loading = 'lazy';
            img.decoding = 'async';
            card.appendChild(img);
        }
        
        card.addEventListener('click', () => showPage('stages', event.id));
        grid.appendChild(card);
    });

    container.appendChild(grid);
}

/**
 * Renders the stage selection page for a chosen event
 * Displays all stages within the event as clickable cards
 * @param {HTMLElement} container - DOM element to render stages into
 * @param {string} eventId - ID of the selected event
 */
function showStagesPage(container, eventId) {
    const event = gameData.events.find(e => e.id === eventId);
    if (!event) {
        console.error('Event not found:', eventId);
        return;
    }

    const title = document.createElement('h2');
    title.textContent = `${escapeHtml(event.name)} – Choose Stage`;
    container.appendChild(title);

    const backButton = document.createElement('button');
    backButton.className = 'back-button';
    backButton.textContent = '← Back to Events';
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

        // When stage clicked: check number of battles
        card.addEventListener('click', () => {
            const battles = getStageBattles(stage);
            if (battles.length === 1) {
                // Only one battle → go directly to enemies page with that battle
                showPage('enemies', eventId, stage.id, battles[0].id);
            } else {
                // multiple battles → show battle selection
                showPage('battles', eventId, stage.id);
            }
        });

        grid.appendChild(card);
    });

    container.appendChild(grid);
}

/**
 * Renders the battle selection page for a given stage
 * Displayed only when a stage has multiple battles
 * @param {HTMLElement} container - DOM element to render battles into
 * @param {string} eventId - ID of selected event
 * @param {string} stageId - ID of selected stage
 */
function showBattlesPage(container, eventId, stageId) {
    const event = gameData.events.find(e => e.id === eventId);
    const stage = event?.stages.find(s => s.id === stageId);
    if (!stage) return;

    const title = document.createElement('h2');
    title.textContent = `${stage.name} – Choose Battle`;
    container.appendChild(title);

    const backBtn = document.createElement('button');
    backBtn.className = 'back-button';
    backBtn.textContent = '← Back to Stages';
    backBtn.addEventListener('click', () => showPage('stages', eventId));
    container.appendChild(backBtn);

    const grid = document.createElement('div');
    grid.className = 'card-grid';

    const battles = getStageBattles(stage);
    battles.forEach(battle => {
        const card = document.createElement('div');
        card.className = 'card';
        const cardContent = document.createElement('div');
        cardContent.className = 'card-content';
        cardContent.innerHTML = `<h3>${battle.name}</h3>`;
        card.appendChild(cardContent);
        card.addEventListener('click', () => showPage('enemies', eventId, stageId, battle.id));
        grid.appendChild(card);
    });

    container.appendChild(grid);
}

/**
 * Renders the enemies page with optional phase selection dropdown
 * Displays enemy ATK calculation forms; dropdown only shown for multi-phase battles
 * @param {HTMLElement} container - DOM element to render enemies into
 * @param {string} eventId - ID of selected event
 * @param {string} stageId - ID of selected stage
 * @param {string} battleId - ID of selected battle
 */
function showEnemiesPage(container, eventId, stageId, battleId) {
    const event = gameData.events.find(e => e.id === eventId);
    const stage = event?.stages.find(s => s.id === stageId);
    if (!stage) return;

    const battles = getStageBattles(stage);
    const battle = battles.find(b => b.id === battleId) || battles[0]; // fallback
    if (!battle) return;

    const singleBattle = battles.length === 1;   // ← flag for single battle

    // Clear the container first
    container.innerHTML = '';

    const title = document.createElement('h2');
    if (singleBattle) {
        title.textContent = `${event.name} – ${stage.name}`;
    } else {
        title.textContent = `${event.name} – ${stage.name} · ${battle.name}`;
    }
    container.appendChild(title);

    const backButton = document.createElement('button');
    backButton.className = 'back-button';
    backButton.textContent = singleBattle ? '← Back to Stages' : '← Back to Battles';
    backButton.addEventListener('click', () => {
        if (singleBattle) {
            showPage('stages', eventId);
        } else {
            showPage('battles', eventId, stageId);
        }
    });
    container.appendChild(backButton);

    // Create phase selection dropdown only if there's more than one phase
    const enemyFormsContainer = document.createElement('div');
    enemyFormsContainer.id = 'enemy-forms-container';

    if (battle.phases.length > 1) {
        const phaseSelectContainer = document.createElement('div');
        phaseSelectContainer.className = 'phase-select-container';

        const phaseLabel = document.createElement('label');
        phaseLabel.textContent = 'Select Phase:';
        phaseLabel.setAttribute('for', 'phase-select');

        const phaseSelect = document.createElement('select');
        phaseSelect.id = 'phase-select';

        battle.phases.forEach(phase => {
            const opt = document.createElement('option');
            opt.value = phase.id;
            opt.textContent = phase.name;
            phaseSelect.appendChild(opt);
        });

        // Event listener for phase selection
        phaseSelect.addEventListener('change', function () {
            const selectedPhaseId = this.value;
            const selectedPhase = battle.phases.find(p => p.id === selectedPhaseId);
            const container = document.getElementById('enemy-forms-container');
            if (container) {
                container.classList.add('fade-out');
            }

            // Wait for animation to complete before changing content
            setTimeout(() => {
                displayEnemiesForPhase(container, selectedPhase, battle.phases.length);

                // Add fade-in animation
                container.classList.remove('fade-out');
                container.classList.add('fade-in');

                // Remove animation class after completion
                setTimeout(() => {
                    container.classList.remove('fade-in');
                }, AppConfig.pageTransitionDuration);
            }, AppConfig.pageTransitionDuration);
        });

        phaseSelectContainer.appendChild(phaseLabel);
        phaseSelectContainer.appendChild(phaseSelect);
        container.appendChild(phaseSelectContainer);
    }
    container.appendChild(enemyFormsContainer);

    // Display enemies for the first phase by default
    if (battle.phases.length > 0) {
        displayEnemiesForPhase(enemyFormsContainer, battle.phases[0], battle.phases.length);
    }
}

/**
 * Renders enemy ATK calculation forms for a specific phase
 * Creates input fields and output containers based on enemy definitions
 * Only shows phase title if there are multiple phases in the battle
 * @param {HTMLElement} container - DOM element to render enemies into
 * @param {Object} phase - Phase object containing array of enemies
 * @param {number} totalPhases - Total number of phases (determines if title is shown)
 */
function displayEnemiesForPhase(container, phase, totalPhases = 1) {
    if (!container) {
        console.error('displayEnemiesForPhase: container is required');
        return;
    }

    if (!phase || !Array.isArray(phase.enemies)) {
        console.warn('displayEnemiesForPhase: phase or phase.enemies is missing/invalid');
        return;
    }

    // Clear previous content
    container.innerHTML = '';

    // Render each enemy in the phase
    phase.enemies.forEach(enemy => {
        if (!enemy.id) {
            console.warn('displayEnemiesForPhase: skipping enemy without id');
            return;
        }

        createEnemyForm(container, enemy);
    });
}

/**
 * Create a single enemy form with inputs and results display
 * Extracted to reduce function complexity and improve maintainability
 * @param {HTMLElement} container - Parent container to append form to
 * @param {Object} enemy - Enemy data object
 */
function createEnemyForm(container, enemy) {
    // Create enemy form wrapper
    const enemyForm = document.createElement('div');
    enemyForm.className = 'enemy-form';
    enemyForm.id = AppConfig.idPatterns.enemy(enemy.id);

    // Add enemy name heading
    const nameHeading = document.createElement('h4');
    nameHeading.textContent = enemy.name || 'Unknown Enemy';
    enemyForm.appendChild(nameHeading);

    // Create image container with card artwork and overlays
    const imgContainer = createEnemyImageContainer(enemy);
    enemyForm.appendChild(imgContainer);

    // Create input fields section
    const formGroup = document.createElement('div');
    if (enemy.inputs && Array.isArray(enemy.inputs)) {
        enemy.inputs.forEach(input => {
            const inputElement = createInputField(enemy, input);
            if (inputElement) {
                formGroup.appendChild(inputElement);
            }
        });
    }

    if (formGroup.children.length > 0) {
        enemyForm.appendChild(formGroup);
    }

    // Create results display section
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'results-container';
    if (enemy.outputs && Array.isArray(enemy.outputs)) {
        enemy.outputs.forEach(output => {
            const resultDiv = document.createElement('div');
            resultDiv.id = AppConfig.idPatterns.output(enemy.id, output.id);
            resultDiv.className = 'result';
            resultDiv.textContent = `${output.label || 'Result'}: 0`;
            resultsContainer.appendChild(resultDiv);
        });
    }

    if (resultsContainer.children.length > 0) {
        enemyForm.appendChild(resultsContainer);
    }

    container.appendChild(enemyForm);

    // Trigger initial calculation
    setTimeout(() => calculateATK(enemy), AppConfig.retryCheckDelay);
}

/**
 * Create the image container with card art and icon overlays
 * @param {Object} enemy - Enemy data object
 * @returns {HTMLElement} Image container element
 */
function createEnemyImageContainer(enemy) {
    const imgContainer = document.createElement('div');
    imgContainer.className = 'enemy-image-container';

    // Add background frame image if provided
    if (enemy.background) {
        const bgImg = document.createElement('img');
        bgImg.src = enemy.background;
        bgImg.alt = 'card frame';
        bgImg.className = 'enemy-bg';
        bgImg.loading = 'lazy';
        bgImg.decoding = 'async';
        imgContainer.appendChild(bgImg);
    }

    // Add main character image
    const mainImg = document.createElement('img');
    mainImg.src = enemy.image || '';
    mainImg.alt = enemy.name || 'character';
    mainImg.className = 'enemy-image';
    mainImg.loading = 'lazy';
    mainImg.decoding = 'async';
    imgContainer.appendChild(mainImg);

    // Add type icon overlay
    if (enemy.typeIcon) {
        const typeImg = document.createElement('img');
        typeImg.src = enemy.typeIcon;
        typeImg.alt = 'type';
        typeImg.className = 'enemy-type';
        typeImg.loading = 'lazy';
        typeImg.decoding = 'async';
        imgContainer.appendChild(typeImg);
    }

    // Add rarity icon overlay
    if (enemy.rarityIcon) {
        const rarityImg = document.createElement('img');
        rarityImg.src = enemy.rarityIcon;
        rarityImg.alt = 'rarity';
        rarityImg.className = 'enemy-rarity';
        rarityImg.loading = 'lazy';
        rarityImg.decoding = 'async';
        imgContainer.appendChild(rarityImg);
    }

    return imgContainer;
}

/**
 * Create a single input field (number, text, or checkbox)
 * @param {Object} enemy - Enemy data object
 * @param {Object} input - Input definition from enemy.inputs
 * @returns {HTMLElement|null} Form group element or null if invalid
 */
function createInputField(enemy, input) {
    if (!input.id || !input.label) {
        console.warn(`Invalid input definition for enemy ${enemy.id}`);
        return null;
    }

    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';

    if (input.type === 'checkbox') {
        // Checkbox input with label above
        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'checkbox-container';

        const textLabel = document.createElement('span');
        textLabel.className = 'checkbox-text';
        textLabel.textContent = input.label;

        const checkboxInput = document.createElement('input');
        checkboxInput.type = 'checkbox';
        checkboxInput.id = AppConfig.idPatterns.input(enemy.id, input.id);
        checkboxInput.checked = input.default || false;

        checkboxInput.addEventListener('change', function () {
            calculateATK(enemy);
        });

        checkboxContainer.appendChild(textLabel);
        checkboxContainer.appendChild(checkboxInput);
        formGroup.appendChild(checkboxContainer);
    } else {
        // Text/number input with label
        const label = document.createElement('label');
        label.htmlFor = AppConfig.idPatterns.input(enemy.id, input.id);
        label.textContent = input.label;

        const inputElement = document.createElement('input');
        inputElement.type = input.type || 'text';
        inputElement.id = AppConfig.idPatterns.input(enemy.id, input.id);

        // Use placeholder instead of pre-filling the value
        if (input.type === 'number') {
            const min = input.min !== undefined ? input.min : '';
            const max = input.max !== undefined ? input.max : '';
            inputElement.placeholder = (min !== '' && max !== '') ? `${min} – ${max}` : (input.default ?? '');
            if (input.min !== undefined) inputElement.min = input.min;
            if (input.max !== undefined) inputElement.max = input.max;
        } else {
            inputElement.placeholder = input.default ?? '';
        }

        // Setup validation for number inputs
        if (input.type === 'number' && input.min !== undefined && input.max !== undefined) {
            setupInputValidation(
                inputElement,
                input.min,
                input.max,
                input.default || 0,
                enemy
            );
        } else if (input.type === 'number') {
            // Simple change listener for number inputs without constraints
            inputElement.addEventListener('change', function () {
                calculateATK(enemy);
            });
        }

        formGroup.appendChild(label);
        formGroup.appendChild(inputElement);
    }

    return formGroup;
}