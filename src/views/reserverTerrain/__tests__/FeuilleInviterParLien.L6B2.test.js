import renderer, { act } from 'react-test-renderer';

import FeuilleInviterParLien from '@/views/reserverTerrain/components/FeuilleInviterParLien';

import { lisibles, pressable } from '@/testSupport/temoinComplexe';

// RESA-L6B-2 (20/10/2026) — « Inviter par lien » (planche EP07 état 4, EP05 ; plan E-P07, RG-LIEN,
// A-P05) : à l'ouverture, le serveur rend le lien (`POST …/lien {actif: true}`) ; le message prêt
// (« Football à 5, mercredi 14/10 à 18 h, Le Five de Montrivage. Réponds ici : <lien> »), « Copier
// le lien », « Partager » (la feuille du téléphone ou du navigateur), et « Désactiver le lien »
// (le code s'efface ; absent sur E-P05, comme sur sa planche).

const mockLien = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useLienDInvitation: () => ({ isPending: false, mutateAsync: mockLien }),
}));
const mockPartager = jest.fn();
const mockCopier = jest.fn();
jest.mock('@/platform/share', () => ({
  __esModule: true,
  default: {
    copier: (/** @type {string} */ texte) => mockCopier(texte),
    share: (/** @type {any} */ contenu) => mockPartager(contenu),
  },
}));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock(
  'react-i18next',
  () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next,
);
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const URL_DU_LIEN = 'https://foundclub.app/r/K7Q2M9';
const PARTIE = {
  complexe: 'Le Five de Montrivage', date: '2026-10-14', from: '18:00', sport: 'Football à 5',
};
const MESSAGE = 'Football à 5, mercredi 14/10 à 18 h, Le Five de Montrivage. Réponds ici : '
  + `${URL_DU_LIEN}`;

/**
 * Monte la feuille ouverte.
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Promise<{ arbre: any, fermer: jest.Mock }>} L'arbre et la fermeture.
 */
const monter = async (autres = {}) => {
  const fermer = jest.fn();
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <FeuilleInviterParLien
        close={fermer}
        partie={PARTIE}
        reservationId="r-1"
        sansDesactiver={autres.sansDesactiver}
      />,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  return { arbre, fermer };
};

/**
 * Appuie sur un nœud.
 * @param {any} noeud - Le nœud.
 * @returns {Promise<void>} Fini.
 */
const toucher = async (noeud) => {
  await act(async () => {
    await noeud.props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLien.mockResolvedValue({ actif: true, code: 'K7Q2M9', url: URL_DU_LIEN });
  mockPartager.mockResolvedValue(undefined);
  mockCopier.mockResolvedValue(true);
});

it('à l’ouverture : le serveur rend le lien ; le message prêt à envoyer', async () => {
  const { arbre } = await monter();
  expect(mockLien).toHaveBeenCalledWith({ actif: true, reservationId: 'r-1' });
  expect(lisibles(arbre)).toEqual(expect.arrayContaining([
    'Inviter par lien',
    'Ceux qui ont le lien voient la partie ; pour répondre, il leur faut un compte.',
    MESSAGE,
    'Copier le lien',
    'Partager',
    'Désactiver le lien',
  ]));
});

it('« Partager » : la feuille du système, avec le message et le lien', async () => {
  const { arbre } = await monter();
  await toucher(pressable(arbre, 'Partager'));
  expect(mockPartager).toHaveBeenCalledWith({ message: MESSAGE, url: URL_DU_LIEN });
});

it('« Copier le lien » : le lien seul, puis « Lien copié »', async () => {
  const { arbre } = await monter();
  await toucher(pressable(arbre, 'Copier le lien'));
  expect(mockCopier).toHaveBeenCalledWith(URL_DU_LIEN);
  expect(lisibles(arbre)).toContain('Lien copié');
});

it('« Désactiver le lien » : le code s’efface, la feuille se ferme', async () => {
  const { arbre, fermer } = await monter();
  await toucher(pressable(arbre, 'Désactiver le lien'));
  expect(mockLien).toHaveBeenLastCalledWith({ actif: false, reservationId: 'r-1' });
  expect(fermer).toHaveBeenCalledWith({ desactive: true });
});

it('E-P05 : pas de « Désactiver » ; sans réseau, la phrase et « Réessayer »', async () => {
  const surLeResultat = await monter({ sansDesactiver: true });
  expect(lisibles(surLeResultat.arbre)).not.toContain('Désactiver le lien');
  mockLien.mockRejectedValueOnce({ code: 'ERR_NETWORK', message: 'Network Error' });
  const { arbre } = await monter();
  expect(lisibles(arbre)).toEqual(expect.arrayContaining([
    'Le lien n’a pas pu être créé.',
    'Réessayer',
  ]));
});
