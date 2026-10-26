import localeDesFormats from '@/theme/strings/localeDesFormats';

// FINITIONS8 (tournee 9, point 4) — LA TAILLE, EN CENTIMETRES.
//
// Trois ecrans se contredisaient : l'inscription demandait des centimetres (« Taille (cm) »,
// « Ex : 180 »), la modification du profil des metres (« Taille (m) », « 1,80 », sur un clavier
// SANS virgule), et la fiche collait « m » derriere toute valeur — d'ou « 182 m »
// (T9_A18_2). Le serveur garde une chaine libre (`height`, string) : on y trouve donc les deux.
// Regle : on SAISIT des centimetres, entre 100 et 250 ; on RELIT les deux formes ; on AFFICHE
// des metres (« 1,82 m »).
// Tests : views/profile/__tests__/profileFormContract.FINITIONS8.taille.test.js (saisie),
// UserDetails.FINITIONS8.taille.test.js (affichage).

// CHOIX3 (« 11- A », P5-24, 26/10) : la LECTURE s'elargit a 50-250 cm (la taille d'un enfant
// s'affiche) ; la SAISIE suit les bornes de l'age, plus bas (`erreurPhysique`).
export const HEIGHT_CM_MIN = 50;
export const HEIGHT_CM_MAX = 250;

// CHOIX3 — LES BORNES DE LA SAISIE, SELON L'AGE.
// Adulte : 100 a 230 cm, 25 a 200 kg (decision d'Adel). Mineur : 50 a 230 cm, 10 a 200 kg, une
// seule paire pour tous les mineurs (choix du lot : simple, un enfant de 4 ans comme un U17 y
// tient). Age inconnu (pas de date de naissance) : celles de l'adulte.
// ⚠️ Memes chiffres cote serveur : admin/src/utils/physical-bounds.js.
export const BORNES_ADULTE = { poids: { max: 200, min: 25 }, taille: { max: 230, min: 100 } };
export const BORNES_MINEUR = { poids: { max: 200, min: 10 }, taille: { max: 230, min: 50 } };

/**
 * @param {number | null | undefined} age
 * @returns {boolean}
 */
const estMineur = (age) => typeof age === 'number' && age < 18;

/**
 * La taille en centimetres, lue dans une saisie ou une valeur enregistree : « 182 », « 182 cm »,
 * « 1,82 », « 1.82 m ». Hors des bornes (50 a 250 cm par defaut), ou illisible : null.
 * @param {unknown} value
 * @param {{ max: number, min: number }} [bornes]
 * @returns {number | null}
 */
export const parseHeightCm = (value, bornes = { max: HEIGHT_CM_MAX, min: HEIGHT_CM_MIN }) => {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s*(cm|m)$/, '')
    .replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(text)) return null;

  const number = Number(text);
  // Moins de 3 : des metres (personne ne mesure 3 cm, ni 3 m).
  const centimeters = Math.round(number < 3 ? number * 100 : number);
  return centimeters >= bornes.min && centimeters <= bornes.max ? centimeters : null;
};

/**
 * Le poids en kilos : « 75 », « 75 kg », « 72,5 ». Hors des bornes, ou illisible : null.
 * @param {unknown} value
 * @param {{ max: number, min: number }} bornes
 * @returns {number | null}
 */
export const parseWeightKg = (value, bornes) => {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s*kg$/, '')
    .replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(text)) return null;

  const kilos = Number(text);
  return kilos >= bornes.min && kilos <= bornes.max ? kilos : null;
};

/**
 * CHOIX3 — le contrôle de la saisie, le même pour tous les écrans du profil.
 * @param {'height' | 'weight'} champ
 * @param {unknown} value - Vide = permis (les deux champs sont facultatifs).
 * @param {number | null | undefined} age - Null = inconnu, bornes de l'adulte.
 * @returns {{ cle: string | null, valeur: string }} `cle` = clé du message d'erreur (null :
 *   accepté) ; `valeur` = ce qui part au serveur (cm, ou kg avec un point).
 */
export const erreurPhysique = (champ, value, age) => {
  if (!String(value ?? '').trim()) return { cle: null, valeur: '' };
  const bornes = estMineur(age) ? BORNES_MINEUR : BORNES_ADULTE;
  const lu = champ === 'height'
    ? parseHeightCm(value, bornes.taille)
    : parseWeightKg(value, bornes.poids);
  if (lu !== null) return { cle: null, valeur: String(lu) };
  return {
    cle: `profile.fields.${champ}.${estMineur(age) ? 'invalidMinor' : 'invalid'}`,
    valeur: String(value),
  };
};

/**
 * La taille telle que la fiche l'ecrit : « 1,82 m » (« 1.82 m » en anglais). Illisible : ''.
 * @param {unknown} value
 * @returns {string}
 */
export const formatHeight = (value) => {
  const centimeters = parseHeightCm(value);
  if (centimeters === null) return '';
  const meters = (centimeters / 100).toLocaleString(localeDesFormats(), {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  return `${meters} m`;
};
