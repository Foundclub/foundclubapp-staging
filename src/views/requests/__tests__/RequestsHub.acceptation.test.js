import { QueryClient } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import {
  acceptTeamMembershipRequest,
} from '@/services/teamMembershipRequest/teamMembershipRequestService';

import RequestsHub from '../RequestsHub';

/**
 * Y04 — CE QUI SE PASSE QUAND ON APPUIE SUR « ACCEPTER », ET QUAND CA RATE.
 *
 * Constat d Adel du 2026-08-19 : « C est tres long quand on appuie sur
 * accepter. On devrait avoir un pop-up "felicitations, demande acceptee". »
 *
 * ⏱️ POURQUOI C ETAIT LONG — mesure, pas supposition. Le code attendait
 * `invalidateAfterAction`, et la promesse rendue par `invalidateQueries` n est
 * tenue qu une fois toutes les requetes ACTIVES relues (query-core 5.85.9,
 * queryClient.js:157-163). `acceptRequest` declare DOUZE racines. L acceptation
 * elle-meme est un seul POST : tout le reste etait de l attente de relecture.
 * Le temoin de vitesse ci-dessous chiffre cet ecart avec un vrai `QueryClient`.
 *
 * 🔒 ET LE TEMOIN QUI COMPTE LE PLUS : une acceptation qui ECHOUE n affiche
 * AUCUNE felicitation. Se tromper dans ce sens fait croire que c est fait.
 */

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

jest.mock('@/services/clubInterestRequest/clubInterestRequestService', () => ({
  CLUB_INTEREST_RESPONSE_PRESETS: [{ key: 'thanks', label: 'Merci' }],
  respondClubInterestRequest: jest.fn(),
}));

jest.mock('@/services/clubMembershipRequest/clubMembershipRequestService', () => ({
  acceptClubMembershipRequest: jest.fn(),
  rejectClubMembershipRequest: jest.fn(),
}));

jest.mock('@/services/event/eventService', () => ({
  approveFeatured: jest.fn(),
  cancelEvent: jest.fn(),
  rejectFeatured: jest.fn(),
  updateEvent: jest.fn(),
}));

jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  acceptEventParticipation: jest.fn(),
  declineEventParticipation: jest.fn(),
}));

jest.mock('@/services/facility/facilityService', () => ({
  approveFacilityOverrideRequest: jest.fn(),
  refuseFacilityOverrideRequest: jest.fn(),
}));

jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  acceptTeamMembershipRequest: jest.fn(),
  rejectTeamMembershipRequest: jest.fn(),
}));

const mockUseRequestsHubData = jest.fn();
jest.mock('@/services/requests/requestsHubQueries', () => ({
  getRequestsHubQueryKey: () => ['requestsHub'],
  useRequestsHubData: (/** @type {any} */ context, /** @type {any} */ options) => (
    mockUseRequestsHubData(context, options)
  ),
}));

let mockClientDeTest = /** @type {any} */ (null);
jest.mock('@tanstack/react-query', () => {
  const reel = jest.requireActual('@tanstack/react-query');
  return { ...reel, useQueryClient: () => mockClientDeTest };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ _key, /** @type {string} */ fallback) => fallback,
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    canEditClub: () => false,
    canManageTeam: true,
    clubVerificationSummary: null,
    userData: {
      documentId: 'u-coach',
      trainedTeams: [{ documentId: 'team-1', name: 'U15 Maison' }],
    },
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

jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => <View>{props.children}</View>,
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
  /**
   * Echelle de style tolerante : un enfant qui demande une valeur inattendue ne
   * doit pas faire tomber le filet.
   * @returns {any} Un objet qui repond a tout.
   */
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

const alerte = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});

const navigation = {
  addListener: jest.fn(() => () => {}),
  canGoBack: () => false,
  goBack: jest.fn(),
  navigate: jest.fn(),
};

const DEMANDE_EQUIPE = {
  actions: { primary: 'accept', secondary: 'reject' },
  createdAt: '2026-08-18T09:00:00.000Z',
  id: 'team:request-1',
  meta: { requesterName: 'Zinedine', requestId: 'request-1', teamName: 'U15 Maison' },
  status: 'pending',
  subtitle: 'Zinedine veut rejoindre U15 Maison.',
  title: 'Demande d equipe',
  type: 'team',
};

/** Le temps qu une relecture met a revenir, une fois marquee perimee. */
const LATENCE_RELECTURE_MS = 40;

/**
 * Les douze racines que `acceptRequest` perime, posees comme requetes ACTIVES
 * et lentes : c est ce que l ecran attendait avant ce lot.
 * @param {QueryClient} client Le cache de test.
 * @returns {Promise<any>} Le compteur des relectures reellement parties.
 */
const poserDesRelecturesLentes = async (client) => {
  const racines = [
    ['requestsHub'], ['teamMembershipRequests'], ['clubMembershipRequests'],
    ['clubInterestRequests'], ['pendingEvents'], ['pending-featured-requests'],
    ['facility-override-requests'], ['teams'], ['team'], ['events'],
    ['planning'], ['home-summary'],
  ];
  const lectures = jest.fn();

  // ⚠️ LA MEME `queryFn` DANS LES DEUX, et ce n'est pas de la redondance :
  // `refetchQueries` appelle `query.fetch()`, qui lit `query.options.queryFn` —
  // c'est-a-dire les options du DERNIER observateur pose. Un observateur sans
  // `queryFn` l'efface, la relecture part en « Missing queryFn », et le temoin
  // ne mesure plus rien.
  const optionsDe = (queryKey) => ({
    queryFn: () => new Promise((resolve) => {
      lectures(String(queryKey[0]));
      setTimeout(() => resolve({ valeur: 'lue' }), LATENCE_RELECTURE_MS);
    }),
    queryKey,
  });

  await Promise.all(racines.map((queryKey) => client.fetchQuery(optionsDe(queryKey))));

  // ⚠️ Sans observateur, react-query considere la requete INACTIVE et
  // `invalidateQueries` ne la relit pas (`refetchType` vaut `active`). On pose
  // donc le MINIMUM que `Query.isActive()` regarde : `options.enabled`
  // (query.ts:257-261). Un vrai `QueryObserver` ferait deux degats — il
  // ecraserait `query.options.queryFn`, et son abonnement declencherait des
  // lectures que ce temoin compterait a tort.
  racines.forEach((queryKey) => {
    client.getQueryCache().find({ queryKey })?.addObserver(/** @type {any} */ ({
      onQueryUpdate: () => {},
      options: { enabled: true },
      shouldFetchOnReconnect: () => false,
      shouldFetchOnWindowFocus: () => false,
    }));
  });

  lectures.mockClear();
  return lectures;
};

let arbreMonte = /** @type {any} */ (null);

/**
 * Monte l ecran avec les elements donnes.
 * @param {any[]} items Les demandes a afficher.
 * @param {any[]} [errors] Les sources en panne.
 * @returns {Promise<any>} L arbre rendu.
 */
const monterLeHub = async (items, errors = []) => {
  mockUseRequestsHubData.mockReturnValue({
    data: { counts: { team: items.length, total: items.length }, errors, items },
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  });

  await act(async () => {
    arbreMonte = renderer.create(
      <RequestsHub navigation={navigation} route={{ params: {} }} />,
    );
  });
  return arbreMonte;
};

/**
 * Tous les textes rendus, aplatis.
 * @param {any} node Le noeud de depart.
 * @returns {string[]} Les chaines trouvees.
 */
const collecterTexte = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collecterTexte);
  return collecterTexte(node.children);
};

/**
 * Le bouton portant ce titre, s il existe.
 * @param {any} tree L arbre rendu.
 * @param {string} titre Le libelle cherche.
 * @returns {any} Le noeud, ou undefined.
 */
const bouton = (tree, titre) => tree.root.findAll(
  (/** @type {any} */ node) => node.props?.title === titre,
  { deep: true },
)[0];

/**
 * Declenche « accepter » sur la demande d equipe.
 * @param {any} tree L arbre rendu.
 * @returns {Promise<number>} Le temps rendu a l utilisateur, en millisecondes.
 */
const accepter = async (tree) => {
  const carte = tree.root.findAll(
    (/** @type {any} */ node) => typeof node.props?.onPrimaryPress === 'function'
      && node.props?.item?.id === DEMANDE_EQUIPE.id,
    { deep: true },
  )[0];
  expect(carte).toBeDefined();

  const debut = Date.now();
  await act(async () => { await carte.props.onPrimaryPress(carte.props.item); });
  return Date.now() - debut;
};

describe('Y04 — accepter une demande : la fenetre, la vitesse, et l echec', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClientDeTest = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    if (arbreMonte) {
      await act(async () => { arbreMonte.unmount(); });
      arbreMonte = null;
    }
    mockClientDeTest.clear();
  });

  it('temoin 3 — une source en panne propose « Reessayer »', async () => {
    const tree = await monterLeHub([], [{ message: 'boom', source: 'friendly', status: 500 }]);
    const rendu = collecterTexte(tree.toJSON()).join(' | ');

    // La banniere nomme toujours la section...
    expect(rendu).toContain('Match amical');
    expect(rendu).toContain('indisponible');
    // ...mais elle offre desormais une sortie.
    expect(bouton(tree, 'Réessayer')).toBeDefined();
  });

  it('temoin 4 — accepter une adhesion d equipe affiche la fenetre DE L EQUIPE', async () => {
    /** @type {any} */ (acceptTeamMembershipRequest).mockResolvedValue({ ok: true });
    const tree = await monterLeHub([DEMANDE_EQUIPE]);

    expect(collecterTexte(tree.toJSON()).join(' | ')).not.toContain('Félicitations');

    await accepter(tree);
    const rendu = collecterTexte(tree.toJSON()).join(' | ');

    expect(rendu).toContain('Félicitations');
    expect(rendu).toContain("Zinedine rejoint l'équipe.");
    // ⛔ Pas le texte generique : c est tout l objet de la demande d Adel.
    expect(rendu).not.toContain('La demande est acceptée.');
    // Et la ligne acceptee a quitte la liste sans attendre la relecture.
    expect(rendu).not.toContain('Zinedine veut rejoindre U15 Maison.');
  });

  it('temoin 6 — une acceptation qui ECHOUE n affiche AUCUNE felicitation', async () => {
    /** @type {any} */ (acceptTeamMembershipRequest).mockRejectedValue(new Error('Refus serveur'));
    const tree = await monterLeHub([DEMANDE_EQUIPE]);

    await accepter(tree);
    const rendu = collecterTexte(tree.toJSON()).join(' | ');

    expect(rendu).not.toContain('Félicitations');
    // L echec, lui, se voit — et la demande reste a traiter.
    expect(alerte).toHaveBeenCalled();
    expect(rendu).toContain('Zinedine veut rejoindre U15 Maison.');
  });

  it('temoin de vitesse — la main revient sans attendre les douze relectures', async () => {
    /** @type {any} */ (acceptTeamMembershipRequest).mockResolvedValue({ ok: true });
    const lectures = await poserDesRelecturesLentes(mockClientDeTest);
    const tree = await monterLeHub([DEMANDE_EQUIPE]);

    const attente = await accepter(tree);

    // AVANT ce lot : on attendait la relecture de douze racines, donc au moins
    // une latence complete. APRES : l acceptation seule, qui est instantanee
    // ici. La borne est large exprES — ce temoin doit mesurer un ORDRE de
    // grandeur, pas la vitesse de la machine qui l execute.
    // 📏 MESURE, ROUGE puis VERT, avec 40 ms de latence simulee par racine :
    //    avant ce lot 300 ms · apres 17 ms. Sur un vrai reseau, ou une lecture
    //    coute 200 a 800 ms, l ecart se multiplie d autant.
    expect(attente).toBeLessThan(LATENCE_RELECTURE_MS);
    // ✅ Et les douze relectures sont bel et bien PARTIES : ne pas les attendre
    // n est pas ne pas les faire. C est la contrepartie du temoin ci-dessus, et
    // sans elle il suffirait de supprimer l invalidation pour le rendre vert.
    expect(lectures.mock.calls.map(([racine]) => racine).sort()).toEqual([
      'clubInterestRequests', 'clubMembershipRequests', 'events',
      'facility-override-requests', 'home-summary', 'pending-featured-requests',
      'pendingEvents', 'planning', 'requestsHub', 'team', 'teamMembershipRequests',
      'teams',
    ]);
  });
});
