import { store } from './store.mjs';
import { createOAuth } from './oauth.mjs';
import { createApp } from './app.mjs';
const admins = { google: process.env.ADMIN_GOOGLE_EMAIL, microsoft: process.env.ADMIN_MICROSOFT_EMAIL };
export const handler = createApp({ store, oauth: createOAuth(process.env), origin: process.env.SITE_ORIGIN, originSecret: process.env.ORIGIN_SECRET, admins, retentionDays: Number(process.env.RETENTION_DAYS || 90) });
