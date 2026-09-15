/**
 * teamInviteShare.js — INVIT2 : fabriquer et envoyer le lien d'invitation d'équipe.
 *
 * AVANT : `https://<api>/install.html?type=team&id=…` — un détour par le navigateur
 * (le domaine de l'API ne sert pas ses fichiers de reconnaissance : 404 mesuré le
 * 15/09 en recette ET en production), sans invitant ni équipe dans la fenêtre.
 * APRÈS : `https://foundclub.app/i/team/<id>?c=<code>` — un domaine dont le
 * fichier iPhone réclame déjà `/i/*` (mesuré 200) : l'app s'ouvre directement
 * quand elle est installée, et le code permet de dire QUI invite.
 */
import { Linking, Platform } from 'react-native';

import { buildInviteWebUrl } from '@/domains/invitations/inviteLink';
import { buildTeamInviteShareText } from '@/domains/team/teamInviteSuggestions';

import { createTeamInviteLink } from '@/services/teamInvite/teamInviteService';

import { resolveShareEnvironment } from '@/utils/shareLinks';

import SharePlatform from '@/platform/share';

const PRODUCTION_INVITE_ORIGIN = 'https://foundclub.app';
const STAGING_INVITE_ORIGIN = 'https://staging.foundclub.app';

/**
 * Le site qui porte les liens : la production pour une build de production, la
 * recette sinon — le code n'existe que dans la base qui l'a créé.
 * @param {string} [appEnv] - l'environnement de la build.
 * @returns {string} l'origine.
 */
export const resolveInviteLinkOrigin = (appEnv) => (
  resolveShareEnvironment(appEnv) === 'production'
    ? PRODUCTION_INVITE_ORIGIN
    : STAGING_INVITE_ORIGIN
);

/**
 * Le lien d'invitation d'une équipe.
 * @param {{ appEnv?: string, code?: string, teamId: string }} params - l'équipe et son code.
 * @returns {string | null} le lien.
 */
export const buildTeamInviteUrl = ({ appEnv, code, teamId }) => buildInviteWebUrl({
  code,
  id: teamId,
  origin: resolveInviteLinkOrigin(appEnv),
  subject: 'team',
});

/**
 * Le texte complet : la phrase humaine, puis le lien.
 * @param {{ clubName?: string, inviterName?: string, teamName?: string, url: string }} params
 * - le contenu.
 * @returns {string} le message.
 */
export const buildTeamInviteMessage = ({
  clubName, inviterName, teamName, url,
}) => (
  `${buildTeamInviteShareText({ clubName, inviterName, teamName })}\n${url}`
);

/**
 * Prépare le lien du staff (code serveur) et ouvre la feuille de partage.
 * Sans réseau, le lien part SANS code : il ouvre toujours l'équipe, et la personne
 * pourra demander à la rejoindre.
 * @param {{ clubName?: string, inviterName?: string, teamId: string, teamName?: string }} params
 * - l'équipe.
 * @returns {Promise<{ code: string, url: string | null }>} ce qui a été partagé.
 */
export const shareTeamInviteLink = async ({
  clubName, inviterName, teamId, teamName,
}) => {
  let code = '';
  try {
    code = String((await createTeamInviteLink(teamId))?.code || '');
  } catch (_error) {
    code = '';
  }
  const url = buildTeamInviteUrl({ code, teamId });
  if (!url) return { code, url };

  await SharePlatform.share({
    message: buildTeamInviteMessage({
      clubName, inviterName, teamName, url,
    }),
    title: String(teamName || ''),
    url,
  }).catch(() => undefined);

  return { code, url };
};

/**
 * Repartage le lien d'une invitation EXISTANTE (son code), sans en créer une autre.
 * @param {{
 *   clubName?: string, code: string, inviterName?: string, teamId: string, teamName?: string
 * }} params - l'invitation.
 * @returns {Promise<string | null>} le lien partagé.
 */
export const shareExistingTeamInvite = async ({
  clubName, code, inviterName, teamId, teamName,
}) => {
  const url = buildTeamInviteUrl({ code, teamId });
  if (!url) return null;
  await SharePlatform.share({
    message: buildTeamInviteMessage({
      clubName, inviterName, teamName, url,
    }),
    title: String(teamName || ''),
    url,
  }).catch(() => undefined);
  return url;
};

/**
 * Ouvre l'application SMS avec le message et le lien, sinon la feuille de partage.
 * @param {{ message: string, phoneNumber: string, url: string }} params
 * - le destinataire et le texte.
 * @returns {Promise<void>} rien.
 */
export const openInviteSms = async ({ message, phoneNumber, url }) => {
  const separator = Platform.OS === 'ios' ? '&' : '?';
  const smsUrl = `sms:${String(phoneNumber || '').replace(/[^\d+]/g, '')}${separator}body=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(smsUrl);
  } catch (_error) {
    await SharePlatform.share({ message, url }).catch(() => undefined);
  }
};
