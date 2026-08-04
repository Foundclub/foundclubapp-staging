/**
 * Extracts a short address (Zip Code + City) from address details.
 * Handles various formats:
 * - Structured object: { postcode: "13002", city: "Marseille" }
 * - Full string: "25 Boulevard des dames 13002 Marseille" -> "13002 Marseille"
 * - Suffix format: "Marseille (13008)" -> "13008 Marseille"
 * - Duplicate zip: "21 Rue Lecourbe 75015 Paris (75015)" -> "75015 Paris"
 * @param {string | object | null} addressDetails
 * @returns {string} Formatted address or empty string
 */
export function getShortAddress(addressDetails) {
  if (!addressDetails) return '';
  if (typeof addressDetails === 'string' && addressDetails.trim() === '[object Object]') return '';

  let raw = '';
  let parsed = null;

  // 1. Normaliser : récupérer la vraie chaîne d'adresse ou l'objet
  if (typeof addressDetails === 'string') {
    try {
      parsed = JSON.parse(addressDetails);
      raw = parsed?.address || (typeof parsed === 'string' ? parsed : addressDetails);
    } catch {
      raw = addressDetails;
    }
  } else {
    parsed = addressDetails;
    raw = addressDetails?.address || '';
  }

  const normalized = normalizeLocationInput(parsed || raw || addressDetails);
  if (normalized?.postcode && normalized?.city) {
    return `${normalized.postcode} ${normalized.city}`;
  }
  if (normalized?.label) {
    return normalized.label;
  }
  if (normalized?.address) {
    return normalized.address;
  }

  // Priority 0: Structured data (Clubs format preservation)
  if (parsed && typeof parsed === 'object') {
    const zip = parsed.zipCode || parsed.postcode;
    const { city } = parsed;
    if (zip && city) {
      return `${zip} ${city}`;
    }
  }

  if (!raw || typeof raw !== 'string') return '';

  const cleanRaw = raw.trim();
  if (!cleanRaw || cleanRaw === '[object Object]') return '';

  // Priority 1: "Zip City" pattern (e.g. "75015 Paris", "13002 Marseille")
  // Matches 5 digits followed by words (City).
  const zipCityMatch = cleanRaw.match(/\b(\d{5})\s+([A-Za-zÀ-ÖØ-öø-ÿ]+(?:[\s-][A-Za-zÀ-ÖØ-öø-ÿ]+)*)/);
  if (zipCityMatch) {
    return `${zipCityMatch[1]} ${zipCityMatch[2]}`;
  }

  // Priority 2: "City (Zip)" pattern (e.g. "Marseille (13008)")
  // Matches words (City) followed by (Zip).
  const cityZipMatch = cleanRaw.match(/([A-Za-zÀ-ÖØ-öø-ÿ]+(?:[\s-][A-Za-zÀ-ÖØ-öø-ÿ]+)*)\s*\(\s*(\d{5})\s*\)/);
  if (cityZipMatch) {
    return `${cityZipMatch[2]} ${cityZipMatch[1]}`;
  }

  // Priority 3: Just a zip code found?
  const zipMatch = cleanRaw.match(/\b\d{5}\b/);
  if (zipMatch) {
    return zipMatch[0];
  }

  // Fallback: return original
  return cleanRaw;
}

const DEFAULT_RADIUS_KM = 20;
const MIN_RADIUS_KM = 5;
const MAX_RADIUS_KM = 100;

/**
 * Libellé de distance des cartes club — POINT DE VÉRITÉ UNIQUE.
 *
 * Partagé par la carte de recherche (`components/molecules/clubCard/ClubCard`)
 * et la carte d'inscription (`views/onboarding/components/OnboardingClubCard`).
 * Les deux en portaient une copie ; le garde ci-dessous n'existait que dans la
 * seconde, si bien que la première affichait « à 50 m » sur TOUS les clubs dès
 * que la distance était inconnue.
 *
 * CE QUE LE SERVEUR ENVOIE VRAIMENT (vérifié dans le dépôt admin) :
 * - `computeDistanceKm` rend `undefined` dès qu'une coordonnée manque
 *   (`src/api/search/services/scoring.ts:211-213`) ;
 * - la charge est normalisée en `distanceKm: distanceKm ?? null`
 *   (`src/api/search/services/search.ts:439`, et 6 autres appels identiques).
 * Le serveur envoie donc **`null`**, jamais `0`, pour « je ne sais pas ».
 * Côté inscription, `getClubDistanceKm` rend lui aussi `null`.
 * ⇒ `0` reste une VRAIE distance (club situé sur le point cherché) : la traiter
 * comme inconnue effacerait le résultat le plus proche. Le « 0 partout » qu'on
 * observait ne venait pas du serveur mais de `Number(null) === 0` ici même.
 * @param {any} distanceKm - Distance en kilomètres, ou une valeur non mesurable.
 * @returns {string} - « à X km » / « à X m », chaîne vide si la distance est inconnue.
 */
export const formatClubDistanceLabel = (distanceKm) => {
  // `Number(null)`, `Number('')`, `Number([])` et `Number(false)` valent tous 0,
  // pas NaN : un contrôle sur la seule finitude laisse donc passer « inconnu »
  // et l'affiche comme une distance nulle. On exige d'abord une vraie mesure.
  const isMeasurable = typeof distanceKm === 'number'
    || (typeof distanceKm === 'string' && distanceKm.trim() !== '');
  if (!isMeasurable) return '';

  const value = Number(distanceKm);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 1) return `à ${Math.max(50, Math.round((value * 1000) / 50) * 50)} m`;

  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `à ${String(rounded).replace('.', ',')} km`;
};

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const toFiniteNumber = (value) => {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const parseLngLatFromValue = (value) => {
  if (typeof value !== 'string' || !value.includes('|')) return null;
  const [lngRaw, latRaw] = value.split('|');
  const lat = toFiniteNumber(latRaw);
  const lng = toFiniteNumber(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const pickFirstText = (...candidates) => candidates.reduce((found, candidate) => {
  if (found) return found;
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    return trimmed.length > 0 ? trimmed : found;
  }
  if (typeof candidate === 'number') {
    return String(candidate);
  }
  if (candidate && typeof candidate === 'object') {
    return pickFirstText(
      candidate.label,
      candidate.description,
      candidate.address_line,
      candidate.address,
      candidate.name,
      candidate.city,
      candidate.context,
      candidate.properties?.label,
      candidate.properties?.city,
      candidate.properties?.context,
    );
  }
  return found;
}, null);

const extractCoordinates = (input) => {
  if (!input || typeof input !== 'object') return null;

  const lat = toFiniteNumber(
    input.lat
        ?? input.latitude
        ?? input.position?.lat
        ?? input.coordinates?.lat
        ?? input.geometry?.coordinates?.[1]
        ?? input.address?.lat
        ?? input.address?.latitude,
  );
  const lng = toFiniteNumber(
    input.lng
        ?? input.lon
        ?? input.longitude
        ?? input.position?.lng
        ?? input.position?.lon
        ?? input.coordinates?.lng
        ?? input.coordinates?.lon
        ?? input.geometry?.coordinates?.[0]
        ?? input.address?.lng
        ?? input.address?.lon
        ?? input.address?.longitude,
  );

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  const directValue = parseLngLatFromValue(input.value);
  if (directValue) return directValue;

  const nestedValue = parseLngLatFromValue(input.address?.value);
  if (nestedValue) return nestedValue;

  return null;
};

export const normalizeRadius = (radiusLike, fallback = DEFAULT_RADIUS_KM) => {
  const parsed = Number.parseInt(String(radiusLike ?? fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(MIN_RADIUS_KM, Math.min(MAX_RADIUS_KM, parsed));
};

export const normalizeLocationInput = (locationLike) => {
  const parsed = parseMaybeJson(locationLike);
  if (!parsed || typeof parsed !== 'object') return null;

  const normalizedAddress = parseMaybeJson(parsed.address);
  const properties = parsed.properties || normalizedAddress?.properties || {};
  const coordinates = extractCoordinates(parsed);

  const label = pickFirstText(
    parsed.label,
    parsed.address_line,
    parsed.address,
    normalizedAddress?.label,
    normalizedAddress?.address,
    properties.label,
  );
  const city = pickFirstText(
    parsed.city,
    normalizedAddress?.city,
    properties.city,
    properties.context,
  );
  const postcode = pickFirstText(
    parsed.postcode,
    normalizedAddress?.postcode,
    properties.postcode,
  );
  const addressLine = pickFirstText(
    parsed.address_line,
    parsed.street,
    normalizedAddress?.address_line,
    normalizedAddress?.street,
    normalizedAddress?.address,
    properties.street,
    label,
  );

  const radius = normalizeRadius(
    parsed.radius
        ?? normalizedAddress?.radius
        ?? parsed.home_base?.radius,
    DEFAULT_RADIUS_KM,
  );

  return {
    address: addressLine,
    city,
    context: pickFirstText(parsed.context, properties.context),
    country: pickFirstText(parsed.country, normalizedAddress?.country, properties.country) || 'FR',
    label,
    lat: coordinates?.lat ?? null,
    lng: coordinates?.lng ?? null,
    postcode,
    radius,
    value: coordinates ? `${coordinates.lng}|${coordinates.lat}` : '',
  };
};

export const getLocationCoordinates = (locationLike) => {
  const normalized = normalizeLocationInput(locationLike);
  if (!normalized) return null;
  if (!Number.isFinite(normalized.lat) || !Number.isFinite(normalized.lng)) return null;
  return { lat: normalized.lat, lng: normalized.lng };
};

export const hasValidLocationCoordinates = (locationLike) => Boolean(getLocationCoordinates(locationLike));

export const buildHomeBasePayload = (locationLike, radiusLike = DEFAULT_RADIUS_KM) => {
  const normalized = normalizeLocationInput(locationLike);
  if (!normalized) return null;
  if (!Number.isFinite(normalized.lat) || !Number.isFinite(normalized.lng)) return null;

  const radius = normalizeRadius(radiusLike, normalized.radius ?? DEFAULT_RADIUS_KM);
  const label = normalized.label || normalized.address || '';
  const address = normalized.address || label;

  return {
    address,
    city: normalized.city || '',
    country: normalized.country || 'FR',
    label,
    lat: normalized.lat,
    lng: normalized.lng,
    postcode: normalized.postcode || '',
    radius,
    value: `${normalized.lng}|${normalized.lat}`,
  };
};
