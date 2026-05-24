# nphunter-site

Static landing page for [nphunter.net](https://nphunter.net), served from S3 + CloudFront (infra defined in [ggame-infra](https://github.com/illidan53/ggame-infra)).

## Deploy

Pushes to `main` automatically:

1. Run the Playwright homepage entry test against local `index.html`
2. `aws s3 sync` the static site contents to bucket `nphunter-site`
3. Invalidate CloudFront distribution `E4B5P9MJTIMYQ`
4. Smoke-test against the CloudFront origin
5. Run the Playwright homepage entry test against `https://nphunter.net`

GitHub Actions assumes role `github-actions-nphunter-site-deploy` via OIDC.

## Test

```bash
npm install
npm run test:e2e
NPHUNTER_SITE_BASE_URL=https://nphunter.net npm run test:e2e
```
