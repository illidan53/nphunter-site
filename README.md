# nphunter-site

Static landing page for [nphunter.net](https://nphunter.net), served from S3 + CloudFront (infra defined in [ggame-infra](https://github.com/illidan53/ggame-infra)).

## Deploy

Pushes to `main` automatically:

1. `aws s3 sync` the repo contents to bucket `nphunter-site`
2. Invalidate CloudFront distribution `E4B5P9MJTIMYQ`
3. Smoke-test against the CloudFront origin

GitHub Actions assumes role `github-actions-nphunter-site-deploy` via OIDC.
