import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function setVersion(version, directory = ".") {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? "") ||
    version.split(".").some((part) => Number(part) > 65535 || String(Number(part)) !== part) ||
    version === "0.0.0") {
    throw new Error("Use a Chrome-compatible version such as 1.0.1 (components 0–65535).");
  }
  const files = ["package.json", "package-lock.json", "public/manifest.json"];
  const documents = await Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(directory, file), "utf8"))));
  for (const [index, document] of documents.entries()) {
    document.version = version;
    if (files[index] === "package-lock.json") document.packages[""].version = version;
    await writeFile(path.join(directory, files[index]), JSON.stringify(document, null, 2) + "\n");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await setVersion(process.argv[2]);
}
