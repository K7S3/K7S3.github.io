# 3D Model Credits — Nova Bastion 3D beta

All models below are **CC0 1.0 (public domain)**. Two source packs:

1. **KayKit Space Base Bits (1.0)** by Kay Lousberg (https://kaylousberg.com,
   https://kaykit.com) — "License: Creative Commons Zero, CC0" (see LICENSE.txt
   in the pack repo). Used for all towers, the Command Spire, reactor, walls,
   and supply crate. Retrieved as glTF + .bin + palette PNG from the official
   repo https://github.com/KayKit-Game-Assets/KayKit-Space-Base-Bits-1.0 and
   converted to single-file GLB with the palette texture baked into vertex
   colors (pure-JS PNG decode, per-vertex UV sampling; no geometry authored
   or modified).
2. **Kenney Space Kit** by Kenney (https://kenney.nl) — CC0 1.0. Used for
   enemies, colonists, and the fuel barrel. Retrieved from the
   eturner58/game-assets GitHub mirror of Kenney's CC0 packs.

## Towers — KayKit Space Base Bits

| File | KayKit source model |
|---|---|
| pulse_turret.glb | basemodule_A.gltf |
| cryo_projector.glb | basemodule_B.gltf |
| tesla_coil.glb | windturbine_tall.gltf |
| mortar.glb | drill_structure.gltf |
| sniper_nest.glb | lander_base.gltf |
| stasis_pylon.glb | basemodule_C.gltf |
| fabricator.glb | cargodepot_A.gltf |
| uplink_dish.glb | roofmodule_solarpanels.gltf |

## Structures — KayKit Space Base Bits

| File | KayKit source model |
|---|---|
| wall_segment.glb | structure_low.gltf |
| command_spire.glb | structure_tall.gltf |
| reactor.glb | basemodule_garage.gltf |
| supply_crate.glb | cargo_A.gltf |

## Kept from Kenney Space Kit (enemies, colonists, barrel)

| File | Kenney source model |
|---|---|
| fuel_barrel.glb | barrel.glb |
| colonist.glb | astronautA.glb |
| engineer.glb | astronautB.glb |
| scout_drone.glb | craft_speederA.glb |
| skitter.glb | rover.glb |
| swarm_mite.glb | alien.glb |
| siege_walker.glb | craft_miner.glb |
| aegis_bot.glb | craft_cargoB.glb |
| wraith.glb | craft_racer.glb |
| repair_drone.glb | craft_speederB.glb |
| splitter.glb | craft_speederC.glb |
| sapper.glb | machine_barrel.glb |
| juggernaut.glb | craft_cargoA.glb |
| dreadnought.glb | craft_cargoA.glb, root scaled (1.4, 1.3, 1.9) |
| overmind.glb | rock_crystalsLargeA.glb |
| leviathan.glb | craft_cargoB.glb, root scaled (1.8, 1.4, 2.6) |

## Notes

- KayKit GLBs: 128–1198 tris each, 9–84 KB each; whole assets/models dir is
  944 KB (budget 40 MB). Poly budget respected: swarm enemies <2k, towers
  <1.2k (limit 5–15k), spire 670 tris.
- All files validated: GLB magic (`glTF`), three.js r147 GLTFLoader parses
  every file, baked COLOR_0 vertex colors present.
- The game loads these via three.js GLTFLoader, merges each to a single
  vertex-colored geometry (pre-existing baked vertex colors are preserved),
  and falls back to code-built primitives if any file is missing or fails to
  parse. Gameplay, sim, UI and balance are untouched.
- Why not Sketchfab: downloads there require an account/OAuth token, which
  cannot be provisioned headlessly; KayKit's official GitHub repo is the
  highest-quality CC0 sci-fi pack available via direct download.
