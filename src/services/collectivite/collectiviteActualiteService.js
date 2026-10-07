import { colors } from '@/theme/colors';

import { createLogger } from '@/utils/logger/logger';

import { getApiBaseUrl } from '@/config/runtimeUrls';
import { PHOTO_MAX_DIMENSION, PHOTO_QUALITY } from '@/platform/media/photoLimits';

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

// VILLE-T18D : la durée d'un envoi (transfert, puis réponse du serveur) part au journal de
// l'écran ; la tournée suivante la lit au lieu de la deviner.
const journal = createLogger('collectivite-actualite');

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
 * @returns {Promise<any>} `{ data: [...] }`.
 */
export const getCollectiviteActualites = (collectiviteId) => lire(
  `/collectivites/${collectiviteId}/actualites`,
);

/**
 * Combien de clubs recevraient l'actualité, AVANT de publier.
 * @param {string} collectiviteId - documentId.
 * @param {{ audience: string, facilityId?: string | null }} cible - Les destinataires choisis.
 * @returns {Promise<any>} `{ data: { audience, clubsCount } }`.
 */
export const getActualiteRecipients = (collectiviteId, { audience, facilityId }) => lire(
  `/collectivites/${collectiviteId}/actualites-destinataires`,
  { params: { audience, ...(facilityId ? { facilityId } : {}) } },
);

/**
 * Publier.
 * @param {{ collectiviteId: string, data: Record<string, unknown> }} args
 * @returns {Promise<any>} `{ data: actualite }`.
 */
export const publishActualite = async ({ collectiviteId, data }) => {
  const http = await client();
  const response = await http.post(`/collectivites/${collectiviteId}/actualites`, { data });
  return response.data;
};

/**
 * Modifier (aucune nouvelle notification ne part).
 * @param {{ actualiteId: string, collectiviteId: string, data: Record<string, unknown> }} args
 * @returns {Promise<any>} `{ data: actualite }`.
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
 * @returns {Promise<any>} `{ data: { documentId, retired } }`.
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
 * @returns {Promise<any>} `{ data: { actualites, collectivite, notify } }`.
 */
export const getClubCollectiviteActualites = (clubId) => lire(
  `/clubs/${clubId}/collectivite-actualites`,
);

/**
 * « Me prévenir des actualités de la Ville » (D68) : désactivé par défaut.
 * @param {{ clubId: string, notify: boolean }} args
 * @returns {Promise<any>} `{ data: { notify } }`.
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
 * @returns {Promise<any>} `{ data: { actualites, collectivites } }`.
 */
export const getMesActualitesDeLaVille = () => lire('/collectivite-actualites/mine');

/**
 * Le bandeau part (ouvert ou masqué) : la date de lecture de CES Villes passe à maintenant.
 * @param {string[] | null} collectiviteIds - Les Villes concernées ; null : toutes les siennes.
 * @returns {Promise<any>} `{ data: { collectiviteIds, seenUntil } }`.
 */
export const markActualitesVues = async (collectiviteIds) => {
  const http = await client();
  const response = await http.put('/collectivite-actualites/mine/seen', {
    data: collectiviteIds ? { collectiviteIds } : {},
  });
  return response.data;
};

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
 * 🐞 COLL-FIX2 (03/10) — ENVOYER LE FORMULAIRE, ET SAVOIR POURQUOI IL N'EST PAS PARTI.
 * Tournées T9 et T10 : « Network request failed » et AUCUN POST /upload. Sur Android, React Native
 * rend exactement cette erreur quand il ne peut pas CONSTRUIRE le corps (NetworkingModule :
 * « Could not retrieve file for uri … », « Binary FormData part needs a content-type header. ») :
 * la requête ne part jamais. `fetch` lit la réponse en `blob` et jette cette raison ; un
 * XMLHttpRequest en TEXTE la garde dans `responseText`. L'erreur la porte (`natif`), le journal
 * de l'écran la montre : la prochaine tournée lira la vraie cause au lieu de la deviner.
 * ⏱️ VILLE-T18D (07/10) — l'envoi dit aussi où il en est (`upload.onprogress`, fraction envoyée)
 * et quand le dernier octet est parti : la réponse sépare le TRANSFERT de l'attente du serveur.
 * @param {string} url - L'adresse de `/upload`.
 * @param {FormData} formData - Le formulaire.
 * @param {string | null | undefined} token - Le jeton du compte.
 * @param {((fraction: number) => void) | undefined} onProgress - La fraction envoyée, de 0 à 1.
 * @returns {Promise<{ envoiMs: number | null, ok: boolean, status: number, texte: string,
 *   totalMs: number }>} La réponse.
 */
const envoyerLeFormulaire = (url, formData, token, onProgress) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  const debut = Date.now();
  /** @type {number | null} */
  let envoyeA = null;
  xhr.open('POST', url);
  if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  xhr.timeout = 45000;
  if (xhr.upload) {
    xhr.upload.onprogress = (/** @type {any} */ evenement) => {
      const total = Number(evenement?.total) || 0;
      if (total <= 0) return;
      const fraction = Math.min(1, Number(evenement?.loaded || 0) / total);
      if (fraction >= 1 && envoyeA === null) envoyeA = Date.now();
      onProgress?.(fraction);
    };
  }
  xhr.onload = () => resolve({
    envoiMs: envoyeA === null ? null : envoyeA - debut,
    ok: xhr.status >= 200 && xhr.status < 300,
    status: xhr.status,
    texte: xhr.responseText || '',
    totalMs: Date.now() - debut,
  });
  const echec = (/** @type {string} */ quoi) => () => {
    const natif = String(xhr.responseText || '').trim() || null;
    reject(Object.assign(new Error(natif ? `${quoi} : ${natif}` : quoi), { natif }));
  };
  xhr.onerror = echec('Network request failed');
  xhr.ontimeout = echec('Network request timed out');
  xhr.send(formData);
});

/**
 * Le corps rendu par `/upload` : le 1er fichier créé, ou une erreur qui dit le statut.
 * @param {{ ok: boolean, status: number, texte: string }} reponse - La réponse.
 * @returns {any} Le fichier créé, ou null.
 */
const lireLeFichierCree = (reponse) => {
  let corps = null;
  try {
    corps = reponse.texte ? JSON.parse(reponse.texte) : null;
  } catch {
    corps = null;
  }
  if (!reponse.ok) {
    throw new Error(corps?.error?.message || `HTTP ${reponse.status}`);
  }
  const [premier] = Array.isArray(corps) ? corps : [];
  return premier || null;
};

/**
 * Téléverse UNE pièce déjà normalisée : le VRAI envoi, sans import à l'appel (testable).
 * 🐞 COLL-FIX2 (03/10) — comme la messagerie, qui envoie des documents (Conversation.js,
 * `uploadAttachmentAsset`) : un 1er envoi direct, et si la requête n'a pas pu partir, un 2e par
 * le client HTTP de l'app. Si les deux échouent, c'est l'erreur du 1er qui remonte : elle porte la
 * raison native.
 * @param {{ fichier: any, octets?: number | null, onProgress?: (fraction: number) => void,
 *   secours?: (formData: FormData) => Promise<any>, token?: string | null, url: string }} envoi -
 *   La pièce, son poids (pour le journal), la progression, l'adresse, le jeton, l'envoi de
 *   secours (rend `data`).
 * @returns {Promise<any>} Le fichier créé, ou null.
 */
export const televerserLaPiece = async ({
  fichier, octets = null, onProgress, secours, token, url,
}) => {
  const formData = new FormData();
  if (typeof File !== 'undefined' && fichier instanceof File) {
    formData.append('files', fichier, fichier.name || `piece-jointe-${Date.now()}`);
  } else {
    formData.append('files', /** @type {any} */ (fichier));
  }
  let reponse;
  try {
    reponse = await envoyerLeFormulaire(url, formData, token, onProgress);
    // VILLE-T18D : le transfert (dernier octet parti) et l'attente du serveur, séparés.
    journal.info('Piece jointe envoyee', {
      envoiMs: reponse.envoiMs,
      octets: Number(octets) > 0 ? Number(octets) : null,
      reponseMs: reponse.envoiMs === null ? null : reponse.totalMs - reponse.envoiMs,
      statut: reponse.status,
      totalMs: reponse.totalMs,
    });
  } catch (erreur) {
    if (!secours) throw erreur;
    try {
      const data = await secours(formData);
      const [premier] = Array.isArray(data) ? data : [];
      return premier || null;
    } catch {
      throw erreur;
    }
  }
  return lireLeFichierCree(reponse);
};

// Une photo du site déjà légère (moins de 300 Ko) et petite (2048 px au plus) part telle quelle.
const SEUIL_REENCODAGE_OCTETS = 300 * 1024;
const PHOTO_DU_NAVIGATEUR = /^image\/(jpeg|png|webp)$/i;

/**
 * 📏 VILLE-T18D (07/10) — LE SITE RÉDUIT UNE PHOTO COMME LE TÉLÉPHONE, avant de l'envoyer.
 * Au téléphone, react-native-image-picker la réduit déjà (PHOTO_PICKER_LIMITS, platform/media) ;
 * le navigateur, lui, envoyait la photo telle que choisie (4 à 8 Mo pour une photo d'appareil).
 * Mêmes règles ici (2048 px de côté, JPEG 0,8), par une toile du navigateur ; le fond est blanc
 * (un JPEG n'a pas de transparence). Une photo déjà sous les limites, un format que le
 * navigateur ne sait pas lire (HEIC), un résultat plus lourd ou un échec : l'original part.
 * ponytail: seule la pièce d'une ACTUALITÉ passe ici ; la messagerie et l'avatar du site n'ont
 * toujours aucune réduction (voie de sortie : appeler cette fonction depuis platform/media).
 * @param {any} fichier - Ce que rend le sélecteur (un `File` sur le site).
 * @param {any} [env] - Le navigateur (`createImageBitmap`, `document`) ; doublé par les témoins.
 * @returns {Promise<any>} La photo réduite (un `File` JPEG), ou le fichier reçu.
 */
export const reduirePhotoDuNavigateur = async (
  fichier,
  env = typeof window === 'undefined' ? {} : window,
) => {
  if (typeof File === 'undefined' || !(fichier instanceof File)) return fichier;
  if (!PHOTO_DU_NAVIGATEUR.test(fichier.type)) return fichier;
  try {
    const image = await env.createImageBitmap(fichier, { imageOrientation: 'from-image' });
    const cote = Math.max(image.width, image.height);
    if (cote <= PHOTO_MAX_DIMENSION && fichier.size <= SEUIL_REENCODAGE_OCTETS) {
      image.close?.();
      return fichier;
    }
    const echelle = Math.min(1, PHOTO_MAX_DIMENSION / cote);
    const largeur = Math.round(image.width * echelle);
    const hauteur = Math.round(image.height * echelle);
    const toile = env.document.createElement('canvas');
    toile.width = largeur;
    toile.height = hauteur;
    const dessin = toile.getContext('2d');
    dessin.fillStyle = colors.neutral00;
    dessin.fillRect(0, 0, largeur, hauteur);
    dessin.drawImage(image, 0, 0, largeur, hauteur);
    image.close?.();
    const jpeg = await new Promise((resolve) => {
      toile.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY);
    });
    if (!jpeg || jpeg.size >= fichier.size) return fichier;
    const nom = `${String(fichier.name || 'photo').replace(/\.[^.]+$/, '')}.jpg`;
    return new File([jpeg], nom, { lastModified: Date.now(), type: 'image/jpeg' });
  } catch {
    return fichier;
  }
};

/**
 * Téléverse UNE pièce jointe (`POST /upload`, comme la messagerie) et rend le fichier créé.
 * Le serveur de l'actualité vérifie ensuite qu'il existe.
 * @param {any} brut - Ce que rend le sélecteur.
 * @param {{ onProgress?: (fraction: number) => void }} [options] - VILLE-T18D : la fraction
 *   envoyée, pour l'écran.
 * @returns {Promise<{ id: number, mime?: string, name?: string, url?: string } | null>} Le
 *   fichier, ou null si rien n'a été choisi.
 */
export const uploadActualiteFile = async (brut, { onProgress } = {}) => {
  const choisi = await reduirePhotoDuNavigateur(brut);
  const fichier = normalizeActualiteFile(choisi);
  if (!fichier) return null;
  const token = (await session())?.token;
  const premier = Array.isArray(choisi) ? choisi[0] : choisi;
  return televerserLaPiece({
    fichier,
    octets: premier?.size ?? premier?.assets?.[0]?.fileSize ?? premier?.fileSize ?? null,
    onProgress,
    secours: async (formData) => (await (await client()).post('/upload', formData, {
      timeout: 45000,
    })).data,
    token,
    url: `${getApiBaseUrl()}/upload`,
  });
};
