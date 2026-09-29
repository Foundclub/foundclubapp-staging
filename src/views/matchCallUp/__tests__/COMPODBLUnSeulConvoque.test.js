import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  buildConvocationFieldTokens,
  buildConvocationReserveList,
  buildPublishedBoardTarget,
} from '@/views/playerConvocation/playerConvocationUtils';

import MatchCallUpSelection from '../MatchCallUpSelection';
import { buildConvocationRoster } from '../matchConvocationUtils';

jest.setTimeout(30000);

// ==========================================================================
// COMPODBL — LE CONVOQUE COMPTE DEUX FOIS (recette du 28/09, tournee 3, defaut 1)
//
// 🔬 Ce que la testeuse a vu, cote ENTRAINEUR : un jeton « ? » sans nom au
// poste de gardien (fiche → Convocation, et terrain de « Modifier »), et
// « Modifier » qui annonce « 3 convoques · 3 titulaires · 0 sur le banc »
// alors que la compo compte mouri sur le terrain et le joueur hors app sur le
// banc.
//
// 🧨 La charge ci-dessous est celle que le serveur rendait (relais
// `T3-relay-partie2.log`, 22:13) : mouri par son identifiant texte ET par son
// numero `134`, et dans l'instantane un joueur SANS identifiant texte ni nom.
// Le serveur est corrige (admin, lot COMPODBL) ; ces temoins tiennent l'app
// debout face a une charge deja abimee — une bulle de tchat garde sa charge,
// et un telephone peut parler a un serveur pas encore mis a jour.
//
// 📏 La regle : une entree de compo qui n'a NI identifiant texte NI nom n'est
// pas une personne. Elle n'est ni dessinee, ni comptee, ni renvoyee au serveur.
// ⚠️ Un joueur hors app (identifiant `manual_…`) et un ancien instantane qui
// porte un NOM restent des personnes.
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
// effets qui en dependent, et Jest part en boucle infinie SANS message utile.
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
          // La regle francaise : zero ET un prennent le singulier.
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

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({ data: mockEvent, isFetching: false }),
}));

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: () => ({ data: mockClubTeams, isFetching: false }),
}));

// FINITIONS3 (29/09) — l ecran lit l abonnement (mur d avance de « Modifier ») : `useAuth`
// charge le client HTTP, absent d une copie de travail. Auth vide = niveau inconnu =
// ecran inchange ; le mur a son propre temoin (MatchCallUpSelection.murDavanceFINITIONS3).
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => ({}) }));

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

const idDe = (/** @type {any} */ personne) => String(personne?.documentId || personne?.id || '');

// --- La charge de la recette ------------------------------------------------

const DOC_MOURI = 'sma3qnjb5p4jefg4dd192190';
const HORS_APP_ID = 'manual_1790632633865';

// Le joueur tel que l'effectif de l'evenement le porte : ses DEUX identifiants.
const MOURI = {
  documentId: DOC_MOURI, firstname: 'mouri', id: 134, lastname: 'nio',
};
const PAUL = {
  documentId: 'paul-veuillet-doc-130', firstname: 'Paul', id: 130, lastname: 'Veuillet',
};
const HORS_APP = {
  documentId: HORS_APP_ID,
  firstname: 'Recette',
  id: HORS_APP_ID,
  isManual: true,
  lastname: 'HorsApp',
};

const instantane = (/** @type {any} */ personne, /** @type {string} */ assignmentKind) => ({
  assignmentKind,
  avatar: null,
  documentId: personne.documentId,
  firstname: personne.firstname,
  id: personne.documentId,
  isManual: Boolean(personne.isManual),
  lastname: personne.lastname,
});

// Exactement ce que `buildSnapshotPlayer({ id: 134 })` ecrivait : le « ? ».
const FANTOME = {
  appliedPosition: null,
  assignmentKind: 'team',
  avatar: null,
  documentId: null,
  firstname: '',
  id: '134',
  isAssigned: true,
  isManual: false,
  lastname: '',
  number: null,
  participantSource: 'team_player',
  position: null,
  teamEntryId: 'team_1',
  teamEntryName: 'COMPO-Foot-U15',
};

const PUBLIE_ABIME = {
  manualPlayers: [HORS_APP],
  reservePlayerIds: [HORS_APP_ID],
  reserveSnapshotPlayers: [instantane(HORS_APP, 'reserve')],
  schemaVersion: 3,
  selectedPlayerIds: [DOC_MOURI, HORS_APP_ID],
  snapshotPlayers: [instantane(MOURI, 'team'), instantane(HORS_APP, 'reserve'), FANTOME],
  sportContext: 'football',
  teams: [{
    id: 'team_1',
    name: 'COMPO-Foot-U15',
    placements: [
      {
        playerId: DOC_MOURI, positionX: 48, positionY: 30, slotId: null,
      },
      {
        playerId: '134', positionX: 50, positionY: 92, slotId: 'team_1:gk',
      },
    ],
  }],
  version: 1,
};

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte l'ecran « Convoques ».
 * @param {any} [parametres]
 * @returns {Promise<any>}
 */
const rendre = async (parametres = {}) => {
  mockRouteParams = {
    clubId: 'club_1',
    eventId: 'mwdw2u0gvwy63r9jayqis2do',
    players: [MOURI, PAUL],
    sport: 'football',
    teamId: 'xpzuyxb64l0mujluirrmq69l',
    teamName: 'COMPO-Foot-U15',
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
  mockEvent = {
    missings: [],
    participationRequests: [],
    // mouri a repondu PRESENT : aucune fenetre « absents » ne s'ouvre.
    participations: [MOURI],
    team: {
      club: { documentId: 'club_1' },
      documentId: 'xpzuyxb64l0mujluirrmq69l',
      players: [MOURI, PAUL],
    },
  };
  mockClubTeams = {
    pages: [{
      data: [{
        documentId: 'xpzuyxb64l0mujluirrmq69l', name: 'COMPO-Foot-U15', players: [MOURI, PAUL],
      }],
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

describe('COMPODBL — une charge abimee ne dessine aucun « ? »', () => {
  test('le terrain (fiche, bulle, « Tu es convoque ») ne dessine que mouri', () => {
    const jetons = buildConvocationFieldTokens({
      placements: PUBLIE_ABIME.teams[0].placements,
      snapshotPlayers: PUBLIE_ABIME.snapshotPlayers,
    });

    expect(jetons.map((jeton) => jeton.player.firstname)).toEqual(['mouri']);
  });

  test('« Modifier » part avec 2 convoques (terrain + banc), jamais avec le 134', () => {
    const cible = buildPublishedBoardTarget(PUBLIE_ABIME, { teamName: 'COMPO-Foot-U15' });

    expect((cible?.startPlacements || []).map((placement) => placement.playerId))
      .toEqual([DOC_MOURI]);
    expect((cible?.selectedPlayers || []).map(idDe)).toEqual([DOC_MOURI, HORS_APP_ID]);
  });

  test('« Convocation publiee » (entraineur) : 2 convoques, pas de ligne sans nom', () => {
    const lignes = buildConvocationRoster({
      published: PUBLIE_ABIME,
      responses: { byPlayerId: { 134: 'pending', [DOC_MOURI]: 'present' } },
    });

    expect(lignes.map((ligne) => ligne.playerId)).toEqual([DOC_MOURI, HORS_APP_ID]);
  });

  test('« Modifier » : 2 convoques · 1 titulaire · 1 sur le banc, une seule forme', async () => {
    const cible = buildPublishedBoardTarget(PUBLIE_ABIME, { teamName: 'COMPO-Foot-U15' });
    const arbre = await rendre(cible || {});

    const texte = texteVisible(arbre);
    expect(texte).toContain('2 convoqués');
    // FINITIONS (28/09) : ce témoin figeait « 1 titulaires » — le vrai singulier.
    expect(texte).toContain('1 titulaire · 1 sur le banc');
    expect(texte).not.toContain('3 convoqués');

    await appuyerSur(arbre, 'Suivant');
    const [, parametres] = [...mockNavigate.mock.calls].pop();
    expect((parametres.selectedPlayers || []).map(idDe)).toEqual([DOC_MOURI, HORS_APP_ID]);
    expect((parametres.startPlacements || [])
      .map((/** @type {any} */ placement) => placement.playerId))
      .toEqual([DOC_MOURI]);
  });

  test('« Preparer la convocation » depuis un brouillon abime : 2 convoques, pas 3', async () => {
    const arbre = await rendre({ existingComposition: PUBLIE_ABIME });

    const texte = texteVisible(arbre);
    expect(texte).toContain('2 convoqués');
    expect(texte).toContain('1 titulaire · 1 sur le banc');
  });
});

describe('COMPODBL 🔒 — ce qui ne bouge pas', () => {
  test('deux homonymes restent DEUX jetons, deux convoques', () => {
    const LUCAS_A = {
      documentId: 'lucas-a', firstname: 'Lucas', id: 301, lastname: 'Martin',
    };
    const LUCAS_B = {
      documentId: 'lucas-b', firstname: 'Lucas', id: 302, lastname: 'Martin',
    };
    const pack = {
      ...PUBLIE_ABIME,
      reservePlayerIds: [],
      reserveSnapshotPlayers: [],
      snapshotPlayers: [instantane(LUCAS_A, 'team'), instantane(LUCAS_B, 'team')],
      teams: [{
        ...PUBLIE_ABIME.teams[0],
        placements: [
          {
            playerId: 'lucas-a', positionX: 35, positionY: 75, slotId: null,
          },
          {
            playerId: 'lucas-b', positionX: 65, positionY: 75, slotId: null,
          },
        ],
      }],
    };

    expect((buildPublishedBoardTarget(pack)?.selectedPlayers || []).map(idDe))
      .toEqual(['lucas-a', 'lucas-b']);
  });

  test('le joueur hors app reste sur le banc, avec son nom', () => {
    expect(buildConvocationReserveList(PUBLIE_ABIME).map((entree) => entree.player.firstname))
      .toEqual(['Recette']);
  });

  test('un ancien instantane SANS identifiant texte mais AVEC un nom reste dessine', () => {
    const jetons = buildConvocationFieldTokens({
      placements: [{
        playerId: '77', positionX: 50, positionY: 50, slotId: null,
      }],
      snapshotPlayers: [{
        documentId: null, firstname: 'Ancien', id: '77', lastname: 'Format',
      }],
    });

    expect(jetons.map((jeton) => jeton.player.firstname)).toEqual(['Ancien']);
  });

  test('une compo NEUVE garde son compteur theorique : 2 coches = 2 titulaires', async () => {
    const arbre = await rendre({ selectedPlayers: [MOURI, PAUL] });

    const texte = texteVisible(arbre);
    expect(texte).toContain('2 convoqués');
    expect(texte).toContain('2 titulaires · 0 sur le banc');
  });
});

// ==========================================================================
// FINITIONS2 (recette du 29/09, tournee 4) — « Modifier » sur la VERSION 2 du
// match de test : mouri nio et Recette HorsApp publies TOUS LES DEUX sur le
// banc (serveur : `placements []`, remplacants `[mouri, HorsApp]`).
// Capture `T4-1-modifier-convoques.png` : « 2 convoqués · 2 titulaires ·
// 0 sur le banc ». Juste des qu'un joueur est sur le terrain (v3).
// ==========================================================================

const PUBLIE_TOUS_AU_BANC = {
  manualPlayers: [HORS_APP],
  reservePlayerIds: [DOC_MOURI, HORS_APP_ID],
  reserveSnapshotPlayers: [instantane(MOURI, 'reserve'), instantane(HORS_APP, 'reserve')],
  schemaVersion: 3,
  selectedPlayerIds: [DOC_MOURI, HORS_APP_ID],
  snapshotPlayers: [instantane(MOURI, 'reserve'), instantane(HORS_APP, 'reserve')],
  sportContext: 'football',
  teams: [{ id: 'team_1', name: 'COMPO-Foot-U15', placements: [] }],
  version: 2,
};

describe('FINITIONS2 1 — une compo publiee sans titulaire compte 0 titulaire', () => {
  test('« Modifier » la v2 (tout le monde au banc) : 0 titulaire · 2 sur le banc', async () => {
    // Exactement ce que « Convocation publiee » -> « Modifier » transmet.
    const arbre = await rendre({
      existingComposition: PUBLIE_TOUS_AU_BANC,
      publishedComposition: PUBLIE_TOUS_AU_BANC,
    });

    const texte = texteVisible(arbre);
    expect(texte).toContain('2 convoqués');
    expect(texte).toContain('0 titulaire · 2 sur le banc');
    expect(texte).not.toContain('2 titulaires');
  });

  test('🔒 le terrain qu on rouvre fait toujours foi : v3 (1 terrain, 1 banc)', async () => {
    const cible = buildPublishedBoardTarget(PUBLIE_ABIME, { teamName: 'COMPO-Foot-U15' });
    const arbre = await rendre(cible || {});

    expect(texteVisible(arbre)).toContain('1 titulaire · 1 sur le banc');
  });
  // La compo NEUVE (projection « 2 coches = 2 titulaires ») a deja son temoin
  // juste au-dessus, dans « COMPODBL 🔒 — ce qui ne bouge pas ».
});

/**
 * Le dernier ecran ouvert par « Suivant », et les convoques qu'il a recus.
 * @returns {{ convoques: string[], ecran: string }}
 */
const derniereDestination = () => {
  const [ecran, parametres] = [...mockNavigate.mock.calls].pop();
  return { convoques: (parametres.selectedPlayers || []).map(idDe), ecran };
};

describe('FINITIONS2 4 — convoque parti de l equipe : les 2 etapes comptent pareil', () => {
  test('mouri a quitte l effectif : « 1 convoqué », « Suivant » en emmene 1', async () => {
    // mouri a quitte COMPO-Foot-U15 : ni l effectif de l ecran, ni celui de
    // l evenement, ni les autres equipes du club ne le portent plus.
    mockEvent = { ...mockEvent, team: { ...mockEvent.team, players: [PAUL] } };
    mockClubTeams = {
      pages: [{
        data: [{
          documentId: 'xpzuyxb64l0mujluirrmq69l', name: 'COMPO-Foot-U15', players: [PAUL],
        }],
      }],
    };
    const arbre = await rendre({
      existingComposition: PUBLIE_TOUS_AU_BANC,
      players: [PAUL],
      publishedComposition: PUBLIE_TOUS_AU_BANC,
    });

    const texte = texteVisible(arbre);
    await appuyerSur(arbre, 'Suivant');
    const { convoques } = derniereDestination();

    // Le compteur annonce EXACTEMENT ceux que l etape suivante recoit.
    expect(convoques).toEqual([HORS_APP_ID]);
    expect(texte).toContain('1 convoqué');
    expect(texte).not.toContain('2 convoqués');
    expect(texte).toContain('0 titulaire · 1 sur le banc');
  });

  test('🔒 passe dans une AUTRE equipe du club : compte ET transmis', async () => {
    mockEvent = { ...mockEvent, team: { ...mockEvent.team, players: [PAUL] } };
    mockClubTeams = {
      pages: [{
        data: [
          { documentId: 'xpzuyxb64l0mujluirrmq69l', name: 'COMPO-Foot-U15', players: [PAUL] },
          { documentId: 'silence-u15', name: 'SILENCE-Test-U15', players: [MOURI] },
        ],
      }],
    };
    const arbre = await rendre({
      existingComposition: PUBLIE_TOUS_AU_BANC,
      players: [PAUL],
      publishedComposition: PUBLIE_TOUS_AU_BANC,
    });

    const texte = texteVisible(arbre);
    await appuyerSur(arbre, 'Suivant');

    expect(texte).toContain('2 convoqués');
    expect(derniereDestination().convoques).toEqual([DOC_MOURI, HORS_APP_ID]);
  });
});
