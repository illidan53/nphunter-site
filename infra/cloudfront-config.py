"""Prepare a CloudFront distribution config from get-distribution-config JSON.
Reads NPHUNTER_API_DOMAIN and NPHUNTER_ORIGIN_SECRET from environment.
Writes the proposed config only; does not change AWS. Keep output outside repo.
"""
import json, os, sys
source = json.load(sys.stdin)
config = source['DistributionConfig']
domain = os.environ['NPHUNTER_API_DOMAIN']
secret = os.environ['NPHUNTER_ORIGIN_SECRET']
if len(secret) < 32 or not domain.endswith('.amazonaws.com'):
    raise SystemExit('Invalid API domain or origin secret')
origin_id = 'nphunter-api'
origin = {'Id': origin_id, 'DomainName': domain, 'OriginPath': '', 'CustomHeaders': {'Quantity': 1, 'Items': [{'HeaderName': 'X-Origin-Verify', 'HeaderValue': secret}]}, 'CustomOriginConfig': {'HTTPPort': 80, 'HTTPSPort': 443, 'OriginProtocolPolicy': 'https-only', 'OriginSslProtocols': {'Quantity': 1, 'Items': ['TLSv1.2']}, 'OriginReadTimeout': 30, 'OriginKeepaliveTimeout': 5}}
origins = [item for item in config['Origins']['Items'] if item['Id'] != origin_id] + [origin]
config['Origins'] = {'Quantity': len(origins), 'Items': origins}
behavior = {'PathPattern': '/api/*', 'TargetOriginId': origin_id, 'ViewerProtocolPolicy': 'https-only', 'AllowedMethods': {'Quantity': 7, 'Items': ['GET','HEAD','OPTIONS','PUT','PATCH','POST','DELETE'], 'CachedMethods': {'Quantity': 2, 'Items': ['GET','HEAD']}}, 'Compress': True, 'SmoothStreaming': False, 'FieldLevelEncryptionId': '', 'LambdaFunctionAssociations': {'Quantity': 0}, 'FunctionAssociations': {'Quantity': 0}, 'TrustedSigners': {'Enabled': False, 'Quantity': 0}, 'TrustedKeyGroups': {'Enabled': False, 'Quantity': 0}, 'CachePolicyId': '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', 'OriginRequestPolicyId': 'b689b0a8-53d0-40ab-baf2-68738e2966ac'}
# Managed CachingDisabled + AllViewerExceptHostHeader (includes CloudFront geolocation).
behaviors = [behavior] + [item for item in config.get('CacheBehaviors', {}).get('Items', []) if item['PathPattern'] != '/api/*']
config['CacheBehaviors'] = {'Quantity': len(behaviors), 'Items': behaviors}
# A global custom 403/404 -> index.html rule would also rewrite protected API errors.
if config.get('CustomErrorResponses', {}).get('Quantity', 0):
    raise SystemExit('Review/remove global custom error responses before adding the API; they can rewrite authorization errors.')
json.dump(config, sys.stdout, indent=2)
