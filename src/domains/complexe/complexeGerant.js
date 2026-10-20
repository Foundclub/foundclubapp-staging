import { RouteNames } from '@/navigation/routeNames';

import { getErrorStatus, getServerErrorCode } from '@/utils/errors/displayError';

import { isBirthdateUnderAge, PARENTAL_POWER_ENDS_AGE } from '@/constants/parentalDeclaration';

/**
 * LE GÉRANT DE COMPLEXE, SES GESTES — RESA-L5A1 (13/10/2026), chantier Réservation.
 *
 * Les règles PURES des écrans du gérant qui parlent au serveur : ce que « Créer mon complexe »
 * envoie (E-G01, la liste blanche du serveur, rien d'autre), ce qu'il pré-remplit, et les refus du
 * serveur NOMMÉS (contrat d'API L1 : le code est dans `error.details.code`).
 *
 * Témoin : `complexeGerant.test.js`.
 */

/** Les délais d'annulation que le serveur accepte (RULE_SPECS `cancellationDelayHours`). */
export const CHOIX_ANNULATION = Object.freeze([0, 2, 6, 12, 24, 48]);

/** Les âges minimum pour réserver (R2, RG-AGE : de 13 à 18 ans, défaut 18). */
export const CHOIX_AGE_MINIMUM = Object.freeze([13, 14, 15, 16, 17, 18]);

/**
 * Les règles du complexe telles que le serveur les juge (`RULE_SPECS`, `RULE_DEFAULTS` de
 * `admin/src/api/complexe/services/complexe.ts`) : les bornes des compteurs de E-G16 et les
 * défauts d'un complexe dont une règle manquerait.
 */
export const REGLES_DU_SERVEUR = Object.freeze({
  bornes: Object.freeze({
    autoBanNoShows: { max: 10, min: 0 },
    collectDeadlineHours: { max: 72, min: 2 },
    maxUpcomingPerUser: { max: 10, min: 1 },
    minLeadTimeHours: { max: 24, min: 0 },
  }),
  defauts: Object.freeze({
    autoBanNoShows: 3,
    cancellationDelayHours: 24,
    collectDeadlineHours: 24,
    dayBeforeConfirmation: true,
    maxUpcomingPerUser: 2,
    minAge: 18,
    minLeadTimeHours: 2,
    morningDigest: true,
  }),
});

/** Les règles d'un complexe neuf (les défauts du serveur, `RULE_DEFAULTS`). */
export const REGLES_PAR_DEFAUT = Object.freeze({ ageMinimum: 18, annulation: 24 });

const SIRET_RE = /^\d{14}$/;
const NOM_MIN = 2;
const HORS_CONNEXION = new Set(['ECONNABORTED', 'ERR_NETWORK', 'REQUEST_TIMEOUT_ABANDONED']);

/**
 * Le téléphone d'un compte à proposer comme téléphone DU complexe (E-G01 étape 1) : il est PUBLIC
 * (montré aux joueurs, RG-TEL). Règle d'app relevée par le contrat L1 : jamais le numéro d'un
 * compte MINEUR — et, prudence, jamais sans date de naissance connue.
 * @param {{ birthdate?: string | null, phoneNumber?: string | null } | null | undefined} compte
 *   - Le compte connecté.
 * @returns {string} Le numéro à pré-remplir, ou ''.
 */
export const telephoneAPreRemplir = (compte) => {
  const naissance = compte?.birthdate;
  if (!naissance || isBirthdateUnderAge(naissance, PARENTAL_POWER_ENDS_AGE)) return '';
  return String(compte?.phoneNumber || '');
};

/**
 * Le SIRET réduit à ses chiffres.
 * @param {unknown} siret - Le SIRET saisi.
 * @returns {string} Les chiffres.
 */
const chiffresDuSiret = (siret) => String(siret || '').replace(/\s+/g, '');

/**
 * L'étape 1 est-elle complète ? Nom, adresse AVEC sa position (le complexe se trouve sur une
 * carte), téléphone, au moins un sport ; le SIRET est facultatif, mais 14 chiffres s'il est donné.
 * @param {{ adresse?: any, nom?: string, siret?: string, sports?: string[],
 *   telephone?: string }} fiche - Ce qui est saisi.
 * @returns {boolean} Vrai si « Continuer » peut s'allumer.
 */
export const ficheComplete = (fiche) => {
  const siret = chiffresDuSiret(fiche?.siret);
  return String(fiche?.nom || '').trim().length >= NOM_MIN
    && Number.isFinite(fiche?.adresse?.lat)
    && Number.isFinite(fiche?.adresse?.lng)
    && Boolean(String(fiche?.telephone || '').trim())
    && Array.isArray(fiche?.sports) && fiche.sports.length > 0
    && (!siret || SIRET_RE.test(siret));
};

/**
 * RESA-INSCRIPTION (19/10/2026) — la version des « règles d'utilisation des complexes » que la case
 * fait accepter : celles validées le 14/10 (`docs/RESERVATION_REGLES_COMPLEXES_2026-10-14.md`).
 * Champ neuf du lot serveur RESA-L2C ; le serveur actuel l'ignore sans erreur (sa liste blanche,
 * mesuré sur `readComplexePayload` et `selfOnboard` : banc `RESAINSCR-20261019/serveur`).
 * Une nouvelle version des règles = une nouvelle date ici.
 */
export const VERSION_DES_REGLES = '2026-10-14';

/**
 * Le corps de « Créer mon complexe » (`POST /complexes/self-onboard`) : la liste blanche du
 * serveur (`readComplexePayload`) et rien d'autre. Le serveur pose lui-même le gestionnaire, le
 * statut, la pastille et le slug. `rulesVersion` accompagne la case cochée, jamais sans elle.
 * @param {{ accepte: boolean, adresse: any, annulation: number, ageMinimum: number, nom: string,
 *   siret?: string, sports: string[], telephone: string }} fiche - Le tunnel rempli.
 * @param {{ forcer?: boolean }} [options] - « Non, continuer » après un doublon possible.
 * @returns {Record<string, any>} Le corps.
 */
export const payloadDeCreation = (fiche, { forcer = false } = {}) => {
  const { adresse } = fiche;
  const siret = chiffresDuSiret(fiche.siret);
  return {
    acceptRules: fiche.accepte === true,
    address: { label: adresse.label, lat: adresse.lat, lng: adresse.lng },
    addressLabel: adresse.label,
    cancellationDelayHours: fiche.annulation,
    coordinates: { lat: adresse.lat, lng: adresse.lng },
    minAge: fiche.ageMinimum,
    name: String(fiche.nom || '').replace(/\s+/g, ' ').trim(),
    phoneNumber: fiche.telephone,
    sports: fiche.sports,
    ...(adresse.city ? { city: adresse.city } : {}),
    ...(forcer ? { forceCreate: true } : {}),
    ...(fiche.accepte === true ? { rulesVersion: VERSION_DES_REGLES } : {}),
    ...(siret ? { siret } : {}),
  };
};

/**
 * Une distance lisible : « 300 m », « 1,2 km ».
 * @param {unknown} metres - La distance.
 * @returns {string} Le texte, ou ''.
 */
export const distanceLisible = (metres) => {
  if (metres === null || metres === undefined || metres === '') return '';
  const valeur = Number(metres);
  if (!Number.isFinite(valeur)) return '';
  if (valeur < 1000) return `${Math.round(valeur)} m`;
  return `${(valeur / 1000).toFixed(1).replace('.', ',')} km`;
};

/**
 * Le refus du serveur, NOMMÉ (codes du contrat L1). Un champ refusé (liste blanche, modèle de
 * créneaux) garde la phrase précise du serveur ; sans réseau : « tes informations sont gardées » ;
 * le reste : le repli de l'écran.
 * @param {(cle: string, defaut: string) => string} t - Traduction.
 * @param {any} erreur - Le refus (corps d'erreur Strapi déballé par le client, ou erreur réseau).
 * @param {string} repli - La phrase de l'écran quand rien d'autre ne s'applique.
 * @returns {string} La phrase à afficher.
 */
export const messageDeRefus = (t, erreur, repli) => {
  const code = getServerErrorCode(erreur);
  switch (code) {
    case 'COMPLEXE_ALREADY_MANAGED':
      return t('complexeGerant.refus.dejaGere', 'Tu gères déjà un complexe.');
    case 'COMPLEXE_CRENEAUX_INVALID':
    case 'COMPLEXE_INVALID_PAYLOAD':
      return String(erreur?.message || '').trim() || repli;
    case 'COMPLEXE_FILE_NOT_ALLOWED':
      return t(
        'complexeGerant.refus.photoDejaUtilisee',
        'Cette photo est déjà utilisée ailleurs : choisis-en une autre.',
      );
    case 'COMPLEXE_GESTIONNAIRE_REQUIRED':
    case 'COMPLEXE_NOT_FOUND':
      return t(
        'complexeGerant.refus.complexeIntrouvable',
        'Ce complexe est introuvable, ou tu ne le gères plus.',
      );
    case 'COMPLEXE_RETIRED':
      return t('complexeGerant.refus.retire', 'Ce complexe a été retiré de FoundClub.');
    case 'COMPLEXE_RULES_NOT_ACCEPTED':
      return t(
        'complexeGerant.refus.reglesNonAcceptees',
        'Accepte les règles d’utilisation des complexes pour continuer.',
      );
    case 'COMPLEXE_TERRAIN_LIMIT':
      return t('complexeGerant.refus.tropDeTerrains', 'Un complexe compte 30 terrains au plus.');
    case 'COMPLEXE_TERRAIN_NOT_FOUND':
      return t('complexeGerant.refus.terrainIntrouvable', 'Ce terrain est introuvable.');
    default:
      break;
  }
  const status = getErrorStatus(erreur);
  const messageReseau = /network|r[ée]seau|timeout/i.test(String(erreur?.message || ''));
  const sansReseau = HORS_CONNEXION.has(code) || (!status && messageReseau);
  if (sansReseau) {
    return t(
      'complexeGerant.refus.horsConnexion',
      'Pas de connexion : tes informations sont gardées.',
    );
  }
  return repli;
};

// ---------------------------------------------------------------------------------------------
// L'accueil du gérant (E-G02)
// ---------------------------------------------------------------------------------------------

/**
 * Les cases « Gérer » de l'accueil, dans l'ordre de la planche (A-G03 : les trois mots d'Adel
 * d'abord, puis RC-G02). `route` : l'écran de ce lot qui s'ouvre ; sans elle, la case dit
 * « Bientôt » (Gérer mon complexe E-G11 ; Canal, Affiches, Fidélité, Clients, Statistiques : lot
 * L4). Pas d'« Employés » en V1 (E-G18). RESA-L5A2 (14/10/2026) : Demandes (E-G06), Planning
 * (E-G03) et Réservations (E-G04) ont leur écran.
 * @type {ReadonlyArray<{ cle: string, icone: string, route: string | null }>}
 */
export const CASES_GERER = Object.freeze([
  { cle: 'complexe', icone: 'shield', route: null },
  { cle: 'installations', icone: 'stadium', route: RouteNames.ComplexeInstallations },
  { cle: 'demandes', icone: 'inboxArrowDown', route: RouteNames.ComplexeDemandes },
  { cle: 'planning', icone: 'calendar', route: RouteNames.ComplexePlanning },
  { cle: 'reservations', icone: 'clock', route: RouteNames.ComplexeReservations },
  { cle: 'canal', icone: 'envelope', route: null },
  { cle: 'affiches', icone: 'share2', route: null },
  { cle: 'fidelite', icone: 'trophy', route: null },
  // RESA-L5B-2 (20/10/2026) : la liste des clients (E-G15, serveur RESA-L4).
  { cle: 'clients', icone: 'users', route: RouteNames.ComplexeClients },
  { cle: 'statistiques', icone: 'chart', route: null },
  { cle: 'reglages', icone: 'edit', route: RouteNames.ComplexeReglages },
]);

/**
 * Le complexe que l'accueil montre : celui de l'adresse s'il est parmi ceux du compte (sinon
 * aucun : l'accès est retiré), le premier du compte sans adresse (un complexe par compte en V1).
 * @param {unknown} liste - « Mes complexes ».
 * @param {string | null | undefined} complexeId - Le complexe demandé.
 * @returns {any | null} Le complexe, ou null.
 */
export const complexeChoisi = (liste, complexeId) => {
  const complexes = Array.isArray(liste) ? liste : [];
  if (complexeId) return complexes.find((c) => c?.documentId === complexeId) || null;
  return complexes[0] || null;
};

/**
 * Le terrain a-t-il des créneaux (au moins une plage ou un créneau ponctuel) ?
 * @param {any} terrain - Le terrain.
 * @returns {boolean} Vrai s'il en a.
 */
const aDesCreneaux = (terrain) => {
  const plan = terrain?.slotPlan;
  return Boolean(plan) && ((plan.ranges || []).length > 0 || (plan.extraSlots || []).length > 0);
};

/**
 * LE bandeau d'état de l'accueil (E-G02 bloc 2) : le PREMIER vrai, un seul — retiré, suspendu (un
 * statut qui n'est pas « actif » : D6, on agit après coup et le gérant garde son accueil), aucun
 * terrain, un terrain sans créneaux.
 * @param {any} complexe - Le complexe.
 * @param {any[]} terrains - Ses terrains.
 * @returns {{ cle: 'aucunTerrain' | 'retire' | 'sansCreneaux' | 'suspendu', terrain?: any }
 *   | null} Le bandeau, ou null quand tout va bien.
 */
export const bandeauDeLAccueil = (complexe, terrains) => {
  if (complexe?.status === 'retire') return { cle: 'retire' };
  if (complexe?.status && complexe.status !== 'actif') return { cle: 'suspendu' };
  if (!terrains.length) return { cle: 'aucunTerrain' };
  const sansCreneaux = terrains.find((terrain) => !aDesCreneaux(terrain));
  return sansCreneaux ? { cle: 'sansCreneaux', terrain: sansCreneaux } : null;
};

// ---------------------------------------------------------------------------------------------
// La fiche d'un terrain (E-G08, RA3)
// ---------------------------------------------------------------------------------------------

/** Le texte pré-rempli d'un terrain « téléphone seulement » (A-G16, celui du serveur). */
export const TEXTE_TELEPHONE_PAR_DEFAUT = 'Ce terrain ne peut être réservé que par appel au';

/** Une photo de terrain : 10 Mo au plus (planche EG08 état 4, valeur SUPPOSÉE de la planche). */
export const PHOTO_OCTETS_MAX = 10 * 1024 * 1024;

/** Les photos d'un terrain : 5 au plus (serveur, `PHOTOS_MAX`). */
export const PHOTOS_MAX = 5;

/** Le nombre de joueurs d'un terrain : de 1 à 50 (serveur, `CAPACITY_MIN` / `CAPACITY_MAX`). */
export const JOUEURS_MIN = 1;
export const JOUEURS_MAX = 50;

const PRIX_RE = /^\d+(?:[.,]\d{1,2})?$/;

/**
 * Un prix saisi : « 60 », « 6,50 », « 6.5 » ; vide = pas de prix (null) ; illisible = undefined.
 * @param {unknown} saisie - Le texte saisi.
 * @returns {number | null | undefined} Le montant, null, ou undefined s'il est faux.
 */
export const lirePrix = (saisie) => {
  const texte = String(saisie ?? '').replace(/\s+/g, '').replace('€', '');
  if (!texte) return null;
  if (!PRIX_RE.test(texte)) return undefined;
  const montant = Number(texte.replace(',', '.'));
  return montant <= 10000 ? montant : undefined;
};

/**
 * Un montant à remettre dans le champ de saisie : 6.5 ⇒ « 6,50 », 60 ⇒ « 60 ».
 * @param {unknown} montant - Le montant.
 * @returns {string} Le texte du champ.
 */
export const prixEnSaisie = (montant) => {
  if (montant === null || montant === undefined || montant === '') return '';
  const valeur = Number(montant);
  if (!Number.isFinite(valeur)) return '';
  return Number.isInteger(valeur) ? String(valeur) : valeur.toFixed(2).replace('.', ',');
};

/**
 * Les erreurs de la fiche d'un terrain, champ par champ (l'erreur s'écrit sous le champ).
 * @param {{ nom?: string, prix?: string, sport?: string | null,
 *   lieu?: string | null }} fiche - Ce qui est saisi.
 * @returns {{ lieu?: boolean, nom?: boolean, prix?: boolean, sport?: boolean }} Les champs faux.
 */
export const erreursDuTerrain = (fiche) => {
  /** @type {{ lieu?: boolean, nom?: boolean, prix?: boolean, sport?: boolean }} */
  const erreurs = {};
  if (String(fiche.nom || '').trim().length < 2) erreurs.nom = true;
  if (!fiche.sport) erreurs.sport = true;
  if (!fiche.lieu) erreurs.lieu = true;
  if (lirePrix(fiche.prix) === undefined) erreurs.prix = true;
  return erreurs;
};

/**
 * Le corps de « Enregistrer » (`POST` ou `PUT /complexes/:id/terrains`) : la liste blanche du
 * serveur (`readTerrainPayload`). Le numéro et le texte du « téléphone seulement » ne partent
 * qu'avec ce mode (le serveur les pré-remplit s'ils manquent).
 * @param {{ joueurs: number, lieu: string, mode: string, nom: string,
 *   photos: Array<{ id: number }>, prix: string, sport: string, telephone?: string,
 *   texteTelephone?: string, unite: string }} fiche - La fiche remplie.
 * @returns {Record<string, any>} Le corps.
 */
export const payloadDuTerrain = (fiche) => ({
  basePrice: lirePrix(fiche.prix) ?? null,
  bookingMode: fiche.mode,
  capacity: fiche.joueurs,
  name: String(fiche.nom || '').replace(/\s+/g, ' ').trim(),
  photos: fiche.photos.map((photo) => photo.id),
  priceUnit: fiche.unite,
  setting: fiche.lieu,
  sport: fiche.sport,
  ...(fiche.mode === 'telephone' ? {
    bookingPhone: String(fiche.telephone || '').trim() || null,
    bookingPhoneText: String(fiche.texteTelephone || '').trim() || null,
  } : {}),
});
