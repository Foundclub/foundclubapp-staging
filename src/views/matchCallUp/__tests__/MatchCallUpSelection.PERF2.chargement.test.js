import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MatchCallUpSelection from '../MatchCallUpSelection';

// PERF2 — L ONGLET « AUTRES EQUIPES » PENDANT le chargement : des formes,
// jamais « Aucune autre équipe dans le club ».
//
// 🧨 Le defaut : `useGetTeams` est la seule requete neuve de l ecran
// (MatchCallUpSelection.js:164-169), sans repli par parametre. Tant qu elle
// vole, `reinforcementPlayers` est vide et l onglet RENFORTS affichait le
// message d ABSENCE — un mensonge le temps d un aller-retour. Le fichier
// l avoue lui-meme (:333-334) : « un renfort disparait tant que la requete
// des equipes du club n est pas revenue ».
//
// 🎯 BORNAGE : seul cet onglet a un trou. L onglet principal prend l effectif
// dans les parametres de route (les 6 sites d appel le passent tous) — il n a
// PAS de squelette, et un temoin le verifie.
//
// ⚠️ LE PIEGE N°1 DU LOT, evite ici a la lettre : la suite historique mocke
// `useGetTeams: () => ({ data: mockClubTeams, isFetching: false })` — une
// fabrique A FORME FIXE, sans cle `isLoading`. Un temoin ecrit par-dessus
// serait VERT quoi qu on ecrive. Ici les DEUX requetes sont PILOTABLES.

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockSetParams = jest.fn();
/** @type {any} */
let mockRouteParams = {};
/** @type {any} */
let mockEventQuery;
/** @type {any} */
let mockTeamsQuery;

// 🧨 L objet `navigation` est FIGE : le recreer a chaque rendu relance les
// effets qui en dependent, et Jest part en boucle infinie sans message utile
// (piege paye le 2026-08-11 par la suite historique).
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

// ⚠️ PILOTABLES — c est tout l objet de ce temoin.
jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => mockEventQuery,
}));
jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: () => mockTeamsQuery,
}));

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: { arrowLeft: 1, chevronLeft: 1 },
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

// SkeletonLoader tire MaskedView / LinearGradient / Reanimated : hors sujet
// ici. Le mock rend les enfants et capture ses props — la preuve que le
// squelette est ENGAGE.
/** @type {any[]} */
const mockSkeletonProps = [];
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock(/** @type {any} */ props) {
    mockSkeletonProps.push(props);
    return props.children;
  },
);

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

jest.mock('@/components/molecules/bottomModal/BottomModal', () => ({
  __esModule: true,
  default: () => null,
}));

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
 * Tout le texte visible de l arbre rendu, concatene.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * Appuie sur l element le plus profond dont le texte contient ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyerSur = async (arbre, libelle) => {
  const cible = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
      && aplatirTexte(noeud.props.children).includes(libelle))
    .pop();
  await act(async () => { cible.props.onPress(); });
};

const EFFECTIF = [
  { documentId: 'p1', firstname: 'Moussa', lastname: 'Diallo' },
  { documentId: 'p2', firstname: 'Hugo', lastname: 'Fofana' },
];

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte l ecran avec l etat de la requete des equipes du club donne.
 * @param {any} equipes l etat renvoye par `useGetTeams`
 * @returns {Promise<any>} l arbre monte
 */
const rendre = async (equipes) => {
  mockRouteParams = {
    clubId: 'club_1',
    eventId: 'evt_1',
    players: EFFECTIF,
    sport: 'football',
    teamId: 'team_1',
    teamName: 'Senior 1',
  };
  mockEventQuery = {
    data: { team: { club: { documentId: 'club_1' }, documentId: 'team_1' } },
    isFetching: false,
    isLoading: false,
  };
  mockTeamsQuery = {
    data: undefined, isFetching: false, isLoading: false, ...equipes,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MatchCallUpSelection />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

afterEach(() => {
  arbresMontes.forEach((arbre) => act(() => arbre.unmount()));
  arbresMontes.length = 0;
  mockSkeletonProps.length = 0;
  jest.clearAllMocks();
});

describe('PERF2 — l onglet renforts pendant le chargement', () => {
  test('requete en vol : des formes, PAS « Aucune autre équipe »', async () => {
    const arbre = await rendre({ isLoading: true });
    await appuyerSur(arbre, 'Autres équipes');

    expect(arbre.root.findAllByProps({ testID: 'matchcallup-reinforcements-skeleton' }).length)
      .toBeGreaterThan(0);
    expect(mockSkeletonProps.length).toBeGreaterThan(0);
    // 🧨 Le mensonge d avant : le message d ABSENCE pendant que la requete vole.
    expect(texteVisible(arbre)).not.toContain('Aucune autre équipe dans le club');

    const [squelette] = arbre.root
      .findAllByProps({ testID: 'matchcallup-reinforcements-skeleton' });
    expect(squelette.findAllByType(Text).length).toBe(0);
  });

  test('reponse arrivee, club sans autre equipe : le message honnete revient', async () => {
    const arbre = await rendre({
      data: { pages: [{ data: [{ documentId: 'team_1', name: 'Senior 1', players: EFFECTIF }] }] },
    });
    await appuyerSur(arbre, 'Autres équipes');

    expect(texteVisible(arbre)).toContain('Aucune autre équipe dans le club');
    expect(arbre.root.findAllByProps({ testID: 'matchcallup-reinforcements-skeleton' }).length)
      .toBe(0);
  });

  test('reponse arrivee avec des renforts : la liste, aucun squelette', async () => {
    const arbre = await rendre({
      data: {
        pages: [{
          data: [
            { documentId: 'team_1', name: 'Senior 1', players: EFFECTIF },
            {
              documentId: 'team_2',
              name: 'U19',
              players: [{ documentId: 'p9', firstname: 'Bilal', lastname: 'Lopez' }],
            },
          ],
        }],
      },
    });
    await appuyerSur(arbre, 'Autres équipes');

    expect(texteVisible(arbre)).toContain('Bilal Lopez');
    expect(arbre.root.findAllByProps({ testID: 'matchcallup-reinforcements-skeleton' }).length)
      .toBe(0);
  });

  test('l onglet PRINCIPAL n a jamais de squelette (effectif des parametres)', async () => {
    const arbre = await rendre({ isLoading: true });

    // On reste sur l onglet par defaut (effectif). Les joueurs des parametres
    // de route sont la, et aucun squelette ne s y glisse.
    expect(texteVisible(arbre)).toContain('Moussa Diallo');
    expect(arbre.root.findAllByProps({ testID: 'matchcallup-reinforcements-skeleton' }).length)
      .toBe(0);
  });
});
