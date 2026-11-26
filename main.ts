// Dawn Patrol: Island Run — hand-in program (Node 22, standard library only).
//
// The game is the static tree in ./game: index.html plus plain ES modules, no build step,
// no library and no network request. This program copies ./game and ./screenshots into the
// output directory (the grader's /output, or $MAKEFUN_OUTPUT_DIR when run by hand) and writes
// dossier.json with the kit's make.fun library so the judge can read the source outline and the
// three screenshots.
//
// Local check:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play it:
//   node serve.ts         → http://localhost:8080

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputRoot = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer refuses an entry beyond these limits; passing them to buildDossier also keeps the
// dossier itself honest about what fits (160 KiB of source text, four screenshots at 256 KiB).
const LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(outputRoot, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputRoot, 'game'), { recursive: true });

const shotSource = join(repoRoot, 'screenshots');
if (existsSync(shotSource)) {
  mkdirSync(join(outputRoot, 'screenshots'), { recursive: true });
  cpSync(shotSource, join(outputRoot, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(outputRoot, LIMITS);
writeFileSync(join(outputRoot, 'dossier.json'), dossier);

const kilobytes = (dossier.length / 1024).toFixed(1);
console.log(`Dawn Patrol handed in: ${join(outputRoot, 'dossier.json')} (${kilobytes} KiB)`);
