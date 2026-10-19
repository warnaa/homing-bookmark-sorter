# Build and test Homing locally

Homing loads as an unpacked Manifest V3 extension in current Chromium-based
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
5. Pin Homing to the toolbar if you want quick access to activity and Undo.

After rebuilding, return to the extensions page and select the Reload button on
the Homing card.

## Configure a test setup

Create at least three ordinary bookmark folders using the browser's bookmark
manager:

```text
Homing test
├── Inbox
├── Development
└── Personal
```

The names and hierarchy are only examples. Destination folders can be anywhere
writable outside the Inbox.

Open Homing's popup and select the settings (⚙) button, then:

1. Choose `Inbox` as the Inbox folder.
2. In the new-rule row, type `developer.chrome.com` (the match type switches
   to **Domain and subdomains**), choose `Development`, and press Enter.
3. Leave the rule confidence at `100` and the global minimum at `80`.
4. Save settings with **Save settings** or Ctrl+S.

The new-rule row keeps the chosen destination after each rule, so several rules
for one folder need only a value and Enter. Pasting a full URL keeps only its
domain.

Reorder rules by dragging the ⠿ handle. Pressing Escape during a drag restores
the previous order. With the handle focused, the up and down arrow keys move the
rule one position.

If you create, rename, move, or remove bookmark folders while settings remain
open, the folder choices update automatically without discarding unsaved rule
or form changes. **Refresh folders** is available as a manual fallback.

The optional checkbox processes bookmarks that were already direct children of
the Inbox. Leave it clear when you want to test only new arrivals. Check it
after adding rules to sort bookmarks that were left in the Inbox.

## Run the manual acceptance checks

### Intentional placement remains untouched

Bookmark any page directly into `Personal`. Wait a moment and confirm it stays
there. Homing must not organize anything outside the configured Inbox.

### A matching bookmark reaches its destination

Open a page on `developer.chrome.com`, bookmark it directly into `Inbox`, and
confirm it moves to `Development`.

Open the Homing popup. Recent activity should identify the destination, rule
confidence, and time.

### The Inbox stays the default save folder

Right after that move, bookmark another page with the star button. The dialog
should propose `Inbox`, not `Development`.

### An unmatched bookmark stays in the Inbox

Bookmark a page from another domain directly into `Inbox`. Confirm it stays in
`Inbox` and appears in recent activity with “No rule matched.”

In the popup, select **Create rule** on that activity entry. Settings open with
the bookmark's domain in the new-rule row, the destination selector focused,
and the option to sort bookmarks already in the Inbox checked. Add the rule and
save: the bookmark moves to the new destination.

### Returning an item retries classification

Move an unsorted bookmark out of `Inbox` and back. Homing should make a new
classification attempt. Reordering it within `Inbox` does not.

### Undo is safe

Within 10 minutes of a confident automatic move, select **Undo** in the popup.
The bookmark should return to Inbox and remain there; the Undo operation itself
must not trigger immediate reclassification.

Move an automatically sorted bookmark manually before trying Undo. Homing
must refuse the stale Undo rather than override the newer placement.

### Folder problems are visible

Delete a configured test destination. Homing should show a toolbar badge and
an actionable problem in the popup. Affected Inbox bookmarks stay in the Inbox
instead of going to a similarly named guessed folder.

## Check the translation

The UI follows the browser's display language: Polish for a Polish browser,
English for every other language. To check Polish in an English browser, start
it with `--lang=pl` from a separate profile, for example:

```powershell
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' --lang=pl --user-data-dir="$env:TEMP\homing-pl"
```

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
bookmark stays in the Inbox. Lower-priority rules are not considered.

## Run the automated Chromium smoke test

The smoke test launches the built extension in an isolated temporary browser
profile, so it does not touch bookmarks in your normal profile. It verifies the
settings UI, activity UI, watch boundary, matching destination, unsorted
bookmarks staying in the Inbox, the Inbox remaining the default save folder,
and Undo. It also starts a Polish browser to confirm the UI follows the browser
language; the main run forces English with `--lang=en-US`.

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
