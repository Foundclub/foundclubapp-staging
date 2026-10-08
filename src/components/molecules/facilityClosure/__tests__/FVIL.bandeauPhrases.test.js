/* eslint-disable max-len -- les phrases de l'écran sont citées en entier */
import { View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityClosureBanner from '../FacilityClosureBanner';

// 🚧 FINITIONS-VILLE (08/10/2026, tournée T20 lot 6) — « … mercredi 4 novembre T20 essai. »,
// « fermé le jeudi 8 octobre Ascension. » : le bandeau d'une fermeture se lit (lecteur d'écran,
// arbre d'accessibilité) en UNE phrase collée — le titre n'a pas de point, le nom de la fermeture
// le suit sans séparateur. Le bandeau se lit désormais « titre. nom. ».
// ROUGE avant le lot : aucune étiquette, la région se lit par ses deux lignes accolées.

jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        let texte = cle;
        if (typeof valeur === 'string') texte = valeur;
        else if (typeof repli === 'string') texte = repli;
        return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''));
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

const etiquette = async (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  // eslint-disable-next-line react/jsx-props-no-spreading
  await act(async () => { arbre = renderer.create(<FacilityClosureBanner {...props} />); });
  const region = arbre.root.findAllByType(View).find((/** @type {any} */ n) => n.props.accessibilityRole === 'summary');
  return region?.props?.accessibilityLabel;
};

describe('FVIL lot 6 · le bandeau d’une fermeture se lit en phrases séparées', () => {
  it('le nom de la fermeture, puis le mot de la Ville, chacun après un point', async () => {
    expect(await etiquette({
      closure: {
        endDate: '2026-11-04', kind: 'closure', label: 'T20 essai', reason: 'autre', startDate: '2026-11-04',
      },
      facilityType: 'Dojo',
      withDays: true,
    })).toBe('Le dojo est fermé le mercredi 4 novembre. T20 essai.');
    expect(await etiquette({
      closure: {
        endDate: '2026-10-08', kind: 'closure', label: 'Ascension', message: 'Bon week-end', reason: 'autre', startDate: '2026-10-08',
      },
      facilityType: 'Terrain',
      withDays: true,
    })).toBe('Le terrain est fermé le jeudi 8 octobre. Ascension. Mot de la Ville : « Bon week-end ».');
  });

  it('un blocage : « Bloquée par la Ville le …, 09:00 – 13:00. Recette T10. »', async () => {
    expect(await etiquette({
      closure: {
        endDate: '2026-10-09', endTime: '13:00', kind: 'block', label: 'Recette T10', startDate: '2026-10-09', startTime: '09:00',
      },
      withDays: true,
    })).toBe('Bloquée par la Ville le vendredi 9 octobre, 09:00 – 13:00. Recette T10.');
  });
});
