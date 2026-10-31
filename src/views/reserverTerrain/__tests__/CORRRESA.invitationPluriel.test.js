import renderer, { act } from 'react-test-renderer';

import ReserverInvitation from '@/views/reserverTerrain/ReserverInvitation';

import { lisibles } from '@/testSupport/temoinComplexe';

// CORR-RESA (83 A) — E-P08, la jauge de la page d'invitation accorde le nombre : « 1 présent sur
// 10 », « 3 présents sur 10 ». Doublures d'EP08.invitation.L6B2.test.js.

jest.setTimeout(30000);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: { code: 'K7Q2M9' } }),
}));

let mockInvitation = /** @type {any} */ ({});
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useInvitation: () => mockInvitation,
  useRepondreParLeLien: () => ({ isPending: false, mutateAsync: jest.fn() }),
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

/**
 * La page d'un lien (`toPublicView`, serveur RESA-L3), comme dans EP08.
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} La page.
 */
const pageDuLien = (autres = {}) => ({
  annonce: null,
  code: 'K7Q2M9',
  collecte: null,
  complexe: { city: 'Montrivage', name: 'Le Five de Montrivage', slug: 'le-five-de-montrivage' },
  date: '2026-10-13',
  endsAt: '2026-10-13T17:00:00.000Z',
  etat: 'ouverte',
  from: '18:00',
  message: null,
  minAge: 16,
  organisateur: 'Julien',
  participants: ['Julien M.'],
  places: 10,
  presents: 1,
  price: { amount: 60, perPlayer: 6, unit: 'creneau' },
  startsAt: '2026-10-13T16:00:00.000Z',
  terrain: { name: 'Terrain 1', sport: 'Football à 5' },
  to: '19:00',
  ...autres,
});

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverInvitation />);
  });
  return arbre;
};

describe('CORR-RESA (83 A) — E-P08, « présent » au singulier, « présents » au pluriel', () => {
  it('1 présent : « 1 présent sur 10 »', async () => {
    mockInvitation = { data: pageDuLien({ presents: 1 }), isLoading: false };
    const vus = lisibles(await monter());
    expect(vus).toContain('1 présent sur 10');
    expect(vus).not.toContain('1 présents sur 10');
  });

  it('3 présents : « 3 présents sur 10 »', async () => {
    mockInvitation = {
      data: pageDuLien({ participants: ['Julien M.', 'Karim B.', 'Sami A.'], presents: 3 }),
      isLoading: false,
    };
    expect(lisibles(await monter())).toContain('3 présents sur 10');
  });
});
