import { promises as fs } from "fs";
import path from "path";

const args = process.argv.slice(2);
const reelType = args[0] ?? "highlights";
const targetDuration = Number(args[1] ?? 60);
const root = process.cwd();
const clipsRoot = path.join(root, "public", "clips");

async function walk(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.toLowerCase().endsWith(".mp4")) out.push(full);
  }
  return out;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const files = shuffle(await walk(path.join(clipsRoot, reelType)));
if (files.length === 0) {
  console.error(`No clips found in ${path.join(clipsRoot, reelType)}`);
  process.exit(1);
}

const selected = [];
let duration = 0;
for (const file of files) {
  if (duration >= targetDuration) break;
  const rel = path.relative(path.join(root, "public"), file).split(path.sep).join("/");
  selected.push({ src: `/${rel}`, objectFit: "cover", volume: 1, effects: [] });
  duration += 8;
}

const audioPath = process.env.AUDIO_PATH ?? "/audio/default_beat.mp3";
const props = {
  resolution: { width: 1080, height: 1920 },
  fps: 30,
  audioTrack: audioPath,
  audioVolume: 0.8,
  clips: selected,
};

const dest = path.join(root, "reel_props.json");
await fs.writeFile(dest, JSON.stringify(props, null, 2));
console.log(`Wrote ${dest} with ${selected.length} clips (~${duration}s)`);
