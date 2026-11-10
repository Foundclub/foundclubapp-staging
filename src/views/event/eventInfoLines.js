import localeDesFormats from '@/theme/strings/localeDesFormats';

import { getLocationCoordinates, normalizeLocationInput } from '@/utils/location';
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
  return `${day}${dernierJourDuStage(event, locale)} · ${end ? `${start} – ${end}` : start}`;
};

/**
 * REPRISE-EVENEMENTS 128 — le dernier jour d'un stage de plusieurs jours : l'en-tête (site et
 * téléphone) n'annonçait que le premier.
 * @param {any} event - L'événement.
 * @returns {Date | null} Le dernier jour, ou `null` (pas un stage, ou un seul jour).
 */
export const getStageLastDay = (event) => {
  if (String(event?.eventFormat || '').toLowerCase() !== 'stage_parent') return null;
  // La date de fin est un jour (« 2026-12-30 ») : midi évite de changer de jour selon le fuseau.
  const fin = new Date(`${String(event?.stageEndDate || '').substring(0, 10)}T12:00:00`);
  const premier = new Date(String(event?.date || ''));
  if (Number.isNaN(fin.getTime()) || fin.toDateString() === premier.toDateString()) return null;
  return fin;
};

/**
 * « – mer. 30 déc. » après le premier jour d'un stage, sinon rien.
 * @param {any} event - L'événement.
 * @param {string} locale - Les formats de l'appareil.
 * @returns {string} Le dernier jour précédé d'un tiret, ou vide.
 */
const dernierJourDuStage = (event, locale) => {
  const fin = getStageLastDay(event);
  if (!fin) return '';
  const jour = fin.toLocaleDateString(locale, { day: 'numeric', month: 'short', weekday: 'short' });
  return ` – ${jour}`;
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
 * ACCUEIL-JOUEUR (09/11/2026, point 3, mots d'Adel : « on n'affiche que la ville ou le code
 * postal, c'est pas bien ») — LE LIEU EN ADRESSE PRÉCISE (rue, ville), partout où la fiche le
 * résume : téléphone, site, carte « Ma semaine » de l'accueil. Remplace, pour le lieu, la ligne
 * courte de la planche ST-VUES3-ORDI (03/10). Sans adresse précise connue : la ligne courte
 * (« Lyon (69001) »), sinon vide — l'écran garde alors son libellé d'avant.
 * 🧪 Témoin : `__tests__/eventInfoLines.ACCUEILJOUEUR.adresse.test.js`.
 * @param {any} event - L'événement.
 * @returns {string} L'adresse précise, « Ville (code postal) », « Ville », ou vide.
 */
export const formatEventPlaceLine = (event) => {
  const court = formatEventPlaceShort(event);
  const parsed = event?.locationDetails ? safeJsonParse(event.locationDetails, null) : null;
  const normalized = normalizeLocationInput(parsed?.address || parsed || event?.location)
    || normalizeLocationInput(event?.location);
  const texte = [normalized?.label, parsed?.address, parsed?.label, event?.location]
    .find((value) => typeof value === 'string' && value.trim()) || '';
  const precis = String(texte).trim().replace(/,?\s*France\s*$/i, '');
  // Ce qui reste une fois la ville et le code postal retirés : rien, c'est la ville seule.
  const reste = [
    normalized?.city, normalized?.postcode, ...court.replace(/[()]/g, ' ').split(/\s+/),
  ]
    .filter((mot) => typeof mot === 'string' && mot.trim())
    .reduce((acc, mot) => acc.split(String(mot).trim()).join(' '), precis);
  return /[\p{L}\d]/u.test(reste) ? precis : court;
};

/**
 * ACCUEIL-JOUEUR (point 4) — ce que le GPS ouvre : le lieu écrit et ses coordonnées connues (les
 * mêmes sources que l'en-tête du téléphone, `EventHeader`). Pour `openExternalMap`.
 * @param {any} event - L'événement.
 * @returns {{ label: string, latitude?: number | null, longitude?: number | null } | null} Le
 *   lieu, ou rien sans lieu.
 */
export const eventMapTarget = (event) => {
  const parsed = event?.locationDetails ? safeJsonParse(event.locationDetails, null) : null;
  const label = formatEventPlaceLine(event);
  const coordonnees = getLocationCoordinates(event?.location)
    || getLocationCoordinates(parsed?.address)
    || getLocationCoordinates(parsed);
  if (!label && !coordonnees) return null;
  return coordonnees
    ? { label, latitude: coordonnees.lat, longitude: coordonnees.lng }
    : { label };
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
