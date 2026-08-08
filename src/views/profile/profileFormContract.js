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
