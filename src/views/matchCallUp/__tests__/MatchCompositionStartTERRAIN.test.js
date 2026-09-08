import { Switch, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MatchCompositionStart from '../MatchCompositionStart';

// 🎁 LOT TERRAIN — CE QUE L'ECRAN « Partir de… » DOIT MONTRER MAINTENANT.
//
// Ce que le banc d'essai a mesure le 2026-09-05, avant ce lot :
//   · une SEULE option, grisee, et aucune formation proposee ;
//   · « Aimanter aux postes » eteint et inatteignable — « disponible quand tu
//     pars d'une formation », alors qu'aucune formation n'existait ;
//   · avec 3 convoques, le terrain annoncait « 0/11 places » SANS UN MOT ;
//   · les ~130 activites sans terrain a postes : grisees, sans explication.
//
// Les 4 temoins ci-dessous tiennent chacun un de ces 4 points.

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
/** @type {any} */
let mockRouteParams = {};

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

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeamDefaultComposition: () => ({ data: undefined, isFetching: false }),
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

const aplatirTexte = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

const texteVisible = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

const rangee = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.accessibilityRole === 'radio'
    && aplatirTexte(noeud.props.children).includes(libelle))[0];

const appuyerSurLaRangee = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  await act(async () => { rangee(arbre, libelle).props.onPress(); });
};

const joueur = (/** @type {string} */ id, /** @type {string} */ position) => ({
  documentId: id, firstname: `Prenom${id}`, lastname: `Nom${id}`, position,
});

/** Les 11 postes du 4-3-3, un joueur par poste declare. */
const ONZE_AVEC_POSTES = [
  joueur('1', 'Gardien'),
  joueur('2', 'Latéral droit'),
  joueur('3', 'Défenseur central'),
  joueur('4', 'Défenseur central'),
  joueur('5', 'Latéral gauche'),
  joueur('6', 'Milieu défensif'),
  joueur('7', 'Milieu central'),
  joueur('8', 'Milieu offensif'),
  joueur('9', 'Ailier droit'),
  joueur('10', 'Ailier gauche'),
  joueur('11', 'Avant-centre'),
];

/** @type {any[]} */
const arbresMontes = [];

const rendre = async (/** @type {any} */ parametres = {}) => {
  mockRouteParams = {
    eventId: 'evt_1',
    selectedPlayers: ONZE_AVEC_POSTES,
    sport: 'Football',
    teamCategory: 'U15 (15 ans)',
    teamId: 'team_1',
    teamName: 'U15 Filles',
    ...parametres,
  };
  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(<MatchCompositionStart />); });
  arbresMontes.push(arbre);
  return arbre;
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('TERRAIN — l ecran propose enfin PLUSIEURS compos type', () => {
  test('un U15 de football voit les 5 formations a 11', async () => {
    const texte = texteVisible(await rendre());

    expect(texte).toContain('COMPOS TYPE');
    ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2'].forEach((nom) => {
      expect(texte).toContain(nom);
    });
    expect(texte).toContain('11 postes à remplir.');
  });

  test('un U11 voit les formations a 8, PAS celles a 11', async () => {
    const texte = texteVisible(await rendre({ teamCategory: 'U11 (11 ans)' }));

    expect(texte).toContain('3-3-1');
    expect(texte).toContain('3-1-3');
    expect(texte).not.toContain('4-2-3-1');
    expect(texte).toContain('8 postes à remplir.');
  });

  test('le futsal recoit ses compos a 5, plus jamais celles du football a 11', async () => {
    const texte = texteVisible(await rendre({ sport: 'Futsal', teamCategory: 'Sénior (+18 ans)' }));

    expect(texte).toContain('1-2-1');
    expect(texte).toContain('2-2');
    expect(texte).not.toContain('4-3-3');
    expect(texte).toContain('5 postes à remplir.');
  });

  test('🕳️ un sport SANS terrain a postes le DIT, il ne grise plus en silence', async () => {
    const texte = texteVisible(await rendre({ sport: 'Judo', teamCategory: '' }));

    expect(texte).toContain(
      'Ce sport n’a pas encore de disposition de terrain — place tes joueurs librement.',
    );
    expect(texte).not.toContain('4-3-3');
  });
});

describe('TERRAIN — une formation trop grande est GRISEE et EXPLIQUEE', () => {
  test('avec 3 convoques, le 4-3-3 dit POURQUOI il n est pas proposable', async () => {
    const arbre = await rendre({ selectedPlayers: ONZE_AVEC_POSTES.slice(0, 3) });

    // 🔓 Message reformule le 07/09 avec l'assouplissement : il ne suffit plus
    // de dire l'effectif complet, il faut nommer le MINIMUM — sinon le coach ne
    // sait pas combien de convoques il lui manque pour debloquer la formation.
    // L'intention du temoin est inchangee : la rangee grisee DIT pourquoi.
    expect(texteVisible(arbre))
      .toContain('Le 4-3-3 se joue à 11 ; il faut au moins 6 convoqués, tu en as 3.');
    expect(rangee(arbre, '4-3-3').props.accessibilityState.disabled).toBe(true);
    // ⛔ Et « Terrain vide » reste choisissable : on ne bloque jamais le coach.
    expect(rangee(arbre, 'Terrain vide').props.accessibilityState.disabled).toBe(false);
  });

  test('avec 11 convoques, elle redevient choisissable', async () => {
    const arbre = await rendre();
    expect(rangee(arbre, '4-3-3').props.accessibilityState.disabled).toBe(false);
  });
});

// 🔓 ASSOUPLISSEMENT — decide par Adel le 2026-09-07.
//
// LE DEFAUT QUE LE LOT TERRAIN AVAIT LUI-MEME REMONTE : applique a la lettre,
// « une formation trop grande est grisee » bloquait TOUT. Un coach qui convoque
// 10 joueurs pour un match a 11 ne pouvait proposer AUCUNE formation, et
// retombait sur le terrain vide — soit exactement l'ecran que ce lot devait
// remplacer, le jour ou il en avait le plus besoin.
//
// LA VRAIE VIE : les reponses arrivent au compte-gouttes jusqu'au dernier
// moment. Le coach prepare sa compo avec ce qu'il a et complete ensuite.
//
// ⚠️ LA CONDITION FERME POSEE AVEC LA DECISION : le trou doit rester VISIBLE.
// On ouvre la formation, mais l'ecran DIT combien de postes resteront vides.
// Sans ca, on remplacerait un blocage par un oubli silencieux — et l'oubli est
// pire, parce que le coach croit sa compo faite.
describe('TERRAIN — une formation s ouvre des la MOITIE de l effectif, et elle le dit', () => {
  test('avec 6 convoques sur 11, le 4-3-3 devient CHOISISSABLE', async () => {
    const arbre = await rendre({ selectedPlayers: ONZE_AVEC_POSTES.slice(0, 6) });

    expect(rangee(arbre, '4-3-3').props.accessibilityState.disabled).toBe(false);
  });

  test('et il ANNONCE combien de postes resteront vides', async () => {
    const arbre = await rendre({ selectedPlayers: ONZE_AVEC_POSTES.slice(0, 6) });

    expect(texteVisible(arbre)).toContain('5 postes resteront vides');
  });

  test('a effectif complet, aucune promesse de trou : on annonce les postes a remplir', async () => {
    const arbre = await rendre();

    expect(texteVisible(arbre)).toContain('11 postes à remplir.');
    expect(texteVisible(arbre)).not.toContain('resteront vides');
  });

  test('sous la moitie, elle reste grisee — et le message nomme le MINIMUM', async () => {
    const arbre = await rendre({ selectedPlayers: ONZE_AVEC_POSTES.slice(0, 5) });

    expect(rangee(arbre, '4-3-3').props.accessibilityState.disabled).toBe(true);
    expect(texteVisible(arbre))
      .toContain('Le 4-3-3 se joue à 11 ; il faut au moins 6 convoqués, tu en as 5.');
  });
});

describe('TERRAIN — choisir une formation allume l aimantation et place les joueurs', () => {
  test('🥇 « Aimanter aux postes » s ALLUME quand on choisit une compo type', async () => {
    const arbre = await rendre();
    const aimant = () => arbre.root.findAllByType(Switch)
      .find((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === 'Aimanter aux postes');

    // Terrain vide : eteint et inatteignable — c'est l'etat mesure au banc.
    await appuyerSurLaRangee(arbre, 'Terrain vide');
    expect(aimant().props.disabled).toBe(true);
    expect(aimant().props.value).toBe(false);

    await appuyerSurLaRangee(arbre, '4-4-2');
    expect(aimant().props.disabled).toBe(false);
    expect(aimant().props.value).toBe(true);
  });

  test('🥇 les 11 convoques partent DEJA places sur leur poste declare', async () => {
    const arbre = await rendre();
    await appuyerSurLaRangee(arbre, '4-4-2');
    await act(async () => {
      arbre.root.findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
        && aplatirTexte(noeud.props.children).includes('Ouvrir le terrain')).pop().props.onPress();
    });

    const [, parametres] = mockNavigate.mock.calls[0];
    expect(parametres.formationKey).toBe('4-4-2');
    expect(parametres.magnetEnabled).toBe(true);
    expect(parametres.startPlacements).toHaveLength(11);
    // Chacun sur SA case, jamais deux au meme endroit.
    expect(new Set(parametres.startPlacements.map((/** @type {any} */ p) => p.slotId)).size)
      .toBe(11);
  });

  test('🔄 REVERSIBLE : eteindre « placer les joueurs » vide l apercu d un doigt', async () => {
    const arbre = await rendre();
    await appuyerSurLaRangee(arbre, '4-4-2');

    const placer = () => arbre.root.findAllByType(Switch)
      .find((/** @type {any} */ noeud) => noeud.props.accessibilityLabel
        === 'Placer les joueurs sur leur poste');

    expect(placer().props.value).toBe(true);
    expect(texteVisible(arbre)).toContain('11 convoqués ont renseigné leur poste.');

    await act(async () => { placer().props.onValueChange(false); });

    await act(async () => {
      arbre.root.findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
        && aplatirTexte(noeud.props.children).includes('Ouvrir le terrain')).pop().props.onPress();
    });
    const [, parametres] = mockNavigate.mock.calls[0];
    expect(parametres.startPlacements).toEqual([]);
    // Le terrain garde ses POSTES : c'est la formation qu'on ouvre, vide.
    expect(parametres.formationKey).toBe('4-4-2');
  });

  test('sans poste declare, l ecran ne promet rien', async () => {
    const arbre = await rendre({
      selectedPlayers: ONZE_AVEC_POSTES.map((player) => ({ ...player, position: '' })),
    });
    await appuyerSurLaRangee(arbre, '4-3-3');

    expect(texteVisible(arbre))
      .toContain('Aucun convoqué n’a renseigné son poste : ils partent tous du banc.');
  });
});
