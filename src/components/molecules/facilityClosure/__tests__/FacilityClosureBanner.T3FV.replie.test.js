import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityClosureBanner from '../FacilityClosureBanner';

// T3-FINITIONS-VILLE (03/11, point 7) — trois bandeaux poussaient le calendrier du Mois sous le bord
// (mi-écran à 1440, plus bas à 390). `replie` : la plus proche, puis « Voir les 2 autres fermetures ».
jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ troisieme) => {
        const options = typeof repli === 'object' ? repli : troisieme;
        const segments = cle.split('.');
        const parent = segments.slice(0, -1).reduce((n, s) => (n == null ? undefined : n[s]), catalogue);
        const dernier = segments[segments.length - 1];
        const suffixe = options?.count === 1 ? '_one' : '_other';
        const valeur = parent?.[dernier] ?? parent?.[`${dernier}${suffixe}`];
        return String(valeur ?? (typeof repli === 'string' ? repli : cle))
          .replace(/\{\{(\w+)\}\}/g, (_t, nom) => String(options?.[nom] ?? ''));
      },
    }),
  };
});
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({ Colors: couleurs, Fonts: genererPolices(couleurs), Spaces: espaces }),
  };
});
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));

const FERMETURES = ['24', '26', '30'].map((jour) => ({
  documentId: `f-${jour}`, endDate: `2026-11-${jour}`, kind: 'closure', reason: 'travaux', startDate: `2026-11-${jour}`,
}));
const monter = async (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
  await act(async () => { arbre = renderer.create(<FacilityClosureBanner {...props} />); });
  return arbre;
};
const titres = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => [].concat(n.props.children).join(''))
  .filter((/** @type {string} */ texte) => texte.includes('fermé'));
const lesAutres = (/** @type {any} */ arbre) => arbre.root.findAllByType(TouchableOpacity)
  .find((/** @type {any} */ n) => n.props.testID === 'bandeau-fermeture-autres');

describe('T3-FINITIONS-VILLE point 7 — plusieurs fermetures au planning', () => {
  it('replié : la plus proche et un seul bouton, qui se lit et se referme', async () => {
    const arbre = await monter({
      closures: FERMETURES, facilityType: 'Dojo', replie: true, withDays: true,
    });
    expect(titres(arbre)).toHaveLength(1);
    expect(titres(arbre)[0]).toContain('24 novembre');
    expect(lesAutres(arbre).props.accessibilityLabel).toBe('Voir les 2 autres fermetures');
    expect(lesAutres(arbre).props.accessibilityState).toEqual({ expanded: false });
    await act(async () => { lesAutres(arbre).props.onPress(); });
    expect(titres(arbre)).toHaveLength(3);
    expect(lesAutres(arbre).props.accessibilityLabel).toBe('Masquer les autres fermetures');
    await act(async () => { lesAutres(arbre).props.onPress(); });
    expect(titres(arbre)).toHaveLength(1);
  });

  it('une seule autre : au singulier', async () => {
    const arbre = await monter({ closures: FERMETURES.slice(0, 2), replie: true, withDays: true });
    expect(lesAutres(arbre).props.accessibilityLabel).toBe('Voir l’autre fermeture');
  });

  it('sans `replie` (la carte d une installation) : toutes, comme avant', async () => {
    const arbre = await monter({ closures: FERMETURES, withDays: true });
    expect(titres(arbre)).toHaveLength(3);
    expect(lesAutres(arbre)).toBeUndefined();
  });
});
