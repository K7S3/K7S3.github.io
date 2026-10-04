# Nova Bastion

A neon space tower-defense game. Build turrets on hex plots, upgrade them into
specialized branches, chain tower synergies, and hold the line against the void
swarm across 5 sectors. Pure vanilla JS: no frameworks, no build step, no
external assets (no CDN, no webfonts, no images). All sound effects are
synthesized live with WebAudio.

Play it at: `https://k7s3.github.io/tower-defense/`

## How to play

- Enemies travel along the glowing path toward your bastion. If they reach the
  end, you lose lives. Lose all lives and the sector falls.
- Tap a glowing hex plot to open the build shop (8 towers). Tap a tower to
  inspect it, upgrade it, pick a specialization branch at max tier, or sell it.
- Tap empty space to deselect. On desktop, hovering a tower previews its range.
- Press **Start Wave** (or the pulsing Wave button during intermission) to send
  the next wave. Calling a wave early grants **bonus gold**.
- Clearing a wave grants gold. Kills grant bounties. Spend it on more towers.
- Beat all waves to secure the sector and earn up to 3 stars. Beating a sector
  unlocks the next one. Progress is saved in your browser.

## Controls

| Input | Action |
|---|---|
| Tap / click plot | Open build shop |
| Tap / click tower | Open tower panel (upgrade, branch, sell) |
| Tap / click empty space | Deselect / close panel |
| Hover tower (desktop) | Preview attack range |
| Space | Pause / resume |
| 1 / 2 / 3 | Game speed 1x / 2x / 3x |
| Esc | Close panel, or pause |

## Tower roster

Towers are defined in `js/towers.js`. Each has 8 behaviors with distinct
silhouettes on the battlefield:

| Tower | Role |
|---|---|
| Pulse | Reliable orb turret, balanced damage |
| Frost | Slows and can freeze enemies in a crystal burst |
| Arc | Tesla coil, chains lightning between targets |
| Mortar | Lobs explosive shells with splash damage |
| Sniper | Long needle, huge range, slow heavy hits |
| Chrono | Time ring that slows enemies in an aura |
| Mint | Coin stack, generates bonus gold over time |
| Amplify | Broadcast dish that buffs nearby towers |

Each tower has upgrade tiers and, at max tier, a choice of two specialization
branches (A / B) that reshape its stats. Selling refunds part of the total
spent. Effective DPS shown in the tower panel is `damage x fireRate`.

## Enemy roster

Enemies are defined in `js/enemies.js`. Shapes on the battlefield match the
type: drones are triangles, runners are darts, tanks are hexagons,
shieldbearers carry shield rings, phantoms flicker in and out of phase, medics
heal allies, splitters break apart, brutes are oversized hexes, and bosses
arrive with crown spikes and a warning siren.

Watch for status cues: blue tint means slowed, an ice box means frozen, a
dashed ring means untargetable, and the cyan arc is remaining shield.

## Synergies

Certain tower combinations unlock synergies (`NB.SYNERGIES`): passive bonuses
that apply while the required towers stand together. Active synergies are
marked with a sparkle on the tower and listed in its panel. Full descriptions
are in the in-game How to Play screen.

## Economy rules

- You start each sector with the sector's `startGold` and `lives`.
- Kills pay the enemy's `bounty` in gold. Wave clears pay a bonus.
- Calling a wave early during intermission pays extra bonus gold.
- Build, upgrade, and branch costs are paid in gold; costs rise per tier.
- Selling a tower refunds a portion of everything spent on it.
- Leaked enemies cost lives (tougher enemies can cost more than one).
- Stars: 3 for a flawless or near-flawless defense, fewer as more lives are
  lost. Zero monetization: no ads, no purchases, no tracking.

## File layout

```
tower-defense/
  index.html        Page, HUD, screens, panels (script order: config, towers,
                    enemies, levels, audio, sim, render, ui, game, main)
  css/style.css     Neon deep-space theme, responsive + touch targets
  js/audio.js       NB.Audio: procedural WebAudio SFX, mute persisted
  js/render.js      NB.Renderer: canvas drawing, particles, banners
  js/ui.js          NB.UI: screens, HUD, panels, toasts, save data
  js/game.js        NB.Game: sim/renderer/UI controller, input, event routing
  js/main.js        Boot: audio unlock, controller init, title screen
```

Data and simulation layers (written alongside the frontend):

```
  js/config.js      NB.CONFIG (960x600 board, storage key, speeds)
  js/towers.js      NB.TOWERS (8 tower definitions, tiers, branches)
  js/enemies.js     NB.ENEMIES (enemy stats per type)
  js/levels.js      NB.LEVELS (5 sectors: paths, plots, waves, anomalies),
                    NB.SYNERGIES
  js/sim.js         NB.createSim: the game simulation
```

The frontend codes defensively against these: every data file has a fallback,
and the game shows a toast instead of crashing if the sim is missing.

## Dev notes

Run locally with any static server from the repo root, for example:

```
python3 -m http.server 8000
```

then open `http://localhost:8000/tower-defense/`.

Syntax-check every script with:

```
for f in js/*.js; do node --check "$f"; done
```

Save format in `localStorage` under the config storage key:

```json
{ "stars": { "<levelId>": 1-3 }, "best": { "<levelId>": { "time": 123, "lives": 18 } }, "unlocked": 2 }
```

Mute preference is stored separately as `nova_bastion_muted_v1`.

## Zero-monetization statement

Nova Bastion has no ads, no in-app purchases, no accounts, and no analytics.
Your sector progress and mute preference live only in your browser's
`localStorage`. Nothing leaves your device.
