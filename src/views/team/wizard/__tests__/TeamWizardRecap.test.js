import { createElement } from 'react';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { TeamWizardProvider, useTeamWizard } from '../TeamWizardContext';
import TeamWizardRecap from '../TeamWizardRecap';

// Filet D25 (E6) — ce que l'etape 8/8 « Recapitulatif » ENVOIE et RAFRAICHIT,
// avant correction. Etat du 2026-08-07. Ce fichier n'avait AUCUN test.
//
// Points d'observation : la charge postee a `createTeam`, les clefs de cache
// invalidees APRES la creation, et la facon dont elles sont attendues (en file
// indienne ou de front) — c'est le coeur du defaut ① signale par Adel.

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockGabarits = [];
/** Journal des invalidations de cache : une entree par appel. */
const mockCache = {
  /** @type {string[]} */ clefs: [],
  /** Les debloqueurs des invalidations en attente, dans l'ordre de depart. */
  /** @type {(() => void)[]} */ terminer: [],
};
/** Charges postees a `createTeam`, dans l'ordre. */
const mockCreations = [];
/** Ce que `createTeam` renvoie (ou leve). */
const mockReponse = { erreur: /** @type {any} */ (null), team: /** @type {any} */ (null) };
/** Le compte connecte. Boite FIGEE : on remplace son contenu, jamais la boite. */
const mockCompte = {
  documentId: 'moi',
  firstname: 'Adel',
  freeUsageSummary: /** @type {any[]} */ ([]),
  lastname: 'F',
  role: { name: 'Dirigeant', type: 'president' },
  subscriptionAccessLevel: 'FREE',
};

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      const base = typeof repli === 'string' ? repli : cle;
      if (!valeurs) return base;
      return Object.keys(valeurs).reduce(
        (texte, nom) => texte.replace(`{{${nom}}}`, String(valeurs[nom])),
        base,
      );
    },
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
      Images: { arrowLeft: 1, close: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    freeUsageSummary: mockCompte.freeUsageSummary,
    subscriptionAccessLevel: mockCompte.subscriptionAccessLevel,
    userData: mockCompte,
  }),
}));

jest.mock('@/context/AppModeContext', () => {
  const modeFige = { isGold: false };
  return { useAppMode: () => modeFige };
});

jest.mock('@/domains/guidance/guidanceRuntime', () => ({
  emitGuidanceAction: jest.fn(),
}));

// Le client de cache, instrumente : chaque invalidation note sa clef et ne se
// termine que quand on le lui demande. C'est ce qui rend VISIBLE la difference
// entre « en file indienne » et « de front ».
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve()
      .then(() => options.mutationFn(variables))
      .then((resultat) => options.onSuccess?.(resultat, variables))
      .catch((erreur) => options.onError?.(erreur, variables)),
  }),
  useQueryClient: () => ({
    invalidateQueries: (/** @type {any} */ filtres) => {
      const clef = String(filtres?.queryKey?.[0] || '');
      mockCache.clefs.push(clef);
      return new Promise((resolve) => {
        mockCache.terminer.push(() => resolve(undefined));
      });
    },
  }),
}));

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL`.
jest.mock('@/services/team/teamService', () => ({
  createTeam: (/** @type {any} */ charge) => {
    mockCreations.push(charge);
    if (mockReponse.erreur) return Promise.reject(mockReponse.erreur);
    return Promise.resolve(mockReponse.team);
  },
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [{ documentId: 'act-1', name: 'Football' }], isLoading: false }),
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [{ documentId: 'cat-1', name: 'U15' }], isLoading: false }),
}));
jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({ data: [{ documentId: 'niv-1', name: 'Loisir' }], isLoading: false }),
}));
jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => ({ data: [{ documentId: 'sec-1', name: 'Masculin' }], isLoading: false }),
}));
jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => ({
    data: { documentId: 'club-1', members: [], name: 'FC Test' },
    isLoading: false,
  }),
}));

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockGabarits.push(props);
  return props.children;
});

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function MurMock(/** @type {any} */ props) {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN } = jest.requireActual('react-native');
    if (!props.isVisible) return null;
    return reactActuel.createElement(TexteRN, null, 'MUR PAYANT OUVERT');
  },
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

/**
 * Le dispatch du tunnel, capte pour semer le recapitulatif.
 * @type {(action: any) => void}
 */
let semer = () => {};

/**
 * Composant sans rendu : il capte le `dispatch` du tunnel.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  const { dispatch } = useTeamWizard();
  semer = dispatch;
  return null;
}

/** @type {any} */
let arbre;
/** @type {any} */
let racine;

/**
 * Monte l'ecran avec un recapitulatif complet.
 * @returns {{ gabarit: any }} L'ecran monte.
 */
const afficherLEcran = () => {
  mockGabarits.length = 0;
  mockCreations.length = 0;
  mockCache.clefs.length = 0;
  mockCache.terminer.length = 0;
  mockCache.partiesAvantLaPremiereFin = 0;
  racine = { reset: jest.fn() };
  const pilote = {
    getParent: () => racine,
    navigate: () => {},
    reset: jest.fn(),
  };
  const element = createElement(
    TeamWizardProvider,
    null,
    createElement(PriseDeCourant),
    createElement(TeamWizardRecap, { navigation: /** @type {any} */ (pilote) }),
  );

  act(() => { arbre = renderer.create(element); });
  act(() => {
    semer({ payload: { clubId: 'club-1' }, type: 'INIT_FROM_PARAMS' });
    semer({ payload: 'U15 Filles', type: 'SET_NAME' });
    semer({ payload: 'sec-1', type: 'SET_SECTION' });
    semer({ payload: 'act-1', type: 'SET_ACTIVITY' });
    semer({ payload: 'cat-1', type: 'SET_CATEGORY' });
    semer({ payload: 'niv-1', type: 'SET_LEVEL' });
    semer({ payload: ['moi'], type: 'SET_TRAINERS' });
  });

  return { gabarit: mockGabarits[mockGabarits.length - 1] };
};

/**
 * Appuie sur le bouton principal du gabarit d'etape (« Creer l'equipe »).
 * @returns {void}
 */
const creerLEquipe = () => {
  const gabarit = mockGabarits[mockGabarits.length - 1];
  expect(gabarit.isNextDisabled).toBe(false);
  act(() => gabarit.onNext());
};

/**
 * Laisse partir toutes les promesses en attente.
 * @returns {Promise<void>} Rien.
 */
const laisserRespirer = async () => {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  mockReponse.erreur = null;
  mockReponse.team = null;
  mockCompte.freeUsageSummary = [];
  mockCompte.subscriptionAccessLevel = 'FREE';
});

describe('D25 — etape 8/8 « Recapitulatif »', () => {
  test('son entete annonce l etape 8 sur 8 et le bouton « Creer l equipe »', () => {
    const { gabarit } = afficherLEcran();

    expect(gabarit.stepIndex).toBe(8);
    expect(gabarit.stepCount).toBe(8);
    expect(gabarit.nextLabel).toBe("Créer l'équipe");
  });

  test('il poste le club, le nom et les entraineurs choisis', async () => {
    afficherLEcran();
    mockReponse.team = { documentId: 'eq-neuve', name: 'U15 Filles' };

    creerLEquipe();
    await laisserRespirer();

    expect(mockCreations).toHaveLength(1);
    expect(mockCreations[0]).toMatchObject({
      activities: ['act-1'],
      category: 'cat-1',
      club: 'club-1',
      level: 'niv-1',
      name: 'U15 Filles',
      section: 'sec-1',
      trainers: ['moi'],
    });
  });

  test('apres creation, il rafraichit les equipes, le profil et le demarrage', async () => {
    afficherLEcran();
    mockReponse.team = { documentId: 'eq-neuve', name: 'U15 Filles' };

    creerLEquipe();
    await laisserRespirer();

    expect(mockCache.clefs).toEqual(
      expect.arrayContaining(['teams', 'get-me', 'app-bootstrap']),
    );
  });

  test('D25 ① — les trois rafraichissements partent DE FRONT, pas en file indienne', async () => {
    afficherLEcran();
    mockReponse.team = { documentId: 'eq-neuve', name: 'U15 Filles' };

    creerLEquipe();
    await laisserRespirer();

    // Les trois sont parties alors qu'AUCUNE n'a encore repondu : personne
    // n'attend l'aller-retour du voisin.
    expect(mockCache.clefs).toHaveLength(3);
    expect(mockCache.terminer).toHaveLength(3);
  });

  test('D25 ① — l ecran change de vue SANS attendre les rafraichissements', async () => {
    afficherLEcran();
    mockReponse.team = { documentId: 'eq-neuve', name: 'U15 Filles' };

    creerLEquipe();
    await laisserRespirer();

    // Aucune invalidation n'a repondu, et pourtant la navigation est deja faite.
    expect(mockCache.terminer).toHaveLength(3);
    expect(racine.reset).toHaveBeenCalledTimes(1);
  });

  test('un refus de quota ouvre le mur payant existant, sans alerte', async () => {
    afficherLEcran();
    mockReponse.erreur = {
      details: {
        decision: {
          allowed: false,
          paywall: 'TEAM_LIMIT',
          reason: 'FREE_QUOTA_EXHAUSTED',
          requiredPlan: ['TEAM'],
        },
      },
    };

    creerLEquipe();
    await laisserRespirer();

    expect(textesSous(arbre.root)).toContain('MUR PAYANT OUVERT');
  });

  test('le pied de page annonce la creation gratuite consommee', () => {
    mockCompte.freeUsageSummary = [{
      limit: 1, quotaType: 'FREE_TEAM', remaining: 1, used: 0,
    }];
    afficherLEcran();

    expect(textesSous(arbre.root)).toContain(
      'Cette équipe utilise ta création gratuite (1/1).',
    );
  });
});

// ---------------------------------------------------------------------------
// LOT EQUIPES (E6) — Q6 : JAMAIS UN ECRAN MUET.
//
// Demande d Adel du 28/08, mot pour mot :
//   « Felicitations, votre equipe est creee. Vous pourrez en profiter une fois
//     qu elle sera validee par votre dirigeant. »
//
// Avant ce lot, la creation reussie ne disait RIEN : l ecran se reinitialisait
// et la navigation repartait. C est le defaut qu Adel avait deja signale
// ailleurs (« l onboarding qui passe a l etape suivante sans rien dire »).
// ---------------------------------------------------------------------------
describe('EQUIPES — Q6 : la creation se dit', () => {
  /** @type {any} */
  let alerte;

  beforeEach(() => {
    alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alerte.mockRestore();
  });

  test('creation normale : l ecran felicite, il ne part pas en silence', async () => {
    mockReponse.team = { documentId: 'team-1', isAwaitingClubApproval: false };
    afficherLEcran();

    creerLEquipe();
    await laisserRespirer();

    expect(alerte).toHaveBeenCalled();
    const [titre, message] = alerte.mock.calls[0];
    expect(titre).toMatch(/Félicitations/i);
    expect(message).toMatch(/Félicitations/i);
    // ⛔ Et surtout PAS la phrase de validation : personne n attend ici.
    expect(message).not.toMatch(/validée par votre dirigeant/i);
  });

  test('equipe en attente : le texte est celui d Adel, MOT POUR MOT', async () => {
    // ⚠️ C est le SERVEUR qui tranche : l app lit `isAwaitingClubApproval` sur
    // l equipe rendue, elle ne le devine pas.
    mockReponse.team = { documentId: 'team-1', isAwaitingClubApproval: true };
    afficherLEcran();

    creerLEquipe();
    await laisserRespirer();

    const [, message] = alerte.mock.calls[0];
    expect(message).toContain('Félicitations, votre équipe est créée.');
    expect(message).toContain(
      "Vous pourrez en profiter une fois qu'elle sera validée par votre dirigeant.",
    );
  });

  test('un refus ne felicite JAMAIS', async () => {
    mockReponse.erreur = new Error('Ton adhésion à ce club n est pas encore validée');
    afficherLEcran();

    creerLEquipe();
    await laisserRespirer();

    const titres = alerte.mock.calls.map((/** @type {any[]} */ appel) => String(appel[0]));
    expect(titres.join(' ')).not.toMatch(/Félicitations/i);
  });
});
