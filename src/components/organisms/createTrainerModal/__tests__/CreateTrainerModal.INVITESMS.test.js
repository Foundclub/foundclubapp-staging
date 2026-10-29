import renderer, { act } from 'react-test-renderer';

import CreateTrainerModal from '../CreateTrainerModal';

// INVITESMS (29/10/2026, decision d'Adel « 2- A », diagnostic DIAG-ROLE-TUNNEL) — « Créer un
// entraîneur » depuis une équipe (fiche, modification, assistant) créait le compte et disait
// seulement « Entraîneur ajouté avec succès » : le serveur ne prévient personne, et 4 comptes
// créés par un club n'ont jamais été ouverts. La même feuille d'invitation qu'AddCoach s'ouvre
// désormais, avec son bouton « Inviter » (SMS pré-rempli). ROUGE avant.

const mockInviteTrainer = jest.fn();
const mockFeuilles = [];
const mockChamps = new Map();
/** @type {any} */
let mockReponse;

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve()
      .then(() => options.onSuccess?.(mockReponse, variables)),
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ r) => (typeof r === 'string' ? r : cle),
  }),
}));
jest.mock('@/theme/strings', () => ({ Joi: jest.requireActual('joi') }));
jest.mock('@/theme/themeContext', () => {
  const vide = new Proxy({}, { get: () => ({}) });
  return {
    __esModule: true,
    default: () => ({ Alignments: vide, Fonts: vide, Spaces: vide }),
  };
});
jest.mock('@/services/auth/authService', () => ({ createTrainer: jest.fn() }));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    inviteTrainer: mockInviteTrainer, userData: { club: { name: 'Club du compte' } },
  }),
}));
jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => ({ data: { documentId: 'club-1', name: 'SMUC' } }),
}));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { createElement } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return function BottomModalMock(/** @type {any} */ props) {
    return createElement(View, null, props.children, props.footerComponent);
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const { createElement } = jest.requireActual('react');
  const { TouchableOpacity } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return createElement(TouchableOpacity, {
      onPress: props.onPress, testID: `bouton-${props.title}`,
    });
  };
});
jest.mock('@/components/molecules/input/Input', () => {
  const { forwardRef } = jest.requireActual('react');
  return forwardRef((/** @type {any} */ props) => {
    mockChamps.set(props.label, props);
    return null;
  });
});
jest.mock(
  '@/components/organisms/trainerInvitedModal/TrainerInvitedModal',
  () => function TrainerInvitedModalMock(/** @type {any} */ props) {
    mockFeuilles.push(props);
    return null;
  },
);

const derniereFeuille = () => mockFeuilles[mockFeuilles.length - 1];

const creer = async () => {
  const onClose = jest.fn();
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<CreateTrainerModal clubId="club-1" isVisible onClose={onClose} />);
  });
  act(() => { mockChamps.get('Telephone *').onChangeText('0612345678'); });
  act(() => { mockChamps.get('Prenom').onChangeText('Luc'); });
  await act(async () => {
    await arbre.root.findByProps({ testID: 'bouton-Ajouter' }).props.onPress();
  });
  return { arbre, onClose };
};

beforeEach(() => {
  mockInviteTrainer.mockClear();
  mockFeuilles.length = 0;
  mockChamps.clear();
  mockReponse = { documentId: 'u-1', firstname: 'Luc', phoneNumber: '+33612345678' };
});

describe('🔴 INVITESMS — après « Créer un entraîneur », la feuille d invitation', () => {
  it('s ouvre avec le prénom de l entraîneur', async () => {
    const { arbre } = await creer();
    expect(derniereFeuille()?.isVisible).toBe(true);
    expect(derniereFeuille()?.trainerName).toBe('Luc');
    act(() => arbre.unmount());
  });

  it('« Inviter » ouvre le SMS pré-rempli : numéro, club, prénom', async () => {
    const { arbre } = await creer();
    await act(async () => { derniereFeuille().onInvite(); });
    expect(mockInviteTrainer).toHaveBeenCalledWith(expect.objectContaining({
      clubId: 'club-1', clubName: 'SMUC', firstname: 'Luc', phoneNumber: '+33612345678',
    }));
    expect(derniereFeuille().isVisible).toBe(false);
    act(() => arbre.unmount());
  });

  it('« Plus tard » referme sans rien envoyer', async () => {
    const { arbre } = await creer();
    await act(async () => { derniereFeuille().onClose(); });
    expect(mockInviteTrainer).not.toHaveBeenCalled();
    expect(derniereFeuille().isVisible).toBe(false);
    act(() => arbre.unmount());
  });
});
