import { Switch, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MatchCompositionStart from '../MatchCompositionStart';

// D79 — ECRAN 4 du pack composition : « Partir de… ».
//
// Les 3 regles que ce fichier tient, parce que les rater se voit a l'ecran :
//   1. Une option sans source est GRISEE, avec sa raison ecrite — jamais
//      choisissable a vide.
//   2. « Aimanter aux postes » est ETEINT sur terrain vide, ALLUME sur une
//      formation. C'est le temoin d'arret n°3 du lot.
//   3. « Ouvrir le terrain » emmene les placements choisis a l'ecran 5.

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
/** @type {any} */
let mockRouteParams = {};
/** @type {any} */
let mockDefaultComposition;

// 🧨 L'objet `navigation` est FIGE : le recreer a chaque rendu relance les
// effets qui en dependent et Jest part en boucle infinie, sans message utile.
const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate };

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

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeamDefaultComposition: () => ({ data: mockDefaultComposition, isFetching: false }),
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

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
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
  await act(async () => { cible.props.onPress(); });
};

/**
 * La rangee radio qui porte ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any}
 */
const rangee = (arbre, libelle) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.accessibilityRole === 'radio'
    && aplatirTexte(noeud.props.children).includes(libelle))[0];

const joueur = (id, firstname, lastname) => ({ documentId: id, firstname, lastname });
const ONZE = Array.from({ length: 11 }, (_, i) => joueur(`p${i}`, `Prenom${i}`, `Nom${i}`));

const COMPO_TYPE = {
  composition: {
    placements: ONZE.slice(0, 11).map((player, index) => ({
      playerId: player.documentId, positionX: 50, positionY: 10 + index,
    })),
  },
};

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte l'ecran.
 * @param {any} [parametres]
 * @returns {Promise<any>}
 */
const rendre = async (parametres = {}) => {
  mockRouteParams = {
    eventId: 'evt_1',
    selectedPlayers: ONZE,
    sport: 'football',
    teamId: 'team_1',
    teamName: 'Senior 1',
    ...parametres,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MatchCompositionStart />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockDefaultComposition = undefined;
});

// 🧨 On DEMONTE entre deux tests : un arbre orphelin garde ses effets vivants et
// fait sortir jest en 1 alors que tous les tests sont verts (piege D68).
afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('D79 ecran 4 — l ecran et ses 3 rangees', () => {
  test('en-tete, progression 2/2, les 3 rangees et le CTA sont la', async () => {
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('Partir de…');
    expect(texte).toContain('Match · Senior 1 · 11 convoqués');
    expect(texte).toContain('2/2');
    expect(texte).toContain('Terrain vide');
    expect(texte).toContain('Compo type');
    expect(texte).toContain('Dernier match');
    expect(texte).toContain('APERÇU');
    expect(texte).toContain('Ouvrir le terrain');
  });

  test('sans compo type ni dernier match, les 2 rangees sont GRISEES avec leur raison', async () => {
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('Cette équipe n’a pas encore de compo type.');
    expect(texte).toContain('Aucune compo déjà publiée à reprendre.');
    expect(rangee(arbre, 'Compo type').props.accessibilityState.disabled).toBe(true);
    expect(rangee(arbre, 'Dernier match').props.accessibilityState.disabled).toBe(true);
    // Terrain vide n'a besoin d'aucune donnee : il reste choisissable, toujours.
    expect(rangee(arbre, 'Terrain vide').props.accessibilityState.disabled).toBe(false);
  });

  test('avec une compo type, sa rangee est active et cochee par defaut', async () => {
    mockDefaultComposition = COMPO_TYPE;
    const arbre = await rendre();

    expect(rangee(arbre, 'Compo type').props.accessibilityState.disabled).toBe(false);
    expect(rangee(arbre, 'Compo type').props.accessibilityState.selected).toBe(true);
    expect(texteVisible(arbre)).toContain('Le modèle par défaut de Senior 1.');
  });

  test('« Dernier match » ne s active que si le serveur a rendu CETTE source', async () => {
    const arbre = await rendre({
      teamComposition: {
        bootstrap: {
          composition: { teams: [{ placements: [{ playerId: 'p0', positionX: 50, positionY: 90 }] }] },
          source: 'last_match',
        },
      },
    });

    expect(rangee(arbre, 'Dernier match').props.accessibilityState.disabled).toBe(false);
  });

  // Le pack ecrit « Compo type · 4-3-3 » : le schema est une DONNEE du pack
  // enregistre, pas un decor. Sans lui, la rangee garde son libelle general.
  test('le schema de la compo type s affiche quand le pack le porte', async () => {
    mockDefaultComposition = {
      composition: {
        teams: [{
          placements: [{ playerId: 'p0', positionX: 50, positionY: 90 }],
          presetLabel: '4-3-3',
        }],
      },
    };
    const arbre = await rendre();

    expect(texteVisible(arbre)).toContain('Compo type · 4-3-3');
  });

  test('sans schema enregistre, la rangee ne fabrique pas un « · » vide', async () => {
    mockDefaultComposition = COMPO_TYPE;
    const arbre = await rendre();

    expect(texteVisible(arbre)).toContain('Compo type');
    expect(texteVisible(arbre)).not.toContain('Compo type · ');
  });

  test('« Dernier match » porte la DATE du match repris quand le serveur la joint', async () => {
    const arbre = await rendre({
      teamComposition: {
        bootstrap: {
          composition: { teams: [{ placements: [{ playerId: 'p0', positionX: 50, positionY: 90 }] }] },
          event: { date: '2026-08-08T15:00:00.000Z' },
          source: 'last_match',
        },
      },
    });

    expect(texteVisible(arbre)).toContain('La compo de samedi 8 août, telle quelle.');
  });
});

describe('D79 ecran 4 — l aimantation suit le point de depart', () => {
  test('terrain vide : l interrupteur est ETEINT et desactive', async () => {
    const arbre = await rendre();
    const interrupteur = arbre.root.findAllByType(Switch)[0];

    expect(interrupteur.props.value).toBe(false);
    expect(interrupteur.props.disabled).toBe(true);
    expect(texteVisible(arbre)).toContain('Disponible quand tu pars d’une formation.');
  });

  test('formation : l interrupteur est ALLUME et manipulable', async () => {
    mockDefaultComposition = COMPO_TYPE;
    const arbre = await rendre();
    const interrupteur = arbre.root.findAllByType(Switch)[0];

    expect(interrupteur.props.value).toBe(true);
    expect(interrupteur.props.disabled).toBe(false);
    expect(texteVisible(arbre)).toContain('Le jeton colle au poste le plus proche.');
  });

  test('le coach peut l eteindre a la main sur une formation', async () => {
    mockDefaultComposition = COMPO_TYPE;
    const arbre = await rendre();
    await act(async () => {
      arbre.root.findAllByType(Switch)[0].props.onValueChange(false);
    });

    expect(arbre.root.findAllByType(Switch)[0].props.value).toBe(false);
  });

  test('revenir au terrain vide RETEINT l aimantation, meme allumee avant', async () => {
    mockDefaultComposition = COMPO_TYPE;
    const arbre = await rendre();
    expect(arbre.root.findAllByType(Switch)[0].props.value).toBe(true);

    await act(async () => { rangee(arbre, 'Terrain vide').props.onPress(); });

    expect(arbre.root.findAllByType(Switch)[0].props.value).toBe(false);
  });
});

describe('D79 ecran 4 — l apercu et le passage au terrain', () => {
  test('terrain vide : l apercu le dit, il ne montre pas un terrain muet', async () => {
    const arbre = await rendre();
    expect(texteVisible(arbre)).toContain('Tout le monde part du banc.');
  });

  test('« Ouvrir le terrain » emmene les placements choisis a l ecran 5', async () => {
    mockDefaultComposition = COMPO_TYPE;
    const arbre = await rendre();
    await appuyerSur(arbre, 'Ouvrir le terrain');

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [nomEcran, parametres] = mockNavigate.mock.calls[0];
    expect(nomEcran).toBe('MatchCompositionBoard');
    expect(parametres.startFrom).toBe('default_composition');
    expect(parametres.startPlacements).toHaveLength(11);
    expect(parametres.magnetEnabled).toBe(true);
    // Les convoques voyagent : le terrain ne doit pas les redemander.
    expect(parametres.selectedPlayers).toHaveLength(11);
  });

  test('depuis un terrain vide, on part sans placement et sans aimantation', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Ouvrir le terrain');

    const [, parametres] = mockNavigate.mock.calls[0];
    expect(parametres.startPlacements).toHaveLength(0);
    expect(parametres.magnetEnabled).toBe(false);
  });

  test('un joueur de la compo type NON convoque ne remonte pas sur le terrain', async () => {
    mockDefaultComposition = {
      composition: {
        placements: [
          { playerId: 'p0', positionX: 50, positionY: 90 },
          { playerId: 'parti_du_club', positionX: 20, positionY: 50 },
        ],
      },
    };
    const arbre = await rendre();
    await appuyerSur(arbre, 'Ouvrir le terrain');

    const [, parametres] = mockNavigate.mock.calls[0];
    expect(parametres.startPlacements).toHaveLength(1);
    expect(parametres.startPlacements[0].playerId).toBe('p0');
  });
});
