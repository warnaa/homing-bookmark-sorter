import { test } from "vitest";
import assert from "node:assert/strict";
import { uploadToStore } from "./chrome-store.mjs";

const env = {
  CWS_PUBLISHER_ID: "publisher", CWS_EXTENSION_ID: "a".repeat(32),
  CWS_CLIENT_ID: "synthetic-client", CWS_CLIENT_SECRET: "synthetic-secret", CWS_REFRESH_TOKEN: "synthetic-refresh",
};
const token = { access_token: "synthetic-token" };
function transport(responses) {
  const calls = [];
  return { calls, fetcher: async (url, options) => {
    calls.push({ url, options });
    const response = responses.shift();
    assert(response, "Unexpected API request");
    return { ok: true, json: async () => response };
  } };
}

test("missing credentials fail before contacting Google", async () => {
  const mock = transport([]);
  await assert.rejects(uploadToStore({ env: {}, zip: "zip", ...mock }), /Missing CWS_PUBLISHER_ID/);
  assert.equal(mock.calls.length, 0);
});

test("upload-only leaves a draft and waits for asynchronous processing", async () => {
  const mock = transport([token, { uploadState: "IN_PROGRESS" }, { lastAsyncUploadState: "SUCCEEDED" }]);
  await uploadToStore({ env, zip: "zip", ...mock, wait: async () => {} });
  assert.equal(mock.calls.length, 3);
  assert(mock.calls[1].url.includes("/upload/v2/"));
});

test("submits only after success and blocks validation warnings", async () => {
  const mock = transport([token, { uploadState: "SUCCEEDED" }, { state: "PENDING_REVIEW" }]);
  await uploadToStore({ env, zip: "zip", publish: true, ...mock });
  assert(mock.calls[2].url.endsWith(":publish"));
  assert.deepEqual(JSON.parse(mock.calls[2].options.body), { publishType: "DEFAULT_PUBLISH", blockOnWarnings: true });
});

test("failed or unknown uploads never submit for review", async () => {
  for (const uploadState of ["FAILED", undefined]) {
    const mock = transport([token, { uploadState }]);
    await assert.rejects(uploadToStore({ env, zip: "zip", publish: true, ...mock }), /Upload did not succeed/);
    assert.equal(mock.calls.length, 2);
  }
});

test("stuck asynchronous uploads time out without publishing", async () => {
  const mock = transport([token, { uploadState: "UPLOAD_IN_PROGRESS" }, ...Array(30).fill({ lastAsyncUploadState: "UPLOAD_IN_PROGRESS" })]);
  await assert.rejects(uploadToStore({ env, zip: "zip", publish: true, ...mock, wait: async () => {} }), /Upload did not succeed/);
  assert.equal(mock.calls.length, 32);
});

test("HTTP failures do not expose response bodies or tokens", async () => {
  await assert.rejects(uploadToStore({ env, zip: "zip", fetcher: async () => ({ ok: false, status: 401, json: () => { throw new Error("synthetic-secret"); } }) }), /Authentication failed \(HTTP 401\)/);
});
