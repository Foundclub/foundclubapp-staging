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
// R17-EVT-1-BIS (h) : la lecture des seances touchees (useApercuEvenement) et ce qu elle rend.
/** @type {any} */
let mockApercuFiche = { data: undefined };
/** @type {any[]} */
const mockApercuDemandes = [];

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockOrdinateur }));
// R17-EVT-1-BIS (e) : ouvrir un lieu dans l'appli de cartes (l'aide partagée).
const mockOuvrirLaCarte = jest.fn(async () => true);
jest.mock('@/platform/maps/externalMap', () => ({
  openExternalMap: (/** @type {any} */ lieu) => mockOuvrirLaCarte(lieu),
}));
// VILLEEVT-CODE (4B) : le partage de la vitrine.
const mockPartager = jest.fn(async () => undefined);
jest.mock('@/platform/share', () => ({
  __esModule: true,
  default: { share: (/** @type {any} */ contenu) => mockPartager(contenu) },
}));
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
  useApercuEvenement: (/** @type {any} */ id, /** @type {any} */ params) => {
    mockApercuDemandes.push({ id, params });
    return id ? mockApercuFiche : { data: undefined };
  },
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
    data: [{
      address: { city: 'Montrivage' }, documentId: 'ville-montrivage', name: 'Ville de Montrivage',
    }],
    isLoading: false,
  }),
}));
jest.mock('@/domains/collectivite/collectiviteDisplay', () => ({
  // R17-EVT-1-BIS (h) : la date de l actualite passe par le vrai formatCollectiviteDay.
  ...jest.requireActual('@/domains/collectivite/collectiviteDisplay'),
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

  // R17-EVT-1-BIS (h) (20/10, tri du chef) — la fiche de la Ville dit les séances que son blocage
  // touche ENCORE (lues comme avant de publier : celles que leur club a déplacées en sortent) et
  // QUAND son actualité est partie. Un club, un membre : ni l'un ni l'autre, et aucune lecture des
  // séances. ROUGE avant (ni encart, ni date, aucune lecture).
  it('🔴 la Ville : les séances encore touchées, et la date de son actualité', async () => {
    mockApercuFiche = {
      data: {
        clubsCount: 1,
        sessions: [{
          club: { name: 'AS Montrivage' },
          date: '2026-10-24',
          endTime: '12:00',
          startTime: '10:00',
          team: { name: 'U13' },
        }],
        sessionsCount: 1,
      },
    };
    mockFiche = {
      data: {
        ...VUE_DE_LA_VILLE,
        actualite: { documentId: 'actu-1', publishedAt: '2026-10-13T08:00:00.000Z' },
        closure: { documentId: 'bloc-1', status: 'active' },
      },
      isLoading: false,
    };
    const arbre = await monter(<EvenementDeLaVille />);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      '1 séance touchée',
      'AS Montrivage · U13, sam. 24 oct. 10:00 – 12:00',
      'Son club la voit « Bloqué par la Ville · à déplacer » et peut la déplacer.',
      'Actualité publiée : mar. 13 oct.',
    ]));
    expect(mockApercuDemandes.at(-1)).toEqual({
      id: 'ville-montrivage',
      params: expect.objectContaining({
        endDate: '2026-10-24',
        endTime: '17:00',
        facilityId: 'stade',
        startDate: '2026-10-24',
        startTime: '10:00',
        takesPlace: true,
      }),
    });
  });

  it('🔴 un membre, un blocage levé : ni encart, ni date, aucune lecture des séances', async () => {
    mockApercuFiche = { data: { sessions: [], sessionsCount: 3 } };
    mockApercuDemandes.length = 0;
    mockFiche = { data: VUE_DU_MEMBRE, isLoading: false };
    const membre = await monter(<EvenementDeLaVille />);
    expect(textes(membre).join(' ')).not.toMatch(/séances? touchées?|Actualité publiée/);
    expect(mockApercuDemandes.length).toBeGreaterThan(0);
    expect(mockApercuDemandes.every((demande) => demande.id === null)).toBe(true);
    mockApercuDemandes.length = 0;
    mockFiche = {
      data: { ...VUE_DE_LA_VILLE, closure: { documentId: 'bloc-1', status: 'reopened' } },
      isLoading: false,
    };
    const leve = await monter(<EvenementDeLaVille />);
    expect(textes(leve).join(' ')).not.toMatch(/séances? touchées?/);
    expect(mockApercuDemandes.every((demande) => demande.id === null)).toBe(true);
  });

  // R17-EVT-1-BIS (f) : l'affiche, en tête de la fiche, pour tous ceux qui la lisent. ROUGE avant.
  it('🔴 l’affiche en tête de la fiche (son adresse servie par le serveur)', async () => {
    mockFiche = {
      data: { ...VUE_DU_MEMBRE, poster: { height: 1200, url: '/uploads/fete.jpg', width: 800 } },
      isLoading: false,
    };
    const arbre = await monter(<EvenementDeLaVille />);
    const affiche = arbre.root
      .findAll((/** @type {any} */ n) => n.props?.testID === 'evenement-affiche');
    expect(affiche.length).toBeGreaterThan(0);
    expect(String(affiche[0].props.source?.uri)).toMatch(/\/uploads\/fete\.jpg$/);
    expect(affiche[0].props.accessibilityLabel).toBe('Affiche de « Fête du sport »');
    mockFiche = { data: VUE_DU_MEMBRE, isLoading: false };
    const sans = await monter(<EvenementDeLaVille />);
    expect(sans.root.findAll((/** @type {any} */ n) => n.props?.testID === 'evenement-affiche'))
      .toHaveLength(0);
  });

  // R17-EVT-1-BIS (e) : « Ailleurs », placé sur la carte : le lieu de la fiche s'ouvre dans l'appli
  // de cartes (comme le lieu d'une séance). Sans point : du texte. ROUGE avant.
  it('🔴 « ailleurs », placé : le lieu s’ouvre dans l’appli de cartes', async () => {
    mockOuvrirLaCarte.mockClear();
    mockFiche = {
      data: {
        ...VUE_DU_MEMBRE,
        address: 'Parc des sports',
        addressLocation: { lat: 45.75, lng: 4.83 },
        facility: null,
        takesPlace: false,
      },
      isLoading: false,
    };
    const arbre = await monter(<EvenementDeLaVille />);
    await touche(arbre, 'evenement-lieu');
    expect(mockOuvrirLaCarte).toHaveBeenCalledWith({
      label: 'Parc des sports', latitude: 45.75, longitude: 4.83,
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
  it('téléphone : le tunnel ; publié, la vitrine puis la fiche REMPLACENT le formulaire', async () => {
    mockParams = { collectiviteId: 'ville-montrivage' };
    mockFiche = { data: null, isLoading: false };
    const arbre = await monter(<CollectiviteEvenement />);
    expect(mockFormulaireProps.presentation).toBe('tunnel');
    expect(mockFormulaireProps.collectiviteNom).toBe('Ville de Montrivage');
    // R17-EVT-1-BIS (e) : la commune de la Ville, d où part la carte de « Ailleurs ».
    expect(mockFormulaireProps.collectiviteVille).toBe('Montrivage');
    await act(async () => {
      await mockFormulaireProps.onPublier({ data: { name: 'Fête du sport' } });
    });
    expect(mockPublier).toHaveBeenCalledWith({ name: 'Fête du sport' });
    // VILLEEVT-CODE (4B) : une création publiée montre d'abord la vitrine ; « Voir la fiche » la remplace.
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    await touche(arbre, 'bouton:Voir la fiche');
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

  it('C05 (Q2-03) : « Modifier » illisible : une erreur, jamais un formulaire vide', async () => {
    mockOrdinateur = false;
    mockFormulaireProps = null;
    const relire = jest.fn();
    mockParams = { collectiviteId: 'ville-montrivage', evenementId: 'evt-1' };
    mockFiche = {
      data: undefined, error: new Error('403'), isError: true, isLoading: false, refetch: relire,
    };
    const arbre = await monter(<CollectiviteEvenement />);
    expect(mockFormulaireProps).toBeNull();
    expect(textes(arbre)).toContain(
      'Cet événement n’a pas pu être lu : il ne peut pas être modifié pour l’instant.',
    );
    await act(async () => {
      arbre.root.findByProps({ testID: 'bouton:Réessayer' }).props.onPress();
    });
    expect(relire).toHaveBeenCalledTimes(1);
  });
});

// 🏛️ VILLEEVT-CODE (27/10/2026, décisions d'Adel du 25/10 « 9- 2B 3B 4B ») — la vitrine après la
// publication (4B), la série et les places sur la fiche (2B, 3B), « Annuler cette date et les
// suivantes ».
const SERIE = {
  dates: ['2026-10-24', '2026-10-31', '2026-11-07', '2026-11-14'],
  id: 'serie-1',
  regle: {
    au: '2026-11-14', frequence: 'week', intervalle: 1, jours: [6], saufVacances: false,
  },
  retirees: [],
};

describe('VILLEEVT-CODE — la vitrine après la publication (4B)', () => {
  it('🔴 l’événement mis en avant, « Partager » (texte et lien), puis « Voir la fiche »', async () => {
    mockParams = { collectiviteId: 'ville-montrivage' };
    mockFiche = { data: null, isLoading: false };
    mockPublier.mockImplementationOnce(async () => ({
      data: { ...VUE_DE_LA_VILLE, capacity: 200, documentId: 'evt-neuf', serie: SERIE },
    }));
    mockPartager.mockClear();
    const arbre = await monter(<CollectiviteEvenement />);
    await act(async () => {
      await mockFormulaireProps.onPublier({ data: { name: 'Fête du sport' } });
    });
    const lus = textes(arbre);
    expect(lus).toContain('C’est publié');
    expect(lus).toContain('Fête du sport');
    expect(lus).toContain('Chaque semaine (samedi) jusqu’au sam. 14 nov.');
    expect(lus).toContain('4 dates');
    expect(lus).toContain('200 places');
    await touche(arbre, 'bouton:Partager');
    const partage = mockPartager.mock.calls[0][0];
    expect(partage.message).toContain('Fête du sport');
    expect(partage.message).toContain('200 places');
    expect(partage.url).toMatch(/\/evenements-de-la-ville\/evt-neuf$/);
    expect(textes(arbre)).toContain('C’est prêt à être collé où vous voulez.');
  });

  it('🔴 « Modifier » : pas de vitrine, la fiche directement', async () => {
    mockParams = { collectiviteId: 'ville-montrivage', evenementId: 'evt-1' };
    mockFiche = { data: VUE_DE_LA_VILLE, isLoading: false };
    await monter(<CollectiviteEvenement />);
    await act(async () => {
      await mockFormulaireProps.onPublier({ data: { name: 'Fête du sport' } });
    });
    expect(mockNavigation.replace).toHaveBeenCalledWith('EvenementDeLaVille', { evenementId: 'evt-1' });
  });
});

describe('VILLEEVT-CODE — la fiche d’une date de série, ses places (2B, 3B)', () => {
  it('🔴 « Se répète : … », « 200 places » ; « Annuler cette date et les suivantes »', async () => {
    mockFiche = { data: { ...VUE_DE_LA_VILLE, capacity: 200, serie: SERIE }, isLoading: false };
    const arbre = await monter(<EvenementDeLaVille />);
    const lus = textes(arbre);
    expect(lus).toContain('Se répète : Chaque semaine (samedi) jusqu’au sam. 14 nov.');
    expect(lus).toContain('200 places');
    await touche(arbre, 'bouton:Annuler l’événement');
    expect(textes(arbre)).toContain(
      'Cette date fait partie d’une série : Chaque semaine (samedi) jusqu’au sam. 14 nov.',
    );
    await touche(arbre, 'bouton:Annuler cette date et les suivantes');
    expect(mockAnnuler).toHaveBeenCalledWith({ evenementId: 'evt-1', serie: true });
  });

  it('🔴 « Annuler cette date seulement » : l’id seul, comme avant', async () => {
    mockFiche = { data: { ...VUE_DE_LA_VILLE, serie: SERIE }, isLoading: false };
    const arbre = await monter(<EvenementDeLaVille />);
    await touche(arbre, 'bouton:Annuler l’événement');
    await touche(arbre, 'bouton:Annuler cette date seulement');
    expect(mockAnnuler).toHaveBeenCalledWith('evt-1');
  });
});
