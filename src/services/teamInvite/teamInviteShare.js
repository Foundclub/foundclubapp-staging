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
import {
  AppState, Linking, Platform, Share,
} from 'react-native';

import { emitGuidanceAction, emitGuidanceInteraction } from '@/domains/guidance/guidanceRuntime';
import { buildInviteWebUrl } from '@/domains/invitations/inviteLink';
import { buildTeamInviteShareText } from '@/domains/team/teamInviteSuggestions';

import { createTeamInviteLink } from '@/services/teamInvite/teamInviteService';

import { resolveShareEnvironment } from '@/utils/shareLinks';

import SharePlatform from '@/platform/share';
import { isDesktopWeb } from '@/responsive/isDesktopWeb';

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
 * T3-LIEN-TOURNOI (04/11) — partage le lien d'un tournoi privé : celui de cette version, car la
 * recette ne connaît pas les tournois de la prod.
 * @param {string} eventId - Le tournoi.
 * @returns {Promise<any>} Ce que le partage a fait ; rien s'il est abandonné ou impossible.
 */
export const shareTournamentInviteLink = async (eventId) => {
  const url = buildInviteWebUrl({
    id: eventId,
    origin: resolveInviteLinkOrigin(),
    subject: 'tournament',
  });
  if (!url) return undefined;
  return SharePlatform.share({ message: url, url }).catch(() => undefined);
};

/** @type {{ remove: () => void } | null} */
let pendingReturn = null;

/**
 * GUIDE-E-CORR (TG-14, tournée du 07/11) : sur Android, `Share.share` rend la main dès
 * l'ouverture du sélecteur (ShareModule.kt), et `openURL` dès l'ouverture de l'app SMS : la
 * question « Tu l'as envoyé ? » s'affichait feuille encore ouverte. Le signal attend que l'app
 * soit passée hors du premier plan, puis revenue. Un nouveau partage remplace l'attente en cours.
 * ponytail: une app qui ne quitte jamais le premier plan n'envoie aucun signal ; la bulle du
 * guide garde alors son bouton « Continuer », qui mène à la même question.
 * @param {() => void} callback - Ce qui part au retour dans l'app.
 * @returns {void}
 */
const whenBackInApp = (callback) => {
  pendingReturn?.remove();
  let hasLeft = AppState.currentState !== 'active';
  const subscription = AppState.addEventListener('change', (state) => {
    if (state !== 'active') {
      hasLeft = true;
      return;
    }
    if (!hasLeft) return;
    subscription.remove();
    if (pendingReturn === subscription) pendingReturn = null;
    callback();
  });
  pendingReturn = subscription;
};

/**
 * Guide Entraîneur (TUTOE, M2) : ce que la feuille de partage a rendu, plateforme par plateforme.
 * - Android : rien de sûr (toujours « partagé », dès l'ouverture) : le guide demande, au retour.
 * - iPhone : « partagé » = envoi certain ; « annulé » = feuille fermée sans choisir d'app. Une app
 *   choisie puis abandonnée ne rend rien (RCTActionSheetManager) : pas de signal du tout.
 * - Site : navigator.share rend un envoi ; l'abandon lève une erreur (rattrapée : `undefined`) ;
 *   « copie » veut dire lien copié, pas envoyé.
 * Ce qui n'est ni un envoi certain ni un « annulé » de la plateforme : le guide demande.
 * @param {{ action?: string } | undefined} result - Le retour de la feuille.
 * @param {string} teamId - L'équipe.
 * @returns {void}
 */
const signalShareResult = (result, teamId) => {
  if (Platform.OS === 'android') {
    whenBackInApp(() => emitGuidanceInteraction('team.invite.returned', { teamId }));
  } else if (result?.action === Share.dismissedAction) {
    emitGuidanceInteraction('team.invite.dismissed');
  } else if (!result || result.action === 'copie') {
    emitGuidanceInteraction('team.invite.returned', { teamId });
  } else {
    emitGuidanceAction('team.invite.shared', { teamId });
  }
};

/**
 * GUIDES-SITE-CORR-2 (M1096, testeur 10/11, Windows + Chrome) : sur un ordinateur,
 * `navigator.share` ouvrait la fenêtre Partager de Windows, impossible à fermer, et rendait la main
 * comme un envoi : le guide passait à la mission 3 sans rien d'envoyé. Sur le site, à la largeur
 * d'un ordinateur (comme `useIsDesktop`), le lien est COPIÉ et l'écran le dit ; le site sur un
 * téléphone et l'application gardent la feuille de partage du système.
 * ponytail: la largeur de la fenêtre dit « ordinateur » ; une tablette large copie aussi, ce qui
 * reste juste (elle sait coller).
 * @param {{ message: string, title: string, url: string }} payload - Ce qui part.
 * @returns {Promise<{ envoi: '' | 'copie' | 'echec', result: any }>} Ce qui s'est passé.
 */
const envoyerLeLien = async (payload) => {
  if (isDesktopWeb()) {
    const copie = await SharePlatform.copier(payload.message);
    // « copie » : le guide demande « Tu l'as envoyé ? » (signalShareResult), il ne valide rien.
    return { envoi: copie ? 'copie' : 'echec', result: copie ? { action: 'copie' } : undefined };
  }
  const result = await SharePlatform.share(payload).catch(() => undefined);
  return { envoi: '', result };
};

/**
 * Prépare le lien du staff (code serveur) et ouvre la feuille de partage.
 * Sans réseau, le lien part SANS code : il ouvre toujours l'équipe, et la personne
 * pourra demander à la rejoindre.
 * @param {{ clubName?: string, inviterName?: string, teamId: string, teamName?: string }} params
 * - l'équipe.
 * @returns {Promise<{ code: string, envoi?: '' | 'copie' | 'echec', url: string | null }>} ce qui
 * a été partagé ; `envoi` : copié sur un ordinateur (M1096), ou la copie a échoué.
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

  const { envoi, result } = await envoyerLeLien({
    message: buildTeamInviteMessage({
      clubName, inviterName, teamName, url,
    }),
    title: String(teamName || ''),
    url,
  });
  signalShareResult(result, teamId);

  return { code, envoi, url };
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
  const { result } = await envoyerLeLien({
    message: buildTeamInviteMessage({
      clubName, inviterName, teamName, url,
    }),
    title: String(teamName || ''),
    url,
  });
  // FIN-GUIDE, point 4 : ce repartage ne disait rien au guide, resté sur « Envoie-le ».
  signalShareResult(result, teamId);
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
  // FIN-GUIDE, point 4 : l'app ne sait pas si le SMS est parti ; le guide demande, au retour
  // de l'app SMS (GUIDE-E-CORR, TG-14).
  if (Platform.OS === 'web') {
    emitGuidanceInteraction('team.invite.returned');
  } else {
    whenBackInApp(() => emitGuidanceInteraction('team.invite.returned'));
  }
};
