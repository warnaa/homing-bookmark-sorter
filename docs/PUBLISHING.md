# Publishing Homing

Homing is not published yet. This guide covers the first listing and repeatable
updates. Account registration and live store submission have not been performed.

## Prepare the first package

Install Node.js 24 and Python 3 (the `python` command must be available), then:

```powershell
npm ci
npm run check
npm run package
```

Upload `build/homing-1.0.0.zip`, not the repository or a ZIP containing a `dist/`
parent folder. The package includes `manifest.json` at its root and only built
extension files. Generated ZIPs and screenshots remain ignored by Git.

## Create the first listing

1. [Register a Chrome Web Store developer account](https://developer.chrome.com/docs/webstore/register).
   Complete Google's registration/payment and account disclosures, and enable
   two-step verification. Use the Google account that will own Homing.
2. Open the [developer dashboard](https://chrome.google.com/webstore/devconsole),
   select **Add new item**, and upload the ZIP.
3. Fill Store listing using [the prepared English and Polish copy](STORE_LISTING.md).
   Select a suitable productivity category and set support contact to
   `damian@warna.pl` where the dashboard offers an email field. For a support URL,
   use a public HTTPS page such as this repository's README once it is public.
4. Supply the 128×128 icon (`public/icons/icon-128.png`), real screenshots, and
   the required promotional image. Follow the dashboard's current size rules;
   screenshots are normally 1280×800 or 640×400 and the small promotional tile
   is 440×280. Do not upload private bookmark data. The browser test uses only
   synthetic fixtures and writes screenshots to `test-results/browser-smoke/`.
   Run `npm run test:browser`; `store-settings-en.png` is a real 1280×800 store
   screenshot. Other diagnostic images are not all in store sizes. On Windows,
   run `powershell -NoProfile -File scripts/generate-store-art.ps1` to create
   `build/store-promo-440x280.png` from the existing Homing icon.
5. Host [the privacy policy](PRIVACY.md) at a publicly accessible HTTPS URL and
   enter that URL in the Privacy tab. If this repository is public, its rendered
   GitHub file URL can be used after the policy is pushed; verify it while signed
   out. A private repository URL will not work. A separate website is unnecessary.
6. Complete Privacy using the single-purpose statement and permission rationale
   in [the listing document](STORE_LISTING.md). Describe local bookmark handling
   accurately; don't confuse local access with transmission to the developer.
   Review every dashboard data-use certification yourself before accepting it.
7. In Distribution select free, public availability and your desired countries.
   In test instructions paste the synthetic setup steps from the listing document.
8. Save the assigned extension ID and publisher ID. Review the final listing and
   submit for review. Google controls review timing and approval. Enable dashboard
   publication notifications if desired.

See Google's [first-publication guide](https://developer.chrome.com/docs/webstore/publish),
[listing guide](https://developer.chrome.com/docs/webstore/cws-dashboard-listing),
and [image requirements](https://developer.chrome.com/docs/webstore/images).

## Configure GitHub once for later updates

Push the workflow files to GitHub. In repository Settings → Environments create
`chrome-web-store`. Optionally configure a required reviewer if your GitHub plan
supports it. Restrict deployment to version tags.

Add these **environment variables**:

| Variable | Value |
| --- | --- |
| `CWS_PUBLISHER_ID` | Publisher → Settings in the store dashboard |
| `CWS_EXTENSION_ID` | The 32-character ID assigned to Homing |

Add these **environment secrets**:

| Secret | Value |
| --- | --- |
| `CWS_CLIENT_ID` | Google OAuth client ID |
| `CWS_CLIENT_SECRET` | Google OAuth client secret |
| `CWS_REFRESH_TOKEN` | Refresh token authorized by the store owner |

Follow Google's [official API setup](https://developer.chrome.com/docs/webstore/using-api):
enable Chrome Web Store API in a Cloud project, configure OAuth consent, create
a web-application OAuth client with the OAuth Playground redirect URI, then
use your own credentials in [OAuth Playground](https://developers.google.com/oauthplayground)
to authorize `https://www.googleapis.com/auth/chromewebstore` as the store owner.
Exchange the authorization code and save the refresh token directly in GitHub
Secrets. External OAuth apps left in Testing issue refresh tokens that expire
after seven days for this scope; see [Google's token expiration rules](https://developers.google.com/identity/protocols/oauth2#expiration).
Follow Google's consent-screen requirements for persistent automation. Never
put tokens in chat, commits, screenshots, or the extension package.

The first listing and any newly changed visibility settings must be completed
in the dashboard before API publishing. No store credentials are needed for
CI checks or ZIP generation.

## Release a new version

```powershell
npm run version:set -- 1.0.1
npm run check
git add package.json package-lock.json public/manifest.json
git commit -m "Prepare version 1.0.1"
git tag v1.0.1
git push origin HEAD
git push origin v1.0.1
```

Commit the release's code changes before tagging. Versions must increase from
the last uploaded store version. The command keeps package, lockfile, and
manifest versions aligned. Tagging an unchanged `1.0.0` is useful for the first
package; don't run the bump command for that initial tag.

Pushing a version tag runs **Release extension**, checks the code, validates the
tag against the version, and attaches a ZIP to the Actions run as an artifact.
To send that version to the store, open Actions → Release extension → Run
workflow, select the default branch containing the workflow, enter the existing
tag (for example `v1.0.1`), and choose:

- `package`: build an artifact only; no credentials needed.
- `upload`: replace the store draft package, without submitting for review.
- `publish`: upload and submit for review, with publication after approval.

The workflow verifies the selected tag exists, pins the upload script to the
same commit, and uploads the exact artifact built in that run. Store operations
are serialized, upload processing is polled, and
submission stops on upload failure, timeout, or store validation warnings.
HTTP errors deliberately omit response bodies to avoid leaking credentials;
inspect the developer dashboard for details. A successful workflow means
submission succeeded, not that Google has approved or published the update.

If an update is rejected, fix it and use a higher version. If a request times
out after Google may have accepted it, check the dashboard before retrying.
Do not rewrite a published tag. Manual ZIP uploads remain available as a fallback.

## Verification boundary

Local tests simulate authentication, asynchronous upload, failures, and
submission. Hosted Actions, live OAuth, store review, first-install from the
store, and upgrades from the store must be verified after account setup.
