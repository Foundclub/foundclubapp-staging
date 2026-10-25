import renderer, { act } from 'react-test-renderer';

import AdminEvents from '../AdminEvents';

// BH14 P9-10 (BUGHUNT 24/10/2026) — la plage du jour mélangeait UTC (la date choisie) et heure
// locale (la fin de journée) : à 00:30 à Paris, « Aujourd'hui » désignait la veille, et les
// événements de 0 h à 2 h étaient exclus.
// L attendu se calcule dans le fuseau de la machine (jest ignore un TZ posé dans le fichier) : le
// témoin n est ROUGE sur l ancien code que dans un fuseau à l est d UTC (Paris : constaté).

/** @type {any} */
let mockFiltres;

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('@/components/organisms/eventListContent/EventListContent', () => (/** @type {any} */ props) => {
  mockFiltres = props.additionalFilters;
  return null;
});
jest.mock('@/components/atoms/selectPicker/SelectPicker', () => () => null);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ defaut) => (
      typeof defaut === 'string' ? defaut : cle
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);

test('P9-10 : à 00:30 à Paris, la journée est celle du jour, de minuit à minuit (heure locale)', async () => {
  jest.useFakeTimers({ now: new Date('2026-10-24T22:30:00.000Z') });
  await act(async () => { renderer.create(<AdminEvents />); });
  jest.useRealTimers();
  const maintenant = new Date('2026-10-24T22:30:00.000Z');
  const [a, m, j] = [maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate()];
  expect(mockFiltres.startDateAfter.getTime()).toBe(new Date(a, m, j).getTime());
  expect(mockFiltres.startDateBefore.getTime()).toBe(new Date(a, m, j, 23, 59, 59, 999).getTime());
});
