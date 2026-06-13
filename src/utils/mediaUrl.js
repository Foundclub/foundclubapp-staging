import { Platform } from 'react-native';

import { getApiBaseUrl, getPublicApiOrigin } from '@/config/runtimeUrls';

const LOOPBACK_HOSTS = new Set(['10.0.2.2', '127.0.0.1', 'localhost']);

export const toPublicApiOrigin = (rawApiUrl) => {
  const raw = String(rawApiUrl || '').trim();
  if (!raw) return '';
  return raw.replace(/\/api\/?$/i, '');
};

export const isLoopbackHost = (host) => LOOPBACK_HOSTS.has(
  String(host || '').trim().toLowerCase(),
);

export const normalizeOrigin = (rawOrigin) => {
  const origin = toPublicApiOrigin(rawOrigin);
  if (!origin) return '';

  try {
    return new URL(origin).origin;
  } catch (_error) {
    return origin.replace(/\/+$/g, '');
  }
};

export const getOriginHost = (origin) => {
  try {
    return new URL(origin).hostname;
  } catch (_error) {
    return '';
  }
};

export const pickPreferredMediaOrigin = (origins) => {
  const candidates = Array.isArray(origins) ? origins.filter(Boolean) : [];
  if (candidates.length === 0) return '';

  if (Platform.OS === 'android' && __DEV__) {
    const runtimeOrigin = normalizeOrigin(getPublicApiOrigin()) || normalizeOrigin(getApiBaseUrl());
    const runtimeLoopbackHost = getOriginHost(runtimeOrigin);
    if (runtimeLoopbackHost) {
      const matchingRuntimeOrigin = candidates.find(
        (origin) => getOriginHost(origin) === runtimeLoopbackHost,
      );
      if (matchingRuntimeOrigin) return matchingRuntimeOrigin;
    }

    const emulatorOrigin = candidates.find((origin) => getOriginHost(origin) === 'localhost')
      || candidates.find((origin) => getOriginHost(origin) === '10.0.2.2');
    if (emulatorOrigin) return emulatorOrigin;
  }

  const nonLoopbackOrigin = candidates.find((origin) => !isLoopbackHost(getOriginHost(origin)));
  return nonLoopbackOrigin || candidates[0] || '';
};

export const rewriteLoopbackUrl = (rawUrl, targetOrigin) => {
  if (!rawUrl || !targetOrigin || !/^https?:\/\//i.test(rawUrl)) return rawUrl;

  try {
    const currentUrl = new URL(rawUrl);
    const targetUrl = new URL(targetOrigin);

    if (
      isLoopbackHost(currentUrl.hostname)
      && currentUrl.hostname !== targetUrl.hostname
    ) {
      return `${targetUrl.origin}${currentUrl.pathname}${currentUrl.search || ''}`;
    }
  } catch (_error) {
    // Keep original URL if parsing fails.
  }

  return rawUrl;
};

export const shouldAttachAuthToMediaUrl = (rawUrl, options = {}) => {
  const value = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(value)) return false;

  const apiOrigins = [
    options.apiOrigin,
    options.publicApiOrigin,
    getApiBaseUrl(),
    getPublicApiOrigin(),
  ]
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

  if (apiOrigins.length === 0) return false;

  const mediaOrigin = normalizeOrigin(value);
  if (!mediaOrigin) return false;

  return apiOrigins.some((origin) => origin === mediaOrigin);
};

const buildDefaultMediaOrigins = () => [
  getApiBaseUrl(),
  getPublicApiOrigin(),
]
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

const isNonHttpResolvedUri = (value) => /^(file:\/\/|content:\/\/|data:)/i.test(value);

export const resolveMediaUrl = (rawUrl, options = {}) => {
  const value = String(rawUrl || '').trim();
  if (!value) return '';

  if (value.startsWith('//')) {
    return `https:${value}`;
  }

  if (isNonHttpResolvedUri(value)) {
    return value;
  }

  const explicitOrigins = Array.isArray(options.origins) ? options.origins : [];
  const origins = (explicitOrigins.length > 0 ? explicitOrigins : buildDefaultMediaOrigins())
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
  const preferredOrigin = pickPreferredMediaOrigin(origins);

  if (/^https?:\/\//i.test(value)) {
    return rewriteLoopbackUrl(value, preferredOrigin);
  }

  const normalizedPath = value.startsWith('/') ? value : `/${value}`;
  if (!preferredOrigin) return normalizedPath;

  return `${preferredOrigin}${normalizedPath}`;
};
