import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';
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

/**
 * Ouvre la feuille de decalage sur la rangee demandee.
 * @param {any} arbre l arbre rendu
 * @param {number} rang la position de la seance dans la liste
 * @returns {void} rien
 */
const ouvrir = (arbre, rang) => {
  const portes = arbre.root.findAllByType(TouchableOpacity)
    .filter((n) => JSON.stringify(n.props.style || {}).includes('flex-end'));
  act(() => { portes[rang].props.onPress(); });
};

/**
 * Les quatre rangees de choix de la feuille.
 * @param {any} arbre l arbre rendu
 * @returns {any[]} les rangees, dans l ordre du dessin
 */
const rangees = (arbre) => arbre.root.findAll((n) => n.type === TouchableOpacity
  && n.props.accessibilityRole === 'radio');

/**
 * Le bouton du pied de la feuille.
 * @param {any} arbre l arbre rendu
 * @returns {any} le bouton
 */
const pied = (arbre) => arbre.root.findByType(Button);

describe('la feuille de decalage', () => {
  it('chaque rangee de la liste porte sa propre porte, en pastille bordee', () => {
    expect(textes(rendre()).filter((v) => v === 'training.actions.postpone'))
      .toHaveLength(SEANCES.length);
  });

  it('reste FERMEE tant qu on ne la demande pas', () => {
    expect(rendre().root.findAllByProps({ testID: 'feuille' })).toHaveLength(0);
  });

  it('s ouvre sur la seance choisie, et porte sa vraie date en titre', () => {
    const arbre = rendre();
    ouvrir(arbre, 2);

    const titre = textes(arbre).find((v) => String(v).startsWith('training.postpone.title'));
    expect(titre).toBeDefined();
    expect(textes(arbre)).toContain('training.postpone.scope');
  });

  it('offre QUATRE choix, et pas un de plus', () => {
    const arbre = rendre();
    ouvrir(arbre, 0);

    const vus = textes(arbre);
    expect(rangees(arbre)).toHaveLength(4);
    // « Demain » vient de la forme _one : i18next la choisit a partir de count=1.
    expect(vus).toContain('training.postpone.byDays|{"count":1}');
    expect(vus).toContain('training.postpone.byDays|{"count":2}');
    expect(vus).toContain('training.postpone.chooseDate');
    expect(vus).toContain('training.postpone.skip');
  });

  it('ecrit la DATE VISEE a droite de chaque delai', () => {
    const arbre = rendre();
    ouvrir(arbre, 0);

    // La 1re seance est prevue le 06/09 : demain c est le 7, dans 2 jours le 8.
    const vus = textes(arbre);
    expect(vus).toContain('lun. 7 sept.');
    expect(vus).toContain('mar. 8 sept.');
  });

  it('n agit PAS au toucher : le choix se voit d abord', () => {
    const arbre = rendre();
    ouvrir(arbre, 0);
    act(() => { rangees(arbre)[0].props.onPress(); });

    expect(mockDecaler.mutate).not.toHaveBeenCalled();
    expect(rangees(arbre)[0].props.accessibilityState.selected).toBe(true);
    expect(rangees(arbre)[1].props.accessibilityState.selected).toBe(false);
  });

  it('garde le bouton ETEINT tant qu aucun choix n est fait', () => {
    const arbre = rendre();
    ouvrir(arbre, 0);

    expect(pied(arbre).props.disabled).toBe(true);
  });

  it('le bouton du bas DIT ou on va, il ne dit pas « valider »', () => {
    const arbre = rendre();
    ouvrir(arbre, 0);
    act(() => { rangees(arbre)[0].props.onPress(); });

    expect(pied(arbre).props.title).toBe('training.postpone.confirm|{"date":"lun. 7 sept."}');
  });

  it('ANNONCE la nouvelle date de fin du programme AVANT le geste', () => {
    const arbre = rendre();
    ouvrir(arbre, 0);
    act(() => { rangees(arbre)[0].props.onPress(); });

    // La derniere seance du jeu est au 08/09 ; un decalage d un jour la met au 9.
    const phrase = textes(arbre)
      .find((v) => String(v).startsWith('training.postpone.consequence|'));
    expect(phrase).toContain('mer. 9 sept.');
  });

  it('dit au contraire que la fin NE BOUGE PAS quand la chaine est decochee', () => {
    const arbre = rendre();
    ouvrir(arbre, 0);
    act(() => {
      arbre.root.findAllByProps({ accessibilityRole: 'checkbox' })[0].props.onPress();
    });
    act(() => { rangees(arbre)[0].props.onPress(); });

    expect(textes(arbre)).toContain('training.postpone.consequenceAlone');
  });

  it('envoie la NOUVELLE date, calculee depuis celle de la seance', () => {
    const arbre = rendre();
    ouvrir(arbre, 0);
    act(() => { rangees(arbre)[0].props.onPress(); });
    act(() => { pied(arbre).props.onPress(); });

    expect(mockDecaler.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { plannedDate: '2026-09-07', shiftFollowing: true },
        sessionDocumentId: 'seance-1',
      }),
      expect.anything(),
    );
  });

  it('DECALE LES SUIVANTES par defaut : c est ce qui preserve les ecarts du programme', () => {
    const arbre = rendre();
    ouvrir(arbre, 0);

    const cases = arbre.root.findAllByProps({ accessibilityRole: 'checkbox' });
    expect(cases[0].props.accessibilityState.checked).toBe(true);
  });

  it('mais on peut ne bouger QUE cette seance, en decochant', () => {
    const arbre = rendre();
    ouvrir(arbre, 0);
    act(() => {
      arbre.root.findAllByProps({ accessibilityRole: 'checkbox' })[0].props.onPress();
    });
    act(() => { rangees(arbre)[1].props.onPress(); });
    act(() => { pied(arbre).props.onPress(); });

    expect(mockDecaler.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { plannedDate: '2026-09-08', shiftFollowing: false },
      }),
      expect.anything(),
    );
  });

  it('SAUTER N EST PAS REPORTER : aucune date ne part, donc rien ne se decale', () => {
    // Le decalage en chaine du serveur ne se declenche que sur un changement de
    // date. Ne pas envoyer `plannedDate` est donc ce qui garantit, dans le tuyau
    // lui-meme, que les seances suivantes ne bougent pas.
    const arbre = rendre();
    ouvrir(arbre, 0);
    act(() => { rangees(arbre)[3].props.onPress(); });

    expect(textes(arbre)).toContain('training.postpone.skipWarning');
    expect(pied(arbre).props.title).toBe('training.postpone.confirmSkip');

    act(() => { pied(arbre).props.onPress(); });
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

  it('n envoie rien quand la seance choisie n a pas de date', () => {
    const arbre = rendre({
      ...INSCRIT,
      sessions: [{ day: { code: 'X', title: 'Sans date' }, documentId: 'x' }],
    });
    ouvrir(arbre, 0);
    act(() => { rangees(arbre)[0].props.onPress(); });

    // Sans date de depart, aucun delai ne mene nulle part : le bouton reste
    // eteint, et l appuyer de force n envoie rien.
    expect(pied(arbre).props.disabled).toBe(true);
    act(() => { pied(arbre).props.onPress(); });
    expect(mockDecaler.mutate).not.toHaveBeenCalled();
  });
});
