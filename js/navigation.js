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

// Helper function: search supports partial word matching
// "goku d" matches "Goku & Dragon" because "goku" is in name AND word starts with "d"
// "goku d" does NOT match "Super Saiyan God Goku" because no word starts with "d"
function searchMatches(name, searchTerms) {
    const nameLower = name.toLowerCase();
    if (!searchTerms) return true;
    const terms = searchTerms.split(/\s+/).filter(t => t);
    // Check if all terms appear as word starts (word boundaries)
    // \bterm matches 'term' at the start of a word
    return terms.every(term => {
        // Escape special regex characters
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedTerm}`);
        return regex.test(nameLower);
    });
}

/**
 * Setup tooltip positioning for a card element
 * Uses CSS custom properties to position tooltip above card at viewport level
 */
function setupCardTooltip(card, tooltipText) {
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'card-tooltip';
    tooltip.textContent = tooltipText;
    tooltip.style.display = 'none';
    tooltip.style.pointerEvents = 'none';
    
    card.appendChild(tooltip);
    
    card.addEventListener('mouseenter', () => {
        tooltip.style.display = 'block';
    });
    
    card.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });
}

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
    const footer = document.querySelector('footer');

    if (currentContentView) {
        // Store current container height to prevent layout collapse
        const currentHeight = container.offsetHeight;
        container.style.minHeight = currentHeight + 'px';
        
        // Fade out existing content and footer together
        currentContentView.classList.remove(AppConfig.cssClasses.pageActive);
        if (footer) {
            footer.style.opacity = '0';
        }

        setTimeout(() => {
            // Clear old content and add new content
            container.innerHTML = '';
            container.appendChild(newContent);

            // Trigger reflow to ensure CSS animation fires
            void newContent.offsetWidth;

            // Fade in new content
            newContent.classList.add(AppConfig.cssClasses.pageActive);
            
            // Fade in footer synchronously
            if (footer) {
                footer.style.opacity = '1';
            }
            
            // Remove height constraint to allow content to flow naturally
            container.style.minHeight = '';
            
            NavigationState.currentContentView = newContent;
        }, AppConfig.pageTransitionDuration);
    } else {
        // First page load: no transition needed
        container.innerHTML = '';
        container.appendChild(newContent);
        void newContent.offsetWidth;
        newContent.classList.add(AppConfig.cssClasses.pageActive);
        if (footer) {
            footer.style.opacity = '1';
        }
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
    title.textContent = 'Events';
    container.appendChild(title);



    // Add search bar
    const searchWrapper = createSearchBar('Search events, stages, battles, or enemies...');
    container.appendChild(searchWrapper);

    const grid = document.createElement('div');
    grid.className = 'card-grid';
    grid.id = 'events-grid';

    const events = gameData.events.filter(e => e.visible !== false);

    const renderEvents = (filteredEvents) => {
        grid.innerHTML = '';
        
        filteredEvents.forEach(event => {
            const card = document.createElement('div');
            card.className = 'card';
            
            if (event.image) {
                const img = document.createElement('img');
                img.src = event.image;
                img.alt = event.name || 'Event';
                img.className = 'event-image';
                img.loading = 'lazy';
                img.decoding = 'async';
                img.width = 300;
                img.height = 220;
                card.appendChild(img);
            }
            
            card.addEventListener('click', () => showPage('stages', event.id));
            setupCardTooltip(card, event.name);
            grid.appendChild(card);
        });
    };

    renderEvents(events);
    container.appendChild(grid);

    // Add search functionality with comprehensive filtering
    const searchInput = searchWrapper.querySelector('.search-input');
    searchInput.addEventListener('input', debounce((e) => {
        const query = e.target.value.toLowerCase().trim();
        
        // Search across events, stages, battles, and enemies
        const filtered = events.filter(event => {
            if (searchMatches(event.name, query)) return true;
            
            for (const stage of event.stages || []) {
                if (searchMatches(stage.name, query)) return true;
                
                const battles = getStageBattles(stage);
                for (const battle of battles) {
                    if (searchMatches(battle.name, query)) return true;
                    
                    for (const phase of battle.phases || []) {
                        for (const enemy of phase.enemies || []) {
                            if (searchMatches(enemy.name, query)) return true;
                        }
                    }
                }
            }
            return false;
        });
        
        renderEvents(filtered);
    }, 300));

    const aboutSection = document.createElement('p');
    aboutSection.className = 'seo-about';
    aboutSection.textContent = 'Select an event, go to your phase, and look up enemy ATK values. Switch to My Damage mode to calculate exactly how much damage your character takes — DEF, type matchup, damage reduction, and passive guard all accounted for.';
    container.appendChild(aboutSection);
}

/**
 * Creates a reusable search bar component
 * @param {string} placeholder - Placeholder text for the search input
 * @returns {HTMLElement} Wrapper div containing the search bar
 */
function createSearchBar(placeholder) {
    const wrapper = document.createElement('div');
    wrapper.className = 'search-bar-wrapper';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'search-input';
    input.placeholder = placeholder;
    wrapper.appendChild(input);
    return wrapper;
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
    title.textContent = event.name;
    container.appendChild(title);

    const backButton = document.createElement('button');
    backButton.className = 'back-button';
    backButton.textContent = '← Back to Events';
    backButton.addEventListener('click', () => showPage('events'));
    container.appendChild(backButton);

    const searchWrapper = createSearchBar('Search stages, battles, or enemies...');
    container.appendChild(searchWrapper);

    const grid = document.createElement('div');
    grid.className = 'card-grid';
    grid.id = 'stages-grid';

    const renderStages = (stages) => {
        grid.innerHTML = '';
        
        stages.forEach(stage => {
            const card = document.createElement('div');
            card.className = 'card';
            const cardContent = document.createElement('div');
            cardContent.className = 'card-content';
            
            const nameEl = document.createElement('h3');
            nameEl.style.margin = '0';
            nameEl.textContent = stage.name;
            
            cardContent.appendChild(nameEl);
            card.appendChild(cardContent);

            card.addEventListener('click', () => {
                const battles = getStageBattles(stage);
                if (battles.length === 1) {
                    showPage('enemies', eventId, stage.id, battles[0].id);
                } else {
                    showPage('battles', eventId, stage.id);
                }
            });

            setupCardTooltip(card, stage.name);
            grid.appendChild(card);
        });
    };

    renderStages(event.stages);
    container.appendChild(grid);

    const searchInput = searchWrapper.querySelector('.search-input');
    searchInput.addEventListener('input', debounce((e) => {
        const query = e.target.value.toLowerCase().trim();
        
        // Search stages by name, battles by name, or enemies by name
        const filtered = event.stages.filter(stage => {
            if (searchMatches(stage.name, query)) return true;
            
            const battles = getStageBattles(stage);
            for (const battle of battles) {
                if (searchMatches(battle.name, query)) return true;
                
                for (const phase of battle.phases || []) {
                    for (const enemy of phase.enemies || []) {
                        if (searchMatches(enemy.name, query)) return true;
                    }
                }
            }
            return false;
        });
        
        renderStages(filtered);
    }, 300));
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
    title.textContent = stage.name;
    container.appendChild(title);

    const backButton = document.createElement('button');
    backButton.className = 'back-button';
    backButton.textContent = '← Back to Stages';
    backButton.addEventListener('click', () => showPage('stages', eventId));
    container.appendChild(backButton);

    const searchWrapper = createSearchBar('Search battles or enemies...');
    container.appendChild(searchWrapper);

    const grid = document.createElement('div');
    grid.className = 'card-grid';
    grid.id = 'battles-grid';

    const battles = getStageBattles(stage);

    const renderBattles = (battlesList) => {
        grid.innerHTML = '';
        
        battlesList.forEach(battle => {
            const card = document.createElement('div');
            card.className = 'card';
            const cardContent = document.createElement('div');
            cardContent.className = 'card-content';
            cardContent.style.display = 'flex';
            cardContent.style.alignItems = 'center';
            cardContent.style.justifyContent = 'space-between';
            cardContent.style.width = '100%';
            
            const nameEl = document.createElement('h3');
            nameEl.style.margin = '0';
            nameEl.style.flex = '1';
            nameEl.textContent = battle.name;
            
            cardContent.appendChild(nameEl);
            card.appendChild(cardContent);
            
            card.addEventListener('click', () => showPage('enemies', eventId, stageId, battle.id));
            setupCardTooltip(card, battle.name);
            grid.appendChild(card);
        });
    };

    renderBattles(battles);
    container.appendChild(grid);

    const searchInput = searchWrapper.querySelector('.search-input');
    searchInput.addEventListener('input', debounce((e) => {
        const query = e.target.value.toLowerCase().trim();
        
        // Search battles by name or enemies by name
        const filtered = battles.filter(battle => {
            if (searchMatches(battle.name, query)) return true;
            
            for (const phase of battle.phases || []) {
                for (const enemy of phase.enemies || []) {
                    if (searchMatches(enemy.name, query)) return true;
                }
            }
            return false;
        });
        
        renderBattles(filtered);
    }, 300));
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

    // Create phase-level damage calculator (mode toggle + character inputs)
    // damageResultsSection is appended after enemyFormsContainer so the flow is:
    //   set character → fill enemy inputs → see damage results at bottom
    const { damageResultsSection } = createPhaseDamageCalculator(container, (mode) => {});

    // Create phase selection tabs (single row layout)
    const enemyFormsContainer = document.createElement('div');
    enemyFormsContainer.id = 'enemy-forms-container';

    // Create phase header container with tabs and buttons
    const phaseTabsContainer = document.createElement('div');
    phaseTabsContainer.className = 'phase-tabs-container';

    if (battle.phases.length > 1) {
        // Multi-phase: show all phase tabs in single row
        const phasesRow = document.createElement('div');
        phasesRow.className = 'phases-row';
        phasesRow.style.display = 'flex';
        phasesRow.style.alignItems = 'center';
        phasesRow.style.gap = '10px';
        phasesRow.style.marginBottom = '20px';
        
        battle.phases.forEach((phase, index) => {
            const tab = document.createElement('button');
            tab.className = `phase-tab ${index === 0 ? 'active' : ''}`;
            const phaseNumber = index + 1;
            tab.textContent = `Phase ${phaseNumber}`;
            tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
            tab.dataset.phaseId = phase.id;
            
            tab.addEventListener('click', () => {
                // Update active tab
                document.querySelectorAll('.phase-tab').forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                
                // Update content with smooth animation
                const formsContainer = document.getElementById('enemy-forms-container');
                
                if (formsContainer) {
                    // Simple fade-out, update, fade-in sequence
                    formsContainer.style.opacity = '0';
                    formsContainer.style.transition = 'opacity 0.25s ease-out';
                    
                    // Update content after fade starts
                    setTimeout(() => {
                        displayEnemiesForPhase(formsContainer, phase, battle.phases.length);
                        // Fade back in
                        formsContainer.style.opacity = '1';
                        formsContainer.style.transition = 'opacity 0.35s ease-in';
                    }, 130);
                    
                    // Clean up inline styles after animation completes
                    setTimeout(() => {
                        formsContainer.style.transition = '';
                        formsContainer.style.opacity = '';
                    }, 500);
                }
            });
            
            phasesRow.appendChild(tab);
        });
        

        phaseTabsContainer.appendChild(phasesRow);
    }

    container.appendChild(phaseTabsContainer);
    container.appendChild(enemyFormsContainer);
    container.appendChild(damageResultsSection);

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

    // Clear the shared damage results panel so stale enemy blocks don't linger
    const sharedDamageResults = document.getElementById('damage-results-section')
        || AppConfig.currentDamageResultsSection;
    if (sharedDamageResults) {
        const titleEl = sharedDamageResults.querySelector('p');
        sharedDamageResults.innerHTML = '';
        if (titleEl) sharedDamageResults.appendChild(titleEl);
        // Re-hide until new results are written
        sharedDamageResults.style.display = 'none';
    }

    // Render each enemy in the phase
    phase.enemies.forEach(enemy => {
        if (!enemy.id) {
            console.warn('displayEnemiesForPhase: skipping enemy without id');
            return;
        }

        createEnemyForm(container, enemy);
    });

    // Attach character input listeners (safe even when panel is detached)
    setupCharacterInputListeners();

    // In damage mode the enemy forms are hidden — keep that state after phase switch
    const formsContainer = container;
    if (AppConfig.getMode() === 'damage') {
        formsContainer.style.display = 'none';
        const phaseTabsEl = document.querySelector('.phase-tabs-container');
        if (phaseTabsEl) phaseTabsEl.style.display = 'none';
    } else {
        formsContainer.style.display = '';
    }
}

/**
 * Create a single enemy form with inputs and results display
 * Extracted to reduce function complexity and improve maintainability
 * @param {HTMLElement} container - Parent container to append form to
 * @param {Object} enemy - Enemy data object
 */
function createEnemyForm(container, enemy) {
    const enemyForm = document.createElement('div');
    enemyForm.className = 'enemy-form';
    enemyForm.id = AppConfig.idPatterns.enemy(enemy.id);

    // Add enemy name heading
    const nameHeading = document.createElement('div');
    nameHeading.style.display = 'flex';
    nameHeading.style.alignItems = 'center';
    nameHeading.style.justifyContent = 'center';
    nameHeading.style.marginBottom = '15px';

    const h4 = document.createElement('h4');
    h4.textContent = enemy.name || 'Unknown Enemy';
    h4.style.margin = '0';
    nameHeading.appendChild(h4);
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

    // Create prominent results card
    const resultsCard = document.createElement('div');
    resultsCard.className = 'results-card';
    resultsCard.id = `results-card-${enemy.id}`;
    resultsCard.style.display = 'none'; // Hidden until results are calculated

    const resultsValues = document.createElement('div');
    resultsValues.className = 'results-values';
    resultsValues.id = `results-values-${enemy.id}`;
    resultsCard.appendChild(resultsValues);

    // Create results action buttons
    const resultsActions = document.createElement('div');
    resultsActions.className = 'results-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-copy-results';
    copyBtn.textContent = '📋 Copy Results';
    copyBtn.addEventListener('click', async () => {
        // Gather input values the same way calculateATK does (with defaults applied)
        const inputs = {};
        if (enemy.inputs && Array.isArray(enemy.inputs)) {
            for (const input of enemy.inputs) {
                const inputElement = document.getElementById(AppConfig.idPatterns.input(enemy.id, input.id));
                if (!inputElement) {
                    inputs[input.id] = input.default ?? AppConfig.defaults.emptyInputValue;
                    continue;
                }
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
        const resultsText = formatResultsForClipboard(enemy, resultsValues, inputs);
        await ClipboardOps.copy(resultsText, copyBtn);
    });
    resultsActions.appendChild(copyBtn);

    resultsCard.appendChild(resultsActions);
    enemyForm.appendChild(resultsCard);

    container.appendChild(enemyForm);
    calculateATK(enemy, enemyForm);
}

/**
 * Create phase-level damage calculator interface
 * Allows toggling between ATK and Damage Received modes
 * Character inputs apply to all enemies in the phase
 * @param {HTMLElement} container - Container to append to
 * @param {Object} phase - Phase data object
 * @param {Function} onModeChange - Callback when mode changes
 */
function createPhaseDamageCalculator(container, onModeChange) {
    // Main container — flat section, no card chrome
    const damageCalcContainer = document.createElement('div');
    damageCalcContainer.className = 'phase-damage-calculator';
    damageCalcContainer.id = 'damage-calc-container';
    damageCalcContainer.style.marginBottom = '20px';

    // Mode switcher
    const modeContainer = document.createElement('div');
    modeContainer.style.display = 'flex';
    modeContainer.style.gap = '8px';
    modeContainer.style.marginBottom = '20px';
    modeContainer.style.alignItems = 'center';

    const atkBtn = document.createElement('button');
    atkBtn.className = 'mode-btn mode-atk';
    atkBtn.textContent = '💥 Enemy ATK';
    atkBtn.style.padding = '10px 16px';
    atkBtn.style.background = 'rgba(99, 179, 237, 0.3)';
    atkBtn.style.border = '1.5px solid rgba(99, 179, 237, 0.6)';
    atkBtn.style.color = 'var(--color-accent)';
    atkBtn.style.borderRadius = '6px';
    atkBtn.style.cursor = 'pointer';
    atkBtn.style.fontWeight = '500';
    atkBtn.style.transition = 'all 0.3s ease-out';
    modeContainer.appendChild(atkBtn);

    const dmgBtn = document.createElement('button');
    dmgBtn.className = 'mode-btn mode-damage';
    dmgBtn.textContent = '🛡️ My Damage';
    dmgBtn.style.padding = '10px 16px';
    dmgBtn.style.background = 'rgba(72, 187, 237, 0.15)';
    dmgBtn.style.border = '1.5px solid rgba(72, 187, 237, 0.3)';
    dmgBtn.style.color = 'var(--color-text-muted)';
    dmgBtn.style.borderRadius = '6px';
    dmgBtn.style.cursor = 'pointer';
    dmgBtn.style.fontWeight = '500';
    dmgBtn.style.transition = 'all 0.3s ease-out';
    modeContainer.appendChild(dmgBtn);

    damageCalcContainer.appendChild(modeContainer);

    // Mode explanation banners
    const atkInfoBanner = document.createElement('p');
    atkInfoBanner.className = 'mode-info-banner mode-info-atk';
    atkInfoBanner.textContent = 'You can change any enemy inputs in here, changes will be stored and taken over to "My Damage" mode.';
    atkInfoBanner.style.margin = '0 0 16px 0';
    atkInfoBanner.style.fontSize = '0.82rem';
    atkInfoBanner.style.color = 'var(--color-text-muted)';
    atkInfoBanner.style.lineHeight = '1.5';
    atkInfoBanner.style.padding = '10px 14px';
    atkInfoBanner.style.background = 'rgba(99, 179, 237, 0.07)';
    atkInfoBanner.style.borderRadius = '6px';
    atkInfoBanner.style.border = '1px solid rgba(99, 179, 237, 0.18)';
    damageCalcContainer.appendChild(atkInfoBanner);

    const dmgInfoBanner = document.createElement('p');
    dmgInfoBanner.className = 'mode-info-banner mode-info-dmg';
    dmgInfoBanner.textContent = 'You can change any character inputs in here, changes will be stored for the current session.';
    dmgInfoBanner.style.margin = '0 0 16px 0';
    dmgInfoBanner.style.fontSize = '0.82rem';
    dmgInfoBanner.style.color = 'var(--color-text-muted)';
    dmgInfoBanner.style.lineHeight = '1.5';
    dmgInfoBanner.style.padding = '10px 14px';
    dmgInfoBanner.style.background = 'rgba(72, 187, 237, 0.07)';
    dmgInfoBanner.style.borderRadius = '6px';
    dmgInfoBanner.style.border = '1px solid rgba(72, 187, 237, 0.18)';
    dmgInfoBanner.style.display = 'none';
    damageCalcContainer.appendChild(dmgInfoBanner);

    // Character inputs section (only visible in damage mode)
    const charInputsSection = document.createElement('div');
    charInputsSection.className = 'character-inputs-section';
    charInputsSection.id = 'char-inputs-section';
    charInputsSection.style.display = 'none';

    const charTitle = document.createElement('p');
    charTitle.textContent = 'Your character';
    charTitle.style.margin = '0 0 12px 0';
    charTitle.style.color = 'var(--color-text-muted)';
    charTitle.style.fontSize = '0.8rem';
    charTitle.style.textTransform = 'uppercase';
    charTitle.style.letterSpacing = '0.5px';
    charTitle.style.fontWeight = '600';
    charInputsSection.appendChild(charTitle);

    const charInputsGrid = document.createElement('div');
    charInputsGrid.className = 'char-inputs-grid';
    charInputsGrid.style.display = 'grid';
    charInputsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(160px, 1fr))';
    charInputsGrid.style.gap = '12px';

    const characterInputs = [
        { id: 'char_type', label: 'Type', type: 'select', options: ['STR', 'TEQ', 'INT', 'PHY', 'AGL'], default: 'STR' },
        { id: 'char_class', label: 'Class', type: 'select', options: ['Super', 'Extreme'], default: 'Super' },
        { id: 'char_defense', label: 'DEF', type: 'number', min: 0, max: Infinity, default: 0, step: 1 },
        { id: 'char_damage_reduction', label: 'Damage Reduction (%)', type: 'number', min: 0, max: 100, default: 0, step: 1 },
        { id: 'char_type_def_boost', label: 'Type DEF Boost Lv', type: 'number', min: 0, max: 50, default: 0, step: 1 },
        { id: 'char_stacked_def', label: 'Stacked DEF (%)', tooltip: 'This value is relevant only for def-lowering bosses and includes these special attack effects: "Raises DEF by X%", "Raises allies\' DEF by X%" (this one can come from allies too).', type: 'number', min: 0, max: Infinity, default: 0, step: 1 },
        { id: 'char_passive_guard', label: 'Passive Guard', type: 'checkbox', default: false },
    ];

    // Helper to read a stored session value for a character input
    const getStoredCharValue = (inputId, fallback) => {
        const stored = sessionStorage.getItem('charInput_' + inputId);
        if (stored === null) return fallback;
        if (stored === '__true__') return true;
        if (stored === '__false__') return false;
        return stored;
    };

    characterInputs.forEach(input => {
        const inputGroup = document.createElement('div');
        inputGroup.style.display = 'flex';
        inputGroup.style.flexDirection = 'column';
        inputGroup.style.gap = '6px';

        const label = document.createElement('label');
        label.textContent = input.label;
        label.style.fontSize = '0.8rem';
        label.style.color = 'var(--color-text-muted)';
        label.style.fontWeight = '500';

        // Styled custom tooltip (replaces native title attribute)
        if (input.tooltip) {
            const tipWrap = document.createElement('span');
            tipWrap.style.position = 'relative';
            tipWrap.style.display = 'inline-flex';
            tipWrap.style.alignItems = 'center';
            tipWrap.style.marginLeft = '4px';

            const helpIcon = document.createElement('span');
            helpIcon.textContent = '\u24D8';
            helpIcon.style.cursor = 'help';
            helpIcon.style.color = 'var(--color-accent)';
            helpIcon.style.fontSize = '0.8rem';
            helpIcon.style.lineHeight = '1';
            helpIcon.style.userSelect = 'none';

            const tipBox = document.createElement('span');
            tipBox.textContent = input.tooltip;
            tipBox.style.cssText = [
                'position:absolute',
                'bottom:calc(100% + 6px)',
                'left:50%',
                'transform:translateX(-50%)',
                'width:min(260px, 80vw)',
                'background:#1a202c',
                'color:#e2e8f0',
                'font-size:0.78rem',
                'line-height:1.5',
                'padding:8px 10px',
                'border-radius:6px',
                'border:1px solid rgba(99,179,237,0.25)',
                'box-shadow:0 4px 12px rgba(0,0,0,0.5)',
                'pointer-events:none',
                'opacity:0',
                'z-index:100',
                'white-space:normal',
                'text-align:left',
                'font-weight:400',
                'letter-spacing:normal',
            ].join(';');

            // Desktop: hover; mobile: tap toggle
            helpIcon.addEventListener('mouseenter', () => { tipBox.style.opacity = '1'; });
            helpIcon.addEventListener('mouseleave', () => { tipBox.style.opacity = '0'; });
            helpIcon.addEventListener('touchstart', (e) => {
                e.preventDefault();
                tipBox.style.opacity = tipBox.style.opacity === '1' ? '0' : '1';
            }, { passive: false });
            // Tap anywhere else to dismiss
            document.addEventListener('touchstart', (e) => {
                if (!tipWrap.contains(e.target)) tipBox.style.opacity = '0';
            }, { passive: true });

            tipWrap.appendChild(helpIcon);
            tipWrap.appendChild(tipBox);
            label.appendChild(tipWrap);
        }
        label.style.letterSpacing = '0.2px';

        let inputElement;
        const inputId = input.id;

        if (input.type === 'select') {
            inputElement = document.createElement('select');
            inputElement.id = inputId;
            inputElement.style.backgroundColor = 'var(--color-bg)';
            inputElement.style.border = '1px solid var(--color-border)';
            inputElement.style.borderRadius = '6px';
            inputElement.style.color = 'var(--color-text)';
            inputElement.style.fontFamily = 'inherit';
            inputElement.style.fontSize = '0.9rem';
            inputElement.style.cursor = 'pointer';

            input.options.forEach(opt => {
                const optEl = document.createElement('option');
                optEl.value = opt;
                optEl.textContent = opt;
                inputElement.appendChild(optEl);
            });
            inputElement.value = getStoredCharValue(inputId, input.default);

            inputGroup.appendChild(label);
            inputGroup.appendChild(inputElement);
        } else if (input.type === 'checkbox') {
            // Styled toggle pill for passive guard
            inputGroup.style.flexDirection = 'row';
            inputGroup.style.alignItems = 'center';
            inputGroup.style.gap = '10px';
            inputGroup.style.gridColumn = 'auto';
            inputGroup.style.padding = '8px 12px';
            inputGroup.style.backgroundColor = 'rgba(99, 179, 237, 0.05)';
            inputGroup.style.border = '1px solid rgba(99, 179, 237, 0.2)';
            inputGroup.style.borderRadius = '8px';
            inputGroup.style.cursor = 'pointer';

            const storedChecked = getStoredCharValue(inputId, input.default);
            const isChecked = storedChecked === true || storedChecked === 'true' || storedChecked === '__true__';

            // Hidden real checkbox (for value reading)
            inputElement = document.createElement('input');
            inputElement.type = 'checkbox';
            inputElement.id = inputId;
            inputElement.checked = isChecked;
            inputElement.style.position = 'absolute';
            inputElement.style.opacity = '0';
            inputElement.style.pointerEvents = 'none';
            inputElement.style.width = '0';
            inputElement.style.height = '0';

            // Visual toggle track
            const toggleTrack = document.createElement('div');
            toggleTrack.className = 'char-toggle-track';
            toggleTrack.style.flexShrink = '0';
            toggleTrack.style.width = '40px';
            toggleTrack.style.height = '22px';
            toggleTrack.style.borderRadius = '11px';
            toggleTrack.style.border = '1.5px solid rgba(99, 179, 237, 0.5)';
            toggleTrack.style.backgroundColor = isChecked ? 'rgba(99, 179, 237, 0.6)' : 'rgba(45, 55, 72, 0.8)';
            toggleTrack.style.position = 'relative';
            toggleTrack.style.transition = 'background-color 0.2s ease';
            toggleTrack.style.cursor = 'pointer';

            const toggleThumb = document.createElement('div');
            toggleThumb.style.position = 'absolute';
            toggleThumb.style.top = '2px';
            toggleThumb.style.left = isChecked ? '18px' : '2px';
            toggleThumb.style.width = '16px';
            toggleThumb.style.height = '16px';
            toggleThumb.style.borderRadius = '50%';
            toggleThumb.style.backgroundColor = isChecked ? '#63b3ed' : '#a0aec0';
            toggleThumb.style.transition = 'left 0.2s ease, background-color 0.2s ease';
            toggleTrack.appendChild(toggleThumb);

            // Label text
            label.style.textTransform = 'none';
            label.style.letterSpacing = 'normal';
            label.style.margin = '0';
            label.style.cursor = 'pointer';
            label.style.userSelect = 'none';
            label.style.fontSize = '0.9rem';
            label.style.color = isChecked ? 'var(--color-accent)' : 'var(--color-text-muted)';
            label.style.fontWeight = isChecked ? '600' : '500';
            label.style.transition = 'color 0.2s ease, font-weight 0.2s ease';
            label.htmlFor = inputId;

            const updateToggle = (checked) => {
                inputElement.checked = checked;
                toggleTrack.style.backgroundColor = checked ? 'rgba(99, 179, 237, 0.6)' : 'rgba(45, 55, 72, 0.8)';
                toggleThumb.style.left = checked ? '18px' : '2px';
                toggleThumb.style.backgroundColor = checked ? '#63b3ed' : '#a0aec0';
                label.style.color = checked ? 'var(--color-accent)' : 'var(--color-text-muted)';
                label.style.fontWeight = checked ? '600' : '500';
                inputGroup.style.backgroundColor = checked ? 'rgba(99, 179, 237, 0.12)' : 'rgba(99, 179, 237, 0.05)';
                inputGroup.style.borderColor = checked ? 'rgba(99, 179, 237, 0.45)' : 'rgba(99, 179, 237, 0.2)';
            };

            inputGroup.addEventListener('click', () => {
                updateToggle(!inputElement.checked);
                inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            });

            inputGroup.appendChild(inputElement);
            inputGroup.appendChild(toggleTrack);
            inputGroup.appendChild(label);

            charInputsGrid.appendChild(inputGroup);
            return; // already appended
        } else {
            inputElement = document.createElement('input');
            inputElement.type = input.type;
            inputElement.id = inputId;
            inputElement.placeholder = input.default;
            inputElement.min = input.min;
            inputElement.max = input.max;
            inputElement.step = input.step || 1;
            // Restore session value
            const storedVal = getStoredCharValue(inputId, null);
            if (storedVal !== null && storedVal !== input.default.toString()) {
                inputElement.value = storedVal;
            }
            inputElement.style.padding = '10px';
            inputElement.style.backgroundColor = 'var(--color-bg)';
            inputElement.style.border = '1px solid var(--color-border)';
            inputElement.style.borderRadius = '6px';
            inputElement.style.color = 'var(--color-text)';
            inputElement.style.fontFamily = 'inherit';
            inputElement.style.fontSize = '0.9rem';
            // Remove spinners for numeric inputs
            inputElement.style.MozAppearance = 'textfield';

            inputGroup.appendChild(label);
            inputGroup.appendChild(inputElement);
        }

        charInputsGrid.appendChild(inputGroup);
    });

    charInputsSection.appendChild(charInputsGrid);

    // DEF note — always visible in damage mode
    const defNote = document.createElement('p');
    defNote.style.cssText = 'margin:12px 0 0 0;font-size:0.75rem;color:var(--color-text-muted);line-height:1.5;';
    defNote.innerHTML = '\u24D8 The defense shown in battle is not always accurate. Calculate yours at <a href="https://dokkanstats.com/en/defcalculator/" target="_blank" rel="noopener noreferrer" style="color:var(--color-accent);text-decoration:underline">dokkanstats.com</a>.';
    charInputsSection.appendChild(defNote);

    damageCalcContainer.appendChild(charInputsSection);

    // Damage results section — start hidden, revealed by displayDamageResults once results exist
    const damageResultsSection = document.createElement('div');
    damageResultsSection.className = 'phase-damage-results';
    damageResultsSection.id = 'damage-results-section';
    damageResultsSection.style.display = 'none';
    damageResultsSection.style.marginTop = '32px';
    damageResultsSection.style.paddingTop = '24px';
    damageResultsSection.style.borderTop = '1px solid rgba(99, 179, 237, 0.15)';

    const damageTitle = document.createElement('p');
    damageTitle.textContent = 'Damage you\'ll take';
    damageTitle.style.margin = '0 0 16px 0';
    damageTitle.style.color = 'var(--color-text-muted)';
    damageTitle.style.fontSize = '0.8rem';
    damageTitle.style.textTransform = 'uppercase';
    damageTitle.style.letterSpacing = '0.5px';
    damageTitle.style.fontWeight = '600';
    damageResultsSection.appendChild(damageTitle);

    container.appendChild(damageCalcContainer);
    // damageResultsSection is returned and appended by the caller, after enemy forms

    // Store direct refs so calculator functions can reach these elements
    // even before performPageTransition adds the page to the document.
    AppConfig.currentDamageResultsSection = damageResultsSection;
    AppConfig.currentCharInputsSection = charInputsSection;

    // Helper to apply ATK mode visual state
    const applyAtkStyle = () => {
        atkBtn.style.background = 'rgba(99, 179, 237, 0.3)';
        atkBtn.style.borderColor = 'rgba(99, 179, 237, 0.6)';
        atkBtn.style.color = 'var(--color-accent)';
        atkBtn.classList.add('active');
        dmgBtn.style.background = 'rgba(72, 187, 237, 0.15)';
        dmgBtn.style.borderColor = 'rgba(72, 187, 237, 0.3)';
        dmgBtn.style.color = 'var(--color-text-muted)';
        dmgBtn.classList.remove('active');
    };

    // Helper to apply Damage mode visual state
    const applyDmgStyle = () => {
        dmgBtn.style.background = 'rgba(72, 187, 237, 0.3)';
        dmgBtn.style.borderColor = 'rgba(72, 187, 237, 0.6)';
        dmgBtn.style.color = 'var(--color-accent)';
        dmgBtn.classList.add('active');
        atkBtn.style.background = 'rgba(99, 179, 237, 0.15)';
        atkBtn.style.borderColor = 'rgba(99, 179, 237, 0.3)';
        atkBtn.style.color = 'var(--color-text-muted)';
        atkBtn.classList.remove('active');
    };

    // Mode switching logic - START IN ATK MODE
    AppConfig.setMode('atk');
    charInputsSection.style.display = 'none';
    atkInfoBanner.style.display = '';
    dmgInfoBanner.style.display = 'none';
    applyAtkStyle();

    atkBtn.addEventListener('click', () => {
        if (AppConfig.getMode() === 'atk') return;
        AppConfig.setMode('atk');
        charInputsSection.style.display = 'none';
        damageResultsSection.style.display = 'none';
        atkInfoBanner.style.display = '';
        dmgInfoBanner.style.display = 'none';
        applyAtkStyle();

        const formsContainer = document.getElementById('enemy-forms-container') || document.querySelector('#enemy-forms-container');
        if (formsContainer) {
            formsContainer.style.display = ''; // restore CSS flex layout
            formsContainer.querySelectorAll('.results-card').forEach(card => card.style.display = 'block');
            formsContainer.querySelectorAll('[id^="enemy-form-"]').forEach(enemyForm => {
                const enemy = findEnemyById(enemyForm.id.replace('enemy-form-', ''));
                if (enemy) calculateATK(enemy, enemyForm);
            });
        }

        // Show phase tabs in ATK mode
        const phaseTabsEl = document.querySelector('.phase-tabs-container');
        if (phaseTabsEl) phaseTabsEl.style.display = '';

        if (onModeChange) onModeChange('atk');
    });

    dmgBtn.addEventListener('click', () => {
        if (AppConfig.getMode() === 'damage') return;
        AppConfig.setMode('damage');
        charInputsSection.style.display = 'block';
        damageResultsSection.style.display = 'block';
        atkInfoBanner.style.display = 'none';
        dmgInfoBanner.style.display = '';
        applyDmgStyle();

        const formsContainer = document.getElementById('enemy-forms-container');
        if (formsContainer) {
            formsContainer.style.display = 'none'; // hide enemy forms — not needed in damage mode
            formsContainer.querySelectorAll('[id^="enemy-form-"]').forEach(enemyForm => {
                const enemy = findEnemyById(enemyForm.id.replace('enemy-form-', ''));
                if (enemy) calculateDamage(enemy);
            });
        }

        // Hide phase tabs in damage mode — not relevant
        const phaseTabsEl = document.querySelector('.phase-tabs-container');
        if (phaseTabsEl) phaseTabsEl.style.display = 'none';

        if (onModeChange) onModeChange('damage');
    });

    return { damageCalcContainer, charInputsSection, damageResultsSection };
}

/**
 * Format results for clipboard copying with input conditions
 * @param {Object} enemy - Enemy data
 * @param {HTMLElement} resultsValuesContainer - Container with result values
 * @param {Object} inputs - Input values used for calculation
 * @returns {string} Formatted results text
 */
function formatResultsForClipboard(enemy, resultsValuesContainer, inputs) {
    const lines = [];
    lines.push('═══════════════════════════════════');
    lines.push(`  ${enemy.name}`);
    lines.push('═══════════════════════════════════');
    lines.push('');
    
    // Add input conditions with better formatting
    if (enemy.inputs && Array.isArray(enemy.inputs) && enemy.inputs.length > 0) {
        lines.push('📋 CONDITIONS USED:');
        for (const input of enemy.inputs) {
            const value = inputs[input.id];
            if (value !== null && value !== undefined) {
                if (typeof value === 'boolean') {
                    lines.push(`   • ${input.label}: ${value ? '✓ Yes' : '✗ No'}`);
                } else {
                    lines.push(`   • ${input.label}: ${value}`);
                }
            }
        }
        lines.push('');
    }
    
    lines.push('💥 ATTACK RESULTS:');
    
    // Extract values from the results card
    const resultItems = resultsValuesContainer.querySelectorAll('.result-value');
    resultItems.forEach(item => {
        const label = item.querySelector('.result-value-label')?.textContent || '';
        const amount = item.querySelector('.result-value-amount')?.textContent || '0';
        if (label) {
            lines.push(`   • ${label}: ${amount}`);
        }
    });
    
    lines.push('');
    lines.push('═══════════════════════════════════');
    lines.push('📊 Dokkan Battle ATK Calculator');
    lines.push('💻 dokkan-battle-atk-calculator.netlify.app');
    lines.push('═══════════════════════════════════');
    
    return lines.join('\n');
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
        // Toggle-style checkbox for enemy-specific boolean inputs
        const toggleRow = document.createElement('div');
        toggleRow.style.display = 'flex';
        toggleRow.style.alignItems = 'center';
        toggleRow.style.gap = '10px';
        toggleRow.style.padding = '8px 10px';
        toggleRow.style.backgroundColor = 'rgba(99, 179, 237, 0.05)';
        toggleRow.style.border = '1px solid rgba(99, 179, 237, 0.15)';
        toggleRow.style.borderRadius = '8px';
        toggleRow.style.cursor = 'pointer';
        toggleRow.style.width = '100%';

        const isChecked = input.default || false;

        const hiddenCheck = document.createElement('input');
        hiddenCheck.type = 'checkbox';
        hiddenCheck.id = AppConfig.idPatterns.input(enemy.id, input.id);
        hiddenCheck.checked = isChecked;
        hiddenCheck.style.position = 'absolute';
        hiddenCheck.style.opacity = '0';
        hiddenCheck.style.pointerEvents = 'none';
        hiddenCheck.style.width = '0';
        hiddenCheck.style.height = '0';

        const track = document.createElement('div');
        track.style.flexShrink = '0';
        track.style.width = '36px';
        track.style.height = '20px';
        track.style.borderRadius = '10px';
        track.style.border = '1.5px solid rgba(99, 179, 237, 0.5)';
        track.style.backgroundColor = isChecked ? 'rgba(99, 179, 237, 0.6)' : 'rgba(45, 55, 72, 0.8)';
        track.style.position = 'relative';
        track.style.transition = 'background-color 0.2s';

        const thumb = document.createElement('div');
        thumb.style.position = 'absolute';
        thumb.style.top = '2px';
        thumb.style.left = isChecked ? '16px' : '2px';
        thumb.style.width = '14px';
        thumb.style.height = '14px';
        thumb.style.borderRadius = '50%';
        thumb.style.backgroundColor = isChecked ? '#63b3ed' : '#a0aec0';
        thumb.style.transition = 'left 0.2s, background-color 0.2s';
        track.appendChild(thumb);

        const toggleLabel = document.createElement('span');
        toggleLabel.textContent = input.label;
        toggleLabel.style.fontSize = '0.85rem';
        toggleLabel.style.color = isChecked ? 'var(--color-text)' : 'var(--color-text-muted)';
        toggleLabel.style.userSelect = 'none';
        toggleLabel.style.lineHeight = '1.3';
        toggleLabel.style.transition = 'color 0.2s';

        const updateToggle = (checked) => {
            hiddenCheck.checked = checked;
            track.style.backgroundColor = checked ? 'rgba(99, 179, 237, 0.6)' : 'rgba(45, 55, 72, 0.8)';
            thumb.style.left = checked ? '16px' : '2px';
            thumb.style.backgroundColor = checked ? '#63b3ed' : '#a0aec0';
            toggleLabel.style.color = checked ? 'var(--color-text)' : 'var(--color-text-muted)';
            toggleRow.style.backgroundColor = checked ? 'rgba(99, 179, 237, 0.1)' : 'rgba(99, 179, 237, 0.05)';
            toggleRow.style.borderColor = checked ? 'rgba(99, 179, 237, 0.35)' : 'rgba(99, 179, 237, 0.15)';
        };

        toggleRow.addEventListener('click', () => {
            updateToggle(!hiddenCheck.checked);
            hiddenCheck.dispatchEvent(new Event('change', { bubbles: true }));
        });

        hiddenCheck.addEventListener('change', () => calculateATK(enemy));

        toggleRow.appendChild(hiddenCheck);
        toggleRow.appendChild(track);
        toggleRow.appendChild(toggleLabel);
        formGroup.appendChild(toggleRow);
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