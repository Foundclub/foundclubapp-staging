import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MatchCallUpSelection from '../MatchCallUpSelection';

jest.setTimeout(30000);

// ==========================================================================
// COMPOMODIF · M4 — AJOUTER UN JOUEUR NE DOIT JAMAIS EN RETIRER UN AUTRE.
//
// 🗣️ Adel, 27/08 : « quand on ajoute des joueurs de la liste, ca efface de la
// liste les anciens, dans le menu pour selectionner les convoques ».
//
// 🎯 LE TEMOIN QUI TRANCHE : partir de 3 convoques, en ajouter 1, en retrouver
// 4 — jamais 1, jamais 2.
//
// 🧨 LE MECANISME MESURE : l'amorce de la selection ne lit QUE
// `params.existingComposition` — le pack PUBLIE, qui ne bouge plus. Or la porte
// « Modifier » du plateau (COMPOLECT-2) renvoie le coach ici avec ce meme pack
// FIGE a chaque tour. Au 2e tour, l'ecran remonte a neuf : il repart du pack
// publie et JETTE ce que le coach venait d'ajouter au tour precedent.
// La verite du moment, elle, voyage bien — dans `params.selectedPlayers`, que
// l'ecran 5 renvoie a chaque aller-retour — mais personne ne la lisait.
//
// ⚠️ ET LES JOUEURS HORS APP SE PERDENT EN PREMIER : ils n'existent dans aucun
// effectif, seulement dans `manualPlayers` du pack et dans la liste des
// convoques. Un pack sans eux les efface sans un mot.
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
          valeur = lire(`${cle}${compte === 1 ? '_one' : '_other'}`);
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
 * La rangee cochable qui porte ce nom de joueur.
 * @param {any} arbre
 * @param {string} nom
 * @returns {any}
 */
const rangeeJoueur = (arbre, nom) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.accessibilityRole === 'button'
    && noeud.props?.accessibilityState?.selected !== undefined
    && aplatirTexte(noeud.props.children).includes(nom))[0];

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
  joueur('p4', 'Yanis', 'Bouchard', { number: 7, position: 'MC' }),
];

// Le joueur hors app : il n'appartient a AUCUN effectif. Il n'existe que dans le
// pack et dans la liste des convoques — c'est pour ca qu'il se perd en premier.
const HORS_APP = joueur('m1', 'Sacha', 'Invite', { isManual: true });

// La compo PUBLIEE : 2 titulaires places, 1 remplacant. 3 convoques en tout.
const PACK_PUBLIE = {
  manualPlayers: [],
  reservePlayerIds: ['p3'],
  schemaVersion: 3,
  selectedPlayerIds: ['p1', 'p2', 'p3'],
  sportContext: 'football',
  teams: [{
    id: 'team_1',
    name: 'Senior 1',
    placements: [
      {
        playerId: 'p1', positionX: 50, positionY: 90, slotId: 'team_1:slot_1',
      },
      {
        playerId: 'p2', positionX: 30, positionY: 60, slotId: 'team_1:slot_2',
      },
    ],
  }],
};

const CONVOQUES_PUBLIES = [EFFECTIF[0], EFFECTIF[1], EFFECTIF[2]];

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte l'ecran de selection.
 * @param {any} [parametres]
 * @returns {Promise<any>}
 */
const rendre = async (parametres = {}) => {
  mockRouteParams = {
    clubId: 'club_1',
    eventId: 'evt_1',
    players: EFFECTIF,
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
    pages: [{ data: [{ documentId: 'team_1', name: 'Senior 1', players: EFFECTIF }] }],
  };
  mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
  mockAlert.mockRestore();
});

describe('COMPOMODIF · M4 — ajouter un convoque n en retire aucun', () => {
  // 🥇 LE TEMOIN D'ADEL, MOT POUR MOT : 3 convoques, on en ajoute 1, on en
  // retrouve 4.
  test('1er tour : les 3 deja convoques sont coches, le 4e s ajoute a eux', async () => {
    const arbre = await rendre({ existingComposition: PACK_PUBLIE });

    await act(async () => {
      rangeeJoueur(arbre, 'Bouchard').props.onPress();
    });
    await appuyerSur(arbre, 'Suivant');

    expect(convoquesEnvoyes().sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  // 🧨 LE VRAI DEFAUT, celui qu'Adel voit : le 2e tour. La porte « Modifier » du
  // plateau renvoie ici le MEME pack publie, fige. Sans lire la selection du
  // moment, l'ecran repart de la compo d'origine et efface le joueur ajoute au
  // tour precedent.
  test('🧨 2e tour : le joueur ajoute au tour d avant est TOUJOURS la', async () => {
    const arbre = await rendre({
      // Le pack publie n'a pas bouge — c'est exactement ce que la porte renvoie.
      existingComposition: PACK_PUBLIE,
      // Ce que l'ecran 5 vient de renvoyer : la selection du moment, 4 personnes.
      selectedPlayers: [...CONVOQUES_PUBLIES, EFFECTIF[3]],
    });

    await appuyerSur(arbre, 'Suivant');

    expect(convoquesEnvoyes().sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  test('🧨 2e tour : un convoque DECOCHE au tour d avant ne revient pas tout seul', async () => {
    const arbre = await rendre({
      existingComposition: PACK_PUBLIE,
      selectedPlayers: [EFFECTIF[0], EFFECTIF[1]],
    });

    await appuyerSur(arbre, 'Suivant');

    expect(convoquesEnvoyes().sort()).toEqual(['p1', 'p2']);
  });

  // ⚠️ Les joueurs hors app se perdent en premier : aucun effectif ne les porte.
  test('🧨 le joueur HORS APP convoque au tour d avant survit au tour suivant', async () => {
    const arbre = await rendre({
      existingComposition: PACK_PUBLIE,
      selectedPlayers: [...CONVOQUES_PUBLIES, HORS_APP],
    });

    // Il ne vit que dans l'onglet « Hors app » : c'est la qu'on va le chercher.
    await appuyerSur(arbre, 'Hors app');
    expect(texteVisible(arbre)).toContain('Sacha');

    await appuyerSur(arbre, 'Suivant');

    expect(convoquesEnvoyes().sort()).toEqual(['m1', 'p1', 'p2', 'p3']);
  });

  test('le joueur HORS APP du pack publie reste convoque au 1er tour', async () => {
    const arbre = await rendre({
      existingComposition: {
        ...PACK_PUBLIE,
        manualPlayers: [HORS_APP],
        reservePlayerIds: ['p3', 'm1'],
        selectedPlayerIds: ['p1', 'p2', 'p3', 'm1'],
      },
    });

    await appuyerSur(arbre, 'Suivant');

    expect(convoquesEnvoyes().sort()).toEqual(['m1', 'p1', 'p2', 'p3']);
  });

  // 🔒 NON-REGRESSION — une compo NEUVE ne pre-coche toujours personne.
  test('🔒 sans compo existante, aucune case n est cochee d office', async () => {
    const arbre = await rendre();

    expect(texteVisible(arbre)).toContain('Convoqu');
    expect(rangeeJoueur(arbre, 'Diallo').props.accessibilityState.selected).toBe(false);
  });
});

describe('COMPOMODIF · M2 — modifier n est pas repartir de zero', () => {
  // 🔒 Ce que « modifier » doit conserver quand le coach revient sur sa liste :
  // le terrain deja pose voyage avec lui, l'ecran 4 « Partir de... » ne
  // reprend pas la main et n'ecrase pas les jetons.
  test('🔒 modifier rouvre le TERRAIN, jamais l ecran « Partir de... »', async () => {
    const arbre = await rendre({
      existingComposition: PACK_PUBLIE,
      selectedPlayers: CONVOQUES_PUBLIES,
    });

    await appuyerSur(arbre, 'Suivant');

    const appel = [...mockNavigate.mock.calls].pop();
    expect(appel?.[0]).toBe('MatchCompositionBoard');
    expect((appel?.[1]?.startPlacements || []).map((/** @type {any} */ p) => p.playerId))
      .toEqual(['p1', 'p2']);
  });
});
