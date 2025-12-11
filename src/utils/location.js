
/**
 * Extracts a short address (Zip Code + City) from address details.
 * Handles various formats:
 * - Structured object: { postcode: "13002", city: "Marseille" }
 * - Full string: "25 Boulevard des dames 13002 Marseille" -> "13002 Marseille"
 * - Suffix format: "Marseille (13008)" -> "13008 Marseille"
 * - Duplicate zip: "21 Rue Lecourbe 75015 Paris (75015)" -> "75015 Paris"
 * 
 * @param {string | object | null} addressDetails 
 * @returns {string} Formatted address or empty string
 */
export function getShortAddress(addressDetails) {
    if (!addressDetails) return '';

    let raw = '';
    let parsed = null;

    // 1. Normaliser : récupérer la vraie chaîne d’adresse ou l'objet
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

    // Priority 0: Structured data (Clubs format preservation)
    if (parsed && typeof parsed === 'object') {
        const zip = parsed.zipCode || parsed.postcode;
        const city = parsed.city;
        if (zip && city) {
            return `${zip} ${city}`;
        }
    }

    if (!raw || typeof raw !== 'string') return '';

    const cleanRaw = raw.trim();

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
