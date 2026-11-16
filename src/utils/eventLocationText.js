import { normalizeLocationInput } from '@/utils/location';
import safeJsonParse from '@/utils/safeJsonParse';

// T-FINITIONS2 (16/11) — LA règle du lieu écrit d'un événement, sortie d'EventHeader (téléphone)
// pour la fiche du site, la fiche d'équipe et les autres écrans qui affichaient `locationDetails`
// tel quel (le JSON brut `{"address":{"description":"AR Soccer, …"}}`).
// Ordre : `locationDetails.address`, puis `location`, puis le lieu normalisé.

/**
 * Le texte lisible d une valeur de lieu (chaine, ou objet description / label / address / name).
 * @param {unknown} value
 * @returns {string}
 */
export const toDisplayText = (value) => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (!value || typeof value !== 'object') {
    return '';
  }

  const entity = /** @type {any} */ (value);
  if (typeof entity.description === 'string') {
    return entity.description.trim();
  }
  if (typeof entity.label === 'string') {
    return entity.label.trim();
  }
  if (entity.label && typeof entity.label === 'object') {
    return toDisplayText(entity.label);
  }
  if (typeof entity.address === 'string') {
    return entity.address.trim();
  }
  if (typeof entity.name === 'string') {
    return entity.name.trim();
  }
  if (entity.address && typeof entity.address === 'object') {
    return toDisplayText(entity.address);
  }
  return '';
};

/**
 * Le lieu écrit d'un événement : jamais du JSON.
 * @param {any} event
 * @returns {string}
 */
export const getEventLocationText = (event) => {
  const raw = event?.locationDetails;
  let parsed = null;
  if (raw && typeof raw === 'object') parsed = raw;
  else if (raw) parsed = safeJsonParse(raw, null);
  // Un texte libre qui n'est pas du JSON reste un lieu lisible.
  const plain = typeof raw === 'string' && !parsed && !raw.trim().startsWith('{') ? raw.trim() : '';
  const normalized = normalizeLocationInput(parsed?.address || event?.location || parsed);
  return toDisplayText(parsed?.address) || toDisplayText(event?.location)
    || normalized?.label || normalized?.address || plain || '';
};
