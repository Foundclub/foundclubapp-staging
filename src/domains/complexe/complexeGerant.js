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
 * Le corps de « Créer mon complexe » (`POST /complexes/self-onboard`) : la liste blanche du
 * serveur (`readComplexePayload`) et rien d'autre. Le serveur pose lui-même le gestionnaire, le
 * statut, la pastille et le slug.
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
