import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import FacilityPlanningList from '../FacilityPlanningList';

// T3-STADE (03/11/2026, Adel) — la liste du planning dit qu'un bloc prend toute l'installation.

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

const LUNDI = new Date(2026, 9, 5);
const bloc = (/** @type {boolean} */ wholeFacility) => normalizePlanningItems([{
  club: { documentId: 'club-b', name: 'AS Foot' },
  documentId: 'seance',
  endAt: '2026-10-06T18:00:00.000Z',
  endTime: '20:00:00.000',
  hasExplicitTime: true,
  kind: 'slot',
  origin: 'slot',
  startAt: '2026-10-06T16:00:00.000Z',
  startTime: '18:00:00.000',
  title: 'AS Foot',
  wholeFacility,
}]);
const textes = async (/** @type {boolean} */ wholeFacility) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <FacilityPlanningList
        capacite={2}
        debutDeSemaine={LUNDI}
        evenements={bloc(wholeFacility)}
        fermeture="22:00"
        fermetures={[]}
        ouverture="08:00"
      />,
    );
  });
  const lus = arbre.root.findAllByType(Text)
    .map((/** @type {any} */ noeud) => noeud.props.children);
  await act(async () => { arbre.unmount(); });
  return lus;
};

describe('T3-STADE — la marque du planning', () => {
  it('un bloc entier la porte, un autre non', async () => {
    expect(await textes(true)).toContain('Toute l’installation');
    expect(await textes(false)).not.toContain('Toute l’installation');
  });
});
