import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { TeamWizardProvider } from '../TeamWizardContext';
import TeamWizardName from '../TeamWizardName';

// Filet D25 (E6) — ce que l'etape 1/8 « Nom de l'equipe » FAIT, avant correction.
// Etat du 2026-08-07. Ce fichier n'avait AUCUN test.
//
// Pilote par le TEXTE VISIBLE et par les props recues par les doublures : la
// mise en page peut changer, ces points d'observation tiennent.
// Le point d'observation du defaut ② est `autoFocus` sur le champ, confronte a
// la visibilite du pop-up « Ton club a deja des equipes ».

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockGabarits = [];
/** Proprietes recues par le champ de saisie, dans l'ordre du rendu. */
const mockChamps = [];
/** Nombre d'appels a `focus()` sur le champ de saisie. */
const mockFocus = { appels: 0 };
/** Ce que l'API rend a la place du reseau. */
const mockReseau = {
  club: /** @type {any} */ (null),
  /** La reponse du club est-elle deja arrivee ? */
  clubRecu: true,
};
/** Le compte connecte. Objet FIGE : on remplace son contenu, jamais la boite. */
const mockCompte = {
  club: /** @type {any} */ ({ documentId: 'club-1', name: 'FC Test' }),
  documentId: 'moi',
  myTeams: /** @type {any[]} */ ([]),
  role: { name: 'Entraineur', type: 'coach' },
  trainedTeams: /** @type {any[]} */ ([]),
};

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
      return cle;
    },
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte. ⛔ Jamais un Proxy.
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
      Images: { arrowLeft: 1, close: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockCompte }),
}));

// Le mode de l'app est lu par `useTeamWizardExit` : valeur FIGEE hors de la
// fabrique, sinon chaque rendu en cree une neuve et Jest tourne sans fin.
jest.mock('@/context/AppModeContext', () => {
  const modeFige = { isGold: false };
  return { useAppMode: () => modeFige };
});

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => options?.mutationFn?.(variables),
    variables: undefined,
  }),
  useQueryClient: () => ({ invalidateQueries: async () => {} }),
}));

// ⛔ Jamais `requireActual` sur un service : le client HTTP refuse de se charger
// sans `API_URL`. On double le module en entier.
jest.mock('@/services/team/teamService', () => ({
  claimTeamAsCoach: jest.fn(async () => ({})),
}));

jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => ({
    data: mockReseau.clubRecu ? mockReseau.club : undefined,
    error: null,
    isFetched: mockReseau.clubRecu,
    isLoading: !mockReseau.clubRecu,
  }),
}));

jest.mock('@/views/search/searchRouteHelpers', () => ({
  navigateToSearchHub: jest.fn(),
}));

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockGabarits.push(props);
  return props.children;
});

// Le champ est rendu SANS pixel : seules ses props comptent, plus le `focus()`
// qu'on lui demande par reference.
jest.mock('@/components/molecules/input/Input', () => {
  const reactActuel = jest.requireActual('react');
  return {
    __esModule: true,
    default: reactActuel.forwardRef((/** @type {any} */ props, /** @type {any} */ ref) => {
      mockChamps.push(props);
      reactActuel.useImperativeHandle(ref, () => ({
        focus: () => { mockFocus.appels += 1; },
      }));
      return null;
    }),
  };
});

// Le pop-up ne rend son contenu QUE quand il est visible : c'est la couture qui
// fait apparaitre (ou non) ses textes dans l'arbre.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function PopUpMock(
  /** @type {any} */ props,
) {
  return props.isVisible ? props.children : null;
});

jest.mock(
  '@/components/molecules/subscriptionQuotaBanner/SubscriptionQuotaBanner',
  () => () => null,
);
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => () => null,
);

jest.mock('@/components/atoms/button/Button', () => function BoutonMock(/** @type {any} */ props) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', disabled: Boolean(props.disabled), onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.title),
  );
});

jest.mock('@/components/molecules/wizardOptionCard/WizardOptionCard', () => function CarteMock(
  /** @type {any} */ props,
) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.title),
    reactActuel.createElement(TexteRN, null, props.subtitle),
  );
});

/**
 * Tous les textes rendus sous un noeud de l'arbre de test.
 * @param {any} noeud Noeud de depart.
 * @returns {string[]} Les textes, dans l'ordre du rendu.
 */
const textesSous = (noeud) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      sortie.push(String(enfant));
      return;
    }
    if (Array.isArray(enfant)) {
      enfant.forEach(parcourir);
      return;
    }
    if (enfant?.children) enfant.children.forEach(parcourir);
  };
  parcourir(noeud.children);
  return sortie;
};

/** @type {any} */
let arbre;

/**
 * Monte l'ecran avec le club servi par `mockReseau`.
 * @param {{ params?: any }} [options] Parametres de route.
 * @returns {{ champ: any, gabarit: any, textes: string[] }} L'ecran monte.
 */
const afficherLEcran = ({ params } = {}) => {
  mockGabarits.length = 0;
  mockChamps.length = 0;
  mockFocus.appels = 0;
  const pilote = {
    getParent: () => null,
    goBack: () => {},
    navigate: () => {},
    reset: () => {},
  };
  const element = createElement(
    TeamWizardProvider,
    null,
    createElement(TeamWizardName, {
      navigation: /** @type {any} */ (pilote),
      route: /** @type {any} */ ({ params: params || { clubId: 'club-1' } }),
    }),
  );

  act(() => { arbre = renderer.create(element); });

  return {
    champ: mockChamps[mockChamps.length - 1] || null,
    gabarit: mockGabarits[mockGabarits.length - 1],
    textes: textesSous(arbre.root),
  };
};

/**
 * Le champ a-t-il reclame le clavier ? Peu importe COMMENT il s'y prend
 * (`autoFocus` au montage ou `focus()` par reference) : la question posee est
 * « le clavier monte-t-il ? ».
 * @param {any} champ Les dernieres props recues par le champ.
 * @returns {boolean} true si le clavier est reclame.
 */
const leClavierEstDemande = (champ) => champ?.autoFocus === true || mockFocus.appels > 0;

/**
 * Appuie sur le pressable qui porte ce libelle.
 * @param {string} libelle Texte visible du bouton.
 * @returns {void}
 */
const appuyerSur = (libelle) => {
  // ⚠️ `TouchableOpacity` ne pose PAS `onPress` sur son noeud hote (il y met des
  // gestionnaires de responder) : on vise donc les noeuds composites.
  const cibles = arbre.root.findAll((/** @type {any} */ noeud) => (
    Boolean(noeud.props?.onPress) && textesSous(noeud).includes(libelle)
  ));
  act(() => cibles[cibles.length - 1].props.onPress());
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  mockReseau.club = null;
  mockReseau.clubRecu = true;
  mockCompte.club = { documentId: 'club-1', name: 'FC Test' };
  delete (/** @type {any} */ (mockCompte)).clubs;
  delete (/** @type {any} */ (mockCompte)).clubAffiliations;
  delete (/** @type {any} */ (mockCompte)).clubMembershipRequests;
});

describe('D25 — etape 1/8 « Nom de l equipe »', () => {
  test('son entete annonce l etape 1 sur 8 et le titre « Nom de l equipe »', () => {
    mockReseau.club = { documentId: 'club-1', name: 'FC Test', teams: [] };
    const { gabarit } = afficherLEcran();

    expect(gabarit.stepIndex).toBe(1);
    expect(gabarit.stepCount).toBe(8);
    expect(gabarit.title).toBe("Nom de l'équipe");
  });

  test('sans club, il n affiche pas le champ mais l aiguillage « il te faut un club »', () => {
    mockCompte.club = null;
    const { champ, textes } = afficherLEcran({ params: {} });

    expect(champ).toBeNull();
    expect(textes).toContain('Rechercher mon club');
    expect(textes).toContain('Je ne trouve pas mon club');
  });

  test('club sans equipe : le clavier monte tout seul, et aucun pop-up', () => {
    mockReseau.club = { documentId: 'club-1', name: 'FC Test', teams: [] };
    const { champ, textes } = afficherLEcran();

    expect(leClavierEstDemande(champ)).toBe(true);
    expect(textes).not.toContain('Ton club a déjà des équipes');
  });

  test('D25 ② — tant que le club n a pas repondu, le clavier ne monte pas', () => {
    mockReseau.clubRecu = false;
    const { champ } = afficherLEcran();

    // C'est l'instant ou `autoFocus` tranchait : on ne sait pas encore si un
    // pop-up va s'ouvrir, donc on ne demande rien.
    expect(leClavierEstDemande(champ)).toBe(false);
  });

  test('D25 ② — club avec equipes : le pop-up s ouvre SANS le clavier', () => {
    mockReseau.club = {
      documentId: 'club-1',
      name: 'FC Test',
      teams: [{ documentId: 'eq-1', name: 'U15 A', trainers: [{ documentId: 'autre' }] }],
    };
    const { champ, textes } = afficherLEcran();

    expect(textes).toContain('Ton club a déjà des équipes');
    expect(leClavierEstDemande(champ)).toBe(false);
  });

  test('D25 ② — « Creer une nouvelle equipe » referme le pop-up ET donne le clavier', () => {
    mockReseau.club = {
      documentId: 'club-1',
      name: 'FC Test',
      teams: [{ documentId: 'eq-1', name: 'U15 A', trainers: [{ documentId: 'autre' }] }],
    };
    afficherLEcran();

    appuyerSur('Créer une nouvelle équipe');

    expect(textesSous(arbre.root)).not.toContain('Ton club a déjà des équipes');
    // Le tap economise par l'ancien `autoFocus` n'est pas perdu : il est rendu
    // APRES la decision, pas pendant.
    expect(mockFocus.appels).toBe(1);
  });

  test('une equipe sans entraineur actif est proposee « a reprendre »', () => {
    mockReseau.club = {
      documentId: 'club-1',
      name: 'FC Test',
      teams: [{ documentId: 'eq-1', name: 'U15 A', trainers: [] }],
    };
    const { textes } = afficherLEcran();

    expect(textes).toContain('Sans entraîneur·e — reprends-la');
  });

  // FILET V02 — DEUX ECRANS VOISINS NE CONNAISSAIENT PAS LE MEME NOMBRE DE
  // CLUBS. `UserTrainedTeams` (l'etape d'a cote) lisait TROIS sources ; cet
  // ecran-ci n'en lisait qu'une, `userData.club`. Un entraineur multi-clubs, ou
  // dont l'adhesion n'est encore qu'une demande `pending` (le cas de TOUT
  // nouveau club, `createClubMembershipRequest` ne s'applique pas tout seul),
  // tombait sur « Il te faut d'abord un club » et se voyait proposer de creer
  // un club qu'il possedait deja.
  //
  // ⚠️ Le juge est desormais PARTAGE (`resolveMyClubDocumentId`) : ces trois
  // temoins tombent ensemble si quelqu'un le retouche.
  test('le tunnel de creation trouve le club par les trois sources', () => {
    // Source 1 — le club du compte.
    mockCompte.club = { documentId: 'club-1', name: 'FC Test' };
    expect(afficherLEcran({ params: {} }).champ).not.toBeNull();

    // Source 2 — le premier des clubs multiples.
    if (arbre) act(() => arbre.unmount());
    mockCompte.club = null;
    (/** @type {any} */ (mockCompte)).clubs = [{ documentId: 'club-2' }];
    expect(afficherLEcran({ params: {} }).champ).not.toBeNull();

    // Source 3 — l'adhesion encore en attente : le cas du club tout juste cree.
    if (arbre) act(() => arbre.unmount());
    (/** @type {any} */ (mockCompte)).clubs = [];
    (/** @type {any} */ (mockCompte)).clubMembershipRequests = [
      { club: { documentId: 'club-3' }, state: 'pending' },
    ];
    expect(afficherLEcran({ params: {} }).champ).not.toBeNull();
  });

  test('une demande d adhesion refusee ne vaut PAS un club', () => {
    mockCompte.club = null;
    (/** @type {any} */ (mockCompte)).clubMembershipRequests = [
      { club: { documentId: 'club-4' }, state: 'refused' },
    ];
    const { champ, textes } = afficherLEcran({ params: {} });

    expect(champ).toBeNull();
    expect(textes).toContain('Rechercher mon club');
  });
});

// ---------------------------------------------------------------------------
// LOT EQUIPES (E6) — Q2 : LE REFUS ARRIVE A L ENTREE, PAS A LA 8/8.
//
// Recette d Adel du 28/08 (club SMUC) : huit ecrans remplis, puis une fenetre
// « Erreur » affichant, en anglais,
// `User is not an authorized staff member of this club`.
//
// Mesure faite avant : le serveur avait RAISON de refuser (une
// `club-membership-request` a l etat `pending` n est PAS une affiliation, cf.
// `admin/src/api/club/services/auth.ts`). Ce que ces temoins figent, c est que
// l app le dise AVANT de faire saisir quoi que ce soit.
// ---------------------------------------------------------------------------
describe('EQUIPES — Q2 : le droit se verifie a l ENTREE du tunnel', () => {
  test('adhesion encore en attente : l ecran BLOQUE, en francais, et ne demande aucun nom', () => {
    mockCompte.club = null;
    (/** @type {any} */ (mockCompte)).clubMembershipRequests = [
      { club: { documentId: 'club-1' }, state: 'pending' },
    ];
    mockReseau.club = { documentId: 'club-1', name: 'SMUC' };

    const { gabarit } = afficherLEcran({ params: { clubId: 'club-1' } });

    // 1. aucun formulaire : l ecran final n a plus de marche « Suivant ».
    //    ⚠️ On observe le GABARIT et non `champ` : la doublure du champ accumule
    //    les props de TOUS les rendus, y compris celui d avant l arrivee du club.
    expect(gabarit.nextLabel).toBeUndefined();
    // 2. le texte est francais, et il nomme la sortie
    const texteEntier = `${gabarit.title} ${gabarit.subtitle}`;
    expect(texteEntier).not.toMatch(/authorized staff member/i);
    expect(texteEntier).toMatch(/adhésion/i);
    expect(texteEntier).toMatch(/dirigeant/i);
    // 3. et il nomme le club concerne
    expect(texteEntier).toMatch(/SMUC/);
  });

  test('club qui reserve la creation aux dirigeants : le coach est arrete des l entree', () => {
    mockCompte.club = { documentId: 'club-1', name: 'SMUC' };
    mockReseau.club = {
      documentId: 'club-1',
      name: 'SMUC',
      teamCreationManagementMode: 'CLUB_OWNER_ONLY',
    };

    const { gabarit } = afficherLEcran({ params: { clubId: 'club-1' } });

    expect(gabarit.nextLabel).toBeUndefined();
    expect(`${gabarit.title} ${gabarit.subtitle}`).toMatch(/dirigeant/i);
  });

  test('LE CLIQUET — sans reglage, l entraineur affilie entre comme avant', () => {
    // ⚠️ Les 222 294 clubs de production n ont pas la colonne. Son absence doit
    // valoir « autorise », sinon ce lot coupe la creation d equipe a tout le monde.
    mockCompte.club = { documentId: 'club-1', name: 'FC Test' };
    mockReseau.club = { documentId: 'club-1', name: 'FC Test' };

    expect(afficherLEcran({ params: { clubId: 'club-1' } }).gabarit.nextLabel).toBeDefined();
  });

  test('un DIRIGEANT n est jamais arrete, meme par le reglage le plus ferme', () => {
    mockCompte.club = { documentId: 'club-1', name: 'SMUC' };
    (/** @type {any} */ (mockCompte)).role = { name: 'Dirigeant', type: 'president' };
    mockReseau.club = {
      documentId: 'club-1',
      name: 'SMUC',
      teamCreationManagementMode: 'CLUB_OWNER_ONLY',
    };

    expect(afficherLEcran({ params: { clubId: 'club-1' } }).gabarit.nextLabel).toBeDefined();
    (/** @type {any} */ (mockCompte)).role = { name: 'Entraineur', type: 'coach' };
  });

  test('tant que le club n est pas revenu, on n affirme RIEN (pas de blocage qui clignote)', () => {
    mockCompte.club = null;
    (/** @type {any} */ (mockCompte)).clubMembershipRequests = [
      { club: { documentId: 'club-1' }, state: 'pending' },
    ];
    mockReseau.club = { documentId: 'club-1', name: 'SMUC' };
    mockReseau.clubRecu = false;

    // Reponse pas encore arrivee : l ecran reste celui de tout le monde.
    expect(afficherLEcran({ params: { clubId: 'club-1' } }).gabarit.nextLabel).toBeDefined();
  });
});
