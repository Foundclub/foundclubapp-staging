/**
 * inviteLink.js — le SEUL endroit qui decide « ce lien est une invitation ».
 *
 * Module 100 % PUR : aucun import, aucun reseau, aucun stockage, aucune
 * navigation. Il LIT une adresse et rend un sujet + un identifiant, ou bien il
 * refuse en disant pourquoi. C'est volontaire : tant que la lecture d'un lien
 * ne peut RIEN declencher, un lien clique par erreur n'engage personne
 * (PROMPT_Y03, interdit n°1).
 *
 * Trois formes sont acceptees, et une seule est canonique :
 *   1. `https://foundclub.app/i/<sujet>/<id>`             <- canonique
 *   2. `https://<api>/install.html?type=&id=&invite=true` <- les liens deja envoyes
 *   3. `foundclub://<sujet>/<id>?invite=true`             <- le schema applicatif historique
 *
 * 🔒 L'adresse ne transporte QUE le sujet et l'identifiant : jamais un nom,
 * jamais un numero de telephone.
 */

/** Les sujets d'invitation. Equipe ET evenement des le depart, pas « plus tard ». */
export const INVITE_SUBJECTS = ['club', 'event', 'squad', 'team'];

/** Segment reserve du lien canonique : `/i/<sujet>/<id>`. */
export const INVITE_PATH_SEGMENT = 'i';

/** Origine publique par defaut du site (mesuree dans admin/Caddyfile). */
export const DEFAULT_INVITE_ORIGIN = 'https://foundclub.app';

const SUBJECT_ALIASES = {
  detection: 'event',
  league_squad: 'squad',
  league_team: 'squad',
  'league-squad': 'squad',
  'league-team': 'squad',
};

const OWN_HOSTS = ['foundclub.app', 'foundclubpro.com'];
const LOCAL_HOSTS = ['10.0.2.2', '127.0.0.1', 'localhost'];

const TRUTHY_FLAGS = ['1', 'on', 'true', 'yes'];

const safeDecode = (value) => {
  try {
    return decodeURIComponent(String(value));
  } catch (_error) {
    return String(value);
  }
};

/**
 * Decoupe une adresse sans dependre de `URL` (incomplet sous Hermes).
 * @param {unknown} rawUrl
 * @returns {{ host: string, path: string, query: string, scheme: string } | null}
 */
const splitUrl = (rawUrl) => {
  if (typeof rawUrl !== 'string') return null;
  const value = rawUrl.trim();
  if (!value) return null;

  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?/i.exec(value);
  if (!match) return null;

  return {
    host: String(match[2] || '').toLowerCase(),
    path: String(match[3] || ''),
    query: String(match[4] || ''),
    scheme: String(match[1] || '').toLowerCase(),
  };
};

/**
 * Lit un parametre de query sans `URLSearchParams`.
 * @param {string} query
 * @param {string} key
 * @returns {string}
 */
const readQueryParam = (query, key) => {
  const found = String(query || '')
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const index = pair.indexOf('=');
      return index >= 0
        ? [safeDecode(pair.slice(0, index)), safeDecode(pair.slice(index + 1))]
        : [safeDecode(pair), ''];
    })
    .find(([name]) => name === key);

  return found ? String(found[1] || '').trim() : '';
};

const isTruthyFlag = (value) => TRUTHY_FLAGS.includes(String(value || '').trim().toLowerCase());

/**
 * Le domaine appartient-il a FoundClub ? Un sous-domaine d'un domaine ETRANGER
 * (`foundclub.app.attaquant.example`) doit etre refuse : on compare donc le
 * suffixe, jamais une simple inclusion.
 * @param {string} host
 * @returns {boolean}
 */
const isOwnHost = (host) => {
  const normalized = String(host || '').toLowerCase().replace(/:\d+$/, '');
  if (!normalized) return false;
  if (LOCAL_HOSTS.includes(normalized)) return true;
  return OWN_HOSTS.some((own) => normalized === own || normalized.endsWith(`.${own}`));
};

/**
 * Ramene un sujet ecrit de plusieurs facons sur son nom unique.
 * @param {unknown} rawSubject
 * @returns {string}
 */
export const normalizeInviteSubject = (rawSubject) => {
  const normalized = String(rawSubject || '').trim().toLowerCase();
  return SUBJECT_ALIASES[normalized] || normalized;
};

/**
 * @typedef {{ id: string, subject: string }} InviteLink
 * @typedef {'foreign-host' | 'malformed' | 'missing-id'
 *   | 'not-an-invite' | 'unknown-subject'} InviteLinkProblem
 * @typedef {{ invite: InviteLink, ok: true }
 *   | { ok: false, reason: InviteLinkProblem }} InviteLinkResult
 */

/**
 * Valide un couple sujet/identifiant deja extrait d'une adresse.
 * @param {unknown} rawSubject
 * @param {unknown} rawId
 * @returns {InviteLinkResult}
 */
const buildResult = (rawSubject, rawId) => {
  const subject = normalizeInviteSubject(rawSubject);
  if (!INVITE_SUBJECTS.includes(subject)) return { ok: false, reason: 'unknown-subject' };

  const id = safeDecode(rawId).trim();
  if (!id) return { ok: false, reason: 'missing-id' };

  return { invite: { id, subject }, ok: true };
};

/**
 * Lit une adresse et dit si c'est une invitation — ou pourquoi ce n'en est pas
 * une. La raison sert a expliquer a l'utilisateur (jamais d'ecran blanc).
 * @param {unknown} rawUrl
 * @returns {InviteLinkResult}
 */
export const readInviteLink = (rawUrl) => {
  const parts = splitUrl(rawUrl);
  if (!parts) return { ok: false, reason: 'malformed' };

  // 3. Schema applicatif : `foundclub://<sujet>/<id>?invite=true`.
  if (parts.scheme === 'foundclub') {
    if (!isTruthyFlag(readQueryParam(parts.query, 'invite'))) {
      return { ok: false, reason: 'not-an-invite' };
    }
    const routeSegments = `${parts.host}${parts.path}`
      .split('/')
      .filter((segment) => segment !== '');
    if (routeSegments.length < 2) return { ok: false, reason: 'missing-id' };
    return buildResult(routeSegments[0], routeSegments[1]);
  }

  if (parts.scheme !== 'http' && parts.scheme !== 'https') {
    return { ok: false, reason: 'malformed' };
  }

  if (!isOwnHost(parts.host)) return { ok: false, reason: 'foreign-host' };

  const segments = parts.path.split('/').filter((segment) => segment !== '');

  // 2. Page d'atterrissage historique : `/install.html?type=&id=&invite=true`.
  if (segments.length === 1 && segments[0].toLowerCase() === 'install.html') {
    if (!isTruthyFlag(readQueryParam(parts.query, 'invite'))) {
      return { ok: false, reason: 'not-an-invite' };
    }
    return buildResult(readQueryParam(parts.query, 'type'), readQueryParam(parts.query, 'id'));
  }

  // 1. Lien canonique : `/i/<sujet>/<id>`.
  if (segments[0] !== INVITE_PATH_SEGMENT) return { ok: false, reason: 'not-an-invite' };
  if (segments.length < 2) return { ok: false, reason: 'unknown-subject' };
  if (segments.length < 3) return { ok: false, reason: 'missing-id' };

  return buildResult(segments[1], segments[2]);
};

/**
 * Version courte : l'invitation, ou `null`.
 * @param {unknown} rawUrl
 * @returns {InviteLink | null}
 */
export const parseInviteLink = (rawUrl) => {
  const result = readInviteLink(rawUrl);
  return result.ok ? result.invite : null;
};

/**
 * Construit le lien canonique. 🔒 Ne prend QUE un sujet et un identifiant.
 * @param {{ id?: unknown, origin?: string, subject?: unknown }} [params]
 * @returns {string | null}
 */
export const buildInviteWebUrl = ({ id, origin = DEFAULT_INVITE_ORIGIN, subject } = {}) => {
  const normalizedSubject = normalizeInviteSubject(subject);
  if (!INVITE_SUBJECTS.includes(normalizedSubject)) return null;

  const normalizedId = String(id ?? '').trim();
  if (!normalizedId) return null;

  const normalizedOrigin = String(origin || DEFAULT_INVITE_ORIGIN).trim().replace(/\/+$/g, '')
    || DEFAULT_INVITE_ORIGIN;

  const path = `${INVITE_PATH_SEGMENT}/${normalizedSubject}/${encodeURIComponent(normalizedId)}`;
  return `${normalizedOrigin}/${path}`;
};
