import localeDesFormats from '@/theme/strings/localeDesFormats';

import { normalizeLocationInput } from '@/utils/location';
import safeJsonParse from '@/utils/safeJsonParse';

/**
 * ST-VUES3-ORDI (03/10) — LE BLOC D'INFOS DU MATCH, téléphone ET site (écran 1, planche
 * « L'encart du score » ; relevé par STATS-FIX2, point 5).
 *
 * La planche dit, dans cet ordre, avec ses trois icônes :
 *   calendrier  « Sam. 5 sept. · 19:00 – 20:00 »   (au lieu de « sam 05/09/2026 » et l'heure)
 *   épingle     « Lyon (69001) »                   (au lieu de l'adresse longue et du GPS)
 *   personnes   « U15 · AS Montrivage »            (au lieu de la catégorie en capitales)
 * Le site les met sur une ligne, sous le titre (planche P3-match-ordi).
 *
 * Fonctions PURES : une chaîne vide quand la donnée manque, jamais une valeur inventée.
 */

/**
 * Une majuscule au début (« sam. » devient « Sam. »).
 * @param {string} value - Un texte.
 * @returns {string} Le même, avec une majuscule.
 */
const capitalize = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

/**
 * « 19:00 » depuis « 19:00:00.000 ».
 * @param {unknown} value - Une heure du serveur.
 * @returns {string} L'heure, ou vide.
 */
const hhmm = (value) => {
  const text = String(value || '').trim();
  return /^\d{1,2}:\d{2}/.test(text) ? text.substring(0, 5) : '';
};

/**
 * Le jour et l'heure : « Sam. 5 sept. · 19:00 – 20:00 ». Le jour se lit à l'heure de
 * l'appareil (comme le reste de l'app) ; les heures sont celles SAISIES (`startTime`,
 * `endTime`), sinon celle de la date.
 * @param {any} event - L'événement.
 * @param {string} [locale] - Les formats de l'appareil.
 * @returns {string} La ligne, ou vide sans date lisible.
 */
export const formatEventWhenLine = (event, locale = localeDesFormats()) => {
  const date = new Date(String(event?.date || ''));
  if (Number.isNaN(date.getTime())) return '';
  const day = capitalize(date.toLocaleDateString(locale, {
    day: 'numeric', month: 'short', weekday: 'short',
  }));
  const start = hhmm(event?.startTime)
    || date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const end = hhmm(event?.startTime) ? hhmm(event?.endTime) : '';
  return `${day} · ${end ? `${start} – ${end}` : start}`;
};

/**
 * Le lieu, court : « Lyon (69001) ». Lu dans `locationDetails` (le lieu choisi), sinon
 * `location`. Sans ville connue : vide — l'écran garde alors son libellé d'avant.
 * @param {any} event - L'événement.
 * @returns {string} « Ville (code postal) », « Ville », ou vide.
 */
export const formatEventPlaceShort = (event) => {
  const parsed = event?.locationDetails ? safeJsonParse(event.locationDetails, null) : null;
  const normalized = normalizeLocationInput(parsed?.address || parsed || event?.location)
    || normalizeLocationInput(event?.location);
  // ⛔ `normalizeLocationInput` retombe sur le « contexte » du géocodeur (« 69, Rhône,
  // Auvergne-Rhône-Alpes ») quand la ville manque : ce n'est pas une ville.
  const city = String(normalized?.city || '').trim();
  const postcode = String(normalized?.postcode || '').trim();
  if (city && !city.includes(',')) return postcode ? `${city} (${postcode})` : city;

  // Une adresse saisie en texte libre finit souvent par « 69001 Lyon ».
  const text = [parsed?.address, parsed?.label, event?.location]
    .find((value) => typeof value === 'string' && value.trim()) || '';
  const match = /(\d{5})\s+([^,\d][^,]*?)\s*(?:,\s*France)?\s*$/i.exec(String(text).trim());
  return match ? `${match[2].trim()} (${match[1]})` : '';
};

/**
 * L'équipe et son club : « U15 · AS Montrivage ».
 * @param {any} event - L'événement.
 * @param {any} [team] - L'équipe du lecteur, sinon celle de l'événement.
 * @returns {string} La ligne, ou vide.
 */
export const formatEventTeamLine = (event, team = null) => {
  const theTeam = team || event?.team || null;
  const teamName = String(theTeam?.name || '').trim();
  const clubName = String(theTeam?.club?.name || event?.club?.name || '').trim();
  return [teamName, clubName].filter(Boolean).join(' · ');
};
