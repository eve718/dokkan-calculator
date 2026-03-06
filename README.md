# Dokkan Battle ATK Calculator

A free, accurate damage calculator for Dokkan Battle events. Enter your unit's ATK stat and instantly see how much damage you'll deal to each enemy boss across different phases.

**Live:** https://dokkan-battle-atk-calculator.netlify.app/

## Features

- **Accurate damage calculations** for all supported Dokkan Battle events
- **Phase-by-phase breakdowns** showing normal attack and super attack damage
- **Real-time results** as you adjust ATK values
- **Event-specific formulas** reverse-engineered from in-game data
- **Responsive design** that works on mobile and desktop

## Quick Start

1. **Visit the site** at the link above
2. **Choose an event** from the grid
3. **Select a stage** and phase
4. **Enter your unit's ATK stat** (visible in-game)
5. **See instant results** for normal and super attack damage

## Development

### Prerequisites
- Node.js 14+
- npm or yarn

### Installation

```bash
git clone https://github.com/eve718/dokkan-calculator.git
cd dokkan-calculator
npm install
```

### Available Scripts

- `npm run generate-og-image` — Optimize the social media preview image to 1200×630
- `npm run obfuscate` — Minify and obfuscate source files into `dist/`
- `npm run precommit` — Auto-run before git commit (obfuscates files)

### Project Structure

```
├── index.html              # Main HTML file
├── js/
│   ├── data.js            # Game data (events, stages, bosses)
│   ├── formulas.js        # Damage calculation formulas
│   ├── navigation.js      # Page routing and UI rendering
│   ├── calculator.js      # Input handling and result updates
│   └── app.js             # Bootstrap script
├── css/
│   ├── style.css          # Main styles and animations
│   └── responsive.css     # Mobile breakpoints
├── dist/                  # Obfuscated production files
├── images/
│   ├── events/            # Event card images
│   ├── enemies/           # Boss/enemy character art
│   └── icons/             # Favicons and PWA icons
└── docs/                  # Developer documentation
```

### How to Add a New Event

1. **Edit `js/data.js`:**
   - Add event entry to `gameData.events` array
   - Include stages with battles and phases
   - Add enemy entries with `inputs`, `outputs`, and `formula` ID

2. **Edit `js/formulas.js`:**
   - Add formula function with matching ID
   - Return object with `normal_atk` and `super_atk` keys

3. **Run obfuscation:**
   ```bash
   npm run obfuscate
   ```

4. **Commit and push:**
   ```bash
   git add .
   git commit -m "feat: add new event"
   git push origin main
   ```

The site auto-deploys via Netlify on every push to `main`.

## Performance

- **Mobile:** 80/100 (PageSpeed Insights)
- **Desktop:** 91/100 (PageSpeed Insights)
- **Accessibility:** 100/100
- **Best Practices:** 100/100
- **SEO:** 100/100

## License

This site is not affiliated with Bandai Namco Entertainment. Dragon Ball Z Dokkan Battle is their trademark. See [LICENSE](LICENSE) for details.

## Support

Found a bug or want to suggest a feature? [Open an issue](https://github.com/eve718/dokkan-calculator/issues).

---

For in-depth development docs, see [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md).
