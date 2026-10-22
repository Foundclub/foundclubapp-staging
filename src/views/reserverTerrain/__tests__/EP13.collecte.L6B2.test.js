import renderer, { act } from 'react-test-renderer';

import { contenuDEchec } from '@/domains/complexe/reserverTerrain';
import { reactI18next } from '@/theme/strings/__mocks__/doublureTraduction';

import ReserverEchec from '@/views/reserverTerrain/ReserverEchec';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, pressable } from '@/testSupport/temoinComplexe';

// RESA-L6B-2 (20/10/2026) — E-P13, ce que les serveurs RESA-L3 / L4 ouvrent (planche EP13 variantes
// 1, 2, 3, 5, 7, 11 ; plan E-P13) :
//   · 1 · collecte, créneau pris : le texte A-P08 au « tu », « Voir d'autres créneaux », « Réserver
//     ailleurs » ; 2 · collecte, date limite : « Relancer sur un autre créneau » ;
//   · 3 · refusée et 5 · annulée par le complexe : « Écrire au complexe » (la conversation de la
//     réservation) — seulement là où une réservation est connue (l'en-tête de E-P07) ;
//   · 11 · plafond atteint : « Voir mes réservations » (E-P10).

const mockNavigate = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn(), navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));
const mockVersLaRecherche = jest.fn();
jest.mock('@/views/search/searchRouteHelpers', () => ({
  navigateToSearchHub: (/** @type {any[]} */ ...args) => mockVersLaRecherche(...args),
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/components/templates/ScreenContainer', () => (
  function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  }
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const { t } = reactI18next.useTranslation();
const CRENEAU = {
  complexe: 'Le Five de Montrivage',
  date: '2026-10-14',
  from: '18:00',
  slug: 'le-five-de-montrivage',
  terrain: 'Terrain 1',
  terrainId: 't-1',
  to: '19:00',
};

/**
 * Monte E-P13.
 * @param {Record<string, any>} params - Les paramètres de route.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async (params) => {
  mockParams = params;
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverEchec />);
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('11 · plafond atteint : « Voir mes réservations » ouvre E-P10', async () => {
  const arbre = await monter({
    ...CRENEAU, details: { code: 'COMPLEXE_RESERVATION_PLAFOND', max: 2 }, variante: 'plafond',
  });
  await act(async () => {
    pressable(arbre, 'Voir mes réservations').props.onPress();
  });
  expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverMesReservations);
});

it('1 · collecte, créneau pris : A-P08 au « tu », deux sorties', async () => {
  const arbre = await monter({ ...CRENEAU, variante: 'collectePrise' });
  expect(lisibles(arbre)).toEqual(expect.arrayContaining([
    'Réservation non aboutie',
    'Désolé, ta réservation n’a pas pu aboutir : quelqu’un a réservé le créneau avant que tu '
      + 'réunisses assez de joueurs.',
    'Voir d’autres créneaux',
    'Réserver ailleurs',
  ]));
});

it('2 · collecte, date limite : « Relancer sur un autre créneau », le calendrier', async () => {
  const arbre = await monter({ ...CRENEAU, variante: 'collecteDelai' });
  await act(async () => {
    pressable(arbre, 'Relancer sur un autre créneau').props.onPress();
  });
  expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverCreneau, expect.objectContaining({
    slug: 'le-five-de-montrivage', terrainId: 't-1',
  }));
});

it('3 et 5 · « Écrire au complexe » proposé ; seul, l’écran ne l’a pas', async () => {
  expect(contenuDEchec(t, 'refusee', { motif: 'tournoi.' }).actions)
    .toEqual(['autresCreneaux', 'ecrire']);
  expect(contenuDEchec(t, 'annuleeParLeComplexe').actions).toEqual(['ecrire']);
  // Sans réservation (un refus au moment de réserver), pas de conversation à ouvrir.
  const arbre = await monter({ ...CRENEAU, motif: 'tournoi.', variante: 'refusee' });
  expect(lisibles(arbre)).not.toContain('Écrire au complexe');
});
