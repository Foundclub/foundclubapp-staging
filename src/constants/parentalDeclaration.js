import { Platform } from 'react-native';

export const MINOR_PARENTAL_DECLARATION_SCOPE = 'minor_parental_declaration';
// MINEURS-SUITE (2026-10-03, decision d'Adel « 3- B », registre des mineurs ligne 16) : la
// declaration du PARENT passe en version CORRIGEE (accents, apostrophe). Adel l'appelle « version 2
// du parent » ; l'identifiant v2 etant deja celui de l'ado (plus bas), elle s'appelle v3. Sa phrase
// vit dans la carte (ParentalDeclarationCard.js) et son empreinte est enfin celle du texte AFFICHE
// (la v1, « 42f52a11… », empreintait une phrase sans accents que l'app n'affichait pas). Le serveur
// accepte encore la v1 des applis installees. ⚠️ Deploiement : le SERVEUR AVANT cette app.
export const MINOR_PARENTAL_DECLARATION_VERSION = 'minor-parental-declaration-v3-parent-2026-10-03';
export const MINOR_PARENTAL_DECLARATION_TEXT_HASH = '490d56e62970f7ded2339dfe7227720b4aa15b0cbc35d6b707455d84afef7ebf';
export const MINOR_PARENTAL_DECLARATION_MIN_AGE = 15;

// CONSENTEMENT-PHRASE (2026-10-01, decision d'Adel « 3-A corrige ») — 2 SIGNATAIRES, 2 TEXTES.
//
// ☠️ La declaration v1, celle du parent, etait aussi celle que cochait un ado
// de 13-14 ans inscrit SEUL : on lui faisait affirmer qu'il est son propre parent. Elle reste
// celle du PARENT qui signe depuis le lien (PARENT-LIEN), corrigee en v3 le 03/10 ; sa phrase vit dans la carte
// (ParentalDeclarationCard.js), seul endroit qui l'affiche — elle etait AUSSI recopiee ici,
// sans aucun lecteur. L'ado coche desormais une phrase VRAIE pour lui (v2, modele SportEasy),
// tournee pour ne pas accorder un participe au genre de l'ado.
//
// ⛔ Ce texte est juridique : il ne se traduit pas, et son empreinte (sha256 du texte AFFICHE,
// en UTF-8) doit rester EGALE a celle du serveur (admin, legal-acceptance.js). Les temoins
// « parentalDeclaration.signataires.test.js » (S2) et « SECUEVENT/V3 bis » (admin) y veillent.
// Changer une virgule = une NOUVELLE version, des deux cotes ; les preuves deja enregistrees
// gardent la leur.
export const PARENTAL_DECLARATION_SIGNATORIES = Object.freeze({
  MINOR_SELF: 'minor_self',
  PARENT: 'parent',
});
export const MINOR_SELF_DECLARATION_VERSION = 'minor-parental-declaration-v2-self-2026-10-01';
export const MINOR_SELF_DECLARATION_TEXT = 'Un de mes parents (ou mon représentant légal) m\'a donné son accord pour créer ce compte.';
export const MINOR_SELF_DECLARATION_TEXT_HASH = '8bdc055408f8d93f68dfea13bccd4e0402d7afc4299eec467285dca668081ae3';

const DECLARATION_BY_SIGNATORY = {
  [PARENTAL_DECLARATION_SIGNATORIES.MINOR_SELF]: {
    consentFlags: { parentalPermissionObtained: true },
    legalTextHash: MINOR_SELF_DECLARATION_TEXT_HASH,
    legalVersion: MINOR_SELF_DECLARATION_VERSION,
  },
  [PARENTAL_DECLARATION_SIGNATORIES.PARENT]: {
    consentFlags: { parentalAuthorityConfirmation: true },
    legalTextHash: MINOR_PARENTAL_DECLARATION_TEXT_HASH,
    legalVersion: MINOR_PARENTAL_DECLARATION_VERSION,
  },
};

/**
 * La declaration que signe CETTE personne. Par defaut l'ado : c'est lui qui coche dans 7
 * appelants sur 8 ; seul le lien parent nomme le parent (temoin S5). Un signataire inconnu
 * retombe sur l'ado — et le serveur refuse alors le lien parent, bruyamment.
 * @param {string} [signatory] - « minor_self » ou « parent ».
 * @returns {{ consentFlags: object, legalTextHash: string, legalVersion: string }} La preuve.
 */
const declarationFor = (signatory) => (
  DECLARATION_BY_SIGNATORY[signatory]
  || DECLARATION_BY_SIGNATORY[PARENTAL_DECLARATION_SIGNATORIES.MINOR_SELF]
);

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

/**
 * DATENAISS (2026-09-22) — la date de naissance est-elle APRES aujourd hui ?
 *
 * Sentry SERVEUR-STRAPI-T : un parent a declare un enfant ne « dans le futur ».
 * Les paliers ci-dessus ne le voient pas — un age negatif est bien « moins de
 * 13 ans » — et seul le serveur refusait, apres l aller-retour.
 *
 * ⏰ LA REFERENCE EST LA DATE LOCALE DU TELEPHONE : le parent raisonne sur son
 * calendrier, pas sur minuit UTC. Une date illisible rend `false` : ce n est pas
 * a cette question de le dire.
 * @param {unknown} value - La date saisie (AAAA-MM-JJ ou JJ/MM/AAAA).
 * @param {Date} [now] - L instant de reference, pour les temoins.
 * @returns {boolean} Vrai si la date tombe apres aujourd hui.
 */
export const isBirthdateInFuture = (value, now = new Date()) => {
  const birthdate = parseBirthdate(value);
  if (!birthdate) return false;

  const naissance = (birthdate.getUTCFullYear() * 10000)
    + ((birthdate.getUTCMonth() + 1) * 100)
    + birthdate.getUTCDate();
  const aujourdHui = (now.getFullYear() * 10000)
    + ((now.getMonth() + 1) * 100)
    + now.getDate();
  return naissance > aujourdHui;
};

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
 * PARENT P2 — L AGE OU LE LIEN PARENTAL S ETEINT.
 *
 * L autorite parentale cesse a la majorite : garder l acces apres 18 ans serait
 * traiter les donnees d un ADULTE sans son accord. Ce n est pas un confort,
 * c est la raison pour laquelle le pouvoir se CALCULE au lieu de se stocker.
 */
export const PARENTAL_POWER_ENDS_AGE = 18;

/**
 * Ce qu un parent peut faire pour un enfant de cet age (E17 du plan PARENT,
 * tranche par Adel le 2026-09-07).
 *
 * 🧠 LE POUVOIR NE SE STOCKE JAMAIS, IL SE CALCULE. Aucun cron, aucune
 * migration : le jour des 13 ans et le jour des 18 ans, l app change de
 * comportement toute seule, et rien ne peut etre « en retard ».
 *
 *   · `full` — moins de 13 ans : tout ce qui existe, y compris demander a
 *     rejoindre un club. L enfant n a pas de compte, le serveur le refuse.
 *   · `view` — 13 a 17 ans : le parent VOIT le planning, il n agit plus.
 *     L ado repond lui-meme.
 *   · `none` — 18 ans et plus : le lien s eteint.
 *
 * 🔢 UN AGE INCONNU REND `view`, ET C EST DELIBERE. `Number('')` vaut 0, et
 * zero an tomberait dans « moins de 13 » — c est-a-dire dans la tranche la plus
 * PERMISSIVE. Sur des donnees d enfant, ce qu on ne sait pas doit fermer la
 * main, jamais l ouvrir.
 * @param {unknown} age - L age en annees revolues, tel que le serveur le rend.
 * @returns {'full' | 'view' | 'none'} Ce que le parent peut faire.
 */
export const parentalPowerForAge = (age) => {
  // ⛔ L ORDRE COMPTE : le vide se teste AVANT la conversion. `Number('')` et
  // `Number(null)` valent tous les deux 0 — donc « moins de 13 ans », la
  // tranche la plus permissive. Convertir d abord ouvrirait la main sur une
  // fiche dont on ignore l age.
  if (age === null || age === undefined || age === '') return 'view';
  const annees = typeof age === 'number' ? age : Number(age);
  if (!Number.isFinite(annees)) return 'view';
  if (annees >= PARENTAL_POWER_ENDS_AGE) return 'none';
  if (annees >= MINOR_PARENT_ACCOUNT_REQUIRED_UNDER_AGE) return 'view';
  return 'full';
};

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
  signatory = PARENTAL_DECLARATION_SIGNATORIES.MINOR_SELF,
  sourceScreen = 'minor_parental_declaration',
  targetDocumentId = null,
  targetType = 'user_profile',
} = {}) => {
  const { consentFlags, legalTextHash, legalVersion } = declarationFor(signatory);
  return {
    accepted: true,
    consentFlags,
    devicePlatform: Platform.OS,
    legalTextHash,
    legalVersion,
    locale: 'fr-FR',
    metadata,
    scope: MINOR_PARENTAL_DECLARATION_SCOPE,
    sourceScreen,
    targetDocumentId,
    targetType,
  };
};

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
