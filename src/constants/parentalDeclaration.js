import { Platform } from 'react-native';

export const MINOR_PARENTAL_DECLARATION_SCOPE = 'minor_parental_declaration';
export const MINOR_PARENTAL_DECLARATION_VERSION = 'minor-parental-declaration-v1-2026-05-14';
export const MINOR_PARENTAL_DECLARATION_TEXT = 'Je déclare être le parent ou le représentant legal de cet enfant et utiliser l application en son nom.';
export const MINOR_PARENTAL_DECLARATION_TEXT_HASH = '42f52a118fe373ac50160c7676da639696723111fbf9e1c4c412d3f3f6c7adf2';
export const MINOR_PARENTAL_DECLARATION_MIN_AGE = 15;

const parseBirthdate = (value) => {
  if (!value || typeof value !== 'string') return null;

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const displayMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (displayMatch) {
    const [, day, month, year] = displayMatch;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

export const isBirthdateUnderAge = (value, minimumAge) => {
  const birthdate = parseBirthdate(value);
  if (!birthdate) return false;

  const now = new Date();
  const utcNow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));

  let age = utcNow.getUTCFullYear() - birthdate.getUTCFullYear();
  const monthDelta = utcNow.getUTCMonth() - birthdate.getUTCMonth();
  if (
    monthDelta < 0
    || (monthDelta === 0 && utcNow.getUTCDate() < birthdate.getUTCDate())
  ) {
    age -= 1;
  }

  return age < minimumAge;
};

export const isBirthdateUnderParentalAge = (value) => (
  isBirthdateUnderAge(value, MINOR_PARENTAL_DECLARATION_MIN_AGE)
);

// PARENT (2026-09-02) — LE PALIER 13, decision d Adel : « en dessous de 13 ans,
// pas le choix d avoir un compte parent pour creer un compte ».
//
// C est un palier DE PLUS, pas un deplacement du seuil 15 ci-dessus : sous
// 13 ans, le serveur refuse TOUTE ecriture tant qu aucun `parentAccount` n est
// rattache — et il le dit avec SA propre portee, distincte de celle de la
// declaration. L ecran « Qui es-tu ? » lit cette portee pour ouvrir l ecran
// « compte parent requis » (chemin A : le parent cree le compte depuis le
// sien) au lieu de l ecran de declaration.
export const MINOR_PARENT_ACCOUNT_REQUIRED_SCOPE = 'minor_parent_account_required';
export const MINOR_PARENT_ACCOUNT_REQUIRED_UNDER_AGE = 13;

export const isBirthdateUnderParentAccountAge = (value) => (
  isBirthdateUnderAge(value, MINOR_PARENT_ACCOUNT_REQUIRED_UNDER_AGE)
);

/**
 * Ce refus du serveur est-il le 400 « compte parent requis » ?
 * Memes quatre chemins que `isMinorParentalDeclarationError` ci-dessous.
 * @param {any} error - L erreur telle que le service la rejette.
 * @returns {boolean} Vrai si le serveur reclame un compte parent rattache.
 */
export const isMinorParentAccountRequiredError = (error) => [
  error?.details?.details?.scope,
  error?.details?.scope,
  error?.response?.data?.error?.details?.details?.scope,
  error?.response?.data?.error?.details?.scope,
].some((portee) => portee === MINOR_PARENT_ACCOUNT_REQUIRED_SCOPE);

export const buildMinorParentalDeclarationPayload = ({
  metadata = {},
  sourceScreen = 'minor_parental_declaration',
  targetDocumentId = null,
  targetType = 'user_profile',
} = {}) => ({
  accepted: true,
  consentFlags: {
    parentalAuthorityConfirmation: true,
  },
  devicePlatform: Platform.OS,
  legalTextHash: MINOR_PARENTAL_DECLARATION_TEXT_HASH,
  legalVersion: MINOR_PARENTAL_DECLARATION_VERSION,
  locale: 'fr-FR',
  metadata,
  scope: MINOR_PARENTAL_DECLARATION_SCOPE,
  sourceScreen,
  targetDocumentId,
  targetType,
});

/**
 * Ce refus du serveur est-il le 400 << declaration parentale >> ?
 *
 * B7-A — C EST LA SEULE CHOSE QUI DISTINGUE CE REFUS D UNE PANNE. Le serveur
 * repond 400 en rangeant la portee dans les details de l erreur ; l app doit la
 * lire pour ouvrir l ecran de declaration au lieu d afficher << Erreur >>.
 *
 * Plusieurs chemins sont essayes, et ce n est pas de la prudence decorative :
 * Strapi range le second argument de ctx.badRequest dans error.details, et ce
 * second argument porte lui-meme une clef details -- la portee se retrouve donc
 * DEUX crans plus bas (error.details.details.scope). Selon que l erreur a
 * traverse buildPreservedApiError ou qu elle arrive brute d axios, elle n est
 * pas au meme endroit. Meme convention que
 * extractSubscriptionDecisionFromError (subscriptionDecision.js:319).
 * @param {any} error - L erreur telle que le service la rejette.
 * @returns {boolean} Vrai si le serveur reclame la declaration parentale.
 */
export const isMinorParentalDeclarationError = (error) => [
  error?.details?.details?.scope,
  error?.details?.scope,
  error?.response?.data?.error?.details?.details?.scope,
  error?.response?.data?.error?.details?.scope,
].some((portee) => portee === MINOR_PARENTAL_DECLARATION_SCOPE);
