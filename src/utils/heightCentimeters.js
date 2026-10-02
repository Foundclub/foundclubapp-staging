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

export const HEIGHT_CM_MIN = 100;
export const HEIGHT_CM_MAX = 250;

/**
 * La taille en centimetres, lue dans une saisie ou une valeur enregistree : « 182 », « 182 cm »,
 * « 1,82 », « 1.82 m ». Hors de 100 a 250 cm, ou illisible : null.
 * @param {unknown} value
 * @returns {number | null}
 */
export const parseHeightCm = (value) => {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s*(cm|m)$/, '')
    .replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(text)) return null;

  const number = Number(text);
  // Moins de 3 : des metres (personne ne mesure 3 cm, ni 3 m).
  const centimeters = Math.round(number < 3 ? number * 100 : number);
  return centimeters >= HEIGHT_CM_MIN && centimeters <= HEIGHT_CM_MAX ? centimeters : null;
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
