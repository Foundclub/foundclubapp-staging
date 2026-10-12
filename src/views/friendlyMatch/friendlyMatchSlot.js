import { normalizeCandidateDates } from '@/domains/search/friendlyMatchFlow';

import { getAddressText } from '@/utils/facilityAddressLabel';

/**
 * AMICAUX-PROPOSITIONS (13/10) — le CRENEAU d une proposition de match amical : la date,
 * l horaire, le lieu. Decision d Adel (12/10) : « il faut obliger en cas de postulation sur
 * un match amical proposé un créneau ».
 *
 * Miroir de ce que le serveur exige (admin `friendly-match-workflow.ts` :
 * `resolveProposalSlot` a la proposition, `missingForAcceptance` a l acceptation). L app le
 * sait AVANT d envoyer : un bouton qui part et revient refuse est un bouton menteur. Le
 * serveur reste le juge ; si les deux divergent, c est son message qui s affiche.
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Une valeur en texte nettoye, '' pour rien.
 * @param {any} value
 * @returns {string}
 */
const text = (value) => String(value ?? '').trim();

/**
 * Le texte d un lieu, quelle que soit sa forme (texte, JSON emballe, adresse structuree).
 * @param {any} value
 * @returns {string}
 */
export const getPlaceText = (value) => (
  getAddressText(value) || text(value?.name) || text(value?.city)
);

/**
 * L horaire que l annonce donne pour ce jour, ou ''.
 * @param {any} ad
 * @param {any} day - AAAA-MM-JJ (ou un instant ISO, coupe au jour).
 * @returns {string}
 */
export const getAdStartForDay = (ad, day) => {
  const wanted = text(day).slice(0, 10);
  if (!wanted) return '';
  const slot = normalizeCandidateDates(ad?.candidateDates).find((entry) => entry.date === wanted);
  return text(slot?.start);
};

/**
 * Le lieu de l annonce : son installation, sinon son lieu, sinon sa ville.
 * '' quand elle n en dit rien.
 * @param {any} ad
 * @returns {string}
 */
export const getAdPlaceLabel = (ad) => (
  [ad?.installation?.address, ad?.installation, ad?.location, ad?.city]
    .map(getPlaceText)
    .find(Boolean) || ''
);

/**
 * Ce que le proposant doit encore donner.
 * - l horaire : seulement quand l annonce n en donne pas pour le jour choisi ;
 * - le lieu : quand il RECOIT (« Je reçois »), ou quand l annonce, qui recoit, ne dit pas ou.
 * @param {any} ad
 * @param {{ chosenDate?: string, chosenHosting?: string, chosenTime?: string,
 *   proposedVenue?: string }} draft
 * @returns {{ adPlace: string, adStart: string, asksPlace: boolean, asksTime: boolean,
 *   missing: Array<'date' | 'place' | 'time'> }}
 */
export const getProposalSlotNeeds = (ad, draft) => {
  const chosenDate = text(draft?.chosenDate);
  const adStart = getAdStartForDay(ad, chosenDate);
  const adPlace = getAdPlaceLabel(ad);
  const asksTime = Boolean(chosenDate) && !adStart;
  const asksPlace = text(draft?.chosenHosting) === 'HOST' || !adPlace;

  /** @type {Array<'date' | 'place' | 'time'>} */
  const missing = [];
  if (!chosenDate) missing.push('date');
  if (asksTime && !TIME_PATTERN.test(text(draft?.chosenTime))) missing.push('time');
  if (asksPlace && !text(draft?.proposedVenue)) missing.push('place');

  return {
    adPlace, adStart, asksPlace, asksTime, missing,
  };
};

/**
 * Ce qu une proposition DEJA envoyee laisse ouvert avant de pouvoir creer le match.
 * ponytail: une proposition d avant ce lot porte un JOUR seul, range a minuit UTC ; on la
 * reconnait comme le serveur (« T00:00:00Z »). Un coup d envoi a 1 h ou 2 h du matin, heure de
 * Paris, se confondrait avec elle : aucun amical ne se joue a cette heure.
 * @param {any} ad
 * @param {any} application
 * @returns {Array<'dateTime' | 'place'>}
 */
export const getAcceptanceNeeds = (ad, application) => {
  const agreed = application?.agreedTerms || {};
  const chosen = text(application?.chosenDate);
  const chosenHasTime = chosen.includes('T') && !/T00:00:00(\.000)?Z$/.test(chosen);
  const hasTime = Boolean(text(agreed.date))
    || chosenHasTime
    || Boolean(getAdStartForDay(ad, chosen));
  const adHosts = text(application?.chosenHosting).toUpperCase() !== 'HOST';
  const proposedPlaces = [
    agreed.location, agreed.venue, application?.proposedLocation, application?.proposedVenue,
  ];
  const hasPlace = proposedPlaces
    .some((value) => Boolean(getPlaceText(value)))
    || (adHosts && Boolean(getAdPlaceLabel(ad)));

  /** @type {Array<'dateTime' | 'place'>} */
  const needs = [];
  if (!hasTime) needs.push('dateTime');
  if (!hasPlace) needs.push('place');
  return needs;
};
