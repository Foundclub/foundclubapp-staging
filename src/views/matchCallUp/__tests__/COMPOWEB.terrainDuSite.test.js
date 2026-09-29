import { Platform, StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { saveEventCompositionDraft } from '@/services/event/eventService';

import MatchCompositionBoard from '../MatchCompositionBoard';
import MatchCompositionStart from '../MatchCompositionStart';

// ==========================================================================
// COMPO-WEB (29/09) — LE TERRAIN DU SITE, ARRIVE SANS SES OBJETS.
//
// Decision d'Adel : l'entraineur compose depuis le site. Or sur le site, un
// ecran arrive par l'ADRESSE (lien, rechargement, nouvel onglet) n'a plus que
// `eventId` / `teamId` : ses joueurs et ses placements ne voyagent pas.
//
// Ce que ce fichier tient, SUR LE SITE (le jumeau `.web.js` du crochet de
// relecture est branche, `Platform.OS` vaut « web ») :
//   1. le terrain arrive sans joueurs : il RELIT `GET /events/:id/composition`
//      et retrouve titulaires et banc du brouillon ;
//   2. sans pack (ni brouillon ni compo publiee), « Publier » et « Enregistrer »
//      sont FERMES — au bouton ET a la source : rien ne part au serveur ;
//   3. pendant la relecture, en echec, ou avec un convoque introuvable : ferme ;
//   4. des objets deja la (navigation dans l'onglet) : AUCUNE relecture ;
//   5. le chemin CLAVIER : Entree sur un jeton le choisit, Entree sur un poste
//      l'y pose, « Remettre au banc » le ramene ;
//   6. « Partir de… » arrive sans convoques : il les relit aussi.
// ==========================================================================

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
/** @type {any} */
let mockRouteParams = {};
/** @type {any} */
let mockReponseComposition = { data: undefined, isError: false };
const mockUseComposition = jest.fn(() => mockReponseComposition);

const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate, popTo: jest.fn() };

// 🌐 LE SITE : c'est le jumeau `.web.js` que Vite compile qui est branche ici.
jest.mock(
  '../useSiteCompositionRecovery',
  () => jest.requireActual('../useSiteCompositionRecovery.web'),
);

jest.mock('@/services/event/eventQueries', () => ({
  useGetEventTeamComposition: (...args) => mockUseComposition(...args),
}));

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeamDefaultComposition: () => ({ data: null }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ fetchQuery: jest.fn(), invalidateQueries: jest.fn() }),
}));

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

jest.mock('react-native-gesture-handler', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  const fabriquerGeste = () => {
    /** @type {any} */
    const geste = {};
    ['activateAfterLongPress', 'minDistance', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']
      .forEach((nom) => { geste[nom] = () => geste; });
    return geste;
  };
  return {
    Gesture: { Pan: fabriquerGeste },
    GestureDetector: (/** @type {any} */ { children }) => <VueRN>{children}</VueRN>,
    GestureHandlerRootView: VueRN,
  };
});

jest.mock('react-native-reanimated', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View: VueRN },
    runOnJS: (/** @type {any} */ fn) => fn,
    useAnimatedStyle: () => ({}),
    useSharedValue: (/** @type {any} */ valeur) => ({ value: valeur }),
    withSpring: (/** @type {any} */ valeur) => valeur,
    withTiming: (/** @type {any} */ valeur) => valeur,
  };
});

jest.mock('@/services/event/eventService', () => ({
  getEventConvocation: jest.fn(),
  publishEventConvocation: jest.fn().mockResolvedValue({}),
  saveEventCompositionDraft: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startTeamChat: jest.fn().mockResolvedValue(null) }),
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
      Images: { arrowLeft: 1, chevronLeft: 1 },
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

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <VueRN>{children}</VueRN>,
  };
});

// La feuille existe dans l'arbre SEULEMENT quand elle est ouverte.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { Text: TexteRN, View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, footerComponent, isVisible }) => (isVisible ? (
      <VueRN>
        <TexteRN>FEUILLE-OUVERTE</TexteRN>
        {children}
        {footerComponent}
      </VueRN>
    ) : null),
  };
});

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/tactical/DraggableToken', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { player }) => <TexteRN>{`JETON:${player?.lastname}`}</TexteRN>,
    GHOST_TOKEN_SIZE: jest.requireActual('@/components/tactical/DraggableToken').GHOST_TOKEN_SIZE,
  };
});

// Le bouton transmet `disabled` : c'est lui qu'on lit.
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { disabled, onPress, title }) => (
      <TouchableOpacity disabled={disabled} onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

const joueur = (id, firstname, lastname) => ({ documentId: id, firstname, lastname });
const J1 = joueur('j1', 'Prenom1', 'Nom1');
const J2 = joueur('j2', 'Prenom2', 'Nom2');
const J3 = joueur('j3', 'Prenom3', 'Nom3');
const EFFECTIF = [J1, J2, J3];

// Ce que rend GET /events/:id/composition : un BROUILLON (sans instantane de ses
// titulaires, comme le vrai serveur), Prenom1 titulaire, Prenom2 au banc.
const chargeAvecBrouillon = () => ({
  bootstrap: { composition: null, source: 'empty' },
  draft: {
    manualPlayers: [],
    reservePlayerIds: ['j2'],
    reserveSnapshotPlayers: [J2],
    schemaVersion: 3,
    selectedPlayerIds: ['j1', 'j2'],
    teams: [{
      id: 'team_1',
      placements: [{
        playerId: 'j1', positionX: 50, positionY: 88, slotId: 'team_1:slot_1',
      }],
    }],
  },
  eligiblePlayers: EFFECTIF,
  published: null,
});

const chargeVide = () => ({
  bootstrap: { composition: null, source: 'empty' },
  draft: null,
  eligiblePlayers: EFFECTIF,
  published: null,
});

// L'adresse, et rien d'autre : ce qui arrive par un lien ou un rechargement.
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

const parLibelle = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.accessibilityLabel === libelle
    && typeof noeud.type === 'string')[0]
  || arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.props?.accessibilityLabel === libelle,
  )[0];

// Le bouton (le composant qui porte `onPress`) nomme par ce libelle d'accessibilite.
const cibleAppuyable = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.accessibilityLabel === libelle
    && typeof noeud.props?.onPress === 'function')[0];

const boutonTitre = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root
  .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
    && aplatirTexte(noeud.props.children) === titre)
  .pop();

const rendre = async (/** @type {any} */ Ecran, /** @type {any} */ parametres) => {
  mockRouteParams = parametres;
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<Ecran />);
  });
  return arbre;
};

describe('COMPO-WEB — le terrain du site, arrive sans ses objets', () => {
  const osOrigine = Platform.OS;
  beforeEach(() => {
    Platform.OS = 'web';
    mockUseComposition.mockClear();
    mockNavigate.mockClear();
    saveEventCompositionDraft.mockClear();
  });
  afterEach(() => { Platform.OS = osOrigine; });

  test('🔴 1. par l adresse, il RELIT le brouillon : titulaire et banc', async () => {
    mockReponseComposition = { data: chargeAvecBrouillon(), isError: false };
    const arbre = await rendre(MatchCompositionBoard, PAR_L_ADRESSE);

    expect(mockUseComposition).toHaveBeenCalledWith('evt_1', 'team_1', { enabled: true });
    expect(parLibelle(arbre, 'Prenom1 Nom1, sur le terrain')).toBeTruthy();
    expect(parLibelle(arbre, 'Prenom2 Nom2, sur le banc')).toBeTruthy();
    expect(texteVisible(arbre)).toContain('1/11 placés');
    expect(boutonTitre(arbre, 'Publier').props.disabled).toBe(false);
  });

  // 🧷 Le FILET d'URL-BOOLEENS (recolte) tient ce cas-la : un terrain sans aucun
  // joueur s'ouvre en lecture seule — « Publier » et « Enregistrer » n'existent
  // meme pas. Ce que COMPO-WEB y ajoute : le bandeau qui DIT pourquoi.
  test('🔴 2. sans pack : lecture seule (le filet), le bandeau dit pourquoi', async () => {
    mockReponseComposition = { data: chargeVide(), isError: false };
    const arbre = await rendre(MatchCompositionBoard, PAR_L_ADRESSE);

    expect(texteVisible(arbre)).toContain('Aucun joueur à placer');
    expect(texteVisible(arbre)).toContain('une composition vide ne se publie pas');
    expect(boutonTitre(arbre, 'Publier')).toBeUndefined();
    expect(boutonTitre(arbre, 'Enregistrer')).toBeUndefined();
    expect(texteVisible(arbre)).not.toContain('FEUILLE-OUVERTE');
    expect(saveEventCompositionDraft).not.toHaveBeenCalled();
  });

  test('🔴 3. relecture en cours, en echec, joueur introuvable : ferme, dit pourquoi', async () => {
    // En cours, puis en echec : aucun joueur encore — le filet tient, le bandeau parle.
    mockReponseComposition = { data: undefined, isError: false };
    let arbre = await rendre(MatchCompositionBoard, PAR_L_ADRESSE);
    expect(texteVisible(arbre)).toContain('Chargement de la composition…');
    expect(boutonTitre(arbre, 'Publier')).toBeUndefined();

    mockReponseComposition = { data: undefined, isError: true };
    arbre = await rendre(MatchCompositionBoard, PAR_L_ADRESSE);
    expect(texteVisible(arbre)).toContain('Composition introuvable');
    expect(boutonTitre(arbre, 'Publier')).toBeUndefined();

    // 🔒 Ce que le filet NE VOIT PAS : des joueurs relus, mais un convoque
    // introuvable. Le terrain s'ouvre en ecriture ; la publication, elle, reste
    // fermee — au bouton ET a la source : republier le retirerait en silence.
    const charge = chargeAvecBrouillon();
    charge.draft.selectedPlayerIds = ['j1', 'j2', 'inconnu'];
    mockReponseComposition = { data: charge, isError: false };
    arbre = await rendre(MatchCompositionBoard, PAR_L_ADRESSE);
    expect(texteVisible(arbre)).toContain('Composition incomplète');
    expect(texteVisible(arbre)).toContain('1 convoqué n’a pas pu être retrouvé');
    const publier = boutonTitre(arbre, 'Publier');
    const enregistrer = boutonTitre(arbre, 'Enregistrer');
    expect(publier.props.disabled).toBe(true);
    expect(enregistrer.props.disabled).toBe(true);
    await act(async () => { publier.props.onPress(); });
    await act(async () => { enregistrer.props.onPress(); });
    expect(texteVisible(arbre)).not.toContain('FEUILLE-OUVERTE');
    expect(saveEventCompositionDraft).not.toHaveBeenCalled();
  });

  test('4. objets deja la (navigation dans l onglet) : aucune relecture', async () => {
    mockReponseComposition = { data: undefined, isError: false };
    const arbre = await rendre(MatchCompositionBoard, {
      ...PAR_L_ADRESSE,
      selectedPlayers: [J1, J2],
      startPlacements: [],
    });

    expect(mockUseComposition).toHaveBeenCalledWith('evt_1', 'team_1', { enabled: false });
    expect(parLibelle(arbre, 'Prenom1 Nom1, sur le banc')).toBeTruthy();
    expect(boutonTitre(arbre, 'Publier').props.disabled).toBe(false);
  });

  test('🔴 5. AU CLAVIER : un jeton, un poste, puis retour au banc', async () => {
    mockReponseComposition = { data: undefined, isError: false };
    const arbre = await rendre(MatchCompositionBoard, {
      ...PAR_L_ADRESSE,
      selectedPlayers: [J1, J2],
      startPlacements: [],
    });

    const jeton = parLibelle(arbre, 'Prenom2 Nom2, sur le banc');
    expect(jeton.props.focusable).toBe(true);
    expect(jeton.props.accessibilityRole).toBe('button');

    // Le focus SE VOIT : un anneau clair sur le jeton qui a le focus clavier.
    expect(StyleSheet.flatten(jeton.props.style || {}).borderWidth).toBeUndefined();
    await act(async () => { jeton.props.onFocus(); });
    const focalise = parLibelle(arbre, 'Prenom2 Nom2, sur le banc');
    expect(StyleSheet.flatten(focalise.props.style).borderWidth).toBe(2);
    await act(async () => { focalise.props.onBlur(); });
    const apres = parLibelle(arbre, 'Prenom2 Nom2, sur le banc');
    expect(StyleSheet.flatten(apres.props.style || {}).borderWidth)
      .toBeUndefined();

    const preventDefault = jest.fn();
    const entree = { nativeEvent: { key: 'Enter' }, preventDefault };
    await act(async () => { jeton.props.onKeyDown(entree); });
    expect(preventDefault).toHaveBeenCalled();
    expect(texteVisible(arbre)).toContain('Prenom2 Nom2 est choisi');

    const poste = cibleAppuyable(arbre, 'Placer Prenom2 Nom2 au poste GB');
    expect(poste).toBeTruthy();
    await act(async () => { poste.props.onPress(); });

    expect(parLibelle(arbre, 'Prenom2 Nom2, sur le terrain')).toBeTruthy();
    expect(texteVisible(arbre)).toContain('1/11 placés');

    // Le poste pris ne s'offre plus ; le joueur place revient au banc au clavier.
    const surLeTerrain = parLibelle(arbre, 'Prenom2 Nom2, sur le terrain');
    const espace = { nativeEvent: { key: ' ' }, preventDefault };
    await act(async () => { surLeTerrain.props.onKeyDown(espace); });
    expect(parLibelle(arbre, 'Placer Prenom2 Nom2 au poste GB')).toBeUndefined();
    await act(async () => { boutonTitre(arbre, 'Remettre Prenom2 Nom2 au banc').props.onPress(); });
    expect(parLibelle(arbre, 'Prenom2 Nom2, sur le banc')).toBeTruthy();
    expect(texteVisible(arbre)).toContain('0/11 placés');
  });

  test('6. sur le telephone, aucune de ces portes (le jeton n est pas un bouton)', async () => {
    Platform.OS = 'ios';
    mockReponseComposition = { data: undefined, isError: false };
    const arbre = await rendre(MatchCompositionBoard, {
      ...PAR_L_ADRESSE,
      selectedPlayers: [J1, J2],
      startPlacements: [],
    });

    const jeton = parLibelle(arbre, 'Prenom2 Nom2, sur le banc');
    expect(jeton.props.onKeyDown).toBeUndefined();
    expect(jeton.props.focusable).toBeUndefined();
    expect(texteVisible(arbre)).not.toContain('Au clavier');
  });

  test('🔴 7. « Partir de… » arrive sans convoques : il les relit aussi', async () => {
    mockReponseComposition = { data: chargeAvecBrouillon(), isError: false };
    const arbre = await rendre(MatchCompositionStart, PAR_L_ADRESSE);

    expect(mockUseComposition).toHaveBeenCalledWith('evt_1', 'team_1', { enabled: true });
    expect(texteVisible(arbre)).toContain('2 convoqués');
  });
});
