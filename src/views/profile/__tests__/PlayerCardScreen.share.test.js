// @ts-nocheck
/**
 * app/src/views/profile/__tests__/PlayerCardScreen.share.test.js
 *
 * L27 (E6) : PlayerCardScreen.js n'avait AUCUN test alors qu'il est le SEUL
 * appelant de `shareCard`. Depuis L27, ce geste peut LEVER une erreur porteuse
 * (`reason`) ou rendre un `outcome` : sans traitement, un refus de permission
 * remonterait nu et l'ecran resterait muet.
 *
 * Ce fichier n'observe QUE la couture : ce que l'ecran demande au partage, et ce
 * qu'il DIT a l'utilisateur ensuite (Alert). Aucun pixel, aucune forme d'arbre —
 * une refonte de mise en page peut passer sans qu'une ligne d'ici ne bouge.
 * Le comportement du hook lui-meme est couvert par useShareCard.test.js.
 */

import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PlayerCardScreen from '../PlayerCardScreen';

/** @type {any} */
let mockShareCard;
/** @type {any[]} */
const mockShareModalProps = [];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('@/domains/playerCard/useShareCard', () => ({
  __esModule: true,
  default: () => ({
    captureToFile: jest.fn(),
    cardRef: { current: null },
    isBusy: false,
    saveCardToGallery: jest.fn(),
    shareCard: mockShareCard,
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    getPostOnboardingHomeRoute: () => 'Home',
    userData: {
      birthDate: '1990-01-01',
      firstname: 'Zinedine',
      id: 7,
      lastname: 'Zidane',
      role: { type: 'joueur' },
    },
  }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ chats: [], sendMessage: jest.fn() }),
}));

jest.mock('@/services/userHistory/userHistoryQueries', () => ({
  useGetMyHistories: () => ({ data: [] }),
}));

jest.mock('@/services/playerCard/uploadCardImage', () => ({ uploadCardImage: jest.fn() }));

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall), et un objet invente
// masquerait un jeton absent. `Images` est le seul element stub.
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: { pin: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('react-native-gesture-handler', () => ({
  ScrollView: jest.requireActual('react-native').ScrollView,
}));

// PlayerCard tire les SVG, le QR et le logo : l'ecran n'a besoin ici que de sa
// presence et de la largeur d'export.
jest.mock('@/components/organisms/playerCard/PlayerCard', () => ({
  __esModule: true,
  CARD_EXPORT_WIDTH: 992,
  CARD_FORMATS: { square: { height: 1262, key: 'square', width: 992 } },
  default: function PlayerCardMock() {
    return null;
  },
}));

jest.mock(
  '@/components/organisms/shareCardModal/ShareCardModal',
  () => function ShareCardModalMock(/** @type {any} */ props) {
    mockShareModalProps.push(props);
    return null;
  },
);

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

jest.mock(
  '@/components/molecules/parentalDeclarationCard/ParentalDeclarationCard',
  () => function ParentalDeclarationCardMock() {
    return null;
  },
);

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

const REFUS_PERMISSION = Object.assign(new Error('permission_denied'), {
  reason: 'permission_denied',
});
const ENREGISTREMENT_IMPOSSIBLE = Object.assign(new Error('save_failed: ENOSPC'), {
  reason: 'save_failed',
});

/**
 * Monte l'ecran et declenche le partage externe, exactement comme le fait
 * ShareCardModal.
 * @returns {Promise<void>}
 */
const partager = async () => {
  await act(async () => {
    renderer.create(
      <PlayerCardScreen navigation={{ navigate: jest.fn() }} route={{ params: {} }} />,
    );
  });
  const { onExternalShare } = mockShareModalProps[mockShareModalProps.length - 1];
  await act(async () => {
    await onExternalShare();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockShareModalProps.length = 0;
  mockShareCard = jest.fn().mockResolvedValue({
    fileUri: 'file:///data/cache/carte.png',
    opened: true,
    outcome: 'shareSheet',
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  /** @type {any} */ (Alert.alert).mockRestore?.();
});

describe('L27 — l ecran encaisse le nouveau contrat de partage', () => {
  it('un refus de permission produit un ETAT TRAITE, pas une exception nue', async () => {
    mockShareCard.mockRejectedValue(REFUS_PERMISSION);

    await expect(partager()).resolves.toBeUndefined();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Erreur',
      'FoundClub n\'a pas le droit d\'enregistrer dans ton téléphone. '
      + 'Autorise-le dans les réglages, puis réessaie.',
    );
  });

  it('un enregistrement impossible nomme SA cause, pas la generation d image', async () => {
    mockShareCard.mockRejectedValue(ENREGISTREMENT_IMPOSSIBLE);

    await partager();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Erreur',
      'L\'enregistrement a échoué. Il reste peut-être trop peu de place sur ton téléphone.',
    );
  });

  it('une panne sans cause connue garde le message generique', async () => {
    mockShareCard.mockRejectedValue(new Error('boom'));

    await partager();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Erreur',
      'Impossible de générer l\'image pour le moment.',
    );
  });

  it('Android : l image rangee en galerie est ANNONCEE, sinon elle semble perdue', async () => {
    mockShareCard.mockResolvedValue({
      fileUri: 'file:///data/cache/carte.png',
      opened: true,
      outcome: 'gallery',
    });

    await partager();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Image enregistrée',
      'Ta carte est enregistrée dans tes photos (album FoundClub). '
      + 'Choisis maintenant où la publier.',
    );
  });

  it('iOS/web : la feuille de partage parle d elle-meme, l ecran se tait', async () => {
    await partager();

    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('le selecteur Android recoit un titre, sinon l utilisateur ne choisit plus', async () => {
    await partager();

    expect(mockShareCard).toHaveBeenCalledWith(
      expect.objectContaining({ dialogTitle: 'Ouvrir ta carte avec…' }),
    );
  });

  it('le message et le titre de la carte continuent de voyager', async () => {
    await partager();

    expect(mockShareCard).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Voici ma carte FoundClub.'),
        // buildPlayerCardModel capitalise le nom de famille — c'est le titre
        // exact que voyait deja la feuille de partage avant L27.
        title: 'Zinedine ZIDANE',
      }),
    );
  });
});
