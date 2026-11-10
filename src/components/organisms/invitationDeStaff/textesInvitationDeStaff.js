/**
 * INVITE-STAFF (10/11/2026, maquette validée) — les phrases de l'invitation de staff, en un
 * seul endroit : la cloche, la feuille « Accepter ou refuser » et la bienvenue les partagent.
 */
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

/**
 * @typedef {{
 *   clubName?: string, documentId?: string, expiresAt?: string, inviterName?: string,
 *   role?: string, teamName?: string,
 * }} InvitationDeStaff
 */

/**
 * Le JJ/MM d'une échéance, ou une chaîne vide.
 * @param {string | undefined} iso - la date ISO.
 * @returns {string} la date courte.
 */
export const dateCourte = (iso) => {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
};

/**
 * « FC Lyon Est t'invite comme coach de l'équipe U13 A ».
 * @param {import('i18next').TFunction} t - la traduction.
 * @param {InvitationDeStaff} invitation - l'invitation.
 * @returns {string} la phrase.
 */
export const phraseDInvitation = (t, invitation) => {
  const valeurs = { club: invitation?.clubName || '', team: invitation?.teamName || '', ...SANS_ECHAPPEMENT };
  if (invitation?.role === 'dirigeant') return t('staffInvitation.received.dirigeant', valeurs);
  return invitation?.teamName
    ? t('staffInvitation.received.coachOf', valeurs)
    : t('staffInvitation.received.coach', valeurs);
};

/**
 * Ce qui change si la personne accepte, une ligne par effet.
 * @param {import('i18next').TFunction} t - la traduction.
 * @param {InvitationDeStaff} invitation - l'invitation.
 * @returns {string[]} les lignes.
 */
export const effetsDeLAcceptation = (t, invitation) => {
  const valeurs = { club: invitation?.clubName || '', team: invitation?.teamName || '', ...SANS_ECHAPPEMENT };
  let role = t('staffInvitation.sheet.becomeCoach', valeurs);
  if (invitation?.role === 'dirigeant') role = t('staffInvitation.sheet.becomeDirigeant', valeurs);
  else if (invitation?.teamName) role = t('staffInvitation.sheet.becomeCoachOf', valeurs);
  return [
    t('staffInvitation.sheet.joinClub', valeurs),
    role,
    t('staffInvitation.sheet.teamsStay'),
  ];
};

/**
 * Le titre et le texte d'un refus serveur (H) : mineur, périmée, club complet, compte protégé.
 * @param {import('i18next').TFunction} t - la traduction.
 * @param {string} code - le code `STAFF_INVITE_*`.
 * @returns {{ texte: string, titre: string }} le message.
 */
export const messageDeRefusServeur = (t, code) => {
  if (code === 'STAFF_INVITE_MINOR') {
    return { texte: t('staffInvitation.errors.minorText'), titre: t('staffInvitation.errors.minorTitle') };
  }
  if (code === 'STAFF_INVITE_CLUB_FULL') {
    return { texte: t('staffInvitation.errors.fullText'), titre: t('staffInvitation.errors.fullTitle') };
  }
  if (code === 'STAFF_INVITE_PROTECTED_ACCOUNT') {
    return { texte: t('staffInvitation.errors.protectedText'), titre: t('staffInvitation.errors.protectedTitle') };
  }
  return { texte: t('staffInvitation.errors.expiredText'), titre: t('staffInvitation.errors.expiredTitle') };
};
