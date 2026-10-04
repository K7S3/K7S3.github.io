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

- **Mouse / touch**: left-click selects and places, right-click or Esc
  cancels, drag with the wall tool to draw wall lines, click barrels to
  detonate them, click supply drops to collect, click an enemy to focus
  fire on it, hover for tooltips.
- **Keyboard**: Space pauses, Esc cancels place mode and closes panels,
  1/2/3 set game speed, Q/E rotate the camera.
- **Gamepad**: left stick moves a virtual cursor, A confirms and places,
  B cancels (also skips briefings), X starts the next wave early for
  bonus gold, Y cycles game speed, Start starts from the title or opens
  the pause menu, Back asks IRA for a situation report, LS recenters the
  cursor, RS jumps the camera back to the Spire, LB/RB zoom, LT/RT rotate,
  D-pad navigates menus.
- **HUD**: pause, mute, menu, wave start, call-early, overclock, and
  Spire upgrade buttons; selected towers offer upgrade, sell, and
  branch A/B; walls offer repair and sell; reactors offer sell.
- **Screens**: title (Start/Continue, Co-op, How to Play, Codex), co-op
  lobby (host with a room code, join with a code), sector briefing
  (read or skip), colony event cards and edict picker, pause menu,
  disconnect overlay with a rejoin countdown, and end-of-sector
  debrief with replay.

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
