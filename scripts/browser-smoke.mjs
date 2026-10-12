/* global chrome, DataTransfer, document, DragEvent, Event, location, PointerEvent, setTimeout, URL */
import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionPath = path.join(root, "dist");
const artifactsPath = path.join(root, "test-results", "browser-smoke");

async function firstExisting(paths) {
  for (const candidate of paths) {
    if (!candidate) continue;
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known installation path.
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

if (!executablePath) {
  throw new Error("Set CHROME_PATH to a Chromium browser executable.");
}

await mkdir(artifactsPath, { recursive: true });

function launchBrowser(language) {
  return puppeteer.launch({
    executablePath,
    headless: true,
    pipe: true,
    enableExtensions: [extensionPath],
    args: ["--no-first-run", "--no-default-browser-check", `--lang=${language}`],
    env: { ...process.env, LANGUAGE: language },
  });
}

async function extensionIdFor(browser) {
  const workerTarget = await browser.waitForTarget(
    (target) =>
      target.type() === "service_worker" &&
      target.url().endsWith("background/service-worker.js"),
    { timeout: 15_000 },
  );
  return new URL(workerTarget.url()).host;
}

// The extension follows the browser UI language; Polish must be picked up.
const polishBrowser = await launchBrowser("pl");
try {
  const polishId = await extensionIdFor(polishBrowser);
  const polishPage = await polishBrowser.newPage();
  await polishPage.goto(`chrome-extension://${polishId}/options.html`);
  await polishPage.waitForSelector("#add-rule");
  assert.equal(await polishPage.$eval(".feedback-footer a", (element) => element.textContent), "Prześlij opinię");
  assert.equal(await polishPage.$eval(".feedback-footer a", (element) => element.getAttribute("href")), "mailto:damian@warna.pl?subject=Homing");
  assert.equal(await polishPage.$eval("html", (element) => element.lang), "pl");
  assert.equal(await polishPage.$eval("h1", (element) => element.textContent), "Ustawienia Homing");
  assert.equal(await polishPage.$eval("#add-rule", (element) => element.textContent), "Dodaj regułę");
  await polishPage.setViewport({ width: 1280, height: 720 });
  await polishPage.screenshot({ path: path.join(artifactsPath, "options-pl.png") });
  await polishPage.goto(`chrome-extension://${polishId}/popup.html`);
  assert.equal(await polishPage.$eval(".feedback-footer a", (element) => element.textContent), "Prześlij opinię");
  assert.equal(
    await polishPage.$eval("#activity-heading", (element) => element.textContent),
    "Ostatnia aktywność",
  );
} finally {
  await polishBrowser.close();
}

const browser = await launchBrowser("en-US");

try {
  const workerTarget = await browser.waitForTarget(
    (target) =>
      target.type() === "service_worker" &&
      target.url().endsWith("background/service-worker.js"),
    { timeout: 15_000 },
  );
  const worker = await workerTarget.worker();
  assert(worker, "The extension service worker did not start.");
  const extensionId = new URL(workerTarget.url()).host;

  const ids = await worker.evaluate(async () => {
    await chrome.storage.local.clear();
    const tree = await chrome.bookmarks.getTree();
    const writableRoot = tree[0]?.children?.find((node) => !node.unmodifiable);
    if (!writableRoot) throw new Error("No writable bookmark root found.");

    const qaRoot = await chrome.bookmarks.create({
      parentId: writableRoot.id,
      title: "Homing browser smoke test",
    });
    const inbox = await chrome.bookmarks.create({ parentId: qaRoot.id, title: "Inbox" });
    const review = await chrome.bookmarks.create({ parentId: qaRoot.id, title: "Needs review" });
    const development = await chrome.bookmarks.create({ parentId: qaRoot.id, title: "Development" });
    const manual = await chrome.bookmarks.create({ parentId: qaRoot.id, title: "Manual" });

    await chrome.storage.local.set({
      settings: {
        schemaVersion: 1,
        inboxFolderId: inbox.id,
        reviewFolderId: review.id,
        confidenceThreshold: 80,
        rules: [
          {
            id: "browser-smoke-rule",
            enabled: true,
            matchType: "domain_suffix",
            pattern: "example.com",
            destinationFolderId: development.id,
            confidence: 95,
          },
        ],
      },
    });

    return {
      qaRoot: qaRoot.id,
      inbox: inbox.id,
      review: review.id,
      development: development.id,
      manual: manual.id,
    };
  });

  async function createBookmark(parentId, title, url) {
    return worker.evaluate(
      async ({ parentId: target, title: name, url: href }) =>
        chrome.bookmarks.create({ parentId: target, title: name, url: href }),
      { parentId, title, url },
    );
  }

  async function waitForParent(bookmarkId, expectedParentId) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const parentId = await worker.evaluate(async (id) => {
        const nodes = await chrome.bookmarks.get(id);
        return nodes[0]?.parentId;
      }, bookmarkId);
      if (parentId === expectedParentId) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(
      `Bookmark ${bookmarkId} did not reach folder ${expectedParentId}.`,
    );
  }

  const deliberate = await createBookmark(
    ids.manual,
    "Deliberate placement",
    "https://example.com/manual",
  );
  await new Promise((resolve) => setTimeout(resolve, 250));
  await waitForParent(deliberate.id, ids.manual);

  const matched = await createBookmark(
    ids.inbox,
    "Matched bookmark",
    "https://docs.example.com/guide",
  );
  await waitForParent(matched.id, ids.development);

  const unmatched = await createBookmark(
    ids.inbox,
    "Unmatched bookmark",
    "https://unmatched.invalid/article",
  );
  await waitForParent(unmatched.id, ids.review);

  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (entry) => {
    if (entry.type() === "error") pageErrors.push(entry.text());
  });

  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.waitForSelector("#add-rule");
  assert.equal(await page.$eval(".feedback-footer a", (element) => element.textContent), "Send feedback");
  await page.waitForSelector(".rule-row");
  assert.equal(await page.$eval("#inbox-folder", (element) => element.value), ids.inbox);
  assert.equal(await page.$eval("#review-folder", (element) => element.value), ids.review);
  assert.equal(await page.$$eval(".rule-row", (rows) => rows.length), 1);
  await page.setViewport({ width: 1280, height: 800 });
  await page.screenshot({ path: path.join(artifactsPath, "store-settings-en.png") });

  await page.$eval(".rule-row input[type='text']", (input) => {
    input.value = "unsaved.example";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const newFolder = await page.evaluate(async (qaRootId) =>
    chrome.bookmarks.create({ parentId: qaRootId, title: "New unsaved destination" }),
  ids.qaRoot);
  await page.waitForFunction(
    (folderId) =>
      [...document.querySelectorAll("#review-folder option")].some(
        (option) => option.value === folderId,
      ),
    {},
    newFolder.id,
  );
  assert.equal(
    await page.$eval(".rule-row input[type='text']", (input) => input.value),
    "unsaved.example",
  );
  assert.equal(await page.$eval("#inbox-folder", (element) => element.value), ids.inbox);
  assert.equal(await page.$eval("#review-folder", (element) => element.value), ids.review);

  // Quick add: type a value, keep the inferred match type, pick a folder, Enter.
  await page.type("#new-rule-pattern", "news.example");
  assert.equal(await page.$eval("#new-rule-type", (element) => element.value), "domain_suffix");
  await page.select("#new-rule-destination", ids.development);
  await page.focus("#new-rule-pattern");
  await page.keyboard.press("Enter");
  assert.equal(await page.$$eval(".rule-row", (rows) => rows.length), 2);
  assert.equal(await page.$eval("#new-rule-pattern", (input) => input.value), "");
  assert.equal(
    await page.$eval("#new-rule-destination", (element) => element.value),
    ids.development,
  );
  assert.equal(await page.$eval("#unsaved-indicator", (element) => element.hidden), false);

  // A second rule for the same folder needs only a value and Enter.
  await page.type("#new-rule-pattern", "https://example.com/docs/*");
  assert.equal(await page.$eval("#new-rule-type", (element) => element.value), "url_pattern");
  await page.keyboard.press("Enter");
  assert.equal(await page.$$eval(".rule-row", (rows) => rows.length), 3);
  const rulePatterns = () =>
    page.$$eval(".rule-row .rule-pattern", (inputs) => inputs.map((input) => input.value));
  assert.deepEqual(await rulePatterns(), [
    "unsaved.example",
    "news.example",
    "https://example.com/docs/*",
  ]);

  // Keyboard reordering from the drag handle keeps focus on the moved rule.
  await page.focus(".rule-row:nth-child(3) .rule-handle");
  await page.keyboard.press("ArrowUp");
  assert.deepEqual(await rulePatterns(), [
    "unsaved.example",
    "https://example.com/docs/*",
    "news.example",
  ]);
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.closest(".rule-row")?.querySelector(".rule-pattern")?.value,
    ),
    "https://example.com/docs/*",
  );

  // Dragging the first rule's handle below the last row moves it to the end.
  await page.setViewport({ width: 1280, height: 900 });
  // A real mouse drag starts from the handle; Escape cancels it unchanged.
  const handleBox = await (await page.$(".rule-row:nth-child(1) .rule-handle")).boundingBox();
  const start = { x: handleBox.x + handleBox.width / 2, y: handleBox.y + handleBox.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y + 40, { steps: 4 });
  await page.waitForSelector(".rule-row--dragging", { timeout: 5_000 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector(".rule-row--dragging"), {
    timeout: 5_000,
  });
  assert.deepEqual(await rulePatterns(), [
    "unsaved.example",
    "https://example.com/docs/*",
    "news.example",
  ]);

  // Headless Chromium does not deliver native drops reliably, so replay the
  // drag events the browser sends when the first rule is dropped at the end.
  await page.evaluate(() => {
    const rows = () => document.querySelectorAll(".rule-row");
    const source = rows()[0];
    const target = rows()[2];
    const transfer = new DataTransfer();
    const fire = (element, type, clientY) =>
      element.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, clientY, dataTransfer: transfer }),
      );
    source.querySelector(".rule-handle").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    fire(source, "dragstart", 0);
    const box = target.getBoundingClientRect();
    fire(target, "dragover", box.bottom - 2);
    fire(target, "drop", box.bottom - 2);
    fire(source, "dragend", box.bottom - 2);
  });
  assert.deepEqual(await rulePatterns(), [
    "https://example.com/docs/*",
    "news.example",
    "unsaved.example",
  ]);

  await page.screenshot({
    path: path.join(artifactsPath, "options.png"),
    fullPage: true,
  });

  // Leaving with unsaved rules asks for confirmation; accept it here.
  page.once("dialog", (dialog) => dialog.accept());
  // Rule suggestions from the popup open settings with the composer prefilled.
  await page.goto(
    `chrome-extension://${extensionId}/options.html?pattern=${encodeURIComponent("https://www.suggested.example/a")}`,
  );
  await page.waitForFunction(
    () => document.querySelector("#new-rule-pattern")?.value === "suggested.example",
  );
  assert.equal(await page.$eval("#new-rule-type", (element) => element.value), "domain_suffix");
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    "new-rule-destination",
  );
  assert.equal(await page.evaluate(() => location.search), "");

  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  assert.equal(await page.$eval(".feedback-footer a", (element) => element.getAttribute("href")), "mailto:damian@warna.pl?subject=Homing");
  await page.waitForSelector(".activity-item");
  assert.equal(await page.$$eval(".activity-item", (rows) => rows.length), 2);
  assert.equal(
    await page.$$eval(".activity-item .text-button", (buttons) =>
      buttons.map((button) => button.textContent),
    ).then((labels) => labels.filter((label) => label === "Create rule").length),
    1,
  );
  await page.screenshot({
    path: path.join(artifactsPath, "popup.png"),
    fullPage: true,
  });

  const movedActivityId = await page.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ type: "GET_POPUP_STATE" });
    return response.state.activity.find((entry) => entry.outcome === "moved")?.id;
  });
  assert(movedActivityId, "The successful move was not recorded.");
  const undoResponse = await page.evaluate(
    (activityId) => chrome.runtime.sendMessage({ type: "UNDO_MOVE", activityId }),
    movedActivityId,
  );
  assert.equal(undoResponse.ok, true);
  await waitForParent(matched.id, ids.inbox);
  await new Promise((resolve) => setTimeout(resolve, 250));
  await waitForParent(matched.id, ids.inbox);

  const recoveryBookmark = await worker.evaluate(async ({ inboxId, targetId }) => {
    const bookmark = await chrome.bookmarks.create({
      parentId: targetId,
      title: "Restart recovery bookmark",
      url: "https://recovery.example.com/article",
    });
    const stored = await chrome.storage.local.get("attempts");
    await chrome.storage.local.set({
      attempts: {
        ...(stored.attempts ?? {}),
        [bookmark.id]: {
          bookmarkId: bookmark.id,
          observedParentId: inboxId,
          observedUrl: bookmark.url,
          observedTitle: bookmark.title,
          observedAt: Date.now(),
          state: "moving",
          attemptVersion: 1,
          targetFolderId: targetId,
          plannedOutcome: "moved",
          reasonCode: "rule_match",
          ruleId: "browser-smoke-rule",
          confidence: 95,
        },
      },
    });
    return bookmark;
  }, { inboxId: ids.inbox, targetId: ids.development });

  await worker.close();
  let recovered = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await page.evaluate(async () => {
      try {
        return await chrome.runtime.sendMessage({ type: "GET_POPUP_STATE" });
      } catch {
        return undefined;
      }
    });
    recovered =
      response?.state?.activity?.some(
        (entry) =>
          entry.bookmarkId === recoveryBookmark.id && entry.outcome === "moved",
      ) === true;
    if (recovered) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(recovered, true, "The restarted worker did not reconcile persisted work.");

  assert.deepEqual(pageErrors, [], `Extension page errors: ${pageErrors.join(" | ")}`);

  await page.evaluate(async (qaRootId) => {
    await chrome.bookmarks.removeTree(qaRootId);
  }, ids.qaRoot);

  process.stdout.write(
    `Chromium smoke test passed in ${path.basename(executablePath)} (${extensionId}).\n`,
  );
} finally {
  await browser.close();
}
