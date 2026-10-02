import { formatDateWithDayPrefix } from '@/utils/date';

/**
 * 📰 COLL-C4A (02/10/2026) — LES ACTUALITÉS DE LA VILLE, en fonctions PURES : aucun appel réseau,
 * aucun client HTTP importé (mémoire piege-env-absent-worktree-import-service : l'accueil des
 * clubs, la fiche du club et le site les importent sans doublure de test).
 *
 * Design validé HY521H1 page 3 (planches P3b-actu-tel et -ordi, P3b-bandeau-tel) ; serveur :
 * `api::collectivite-actualite` (admin fix/COLL-C4A-admin). La mairie y parle en son nom (vous) ;
 * personne n'y répond : l'actualité est en LECTURE SEULE pour les membres.
 */

/** Les types, dans l'ordre de la planche. */
export const ACTUALITE_CATEGORIES = Object.freeze([
  'fermeture', 'forum', 'subventions', 'travaux', 'autre',
]);

/** Les destinataires : tous les membres, les dirigeants, ou les clubs d'une installation. */
export const ACTUALITE_AUDIENCES = Object.freeze(['membres', 'dirigeants', 'installation']);

// Mêmes bornes que le serveur (collectivite-actualite.ts) : c'est lui le juge.
export const ACTUALITE_TITLE_MAX = 120;
export const ACTUALITE_BODY_MAX = 2000;
export const ACTUALITE_ATTACHMENTS_MAX = 6;

const REPLIS_TYPES = {
  autre: 'Autre',
  fermeture: 'Fermeture',
  forum: 'Forum, manifestation',
  subventions: 'Subventions',
  travaux: 'Travaux',
};

/**
 * Le libellé d'un type d'actualité.
 * @param {(cle: string, repli: string) => string} t - La traduction.
 * @param {unknown} categorie - Le type rendu par le serveur.
 * @returns {string} Le libellé.
 */
export const categoryLabel = (t, categorie) => {
  const cle = ACTUALITE_CATEGORIES.includes(String(categorie)) ? String(categorie) : 'autre';
  return t(`collectiviteActualites.categories.${cle}`, REPLIS_TYPES[/** @type {'autre'} */ (cle)]);
};

/**
 * Le libellé d'un choix de destinataires (« Pour qui »).
 * @param {(cle: string, repli: string) => string} t - La traduction.
 * @param {unknown} audience - `membres`, `dirigeants` ou `installation`.
 * @returns {string} Le libellé.
 */
export const audienceLabel = (t, audience) => {
  if (audience === 'dirigeants') {
    return t('collectiviteActualites.audiences.dirigeants', 'Les dirigeants');
  }
  if (audience === 'installation') {
    return t('collectiviteActualites.audiences.installation', 'Les clubs d’une installation');
  }
  return t('collectiviteActualites.audiences.membres', 'Tous les membres');
};

/**
 * La couleur d'un type (planche : une fermeture prend la couleur d'attention, les subventions le
 * cyan de la marque). Jamais l'or, réservé à la League.
 * @param {unknown} categorie - Le type.
 * @returns {'warning' | 'primary' | 'success' | 'neutral'} Le ton.
 */
export const categoryTone = (categorie) => {
  if (categorie === 'fermeture' || categorie === 'travaux') return 'warning';
  if (categorie === 'subventions') return 'primary';
  if (categorie === 'forum') return 'success';
  return 'neutral';
};

/**
 * « Envoyée aux membres des 3 clubs » : à qui elle est partie, en NOMBRES (jamais une personne,
 * et jamais « lue par n » : ce compteur n'existe pas).
 * @param {(cle: string, repli: string, options?: object) => string} t - La traduction.
 * @param {{ audience?: unknown, clubsCount?: unknown }} actualite - `audience`, et
 *   `recipients.clubsCount`.
 * @returns {string} La ligne.
 */
export const recipientsLine = (t, { audience, clubsCount }) => {
  const nombre = Number.isInteger(clubsCount) ? Number(clubsCount) : 0;
  const un = nombre === 1;
  if (audience === 'dirigeants') {
    return un
      ? t('collectiviteActualites.envoyee.dirigeantsUn', 'Envoyée aux dirigeants d’1 club')
      : t(
        'collectiviteActualites.envoyee.dirigeants',
        'Envoyée aux dirigeants des {{nombre}} clubs',
        { nombre },
      );
  }
  if (audience === 'installation') {
    return un
      ? t(
        'collectiviteActualites.envoyee.installationUn',
        'Envoyée aux membres d’1 club de l’installation',
      )
      : t(
        'collectiviteActualites.envoyee.installation',
        'Envoyée aux membres des {{nombre}} clubs de l’installation',
        { nombre },
      );
  }
  return un
    ? t('collectiviteActualites.envoyee.membresUn', 'Envoyée aux membres d’1 club')
    : t(
      'collectiviteActualites.envoyee.membres',
      'Envoyée aux membres des {{nombre}} clubs',
      { nombre },
    );
};

/**
 * La phrase AVANT de publier (planche P3b-actu-tel, écran 1) : qui la recevra, qui est prévenu,
 * et que personne n'y répond.
 * @param {(cle: string, repli: string, options?: object) => string} t - La traduction.
 * @param {{ audience: string, clubsCount: number | null }} cible - Les destinataires choisis.
 * @returns {string} La phrase ; « … » tant que le nombre n'est pas connu.
 */
export const audiencePreview = (t, { audience, clubsCount }) => {
  if (!Number.isInteger(clubsCount)) {
    return t('collectiviteActualites.apercu.calcul', 'Nous comptons les clubs qui la recevront…');
  }
  const nombre = Number(clubsCount);
  if (nombre === 0) {
    return t(
      'collectiviteActualites.apercu.aucun',
      'Aucun club ne la recevra pour l’instant : aucun club rattaché ne correspond à ce choix.',
    );
  }
  if (audience === 'dirigeants') {
    return nombre === 1
      ? t(
        'collectiviteActualites.apercu.dirigeantsUn',
        'Reçue par les dirigeants d’1 club rattaché, avec une notification. Personne n’y répond.',
      )
      : t(
        'collectiviteActualites.apercu.dirigeants',
        // eslint-disable-next-line max-len
        'Reçue par les dirigeants des {{nombre}} clubs rattachés, avec une notification. Personne n’y répond.',
        { nombre },
      );
  }
  const qui = nombre === 1
    ? t('collectiviteActualites.apercu.membresUn', 'Reçue par les membres d’1 club.')
    : t(
      'collectiviteActualites.apercu.membres',
      'Reçue par les membres des {{nombre}} clubs.',
      { nombre },
    );
  return `${qui} ${t(
    'collectiviteActualites.apercu.notification',
    // eslint-disable-next-line max-len
    'Une notification part aux dirigeants, aux entraîneurs et aux membres qui l’ont activée. Personne n’y répond.',
  )}`;
};

/**
 * La date de publication : « aujourd'hui », ou le jour (« mar 29/09/2026 »).
 * @param {(cle: string, repli: string) => string} t - La traduction.
 * @param {unknown} valeur - `publishedAt`.
 * @param {Date} [maintenant] - Maintenant (témoins).
 * @returns {string} Le libellé, ou ''.
 */
export const publicationDateLabel = (t, valeur, maintenant = new Date()) => {
  const date = typeof valeur === 'string' || valeur instanceof Date ? new Date(valeur) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  if (date.toDateString() === maintenant.toDateString()) {
    return t('collectiviteActualites.aujourdhui', 'aujourd’hui');
  }
  return formatDateWithDayPrefix(date, { fallback: '' });
};

// Le bandeau de l'accueil : une actualité de moins de 7 jours (planche P3b-bandeau-tel, écran 6).
export const BANDEAU_JOURS = 7;
const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Le bandeau de la MAIRIE (« Votre actualité · en ligne ») : sa dernière actualité, en ligne
 * depuis moins de 7 jours, et pas celle qu'elle a masquée. Une plus récente le fait revenir.
 * @param {unknown} actualites - `/collectivites/:id/actualites` (les plus récentes d'abord).
 * @param {string | null} masquee - documentId de l'actualité masquée sur cet appareil.
 * @param {Date} [maintenant] - Maintenant (témoins).
 * @returns {any | null} L'actualité à montrer, ou null.
 */
export const bandeauMairie = (actualites, masquee, maintenant = new Date()) => {
  const derniere = Array.isArray(actualites) ? actualites[0] : null;
  if (!derniere?.documentId || derniere.documentId === masquee) return null;
  const publiee = new Date(String(derniere.publishedAt || '')).getTime();
  if (!Number.isFinite(publiee)) return null;
  return maintenant.getTime() - publiee <= BANDEAU_JOURS * JOUR_MS ? derniere : null;
};

/**
 * L'initiale d'une Ville pour son écusson, faute de blason : « Ville de Montrivage » ⇒ « M ».
 * @param {unknown} nom - Le nom de la collectivité.
 * @returns {string} Une lettre majuscule, ou « ? ».
 */
export const villeInitiale = (nom) => {
  const mots = String(nom || '').trim().split(/[\s\-']+/u).filter((mot) => /\p{L}/u.test(mot));
  const dernier = mots[mots.length - 1] || '';
  return (dernier.match(/\p{L}/u) || ['?'])[0].toUpperCase();
};

/**
 * Une pièce jointe est-elle une image ?
 * @param {any} fichier - La pièce (`mime`, `ext`, `name`).
 * @returns {boolean} Vrai pour une photo.
 */
export const isImageAttachment = (fichier) => {
  const mime = String(fichier?.mime || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(String(fichier?.name || fichier?.ext || ''));
};

/**
 * L'étiquette d'une pièce jointe (« PDF », « DOC », « IMG »), comme la messagerie.
 * @param {any} fichier - La pièce.
 * @returns {string} L'étiquette.
 */
export const attachmentBadge = (fichier) => {
  if (isImageAttachment(fichier)) return 'IMG';
  const mime = String(fichier?.mime || '').toLowerCase();
  const ext = String(fichier?.ext || fichier?.name || '').split('.').pop()?.toLowerCase() || '';
  if (mime.includes('pdf') || ext === 'pdf') return 'PDF';
  if (mime.includes('word') || ['doc', 'docx', 'odt'].includes(ext)) return 'DOC';
  return ext ? ext.slice(0, 4).toUpperCase() : 'DOC';
};

/**
 * Les fautes du formulaire « Nouvelle actualité ». Vide = prêt à publier. Le serveur reste juge.
 * @param {{ audience: string, body?: string, facilityId?: string | null, title?: string }} form
 * @returns {Record<string, 'required' | 'tooLong'>} Une clef par champ fautif.
 */
export const actualiteFormErrors = (form) => {
  /** @type {Record<string, 'required' | 'tooLong'>} */
  const fautes = {};
  const titre = String(form?.title || '').trim();
  if (!titre) fautes.title = 'required';
  else if (titre.length > ACTUALITE_TITLE_MAX) fautes.title = 'tooLong';
  if (String(form?.body || '').trim().length > ACTUALITE_BODY_MAX) fautes.body = 'tooLong';
  if (form?.audience === 'installation' && !form?.facilityId) fautes.facility = 'required';
  return fautes;
};

/**
 * Le corps envoyé au serveur (publier ou modifier) : liste blanche.
 * @param {{ attachments?: Array<{ id?: number }>, audience: string, body?: string,
 *   category: string, facilityId?: string | null, title?: string }} form
 * @returns {Record<string, unknown>} Le corps.
 */
export const toActualitePayload = (form) => ({
  attachments: (Array.isArray(form?.attachments) ? form.attachments : [])
    .map((fichier) => Number(fichier?.id))
    .filter((id) => Number.isInteger(id) && id > 0),
  audience: form?.audience,
  body: String(form?.body || '').trim(),
  category: form?.category,
  ...(form?.audience === 'installation' ? { facilityId: form?.facilityId || null } : {}),
  title: String(form?.title || '').trim(),
});
