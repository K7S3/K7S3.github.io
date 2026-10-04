# Nova Bastion 3D (Public Beta)

A They-Are-Billions-style 3D colony-defense game with Frostpunk systems.
Year 2100: humanity endures inside sealed arcologies, and you are a Bastion
Commander defending the COMMAND SPIRE against the RUST, a rogue machine
swarm. Raise walls, turrets and reactors inside the Spire's tactical uplink,
manage colony morale, weather blackout surges, sign edicts, and hold the
line across 5 sectors. Pure vanilla JS plus vendored three.js: no build
step, no CDN at runtime, no external assets. All sound effects are
synthesized live with WebAudio.

This is the **Beta 1** public test build. It lives at
`https://k7s3.github.io/tower-defense-3d/` alongside the stable 2D game at
`https://k7s3.github.io/tower-defense/`, which is untouched by this beta.

## What is in the beta

- Full 3D core: sectors 1-5 (Meridian, Kestrel, Aegis, Nocturne, Helios
  arcologies), towers, walls, reactors, the Command Spire, supply drops,
  barrels, the hero engineer, overclock and strain.
- Frostpunk layer: colony morale, colony events with choices, edicts, the
  Rust's corrupted broadcasts, story chapters with briefings and debriefs,
  and the IRA advisor.
- Co-op netcode over PeerJS: host a room, join with a code, shared sim,
  AI commanders fill empty seats (Engineer, Vanguard, Warden doctrines).
- Gamepad support: twin-stick style play, radial build menu, haptics.
- PWA: installable, offline-first via the service worker.

## Controls (quick map)

- **Mouse**: left-click select and place, right-click or Esc cancels,
  drag with the wall tool to draw wall lines, click barrels to detonate,
  click supply drops to collect, click an enemy to focus fire.
- **Keyboard**: 1-7 select tower palette, W wall tool, R reactor,
  Space starts the next wave, F speeds the game, P pauses,
  O toggles Spire overclock, U upgrades selected, X sells selected,
  Esc cancels or closes panels, ? opens help.
- **Gamepad**: left stick moves cursor, right stick aims, RT/LT confirm
  and cancel, Y opens the radial build menu, LB/RB cycle palette,
  Start opens the menu, Back toggles help.
- **Menus**: title screen (New Campaign, Continue, Co-op, How to Play,
  Settings, Credits), pause menu, sector select, event choice cards,
  edict picker, game over and victory screens.

## Known rough edges in Beta 1

- Co-op uses the public PeerJS cloud for signaling; room codes are short
  and unencrypted, fine for casual play with friends.
- No em dash was used anywhere in this file, per house style.

## For developers

File set: `index.html`, `manifest.json`, `sw.js`, `css/`, `js/` (audio,
config, towers, enemies, sectors, events, story, ira, sim, render3d,
demo3d, net, ai, ui, game, gamepad, main), `js/vendor/` (three.js,
PeerJS, fonts), `icons/`, `screenshots/`, `scripts/`.

Regenerate the service worker precache after changing the file set:

    node scripts/build-sw.js

Serve locally with any static server (service workers need http://,
not file://), then open the root URL.
