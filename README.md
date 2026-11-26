[![Best Flight Game](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/museuser15416081/makefun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/museuser15416081/makefun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# Dawn Patrol: Island Run

A side-view flight sortie over a small procedural island, written in plain JavaScript on a
single canvas with no libraries and no downloaded assets. One lap, one aeroplane, three jobs:
lift off from the dawn strip, thread five glowing gates in order, then grease it back onto the
tarmac. The sky warms as the sortie goes on, the island scrolls past layered hills, farmland, a
river, a coast road and a hill town, and the engine hum, wind, gate chimes and touchdown thud
are all synthesised with WebAudio.

Fuel is a real decision: a wide-open throttle drinks it, a lean cruise saves it, and if the tanks
run dry the engine quits and the last miles are a glide. Gates pay extra for speed, the clock
pays for a quick lap, and the landing is scored on sink rate, trim speed and how close to the
centreline you arrive. A hard landing or a ridge strike ends the sortie with a clear report.

## Controls

| Input | Action |
| --- | --- |
| `W` / `S` or `↑` / `↓` | throttle up / down |
| `A` / `D` or `←` / `→` | climb / dive |
| Mouse | point where you want the nose (optional steer) |
| `Enter` / `Space` | start, resume, fly again |
| `P` / `Esc` | pause |
| `M` | mute |

Lift off at about 100 knots: open the throttle, then ease back. Keep an eye on the airspeed —
below the stall the wing stops lifting. The runway reappears after the last gate; descend
gently, flare, and touch down under 600 ft/min.

## Run it locally

No build step. Node 22.18 or newer, then:

```sh
node serve.ts
```

Open <http://localhost:8080>. Any static file server pointed at `game/` works too. The three
screenshots in `screenshots/` are deterministic staged frames: `?shot=start&seed=1` (title, plane
on the runway at dawn), `?shot=play&seed=1` (mid-flight through gate two), and `?shot=end&seed=1`
(clean landing with the score breakdown).

## Hand-in layout

- `game/` — static game: `index.html` and ES modules in `game/src/` (config, seeded random,
  input, terrain, flight model, mission, world glue, HUD, renderer, staged shots, audio, boot).
- `screenshots/` — three real renders of the game.
- `main.ts` — copies `game/` and `screenshots/` to the output directory and writes `dossier.json`
  with `vendor/makefun-game.ts`.
- `serve.ts` — small local static server on port 8080.
- `LICENSE` — MIT.

<sub>Entered on [make.fun](https://make.fun/?ref=mdw2e7jm&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
