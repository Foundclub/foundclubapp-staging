// @ts-nocheck
import { getApiBaseUrl, getPublicApiOrigin } from '@/config/runtimeUrls';

const DEFAULT_PUBLIC_ORIGIN = 'https://foundclub.com';
const DEFAULT_WEB_APP_ORIGIN = 'https://foundclub.app';

const buildQueryString = (params) => Object.entries(params)
  .filter(([, value]) => value !== undefined && value !== null && value !== '')
  .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  .join('&');

export const toPublicOrigin = (apiUrl = getApiBaseUrl()) => {
  const rawValue = String(apiUrl || '').trim();
  if (!rawValue) return DEFAULT_PUBLIC_ORIGIN;
  return rawValue.replace(/\/api\/?$/i, '');
};

export const resolveShareEnvironment = (appEnv = process.env.APP_ENV || process.env.ENV) => {
  const normalizedEnv = String(appEnv || '').trim().toLowerCase();
  return normalizedEnv === 'production' ? 'production' : 'staging';
};

export const resolveWebAppOrigin = ({
  apiUrl = getApiBaseUrl(),
  publicOrigin = getPublicApiOrigin(),
  webUrl = process.env.WEB_APP_URL || process.env.FRONTEND_URL,
} = {}) => {
  const configuredWebUrl = String(webUrl || '').trim().replace(/\/+$/g, '');
  if (configuredWebUrl) return configuredWebUrl;

  if (typeof window !== 'undefined' && window.location?.origin) {
    return String(window.location.origin).trim().replace(/\/+$/g, '');
  }

  const runtimePublicOrigin = String(publicOrigin || '').trim().replace(/\/+$/g, '');
  if (runtimePublicOrigin) return runtimePublicOrigin;

  const derivedOrigin = toPublicOrigin(apiUrl);
  return derivedOrigin || DEFAULT_WEB_APP_ORIGIN;
};

export const buildFoundClubDeepLink = ({ id, invite = false, type }) => {
  if (!type || !id) return null;

  const normalizedType = String(type).trim().toLowerCase();
  const routeTypeMap = {
    league_squad: 'squad',
    league_team: 'squad',
    'league-squad': 'squad',
    'league-team': 'squad',
    squad: 'squad',
  };
  const routeType = routeTypeMap[normalizedType] || normalizedType;
  const query = buildQueryString({
    invite: invite ? 'true' : undefined,
  });

  return `foundclub://${encodeURIComponent(routeType)}/${encodeURIComponent(String(id))}${query ? `?${query}` : ''}`;
};

export const buildInstallLandingUrl = ({
  apiUrl,
  env = resolveShareEnvironment(),
  id,
  invite = false,
  source = 'share',
  type,
}) => {
  const baseUrl = toPublicOrigin(apiUrl);
  const query = buildQueryString({
    env,
    id,
    invite: invite ? 'true' : undefined,
    source,
    type,
  });

  return `${baseUrl}/install.html${query ? `?${query}` : ''}`;
};

export const buildPublicEventUrl = ({
  apiUrl,
  eventId,
  publicOrigin,
  webUrl,
}) => {
  const normalizedEventId = String(eventId || '').trim();
  if (!normalizedEventId) return null;

  const baseUrl = resolveWebAppOrigin({
    apiUrl,
    publicOrigin,
    webUrl,
  });

  return `${baseUrl}/events/${encodeURIComponent(normalizedEventId)}`;
};

export const buildShareMessageWithUrl = ({ intro, linkLabel, url }) => {
  const sections = [String(intro || '').trim()].filter(Boolean);

  if (url) {
    const normalizedLabel = String(linkLabel || '').trim();
    sections.push(normalizedLabel ? `${normalizedLabel} :\n${url}` : url);
  }

  return sections.join('\n\n');
};
