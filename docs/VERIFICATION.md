# MVP verification record

Date: 2026-09-24

## Automated project gate

Command:

```powershell
npm run check
```

Result: passed.

- TypeScript strict type checking passed.
- ESLint passed.
- Three test files passed with 20 tests.
- The production extension built successfully.
- Package validation found 21 expected files, no TypeScript or test leakage, and
  no host permissions or content scripts.
- npm reported no known dependency vulnerabilities at installation time.

Environment:

- Node.js 24.16.0.
- npm 11.14.1.

The project declares Node.js 22 as its minimum supported development runtime;
the verification environment used the newer version above.

## Browser smoke tests

Command:

```powershell
npm run test:browser
```

The same built `dist/` extension passed in:

- Google Chrome 153.0.8010.53.
- Microsoft Edge 153.0.4234.48.

Each run used an isolated temporary browser profile and verified:

1. Manifest V3 installation and service-worker startup.
2. Settings and activity pages render without page or console errors.
3. A bookmark deliberately placed outside Inbox remains untouched.
4. A matching direct Inbox bookmark moves to an arbitrary configured
   destination.
5. An unmatched direct Inbox bookmark moves to Needs review.
6. Both outcomes appear in recent activity.
7. Undo returns a confidently moved bookmark to Inbox without causing immediate
   reclassification.
8. Forced service-worker termination followed by restart reconciles a persisted
   post-move attempt without moving the bookmark again.
9. A folder created while settings are open appears automatically without
   discarding an unsaved rule edit or the current folder selections.

Screenshots from the latest smoke run were inspected for layout and readability.
They are generated under `test-results/browser-smoke/` and intentionally remain
outside version control.

## Bounded verification

- Brave was not installed in the verification environment. It uses the same
  Chromium extension package and has manual loading instructions, but it was
  not claimed as directly exercised.
- Firefox support is a post-MVP candidate and was not tested.
- Chrome Web Store packaging and publication were not requested or tested.
- Import suppression is covered by coordinator integration tests; a real
  browser bookmark-import UI flow was not automated.

## Feedback and release preparation on 2026-10-12

- `npm ci` installed dependencies and reported zero known vulnerabilities.
- `npm run check` passed: strict types, ESLint, 38 tests in nine files, build,
  and validation of 25 packaged files with English/Polish locales.
- `npm run test:browser` passed in Google Chrome 155.0.8059.39 using isolated
  temporary profiles. Added assertions cover feedback text in both locales
  and the fixed recipient/subject in both pages. No email was sent.
- The first browser launch was blocked by Windows `spawn EPERM`; the same
  command passed on a permitted sandbox retry.
- `npm run package` built and inspected `build/homing-1.0.0.zip` with the
  manifest at the root and aligned package/manifest versions.
- The API tests use synthetic credentials and simulated HTTP responses;
  they verify missing credentials, draft-only upload, asynchronous success,
  failed/unknown uploads, polling timeout, review submission, and redacted
  HTTP errors. No live Google API requests were made.
- A 1280×800 settings screenshot with synthetic bookmarks was generated and
  inspected. Edge was not rerun for this follow-up.
- The 440×280 promotional tile was generated with
  `powershell -NoProfile -File scripts/generate-store-art.ps1` and inspected.
- Hosted GitHub Actions, developer registration, public privacy-policy hosting,
  store submission/review, and store installation/upgrades remain unverified.
