import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardRecap from '../EventWizardRecap';

// EVT-CLUB-ECRANS (14/11/2026, D121) — ecran 2 bis de la maquette v2 : la ligne « Pour · Tout le
// club · N personnes » et la 2e confirmation « Créer et prévenir N personnes ? » (Q4 B), puis la
// charge de creation (contrat fix/EVT-CLUB-admin : `audienceScope` + `club`, sans `team` hors Match
// / Tournoi). Doublures reprises de `EventWizardRecap.creation.test.js` ; ici le gabarit REND son
// contenu.

/** Proprietes recues par le gabarit d'etape. */
const mockGabarits = [];
/** Ce qui part au serveur. */
const mockEnvois = [];

jest.mock('../useMairieDecideALaCreation', () => ({
  __esModule: true,
  default: () => ({
    complet: false,
    deLaVille: false,
    mairie: false,
    tuAcceptes: false,
    ville: null,
  }),
}));
jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      const texte = typeof repli?.defaultValue === 'string' ? repli.defaultValue : cle;
      return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(repli?.[nom] ?? ''));
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
      Images: { arrowLeft: 1, chevronDown: 1, close: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock(
  '@/components/molecules/wizardStepLayout/WizardStepLayout',
  () => function GabaritMock(/** @type {any} */ props) {
    mockGabarits.push(props);
    return props.children;
  },
);

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
      userData: {
        club: { documentId: 'club-1', name: 'AS Les Bruyeres' },
        documentId: 'moi',
        role: { name: USER_ROLES.president, type: 'president' },
      },
    }),
  };
});

// Le fabricant de requetes recopie la charge : c'est elle qu'on lit.
jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    createReccurrentEventPayload: (/** @type {any} */ donnees) => [{ ...donnees }],
    createStageEventPayload: (/** @type {any} */ donnees) => ({ ...donnees }),
  }),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: () => {} }));

jest.mock('@/services/event/eventService', () => ({
  createEventsWithConcurrency: async (/** @type {any[]} */ payloads) => {
    mockEnvois.push(...(payloads || []));
    return {
      created: [
        { documentId: 'ev-1', payload: { name: 'x' }, response: { data: { documentId: 'ev-1' } } },
      ],
      failed: [],
    };
  },
  getEventById: () => Promise.resolve(null),
  requestFeatured: () => Promise.resolve(null),
  rollbackEventsByCancel: () => Promise.resolve([]),
}));

jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function FeuilleMock(/** @type {any} */ props) {
    return props.isVisible ? props.children : null;
  },
);
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => () => null,
);
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => () => null);
jest.mock(
  '@/components/atoms/button/Button',
  () => function BoutonMock(/** @type {any} */ props) {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
    return reactActuel.createElement(
      PressableRN,
      { onPress: props.onPress, testID: `bouton:${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  },
);

const CLUB = { documentId: 'club-1', name: 'AS Les Bruyeres' };
const ETAT_TOUT_LE_CLUB = {
  audienceScope: 'club',
  club: CLUB,
  clubAudienceCounts: {
    children: 51,
    coaches: 10,
    members: 6,
    parents: 41,
    players: 111,
    total: 168,
  },
  customName: 'Fête de fin d’année',
  date: new Date('2027-12-13T14:00:00.000Z'),
  endTime: new Date('2027-12-13T17:00:00.000Z'),
  facility: { documentId: 'inst-1', name: 'Gymnase Jean-Moulin' },
  location: 'Gymnase Jean-Moulin',
  startTime: new Date('2027-12-13T14:00:00.000Z'),
  team: null,
  type: { documentId: 'type-autre', name: 'Autre' },
  validationMode: 'auto',
};
const EQUIPE = { club: CLUB, documentId: 'equipe-1', name: 'Seniors A' };

const textesSous = (/** @type {any} */ noeud) => {
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

let semer = () => {};
/**
 * Expose le dispatch du tunnel.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  semer = useEventWizard().dispatch;
  return null;
}

let arbre;
const navigation = {
  canGoBack: () => true,
  goBack: () => {},
  navigate: () => {},
  push: () => {},
  replace: () => {},
  reset: () => {},
};
const monter = (etat) => {
  const rendre = (contenu) => createElement(
    EventWizardProvider,
    null,
    createElement(PriseDeCourant),
    contenu,
  );
  act(() => {
    arbre = renderer.create(rendre(null));
  });
  act(() => semer({ payload: etat, type: 'SET_META' }));
  act(() => {
    arbre.update(rendre(createElement(EventWizardRecap, { navigation, route: { params: {} } })));
  });
};
const textes = () => textesSous(arbre.root);
const gabarit = () => mockGabarits[mockGabarits.length - 1];
const appuyer = async (titre) => {
  await act(async () => {
    await arbre.root.findByProps({ testID: `bouton:${titre}` }).props.onPress();
  });
};

beforeEach(() => {
  mockEnvois.length = 0;
  mockGabarits.length = 0;
  if (typeof window !== 'undefined' && window.sessionStorage) window.sessionStorage.clear();
});
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('EVT-CLUB — ecran 2 bis : le recapitulatif « tout le club »', () => {
  test('la ligne « Pour · Tout le club · 168 personnes », pret a creer sans equipe', () => {
    monter(ETAT_TOUT_LE_CLUB);
    expect(textes()).toContain('Pour');
    expect(textes()).toContain('Tout le club · 168 personnes');
    expect(gabarit().isNextDisabled).toBe(false);
  });

  test('« Créer » ouvre la 2e confirmation et l apercu ; rien ne part', async () => {
    monter(ETAT_TOUT_LE_CLUB);
    await act(async () => {
      await gabarit().onNext();
    });
    expect(mockEnvois).toHaveLength(0);
    const liste = textes();
    expect(liste).toContain('Créer et prévenir 168 personnes ?');
    expect(liste).toContain('Tout le club est invité');
    expect(
      liste.some(
        (texte) => texte.startsWith('Fête de fin d’année, ') && texte.endsWith('Tu viens ?'),
      ),
    ).toBe(true);
    expect(liste).toContain('Revenir au récapitulatif');
  });

  test('« Revenir au récapitulatif » referme sans rien envoyer', async () => {
    monter(ETAT_TOUT_LE_CLUB);
    await act(async () => {
      await gabarit().onNext();
    });
    await appuyer('Revenir au récapitulatif');
    expect(textes()).not.toContain('Créer et prévenir 168 personnes ?');
    expect(mockEnvois).toHaveLength(0);
  });

  test('« Créer et prévenir le club » : audienceScope + club, sans equipe, une date', async () => {
    monter({ ...ETAT_TOUT_LE_CLUB, isRecurrent: true });
    await act(async () => {
      await gabarit().onNext();
    });
    await appuyer('Créer et prévenir le club');
    expect(mockEnvois.length).toBe(1);
    expect(mockEnvois[0].audienceScope).toBe('club');
    expect(mockEnvois[0].club).toBe('club-1');
    expect(mockEnvois[0].team).toBeUndefined();
    expect(mockEnvois[0].isRecurrent).toBe(false);
  });

  test('Match (R1 A) : l equipe part aussi, avec audienceScope', async () => {
    monter({
      ...ETAT_TOUT_LE_CLUB,
      team: EQUIPE,
      type: { documentId: 'type-match', name: 'Match' },
    });
    expect(textes()).toContain('Seniors A');
    expect(textes()).toContain('Tout le club · 168 personnes');
    await act(async () => {
      await gabarit().onNext();
    });
    await appuyer('Créer et prévenir le club');
    expect(mockEnvois[0]).toEqual(
      expect.objectContaining({ audienceScope: 'club', team: 'equipe-1' }),
    );
  });

  test('un evenement ordinaire : « Créer » part tout de suite, sans audienceScope', async () => {
    monter({
      ...ETAT_TOUT_LE_CLUB,
      audienceScope: null,
      clubAudienceCounts: null,
      team: EQUIPE,
    });
    expect(textes()).not.toContain('Pour');
    await act(async () => {
      await gabarit().onNext();
    });
    expect(mockEnvois.length).toBe(1);
    expect(mockEnvois[0]).not.toHaveProperty('audienceScope');
    expect(mockEnvois[0].team).toBe('equipe-1');
  });
});
