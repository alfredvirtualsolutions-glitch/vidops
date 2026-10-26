import { promises as fs } from "fs";
import path from "path";
import { Clip } from "./types";

const CLIPS_ROOT = path.join(process.cwd(), "public", "clips");

async function walk(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.name.toLowerCase().endsWith(".mp4")) {
      files.push(full);
    }
  }
  return files;
}

export async function listClips(): Promise<Clip[]> {
  const files = await walk(CLIPS_ROOT);
  return files.map((full) => {
    const rel = path.relative(path.join(process.cwd(), "public"), full).split(path.sep).join("/");
    const segments = rel.split("/");
    return {
      key: rel,
      url: `/${rel}`,
      name: path.basename(rel),
      category: segments.length > 2 ? segments[1] : "uncategorized",
      duration: null,
    };
  });
}
