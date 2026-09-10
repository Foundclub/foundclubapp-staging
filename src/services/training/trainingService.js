import client from '@/services/client';

/**
 * ENTRAINEMENT PERSO — l'unique porte vers le serveur.
 *
 * 🔎 POURQUOI SI PEU DE FONCTIONS : le serveur n'expose que huit verbes (deux pour le
 * catalogue, six pour « mon entrainement »). Les seances et les resultats n'ont
 * volontairement AUCUNE route a eux : ils ne se manipulent qu'a travers une inscription
 * qui appartient a l'appelant. Ce fichier suit exactement ce decoupage.
 */

/**
 * Les programmes publies, avec leurs journees et leurs tests.
 * @returns {Promise<Array<Record<string, any>>>} Le catalogue complet, ou un tableau vide quand le
 *   serveur ne rend rien.
 */
export const getTrainingPrograms = async () => {
  const { data } = await client.get('/training-programs');
  return data?.data || [];
};

/**
 * Un programme et tout son contenu.
 * @param {string} documentId L'identifiant du programme a charger.
 * @returns {Promise<Record<string, any>|null>} Le programme, ou `null` quand il est introuvable.
 */
export const getTrainingProgram = async (documentId) => {
  const { data } = await client.get(`/training-programs/${documentId}`);
  return data?.data || null;
};

/**
 * L'entrainement en cours : l'inscription, le programme, et les seances planifiees.
 * Rend `null` quand la personne n'a rien choisi — ce n'est pas une erreur, c'est
 * l'etat de depart de tout le monde.
 * @returns {Promise<Record<string, any>|null>} L'entrainement en cours, ou `null` quand il n'y en a
 *   pas.
 */
export const getMyTraining = async () => {
  const { data } = await client.get('/training/mine');
  return data?.data || null;
};

/**
 * « Je choisis cet entrainement ». Cree l'inscription ET toutes ses seances d'un coup.
 * @param {string} programDocumentId
 * @param {string} [startDate] date ISO (AAAA-MM-JJ). Par defaut : aujourd'hui.
 * @returns {Promise<Record<string, any>|null>} L'inscription creee, ou `null` quand le serveur ne
 *   rend
 *   rien.
 */
export const chooseTrainingProgram = async (programDocumentId, startDate) => {
  const { data } = await client.post('/training/enroll', { programDocumentId, startDate });
  return data?.data || null;
};

/**
 * Quitter le programme en cours. Les resultats deja saisis sont conserves.
 * @returns {Promise<Record<string, any>|null>} L'inscription refermee, ou `null` quand le serveur
 *   ne
 *   rend rien.
 */
export const leaveTrainingProgram = async () => {
  const { data } = await client.post('/training/leave', {});
  return data?.data || null;
};

/**
 * Met a jour une seance : son etat, sa date, son controle de fraicheur, ses notes.
 * @param {string} sessionDocumentId
 * @param {object} payload Les champs a modifier ; ceux qui sont absents ne bougent pas.
 * @param {string} [payload.status] Le nouvel etat de la seance.
 * @param {string} [payload.plannedDate] La date prevue, au format ISO (AAAA-MM-JJ).
 * @param {object} [payload.freshness] Le controle de fraicheur saisi avant la seance.
 * @param {object} [payload.conditions] Les conditions du jour.
 * @param {string} [payload.notes] Les notes libres de la personne.
 * @returns {Promise<Record<string, any>|null>} La seance mise a jour, ou `null` quand le serveur ne
 *   rend rien.
 */
export const updateTrainingSession = async (sessionDocumentId, payload) => {
  const { data } = await client.put(`/training/sessions/${sessionDocumentId}`, payload);
  return data?.data || null;
};

/**
 * Ce que le serveur repond a un envoi de mesures.
 * @typedef {{
 *   rejected: Array<Record<string, any>>,
 *   results: Array<Record<string, any>>,
 *   saved: number
 * }} ReponseEnvoi
 */

/**
 * Envoie un LOT de mesures. Le lot existe parce que le terrain n'a pas toujours de
 * reseau : l'app garde les saisies en local et les pousse ensemble. Re-pousser le
 * meme lot ne cree pas de doublon, le serveur met a jour.
 * @param {string} sessionDocumentId
 * @param {Array<Record<string, any>>} results lignes
 *   { testDocumentId, measureKey, attempt, side, value,
 *   textValue, unit, isValid, invalidReason, notes }
 * @returns {Promise<ReponseEnvoi>} Le nombre de mesures enregistrees et la
 *   liste de celles que le serveur a refusees.
 */
export const saveTrainingResults = async (sessionDocumentId, results) => {
  const { data } = await client.post('/training/results', { results, sessionDocumentId });
  return data?.data || { rejected: [], results: [], saved: 0 };
};

/** Un carnet qu'on n'a pas encore commence : la forme rendue, une seule fois. */
const CARNET_VIDE = { csv: '', rows: 0 };

/**
 * Le carnet complet, une mesure par ligne, pret a coller.
 *
 * 🧨 UN 404 N'EST PAS UNE PANNE ICI, ET LE CONFONDRE COUTE UN ECRAN.
 * Le serveur rend `notFound('Aucun entrainement en cours')` tant que la personne
 * n'a choisi aucun programme — c'est l'etat de depart de TOUT LE MONDE, pas une
 * erreur. Sans cette traduction, l'ecran passait ce 404 a `WithDataWrapper`, qui
 * affichait son pave d'erreur AVANT d'atteindre l'etat vide pourtant deja ecrit
 * (`TrainingLogbook.js`, `training.logbook.emptyTitle`).
 *
 * 🩸 Vu par Adel le 2026-09-10 sur la 2.6.40 : « La ressource demandee est
 * introuvable » et un bouton « Reessayer » qui ne pouvait rien reparer.
 *
 * ⛔ SEUL le 404 devient un carnet vide. Une coupure reseau ou un 500 doivent
 * continuer a remonter : les faire passer pour un carnet vide dirait a quelqu'un
 * que ses mesures ont disparu.
 * @returns {Promise<{csv: string, rows: number}>} Le carnet au format CSV et son nombre
 *   de lignes.
 */
export const exportTrainingResults = async () => {
  try {
    const { data } = await client.get('/training/export');
    return data?.data || { ...CARNET_VIDE };
  } catch (erreur) {
    // 🪰 Le code se lit a DEUX endroits : a la racine, et dans le corps deballe
    //    par l'intercepteur de reponse. Les deux formes arrivent vraiment ici.
    const code = Number(
      erreur?.status ?? erreur?.response?.status ?? erreur?.response?.data?.error?.status,
    );
    if (code === 404) return { ...CARNET_VIDE };
    throw erreur;
  }
};
