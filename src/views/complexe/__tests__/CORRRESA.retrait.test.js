import renderer, { act } from 'react-test-renderer';

import FeuilleRetrait from '@/views/complexe/components/FeuilleRetrait';

import { lisibles } from '@/testSupport/temoinComplexe';

// CORR-RESA (69 A, 31/10/2026) — « Retirer un terrain » : la feuille dit aussi les collectes en
// cours que le retrait arrêtera (`collectesTouchees` de l'aperçu du serveur).

let mockApercu = /** @type {any} */ ({});
jest.mock('@/services/complexe/complexeQueries', () => ({
  useApercuRetrait: () => ({ isPending: false, mutateAsync: async () => mockApercu }),
  useRetirerTerrain: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

/**
 * Monte la feuille ouverte sur « Terrain 1 ».
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <FeuilleRetrait
        complexeId="cx-five"
        onFermer={jest.fn()}
        onRetire={jest.fn()}
        terrain={{ documentId: 't-1', name: 'Terrain 1' }}
      />,
    );
  });
  return arbre;
};

describe('CORR-RESA (69 A) — retirer un terrain qui porte une collecte', () => {
  it('0 réservation, 1 collecte : la phrase dit que la collecte s’arrêtera', async () => {
    mockApercu = { data: { collectesTouchees: 1, reservationsTouchees: 0 } };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain(
      'Aucune réservation à venir sur ce terrain. '
      + '1 collecte en cours s’arrêtera et ses joueurs seront prévenus.',
    );
  });

  it('2 réservations, 3 collectes : les deux phrases, au pluriel', async () => {
    mockApercu = { data: { collectesTouchees: 3, reservationsTouchees: 2 } };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain(
      '2 réservations à venir seront annulées et les joueurs prévenus. '
      + '3 collectes en cours s’arrêteront et leurs joueurs seront prévenus.',
    );
  });

  it('aucune collecte : la phrase reste celle des réservations seules', async () => {
    mockApercu = { data: { collectesTouchees: 0, reservationsTouchees: 0 } };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Aucune réservation à venir sur ce terrain.');
    expect(lisibles(arbre).some((texte) => texte.includes('collecte'))).toBe(false);
  });
});
