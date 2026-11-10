import renderer, { act } from 'react-test-renderer';

import CreateTrainerModal from '../CreateTrainerModal';

// C04 (BUGHUNT phase 2, 25/10) — « Créer un entraîneur » depuis l'équipe.
// Q2-13 : le pavé numérique n'a pas de « / » et la saisie n'était pas mise en forme : « 15012010 »
// était refusé par le motif JJ/MM/AAAA, on ne pouvait ajouter l'entraîneur que sans date.
// Q2-06 : « 31/02/2010 » passait le motif et partait au serveur (enregistré le 2010-03-03).

const mockMutate = jest.fn();
const mockChamps = new Map();

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: mockMutate }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ r) => (typeof r === 'string' ? r : cle),
  }),
}));
// Le vrai Joi, sans le démarrage d'i18next que '@/theme/strings' déclenche à l'import.
jest.mock('@/theme/strings', () => ({ Joi: jest.requireActual('joi') }));
jest.mock('@/theme/themeContext', () => {
  const vide = new Proxy({}, { get: () => ({}) });
  return {
    __esModule: true,
    default: () => ({ Alignments: vide, Fonts: vide, Spaces: vide }),
  };
});
jest.mock('@/services/auth/authService', () => ({ createTrainer: jest.fn() }));
// INVITESMS (29/10) : la fenetre lit desormais `useAuth` (invitation SMS) et le nom du club ;
// le vrai `useAuth` tire le client reseau, qui exige une configuration d'API.
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ inviteTrainer: jest.fn(), userData: null }),
}));
jest.mock('@/services/club/clubQueries', () => ({ useGetClub: () => ({ data: null }) }));
jest.mock(
  '@/components/organisms/trainerInvitedModal/TrainerInvitedModal',
  () => function TrainerInvitedModalMock() { return null; },
);
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

const champ = (/** @type {string} */ libelle) => mockChamps.get(libelle);
const DATE = 'Date de naissance';

const monter = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<CreateTrainerModal clubId="club-1" isVisible onClose={jest.fn()} />);
  });
  return arbre;
};
const ajouter = async (/** @type {any} */ arbre) => {
  await act(async () => {
    await arbre.root.findByProps({ testID: 'bouton-staffInvitation.form.send' }).props.onPress();
  });
};

beforeEach(() => {
  mockMutate.mockClear();
  mockChamps.clear();
});

// INVITE-STAFF (10/11/2026, « 1A ») : on invite, on ne crée plus le compte. La date de naissance
// (C04 Q2-06 / Q2-13) quitte la feuille : la personne la saisit elle-même à son inscription, et
// le serveur refuse un mineur à l'acceptation.
describe('INVITE-STAFF — la feuille d équipe invite un coach, sans date de naissance', () => {
  it('plus de champ date de naissance ni nom ; l invitation part en coach', async () => {
    const arbre = monter();
    expect(champ(DATE)).toBeUndefined();
    expect(champ('Nom')).toBeUndefined();
    act(() => { champ('Telephone *').onChangeText('0612345678'); });
    await ajouter(arbre);
    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({
      clubId: 'club-1',
      phoneNumber: '0612345678',
      role: 'coach',
    }));
    expect(mockMutate.mock.calls[0][0]).not.toHaveProperty('birthdate');
    act(() => arbre.unmount());
  });
});
