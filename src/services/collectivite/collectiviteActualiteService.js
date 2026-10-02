import { getApiBaseUrl } from '@/config/runtimeUrls';

/**
 * 📰 COLL-C4A (02/10/2026) — LES ACTUALITÉS DE LA VILLE, côté serveur `api::collectivite-actualite`
 * (admin fix/COLL-C4A-admin).
 *
 * Les gestes de la MAIRIE (`/collectivites/:id/actualites...`) sont gardés par la policy
 * `is-gestionnaire-collectivite` : la relation `gestionnaires`, jamais le rôle. Les lectures du
 * MEMBRE (`/clubs/:id/collectivite-actualites`, `/collectivite-actualites/mine`) ne rendent que
 * ce que SES clubs peuvent lire. L'app ne déduit rien : elle affiche ce que le serveur rend.
 *
 * ⚠️ Le client HTTP et la session sont chargés À L'APPEL (import dynamique, comme
 * MatchCenterScreen pour leagueMatchService) et non à l'import : la fiche du club (ClubDetails,
 * 10 témoins) et les accueils importent ce module sans doubler le client, qui exige l'adresse du
 * serveur dès son chargement (mémoire piege-env-absent-worktree-import-service).
 */

/**
 * Le client HTTP de l'app, chargé à l'appel.
 * @returns {Promise<any>} Le client axios.
 */
const client = async () => (await import('../client')).default;

/**
 * La session (le jeton) du compte connecté, chargée à l'appel.
 * @returns {Promise<any>} Les jetons, ou null.
 */
const session = async () => (await import('../../domains/auth/authUseCases')).getAuthTokens();

/**
 * Lit une route du serveur.
 * @param {string} chemin - La route.
 * @param {object} [options] - Options axios (`params`).
 * @returns {Promise<any>} Le corps de la réponse.
 */
const lire = async (chemin, options) => (await (await client()).get(chemin, options)).data;

/**
 * Les actualités EN LIGNE de la collectivité, les plus récentes d'abord.
 * @param {string} collectiviteId - documentId.
 * @returns {Promise<object>} `{ data: [...] }`.
 */
export const getCollectiviteActualites = (collectiviteId) => lire(
  `/collectivites/${collectiviteId}/actualites`,
);

/**
 * Combien de clubs recevraient l'actualité, AVANT de publier.
 * @param {string} collectiviteId - documentId.
 * @param {{ audience: string, facilityId?: string | null }} cible - Les destinataires choisis.
 * @returns {Promise<object>} `{ data: { audience, clubsCount } }`.
 */
export const getActualiteRecipients = (collectiviteId, { audience, facilityId }) => lire(
  `/collectivites/${collectiviteId}/actualites-destinataires`,
  { params: { audience, ...(facilityId ? { facilityId } : {}) } },
);

/**
 * Publier.
 * @param {{ collectiviteId: string, data: Record<string, unknown> }} args
 * @returns {Promise<object>} `{ data: actualite }`.
 */
export const publishActualite = async ({ collectiviteId, data }) => {
  const http = await client();
  const response = await http.post(`/collectivites/${collectiviteId}/actualites`, { data });
  return response.data;
};

/**
 * Modifier (aucune nouvelle notification ne part).
 * @param {{ actualiteId: string, collectiviteId: string, data: Record<string, unknown> }} args
 * @returns {Promise<object>} `{ data: actualite }`.
 */
export const modifyActualite = async ({ actualiteId, collectiviteId, data }) => {
  const http = await client();
  const response = await http.put(
    `/collectivites/${collectiviteId}/actualites/${actualiteId}`,
    { data },
  );
  return response.data;
};

/**
 * Retirer : elle disparaît pour tous ses lecteurs.
 * @param {{ actualiteId: string, collectiviteId: string }} args
 * @returns {Promise<object>} `{ data: { documentId, retired } }`.
 */
export const retireActualite = async ({ actualiteId, collectiviteId }) => {
  const http = await client();
  const response = await http.delete(`/collectivites/${collectiviteId}/actualites/${actualiteId}`);
  return response.data;
};

/**
 * Le bloc « De la Ville de … » de la fiche d'UN club : la Ville du club (ou null), ses dernières
 * actualités que CE membre peut lire, et s'il a activé la notification (D68).
 * @param {string} clubId - documentId du club.
 * @returns {Promise<object>} `{ data: { actualites, collectivite, notify } }`.
 */
export const getClubCollectiviteActualites = (clubId) => lire(
  `/clubs/${clubId}/collectivite-actualites`,
);

/**
 * « Me prévenir des actualités de la Ville » (D68) : désactivé par défaut.
 * @param {{ clubId: string, notify: boolean }} args
 * @returns {Promise<object>} `{ data: { notify } }`.
 */
export const setClubCollectiviteActualitesNotify = async ({ clubId, notify }) => {
  const http = await client();
  const response = await http.put(
    `/clubs/${clubId}/collectivite-actualites/preference`,
    { data: { notify } },
  );
  return response.data;
};

/**
 * Le canal de la Ville d'un membre : toutes les actualités que SES clubs peuvent lire.
 * @returns {Promise<object>} `{ data: { actualites, collectivites } }`.
 */
export const getMesActualitesDeLaVille = () => lire('/collectivite-actualites/mine');

/**
 * La pièce choisie (sélecteur natif, `File` du navigateur, ou réponse de l'appareil photo),
 * ramenée à ce que `FormData` attend. Même lecture que le dépôt d'une pièce de licence
 * (`licenseService.normalizePickedFile`), qui la garde privée.
 * @param {any} brut - Ce que rend le sélecteur.
 * @returns {any | null} Le fichier, ou null.
 */
export const normalizeActualiteFile = (brut) => {
  if (!brut) return null;
  if (Array.isArray(brut)) return normalizeActualiteFile(brut[0]);
  if (brut?.assets?.[0]) return normalizeActualiteFile(brut.assets[0]);
  if (typeof File !== 'undefined' && brut instanceof File) return brut;
  const uri = brut.uri || brut.fileCopyUri || brut.path;
  if (!uri) return null;
  return {
    name: brut.name || brut.fileName || `piece-jointe-${Date.now()}`,
    type: brut.type || brut.mimeType || 'application/octet-stream',
    uri,
  };
};

/**
 * Téléverse UNE pièce jointe (`POST /upload`, comme la messagerie) et rend le fichier créé.
 * Le serveur de l'actualité vérifie ensuite qu'il existe.
 * @param {any} brut - Ce que rend le sélecteur.
 * @returns {Promise<{ id: number, mime?: string, name?: string, url?: string } | null>} Le
 *   fichier, ou null si rien n'a été choisi.
 */
export const uploadActualiteFile = async (brut) => {
  const fichier = normalizeActualiteFile(brut);
  if (!fichier) return null;
  const formData = new FormData();
  if (typeof File !== 'undefined' && fichier instanceof File) {
    formData.append('files', fichier, fichier.name || `piece-jointe-${Date.now()}`);
  } else {
    formData.append('files', /** @type {any} */ (fichier));
  }
  const token = (await session())?.token;
  // `fetch` plutôt qu'axios : Android perd le FormData d'axios (Conversation.js, même choix).
  const response = await fetch(`${getApiBaseUrl()}/upload`, {
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    method: 'POST',
  });
  const texte = await response.text();
  let corps = null;
  try {
    corps = texte ? JSON.parse(texte) : null;
  } catch {
    corps = null;
  }
  if (!response.ok) {
    throw new Error(corps?.error?.message || `HTTP ${response.status}`);
  }
  const [premier] = Array.isArray(corps) ? corps : [];
  return premier || null;
};
