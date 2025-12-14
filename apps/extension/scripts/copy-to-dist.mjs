import { mkdir, copyFile, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd(); // apps/extension
const dist = path.join(root, "dist");

await mkdir(dist, { recursive: true });

// Copy manifest.json -> dist/manifest.json
await copyFile(path.join(root, "manifest.json"), path.join(dist, "manifest.json"));

// Copy icons folder if it exists
const iconsSrc = path.join(root, "public", "icons");
const iconsDest = path.join(dist, "icons");

if (existsSync(iconsSrc)) {
    await cp(iconsSrc, iconsDest, { recursive: true });
}

console.log("[copy-to-dist] Copied manifest + icons to dist/");
