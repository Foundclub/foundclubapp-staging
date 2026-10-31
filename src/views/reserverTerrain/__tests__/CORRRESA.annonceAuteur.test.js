import renderer, { act } from 'react-test-renderer';

import ReserverAnnonce from '@/views/reserverTerrain/ReserverAnnonce';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';
import { annonceDeReservation } from '@/testSupport/temoinReserver';

// CORR-RESA (80 A) — E-P09 : l'auteur de l'annonce est reconnu d'où qu'il vienne (lien, canal,
// notification) par le serveur (`estAuteur`), même SANS `reservationId` dans l'adresse : il voit
// « Fermer l'annonce », pas « Je viens » ; « Partager » reste réservé à l'adresse avec la
// réservation. Doublures d'EP09.annonce.L6B2.test.js.

jest.setTimeout(30000);

let mockLecture = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: { annonceId: 'a-1' } }),
}));
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useAnnonce: () => mockLecture,
  useFermerUneAnnonce: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useLienDInvitation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useRejoindreUneAnnonce: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { birthdate: '1995-03-02', documentId: 'u-2' } }),
}));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
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
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverAnnonce />);
  });
  return arbre;
};

describe('CORR-RESA (80 A) — E-P09, l’auteur reconnu sans reservationId', () => {
  it('estAuteur, ouverte : « Fermer l’annonce », ni « Je viens » ni « Partager »', async () => {
    mockLecture = {
      data: annonceDeReservation({ estAuteur: true, status: 'ouverte' }), isLoading: false,
    };
    const arbre = await monter();
    const vus = lisibles(arbre);
    expect(vus).toContain('Fermer l’annonce');
    expect(vus).not.toContain('Je viens');
    expect(parRepere(arbre, 'annonce-je-viens')).toBeNull();
    expect(vus).not.toContain('Partager');
  });

  it('pas l’auteur : « Je viens », pas « Fermer l’annonce »', async () => {
    mockLecture = {
      data: annonceDeReservation({ estAuteur: false, status: 'ouverte' }), isLoading: false,
    };
    const arbre = await monter();
    const vus = lisibles(arbre);
    expect(vus).toContain('Je viens');
    expect(parRepere(arbre, 'annonce-je-viens')).not.toBeNull();
    expect(vus).not.toContain('Fermer l’annonce');
  });
});
