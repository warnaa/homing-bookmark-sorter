import { access, readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(dist, relativePath), "utf8"));
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(target)));
    else files.push(target);
  }
  return files;
}

const manifest = await readJson("manifest.json");
const messages = await readJson("_locales/en/messages.json");
const requiredFiles = [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  manifest.options_ui?.page,
  "_locales/en/messages.json",
  ...Object.values(manifest.icons ?? {}),
  ...Object.values(manifest.action?.default_icon ?? {}),
].filter(Boolean);

for (const relativePath of requiredFiles) {
  await access(path.join(dist, relativePath));
}

const manifestText = JSON.stringify(manifest);
for (const match of manifestText.matchAll(/__MSG_([A-Za-z0-9_]+)__/g)) {
  if (!messages[match[1]]) {
    throw new Error(`Manifest references missing i18n key: ${match[1]}`);
  }
}

for (const page of ["options.html", "popup.html"]) {
  const html = await readFile(path.join(dist, page), "utf8");
  for (const match of html.matchAll(/data-i18n(?:-aria-label)?="([A-Za-z0-9_]+)"/g)) {
    if (!messages[match[1]]) {
      throw new Error(`${page} references missing i18n key: ${match[1]}`);
    }
  }
}

if (manifest.host_permissions || manifest.content_scripts) {
  throw new Error("MVP package unexpectedly requests page access");
}

const packagedFiles = await listFiles(dist);
const forbidden = packagedFiles.filter(
  (file) => file.endsWith(".ts") || file.includes(".test."),
);
if (forbidden.length) {
  throw new Error(`Development files leaked into package: ${forbidden.join(", ")}`);
}

process.stdout.write(
  `Validated ${packagedFiles.length} packaged files with narrow permissions.\n`,
);
