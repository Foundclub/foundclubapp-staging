import renderer, { act } from 'react-test-renderer';

import PlayerConvocationScreen from '../PlayerConvocationScreen';

// ==========================================================================
// COMPOMSG — « TU ES CONVOQUÉ », VU DEPUIS LA MESSAGERIE (23/09).
//
// 🗣️ Adel, capture 3 (TestFlight 2.6.61) : « dans la version avec les infos, on
// ne voit pas les photos des joueurs : ce n'est pas normal. Il faudrait qu'en
// cliquant, on puisse afficher la version en plein écran. »
//
// 🧨 CE QUE LA LECTURE DU CODE A TROUVÉ : les photos ÉTAIENT dans la charge
// (`published.snapshotPlayers[].avatar` — la carte du fil et le plein écran les
// affichent pour les mêmes joueurs). Cet écran dessinait ses PROPRES pastilles,
// qui n'écrivaient que des initiales. Composant différent, pas donnée absente.
//
// Et le RDV : le serveur n'a AUCUN champ d'heure de rendez-vous. Le « RDV 19h30
// au stade de Pelisanne » que la carte affiche est le texte libre de
// l'événement ; cet écran ne le montrait nulle part et écrivait « Non précisé ».
// ==========================================================================

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();
const mockRsvp = jest.fn(() => Promise.resolve({}));

/** @type {any} */
let mockConvocation;
/** @type {any} */
let mockEvent;
/** @type {any} */
let mockUserData;

const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate, replace: mockReplace };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { eventId: 'evt-1', teamId: 'team-1' } }),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ input) => {
      options.mutationFn(input);
    },
  }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
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
        return valeur.replace(/{{(\w+)}}/g, (_correspondance, nom) => (
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

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData }),
}));

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({ data: mockEvent }),
  useGetEventConvocation: () => ({
    data: mockConvocation,
    isError: false,
    isLoading: false,
  }),
}));

jest.mock('@/services/event/eventService', () => ({
  respondToEventRsvp: (/** @type {any} */ ...args) => mockRsvp(...args),
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
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>RETOUR</TexteRN> };
});

jest.mock('@/components/atoms/loader/Loader', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>CHARGEMENT</TexteRN> };
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { name }) => <TexteRN>{`AVATAR:${name}`}</TexteRN>,
  };
});

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View testID="terrain">{children}</View>,
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

/**
 * Aplatit les enfants React en une chaîne, pour lire le texte rendu.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tout le texte visible de l'arbre rendu, concaténé.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return arbre.root.findAllByType(TexteRN)
    .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
    .join(' | ');
};

const MOI = 'joueur-1';

// La charge telle que la capture d'Adel la montre : Adel sur le terrain AVEC
// une photo, Amin sur le terrain SANS photo, Paul au banc avec la sienne.
const PAUL = {
  avatar: { url: '/uploads/paul.jpg' },
  documentId: 'joueur-3',
  firstname: 'Paul',
  lastname: 'Veuillet',
};

const PACK = {
  publishedBy: { firstname: 'Pierre', lastname: 'Hecquet' },
  reservePlayerIds: ['joueur-3'],
  reserveSnapshotPlayers: [PAUL],
  snapshotPlayers: [
    {
      avatar: { url: '/uploads/adel.jpg' },
      documentId: MOI,
      firstname: 'Adel',
      lastname: 'Ferchichi',
    },
    { documentId: 'joueur-2', firstname: 'Amin', lastname: 'Hsino' },
    PAUL,
  ],
  sportContext: 'football',
  teams: [{
    id: 'team_1',
    name: 'Aix-Perd en Buvette',
    placements: [
      { playerId: MOI, positionX: 50, positionY: 20 },
      { playerId: 'joueur-2', positionX: 50, positionY: 93 },
    ],
  }],
  version: 2,
};

/** @type {any[]} */
const montes = [];

const rendre = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<PlayerConvocationScreen />);
  });
  montes.push(arbre);
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUserData = { documentId: MOI };
  mockEvent = {
    date: '2026-09-28T16:00:00.000Z',
    description: 'RDV 19h30 au stade de Pelisanne',
    documentId: 'evt-1',
    locationDetails: JSON.stringify({ address: 'Pélissanne (13330)' }),
    opponentName: 'US Pelican',
    startTime: '18:00:00.000',
    type: { name: 'Match' },
  };
  mockConvocation = {
    branches: [{
      published: PACK,
      responses: { byPlayerId: {} },
      team: { documentId: 'team-1', name: 'Aix-Perd en Buvette' },
    }],
    event: { date: '2026-09-28T16:00:00.000Z', documentId: 'evt-1', name: 'Match vs US Pelican' },
  };
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('COMPOMSG · écran 3 — les PHOTOS sur le terrain', () => {
  test('🥇 un joueur qui a une photo apparaît avec SA photo sur le terrain', () => {
    const { Image } = jest.requireActual('react-native');
    const arbre = rendre();
    const [terrain] = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'terrain');

    const photos = terrain.findAllByType(Image)
      .map((/** @type {any} */ n) => String(n.props.source?.uri || ''));

    expect(photos.some((uri) => uri.includes('/uploads/adel.jpg'))).toBe(true);
  });

  test('🔒 un joueur SANS photo garde ses initiales — jamais un rond vide', () => {
    const arbre = rendre();
    const [terrain] = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'terrain');
    const { Text: TexteRN } = jest.requireActual('react-native');

    const initiales = terrain.findAllByType(TexteRN)
      .map((/** @type {any} */ n) => aplatirTexte(n.props.children));

    expect(initiales).toContain('AH');
  });
});

describe('COMPOMSG · écran 3 — toucher le terrain ouvre le PLEIN ÉCRAN', () => {
  test('🥇 le terrain est un bouton qui mène au plateau, en lecture seule, avec les photos', () => {
    const arbre = rendre();
    const bouton = arbre.root.findAll(
      (/** @type {any} */ n) => typeof n.props?.onPress === 'function'
        && n.props?.accessibilityLabel === 'Voir la composition en plein écran',
    )[0];

    expect(bouton).toBeDefined();
    act(() => { bouton.props.onPress(); });

    const [ecran, parametres] = mockNavigate.mock.calls.pop();
    expect(ecran).toBe('MatchCompositionBoard');
    expect(parametres.readOnly).toBe(true);
    expect(parametres.canEdit).toBe(false);
    expect(parametres.eventId).toBe('evt-1');
    expect(parametres.startPlacements.map((/** @type {any} */ p) => p.playerId))
      .toEqual([MOI, 'joueur-2']);
    // Les personnes voyagent AVEC leur photo : le plein écran la dessine.
    expect(parametres.selectedPlayers[0].avatar).toEqual({ url: '/uploads/adel.jpg' });
    // Titulaires PUIS banc : le plateau retrouve le banc tout seul.
    expect(parametres.selectedPlayers.map((/** @type {any} */ p) => p.documentId))
      .toEqual([MOI, 'joueur-2', 'joueur-3']);
  });

  /**
   * Touche le terrain et rend les parametres envoyes au plein ecran.
   * @returns {any}
   */
  const ouvrirLePleinEcran = () => {
    const bouton = rendre().root.findAll(
      (/** @type {any} */ n) => typeof n.props?.onPress === 'function'
        && n.props?.accessibilityLabel === 'Voir la composition en plein écran',
    )[0];
    act(() => { bouton.props.onPress(); });
    return mockNavigate.mock.calls.pop()[1];
  };

  test('📱 URL-BOOLEENS — sur le telephone, AUCUNE relecture demandee (economie COMPOMSG)', () => {
    expect(ouvrirLePleinEcran().refreshFromServer).toBeUndefined();
  });

  test('🌐 URL-BOOLEENS — sur le SITE, le plein ecran relit la compo sur le serveur', () => {
    // Sur le site, les joueurs et les placements (des objets) ne voyagent pas dans
    // l adresse : sans relecture, le plein ecran y arrivait VIDE.
    const { Platform } = jest.requireActual('react-native');
    const systemeReel = Platform.OS;
    Platform.OS = 'web';
    try {
      expect(ouvrirLePleinEcran().refreshFromServer).toBe(true);
    } finally {
      Platform.OS = systemeReel;
    }
  });
});

describe('COMPOMSG · écran 3 — les MÊMES infos que la carte du fil', () => {
  test('🥇 le texte de l’entraîneur (RDV…) est à l’écran, comme sur la carte', () => {
    const texte = texteVisible(rendre());

    expect(texte).toContain('RDV 19h30 au stade de Pelisanne');
  });

  test('⛔ plus de colonne « RDV · Non précisé » qui contredit la carte', () => {
    const texte = texteVisible(rendre());

    expect(texte).not.toContain('Non précisé');
    expect(texte).not.toMatch(/(^|\| )RDV( \||$)/);
  });

  test('🥇 le JOUR du match est écrit, pas seulement l’heure', () => {
    const texte = texteVisible(rendre());

    expect(texte).toContain('28/09/2026');
    expect(texte).toContain('18:00');
  });

  test('🔒 sans texte libre, aucune ligne vide ne s’affiche', () => {
    mockEvent = { ...mockEvent, description: '' };
    const texte = texteVisible(rendre());

    expect(texte).not.toContain('Infos');
    expect(texte).not.toContain('undefined');
  });

  test('🔒 un texte libre identique au nom du match n’est pas répété', () => {
    mockEvent = { ...mockEvent, description: 'Match vs US Pelican' };
    const texte = texteVisible(rendre());

    expect(texte.split('Match vs US Pelican').length - 1).toBe(1);
  });

  test('🥇 une compo modifiée dit sa VERSION ; la première n’affiche rien de technique', () => {
    // FINITIONS : l'espace de la pastille est désormais INSÉCABLE — le lecteur lit
    // toujours « Version 2 », d'où la normalisation des blancs avant de comparer.
    expect(texteVisible(rendre()).replace(/\s/g, ' ')).toContain('Version 2');

    mockConvocation.branches[0].published = { ...PACK, version: 1 };
    const premiere = texteVisible(rendre());
    expect(premiere).not.toContain('Version');
    expect(premiere).not.toMatch(/\bv1\b/);
  });
});

// ==========================================================================
// FINITIONS (recette émulateur du 2026-09-28, Android 16, tournée 3) — la
// pastille affichait « Version » au lieu de « Version 2 » (capture
// T3-B3-zoom-version-coupee). Une pastille épouse la largeur de son texte, et un
// texte GRAS de plusieurs mots y perd son dernier mot ; un mot seul (« Titulaire »,
// « Remplaçant ») reste entier. ⇒ Les pastilles de l'écran n'offrent plus aucun
// point de coupure. Écrit ROUGE.
// ⚠️ Jest ne calcule aucune mise en page : le témoin tient l'ABSENCE de point de
// coupure, pas le rendu — seul un Android 16 prouvera « Version 2 » entier.
// ==========================================================================
describe('FINITIONS — les pastilles de « Tu es convoqué » ne se coupent plus', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  const texteDe = (/** @type {any} */ noeud) => noeud.findAllByType(TexteRN)
    .map((/** @type {any} */ n) => aplatirTexte(n.props.children)).join('');

  test('🥇 « Version 2 » : aucune espace sécable dans la pastille', () => {
    const arbre = rendre();
    const pastille = arbre.root.findAllByType(TexteRN)
      .find((/** @type {any} */ n) => /^Version\s2$/.test(aplatirTexte(n.props.children)));

    expect(pastille).toBeDefined();
    expect(aplatirTexte(pastille.props.children)).not.toContain(' ');
  });

  test('🥇 « Sans réponse » sur la ligne d un remplaçant : aucune espace sécable', () => {
    mockConvocation.branches[0].responses = { byPlayerId: { 'joueur-3': 'pending' } };
    const arbre = rendre();
    const [pastille] = arbre.root
      .findAll((/** @type {any} */ n) => n.props?.testID === 'reponse-banc-joueur-3');

    expect(texteDe(pastille).replace(/\s/g, ' ')).toBe('Sans réponse');
    expect(texteDe(pastille)).not.toContain(' ');
  });
});

// ==========================================================================
// CONVOC-RDV (décision d'Adel du 08/10, `rdv lot`) — le serveur range enfin le
// rendez-vous dans la convocation (`published.rendezVous`) : « Tu es convoqué »
// l'affiche, sous les colonnes, comme la carte du fil (« RDV 13:30 · Au club »).
// Une convocation d'AVANT n'a pas la clé : l'écran reste tel qu'il était.
// ==========================================================================
describe('CRDV · écran 3 — le RENDEZ-VOUS de la convocation', () => {
  /**
   * Les blocs « rendez-vous » de l'arbre rendu.
   * @param {any} arbre
   * @returns {any[]}
   */
  const blocsRdv = (arbre) => arbre.root.findAll(
    (/** @type {any} */ n) => n.props?.testID === 'convocation-rendez-vous'
      && typeof n.type === 'string',
  );

  test('🥇 l’heure et le lieu du rendez-vous sont à l’écran', () => {
    mockConvocation.branches[0].published = {
      ...PACK, rendezVous: { place: 'Au club', time: '13:30' },
    };
    const arbre = rendre();
    const [bloc] = blocsRdv(arbre);

    expect(bloc).toBeDefined();
    expect(texteVisible(arbre)).toContain('RDV | 13:30 · Au club');
  });

  test('🔒 une convocation d’avant (sans la clé) ou abîmée : aucun bloc', () => {
    expect(blocsRdv(rendre())).toHaveLength(0);

    mockConvocation.branches[0].published = { ...PACK, rendezVous: { place: 42, time: '13h30' } };
    expect(blocsRdv(rendre())).toHaveLength(0);
  });
});
