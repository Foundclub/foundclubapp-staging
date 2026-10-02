import { Alert, Linking, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { deleteFacility } from '@/services/facility/facilityService';

import FacilityList from '../FacilityList';

// D34 (E6) : FacilityList.js fait 580 lignes et n'avait AUCUN test, alors que
// l'ecran 03 du pack « Gerer mon club » lui demande de changer entierement de
// peau (carte peinte -> lisere + pastille, chips -> meta d'une ligne, bouton
// plein -> grammaire pointillee). Ce fichier fige le comportement AVANT la
// refonte et doit passer, INCHANGE, avant et apres.
//
// Il ne decrit volontairement AUCUN pixel : il observe ce qui part en
// navigation (`FacilityForm`), ce qui part sur le reseau (`deleteFacility`),
// ce que recoit la feuille de paywall, ce qui part vers la carte (`Linking`),
// et ce que l'ecran REFUSE de faire (installation partagee = pas de
// suppression). Une mise en page peut donc etre refaite de fond en comble sans
// qu'une seule ligne d'ici ne bouge.
//
// Seuil de tolerance assume : les gestes sont pilotes par le TEXTE VISIBLE,
// parce que c'est le seul point d'appui qui survit au passage de chips empilees
// a une meta d'une ligne.

/** @type {any[]} */
const mockButtonProps = [];
/** @type {any[]} */
const mockPaywallProps = [];
/** @type {any[]} */
const mockEmptyStateProps = [];

/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockRoute;
/** @type {any} */
let mockFacilityContext;
/** @type {any} */
let mockUserData;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData }),
}));

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend
// les echecs Jest illisibles (constat du lot paywall, 2026-08-02), et un objet
// invente masquerait un jeton absent. `Images` est le seul element stub, pour
// ne pas faire dependre ce test de la resolution des fichiers d'assets.
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
      Images: { calendar: 3, edit: 2, pin: 1 },
      Spaces: espaces,
    }),
  };
});

// COLL1B : la doublure RETIENT aussi ce que l ecran demande (options du hook).
/** @type {any[]} */
const mockFacilityContextCalls = [];
jest.mock('@/services/facility/facilityQueries', () => ({
  useClubFacilityContext: (/** @type {any} */ contexte, /** @type {any} */ options) => {
    mockFacilityContextCalls.push({ contexte, options });
    return mockFacilityContext;
  },
}));

// COLL1C — le mode collectivite lit les installations de LA collectivite.
/** @type {any} */
let mockCollectiviteInstallations = { data: undefined, isLoading: false, refetch: jest.fn() };
// COLL-C2B (02/10) : la liste de la Ville lit la semaine de chaque installation (son planning) et
// range ses gestes dans une feuille du bas ; deux doublures, sans effet cote club.
jest.mock('@/services/seasonSlot/seasonSlotQueries', () => ({
  useInstallationsWeekSummary: () => ({}),
}));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, isVisible },
) {
  return isVisible ? children : null;
});

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => mockCollectiviteInstallations,
  // TEXTES-COLLECTIVITES : en mode collectivite, la page porte le nom de la collectivite.
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Recette' }],
  }),
}));

// Le service est double ENTIEREMENT, fonctions pures comprises : le module
// importe le client HTTP, qui refuse de se charger sans `API_URL` (piege paye
// au lot L35, 2026-08-05). `getFacilitySections` est donc reimplemente ici a
// l'identique de la source, et non `requireActual`.
jest.mock('@/services/facility/facilityService', () => ({
  deleteFacility: jest.fn(),
  getFacilitySections: (/** @type {any[]} */ installations, /** @type {any} */ libelles = {}) => {
    if (!Array.isArray(installations) || installations.length === 0) return [];

    const titreClub = libelles.clubTitle || 'Installations du club';
    const titrePartage = libelles.sharedTitle || 'Installations partagées';
    const propres = installations.filter((installation) => !installation?.isShared);
    const partagees = installations.filter((installation) => installation?.isShared);

    if (propres.length > 0 && partagees.length > 0) {
      return [
        { data: propres, title: titreClub },
        { data: partagees, title: titrePartage },
      ];
    }
    if (partagees.length > 0) return [{ data: partagees, title: titrePartage }];
    return [{ data: propres, title: titreClub }];
  },
}));

// Valeur FIGEE hors de la fabrique : un double de hook qui rend un objet neuf a
// chaque appel fait tourner Jest en boucle infinie, sans message.
const dispositionFigee = { sceneBottomInset: 24 };
jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => dispositionFigee,
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  return null;
});

jest.mock('@/components/atoms/emptyState/EmptyState', () => function EmptyStateMock(
  /** @type {any} */ props,
) {
  mockEmptyStateProps.push(props);
  return null;
});

// Le bouton est rendu comme un vrai element pressable portant son libelle :
// c'est ce qui permet aux tests d'appuyer « sur le texte », que le libelle soit
// porte par un Button (avant) ou par un TouchableOpacity (apres).
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    mockButtonProps.push(props);
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled || props.isLoading, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock(/** @type {any} */ props) {
    mockPaywallProps.push(props);
    return null;
  },
);

const INSTALLATION_CLUB = {
  address: {
    description: '21 rue Fortia, Marseille',
    geometry: { coordinates: [5.37, 43.29] },
  },
  documentId: 'fac-1',
  maxSlots: 1,
  name: 'Gymnase',
  planningColor: '#ff4d5e',
  type: 'Terrain',
};

const INSTALLATION_PARTAGEE = {
  address: 'Stade du multisport',
  documentId: 'fac-2',
  isReadOnly: true,
  isShared: true,
  maxSlots: 3,
  name: 'Terrain multisport',
  ownerName: 'SMUC',
  type: 'Gymnase',
};

// `SectionList` planifie ses lots via un `Batchinator` qui appelle
// `InteractionManager` sur un `setTimeout`. Si l'arbre survit a la fin du test,
// ce minuteur se declenche APRES le demontage de l'environnement Jest et fait
// tomber le processus entier — sans rapport avec le code teste. On demonte
// donc explicitement tout ce qu'on a monte.
/** @type {any[]} */
const arbresMontes = [];

/**
 * Rend l'ecran et retourne son arbre.
 * @returns {any} L'arbre rendu.
 */
const rendre = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<FacilityList />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

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
 * Texte visible sous un noeud de l'arbre rendu.
 * @param {any} noeud - Le noeud observe.
 * @returns {string} Le texte visible.
 */
const texteDe = (noeud) => noeud
  .findAllByType(Text)
  .map((/** @type {any} */ texte) => aplatirTexte(texte.props.children))
  .join(' ');

/**
 * Trouve le pressable le plus profond qui porte ce libelle, ou undefined.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} libelle - Le libelle visible cherche.
 * @returns {any} Le noeud pressable, ou undefined.
 */
const pressableAvecTexte = (arbre, libelle) => {
  const candidats = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function')
    .filter((/** @type {any} */ noeud) => texteDe(noeud).includes(libelle));

  if (candidats.length === 0) return undefined;

  return candidats.find((/** @type {any} */ noeud) => texteDe(noeud).trim() === libelle)
    || candidats[candidats.length - 1];
};

/**
 * Tout le texte visible de l'arbre, en une seule chaine.
 * @param {any} arbre - L'arbre rendu.
 * @returns {string} Le texte visible.
 */
const textesVisibles = (arbre) => texteDe(arbre.root);

beforeEach(() => {
  jest.clearAllMocks();
  mockButtonProps.length = 0;
  mockPaywallProps.length = 0;
  mockEmptyStateProps.length = 0;
  mockFacilityContextCalls.length = 0;

  mockNavigation = { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };
  mockRoute = { params: { clubId: 'club-1', cmId: null } };
  mockUserData = { club: { documentId: 'club-1' } };
  mockFacilityContext = {
    data: { allFacilities: [INSTALLATION_CLUB], cmId: null },
    error: null,
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  };

  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => {
  act(() => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
  jest.restoreAllMocks();
});

describe('FacilityList — ce que l ecran fait (fige avant la refonte D34)', () => {
  it('affiche le nom, le type et l adresse de l installation', () => {
    const arbre = rendre();
    const textes = textesVisibles(arbre);

    expect(textes).toContain('Gymnase');
    expect(textes.includes('21 rue Fortia')).toBe(true);
    expect(textes).toContain('Terrain');
  });

  it('annonce la capacite au singulier pour une seule equipe simultanee', () => {
    const arbre = rendre();

    expect(textesVisibles(arbre).includes('1 équipe simultanée')).toBe(true);
  });

  it('annonce la capacite au pluriel au dela d une equipe', () => {
    mockFacilityContext.data = { allFacilities: [{ ...INSTALLATION_CLUB, maxSlots: 3 }], cmId: null };
    const arbre = rendre();

    expect(textesVisibles(arbre).includes('3 équipes simultanées')).toBe(true);
  });

  it('ouvre le formulaire VIDE quand on demande une nouvelle installation', () => {
    const arbre = rendre();

    act(() => {
      pressableAvecTexte(arbre, 'Ajouter').props.onPress();
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'FacilityForm',
      { clubId: 'club-1', cmId: null },
    );
  });

  it('ouvre le formulaire PRE-REMPLI quand on ouvre une installation existante', () => {
    const arbre = rendre();
    const carte = arbre.root.findAll(
      (/** @type {any} */ noeud) => noeud.props?.accessibilityLabel === "Modifier l'installation Gymnase",
    )[0];

    act(() => {
      carte.props.onPress();
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'FacilityForm',
      { clubId: 'club-1', cmId: null, facility: INSTALLATION_CLUB },
    );
  });

  it('demande confirmation avant de supprimer, et n appelle le reseau qu apres', async () => {
    const arbre = rendre();

    act(() => {
      pressableAvecTexte(arbre, 'Supprimer').props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalled();
    expect(deleteFacility).not.toHaveBeenCalled();

    const boutons = /** @type {any} */ (Alert.alert).mock.calls[0][2];
    const confirmation = boutons.find((/** @type {any} */ bouton) => bouton.style === 'destructive');

    await act(async () => {
      await confirmation.onPress();
    });

    expect(deleteFacility).toHaveBeenCalledWith('fac-1');
  });

  it('ouvre la feuille d abonnement quand la suppression est refusee pour cause d offre', async () => {
    // Forme reelle rejetee par l'intercepteur HTTP : la charge Strapi DEBALLEE,
    // sans `.response` (mesure au lot R09) — d'ou `details.decision` a la racine.
    /** @type {any} */ (deleteFacility).mockRejectedValue({
      details: { decision: { paywall: 'facility-manage-required' } },
    });

    const arbre = rendre();

    act(() => {
      pressableAvecTexte(arbre, 'Supprimer').props.onPress();
    });

    const boutons = /** @type {any} */ (Alert.alert).mock.calls[0][2];
    const confirmation = boutons.find((/** @type {any} */ bouton) => bouton.style === 'destructive');

    await act(async () => {
      await confirmation.onPress();
    });

    const derniereFeuille = mockPaywallProps[mockPaywallProps.length - 1];
    expect(derniereFeuille.isVisible).toBe(true);
    expect(derniereFeuille.clubDocumentId).toBe('club-1');
  });

  it('n offre PAS la suppression sur une installation partagee en lecture seule', () => {
    mockFacilityContext.data = { allFacilities: [INSTALLATION_PARTAGEE], cmId: null };
    const arbre = rendre();

    expect(pressableAvecTexte(arbre, 'Supprimer')).toBeUndefined();
    expect(textesVisibles(arbre).includes('multisport')).toBe(true);
  });

  // D50 : depuis que le hub a retire les onglets de « Mon club », CE bouton est
  // le SEUL chemin vers le planning du club — cet ecran-la n'a aucune route a
  // lui, on n'y entre qu'en revenant sur `Club` avec `planningFacilityId`. Si
  // ce point d'entree disparait, le planning devient inatteignable sans qu'une
  // seule porte ne s'en apercoive : ce filet est la pour ca.
  it('« Voir le planning » ramene sur le club avec l installation a selectionner', () => {
    const arbre = rendre();

    act(() => {
      pressableAvecTexte(arbre, 'Voir le planning').props.onPress();
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'Club',
      { clubId: 'club-1', planningFacilityId: 'fac-1', planningScope: 'club' },
    );
  });

  it('ouvre la carte sur l adresse quand l installation en a une', async () => {
    const arbre = rendre();

    await act(async () => {
      pressableAvecTexte(arbre, 'GPS').props.onPress();
    });

    expect(Linking.canOpenURL).toHaveBeenCalled();
  });

  it('separe installations du club et installations partagees quand il y a les deux', () => {
    mockFacilityContext.data = {
      allFacilities: [INSTALLATION_CLUB, INSTALLATION_PARTAGEE],
      cmId: null,
    };
    const arbre = rendre();
    const textes = textesVisibles(arbre);

    expect(textes).toContain('Installations du club');
    expect(textes).toContain('Installations partagées');
  });

  it('propose l ajout depuis l etat vide', () => {
    mockFacilityContext.data = { allFacilities: [], cmId: null };
    rendre();

    expect(mockEmptyStateProps[0].actionLabel).toBe('Ajouter une installation');

    act(() => {
      mockEmptyStateProps[0].onAction();
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'FacilityForm',
      { clubId: 'club-1', cmId: null },
    );
  });

  it('refuse d agir quand aucun club ne peut etre determine', () => {
    mockRoute = { params: {} };
    mockUserData = {};
    mockFacilityContext.data = { allFacilities: [], cmId: null };
    const arbre = rendre();

    expect(textesVisibles(arbre)).toContain('Club introuvable');
  });

  it('affiche le message d erreur quand le chargement echoue', () => {
    mockFacilityContext.error = new Error('reseau coupe');
    const arbre = rendre();

    expect(textesVisibles(arbre)).toContain('Impossible de charger les installations');
  });
});

// D51 ecran 03 : le type est requis a la creation depuis D2, mais des
// installations anterieures peuvent encore ne pas en porter. Elles s'annoncaient
// « Type inconnu » — un aveu de panne la ou il n'y a qu'un champ vide.
describe('FacilityList — refonte D51 ecran 03', () => {
  it('une installation sans type n annonce plus « Type inconnu »', () => {
    mockFacilityContext.data = {
      allFacilities: [{ ...INSTALLATION_CLUB, type: undefined }],
      cmId: null,
    };
    const arbre = rendre();

    expect(textesVisibles(arbre)).not.toContain('Type inconnu');
  });

  it('sans type, la meta garde la capacite et l adresse', () => {
    mockFacilityContext.data = {
      allFacilities: [{ ...INSTALLATION_CLUB, type: undefined }],
      cmId: null,
    };
    const arbre = rendre();
    const textes = textesVisibles(arbre);

    expect(textes).toContain('1 équipe simultanée');
    expect(textes).toContain('21 rue Fortia, Marseille');
  });

  it('avec un type, il reste en tete de la meta', () => {
    const arbre = rendre();

    expect(textesVisibles(arbre)).toContain('Terrain · 1 équipe simultanée');
  });
});

// ---------------------------------------------------------------------------
// COLL1B (29/09) — lot 1b du chantier Collectivites (SPEC §3) : « l onglet
// Installations du club montre ses installations ET celles de la collectivite ».
// ROUGE avant le lot : l ecran ne demandait pas celles de la collectivite, une
// installation en lecture seule s annoncait « Multisport », et « Voir le planning »
// renvoyait vers le planning du CLUB (qui ne montre que ses propres evenements).
// ---------------------------------------------------------------------------
const INSTALLATION_DE_LA_VILLE = {
  address: { description: '1 avenue du Stade, Demo' },
  collectivite: { documentId: 'ville-demo', name: 'Ville de Demo' },
  documentId: 'gym-ville',
  isReadOnly: true,
  isShared: true,
  maxSlots: 2,
  name: 'Gymnase de la Ville',
  ownerName: 'Ville de Demo',
  ownerType: 'collectivite',
  type: 'Gymnase',
};

describe('FacilityList — COLL1B : les installations de la collectivite du club', () => {
  it('l ecran demande AUSSI les installations de la collectivite du club', () => {
    rendre();

    expect(mockFacilityContextCalls[mockFacilityContextCalls.length - 1].options).toMatchObject({ includeCollectivite: true });
  });

  it('le gymnase de la Ville se lit « Ville de Demo », jamais « Multisport »', () => {
    mockFacilityContext.data = { allFacilities: [INSTALLATION_CLUB, INSTALLATION_DE_LA_VILLE], cmId: null };
    const arbre = rendre();
    const textes = textesVisibles(arbre);

    expect(textes).toContain('Gymnase de la Ville');
    expect(textes).toContain('Ville de Demo');
    expect(textes.includes('Multisport')).toBe(false);
  });

  it('« Voir le planning » ouvre le planning de la SEMAINE de cette installation', () => {
    mockFacilityContext.data = { allFacilities: [INSTALLATION_DE_LA_VILLE], cmId: null };
    const arbre = rendre();

    act(() => {
      pressableAvecTexte(arbre, 'Voir le planning').props.onPress();
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith('PlanningWeekFullscreen', expect.objectContaining({
      contextDetailLabel: 'Gymnase de la Ville',
      facilityId: 'gym-ville',
      sourceType: 'facility',
    }));
  });

  it('ni « Modifier », ni « Supprimer » : l installation est a la mairie', () => {
    mockFacilityContext.data = { allFacilities: [INSTALLATION_DE_LA_VILLE], cmId: null };
    const arbre = rendre();

    expect(pressableAvecTexte(arbre, 'Supprimer')).toBeUndefined();
    expect(pressableAvecTexte(arbre, 'Modifier')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 🏛️ COLLECTIVITES 1c — ECRAN 4 : les installations de LA collectivite (SPEC §2 B)
// ROUGE avant l ecran 4 : la liste ne connaissait que le club du compte.
// ---------------------------------------------------------------------------
describe('COLL1C — mode collectivité (route CollectiviteInstallations)', () => {
  const GYMNASE = {
    address: { description: '1 avenue du Stade, Recette' },
    capacityConflictMode: 'pending_validation',
    closingTime: '22:00:00',
    documentId: 'gymnase-recette',
    maxSlots: 2,
    name: 'Gymnase de la Recette',
    openingTime: '08:00:00',
    type: 'Gymnase',
  };

  beforeEach(() => {
    mockRoute = { params: { collectiviteId: 'ville-de-recette' } };
    mockCollectiviteInstallations = {
      data: [GYMNASE], error: null, isLoading: false, isRefetching: false, refetch: jest.fn(),
    };
  });

  it('liste les installations de la Ville, horaires compris — jamais celles du club', () => {
    const textes = textesVisibles(rendre());
    // COLL-C2B (02/10, design P4) : la PAGE porte « Installations de la Ville », une fois ;
    // l en-tete de navigation se tait (avant : le nom de la Ville, TEXTES-COLLECTIVITES). La
    // capacite se dit « 2 equipes a la fois » (temoin FacilityList.COLL-C2B, vrai i18next).
    expect(textes).toContain('Installations de la Ville');
    expect(mockNavigation.setOptions).toHaveBeenCalledWith({ headerTitle: '' });
    expect(textes).toContain('Gymnase de la Recette');
    expect(textes.includes('08:00 – 22:00')).toBe(true);
    expect(textes).not.toContain('Terrain Honneur');
    // Aucune lecture du club : le contexte club est demande SANS club ni structure.
    expect(mockFacilityContextCalls.every(({ contexte }) => !contexte.clubId && !contexte.cmId))
      .toBe(true);
  });

  it('pas de « Supprimer » pour le gestionnaire (le serveur ne le lui ouvre pas)', () => {
    expect(pressableAvecTexte(rendre(), 'Supprimer')).toBeUndefined();
  });

  it('« Modifier » ouvre le formulaire de la COLLECTIVITE, avec l identifiant', () => {
    const arbre = rendre();
    // COLL-C2B (02/10, design P4) : « Modifier » est range dans le menu « Plus d actions ».
    act(() => {
      arbre.root.findAll((/** @type {any} */ noeud) => (
        String(noeud.props?.accessibilityLabel || '').startsWith('Plus d’actions')
        && typeof noeud.props?.onPress === 'function'
      ))[0].props.onPress();
    });
    act(() => {
      pressableAvecTexte(arbre, 'Modifier').props.onPress();
    });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('CollectiviteInstallationForm', {
      collectiviteId: 'ville-de-recette',
      facility: expect.objectContaining({ documentId: 'gymnase-recette' }),
      facilityId: 'gymnase-recette',
    });
  });

  it('« Ajouter » ouvre le formulaire VIDE de la collectivité', () => {
    const arbre = rendre();
    act(() => {
      pressableAvecTexte(arbre, 'Ajouter').props.onPress();
    });
    expect(mockNavigation.navigate)
      .toHaveBeenCalledWith('CollectiviteInstallationForm', { collectiviteId: 'ville-de-recette' });
  });

  it('« Voir le planning » ouvre le planning de CETTE installation (lot 1b)', () => {
    const arbre = rendre();
    // COLL-C2B (02/10, design P4) : « Voir le planning » est range dans « Plus d actions ».
    act(() => {
      arbre.root.findAll((/** @type {any} */ noeud) => (
        String(noeud.props?.accessibilityLabel || '').startsWith('Plus d’actions')
        && typeof noeud.props?.onPress === 'function'
      ))[0].props.onPress();
    });
    act(() => {
      pressableAvecTexte(arbre, 'Voir le planning').props.onPress();
    });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('PlanningWeekFullscreen', {
      contextDetailLabel: 'Gymnase de la Recette',
      facilityId: 'gymnase-recette',
      sourceType: 'facility',
    });
  });
});
