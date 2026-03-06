# Dokkan Calculator - Quick Reference for Developers

## Project Structure

```
dokkan-calculator/
├── index.html                    # Entry point with script load order
├── package.json                  # Build scripts and dependencies
├── REFACTORING_SUMMARY.md       # Complete refactoring documentation (NEW)
├── CHANGELOG.md                 # Detailed change log (NEW)
│
├── js/
│   ├── config.js               # AppConfig central configuration (NEW)
│   ├── data.js                 # Game data: events → stages → battles → phases → enemies
│   ├── formulas.js             # ATK calculation functions indexed by enemy ID
│   ├── navigation.js           # SPA routing and page rendering (REFACTORED)
│   ├── calculator.js           # Input validation and result display
│   ├── app.js                  # Application bootstrap
│   ├── data-obfuscated.js      # Obfuscated data.js (production)
│   └── formulas-obfuscated.js  # Obfuscated formulas.js (production)
│
├── css/
│   ├── style.css               # Main stylesheet
│   └── responsive.css          # Responsive layout rules
│
└── images/
    ├── events/                 # Event card artwork
    └── enemies/                # Character and card frame images
```

---

## Critical Load Order

⚠️ **MUST be followed - script order determines what's available:**

1. **config.js** (NEW) - AppConfig must load FIRST
2. **data.js** - Game data structure
3. **formulas.js** - Calculation functions
4. **navigation.js** - UI routing (depends on data, calculator, config)
5. **calculator.js** - Input handling (depends on formulas, config)
6. **app.js** - Bootstrap (depends on navigation)

❌ **If you change script order, the app breaks!**

---

## Using AppConfig

### Access Configuration Anywhere
```javascript
// Import is automatic - AppConfig is global
const timing = AppConfig.pageTransitionDuration;  // 300ms
const delay = AppConfig.inputDebounceDelay;       // 500ms
```

### Available Constants
```javascript
AppConfig.pageTransitionDuration    // 300ms - Page fade animations
AppConfig.inputDebounceDelay        // 500ms - Input field validation delay
AppConfig.inputCorrectionDelay      // 800ms - Auto-correct timing
AppConfig.retryCheckDelay           // 100ms - DOM element retry interval

AppConfig.idPatterns.input(enemyId, inputId)      // Generate input ID
AppConfig.idPatterns.output(enemyId, outputId)    // Generate output ID
AppConfig.idPatterns.enemy(enemyId)               // Generate enemy form ID

AppConfig.getInputElement(enemyId, inputId)       // Get input element
AppConfig.getOutputElement(enemyId, outputId)     // Get output element

AppConfig.cssClasses.pageActive                   // 'active'
AppConfig.cssClasses.fadeIn                       // 'fade-in'
```

### ✅ DO: Use AppConfig
```javascript
// Good - centralized, maintainable
setTimeout(() => {
    container.classList.add(AppConfig.cssClasses.pageActive);
}, AppConfig.pageTransitionDuration);

const inputId = AppConfig.idPatterns.input(enemy.id, input.id);
```

### ❌ DON'T: Hardcode Values
```javascript
// Bad - scattered magic numbers
setTimeout(() => {
    container.classList.add('active');
}, 300);

const inputId = `${enemy.id}_${input.id}`;
```

---

## Code Patterns

### Standard Function Template
```javascript
/**
 * Clear, descriptive name following camelCase
 * One sentence explaining what it does
 * 
 * @param {type} requiredParam - Description of parameter
 * @param {type} [optionalParam] - Optional parameters use brackets
 * @returns {type} Description of return value
 */
function myFunction(requiredParam, optionalParam) {
    // 1. Validate required parameters
    if (!requiredParam) {
        console.warn('myFunction: requiredParam is required');
        return null;
    }

    // 2. Validate optional parameters
    if (optionalParam && typeof optionalParam !== 'expected-type') {
        console.warn('myFunction: optionalParam has unexpected type');
        optionalParam = defaultValue;
    }

    // 3. Execute with try/catch for risky operations
    try {
        // Core logic here
        return result;
    } catch (error) {
        console.error('myFunction: execution failed', error);
        return null;
    }
}
```

### Error Handling Levels
```javascript
console.warn()   // Non-critical issues (invalid parameters, missing optional data)
console.error()  // Critical failures (formula not found, DOM element missing)
console.log()    // Debug info only (avoid in production code)
```

### ID Generation Pattern
```javascript
// Always use AppConfig to avoid typos and maintain consistency
const inputId = AppConfig.idPatterns.input(enemy.id, input.id);
const outputId = AppConfig.idPatterns.output(enemy.id, output.id);
const enemyId = AppConfig.idPatterns.enemy(enemy.id);

// Or use getter functions with built-in null checking
const element = AppConfig.getInputElement(enemy.id, input.id);
```

---

## Navigation & Routing

### Main Router
```javascript
/**
 * Navigation entry point - shows specified page
 * Handles fade in/out animations
 * Updates breadcrumb and internal state
 */
showPage(page, eventId, stageId, battleId)
```

### Page Navigation Flow
```
Events Page
  ↓ (click event)
Stages Page (for selected event)
  ↓ (click stage)
Battles Page (for selected stage)
  ↓ (click battle)
Enemies Page (with phase selector for multi-phase battles)
  ↓ (click phase or enter values)
ATK Calculations Display
```

### State Variables
```javascript
currentPage          // Current page: 'events', 'stages', 'battles', 'enemies'
currentEventId       // Selected event
currentStageId       // Selected stage
currentBattleId      // Selected battle
currentContentView   // Current rendered content DOM element
```

---

## Calculator & Input Validation

### Calculation Flow
```
User enters value in input field
  ↓
Input validation triggered (debounced 500ms)
  ↓
calculateATK(enemy) called
  ↓
Reads all enemy inputs
  ↓
Calls formulaFunctions[enemy.formula](inputs)
  ↓
Updates result display elements
```

### Input Element ID Pattern
```javascript
// Format: "${enemyId}_${inputId}"
Example: "5162_attack_power" ← input field
         "5162_normal_atk"   ← result display
```

### Adding Input Validation to New Field
```javascript
setupInputValidation(inputElement, min, max, defaultValue, enemy);
```

---

## Data Structure

### Game Data Hierarchy
```javascript
gameData = {
    events: [
        {
            id: "event_001",
            name: "Event Name",
            image: "images/events/..."
            stages: [
                {
                    id: "stage_001",
                    name: "Stage Name",
                    // Either battles array (new) or phases array (legacy)
                    battles: [
                        {
                            id: "battle_001",
                            name: "Battle Name",
                            phases: [  // Can have multiple phases
                                {
                                    name: "Phase 1",
                                    enemies: [
                                        {
                                            id: "5162",
                                            name: "King Vegeta",
                                            image: "images/enemies/...",
                                            formula: "1722001511",  // Reference to formulaFunctions
                                            inputs: [
                                                { id: "attack_power", label: "ATK", type: "number", min: 0, max: 9999, default: 100 },
                                                { id: "has_bonus", label: "Bonus?", type: "checkbox", default: false }
                                            ],
                                            outputs: [
                                                { id: "normal_atk", label: "Normal ATK" },
                                                { id: "super_atk", label: "Super ATK" }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}
```

---

## Formulas Module

### Adding a New Calculation Function

1. **Add to js/formulas.js:**
```javascript
formulaFunctions[1722001511] = function(inputs) {
    const baseAtk = inputs.attack_power || 100;
    const hasBonus = inputs.has_bonus || false;
    const multiplier = hasBonus ? 1.5 : 1.0;
    
    return {
        normal_atk: Math.floor(baseAtk * 1.0 * multiplier),
        super_atk: Math.floor(baseAtk * 2.0 * multiplier)
    };
};
```

2. **Add enemy to js/data.js:**
```javascript
{
    id: "5162",
    name: "King Vegeta",
    formula: "1722001511",  // ← Must match key in formulaFunctions
    inputs: [...],
    outputs: [
        { id: "normal_atk", label: "Normal ATK" },
        { id: "super_atk", label: "Super ATK" }
    ]
}
```

3. **Verify in browser:**
   - No console errors about "Formula not found"
   - Results display correctly when inputs are entered

---

## Common Tasks

### Change Animation Timing
```javascript
// Edit js/config.js, line ~15
AppConfig.pageTransitionDuration = 300;  // Change this value

// All pages automatically use new timing - no other changes needed!
```

### Change Input Validation Delay
```javascript
// Edit js/config.js, line ~16
AppConfig.inputDebounceDelay = 500;  // Milliseconds before validation triggers
```

### Add New Enemy
```javascript
// 1. Edit js/data.js - add to appropriate phase.enemies array
{
    id: "new_enemy_id",
    name: "New Enemy Name",
    image: "images/enemies/...",
    formula: "formula_id",  // Reference in formulas.js
    inputs: [...],
    outputs: [...]
}

// 2. Edit js/formulas.js - add calculation function
formulaFunctions["formula_id"] = function(inputs) {
    return { result_id: calculatedValue };
};

// 3. Test in browser - should appear in UI immediately
```

### Change Retry Interval for DOM Lookups
```javascript
// Edit js/config.js, line ~17
AppConfig.retryCheckDelay = 100;  // Milliseconds between retry attempts

// Used when elements aren't yet in DOM (rare case)
```

---

## Debugging Tips

### Check Browser Console (F12)
```javascript
// All console messages use consistent patterns:
console.warn()   // Yellow icon - non-critical issues
console.error()  // Red icon - critical failures

// Example outputs:
// ⚠️ displayEnemiesForPhase: phase.enemies is missing/invalid
// ❌ Formula not found for ID 1722001511
// ✓ No errors = everything working!
```

### Verify AppConfig Loaded
```javascript
// Open browser console (F12) and type:
AppConfig
// Should show entire object with all configuration values
// If undefined: config.js didn't load - check index.html script order
```

### Check Element IDs
```javascript
// Browser console - find input element:
document.getElementById("5162_attack_power")
// Should return the input element
// If null: ID pattern mismatch - check enemy.id and input.id values
```

### Monitor Calculation
```javascript
// Edit js/calculator.js temporarily - add to calculateATK():
console.log('Calculating for enemy:', enemy.id);
console.log('Formula ID:', enemy.formula);
console.log('Inputs:', inputs);
console.log('Results:', results);

// Then check console while entering values
```

---

## Testing Checklist

Before committing changes:

- [ ] No console errors (F12 → Console tab)
- [ ] All pages navigate correctly (Events → Stages → Battles → Enemies)
- [ ] Calculations update as you type
- [ ] Phase switching works with multiple phases
- [ ] Animations feel smooth (300ms fade)
- [ ] Invalid input shows error styling
- [ ] Auto-correct triggers after 800ms of invalid input
- [ ] Browser network tab shows all JS files loaded
- [ ] AppConfig accessible in console

---

## Build & Deployment

### Local Development
```bash
# Just open in browser
start index.html

# Or use a local server
python -m http.server 8000
# Then visit http://localhost:8000
```

### Production Build (Obfuscation)
```bash
npm run obfuscate
# Creates:
# - js/data-obfuscated.js
# - js/formulas-obfuscated.js
# Note: config.js is NOT obfuscated (contains reference keys)
```

### Deploy to Netlify
```bash
# Netlify automatically uses pre-built obfuscated files
npm run netlify-build  # (This is a no-op by design)
```

---

## Resources

**Documentation:**
- [REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md) - Complete architectural overview
- [CHANGELOG.md](CHANGELOG.md) - Detailed change log with before/after examples

**Configuration:**
- [js/config.js](js/config.js) - All constants in one place

**Key Files:**
- [index.html](index.html) - Entry point (check script order here)
- [js/navigation.js](js/navigation.js) - Page routing and rendering
- [js/calculator.js](js/calculator.js) - Input handling and calculations
- [js/data.js](js/data.js) - Game data structure

---

## Questions?

Refer to:
1. **How does X work?** → Check REFACTORING_SUMMARY.md
2. **What changed?** → Check CHANGELOG.md
3. **Where is constant X?** → Look in js/config.js
4. **How do I add Y?** → See Common Tasks section above
5. **Why is error Z?** → Check Debugging Tips section

---

**Remember:** This codebase is now organized, documented, and future-proof. Follow the patterns established in this file and you'll maintain that quality! ✅
