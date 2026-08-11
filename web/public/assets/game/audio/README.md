# Echoes at Dawn audio assets

Runtime audio uses Ogg Opus as the primary Chromium path and MP3 as the fallback. All source assets below are released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Attribution is not required, but the original creators and source pages are retained here for provenance.

| Runtime cue | Selected source file | Original work | Creator | Source |
| --- | --- | --- | --- | --- |
| `bgm/field-dark-shrine` | `qubodup-yd-DarkShrineLoop-OpenGameArt.flac` | Dark Shrine Loop | qubodup | https://opengameart.org/content/dark-shrine-loop |
| `bgm/field-relay-camp` | `once_upon_a_time_loop.wav` | Once Upon a Time (loop) | TAD | https://opengameart.org/content/once-upon-a-time-loop |
| `bgm/battle-standard` | `Fighting is not an option.wav` | RPG Battle Theme II | CleytonKauffman | https://opengameart.org/content/rpg-battle-theme-ii |
| `bgm/battle-boss` | `space_boss_battle_bpm175_0.ogg` | Space Boss Battle | MintoDog | https://opengameart.org/content/space-boss-battle |
| `se/ui/navigate`, `confirm`, `cancel` | `rollover2.wav`, `click1.wav`, `switch14.wav` | 51 UI sound effects | Kenney | https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks |
| `se/battle/attack`, `magic`, `enemy-hit`; `se/field/recovery` | `blade_02.ogg`, `spell_01.ogg`, `creature_roar_03.ogg`, `item_gem_01.ogg` | 80 CC0 RPG SFX | rubberduck | https://opengameart.org/content/80-cc0-rpg-sfx |

## Conversion

- Music: `ffmpeg` Opus 96 kbps VBR and MP3 128 kbps CBR.
- Effects: `ffmpeg` Opus 48 kbps VBR and MP3 64 kbps CBR.
- Source metadata was stripped from runtime derivatives.
- The original downloads are intentionally not committed; only the selected, compressed runtime derivatives are included.

The catalog and per-cue mix levels live in `web/src/game/audio/audio-catalog.ts`.
