# Production deployment

Updated: 2026-09-26.

- Website: https://nphunter.net (canonical; no redirect to .gg)
- History shell: https://nphunter.net/history.html (data requires an administrator session)
- Region: us-east-1, in the AWS account behind the `nphunter-sso` CLI profile
- CloudFormation stack: `nphunter-api`
- DynamoDB: the stack's `Records` table (stack output `RecordsTable`)
- API Gateway origin: stack output `ApiOriginDomain`; it rejects requests without CloudFront's origin header
- Private deployment artifact bucket: `nphunter-api-artifacts-<account ID>`
- CloudFront: `E4B5P9MJTIMYQ`, alias nphunter.net
- TLS: ACM certificate `037b68bd-60db-4e61-8d6b-44aa008d4b1c` in us-east-1, covering nphunter.net
- Domain: nphunter.net remains registered with Route 53 (expires 2027-03-31). nphunter.gg auto-renewal was disabled on 2026-10-13, its hosted zone was deleted, and registration deletion completed in Route 53 (operation `86a486cd-311a-4fb1-a8d2-4035e7a8dbe4`: SUCCESSFUL; registered-domain list contains only nphunter.net). The obsolete .gg/SAN certificates were removed after all three distributions switched to .net.

On 2026-10-13 the site moved back to nphunter.net. The stack's `SiteOrigin` is `https://nphunter.net`; Google and Microsoft have .net callbacks registered. Existing host-only .gg sessions do not transfer, so visitors sign in again. The former .net → .gg redirect could remain in an existing browser's cache for up to one day; clear cached site data if that happens. The canonical function now redirects .gg to .net if invoked, although .gg is no longer an alias.

Global Network is now https://global-network.nphunter.net (`nsite/infra`, Pulumi `nsite-infra/prod`): S3 + CloudFront + Lambda + DynamoDB, no EC2. Kube Playground is https://k8s-game.nphunter.net (`kgame/infra`, Pulumi `kgame-infra/prod`): S3 + CloudFront only. Finance remains https://finance.nphunter.net (`msite/infra`), with EC2 `i-0fa217e019960b606` and its persistent research data. The Vercel projects are unchanged.

The obsolete ggame, cgame and tgame hosting has been retired through targeted Pulumi updates: EC2 instances `i-064ddf2918e84ff97`, `i-07de411cc37e35639` and `i-04e153294841e30fd`, their root disks, dedicated Elastic IPs and A records are removed. Their `infra/Pulumi.dev.yaml` files set `hosting_enabled: false`, and the programs require explicit true to create hosts. The ggame deploy/Pulumi workflows are disabled; cgame and tgame deployment variables are false. ECR images, source, shared VPC, IAM and the main-site resources are retained. Do not destroy the whole ggame stack: it owns the main site and shared .net zone.

The root distribution's API origin and cache/function behaviors are managed by this repository's deployment procedure. The legacy `ggame/infra/nphunter_site` definition ignores those fields, and its CloudFront state was refreshed after migration so a compute cleanup cannot overwrite login routing. Use a preview before any update; do not remove these exclusions without transferring ownership of the full API configuration. The domain migration used the existing CloudFormation template and previous secret parameters, changing only `SiteOrigin`; it did not deploy a new backend build.

The backend and static assets are deployed. `/api/*` uses managed CachingDisabled and AllViewerExceptHostHeader. The old global homepage error rewrites were removed so API status codes are preserved. Lambda uses shared account concurrency because the account quota could not accommodate reserved concurrency; API Gateway request throttling remains enabled.

The Google Cloud project has NPHunter OAuth branding configured and the audience published to production. Its Web client ID is `278959838413-8v84lsa6jnkrbob1gp52c8g9eaiidalr.apps.googleusercontent.com`.

Microsoft NPHunter application ID is `df297563-2c38-4e75-a6c1-22734d7fc42b`, with personal-account audience and the production Web callback. Both provider credentials are configured in AWS and both login options are enabled. The active Microsoft credential is named `NPHunter production verified` and expires **2027-03-20**; rotate before that date. An earlier unused credential named `NPHunter production login` also expires that day. Both applications link the site's homepage and `/privacy.html`.

Verified against production: real Google and Outlook sign-ins both resolve the specified mailbox to an administrator; Both administrator history pages load and logout revokes access. Direct API origin rejects unsigned requests (403), unauthenticated history is denied (401), session reports guest, responses are no-store, and a real browser visit stores valid IP/country/signature fields. Browser regression suite: 9 passed, 1 unrelated optional live-target test skipped. JWT/authorization unit suite: 11 passed. Ordinary-user denial is covered by backend and browser tests; no separate ordinary account was used for live OAuth verification.

Visit collection began on 2026-09-21. Records are retained for 90 days by default; earlier traffic cannot be reconstructed. Browser signatures provide approximate deduplication only.

No secret values belong in this file, frontend assets, Git, or test output. CloudFront's origin header and Lambda's OriginSecret must always match. Use the existing deployed parameter values when updating the stack.

Administrator mailboxes are the stack parameters `AdminGoogleEmail` and `AdminMicrosoftEmail`; keep them out of this public repository. The Lambda deployed on 2026-09-21 predates these parameters and has the administrators built in, so **the next stack update must set both**, or no one can read history. Admin bindings in DynamoDB are keyed by provider and mailbox, so the same mailboxes keep their existing bindings.

The header now contains the language selector and Sign in / Sign up buttons. Provider choices appear in a dismissible keyboard-accessible dialog; project shortcut links were removed from the header.

### Kube Playground public access (2026-10-11)

Removed the CloudFront author-IP viewer-request gate from `kgame/infra`, including the obsolete function and configuration. The game is public without sign-in, while its S3 bucket remains private behind CloudFront OAC. The homepage no longer labels the card as author-only. Destination checks require HTTP 200 and the game title.

## 2026-10-13 validation

- All three obsolete EC2 instances report `terminated`; the only remaining us-east-1 EBS volume and Elastic IP belong to finance.
- Main site: 12 backend tests and 18 local browser tests passed; 2 live homepage tests passed at nphunter.net. Anonymous session API returns 200; both provider login starts return 302 with .net callback URLs. Full user sign-in was not performed.
- Global Network: lint, 51 tests and build passed; HTTPS homepage, `/geo` and `/api/whoami` return 200 on the new domain.
- Kube: new-domain HTTPS returns 200; a real Chromium check verified the return-home link points to nphunter.net. The existing published hub asset was patched only for its return-home URL, with a new content hash and index invalidation. Local `test/hub.test.js` still fails on the pre-existing unfinished `mission-cargo` registration; those unrelated local changes were not published.
- Pulumi updates completed for all five affected stacks. The legacy root CloudFront preview reports no changes after refresh and routing exclusions.
- Migration and retirement changes are committed in their respective repositories; unrelated unfinished game work is preserved. Deployment workflows/variables for the retired EC2 games were disabled in GitHub directly.
