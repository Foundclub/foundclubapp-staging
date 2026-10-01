import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';

import CollectiviteRequests from '../CollectiviteRequests';

// 🏛️ COLLECTIVITES 1c — ECRAN 3 : « Demandes de la Ville » (SPEC §2 E).
//
// De bout en bout cote app : les VRAIES lectures (collectiviteQueries) et les VRAIES
// mutations du lot 3a (facilityQueries -> facilityService). Seul le client HTTP est
// double : c est lui qui dit QUELLE route est appelee, avec QUEL corps.
// Ce que ce temoin fige (ROUGE avant l ecran 3 : l ecran n existait pas) :
//   - une demande en attente dit qui (club, equipe, la personne), quoi (installation,
//     moment, chaque semaine), le motif, et le conflit (qui occupe, place restante) ;
//   - accepter AVEC un message -> POST /facility-override-requests/:id/approve,
//     { data: { decisionReason: <message> } } ;
//   - refuser exige un motif ; avec lui -> POST .../refuse ;
//   - une place prise entre-temps (409 FACILITY_OVERRIDE_CAPACITY_CHANGED) se dit en
//     francais, pas en code ;
//   - l onglet « Traitees » montre la decision et le message ;
//   - la notification d une nouvelle demande (ctaRoute pose par le serveur) mene ICI.

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: jest.fn(),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: { collectiviteId: 'ville-de-recette' } }),
}));

jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        let texte = cle;
        if (typeof valeur === 'string') texte = valeur;
        else if (typeof repli === 'string') texte = repli;
        return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''));
      },
    }),
  };
});

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

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const reactActuel = jest.requireActual('react');
  const {
    Text: TexteRN, TouchableOpacity: PressableRN, View: VueRN,
  } = jest.requireActual('react-native');
  return function SegmentedControlMock(/** @type {any} */ props) {
    return reactActuel.createElement(VueRN, null, props.options.map((/** @type {any} */ option) => (
      reactActuel.createElement(
        PressableRN,
        {
          key: option.value,
          onPress: () => props.onChange(option.value),
          testID: `onglet-${option.value}`,
        },
        reactActuel.createElement(TexteRN, null, option.label),
      )
    )));
  };
});

const VILLE = { documentId: 'ville-de-recette', name: 'Ville de Recette', type: 'commune' };
const EN_ATTENTE = {
  club: { documentId: 'club-b', name: 'Test Fc' },
  conflict: {
    maxSlots: 1,
    occupants: [{
      club: 'AIKI',
      end: '2030-10-07T17:30:00.000Z',
      start: '2030-10-07T16:00:00.000Z',
      team: 'Seniors',
    }],
    remaining: 0,
  },
  documentId: 'rq-1',
  event: {
    documentId: 'ev-1', isRecurring: true, name: '', type: { name: 'Entraînement' },
  },
  facility: { documentId: 'gymnase', name: 'Gymnase de la Recette' },
  reason: 'Match de coupe avancé',
  requestedBy: { documentId: 'u-paul', firstname: 'Paul', lastname: 'Veuillet' },
  requestedEnd: '2030-10-07T17:30:00.000Z',
  requestedStart: '2030-10-07T16:00:00.000Z',
  status: 'pending',
  team: { documentId: 'team-b', name: 'U15' },
};
const TRAITEE = {
  ...EN_ATTENTE,
  conflict: undefined,
  decisionReason: 'Partagez le plateau',
  documentId: 'rq-0',
  status: 'approved',
};

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

// Le composant pressable (TouchableOpacity) porte `onPress` ; ses vues natives, non.
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID, index = 0) => {
  const pressables = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === testID
    && typeof n.props?.onPress === 'function');
  await act(async () => {
    await pressables[index].props.onPress();
  });
};

// Les lectures react-query se livrent sur un tour d horloge ; sur un PC charge, UN tour ne
// suffit pas. On attend donc que l ecran AFFICHE ce qu on attend, borne a 3 s.
jest.setTimeout(20000);
const attendre = async (/** @type {() => boolean} */ condition) => {
  for (let essai = 0; essai < 150 && !condition(); essai += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((r) => { setTimeout(r, 20); }); });
  }
};

const monter = async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <CollectiviteRequests />
      </QueryClientProvider>,
    );
  });
  await attendre(() => textes(arbre).includes('Test Fc · U15'));
  return arbre;
};

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockGet.mockImplementation(async (/** @type {string} */ url, /** @type {any} */ config) => {
    if (url === '/collectivites/mine') return { data: { data: [VILLE] } };
    if (url === '/collectivites/ville-de-recette/requests') {
      return { data: { data: config?.params?.status === 'decided' ? [TRAITEE] : [EN_ATTENTE] } };
    }
    throw new Error(`GET inattendu ${url}`);
  });
  mockPost.mockResolvedValue({ data: { data: { documentId: 'rq-1' } } });
});

describe('COLLECTIVITES 1c — écran 3 : « Demandes de la Ville »', () => {
  it('une demande en attente dit qui, quoi, le motif, et le conflit', async () => {
    const lus = textes(await monter());
    expect(lus).toEqual(expect.arrayContaining([
      'Test Fc · U15',
      'Demandé par Paul Veuillet',
      'Chaque semaine',
      'Motif : Match de coupe avancé',
      'Place restante : 0 sur 1',
    ]));
    expect(lus.some((texte) => texte.startsWith('Gymnase de la Recette · '))).toBe(true);
    expect(lus.some((texte) => texte.startsWith('Déjà là : AIKI · Seniors ('))).toBe(true);
    expect(lus).toContain('En attente (1)');
  });

  it('accepter AVEC un message appelle la route du propriétaire, message compris', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'bouton-Accepter');
    await act(async () => {
      arbre.root.findByType(TextInput).props.onChangeText('Partagez le plateau');
    });
    await appuyer(arbre, 'bouton-Accepter', 1);
    expect(mockPost).toHaveBeenCalledWith(
      '/facility-override-requests/rq-1/approve',
      { data: { decisionReason: 'Partagez le plateau' } },
    );
  });

  it('refuser exige un motif ; avec lui, la route de refus', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'bouton-Refuser');
    await appuyer(arbre, 'bouton-Refuser', 1);
    expect(mockPost).not.toHaveBeenCalled();
    expect(textes(arbre)).toContain('Écrivez le motif : le club le lira.');
    await act(async () => {
      arbre.root.findByType(TextInput).props.onChangeText('Forum des associations');
    });
    await appuyer(arbre, 'bouton-Refuser', 1);
    expect(mockPost).toHaveBeenCalledWith(
      '/facility-override-requests/rq-1/refuse',
      { data: { decisionReason: 'Forum des associations' } },
    );
  });

  it('une place prise entre-temps (409) se dit en français, pas en code', async () => {
    mockPost.mockRejectedValue({
      details: { code: 'FACILITY_OVERRIDE_CAPACITY_CHANGED' },
      message: 'Plus de place',
      status: 409,
    });
    const arbre = await monter();
    await appuyer(arbre, 'bouton-Accepter');
    await appuyer(arbre, 'bouton-Accepter', 1);
    const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
    expect(textes(arbre)).toContain(catalogue.APIerrors.FACILITY_OVERRIDE_CAPACITY_CHANGED);
  });

  it('l onglet « Traitées » montre la décision et le message', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'onglet-decided');
    await attendre(() => textes(arbre).includes('Acceptée'));
    expect(textes(arbre))
      .toEqual(expect.arrayContaining(['Acceptée', 'Votre message : Partagez le plateau']));
  });

  it('la notification d une nouvelle demande (ctaRoute du serveur) mène à cet écran', () => {
    const destination = resolveNotificationDestination({
      ctaParams: { collectiviteId: 'ville-de-recette' },
      ctaRoute: 'CollectiviteRequests',
      eventId: 'ev-1',
      type: 'overbookingRequest',
    });
    expect(destination).toEqual({
      params: { collectiviteId: 'ville-de-recette' },
      route: 'CollectiviteRequests',
    });
  });
});
