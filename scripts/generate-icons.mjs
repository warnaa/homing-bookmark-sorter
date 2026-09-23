import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "public", "icons");

async function firstExisting(paths) {
  for (const candidate of paths) {
    if (!candidate) continue;
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known browser path.
    }
  }
  return undefined;
}

const executablePath = await firstExisting([
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
]);
if (!executablePath) throw new Error("Set CHROME_PATH to a Chromium executable.");

const svg = await readFile(path.join(root, "assets", "nestmark-icon.svg"), "utf8");
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true });

try {
  const page = await browser.newPage();
  for (const size of [16, 32, 48, 128]) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(
      `<style>html,body{margin:0;width:${size}px;height:${size}px}svg{display:block;width:100%;height:100%}</style>${svg}`,
    );
    await page.screenshot({
      path: path.join(output, `icon-${size}.png`),
      omitBackground: true,
    });
  }
} finally {
  await browser.close();
}

process.stdout.write("Generated Nestmark icons at 16, 32, 48, and 128 pixels.\n");
