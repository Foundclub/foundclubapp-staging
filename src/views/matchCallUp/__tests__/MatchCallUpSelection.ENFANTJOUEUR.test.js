import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MatchCallUpSelection from '../MatchCallUpSelection';

// ENFANT-JOUEUR (decision d Adel du 30/10, « A ») — un enfant inscrit par son parent
// est un vrai joueur de son equipe. Constate en recette : « EFFECTIF U11 TUNNEL · 0 »
// alors que le serveur connait Lina. Harnais copie de MatchCallUpSelection.test.js.

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
// effets qui en dependent, et Jest part en boucle infinie SANS message utile
// (piege paye le 2026-08-11).
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
      // Double de `t` fidele sur les 2 mecanismes dont l'ecran depend :
      // le pluriel `_one` / `_other` et l'interpolation `{{...}}`.
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
          // 🔤 LA REGLE FRANCAISE : zero ET un prennent le singulier. Ce double
          // appliquait la regle anglaise (1 seul) — il decrivait donc un ecran
          // que l app ne montre plus depuis qu elle embarque `intl-pluralrules`
          // (2026-09-08). Un double qui ment est pire qu un double absent.
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

// PERF2 - l ecran importe desormais WithDataWrapper -> SkeletonLoader, qui
// tire MaskedView / LinearGradient / Reanimated : hors sujet dans cette
// suite. ⚠️ Cette fabrique est A FORME FIXE (pas de cle isLoading) : les
// temoins d etat de chargement vivent dans MatchCallUpSelection.PERF2.
// chargement.test.js, avec des requetes pilotables — ne pas en ecrire ici.
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

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
  return {
    __esModule: true,
    default: () => <TexteRN>RETOUR</TexteRN>,
  };
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

// AC09 — la fenetre de prevention. On garde le double le plus betement fidele
// possible : elle n'existe dans l'arbre QUE quand elle est ouverte, et son pied
// (les 2 boutons) est rendu avec elle.
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
 * La rangee (cochable) qui porte ce nom de joueur.
 * @param {any} arbre
 * @param {string} nom
 * @returns {any}
 */
const rangeeJoueur = (arbre, nom) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.accessibilityRole === 'button'
    && noeud.props?.accessibilityState?.selected !== undefined
    && aplatirTexte(noeud.props.children).includes(nom))[0];

const joueur = (id, firstname, lastname, extra = {}) => ({
  documentId: id, firstname, lastname, ...extra,
});

const EFFECTIF = [
  joueur('p1', 'Moussa', 'Diallo', { number: 1, position: 'GB' }),
  joueur('p2', 'Hugo', 'Fofana', { number: 6, position: 'DD' }),
  joueur('p3', 'Théo', 'Marchal', { number: 3, position: 'DC' }),
];

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte l'ecran.
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
  mockEvent = { team: { club: { documentId: 'club_1' }, documentId: 'team_1' } };
  mockClubTeams = {
    pages: [{
      data: [
        { documentId: 'team_1', name: 'Senior 1', players: EFFECTIF },
        {
          documentId: 'team_2',
          name: 'U19',
          players: [
            joueur('r1', 'Bilal', 'Lopez', { number: 14, position: 'MC' }),
            joueur('r2', 'Karim', 'Sylla', {
              number: 8, position: 'MD', unavailabilityReason: 'licence',
            }),
            joueur('r3', 'Enzo', 'Petit', {
              number: 9, position: 'AT', suspensionMatches: 1, unavailabilityReason: 'suspension',
            }),
          ],
        },
      ],
    }],
  };
  mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

// 🧨 On DEMONTE entre deux tests : un arbre orphelin garde ses effets vivants
// et continue de reagir aux doubles partages, ce qui a produit 16 « Maximum
// update depth exceeded » alors que les 18 tests etaient verts (piege D68).
afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
  mockAlert.mockRestore();
});

const LINA = {
  documentId: 'lina-doc',
  firstname: 'Lina',
  id: 'lina-doc',
  isManual: false,
  lastname: 'Recette',
  participantSource: 'declared_child',
};

describe('ENFANT-JOUEUR — la fiche enfant dans la liste a convoquer', () => {
  test('equipe sans compte (U11 Tunnel) : Lina vient du serveur, l effectif compte 1', async () => {
    mockEvent = { team: { club: { documentId: 'club_1' }, documentId: 'team_1', players: [] } };
    const arbre = await rendre({
      players: [],
      teamComposition: { eligiblePlayers: [LINA] },
      teamName: 'U11 Tunnel',
    });
    const texte = texteVisible(arbre);

    expect(texte).toContain('EFFECTIF U11 TUNNEL · 1');
    expect(rangeeJoueur(arbre, 'Lina')).toBeTruthy();
  });

  test('equipe mixte : les comptes passes par l ecran ET Lina, chacun une fois', async () => {
    const arbre = await rendre({
      teamComposition: { eligiblePlayers: [...EFFECTIF, LINA] },
    });
    const texte = texteVisible(arbre);

    expect(texte).toContain('EFFECTIF SENIOR 1 · 4');
    expect(rangeeJoueur(arbre, 'Moussa')).toBeTruthy();
    expect(rangeeJoueur(arbre, 'Lina')).toBeTruthy();
  });

  test('Lina porte « Répond via son parent », pas « Hors app »', async () => {
    const arbre = await rendre({
      teamComposition: { eligiblePlayers: [...EFFECTIF, LINA] },
    });
    const rangee = aplatirTexte(rangeeJoueur(arbre, 'Lina').props.children);

    expect(texteVisible(arbre)).toContain('Répond via son parent');
    expect(rangee).not.toContain('Hors app');
  });

  test('la reponse donnee par le parent colore la pastille de Lina', async () => {
    const arbre = await rendre({
      teamComposition: {
        childAnswers: { 'lina-doc': 'absent' },
        eligiblePlayers: [...EFFECTIF, LINA],
      },
    });
    const rangee = aplatirTexte(rangeeJoueur(arbre, 'Lina').props.children);

    expect(rangee).toContain('Absent');
    expect(rangee).not.toContain('Sans réponse');
  });
});
