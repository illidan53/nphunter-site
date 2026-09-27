import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from '../../backend/node_modules/jose/dist/webapi/index.js';
import { createOAuth } from '../../backend/oauth.mjs';
const pair = await generateKeyPair('RS256');
const tid = '9188040d-6c67-4c5b-b112-36a304b66dad';
async function make({ provider='google', claims={}, issuer, audience='client-id', key=pair.privateKey, expires='1h', profile }={}) {
  const payload={nonce:'nonce',email:'owner@gmail.com',email_verified:true,sub:'subject',...(provider==='microsoft'?{tid,oid:'00000000-0000-0000-0123-456789abcdef'}:{}),...claims};
  const jwt=await new SignJWT(payload).setProtectedHeader({alg:'RS256'}).setIssuer(issuer||(provider==='google'?'https://accounts.google.com':`https://login.microsoftonline.com/${tid}/v2.0`)).setAudience(audience).setIssuedAt().setExpirationTime(expires).sign(key);
  const requests=[];
  const oauth=createOAuth({SITE_ORIGIN:'https://nphunter.gg',GOOGLE_CLIENT_ID:'client-id',GOOGLE_CLIENT_SECRET:'secret',MICROSOFT_CLIENT_ID:'client-id',MICROSOFT_CLIENT_SECRET:'secret'}, {jwks:{google:pair.publicKey,microsoft:pair.publicKey},request:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>String(url).includes('graph.microsoft.com')?profile:{id_token:jwt,access_token:'access'}};}});
  return {oauth,requests,exchange:()=>oauth.exchange(provider,'code',{nonce:'nonce',verifier:'verifier'})};
}
test('OIDC verifies signature, issuer, audience, expiry and nonce',async()=>{
  assert.equal((await (await make()).exchange()).subject,'subject');
  for(const config of [{issuer:'https://attacker.example'},{audience:'another-app'},{expires:'-1h'},{claims:{nonce:'wrong'}},{key:(await generateKeyPair('RS256')).privateKey}])await assert.rejects((await make(config)).exchange());
});
test('authorization and exchange use PKCE, exact redirect and no mailbox scope',async()=>{
  const {oauth,requests,exchange}=await make();const url=new URL(await oauth.authorize('google',{state:'state',nonce:'nonce',verifier:'verifier'}));
  assert.equal(url.searchParams.get('redirect_uri'),'https://nphunter.gg/api/auth/google/callback');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.ok(url.searchParams.get('code_challenge'));await exchange();assert.equal(requests[0].options.body.get('code_verifier'),'verifier');
});
test('Microsoft bootstrap uses Graph mailbox, accepts consumer ID format, rejects profile mismatch',async()=>{
  const config={provider:'microsoft',claims:{email:'owner@outlook.com',preferred_username:'owner@outlook.com'},profile:{id:'0123456789abcdef',mail:'other@outlook.com'}};
  const user=await (await make(config)).exchange();assert.equal(user.email,'other@outlook.com');assert.equal(user.emailVerified,true);
  await assert.rejects((await make({...config,profile:{id:'different',mail:'owner@outlook.com'}})).exchange());
  await assert.rejects((await make({...config,claims:{tid:'organization'}})).exchange());
});
