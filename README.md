# nphunter-site

Static landing page for [nphunter.net](https://nphunter.net), served from S3 + CloudFront (infra defined in [ggame-infra](https://github.com/illidan53/ggame-infra)).

## Deploy

Pushes to `main` automatically:

1. Run the Playwright homepage entry test against local `index.html`
2. `aws s3 sync` the static site contents to bucket `nphunter-site`
3. Upload `index.html` with `Cache-Control: no-cache, max-age=0, must-revalidate`, including when its contents are unchanged
4. Invalidate CloudFront distribution `E4B5P9MJTIMYQ` and wait for completion
5. Smoke-test against the CloudFront origin
6. Run the Playwright homepage entry and cache-header tests against `https://nphunter.net`

GitHub Actions assumes role `github-actions-nphunter-site-deploy` via OIDC.

## Test

```bash
npm install
npm run test:e2e
NPHUNTER_SITE_BASE_URL=https://nphunter.net npm run test:e2e
NPHUNTER_SITE_BASE_URL=https://nphunter.net NPHUNTER_SITE_VERIFY_TARGETS=1 npm run test:e2e
```

The HTML cache policy requires browsers to validate their cached homepage before reuse. CloudFront invalidation alone cannot clear a page already cached in a visitor’s browser. Visitors who still hold a page from before this policy was added should reload once.
