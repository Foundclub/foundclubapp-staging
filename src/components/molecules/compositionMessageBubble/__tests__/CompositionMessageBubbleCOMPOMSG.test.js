import renderer, { act } from 'react-test-renderer';

import CompositionMessageBubble from '../CompositionMessageBubble';

// BULLE (29/09) — la barre Present / Absent tire la couche de services (client
// HTTP). Cette suite ne l affiche jamais (matchs passes, ou lecteur absent de la
// carte) : elle est testee dans `CompositionMessageBubbleBULLE.test.js`.
jest.mock('../CompositionAnswerBar', () => ({ __esModule: true, default: () => null }));

// ==========================================================================
// COMPOMSG — LA CARTE « COMPOSITION PUBLIÉE » DU FIL, REFAITE (23/09).
//
// 🗣️ Adel, capture 2 (TestFlight 2.6.61) : « le message dans le fil de la
// conversation, visuellement il faut l'améliorer, qu'il corresponde mieux au
// design system. Là, c'est pas très beau. »
//
// Ce que la capture montrait, et que ces témoins interdisent désormais :
//   · « 1 equipe(s) » — accent manquant, « (s) » de formulaire ;
//   · « Aix-Perd en Buvette · v1 » — un « v1 » qui ne dit rien à un joueur ;
//   · un terrain de football ÉCRASÉ dans une boîte couchée (220 × 150) ;
//   · aucun passage direct vers le plein écran pour un joueur convoqué.
//
// ⛔ Ce que ces témoins ne rejouent PAS : les noms sous le terrain (R6), le
// contexte date/heure/lieu (U06), l'aiguillage (AC08, COMPOMODIF). Leurs
// fichiers les tiennent déjà.
// ==========================================================================

const mockNavigate = jest.fn();
/** @type {any} */
let mockSnapshot;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
// Le français de l'app, pluriels et `{{version}}` compris.
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('@/store/authRuntime', () => ({
  getAuthRuntimeSnapshot: () => mockSnapshot,
}));

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, style }) => (
      <View style={style} testID="mini-terrain">{children}</View>
    ),
  };
});

jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  return {
    __esModule: true,
    default: () => ({
      Colors: colors(),
      Fonts: jest.requireActual('@/theme/fonts').default(colors()),
      Spaces,
    }),
  };
});

const MOI = 'joueur-1';
const REMPLACANT = 'joueur-2';

const COMPO = {
  eventAddress: 'Pélissanne (13330)',
  eventDate: '2026-09-28T16:00:00.000Z',
  eventId: 'evt-1',
  eventName: 'RDV 19h30 au stade de Pelisanne',
  manualPlayers: [],
  placements: [],
  publishedVersion: 1,
  reservePlayers: [{ documentId: REMPLACANT, firstname: 'Paul', lastname: 'Veuillet' }],
  schemaVersion: 3,
  snapshotPlayers: [
    {
      avatar: '/uploads/adel.jpg', documentId: MOI, firstname: 'Adel', lastname: 'Ferchichi',
    },
    { documentId: REMPLACANT, firstname: 'Paul', lastname: 'Veuillet' },
  ],
  sport: 'football',
  sportContext: 'football',
  teamId: 'team-1',
  teamName: 'Aix-Perd en Buvette',
  teams: [{
    id: 't1',
    name: 'Aix-Perd en Buvette',
    placements: [{ playerId: MOI, positionX: 50, positionY: 20 }],
  }],
  type: 'lineup_share',
};

/** @type {any[]} */
const montes = [];

const rendre = (/** @type {any} */ compo = COMPO) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<CompositionMessageBubble composition={compo} />);
  });
  montes.push(arbre);
  return arbre;
};

const texteVisible = (/** @type {any} */ arbre) => {
  const { Text } = jest.requireActual('react-native');
  return arbre.root.findAllByType(Text)
    .map((/** @type {any} */ n) => {
      const enfants = Array.isArray(n.props.children) ? n.props.children : [n.props.children];
      return enfants.map((/** @type {any} */ e) => String(e ?? '')).join('');
    })
    .join(' | ');
};

const derniereRoute = () => {
  const appel = [...mockNavigate.mock.calls].pop();
  return appel ? appel[1] : null;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSnapshot = { auth: { user: { documentId: MOI } } };
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('COMPOMSG · écran 1 — plus aucun libellé technique', () => {
  test('⛔ ni « equipe(s) », ni « v1 » : la carte parle comme un humain', () => {
    const texte = texteVisible(rendre());

    expect(texte).not.toContain('equipe(s)');
    expect(texte).not.toMatch(/\bv1\b/);
  });

  test('🥇 la carte compte les CONVOQUÉS (terrain + banc), au bon pluriel', () => {
    expect(texteVisible(rendre())).toContain('2 convoqués');

    const seul = texteVisible(rendre({ ...COMPO, reservePlayers: [] }));
    expect(seul).toContain('1 convoqué');
    expect(seul).not.toContain('1 convoqués');
  });

  test('🥇 une compo MODIFIÉE le dit en mots : « Version 2 »', () => {
    const texte = texteVisible(rendre({ ...COMPO, publishedVersion: 2 }));

    expect(texte).toContain('Version 2');
    expect(texte).not.toMatch(/\bv2\b/);
  });

  test('🔤 « + 2 autres équipes » — le pluriel français, enfin juste', () => {
    const autre = {
      id: 't2', name: 'B', placements: [{ playerId: REMPLACANT, positionX: 10, positionY: 10 }],
    };
    const teams = [...COMPO.teams, autre, { ...autre, id: 't3' }];
    const texte = texteVisible(rendre({ ...COMPO, teams }));

    expect(texte).toContain('+ 2 autres équipes');
  });
});

describe('COMPOMSG · écran 1 — le terrain', () => {
  test('🥇 le terrain est DEBOUT, dans les proportions du sport — plus écrasé', () => {
    const arbre = rendre();
    const [terrain] = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'mini-terrain',
    );
    const style = [terrain.props.style].flat(Infinity)
      .reduce((/** @type {any} */ acc, /** @type {any} */ s) => ({ ...acc, ...(s || {}) }), {});

    // Un terrain de football est plus HAUT que large (ratio 1,52).
    expect(style.aspectRatio).toBeLessThan(1);
  });

  test('🥇 toucher le terrain ouvre le PLEIN ÉCRAN, même pour un joueur convoqué', () => {
    const arbre = rendre();
    const bouton = arbre.root.findAll(
      (/** @type {any} */ n) => typeof n.props?.onPress === 'function'
        && n.props?.accessibilityLabel === 'Voir la composition en plein écran',
    )[0];

    expect(bouton).toBeDefined();
    act(() => { bouton.props.onPress(); });

    expect(derniereRoute()?.screen).toBe('MatchCompositionBoard');
    expect(derniereRoute()?.params?.readOnly).toBe(true);
  });

  test('🥇 le plein écran ouvert depuis la carte relit la DERNIÈRE version publiée', () => {
    mockSnapshot = { auth: { user: { documentId: 'spectateur-9' } } };
    const arbre = rendre({ ...COMPO, publishedVersion: 3 });
    const { TouchableOpacity } = jest.requireActual('react-native');

    act(() => { arbre.root.findAllByType(TouchableOpacity)[0].props.onPress(); });

    expect(derniereRoute()?.params?.refreshFromServer).toBe(true);
    // La version que la carte montrait : le plateau dira si elle a été dépassée.
    expect(derniereRoute()?.params?.messageVersion).toBe(3);
  });
});

describe('COMPOMSG · écran 1 — accessibilité', () => {
  test('🥇 la carte se lit comme UN bouton, avec une phrase qui dit tout', () => {
    const { TouchableOpacity } = jest.requireActual('react-native');
    const carte = rendre().root.findAllByType(TouchableOpacity)[0];

    expect(carte.props.accessibilityRole).toBe('button');
    expect(carte.props.accessibilityLabel).toContain('RDV 19h30 au stade de Pelisanne');
    expect(carte.props.accessibilityLabel).toContain('2 convoqués');
  });
});
