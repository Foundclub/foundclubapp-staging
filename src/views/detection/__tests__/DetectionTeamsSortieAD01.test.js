import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { saveEventCompositionDraft } from '@/services/event/eventService';

import DetectionTeamsAuto from '../DetectionTeamsAuto';
import DetectionTeamsManual from '../DetectionTeamsManual';

// ==========================================================================
// AD01 — LA SORTIE DES ECRANS 14 ET 15 (porte B).
//
// 🕳️ CE QUE LA MESURE A TROUVE : ces deux ecrans enregistrent la repartition,
// puis font `navigation.goBack()`. Le bouton principal de l'ecran 14 s'appelle
// pourtant `detection.teams.manual.actions.field` — « LE TERRAIN » : un nom qui
// promet un ecran qui n'arrivait jamais. `DetectionTeamsBoard` (850 lignes) et
// `DetectionRotationBoard` (697 lignes) attendaient derriere, sans un seul
// appelant.
//
// ⚠️ CES DEUX ECRANS N'AVAIENT AUCUN TEMOIN (E6). Ce fichier en pose donc DEUX
// SORTES, et l'ordre compte :
//   · 🟢 CARACTERISANTS (verts AVANT comme APRES) — ce qui est enregistre, et
//     le fait que rien ne parte quand il manque l'evenement ou l'equipe. C'est
//     le filet : si la modification cassait l'enregistrement, ils vireraient au
//     rouge.
//   · 🔴 LA MODIFICATION elle-meme — la DESTINATION apres l'enregistrement.
//
// ⛔ Le lot ne change QUE cette destination. Pas une couleur, pas un
// espacement, pas une chaine.
// ==========================================================================

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
/** @type {any} */
let mockRouteParams = {};
/** @type {any} */
const mockCompositionQuery = { data: null };

const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle) => cle,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/services/event/eventService', () => ({
  saveEventCompositionDraft: jest.fn(),
}));

jest.mock('@/services/event/eventQueries', () => ({
  useGetEventTeamComposition: () => mockCompositionQuery,
}));

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
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <VueRN>{children}</VueRN>,
  };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>RETOUR</TexteRN> };
});

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: function BoutonDouble(/** @type {any} */ props) {
      return react.createElement(
        rn.TouchableOpacity,
        {
          accessibilityRole: 'button',
          disabled: Boolean(props.disabled || props.isLoading),
          onPress: props.onPress,
        },
        react.createElement(rn.Text, null, props.title || ''),
      );
    },
  };
});

const JOUEURS = [
  { documentId: 'p1', firstname: 'Ali', lastname: 'Un' },
  { documentId: 'p2', firstname: 'Bea', lastname: 'Deux' },
  { documentId: 'p3', firstname: 'Cyd', lastname: 'Trois' },
  { documentId: 'p4', firstname: 'Dan', lastname: 'Quatre' },
];

const PARAMS = {
  checkInFirst: false,
  eventId: 'event-1',
  memberMode: 'SPREAD',
  players: JOUEURS,
  presentIds: null,
  sport: 'football',
  teamId: 'team-1',
};

/** @type {any} */
let monte = null;

const monter = (/** @type {any} */ Ecran, /** @type {any} */ params = PARAMS) => {
  mockRouteParams = params;
  act(() => {
    monte = renderer.create(<Ecran />);
  });
  return monte.root;
};

const texteDe = (/** @type {any} */ noeud) => {
  const morceaux = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (enfant === null || enfant === undefined || enfant === false) return;
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      morceaux.push(String(enfant));
      return;
    }
    const enfants = enfant?.props?.children;
    if (Array.isArray(enfants)) enfants.forEach(parcourir);
    else parcourir(enfants);
  };
  parcourir(noeud);
  return morceaux.join(' ').trim();
};

const appuyer = (/** @type {any} */ racine, /** @type {string} */ libelle) => {
  const bouton = racine
    .findAllByProps({ accessibilityRole: 'button' })
    .find((/** @type {any} */ noeud) => texteDe(noeud).includes(libelle));
  if (!bouton) {
    const vu = racine.findAllByType(Text).map(texteDe).filter(Boolean).join(' | ');
    throw new Error(`Aucun bouton « ${libelle} ». Vu : ${vu}`);
  }
  act(() => {
    bouton.props.onPress();
  });
};

// L'enregistrement est asynchrone : l'alerte n'arrive qu'au tour suivant.
const attendreLAlerte = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

// Le coach appuie sur « OK » dans l'alerte de confirmation. C'est CE rappel qui
// decide ou il atterrit — c'est le seul point que ce lot deplace.
const validerLAlerte = () => {
  const dernierAppel = [...jest.mocked(Alert.alert).mock.calls].pop();
  const boutons = dernierAppel?.[2];
  if (!Array.isArray(boutons) || typeof boutons[0]?.onPress !== 'function') {
    throw new Error(`L alerte ne porte aucun bouton actionnable : ${JSON.stringify(boutons)}`);
  }
  act(() => {
    boutons[0].onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCompositionQuery.data = null;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.mocked(saveEventCompositionDraft).mockResolvedValue({});
});

afterEach(() => {
  if (monte) {
    act(() => {
      monte.unmount();
    });
    monte = null;
  }
  jest.restoreAllMocks();
});

const ECRANS = [
  {
    action: 'detection.teams.manual.actions.field',
    composant: DetectionTeamsManual,
    nom: 'ECRAN 14 · Equipes a la main',
  },
  {
    action: 'detection.teams.auto.actions.generate',
    composant: DetectionTeamsAuto,
    nom: 'ECRAN 15 · Equipes automatiques',
  },
];

describe.each(ECRANS)('AD01 · porte B — $nom', ({ action, composant }) => {
  // 🟢 CARACTERISANT — ce que l'ecran faisait deja, et qui ne doit pas bouger.
  test('🟢 il enregistre la repartition sur l evenement et l equipe recus', async () => {
    const racine = monter(composant);

    appuyer(racine, action);
    await attendreLAlerte();

    expect(saveEventCompositionDraft).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({ teamId: 'team-1' }),
    );
  });

  // 🟢 CARACTERISANT — le garde-fou d'entree, jamais mesure jusqu'ici.
  test('🟢 sans equipe, rien ne part au serveur', async () => {
    const racine = monter(composant, { ...PARAMS, teamId: undefined });

    appuyer(racine, action);
    await attendreLAlerte();

    expect(saveEventCompositionDraft).not.toHaveBeenCalled();
  });

  // 🔴 LA MODIFICATION — c'est la seule ligne que ce lot deplace.
  test('🔴 apres l enregistrement, le coach arrive sur LE TERRAIN, pas en arriere', async () => {
    const racine = monter(composant);

    appuyer(racine, action);
    await attendreLAlerte();
    validerLAlerte();

    expect(mockNavigate).toHaveBeenCalledWith(
      'DetectionTeamsBoard',
      expect.objectContaining({ eventId: 'event-1', teamId: 'team-1' }),
    );
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  // 🟢 CARACTERISANT — une erreur serveur ne doit emmener nulle part.
  test('🟢 si l enregistrement echoue, le coach reste ou il est', async () => {
    jest.mocked(saveEventCompositionDraft).mockRejectedValue(new Error('boum'));
    const racine = monter(composant);

    appuyer(racine, action);
    await attendreLAlerte();

    expect(mockNavigate).not.toHaveBeenCalledWith('DetectionTeamsBoard', expect.anything());
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
