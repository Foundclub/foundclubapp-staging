/**
 * MESSAGERIE-1W (07/10) — LA FORME DU FIL DU SITE, SANS UN PIXEL.
 *
 * Le pack « modele WhatsApp » (README §3.1, SPECS §1) range le fil en GROUPES : les messages
 * consecutifs d une meme personne, le meme jour, forment un groupe ; son nom s ecrit sur le
 * premier, son avatar et la queue de la bulle se posent sur le dernier ; une puce centree
 * annonce chaque nouveau jour. Ces regles ne dependent d aucun rendu : elles vivent ici, et
 * `__tests__/filDuSite.test.js` les fige. `Conversation.web.js` ne fait plus que dessiner.
 *
 * ⛔ Aucune couleur ici : les valeurs du pack vivent dans `Conversation.web.js` (fichier
 * exempte du contrat de theme) en attendant les jetons de MESSAGERIE-1A.
 */

/**
 * Le jour LOCAL d une date, « AAAA-MM-JJ » ; '' si la date est illisible.
 * @param {string | number | Date | null | undefined} valeur - La date.
 * @returns {string} La clef du jour.
 */
export const cleDuJour = (valeur) => {
  if (!valeur) return '';
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return '';
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mois}-${jour}`;
};

/**
 * Le libelle d une puce de date, comme WhatsApp : « Aujourd hui », « Hier », le nom du jour
 * dans la semaine ecoulee, puis « 6 octobre » (et l annee si ce n est pas celle-ci).
 * @param {string | number | Date} valeur - La date du premier message du jour.
 * @param {{ aujourdhui: string, hier: string, locale?: string, maintenant?: Date }} textes
 *   Les deux mots traduits, la langue des dates et l instant de reference.
 * @returns {string} Le libelle.
 */
export const libelleDuJour = (valeur, {
  aujourdhui, hier, locale = 'fr-FR', maintenant = new Date(),
}) => {
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return '';
  const minuit = (instant) => new Date(
    instant.getFullYear(),
    instant.getMonth(),
    instant.getDate(),
  );
  const ecartJours = Math.round((minuit(maintenant).getTime() - minuit(date).getTime()) / 86400000);
  if (ecartJours === 0) return aujourdhui;
  if (ecartJours === 1) return hier;
  if (ecartJours > 1 && ecartJours < 7) {
    const nom = date.toLocaleDateString(locale, { weekday: 'long' });
    return nom.charAt(0).toUpperCase() + nom.slice(1);
  }
  return date.toLocaleDateString(locale, date.getFullYear() === maintenant.getFullYear()
    ? { day: 'numeric', month: 'long' }
    : { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * L identifiant d un message, quelle que soit sa forme (serveur, optimiste).
 * @param {any} message - Le message.
 * @returns {string} Son identifiant, ou ''.
 */
export const idDuMessage = (message) => String(
  message?.documentId || message?.id || message?.clientMessageId || '',
).trim();

/**
 * L expediteur d un message ; '' pour une ligne systeme (« … a rejoint le canal »).
 * @param {any} message - Le message.
 * @returns {string} Son identifiant.
 */
const idDeLExpediteur = (message) => String(
  message?.sender?.documentId || message?.sender?.id || '',
).trim();

/**
 * @typedef {{ type: 'jour', cle: string, date: string }} EntreeJour
 * @typedef {{ type: 'message', cle: string, message: any, premier: boolean, dernier: boolean }}
 *   EntreeMessage
 */

/**
 * Range le fil (deja trie du plus ancien au plus recent) en puces de jour et en messages
 * marques « premier » / « dernier » de leur groupe.
 * @param {any[]} messages - Les messages, dans l ordre d affichage.
 * @returns {(EntreeJour | EntreeMessage)[]} Ce que le fil dessine, dans l ordre.
 */
export const rangerLeFil = (messages) => {
  const liste = Array.isArray(messages) ? messages : [];
  /** @type {(EntreeJour | EntreeMessage)[]} */
  const entrees = [];
  let jourPrecedent = '';

  liste.forEach((message, index) => {
    const jour = cleDuJour(message?.createdAt);
    if (jour && jour !== jourPrecedent) {
      entrees.push({ cle: `jour-${jour}`, date: String(message?.createdAt), type: 'jour' });
      jourPrecedent = jour;
    }
    const auteur = idDeLExpediteur(message);
    const precedent = liste[index - 1];
    const suivant = liste[index + 1];
    // Une ligne systeme n appartient a aucun groupe, et coupe celui qui l entoure.
    const memeGroupe = (voisin) => Boolean(auteur)
      && idDeLExpediteur(voisin) === auteur
      && cleDuJour(voisin?.createdAt) === jour;
    entrees.push({
      cle: idDuMessage(message) || `message-${index}`,
      dernier: !memeGroupe(suivant),
      message,
      premier: !memeGroupe(precedent),
      type: 'message',
    });
  });

  return entrees;
};

/**
 * L etat des coches d UN DE MES messages, avec la regle du telephone (Conversation.js,
 * `renderTicks`) : lu des qu une personne au moins l a lu.
 * @param {any} message - Mon message.
 * @returns {'echec' | 'en-cours' | 'lu' | 'envoye'} L etat a dessiner.
 */
export const etatDesCoches = (message) => {
  if (message?.failed) return 'echec';
  if (message?.pending) return 'en-cours';
  if (Array.isArray(message?.readBy) && message.readBy.length > 0) return 'lu';
  return 'envoye';
};

/**
 * La place d une personne dans la palette des noms : stable d un affichage a l autre, et la
 * meme pour une personne dans tous les fils (SPECS §0, « attribution stable par utilisateur »).
 * @param {string} identifiant - Le documentId de la personne.
 * @param {number} taille - Le nombre de couleurs de la palette.
 * @returns {number} Un indice entre 0 et taille - 1.
 */
export const indiceDeCouleur = (identifiant, taille) => {
  if (!taille) return 0;
  let somme = 0;
  String(identifiant || '').split('').forEach((caractere) => {
    somme = ((somme * 31) + caractere.charCodeAt(0)) % 100000;
  });
  return somme % taille;
};

/**
 * Les messages dont le texte ne se modifie pas : la MEME liste que le serveur (chat-message.ts,
 * `NON_EDITABLE_COMPOSITION_TYPES`) et que le telephone (Conversation.js).
 */
const TYPES_NON_MODIFIABLES = new Set([
  'contact_share',
  'event_share',
  'location_share',
  'poll',
  'proposal',
  'voice_note',
]);

/**
 * Le texte de ce message peut-il etre modifie (s il est a moi) ? Un sondage, un vocal, un partage
 * ou une proposition ne le peuvent pas.
 * @param {any} message - Le message.
 * @returns {boolean} Vrai si « Modifier » a un sens.
 */
export const estModifiable = (message) => {
  const type = String(message?.composition?.type || '').trim().toLowerCase();
  return !type || !TYPES_NON_MODIFIABLES.has(type);
};

/**
 * MSG1W §3.8 — L EVENEMENT D UN MESSAGE, pour la bulle du telephone (EventMessageBubble) : la
 * relation `event` du message, completee par l apercu que porte un partage (`event_share`), ou
 * reconstruite depuis ce partage. Meme regle que le telephone (`resolveMessageEventPayload`) :
 * une valeur VIDE de la relation n efface pas celle de l apercu.
 * @param {any} message - Le message.
 * @returns {any | null} L evenement a dessiner, ou null.
 */
export const evenementDuMessage = (message) => {
  const composition = message?.composition;
  const relation = message?.event;
  const estUnPartage = composition?.type === 'event_share';
  const id = String(
    relation?.documentId
    || relation?.id
    || (typeof relation === 'string' ? relation : '')
    || composition?.eventDocumentId
    || '',
  ).trim();
  if (!id) return null;
  const apercu = estUnPartage && composition?.eventPreview
    && typeof composition.eventPreview === 'object'
    ? composition.eventPreview
    : null;
  const repli = estUnPartage ? {
    date: composition?.eventDate || null,
    documentId: id,
    locationDetails: composition?.locationLabel || '',
    name: composition?.eventName || 'Événement',
    team: composition?.teamName ? { name: composition.teamName } : null,
    type: { name: 'Événement' },
  } : null;
  const base = apercu || repli;
  if (relation && typeof relation === 'object') {
    if (!base) return relation;
    const fusion = { ...base };
    Object.entries(relation).forEach(([cle, valeur]) => {
      if (valeur !== null && valeur !== undefined && valeur !== '') fusion[cle] = valeur;
    });
    return { ...fusion, documentId: id };
  }
  return base ? { ...base, documentId: id } : null;
};
