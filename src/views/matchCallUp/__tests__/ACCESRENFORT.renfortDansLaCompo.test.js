import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MatchCallUpSelection from '../MatchCallUpSelection';
import { buildFieldFromServerComposition } from '../matchCompositionUtils';

jest.setTimeout(30000);

// ==========================================================================
// ACCES-RENFORT (29/09) — LE RENFORT RESTE UN RENFORT, A LA REOUVERTURE.
//
// Le renfort : un joueur d'une AUTRE equipe du club, convoque dans la compo
// (lot COMPO-RENFORTS). Deux ecrans le perdaient de vue :
//
//   6b · TELEPHONE ET SITE — rouvrir une compo PUBLIEE passe son instantane
//        (`snapshotPlayers`) comme effectif (`EventDetails`,
//        `handleManageComposition`) : le renfort s'affichait sous « Mon
//        equipe », et l'onglet « Autres equipes » ne le montrait plus.
//        L'instantane le DIT pourtant : `participantSource: 'club_reinforcement'`.
//   6c · SITE — recharger la page du terrain sur un BROUILLON qui a un renfort
//        au terrain : le brouillon n'a pas d'instantane, l'effectif ne porte
//        pas le renfort ⇒ `missingPlayerIds`, publication bloquee. Le serveur
//        rend desormais les renforts a part (`reinforcementPlayers`).
// ==========================================================================

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockSetParams = jest.fn();
/** @type {any} */
let mockRouteParams = {};
/** @type {any} */
let mockEvent;
/** @type {any} */
let mockClubTeams;
/** @type {any} */
let mockAlert;

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

// 🧨 L'objet `navigation` est FIGE : le recreer a chaque rendu relance les
// effets qui en dependent (meme precaution que `CompoModifSelection.test.js`).
const mockNavigation = {
  goBack: mockGoBack,
  navigate: mockNavigate,
  setParams: mockSetParams,
};

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

// FINITIONS3 (29/09) — l ecran lit l abonnement (mur d avance de « Modifier ») : `useAuth`
// est double ici comme dans les 6 autres temoins qui montent la selection (recolte du 29/09 soir).
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => ({}) }));

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({ data: mockEvent, isFetching: false }),
}));

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: () => ({ data: mockClubTeams, isFetching: false }),
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

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, footerComponent, isVisible }) => (
      isVisible ? (
        <VueRN>
          {children}
          {footerComponent}
        </VueRN>
      ) : null
    ),
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
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * Appuie sur l'element le plus profond dont le texte contient ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyerSur = async (arbre, libelle) => {
  const cible = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
      && aplatirTexte(noeud.props.children).includes(libelle))
    .pop();
  if (!cible) throw new Error(`Aucun bouton « ${libelle} ». Vu : ${texteVisible(arbre)}`);
  await act(async () => { cible.props.onPress(); });
};

/**
 * Les rangees cochables qui portent ce nom de joueur, dans l'onglet affiche.
 * @param {any} arbre
 * @param {string} nom
 * @returns {any[]}
 */
const rangeesJoueur = (arbre, nom) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.accessibilityRole === 'button'
    && noeud.props?.accessibilityState?.selected !== undefined
    && aplatirTexte(noeud.props.children).includes(nom));

/**
 * Les identifiants des convoques que l'ecran envoie a la suite du parcours.
 * @returns {string[]}
 */
const convoquesEnvoyes = () => {
  const appel = [...mockNavigate.mock.calls].pop();
  return ((appel?.[1]?.selectedPlayers) || [])
    .map((/** @type {any} */ personne) => String(personne?.documentId || personne?.id || ''));
};

const joueur = (id, firstname, lastname, extra = {}) => ({
  documentId: id, firstname, lastname, ...extra,
});

const EFFECTIF = [
  joueur('p1', 'Moussa', 'Diallo', { number: 1, position: 'GB' }),
  joueur('p2', 'Hugo', 'Fofana', { number: 6, position: 'DD' }),
  joueur('p3', 'Theo', 'Marchal', { number: 3, position: 'DC' }),
];
// Joueur de l'equipe B du MEME club — le renfort.
const RENFORT = joueur('r1', 'Rayan', 'Renfort', { position: 'MC' });

/**
 * Une ligne d instantane, comme `buildSnapshotPlayer` (serveur) l ecrit.
 * @param {any} personne
 * @param {string} assignmentKind
 * @param {string} [participantSource]
 * @returns {any}
 */
const instantane = (personne, assignmentKind, participantSource = 'team_player') => ({
  ...personne,
  assignmentKind,
  id: personne.documentId,
  isAssigned: assignmentKind !== 'unassigned',
  participantSource,
});

// La compo PUBLIEE, telle que le serveur la rend : son instantane porte TOUT
// l annuaire de la branche (effectif, puis renforts), chacun etiquete — et le
// renfort y est dit renfort.
const PACK_PUBLIE = {
  manualPlayers: [],
  reservePlayerIds: ['p2'],
  schemaVersion: 3,
  selectedPlayerIds: ['p1', 'r1', 'p2'],
  snapshotPlayers: [
    instantane(EFFECTIF[0], 'team'),
    instantane(EFFECTIF[1], 'reserve'),
    instantane(EFFECTIF[2], 'unassigned'),
    instantane(RENFORT, 'team', 'club_reinforcement'),
  ],
  sportContext: 'football',
  teams: [{
    id: 'team_1',
    name: 'Senior 1',
    placements: [
      {
        playerId: 'p1', positionX: 50, positionY: 90, slotId: 'team_1:slot_1',
      },
      {
        playerId: 'r1', positionX: 30, positionY: 60, slotId: 'team_1:slot_2',
      },
    ],
  }],
};

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte l'ecran de selection comme « Gerer la composition » le fait sur une
 * compo publiee : l'instantane passe comme effectif (`players`).
 * @param {any} [parametres]
 * @returns {Promise<any>}
 */
const rendre = async (parametres = {}) => {
  mockRouteParams = {
    clubId: 'club_1',
    eventId: 'evt_1',
    existingComposition: PACK_PUBLIE,
    players: PACK_PUBLIE.snapshotPlayers,
    sport: 'football',
    teamId: 'team_1',
    teamName: 'Senior 1',
    ...parametres,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MatchCallUpSelection />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockSetParams.mockClear();
  mockEvent = { team: { club: { documentId: 'club_1' }, documentId: 'team_1', players: EFFECTIF } };
  mockClubTeams = {
    pages: [{
      data: [
        { documentId: 'team_1', name: 'Senior 1', players: EFFECTIF },
        { documentId: 'team_2', name: 'Senior 2', players: [RENFORT] },
      ],
    }],
  };
  mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
  mockAlert.mockRestore();
});

describe('ACCES-RENFORT 6b — compo publiee rouverte : le renfort sous « Autres equipes »', () => {
  test('« Mon equipe » ne le montre pas', async () => {
    const arbre = await rendre();

    expect(rangeesJoueur(arbre, 'Diallo').length).toBeGreaterThan(0);
    expect(rangeesJoueur(arbre, 'Marchal').length).toBeGreaterThan(0);
    expect(rangeesJoueur(arbre, 'Renfort')).toHaveLength(0);
  });

  test('« Autres equipes » le montre, COCHE, avec son equipe', async () => {
    const arbre = await rendre();

    await appuyerSur(arbre, 'Autres équipes');

    const [rangee] = rangeesJoueur(arbre, 'Renfort');
    expect(rangee).toBeDefined();
    expect(rangee.props.accessibilityState.selected).toBe(true);
    expect(texteVisible(arbre)).toContain('Senior 2');
  });

  test('🔒 il reste convoque : « Suivant » l emmene, et personne d autre ne change', async () => {
    const arbre = await rendre();

    await appuyerSur(arbre, 'Suivant');

    expect(convoquesEnvoyes().sort()).toEqual(['p1', 'p2', 'r1']);
  });

  test('🔒 un joueur de l equipe garde sa place dans « Mon equipe »', async () => {
    const arbre = await rendre();

    const [rangee] = rangeesJoueur(arbre, 'Diallo');
    expect(rangee.props.accessibilityState.selected).toBe(true);
  });
});

describe('ACCES-RENFORT 6c — le site relit un BROUILLON avec un renfort au terrain', () => {
  const brouillon = {
    reservePlayerIds: ['p2'],
    schemaVersion: 3,
    selectedPlayerIds: ['p1', 'r1', 'p2'],
    teams: [{ placements: [{ playerId: 'p1' }, { playerId: 'r1' }] }],
  };
  const reponseServeur = {
    draft: brouillon,
    // L'effectif : « Mon equipe ». Le renfort n'y est pas, et ne doit pas y etre.
    eligiblePlayers: EFFECTIF
      .map((personne) => ({ ...personne, participantSource: 'team_player' })),
    reinforcementPlayers: [{ ...RENFORT, participantSource: 'club_reinforcement' }],
  };

  test('le renfort est NOMME : pas de convoque introuvable, la publication reste possible', () => {
    const terrain = buildFieldFromServerComposition(reponseServeur);

    expect(terrain.missingPlayerIds).toEqual([]);
    expect(terrain.selectedPlayers.map((personne) => personne.documentId))
      .toEqual(['p1', 'r1', 'p2']);
    expect(terrain.selectedPlayers[1].participantSource).toBe('club_reinforcement');
    expect(terrain.startPlacements.map((placement) => placement.playerId)).toEqual(['p1', 'r1']);
  });

  test('🔒 un convoque que la charge ne nomme VRAIMENT pas reste introuvable (echec sur)', () => {
    const terrain = buildFieldFromServerComposition({
      ...reponseServeur,
      reinforcementPlayers: [],
    });

    expect(terrain.missingPlayerIds).toEqual(['r1']);
  });
});
