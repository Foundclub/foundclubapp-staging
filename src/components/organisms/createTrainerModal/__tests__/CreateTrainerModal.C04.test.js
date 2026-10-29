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
    await arbre.root.findByProps({ testID: 'bouton-Ajouter' }).props.onPress();
  });
};

beforeEach(() => {
  mockMutate.mockClear();
  mockChamps.clear();
});

describe('🔴 C04 Q2-13 — la date de naissance se tape au pavé numérique', () => {
  it('« 15012010 » s affiche « 15/01/2010 » et part avec l entraîneur', async () => {
    const arbre = monter();
    act(() => { champ('Telephone *').onChangeText('0612345678'); });
    act(() => { champ(DATE).onChangeText('15012010'); });

    expect(champ(DATE).value).toBe('15/01/2010');
    await ajouter(arbre);
    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ birthdate: '15/01/2010' }));
    act(() => arbre.unmount());
  });
});

describe('🔴 C04 Q2-06 — un jour qui n existe pas est refusé', () => {
  it('« 31/02/2010 » : rien ne part, et le champ le dit', async () => {
    const arbre = monter();
    act(() => { champ('Telephone *').onChangeText('0612345678'); });
    act(() => { champ(DATE).onChangeText('31/02/2010'); });
    await ajouter(arbre);

    expect(mockMutate).not.toHaveBeenCalled();
    expect(champ(DATE).error).toBeTruthy();
    act(() => arbre.unmount());
  });
});
