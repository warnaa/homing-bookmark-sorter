/* global fetch, setTimeout, AbortSignal, URLSearchParams */
import { readFile } from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";

// Inject transport and waiting so failure paths can be tested without store access.
export async function uploadToStore({ env, zip, publish = false, fetcher = fetch, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  for (const key of ["CWS_PUBLISHER_ID", "CWS_EXTENSION_ID", "CWS_CLIENT_ID", "CWS_CLIENT_SECRET", "CWS_REFRESH_TOKEN"]) {
    if (!env[key]) throw new Error(`Missing ${key}`);
  }
  if (!/^[a-p]{32}$/.test(env.CWS_EXTENSION_ID) || !/^[A-Za-z0-9_-]+$/.test(env.CWS_PUBLISHER_ID)) {
    throw new Error("Invalid Chrome Web Store item identifiers");
  }
  async function request(url, options, label) {
    const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(120_000) });
    // Never print response bodies: authentication failures can contain credentials.
    if (!response.ok) throw new Error(`${label} failed (HTTP ${response.status}); inspect the developer dashboard.`);
    return response.json();
  }
  const token = await request("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: env.CWS_CLIENT_ID, client_secret: env.CWS_CLIENT_SECRET, refresh_token: env.CWS_REFRESH_TOKEN }),
  }, "Authentication");
  if (!token.access_token) throw new Error("Authentication returned no access token");
  const headers = { Authorization: `Bearer ${token.access_token}` };
  const item = `publishers/${env.CWS_PUBLISHER_ID}/items/${env.CWS_EXTENSION_ID}`;
  const base = `https://chromewebstore.googleapis.com/v2/${item}`;
  const result = await request(`https://chromewebstore.googleapis.com/upload/v2/${item}:upload`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/zip" }, body: zip,
  }, "Upload");
  let state = result.uploadState;
  const inProgress = (value) => ["IN_PROGRESS", "UPLOAD_IN_PROGRESS"].includes(value);
  for (let attempt = 0; inProgress(state) && attempt < 30; attempt++) {
    await wait(10_000);
    const status = await request(`${base}:fetchStatus`, { headers }, "Upload status");
    state = status.lastAsyncUploadState;
  }
  if (state !== "SUCCEEDED") throw new Error("Upload did not succeed; nothing was submitted for review. Inspect the dashboard before retrying.");
  if (publish) {
    await request(`${base}:publish`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ publishType: "DEFAULT_PUBLISH", blockOnWarnings: true }),
    }, "Submission");
  }
  return publish ? "Submitted for review; publication awaits Google approval." : "Uploaded as a draft; not submitted for review.";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, mode] = process.argv.slice(2);
  if (!file || !["upload", "publish"].includes(mode)) throw new Error("Usage: node scripts/chrome-store.mjs ZIP upload|publish");
  process.stdout.write(await uploadToStore({ env: process.env, zip: await readFile(file), publish: mode === "publish" }) + "\n");
}
