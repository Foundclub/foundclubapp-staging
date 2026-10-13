import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardRecap from '../EventWizardRecap';

// SERIE-ANNONCE (06/10/2026, decision du chef « serie A ») — L'ASSISTANT ANNONCE UNE SERIE
// UNE FOIS.
//
// Le constat (FINITIONS15 ⚖️ 1, tournee T14) : l'assistant pose les dates d'une serie 3 par 3 ;
// chaque POST /events annoncait (ou non) SA date, a un instant ou le serveur ignorait la serie
// entiere. La notification « Evenement publie » ne nommait qu'une date.
// Ce que ce fichier fige :
//   - une SERIE (plusieurs dates, un `recurrenceGroupId`) : chaque date part « j'annoncerai »
//     (`announceSeriesLater`), puis UN appel a « annoncer la serie », avec la premiere date ;
//   - une date SEULE : ni drapeau, ni appel (le serveur l'annonce a la creation, comme avant) ;
//   - « annoncer la serie » qui echoue (serveur ancien, reseau) ne bloque rien : l'ecran
//     suivant s'ouvre, aucune alerte. Le serveur a son filet (la serie s'annonce 5 min apres
//     sans l'appel) ; un serveur ancien, lui, a ignore le drapeau et annonce par l'ancien chemin.

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockProprietesDuGabarit = [];
/** Les dates que l'assistant pose (rendues par `createReccurrentEventPayload`). */
let mockDatesPosees = [];
const mockCreerEnLot = jest.fn();
const mockAnnoncerLaSerie = jest.fn();
const mockAlerte = jest.fn();

// COLL-R-APP-CREATION (13/10) — « la mairie décidera ? » a son propre témoin
// (useMairieDecideALaCreation.CRA4.test.js) : ici, la mairie ne décide pas.
jest.mock('../useMairieDecideALaCreation', () => ({
  __esModule: true,
  default: () => ({
    complet: false, deLaVille: false, mairie: false, tuAcceptes: false, ville: null,
  }),
}));
jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
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
      Images: { arrowLeft: 1, chevronDown: 1, close: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockProprietesDuGabarit.push(props);
  return null;
});

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    fetchQuery: () => Promise.resolve(null),
    invalidateQueries: () => Promise.resolve(),
    setQueryData: () => {},
  }),
}));

jest.mock('@/domains/auth/useAuth', () => {
  const { USER_ROLES } = jest.requireActual('@/domains/auth/authUseCases');
  return {
    __esModule: true,
    default: () => ({
      USER_ROLES,
      userData: { documentId: 'moi', role: { name: USER_ROLES.president, type: 'president' } },
    }),
  };
});

jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    createReccurrentEventPayload: () => mockDatesPosees,
    createStageEventPayload: () => ({ name: 'Un stage' }),
  }),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: () => {} }));

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL`.
jest.mock('@/services/event/eventService', () => ({
  announceEventSeries: (/** @type {any[]} */ ...args) => mockAnnoncerLaSerie(...args),
  createEventsWithConcurrency: (/** @type {any[]} */ ...args) => mockCreerEnLot(...args),
  // SERIES (08/10) — une serie part par `createEventSeries` (une requete) : le meme lot, vu d ici.
  createEventSeries: (/** @type {any[]} */ ...args) => mockCreerEnLot(...args),
  getEventById: () => Promise.resolve(null),
  requestFeatured: () => Promise.resolve(null),
  rollbackEventsByCancel: () => Promise.resolve([]),
}));

jest.mock('@/components/molecules/bottomModal/BottomModal', () => function FeuilleMock(
  /** @type {any} */ props,
) {
  return props.isVisible ? props.children : null;
});

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => () => null,
);

jest.mock('@/components/atoms/button/Button', () => function BoutonMock() {
  return null;
});

jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => () => null);

jest.mock('react-native/Libraries/Alert/Alert', () => {
  const mockModule = {
    alert: (/** @type {any[]} */ ...args) => mockAlerte(...args),
  };
  // RN 0.79 lit `require(module).default` : le mock sert les DEUX formes
  // (motif de GuideOffersRecap.test.js).
  return { ...mockModule, default: mockModule };
});

const ETAT = {
  date: new Date('2027-10-13T15:30:00.000Z'),
  endTime: new Date('2027-10-13T17:00:00.000Z'),
  facility: { documentId: 'inst-1', name: 'Gymnase' },
  location: 'Gymnase · 21 rue Fortia',
  sessionStatus: 'closed',
  startTime: new Date('2027-10-13T15:30:00.000Z'),
  team: {
    activities: [{ documentId: 'act-1', name: 'Football' }],
    club: { documentId: 'club-1', name: 'FC Test' },
    documentId: 'equipe-1',
    name: 'U15',
    sport: { documentId: 'sport-1', name: 'Football' },
  },
  type: { documentId: 'type-entrainement', name: 'Entrainement' },
  validationMode: 'auto',
};

/** Le dispatch du tunnel, capte pour semer l'etat de depart. */
let semer = () => {};

/**
 * Sonde sans rendu : elle expose le `dispatch` du tunnel.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  semer = useEventWizard().dispatch;
  return null;
}

/**
 * Pose les dates rendues par le serveur double : une par payload, la 1re a l'identifiant `ev-1`.
 * @param {any[]} payloads Les dates envoyees.
 * @returns {Promise<{ created: any[], failed: any[] }>} Le resultat du lot.
 */
const toutesPosees = async (payloads) => ({
  created: payloads.map((payload, index) => ({
    documentId: `ev-${index + 1}`,
    payload,
    response: { data: { documentId: `ev-${index + 1}` } },
  })),
  failed: [],
});

beforeEach(() => {
  mockProprietesDuGabarit.length = 0;
  mockCreerEnLot.mockReset();
  mockAnnoncerLaSerie.mockReset();
  mockAlerte.mockReset();
  mockCreerEnLot.mockImplementation(toutesPosees);
  mockAnnoncerLaSerie.mockResolvedValue({ data: { announced: true, count: 3 } });
});

/**
 * Appuie sur « Creer » et rend ce que l'ecran a fait.
 * @returns {Promise<{ reset: any[] }>} Les `navigation.reset` appeles.
 */
const creer = async () => {
  /** @type {any[]} */
  const reset = [];
  const navigation = {
    canGoBack: () => true,
    goBack: () => {},
    navigate: () => {},
    push: () => {},
    replace: () => {},
    reset: (/** @type {any} */ config) => { reset.push(config); },
  };
  const rendre = (/** @type {any} */ contenu) => createElement(
    EventWizardProvider,
    null,
    createElement(PriseDeCourant),
    contenu,
  );
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(rendre(null)); });
  act(() => semer({ payload: ETAT, type: 'SET_META' }));
  act(() => {
    arbre.update(rendre(createElement(EventWizardRecap, { navigation, route: { params: {} } })));
  });
  const gabarit = mockProprietesDuGabarit[mockProprietesDuGabarit.length - 1];
  await act(async () => {
    await gabarit.onNext();
  });
  // L'annonce part sans etre attendue par l'ecran : on laisse tourner la boucle.
  await act(async () => {
    await new Promise((resoudre) => { setTimeout(resoudre, 0); });
  });
  act(() => arbre.unmount());
  return { reset };
};

// Le premier rendu de l'assistant, a froid, depasse les 5 s par defaut de jest sur ce poste.
jest.setTimeout(30000);

const SERIE = [
  { name: '', recurrenceGroupId: 'serie-1', team: 'equipe-1' },
  { name: '', recurrenceGroupId: 'serie-1', team: 'equipe-1' },
  { name: '', recurrenceGroupId: 'serie-1', team: 'equipe-1' },
];

describe('SERIE-ANNONCE — l\'assistant annonce une serie UNE fois', () => {
  test('une SERIE : chaque date « j\'annoncerai », puis UN appel avec la 1re date', async () => {
    mockDatesPosees = SERIE;
    const { reset } = await creer();
    expect(mockCreerEnLot).toHaveBeenCalledTimes(1);
    const [payloads, options] = mockCreerEnLot.mock.calls[0];
    expect(payloads).toHaveLength(3);
    expect(options).toEqual(expect.objectContaining({ announceSeriesLater: true }));
    expect(mockAnnoncerLaSerie).toHaveBeenCalledTimes(1);
    expect(mockAnnoncerLaSerie).toHaveBeenCalledWith('ev-1');
    expect(reset).toHaveLength(1);
  });

  test('une date SEULE : ni drapeau, ni appel (annoncee a sa creation, comme avant)', async () => {
    mockDatesPosees = [{ name: '', team: 'equipe-1' }];
    await creer();
    const [, options] = mockCreerEnLot.mock.calls[0];
    expect(options?.announceSeriesLater).not.toBe(true);
    expect(mockAnnoncerLaSerie).not.toHaveBeenCalled();
  });

  test('« annoncer la serie » qui echoue ne bloque rien, sans alerte', async () => {
    mockDatesPosees = SERIE;
    mockAnnoncerLaSerie.mockRejectedValue(new Error('Not Found'));
    const { reset } = await creer();
    expect(mockAnnoncerLaSerie).toHaveBeenCalledTimes(1);
    expect(reset).toHaveLength(1);
    expect(mockAlerte).not.toHaveBeenCalled();
  });
});
