import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { formatDateWithDayPrefix } from '@/utils/date';

/**
 * COLLECTIVITES 1c (2026-09-29) — ce que les ecrans « Ma collectivite » affichent, en
 * fonctions PURES : aucun appel reseau, aucun client HTTP importe. N importe quel ecran
 * (ou le site) les importe sans doublure de test (memoire
 * piege-env-absent-worktree-import-service : les hooks restent dans services/).
 */

/**
 * La collectivite `collectiviteId` parmi celles que je gere, ou `null`.
 * @param {unknown} collectivites - La reponse de `/collectivites/mine`.
 * @param {string | null | undefined} collectiviteId - documentId recherche.
 * @returns {{ documentId?: string, name?: string, type?: string } | null} La collectivite, ou
 *   null si je ne la gere pas.
 */
export const findManagedCollectivite = (collectivites, collectiviteId) => {
  if (!Array.isArray(collectivites) || !collectiviteId) return null;
  return collectivites.find((collectivite) => collectivite?.documentId === collectiviteId) || null;
};

/**
 * « 18:00 » depuis une date ISO, a l heure du telephone ; '' si illisible.
 * @param {string | null | undefined} value - Date ISO.
 * @returns {string} L heure.
 */
const formatHour = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const deux = (/** @type {number} */ valeur) => String(valeur).padStart(2, '0');
  return `${deux(date.getHours())}:${deux(date.getMinutes())}`;
};

/**
 * Le moment d une demande ou d un occupant : « jeu 01/10/2026 · 18:00 – 19:30 ».
 * @param {string | null | undefined} start - Debut (ISO).
 * @param {string | null | undefined} end - Fin (ISO).
 * @returns {string} Le libelle, ou '' si le debut est illisible.
 */
export const formatSlot = (start, end) => {
  const day = formatDateWithDayPrefix(start, { fallback: '' });
  if (!day) return '';
  const from = formatHour(start);
  const to = formatHour(end);
  return to ? `${day} · ${from} – ${to}` : `${day} · ${from}`;
};

/**
 * Les horaires d ouverture d une installation : « 08:00 – 22:00 » ; '' s il en manque un.
 * @param {string | null | undefined} openingTime - « HH:MM[:SS[.mmm]] ».
 * @param {string | null | undefined} closingTime - « HH:MM[:SS[.mmm]] ».
 * @returns {string} Le libelle.
 */
export const formatOpeningHours = (openingTime, closingTime) => {
  const open = String(openingTime || '').slice(0, 5);
  const close = String(closingTime || '').slice(0, 5);
  return open && close ? `${open} – ${close}` : '';
};

// COLL-C2C (02/10) — l ÉCUSSON d une collectivité, faute de logo (planches P8-club-tel et
// P8-abonnement-tel) : l initiale de son nom propre, « Ville de Montrivage » => « M ».
// ponytail: seuls les noms communs ci-dessous sont sautés (« Communauté de communes du Val »
// donne « C ») ; voie de sortie : un logo de collectivité, champ à créer.
const NOM_COMMUN_DE_COLLECTIVITE = /^(ville|commune|mairie|m[ée]tropole|r[ée]gion|d[ée]partement|collectivit[ée])\s+(de\s+(la\s+|l['’])?|du\s+|des\s+|d['’])?/i;

/**
 * L initiale d une collectivité, pour son écusson.
 * @param {string | null | undefined} name - Son nom (« Ville de Montrivage »).
 * @returns {string} Une lettre capitale, ou vide.
 */
export const collectiviteInitial = (name) => {
  const nom = String(name || '').trim();
  const propre = nom.replace(NOM_COMMUN_DE_COLLECTIVITE, '').trim() || nom;
  return propre.charAt(0).toLocaleUpperCase();
};

/**
 * « HH:MM » depuis la valeur du serveur (« 08:00:00.000 »), pour un champ de saisie.
 * @param {string | null | undefined} value - L horaire.
 * @returns {string} « HH:MM » ou ''.
 */
export const toTimeInput = (value) => String(value || '').slice(0, 5);

/**
 * Un nombre de la collectivite pour l accueil : le nombre, « … » pendant la lecture,
 * « — » si la lecture a echoue (jamais un 0 invente).
 * @param {{ data?: unknown, error?: unknown, isLoading?: boolean }} query - Resultat react-query.
 * @returns {string} Le libelle.
 */
export const countLabel = (query) => {
  if (query?.isLoading) return '…';
  if (query?.error || !Array.isArray(query?.data)) return '—';
  return String(query.data.length);
};

// ─── CONSOLE SUPER-ADMIN (D61, 2026-09-29) : « nous » activons, rattachons, nommons ───

/** Les types du serveur (admin collectivite/schema.json), dans l ordre des puces. */
export const COLLECTIVITE_TYPES = ['commune', 'intercommunalite', 'departement', 'region'];

/**
 * Le libelle d un type de collectivite (une cle par type : chacune reste lisible par
 * frClefsAtteignables).
 * @param {(cle: string, repli: string) => string} t - La traduction de l ecran.
 * @param {unknown} type - Le type du serveur.
 * @returns {string} Le libelle, ou le type brut s il est inconnu.
 */
export const collectiviteTypeLabel = (t, type) => {
  switch (type) {
    case 'commune': return t('adminCollectivites.types.commune', 'Commune');
    case 'departement': return t('adminCollectivites.types.departement', 'Département');
    case 'intercommunalite':
      return t('adminCollectivites.types.intercommunalite', 'Intercommunalité');
    case 'region': return t('adminCollectivites.types.region', 'Région');
    default: return String(type || '');
  }
};

// D59 — le nom se saisit sous sa forme OFFICIELLE : le bandeau « Offert par la Ville de X »
// le lit tel quel (formatCollectiviteOfferedBy lui donne son article). Un prefixe par type,
// majuscule comprise ; le nom propre suit, jamais vide.
const OFFICIAL_NAME_PATTERNS = {
  commune: /^(Ville|Commune) (de |d['’]|du |des )\S/u,
  departement: /^(Département (de |d['’]|du |des )|Conseil départemental (de |d['’]|du |des ))\S/u,
  intercommunalite: /^(Communauté (de communes |d['’]agglomération |urbaine )|Métropole )\S/u,
  region: /^(Région |Conseil régional (de |d['’]|du |des ))\S/u,
};

// Codes officiels, memes regles que le serveur (collectivite service, readCreatePayload).
const INSEE_PATTERN = /^(\d{2}|2A|2B)\d{3}$/;
const SIREN_PATTERN = /^\d{9}$/;

/**
 * Le nom respecte-t-il la forme officielle de son type (D59) ?
 * @param {unknown} name - Le nom saisi.
 * @param {unknown} type - `commune`, `intercommunalite`, `departement` ou `region`.
 * @returns {boolean} Vrai si le nom commence par un prefixe officiel de ce type.
 */
export const isOfficialCollectiviteName = (name, type) => {
  const motif = /** @type {Record<string, RegExp>} */ (OFFICIAL_NAME_PATTERNS)[String(type)];
  return Boolean(motif) && motif.test(String(name || '').trim());
};

/**
 * COLL-CONSOLE-BIS (03/10/2026) — le NOM OFFICIEL d une commune trouvee dans le referentiel de
 * l Etat (D59), avec son article : « Valfleuri » → « Ville de Valfleuri », « Aix » → « Ville
 * d’Aix », « Le Havre » → « Ville du Havre », « Les Mureaux » → « Ville des Mureaux ». « La »
 * et « L’ » ne se contractent pas (« Ville de La Rochelle »). Un nom FRANCAIS, quelle que soit
 * la langue de l ecran, comme le prefixe que pose le formulaire (le dictionnaire anglais porte
 * les memes valeurs).
 * @param {(cle: string, repli: string, options?: object) => string} t - La traduction.
 * @param {unknown} nom - Le nom de la commune, tel que le referentiel l ecrit.
 * @returns {string} Le nom officiel, ou '' sans nom.
 */
export const nomOfficielDeCommune = (t, nom) => {
  const propre = String(nom || '').trim();
  if (!propre) return '';
  if (/^le /iu.test(propre)) {
    return t('collectiviteConsoleBis.commune.nomDu', 'Ville du {{nom}}', {
      nom: propre.slice(3), ...SANS_ECHAPPEMENT,
    });
  }
  if (/^les /iu.test(propre)) {
    return t('collectiviteConsoleBis.commune.nomDes', 'Ville des {{nom}}', {
      nom: propre.slice(4), ...SANS_ECHAPPEMENT,
    });
  }
  if (/^[aeiouyhàâäéèêëîïôöùûüœæ]/iu.test(propre)) {
    return t('collectiviteConsoleBis.commune.nomElide', 'Ville d’{{nom}}', {
      nom: propre, ...SANS_ECHAPPEMENT,
    });
  }
  return t('collectiviteConsoleBis.commune.nomDe', 'Ville de {{nom}}', {
    nom: propre, ...SANS_ECHAPPEMENT,
  });
};

/**
 * Lit le formulaire de creation : les champs nettoyes, et la liste des fautes (cles de
 * traduction sous `adminCollectivites.form.errors`). Vide = pret a partir. Le serveur
 * reste juge (400, 409) : ce controle evite l aller-retour et porte D59, que lui ignore.
 * @param {{ codeInsee?: string, email?: string, name?: string, phoneNumber?: string,
 *   siren?: string, type?: string }} form - Les champs saisis.
 * @returns {{ data: Record<string, string>, errors: string[] }} Le corps et les fautes.
 */
export const readCollectiviteCreateForm = (form) => {
  const lire = (/** @type {unknown} */ valeur) => String(valeur || '').trim();
  const type = lire(form?.type);
  const data = {
    codeInsee: lire(form?.codeInsee).toUpperCase(),
    email: lire(form?.email),
    name: lire(form?.name),
    phoneNumber: lire(form?.phoneNumber),
    siren: lire(form?.siren).replace(/\s/g, ''),
    type,
  };
  const errors = [];
  if (!COLLECTIVITE_TYPES.includes(type)) errors.push('type');
  else if (!isOfficialCollectiviteName(data.name, type)) errors.push('officialName');
  if (data.codeInsee && !INSEE_PATTERN.test(data.codeInsee)) errors.push('codeInsee');
  if (data.siren && !SIREN_PATTERN.test(data.siren)) errors.push('siren');
  if (!data.codeInsee && !data.siren) errors.push('identifier');
  return {
    // Un champ facultatif vide ne part pas : le serveur le lirait comme une valeur.
    data: Object.fromEntries(Object.entries(data).filter(([, valeur]) => valeur !== '')),
    errors,
  };
};

/**
 * Une collectivite telle que la liste de la console la lit. `isActive` n est vrai que
 * s il vaut VRAI : une ligne d avant le lot 1d lit NULL, donc inactive (meme regle que
 * le serveur, collectivite service `isActive`).
 * COLL-CONSOLE-BIS (03/10) — + `activatedAt` (la date de l activation en cours, ou null : une
 * Ville activee avant le lot, ou inactive).
 * @param {any} entry - Une ligne de `/superadmin/content/.../list`.
 * @returns {{ activatedAt: string | null, clubsCount: number, documentId: string,
 *   isActive: boolean, name: string, type: string }} La ligne.
 */
export const toAdminCollectiviteRow = (entry) => ({
  activatedAt: typeof entry?.activatedAt === 'string' ? entry.activatedAt : null,
  clubsCount: Array.isArray(entry?.clubs) ? entry.clubs.length : 0,
  documentId: String(entry?.documentId || ''),
  isActive: entry?.isActive === true,
  name: String(entry?.name || ''),
  type: String(entry?.type || ''),
});

/**
 * Le detail d une collectivite pour la console : ses clubs, ses gestionnaires (nom et
 * e-mail, rien d autre) et ses installations, tries par nom.
 * @param {any} entry - La ligne de `/superadmin/content/.../list` filtree sur la collectivite.
 * @returns {any} Le detail, ou null sans ligne.
 */
export const toAdminCollectiviteDetail = (entry) => {
  if (!entry?.documentId) return null;
  const liste = (/** @type {unknown} */ valeur) => (Array.isArray(valeur) ? valeur : []);
  const parNom = (/** @type {any} */ a, /** @type {any} */ b) => String(a.name)
    .localeCompare(String(b.name), 'fr');
  return {
    ...toAdminCollectiviteRow(entry),
    clubs: liste(entry.clubs).map((club) => ({
      documentId: String(club?.documentId || ''),
      logoUrl: club?.logo?.url || null,
      name: String(club?.name || ''),
    })).sort(parNom),
    codeInsee: entry.codeInsee || null,
    gestionnaires: liste(entry.gestionnaires).map((compte) => ({
      documentId: String(compte?.documentId || ''),
      email: compte?.email || null,
      name: [compte?.firstname, compte?.lastname].filter(Boolean).join(' '),
    })).sort(parNom),
    installations: liste(entry.installations).map((installation) => ({
      documentId: String(installation?.documentId || ''),
      maxSlots: Number.isInteger(installation?.maxSlots) ? installation.maxSlots : null,
      name: String(installation?.name || ''),
      type: installation?.type || null,
    })).sort(parNom),
    siren: entry.siren || null,
  };
};
