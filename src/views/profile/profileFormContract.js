import { Joi } from '@/theme/strings';

// D39 — le contrat du formulaire de profil, extrait de `ProfileEdit.js` pour
// que la page « Mon profil » du joueur et de l'entraineur s'en serve SANS le
// recopier (§1 bis barreau 2 : reutiliser avant de reecrire).
//
// ⚠️ Il vit dans un module NEUTRE, et c'est volontaire : importer
// `@/views/profile/ProfileEdit` depuis un fichier sans suffixe se resout en
// `ProfileEdit.web.js` cote Vite, qui n'exporte rien de tout ceci. Le site se
// casserait sans qu'aucune porte de `app` ne le voie.

export const defaultValues = {
  address: null,
  bestLevel: '',
  birthdate: '',
  category: '',
  email: '',
  firstname: '',
  height: '',
  isLookingForClub: false,
  jerseyNumber: '',
  lastname: '',
  nationality: '',
  phoneNumber: '',
  position: '',
  preferredSport: '',
  section: '',
  weight: '',
};

export const profileSchema = Joi.object({
  address: Joi.object().allow(null).optional(),
  bestLevel: Joi.string().allow(null, '').optional(),
  birthdate: Joi.string().pattern(/^(\d{2}\/\d{2}\/\d{4})?$/).allow('').optional(),
  category: Joi.string().allow(null, '').optional(),
  documentId: Joi.string().allow(null, '').optional(),
  email: Joi.string().allow(null, '').optional(),
  firstname: Joi.string().required(),
  height: Joi.string().allow(null, '').optional(),
  isLookingForClub: Joi.boolean().optional(),
  jerseyNumber: Joi.string().pattern(/^([0-9]{1,2})?$/).allow('').optional(),
  lastname: Joi.string().required(),
  nationality: Joi.string().allow(null, '').optional(),
  phoneNumber: Joi.string(),
  position: Joi.string().allow(null, '').optional(),
  preferredSport: Joi.string().allow(null, '').optional(),
  section: Joi.string().allow(null, '').optional(),
  weight: Joi.string().allow(null, '').optional(),
}).unknown(true);

/**
 * Precharge le formulaire avec les VRAIES valeurs du profil.
 * « Placeholder n'est pas une valeur » : une donnee qui existe s'affiche dans
 * son champ, jamais en gris d'exemple.
 * @param {any} userData
 * @param {(value: string) => string} formatBirthdateToDisplay
 * @returns {any}
 */
export const buildProfileFormValues = (userData, formatBirthdateToDisplay) => ({
  ...defaultValues,
  ...userData,
  address: userData?.address || null,
  bestLevel: userData?.bestLevel || '',
  birthdate: formatBirthdateToDisplay(userData?.birthdate || ''),
  category: userData?.category || '',
  height: userData?.height ? String(userData.height) : '',
  jerseyNumber: userData?.jerseyNumber != null ? String(userData.jerseyNumber) : '',
  nationality: userData?.nationality || '',
  preferredSport: userData?.preferredSport || '',
  section: userData?.section?.documentId || '',
  weight: userData?.weight ? String(userData.weight) : '',
});

/**
 * L'age derive de la date de naissance affichee (JJ/MM/AAAA).
 * Le pack l'exige fusionne : « 10/04/2000 · 26 ans ». Il se CALCULE, il ne se
 * saisit pas.
 * @param {string} displayedBirthdate
 * @returns {number | null}
 */
export const getAgeFromDisplayedBirthdate = (displayedBirthdate) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(displayedBirthdate || '').trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const birthDate = new Date(year, month - 1, day);
  if (
    birthDate.getFullYear() !== year
    || birthDate.getMonth() !== month - 1
    || birthDate.getDate() !== day
  ) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const hasHadBirthdayThisYear = today.getMonth() > month - 1
    || (today.getMonth() === month - 1 && today.getDate() >= day);
  if (!hasHadBirthdayThisYear) age -= 1;

  return age >= 0 && age < 130 ? age : null;
};

// AC03 — « la categorie et le sport se CHERCHENT et se CHOISISSENT ».
// Les trois ecrans d'edition du profil (`ProfileEdit`, `ProfileEdit.web` et
// `SelfProfilePlayerCoach`) portaient chacun leur PROPRE liste ecrite en dur :
// six listes au total, qui divergeaient deja de celles du serveur
// (`/activities` et `/categories`) que l'inscription et les tunnels d'equipe
// utilisent, eux, depuis toujours. Ces deux fonctions sont la seule chose que
// les trois ecrans partagent desormais — elles ne connaissent ni React ni le
// reseau, donc elles se testent sans monter un ecran.

/**
 * Compare deux libelles sans se laisser piéger par la casse ni les accents :
 * l'inscription enregistre « Football », un vieux profil porte « football », et
 * le serveur nomme « Sénior (+18 ans) ».
 * @param {unknown} value
 * @returns {string}
 */
const normalizeChoice = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

/**
 * Les libelles de la liste de reference, tels que le serveur les nomme.
 * @param {Array<{name?: string}> | undefined | null} referenceItems
 * @returns {string[]}
 */
const referenceNames = (referenceItems) => (Array.isArray(referenceItems) ? referenceItems : [])
  .map((item) => String(item?.name ?? '').trim())
  .filter(Boolean);

/**
 * Decoupe la valeur enregistree en choix.
 * ⚠️ `category` est UNE CHAINE a virgules (« U13, U15 ») et pas une liste :
 * c'est la forme que le serveur attend (`user.category` est un `string`), et ce
 * lot ne la change pas.
 * @param {unknown} rawValue
 * @returns {string[]}
 */
export const splitChoiceValue = (rawValue) => String(rawValue ?? '')
  .split(',')
  .map((part) => part.trim())
  .filter(Boolean);

/**
 * Les options d'un champ de profil, baties sur la LISTE DU SERVEUR.
 *
 * 🔒 Le garde-fou du lot : une valeur deja enregistree qui ne figure PAS dans
 * la liste est ajoutee en tete au lieu de disparaitre. Personne ne perd ce
 * qu'il avait ecrit du temps de la saisie libre ; il le remplace quand il veut.
 * @param {Array<{name?: string}> | undefined | null} referenceItems
 * @param {unknown} rawValue - La valeur enregistree (« U13, U15 » ou « football »).
 * @param {string} [search] - Ce que la personne tape dans la barre de recherche.
 * @returns {Array<{label: string, value: string}>}
 */
export const buildChoiceOptions = (referenceItems, rawValue, search = '') => {
  const known = referenceNames(referenceItems);
  const knownKeys = new Set(known.map(normalizeChoice));
  const seen = new Set();
  const orphans = splitChoiceValue(rawValue).filter((token) => {
    const key = normalizeChoice(token);
    if (knownKeys.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const needle = normalizeChoice(search);

  return [...orphans, ...known]
    .filter((name) => !needle || normalizeChoice(name).includes(needle))
    .map((name) => ({ label: name, value: name }));
};

/**
 * Les choix a montrer comme COCHES dans la liste.
 *
 * La liste deroulante compare les libelles caractere pour caractere : un profil
 * qui porte « football » ne se verrait pas coche en face de « Football ». On
 * rend donc le libelle du serveur des qu'il designe la meme chose, et la valeur
 * brute sinon.
 * ⚠️ Rien n'est ENREGISTRE ici : tant que la personne ne rechoisit pas
 * elle-meme, le profil garde exactement ce qu'il portait.
 * @param {Array<{name?: string}> | undefined | null} referenceItems
 * @param {unknown} rawValue
 * @returns {string[]}
 */
export const resolveChoiceValues = (referenceItems, rawValue) => {
  const byKey = new Map(
    referenceNames(referenceItems).map((name) => [normalizeChoice(name), name]),
  );

  return splitChoiceValue(rawValue).map((token) => byKey.get(normalizeChoice(token)) || token);
};
