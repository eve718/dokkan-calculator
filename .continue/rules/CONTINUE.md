# CONTINUE.md - Project Guide

Welcome to the **Dokkan Battle Enemy ATK Calculator** project! This guide provides a comprehensive overview of the codebase to help you get started quickly and follow our development standards.

## 1. Project Overview
The Dokkan Battle ATK Calculator is a web-based tool for players to predict enemy attack damage. It features real-time calculations, multi-phase battle support, and sharing capabilities.

- **Key Technologies:** Vanilla JavaScript (ES6+), HTML5, CSS3, [javascript-obfuscator](https://github.com/javascript-obfuscator/javascript-obfuscator) for production builds.
- **Architecture:** Single Page Application (SPA) using a custom navigation system. Data-driven UI where the structure is defined in `js/data.js` and calculations in `js/formulas.js`.

## 2. Getting Started
### Prerequisites
- Node.js 14+
- npm or yarn

### Installation
```bash
git clone https://github.com/eve718/dokkan-calculator.git
cd dokkan-calculator
npm install
```

### Basic Usage
1. Open `index.html` in your browser (or use a local server like Live Server).
2. Navigate through Events -> Stages -> Battles -> Phases.
3. Select an enemy and input stats (ATK, buffs, etc.) to see calculated results.

### Running Scripts
- `npm run generate-og-image`: Generates social media preview images.
- `npm run obfuscate`: Minifies and obfuscates `js/data.js` and `js/formulas.js` into the `dist/` folder.

## 3. Project Structure
```text
├── index.html              # Main entry point and script orchestrator
├── js/
│   ├── config.js          # AppConfig - central configuration & constants
│   ├── data.js            # Hierarchical game data (Events -> Stages -> ...)
│   ├── formulas.js        # Logic for damage calculations
│   ├── navigation.js      # SPA routing and UI rendering logic
│   ├── calculator.js      # Input handling and result updating
│   └── app.js             # Application bootstrap
├── css/
│   ├── style.css          # Main layout and theme
│   └── responsive.css     # Mobile-first responsiveness
├── dist/                  # Obfuscated JS files for production
├── images/                # Assets for events, enemies, and icons
└── docs/                  # Detailed developer guides and logs
```

## 4. Development Workflow
### Critical Script Order
The order in `index.html` is vital for dependency management:
1. `config.js` -> 2. `data.js` -> 3. `formulas.js` -> 4. `navigation.js` -> 5. `calculator.js` -> 6. `app.js`.

### Coding Standards
- **Use `AppConfig`**: Always use `js/config.js` for constants, animation timings, and ID generation patterns.
- **CamelCase**: Use camelCase for variables and functions.
- **Validation**: Ensure all new inputs are wrapped with `setupInputValidation` in `calculator.js`.

### Deployment
The project is hosted on **Netlify**. It auto-deploys from the `main` branch. 
*Note: Run `npm run obfuscate` before committing to update production files.*

## 5. Key Concepts
- **Data-Driven UI**: The UI is generated dynamically based on the objects in `js/data.js`.
- **Formula Mapping**: Each enemy in `data.js` has a `formula` ID that maps to a function in `formulas.js`.
- **SPA Routing**: `navigation.js` manages state (`currentPage`, `currentEventId`, etc.) and handles DOM replacement with fade animations.

## 6. Common Tasks
### Adding a New Event/Enemy
1. Define the event structure in `js/data.js`.
2. Add the corresponding calculation function in `js/formulas.js` using the same ID.
3. Add character/event images to the `images/` directory.

### Updating UI Styles
- Use `css/style.css` for global styles.
- Use `css/responsive.css` for media queries (Mobile < 768px).

## 7. Troubleshooting
- **Calculations not updating?** Check if the `enemy.id` and input `id` match the pattern in `AppConfig.idPatterns`.
- **Navigation broken?** Verify script load order in `index.html`.
- **"Formula not found"?** Ensure the ID in `data.js` matches the key in `formulaFunctions` within `formulas.js`.

## 8. References
- [Detailed Developer Guide](docs/DEVELOPER_GUIDE.md)
- [Refactoring Summary](docs/REFACTORING_SUMMARY.md)
- [Project Changelog](docs/CHANGELOG.md)

---
*This guide is automatically loaded by Continue to provide context for your development tasks.*
