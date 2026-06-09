#!/usr/bin/env node
/* eslint-disable no-console */

const normalizeText = (value) => String(value || '').trim();
const isLikelyApiUrl = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    const host = String(parsed.hostname || '').trim().toLowerCase();
    const pathname = String(parsed.pathname || '').trim().toLowerCase();
    return host === 'api'
      || host.startsWith('api.')
      || host.startsWith('api-')
      || host.includes('.api.')
      || pathname === '/api'
      || pathname.startsWith('/api/');
  } catch (_error) {
    return /(^|\/\/)api[.-]/i.test(normalized) || /\/api(?:\/|$)/i.test(normalized);
  }
};

const normalizeAppEnv = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'production') return 'production';
  if (normalized === 'staging' || normalized === 'preview') return 'staging';
  return 'local';
};

const appEnv = normalizeAppEnv(process.env.APP_ENV || process.env.ENV);
const searchMapProvider = normalizeText(process.env.FC_SEARCH_MAP_PROVIDER).toLowerCase();
const errors = [];
const warnings = [];

if (appEnv === 'staging' || appEnv === 'production') {
  const requiredKeys = ['API_URL', 'SOCKET_URL', 'WEB_APP_URL'];
  requiredKeys.forEach((key) => {
    const value = normalizeText(process.env[key]);
    if (!value) {
      errors.push(`${key} is required for ${appEnv} builds. Configure it in EAS env/secrets.`);
    } else if (!/^https?:\/\//i.test(value)) {
      errors.push(`${key} must be a full URL. Received: ${value}`);
    }
  });

  const apiUrl = normalizeText(process.env.API_URL);
  if (apiUrl && !/\/api\/?$/i.test(apiUrl)) {
    warnings.push(
      'API_URL does not end with /api. '
      + 'Verify the mobile base URL before shipping this build.',
    );
  }

  const webAppUrl = normalizeText(process.env.WEB_APP_URL);
  if (webAppUrl && isLikelyApiUrl(webAppUrl)) {
    errors.push(
      'WEB_APP_URL must point to the public web app origin, '
      + 'not the API host.',
    );
  }

  if (searchMapProvider === 'tomtom' && !normalizeText(process.env.TOMTOM_API_KEY)) {
    errors.push(
      'TOMTOM_API_KEY is required when FC_SEARCH_MAP_PROVIDER=tomtom '
      + 'for staging/production builds.',
    );
  }
}

console.info('[RUNTIME_ENV_CHECK]', {
  apiUrlConfigured: Boolean(normalizeText(process.env.API_URL)),
  appEnv,
  errors,
  searchMapProvider: searchMapProvider || 'auto',
  socketUrlConfigured: Boolean(normalizeText(process.env.SOCKET_URL)),
  warnings,
  webAppUrlConfigured: Boolean(normalizeText(process.env.WEB_APP_URL)),
});

if (errors.length > 0) {
  errors.forEach((error) => console.error(`[RUNTIME_ENV_CHECK] ${error}`));
  process.exit(1);
}
