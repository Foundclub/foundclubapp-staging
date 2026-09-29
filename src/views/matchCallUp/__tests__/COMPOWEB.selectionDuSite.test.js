import { Platform, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MatchCallUpSelection from '../MatchCallUpSelection';

// ==========================================================================
// COMPO-WEB (29/09) — LA SELECTION DU SITE, ARRIVEE PAR L'ADRESSE.
//
// Sur le site, « Gerer la composition » ouvrait la selection avec des OBJETS
// (compo existante, effectif) que l'adresse ne porte pas : arrive par un lien,
// un rechargement ou un nouvel onglet, l'ecran ne cochait PERSONNE — la compo
// deja publiee semblait perdue.
//
// Ce que ce fichier tient, SUR LE SITE (jumeau `.web.js` du crochet branche) :
//   1. arrivee par l'adresse : l'ecran RELIT `GET /events/:id/composition` et
//      coche les convoques de la version publiee — la meme regle que le
//      telephone (`readCalledUpIdsFromPack`) ;
//   2. un brouillon passe AVANT la compo publiee (ordre de « Gerer ») ;
//   3. avec ses objets (navigation dans l'onglet) : aucune relecture ;
//   4. « Suivant » transmet au terrain les convoques relus ET la charge du
//      serveur (le terrain s'en sert pour enregistrer).
// ==========================================================================

const mockNavigate = jest.fn();
/** @type {any} */
let mockRouteParams = {};
/** @type {any} */
let mockReponseComposition = { data: undefined, isError: false };
const mockUseComposition = jest.fn(() => mockReponseComposition);

const mockNavigation = { goBack: jest.fn(), navigate: mockNavigate, setParams: jest.fn() };

jest.mock('../useSiteCompositionRecovery', () => jest.requireActual('../useSiteCompositionRecovery.web'));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ options) => {
        const lire = (/** @type {string} */ chemin) => chemin.split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        const compte = options?.count;
        let valeur = lire(cle);
        if (typeof valeur !== 'string' && compte !== undefined) {
          valeur = lire(`${cle}${compte === 0 || compte === 1 ? '_one' : '_other'}`);
        }
        if (typeof valeur !== 'string') return cle;
        return valeur.replace(/{{(\w+)}}/g, (_c, nom) => (
          options && options[nom] !== undefined ? String(options[nom]) : ''
        ));
      },
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({ data: undefined, isFetching: false }),
  useGetEventTeamComposition: (...args) => mockUseComposition(...args),
}));

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: () => ({ data: undefined, isFetching: false, isLoading: false }),
}));

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

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
      Images: { arrowLeft: 1, chevronLeft: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: (/** @type {any} */ { children }) => <View>{children}</View> };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>RETOUR</TexteRN> };
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { name }) => <TexteRN>{`AVATAR:${name}`}</TexteRN>,
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => ({
  __esModule: true,
  default: () => null,
}));

const joueur = (id, firstname, lastname) => ({ documentId: id, firstname, lastname });
const J1 = joueur('j1', 'Prenom1', 'Nom1');
const J2 = joueur('j2', 'Prenom2', 'Nom2');
const J3 = joueur('j3', 'Prenom3', 'Nom3');
const EFFECTIF = [J1, J2, J3];

const PUBLIEE = {
  reservePlayerIds: ['j3'],
  selectedPlayerIds: ['j1', 'j3'],
  snapshotPlayers: EFFECTIF,
  teams: [{ id: 'team_1', placements: [{ playerId: 'j1', positionX: 50, positionY: 88 }] }],
  version: 1,
};

const PAR_L_ADRESSE = {
  canEdit: true,
  eventId: 'evt_1',
  readOnly: false,
  sport: 'football',
  teamId: 'team_1',
  teamName: 'U17',
};

const aplatirTexte = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

const texteVisible = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

const rangeeJoueur = (/** @type {any} */ arbre, /** @type {string} */ nom) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.accessibilityRole === 'button'
    && noeud.props?.accessibilityState?.selected !== undefined
    && aplatirTexte(noeud.props.children).includes(nom))[0];

const rendre = async (/** @type {any} */ parametres) => {
  mockRouteParams = parametres;
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MatchCallUpSelection />);
  });
  return arbre;
};

describe('COMPO-WEB — la selection du site, arrivee par l adresse', () => {
  const osOrigine = Platform.OS;
  beforeEach(() => {
    Platform.OS = 'web';
    mockUseComposition.mockClear();
    mockNavigate.mockClear();
  });
  afterEach(() => { Platform.OS = osOrigine; });

  test('🔴 1. elle RELIT le serveur et coche les convoques de la version publiee', async () => {
    mockReponseComposition = {
      data: { draft: null, eligiblePlayers: EFFECTIF, published: PUBLIEE },
      isError: false,
    };
    const arbre = await rendre(PAR_L_ADRESSE);

    expect(mockUseComposition).toHaveBeenCalledWith('evt_1', 'team_1', { enabled: true });
    expect(texteVisible(arbre)).toContain('2 convoqués');
    expect(rangeeJoueur(arbre, 'Prenom1 Nom1').props.accessibilityState.selected).toBe(true);
    expect(rangeeJoueur(arbre, 'Prenom3 Nom3').props.accessibilityState.selected).toBe(true);
    expect(rangeeJoueur(arbre, 'Prenom2 Nom2').props.accessibilityState.selected).toBe(false);
  });

  test('🔴 2. un brouillon passe AVANT la compo publiee (l ordre de « Gerer »)', async () => {
    mockReponseComposition = {
      data: {
        draft: { reservePlayerIds: [], selectedPlayerIds: ['j2'], teams: [] },
        eligiblePlayers: EFFECTIF,
        published: PUBLIEE,
      },
      isError: false,
    };
    const arbre = await rendre(PAR_L_ADRESSE);

    expect(texteVisible(arbre)).toContain('1 convoqué');
    expect(rangeeJoueur(arbre, 'Prenom2 Nom2').props.accessibilityState.selected).toBe(true);
    expect(rangeeJoueur(arbre, 'Prenom1 Nom1').props.accessibilityState.selected).toBe(false);
  });

  test('3. avec ses objets (navigation dans l onglet) : aucune relecture', async () => {
    mockReponseComposition = { data: undefined, isError: false };
    const arbre = await rendre({ ...PAR_L_ADRESSE, existingComposition: PUBLIEE, players: EFFECTIF });

    expect(mockUseComposition).toHaveBeenCalledWith('evt_1', 'team_1', { enabled: false });
    expect(texteVisible(arbre)).toContain('2 convoqués');
  });

  test('🔴 4. « Suivant » emmene au terrain les convoques relus et la charge du serveur', async () => {
    const charge = { draft: null, eligiblePlayers: EFFECTIF, published: PUBLIEE };
    mockReponseComposition = { data: charge, isError: false };
    const arbre = await rendre(PAR_L_ADRESSE);

    const suivant = arbre.root
      .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
        && aplatirTexte(noeud.props.children) === 'Suivant')
      .pop();
    await act(async () => { suivant.props.onPress(); });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [route, parametres] = mockNavigate.mock.calls[0];
    expect(route).toBe('MatchCompositionBoard');
    expect(parametres.selectedPlayers.map((/** @type {any} */ p) => p.documentId)).toEqual(['j1', 'j3']);
    expect(parametres.startPlacements).toEqual([
      expect.objectContaining({ playerId: 'j1', positionX: 50, positionY: 88 }),
    ]);
    expect(parametres.teamComposition).toBe(charge);
  });
});
