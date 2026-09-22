function getAllBossEntries() {
    const entries = [];
    for (const event of gameData.events || []) {
        for (const stage of event.stages || []) {
            const battles = stage.battles && stage.battles.length
                ? stage.battles
                : [{ id: 'legacy-battle', name: 'Battle', phases: stage.phases || [] }];
            for (const battle of battles) {
                for (const phase of battle.phases || []) {
                    for (const enemy of phase.enemies || []) {
                        entries.push({ event, stage, battle, phase, enemy });
                    }
                }
            }
        }
    }
    return entries;
}

function getRecentBossEntries() {
    const selected = new Map();
    const types = ['STR', 'PHY', 'INT', 'TEQ', 'AGL'];
    const classes = ['Super', 'Extreme'];
    const events = [...(gameData.events || [])].reverse();

    for (const event of events) {
        const stages = [...(event.stages || [])].filter(stage => stage.visible !== false).reverse();
        for (const stage of stages) {
            const battles = stage.battles && stage.battles.length
                ? stage.battles
                : [{ id: 'legacy-battle', name: 'Battle', phases: stage.phases || [] }];
            // Only the last battle of this stage is eligible. If it cannot
            // provide a missing type/class pair, try the previous stage.
            const battle = battles.at(-1);
            const phase = battle?.phases?.at(-1);
            // Recent-mode representatives always use the first enemy in the
            // final phase; later enemies in a multi-enemy phase are ignored.
            const enemy = phase?.enemies?.[0];
            if (!enemy) continue;
            const info = getEnemyInfoFromIcon(enemy.typeIcon);
            const key = `${info.type}_${info.class}`;
            if (!types.includes(info.type) || !classes.includes(info.class) || selected.has(key)) continue;
            const defaults = {};
            for (const input of getBossInputDefinitions({ phase, enemy })) defaults[input.id] = input.default ?? 0;
            const standard = calculateEnemyATK(enemy.formula, defaults);
            const hasEnoughDamage = Object.entries(standard).some(([id, value]) =>
                id !== '_labels' && typeof value === 'number' && value > 0
            );
            if (hasEnoughDamage) selected.set(key, { event, stage, battle, phase, enemy, type: info.type, class: info.class });
        }
    }

    return types.flatMap(type => classes.map(enemyClass => selected.get(`${type}_${enemyClass}`)).filter(Boolean));
}

function bossSearchMatches(entry, query) {
    const haystack = [
        entry.enemy.name,
        entry.event.name,
        entry.stage.name,
        entry.battle.name,
        entry.phase.name,
        getEnemyInfoFromIcon(entry.enemy.typeIcon).type,
        getEnemyInfoFromIcon(entry.enemy.typeIcon).class,
        entry.enemy.rarityIcon,
    ].join(' ').toLowerCase();
    return (query || '').toLowerCase().trim().split(/\s+/).filter(Boolean).every(term => haystack.includes(term));
}

function getPassiveCandidates(input) {
    if (input.type === 'checkbox') return [false, true];
    if (input.type === 'select' && Array.isArray(input.options)) return [...input.options];
    const values = new Set([input.default ?? 0]);
    if (input.min !== undefined) values.add(input.min);
    if (input.max !== undefined && isFinite(input.max)) values.add(input.max);
    return [...values];
}

function getAttackScore(results) {
    return Object.entries(results || {}).reduce((total, [id, value]) => {
        return id === '_labels' || typeof value !== 'number' ? total : total + Math.max(0, value);
    }, 0);
}

function findFullPassiveInputs(entry) {
    const definitions = getBossInputDefinitions(entry);
    const inputs = {};
    definitions.forEach(input => { inputs[input.id] = input.default ?? (input.type === 'checkbox' ? false : 0); });

    const candidates = definitions.map(input => ({ input, values: getPassiveCandidates(input) }));
    const combinations = candidates.reduce((total, item) => total * item.values.length, 1);
    let bestScore = -1;
    let bestInputs = { ...inputs };
    const evaluate = trial => {
        const score = getAttackScore(calculateEnemyATK(entry.enemy.formula, trial));
        if (score > bestScore) {
            bestScore = score;
            bestInputs = { ...trial };
        }
    };

    if (combinations <= 4096) {
        const visit = (index, trial) => {
            if (index === candidates.length) {
                evaluate(trial);
                return;
            }
            const { input, values } = candidates[index];
            values.forEach(value => visit(index + 1, { ...trial, [input.id]: value }));
        };
        visit(0, inputs);
        return bestInputs;
    }

    // Coordinate search keeps larger presets deterministic without a
    // combinatorial explosion for phases with many independent inputs.
    bestScore = getAttackScore(calculateEnemyATK(entry.enemy.formula, inputs));
    let improved = true;
    while (improved) {
        improved = false;
        for (const input of definitions) {
            let bestValue = inputs[input.id];
            for (const candidate of getPassiveCandidates(input)) {
                const trial = { ...inputs, [input.id]: candidate };
                const score = getAttackScore(calculateEnemyATK(entry.enemy.formula, trial));
                if (score > bestScore) {
                    bestScore = score;
                    bestValue = candidate;
                    improved = true;
                }
            }
            inputs[input.id] = bestValue;
        }
    }
    return inputs;
}

function getBossInputDefinitions(entry) {
    const definitions = [];
    const seen = new Set();
    for (const input of [...(entry.phase?.globalInputs || []), ...(entry.enemy.inputs || [])]) {
        if (input?.id && !seen.has(input.id)) {
            seen.add(input.id);
            definitions.push(input);
        }
    }
    return definitions;
}

function readBossInputs(entry, scope, overrides = {}) {
    return { ...collectEnemyInputValues(entry.enemy, scope), ...overrides };
}

function calculateBossDamage(entry, scope, characterInputs, overrides = {}) {
    const enemyAttackResults = calculateEnemyATK(entry.enemy.formula, readBossInputs(entry, scope, overrides));
    const enemyInfo = getEnemyInfoFromIcon(entry.enemy.typeIcon);
    const enemyProperties = { enemy_type: enemyInfo.type, enemy_class: enemyInfo.class };
    for (const output of entry.enemy.outputs || []) {
        const label = enemyAttackResults._labels?.[output.id] || output.label || '';
        const defIgnore = extractDefIgnoreFromLabel(label);
        const defLower = extractDefLowerFromLabel(label);
        if (defIgnore > 0) enemyProperties[output.id + '_def_ignore'] = defIgnore;
        if (defLower > 0) enemyProperties[output.id + '_def_lower'] = defLower;
    }
    const formula = getDamageTakenFormula(entry.enemy.formula);
    const damageResults = formula ? formula({ characterInputs, enemyAttackResults, enemyProperties }) : {};
    return { enemyAttackResults, damageResults };
}

function createBossMeta(entry) {
    const meta = document.createElement('p');
    meta.className = 'dc-boss-meta';
    const path = [entry.event.name, entry.stage.name];
    if ((entry.stage.battles || []).length > 1) path.push(entry.battle.name);
    path.push(entry.phase.name);
    meta.textContent = path.join(' / ');
    return meta;
}

function createBossPhaseLink(entry) {
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'dc-boss-image-link';
    link.title = `Open ${entry.phase.name}`;
    link.setAttribute('aria-label', `Open ${entry.enemy.name} in ${entry.phase.name}`);
    link.addEventListener('click', event => {
        event.preventDefault();
        showPage('enemies', entry.event.id, entry.stage.id, entry.battle.id, entry.phase.id);
    });
    return link;
}

function renderBossDamageCard(container, entry, damageResults, enemyAttackResults, titleSuffix = '', linkImage = false) {
    const card = document.createElement('article');
    card.className = 'dc-boss-result';

    const heading = document.createElement('h3');
    heading.textContent = entry.enemy.name + titleSuffix;
    card.appendChild(heading);
    card.appendChild(createBossMeta(entry));

    const visualRow = document.createElement('div');
    visualRow.className = 'dc-boss-visual-row';
    const image = createEnemyImageContainer(entry.enemy);
    if (linkImage) {
        const imageLink = createBossPhaseLink(entry);
        imageLink.appendChild(image);
        visualRow.appendChild(imageLink);
    } else {
        visualRow.appendChild(image);
    }
    const values = createBossDamageValues(entry, damageResults, enemyAttackResults);
    visualRow.appendChild(values);
    card.appendChild(visualRow);
    container.appendChild(card);
    return card;
}

function createBossDamageValues(entry, damageResults, enemyAttackResults) {
    const values = document.createElement('div');
    values.className = 'dc-boss-damage-values';
    for (const [damageKey, value] of Object.entries(damageResults || {})) {
        const atkId = damageKey.replace(/_damage(\d*)$/, '_atk$1');
        const output = (entry.enemy.outputs || []).find(item => item.id === atkId);
        const item = document.createElement('div');
        item.className = 'dc-boss-damage-item';
        const label = document.createElement('span');
        label.textContent = enemyAttackResults?._labels?.[atkId] || output?.label || damageKey.replace(/_/g, ' ');
        const amount = document.createElement('strong');
        amount.textContent = `${formatDmgRange(value)} DMG`;
        item.appendChild(label);
        item.appendChild(amount);
        values.appendChild(item);
    }
    return values;
}

function createBossInputPanel(entry, onChange) {
    const panel = document.createElement('div');
    panel.className = 'dc-boss-inputs';
    const title = document.createElement('p');
    title.className = 'dc-section-label';
    title.textContent = 'Boss inputs';
    panel.appendChild(title);
    for (const input of getBossInputDefinitions(entry)) {
        const isGlobal = (entry.phase?.globalInputs || []).some(item => item.id === input.id);
        const group = createInputField(isGlobal ? entry.phase.id : entry.enemy.id, input, onChange);
        if (group) panel.appendChild(group);
    }
    return panel;
}
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
    currentPhaseId: null,
    currentSearch: '',      // last search-bar query — persists across page changes
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

function makeInteractiveCard(card, onActivate) {
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.addEventListener('click', onActivate);
    card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onActivate();
        }
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
function showPage(page, eventId = null, stageId = null, battleId = null, phaseId = null) {
    // Validate page type
    const validPages = ['events', 'stages', 'battles', 'enemies', 'damage-calculator'];
    if (!validPages.includes(page)) {
        console.warn(`Invalid page type: ${page}. Defaulting to 'events'`);
        page = 'events';
    }

    // Update navigation state
    NavigationState.update({
        currentPage: page,
        currentEventId: eventId,
        currentStageId: stageId,
        currentBattleId: battleId,
        currentPhaseId: phaseId
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
            showEnemiesPage(newContent, eventId, stageId, battleId, phaseId);
            break;
        case 'damage-calculator':
            showDamageCalculatorPage(newContent);
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

    if (currentPage === 'damage-calculator') {
        html += ' &gt; Damage Calculator';
        breadcrumbDiv.innerHTML = html;
        return;
    }

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
    // ── Tools section (above the Events title) ────────────────────────────────
    const toolsSection = document.createElement('div');
    toolsSection.className = 'tools-section';

    const toolsSectionTitle = document.createElement('p');
    toolsSectionTitle.className = 'tools-section-title';
    toolsSectionTitle.textContent = 'Tools';
    toolsSection.appendChild(toolsSectionTitle);

    const dcToolCard = document.createElement('div');
    dcToolCard.className = 'tool-card';
    const dcIcon = document.createElement('div');
    dcIcon.className = 'tool-card-icon';
    dcIcon.textContent = '⚔️';
    const dcInfo = document.createElement('div');
    dcInfo.className = 'tool-card-info';
    const dcName = document.createElement('div');
    dcName.className = 'tool-card-name';
    dcName.textContent = 'Damage Calculator';
    const dcDesc = document.createElement('div');
    dcDesc.className = 'tool-card-desc';
    dcDesc.textContent = 'Enter any enemy ATK and your character stats to see exactly how much damage you take — for all type & class combinations.';
    dcInfo.appendChild(dcName);
    dcInfo.appendChild(dcDesc);
    dcToolCard.appendChild(dcIcon);
    dcToolCard.appendChild(dcInfo);
    makeInteractiveCard(dcToolCard, () => showPage('damage-calculator'));
    toolsSection.appendChild(dcToolCard);
    container.appendChild(toolsSection);
    // ──────────────────────────────────────────────────────────────────────────

    const title = document.createElement('h2');
    title.textContent = 'Events';
    container.appendChild(title);

    // Add search bar
    const searchWrapper = createSearchBar('Search events, stages, battles, or enemies...');
    container.appendChild(searchWrapper);

    const grid = document.createElement('div');
    grid.className = 'card-grid';
    grid.id = 'events-grid';

    const events = gameData.events.filter(e => e.visible !== false).reverse();

    const renderEvents = (filteredEvents) => {
        grid.innerHTML = '';
        
        if (filteredEvents.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.textContent = 'No results found';
            grid.appendChild(noResults);
            return;
        }
        
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
                img.height = 150;
                card.appendChild(img);
            }
            
            makeInteractiveCard(card, () => showPage('stages', event.id));
            setupCardTooltip(card, event.name);
            grid.appendChild(card);
        });
    };

    // Search across events, stages, battles, and enemies
    const applyEventFilter = (rawQuery) => {
        const query = (rawQuery || '').toLowerCase().trim();
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
    };

    // Re-apply the persisted query (if any) so a restored search bar always
    // matches the rendered results
    applyEventFilter(NavigationState.currentSearch);
    container.appendChild(grid);

    const searchInput = searchWrapper.querySelector('.search-input');
    searchInput.addEventListener('input', debounce((e) => applyEventFilter(e.target.value), 300));

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
function createSearchBar(placeholder, onSearch = null, persistState = true) {
    const wrapper = document.createElement('div');
    wrapper.className = 'search-bar-wrapper';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'search-input';
    input.placeholder = placeholder;
    // Persist the query across page navigation: pre-fill the last search and
    // keep NavigationState updated on every keystroke, so re-rendered pages
    // (which rebuild the search bar) restore both the text and its filter.
    input.value = persistState ? (NavigationState.currentSearch || '') : '';

    // "×" button — one click clears the query (and its persisted state) and
    // re-applies the page filter via the input event.
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'search-clear-btn';
    clearBtn.title = 'Clear search';
    clearBtn.setAttribute('aria-label', 'Clear search');
    clearBtn.addEventListener('click', () => {
        input.value = '';
        if (persistState) NavigationState.currentSearch = '';
        updateClearVisibility();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
    });

    function updateClearVisibility() {
        clearBtn.style.display = input.value ? 'flex' : 'none';
    }

    input.addEventListener('input', () => {
        if (persistState) NavigationState.currentSearch = input.value;
        if (onSearch) onSearch(input.value);
        updateClearVisibility();
    });

    wrapper.appendChild(input);
    wrapper.appendChild(clearBtn);
    updateClearVisibility();
    return wrapper;
}

/**
 * Standalone Damage Calculator page.
 * Lets the user enter any enemy ATK + character stats and see
 * damage received for all 10 enemy type/class combinations.
 * @param {HTMLElement} container
 */
function showDamageCalculatorPage(container) {
    // --- Back button ---
    const backBtn = document.createElement('button');
    backBtn.className = 'back-button';
    backBtn.textContent = '← Back to Events';
    backBtn.addEventListener('click', () => showPage('events'));
    container.appendChild(backBtn);

    const title = document.createElement('h2');
    title.textContent = 'Damage Calculator';
    container.appendChild(title);

    const desc = document.createElement('p');
    desc.className = 'mode-info-banner mode-info-atk';
    desc.style.marginBottom = '20px';
    desc.textContent = "Enter the enemy's ATK and your character's stats to see how much damage you receive for every enemy type & class combination. All inputs are remembered for the current session.";
    container.appendChild(desc);

    const modeBar = document.createElement('div');
    modeBar.className = 'dc-mode-bar';
    const modeTitle = document.createElement('span');
    modeTitle.className = 'dc-mode-title';
    modeTitle.textContent = 'Calculator mode';
    modeBar.appendChild(modeTitle);
    const modeButtons = {};
    let activeMode = 'manual';
    let runBossMode = () => {};
    ['manual', 'recent', 'boss'].forEach(mode => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dc-mode-choice';
        button.textContent = mode === 'manual' ? 'Damage Received' : mode === 'recent' ? 'Recent Events' : 'Choose a Boss';
        modeButtons[mode] = button;
        modeBar.appendChild(button);
    });
    container.appendChild(modeBar);

    // --- Session storage helpers ---
    const getStoredEnemy = (key, fallback) => {
        const v = sessionStorage.getItem('dcEnemy_' + key);
        if (v === null) return fallback;
        if (v === '__true__') return true;
        if (v === '__false__') return false;
        const n = Number(v);
        return isNaN(n) ? fallback : n;
    };
    const setStoredEnemy = (key, val) => {
        sessionStorage.setItem('dcEnemy_' + key, typeof val === 'boolean' ? (val ? '__true__' : '__false__') : String(val));
    };

    // --- Two-panel wrapper ---
    const panels = document.createElement('div');
    panels.className = 'dc-panels';
    container.appendChild(panels);
    let bossWorkspace;

    // ── Enemy panel ────────────────────────────────────────────────────────────
    const enemyPanel = document.createElement('div');
    enemyPanel.className = 'dc-card';
    panels.appendChild(enemyPanel);

    const enemyCardTitle = document.createElement('p');
    enemyCardTitle.className = 'dc-card-title';
    enemyCardTitle.textContent = 'Enemy';
    enemyPanel.appendChild(enemyCardTitle);

    const enemyGrid = document.createElement('div');
    enemyGrid.className = 'dc-enemy-grid';
    enemyPanel.appendChild(enemyGrid);

    // Helper: numeric input group with placeholder (invisible, used as default)
    function makeNumGroup(id, labelText, storedVal, min, max, placeholder) {
        const g = document.createElement('div');
        g.className = 'dc-input-group';
        const lbl = document.createElement('label');
        lbl.htmlFor = id;
        lbl.className = 'dc-input-label';
        lbl.textContent = labelText;
        g.appendChild(lbl);
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.id = id;
        inp.min = min ?? 0;
        if (max != null && isFinite(max)) inp.max = max;
        inp.step = 1;
        inp.placeholder = String(placeholder ?? 0);
        // Only set .value if the user has previously saved something
        if (storedVal !== null && storedVal !== undefined && storedVal !== 0) {
            inp.value = storedVal;
        }
        inp.style.cssText = 'width:100%;padding:10px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text);font-family:inherit;font-size:0.9rem;-moz-appearance:textfield';
        g.appendChild(inp);
        return { g, inp };
    }

    // Helper: compact toggle pill for enemy inputs
    function makeToggleGroup(id, labelText, storedVal) {
        const isChecked = storedVal === true;
        const g = document.createElement('div');
        g.className = 'dc-input-group dc-check-group';
        g.style.cssText = 'flex-direction:row;align-items:center;gap:8px;padding:6px 10px;background:' + (isChecked ? 'rgba(99,179,237,0.12)' : 'rgba(99,179,237,0.05)') + ';border:1px solid ' + (isChecked ? 'rgba(99,179,237,0.45)' : 'rgba(99,179,237,0.2)') + ';border-radius:8px;cursor:pointer';

        // Hidden real checkbox
        const inp = document.createElement('input');
        inp.type = 'checkbox';
        inp.id = id;
        inp.checked = isChecked;
        inp.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:0;height:0';

        // Compact toggle track (32×18)
        const track = document.createElement('div');
        track.style.cssText = 'flex-shrink:0;width:32px;height:18px;border-radius:9px;border:1.5px solid rgba(99,179,237,0.5);background:' + (isChecked ? 'rgba(99,179,237,0.6)' : 'rgba(45,55,72,0.8)') + ';position:relative;transition:background 0.2s;cursor:pointer';
        const thumb = document.createElement('div');
        thumb.style.cssText = 'position:absolute;top:1px;left:' + (isChecked ? '13px' : '1px') + ';width:14px;height:14px;border-radius:50%;background:' + (isChecked ? '#63b3ed' : '#a0aec0') + ';transition:left 0.2s,background 0.2s';
        track.appendChild(thumb);

        const lbl = document.createElement('label');
        lbl.htmlFor = id;
        lbl.textContent = labelText;
        lbl.style.cssText = 'margin:0;cursor:pointer;user-select:none;font-size:0.82rem;font-weight:' + (isChecked ? '600' : '500') + ';color:' + (isChecked ? 'var(--color-accent)' : 'var(--color-text-muted)') + ';transition:color 0.2s,font-weight 0.2s';

        const update = (checked) => {
            inp.checked = checked;
            track.style.background = checked ? 'rgba(99,179,237,0.6)' : 'rgba(45,55,72,0.8)';
            thumb.style.left = checked ? '13px' : '1px';
            thumb.style.background = checked ? '#63b3ed' : '#a0aec0';
            lbl.style.color = checked ? 'var(--color-accent)' : 'var(--color-text-muted)';
            lbl.style.fontWeight = checked ? '600' : '500';
            g.style.background = checked ? 'rgba(99,179,237,0.12)' : 'rgba(99,179,237,0.05)';
            g.style.borderColor = checked ? 'rgba(99,179,237,0.45)' : 'rgba(99,179,237,0.2)';
        };
        g.addEventListener('click', () => {
            update(!inp.checked);
            inp.dispatchEvent(new Event('change', { bubbles: true }));
        });

        g.appendChild(inp);
        g.appendChild(track);
        g.appendChild(lbl);
        return { g, inp };
    }

    const storedAtk       = getStoredEnemy('enemy_atk',       null);
    const storedDefLower  = getStoredEnemy('enemy_def_lower',  null);
    const storedDefIgnore = getStoredEnemy('enemy_def_ignore', null);
    const storedCrit      = getStoredEnemy('enemy_crit',       false);

    const { g: atkGroup,       inp: atkInput }       = makeNumGroup('dc_enemy_atk',      'ATK',              storedAtk,       0, Infinity, 0);
    const { g: defLowerGroup,  inp: defLowerInput }  = makeNumGroup('dc_enemy_def_lower', 'DEF Lowering (%)', storedDefLower,  0, 100,      0);
    const { g: defIgnoreGroup, inp: defIgnoreInput } = makeNumGroup('dc_enemy_def_ignore','DEF Ignored on Crit (%)', storedDefIgnore, 0, 100, 0);
    const { g: critGroup,      inp: critInput }      = makeToggleGroup('dc_enemy_crit',   'Crits',            storedCrit);

    // Crit toggle and DEF-ignore side-by-side in one grid row
    const critRow = document.createElement('div');
    critRow.style.cssText = 'grid-column:1/-1;display:flex;gap:10px;align-items:flex-end';
    critRow.appendChild(critGroup);
    critRow.appendChild(defIgnoreGroup);

    [atkGroup, defLowerGroup, critRow].forEach(g => enemyGrid.appendChild(g));
    [[atkInput, 'enemy_atk'], [defLowerInput, 'enemy_def_lower'], [defIgnoreInput, 'enemy_def_ignore']].forEach(([el, key]) => {
        el.addEventListener('input', () => { setStoredEnemy(key, el.value); runCalculation(); });
    });
    critInput.addEventListener('change', () => {
        setStoredEnemy('enemy_crit', critInput.checked);
        runCalculation();
    });

    // ── Character panel ────────────────────────────────────────────────────────
    const charPanel = document.createElement('div');
    charPanel.className = 'dc-card';
    panels.appendChild(charPanel);

    const charCardTitle = document.createElement('p');
    charCardTitle.className = 'dc-card-title';
    charCardTitle.textContent = 'Your Character';
    charPanel.appendChild(charCardTitle);

    const charBanner = document.createElement('p');
    charBanner.className = 'mode-info-banner mode-info-dmg';
    charBanner.style.cssText = 'margin-bottom:14px;font-size:0.82rem;color:var(--color-text-muted);line-height:1.5;padding:10px 14px;background:rgba(72,187,237,0.07);border-radius:6px;border:1px solid rgba(72,187,237,0.18)';
    charBanner.textContent = 'Changes here also apply in the "My Damage" mode inside each event.';
    charPanel.appendChild(charBanner);

    const charGrid = document.createElement('div');
    charGrid.className = 'char-inputs-grid';
    charGrid.style.display = 'grid';
    charGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(160px, 1fr))';
    charGrid.style.gap = '12px';
    charPanel.appendChild(charGrid);

    // Exact same tooltip text and structure as My Damage mode
    const STACKED_DEF_TOOLTIP = 'This value is relevant only for def-lowering bosses and includes these special attack effects: "Raises DEF by X%", "Raises allies\' DEF by X%" (this one can come from allies too).';

    const CHAR_INPUTS = [
        { id: 'char_type',             label: 'Type',                 type: 'select',   options: ['STR','TEQ','INT','PHY','AGL'], default: 'STR'   },
        { id: 'char_class',            label: 'Class',                type: 'select',   options: ['Super','Extreme'],             default: 'Super' },
        { id: 'char_defense',          label: 'DEF',                  type: 'number',   default: 0,  min: 0, max: Infinity, step: 1 },
        { id: 'char_damage_reduction', label: 'Damage Reduction (%)', type: 'number',   default: 0,  min: 0, max: 100,      step: 1 },
        { id: 'char_type_def_boost',   label: 'Type DEF Boost Lv',   type: 'number',   default: 0,  min: 0, max: 50,       step: 1 },
        { id: 'char_stacked_def',      label: 'Stacked DEF (%)',      type: 'number',   default: 0,  min: 0, max: Infinity, step: 1, tooltip: STACKED_DEF_TOOLTIP },
        { id: 'char_passive_guard',    label: 'Passive Guard',        type: 'checkbox', default: false },
    ];

    const getStoredChar = (id, fallback) => {
        const stored = sessionStorage.getItem('charInput_' + id);
        if (stored === null) return fallback;
        if (stored === '__true__') return true;
        if (stored === '__false__') return false;
        return stored;
    };

    CHAR_INPUTS.forEach(inp => {
        const storedVal = getStoredChar(inp.id, inp.default);

        const inputGroup = document.createElement('div');
        inputGroup.style.display = 'flex';
        inputGroup.style.flexDirection = 'column';
        inputGroup.style.gap = '6px';

        const label = document.createElement('label');
        label.htmlFor = inp.id;
        label.textContent = inp.label;
        label.style.fontSize = '0.8rem';
        label.style.color = 'var(--color-text-muted)';
        label.style.fontWeight = '500';
        label.style.letterSpacing = '0.2px';

        if (inp.tooltip) {
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
            tipBox.textContent = inp.tooltip;
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
            helpIcon.addEventListener('mouseenter', () => { tipBox.style.opacity = '1'; });
            helpIcon.addEventListener('mouseleave', () => { tipBox.style.opacity = '0'; });
            helpIcon.addEventListener('touchstart', (e) => {
                e.preventDefault();
                tipBox.style.opacity = tipBox.style.opacity === '1' ? '0' : '1';
            }, { passive: false });
            document.addEventListener('touchstart', (e) => {
                if (!tipWrap.contains(e.target)) tipBox.style.opacity = '0';
            }, { passive: true });
            tipWrap.appendChild(helpIcon);
            tipWrap.appendChild(tipBox);
            label.appendChild(tipWrap);
        }

        let inputEl;
        if (inp.type === 'select') {
            inputEl = document.createElement('select');
            inputEl.id = inp.id;
            inputEl.style.cssText = [
                'width:100%',
                'padding:10px 32px 10px 12px',
                'background:var(--color-bg)',
                'border:1.5px solid var(--color-border)',
                'border-radius:6px',
                'color:var(--color-text)',
                'font-family:inherit',
                'font-size:max(16px,0.9rem)',
                'cursor:pointer',
                '-webkit-appearance:none',
                'appearance:none',
                'background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath d=\'M1 1l5 5 5-5\' stroke=\'%2363b3ed\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\'/%3E%3C/svg%3E")',
                'background-repeat:no-repeat',
                'background-position:right 10px center',
                'min-height:40px',
                'touch-action:manipulation',
            ].join(';');
            inp.options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt; o.textContent = opt;
                inputEl.appendChild(o);
            });
            inputEl.value = String(storedVal);
            inputGroup.appendChild(label);
            inputGroup.appendChild(inputEl);
        } else if (inp.type === 'checkbox') {
            // Styled toggle pill — same as My Damage mode
            const isChecked = storedVal === true || storedVal === 'true' || storedVal === '__true__';
            inputGroup.style.flexDirection = 'row';
            inputGroup.style.alignItems = 'center';
            inputGroup.style.gap = '10px';
            inputGroup.style.padding = '8px 12px';
            inputGroup.style.backgroundColor = isChecked ? 'rgba(99,179,237,0.12)' : 'rgba(99,179,237,0.05)';
            inputGroup.style.border = '1px solid ' + (isChecked ? 'rgba(99,179,237,0.45)' : 'rgba(99,179,237,0.2)');
            inputGroup.style.borderRadius = '8px';
            inputGroup.style.cursor = 'pointer';

            inputEl = document.createElement('input');
            inputEl.type = 'checkbox';
            inputEl.id = inp.id;
            inputEl.checked = isChecked;
            inputEl.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:0;height:0';

            const track = document.createElement('div');
            track.style.cssText = 'flex-shrink:0;width:40px;height:22px;border-radius:11px;border:1.5px solid rgba(99,179,237,0.5);background:' + (isChecked ? 'rgba(99,179,237,0.6)' : 'rgba(45,55,72,0.8)') + ';position:relative;transition:background 0.2s';
            const thumb = document.createElement('div');
            thumb.style.cssText = 'position:absolute;top:2px;left:' + (isChecked ? '18px' : '2px') + ';width:16px;height:16px;border-radius:50%;background:' + (isChecked ? '#63b3ed' : '#a0aec0') + ';transition:left 0.2s,background 0.2s';
            track.appendChild(thumb);

            label.textContent = inp.label;
            label.style.margin = '0';
            label.style.cursor = 'pointer';
            label.style.userSelect = 'none';
            label.style.fontSize = '0.9rem';
            label.style.color = isChecked ? 'var(--color-accent)' : 'var(--color-text-muted)';
            label.style.fontWeight = isChecked ? '600' : '500';
            label.style.transition = 'color 0.2s,font-weight 0.2s';
            label.htmlFor = inp.id;

            const updatePG = (checked) => {
                inputEl.checked = checked;
                track.style.background = checked ? 'rgba(99,179,237,0.6)' : 'rgba(45,55,72,0.8)';
                thumb.style.left = checked ? '18px' : '2px';
                thumb.style.background = checked ? '#63b3ed' : '#a0aec0';
                label.style.color = checked ? 'var(--color-accent)' : 'var(--color-text-muted)';
                label.style.fontWeight = checked ? '600' : '500';
                inputGroup.style.backgroundColor = checked ? 'rgba(99,179,237,0.12)' : 'rgba(99,179,237,0.05)';
                inputGroup.style.borderColor = checked ? 'rgba(99,179,237,0.45)' : 'rgba(99,179,237,0.2)';
            };
            inputGroup.addEventListener('click', () => {
                updatePG(!inputEl.checked);
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            });

            inputGroup.appendChild(inputEl);
            inputGroup.appendChild(track);
            inputGroup.appendChild(label);
            charGrid.appendChild(inputGroup);

            inputEl.addEventListener('change', () => {
                sessionStorage.setItem('charInput_' + inp.id, inputEl.checked ? '__true__' : '__false__');
                runCalculation();
            });
            return; // already appended
        } else {
            inputEl = document.createElement('input');
            inputEl.type = 'number';
            inputEl.id = inp.id;
            inputEl.placeholder = String(inp.default ?? 0);
            inputEl.min = inp.min ?? 0;
            if (inp.max != null && isFinite(inp.max)) inputEl.max = inp.max;
            inputEl.step = inp.step || 1;
            const sv = getStoredChar(inp.id, null);
            if (sv !== null && sv !== String(inp.default)) inputEl.value = sv;
            inputEl.style.padding = '10px';
            inputEl.style.backgroundColor = 'var(--color-bg)';
            inputEl.style.border = '1px solid var(--color-border)';
            inputEl.style.borderRadius = '6px';
            inputEl.style.color = 'var(--color-text)';
            inputEl.style.fontFamily = 'inherit';
            inputEl.style.fontSize = '0.9rem';
            inputEl.style.MozAppearance = 'textfield';
            inputGroup.appendChild(label);
            inputGroup.appendChild(inputEl);
        }
        charGrid.appendChild(inputGroup);

        const evType = (inputEl.tagName === 'SELECT') ? 'change' : 'input';
        inputEl.addEventListener(evType, () => {
            sessionStorage.setItem('charInput_' + inp.id, inputEl.value);
            runCalculation();
        });
    });

    // DEF note — same as My Damage mode
    const defNote = document.createElement('p');
    defNote.style.cssText = 'margin:12px 0 0 0;font-size:0.75rem;color:var(--color-text-muted);line-height:1.5';
    defNote.innerHTML = '\u24D8 The defense shown in battle is not always accurate. Calculate yours at <a href="https://dokkanstats.com/en/defcalculator/" target="_blank" rel="noopener noreferrer" style="color:var(--color-accent);text-decoration:underline">dokkanstats.com</a>.';
    charPanel.appendChild(defNote);

    // ── Results section ────────────────────────────────────────────────────────
    const resultsSection = document.createElement('div');
    resultsSection.className = 'dc-results-section';
    container.appendChild(resultsSection);

    // ── Live calculation ───────────────────────────────────────────────────────
    // Map char input ids to their actual element references (already created above)
    // This lets readCharInputs work before/after DOM insertion without getElementById
    const charInputEls = {};
    CHAR_INPUTS.forEach(cfg => {
        const el = charGrid.querySelector('#' + cfg.id) ||
                   charPanel.querySelector('#' + cfg.id);
        if (el) charInputEls[cfg.id] = el;
    });

    function readCharInputs() {
        const out = {};
        CHAR_INPUTS.forEach(cfg => {
            const el = charInputEls[cfg.id] || document.getElementById(cfg.id);
            if (!el) { out[cfg.id] = cfg.default ?? 0; return; }
            if (el.type === 'checkbox') out[cfg.id] = el.checked;
            else if (el.tagName === 'SELECT') out[cfg.id] = el.value;
            else out[cfg.id] = parseFloat(el.value) || parseFloat(el.placeholder) || 0;
        });
        return out;
    }

    function runCalculation() {
        if (activeMode !== 'manual') {
            runBossMode();
            return;
        }
        const ei = {
            enemy_atk:        parseFloat(atkInput.value)        || parseFloat(atkInput.placeholder)        || 0,
            enemy_def_lower:  parseFloat(defLowerInput.value)   || parseFloat(defLowerInput.placeholder)   || 0,
            enemy_crit:       critInput.checked,
            enemy_def_ignore: parseFloat(defIgnoreInput.value)  || parseFloat(defIgnoreInput.placeholder)  || 0,
        };
        const results = calculateStandaloneDamage(ei, readCharInputs());
        renderStandaloneDamageResults(resultsSection, results, critInput.checked);
    }

    bossWorkspace = document.createElement('div');
    bossWorkspace.className = 'dc-boss-workspace';
    bossWorkspace.style.display = 'none';
    container.appendChild(bossWorkspace);

    const characterJumpButton = document.createElement('button');
    characterJumpButton.type = 'button';
    characterJumpButton.className = 'dc-character-jump';
    characterJumpButton.textContent = '↑';
    characterJumpButton.title = 'Back to Your Character';
    characterJumpButton.setAttribute('aria-label', 'Back to Your Character');
    characterJumpButton.addEventListener('click', () => {
        charPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    characterJumpButton.style.display = 'none';
    container.appendChild(characterJumpButton);

    const characterValues = () => readCharInputs();
    const renderBossSection = (section, entry) => {
        section.innerHTML = '';
        const refreshBossDamage = () => {
            const previousCard = section.querySelector('.dc-boss-result');
            if (previousCard) previousCard.remove();
            const overrides = {};
            const calculated = calculateBossDamage(entry, section, characterValues(), overrides);
            renderBossDamageCard(section, entry, calculated.damageResults, calculated.enemyAttackResults, '', true);
        };
        const inputPanel = createBossInputPanel(entry, refreshBossDamage);
        section.appendChild(inputPanel);
        refreshBossDamage();
    };

    const renderRecentMode = () => {
        bossWorkspace.innerHTML = '';
        const heading = document.createElement('h3');
        heading.textContent = 'Recent final bosses by type and class';
        bossWorkspace.appendChild(heading);
        const note = document.createElement('p');
        note.className = 'dc-boss-note';
        note.textContent = 'Each card uses the most recent final boss available for that type and class. The image opens its exact phase.';
        bossWorkspace.appendChild(note);
        const recentGrid = document.createElement('div');
        recentGrid.className = 'dc-recent-grid';
        bossWorkspace.appendChild(recentGrid);
        getRecentBossEntries().forEach(entry => {
            const section = document.createElement('section');
            section.className = 'dc-recent-boss';
            recentGrid.appendChild(section);
            const standardInputs = Object.fromEntries(getBossInputDefinitions(entry).map(input => [input.id, input.default ?? 0]));
            const fullInputs = findFullPassiveInputs(entry);
            const standard = calculateBossDamage(entry, section, characterValues(), standardInputs);
            const full = calculateBossDamage(entry, section, characterValues(), fullInputs);
            renderRecentBossCard(section, entry, { ...standard, inputs: standardInputs }, { ...full, inputs: fullInputs });
        });
    };

    const renderSearchMode = () => {
        bossWorkspace.innerHTML = '';
        const heading = document.createElement('h3');
        heading.textContent = 'Choose a boss';
        bossWorkspace.appendChild(heading);
        const results = document.createElement('div');
        results.className = 'dc-boss-search-results';
        const selected = document.createElement('div');
        selected.className = 'dc-selected-boss';
        const entries = getAllBossEntries().reverse();
        const drawResults = () => {
            results.innerHTML = '';
            const matches = entries.filter(entry => bossSearchMatches(entry, searchInput.value)).slice(0, 30);
            matches.forEach(entry => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'dc-boss-search-result';
            const image = createEnemyImageContainer(entry.enemy);
            image.classList.add('dc-search-enemy-image');
            button.appendChild(image);

                const eventTitle = document.createElement('span');
                eventTitle.className = 'dc-search-event-title dc-search-enemy-info';
                eventTitle.textContent = entry.event.name;
                const location = document.createElement('span');
                location.className = 'dc-search-location';
                const locationParts = [entry.stage.name];
                if ((entry.stage.battles || []).length > 1) locationParts.push(entry.battle.name);
                locationParts.push(entry.phase.name);
                location.textContent = locationParts.join(' / ');
                button.appendChild(eventTitle);
                button.appendChild(location);
                button.addEventListener('click', () => {
                    selected.innerHTML = '';
                    selected.__entry = entry;
                    renderBossSection(selected, entry);
                });
                results.appendChild(button);
            });
            if (!matches.length) {
                const empty = document.createElement('p');
                empty.className = 'dc-boss-note';
                empty.textContent = 'No bosses match those search terms.';
                results.appendChild(empty);
            }
        };
        const searchWrapper = createSearchBar(
            'Search name, type, rarity, event, stage, or battle...',
            drawResults,
            false
        );
        const searchInput = searchWrapper.querySelector('.search-input');
        searchInput.classList.add('dc-boss-search');
        searchInput.type = 'search';
        searchInput.setAttribute('aria-label', 'Search bosses');
        bossWorkspace.appendChild(searchWrapper);
        bossWorkspace.appendChild(results);
        bossWorkspace.appendChild(selected);
        drawResults();
        runBossMode = () => {
            if (selected.__entry) renderBossSection(selected, selected.__entry);
        };
    };

    const activateMode = mode => {
        activeMode = mode;
        Object.entries(modeButtons).forEach(([key, button]) => button.classList.toggle('active', key === mode));
        const manual = mode === 'manual';
        enemyPanel.style.display = manual ? '' : 'none';
        resultsSection.style.display = manual ? '' : 'none';
        bossWorkspace.style.display = manual ? 'none' : 'block';
        characterJumpButton.style.display = manual ? 'none' : 'flex';
        if (mode === 'recent') renderRecentMode();
        if (mode === 'boss') renderSearchMode();
        if (manual) runCalculation();
    };
    Object.entries(modeButtons).forEach(([mode, button]) => button.addEventListener('click', () => activateMode(mode)));
    activateMode('manual');

    // Defer first calculation until after performPageTransition adds us to the DOM
    requestAnimationFrame(() => requestAnimationFrame(() => runCalculation()));
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
        
        if (stages.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.textContent = 'No results found';
            grid.appendChild(noResults);
            return;
        }
        
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

            makeInteractiveCard(card, () => {
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

    // Search stages by name, battles by name, or enemies by name
    const applyStageFilter = (rawQuery) => {
        const query = (rawQuery || '').toLowerCase().trim();
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
    };

    // Re-apply the persisted query (if any) so a restored search bar always
    // matches the rendered results
    applyStageFilter(NavigationState.currentSearch);
    container.appendChild(grid);

    const searchInput = searchWrapper.querySelector('.search-input');
    searchInput.addEventListener('input', debounce((e) => applyStageFilter(e.target.value), 300));
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
        
        if (battlesList.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.textContent = 'No results found';
            grid.appendChild(noResults);
            return;
        }
        
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
            
            makeInteractiveCard(card, () => showPage('enemies', eventId, stageId, battle.id));
            setupCardTooltip(card, battle.name);
            grid.appendChild(card);
        });
    };

    // Search battles by name or enemies by name
    const applyBattleFilter = (rawQuery) => {
        const query = (rawQuery || '').toLowerCase().trim();
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
    };

    // Re-apply the persisted query (if any) so a restored search bar always
    // matches the rendered results
    applyBattleFilter(NavigationState.currentSearch);
    container.appendChild(grid);

    const searchInput = searchWrapper.querySelector('.search-input');
    searchInput.addEventListener('input', debounce((e) => applyBattleFilter(e.target.value), 300));
}

/**
 * Renders the enemies page with optional phase selection dropdown
 * Displays enemy ATK calculation forms; dropdown only shown for multi-phase battles
 * @param {HTMLElement} container - DOM element to render enemies into
 * @param {string} eventId - ID of selected event
 * @param {string} stageId - ID of selected stage
 * @param {string} battleId - ID of selected battle
 */
function showEnemiesPage(container, eventId, stageId, battleId, phaseId = null) {
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
                // Capture current phase inputs before switching
                const currentActiveTab = document.querySelector('.phase-tab.active');
                if (currentActiveTab && currentActiveTab.dataset.phaseId) {
                    const currentPhaseId = currentActiveTab.dataset.phaseId;
                    const formsContainer = document.getElementById('enemy-forms-container');
                    if (formsContainer) {
                        const currentPhaseSnapshot = capturePhaseInputValues(null);
                        rememberPhaseInputSnapshot(currentPhaseId, currentPhaseSnapshot);
                    }
                }

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
                        
                        // Restore previously saved inputs for this phase
                        if (phaseInputSnapshots && phaseInputSnapshots[phase.id]) {
                            restorePhaseInputValues(phase, phaseInputSnapshots[phase.id]);
                        }

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
        const initialPhase = battle.phases.find(phase => phase.id === phaseId) || battle.phases[0];
        displayEnemiesForPhase(enemyFormsContainer, initialPhase, battle.phases.length);
        if (phaseId && initialPhase.id !== battle.phases[0].id) {
            phaseTabsContainer.querySelectorAll('.phase-tab').forEach(tab => {
                const active = tab.dataset.phaseId === initialPhase.id;
                tab.classList.toggle('active', active);
                tab.setAttribute('aria-selected', active ? 'true' : 'false');
            });
        }
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

    // Defeated-enemies tray: resurrect UI for enemies removed via their ✕ button
    if (getDefeatedEnemyIds(phase.id).length > 0) {
        container.appendChild(createDefeatedTray(phase));
    }

    // Phase-wide inputs panel (shared by every enemy of this phase)
    if (Array.isArray(phase.globalInputs) && phase.globalInputs.length > 0) {
        container.appendChild(createPhaseInputsPanel(phase));
    }

    // Render each enemy in the phase (defeated ones are removed from the page)
    phase.enemies.forEach(enemy => {
        if (!enemy.id) {
            console.warn('displayEnemiesForPhase: skipping enemy without id');
            return;
        }

        if (isEnemyDefeated(phase.id, enemy.id)) return;

        createEnemyForm(container, enemy, phase);
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
 * Create the phase-wide inputs panel: inputs shared by every enemy of a phase.
 * Rendered once above the enemy forms. Element ids are namespaced by the phase
 * id ("${phase.id}_${input.id}") so they never collide with enemy inputs; the
 * calculator merges their values into every enemy's inputs automatically.
 * Changing any of them recalculates the whole phase.
 * @param {Object} phase - Phase data object with a globalInputs array
 * @returns {HTMLElement} The panel element
 */
function createPhaseInputsPanel(phase) {
    const panel = document.createElement('div');
    panel.className = 'enemy-form phase-inputs-panel';
    panel.id = `phase-inputs-${phase.id}`;

    const heading = document.createElement('h4');
    heading.className = 'phase-inputs-title';
    heading.textContent = '⚙️ Phase-wide inputs';
    panel.appendChild(heading);

    const note = document.createElement('p');
    note.className = 'phase-inputs-note';
    note.textContent = 'Shared by every enemy in this phase — set them once here.';
    panel.appendChild(note);

    const formGroup = document.createElement('div');
    formGroup.className = 'phase-inputs-group';
    (phase.globalInputs || []).forEach(input => {
        const inputElement = createInputField(phase.id, input, () => recalculatePhaseEnemies(phase));
        if (inputElement) {
            formGroup.appendChild(inputElement);
        }
    });
    panel.appendChild(formGroup);

    return panel;
}

// In-memory per-phase snapshots of the last known input values — they let a
// resurrected enemy come back with the values it had when it was defeated.
const phaseInputSnapshots = {};

function rememberPhaseInputSnapshot(phaseId, snapshot) {
    phaseInputSnapshots[phaseId] = { ...(phaseInputSnapshots[phaseId] || {}), ...snapshot };
}

function mergedPhaseSnapshot(phaseId, fresh) {
    return { ...(phaseInputSnapshots[phaseId] || {}), ...fresh };
}

/**
 * Snapshot the current values of every rendered input of the phase (enemy
 * inputs + phase-wide inputs), keyed by DOM element id — used so that
 * defeat/resurrect re-renders keep the user's typed values instead of
 * resetting them to defaults.
 * @param {Object} phase - Phase data object
 * @returns {Object} id → { type, value } (value is a string, or a boolean for checkboxes)
 */
function capturePhaseInputValues(phase) {
    const snapshot = {};
    const container = document.getElementById('enemy-forms-container');
    if (!container) return snapshot;
    container.querySelectorAll('input').forEach(el => {
        if (!el.id) return;
        snapshot[el.id] = { type: el.type, value: el.type === 'checkbox' ? el.checked : el.value };
    });
    return snapshot;
}

/**
 * Re-apply a snapshot taken by capturePhaseInputValues after a
 * defeat/resurrect re-render, then recalculate the phase — every enemy's
 * current input values (including the defeated/resurrected one's) are
 * preserved. Checkboxes get a change event so their toggle visuals re-sync.
 * @param {Object} phase - Phase data object
 * @param {Object} snapshot - id → { type, value }
 */
function restorePhaseInputValues(phase, snapshot) {
    if (!snapshot) return;
    Object.keys(snapshot).forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const saved = snapshot[id];
        if (el.type === 'checkbox') {
            const changed = el.checked !== (saved.value === true);
            el.checked = saved.value === true;
            if (changed) el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            el.value = saved.value;
        }
    });
    recalculatePhaseEnemies(phase);
}

/**
 * Create the defeated-enemies tray: one chip per defeated enemy of the phase,
 * each with a ↺ resurrect button (in case of mistakes). Rendered above the
 * phase-wide inputs panel whenever at least one enemy is defeated.
 * @param {Object} phase - Phase data object
 * @returns {HTMLElement} The tray element
 */
function createDefeatedTray(phase) {
    const tray = document.createElement('div');
    tray.className = 'defeated-tray';

    const title = document.createElement('span');
    title.className = 'defeated-tray-title';
    title.textContent = '☠️ Defeated (resurrect):';
    tray.appendChild(title);

    getDefeatedEnemyIds(phase.id).forEach(id => {
        const enemy = (phase.enemies || []).find(e => String(e.id) === String(id));
        const chip = document.createElement('span');
        chip.className = 'defeated-chip';

        const name = document.createElement('span');
        name.textContent = enemy ? enemy.name : `Enemy ${id}`;
        chip.appendChild(name);

        const resurrectBtn = document.createElement('button');
        resurrectBtn.type = 'button';
        resurrectBtn.className = 'defeated-resurrect-btn';
        resurrectBtn.title = `Resurrect "${enemy ? enemy.name : id}"`;
        resurrectBtn.setAttribute('aria-label', resurrectBtn.title);
        resurrectBtn.addEventListener('click', () => {
            const fresh = capturePhaseInputValues(phase);
            resurrectEnemy(phase.id, id);
            const formsContainer = document.getElementById('enemy-forms-container');
            if (formsContainer) {
                displayEnemiesForPhase(formsContainer, phase);
                restorePhaseInputValues(phase, mergedPhaseSnapshot(phase.id, fresh));
            }
        });
        chip.appendChild(resurrectBtn);

        tray.appendChild(chip);
    });

    return tray;
}

/**
 * Create a single enemy form with inputs and results display
 * Extracted to reduce function complexity and improve maintainability
 * @param {HTMLElement} container - Parent container to append form to
 * @param {Object} enemy - Enemy data object
 * @param {Object} phase - Phase data object the enemy belongs to (used by the
 *        defeat button's per-phase state and re-render)
 */
function createEnemyForm(container, enemy, phase) {
    const enemyForm = document.createElement('div');
    enemyForm.className = 'enemy-form';
    enemyForm.id = AppConfig.idPatterns.enemy(enemy.id);

    // Add enemy name heading (with the defeat ✕ button on the right).
    // Balanced layout: [24px spacer][name centered in between][✕ button] so
    // the button never overlaps the name, even for very long enemy names.
    const nameHeading = document.createElement('div');
    nameHeading.style.display = 'flex';
    nameHeading.style.alignItems = 'center';
    nameHeading.style.gap = '6px';
    nameHeading.style.marginBottom = '15px';

    const headingSpacer = document.createElement('span');
    headingSpacer.style.width = '24px';
    headingSpacer.style.flexShrink = '0';
    nameHeading.appendChild(headingSpacer);

    const h4 = document.createElement('h4');
    h4.textContent = enemy.name || 'Unknown Enemy';
    h4.style.margin = '0';
    h4.style.flex = '1';
    h4.style.minWidth = '0';
    h4.style.textAlign = 'center';
    h4.style.overflowWrap = 'anywhere';
    nameHeading.appendChild(h4);

    // ✕ = mark this enemy as defeated: its card is removed from the page and
    // every other formula can query it via inputs.defeated_<enemyId>.
    // Reversible from the defeated-enemies tray.
    const defeatBtn = document.createElement('button');
    defeatBtn.type = 'button';
    defeatBtn.className = 'enemy-defeat-btn';
    defeatBtn.title = `Mark "${enemy.name}" as defeated (resurrectable)`;
    defeatBtn.setAttribute('aria-label', defeatBtn.title);
    defeatBtn.addEventListener('click', () => {
        const fresh = capturePhaseInputValues(phase);
        rememberPhaseInputSnapshot(phase.id, fresh);
        defeatEnemy(phase.id, enemy.id);
        const formsContainer = document.getElementById('enemy-forms-container');
        if (formsContainer) {
            displayEnemiesForPhase(formsContainer, phase);
            restorePhaseInputValues(phase, mergedPhaseSnapshot(phase.id, fresh));
        }
    });
    nameHeading.appendChild(defeatBtn);

    enemyForm.appendChild(nameHeading);

    // Create image container with card artwork and overlays
    const imgContainer = createEnemyImageContainer(enemy);
    enemyForm.appendChild(imgContainer);

    // Create input fields section (phase-wide inputs live in the shared panel)
    const formGroup = document.createElement('div');
    if (enemy.inputs && Array.isArray(enemy.inputs)) {
        enemy.inputs.forEach(input => {
            const inputElement = createInputField(enemy.id, input, () => calculateATK(enemy));
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
        // Gather input values the same way calculateATK does
        // (own inputs + phase-wide inputs, defaults applied)
        const inputs = collectEnemyInputValues(enemy, enemyForm);
        const inputDefs = collectEnemyInputDefs(enemy);
        const resultsText = formatResultsForClipboard(enemy, resultsValues, inputs, inputDefs);
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
            inputElement.setAttribute('aria-label', input.label);
            inputElement.style.position = 'absolute';
            inputElement.style.opacity = '0';
            inputElement.style.width = '1px';
            inputElement.style.height = '1px';
            inputElement.style.margin = '-1px';
            inputElement.style.clip = 'rect(0 0 0 0)';

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
            inputElement.addEventListener('click', (event) => event.stopPropagation());

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
 * @param {Array} [inputDefsOverride] - Input definitions to render as
 *        conditions (phase-wide + enemy); defaults to enemy.inputs
 * @returns {string} Formatted results text
 */
function formatResultsForClipboard(enemy, resultsValuesContainer, inputs, inputDefsOverride) {
    const lines = [];
    lines.push('═══════════════════════════════════');
    lines.push(`  ${enemy.name}`);
    lines.push('═══════════════════════════════════');
    lines.push('');
    
    // Add input conditions with better formatting (phase-wide inputs included)
    const inputDefs = (Array.isArray(inputDefsOverride) && inputDefsOverride.length > 0)
        ? inputDefsOverride
        : enemy.inputs;
    if (inputDefs && Array.isArray(inputDefs) && inputDefs.length > 0) {
        lines.push('📋 CONDITIONS USED:');
        for (const input of inputDefs) {
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
 * Owner-agnostic: used both for enemy inputs (ownerId = enemy id) and for
 * phase-wide inputs (ownerId = phase id).
 * @param {string} ownerId - Enemy or phase id (DOM id prefix)
 * @param {Object} input - Input definition
 * @param {Function} onRecalc - Recalculation callback fired on value change
 * @returns {HTMLElement|null} Form group element or null if invalid
 */
function createInputField(ownerId, input, onRecalc) {
    if (!input.id || !input.label || typeof onRecalc !== 'function') {
        console.warn(`Invalid input definition for owner ${ownerId}`);
        return null;
    }

    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';

    if (input.type === 'checkbox') {
        // Toggle-style checkbox for boolean inputs (enemy or phase-wide)
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
        hiddenCheck.id = AppConfig.idPatterns.input(ownerId, input.id);
        hiddenCheck.checked = isChecked;
        hiddenCheck.setAttribute('aria-label', input.label);
        hiddenCheck.style.position = 'absolute';
        hiddenCheck.style.opacity = '0';
        hiddenCheck.style.width = '1px';
        hiddenCheck.style.height = '1px';
        hiddenCheck.style.margin = '-1px';
        hiddenCheck.style.clip = 'rect(0 0 0 0)';

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
        hiddenCheck.syncToggleVisual = () => updateToggle(hiddenCheck.checked);

        toggleRow.addEventListener('click', () => {
            updateToggle(!hiddenCheck.checked);
            hiddenCheck.dispatchEvent(new Event('change', { bubbles: true }));
        });
        hiddenCheck.addEventListener('click', (event) => event.stopPropagation());

        hiddenCheck.addEventListener('change', () => {
            updateToggle(hiddenCheck.checked);
            onRecalc();
        });

        toggleRow.appendChild(hiddenCheck);
        toggleRow.appendChild(track);
        toggleRow.appendChild(toggleLabel);
        formGroup.appendChild(toggleRow);
    } else {
        // Text/number input with label
        const label = document.createElement('label');
        label.htmlFor = AppConfig.idPatterns.input(ownerId, input.id);
        label.textContent = input.label;

        const inputElement = document.createElement('input');
        inputElement.type = input.type || 'text';
        inputElement.id = AppConfig.idPatterns.input(ownerId, input.id);

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
                onRecalc
            );
        } else if (input.type === 'number') {
            // Simple change listener for number inputs without constraints
            inputElement.addEventListener('change', function () {
                onRecalc();
            });
        }

        formGroup.appendChild(label);
        formGroup.appendChild(inputElement);
    }

    return formGroup;
}

function createRecentPassiveSummary(entry, standardInputs, fullInputs) {
    const summary = document.createElement('div');
    summary.className = 'dc-recent-passive-summary';
    for (const [title, inputs] of [['Standard', standardInputs], ['Full', fullInputs]]) {
        const column = document.createElement('div');
        column.className = 'dc-recent-passive-column';
        const heading = document.createElement('strong');
        heading.textContent = title;
        column.appendChild(heading);
        for (const input of getBossInputDefinitions(entry)) {
            const row = document.createElement('div');
            row.className = 'dc-recent-passive-row';
            const label = document.createElement('span');
            label.textContent = input.label;
            const value = document.createElement('b');
            const inputValue = inputs[input.id];
            value.textContent = input.type === 'checkbox' ? (inputValue ? 'Yes' : 'No') : String(inputValue ?? 0);
            row.appendChild(label);
            row.appendChild(value);
            column.appendChild(row);
        }
        summary.appendChild(column);
    }
    return summary;
}

function renderRecentBossCard(container, entry, standard, full) {
    const card = document.createElement('article');
    card.className = 'dc-boss-result dc-recent-result';

    const heading = document.createElement('h3');
    heading.textContent = `${entry.type} ${entry.class} · ${entry.enemy.name}`;
    card.appendChild(heading);
    card.appendChild(createBossMeta(entry));

    const body = document.createElement('div');
    body.className = 'dc-recent-result-body';
    const imageLink = createBossPhaseLink(entry);
    imageLink.appendChild(createEnemyImageContainer(entry.enemy));
    body.appendChild(imageLink);

    const damageColumns = document.createElement('div');
    damageColumns.className = 'dc-recent-damage-columns';
    for (const result of [standard, full]) {
        const column = document.createElement('div');
        column.className = 'dc-recent-damage-column';
        const title = document.createElement('strong');
        title.textContent = 'DMG';
        column.appendChild(title);
        column.appendChild(createBossDamageValues(entry, result.damageResults, result.enemyAttackResults));
        damageColumns.appendChild(column);
    }
    body.appendChild(damageColumns);
    card.appendChild(body);
    card.appendChild(createRecentPassiveSummary(entry, standard.inputs, full.inputs));
    container.appendChild(card);
}