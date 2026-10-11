<img src="public/icons/homing.svg" alt="" width="96" height="96">

# Homing

**Bookmarks that find their own way home.**

Homing is a planned browser extension that watches one user-selected bookmark
folder, classifies bookmarks arriving there, and moves them to user-selected
destination folders. Bookmarks saved anywhere else are treated as intentional
and are never reorganized.

When Homing cannot choose a destination confidently, it moves the bookmark to
a separately configured **Needs review** folder. Both classification
destinations and the review folder may live anywhere writable in the browser's
bookmark tree.

## Project status

The local-install MVP is implemented as a Manifest V3 extension and verified in
Google Chrome and Microsoft Edge. It uses deterministic URL/title rules and
does not request access to page content.

Current capabilities:

- Watch exactly one selected Inbox folder.
- Route matching bookmarks to any writable bookmark folder.
- Send uncertain or failed attempts to a selected Needs review folder.
- Match exact domains, domains with subdomains, wildcard URLs, and title text.
- Preserve deliberate placement outside the Inbox and later manual moves.
- Recover unfinished work after service-worker suspension.
- Explain recent decisions and offer a safe 10-minute Undo.
- Keep all extension data local.
- Show the UI in English or Polish, following the browser language.

## Product principles

- Only the configured Inbox is automated.
- A user's explicit folder choice is respected.
- Uncertainty is visible, recoverable, and routed to Needs review.
- Rules are deterministic and explainable before optional AI is introduced.
- Page access and external processing are opt-in.
- User-facing text is localization-ready from the first implementation.

## Project documents

- [Requirements](REQUIREMENTS.md) — normative product behavior and acceptance
  criteria.
- [Implementation plan](PLAN.md) — phased delivery and verification strategy.
- [Architecture](docs/ARCHITECTURE.md) — implemented components, state, and event
  flows.
- [Decision log](docs/DECISIONS.md) — durable product and engineering decisions.
- [Local testing](docs/LOCAL_TESTING.md) — build, install, and manual test steps.
- [Privacy and permissions](docs/PRIVACY.md) — data handling and permission
  rationale.
- [Verification record](docs/VERIFICATION.md) — checks and browser versions
  exercised for the current MVP.
- [Agent guidance](AGENTS.md) — repository rules for coding agents and
  contributors.

When documents disagree, `REQUIREMENTS.md` is the product source of truth and
newer accepted entries in `docs/DECISIONS.md` explain intentional changes.

## Name

The extension is meant for the Chrome Web Store only, as "Homing - bookmark
sorter" ("Homing - sortowanie zakładek" in Polish). A name check on 2026-10-11
found no conflicting extension and no EU-wide "Homing" trademark for software;
the closest mark is a French registration for hotel software. See
[D-015](docs/DECISIONS.md) for details. This is not legal advice.

## Development

Requirements: Node.js 22 or newer and npm.

```powershell
npm install
npm run check
```

`npm run check` type-checks, lints, runs the unit/integration suite, builds
`dist/`, and validates the packaged files and permissions. To exercise the
built extension in an isolated temporary Chrome profile:

```powershell
npm run test:browser
```

See [Local testing](docs/LOCAL_TESTING.md) for installation in Chrome, Edge, or
Brave and a complete manual acceptance walkthrough.

## License

No license has been selected yet. All rights remain with the repository owner
until a license file is added.
