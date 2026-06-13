/**
 * One-off: replace ad-hoc pixel font sizes with Tailwind scale tokens.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "src");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      walk(p, out);
    } else if (/\.(jsx|js|tsx|ts|css)$/.test(ent.name)) out.push(p);
  }
  return out;
}

const files = walk(root);
let changed = 0;
for (const file of files) {
  let c = fs.readFileSync(file, "utf8");
  const orig = c;
  c = c.replace(/text-\[10px\]/g, "text-xs leading-tight");
  c = c.replace(/text-\[11px\]/g, "text-xs");
  c = c.replace(/text-\[9px\]/g, "text-xs leading-tight");
  c = c.replace(/text-\[15px\]/g, "text-base");
  if (c !== orig) {
    fs.writeFileSync(file, c, "utf8");
    changed++;
  }
}
console.log(`Updated ${changed} files`);
