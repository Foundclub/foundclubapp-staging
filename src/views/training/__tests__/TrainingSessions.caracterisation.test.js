import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubCardSurface from '@/components/molecules/clubCard/ClubCardSurface';
import TrainingSessionRow from '@/components/organisms/training/TrainingSessionRow';

import TrainingSessions from '../TrainingSessions';

/**
 * « TOUTES MES SEANCES » — LE FILET QUI DEMENAGE.
 *
 * 🔎 CE FICHIER N EST PAS UN FILET NEUF : c est celui de « Mon entrainement »,
 * transporte. Le pack de design sort deliberement la liste des huit journees du
 * premier ecran pour la mettre derriere une porte, et un comportement qu on
 * deplace doit rester protege pendant le voyage — sinon le demenagement devient
 * une perte silencieuse.
 *
 * CE QU IL FIGE, et qui etait deja fige avant le demenagement :
 *   1. une rangee par seance, dans l ORDRE RENDU PAR LE SERVEUR, jamais celui des dates ;
 *   2. le code, le titre, la date, le lieu, la duree et le statut de chaque journee ;
 *   3. la prochaine seance se distingue des autres ;
 *   4. appuyer sur une rangee ouvre CETTE journee-la, avec ses deux identifiants.
 *
 * CE QU IL AJOUTE, parce que l ecran est neuf :
 *   5. chaque rangee porte sa porte « Decaler » ;
 *   6. la feuille de report ne s ouvre que sur demande, et elle DIT sa portee reelle.
 */

/** @type {any} */
let mockEntrainement;
/** @type {any} */
let mockDecaler;

jest.mock('@/hooks/useTraining', () => ({
  useMyTraining: () => mockEntrainement,
  useUpdateTrainingSession: () => mockDecaler,
}));

jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const genererStyle = jest.requireActual('@/theme/applicationStyle').default;
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: genererStyle(Colors),
      Colors,
      Fonts: genererPolices(Colors),
      Spaces,
    }),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ clef, /** @type {any} */ options) => (
      options ? `${clef}|${JSON.stringify(options)}` : clef
    ),
  }),
}));

// Le degrade natif n est pas transpile par Jest ; `ClubCardSurface` s en sert.
jest.mock('react-native-linear-gradient', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => reactActuel.createElement(VueRN, props),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }) => reactActuel.createElement(VueRN, null, children),
  };
});

jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }) => reactActuel.createElement(VueRN, null, children),
  };
});

// La feuille du bas monte par-dessus l ecran : on la remplace par une vue qui
// ne rend ses enfants QUE lorsqu elle est visible, pour pouvoir l observer.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children, isVisible }) => (
      isVisible ? reactActuel.createElement(VueRN, { testID: 'feuille' }, children) : null
    ),
  };
});

const SEANCES = [
  {
    day: {
      code: 'T',
      documentId: 'jour-t',
      durationMinutes: 160,
      place: 'terrain',
      title: 'Jour T — Technique',
    },
    documentId: 'seance-1',
    plannedDate: '2026-09-06',
    status: 'done',
  },
  {
    day: {
      code: 'A',
      documentId: 'jour-a',
      durationMinutes: 75,
      place: 'salle',
      title: 'Jour A — Structure',
    },
    documentId: 'seance-2',
    plannedDate: '2026-09-07',
    status: 'planned',
  },
  {
    day: {
      code: 'B',
      documentId: 'jour-b',
      durationMinutes: 120,
      place: 'salle',
      title: 'Jour B — Détente',
    },
    documentId: 'seance-3',
    plannedDate: '2026-09-08',
    status: 'planned',
  },
];

const INSCRIT = {
  enrollment: { documentId: 'insc-1', program: { title: 'Football haut niveau' } },
  error: null,
  isLoading: false,
  nextSession: SEANCES[1],
  progress: { done: 1, ratio: 0.125, total: 8 },
  refetch: () => {},
  sessions: SEANCES,
};

/**
 * Monte l ecran et rend l arbre de test.
 * @param {any} [etat] ce que rend le crochet `useMyTraining`
 * @param {any} [navigation] la navigation moquee
 * @returns {any} l arbre react-test-renderer
 */
const rendre = (etat = INSCRIT, navigation = { navigate: () => {} }) => {
  mockEntrainement = etat;
  mockDecaler = { isPending: false, mutate: jest.fn() };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<TrainingSessions navigation={navigation} />);
  });
  return arbre;
};

/**
 * Tout le texte affiche par un arbre, mis a plat.
 * @param {any} arbre l arbre rendu
 * @returns {string[]} les chaines reellement rendues
 */
const textes = (arbre) => {
  /** @type {string[]} */
  const sortie = [];
  /**
   * Descend dans un noeud rendu et empile chaque chaine rencontree.
   * @param {any} noeud un noeud de l arbre rendu
   * @returns {void} rien : la sortie est empilee dans `sortie`
   */
  const parcourir = (noeud) => {
    if (typeof noeud === 'string') { sortie.push(noeud); return; }
    if (Array.isArray(noeud)) { noeud.forEach(parcourir); return; }
    if (noeud && noeud.children) noeud.children.forEach(parcourir);
  };
  parcourir(arbre.toJSON());
  return sortie;
};

describe('la liste des seances a survecu au demenagement', () => {
  it('rend UNE rangee par seance', () => {
    expect(rendre().root.findAllByType(TrainingSessionRow)).toHaveLength(SEANCES.length);
  });

  it('affiche le code et le titre de chaque journee', () => {
    const vus = textes(rendre());

    expect(vus).toEqual(expect.arrayContaining([
      'T', 'A', 'B', 'Jour T — Technique', 'Jour A — Structure',
    ]));
  });

  it('RELIE la date, le lieu et la duree par des points medians', () => {
    // 🪤 Simplement espacees, les trois informations se lisaient comme trois
    // etiquettes sans rapport. Et le lieu passe en minuscules : le serveur rend
    // « SALLE » ou « Salle » selon les programmes, et une casse qui saute d une
    // rangee a l autre se voit tout de suite.
    expect(textes(rendre())).toContain('dim. 6 sept. · terrain · 160 min');
  });

  it('garde l ORDRE RENDU PAR LE SERVEUR, jamais l ordre des dates', () => {
    expect(textes(rendre()).filter((v) => ['A', 'B', 'T'].includes(v))).toEqual(['T', 'A', 'B']);
  });

  it('distingue la prochaine seance des autres', () => {
    const rangees = rendre().root.findAllByType(TrainingSessionRow);

    expect(rangees.map((r) => r.props.isNext)).toEqual([false, true, false]);
  });

  it('appuyer sur une rangee ouvre CETTE journee, avec ses deux identifiants', () => {
    const navigate = jest.fn();
    const arbre = rendre(INSCRIT, { navigate });

    act(() => { arbre.root.findAllByType(TrainingSessionRow)[2].props.onPress(); });

    expect(navigate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      dayId: 'jour-b', sessionId: 'seance-3', title: 'Jour B — Détente',
    }));
  });
});

describe('decaler une seance', () => {
  it('chaque rangee porte sa propre porte « Decaler »', () => {
    expect(textes(rendre()).filter((v) => v === 'training.actions.postpone'))
      .toHaveLength(SEANCES.length);
  });

  it('la feuille reste FERMEE tant qu on ne la demande pas', () => {
    expect(rendre().root.findAllByProps({ testID: 'feuille' })).toHaveLength(0);
  });

  it('elle s ouvre sur la seance choisie, et DIT sa portee reelle', () => {
    const arbre = rendre();
    const portes = arbre.root.findAllByType(TouchableOpacity)
      .filter((n) => JSON.stringify(n.props.style || {}).includes('flex-end'));

    act(() => { portes[2].props.onPress(); });

    const vus = textes(arbre);
    expect(vus).toContain('training.postpone.scope');
    expect(vus.some((v) => v.startsWith('training.postpone.title'))).toBe(true);
  });

  it('repousser envoie la NOUVELLE date, calculee depuis celle de la seance', () => {
    const arbre = rendre();
    const portes = arbre.root.findAllByType(TouchableOpacity)
      .filter((n) => JSON.stringify(n.props.style || {}).includes('flex-end'));

    act(() => { portes[0].props.onPress(); });
    const boutons = arbre.root.findAllByProps({ variant: 'SecondaryLight' })
      .filter((n) => typeof n.props.onPress === 'function');
    act(() => { boutons[0].props.onPress(); });

    // La 1re seance est prevue le 06/09 ; le premier decalage est de 1 jour.
    expect(mockDecaler.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { plannedDate: '2026-09-07', shiftFollowing: true },
        sessionDocumentId: 'seance-1',
      }),
      expect.anything(),
    );
  });

  it('DECALE LES SUIVANTES par defaut : c est ce qui preserve les ecarts du programme', () => {
    // 🔗 Le programme prescrit des ecarts (« au moins 24 h apres le dernier
    // entrainement »). Repousser une seule seance les ecrase en silence : la
    // suivante se retrouve collee a celle qu on vient de bouger.
    const arbre = rendre();
    const portes = arbre.root.findAllByType(TouchableOpacity)
      .filter((n) => JSON.stringify(n.props.style || {}).includes('flex-end'));
    act(() => { portes[0].props.onPress(); });

    const cases = arbre.root.findAllByProps({ accessibilityRole: 'checkbox' });
    expect(cases[0].props.accessibilityState.checked).toBe(true);
  });

  it('mais on peut ne bouger QUE cette seance, en decochant', () => {
    const arbre = rendre();
    const portes = arbre.root.findAllByType(TouchableOpacity)
      .filter((n) => JSON.stringify(n.props.style || {}).includes('flex-end'));
    act(() => { portes[0].props.onPress(); });
    act(() => { arbre.root.findAllByProps({ accessibilityRole: 'checkbox' })[0].props.onPress(); });

    const boutons = arbre.root.findAllByProps({ variant: 'SecondaryLight' })
      .filter((n) => typeof n.props.onPress === 'function');
    act(() => { boutons[0].props.onPress(); });

    expect(mockDecaler.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ shiftFollowing: false }) }),
      expect.anything(),
    );
  });

  it('sauter une seance la marque « skipped », elle ne disparait pas', () => {
    const arbre = rendre();
    const portes = arbre.root.findAllByType(TouchableOpacity)
      .filter((n) => JSON.stringify(n.props.style || {}).includes('flex-end'));
    act(() => { portes[0].props.onPress(); });

    const sauter = arbre.root.findAllByProps({ title: 'training.actions.skipSession' })
      .filter((n) => typeof n.props.onPress === 'function');
    act(() => { sauter[0].props.onPress(); });

    expect(mockDecaler.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { status: 'skipped' },
        sessionDocumentId: 'seance-1',
      }),
      expect.anything(),
    );
  });

  it('une seance sautee s attenue au lieu de disparaitre', () => {
    const arbre = rendre({
      ...INSCRIT,
      sessions: [{ ...SEANCES[0], status: 'skipped' }],
    });
    const surfaces = arbre.root.findAllByType(ClubCardSurface);
    const styles = [].concat(...[surfaces[0].props.style].flat(4).filter(Boolean));

    expect(styles.some((s) => s && s.opacity === 0.55)).toBe(true);
    expect(surfaces).toHaveLength(1);
  });
});

describe('ce qui ne doit jamais faire tomber l ecran', () => {
  it('accepte une liste de seances absente', () => {
    expect(() => rendre({ ...INSCRIT, sessions: undefined })).not.toThrow();
  });

  it('n ouvre rien quand la seance choisie n a pas de date', () => {
    const arbre = rendre({
      ...INSCRIT,
      sessions: [{ day: { code: 'X', title: 'Sans date' }, documentId: 'x' }],
    });
    const portes = arbre.root.findAllByType(TouchableOpacity)
      .filter((n) => JSON.stringify(n.props.style || {}).includes('flex-end'));

    act(() => { portes[0].props.onPress(); });
    const boutons = arbre.root.findAllByProps({ variant: 'SecondaryLight' })
      .filter((n) => typeof n.props.onPress === 'function');
    act(() => { boutons[0].props.onPress(); });

    expect(mockDecaler.mutate).not.toHaveBeenCalled();
  });
});
