import { ScrollView, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import fr from '@/theme/strings/translations/fr';

import Button from '@/components/atoms/button/Button';
import TrainingProgressBar from '@/components/organisms/training/TrainingProgressBar';

import TrainingDay from '../TrainingDay';

/**
 * « LA FICHE D UNE JOURNEE » — LE FILET.
 *
 * 🔎 CE QU IL PROTEGE, ET POURQUOI CHAQUE POINT COMPTE :
 *   1. LA BASCULE « Preparer » / « Sur place ». C est le coeur du dessin, et le
 *      seul element de l ecran qui ne se voit pas sur une capture : deux
 *      organisations differentes des memes donnees. Le texte long se lit la
 *      veille, assis ; la liste des tests se manipule debout, sur le terrain.
 *   2. LE PIED HORS DU DEFILEMENT. Sur une journee de six tests avec ses quatre
 *      sections depliees, « Commencer » etait a quarante lignes du bas.
 *   3. LA BARRIERE OBLIGATOIRE. « Commencer » n a plus le droit de demarrer une
 *      journee qui reclame les cinq questions de forme : sans elles, on mesure
 *      quelqu un sans savoir dans quel etat il est.
 *   4. « TERMINER » NE FAIT PLUS SORTIR. L etat « journee finie » n etait jamais
 *      visible : on etait renvoye au planning avant de le voir.
 *   5. UN TITRE SANS CONTENU NE S AFFICHE PAS. On depliait « Le deroule » sur du
 *      vide, et on en concluait que l app avait perdu le programme.
 *   6. LES MOTS INTERDITS. Le pack bannit « fraicheur » et « depouiller » devant
 *      l utilisateur. Le temoin lit les VALEURS de `fr.js`, pas l ecran : c est
 *      la seule facon d attraper une clef reintroduite ailleurs.
 */

/** @type {any} */
let mockEntrainement;
/** @type {any} */
let mockMiseAJour;

jest.mock('@/hooks/useTraining', () => ({
  useMyTraining: () => mockEntrainement,
  useUpdateTrainingSession: () => mockMiseAJour,
}));

jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const genererStyle = jest.requireActual('@/theme/applicationStyle').default;
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();

  // Le vrai theme rend CINQ objets et un jeu d images : `Button` lit
  // `ApplicationStyle`, les accordeons et les cartes de test lisent `Images`.
  // On sert le theme REEL, pas une version amputee.
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: genererStyle(Colors),
      Colors,
      Fonts: genererPolices(Colors),
      Images: { chevronDown: 1 },
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

// 🪤 La fiche d une journee lit maintenant `formatSessionDate` dans la rangee de
// seance, qui tire un degrade natif : sans cette doublure, la suite ne MONTE meme
// pas — elle echoue avant le premier temoin.
jest.mock('react-native-linear-gradient', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => reactActuel.createElement(VueRN, props),
  };
});

// Le gabarit d'ecran pose un fond et des marges : il n'apporte rien a observer
// ici, et il tire des dependances natives (degrade, image de fond).
jest.mock('@/components/templates/ScreenContainer', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }) => reactActuel.createElement(VueRN, null, children),
  };
});

// L'enveloppe de chargement rend ses enfants des que ni erreur ni attente. On la
// double pour observer le CONTENU de l'ecran : c'est elle, et elle seule, qui
// porte le chargement et l'erreur — l'ecran n'en dessine aucun lui-meme.
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }) => reactActuel.createElement(VueRN, null, children),
  };
});

/**
 * Trois tests qui couvrent les trois etats possibles d une ligne.
 *
 * 🔎 LE NOMBRE DE MESURES EST CE QUI SEPARE « fait » de « entame » : un test qui
 * porte trois mesures et dont une seule est saisie n est PAS fait. La version
 * precedente confondait les deux et annoncait la journee terminee au premier
 * chiffre saisi.
 */
const TESTS = [
  {
    code: 'S10',
    documentId: 't-1',
    estimatedMinutes: 12,
    measures: [{ key: 'a', moment: 'terrain' }, { key: 'b', moment: 'terrain' }],
    name: 'Sprint 10 metres',
  },
  {
    code: 'CMJ',
    documentId: 't-2',
    estimatedMinutes: 8,
    isOptional: true,
    measures: [
      { key: 'c', moment: 'terrain' },
      { key: 'd', moment: 'terrain' },
      { key: 'e', moment: 'terrain' },
    ],
    name: 'Detente verticale',
  },
  {
    code: 'IDX',
    documentId: 't-3',
    // Tout se calcule au bureau : rien a mesurer sur le terrain. C est la
    // definition de « calcul seul », et aucun test du programme d aujourd hui ne
    // remplit cette condition — le temoin la garde vivante en attendant.
    measures: [{ key: 'f', moment: 'differe' }],
    name: 'Indice de reactivite',
  },
];

const JOURNEE = {
  code: 'B',
  documentId: 'jour-b',
  durationMinutes: 120,
  kicker: 'Jour B',
  lead: 'Detente et remise en route',
  logbook: [{ text: 'Note ta sensation du jour', type: 'p' }],
  markers: [
    { label: 'Sommeil', value: 'au moins 7 h' },
    { label: 'Cafe', value: 'aucun le matin' },
  ],
  place: 'SALLE',
  requiresFreshnessCheck: true,
  tests: TESTS,
  timeline: [{ text: 'Echauffement puis blocs', type: 'p' }],
  title: 'Jour B - Detente',
  warmup: [{ text: 'Mobilite des hanches', type: 'p' }],
};

const SEANCE = {
  day: { documentId: 'jour-b' },
  documentId: 'seance-9',
  plannedDate: '2026-09-09',
  // S10 a ses DEUX mesures : il est fait. CMJ n en a qu une sur trois : il est
  // entame. IDX n en a aucune : il reste a faire.
  results: [
    { test: { code: 'S10' } },
    { test: { code: 'S10' } },
    { test: { code: 'CMJ' } },
  ],
  status: 'planned',
};

const INSCRIT = {
  enrollment: { program: { days: [JOURNEE] } },
  error: null,
  isLoading: false,
  refetch: () => {},
  sessions: [SEANCE],
};

const ROUTE = { params: { sessionId: 'seance-9' } };

/**
 * L'etat du crochet pour une journee et une seance donnees.
 * @param {any} [journee] la journee que le programme doit contenir
 * @param {any} [seance] la seance correspondante
 * @returns {any} ce que rend `useMyTraining`
 */
const avec = (journee = JOURNEE, seance = SEANCE) => ({
  ...INSCRIT,
  enrollment: { program: { days: [journee] } },
  sessions: [seance],
});

/**
 * Monte l'ecran et rend l'arbre de test.
 * @param {object} [options] ce qu'on veut faire varier pour ce temoin
 * @param {any} [options.etat] ce que rend le crochet `useMyTraining`
 * @param {any} [options.miseAJour] ce que rend `useUpdateTrainingSession`
 * @param {any} [options.navigation] la navigation moquee
 * @param {any} [options.route] la route et ses parametres
 * @returns {any} l'arbre react-test-renderer
 */
const rendre = ({
  etat = INSCRIT,
  miseAJour = {},
  navigation = {},
  route = ROUTE,
} = {}) => {
  mockEntrainement = etat;
  mockMiseAJour = {
    isPending: false,
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    ...miseAJour,
  };
  const nav = { goBack: jest.fn(), navigate: jest.fn(), ...navigation };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<TrainingDay navigation={nav} route={route} />);
  });
  return arbre;
};

/**
 * Tout le texte affiche par un arbre, mis a plat, dans l'ordre de l'ecran.
 * @param {any} arbre l'arbre rendu
 * @returns {string[]} les chaines reellement rendues
 */
const textes = (arbre) => {
  /** @type {string[]} */
  const sortie = [];
  /**
   * Descend dans un noeud rendu et empile chaque chaine rencontree.
   * @param {any} noeud un noeud de l'arbre rendu
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

/**
 * Le bouton principal du pied — celui qui commence ou termine la journee.
 * @param {any} arbre l arbre rendu
 * @returns {any} le premier bouton du pied
 */
const boutonPrincipal = (arbre) => arbre.root.findAllByType(Button)[0];

/**
 * Appuie sur l onglet demande.
 * @param {any} arbre l arbre rendu
 * @param {string} clef `prepare` ou `onSite`
 * @returns {void} rien
 */
const basculer = (arbre, clef) => {
  // Les DEUX seuls noeuds de l ecran qui portent `selected` sont les onglets :
  // les accordeons portent `expanded`, les cartes de test ne portent rien.
  const onglets = arbre.root.findAll((n) => n.type === TouchableOpacity
    && n.props.accessibilityState?.selected !== undefined);
  act(() => { onglets[clef === 'prepare' ? 0 : 1].props.onPress(); });
};

describe('la bascule « Preparer » / « Sur place »', () => {
  it('ouvre sur PREPARER tant que la seance n a pas commence', () => {
    const vus = textes(rendre());

    // Le deroule est la, la liste des tests n y est pas : on est chez soi.
    expect(vus).toContain('training.day.timeline');
    expect(vus).not.toContain('training.day.testsTitle');
  });

  it('ouvre sur SUR PLACE des que la seance est lancee', () => {
    const vus = textes(rendre({ etat: avec(JOURNEE, { ...SEANCE, status: 'in_progress' }) }));

    expect(vus).toContain('training.day.testsTitle');
    expect(vus).not.toContain('training.day.timeline');
  });

  it('ouvre sur SUR PLACE quand la journee est finie', () => {
    const vus = textes(rendre({ etat: avec(JOURNEE, { ...SEANCE, status: 'done' }) }));

    expect(vus).toContain('training.day.testsTitle');
  });

  it('un appui bascule d un onglet a l autre, et le choix TIENT', () => {
    const arbre = rendre();
    basculer(arbre, 'onSite');

    const vus = textes(arbre);
    expect(vus).toContain('training.day.testsTitle');
    expect(vus).not.toContain('training.day.timeline');
  });
});

describe('le chapeau', () => {
  it('met le CODE en titre, pas le nom de la journee', () => {
    expect(textes(rendre())).toContain('training.day.code|{"code":"B"}');
  });

  it('donne la date et le lieu en une seule ligne, le lieu en minuscules', () => {
    const ligne = textes(rendre()).find((v) => String(v).startsWith('training.day.heading'));

    expect(ligne).toContain('"place":"salle"');
    expect(ligne).toContain('mercredi 9 septembre');
  });

  it('annonce la duree', () => {
    expect(textes(rendre())).toContain('training.day.duration|{"count":120}');
  });

  it('se rabat sur le nom quand la journee n a pas de code', () => {
    const vus = textes(rendre({ etat: avec({ ...JOURNEE, code: '' }) }));

    expect(vus).toContain('Jour B - Detente');
    expect(vus.some((v) => String(v).startsWith('training.day.code'))).toBe(false);
  });
});

describe('ou j en suis, du cote « Sur place »', () => {
  it('compte UN test fait sur trois : deux mesures sur deux, pas une sur trois', () => {
    const arbre = rendre({ etat: avec(JOURNEE, { ...SEANCE, status: 'in_progress' }) });

    expect(textes(arbre)).toContain('training.day.progress|{"count":1,"done":1,"total":3}');
  });

  it('dessine la barre a la meme hauteur que le compte', () => {
    const arbre = rendre({ etat: avec(JOURNEE, { ...SEANCE, status: 'in_progress' }) });

    expect(arbre.root.findByType(TrainingProgressBar).props.ratio).toBeCloseTo(1 / 3);
  });

  it('annonce le total des mesures de la journee', () => {
    const arbre = rendre({ etat: avec(JOURNEE, { ...SEANCE, status: 'in_progress' }) });

    // 2 + 3 + 1 = 6 mesures sur les trois tests.
    expect(textes(arbre)).toContain('training.day.measures|{"count":6}');
  });

  it('compte les tests, a cote du titre de la liste', () => {
    const arbre = rendre({ etat: avec(JOURNEE, { ...SEANCE, status: 'in_progress' }) });

    expect(textes(arbre)).toContain('3');
  });
});

describe('les cartes de test', () => {
  /**
   * Les trois cartes de test, dans l ordre de l ecran.
   * @param {any} arbre l arbre rendu
   * @returns {any[]} les noeuds cliquables des cartes
   */
  const cartes = (arbre) => arbre.root.findAll((n) => n.type === TouchableOpacity
    && String(n.props.style?.[1]?.borderRadius) === '10');

  it('marque le test ENTAME d un cadre de deux points, les autres d un seul', () => {
    const arbre = rendre({ etat: avec(JOURNEE, { ...SEANCE, status: 'in_progress' }) });
    const [fait, entame, aFaire] = cartes(arbre).map((c) => c.props.style[1].borderWidth);

    expect(entame).toBe(2);
    expect(fait).toBe(1);
    expect(aFaire).toBe(1);
  });

  it('ecrit « en cours » sur le test entame, et sur lui seul', () => {
    const arbre = rendre({ etat: avec(JOURNEE, { ...SEANCE, status: 'in_progress' }) });

    expect(textes(arbre).filter((v) => v === 'training.day.inProgress')).toHaveLength(1);
  });

  it('met un « ≈ » devant la duree : c est une estimation, pas un horaire', () => {
    const arbre = rendre({ etat: avec(JOURNEE, { ...SEANCE, status: 'in_progress' }) });

    expect(textes(arbre)).toContain('≈ 12 min');
  });

  it('marque « calcul seul » le test dont AUCUNE mesure ne se prend sur le terrain', () => {
    const arbre = rendre({ etat: avec(JOURNEE, { ...SEANCE, status: 'in_progress' }) });

    expect(textes(arbre).filter((v) => v === 'training.day.computeOnly')).toHaveLength(1);
  });

  it('ouvre le bon test : le RANG, pas le code', () => {
    const navigate = jest.fn();
    const arbre = rendre({
      etat: avec(JOURNEE, { ...SEANCE, status: 'in_progress' }),
      navigation: { navigate },
    });

    act(() => { cartes(arbre)[1].props.onPress(); });

    expect(navigate).toHaveBeenCalledWith(
      'TrainingTest',
      expect.objectContaining({ testIndex: 1 }),
    );
  });
});

describe('les sections du cote « Preparer »', () => {
  it('annonce le volume de chaque section AVANT qu on la deplie', () => {
    const vus = textes(rendre());

    expect(vus).toContain('training.day.lines|{"count":1}');
    expect(vus).toContain('training.day.blocks|{"count":1}');
  });

  it('mais les REPERES annoncent ou en est la preparation, pas leur volume', () => {
    // C est le seul compteur de l ecran qui parle de la VEILLE. Les autres disent
    // combien il y a a lire ; celui-la dit combien de preparatifs sont faits.
    const vus = textes(rendre());

    // 🔤 `count` porte le compte RÉEL. Depuis le 2026-09-08, l app embarque
    // `intl-pluralrules` : le moteur du telephone connait enfin la regle du
    // francais, ou ZERO prend le singulier. Il n y a plus d adaptateur.
    expect(vus).toContain('training.day.prepared|{"count":0,"done":0,"total":2}');
    expect(vus).not.toContain('training.day.points|{"count":2}');
  });

  it('n affiche PAS un titre dont la section est vide', () => {
    const vus = textes(rendre({ etat: avec({ ...JOURNEE, timeline: [], warmup: null }) }));

    expect(vus).not.toContain('training.day.timeline');
    expect(vus).not.toContain('training.day.warmup');
    // Celles qui ont du contenu restent.
    expect(vus).toContain('training.day.markers');
    expect(vus).toContain('training.day.logbook');
  });

  it('deplie les reperes ET le deroule d entree, garde le reste ferme', () => {
    // Le deroule est un TABLEAU a quatre colonnes, et c est ce qu on relit
    // vraiment la veille : le plier demandait un geste pour decouvrir qu il
    // existait. L echauffement, lui, se lit sur place.
    const vus = textes(rendre());

    expect(vus).toContain('au moins 7 h');
    expect(vus).toContain('Echauffement puis blocs');
    expect(vus).not.toContain('Mobilite des hanches');
  });
});

describe('les reperes se COCHENT, et la coche survit', () => {
  /**
   * Les cases a cocher des reperes.
   * @param {any} arbre l arbre rendu
   * @returns {any[]} les rangees cochables
   */
  const reperes = (arbre) => arbre.root.findAll((n) => n.type === TouchableOpacity
    && n.props.accessibilityRole === 'checkbox');

  it('chaque repere est une case, pas un paragraphe a lire', () => {
    expect(reperes(rendre())).toHaveLength(JOURNEE.markers.length);
  });

  it('cocher envoie la liste au serveur, dans le champ qui existait deja', () => {
    // 🔎 `conditions` est un champ JSON deja porte par la seance et deja accepte
    // par le serveur : aucune migration, et la liste survit au changement de
    // telephone — ce qu une memoire locale ne ferait pas.
    const mutate = jest.fn();
    const arbre = rendre({ miseAJour: { mutate } });

    act(() => { reperes(arbre)[0].props.onPress(); });

    expect(mutate).toHaveBeenCalledWith({
      payload: { conditions: { prepared: ['Sommeil'] } },
      sessionDocumentId: 'seance-9',
    });
  });

  it('affiche COCHE ce que la seance dit deja prepare', () => {
    const arbre = rendre({
      etat: avec(JOURNEE, { ...SEANCE, conditions: { prepared: ['Cafe'] } }),
    });
    const etats = reperes(arbre).map((n) => n.props.accessibilityState.checked);

    expect(etats).toEqual([false, true]);
    expect(textes(arbre)).toContain('training.day.prepared|{"count":1,"done":1,"total":2}');
  });

  it('decocher RETIRE la ligne au lieu de la rajouter', () => {
    const mutate = jest.fn();
    const arbre = rendre({
      etat: avec(JOURNEE, { ...SEANCE, conditions: { prepared: ['Cafe'] } }),
      miseAJour: { mutate },
    });

    act(() => { reperes(arbre)[1].props.onPress(); });

    expect(mutate).toHaveBeenCalledWith({
      payload: { conditions: { prepared: [] } },
      sessionDocumentId: 'seance-9',
    });
  });

  it('garde le reste de `conditions` intact : on n ecrase pas ce qu on ne lit pas', () => {
    const mutate = jest.fn();
    const arbre = rendre({
      etat: avec(JOURNEE, { ...SEANCE, conditions: { meteo: 'pluie' } }),
      miseAJour: { mutate },
    });

    act(() => { reperes(arbre)[0].props.onPress(); });

    expect(mutate).toHaveBeenCalledWith({
      payload: { conditions: { meteo: 'pluie', prepared: ['Sommeil'] } },
      sessionDocumentId: 'seance-9',
    });
  });
});

describe('le « Pourquoi » de chaque test', () => {
  it('ouvre le test sur son onglet d explication, sans le lancer', () => {
    // 🪤 L explication etait complete et atteignable UNIQUEMENT en demarrant le
    // test — c est-a-dire au moment ou on n a plus le temps de lire.
    const navigate = jest.fn();
    const arbre = rendre({
      etat: avec(JOURNEE, { ...SEANCE, status: 'in_progress' }),
      navigation: { navigate },
    });
    const liens = arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.accessibilityRole === 'link');

    expect(liens).toHaveLength(TESTS.length);
    act(() => { liens[1].props.onPress(); });

    expect(navigate).toHaveBeenCalledWith('TrainingTest', expect.objectContaining({
      tab: 'learn',
      testIndex: 1,
    }));
  });
});

describe('la barriere des cinq questions', () => {
  it('l encart d or est un BOUTON, et il y mene', () => {
    const navigate = jest.fn();
    const arbre = rendre({ navigation: { navigate } });
    // Le liseré d or de trois points ne se trouve nulle part ailleurs sur l ecran.
    const encart = arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.style?.borderLeftWidth === 3)[0];

    act(() => { encart.props.onPress(); });

    expect(navigate).toHaveBeenCalledWith('TrainingFreshness', { sessionId: 'seance-9' });
  });

  it('« Commencer » N A PAS le droit de demarrer une journee qui la reclame', async () => {
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    const navigate = jest.fn();
    const arbre = rendre({ miseAJour: { mutateAsync }, navigation: { navigate } });

    await act(async () => { boutonPrincipal(arbre).props.onPress(); });

    expect(navigate).toHaveBeenCalledWith('TrainingFreshness', { sessionId: 'seance-9' });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('demarre DIRECTEMENT quand la journee ne la reclame pas', async () => {
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    const arbre = rendre({
      etat: avec({ ...JOURNEE, requiresFreshnessCheck: false }),
      miseAJour: { mutateAsync },
    });

    await act(async () => { boutonPrincipal(arbre).props.onPress(); });

    expect(mutateAsync).toHaveBeenCalledWith({
      payload: { status: 'in_progress' },
      sessionDocumentId: 'seance-9',
    });
  });

  it('cache l encart une fois la journee finie : il n y a plus rien a decider', () => {
    const vus = textes(rendre({ etat: avec(JOURNEE, { ...SEANCE, status: 'done' }) }));

    expect(vus).not.toContain('training.day.freshnessRequired');
  });
});

describe('le pied de page', () => {
  it('vit HORS du defilement : il ne descend pas du ScrollView', () => {
    const arbre = rendre();

    expect(arbre.root.findByType(ScrollView).findAllByType(Button)).toHaveLength(0);
    // Deux sorties : « Commencer », et « je la ferai <date> ».
    expect(arbre.root.findAllByType(Button)).toHaveLength(2);
  });

  it('pendant la seance, RAMENE au tableau de bord au lieu de terminer ici', () => {
    // 🪤 Cette fiche sert a RELIRE un protocole en cours de route. Le geste, lui,
    // se fait sur le tableau de bord — c est la qu on voit ce qui reste, et donc
    // la que la decision de terminer se prend.
    const navigate = jest.fn();
    const arbre = rendre({
      etat: avec(JOURNEE, { ...SEANCE, status: 'in_progress' }),
      navigation: { navigate },
    });
    const bouton = boutonPrincipal(arbre);

    expect(bouton.props.title).toBe('training.now.back');
    act(() => { bouton.props.onPress(); });
    expect(navigate).toHaveBeenCalledWith('TrainingSessionNow', { sessionId: 'seance-9' });

    // ⛔ Plus de « je la ferai plus tard » une fois la seance lancee : on ne
    // reporte pas une journee dont le chronometre tourne deja.
    expect(arbre.root.findAllByType(Button)).toHaveLength(1);
  });

  it('offre une DEUXIEME sortie a qui prepare la veille', () => {
    // Le pied n avait qu un bouton : « Commencer ». Quelqu un qui ouvre la
    // journee pour la preparer n avait aucune facon de dire « pas maintenant ».
    const navigate = jest.fn();
    const arbre = rendre({ navigation: { navigate } });
    const [, secondaire] = arbre.root.findAllByType(Button);

    expect(secondaire.props.title).toBe('training.day.later|{"date":"mer. 9 sept."}');
    act(() => { secondaire.props.onPress(); });
    expect(navigate).toHaveBeenCalledWith('TrainingPlan');
  });

  it('demarrer une journee sans barriere OUVRE le tableau de bord', async () => {
    // 🪤 « Commencer » ne faisait que changer une etiquette d etat : on restait
    // sur la meme page de lecture, sans savoir quoi faire ensuite.
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    const navigate = jest.fn();
    const arbre = rendre({
      etat: avec({ ...JOURNEE, requiresFreshnessCheck: false }),
      miseAJour: { mutateAsync },
      navigation: { navigate },
    });

    await act(async () => { boutonPrincipal(arbre).props.onPress(); });

    expect(mutateAsync).toHaveBeenCalledWith({
      payload: { status: 'in_progress' },
      sessionDocumentId: 'seance-9',
    });
    expect(navigate).toHaveBeenCalledWith('TrainingSessionNow', { sessionId: 'seance-9' });
  });

  it('prend sa TROISIEME forme quand la journee est finie : la porte du carnet', () => {
    const navigate = jest.fn();
    const arbre = rendre({
      etat: avec(JOURNEE, { ...SEANCE, status: 'done' }),
      navigation: { navigate },
    });
    const bouton = boutonPrincipal(arbre);

    expect(bouton.props.title).toBe('training.day.seeMeasures|{"count":6}');
    act(() => { bouton.props.onPress(); });
    expect(navigate).toHaveBeenCalledWith('TrainingLogbook');
  });
});

describe('les mots que le pack interdit devant l utilisateur', () => {
  /**
   * Toutes les phrases du bloc `training` de `fr.js`, a plat.
   * @param {any} noeud un objet de traductions ou une chaine
   * @returns {string[]} les phrases rencontrees
   */
  const phrases = (noeud) => {
    if (typeof noeud === 'string') return [noeud];
    if (!noeud || typeof noeud !== 'object') return [];
    return Object.values(noeud).flatMap(phrases);
  };

  it('« fraicheur » et « depouiller » ne sont plus dans AUCUNE phrase', () => {
    const fautives = phrases(fr.training)
      .filter((p) => /fra[iî]cheur|d[ée]pouill/i.test(p));

    expect(fautives).toEqual([]);
  });
});

describe('ce qui ne doit jamais faire tomber l ecran', () => {
  it('traverse une journee introuvable sans exploser', () => {
    expect(() => rendre({ etat: { ...INSCRIT, enrollment: null, sessions: [] } })).not.toThrow();
  });

  it('traverse une journee sans aucun test', () => {
    const arbre = rendre({
      etat: avec({ ...JOURNEE, tests: [] }, { ...SEANCE, status: 'in_progress' }),
    });

    expect(textes(arbre)).toContain('training.day.progress|{"count":0,"done":0,"total":0}');
  });
});
