import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteEvenement from '../CollectiviteEvenement';
import EvenementDeLaVille from '../EvenementDeLaVille';

// 🏛️ R17-EVT-1 (20/10/2026, REC17-005), point 2 — LA FICHE et L'ÉCRAN du formulaire.
// Planches : P10-evenement-ordi (état 8 : son panneau ; état 9 : « Annuler l'événement »),
// P11-evenement-v2-tel (état 8 : la fiche côté club). Ce témoin fige :
//   - la Ville : ce qu'il est, qui le voit, « Modifier », « Voir l'actualité », « Annuler
//     l'événement » (la fenêtre, puis le geste) ;
//   - un club, un membre : la fiche sans aucun geste ; le lieu mène au planning de l'installation ;
//   - annulé : « Annulé », plus aucun geste ; introuvable (404) : une phrase ;
//   - l'écran du formulaire : publié, la fiche le REMPLACE ; ordinateur : le panneau.

/** @type {any} */
let mockFiche;
/** @type {any} */
let mockParams;
let mockOrdinateur = false;
const mockNavigation = {
  canGoBack: () => true,
  goBack: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
};
const mockAnnuler = jest.fn(async () => ({ data: { documentId: 'evt-1', status: 'cancelled' } }));
const mockPublier = jest.fn(async () => ({ data: { documentId: 'evt-neuf' } }));
const mockModifier = jest.fn(async () => ({ data: { documentId: 'evt-1' } }));
/** @type {any} */
let mockFormulaireProps = null;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockOrdinateur }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
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
      Images: {},
      Spaces: espaces,
    }),
  };
});
jest.mock('@/services/collectivite/collectiviteEvenementQueries', () => ({
  useEvenementDeLaVille: () => mockFiche,
  useGestesEvenementDeLaVille: () => ({
    annuler: { isPending: false, mutateAsync: mockAnnuler },
    modifier: { mutateAsync: mockModifier },
    publier: { mutateAsync: mockPublier },
  }),
}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => ({
    data: [{ documentId: 'stade', name: 'Stade municipal' }],
    isLoading: false,
  }),
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-montrivage', name: 'Ville de Montrivage' }],
    isLoading: false,
  }),
}));
jest.mock('@/domains/collectivite/collectiviteDisplay', () => ({
  findManagedCollectivite: (/** @type {any[]} */ liste, /** @type {string} */ id) => {
    const trouvee = (liste || []).find((item) => item.documentId === id);
    return trouvee || null;
  },
}));
jest.mock(
  '@/components/organisms/evenementVille/EvenementVilleForm',
  () => function FormulaireMock(/** @type {any} */ props) {
    mockFormulaireProps = props;
    return null;
  },
);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);
jest.mock(
  '@/components/atoms/loader/Loader',
  () => function LoaderMock() {
    return null;
  },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      {
        disabled: props.disabled,
        onPress: props.onPress,
        // Le vrai bouton ne pose aucun testID : on le vise par son libellé.
        testID: props.testID ?? `bouton:${props.title}`,
      },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  },
);

const VUE_DE_LA_VILLE = {
  actualite: { documentId: 'actu-1' },
  address: null,
  audience: 'dirigeants',
  collectivite: { documentId: 'ville-montrivage', name: 'Ville de Montrivage' },
  description: 'Stands des clubs, initiations.',
  documentId: 'evt-1',
  endDate: '2026-10-24',
  endTime: '17:00',
  facility: { documentId: 'stade', name: 'Stade municipal' },
  name: 'Fête du sport',
  startDate: '2026-10-24',
  startTime: '10:00',
  status: 'active',
  takesPlace: true,
  visibility: 'actualite',
};
const {
  actualite: _a, audience: _b, visibility: _c, ...VUE_DU_MEMBRE
} = VUE_DE_LA_VILLE;

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatir(noeud.props.children).trim());
const boutons = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(TouchableOpacity)
  .map((/** @type {any} */ n) => n.props.testID)
  .filter(Boolean);
const touche = (/** @type {any} */ arbre, /** @type {string} */ id) => {
  // Le dernier : une fenêtre ouverte se dessine après l’écran (deux « Annuler l’événement »).
  const noeud = arbre.root.findAllByType(TouchableOpacity)
    .filter((n) => n.props.testID === id)
    .at(-1);
  if (!noeud) throw new Error(`pas de ${id}`);
  return act(async () => {
    await noeud.props.onPress();
  });
};
const monter = async (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(element);
  });
  return arbre;
};

beforeEach(() => {
  mockParams = { evenementId: 'evt-1' };
  mockOrdinateur = false;
  mockFormulaireProps = null;
  Object.values(mockNavigation).forEach((fn) => fn?.mockClear?.());
  mockAnnuler.mockClear();
  mockPublier.mockClear();
});

describe('R17-EVT-1 — la fiche d’un événement de la Ville', () => {
  it('la Ville : ce qu’il est, qui le voit, et ses trois gestes', async () => {
    mockFiche = { data: VUE_DE_LA_VILLE, isLoading: false };
    const arbre = await monter(<EvenementDeLaVille />);
    const lus = textes(arbre);
    expect(lus).toEqual(
      expect.arrayContaining([
        'Événement de la Ville',
        'Ville de Montrivage',
        'Fête du sport',
        'sam. 24 oct. · 10:00 – 17:00',
        'Stade municipal · toute l’installation',
        'Les clubs + actualité aux dirigeants',
        'Stands des clubs, initiations.',
        'Modifier',
        'Voir l’actualité',
        'Annuler l’événement',
      ]),
    );
    await touche(arbre, 'bouton:Modifier');
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith('CollectiviteEvenement', {
      collectiviteId: 'ville-montrivage',
      evenementId: 'evt-1',
    });
    await touche(arbre, 'bouton:Voir l’actualité');
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith('CollectiviteActualites', {
      collectiviteId: 'ville-montrivage',
    });
  });

  it('« Annuler l’événement » : la fenêtre, « Garder », puis le geste', async () => {
    mockFiche = { data: VUE_DE_LA_VILLE, isLoading: false };
    const arbre = await monter(<EvenementDeLaVille />);
    await touche(arbre, 'bouton:Annuler l’événement');
    let lus = textes(arbre);
    expect(lus).toContain('Annuler « Fête du sport » ?');
    expect(lus).toContain(
      'Ceux qui avaient été prévenus le sont de l’annulation. '
        + 'Stade municipal redevient libre : sam. 24 oct. · 10:00 – 17:00.',
    );
    expect(lus).toContain('Une séance déjà déplacée par son club ne revient pas toute seule.');
    await touche(arbre, 'bouton:Garder l’événement');
    expect(mockAnnuler).not.toHaveBeenCalled();
    await touche(arbre, 'bouton:Annuler l’événement');
    await touche(arbre, 'bouton:Annuler l’événement');
    expect(mockAnnuler).toHaveBeenCalledWith('evt-1');
    lus = textes(arbre);
    expect(lus).not.toContain('Annuler « Fête du sport » ?');
  });

  it('un club, un membre : sans geste ; le lieu mène au planning', async () => {
    mockFiche = { data: VUE_DU_MEMBRE, isLoading: false };
    const arbre = await monter(<EvenementDeLaVille />);
    expect(boutons(arbre)).toEqual(['evenement-lieu']);
    expect(textes(arbre)).not.toContain('Les clubs + actualité aux dirigeants');
    await touche(arbre, 'evenement-lieu');
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith('PlanningWeekFullscreen', {
      contextDetailLabel: 'Stade municipal',
      date: '2026-10-24',
      facilityId: 'stade',
      sourceType: 'facility',
    });
  });

  it('annulé : « Annulé », plus aucun geste ; introuvable : une phrase', async () => {
    mockFiche = { data: { ...VUE_DE_LA_VILLE, status: 'cancelled' }, isLoading: false };
    const annule = await monter(<EvenementDeLaVille />);
    expect(textes(annule)).toContain('Annulé');
    expect(boutons(annule)).toEqual(['evenement-lieu']);
    mockFiche = { data: null, isLoading: false };
    const absent = await monter(<EvenementDeLaVille />);
    expect(textes(absent)).toEqual(['Cet événement n’existe plus, ou il ne vous est pas montré.']);
  });
});

describe('R17-EVT-1 — l’écran du formulaire', () => {
  it('téléphone : le tunnel ; publié, la fiche REMPLACE le formulaire', async () => {
    mockParams = { collectiviteId: 'ville-montrivage' };
    mockFiche = { data: null, isLoading: false };
    await monter(<CollectiviteEvenement />);
    expect(mockFormulaireProps.presentation).toBe('tunnel');
    expect(mockFormulaireProps.collectiviteNom).toBe('Ville de Montrivage');
    await act(async () => {
      await mockFormulaireProps.onPublier({ data: { name: 'Fête du sport' } });
    });
    expect(mockPublier).toHaveBeenCalledWith({ name: 'Fête du sport' });
    expect(mockNavigation.replace).toHaveBeenCalledWith('EvenementDeLaVille', {
      evenementId: 'evt-neuf',
    });
  });

  it('ordinateur : le panneau ; « Modifier » ; la case du planning pré-remplit', async () => {
    mockOrdinateur = true;
    mockParams = { collectiviteId: 'ville-montrivage', evenementId: 'evt-1' };
    mockFiche = { data: VUE_DE_LA_VILLE, isLoading: false };
    await monter(<CollectiviteEvenement />);
    expect(mockFormulaireProps.presentation).toBe('panneau');
    expect(mockFormulaireProps.evenement.documentId).toBe('evt-1');
    mockParams = {
      collectiviteId: 'ville-montrivage',
      date: '2026-10-24',
      facilityId: 'stade',
      startTime: '14:00',
    };
    mockFiche = { data: null, isLoading: false };
    await monter(<CollectiviteEvenement />);
    expect(mockFormulaireProps.initial).toEqual({
      date: '2026-10-24',
      endTime: undefined,
      facilityId: 'stade',
      startTime: '14:00',
    });
  });
});
