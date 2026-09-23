# Nestmark

**A quiet inbox for bookmarks that puts every saved page in the right nest.**

Nestmark is a planned browser extension that watches one user-selected bookmark
folder, classifies bookmarks arriving there, and moves them to user-selected
destination folders. Bookmarks saved anywhere else are treated as intentional
and are never reorganized.

When Nestmark cannot choose a destination confidently, it moves the bookmark to
a separately configured **Needs review** folder. Both classification
destinations and the review folder may live anywhere writable in the browser's
bookmark tree.

## Project status

The repository is currently in the requirements and architecture phase. There
is no extension implementation yet.

The initial target is a Manifest V3 extension for Chromium browsers (Chrome and
Edge). The design should avoid unnecessary Chromium-specific assumptions so a
Firefox port remains practical.

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
- [Architecture](docs/ARCHITECTURE.md) — proposed components, state, and event
  flows.
- [Decision log](docs/DECISIONS.md) — durable product and engineering decisions.
- [Agent guidance](AGENTS.md) — repository rules for coding agents and
  contributors.

When documents disagree, `REQUIREMENTS.md` is the product source of truth and
newer accepted entries in `docs/DECISIONS.md` explain intentional changes.

## Working name

**Nestmark** is a working product name, not a claim of trademark or store-name
availability. Name availability must be checked before publication.

## Development

Tooling and source layout will be introduced in Phase 1 of `PLAN.md`. Until
then, changes should improve the requirements, decisions, or implementation
plan without pretending that runtime behavior has been verified.

## License

No license has been selected yet. All rights remain with the repository owner
until a license file is added.
