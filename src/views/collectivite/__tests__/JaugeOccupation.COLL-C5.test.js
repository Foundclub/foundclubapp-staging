import { View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { phraseOccupation } from '@/domains/collectivite/collectiviteChiffres';

import JaugeOccupation from '../components/JaugeOccupation';

// 📊 COLL-C5 (03/10/2026), point 3 — PLANCHES 2 et 3 : la jauge d'occupation de l'accueil de la
// Ville (design HY521H1 page 1, « Cette semaine »).
// Contrat : admin/docs/CONTRAT_CHIFFRES_VILLE.md §5.
//
// Ce que ce témoin fige (ROUGE avant : la jauge n'existait pas) :
//   - la barre se remplit du TAUX de la semaine, plafonnée à 100 % ;
//   - sans taux, elle reste VIDE et se lit « — » (jamais un 0 inventé) ;
//   - la fin de la ligne « 9 séances · occupation : 6 % » de l'accueil.

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const couleurs = genererCouleurs();
  return { __esModule: true, default: () => ({ Colors: couleurs }) };
});

const t = (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args);

const monter = (/** @type {any} */ { couleur = null, taux = null }) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<JaugeOccupation couleur={couleur} taux={taux} />); });
  const [jauge, plein] = arbre.root.findAllByType(View);
  return { jauge, plein };
};

describe('COLL-C5 — la jauge d’occupation de l’accueil', () => {
  it('se remplit du taux de la semaine, dans la couleur de l’installation', () => {
    const { jauge, plein } = monter({ couleur: 'couleur-du-gymnase', taux: 23 });
    expect(plein.props.style.width).toBe('23%');
    expect(plein.props.style.backgroundColor).toBe('couleur-du-gymnase');
    expect(jauge.props.accessibilityLabel).toBe('Occupation : 23 %');
    expect(jauge.props.accessibilityValue).toEqual({ max: 100, min: 0, now: 23 });
  });

  it('s’arrête à 100 % quand le taux dépasse (hors horaires, « Autoriser et notifier »)', () => {
    expect(monter({ taux: 130 }).plein.props.style.width).toBe('100%');
  });

  it('sans taux : vide, et « — »', () => {
    const { jauge, plein } = monter({ taux: null });
    expect(plein.props.style.width).toBe('0%');
    expect(jauge.props.accessibilityLabel).toBe('Occupation : —');
  });

  it('la fin de la ligne de l’accueil : « occupation : 6 % », ou « occupation : — »', () => {
    expect(phraseOccupation(t, 6)).toBe('occupation : 6 %');
    expect(phraseOccupation(t, null)).toBe('occupation : —');
  });
});
