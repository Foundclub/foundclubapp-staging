import renderer, { act } from 'react-test-renderer';

import PlayerConvocationScreen from '../PlayerConvocationScreen';

// ==========================================================================
// AD08 — LE BANC, SUR L'ECRAN DU JOUEUR : les deux lignes que rien ne gardait.
//
//   T4. 🖍️ SA LIGNE SUR LE BANC. Le code la distingue deja (teinte et bordure
//       plus fortes, `PlayerConvocationScreen.js` : `isMine`), mais AUCUN
//       temoin ne le figeait — un lot suivant pouvait retirer la teinte sans
//       qu'une seule porte ne bouge.
//
// 🧨 La charge utilisee ici est celle du SERVEUR (forme `branches`), et le
// remplacant n'y est QUE dans `reserveSnapshotPlayers` : c'est la forme qui
// mettait sa carte d'identite a blanc.
// ==========================================================================

const mockGoBack = jest.fn();
const mockReplace = jest.fn();

/** @type {any} */
let mockUserData;
/** @type {any} */
let mockQueryState;

const mockNavigation = { goBack: mockGoBack, navigate: jest.fn(), replace: mockReplace };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { eventId: 'evt-1', teamId: 'team-1' } }),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn(), variables: undefined }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ options) => {
        const valeur = cle.split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
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
  useGetEvent: () => ({ data: { location: 'Stade Municipal', startTime: '15:00:00.000' } }),
  useGetEventConvocation: () => mockQueryState,
}));

jest.mock('@/services/event/eventService', () => ({
  respondToEventRsvp: jest.fn(() => Promise.resolve({})),
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
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { title }) => <TexteRN>{title}</TexteRN>,
  };
});

/**
 * Aplati les enfants React en une chaine, pour lire le texte rendu.
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
 * Tout le texte visible de l'arbre rendu, concatene.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return arbre.root.findAllByType(TexteRN)
    .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
    .join(' | ');
};

/**
 * La peinture (fond + bordure) de la ligne de banc qui porte ce nom.
 *
 * On retient la DERNIERE vue peinte qui contient le nom : la carte d'identite
 * du haut est peinte elle aussi et vient AVANT dans l'arbre, la ligne de banc
 * est donc toujours la derniere des deux.
 * @param {any} arbre
 * @param {string} nom
 * @returns {any}
 */
const peintureDeLaLigne = (arbre, nom) => {
  const { Text: TexteRN, View: VueRN } = jest.requireActual('react-native');
  const peintes = arbre.root.findAllByType(VueRN)
    .map((/** @type {any} */ noeud) => ({
      noeud,
      peinture: [].concat(noeud.props.style || [])
        .find((/** @type {any} */ style) => style && style.backgroundColor && style.borderColor),
    }))
    .filter((/** @type {any} */ entree) => Boolean(entree.peinture)
      && entree.noeud.findAllByType(TexteRN)
        .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children).includes(nom)));

  return peintes.length ? peintes[peintes.length - 1].peinture : null;
};

const PACK = {
  publishedBy: { firstname: 'Coach', lastname: 'Karim' },
  reservePlayerIds: ['joueur-2', 'joueur-3'],
  // 🧨 Les remplacants ne sont QUE la — jamais dans `snapshotPlayers`.
  reserveSnapshotPlayers: [
    {
      documentId: 'joueur-2', firstname: 'Leo', lastname: 'Diarra', number: 7, position: 'Ailier',
    },
    {
      documentId: 'joueur-3', firstname: 'Yanis', lastname: 'Bosco', number: 11, position: 'Milieu',
    },
  ],
  snapshotPlayers: [
    {
      documentId: 'joueur-1', firstname: 'Karim', lastname: 'Sylla', number: 1,
    },
  ],
  sportContext: 'football',
  teams: [{
    id: 'team_1',
    name: 'Senior 1',
    placements: [{
      playerId: 'joueur-1', positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
    }],
  }],
};

const CHARGE_SERVEUR = {
  branches: [{
    published: PACK,
    responses: { byPlayerId: {}, counts: { absent: 0, pending: 3, present: 0 } },
    team: { documentId: 'team-1', name: 'Senior 1' },
    viewer: { inReserve: true, teamEntryIds: [] },
  }],
  event: { date: '2026-08-15T15:00:00.000Z', documentId: 'evt-1', name: 'Match' },
  eventKind: 'event',
  schemaVersion: 3,
};

const rendre = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<PlayerConvocationScreen />);
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUserData = { documentId: 'joueur-2' };
  mockQueryState = { data: CHARGE_SERVEUR, isError: false, isLoading: false };
});

describe('AD08 · TEMOIN 4 — 🖍️ sa ligne sur le banc ne ressemble pas aux autres', () => {
  test('le lecteur est surligne, ses camarades de banc ne le sont pas', () => {
    const arbre = rendre();
    const mienne = peintureDeLaLigne(arbre, 'Leo Diarra');
    const autre = peintureDeLaLigne(arbre, 'Yanis Bosco');

    expect(mienne).not.toBeNull();
    expect(autre).not.toBeNull();
    expect(mienne.backgroundColor).not.toBe(autre.backgroundColor);
    expect(mienne.borderColor).not.toBe(autre.borderColor);
  });

  test('et quand c est le titulaire qui regarde, AUCUNE ligne du banc n est surlignee', () => {
    mockUserData = { documentId: 'joueur-1' };
    const arbre = rendre();

    expect(peintureDeLaLigne(arbre, 'Leo Diarra').backgroundColor)
      .toBe(peintureDeLaLigne(arbre, 'Yanis Bosco').backgroundColor);
  });
});

describe('AD08 · TEMOIN 7 — 🔒 le garde-fou de vie privee ne bouge pas', () => {
  test('un entraineur qui recoit la meme notification est repose sur l evenement', () => {
    mockUserData = { documentId: 'coach-1' };
    const texte = texteVisible(rendre());

    expect(texte).not.toContain('Tu es convoqué');
    expect(texte).not.toContain('Leo Diarra');
    expect(mockReplace).toHaveBeenCalled();
  });
});
