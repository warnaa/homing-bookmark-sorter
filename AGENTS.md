# Repository guidance for agents

## Mission

Build Nestmark as a narrow, trustworthy bookmark-inbox sorter. The extension
must automate only the configured Inbox and must preserve deliberate user
placement everywhere else.

## Sources of truth

Read these before changing behavior:

1. `REQUIREMENTS.md` for normative product behavior.
2. `docs/DECISIONS.md` for accepted tradeoffs and changes.
3. `PLAN.md` for sequencing and phase-specific verification.
4. `docs/ARCHITECTURE.md` for component boundaries and event flows.

If implementation and requirements disagree, stop and make the discrepancy
explicit. Do not silently redefine the requirement in code.

## Engineering constraints

- Preserve the one-folder watch boundary.
- Never reorganize bookmarks outside the Inbox unless executing a current,
  revalidated attempt for a bookmark that entered the Inbox.
- Treat a later manual move as authoritative.
- Never guess a replacement folder by name when a configured folder ID is
  missing.
- Keep classification logic pure and independent from browser APIs.
- Put browser-specific APIs behind an adapter.
- Persist workflow state; do not rely on service-worker globals surviving.
- Do not request full-page or broad host access for MVP URL/title rules.
- Do not add remote classification, analytics, or telemetry without an accepted
  decision documenting consent, data flow, and failure behavior.
- Do not embed secrets in source, manifests, fixtures, or built artifacts.

## Internationalization

- Add every user-facing string to `_locales/en/messages.json` when the extension
  shell exists.
- Use stable semantic message keys.
- Do not translate or normalize user-created bookmark titles or folder names.
- Test fallback behavior for missing message keys.

## Change discipline

- Keep changes scoped to the current phase or explicitly requested behavior.
- Preserve unrelated user changes.
- Add or update tests with behavior changes.
- Update requirements only for genuine product decisions, and add a decision-log
  entry when changing an accepted contract.
- Do not claim browser or end-to-end verification unless it actually ran.
- Use sentence-like Markdown headings and concise commit messages.
- Do not commit generated packages, browser profiles, coverage output, secrets,
  or local environment files.

## Expected verification

Run the narrowest relevant checks first, followed by the repository-wide check
command once tooling exists. For browser-facing changes, verify both the pure
logic and the relevant mocked or real browser event sequence. Report commands
run, failures, and anything not verified.

## Completion criteria

A change is complete only when:

- Its acceptance behavior is unambiguous.
- Failure and race behavior are covered.
- User-facing text is localizable.
- Relevant automated checks pass.
- Documentation remains consistent with the implementation.
