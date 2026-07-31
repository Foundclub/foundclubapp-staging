import {
  hasUpcomingCandidateDate,
  HOSTING_PREFERENCES,
  normalizeCandidateDates,
} from '@/domains/search/friendlyMatchFlow';

/**
 * La carte des 7 etapes de l assistant de publication (spec §4.1) et le corps
 * envoye au serveur.
 *
 * Ce fichier ne dessine rien : il dit ce qui BLOQUE une etape et ce qui part
 * dans la requete. C est le pendant de recruitment/wizard/adWizardStepUtils.js,
 * et la raison pour laquelle les 7 ecrans n ont aucune regle a eux.
 *
 * Ce qu il n a PAS a faire, parce que le serveur le fait deja :
 *   · `city` et `geohash`      -> derives de `location` (lifecycles.ts:62-91)
 *   · `lastCandidateDate`      -> derive de `candidateDates` (lifecycles.ts:97-107)
 *   · `author`                 -> pose depuis le jeton (friendly-match-ad.ts:12-15)
 * Les envoyer serait au mieux inutile, au pire falsifiable.
 */

/** Les 7 etapes, dans l ordre ou l assistant les traverse (§4.1). */
export const FRIENDLY_MATCH_WIZARD_STEPS = /** @type {const} */ ([
  'team',
  'hosting',
  'dates',
  'location',
  'opponent',
  'description',
  'recap',
]);

/** Format libre du catalogue (§3.4) : il exige son texte, sinon il ne dit rien. */
export const FORMAT_OTHER_VALUE = 'Autre';

/**
 * Le nombre d etapes affiche par le gabarit de tunnel.
 * @returns {number}
 */
export const getFriendlyMatchWizardStepCount = () => FRIENDLY_MATCH_WIZARD_STEPS.length;

/**
 * Le rang AFFICHE d une etape : « Étape 3/7 » commence a 1, pas a 0. Une etape
 * inconnue rend 1 plutot que 0 : un compteur a « 0/7 » serait un bug visible
 * pour l utilisateur alors que le tunnel, lui, fonctionne.
 * @param {any} stepKey
 * @returns {number}
 */
export const getFriendlyMatchWizardStepIndex = (stepKey) => {
  const index = FRIENDLY_MATCH_WIZARD_STEPS.indexOf(/** @type {any} */ (stepKey));
  return index < 0 ? 1 : index + 1;
};

/**
 * Le texte d une entite de reference, quelle que soit la forme recue.
 * @param {any} value
 * @returns {string}
 */
const getDocumentId = (value) => {
  if (!value) return '';
  if (typeof value === 'object') return String(value.documentId || value.id || '').trim();
  return String(value).trim();
};

/**
 * Une chaine utile, ou rien.
 * @param {any} value
 * @returns {string}
 */
const trimmed = (value) => String(value ?? '').trim();

/**
 * Le format tel qu il doit partir : « Autre » cede la place au texte saisi.
 * @param {any} draft
 * @returns {string}
 */
const resolveFormat = (draft) => {
  const format = trimmed(draft?.format);
  if (format === FORMAT_OTHER_VALUE) return trimmed(draft?.formatOther);
  return format;
};

/**
 * Ce qui empeche de quitter une etape, en francais et adresse a l utilisateur.
 * `null` veut dire « on peut continuer ».
 *
 * Categorie, niveau et format restent FACULTATIFS : le schema serveur ne les
 * exige pas, et les rendre obligatoires empecherait de publier une annonce
 * volontairement ouverte (« n importe quel adversaire du coin »).
 * @param {any} stepKey
 * @param {any} draft
 * @param {Date} [now]
 * @returns {string | null}
 */
export const getFriendlyMatchWizardStepIssue = (stepKey, draft, now = new Date()) => {
  switch (stepKey) {
    case 'dates': {
      const slots = normalizeCandidateDates(draft?.candidateDates);
      if (slots.length === 0) return 'Propose au moins une date.';
      // Une annonce dont toutes les dates sont passees naitrait `expired`
      // (§4.7) : elle serait publiee puis effacee sans avoir rien servi.
      if (!hasUpcomingCandidateDate({ candidateDates: slots }, now)) {
        return 'Toutes tes dates sont déjà passées : propose une date à venir.';
      }
      return null;
    }

    case 'description':
      // Description et arbitrage sont facultatifs (§4.1, etape 6).
      return null;

    case 'hosting':
      // Q1 : le choix est TOUJOURS explicite, meme quand il parait evident.
      return HOSTING_PREFERENCES.includes(/** @type {any} */ (trimmed(draft?.hostingPreference)))
        ? null
        : 'Dis si tu peux recevoir, te déplacer, ou les deux.';

    case 'location': {
      if (!draft?.location) return 'Indique où tu cherches un adversaire.';
      const radius = Number(draft?.travelRadiusKm);
      if (!Number.isFinite(radius) || radius < 1) {
        return 'Choisis un rayon d’au moins 1 km.';
      }
      return null;
    }

    case 'opponent':
      // Le catalogue est ferme + « Autre » (§3.4). « Autre » sans texte ne
      // decrit rien : ni l adversaire ni le filtre ne sauraient quoi en faire.
      if (trimmed(draft?.format) === FORMAT_OTHER_VALUE && !trimmed(draft?.formatOther)) {
        return 'Écris le format que tu cherches.';
      }
      return null;

    case 'recap': {
      const blockingStep = getFriendlyMatchWizardBlockingStep(draft, now);
      if (!blockingStep) return null;
      return getFriendlyMatchWizardStepIssue(blockingStep, draft, now);
    }

    case 'team':
      return getDocumentId(draft?.team)
        ? null
        : 'Choisis l’équipe qui cherche un match.';

    default:
      return null;
  }
};

/**
 * La PREMIERE etape encore en defaut — celle vers laquelle renvoyer depuis le
 * recapitulatif. Renvoyer la derniere ferait reculer l utilisateur pas a pas.
 * @param {any} draft
 * @param {Date} [now]
 * @returns {string | null}
 */
export const getFriendlyMatchWizardBlockingStep = (draft, now = new Date()) => (
  FRIENDLY_MATCH_WIZARD_STEPS
    .filter((stepKey) => stepKey !== 'recap')
    .find((stepKey) => getFriendlyMatchWizardStepIssue(stepKey, draft, now) !== null) || null
);

/**
 * Le corps de `POST /friendly-match-ads`.
 *
 * Les relations partent en `documentId` — l idiome deja utilise par l assistant
 * de recrutement (AdWizardRecap.js:355-364). Un champ vide est ABSENT du corps
 * plutot qu envoye a chaine vide : Strapi ecrirait la chaine vide en base, et
 * un filtre `$null` ne la verrait jamais.
 * @param {any} draft
 * @returns {any}
 */
export const buildFriendlyMatchAdPayload = (draft) => {
  const hostingPreference = trimmed(draft?.hostingPreference);
  const format = resolveFormat(draft);
  const description = trimmed(draft?.description);
  const refereeing = trimmed(draft?.refereeing);
  const radius = Number(draft?.travelRadiusKm);

  const payload = /** @type {any} */ ({
    candidateDates: normalizeCandidateDates(draft?.candidateDates),
    hostingPreference,
    location: draft?.location,
    team: getDocumentId(draft?.team),
  });

  if (Number.isFinite(radius) && radius >= 1) payload.travelRadiusKm = Math.round(radius);
  if (description) payload.description = description;
  if (format) payload.format = format;
  if (refereeing) payload.refereeing = refereeing;

  [
    ['activity', draft?.activity],
    ['category', draft?.category],
    ['level', draft?.level],
    ['section', draft?.section],
  ].forEach(([field, value]) => {
    const documentId = getDocumentId(value);
    if (documentId) payload[/** @type {string} */ (field)] = documentId;
  });

  // Un terrain n a de sens que si on recoit : une annonce « je me deplace »
  // qui emporterait une installation proposerait un lieu qu elle n offre pas.
  if (hostingPreference !== 'AWAY') {
    const installationId = getDocumentId(draft?.installation);
    if (installationId) payload.installation = installationId;
  }

  return payload;
};
