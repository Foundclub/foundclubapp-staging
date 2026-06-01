import { APP_RUNTIME_ENV } from '@/constants/runtimeFlags';

const normalizeFlag = (value) => String(value || '').trim().toLowerCase();

export const getResolvedAuthAppEnv = (env = process.env) => normalizeFlag(
  env.APP_ENV || env.ENV || APP_RUNTIME_ENV,
);

export const isFirebaseBypassEnabled = (env = process.env) => {
  if (getResolvedAuthAppEnv(env) !== 'local') {
    return false;
  }

  const bypassFlag = normalizeFlag(env.BYPASS_FIREBASE_AUTH);
  if (!bypassFlag) {
    return true;
  }

  return bypassFlag === 'true';
};

const normalizePhoneNumberForBypass = (value) => String(value || '')
  .replace(/\s+/g, '')
  .trim();

const parseCsvPhones = (rawValue) => String(rawValue || '')
  .split(',')
  .map((value) => normalizePhoneNumberForBypass(value))
  .filter(Boolean);

export const isWebQaPhoneBypassEnabled = (phoneNumber, env = process.env) => {
  const isEnabled = String(env.WEB_ENABLE_QA_LOGIN_BYPASS || '').trim().toLowerCase() === 'true';
  if (!isEnabled) return false;

  const normalizedPhoneNumber = normalizePhoneNumberForBypass(phoneNumber);
  if (!normalizedPhoneNumber) return false;

  return parseCsvPhones(env.WEB_QA_BYPASS_PHONES).includes(normalizedPhoneNumber);
};

export const normalizePhoneNumberForBypassMatch = normalizePhoneNumberForBypass;
