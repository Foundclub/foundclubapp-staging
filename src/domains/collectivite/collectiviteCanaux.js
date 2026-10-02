import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { getServerErrorCode } from '@/utils/errors/displayError';

/**
 * 🏛️ COLL-C4A2 (02/10/2026) — LES CANAUX DE LA VILLE DANS LA MESSAGERIE, en fonctions PURES.
 *
 * Deux types de fil, dont le SERVEUR calcule les membres (admin
 * `api/chat/services/collectivite-channels.ts`) :
 *   · `collectivite_dirigeants` (D72) — le canal des dirigeants : la Ville et les dirigeants de
 *     ses clubs rattachés. Tous se répondent. Épinglé en tête de la messagerie (il ne figure
 *     donc pas dans la liste des conversations) ;
 *   · `collectivite_club` (D73) — la conversation PRIVÉE entre la Ville et les dirigeants d'UN
 *     club. Côté Ville, elle se range dans « Conversations » ; côté club, elle porte le nom de la
 *     Ville.
 *
 * Design validé HY521H1 page 3 (P3c-canal-tel, P3v2-messages-tel). « Vous » pour la mairie,
 * « tu » pour le dirigeant. Chaque message dit qui écrit ET pour quel club : la signature est
 * écrite par le serveur, l'app ne fait que DEMANDER la voix de la Ville depuis l'espace de la
 * Ville.
 */

export const CANAL_DIRIGEANTS = 'collectivite_dirigeants';
export const CONVERSATION_CLUB = 'collectivite_club';
export const CODE_PLUS_DANS_LE_FIL = 'COLLECTIVITE_CANAL_NOT_MEMBER';

/**
 * Ce fil est-il un fil de la Ville (canal des dirigeants ou conversation privée) ?
 * @param {any} chat - Le fil.
 * @returns {boolean} Vrai pour les deux fils de la Ville.
 */
export const estFilDeLaVille = (chat) => (
  chat?.type === CANAL_DIRIGEANTS || chat?.type === CONVERSATION_CLUB
);

/**
 * Le titre d'un fil de la Ville (vide pour les autres fils).
 * @param {any} t - La traduction (i18next).
 * @param {{ chat: any, espaceVille?: boolean }} params - Le fil, et l'espace d'où on le lit.
 * @returns {string} « Dirigeants des clubs », le nom du club (côté Ville) ou de la Ville.
 */
export const titreDuFil = (t, { chat, espaceVille = false }) => {
  if (chat?.type === CANAL_DIRIGEANTS) {
    return t('collectiviteCanaux.titre', 'Dirigeants des clubs');
  }
  if (chat?.type === CONVERSATION_CLUB) {
    return String((espaceVille ? chat?.collectiviteClub?.name : chat?.collectivite?.name) || '');
  }
  return '';
};

/**
 * Le sous-titre de l'en-tête (planche P3c-canal-tel, écrans 1, 4 et 8).
 * @param {any} t - La traduction (i18next).
 * @param {{ chat: any, clubsCount?: number, espaceVille?: boolean }} params - Le fil.
 * @returns {string} La ligne sous le titre.
 */
export const sousTitreDuFil = (t, { chat, clubsCount = 0, espaceVille = false }) => {
  if (chat?.type === CANAL_DIRIGEANTS) {
    if (espaceVille) {
      return clubsCount === 1
        ? t('collectiviteCanaux.sousTitre.mairieUn', 'Vous et les dirigeants d’1 club')
        : t('collectiviteCanaux.sousTitre.mairie', 'Vous et les dirigeants des {{nombre}} clubs', {
          nombre: clubsCount,
        });
    }
    return clubsCount === 1
      ? t('collectiviteCanaux.sousTitre.dirigeantUn', '{{ville}} et 1 club', {
        ...SANS_ECHAPPEMENT,
        ville: chat?.collectivite?.name || '',
      })
      : t('collectiviteCanaux.sousTitre.dirigeant', '{{ville}} et {{nombre}} clubs', {
        ...SANS_ECHAPPEMENT,
        nombre: clubsCount,
        ville: chat?.collectivite?.name || '',
      });
  }
  if (chat?.type === CONVERSATION_CLUB) {
    return espaceVille
      ? t('collectiviteCanaux.sousTitre.priveeMairie', 'Vous et les dirigeants du club')
      : t('collectiviteCanaux.sousTitre.priveeClub', 'Conversation privée avec la Ville');
  }
  return '';
};

/**
 * Qui écrit, et pour qui : « Ville de Montrivage · Karim B. » ou « Karim Benali · AS
 * Montrivage ». Null hors d'un fil de la Ville (le message n'a pas de signature).
 * @param {any} t - La traduction (i18next).
 * @param {any} message - Le message, avec `sender` et `senderSignature`.
 * @returns {string | null} L'étiquette de l'expéditeur.
 */
export const signatureDuMessage = (t, message) => {
  const signature = message?.senderSignature;
  if (!signature || typeof signature !== 'object' || !signature.voix) return null;
  const prenom = String(message?.sender?.firstname || '').trim();
  const nom = String(message?.sender?.lastname || '').trim();
  if (signature.voix === 'ville') {
    return t('collectiviteCanaux.signature.ville', '{{ville}} · {{prenom}} {{initiale}}', {
      initiale: nom ? `${nom.charAt(0)}.` : '',
      ...SANS_ECHAPPEMENT,
      prenom,
      ville: String(signature.nom || ''),
    }).trim();
  }
  return t('collectiviteCanaux.signature.club', '{{prenom}} {{nom}} · {{club}}', {
    club: String(signature.nom || ''),
    ...SANS_ECHAPPEMENT,
    nom,
    prenom,
  }).replace(/\s+·/, ' ·').trim();
};

/**
 * Le texte du champ d'écriture, ou null hors d'un fil de la Ville.
 * @param {any} t - La traduction (i18next).
 * @param {{ chat: any, espaceVille?: boolean }} params - Le fil, et l'espace d'où on écrit.
 * @returns {string | null} Le texte d'invite.
 */
export const placeholderDuFil = (t, { chat, espaceVille = false }) => {
  if (chat?.type === CANAL_DIRIGEANTS) {
    return espaceVille
      ? t('collectiviteCanaux.ecrire.mairie', 'Écrire aux dirigeants…')
      : t('collectiviteCanaux.ecrire.dirigeant', 'Écris aux autres dirigeants…');
  }
  if (chat?.type === CONVERSATION_CLUB) {
    return espaceVille
      ? t('collectiviteCanaux.ecrire.priveeMairie', 'Écrire à {{club}}…', {
        club: chat?.collectiviteClub?.name || '',
        ...SANS_ECHAPPEMENT,
      })
      : t('collectiviteCanaux.ecrire.priveeClub', 'Écris à la Ville…');
  }
  return null;
};

/**
 * Ce que l'app ajoute à un message pour DEMANDER la voix de la Ville : seulement dans un fil de
 * la Ville, et seulement depuis l'espace de la Ville. Le serveur décide (un dirigeant qui la
 * demande ne l'obtient pas).
 * @param {{ chat: any, espaceVille?: boolean }} params - Le fil, et l'espace d'où on écrit.
 * @returns {{ senderSignature?: { voix: 'ville' } }} Le complément du message.
 */
export const voixDuFil = ({ chat, espaceVille = false }) => (
  estFilDeLaVille(chat) && espaceVille ? { senderSignature: { voix: 'ville' } } : {}
);

/**
 * La liste des conversations, une fois les fils de la Ville rangés :
 *   · le canal des dirigeants n'y figure jamais (il est épinglé en tête) ;
 *   · dans l'espace de la Ville, seules SES conversations privées avec ses clubs ;
 *   · côté club, la conversation privée de SON club seulement (un compte mixte ne voit pas, côté
 *     club, les conversations de la Ville avec les autres clubs).
 * @param {any[]} chats - Les fils, dans l'ordre de la liste.
 * @param {{ collectiviteId?: string | null, espaceVille?: boolean,
 *   monClubId?: string | null }} params - La Ville de l'espace, et le club du compte.
 * @returns {any[]} Les fils à afficher, dans le même ordre.
 */
export const filsDeLaMessagerie = (chats, {
  collectiviteId = null, espaceVille = false, monClubId = null,
}) => {
  const liste = Array.isArray(chats) ? chats : [];
  if (espaceVille) {
    return liste.filter((chat) => chat?.type === CONVERSATION_CLUB
      && (!collectiviteId || chat?.collectivite?.documentId === collectiviteId));
  }
  return liste.filter((chat) => {
    if (chat?.type === CANAL_DIRIGEANTS) return false;
    if (chat?.type === CONVERSATION_CLUB) {
      return Boolean(monClubId) && chat?.collectiviteClub?.documentId === monClubId;
    }
    return true;
  });
};

/**
 * Le serveur a-t-il répondu « tu ne fais plus partie de ce fil » (club détaché, dirigeant parti) ?
 * @param {unknown} error - L'erreur de la requête.
 * @returns {boolean} Vrai pour ce refus-là, et lui seul.
 */
export const estRefusDuFilDeLaVille = (error) => (
  getServerErrorCode(error) === CODE_PLUS_DANS_LE_FIL
);
