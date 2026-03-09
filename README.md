# Dokkan Battle Enemy ATK Calculator

A free calculator for Dokkan Battle players to predict how much damage an enemy will deal during a fight. Navigate to the phase you're fighting, input your scenario (phase conditions, buffs, debuffs, etc.), and instantly see attack damage predictions. Copy results to share with other players for help, or download enemy images to use in discussions.

**Live:** https://dokkan-battle-atk-calculator.netlify.app/

## Features

- **Instant damage predictions** - Choose your fight scenario and see how hard the enemy hits
- **Real-time calculations** - Adjust inputs and watch results update instantly
- **Copy results** - Share your calculation with other players to ask for help
- **Download enemy images** - Save and share enemy stats with the community
- **Favorite phases** - Quick access to phases you fight frequently or plan to revisit
- **Comprehensive breakdowns** - View normal attacks, super attacks, AOE damage, and more
- **Works on mobile & desktop** - Calculate damage predictions anywhere

## How to Use

1. **Visit the site** at the link above
2. **Select your event** from the grid
3. **Navigate to your stage** and battle
4. **Choose the phase** where you're fighting
5. **Select the enemy** you're facing
6. **Input your fight scenario** (current conditions, the enemy's state, any buffs/debuffs, etc.)
7. **See the damage prediction** - Instant results for normal attacks, super attacks, and AOE attacks
8. **Copy or download** to share with other players or save for reference

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
