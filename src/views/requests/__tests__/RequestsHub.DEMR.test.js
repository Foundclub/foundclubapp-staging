import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RefreshControl } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getClubInterestRequests } from '@/services/clubInterestRequest/clubInterestRequestService';
import {
  getClubMembershipRequests,
} from '@/services/clubMembershipRequest/clubMembershipRequestService';
import {
  getEvents,
  getMyPendingEventTeamInvitations,
  getPendingEventParticipationRequestsForHub,
  getPendingFeaturedRequests,
} from '@/services/event/eventService';
import { getPendingFacilityOverrideRequests } from '@/services/facility/facilityService';
import {
  getMyFriendlyMatchAds,
  getMyFriendlyMatchApplications,
} from '@/services/friendlyMatch/friendlyMatchService';
import { getRequestsHubData } from '@/services/requests/requestsHubService';
import {
  getTeamMembershipRequests,
} from '@/services/teamMembershipRequest/teamMembershipRequestService';

import RequestsHub from '../RequestsHub';

/**
 * DEMR / T3 + T4 — L'ONGLET « DEMANDES » AVEC SON VRAI HOOK.
 *
 * Adel, 16/09 : « il peut charger en illimite ; pour afficher les demandes il
 * faut le recharger ; et c'est hyper long ».
 *
 * 🧨 POURQUOI LES QUATRE TEMOINS D'ECRAN EXISTANTS NE POUVAIENT RIEN VOIR : ils
 * remplacent `useRequestsHubData` par une valeur fixe (`isLoading: false`). Ici,
 * le hook, le service du hub et react-query sont les VRAIS ; seules les lectures
 * HTTP de chaque source sont doublees, et chacune reste EN VOL tant que le
 * temoin ne la libere pas.
 *
 * T3 — le premier chargement montre « chargement », jamais « Aucune demande en
 *      attente » (`placeholderData` rendait `isLoading` faux pour toujours).
 * T4 — un retour sur l'onglet pendant une lecture ne lance pas une deuxieme
 *      chaine ; une relecture qui en remplace une autre COUPE l'ancien HTTP ;
 *      une chaine paginee coupee ne demande pas la page suivante.
 */

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

jest.mock('@/services/clubInterestRequest/clubInterestRequestService', () => ({
  CLUB_INTEREST_RESPONSE_PRESETS: [{ key: 'thanks', label: 'Merci' }],
  getClubInterestRequests: jest.fn(),
  respondClubInterestRequest: jest.fn(),
}));

jest.mock('@/services/clubMembershipRequest/clubMembershipRequestService', () => ({
  acceptClubMembershipRequest: jest.fn(),
  getClubMembershipRequests: jest.fn(),
  rejectClubMembershipRequest: jest.fn(),
}));

jest.mock('@/services/event/eventService', () => ({
  approveFeatured: jest.fn(),
  cancelEvent: jest.fn(),
  getEvents: jest.fn(),
  getMyPendingEventTeamInvitations: jest.fn(),
  getPendingEventParticipationRequestsForHub: jest.fn(),
  getPendingFeaturedRequests: jest.fn(),
  rejectFeatured: jest.fn(),
  updateEvent: jest.fn(),
}));

jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  acceptEventParticipation: jest.fn(),
  declineEventParticipation: jest.fn(),
}));

jest.mock('@/services/facility/facilityService', () => ({
  approveFacilityOverrideRequest: jest.fn(),
  getPendingFacilityOverrideRequests: jest.fn(),
  refuseFacilityOverrideRequest: jest.fn(),
}));

jest.mock('@/services/friendlyMatch/friendlyMatchService', () => ({
  getMyFriendlyMatchAds: jest.fn(),
  getMyFriendlyMatchApplications: jest.fn(),
}));

jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  acceptTeamMembershipRequest: jest.fn(),
  getTeamMembershipRequests: jest.fn(),
  rejectTeamMembershipRequest: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ _key, /** @type {string} */ fallback) => fallback,
  }),
}));

let mockUserData = /** @type {any} */ (null);
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    canEditClub: () => false,
    canManageTeam: true,
    clubVerificationSummary: null,
    userData: mockUserData,
  }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startWhisperChat: jest.fn() }),
}));

jest.mock('@/context/ClubScopeContext', () => ({ useClubScope: () => ({}) }));

jest.mock('@/domains/guidance/guidanceRuntime', () => ({
  emitGuidanceAction: jest.fn(),
  emitGuidanceInteraction: jest.fn(),
}));

jest.mock('@/components/templates/ScreenContainer', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => <View>{props.children}</View>,
  };
});

// Le contrat de WithDataWrapper, tel qu'il est : les enfants sont TOUJOURS
// rendus ; un chargement ajoute un squelette, une erreur un pave. On en garde
// la trace lisible pour le temoin.
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  // eslint-disable-next-line global-require
  const { Text, View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (
      <View>
        {props.isLoading ? <Text>[squelette]</Text> : null}
        {props.error ? <Text>{`[pave-erreur] ${props.error}`}</Text> : null}
        {props.children}
      </View>
    ),
  };
});

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/theme/themeContext', () => {
  const anyScale = () => new Proxy({}, {
    get: (/** @type {any} */ _target, /** @type {any} */ key) => (
      typeof key === 'symbol' ? undefined : anyScale()
    ),
  });

  return {
    __esModule: true,
    default: () => ({
      Alignments: anyScale(),
      ApplicationStyle: anyScale(),
      Colors: new Proxy({}, {
        get: (/** @type {any} */ _target, /** @type {any} */ key) => (
          typeof key === 'symbol' ? undefined : 'couleur'
        ),
      }),
      Fonts: anyScale(),
      Images: anyScale(),
      Spaces: anyScale(),
    }),
  };
});

// Le premier montage de cet ecran charge des dizaines de modules : a froid et
// sous charge, il depasse les 5 s par defaut de Jest (mesure : 29 s pour le
// fichier dans une passe groupee). Ces temoins COMPTENT, ils ne chronometrent
// rien : la marge ne change aucun verdict.
jest.setTimeout(30_000);

const CHARGEMENT = 'Chargement des demandes...';
const VIDE = 'Aucune demande en attente';

const PAGE_VIDE = {
  data: [],
  meta: {
    pagination: {
      page: 1, pageCount: 1, pageSize: 50, total: 0,
    },
  },
};

const ACTIVITE_AVEC_DEMANDE = {
  date: '2026-09-20T10:00:00.000Z',
  documentId: 'event-1',
  name: 'Seance du samedi',
  participationRequests: [{
    createdAt: '2026-09-16T08:00:00.000Z',
    documentId: 'request-1',
    isActive: true,
    participationStatus: 'pending',
    user: { documentId: 'user-1', firstname: 'Karim', lastname: 'Benali' },
  }],
  team: { documentId: 'team-1', name: 'Senior' },
  type: { documentId: 'type-1', name: 'Entrainement' },
};

/**
 * Une promesse pilotable.
 * @returns {{ promise: Promise<any>, reject: (e: any) => void, resolve: (v: any) => void }}
 */
const deferred = () => {
  /** @type {any} */
  let resolve;
  /** @type {any} */
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
};

/**
 * Les lectures de la source « event » en vol — par l'ancien chemin (`getEvents`)
 * comme par la route dediee : le temoin ne presume pas du chemin emprunte.
 * @type {Array<{ deferred: ReturnType<typeof deferred>, signal: AbortSignal | undefined }>}
 */
let lecturesEvenement = [];

const lireEvenement = (/** @type {any} */ _params, /** @type {any} */ options) => {
  const lecture = { deferred: deferred(), signal: options?.signal };
  lecturesEvenement.push(lecture);
  return lecture.deferred.promise;
};

const listeners = /** @type {Record<string, () => void>} */ ({});
const navigation = {
  addListener: jest.fn((/** @type {string} */ event, /** @type {() => void} */ callback) => {
    listeners[event] = callback;
    return () => { delete listeners[event]; };
  }),
  canGoBack: () => false,
  goBack: jest.fn(),
  navigate: jest.fn(),
};

/** @type {QueryClient} */
let client;
/** @type {any} */
let arbre = null;

/**
 * Tous les textes affiches, dans l'ordre.
 * @returns {string} Les textes, joints.
 */
const textes = () => {
  const out = /** @type {string[]} */ ([]);
  const walk = (/** @type {any} */ node) => {
    if (node == null) return;
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    (node.children || []).forEach(walk);
  };
  walk(arbre.toJSON());
  return out.join(' | ');
};

// react-query diffuse ses changements d'etat sur un minuteur a 0 ms
// (`notifyManager`) : attendre les seules micro-taches ne suffit pas.
const vider = async () => {
  await act(async () => {
    for (let tour = 0; tour < 5; tour += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => { setTimeout(resolve, 0); });
    }
  });
};

const monter = async () => {
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <RequestsHub navigation={navigation} route={{ params: {} }} />
      </QueryClientProvider>,
    );
  });
  await vider();
};

const libererLecture = async (/** @type {number} */ index, /** @type {any} */ value) => {
  await act(async () => {
    lecturesEvenement[index].deferred.resolve(value);
  });
  await vider();
};

const refuserLecture = async (/** @type {number} */ index, /** @type {any} */ error) => {
  await act(async () => {
    lecturesEvenement[index].deferred.reject(error);
  });
  await vider();
};

const tirerPourRafraichir = async () => {
  const controle = arbre.root.findByType(RefreshControl);
  await act(async () => {
    controle.props.onRefresh();
  });
  await vider();
};

const revenirSurOnglet = async () => {
  expect(typeof listeners.focus).toBe('function');
  await act(async () => {
    listeners.focus();
  });
  await vider();
};

const chargerUneFois = async () => {
  await monter();
  expect(lecturesEvenement).toHaveLength(1);
  await libererLecture(0, { data: [ACTIVITE_AVEC_DEMANDE], meta: PAGE_VIDE.meta });
  expect(textes()).toContain('Karim Benali');
};

beforeEach(() => {
  jest.clearAllMocks();
  lecturesEvenement = [];
  Object.keys(listeners).forEach((key) => delete listeners[key]);
  mockUserData = {
    club: { documentId: 'club-1' },
    documentId: 'u-dirigeant',
    trainedTeams: [],
  };
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  /** @type {jest.Mock} */ (getClubInterestRequests).mockResolvedValue(PAGE_VIDE);
  /** @type {jest.Mock} */ (getClubMembershipRequests).mockResolvedValue(PAGE_VIDE);
  /** @type {jest.Mock} */ (getEvents).mockImplementation(lireEvenement);
  /** @type {jest.Mock} */ (getPendingEventParticipationRequestsForHub)
    .mockImplementation(lireEvenement);
  /** @type {jest.Mock} */ (getMyPendingEventTeamInvitations).mockResolvedValue([]);
  /** @type {jest.Mock} */ (getPendingFeaturedRequests).mockResolvedValue({ data: [] });
  /** @type {jest.Mock} */ (getPendingFacilityOverrideRequests).mockResolvedValue({ data: [] });
  /** @type {jest.Mock} */ (getMyFriendlyMatchAds).mockResolvedValue([]);
  /** @type {jest.Mock} */ (getMyFriendlyMatchApplications).mockResolvedValue([]);
  /** @type {jest.Mock} */ (getTeamMembershipRequests).mockResolvedValue(PAGE_VIDE);
});

afterEach(async () => {
  jest.restoreAllMocks();
  if (arbre) {
    await act(async () => { arbre.unmount(); });
    arbre = null;
  }
  client.clear();
});

describe('DEMR / T3 — le premier chargement se dit', () => {
  it('T3.1 — premiere lecture : « chargement », jamais « Aucune demande en attente »', async () => {
    await monter();

    expect(lecturesEvenement).toHaveLength(1);
    const affiche = textes();
    expect({ chargement: affiche.includes(CHARGEMENT), vide: affiche.includes(VIDE) })
      .toEqual({ chargement: true, vide: false });
  });

  it('T3.2 — a l arrivee des donnees, le chargement part et la demande s affiche', async () => {
    await monter();
    await libererLecture(0, { data: [ACTIVITE_AVEC_DEMANDE], meta: PAGE_VIDE.meta });

    const affiche = textes();
    expect(affiche).toContain('Karim Benali');
    expect(affiche).not.toContain(CHARGEMENT);
    expect(affiche).not.toContain('[squelette]');
  });

  it('T3.3 — un club sans demande finit bien sur « Aucune demande en attente »', async () => {
    await monter();
    await libererLecture(0, PAGE_VIDE);

    const affiche = textes();
    expect(affiche).toContain(VIDE);
    expect(affiche).not.toContain(CHARGEMENT);
  });

  it('T3.4 — en cas d echec, le chargement disparait et « Réessayer » apparait', async () => {
    await monter();
    await refuserLecture(0, { message: 'Internal Server Error', status: 500 });

    expect(textes()).not.toContain(CHARGEMENT);
    const boutons = arbre.root.findAll(
      (/** @type {any} */ node) => node.props?.title === 'Réessayer',
    );
    expect(boutons.length).toBeGreaterThan(0);
  });

  it('T3.5 — un compte sans club ni equipe ne reste pas bloque sur « chargement »', async () => {
    mockUserData = { documentId: 'u-seul', trainedTeams: [] };
    await monter();

    expect(lecturesEvenement).toHaveLength(0);
    const affiche = textes();
    expect(affiche).toContain(VIDE);
    expect(affiche).not.toContain(CHARGEMENT);
  });
});

describe('DEMR / T4 — des relectures maitrisees', () => {
  it('T4.1 — revenir sur l onglet PENDANT une relecture ne lance pas une 2e chaine', async () => {
    await chargerUneFois();
    await tirerPourRafraichir();
    expect(lecturesEvenement).toHaveLength(2);

    await revenirSurOnglet();

    expect({ lectures: lecturesEvenement.length }).toEqual({ lectures: 2 });
    expect(lecturesEvenement[1].signal?.aborted ?? false).toBe(false);
  });

  it('T4.2 — revenir sur l onglet avec une liste FRAICHE (< 30 s) ne relit rien', async () => {
    await chargerUneFois();

    await revenirSurOnglet();

    expect({ lectures: lecturesEvenement.length }).toEqual({ lectures: 1 });
  });

  it('T4.3 — revenir sur l onglet avec une liste PERIMEE (> 30 s) relit, une fois', async () => {
    await chargerUneFois();
    const maintenant = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(maintenant + 31_000);

    await revenirSurOnglet();

    expect({ lectures: lecturesEvenement.length }).toEqual({ lectures: 2 });
  });

  it('T4.4 — une relecture qui en REMPLACE une autre coupe l ancien HTTP (signal)', async () => {
    await chargerUneFois();
    await tirerPourRafraichir();
    expect(lecturesEvenement).toHaveLength(2);
    const ancienne = lecturesEvenement[1];

    // Ce que fait une notification « nouvelle demande », ou une acceptation.
    await act(async () => {
      client.invalidateQueries({ queryKey: ['requestsHub'] }).catch(() => {});
    });
    await vider();

    expect({ coupe: ancienne.signal?.aborted ?? false, signalTransmis: Boolean(ancienne.signal) })
      .toEqual({ coupe: true, signalTransmis: true });
    expect(lecturesEvenement).toHaveLength(3);
  });

  it('T4.5 — une chaine paginee coupee ne demande PAS la page suivante', async () => {
    const page1 = deferred();
    /** @type {jest.Mock} */ (getTeamMembershipRequests).mockImplementation(
      (/** @type {any} */ _teamIds, /** @type {any} */ params) => (
        params?.page === 1 ? page1.promise : Promise.resolve(PAGE_VIDE)
      ),
    );
    /** @type {jest.Mock} */ (getPendingEventParticipationRequestsForHub)
      .mockResolvedValue({ data: [] });
    /** @type {jest.Mock} */ (getEvents).mockResolvedValue(PAGE_VIDE);

    const controller = new AbortController();
    const lecture = getRequestsHubData({ clubId: 'club-1' }, { signal: controller.signal });
    const issue = lecture.then(() => 'resolue', () => 'rejetee');
    await Promise.resolve();

    controller.abort();
    page1.resolve({
      data: [],
      meta: {
        pagination: {
          page: 1, pageCount: 3, pageSize: 50, total: 120,
        },
      },
    });

    expect(await issue).toBe('rejetee');
    const pagesDemandees = /** @type {jest.Mock} */ (getTeamMembershipRequests).mock.calls
      .map((/** @type {any[]} */ call) => call[1]?.page);
    expect(pagesDemandees).toEqual([1]);
  });
});
