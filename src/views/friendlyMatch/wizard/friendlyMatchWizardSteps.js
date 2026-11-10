import i18next from 'i18next';

import {
  hasUpcomingCandidateDate,
  HOSTING_PREFERENCES,
  normalizeCandidateDates,
} from '@/domains/search/friendlyMatchFlow';
import {
  buildCustomFormatCode,
  CUSTOM_FORMAT,
  CUSTOM_LIMITS,
  formatDurationLabel,
  PRECISION_MAX_LENGTH,
} from '@/domains/search/friendlyMatchFormats';

import { normalizeLocationInput } from '@/utils/location';

/**
 * La carte des 8 etapes de l assistant de publication (spec §4.1) et le corps
 * envoye au serveur.
 *
 * Ce fichier ne dessine rien : il dit ce qui BLOQUE une etape et ce qui part
 * dans la requete. C est le pendant de recruitment/wizard/adWizardStepUtils.js,
 * et la raison pour laquelle les 8 ecrans n ont aucune regle a eux.
 *
 * Ce qu il n a PAS a faire, parce que le serveur le fait deja :
 *   · `city` et `geohash`      -> derives de `location` (lifecycles.ts:62-91)
 *   · `lastCandidateDate`      -> derive de `candidateDates` (lifecycles.ts:97-107)
 *   · `author`                 -> pose depuis le jeton (friendly-match-ad.ts:12-15)
 * Les envoyer serait au mieux inutile, au pire falsifiable.
 */

/**
 * Les 8 etapes, dans l ordre ou l assistant les traverse (§4.1).
 * AMICAUX-FORMAT (« 1 A », 10/11/2026) : le format vient juste apres l equipe.
 */
export const FRIENDLY_MATCH_WIZARD_STEPS = /** @type {const} */ ([
  'team',
  'format',
  'hosting',
  'dates',
  'location',
  'opponent',
  'description',
  'recap',
]);

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
 * Un entier dans ses bornes ?
 * @param {any} value
 * @param {{ min: number, max: number }} limits
 * @returns {boolean}
 */
const isIntegerWithin = (value, limits) => (
  Number.isInteger(value) && value >= limits.min && value <= limits.max
);

/**
 * Le format tel qu il doit partir : « Personnalisé » devient « 10v11 ».
 * @param {any} draft
 * @returns {string}
 */
const resolveFormat = (draft) => {
  const format = trimmed(draft?.format);
  if (format !== CUSTOM_FORMAT) return format;
  const { them, us } = draft?.formatCustom || {};
  return buildCustomFormatCode(us, them);
};

/**
 * AMICAUX-FORMAT (« 2 A ») — la duree et la precision, dans `formatDetails`.
 * La precision libre n existe que pour le personnalise (maquette, ecran 2).
 * @param {any} draft
 * @returns {{ duration?: any, precision?: string } | null}
 */
const resolveFormatDetails = (draft) => {
  const details = /** @type {{ duration?: any, precision?: string }} */ ({});
  if (formatDurationLabel(draft?.formatDuration)) details.duration = draft.formatDuration;
  const precision = trimmed(draft?.formatPrecision).slice(0, PRECISION_MAX_LENGTH);
  if (trimmed(draft?.format) === CUSTOM_FORMAT && precision) details.precision = precision;
  return Object.keys(details).length > 0 ? details : null;
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
      if (slots.length === 0) {
        return i18next.t(
          'friendlyMatchWizardSteps.proposeAtLeastOneDate',
          'Propose au moins une date.',
        );
      }
      // Une annonce dont toutes les dates sont passees naitrait `expired`
      // (§4.7) : elle serait publiee puis effacee sans avoir rien servi.
      if (!hasUpcomingCandidateDate({ candidateDates: slots }, now)) {
        return i18next.t(
          'friendlyMatchWizardSteps.allYourDatesHaveAlready',
          'Toutes tes dates sont déjà passées : propose une date à venir.',
        );
      }
      return null;
    }

    case 'description':
      // Description et arbitrage sont facultatifs (§4.1, etape 6).
      return null;

    // AMICAUX-FORMAT (« 3 A ») : le format est obligatoire, sa duree aussi. La
    // duree par defaut se pose au choix du format : ce blocage ne se voit que
    // si une duree a ete retiree, ou sur un personnalise hors bornes.
    case 'format': {
      const format = trimmed(draft?.format);
      if (!format) {
        return i18next.t('friendlyMatchWizardSteps.chooseAFormat', 'Choisis un format.');
      }
      if (format === CUSTOM_FORMAT) {
        const { them, us } = draft?.formatCustom || {};
        const { players } = CUSTOM_LIMITS;
        if (!isIntegerWithin(us, players) || !isIntegerWithin(them, players)) {
          return i18next.t(
            'friendlyMatchWizardSteps.playersBetween',
            'Indique entre 1 et 15 joueurs de chaque côté.',
          );
        }
      }
      return formatDurationLabel(draft?.formatDuration)
        ? null
        : i18next.t('friendlyMatchWizardSteps.chooseADuration', 'Choisis une durée.');
    }

    case 'hosting':
      // Q1 : le choix est TOUJOURS explicite, meme quand il parait evident.
      return HOSTING_PREFERENCES.includes(/** @type {any} */ (trimmed(draft?.hostingPreference)))
        ? null
        : i18next.t(
          'friendlyMatchWizardSteps.sayWhetherYouCanHost',
          'Dis si tu peux recevoir, te déplacer, ou les deux.',
        );

    case 'location': {
      if (!draft?.location) {
        return i18next.t(
          'friendlyMatchWizardSteps.sayWhereYouReLooking',
          'Indique où tu cherches un adversaire.',
        );
      }
      const radius = Number(draft?.travelRadiusKm);
      if (!Number.isFinite(radius) || radius < 1) {
        return i18next.t(
          'friendlyMatchWizardSteps.chooseARadiusOfAt',
          'Choisis un rayon d’au moins 1 km.',
        );
      }
      return null;
    }

    case 'opponent':
      // Categories et niveaux : facultatifs (rien coche = toutes). Le format a
      // quitte cette etape pour la sienne (AMICAUX-FORMAT).
      return null;

    case 'recap': {
      const blockingStep = getFriendlyMatchWizardBlockingStep(draft, now);
      if (!blockingStep) return null;
      return getFriendlyMatchWizardStepIssue(blockingStep, draft, now);
    }

    case 'team':
      return getDocumentId(draft?.team)
        ? null
        : i18next.t(
          'friendlyMatchWizardSteps.chooseTheTeamLookingFor',
          'Choisis l’équipe qui cherche un match.',
        );

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
 * Ce qu une installation du club apporte a l etape 4 : le terrain propose ET le
 * lieu de l annonce, prets a etre ranges par `SET_LOCATION_SELECTION`.
 *
 * 🧨 La traduction n est PAS decorative. Le serveur derive `city` et `geohash`
 * de `location` (lifecycles.ts:62-91) : il lit `city || label` d un cote, et
 * `lat` / `lng` de l autre. Or une adresse d installation est rangee en base
 * sous la forme `{ description, geometry: { coordinates: [lng, lat] } }`
 * (FacilityForm.js:102-117) — qui ne repond a NI l un NI l autre. L envoyer
 * telle quelle publierait une annonce sans ville et sans geohash, donc absente
 * de tous les tris par distance, et sans le moindre message d erreur.
 * On rend donc EXACTEMENT la forme de la saisie libre (autocompleteAddressInput
 * .js:141-155), et rien d autre : un format a nous serait un troisieme dialecte.
 *
 * Rendre `null` est un resultat utile : c est ce qui permet a l ecran de ne pas
 * proposer une installation qu il ne saurait pas transformer en lieu.
 * @param {any} facility
 * @returns {{ installation: { documentId: string, name: string }, location: any } | null}
 */
export const buildFriendlyMatchFacilitySelection = (facility) => {
  const documentId = getDocumentId(facility);
  if (!documentId) return null;

  const address = facility?.address;
  const normalized = normalizeLocationInput(
    address && typeof address === 'object' && !Array.isArray(address)
      ? { ...address, label: address.label || address.description || '' }
      : address,
  );
  if (!normalized || !Number.isFinite(normalized.lat) || !Number.isFinite(normalized.lng)) {
    return null;
  }

  const name = trimmed(facility?.name);

  return {
    installation: { documentId, name },
    location: {
      city: normalized.city || '',
      context: normalized.context || '',
      // Une installation sans adresse lisible garde au moins son nom : mieux
      // vaut « Terrain synthetique » qu une annonce dont le lieu est vide.
      label: normalized.label || name,
      lat: normalized.lat,
      lng: normalized.lng,
      postcode: normalized.postcode || '',
      value: normalized.value,
    },
  };
};

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
  const formatDetails = resolveFormatDetails(draft);
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
  if (format && formatDetails) payload.formatDetails = formatDetails;
  if (refereeing) payload.refereeing = refereeing;

  [
    ['activity', draft?.activity],
    ['section', draft?.section],
  ].forEach(([field, value]) => {
    const documentId = getDocumentId(value);
    if (documentId) payload[/** @type {string} */ (field)] = documentId;
  });

  // D90 — categories et niveaux partent au PLURIEL, et leur premiere valeur
  // repart AUSSI au singulier. Ce doublon est volontaire : une app restee en
  // arriere ne connait que `category` / `level`, et une annonce qui arriverait
  // sans eux s afficherait « Catégorie libre » chez elle. Rien coche = les deux
  // champs sont ABSENTS du corps, donc l annonce est ouverte a tout le monde.
  [
    ['categories', 'category', draft?.categories],
    ['levels', 'level', draft?.levels],
  ].forEach(([pluralField, singularField, values]) => {
    const documentIds = Array.from(new Set(
      (Array.isArray(values) ? values : []).map(getDocumentId).filter(Boolean),
    ));
    if (documentIds.length === 0) return;
    const [firstDocumentId] = documentIds;
    payload[/** @type {string} */ (pluralField)] = documentIds;
    payload[/** @type {string} */ (singularField)] = firstDocumentId;
  });

  // Un terrain n a de sens que si on recoit : une annonce « je me deplace »
  // qui emporterait une installation proposerait un lieu qu elle n offre pas.
  if (hostingPreference !== 'AWAY') {
    const installationId = getDocumentId(draft?.installation);
    if (installationId) payload.installation = installationId;
  }

  return payload;
};
