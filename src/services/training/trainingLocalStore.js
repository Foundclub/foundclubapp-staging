import { getItem, removeItem, setItem } from '@/platform/storage';

/**
 * LE CARNET LOCAL — ce qui rend la saisie possible sans reseau.
 *
 * 🔎 POURQUOI IL EXISTE : les tests se font sur un terrain, souvent sans reseau, et
 * une mesure perdue ne se retrouve pas — on ne redemande pas a quelqu'un de refaire
 * trois sprints maximaux parce que la requete a echoue. Donc : on ecrit TOUJOURS en
 * local d'abord, l'envoi au serveur vient apres, et un envoi rate ne perd rien.
 *
 * 🔑 LA CLE D'UNE MESURE est (seance, test, mesure, essai, cote). C'est la meme que
 * cote serveur : re-pousser deux fois la meme ligne met a jour au lieu de dupliquer.
 */

const PREFIX = 'training.results.';
const PENDING_KEY = 'training.pending.sessions';

/**
 * La cle d'une mesure : (test, mesure, essai, cote).
 * @param {Record<string, any>} row une ligne de mesure
 * @returns {string} la cle, identique cote serveur
 */
const measureId = (row) => [
  row.testDocumentId,
  row.measureKey,
  row.attempt ?? 1,
  row.side || 'none',
].join('|');

/**
 * Relit une valeur JSON du stockage local, sans jamais jeter.
 * @param {string} key la clef de stockage
 * @param {any} fallback ce qu'on rend si la valeur est absente ou illisible
 * @returns {any} la valeur relue, ou `fallback`
 */
const readJson = (key, fallback) => {
  try {
    const raw = getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    // Un carnet illisible ne doit jamais empecher la saisie du jour : on repart a vide.
    return fallback;
  }
};

/**
 * Ecrit une valeur JSON dans le stockage local, sans jamais jeter.
 * @param {string} key la clef de stockage
 * @param {any} value la valeur a serialiser
 * @returns {boolean} vrai si l'ecriture a abouti
 */
const writeJson = (key, value) => {
  try {
    setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

/**
 * Toutes les mesures gardees en local pour une seance, indexees par leur cle.
 * @param {string} sessionDocumentId Identifiant Strapi de la seance concernee.
 * @returns {{[key: string]: Record<string, any>}} Le carnet de la seance, vide si elle est
 *   inconnue.
 */
export const getLocalResults = (sessionDocumentId) => {
  if (!sessionDocumentId) return {};
  return readJson(`${PREFIX}${sessionDocumentId}`, {});
};

/**
 * Ecrit (ou remplace) une mesure dans le carnet local. Rend le carnet complet.
 * @param {string} sessionDocumentId Identifiant Strapi de la seance concernee.
 * @param {object} row La mesure saisie.
 * @param {string} row.testDocumentId Identifiant du test auquel la mesure appartient.
 * @param {string} row.measureKey Cle de la grandeur mesuree (temps, distance, etc.).
 * @param {number} [row.attempt] Numero d'essai ; 1 par defaut.
 * @param {string} [row.side] Cote mesure (gauche, droit) ; 'none' par defaut.
 * @returns {{[key: string]: Record<string, any>}} Le carnet de la seance apres ecriture.
 */
export const putLocalResult = (sessionDocumentId, row) => {
  if (!sessionDocumentId || !row?.testDocumentId || !row?.measureKey) {
    return getLocalResults(sessionDocumentId);
  }
  const all = getLocalResults(sessionDocumentId);
  const id = measureId(row);
  all[id] = {
    ...row,
    attempt: row.attempt ?? 1,
    savedAt: new Date().toISOString(),
    side: row.side || 'none',
    synced: false,
  };
  // 🚨 Une ecriture qui rate ne doit JAMAIS passer pour une reussite : c'est la
  // seule promesse de ce lot dont l'echec est irrattrapable — on ne redemande pas
  // a quelqu'un de refaire trois sprints maximaux. L'ecran doit pouvoir le dire.
  if (!writeJson(`${PREFIX}${sessionDocumentId}`, all)) {
    throw new Error(`Le carnet local n'a pas pu etre ecrit (seance ${sessionDocumentId}).`);
  }
  markSessionPending(sessionDocumentId);
  return all;
};

/**
 * Retire une mesure du carnet local (l'athlete efface une saisie).
 * @param {string} sessionDocumentId Identifiant Strapi de la seance concernee.
 * @param {object} row La mesure a retirer, identifiee par sa cle (test, grandeur, essai, cote).
 * @returns {{[key: string]: Record<string, any>}} Le carnet de la seance apres suppression.
 */
export const removeLocalResult = (sessionDocumentId, row) => {
  const all = getLocalResults(sessionDocumentId);
  delete all[measureId(row)];
  writeJson(`${PREFIX}${sessionDocumentId}`, all);
  return all;
};

/**
 * Les mesures pas encore acceptees par le serveur.
 * @param {string} sessionDocumentId Identifiant Strapi de la seance concernee.
 * @returns {Record<string, any>[]} Les mesures restant a envoyer, dans l'ordre du carnet.
 */
export const getUnsyncedResults = (sessionDocumentId) => (
  /** @type {Record<string, any>[]} */ (Object.values(getLocalResults(sessionDocumentId)))
).filter((row) => !row.synced);

/**
 * Marque comme envoyees les mesures que le serveur a acceptees.
 * @param {string} sessionDocumentId Identifiant Strapi de la seance concernee.
 * @param {Record<string, any>[]} [rows] Les mesures acceptees par le serveur.
 */
export const markResultsSynced = (sessionDocumentId, rows = []) => {
  if (!rows.length) return;
  const all = getLocalResults(sessionDocumentId);
  rows.forEach((row) => {
    const id = measureId(row);
    if (all[id]) all[id] = { ...all[id], synced: true };
  });
  writeJson(`${PREFIX}${sessionDocumentId}`, all);
  if (!getUnsyncedResults(sessionDocumentId).length) unmarkSessionPending(sessionDocumentId);
};

/**
 * Les seances qui ont encore quelque chose a envoyer, toutes journees confondues.
 * @returns {string[]} Les identifiants des seances en attente d'envoi.
 */
export const getPendingSessions = () => readJson(PENDING_KEY, []);

/**
 * Inscrit une seance dans la file d'envoi.
 * @param {string} sessionDocumentId Identifiant Strapi de la seance concernee.
 * @returns {void} rien
 */
const markSessionPending = (sessionDocumentId) => {
  const pending = getPendingSessions();
  if (!pending.includes(sessionDocumentId)) writeJson(PENDING_KEY, [...pending, sessionDocumentId]);
};

/**
 * Retire une seance de la file d'envoi.
 * @param {string} sessionDocumentId Identifiant Strapi de la seance concernee.
 * @returns {void} rien
 */
const unmarkSessionPending = (sessionDocumentId) => {
  const pending = getPendingSessions().filter((id) => id !== sessionDocumentId);
  if (pending.length) writeJson(PENDING_KEY, pending);
  else removeItem(PENDING_KEY);
};

/**
 * Efface le carnet local d'une seance. A n'appeler qu'apres un envoi complet.
 * @param {string} sessionDocumentId Identifiant Strapi de la seance concernee.
 */
export const clearLocalSession = (sessionDocumentId) => {
  removeItem(`${PREFIX}${sessionDocumentId}`);
  unmarkSessionPending(sessionDocumentId);
};

/**
 * Fusionne ce que dit le serveur et ce qui est en local.
 * Le LOCAL gagne quand il n'est pas encore envoye : c'est la saisie la plus recente,
 * et c'est celle que l'athlete vient de taper sous les yeux.
 * @param {Record<string, any>[]} serverResults Les mesures rendues par le serveur.
 * @param {string} sessionDocumentId Identifiant Strapi de la seance concernee.
 * @returns {{[key: string]: Record<string, any>}} Les mesures des deux sources, indexees par leur
 *   cle.
 */
export const mergeResults = (serverResults, sessionDocumentId) => {
  /** @type {{[key: string]: Record<string, any>}} */
  const merged = {};
  /** @type {Record<string, any>[]} */
  const venuesDuServeur = Array.isArray(serverResults) ? serverResults : [];
  venuesDuServeur.forEach((row) => {
    const id = measureId({
      attempt: row.attempt,
      measureKey: row.measureKey,
      side: row.side,
      testDocumentId: row.test?.documentId || row.testDocumentId,
    });
    merged[id] = { ...row, synced: true };
  });
  /** @type {[string, Record<string, any>][]} */
  const duCarnet = Object.entries(getLocalResults(sessionDocumentId));
  duCarnet.forEach(([id, row]) => {
    if (!row.synced || !merged[id]) merged[id] = row;
  });
  return merged;
};

export const buildMeasureId = measureId;
