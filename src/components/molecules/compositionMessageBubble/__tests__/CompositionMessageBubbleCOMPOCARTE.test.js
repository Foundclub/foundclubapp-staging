import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CompositionMessageBubble from '../CompositionMessageBubble';

// La barre Present / Absent tire la couche de services (client HTTP) : elle a
// ses propres temoins (`CompositionMessageBubbleBULLE.test.js`).
jest.mock('../CompositionAnswerBar', () => ({ __esModule: true, default: () => null }));

// ==========================================================================
// COMPO-CARTE-SITE (29/09) — « AGRANDIR » ATTEIGNABLE AU LECTEUR D'ECRAN.
//
// 🔍 Constat du lot BULLE : le terrain « Agrandir » de la carte est un bouton
// IMBRIQUE dans le bouton-carte. Or un element accessible (la carte) est lu
// comme UN SEUL element par VoiceOver et TalkBack : tout bouton range dedans
// est invisible pour eux. Sur le site, un `role="button"` dans un autre
// `role="button"` est le meme defaut. BULLE a pose Present / Absent A COTE de
// la carte pour cette raison ; le terrain recoit le meme remede.
//
// 🎯 Ce que ces temoins exigent :
//   1. « Agrandir » n'est PLUS un descendant du bouton-carte ;
//   2. un lecteur d'ecran trouve exactement DEUX boutons : la carte (sa phrase
//      qui dit tout) et le terrain — aucun doublon ;
//   3. CE QUE VOIT UN VOYANT NE CHANGE PAS : memes textes, dans le meme ordre,
//      le meme cadre autour de tout, et chaque zone touchee ouvre ce qu'elle
//      ouvrait (la carte : l'aiguillage AC08 ; le terrain : le plein ecran).
//
// 🧱 Les temoins 3 sont VERTS avant comme apres : ils caracterisent ce que le
// decoupage ne doit pas changer. Les temoins 1 et 2 sont ROUGES avant.
// ==========================================================================

const mockNavigate = jest.fn();
/** @type {any} */
let mockSnapshot;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
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
const LIBELLE_TERRAIN = 'Voir la composition en plein écran';

const COMPO = {
  eventAddress: 'Pélissanne (13330)',
  eventDate: '2026-09-28T16:00:00.000Z',
  eventDisplayName: 'Match vs US Pelican',
  eventId: 'evt-1',
  eventName: 'Match vs US Pelican',
  eventNote: 'RDV 19h30 au stade',
  manualPlayers: [],
  placements: [],
  publishedVersion: 2,
  reservePlayers: [{ documentId: REMPLACANT, firstname: 'Paul', lastname: 'Veuillet' }],
  schemaVersion: 3,
  snapshotPlayers: [
    { documentId: MOI, firstname: 'Adel', lastname: 'Ferchichi' },
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

/**
 * Monte la carte seule.
 * @param {any} [compo]
 * @returns {any}
 */
const rendre = (compo = COMPO) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<CompositionMessageBubble composition={compo} />);
  });
  montes.push(arbre);
  return arbre;
};

/**
 * Le bouton-carte : celui qui porte la phrase de la carte et « Ouvre la
 * composition ».
 * @param {any} arbre
 * @returns {any}
 */
const boutonCarte = (arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === TouchableOpacity
    && n.props.accessibilityHint === 'Ouvre la composition',
)[0];

/**
 * Le bouton du terrain (« Agrandir »).
 * @param {any} arbre
 * @returns {any}
 */
const boutonTerrain = (arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === TouchableOpacity
    && n.props.accessibilityLabel === LIBELLE_TERRAIN,
)[0];

/**
 * Un noeud est-il MASQUE aux lecteurs d'ecran, lui ou un de ses parents ?
 * @param {any} noeud
 * @returns {boolean}
 */
const estMasque = (noeud) => {
  for (let courant = noeud; courant; courant = courant.parent) {
    if (courant.props?.['aria-hidden'] === true
      || courant.props?.accessibilityElementsHidden === true
      || courant.props?.importantForAccessibility === 'no-hide-descendants') {
      return true;
    }
  }
  return false;
};

/**
 * Ce qu'un lecteur d'ecran peut atteindre : les boutons accessibles, non
 * masques, et qui ne sont pas ENFERMES dans un autre element accessible.
 * @param {any} arbre
 * @returns {any[]}
 */
const elementsAtteignables = (arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === TouchableOpacity,
).filter((/** @type {any} */ bouton) => {
  if (bouton.props.accessible === false || estMasque(bouton)) return false;
  for (let ancetre = bouton.parent; ancetre; ancetre = ancetre.parent) {
    if (ancetre.type === TouchableOpacity && ancetre.props.accessible !== false) return false;
  }
  return true;
});

/**
 * Les textes visibles, dans l'ordre de l'ecran.
 * @param {any} arbre
 * @returns {string[]}
 */
const textesDansLOrdre = (arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => {
    const enfants = Array.isArray(n.props.children) ? n.props.children : [n.props.children];
    return enfants.map((/** @type {any} */ e) => String(e ?? '')).join('');
  });

/**
 * Le bouton le plus proche au-dessus de ce texte : c'est lui que le doigt
 * declenche en touchant ce texte.
 * @param {any} arbre
 * @param {string} texte
 * @returns {any}
 */
const boutonSous = (arbre, texte) => {
  const noeud = arbre.root.findAllByType(Text).find((/** @type {any} */ n) => {
    const enfants = Array.isArray(n.props.children) ? n.props.children : [n.props.children];
    return enfants.map((/** @type {any} */ e) => String(e ?? '')).join('') === texte;
  });
  for (let courant = noeud?.parent; courant; courant = courant.parent) {
    if (courant.type === TouchableOpacity) return courant;
  }
  return null;
};

const derniereRoute = () => {
  const appel = [...mockNavigate.mock.calls].pop();
  return appel ? appel[1] : null;
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockSnapshot = { auth: { user: { documentId: MOI } } };
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('COMPO-CARTE-SITE · témoin 1 — « Agrandir » sort du bouton-carte', () => {
  test('🥇 le terrain n est PLUS un descendant du bouton-carte', () => {
    const arbre = rendre();
    const carte = boutonCarte(arbre);

    expect(carte).toBeDefined();
    expect(boutonTerrain(arbre)).toBeDefined();
    expect(carte.findAll(
      (/** @type {any} */ n) => n.props?.accessibilityLabel === LIBELLE_TERRAIN,
    )).toHaveLength(0);
  });

  test('🥇 le terrain n est enfermé dans AUCUN élément accessible, ni masqué', () => {
    const terrain = boutonTerrain(rendre());

    expect(estMasque(terrain)).toBe(false);
    for (let ancetre = terrain.parent; ancetre; ancetre = ancetre.parent) {
      expect(ancetre.type === TouchableOpacity && ancetre.props.accessible !== false).toBe(false);
    }
  });
});

describe('COMPO-CARTE-SITE · témoin 2 — le lecteur d écran trouve deux boutons', () => {
  test('🥇 la carte puis le terrain, dans cet ordre', () => {
    const atteignables = elementsAtteignables(rendre());

    expect(atteignables.map((/** @type {any} */ n) => n.props.accessibilityLabel)).toEqual([
      expect.stringContaining('Match vs US Pelican'),
      LIBELLE_TERRAIN,
    ]);
  });

  test('🥇 la phrase de la carte dit toujours tout (titre, lieu, RDV, compte)', () => {
    const carte = boutonCarte(rendre());

    expect(carte.props.accessibilityRole).toBe('button');
    expect(carte.props.accessibilityLabel).toContain('Match vs US Pelican');
    expect(carte.props.accessibilityLabel).toContain('Pélissanne (13330)');
    expect(carte.props.accessibilityLabel).toContain('RDV 19h30 au stade');
    expect(carte.props.accessibilityLabel).toContain('2 convoqués');
  });
});

// 🎨 MSG1A (07/10) — le pack « modele WhatsApp » change VOLONTAIREMENT trois choses que ce
// temoin figeait : « quand · equipe » sur UNE ligne, et, pour qui ne gere pas la composition,
// un seul bouton « Ouvrir la composition » (le pied « N convoques · Ouvrir » devient de vrais
// boutons). Le reste (ordre, terrain, noms, aiguillage) ne bouge pas.
describe('COMPO-CARTE-SITE · témoin 3 — ce que voit un voyant ne change pas', () => {
  test('les mêmes textes, dans le même ordre', () => {
    expect(textesDansLOrdre(rendre())).toEqual([
      'Composition publiée',
      'Version 2',
      'Match vs US Pelican',
      expect.stringMatching(/ · .* · Aix-Perd en Buvette$/),
      'Pélissanne (13330)',
      'Infos',
      'RDV 19h30 au stade',
      // Les initiales du jeton pose sur le terrain (pas de photo ici).
      'AF',
      'Agrandir',
      'Sur le terrain · 1',
      'Adel Ferchichi',
      'Sur le banc · 1',
      'Paul Veuillet',
      '2 convoqués',
      'Ouvrir la composition',
    ]);
  });

  test('le cadre de la carte (bord, largeur) entoure TOUT : titre, terrain et « Ouvrir »', () => {
    const arbre = rendre();
    const cadres = arbre.root.findAll((/** @type {any} */ n) => {
      const style = [n.props?.style].flat(Infinity)
        .reduce((/** @type {any} */ acc, /** @type {any} */ s) => ({ ...acc, ...(s || {}) }), {});
      return typeof n.type !== 'string' && style.width === 264 && style.borderWidth === 1;
    });
    const cadre = cadres[cadres.length - 1];

    expect(cadre).toBeDefined();
    expect(cadre.findAll((/** @type {any} */ n) => n.props?.testID === 'mini-terrain').length)
      .toBeGreaterThan(0);
    const textes = cadre.findAllByType(Text).map((/** @type {any} */ n) => n.props.children);
    expect(textes).toContain('Match vs US Pelican');
    expect(textes).toContain('Ouvrir la composition');
  });

  test('toucher le titre, les noms ou « Ouvrir » : l aiguillage de la carte', () => {
    // Un convoque (le lecteur de ce temoin) va sur « Tu es convoque ».
    const arbre = rendre();

    ['Match vs US Pelican', 'Adel Ferchichi', 'Ouvrir la composition'].forEach((texte) => {
      mockNavigate.mockClear();
      const bouton = boutonSous(arbre, texte);
      expect(bouton).not.toBeNull();
      act(() => { bouton.props.onPress(); });
      expect(derniereRoute()?.screen).toBe('PlayerConvocation');
    });
  });

  test('toucher « Agrandir » : le plein écran, même pour un convoqué', () => {
    const arbre = rendre();
    const bouton = boutonSous(arbre, 'Agrandir');

    act(() => { bouton.props.onPress(); });

    expect(derniereRoute()?.screen).toBe('MatchCompositionBoard');
    expect(derniereRoute()?.params?.readOnly).toBe(true);
  });
});

// MSG1A (§3.7) — LE CONTRAT AVEC MSG1C (07/10) : `onEdit(target?)` et `renderReponses()`.
// 🔴 ROUGE avant MSG1A : K1, K2, K3 (la carte n'avait ni « Modifier », ni bloc sous elle).
describe('MSG1A — contrat de la carte avec MSG1C', () => {
  /**
   * @param {any} props
   * @returns {any} L'arbre.
   */
  const rendreAvec = (props) => {
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(
        <CompositionMessageBubble
          composition={COMPO}
          dansLaBulle={props.dansLaBulle}
          onEdit={props.onEdit}
          onOpenAddress={props.onOpenAddress}
          renderReponses={props.renderReponses}
        />,
      );
    });
    montes.push(arbre);
    return arbre;
  };

  test('K1 — sans onEdit : un seul bouton « Ouvrir la composition », pas de « Modifier »', () => {
    const textes = textesDansLOrdre(rendreAvec({}));
    expect(textes).toContain('Ouvrir la composition');
    expect(textes).not.toContain('Modifier');
  });

  test('K2 — avec onEdit : « Modifier » appelle onEdit(), le terrain onEdit(« placement »)', () => {
    const onEdit = jest.fn();
    const arbre = rendreAvec({ onEdit });

    act(() => { boutonSous(arbre, 'Modifier').props.onPress(); });
    expect(onEdit).toHaveBeenLastCalledWith();

    act(() => { boutonTerrain(arbre).props.onPress(); });
    expect(onEdit).toHaveBeenLastCalledWith('placement');
    expect(textesDansLOrdre(arbre)).toEqual(expect.arrayContaining(['Ouvrir', 'Modifier le placement']));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('K3 — renderReponses : son rendu se pose sous la carte', () => {
    const arbre = rendreAvec({ renderReponses: () => <Text>Présents · 3</Text> });
    expect(textesDansLOrdre(arbre)).toContain('Présents · 3');
  });

  test('K4 — dans la bulle du fil : ni fond ni liseré propres, 276 de large', () => {
    const arbre = rendreAvec({ dansLaBulle: true });
    const cadre = arbre.root.findAll((n) => typeof n.type !== 'string').find((n) => {
      const style = [n.props?.style].flat(Infinity).reduce((acc, s) => ({ ...acc, ...(s || {}) }), {});
      return style.width === 276;
    });
    expect(cadre).toBeDefined();
    const style = [cadre.props.style].flat(Infinity).reduce((acc, s) => ({ ...acc, ...(s || {}) }), {});
    expect(style.backgroundColor).toBeUndefined();
    expect(style.borderWidth).toBeUndefined();
  });

  test('K5 — avec onOpenAddress, le lieu est un LIEN a part, hors du bouton de la carte', () => {
    const onOpenAddress = jest.fn();
    const arbre = rendreAvec({ onOpenAddress });
    const lien = arbre.root.findAll((n) => n.props?.testID === 'composition-adresse'
      && typeof n.props?.onPress === 'function')[0];

    expect(lien.props.accessibilityRole).toBe('link');
    // ⛔ Aucun bouton dans un bouton : aucun ancetre du lien n'est le bouton de la carte.
    let parent = lien.parent;
    while (parent) {
      expect(parent.props?.accessibilityRole === 'button' && parent.props?.accessibilityLabel)
        .toBeFalsy();
      parent = parent.parent;
    }

    act(() => { lien.props.onPress(); });
    expect(onOpenAddress).toHaveBeenCalledWith({ label: 'Pélissanne (13330)' });
  });
});
