# Build and test Nestmark locally

Nestmark loads as an unpacked Manifest V3 extension in current Chromium-based
browsers. It has been exercised automatically in Google Chrome and Microsoft
Edge.

## Prerequisites

- Node.js 22 or newer.
- npm.
- A current Chrome, Edge, or Brave installation.

## Build the extension

From the repository root:

```powershell
npm install
npm run check
```

The final unpacked extension is written to `dist/`. The check command runs:

- TypeScript type checking.
- ESLint.
- Unit and coordinator integration tests.
- The production build.
- Package and permission validation.

## Load it in a Chromium browser

1. Open the extensions page:

   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`

2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Select this repository's `dist` folder, not the repository root or `src`.
5. Pin Nestmark to the toolbar if you want quick access to activity and Undo.

After rebuilding, return to the extensions page and select the Reload button on
the Nestmark card.

## Configure a test setup

Create at least four ordinary bookmark folders using the browser's bookmark
manager:

```text
Nestmark test
├── Inbox
├── Needs review
├── Development
└── Personal
```

The names and hierarchy are only examples. Destination and Needs review folders
can be anywhere writable outside the Inbox.

Open Nestmark's popup and select **Open settings**, then:

1. Choose `Inbox` as the Inbox folder.
2. Choose `Needs review` as the Needs review folder.
3. Add an **Exact domain** rule for `developer.chrome.com` and choose
   `Development` as its destination.
4. Leave confidence at `100` and the global minimum at `80`.
5. Save settings.

The optional checkbox processes bookmarks that were already direct children of
the Inbox. Leave it clear when you want to test only new arrivals.

## Run the manual acceptance checks

### Intentional placement remains untouched

Bookmark any page directly into `Personal`. Wait a moment and confirm it stays
there. Nestmark must not organize anything outside the configured Inbox.

### A matching bookmark reaches its destination

Open a page on `developer.chrome.com`, bookmark it directly into `Inbox`, and
confirm it moves to `Development`.

Open the Nestmark popup. Recent activity should identify the destination, rule
confidence, and time.

### An unmatched bookmark needs review

Bookmark a page from another domain directly into `Inbox`. Confirm it moves to
`Needs review` and appears in recent activity with “No rule matched.”

### Returning an item retries classification

Move a bookmark from `Needs review` back to `Inbox`. Nestmark should make a new
classification attempt. It will return to Needs review until a matching rule is
added.

### Undo is safe

Within 10 minutes of a confident automatic move, select **Undo** in the popup.
The bookmark should return to Inbox and remain there; the Undo operation itself
must not trigger immediate reclassification.

Move an automatically sorted bookmark manually before trying Undo. Nestmark
must refuse the stale Undo rather than override the newer placement.

### Folder problems are visible

Delete a configured test destination. Nestmark should show a toolbar badge and
an actionable problem in the popup. Affected Inbox bookmarks go to Needs review
instead of a similarly named guessed folder.

## Rule behavior

Rules use explicit top-to-bottom priority. The first matching rule owns the
decision.

- **Exact domain:** matches one hostname, such as `example.com`.
- **Domain and subdomains:** matches `example.com` and hosts such as
  `docs.example.com`, but not `notexample.com`.
- **URL wildcard:** matches the complete URL; `*` matches any sequence and `?`
  matches one character.
- **Title contains:** case-insensitive text contained in the bookmark title.

If the first matching rule's confidence is below the global minimum, the
bookmark goes to Needs review. Lower-priority rules are not considered.

## Run the automated Chromium smoke test

The smoke test launches the built extension in an isolated temporary browser
profile, so it does not touch bookmarks in your normal profile. It verifies the
settings UI, activity UI, watch boundary, matching destination, Needs review,
and Undo.

Chrome is detected automatically on standard Windows installation paths:

```powershell
npm run test:browser
```

To test a specific Chromium executable:

```powershell
$env:CHROME_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm run test:browser
```

The test stores screenshots under `test-results/browser-smoke/`; that directory
is intentionally excluded from Git.

## Troubleshooting

- If **Load unpacked** rejects the folder, run `npm run build` and select
  `dist/` again.
- If a change does not appear, rebuild and use Reload on the browser's extension
  card.
- If sorting stops after folders were deleted or reorganized, open settings and
  select valid folders again.
- Use the **service worker** link on the extension card to inspect runtime errors
  during development.
- Run `npm run check` before treating a browser symptom as a packaging failure.
