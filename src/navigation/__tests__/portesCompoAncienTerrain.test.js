// C-F — LE FILET DES PORTES ENCORE POSEES SUR L'ANCIEN TERRAIN.
//
// Ce lot devait « couper net » `views/tactical_v2/`. La mesure du 2026-08-16 dit
// que c'est impossible aujourd'hui : TROIS portes VIVANTES y menent encore, et
// aucune n'a de remplacant dans le nouveau parcours.
//
//   1. la LECTURE SEULE d'une compo  -> deja tenue par
//      `EventDetailsManagePanel.test.js` (ROUTES_COMPOSITION) cote natif et par
//      `EventDetailsWebComposition.test.js` cote site ;
//   2. le TOUR GUIDE du coach        -> AUCUN filet  (ce fichier, temoin 1) ;
//   3. la BULLE COMPO du canal       -> AUCUN filet  (ce fichier, temoin 2).
//
// E6 : `tourCatalog.js` et `CompositionMessageBubble.js` n'avaient aucun test.
// Sans ce filet, le jour ou quelqu'un supprime le dossier, ces deux portes
// tombent EN SILENCE — le tour guide du coach s'arrete au milieu, et toutes les
// compos deja postees dans les canaux deviennent des vignettes mortes. C'est
// exactement le motif de la regression la plus chere du projet : du code devenu
// inatteignable que personne n'avait cartographie.
//
// ⚠️ CE FICHIER N'EST PAS UN VOEU : il DOIT devenir rouge le jour de la coupe.
// Sa rougeur est le rappel que ces deux portes ont besoin d'une destination
// neuve AVANT que `tactical_v2` disparaisse. On le met a jour ce jour-la, on ne
// le supprime pas.

import renderer, { act } from 'react-test-renderer';

import { TOUR_PROFILES } from '@/domains/tour/tourCatalog';

import BulleCompo from '@/components/molecules/compositionMessageBubble/CompositionMessageBubble';

import { RouteNames } from '@/navigation/routeNames';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: (...args) => mockNavigate(...args) }),
}));

// ⚠️ Le terrain rendu doit LAISSER PASSER ses enfants : les jetons de la
// vignette sont ses enfants. Un mock qui rend `null` les fait disparaitre et
// donne un faux « aucun jeton » — piege paye une fois le 2026-08-16.
jest.mock('@/components/tactical/RenderedTacticalField', () => ({ children }) => children);

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Images: {},
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

const findStep = (profileKey, stepId) => TOUR_PROFILES[profileKey].steps
  .find((step) => step.id === stepId);

/**
 * Retrouve le premier noeud portant un `onPress`, quelle que soit sa place.
 * @param {any} node Racine de l'arbre rendu.
 * @returns {any} Le noeud touchable, ou `null` s'il n'y en a aucun.
 */
const findPressable = (node) => {
  if (!node || typeof node !== 'object') return null;
  if (typeof node.props?.onPress === 'function') return node;
  const children = Array.isArray(node.children) ? node.children : [];
  return children.reduce((found, child) => found || findPressable(child), null);
};

describe('C-F temoin 1 — le TOUR GUIDE du coach mene toujours quelque part', () => {
  it("l'etape composition existe encore dans le tour du coach", () => {
    expect(findStep('coach', 'coach_composition')).toBeDefined();
  });

  it('elle ouvre l ANCIEN terrain, en simulation — et rien d autre ne sait le faire', () => {
    const cible = findStep('coach', 'coach_composition').navTarget;
    const resolue = cible.params({ userData: { preferredSport: 'football' } });

    expect(cible.routeName).toBe(RouteNames.EventStack);
    // 🔒 LE JOUR DE LA COUPE, CETTE LIGNE DEVIENT ROUGE. C'est voulu : elle dit
    // que le tour guide n'a pas encore de terrain de remplacement.
    expect(resolue.screen).toBe(RouteNames.TacticalBoardV2);
    // Le mode simulation est la promesse faite au coach : « rien n'est publie ».
    // Mesure du 2026-08-16 : `simulationMode` n'existe dans AUCUN ecran neuf.
    expect(resolue.params.simulationMode).toBe(true);
    expect(resolue.params.canEdit).toBe(true);
  });

  it('elle part avec un effectif d essai non vide, sinon le terrain est nu', () => {
    const resolue = findStep('coach', 'coach_composition')
      .navTarget.params({ userData: { preferredSport: 'football' } });

    expect(Array.isArray(resolue.params.players)).toBe(true);
    expect(resolue.params.players.length).toBeGreaterThan(0);
  });
});

describe('C-F temoin 2 — la BULLE COMPO d un canal reste ouvrable', () => {
  beforeEach(() => mockNavigate.mockClear());

  const compositionAncienneForme = {
    eventId: 'evt-1',
    eventName: 'Match amical',
    placements: [{ playerId: 'j1', positionX: 50, positionY: 50 }],
    sport: 'football',
    teamName: 'Les Bleus',
    teamPlayers: [{ documentId: 'j1', firstname: 'Ada', lastname: 'Lovelace' }],
    type: 'lineup_share',
  };

  const ouvrirLaBulle = (composition) => {
    let arbre;
    act(() => {
      arbre = renderer.create(<BulleCompo composition={composition} />);
    });
    const pressable = findPressable(arbre.root);
    expect(pressable).not.toBeNull();
    act(() => pressable.props.onPress());
    return mockNavigate.mock.calls[0];
  };

  it('sans composition : la bulle ne rend rien, et ne plante pas', () => {
    let arbre;
    act(() => {
      arbre = renderer.create(<BulleCompo composition={null} />);
    });
    expect(arbre.toJSON()).toBeNull();
  });

  it('au toucher : elle ouvre l ANCIEN terrain, en LECTURE SEULE', () => {
    const [routeName, args] = ouvrirLaBulle(compositionAncienneForme);

    expect(routeName).toBe(RouteNames.EventStack);
    // 🔒 Deuxieme ligne qui rougira le jour de la coupe.
    expect(args.screen).toBe(RouteNames.TacticalBoardV2);
    // Une compo deja postee ne se remodifie pas depuis le canal.
    expect(args.params.readOnly).toBe(true);
    expect(args.params.canEdit).toBe(false);
  });

  it('elle emporte l evenement du message, pas celui de l ecran du moment', () => {
    const [, args] = ouvrirLaBulle(compositionAncienneForme);

    expect(args.params.eventId).toBe('evt-1');
    expect(args.params.eventName).toBe('Match amical');
  });

  // 🐛 DEFAUT MESURE LE 2026-08-16, PREEXISTANT — consigne, PAS corrige ici.
  //
  // `isMultiTeamComposition` (l. 77) vaut `Number(schemaVersion) === 3 ||
  // Array.isArray(teams)`, or `teams` est destructure avec `= []` (l. 74).
  // `Array.isArray([])` est TOUJOURS vrai ⇒ le drapeau est vrai pour TOUTE
  // composition, y compris une ancienne a `placements` plats. Consequence a
  // l'ecran : ses placements ne sont jamais recopies dans la charge, la
  // vignette du canal ne dessine AUCUN jeton, et le terrain s'ouvre VIDE.
  //
  // ⛔ Pourquoi ce lot ne le repare pas : C-F a pour seule mission de deplacer
  // des pieces sans changer un comportement. Reparer ici (`Array.isArray(teams)
  // && teams.length > 0`) modifierait ce que voit un joueur — c'est une
  // decision de lot, pas un effet de bord de demenagement.
  //
  // ⚠️ Ce test decrit donc ce qui EST, pas ce qui devrait etre. Le jour de la
  // correction, il devient rouge : c'est le signal, il se met a jour.
  it('🐛 une compo ANCIENNE forme part quand meme en multi-equipes, et arrive vide', () => {
    const [, args] = ouvrirLaBulle(compositionAncienneForme);

    expect(args.params.multiTeamComposition).toBe(true);
    expect(args.params.existingComposition.placements).toBeUndefined();
    expect(args.params.existingComposition.teams).toEqual([]);
  });

  // Preuve par DIFFERENCE, pour qu'aucune des deux moities ne puisse etre vraie
  // par accident : le MEME joueur, au MEME endroit, dessine son dossard quand la
  // compo est en forme v3, et ne dessine RIEN en ancienne forme.
  it('🐛 et sa vignette ne dessine aucun dossard, la ou la forme v3 en dessine un', () => {
    const dossards = (composition) => {
      let arbre;
      act(() => {
        arbre = renderer.create(<BulleCompo composition={composition} />);
      });
      return JSON.stringify(arbre.toJSON() || {}).includes('AL');
    };

    expect(dossards({
      ...compositionAncienneForme,
      placements: [],
      schemaVersion: 3,
      teams: [{ id: 'e1', name: 'Equipe 1', placements: compositionAncienneForme.placements }],
    })).toBe(true);

    expect(compositionAncienneForme.placements).toHaveLength(1);
    expect(dossards(compositionAncienneForme)).toBe(false);
  });

  // Le meme defaut, dit avec les mots que lit l'utilisateur : la pastille de la
  // vignette compte des EQUIPES (parce que le drapeau multi est toujours vrai),
  // et une ancienne compo n'en a aucune. Elle affiche donc « 0 equipe(s) » pour
  // une composition qui contient bel et bien un joueur.
  it('🐛 sa pastille annonce « 0 equipe(s) » pour une compo qui a un joueur', () => {
    let arbre;
    act(() => {
      arbre = renderer.create(
        <BulleCompo composition={compositionAncienneForme} />,
      );
    });

    const rendu = JSON.stringify(arbre.toJSON());
    expect(rendu).toContain('equipe(s)');
    expect(rendu).toContain('0');
    expect(rendu).not.toContain('joueur');
  });

  it('forme multi-equipes : la charge part en version 3, pas en placements plats', () => {
    const [, args] = ouvrirLaBulle({
      ...compositionAncienneForme,
      placements: [],
      schemaVersion: 3,
      teams: [{ id: 'e1', name: 'Equipe 1', placements: [] }],
    });

    expect(args.params.multiTeamComposition).toBe(true);
    expect(args.params.existingComposition.schemaVersion).toBe(3);
  });
});
