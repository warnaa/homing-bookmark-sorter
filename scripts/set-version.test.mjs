import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setVersion } from "./set-version.mjs";

test("version updates all release declarations and rejects invalid Chrome versions before writing", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "homing-version-"));
  try {
    await mkdir(path.join(directory, "public"));
    for (const file of ["package.json", "package-lock.json", "public/manifest.json"]) {
      await writeFile(path.join(directory, file), JSON.stringify({ version: "1.0.0", packages: { "": { version: "1.0.0" } } }));
    }
    await setVersion("1.0.1", directory);
    for (const file of ["package.json", "package-lock.json", "public/manifest.json"]) {
      const data = JSON.parse(await readFile(path.join(directory, file), "utf8"));
      assert.equal(data.version, "1.0.1");
      if (file === "package-lock.json") assert.equal(data.packages[""].version, "1.0.1");
    }
    for (const version of ["1.0.1-beta", "65536.0.0", "01.0.0", "0.0.0"]) {
      await assert.rejects(setVersion(version, directory), /Chrome-compatible/);
      assert.equal(JSON.parse(await readFile(path.join(directory, "public/manifest.json"), "utf8")).version, "1.0.1");
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
