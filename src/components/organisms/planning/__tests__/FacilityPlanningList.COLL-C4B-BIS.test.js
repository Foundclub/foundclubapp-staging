/* eslint-disable max-len -- des phrases entieres de la liste, comparees telles quelles */
import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import FacilityPlanningList from '../FacilityPlanningList';

// 🖥️ COLL-C4B-BIS (03/10/2026) — planche 25 du plan, design HY521H1 page 4 : la vue « Liste » du
// planning d une installation face a une fermeture.
//   point 3 : la seance touchee se cerne de POINTILLES — sur Android, seulement si ses quatre bords
//             ont la meme epaisseur et la meme couleur (bord gauche de 3 px : trait plein) ;
// ROUGE avant le lot : bord gauche de 3 px a la couleur du club.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
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

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

const COULEURS = jest.requireActual('@/theme/colors').colors;
// La semaine du lundi 5 octobre 2026.
const LUNDI = new Date(2026, 9, 5);
const bloc = (/** @type {any} */ champs) => ({
  closure: null,
  club: { documentId: 'club-A', name: 'Montrivage FC' },
  documentId: null,
  facility: { documentId: 'gym-ville', name: 'Gymnase des Tilleuls' },
  hasExplicitTime: true,
  kind: 'slot',
  team: { name: 'Senior B' },
  title: 'Montrivage FC · Senior B',
  ...champs,
});
// Vendredi 9, 18:00 - 19:30, touchee par la fermeture du jour.
const TOUCHEE = bloc({
  closure: { documentId: 'f1', kind: 'closure' },
  endAt: '2026-10-09T17:30:00.000Z',
  endTime: '19:30:00.000',
  startAt: '2026-10-09T16:00:00.000Z',
  startTime: '18:00:00.000',
});

/** @type {any[]} */
const arbresMontes = [];
afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});
const monter = async (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <FacilityPlanningList
        capacite={2}
        debutDeSemaine={LUNDI}
        evenements={props.evenements}
        fermeture="22:00"
        fermetures={props.fermetures}
        onFreePress={props.onFreePress}
        ouverture="08:00"
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};
const ligneDe = (/** @type {any} */ arbre, /** @type {string} */ texte) => arbre.root
  .findAll((/** @type {any} */ n) => typeof n.type === 'string' && n.props.accessible === true)
  .find((/** @type {any} */ n) => n.findAllByType(Text).some((/** @type {any} */ e) => e.props.children === texte));

describe('COLL-C4B-BIS — la Liste face a une fermeture', () => {
  it('point 3 : la seance touchee, pointilles sur quatre bords egaux, orange', async () => {
    const arbre = await monter({ evenements: normalizePlanningItems([TOUCHEE]) });
    const style = StyleSheet.flatten(ligneDe(arbre, 'Montrivage FC · Senior B').props.style);
    expect(style.borderStyle).toBe('dashed');
    expect(style.borderLeftWidth).toBe(style.borderWidth);
    expect(style.borderLeftColor).toBe(COULEURS.warning500);
  });
});
