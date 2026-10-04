# 3D Model Credits — Nova Bastion 3D beta

All models below are **CC0 1.0 (public domain)**. Source pack: **Kenney Space Kit**
(and one file from Kenney Survival Kit), by Kenney (https://kenney.nl).
License: Creative Commons CC0 1.0 Universal — free for personal and commercial
use, no attribution required (attribution given here anyway).

Retrieved from the eturner58/game-assets GitHub mirror of Kenney's CC0 packs
(individual GLB files, unmodified except where noted). Kenney's license page:
https://kenney.nl/assets — every pack page states "License: Creative Commons CC0".

Three files are proportion variants produced by baking a non-uniform scale into
the GLB root node (no geometry authored): sniper_nest.glb, dreadnought.glb,
leviathan.glb. swarm_mite.glb is used for two enemy types at different scales.

## Towers (`tower_*`)

| File | Kenney source model | Pack |
|---|---|---|
| pulse_turret.glb | turret_single.glb | Space Kit |
| cryo_projector.glb | satelliteDish_detailed.glb | Space Kit |
| tesla_coil.glb | machine_wireless.glb | Space Kit |
| mortar.glb | turret_double.glb | Space Kit |
| sniper_nest.glb | turret_single.glb, root scaled (0.75, 1.6, 0.75) | Space Kit |
| stasis_pylon.glb | chimney_detailed.glb | Space Kit |
| fabricator.glb | machine_generator.glb | Space Kit |
| uplink_dish.glb | satelliteDish.glb | Space Kit |

## Structures (`struct_*` / wall / spire / reactor / barrel / crate / colonist / engineer)

| File | Kenney source model | Pack |
|---|---|---|
| wall_segment.glb | corridor_wall.glb | Space Kit |
| command_spire.glb | structure_detailed.glb | Space Kit |
| reactor.glb | machine_generatorLarge.glb | Space Kit |
| fuel_barrel.glb | barrel.glb | Space Kit |
| supply_crate.glb | box.glb | Survival Kit |
| colonist.glb | astronautA.glb | Space Kit |
| engineer.glb | astronautB.glb | Space Kit |

## Enemies (`enemy_*`)

| File | Kenney source model | Pack |
|---|---|---|
| scout_drone.glb | craft_speederA.glb | Space Kit |
| skitter.glb | rover.glb | Space Kit |
| swarm_mite.glb | alien.glb | Space Kit |
| siege_walker.glb | craft_miner.glb | Space Kit |
| aegis_bot.glb | craft_cargoB.glb | Space Kit |
| wraith.glb | craft_racer.glb | Space Kit |
| repair_drone.glb | craft_speederB.glb | Space Kit |
| splitter.glb | craft_speederC.glb | Space Kit |
| sapper.glb | machine_barrel.glb | Space Kit |
| juggernaut.glb | craft_cargoA.glb | Space Kit |
| dreadnought.glb | craft_cargoA.glb, root scaled (1.4, 1.3, 1.9) | Space Kit |
| overmind.glb | rock_crystalsLargeA.glb | Space Kit |
| leviathan.glb | craft_cargoB.glb, root scaled (1.8, 1.4, 2.6) | Space Kit |

## Notes

- All files validated: GLB magic (`glTF`), JSON chunk parses, triangle counts
  36–876 each (limit 5,000), total 668 KB (budget 15 MB).
- The game loads these via three.js GLTFLoader, merges each to a single
  vertex-colored geometry, and falls back to code-built primitives if any file
  is missing or fails to parse. Gameplay, sim, UI and balance are untouched.
