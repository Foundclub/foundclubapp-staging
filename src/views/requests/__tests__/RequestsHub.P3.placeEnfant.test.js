import { QueryClient } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import {
  respondClubInterestRequest,
} from '@/services/clubInterestRequest/clubInterestRequestService';

import RequestsHub from '../RequestsHub';

/**
 * 👶 PARENT P3 (2026-09-11) — TRANCHER UNE PLACE DEMANDEE POUR UN ENFANT.
 *
 * Decision d'Adel du 11/09 (« 1- a ») : accepter fait entrer l'enfant dans
 * l'equipe ; refuser EFFACE la demande. Ce que ces temoins verrouillent :
 *  ① « Accepter » envoie `accept_child` — et ne passe PAS par la fenetre des
 *    messages types, qui laisserait la demande traitee sans l'enfant ;
 *  ② « Refuser » demande CONFIRMATION d'abord : le geste ne se rattrape pas ;
 *  ③ l'interet d'un ADULTE garde son chemin : « Repondre » n'appelle pas le
 *    serveur directement.
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
    t: (/** @type {string} */ _key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : fallback?.defaultValue || _key
    ),
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
      trainedTeams: [{ documentId: 'team-u11', name: 'U11' }],
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

const PLACE_POUR_LEA = {
  actions: { primary: 'accept', secondary: 'reject' },
  createdAt: '2026-09-11T09:00:00.000Z',
  id: 'interest:interest-lea',
  meta: {
    childAge: 7,
    childFirstname: 'Léa',
    childId: 'enfant-lea',
    clubId: 'club-1',
    requesterName: 'Karim Benali',
    requestId: 'interest-lea',
    teamName: 'U11',
  },
  status: 'pending',
  subtitle: 'Karim Benali demande une place pour Léa (7 ans) dans U11.',
  title: 'Place pour un enfant',
  type: 'interest',
};

const INTERET_ADULTE = {
  actions: { primary: 'respond', secondary: 'chat' },
  createdAt: '2026-09-11T09:00:00.000Z',
  id: 'interest:interest-adulte',
  meta: { requesterName: 'Mina Diallo', requestId: 'interest-adulte', teamName: 'U11' },
  status: 'pending',
  subtitle: 'Mina Diallo est intéressé par U11.',
  title: 'Intérêt club',
  type: 'interest',
};

let arbreMonte = /** @type {any} */ (null);

/**
 * Monte l ecran avec les demandes donnees.
 * @param {any[]} items Les demandes a afficher.
 * @returns {Promise<any>} L arbre rendu.
 */
const monterLeHub = async (items) => {
  mockUseRequestsHubData.mockReturnValue({
    data: { counts: { interest: items.length, total: items.length }, errors: [], items },
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
 * La carte d une demande, telle que l ecran la rend.
 * @param {any} tree L arbre rendu.
 * @param {string} id L identifiant de la demande.
 * @returns {any} Le noeud de la carte.
 */
const carteDe = (tree, id) => tree.root.findAll(
  (/** @type {any} */ node) => typeof node.props?.onPrimaryPress === 'function'
    && node.props?.item?.id === id,
  { deep: true },
)[0];

describe('P3 — trancher une place demandee pour un enfant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClientDeTest = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    respondClubInterestRequest.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    if (arbreMonte) act(() => { arbreMonte.unmount(); });
    arbreMonte = null;
  });

  test('① « Accepter » envoie `accept_child`, sans passer par les messages types', async () => {
    const tree = await monterLeHub([PLACE_POUR_LEA]);
    const carte = carteDe(tree, PLACE_POUR_LEA.id);
    expect(carte).toBeDefined();

    await act(async () => { await carte.props.onPrimaryPress(carte.props.item); });

    expect(respondClubInterestRequest).toHaveBeenCalledTimes(1);
    expect(respondClubInterestRequest).toHaveBeenCalledWith('interest-lea', {
      responseType: 'accept_child',
    });
    // 👶 PARENT-FINITIONS 5 — la fenetre dit que Lea ENTRE dans l'equipe (avant : « Ta réponse
    // est partie. », la phrase de l'interet d'un adulte).
    /**
     * Les textes rendus, aplatis.
     * @param {any} noeud Le noeud de départ.
     * @returns {string[]} Les chaînes trouvées.
     */
    const textes = (noeud) => {
      if (noeud === null || noeud === undefined) return [];
      if (typeof noeud === 'string') return [noeud];
      if (Array.isArray(noeud)) return noeud.flatMap(textes);
      return textes(noeud.children);
    };
    const texte = textes(tree.toJSON()).join(' | ');
    expect(texte).toContain('Léa rejoint U11.');
    expect(texte).not.toContain('Ta réponse est partie.');
  });

  test('② « Refuser » demande CONFIRMATION, et n envoie `refuse_child` qu apres', async () => {
    const tree = await monterLeHub([PLACE_POUR_LEA]);
    const carte = carteDe(tree, PLACE_POUR_LEA.id);

    await act(async () => { await carte.props.onSecondaryPress(carte.props.item); });

    expect(respondClubInterestRequest).not.toHaveBeenCalled();
    expect(alerte).toHaveBeenCalledTimes(1);
    const boutons = alerte.mock.calls[0][2] || [];
    const confirmer = boutons.find((/** @type {any} */ b) => b?.style === 'destructive');
    expect(confirmer).toBeDefined();

    await act(async () => { await confirmer.onPress(); });

    expect(respondClubInterestRequest).toHaveBeenCalledWith('interest-lea', {
      responseType: 'refuse_child',
    });
  });

  test('③ l interet d un ADULTE garde son chemin : « Repondre » n appelle rien', async () => {
    const tree = await monterLeHub([INTERET_ADULTE]);
    const carte = carteDe(tree, INTERET_ADULTE.id);

    await act(async () => { await carte.props.onPrimaryPress(carte.props.item); });

    expect(respondClubInterestRequest).not.toHaveBeenCalled();
  });

  // 👶 PARENT-FINITIONS 6 (14/10) — LE PARENT A RETIRE SA DEMANDE (PAR-L8) PENDANT QUE LE COACH
  // LA REGARDAIT. Avant : alerte « Erreur » avec le message brut anglais « Club interest request
  // not found », et la carte restait. Le serveur le dit par un 404 : avec le code
  // CLUB_INTEREST_REQUEST_GONE quand l'annulation gagne la course (relue sous le verrou de
  // l'enfant), sans code quand elle etait deja faite avant la lecture.
  test.each([
    ['le code GONE (annulation pendant la decision)', {
      details: { code: 'CLUB_INTEREST_REQUEST_GONE' },
      message: 'Club interest request not found',
      status: 404,
    }],
    ['un 404 sans code (annulation faite avant)', {
      message: 'Club interest request not found',
      status: 404,
    }],
  ])('④ accepter une demande retiree, %s : « Le parent a retiré cette demande. »', async (
    _cas,
    erreur,
  ) => {
    respondClubInterestRequest.mockRejectedValue(erreur);
    const relire = jest.spyOn(mockClientDeTest, 'invalidateQueries');
    const tree = await monterLeHub([PLACE_POUR_LEA]);
    const carte = carteDe(tree, PLACE_POUR_LEA.id);

    await act(async () => { await carte.props.onPrimaryPress(carte.props.item); });

    expect(alerte).toHaveBeenCalledTimes(1);
    const [titre, message] = alerte.mock.calls[0];
    expect(titre).toBe('Demande retirée');
    expect(message).toBe('Le parent a retiré cette demande.');
    expect(String(message)).not.toContain('not found');
    // La carte part tout de suite, et la liste se relit derriere.
    expect(carteDe(tree, PLACE_POUR_LEA.id)).toBeUndefined();
    expect(relire).toHaveBeenCalled();
  });

  // CORR-MESSAGERIE p62 (31/10) — les demandes soeurs restent ouvertes : un 2e club qui accepte
  // une enfant deja placee ailleurs bute sur le garde-fou du serveur. Il lit une phrase, pas
  // « Declared child already belongs to a team ».
  test('p62 : accepter une enfant deja placee ailleurs le dit en francais, et la carte reste', async () => {
    respondClubInterestRequest.mockRejectedValue({
      message: 'Declared child already belongs to a team',
      status: 400,
    });
    const tree = await monterLeHub([PLACE_POUR_LEA]);
    const carte = carteDe(tree, PLACE_POUR_LEA.id);

    await act(async () => { await carte.props.onPrimaryPress(carte.props.item); });

    const [titre, message] = alerte.mock.calls[alerte.mock.calls.length - 1];
    expect(titre).toBe('Déjà dans une équipe');
    expect(String(message)).not.toContain('already belongs');
    expect(String(message)).toContain('autre équipe');
    expect(carteDe(tree, PLACE_POUR_LEA.id)).toBeDefined();
  });

  test('④ une autre panne garde son message, et la carte reste', async () => {
    respondClubInterestRequest.mockRejectedValue(new Error('Network Error'));
    const tree = await monterLeHub([PLACE_POUR_LEA]);
    const carte = carteDe(tree, PLACE_POUR_LEA.id);

    await act(async () => { await carte.props.onPrimaryPress(carte.props.item); });

    expect(alerte).toHaveBeenCalledWith('Erreur', 'Network Error');
    expect(carteDe(tree, PLACE_POUR_LEA.id)).toBeDefined();
  });
});
