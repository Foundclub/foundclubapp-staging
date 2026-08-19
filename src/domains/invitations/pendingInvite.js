/**
 * pendingInvite.js — l'invitation qui ATTEND son moment.
 *
 * Le lien est souvent clique AVANT que la personne soit prete : app tout juste
 * installee, pas encore de compte, onboarding en cours. On range donc le sujet
 * et l'identifiant, et on repropose plus tard.
 *
 * 🔒 On ne range QUE le sujet et l'identifiant — jamais un nom, jamais un
 * numero. Et une invitation rangee ne fait toujours RIEN toute seule : elle
 * ne sert qu'a reafficher la question.
 *
 * Meme duree de vie que l'ancien magasin League (`pendingSquadInviteLink`) :
 * 7 jours. ⚠️ Ce magasin-la existe encore et reste branche sur le chemin
 * League ; il sera absorbe ici quand la squad passera par ce socle.
 */
import { INVITE_SUBJECTS } from '@/domains/invitations/inviteLink';
import { storage } from '@/store/appContext';

export const PENDING_INVITE_STORAGE_KEY = 'pendingInviteLink';
export const PENDING_INVITE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * L'invitation rangee : le sujet, son identifiant, et la date de rangement.
 * @typedef {{ createdAt: number, id: string, subject: string }} PendingInvite
 */

/**
 * Relit et valide le contenu range.
 * @param {string | undefined} rawValue
 * @returns {PendingInvite | null}
 */
const parsePendingInvite = (rawValue) => {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    const id = String(parsed?.id || '').trim();
    const subject = String(parsed?.subject || '').trim();
    const createdAt = Number(parsed?.createdAt || 0);

    if (!id || !INVITE_SUBJECTS.includes(subject)) return null;
    if (!Number.isFinite(createdAt) || createdAt <= 0) return null;
    if (Date.now() - createdAt > PENDING_INVITE_MAX_AGE_MS) return null;

    return { createdAt, id, subject };
  } catch (_error) {
    return null;
  }
};

/**
 * Range une invitation pour plus tard. Ne fait rien si elle est invalide.
 * @param {{ id?: unknown, subject?: unknown } | null} [invite]
 * @returns {void}
 */
export const savePendingInvite = (invite) => {
  const id = String(invite?.id ?? '').trim();
  const subject = String(invite?.subject ?? '').trim();
  if (!id || !INVITE_SUBJECTS.includes(subject)) return;

  storage.set(PENDING_INVITE_STORAGE_KEY, JSON.stringify({
    createdAt: Date.now(),
    id,
    subject,
  }));
};

/**
 * Relit l'invitation en attente. Une invitation perimee ou illisible est
 * effacee plutot que rejouee.
 * @returns {PendingInvite | null}
 */
export const readPendingInvite = () => {
  const pendingInvite = parsePendingInvite(storage.getString(PENDING_INVITE_STORAGE_KEY));
  if (!pendingInvite) {
    storage.delete(PENDING_INVITE_STORAGE_KEY);
  }
  return pendingInvite;
};

/**
 * Efface l'invitation en attente.
 * @returns {void}
 */
export const clearPendingInvite = () => {
  storage.delete(PENDING_INVITE_STORAGE_KEY);
};
