import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubEdit from '../ClubEdit';

// RECETTE-WEB-DIRIGEANT (29/10) — demande d'Adel : en production, sur le site, l'envoi du logo
// du club affichait « Erreur — Failed to update club info: Failed to upload file: Files are
// empty ». La cause (fichier vide) est corrigée dans formDataFile.js ; ici, le MESSAGE : un échec
// technique du serveur ne s'affiche plus en anglais, l'écran dit sa phrase française.
// Doublures reprises de ClubEdit.reglages.test.js.

/** @type {any[]} */
const mockOptions = [];
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => {
    mockOptions.push(options);
    return { isPending: false, mutate: jest.fn() };
  },
}));

// L'ecran appelle `t('common.actions.save')` SANS repli : sans cette petite
// table, la doublure rendrait la cle brute et « Enregistrer » n'existerait pas
// a l'ecran. On ne recopie ici que les cles appelees sans repli.
const TRADUCTIONS_SANS_REPLI = {
  'common.actions.save': 'Enregistrer',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      return TRADUCTIONS_SANS_REPLI[cle] || cle;
    },
  }),
}));

// Le vrai Joi, sans le bootstrap i18next que '@/theme/strings' declenche a
// l'import (il chargerait fr.js, tenu par un autre lot).
jest.mock('@/theme/strings', () => ({ Joi: jest.requireActual('joi') }));

jest.mock('@/theme/colors', () => ({
  withAlpha: () => 'couleur-transparente',
}));

jest.mock('@/theme/themeContext', () => {
  const feuilleDeStyle = {};
  const rampe = () => new Proxy({}, { get: () => feuilleDeStyle });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, { get: () => feuilleDeStyle }),
      Colors: new Proxy({}, { get: (_cible, cle) => `couleur-${String(cle)}` }),
      Fonts: rampe(),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});

const mockGetClub = jest.fn();
jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: (/** @type {any} */ ...args) => mockGetClub(...args),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [] }),
}));

jest.mock('@/services/club/clubService', () => ({
  updateClubInfo: jest.fn(),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

// Contrairement au filet L15, le bouton est ici un VRAI pressable portant son
// libelle : c'est le seul moyen d'appuyer sur « Enregistrer » et d'observer ce
// que l'ecran envoie, quelle que soit la mise en page.
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled || props.isLoading, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  return null;
});

jest.mock('@/components/molecules/input/Input', () => function InputMock() {
  return null;
});

jest.mock(
  '@/components/molecules/autocompleteSelect/AutocompleteSelect',
  () => function AutocompleteSelectMock() {
    return null;
  },
);

// R17-ADRESSE (19/10) : l'adresse passe par le champ d'adresse partagé (il lit le réseau) ; ce
// filet ne la regarde pas — ClubEdit.adresseSurLaCarte.test.js le fait.
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => function AutocompleteAddressInputMock() {
    return null;
  },
);

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() {
    return null;
  },
);

jest.mock(
  '@/components/molecules/selectAvatar/SelectAvatar',
  () => function SelectAvatarMock() {
    return null;
  },
);

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

beforeEach(() => {
  mockOptions.length = 0;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockGetClub.mockReturnValue({
    data: { activites: [], documentId: 'club-1', name: 'AS Exemple' },
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  });
});

afterEach(() => jest.restoreAllMocks());

it('🔴 un échec technique en anglais s affiche en français', async () => {
  await act(async () => {
    renderer.create(
      <ClubEdit
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({ params: { clubId: 'club-1' } })}
      />,
    );
  });

  const { updateClubInfo } = jest.requireMock('@/services/club/clubService');
  const { onError } = mockOptions.find((o) => o.mutationFn === updateClubInfo);
  const brut = 'Failed to update club info: Failed to upload file: Files are empty';
  act(() => onError(new Error(brut)));

  const [, message] = /** @type {any} */ (Alert.alert).mock.calls[0];
  expect(message).toBe('Impossible de mettre à jour ce club pour le moment.');
});
