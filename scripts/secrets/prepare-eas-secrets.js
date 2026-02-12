#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const appRoot = process.cwd();
const isEasBuild = process.env.EAS_BUILD === 'true';
const easPlatform = String(process.env.EAS_BUILD_PLATFORM || '').toLowerCase();

const IOS_TARGET = path.join(appRoot, 'ios', 'GoogleService-Info.plist');
const ANDROID_TARGET = path.join(appRoot, 'android', 'app', 'google-services.json');
const ANDROID_STAGING_TARGET = path.join(appRoot, 'android', 'app', 'src', 'staging', 'google-services.json');

const IOS_ENV_CANDIDATES = [
  'IOS_GOOGLE_SERVICE_INFO_PLIST',
  'IOS_GOOGLE_SERVICE_INFO_PLIST_BASE64',
  'GOOGLE_SERVICE_INFO_PLIST',
  'GOOGLE_SERVICE_INFO_PLIST_BASE64',
];

const ANDROID_ENV_CANDIDATES = [
  'ANDROID_GOOGLE_SERVICES_JSON',
  'ANDROID_GOOGLE_SERVICES_JSON_BASE64',
  'GOOGLE_SERVICES_JSON',
  'GOOGLE_SERVICES_JSON_BASE64',
];

const ANDROID_STAGING_ENV_CANDIDATES = [
  'ANDROID_GOOGLE_SERVICES_STAGING_JSON',
  'ANDROID_GOOGLE_SERVICES_STAGING_JSON_BASE64',
  'GOOGLE_SERVICES_STAGING_JSON',
  'GOOGLE_SERVICES_STAGING_JSON_BASE64',
];

const ensureParentDir = (targetPath) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
};

const looksLikeXml = (value) => {
  const normalized = String(value || '').trim();
  return normalized.startsWith('<?xml') || normalized.startsWith('<plist');
};

const looksLikeJson = (value) => {
  const normalized = String(value || '').trim();
  return normalized.startsWith('{') || normalized.startsWith('[');
};

const decodeBase64 = (value) => {
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    return decoded && decoded.trim() ? decoded : null;
  } catch (_error) {
    return null;
  }
};

const resolveContentFromEnv = (envNames, validator) => {
  for (const name of envNames) {
    const raw = process.env[name];
    if (!raw) continue;

    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (fs.existsSync(trimmed) && fs.statSync(trimmed).isFile()) {
      const fileContent = fs.readFileSync(trimmed, 'utf8');
      if (validator(fileContent)) {
        return { content: fileContent, source: `${name} (file path)` };
      }
      continue;
    }

    if (validator(raw)) {
      return { content: raw, source: `${name} (raw)` };
    }

    const decoded = decodeBase64(trimmed);
    if (decoded && validator(decoded)) {
      return { content: decoded, source: `${name} (base64)` };
    }
  }

  return null;
};

const writeIfMissing = ({ targetPath, envNames, required, label, validator }) => {
  if (fs.existsSync(targetPath)) {
    console.log(`[eas-secrets] ${label} already exists: ${path.relative(appRoot, targetPath)}`);
    return true;
  }

  const resolved = resolveContentFromEnv(envNames, validator);
  if (!resolved) {
    if (required) {
      console.error(`[eas-secrets] Missing required ${label}.`);
      console.error(`[eas-secrets] Expected one of env vars: ${envNames.join(', ')}`);
      return false;
    }
    console.log(`[eas-secrets] Optional ${label} not provided. Skipping.`);
    return true;
  }

  ensureParentDir(targetPath);
  fs.writeFileSync(targetPath, resolved.content, 'utf8');
  console.log(`[eas-secrets] Wrote ${label} -> ${path.relative(appRoot, targetPath)} from ${resolved.source}`);
  return true;
};

const shouldHandleIos = easPlatform === '' || easPlatform === 'ios';
const shouldHandleAndroid = easPlatform === '' || easPlatform === 'android';

const iosRequired = isEasBuild && shouldHandleIos;
const androidRequired = isEasBuild && shouldHandleAndroid;

let ok = true;

if (shouldHandleIos) {
  ok = writeIfMissing({
    targetPath: IOS_TARGET,
    envNames: IOS_ENV_CANDIDATES,
    required: iosRequired,
    label: 'iOS GoogleService-Info.plist',
    validator: looksLikeXml,
  }) && ok;
}

if (shouldHandleAndroid) {
  ok = writeIfMissing({
    targetPath: ANDROID_TARGET,
    envNames: ANDROID_ENV_CANDIDATES,
    required: androidRequired,
    label: 'Android google-services.json',
    validator: looksLikeJson,
  }) && ok;

  ok = writeIfMissing({
    targetPath: ANDROID_STAGING_TARGET,
    envNames: ANDROID_STAGING_ENV_CANDIDATES,
    required: false,
    label: 'Android staging google-services.json',
    validator: looksLikeJson,
  }) && ok;
}

if (!ok) {
  process.exit(1);
}

console.log('[eas-secrets] Secret preparation complete.');
