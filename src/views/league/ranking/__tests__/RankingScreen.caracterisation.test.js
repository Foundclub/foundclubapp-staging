import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getRanking } from '@/services/leagueTeam/leagueTeamService';

import RankingScreen from '../RankingScreen';

// E6 : `RankingScreen.js` n'avait AUCUN test. Ce filet fige ce que l'ecran FAIT
// aujourd'hui, avant que sa mise en page change (le haut passe dans le
// defilement, la FlatList peut devenir un ScrollView qui deroule les lignes).
//
// Il n'observe que des textes, des appuis et des appels : il ne depend ni du
// type de composant de liste, ni de la place exacte des elements dans l'arbre.
//
// LES DEUX « < » : l'ecran en a deux, le retour (barre du haut) et la division
// precedente. On les distingue de deux facons a la fois :
//   1. par leur ordre dans l'arbre : le retour est le PREMIER pressable qui porte
//      « < », la division precedente le SECOND ;
//   2. par leur effet, verifie dans chaque test : le premier appelle
//      `navigation.goBack` sans relancer `getRanking`, le second relance
//      `getRanking` sans appeler `goBack`.

/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockRoute;

// `useFocusEffect` execute son rappel via `useEffect`, et le rejoue quand le
// rappel change (comme l'ecran reste au premier plan), jamais en boucle.
jest.mock('@react-navigation/native', () => {
  const reactActuel = jest.requireActual('react');
  return {
    useFocusEffect: (/** @type {() => any} */ rappel) => {
      reactActuel.useEffect(() => rappel(), [rappel]);
    },
    useNavigation: () => mockNavigation,
    useRoute: () => mockRoute,
  };
});

jest.mock('@tanstack/react-query', () => {
  const clientRequetes = {};
  return { useQueryClient: () => clientRequetes };
});

// Traduction : ce que l'app affiche en francais (texte de fr.js, sinon le repli).
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

// Le VRAI theme, jamais un Proxy : un Proxy rend les echecs Jest illisibles.
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ sceneBottomInset: 134 }),
  useBottomDockLayout: () => ({ sceneBottomInset: 134 }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'u-1' } }),
}));

jest.mock('@/services/leagueTeam/leagueTeamQueries', () => ({
  loadLeagueTeamContextWithCache: jest.fn(() => Promise.resolve(null)),
}));

// Service double ENTIEREMENT : il importe le client HTTP.
jest.mock('@/services/leagueTeam/leagueTeamService', () => ({
  getRanking: jest.fn(),
}));

jest.mock('@/components/atoms/teamShield/TeamShield', () => function TeamShieldMock() {
  return null;
});

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title || ''),
    );
  };
});

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock(/** @type {any} */ props) {
    return props.children;
  },
);

// L'etat chargement / erreur : son titre, sa description, et son bouton d'action.
jest.mock('@/views/league/components/LeagueStateView', () => {
  const reactActuel = jest.requireActual('react');
  const {
    Text: TexteRN,
    TouchableOpacity: PressableRN,
    View: VueRN,
  } = jest.requireActual('react-native');
  return function LeagueStateViewMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      VueRN,
      null,
      reactActuel.createElement(TexteRN, null, props.title),
      reactActuel.createElement(TexteRN, null, props.description),
      props.actionLabel
        ? reactActuel.createElement(
          PressableRN,
          { onPress: props.onAction },
          reactActuel.createElement(TexteRN, null, props.actionLabel),
        )
        : null,
    );
  };
});

const EQUIPES = [
  {
    division_points: 42,
    documentId: 'eq-a',
    draws: 1,
    highest_streak: 4,
    losses: 2,
    name: 'Les Aigles',
    streak: 2,
    wins: 3,
  },
  {
    division_points: 7,
    documentId: 'eq-b',
    draws: 2,
    highest_streak: 1,
    losses: 5,
    name: 'Les Bisons',
    streak: -1,
    wins: 0,
  },
  {
    divisionPoints: 15,
    documentId: 'eq-c',
    draws: 0,
    highestStreak: 6,
    losses: 0,
    name: 'Les Cobras',
    streak: 0,
    wins: 9,
  },
];

// Ce que chaque ligne doit montrer : rang, nom, « V - N - D », serie, points.
const LIGNES_ATTENDUES = [
  {
    nom: 'Les Aigles', points: '42', rang: '1', serie: 'Série x2 | Best x4', vnd: '3V -1N -2D',
  },
  {
    nom: 'Les Bisons', points: '7', rang: '2', serie: 'Série Défaite | Best x1', vnd: '0V -2N -5D',
  },
  {
    nom: 'Les Cobras', points: '15', rang: '3', serie: 'Série Stable | Best x6', vnd: '9V -0N -0D',
  },
];

/**
 * Aplatit les enfants d'un noeud en une chaine.
 * @param {any} enfants - Les enfants du noeud.
 * @returns {string} Le texte aplati.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Les textes visibles sous un noeud, un par composant Text.
 * @param {any} noeud - Le noeud observe.
 * @returns {string[]} Les textes, dans l'ordre de l'arbre.
 */
const textesDe = (noeud) => noeud
  .findAllByType(Text)
  .map((/** @type {any} */ texte) => aplatirTexte(texte.props.children));

/**
 * Texte visible sous un noeud, en une chaine.
 * @param {any} noeud - Le noeud observe.
 * @returns {string} Le texte visible.
 */
const texteDe = (noeud) => textesDe(noeud).join(' ');

/**
 * Les pressables les plus profonds dont le texte est exactement ce libelle.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} libelle - Le libelle visible.
 * @returns {any[]} Les noeuds, dans l'ordre de l'arbre.
 */
const pressablesAvecLibelle = (arbre, libelle) => {
  const tous = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function')
    .filter((/** @type {any} */ noeud) => textesDe(noeud).join('').trim() === libelle);
  // Un composant et son hote portent le meme onPress : on garde le plus profond.
  return tous.filter((/** @type {any} */ noeud) => !tous.some(
    (/** @type {any} */ autre) => autre !== noeud
      && noeud.findAll((/** @type {any} */ n) => n === autre).length > 0,
  ));
};

/**
 * Le plus grand sous-arbre qui contient ce nom d'equipe et aucun autre : la ligne.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} nom - Le nom de l'equipe.
 * @returns {any} Le noeud de la ligne, ou undefined.
 */
const ligneDe = (arbre, nom) => {
  const autres = EQUIPES.map((equipe) => equipe.name).filter((n) => n !== nom);
  const candidats = arbre.root.findAll((/** @type {any} */ noeud) => {
    if (typeof noeud.type === 'string') return false;
    const textes = textesDe(noeud);
    return textes.includes(nom) && !autres.some((autre) => textes.includes(autre));
  });
  return candidats.sort((a, b) => textesDe(b).length - textesDe(a).length)[0];
};

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte l'ecran et laisse les promesses se resoudre.
 * @returns {Promise<any>} L'arbre monte.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<RankingScreen />);
  });
  await act(async () => {});
  arbresMontes.push(arbre);
  return arbre;
};

/**
 * Appuie sur un pressable et laisse les promesses se resoudre.
 * @param {any} noeud - Le pressable.
 * @returns {Promise<void>}
 */
const appuyer = async (noeud) => {
  await act(async () => {
    noeud.props.onPress();
  });
  await act(async () => {});
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigation = { goBack: jest.fn(), navigate: jest.fn() };
  mockRoute = { params: { division: 3 } };
  /** @type {any} */ (getRanking).mockResolvedValue(EQUIPES);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
  jest.restoreAllMocks();
});

describe('RankingScreen — etats chargement et erreur', () => {
  it('pendant le chargement, montre « Chargement du classement »', async () => {
    /** @type {any} */ (getRanking).mockReturnValue(new Promise(() => {}));

    const arbre = await monter();

    expect(textesDe(arbre.root)).toContain('Chargement du classement');
    expect(textesDe(arbre.root)).not.toContain('CLASSEMENT');
    expect(getRanking).toHaveBeenCalledWith(3);
  });

  it('en echec, montre « Classement indisponible » ; « Réessayer » relance', async () => {
    /** @type {any} */ (getRanking).mockRejectedValue(new Error('panne'));

    const arbre = await monter();

    expect(textesDe(arbre.root)).toContain('Classement indisponible');
    expect(textesDe(arbre.root)).toContain(
      'Impossible de charger le classement League pour cette division.',
    );
    const appelsAvant = /** @type {any} */ (getRanking).mock.calls.length;

    /** @type {any} */ (getRanking).mockResolvedValue(EQUIPES);
    await appuyer(pressablesAvecLibelle(arbre, 'Réessayer')[0]);

    expect(/** @type {any} */ (getRanking).mock.calls.length).toBeGreaterThan(appelsAvant);
    expect(getRanking).toHaveBeenLastCalledWith(3);
    expect(textesDe(arbre.root)).toContain('Les Aigles');
  });
});

describe('RankingScreen — une fois charge', () => {
  it('montre le titre, la division et les en-tetes de colonnes', async () => {
    const textes = textesDe((await monter()).root);

    expect(textes).toContain('CLASSEMENT');
    expect(textes).toContain('DIVISION 3');
    expect(textes).toContain('#');
    expect(textes).toContain('Équipe');
    expect(textes).toContain('PTS');
  });

  it.each(LIGNES_ATTENDUES)('ligne $nom : rang, nom, V-N-D, serie, points', async (attendu) => {
    const ligne = ligneDe(await monter(), attendu.nom);
    const textes = textesDe(ligne);

    expect(textes).toContain(attendu.rang);
    expect(textes).toContain(attendu.nom);
    expect(textes).toContain(attendu.vnd);
    expect(textes).toContain(attendu.serie);
    expect(textes).toContain(attendu.points);
    expect(textes).toContain('PTS');
  });

  it('les lignes suivent l ordre renvoye par getRanking', async () => {
    const textes = textesDe((await monter()).root);
    const positions = EQUIPES.map((equipe) => textes.indexOf(equipe.name));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('ordre inverse : le rang 1 va a la premiere equipe renvoyee', async () => {
    /** @type {any} */ (getRanking).mockResolvedValue([...EQUIPES].reverse());

    const arbre = await monter();

    expect(textesDe(ligneDe(arbre, 'Les Cobras'))).toContain('1');
    expect(textesDe(ligneDe(arbre, 'Les Aigles'))).toContain('3');
  });

  it('liste vide : « Aucune équipe sur cette division. » et l invitation a changer', async () => {
    /** @type {any} */ (getRanking).mockResolvedValue([]);

    const textes = textesDe((await monter()).root);

    expect(textes).toContain('Aucune équipe sur cette division.');
    expect(textes).toContain('Change de division ou relance plus tard.');
  });
});

describe('RankingScreen — fleches de division et retour', () => {
  it('« > » passe a la division suivante et relance getRanking avec elle', async () => {
    const arbre = await monter();
    /** @type {any} */ (getRanking).mockClear();

    await appuyer(pressablesAvecLibelle(arbre, '>')[0]);

    expect(getRanking).toHaveBeenCalledWith(4);
    expect(textesDe(arbre.root)).toContain('DIVISION 4');
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });

  it('le SECOND « < » passe a la division precedente et relance getRanking avec elle', async () => {
    const arbre = await monter();
    /** @type {any} */ (getRanking).mockClear();
    const chevrons = pressablesAvecLibelle(arbre, '<');

    expect(chevrons).toHaveLength(2);
    await appuyer(chevrons[1]);

    expect(getRanking).toHaveBeenCalledWith(2);
    expect(textesDe(arbre.root)).toContain('DIVISION 2');
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });

  it('borne 5 : « > » en division 5 ne change rien et n appelle pas getRanking', async () => {
    mockRoute = { params: { division: 5 } };
    const arbre = await monter();
    /** @type {any} */ (getRanking).mockClear();

    await appuyer(pressablesAvecLibelle(arbre, '>')[0]);

    expect(getRanking).not.toHaveBeenCalled();
    expect(textesDe(arbre.root)).toContain('DIVISION 5');
  });

  it('borne 1 : le second « < » en division 1 ne change rien, pas d appel', async () => {
    mockRoute = { params: { division: 1 } };
    const arbre = await monter();
    /** @type {any} */ (getRanking).mockClear();

    await appuyer(pressablesAvecLibelle(arbre, '<')[1]);

    expect(getRanking).not.toHaveBeenCalled();
    expect(textesDe(arbre.root)).toContain('DIVISION 1');
  });

  it('le PREMIER « < » (retour du haut) appelle navigation.goBack sans recharger', async () => {
    const arbre = await monter();
    /** @type {any} */ (getRanking).mockClear();

    await appuyer(pressablesAvecLibelle(arbre, '<')[0]);

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(getRanking).not.toHaveBeenCalled();
    expect(textesDe(arbre.root)).toContain('DIVISION 3');
  });
});

describe('RankingScreen — marge de fin de liste', () => {
  it('vaut max(sceneBottomInset, 12) = 134 quelque part dans l arbre rendu', async () => {
    const arbre = await monter();
    const styles = arbre.root
      .findAll(() => true)
      .flatMap((/** @type {any} */ noeud) => Object.keys(noeud.props || {})
        .filter((cle) => /style$/i.test(cle))
        .map((cle) => StyleSheet.flatten(noeud.props[cle])))
      .filter(Boolean);

    expect(styles.some((/** @type {any} */ style) => style.paddingBottom === 134)).toBe(true);
    // Le controle a du sens : l'ecran rendu montre bien la liste.
    expect(texteDe(arbre.root)).toContain('Les Aigles');
  });
});
