import { Dimensions } from 'react-native';

export const screenWidth = Dimensions.get('window').width;
export const screenHeight = Dimensions.get('window').height;

// Rampe d'espacement. Elle a des TROUS assumes : `Spaces.gap[10]` rend
// `undefined` et React Native ignore la valeur EN SILENCE, sans avertissement.
// Un jeton absent est donc un style perdu, pas une erreur.
//
// 38 / 44 / 52 / 74 ajoutes le 2026-08-05 (GO Adel) pour les deux packs de
// design : 44 = cible tactile et boutons, 52 = rangees de profil et CTA,
// 74 = cartes option du tunnel amical, 38 = tuiles d'icone. Aucun appelant
// aujourd'hui : les ajouter ne change donc l'apparence d'aucun ecran.
//
// ⛔ 6, 10 et 14 sont VOLONTAIREMENT absents. 183 appels hors rampe existent
// deja dans 51 fichiers (10 x78, 6 x33, 14 x29) : les declarer donnerait d'un
// coup a ~140 endroits un espacement qu'ils n'ont jamais eu. C'est un lot a
// part, avec sa propre recette.
export const sizes = {
  0: 0,
  12: 12,
  128: 128,
  16: 16,
  160: 160,
  24: 24,
  32: 32,
  38: 38,
  4: 4,
  40: 40,
  44: 44,
  52: 52,
  64: 64,
  74: 74,
  8: 8,
  80: 80,
};

export const types = {
  gap: 'gap',
  margin: 'margin',
  marginBottom: 'marginBottom',
  marginHorizontal: 'marginHorizontal',
  marginLeft: 'marginLeft',
  marginRight: 'marginRight',
  marginTop: 'marginTop',
  marginVertical: 'marginVertical',
  padding: 'padding',
  paddingBottom: 'paddingBottom',
  paddingHorizontal: 'paddingHorizontal',
  paddingLeft: 'paddingLeft',
  paddingRight: 'paddingRight',
  paddingTop: 'paddingTop',
  paddingVertical: 'paddingVertical',
};

/**
 * Generate classes defining margin and padding for every sizes defined above
 * @returns {import('./types').Spaces} - The generated classes.
 */
const getSpaces = () => {
  /**
   * @type {import('./types').Spaces}
   */
  // @ts-expect-error because we can't use typescript as type to define the accumulator
  const initialAcc = {};
  return Object.keys(types).reduce(
    (acc, type) => ({
      ...acc,
      [type]: Object.entries(sizes).reduce(
        (accSize, [key, value]) => ({
          ...accSize,
          [key]: {
            [type]: value,
          },
        }),
        {},
      ),
    }),
    initialAcc,
  );
};

export default getSpaces();
