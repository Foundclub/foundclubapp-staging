#!/usr/bin/env node

const normalizeText = (value) => String(value || '').trim();

const normalizeAppEnv = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'production') return 'production';
  if (normalized === 'staging' || normalized === 'preview') return 'staging';
  return 'local';
};

const appEnv = normalizeAppEnv(process.env.APP_ENV || process.env.ENV);
const requiredKeys = ['API_URL', 'SOCKET_URL'];
const errors = [];
const warnings = [];

if (appEnv === 'staging' || appEnv === 'production') {
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
    warnings.push('API_URL does not end with /api. Verify the mobile base URL before shipping this build.');
  }
}

console.info('[RUNTIME_ENV_CHECK]', {
  apiUrlConfigured: Boolean(normalizeText(process.env.API_URL)),
  appEnv,
  errors,
  socketUrlConfigured: Boolean(normalizeText(process.env.SOCKET_URL)),
  warnings,
});

if (errors.length > 0) {
  errors.forEach((error) => console.error(`[RUNTIME_ENV_CHECK] ${error}`));
  process.exit(1);
}
