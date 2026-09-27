# nphunter-site

Website for [nphunter.gg](https://nphunter.gg), served from S3 + CloudFront, with Google/Outlook login and administrator visit analytics on API Gateway, Lambda and DynamoDB. The old nphunter.net domain permanently redirects to nphunter.gg through a CloudFront Function ([infra/canonical-host.js](infra/canonical-host.js)). See [production deployment](infra/DEPLOYMENT.md) for current configuration and credential expiry. The original static infrastructure is defined in [illidan53/ggame `infra/`](https://github.com/illidan53/ggame/tree/main/infra), which lags behind production; the API template is maintained here.

## Deploy

Pushes to `main` automatically:

1. Run backend authorization tests and Playwright page tests against local files
2. `aws s3 sync` the static site contents to bucket `nphunter-site`
3. Upload `index.html` with `Cache-Control: no-cache, max-age=0, must-revalidate`, including when its contents are unchanged
4. Invalidate CloudFront distribution `E4B5P9MJTIMYQ` and wait for completion
5. Smoke-test against the CloudFront origin
6. Run the Playwright homepage entry and cache-header tests against `https://nphunter.gg`

GitHub Actions assumes role `github-actions-nphunter-site-deploy` via OIDC.

## Test

```bash
npm ci
npm ci --prefix backend
npm run test:backend
npm run test:e2e
NPHUNTER_SITE_BASE_URL=https://nphunter.gg npm run test:e2e
NPHUNTER_SITE_BASE_URL=https://nphunter.gg NPHUNTER_SITE_VERIFY_TARGETS=1 npm run test:e2e
```

The HTML cache policy requires browsers to validate their cached homepage before reuse. CloudFront invalidation alone cannot clear a page already cached in a visitor’s browser. Visitors who still hold a page from before this policy was added should reload once.

## Languages

The header selector switches between Chinese (default) and English. Copy is maintained separately in `locales/zh.js` and `locales/en.js`, using matching keys. `language.js` applies text, accessible labels, image descriptions, document language and metadata, and remembers an explicit selection in localStorage. Switching still works when storage is blocked. The HTML retains Chinese fallback copy when JavaScript is unavailable. Project destinations are shared between languages.

## Interface styles

The header's style switch offers **Normal** and **Styled** (default). Styled shows each project as a glass card, with the project's art on a lit screen, over an aurora sky and planet horizon. The cards sit in a horizontal scroll-snap carousel: the previous/next buttons, the ← → keys, swipes and the dock below all bring one card at a time to the center, and side cards turn toward it. A click on a card that is not centered brings it to the center before it opens. Normal is the original light card grid. Both styles share the same project markup: `styled.css` restyles it (its `.slide-inner` and `.project-screen` wrappers are `display: contents` in Normal), and `styled.js` runs the switch, starfield and carousel. Card motion is applied to `.slide-inner`, not the slide, because scroll-snap measures the slide's transformed box. The choice is stored in localStorage (`nphunter-style`); an inline script in `index.html` applies it before the first paint. With reduced motion, cards switch instantly and the ambient animation stops.

## Login and administrator history

The homepage stays public. `account.js` places Sign in / Sign up beside the language selector. Both open an accessible modal offering Google/Gmail and Microsoft personal-account/Outlook sign-in; the first successful sign-in creates the account. The analytics notice is in the footer. `/history.html` is a public, empty page shell: **all history data is fetched from administrator-only API endpoints**, never embedded in HTML or public storage. Members and guests receive HTTP 403/401 from the API even if they modify the UI.

The AWS SAM/CloudFormation template in `infra/template.yaml` adds API Gateway HTTP API, Lambda (Node 22), and a private encrypted DynamoDB table. `/api/*` must route through the same CloudFront distribution with caching disabled; the origin requires a random secret header set by CloudFront. A direct API Gateway request is rejected. Deployment uploads only an explicit public-file allowlist to S3.

Administrators are configured at deploy time with the stack parameters `AdminGoogleEmail` and `AdminMicrosoftEmail`, so their addresses stay out of this public repository. With neither set, no one can read history.

- Google: the configured mailbox, with a verified Google email.
- Microsoft: the configured mailbox, from Microsoft Graph's personal-account mailbox profile, **not** the mutable ID-token `preferred_username` claim.

The first successful verified login binds each administrator mailbox to its immutable provider subject in DynamoDB. A different subject cannot claim the same administrator entry. Sessions last 24 hours, use opaque random tokens in `Secure; HttpOnly; SameSite=Lax; Path=/` host-only cookies, and are revoked server-side at logout. OAuth uses authorization code flow, PKCE, browser-bound one-use state, nonce, and signed ID-token issuer/audience/expiry verification. Microsoft organizational accounts are intentionally excluded from this personal-mailbox login option.

Analytics record one page-load event on `/`, `/index.html` and `/history.html`, including server time, trusted CloudFront viewer IP/country, path, browser, language, signature and role. No prior historical traffic can be reconstructed. No email content or contacts are requested. Scripts disabled or blocked by the browser do not produce events. The browser hashes coarse local properties (user agent, language, timezone, screen, touch capability) with SHA-256; no canvas/font enumeration or cross-site cookie is used. This is approximate deduplication: matching devices can collide and changing settings can split a visitor. Authenticated visitors are counted by provider subject. A person visiting before and after sign-in may count twice. A signature is never used to authenticate or authorize.

History has 7/30/90-day trends, range-wide distinct visitor and guest counts, daily accessible data, and UTC-date record search with pagination. Daily counts must not be summed to obtain range-wide distinct counts. Trend pages are loaded to completion before totals appear; failed loads do not show partial totals as complete. Raw records expire after 90 days by default; expired records are excluded immediately even if DynamoDB TTL deletion is delayed. Account admin bindings have no TTL. DynamoDB point-in-time backups can retain deleted data for up to the configured backup window; logs contain only generic failures, not tokens or visit contents.

### Configure and deploy backend

1. Google Cloud: create a Web OAuth client, configure the consent screen and `openid email profile` scopes. Use callback `https://nphunter.gg/api/auth/google/callback`. Publish the app's audience when ready for all users; testing mode is restricted to configured test accounts.
2. Microsoft Entra: register a **Web** application supporting **personal Microsoft accounts only**, callback `https://nphunter.gg/api/auth/microsoft/callback`. Grant delegated `User.Read` plus OIDC scopes, and create a client secret with a recorded expiry date. Do not enable implicit flow or public-client password flow. Rotate the client secret before expiry.
3. Install/package backend dependencies: `npm ci --prefix backend`. Package `infra/template.yaml` using AWS SAM (`sam build`) or `aws cloudformation package --template-file infra/template.yaml --s3-bucket YOUR_PRIVATE_ARTIFACT_BUCKET --output-template-file /private/path/packaged.yaml`. Use a private artifact bucket, never the public website bucket.
4. Deploy the packaged template with stack name `nphunter-api`, IAM capability, and parameters `SiteOrigin`, `OriginSecret` (random 32+ characters), `GoogleClientId`, `GoogleClientSecret`, `MicrosoftClientId`, `MicrosoftClientSecret`, `AdminGoogleEmail`, `AdminMicrosoftEmail`, and optionally `RetentionDays`. Secret parameters are `NoEcho`; supply them through a protected parameter file/secret manager, never commit them or paste them into command history. Blank provider credentials disable that provider safely.
5. Fetch the existing CloudFront configuration and ETag. Set `NPHUNTER_API_DOMAIN` to stack output `ApiOriginDomain` and `NPHUNTER_ORIGIN_SECRET` to the same origin secret. `infra/cloudfront-config.py` reads the existing distribution JSON on stdin and writes a proposed full configuration on stdout. Review and apply with `aws cloudfront update-distribution --if-match ETAG --distribution-config file:///private/path/proposed.json`. This retains the site's S3 origin and adds `/api/*`, managed **CachingDisabled** and **AllViewerExceptHostHeader** (includes CloudFront viewer location headers). Keep the output private: it includes the origin secret.
6. Remove the previous distribution-wide 403/404 custom page rewrites before integration: otherwise CloudFront can turn API authorization errors into homepage HTML. The config helper refuses to proceed when any custom error response exists. Update the corresponding `ggame-infra` Pulumi definition/import the external change to avoid reverting the API behavior in a future infrastructure deployment.
7. Deploy static assets through the existing workflow. Validate `/api/session`, Google and Microsoft real sign-in, both administrator accounts, ordinary-user denial, `/api/history` without cookies, logout revocation, country/IP values, and range totals. No credentials are needed in frontend files.

```bash
npm run test:backend
npm run test:e2e
```

Backend tests exercise authorization, administrator bootstrap, OAuth state replay/browser binding, session expiry/logout/CSRF, trusted IPs, pagination, deduplication inputs, expiry filtering and invalid parameters. Browser tests mock the API to check guest/member denial, login navigation, administrator data rendering, escaping, responsive layout and language switching. Real provider login still requires deployed credentials and cannot be established by mocked tests.

References: [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [Microsoft ID-token claims](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference), [CloudFront managed origin policies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.html).
