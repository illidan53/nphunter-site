import { createHash } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
const microsoftTenant = '9188040d-6c67-4c5b-b112-36a304b66dad';
const providers = {
  google: { authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', jwks: 'https://www.googleapis.com/oauth2/v3/certs', issuer: ['https://accounts.google.com', 'accounts.google.com'], scope: 'openid email profile' },
  microsoft: { authorize: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize', token: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token', jwks: 'https://login.microsoftonline.com/consumers/discovery/v2.0/keys', issuer: `https://login.microsoftonline.com/${microsoftTenant}/v2.0`, scope: 'openid email profile User.Read' }
};
const keys = Object.fromEntries(Object.entries(providers).map(([name, config]) => [name, createRemoteJWKSet(new URL(config.jwks))]));
export function createOAuth(env, { request = fetch, jwks = keys } = {}) {
  const credentials = name => ({ id: env[`${name.toUpperCase()}_CLIENT_ID`], secret: env[`${name.toUpperCase()}_CLIENT_SECRET`] });
  const callback = name => `${env.SITE_ORIGIN}/api/auth/${name}/callback`;
  return {
    available: () => Object.fromEntries(Object.keys(providers).map(name => [name, Boolean(credentials(name).id && credentials(name).secret)])),
    async authorize(name, { state, nonce, verifier }) {
      const url = new URL(providers[name].authorize);
      url.search = new URLSearchParams({ client_id: credentials(name).id, redirect_uri: callback(name), response_type: 'code', scope: providers[name].scope, state, nonce, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: 'select_account' });
      return url.href;
    },
    async exchange(name, code, flow) {
      const config = providers[name];
      const response = await request(config.token, { method: 'POST', signal: AbortSignal.timeout(10000), body: new URLSearchParams({ grant_type: 'authorization_code', client_id: credentials(name).id, client_secret: credentials(name).secret, redirect_uri: callback(name), code, code_verifier: flow.verifier }) });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        const kind = /^[a-z_]+$/.test(failure.error || '') ? failure.error : 'unknown';
        const codes = Array.isArray(failure.error_codes) ? failure.error_codes.filter(Number.isInteger).join('_') : '';
        throw Object.assign(new Error('Token exchange failed'), { code: `OAUTH_${kind}_${codes}` });
      }
      const tokens = await response.json();
      const { payload } = await jwtVerify(tokens.id_token, jwks[name], { issuer: config.issuer, audience: credentials(name).id, algorithms: ['RS256'], requiredClaims: ['sub', 'iat', 'exp', 'nonce'] });
      if (payload.nonce !== flow.nonce) throw new Error('Invalid nonce');
      let email = payload.email?.toLowerCase();
      let emailVerified = payload.email_verified === true;
      if (name === 'microsoft') {
        if (payload.tid !== microsoftTenant) throw new Error('Personal Microsoft account required');
        // Never authorize from mutable preferred_username/email token claims.
        const profileResponse = await request('https://graph.microsoft.com/v1.0/me?$select=id,mail,displayName', { signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${tokens.access_token}` } });
        if (!profileResponse.ok) throw new Error('Profile lookup failed');
        const profile = await profileResponse.json();
        const normalizeId = value => typeof value === 'string' && /^[a-f0-9-]{16,36}$/i.test(value) ? value.replaceAll('-', '').padStart(32, '0').toLowerCase() : null;
        if (!normalizeId(profile.id) || normalizeId(profile.id) !== normalizeId(payload.oid)) throw new Error('Profile identity mismatch');
        email = profile.mail?.toLowerCase();
        // Only Microsoft-controlled personal mailbox domains can bootstrap an admin.
        emailVerified = typeof email === 'string' && /@(outlook\.com|hotmail\.com|live\.com)$/.test(email);
      }
      return { provider: name, subject: payload.sub, email: email || null, emailVerified, name: String(payload.name || email || 'User').slice(0, 100) };
    }
  };
}
