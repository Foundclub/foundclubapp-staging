/**
 * MSG1A — LES REGLES PURES DE L'HABILLAGE « MODELE WHATSAPP » DU FIL.
 *
 * Pack de design d'Adel du 07/10 (`design_handoff_messagerie_whatsapp`, SPECS.md §1).
 * Rien ici ne dessine : ces fonctions disent QUELLE bulle porte la queue, le nom,
 * l'avatar, et QUELLE couleur prend le nom d'une personne. L'ecran les applique.
 *
 * 🧱 Aucun import de service : un module de `src/services` charge le client HTTP
 * et fait rougir toutes les suites d'une copie de travail sans `.env`.
 */

import {
  getDocumentDisplayName,
  isDocumentAttachment,
  isImageAttachment,
} from '@/utils/documentAttachment';

/** Les couleurs de nom du pack, dans l'ordre de SPECS.md §0 (jetons `chatName1..13`). */
export const NOMBRE_DE_COULEURS_DE_NOM = 13;

/**
 * L'espace reserve en fin de derniere ligne pour l'heure et les coches (SPECS.md §1) :
 * 54 sur mes bulles (heure + coches), 36 sur les bulles recues (heure seule).
 */
export const ESPACE_RESERVE_META = { moi: 54, recu: 36 };

/**
 * Largeur d'une espace insecable en Montserrat 15 (0,26 em, mesuree sur le banc).
 * Sert a reserver la place de l'heure SANS rien afficher : le texte s'arrete avant.
 */
const LARGEUR_ESPACE_INSECABLE = 3.9;

/**
 * La reserve, ecrite en espaces insecables : elle se colle au dernier mot, donc
 * l'heure ne chevauche jamais la derniere ligne, et un texte court garde sa bulle
 * etroite (comme WhatsApp).
 * @param {boolean} estAMoi - Ma bulle (heure + coches) ou une bulle recue.
 * @returns {string} La reserve.
 */
export const reserveDeLHeure = (estAMoi) => '\u00A0'.repeat(Math.ceil(
  (estAMoi ? ESPACE_RESERVE_META.moi : ESPACE_RESERVE_META.recu) / LARGEUR_ESPACE_INSECABLE,
));

/**
 * L'index (0 a 12) de la couleur d'une personne : le meme identifiant donne
 * TOUJOURS la meme couleur, sur tous les telephones (hachage stable, djb2).
 * @param {unknown} identifiant - L'identifiant du compte.
 * @returns {number} L'index dans la palette.
 */
export const indexDeLaCouleurDuNom = (identifiant) => {
  const texte = String(identifiant ?? '').trim();
  let empreinte = 5381;
  for (let i = 0; i < texte.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    empreinte = ((empreinte * 33) ^ texte.charCodeAt(i)) >>> 0;
  }
  return empreinte % NOMBRE_DE_COULEURS_DE_NOM;
};

/**
 * La couleur du nom d'une personne, lue dans les jetons du theme.
 * @param {Record<string, string>} Colors - Les couleurs du theme.
 * @param {unknown} identifiant - L'identifiant du compte.
 * @returns {string} La couleur.
 */
export const couleurDuNom = (Colors, identifiant) => (
  Colors[`chatName${indexDeLaCouleurDuNom(identifiant) + 1}`] || Colors.primary500
);

/**
 * @param {any} message - Un message au format GiftedChat.
 * @returns {string} L'identifiant de son auteur.
 */
// eslint-disable-next-line no-underscore-dangle -- le format de GiftedChat
const auteurDe = (message) => String(message?.user?._id ?? '');

/**
 * @param {any} a - Un message.
 * @param {any} b - Un autre message.
 * @returns {boolean} Vrai s'ils sont du meme jour calendaire.
 */
const memeJour = (a, b) => {
  const da = new Date(a?.createdAt);
  const db = new Date(b?.createdAt);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
};

/**
 * @param {any} a - Un message.
 * @param {any} b - Le message voisin (ou rien).
 * @returns {boolean} Vrai si les deux appartiennent au meme groupe de bulles.
 */
const memeGroupe = (a, b) => Boolean(b)
  && !a?.system
  && !b?.system
  && auteurDe(a) !== ''
  && auteurDe(a) === auteurDe(b)
  && memeJour(a, b);

/**
 * La place d'un message dans son groupe (messages consecutifs d'une meme personne,
 * le meme jour). GiftedChat nomme `previousMessage` le message PLUS ANCIEN et
 * `nextMessage` le PLUS RECENT, liste inversee ou non.
 *  · `premier` : il ouvre le groupe — il porte le nom (groupes) et 10 au-dessus ;
 *  · `dernier` : il le ferme — il porte la queue et l'avatar.
 * @param {{courant: any, precedent?: any, suivant?: any}} voisins - Le message et ses voisins.
 * @returns {{dernier: boolean, premier: boolean}} Sa place.
 */
export const placeDansLeGroupe = ({ courant, precedent, suivant }) => ({
  dernier: !memeGroupe(courant, suivant),
  premier: !memeGroupe(courant, precedent),
});

/**
 * Un tete-a-tete : pas d'avatar, pas de nom au-dessus des bulles (SPECS.md §1).
 * Tout autre fil (groupe, equipe, club, League, Ville) montre qui parle.
 * @param {unknown} typeDuFil - `chat.type`.
 * @returns {boolean} Vrai pour un tete-a-tete.
 */
export const estUnTeteATete = (typeDuFil) => typeDuFil === 'whisper';

/**
 * MSG1A (§3.3) — CE QUE DIT UNE CITATION (dans la bulle, et dans la barre « reponse en
 * cours »). Le message cite peut arriver sous deux formes : un message GiftedChat (`text`,
 * `image`, `attachments`, `composition`) ou la citation que le serveur joint au message
 * (`message`, `composition`). Un contenu riche se dit avec son ICONE (SPECS.md §1).
 * @param {any} message - Le message cite.
 * @param {(cle: string, repli: string) => string} t - La traduction.
 * @returns {{icone: string, texte: string}} L'extrait (une ligne) et son glyphe (ou rien).
 */
export const extraitDuMessageCite = (message, t) => {
  const composition = message?.composition;
  const texte = String(message?.text ?? message?.message ?? '').trim();
  const titre = (valeur) => String(valeur || '').trim();

  switch (composition?.type) {
    case 'contact_share':
      return {
        icone: 'users',
        texte: titre(composition.contactName) || t('conversation.quote.contact', 'Contact'),
      };
    case 'event_share':
      return {
        icone: 'calendar',
        texte: titre(composition.eventName) || t('conversation.quote.event', 'Événement'),
      };
    case 'lineup_share': {
      const match = titre(composition.eventDisplayName) || titre(composition.eventName);
      const mot = t('conversation.quote.lineup', 'Composition');
      return { icone: 'users', texte: match ? `${mot} · ${match}` : mot };
    }
    case 'location_share':
      return { icone: 'locationPin', texte: t('conversation.quote.location', 'Localisation') };
    case 'poll':
      return {
        icone: 'chartSimpleHorizontal',
        texte: titre(composition.question) || t('conversation.quote.poll', 'Sondage'),
      };
    case 'voice_note':
      return { icone: 'microphone', texte: t('conversation.quote.voice', 'Message vocal') };
    default:
      break;
  }
  if (message?.event && typeof message.event === 'object') {
    return {
      icone: 'calendar',
      texte: titre(message.event.name) || t('conversation.quote.event', 'Événement'),
    };
  }
  const pieces = Array.isArray(message?.attachments) ? message.attachments : [];
  if (message?.image || pieces.some((piece) => isImageAttachment(piece))) {
    return { icone: 'image', texte: texte || t('conversation.quote.photo', 'Photo') };
  }
  const document = pieces.find((piece) => isDocumentAttachment(piece));
  if (document) return { icone: 'file', texte: texte || getDocumentDisplayName(document) };
  return { icone: '', texte: texte || t('conversation.replyPreview.defaultText', 'Message') };
};

/**
 * MSG1A (§3.3) — QUI EST CITE : son nom (« Vous » si c'est moi) et l'identifiant qui donne
 * sa couleur. Meme double forme que `extraitDuMessageCite`.
 * @param {any} message - Le message cite.
 * @param {string} moi - Mon identifiant.
 * @param {(cle: string, repli: string) => string} t - La traduction.
 * @returns {{identifiant: string, nom: string}} L'auteur cite.
 */
export const auteurDuMessageCite = (message, moi, t) => {
  // eslint-disable-next-line no-underscore-dangle -- le format de GiftedChat
  const identifiant = String(message?.sender?.documentId || message?.user?._id || '').trim();
  if (identifiant && identifiant === String(moi || '').trim()) {
    return { identifiant, nom: t('conversation.header.you', 'Vous') };
  }
  const nom = [message?.sender?.firstname, message?.sender?.lastname].filter(Boolean).join(' ').trim()
    || String(message?.sender?.name || message?.user?.name || '').trim()
    || t('conversation.replyPreview.defaultAuthor', 'Membre');
  return { identifiant, nom };
};
