import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeCanal from '@/views/complexe/ComplexeCanal';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';

// RESA-L5B-2 (20/10/2026) — E-G12 « Le canal du complexe », côté gérant (planche EG12 états 1 à 3 ;
// plan :846-889 ; RG-CANAL, RC-T02, Q5) sur le serveur RESA-L4 : `GET /complexes/:id/canal` rend
// `{ chatId, liste[{ nom, via, depuis }], membres }` (le canal est un groupe de la messagerie, le
// gérant y écrit par la conversation habituelle). L'écran : « CANAL · <NOM> », « 214 membres »,
// « Tous les membres seront prévenus. », « Écrire aux membres » (la conversation du canal), la
// liste des membres (prénom + initiale, « Entré·e par une réservation · 02/10 », aucun téléphone),
// la recherche ; vide : « Ton canal est prêt… » ; complexe suspendu : le canal est en pause.

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { complexeId: 'cx-five' } }),
}));

let mockLecture = /** @type {any} */ ({});
jest.mock('@/services/complexe/complexeQueries', () => ({
  useCanalDuComplexe: () => mockLecture,
  useComplexeChoisi: (/** @type {any} */ complexeId) => ({
    complexe: { documentId: complexeId, name: 'Le Five de Montrivage' },
    complexeId,
    mes: { data: [], isLoading: false },
  }),
}));

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

const CANAL = {
  chatId: 'chat-canal-five',
  liste: [
    {
      depuis: '2026-10-02T09:00:00.000Z',
      documentId: 'u-julien',
      nom: 'Julien M.',
      via: 'reservation',
    },
    {
      depuis: '2026-10-05T09:00:00.000Z', documentId: 'u-karim', nom: 'Karim B.', via: 'favori',
    },
  ],
  membres: 214,
};

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeCanal />);
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLecture = { data: CANAL, isLoading: false, refetch: jest.fn() };
});

describe('E-G12 — le canal du complexe, côté gérant', () => {
  it('« CANAL · LE FIVE… », 214 membres, la règle, les membres et leur origine', async () => {
    const arbre = await monter();
    const vus = lisibles(arbre);
    expect(vus).toContain('CANAL · LE FIVE DE MONTRIVAGE');
    expect(vus).toContain('214 membres');
    expect(vus).toContain('Tous les membres seront prévenus.');
    expect(vus).toContain('Julien M.');
    expect(vus).toContain('Entré·e par une réservation · 02/10');
    expect(vus).toContain('Karim B.');
    expect(vus).toContain('Entré·e par les favoris · 05/10');
    // Aucun numéro (RC-T04) : la liste ne porte que le nom.
    expect(vus.join(' ')).not.toMatch(/\d{2} \d{2} \d{2}/);
  });

  it('« Écrire aux membres » ouvre la conversation du canal (le gérant y écrit)', async () => {
    const arbre = await monter();
    await act(async () => {
      pressable(arbre, 'Écrire aux membres').props.onPress();
    });
    expect(mockNavigate)
      .toHaveBeenCalledWith(RouteNames.Conversation, { chatId: 'chat-canal-five' });
  });

  it('la recherche filtre les membres par leur nom', async () => {
    const arbre = await monter();
    await act(async () => {
      arbre.root.findAllByType(TextInput)[0].props.onChangeText('kar');
    });
    const vus = lisibles(arbre);
    expect(vus).toContain('Karim B.');
    expect(vus).not.toContain('Julien M.');
  });

  it('vide : « Ton canal est prêt… » (planche état 3)', async () => {
    mockLecture = { data: { ...CANAL, liste: [], membres: 0 }, isLoading: false };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain(
      'Ton canal est prêt. Écris ton premier message : il arrivera chez tous ceux qui réservent '
      + 'chez toi ou te mettent en favori.',
    );
    expect(lisibles(arbre)).toContain('0 membre');
  });

  it('complexe suspendu : le canal est en pause (COMPLEXE_CANAL_INACTIF)', async () => {
    mockLecture = {
      data: undefined,
      error: { response: { data: { error: { details: { code: 'COMPLEXE_CANAL_INACTIF' } } } } },
      isLoading: false,
      refetch: jest.fn(),
    };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Ton complexe est suspendu : son canal est en pause.');
  });

  it('chargement : le squelette ; erreur : « Réessayer »', async () => {
    mockLecture = { data: undefined, isLoading: true };
    let arbre = await monter();
    expect(parRepere(arbre, 'canal-squelette')).not.toBeNull();
    mockLecture = {
      data: undefined, error: new Error('panne'), isLoading: false, refetch: jest.fn(),
    };
    arbre = await monter();
    expect(lisibles(arbre)).toContain('Impossible de charger ton canal.');
    await act(async () => {
      pressable(arbre, 'Réessayer').props.onPress();
    });
    expect(mockLecture.refetch).toHaveBeenCalled();
  });
});
