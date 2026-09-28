# Production deployment

Updated: 2026-09-26.

- Website: https://nphunter.gg (https://nphunter.net permanently redirects here)
- History shell: https://nphunter.gg/history.html (data requires an administrator session)
- Region: us-east-1, in the AWS account behind the `nphunter-sso` CLI profile
- CloudFormation stack: `nphunter-api`
- DynamoDB: the stack's `Records` table (stack output `RecordsTable`)
- API Gateway origin: stack output `ApiOriginDomain`; it rejects requests without CloudFront's origin header
- Private deployment artifact bucket: `nphunter-api-artifacts-<account ID>`
- CloudFront: `E4B5P9MJTIMYQ`, aliases nphunter.gg and nphunter.net
- TLS: one ACM certificate in us-east-1 covering nphunter.gg and nphunter.net
- Domains: both registered with Route 53 in this account, auto-renewing (nphunter.net expires 2027-03-31, nphunter.gg 2027-09-26). Each has a Route 53 hosted zone in the same account.

The site moved from nphunter.net to nphunter.gg on 2026-09-26. CloudFront Function `nphunter-site-canonical-host` ([canonical-host.js](canonical-host.js)) runs on viewer requests for the default and `/api/*` behaviors and answers nphunter.net requests with a 301 to the same path and query on nphunter.gg; browsers keep the redirect for one day. The stack's `SiteOrigin` is `https://nphunter.gg`, and Google and Microsoft both have callbacks registered for both domains. The nphunter.net callbacks can be removed once logins on nphunter.gg are confirmed. Subdomains finance, cgame, ggame and tgame remain on nphunter.net. global-network.nphunter.gg (Global Network, added 2026-09-28) is a separate S3 + CloudFront site with its own certificate and distribution, managed from [illidan53/nsite `infra/`](https://github.com/illidan53/nsite/tree/main/infra); it only adds A/AAAA and certificate-validation records to the nphunter.gg hosted zone.

The certificate, aliases, function association and nphunter.gg records were applied with the AWS CLI. The Pulumi definition in [illidan53/ggame `infra/nphunter_site`](https://github.com/illidan53/ggame/tree/main/infra/nphunter_site) still describes the distribution before the API integration (nphunter.net only, the old certificate, no `/api/*` behavior or function, global error rewrites). A `pulumi up` there would break login and take nphunter.gg offline, so update that code to match production before running it.

The backend and static assets are deployed. `/api/*` uses managed CachingDisabled and AllViewerExceptHostHeader. The old global homepage error rewrites were removed so API status codes are preserved. Lambda uses shared account concurrency because the account quota could not accommodate reserved concurrency; API Gateway request throttling remains enabled.

The Google Cloud project has NPHunter OAuth branding configured and the audience published to production. Its Web client ID is `278959838413-8v84lsa6jnkrbob1gp52c8g9eaiidalr.apps.googleusercontent.com`.

Microsoft NPHunter application ID is `df297563-2c38-4e75-a6c1-22734d7fc42b`, with personal-account audience and the production Web callback. Both provider credentials are configured in AWS and both login options are enabled. The active Microsoft credential is named `NPHunter production verified` and expires **2027-03-20**; rotate before that date. An earlier unused credential named `NPHunter production login` also expires that day. Both applications link the site's homepage and `/privacy.html`.

Verified against production: real Google and Outlook sign-ins both resolve the specified mailbox to an administrator; Both administrator history pages load and logout revokes access. Direct API origin rejects unsigned requests (403), unauthenticated history is denied (401), session reports guest, responses are no-store, and a real browser visit stores valid IP/country/signature fields. Browser regression suite: 9 passed, 1 unrelated optional live-target test skipped. JWT/authorization unit suite: 11 passed. Ordinary-user denial is covered by backend and browser tests; no separate ordinary account was used for live OAuth verification.

Visit collection began on 2026-09-21. Records are retained for 90 days by default; earlier traffic cannot be reconstructed. Browser signatures provide approximate deduplication only.

No secret values belong in this file, frontend assets, Git, or test output. CloudFront's origin header and Lambda's OriginSecret must always match. Use the existing deployed parameter values when updating the stack.

Administrator mailboxes are the stack parameters `AdminGoogleEmail` and `AdminMicrosoftEmail`; keep them out of this public repository. The Lambda deployed on 2026-09-21 predates these parameters and has the administrators built in, so **the next stack update must set both**, or no one can read history. Admin bindings in DynamoDB are keyed by provider and mailbox, so the same mailboxes keep their existing bindings.

The header now contains the language selector and Sign in / Sign up buttons. Provider choices appear in a dismissible keyboard-accessible dialog; project shortcut links were removed from the header.
