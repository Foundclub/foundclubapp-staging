import {
  buildInviteWebUrl,
  INVITE_SUBJECTS,
  normalizeInviteCode,
  normalizeInviteSubject,
} from '@/domains/invitations/inviteLink';

const INSTALL_INVITE_MARKER = '1';

const safeDecode = (value) => {
  try {
    return decodeURIComponent(String(value || '').replace(/\+/g, ' '));
  } catch (_error) {
    return String(value || '');
  }
};

const readReferrerParams = (rawReferrer) => Object.fromEntries(
  String(rawReferrer || '')
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const separator = pair.indexOf('=');
      return separator < 0
        ? [safeDecode(pair), '']
        : [safeDecode(pair.slice(0, separator)), safeDecode(pair.slice(separator + 1))];
    }),
);

/**
 * Lit le petit colis pose par la page web dans le champ officiel Play referrer.
 * Tout autre referrer (campagne, attribution, valeur tierce) est ignore.
 * @param {unknown} rawReferrer
 * @returns {{ code?: string, id: string, subject: string } | null}
 */
export const parseInviteInstallReferrer = (rawReferrer) => {
  const params = readReferrerParams(rawReferrer);
  if (params.fc_invite !== INSTALL_INVITE_MARKER) return null;

  const subject = normalizeInviteSubject(params.subject);
  const id = String(params.id || '').trim();
  if (!INVITE_SUBJECTS.includes(subject) || !id) return null;

  const code = normalizeInviteCode(params.c);
  return code ? { code, id, subject } : { id, subject };
};

/**
 * Le referrer devient un lien canonique, puis repasse par le socle INVIT2.
 * @param {unknown} rawReferrer
 * @returns {string | null}
 */
export const buildInviteUrlFromInstallReferrer = (rawReferrer) => {
  const invite = parseInviteInstallReferrer(rawReferrer);
  return invite ? buildInviteWebUrl(invite) : null;
};
