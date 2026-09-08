import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import genererCouleurs from '@/theme/colors';

import Button from '@/components/atoms/button/Button';

import TrainingFreshness, { verdictDeForme } from '../TrainingFreshness';

/**
 * « COMMENT TU TE SENS ? » — LE FILET DE LA BARRIERE.
 *
 * 🔎 CE QU IL PROTEGE, ET POURQUOI C EST LE PLUS SERIEUX DE LA SECTION : cet ecran
 * est le seul qui puisse EMPECHER une seance d avoir lieu. S il se trompe dans un
 * sens, il laisse mesurer quelqu un d epuise et pourrit une serie de mesures ; s il
 * se trompe dans l autre, il reporte des seances valables et l entrainement
 * s arrete. La regle de decision est donc testee comme une fonction, a part, sur
 * ses quatre cas, plutot qu a travers l ecran.
 *
 * ⚠️ LE VETO DES COURBATURES EST TESTE SEPAREMENT du total, parce que c est
 * exactement le cas qu une regle « seulement sur le total » laisserait passer : un
 * joueur peut afficher 18 sur 25 en dormant bien, tout en etant a 2 en courbatures.
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
  const couleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = couleurs();

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

const Colors = genererCouleurs();

const SEANCE = { day: { documentId: 'jour-b' }, documentId: 'seance-9', status: 'planned' };

const INSCRIT = {
  enrollment: { program: { days: [] } },
  error: null,
  isLoading: false,
  refetch: () => {},
  sessions: [SEANCE],
};

const QUESTIONS = ['sleep', 'fatigue', 'soreness', 'stress', 'mood'];

/**
 * Monte l'ecran et rend l'arbre de test.
 * @param {object} [options] ce qu'on veut faire varier
 * @param {any} [options.miseAJour] ce que rend `useUpdateTrainingSession`
 * @param {any} [options.navigation] la navigation moquee
 * @returns {any} l'arbre react-test-renderer
 */
const rendre = ({ miseAJour = {}, navigation = {} } = {}) => {
  mockEntrainement = INSCRIT;
  mockMiseAJour = {
    isPending: false,
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    ...miseAJour,
  };
  const nav = { goBack: jest.fn(), navigate: jest.fn(), ...navigation };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <TrainingFreshness navigation={nav} route={{ params: { sessionId: 'seance-9' } }} />,
    );
  });
  return arbre;
};

/**
 * Tout le texte affiche par un arbre, mis a plat.
 * @param {any} arbre l'arbre rendu
 * @returns {string[]} les chaines reellement rendues
 */
const textes = (arbre) => {
  /** @type {string[]} */
  const sortie = [];
  /**
   * Descend dans un noeud rendu et empile chaque chaine rencontree.
   * @param {any} noeud un noeud de l'arbre rendu
   * @returns {void} rien
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
 * Repond a une question.
 * @param {any} arbre l arbre rendu
 * @param {string} clef la question
 * @param {number} note la note choisie
 * @returns {void} rien
 */
const repondre = (arbre, clef, note) => {
  const bouton = arbre.root.findAllByProps({
    accessibilityLabel: [`training.freshness.items.${clef}`, note,
      `training.freshness.scale.${note}`].join(' '),
  }).find((n) => typeof n.props.onPress === 'function');
  act(() => { bouton.props.onPress(); });
};

/**
 * Repond aux cinq questions d un coup.
 * @param {any} arbre l arbre rendu
 * @param {Record<string, number>} notes les notes, par question
 * @returns {void} rien
 */
const repondreATout = (arbre, notes) => {
  QUESTIONS.forEach((clef) => repondre(arbre, clef, notes[clef]));
};

describe('LA REGLE QUI DECIDE, testee a part de l ecran', () => {
  it('ne decide RIEN tant que les cinq reponses ne sont pas la', () => {
    expect(verdictDeForme({})).toBeNull();
    expect(verdictDeForme({
      fatigue: 5, mood: 5, sleep: 5, soreness: 5,
    })).toBeNull();
  });

  it('reporte sous 15 sur 25', () => {
    expect(verdictDeForme({
      fatigue: 3, mood: 3, sleep: 3, soreness: 3, stress: 2,
    })).toEqual({ total: 14, verdict: 'postpone' });
  });

  it('🪤 reporte AUSSI a 2 en courbatures, meme avec un total confortable', () => {
    // 5+5+2+5+4 = 21 sur 25 : un controle qui ne regarderait que le total
    // laisserait passer cette seance, et la force explosive serait faussee.
    expect(verdictDeForme({
      fatigue: 5, mood: 4, sleep: 5, soreness: 2, stress: 5,
    })).toEqual({ total: 21, verdict: 'postpone' });
  });

  it('allege entre 15 et 18', () => {
    expect(verdictDeForme({
      fatigue: 3, mood: 3, sleep: 3, soreness: 3, stress: 3,
    })).toEqual({ total: 15, verdict: 'restricted' });
    expect(verdictDeForme({
      fatigue: 4, mood: 4, sleep: 4, soreness: 3, stress: 3,
    })).toEqual({ total: 18, verdict: 'restricted' });
  });

  it('laisse passer a partir de 19', () => {
    expect(verdictDeForme({
      fatigue: 4, mood: 4, sleep: 4, soreness: 4, stress: 3,
    })).toEqual({ total: 19, verdict: 'go' });
  });
});

describe('les cinq questions', () => {
  it('sont la, dans l ordre du pack : du plus factuel au plus flou', () => {
    const vus = textes(rendre());
    const rang = (/** @type {string} */ clef) => vus.indexOf(`training.freshness.items.${clef}`);

    QUESTIONS.forEach((clef) => expect(rang(clef)).toBeGreaterThanOrEqual(0));
    expect(rang('sleep')).toBeLessThan(rang('fatigue'));
    expect(rang('fatigue')).toBeLessThan(rang('soreness'));
    expect(rang('soreness')).toBeLessThan(rang('stress'));
    expect(rang('stress')).toBeLessThan(rang('mood'));
  });

  it('portent chacune CINQ cases hautes de 56 points, pour un doigt froid', () => {
    const arbre = rendre();
    const cases = arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.style?.height === 56);

    expect(cases).toHaveLength(QUESTIONS.length * 5);
  });

  it('ecrivent les DEUX bouts de leur echelle, et ils different d une question a l autre', () => {
    const vus = textes(rendre());

    QUESTIONS.forEach((clef) => {
      expect(vus).toContain(`training.freshness.ends.${clef}.low`);
      expect(vus).toContain(`training.freshness.ends.${clef}.high`);
    });
  });
});

describe('la couleur d une reponse dit l ALERTE, pas la position', () => {
  /**
   * La couleur du cadre d une case choisie.
   * @param {any} arbre l arbre rendu
   * @param {string} clef la question
   * @param {number} note la note
   * @returns {any} la couleur du liseré
   */
  const teinte = (arbre, clef, note) => arbre.root.findAllByProps({
    accessibilityLabel: [`training.freshness.items.${clef}`, note,
      `training.freshness.scale.${note}`].join(' '),
  }).find((n) => typeof n.props.onPress === 'function').props.style.borderColor;

  it('allume 1 et 2 en OR', () => {
    const arbre = rendre();
    repondre(arbre, 'sleep', 2);

    expect(teinte(arbre, 'sleep', 2)).toBe(Colors.gold500);
  });

  it('allume 3, 4 et 5 en BLEU', () => {
    const arbre = rendre();
    repondre(arbre, 'sleep', 3);

    expect(teinte(arbre, 'sleep', 3)).toBe(Colors.primary500);
  });
});

describe('l ecran est CALME tant qu on n a pas repondu', () => {
  it('n affiche qu un tiret a la place du total', () => {
    const vus = textes(rendre());

    expect(vus).toContain('—');
    expect(vus.some((v) => String(v).startsWith('training.freshness.decisionTitle'))).toBe(false);
  });

  it('garde le bouton ETEINT', () => {
    expect(rendre().root.findByType(Button).props.disabled).toBe(true);
  });

  it('reste eteint avec QUATRE reponses sur cinq', () => {
    const arbre = rendre();
    ['sleep', 'fatigue', 'soreness', 'stress'].forEach((clef) => repondre(arbre, clef, 5));

    expect(arbre.root.findByType(Button).props.disabled).toBe(true);
    expect(textes(arbre)).toContain('—');
  });
});

describe('le total et son verdict, une fois les cinq reponses la', () => {
  it('affiche le total en chiffres', () => {
    const arbre = rendre();
    repondreATout(arbre, {
      fatigue: 4, mood: 4, sleep: 4, soreness: 4, stress: 4,
    });

    expect(textes(arbre)).toContain('20');
    expect(textes(arbre)).not.toContain('—');
  });

  it('affiche le titre COURT du verdict et sa phrase', () => {
    const arbre = rendre();
    repondreATout(arbre, {
      fatigue: 4, mood: 4, sleep: 4, soreness: 4, stress: 4,
    });
    const vus = textes(arbre);

    expect(vus).toContain('training.freshness.decisionTitle.go');
    expect(vus).toContain('training.freshness.decision.go');
  });

  it('passe le total en OR quand il descend sous 15', () => {
    const arbre = rendre();
    repondreATout(arbre, {
      fatigue: 2, mood: 3, sleep: 2, soreness: 3, stress: 3,
    });
    const chiffre = arbre.root.findAll((n) => n.props?.style?.fontSize === 40)[0];

    expect(chiffre.props.style.color).toBe(Colors.gold500);
  });
});

describe('le bouton change de nom selon ce que la seance va etre', () => {
  it('dit « Commencer ma seance » quand tout va bien', () => {
    const arbre = rendre();
    repondreATout(arbre, {
      fatigue: 4, mood: 4, sleep: 4, soreness: 4, stress: 4,
    });

    expect(arbre.root.findByType(Button).props.title).toBe('training.freshness.start');
  });

  it('dit « Commencer en version allegee » quand le verdict allege', () => {
    const arbre = rendre();
    repondreATout(arbre, {
      fatigue: 3, mood: 3, sleep: 3, soreness: 3, stress: 3,
    });

    expect(arbre.root.findByType(Button).props.title).toBe('training.freshness.startLight');
  });
});

describe('les DEUX sorties du cas « on reporte »', () => {
  /**
   * Un arbre dont les cinq reponses concluent au report.
   * @param {any} [options] ce qu on passe a `rendre`
   * @returns {any} l arbre rendu
   */
  const enReport = (options) => {
    const arbre = rendre(options);
    repondreATout(arbre, {
      fatigue: 2, mood: 3, sleep: 2, soreness: 3, stress: 3,
    });
    return arbre;
  };

  it('propose « Reporter » ET « Je la fais quand meme », jamais l un sans l autre', () => {
    const boutons = enReport().root.findAllByType(Button).map((b) => b.props.title);

    expect(boutons).toEqual([
      'training.freshness.postponeAction',
      'training.freshness.anyway',
    ]);
  });

  it('« Reporter » marque la seance ET emmene la ou on CHOISIT de combien', async () => {
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    const navigate = jest.fn();
    const arbre = enReport({ miseAJour: { mutateAsync }, navigation: { navigate } });

    await act(async () => {
      arbre.root.findAllByType(Button)[0].props.onPress();
    });

    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ status: 'postponed' }),
      sessionDocumentId: 'seance-9',
    }));
    expect(navigate).toHaveBeenCalledWith('TrainingSessions', { postponeSessionId: 'seance-9' });
  });

  it('🪤 « Je la fais quand meme » passe, MAIS l etat reel part quand meme', async () => {
    // C est ce qui empeche la personne de mentir sur ses reponses pour debloquer
    // le bouton : elle peut passer, et le carnet saura pourquoi ca detonne.
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    const arbre = enReport({ miseAJour: { mutateAsync } });

    await act(async () => {
      arbre.root.findAllByType(Button)[1].props.onPress();
    });

    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        freshness: expect.objectContaining({ decision: 'postpone' }),
        status: 'in_progress',
      }),
    }));
  });
});

describe('ce qui part au serveur', () => {
  it('envoie les CINQ notes, leur total et le verdict — pas seulement le verdict', async () => {
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    const arbre = rendre({ miseAJour: { mutateAsync } });
    repondreATout(arbre, {
      fatigue: 4, mood: 4, sleep: 4, soreness: 3, stress: 3,
    });

    await act(async () => { arbre.root.findByType(Button).props.onPress(); });

    expect(mutateAsync).toHaveBeenCalledWith({
      payload: {
        freshness: {
          answers: {
            fatigue: 4, mood: 4, sleep: 4, soreness: 3, stress: 3,
          },
          // 🔎 LE VERDICT VOYAGE AVEC LES NOTES : le recalculer plus tard donnerait
          // un autre resultat le jour ou les seuils bougent, et le carnet mentirait
          // retroactivement sur des seances deja faites. C est aussi ce qui permet
          // de savoir qu une seance a tourne en version allegee, sans champ dedie.
          decision: 'restricted',
          total: 18,
        },
        status: 'in_progress',
      },
      sessionDocumentId: 'seance-9',
    });
  });

  it('file sur la journee une fois les reponses parties', async () => {
    const navigate = jest.fn();
    const arbre = rendre({ navigation: { navigate } });
    repondreATout(arbre, {
      fatigue: 5, mood: 5, sleep: 5, soreness: 5, stress: 5,
    });

    await act(async () => { arbre.root.findByType(Button).props.onPress(); });

    expect(navigate).toHaveBeenCalledWith('TrainingDay', { sessionId: 'seance-9' });
  });

  it('🪤 ne fait PAS partir la personne quand l envoi echoue', async () => {
    const navigate = jest.fn();
    const arbre = rendre({
      miseAJour: { mutateAsync: jest.fn().mockRejectedValue(new Error('reseau')) },
      navigation: { navigate },
    });
    repondreATout(arbre, {
      fatigue: 5, mood: 5, sleep: 5, soreness: 5, stress: 5,
    });

    await act(async () => { arbre.root.findByType(Button).props.onPress(); });

    expect(textes(arbre)).toContain('training.freshness.saveFailed');
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('le carton d introduction', () => {
  it('est la, et il dit ce que les reponses DECIDENT', () => {
    expect(textes(rendre())).toContain('training.freshness.intro');
  });
});
