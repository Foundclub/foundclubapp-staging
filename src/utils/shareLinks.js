const DEFAULT_PUBLIC_ORIGIN = 'https://foundclub.com';

const buildQueryString = (params) => Object.entries(params)
  .filter(([, value]) => value !== undefined && value !== null && value !== '')
  .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  .join('&');

export const toPublicOrigin = (apiUrl = process.env.API_URL) => {
  const rawValue = String(apiUrl || '').trim();
  if (!rawValue) return DEFAULT_PUBLIC_ORIGIN;
  return rawValue.replace(/\/api\/?$/i, '');
};

export const resolveShareEnvironment = (appEnv = process.env.APP_ENV || process.env.ENV) => {
  const normalizedEnv = String(appEnv || '').trim().toLowerCase();
  return normalizedEnv === 'production' ? 'production' : 'staging';
};

export const buildFoundClubDeepLink = ({ id, invite = false, type }) => {
  if (!type || !id) return null;

  const query = buildQueryString({
    invite: invite ? 'true' : undefined,
  });

  return `foundclub://${encodeURIComponent(type)}/${encodeURIComponent(String(id))}${query ? `?${query}` : ''}`;
};

export const buildInstallLandingUrl = ({
  apiUrl,
  env = resolveShareEnvironment(),
  id,
  source = 'share',
  type,
}) => {
  const baseUrl = toPublicOrigin(apiUrl);
  const query = buildQueryString({
    env,
    id,
    source,
    type,
  });

  return `${baseUrl}/install.html${query ? `?${query}` : ''}`;
};

export const buildShareMessageWithUrl = ({ intro, linkLabel, url }) => {
  const sections = [String(intro || '').trim()].filter(Boolean);

  if (url) {
    const normalizedLabel = String(linkLabel || '').trim();
    sections.push(normalizedLabel ? `${normalizedLabel} :\n${url}` : url);
  }

  return sections.join('\n\n');
};
