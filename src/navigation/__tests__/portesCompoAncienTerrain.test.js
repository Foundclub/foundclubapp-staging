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

// BULLE (29/09) — la barre Present / Absent tire la couche de services (client
// HTTP). Cette suite ne l affiche jamais (matchs passes, ou lecteur absent de la
// carte) : elle est testee dans `CompositionMessageBubbleBULLE.test.js`.
jest.mock(
  '@/components/molecules/compositionMessageBubble/CompositionAnswerBar',
  () => ({ __esModule: true, default: () => null }),
);

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: (...args) => mockNavigate(...args) }),
}));

// COMPOMSG : le compte « 1 convoqué » passe par un pluriel i18next — la doublure
// rend le français de l'app au lieu du `t` « pas prêt » de react-i18next.
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

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

  // 🔄 COMPOMSG (23/09) — LA PORTE VERS L'ANCIEN TERRAIN EXISTE TOUJOURS, mais une
  // carte a plat qui porte un joueur place ouvre desormais le MEME plein ecran que
  // les autres (voir plus bas). Le fil-piege de la coupe reste pose sur le cas
  // qui y mene encore : une carte SANS evenement rattache.
  it('au toucher : sans evenement rattache, elle ouvre l ANCIEN terrain, en LECTURE SEULE', () => {
    const [routeName, args] = ouvrirLaBulle({ ...compositionAncienneForme, eventId: undefined });

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
    expect(args.params.eventLabel).toBe('Match amical');
  });

  // ✅ CORRIGE LE 2026-09-23 (COMPOMSG, point 3) — le defaut consigne ici le
  // 2026-08-16 : `isMultiTeamComposition` valait `schemaVersion === 3 ||
  // Array.isArray(teams)`, et `teams` a `[]` pour valeur par defaut ⇒ TOUJOURS
  // vrai. Une carte a plat ne lisait jamais ses placements. Le chef d'orchestre a
  // compte 7 cartes de cette forme en production (13/05 → 15/06).
  // Ces trois temoins decrivaient le defaut ; ils decrivent maintenant la correction.
  it('une compo ANCIENNE forme n est plus lue en multi-equipes : ses placements partent', () => {
    const [, args] = ouvrirLaBulle(compositionAncienneForme);

    expect(args.screen).toBe(RouteNames.MatchCompositionBoard);
    expect(args.params.existingComposition.placements).toEqual(compositionAncienneForme.placements);
    expect(args.params.startPlacements.map((placement) => placement.playerId)).toEqual(['j1']);
  });

  // Preuve par DIFFERENCE, gardee : le MEME joueur, au MEME endroit, dessine son
  // dossard en forme v3 ET en ancienne forme.
  it('et sa vignette dessine le dossard, comme la forme v3', () => {
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
    expect(dossards(compositionAncienneForme)).toBe(true);
  });

  // Dit avec les mots que lit l'utilisateur : le nom et le compte sont la.
  it('son pied de carte compte le convoque, et son nom est ecrit', () => {
    let arbre;
    act(() => {
      arbre = renderer.create(
        <BulleCompo composition={compositionAncienneForme} />,
      );
    });

    const rendu = JSON.stringify(arbre.toJSON());
    expect(rendu).not.toContain('equipe(s)');
    expect(rendu).toContain('1 convoqué');
    expect(rendu).toContain('Ada Lovelace');
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
