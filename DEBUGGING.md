# Debugging Results Display Issue

## How to Collect Debug Logs

1. **Open the app in your browser** (http://localhost:8080)
2. **Open browser Developer Tools** (Press F12 or right-click → Inspect)
3. **Go to the Console tab**
4. **Clear the console** (click the circle icon)
5. **Navigate to an enemy** (Events → Stage → Battle → Phase → Select an enemy)
6. **Copy ALL console output** and paste it below

## What to Look For

The logs will follow this pattern:

```
[displayEnemiesForPhase] Rendering phase with X enemies
[displayEnemiesForPhase]   Creating form for enemy 1/1: 1722001511 - Goku Black...
[createEnemyForm] Creating form for enemy: 1722001511, has 5 outputs
[createEnemyForm] Created form for enemy 1722001511, triggering calculation...
[calculateEnemyATK] Looking for formula: 1722001511
[calculateEnemyATK] Formula found: true, is function: true
[calculateEnemyATK] Formula executed successfully, returned: {...}
[calculateATK] Enemy: 1722001511, Formula: 1722001511
[calculateATK] Inputs: {...}
[calculateATK] Results: {...}
[calculateATK] Found existing card: true, container: true
[calculateATK] Checking if can populate results...
[calculateATK] ✓ Proceeding to populate results for enemy...
[calculateATK] ✓ SHOWING results card for enemy 1722001511
```

## Critical Points to Check

1. **Is the formula found?** → Look for "[calculateEnemyATK] Formula found:"
2. **Are results returned?** → Look for "[calculateATK] Results:" - should NOT be empty {}
3. **Is results card found?** → Look for "[calculateATK] Found existing card: true"
4. **Are results displayed?** → Look for "[calculateATK] ✓ SHOWING results card"

If you see any error messages or if results show "NO visible results", paste the console output here and I'll identify the issue.
