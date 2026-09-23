// VOCAL2 — L'ENCHAÎNEMENT DES VOCAUX (décision d'Adel, 23/09 ~17h50).
//
// À la FIN d'un vocal, le suivant non écouté du même fil démarre tout seul,
// comme sur WhatsApp. Deux morceaux, ici :
//
// 1. 🧭 QUI ENCHAÎNE — `nextVoiceToChain`. Règle choisie : le message
//    IMMÉDIATEMENT en dessous (plus récent), et seulement s'il est un vocal
//    REÇU. Un texte, une photo, un sondage ou un de MES vocaux entre les deux
//    arrête la chaîne. Pourquoi : c'est ce que l'on attend d'une conversation
//    (on écoute une salve de vocaux, pas des vocaux éparpillés au milieu d'une
//    discussion écrite qu'on sauterait sans la lire), et la maquette le dit :
//    « vers le bas seulement ». Le « déjà écouté ? » se vérifie au moment de
//    démarrer, dans la bulle suivante : c'est elle qui tient son point.
//
// 2. 📣 LE RELAIS — `requestVoicePlay` / `onVoicePlayRequest`. Chaque bulle
//    vit sa vie (son lecteur, son point) : à sa fin de lecture, elle ne
//    démarre pas la suivante, elle la PRÉVIENT. Une bulle qui a quitté l'écran
//    n'écoute plus : la chaîne s'arrête sans bruit.

/** @type {Map<string, Set<() => void>>} */
const ecouteurs = new Map();

/**
 * Le vocal à enchaîner après celui-ci.
 * @param {any} messageSuivant - Le message juste en dessous (plus récent).
 * @param {boolean} estAMoi - Ce message est-il à moi ?
 * @returns {string} Son identifiant, ou '' s'il ne faut rien enchaîner.
 */
export const nextVoiceToChain = (messageSuivant, estAMoi) => {
  if (!messageSuivant || estAMoi) return '';
  if (String(messageSuivant?.composition?.type || '') !== 'voice_note') return '';
  // Le même ordre que `getMessageDocumentId` (Conversation.js), qui nomme la bulle.
  // eslint-disable-next-line no-underscore-dangle -- `_id` est le nom imposé par GiftedChat
  return String(messageSuivant.documentId || messageSuivant.id || messageSuivant._id || '').trim();
};

/**
 * Écoute les demandes « à toi de jouer » adressées à un vocal.
 * @param {string} idMessage - Le vocal.
 * @param {() => void} ecouteur - Ce qu'il fait quand on l'appelle.
 * @returns {() => void} Le désabonnement.
 */
export const onVoicePlayRequest = (idMessage, ecouteur) => {
  const cle = String(idMessage || '');
  if (!cle) return () => {};
  if (!ecouteurs.has(cle)) ecouteurs.set(cle, new Set());
  const liste = /** @type {Set<() => void>} */ (ecouteurs.get(cle));
  liste.add(ecouteur);
  return () => {
    liste.delete(ecouteur);
    if (liste.size === 0) ecouteurs.delete(cle);
  };
};

/**
 * Prévient un vocal que c'est à lui de jouer.
 * @param {string} idMessage - Le vocal.
 * @returns {void}
 */
export const requestVoicePlay = (idMessage) => {
  const liste = ecouteurs.get(String(idMessage || ''));
  if (!liste) return;
  [...liste].forEach((ecouteur) => ecouteur());
};
