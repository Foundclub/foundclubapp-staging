import { computeAge } from '@/domains/playerCard/cardModel';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { RouteNames } from '@/navigation/routeNames';

import { getServerErrorCode } from '@/utils/errors/displayError';

/**
 * 🏛️ COLL-C4A2 (02/10/2026) — LES CANAUX DE LA VILLE DANS LA MESSAGERIE, en fonctions PURES.
 *
 * Deux types de fil, dont le SERVEUR calcule les membres (admin
 * `api/chat/services/collectivite-channels.ts`) :
 *   · `collectivite_dirigeants` (D72) — le canal des dirigeants : la Ville et les dirigeants de
 *     ses clubs rattachés. Tous se répondent. Une ligne de la liste comme les autres, côté
 *     Ville comme côté club (R17-CANAUX, 19/10 : plus de carte épinglée) ;
 *   · `collectivite_club` (D73) — la conversation PRIVÉE entre la Ville et les dirigeants d'UN
 *     club. Côté Ville, elle se range dans « Conversations » ; côté club, elle porte le nom de la
 *     Ville.
 *
 *   · `collectivite_ville` (R17-CANAUX, 19/10, REC17-004) — « Toute la ville » : les lecteurs
 *     MAJEURS des actualités de la Ville (décision d'Adel « B » du 19/10, le serveur en décide) le
 *     lisent (une ligne en tête de leur liste), seule la Ville y
 *     écrit, et personne n'y voit qui le lit (un NOMBRE de clubs). Ses actualités « membres »
 *     y arrivent seules, en lignes de la Ville qui mènent à l'actualité.
 *
 *   · `collectivite_conversation` (MSG-VILLE-NOUVELLE, 20/10, REC17-004 ter) — la conversation que
 *     la Ville OUVRE avec qui elle veut (« Nouvelle conversation » : membres majeurs de ses clubs,
 *     ses autres gestionnaires ; décisions d'Adel « 1- B » / « 2- A »). Tête-à-tête ou groupe :
 *     côté Ville, il porte le nom de la personne (ou du groupe) ; côté membre, celui de la Ville.
 *
 * Design validé HY521H1 page 3 (P3c-canal-tel, P3v2-messages-tel). « Vous » pour la mairie,
 * « tu » pour le dirigeant. Chaque message dit qui écrit ET pour quel club : la signature est
 * écrite par le serveur, l'app ne fait que DEMANDER la voix de la Ville depuis l'espace de la
 * Ville.
 */

export const CANAL_DIRIGEANTS = 'collectivite_dirigeants';
export const CONVERSATION_CLUB = 'collectivite_club';
export const CANAL_VILLE = 'collectivite_ville';
/** MSG-VILLE-NOUVELLE — la conversation ouverte par la Ville (tête-à-tête ou groupe). */
export const CONVERSATION_LIBRE = 'collectivite_conversation';
export const CODE_PLUS_DANS_LE_FIL = 'COLLECTIVITE_CANAL_NOT_MEMBER';
/** R17-CANAUX — la notice d'une actualité posée par la Ville dans son canal (admin). */
export const NOTICE_ACTUALITE = 'collectivite_actualite';

/**
 * Ce fil est-il un fil de la Ville (canal des dirigeants, conversation privée, « Toute la
 * ville ») ?
 * @param {any} chat - Le fil.
 * @returns {boolean} Vrai pour les trois fils de la Ville.
 */
export const estFilDeLaVille = (chat) => (
  chat?.type === CANAL_DIRIGEANTS || chat?.type === CONVERSATION_CLUB || chat?.type === CANAL_VILLE
  || chat?.type === CONVERSATION_LIBRE
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
  // R17-CANAUX — la Ville sait de quelle ville il s'agit ; un membre peut en lire plusieurs.
  if (chat?.type === CANAL_VILLE) {
    return espaceVille
      ? t('collectiviteCanaux.ville.titre', 'Toute la ville')
      : t('collectiviteCanaux.ville.titreMembre', 'Toute la ville · {{ville}}', {
        ...SANS_ECHAPPEMENT,
        ville: chat?.collectivite?.name || '',
      });
  }
  if (chat?.type === CONVERSATION_CLUB) {
    return String((espaceVille ? chat?.collectiviteClub?.name : chat?.collectivite?.name) || '');
  }
  // MSG-VILLE-NOUVELLE — un groupe porte son nom ; un tête-à-tête porte, côté membre, le nom de
  // la Ville, et côté Ville le nom de la personne (vide ici : `getConversationName` le dit).
  if (chat?.type === CONVERSATION_LIBRE) {
    const nomDuGroupe = String(chat?.groupName || '').trim();
    if (nomDuGroupe || espaceVille) return nomDuGroupe;
    return String(chat?.collectivite?.name || '');
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
  // R17-CANAUX — un NOMBRE, jamais une personne (le serveur ne rend que lui).
  if (chat?.type === CANAL_VILLE) {
    return clubsCount === 1
      ? t('collectiviteCanaux.ville.sousTitreUn', 'Lu par les membres d’1 club')
      : t('collectiviteCanaux.ville.sousTitre', 'Lu par les membres des {{nombre}} clubs', {
        nombre: clubsCount,
      });
  }
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
  // MSG-VILLE-NOUVELLE — côté membre, d'où vient la conversation ; côté Ville, qui la lit.
  if (chat?.type === CONVERSATION_LIBRE) {
    return espaceVille
      ? t('collectiviteCanaux.libre.sousTitreMairie', 'Seules les personnes choisies la lisent')
      : t('collectiviteCanaux.libre.sousTitreMembre', 'Conversation avec {{ville}}', {
        ...SANS_ECHAPPEMENT,
        ville: chat?.collectivite?.name || '',
      });
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
  if (chat?.type === CANAL_VILLE) {
    return t('collectiviteCanaux.ville.ecrire', 'Écrire à toute la ville…');
  }
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
 * R17-CANAUX — qui écrit dans un fil de la Ville : tous ses membres, sauf dans « Toute la ville »
 * où seule la Ville écrit — depuis son espace, ou quand le serveur le dit (`membres.peutEcrire` :
 * un compte mixte qui l'ouvre depuis son club). Le serveur refuse de toute façon un membre
 * (COLLECTIVITE_CANAL_READ_ONLY) : ceci ne fait que montrer, ou non, la saisie.
 * @param {{ chat: any, espaceVille?: boolean, membres?: any }} params - Le fil, l'espace, la
 *   réponse « qui est dans ce canal ».
 * @returns {boolean} Vrai si la saisie doit être offerte (faux hors d'un fil de la Ville).
 */
export const peutEcrireDansLeFil = ({ chat, espaceVille = false, membres = null }) => {
  if (chat?.type === CANAL_VILLE) return Boolean(espaceVille) || membres?.peutEcrire === true;
  return estFilDeLaVille(chat);
};

/**
 * R17-CANAUX — une actualité posée par la Ville dans son canal : où elle mène. Le membre ouvre le
 * canal des actualités de sa Ville (l'écran de la notification d'actualité) ; la Ville, sa liste.
 * @param {{ espaceVille?: boolean, message: any }} params - La ligne, et l'espace d'où on lit.
 * @returns {{ name: string, params: Record<string, string> } | null} La route, ou null.
 */
export const routeDeLaLigne = ({ espaceVille = false, message }) => {
  const notice = message?.systemNotice;
  if (notice?.kind !== NOTICE_ACTUALITE) return null;
  const collectiviteId = String(notice?.collectivite?.documentId || '');
  const actualiteId = String(notice?.actualite?.documentId || '');
  if (!collectiviteId || !actualiteId) return null;
  return espaceVille
    ? { name: RouteNames.CollectiviteActualites, params: { collectiviteId } }
    : { name: RouteNames.CollectiviteActualitesCanal, params: { actualiteId, collectiviteId } };
};

/**
 * R17-CANAUX — la phrase d'une ligne d'actualité, traduite ; toute autre ligne garde sa phrase.
 * @param {any} t - La traduction (i18next).
 * @param {any} message - La ligne.
 * @returns {string} La phrase.
 */
export const texteDeLaLigne = (t, message) => {
  const notice = message?.systemNotice;
  if (notice?.kind !== NOTICE_ACTUALITE) return String(message?.message || '');
  return t('collectiviteCanaux.ville.actualite', 'Nouvelle actualité de la Ville : « {{titre}} »', {
    ...SANS_ECHAPPEMENT,
    titre: String(notice?.actualite?.title || ''),
  });
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
 * R17-CANAUX — un mineur CONNU (moins de 18 ans, date de naissance renseignée).
 * @param {any} user - Le compte.
 * @returns {boolean} Vrai s'il a moins de 18 ans.
 */
export const estMineurConnu = (user) => {
  const age = computeAge(user?.birthdate);
  return age !== null && age < 18;
};

/**
 * La liste des conversations, une fois les fils de la Ville rangés :
 *   · dans l'espace de la Ville, SES fils seulement : son canal des dirigeants, « Toute la
 *     ville » et ses conversations privées avec ses clubs ;
 *   · côté club, le canal des dirigeants et « Toute la ville » sont des lignes comme les autres
 *     (R17-CANAUX, 19/10, correction 2 du chef : plus de bloc épinglé au-dessus de la liste) ;
 *     « Toute la ville » jamais pour un mineur connu (décision d'Adel « B » : le serveur ne le
 *     lui envoie pas ; l'app ne montre pas non plus une liste d'avant gardée en cache) ;
 *   · côté club, la conversation privée de SON club seulement (un compte mixte ne voit pas, côté
 *     club, les conversations de la Ville avec les autres clubs).
 * @param {any[]} chats - Les fils, dans l'ordre de la liste.
 * @param {{ collectiviteId?: string | null, espaceVille?: boolean, mineur?: boolean,
 *   monClubId?: string | null }} params - La Ville de l'espace, le compte mineur ou non, et
 *   le club du compte.
 * @returns {any[]} Les fils à afficher, dans le même ordre.
 */
export const filsDeLaMessagerie = (chats, {
  collectiviteId = null, espaceVille = false, mineur = false, monClubId = null,
}) => {
  const liste = Array.isArray(chats) ? chats : [];
  if (espaceVille) {
    return liste.filter((chat) => estFilDeLaVille(chat)
      && (!collectiviteId || chat?.collectivite?.documentId === collectiviteId));
  }
  return liste.filter((chat) => {
    if (chat?.type === CANAL_VILLE) return !mineur;
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
