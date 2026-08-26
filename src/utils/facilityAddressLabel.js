import { getShortAddress } from '@/utils/location';
import safeJsonParse from '@/utils/safeJsonParse';

/**
 * Libelle de lieu — POINT DE VERITE UNIQUE (defaut T8, recette du 26/08).
 *
 * CE QUI S'EST PASSE : deux copies jumelles de `getFacilityAddressLabel` vivaient
 * dans `views/recruitment/wizard/AdWizardLocation` et
 * `components/organisms/facilitySelector/FacilitySelector`. Toutes deux
 * promettaient un libelle et rendaient `address.label || address.description ||
 * address.address` SANS jamais garantir une chaine. Or le serveur envoie une
 * adresse structuree : `{ value: '', address: { geometry, description } }`.
 * Les trois cles etaient donc absentes au premier niveau et la fonction rendait
 * l'OBJET `address.address`. Le `join(' - ')` de l'appelant le transformait en
 * « [object Object] », et cette chaine partait EN BASE : 6 annonces de la
 * recette portent « Gymnase - [object Object] » dans `recruitment_ads.address`.
 *
 * ⛔ `String(objet)` n'est PAS une correction : c'est exactement ce qui a cree le
 * defaut. On descend dans l'objet jusqu'a trouver du texte, et si l'on n'en
 * trouve pas, on rend le repli — jamais l'objet.
 */

// Les cles qui portent du texte d'adresse, par ordre de preference. Ce sont
// celles que les deux copies lisaient deja : l'ordre ne change pas, seule la
// descente est nouvelle.
const ADDRESS_TEXT_KEYS = ['label', 'description', 'address'];

// L'adresse structuree du serveur tient en 2 niveaux ; 4 laisse de la marge sans
// exposer a un objet cyclique.
const MAX_DESCENT = 4;

const CORRUPTED_MARKER = '[object Object]';

const DEFAULT_ADDRESS_FALLBACK = 'Adresse non renseignée';

/**
 * Rend une chaine utilisable, ou une chaine vide.
 *
 * Un texte qui contient deja « [object Object] » est ecarte : c'est le parc
 * corrompu du 26/08, et le garder afficherait le defaut au lieu de le reparer.
 * @param {any} value
 * @returns {string}
 */
const usableText = (value) => {
  if (value === null || value === undefined) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  return trimmed.includes(CORRUPTED_MARKER) ? '' : trimmed;
};

/**
 * Extrait le premier texte exploitable d'une adresse, quelle que soit sa forme.
 * @param {any} value - Chaine, chaine JSON, objet structure, tableau, ou rien.
 * @param {number} [depth] - Profondeur de descente courante.
 * @returns {string} Le texte trouve, ou une chaine vide. JAMAIS un objet.
 */
const pickAddressText = (value, depth = 0) => {
  if (value === null || value === undefined) return '';

  if (typeof value === 'string') {
    // Certains ecrans stockent l'adresse en JSON serialise (`locationDetails`).
    const parsed = safeJsonParse(value, null);
    if (parsed && typeof parsed === 'object' && depth < MAX_DESCENT) {
      return pickAddressText(parsed, depth + 1);
    }
    return usableText(value);
  }

  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value !== 'object' || depth >= MAX_DESCENT) return '';

  if (Array.isArray(value)) {
    return value.reduce((found, item) => found || pickAddressText(item, depth + 1), '');
  }

  return ADDRESS_TEXT_KEYS.reduce(
    (found, key) => found || pickAddressText(value[key], depth + 1),
    '',
  );
};

/**
 * Le texte d'une adresse, ou une chaine vide — sans repli habille.
 *
 * C'est la forme a utiliser quand on ECRIT une donnee : y glisser
 * « Adresse non renseignée » polluerait la base avec un libelle de secours.
 * @param {any} address - L'adresse brute (chaine, objet structure, ou rien).
 * @returns {string} Le texte trouve, ou ''. JAMAIS un objet.
 */
export const getAddressText = (address) => pickAddressText(address);

/**
 * Libelle d'adresse d'une installation — garantit une CHAINE, toujours.
 *
 * Remplace les deux copies jumelles d'AdWizardLocation et de FacilitySelector.
 * @param {any} address - L'adresse brute (chaine, objet structure, ou rien).
 * @param {string} [fallback] - Le repli quand aucun texte n'est trouvable.
 * @returns {string} Un libelle affichable, jamais un objet.
 */
export const getFacilityAddressLabel = (address, fallback = DEFAULT_ADDRESS_FALLBACK) => (
  pickAddressText(address) || usableText(fallback) || DEFAULT_ADDRESS_FALLBACK
);

/**
 * Libelle de lieu pret a afficher — repare aussi le parc deja ecrit en base.
 *
 * Un correctif d'ecriture ne change RIEN aux annonces deja enregistrees : leur
 * `label` reste « Gymnase - [object Object] » tant qu'Adel n'a pas fait passer la
 * requete de reparation. L'affichage doit donc savoir se debrouiller seul, en
 * recomposant le libelle depuis les champs restes sains de la MEME charge
 * (`facilityName` + `address.description`).
 * @param {any} location - La charge `address` de l'annonce, ou une simple chaine.
 * @param {string} [fallbackLabel] - Le repli de l'ecran appelant.
 * @returns {string} Un libelle affichable, jamais « [object Object] ».
 */
export const resolveLocationDisplayLabel = (location, fallbackLabel = '') => {
  const storedLabel = pickAddressText(
    typeof location === 'string' ? location : location?.label,
  );
  if (storedLabel) return storedLabel;

  const facilityName = pickAddressText(location?.facilityName);
  const addressText = pickAddressText(location?.address) || pickAddressText(location);
  const shortAddress = getShortAddress(addressText) || addressText;

  return [facilityName, shortAddress].filter(Boolean).join(' · ') || usableText(fallbackLabel);
};
