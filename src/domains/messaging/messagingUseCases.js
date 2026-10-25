import i18next from 'i18next';

import { storage } from '@/store/appContext';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import {
  getDocumentPreviewText,
  isDocumentAttachment,
} from '@/utils/documentAttachment';

/**
 * Get the storage key for the last read message timestamp of a chat
 * @param {string} chatId - The chat ID
 * @returns {string} The storage key
 */
export const getLastReadMessageKey = (/** @type {string} */ chatId) => `chat_${chatId}_last_read`;

/**
 * Check if a chat has unread messages
 * @param {string} chatId - The chat ID
 * @param {string} lastMessageTimestamp - The timestamp of the last message
 * @returns {boolean} - Whether the chat has unread messages
 */
export const getUnreadStatus = (
  /** @type {string} */ chatId,
  /** @type {string} */ lastMessageTimestamp,
) => {
  const lastReadTimestamp = storage.getString(getLastReadMessageKey(chatId));
  if (!lastReadTimestamp) return true;
  return new Date(lastMessageTimestamp) > new Date(lastReadTimestamp);
};

/**
 * Checks whether a chat belongs to FoundClub League.
 * @param {Chat | null | undefined | Record<string, any>} chat
 * @returns {boolean}
 */
export const isLeagueChat = (chat) => {
  if (!chat || typeof chat !== 'object') return false;

  const chatType = String(chat.type || '').trim().toLowerCase();
  if (chatType === 'league_match' || chatType === 'league') return true;

  return Boolean(chat.league_match);
};

/**
 * ARCHIVEES (08/10) — ce fil est-il archive PAR MOI ? `archivedBy` porte tous ceux qui l ont
 * archive : celui d un autre membre ne le retire pas de MA liste. Une seule regle pour la liste
 * du telephone et la colonne « Messages » du site.
 * @param {Chat | null | undefined | Record<string, any>} chat
 * @param {string | null | undefined} meId
 * @returns {boolean}
 */
export const estArchivePourMoi = (chat, meId) => {
  const archivePar = chat?.archivedBy;
  return Boolean(meId)
    && Array.isArray(archivePar)
    && archivePar.some((/** @type {any} */ u) => u?.documentId === meId);
};

/**
 * Ce fil est-il epingle PAR MOI (`pinnedBy`) ?
 * @param {Chat | null | undefined | Record<string, any>} chat
 * @param {string | null | undefined} meId
 * @returns {boolean}
 */
export const estEpinglePourMoi = (chat, meId) => {
  const epinglePar = chat?.pinnedBy;
  return Boolean(meId) && Array.isArray(epinglePar)
    && epinglePar.some((/** @type {any} */ u) => u?.documentId === meId);
};

/**
 * Date de creation d un message ; les dates absentes/invalides viennent apres les dates connues.
 * @param {any} message - Le message.
 * @returns {number} Son horodatage, ou moins l infini.
 */
const dateDuMessage = (message) => {
  if (!message?.createdAt) return Number.NEGATIVE_INFINITY;
  const date = new Date(message.createdAt).getTime();
  return Number.isFinite(date) ? date : Number.NEGATIVE_INFINITY;
};

/**
 * IPH09 (09/10, regle d Adel) — mes epingles, puis le canal du club restent en tete.
 * R17-CANAUX (19/10, REC17-004) — « Toute la ville » (`collectivite_ville`) s affiche en tete de
 * la liste : apres mes epingles, avant le canal du club.
 * Tous les autres types se melangent par DERNIER MESSAGE, jamais par `chat.updatedAt`
 * (renommage, lecture, adhesion). Les ex aequo et fils sans date gardent l ordre recu.
 * Regle partagee par Messaging.js et la colonne de Conversation.web.js.
 * @param {any[]} chats - Les fils.
 * @param {string | null | undefined} meId - Moi.
 * @returns {any[]} Une copie triee, sans modifier les fils.
 */
export const trierLesFils = (chats, meId) => [...(Array.isArray(chats) ? chats : [])]
  .sort((a, b) => {
    const epingleA = estEpinglePourMoi(a, meId);
    const epingleB = estEpinglePourMoi(b, meId);
    if (epingleA !== epingleB) return epingleA ? -1 : 1;
    const villeA = a?.type === 'collectivite_ville';
    const villeB = b?.type === 'collectivite_ville';
    if (villeA !== villeB) return villeA ? -1 : 1;
    const clubA = a?.type === 'club';
    const clubB = b?.type === 'club';
    if (clubA !== clubB) return clubA ? -1 : 1;
    const dateA = dateDuMessage(getChatLastMessage(a));
    const dateB = dateDuMessage(getChatLastMessage(b));
    if (dateA === dateB) return 0;
    return dateA > dateB ? -1 : 1;
  });

/**
 * SMF (T20) — CE QUE MONTRE LA LISTE : la portee « Toutes / Classique / League », puis la
 * recherche sur le nom du fil. Meme regle au telephone et dans la colonne du site.
 * @param {any[]} chats - Les fils deja tries.
 * @param {{ nomDuFil: (chat: any) => string, portee?: string, recherche?: string }} options -
 *   Le nom affiche d un fil, la portee choisie, le texte cherche.
 * @returns {any[]} Les fils a afficher, dans le meme ordre.
 */
export const filtrerLesFils = (chats, { nomDuFil, portee = 'all', recherche = '' }) => {
  const parPortee = (Array.isArray(chats) ? chats : []).filter((chat) => {
    if (portee === 'league') return isLeagueChat(chat);
    if (portee === 'classic') return !isLeagueChat(chat);
    return true;
  });
  if (!recherche) return parPortee;
  const cherche = recherche.toLowerCase();
  return parPortee.filter((chat) => Boolean(nomDuFil(chat)?.toLowerCase()?.includes(cherche)));
};

/**
 * Checks whether a chat is the thread opened by a friendly match proposal.
 *
 * Le serveur ouvre ce fil au moment de la candidature pour que les DEUX staffs
 * conviennent des modalites (friendly-match-workflow.ts, `applyToAd`), et il en
 * autorise l ecriture : `ensureUserCanWriteInChat` ne restreint que `club` et
 * `multisport`. L app, elle, l avait oublie de sa liste d ecriture — le fil
 * s ouvrait donc en « lecture seule », ce qui contredisait tout ce que l ecran
 * promet. Le type est la SEULE marque disponible : contrairement a
 * `league_match`, le schema du chat n a pas de relation vers la candidature.
 * @param {Chat | null | undefined | Record<string, any>} chat
 * @returns {boolean}
 */
export const isFriendlyMatchChat = (chat) => {
  if (!chat || typeof chat !== 'object') return false;

  return String(chat.type || '').trim().toLowerCase() === 'friendly_match';
};

/**
 * Conversation name generator
 * @param {object} params - Parameters for generating the conversation name
 * @param {Club} [params.chatClub] - The chat club object
 * @param {string} [params.chatGroupName] - Group chat display name
 * @param {MultisportClubRef} [params.chatMultisportClub] - The multisport club object
 * @param {User[]} [params.chatParticipants] - Array of chat participants
 * @param {Team} [params.chatTeam] - The chat team object
 * @param {LeagueMatch} [params.chatLeagueMatch] - League match linked to chat
 * @param {string} params.chatType - The type of chat (e.g., 'club', 'team', 'whisper')
 * @param {string} [params.meId] - The ID of the current user
 * @returns {string} The generated conversation name
 */
export const getConversationName = ({
  chatClub, chatGroupName, chatLeagueMatch, chatMultisportClub, chatParticipants, chatTeam, chatType, meId,
}) => {
  switch (chatType) {
    // MSG-SUPPORT (20/10) — la conversation avec l'équipe FoundClub (épinglée en tête de Messages).
    case 'assistance':
      return i18next.t('assistance.titre', 'Assistance FoundClub');
    case 'club':
      return chatClub?.name || '';
    // MSG-VILLE-NOUVELLE (20/10) — la conversation ouverte par la Ville : son nom de groupe, ou,
    // pour un tête-à-tête, la personne d'en face (le nom de la Ville côté membre : titreDuFil).
    case 'collectivite_conversation': {
      if (String(chatGroupName || '').trim()) return String(chatGroupName).trim();
      const enFace = chatParticipants?.find((p) => p.documentId !== meId) || chatParticipants?.[0];
      return `${enFace?.firstname || ''} ${enFace?.lastname || ''}`.trim();
    }
    // COLL-C4A2 (02/10) — le canal des dirigeants de la Ville (D72). La conversation privee
    // Ville <-> club (D73) se nomme par collectiviteCanaux.titreDuFil (qui sait de quel cote).
    case 'collectivite_dirigeants':
      return i18next.t('collectiviteCanaux.titre', 'Dirigeants des clubs');
    // R17-CANAUX (19/10) — « Toute la ville » ; titreDuFil y ajoute le nom de la Ville.
    case 'collectivite_ville':
      return i18next.t('collectiviteCanaux.ville.titre', 'Toute la ville');
    case 'friendly_match':
      // Le serveur pose deja « Match amical : A vs B » dans groupName
      // (friendly-match-workflow.ts:279). Sans ce cas, le `default` rendait ''
      // et le fil s affichait sans titre dans la liste de messagerie.
      return chatGroupName || i18next.t(
        'messagingUseCases.conversationName.friendlyMatch',
        'Match amical',
      );
    case 'group':
      return chatGroupName || i18next.t('messagingUseCases.conversationName.group', 'Groupe');
    case 'league_match':
      if (chatLeagueMatch) {
        const date = chatLeagueMatch.date
          ? new Date(chatLeagueMatch.date).toLocaleDateString(localeDesFormats(), {
            day: '2-digit',
            month: '2-digit',
          })
          : '';
        return date
          ? i18next.t(
            'messagingUseCases.conversationName.leagueMatchOn',
            'Match du {{date}}',
            { date, ...SANS_ECHAPPEMENT },
          )
          : i18next.t('messagingUseCases.conversationName.leagueMatch', 'Match de Ligue');
      }
      return i18next.t('messagingUseCases.conversationName.leagueMatch', 'Match de Ligue');
    case 'multisport':
      return chatMultisportClub?.name || '';
    case 'team':
      return chatTeam?.name || '';
    case 'whisper': {
      const participant = chatParticipants?.find(
        (p) => p.documentId !== meId,
      ) || chatParticipants?.[0];
      return `${participant?.firstname || ''} ${participant?.lastname || ''}`.trim();
    }
    default:
      return '';
  }
};

/**
 * Repli de traduction : les fonctions ci-dessous restent pures et testables
 * sans i18n. Les ecrans passent `t`, les tests non.
 * @param {string} _key
 * @param {string} fallback
 * @returns {string}
 */
const defaultTranslate = (_key, fallback) => fallback;

/**
 * Remplace les jetons `{{nom}}` d un libelle traduit.
 * @param {string} template
 * @param {Record<string, string>} values
 * @returns {string}
 */
const fillTemplate = (template, values) => String(template || '').replace(
  /\{\{(\w+)\}\}/g,
  (match, key) => (values?.[key] === undefined ? match : String(values[key])),
);

/**
 * Le dernier message d une conversation, choisi sur sa DATE.
 *
 * AC05 — la liste lisait `chat.messages[0]`, donc elle supposait un ordre.
 * Aujourd hui le serveur ne renvoie qu un seul element (il le fabrique depuis
 * la colonne `latestMessageSnapshot`, chat.ts:559), mais rien dans le contrat
 * ne le garantit : le jour ou la liste peuplera vraiment `messages`, `[0]`
 * montrerait le message le PLUS ANCIEN. On compare les dates, une fois.
 * @param {Chat | null | undefined | Record<string, any>} chat
 * @returns {ChatMessage | null}
 */
export const getChatLastMessage = (chat) => {
  const messages = Array.isArray(chat?.messages) ? chat.messages : [];
  if (messages.length === 0) return null;

  return messages.reduce((latest, message) => {
    if (!message) return latest;
    if (!latest) return message;
    const latestTime = dateDuMessage(latest);
    const messageTime = dateDuMessage(message);
    return messageTime > latestTime ? message : latest;
  }, /** @type {any} */ (null)) || null;
};

/**
 * L heure d un message quand il date du jour, sa date sinon.
 *
 * AC05 — Adel : « l heure ou le jour du message recu ». La liste affichait
 * `formatDistanceToNow` (« environ 3 heures », « 2 jours »), qui ne repond ni
 * a l un ni a l autre.
 * @param {string | number | Date | null | undefined} value
 * @param {{ now?: Date, timeZone?: string }} [options]
 * @returns {string}
 */
export const formatChatTimestamp = (value, options = {}) => {
  if (value === null || value === undefined || value === '') return '';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = options?.now instanceof Date ? options.now : new Date();
  const timeZone = options?.timeZone;
  const dayOptions = timeZone
    ? {
      day: '2-digit', month: '2-digit', timeZone, year: 'numeric',
    }
    : { day: '2-digit', month: '2-digit', year: 'numeric' };
  const sameDay = date.toLocaleDateString(localeDesFormats(), dayOptions)
    === now.toLocaleDateString(localeDesFormats(), dayOptions);

  if (sameDay) {
    return date.toLocaleTimeString(localeDesFormats(), {
      hour: '2-digit',
      minute: '2-digit',
      ...(timeZone ? { timeZone } : {}),
    });
  }

  return date.toLocaleDateString(localeDesFormats(), {
    day: '2-digit',
    month: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  });
};

/**
 * Les deux camps annonces par le titre d un fil d amical.
 *
 * Le serveur ecrit « Match amical : A vs B » (friendly-match-workflow.ts:593)
 * et n attache AUCUNE equipe au fil : `groupName` est, aujourd hui, la seule
 * marque des deux camps dans la charge de la liste.
 * @param {string} groupName
 * @returns {string[]}
 */
const splitFriendlyMatchSides = (groupName) => {
  const raw = String(groupName || '').trim();
  if (!raw) return [];
  const afterLabel = raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw;
  const sides = afterLabel.split(/\s+vs\s+/i).map((side) => side.trim()).filter(Boolean);
  return sides.length === 2 ? sides : [];
};

/**
 * L equipe d en face d un match amical — jamais un club invente.
 *
 * AC05 constat 3. Deux sources, dans cet ordre :
 *  1. `chat.friendlyMatchTeams` quand le serveur le fournit : il porte le LOGO ;
 *  2. le titre du fil : il ne porte qu un NOM, donc des initiales.
 * Quand aucune des deux ne tranche, on rend `null` — l ecran affiche alors son
 * repli neutre plutot qu un ecusson qui ferait croire a un vrai club.
 * @param {{ chat?: any, myTeams?: any[] }} params
 * @returns {{ logoUrl: string, name: string } | null}
 */
export const resolveFriendlyMatchOpponent = ({ chat, myTeams } = {}) => {
  if (!isFriendlyMatchChat(chat)) return null;

  const mine = Array.isArray(myTeams) ? myTeams : [];
  const normalizeName = (value) => String(value || '').trim().toLowerCase();
  const myTeamIds = new Set(
    mine.map((team) => String(team?.documentId || '').trim()).filter(Boolean),
  );
  const myTeamNames = new Set(mine.map((team) => normalizeName(team?.name)).filter(Boolean));

  const serverTeams = Array.isArray(chat?.friendlyMatchTeams) ? chat.friendlyMatchTeams : [];
  if (serverTeams.length === 2) {
    const opponent = serverTeams.find((team) => {
      const teamId = String(team?.documentId || '').trim();
      if (teamId && myTeamIds.has(teamId)) return false;
      return !myTeamNames.has(normalizeName(team?.name));
    });
    if (opponent?.name) {
      return {
        logoUrl: String(opponent?.logo?.url || opponent?.logoUrl || ''),
        name: String(opponent.name).trim(),
      };
    }
  }

  const sides = splitFriendlyMatchSides(chat?.groupName);
  if (sides.length !== 2) return null;

  // Les deux camps me sont etrangers (un dirigeant qui suit un fil sans y
  // jouer) : on ne sait pas lequel est « en face », donc on ne choisit pas.
  if (!sides.some((side) => myTeamNames.has(normalizeName(side)))) return null;

  const opponentName = sides.find((side) => !myTeamNames.has(normalizeName(side)));
  if (!opponentName) return null;

  return { logoUrl: '', name: opponentName };
};

/**
 * Returns a user-friendly preview for a chat message.
 *
 * AC05 — `lineup_share` (la composition d equipe) manquait : le serveur la
 * poste avec un texte VIDE (event-composition.ts:1864), donc la ligne tombait
 * dans le `default`, ne trouvait aucun texte, et ne rendait rien — c est le
 * « la c est vide » d Adel. Le repli final nomme aussi les charges que l app ne
 * connait pas encore, plutot que de laisser une ligne muette.
 * @param {ChatMessage | undefined | null} message
 * @param {(key: string, fallback: string) => string} [t]
 * @returns {string}
 */
export const getChatMessagePreview = (message, t = defaultTranslate) => {
  if (!message) return '';

  const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
  const documentPreviewText = getDocumentPreviewText(attachments);
  if (documentPreviewText) return documentPreviewText;

  const composition = message?.composition || {};
  const compositionType = String(composition?.type || '').trim().toLowerCase();
  const named = (key, fallback, values) => fillTemplate(t(key, fallback), values);
  switch (compositionType) {
    case 'contact_share':
      return t('messaging.preview.contactShare', 'Contact partagé');
    case 'event_share': {
      const eventName = String(composition?.eventName || '').trim();
      return eventName
        ? named('messaging.preview.eventShareNamed', 'Événement : {{name}}', { name: eventName })
        : t('messaging.preview.eventShare', 'Événement partagé');
    }
    case 'lineup_share': {
      const teamName = String(composition?.teamName || '').trim();
      return teamName
        ? named('messaging.preview.lineupShareNamed', 'Composition : {{team}}', { team: teamName })
        : t('messaging.preview.lineupShare', 'Composition publiée');
    }
    case 'location_share':
      return t('messaging.preview.locationShare', 'Localisation');
    case 'poll': {
      const question = String(composition?.question || '').trim();
      return question
        ? named('messaging.preview.pollNamed', 'Sondage : {{question}}', { question })
        : t('messaging.preview.poll', 'Sondage');
    }
    case 'proposal': {
      // S03 — une proposition de match amical porte de quoi se nommer ; une
      // proposition LEAGUE, non. Sans ces deux lignes, donner enfin une charge
      // à la proposition d'amical FERAIT RECULER la liste : elle passerait du
      // texte du message (« AS Candidats U15 propose un match. ») au générique
      // « Proposition ». ⛔ Rien n'est inventé : ce qui manque est simplement
      // absent de la ligne.
      const { dateLabel, kind, teamName } = composition;
      if (kind !== 'friendly_match') return t('messaging.preview.proposal', 'Proposition');
      const equipe = String(teamName || '').trim();
      const quand = String(dateLabel || '').trim();
      if (!equipe) return t('messaging.preview.proposalMatch', 'Proposition de match');
      return quand
        ? named('messaging.preview.proposalWhen', '{{team}} propose un match — {{when}}', { team: equipe, when: quand })
        : named('messaging.preview.proposalTeam', '{{team}} propose un match', { team: equipe });
    }
    case 'voice_note':
      return t('messaging.preview.voiceNote', 'Note vocale');
    default:
      break;
  }

  const text = String(message?.message || '').trim();
  if (text) return text;

  if (attachments.length > 0) {
    const firstMime = String(attachments?.[0]?.mime || '').toLowerCase();
    if (firstMime.startsWith('image/')) return t('messaging.preview.photo', 'Photo');
    if (firstMime.startsWith('audio/')) return t('messaging.preview.voiceNote', 'Note vocale');
    if (attachments.some((attachment) => isDocumentAttachment(attachment))) {
      return t('messaging.preview.file', 'Fichier');
    }
    return t('messaging.preview.attachment', 'Pièce jointe');
  }

  // 🔒 LE GARDE-FOU (AC05, temoin 4). Un message existe bel et bien — il a une
  // identite ou une charge — mais l app ne sait pas le resumer. Onze chemins du
  // serveur creent des messages sans passer par le service commun ; le jour ou
  // l un d eux pose un type neuf, la ligne doit dire qu il y a quelque chose a
  // lire. Un objet SANS aucune substance, lui, n invente rien.
  const hasSubstance = Boolean(
    message?.documentId
    || message?.id
    || message?.createdAt
    || compositionType,
  );
  return hasSubstance ? t('messaging.preview.fallback', 'Nouveau message') : '';
};

/**
 * Le frein entre deux relectures du compteur de non-lus, en millisecondes.
 *
 * ⏱️ Dix messages qui arrivent en rafale ne doivent declencher qu UNE lecture,
 * pas dix. Deux secondes suffisent a absorber une rafale sans que la pastille
 * paraisse en retard.
 */
export const UNREAD_REFETCH_COOLDOWN_MS = 2_000;

/**
 * WHATSAPP3 — FAUT-IL RELIRE LE COMPTEUR DE NON-LUS ?
 *
 * 🧮 POURQUOI ON RELIT AU LIEU DE COMPTER SOI-MEME. Ce compteur se calcule cote
 * serveur en comparant des COUPLES (message, lecture), avec un plafond a 100, sur
 * deux repliques. Un « +1 » local paraitrait juste et divergerait en silence — et
 * un chiffre faux s affiche a tout le monde. Relire est idempotent : deux
 * ecouteurs qui relisent rendent le meme chiffre. C est la decision « option D »
 * du chef d orchestre (23/09).
 *
 * Trois cas ne demandent AUCUNE lecture :
 *   · mon propre message — je viens de l ecrire, il est lu ;
 *   · un message du fil que j ai ouvert — je suis en train de le lire ;
 *   · une rafale — le frein tient.
 *
 * 🧯 EN CAS DE DOUTE, ON RELIT. Un expediteur inconnu, un identifiant manquant :
 * on prefere une petite lecture inutile a une pastille qui ment.
 * @param {object} [params] Ce que l ecran sait au moment ou le message arrive.
 * @param {string} [params.currentChatId] Le fil actuellement ouvert, s il y en a un.
 * @param {number} [params.lastRefetchAt] Quand on a relu pour la derniere fois.
 * @param {any} [params.message] Le message qui vient d arriver.
 * @param {string} [params.myUserId] Mon identifiant de compte.
 * @param {number} [params.now] L instant courant.
 * @returns {boolean} Vrai s il faut relire le compteur.
 */
export const shouldRefetchUnreadOnMessage = (params) => {
  const message = params?.message;

  const expediteur = String(message?.sender?.documentId ?? '').trim();
  const moi = String(params?.myUserId ?? '').trim();
  // Mon propre message : rien a relire. Si l un des deux identifiants manque, on
  // ne conclut PAS que c est moi — on relira.
  if (expediteur && moi && expediteur === moi) return false;

  const filDuMessage = String(message?.chat?.documentId ?? '').trim();
  const filOuvert = String(params?.currentChatId ?? '').trim();
  if (filDuMessage && filOuvert && filDuMessage === filOuvert) return false;

  const maintenant = Number(params?.now);
  const derniere = Number(params?.lastRefetchAt);
  if (Number.isFinite(maintenant) && Number.isFinite(derniere) && derniere > 0) {
    if (maintenant - derniere < UNREAD_REFETCH_COOLDOWN_MS) return false;
  }

  return true;
};
