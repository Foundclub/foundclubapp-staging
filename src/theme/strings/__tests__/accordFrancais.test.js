import i18n from 'i18next';

import accordFrancais from '../accordFrancais';

/**
 * 🐞 « 0 séances faites sur 8 » — en francais, zero prend le SINGULIER.
 *
 * Ce filet ne teste pas i18next : il teste que l adaptateur donne, sous LES DEUX
 * regles de pluriel, la forme que le francais demande. La regle anglaise est celle
 * qui s applique reellement sur le telephone (le moteur embarque ne resout pas
 * `Intl.PluralRules` pour le francais) ; la regle francaise est celle qu on aura
 * le jour ou l app embarquera `intl-pluralrules`.
 */

/**
 * La regle ANGLAISE : 1 → singulier, tout le reste → pluriel.
 * C est celle qui s applique reellement sur le telephone.
 * @param {number} n le compte
 * @returns {string} la forme choisie
 */
const formeAnglaise = (n) => (n === 1 ? 'one' : 'other');

/**
 * La regle FRANCAISE (CLDR) : 0 et 1 → singulier. C est celle qu on veut lire.
 * @param {number} n le compte
 * @returns {string} la forme attendue
 */
const formeFrancaise = (n) => (n === 0 || n === 1 ? 'one' : 'other');

describe('l accord du zero', () => {
  it.each([0, 1, 2, 8, 57])('donne la MEME forme que le francais, pour %i', (n) => {
    expect(formeAnglaise(accordFrancais(n))).toBe(formeFrancaise(n));
  });

  it('ne change que le zero', () => {
    expect(accordFrancais(0)).toBe(1);
    [1, 2, 3, 57].forEach((n) => expect(accordFrancais(n)).toBe(n));
  });

  it('ne tombe pas sur une valeur absente', () => {
    expect(accordFrancais(undefined)).toBe(0);
    expect(accordFrancais(null)).toBe(1);
  });
});

describe('sur de vraies phrases du programme', () => {
  beforeAll(() => {
    i18n.init({
      compatibilityJSON: 'v4',
      lng: 'en', // ⚠️ EXPRES : on rejoue la regle du telephone, pas celle de Node.
      resources: {
        en: {
          translation: {
            seances_one: '{{done}} séance faite sur {{total}}',
            seances_other: '{{done}} séances faites sur {{total}}',
          },
        },
      },
    });
  });

  it('« 0 séance faite sur 8 » — et non « 0 séances faites »', () => {
    expect(i18n.t('seances', { count: accordFrancais(0), done: 0, total: 8 }))
      .toBe('0 séance faite sur 8');
  });

  it('garde le singulier a 1 et le pluriel a 2', () => {
    expect(i18n.t('seances', { count: accordFrancais(1), done: 1, total: 8 }))
      .toBe('1 séance faite sur 8');
    expect(i18n.t('seances', { count: accordFrancais(3), done: 3, total: 8 }))
      .toBe('3 séances faites sur 8');
  });
});
