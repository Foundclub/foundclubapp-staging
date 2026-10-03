import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';

import CollectiviteRequests from '../CollectiviteRequests';

// 🏛️ « Demandes de la Ville » — COLLECTIVITES 1c (écran 3), puis COLL-C3B (02/10) : planches
// P6v2-phrase (tel, ordi), P6-demandes, P6-fenetre (artefact HY521H1).
//
// De bout en bout côté app : les VRAIES lectures (collectiviteQueries) et les VRAIES mutations
// du lot 3a (facilityQueries -> facilityService). Seul le client HTTP est doublé.
// Ce que ce témoin fige (ROUGE avant COLL-C3B : la carte empilait « Club · équipe », le lieu,
// « Chaque semaine », « Motif : … », « Place restante : 0 sur 1 ») :
//   - chaque demande est UNE PHRASE (« Test Fc demande le lundi 7 oct., de 18:00 à 19:30, au
//     Gymnase de la Recette, pour ses U15. »), puis ce qu'il y a sur place en une phrase, qui
//     est déjà là, la conséquence, et le motif avec l'encadrant ET SA FONCTION (« nom B ») ;
//   - les pastilles : Complet / N place(s) libre(s), Une fois / Chaque semaine ; D69 « Demande de
//     votre club » ;
//   - une série « chaque semaine » se lit « … jusqu'au 30 juin » et se tranche par « Accepter la
//     série » (corps `series: true`) ;
//   - la fenêtre rappelle la demande, dit qui sera prévenu, propose 3 motifs de refus en un
//     appui, et son bouton rouge dit la conséquence ; une place prise entre-temps (409) se dit
//     et ne laisse que refuser ;
//   - « Traitées » : l'issue, votre message en citation, « Le club a été prévenu · … le … » ;
//   - vide, erreur, refus d'accès ; sur ordinateur, la file à gauche et la demande à droite.

const mockGet = jest.fn();
const mockPost = jest.fn();
const PORTRAIT = {
  fontScale: 1, height: 812, scale: 2, width: 375,
};
const ORDINATEUR = {
  fontScale: 1, height: 900, scale: 1, width: 1280,
};
let mockDimensions = PORTRAIT;
let mockUserData = { club: null, clubs: [], documentId: 'u-mairie' };

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: jest.fn(),
  },
}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDimensions,
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData }),
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
        const valeurs = typeof repli === 'object' && repli ? repli : options;
        return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(valeurs?.[nom] ?? ''));
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

// Les heures se lisent dans le fuseau de l'appareil : le témoin les calcule comme l'écran.
const heure = (/** @type {string} */ iso) => format(new Date(iso), 'HH:mm');
const jourLong = (/** @type {string} */ iso) => format(new Date(iso), 'EEEE d MMM', { locale: fr });

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
    documentId: 'ev-1', isRecurring: false, name: null, type: { name: 'Entraînement' },
  },
  facility: { documentId: 'gymnase', name: 'Gymnase de la Recette' },
  reason: 'Match de coupe avancé',
  requestedBy: { documentId: 'u-paul', firstname: 'Paul', lastname: 'Veuillet' },
  requestedEnd: '2030-10-07T17:30:00.000Z',
  requestedStart: '2030-10-07T16:00:00.000Z',
  requesterFunction: 'manager',
  series: null,
  seriesCount: 1,
  status: 'pending',
  team: { documentId: 'team-b', name: 'U15' },
};
const SERIE = {
  ...EN_ATTENTE,
  club: { documentId: 'club-c', name: 'Montrivage Basket' },
  conflict: { maxSlots: 2, occupants: [], remaining: 2 },
  documentId: 'rq-serie',
  event: { ...EN_ATTENTE.event, documentId: 'ev-s', isRecurring: true },
  reason: null,
  requestedEnd: '2030-10-09T17:00:00.000Z',
  requestedStart: '2030-10-09T15:30:00.000Z',
  requesterFunction: 'trainer',
  series: {
    endTime: '19:00',
    pendingCount: 30,
    startTime: '17:30',
    until: '2031-06-30',
    untilLabel: '30 juin',
    validFrom: '2030-10-09',
    weekday: 3,
    weekdayLabel: 'mercredi',
  },
  seriesCount: 30,
  team: { documentId: 'team-c', name: 'Seniors Basket' },
};
const TRAITEE = {
  ...EN_ATTENTE,
  conflict: undefined,
  decisionReason: 'Partagez le plateau',
  documentId: 'rq-0',
  status: 'approved',
  updatedAt: '2030-10-01T09:00:00.000Z',
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

// Le composant pressable porte `onPress` ; ses vues natives, non.
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID, index = 0) => {
  const pressables = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === testID
    && typeof n.props?.onPress === 'function');
  await act(async () => {
    await pressables[index].props.onPress();
  });
};

jest.setTimeout(20000);
const attendre = async (/** @type {() => boolean} */ condition) => {
  for (let essai = 0; essai < 150 && !condition(); essai += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((r) => { setTimeout(r, 20); }); });
  }
};

// eslint-disable-next-line max-len
const PHRASE_1 = `Test Fc demande le ${jourLong(EN_ATTENTE.requestedStart)}, de ${heure(EN_ATTENTE.requestedStart)} à ${heure(EN_ATTENTE.requestedEnd)}, au Gymnase de la Recette, pour ses U15.`;

let mockEnAttente = [EN_ATTENTE];
const monter = async (attendu = (/** @type {string[]} */ lus) => lus.includes(PHRASE_1)) => {
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
  await attendre(() => attendu(textes(arbre)));
  return arbre;
};

beforeEach(() => {
  mockDimensions = PORTRAIT;
  mockUserData = { club: null, clubs: [], documentId: 'u-mairie' };
  mockEnAttente = [EN_ATTENTE];
  mockGet.mockReset();
  mockPost.mockReset();
  mockGet.mockImplementation(async (/** @type {string} */ url, /** @type {any} */ config) => {
    if (url === '/collectivites/mine') return { data: { data: [VILLE] } };
    if (url === '/collectivites/ville-de-recette/requests') {
      return { data: { data: config?.params?.status === 'decided' ? [TRAITEE] : mockEnAttente } };
    }
    throw new Error(`GET inattendu ${url}`);
  });
  mockPost.mockResolvedValue({ data: { data: { documentId: 'rq-1' } } });
});

describe('COLL-C3B — planche P6v2 : chaque demande est une phrase', () => {
  // eslint-disable-next-line max-len
  it('la carte : la phrase, la place en une phrase, qui est déjà là, la conséquence, le motif et la fonction', async () => {
    const lus = textes(await monter());
    expect(lus).toEqual(expect.arrayContaining([
      PHRASE_1,
      'Complet',
      'Une fois',
      'Il y a déjà 1 équipe : c’est complet.',
      // eslint-disable-next-line max-len
      `AIKI · Seniors, de ${heure('2030-10-07T16:00:00.000Z')} à ${heure('2030-10-07T17:30:00.000Z')}.`,
      'Accepter met 2 équipes pour 1 place.',
      '« Match de coupe avancé » · Paul Veuillet, dirigeant',
    ]));
    // RETIRÉ par la planche : le titre « club · équipe » (la phrase le contient), « Ponctuel ».
    expect(lus).not.toContain('Test Fc · U15');
    expect(lus).not.toContain('Ponctuel');
    expect(lus).toContain('En attente (1)');
  });

  // 🐞 COLL-FIX2 (03/10), planche 31 (tournée T10) : « AS Montrivage · U15, de 18:30 à . » — un
  // occupant dont le serveur ne connaît pas la fin. La phrase ne finit plus jamais par « à . ».
  it('un occupant sans heure de fin : « dès 18:00 », jamais « à . »', async () => {
    mockEnAttente = [{
      ...EN_ATTENTE,
      conflict: {
        ...EN_ATTENTE.conflict,
        occupants: [{ ...EN_ATTENTE.conflict.occupants[0], end: null }],
      },
    }];
    const lus = textes(await monter());
    expect(lus).toContain(`AIKI · Seniors, dès ${heure('2030-10-07T16:00:00.000Z')}.`);
    expect(lus.some((texte) => / à \.$/.test(texte))).toBe(false);
  });

  // eslint-disable-next-line max-len
  it('une série « chaque semaine » : « … jusqu’au 30 juin », place libre, « Accepter la série » ⇒ series: true', async () => {
    mockEnAttente = [SERIE];
    // eslint-disable-next-line max-len
    const phrase = `Montrivage Basket demande chaque mercredi, de ${heure(SERIE.requestedStart)} à ${heure(SERIE.requestedEnd)}, au Gymnase de la Recette, pour ses Seniors Basket, jusqu’au 30 juin.`;
    const arbre = await monter((lus) => lus.includes(phrase));
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      phrase,
      'Chaque semaine',
      '2 places libres',
      'Personne n’y est : il reste 2 places.',
      'Accepter ne gêne personne.',
      'Paul Veuillet, entraîneur',
    ]));
    await appuyer(arbre, 'bouton-Accepter la série');
    expect(textes(arbre)).toContain('Accepter la série');
    await appuyer(arbre, 'bouton-Accepter la série', 1);
    expect(mockPost).toHaveBeenCalledWith(
      '/facility-override-requests/rq-serie/approve',
      { data: { decisionReason: '', series: true } },
    );
  });

  // eslint-disable-next-line max-len
  it('D69 : la demande du club du gestionnaire porte « Demande de votre club », sur la liste', async () => {
    mockUserData = { club: { documentId: 'club-b' }, clubs: [], documentId: 'u-mixte' };
    const lus = textes(await monter());
    expect(lus).toContain('Demande de votre club');
  });
});

describe('COLL-C3B — planche P6-fenetre : accepter ou refuser', () => {
  // eslint-disable-next-line max-len
  it('accepter : la fenêtre rappelle la demande et dit qui sera prévenu ; le corps reste celui du lot 3a', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'bouton-Accepter');
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Accepter la demande',
      'Test Fc · U15',
      'Demandé par Paul Veuillet',
      '2 équipes pour 1 place à ce moment.',
      'Seront prévenus',
      'Paul Veuillet (Test Fc), qui demande ; et les clubs déjà là : AIKI · Seniors.',
    ]));
    await act(async () => {
      arbre.root.findByType(TextInput).props.onChangeText('Partagez le plateau');
    });
    await appuyer(arbre, 'bouton-Accepter', 1);
    expect(mockPost).toHaveBeenCalledWith(
      '/facility-override-requests/rq-1/approve',
      { data: { decisionReason: 'Partagez le plateau' } },
    );
  });

  // eslint-disable-next-line max-len
  it('refuser : motif exigé ; un motif en un appui ; le bouton rouge dit la conséquence', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'bouton-Refuser');
    const bouton = 'bouton-Refuser et annuler l’entraînement';
    await appuyer(arbre, bouton);
    expect(mockPost).not.toHaveBeenCalled();
    expect(textes(arbre)).toContain('Écrivez le motif : le club le lira.');
    await appuyer(arbre, 'motif-complet');
    expect(arbre.root.findByType(TextInput).props.value).toBe('Installation complète');
    await appuyer(arbre, bouton);
    expect(mockPost).toHaveBeenCalledWith(
      '/facility-override-requests/rq-1/refuse',
      { data: { decisionReason: 'Installation complète' } },
    );
  });

  // eslint-disable-next-line max-len
  it('une place prise entre-temps (409) : la fenêtre le dit et ne laisse plus que refuser', async () => {
    mockPost.mockRejectedValue({
      details: { code: 'FACILITY_OVERRIDE_CAPACITY_CHANGED' },
      message: 'Plus de place',
      status: 409,
    });
    const arbre = await monter();
    await appuyer(arbre, 'bouton-Accepter');
    await appuyer(arbre, 'bouton-Accepter', 1);
    const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
    const lus = textes(arbre);
    expect(lus).toContain(catalogue.APIerrors.FACILITY_OVERRIDE_CAPACITY_CHANGED);
    expect(lus).toEqual(expect.arrayContaining(['Refuser et annuler l’entraînement', 'Fermer']));
  });
});

// eslint-disable-next-line max-len
describe('COLL-C3B — planche P6-demandes : traitées, vide, erreur, refus d’accès, ordinateur', () => {
  // eslint-disable-next-line max-len
  it('« Traitées » : l’issue, votre message en citation, « Le club a été prévenu · acceptée le … »', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'onglet-decided');
    await attendre(() => textes(arbre).includes('Acceptée'));
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Acceptée',
      'Votre message',
      '« Partagez le plateau »',
      // eslint-disable-next-line max-len
      `Le club a été prévenu · acceptée le ${format(new Date(TRAITEE.updatedAt), 'd MMM', { locale: fr })}`,
    ]));
  });

  it('en attente, vide : l’écran explique d’où viennent les demandes', async () => {
    mockEnAttente = [];
    const lus = textes(await monter((l) => l.includes('Aucune demande en attente.')));
    // eslint-disable-next-line max-len
    expect(lus).toContain('Quand un club veut une place sur une installation déjà complète, sa demande arrive ici. Vous l’acceptez ou la refusez, avec un mot ; le club est prévenu.');
  });

  it('refus d’accès (403) : « Accès retiré »', async () => {
    mockGet.mockImplementation(async (/** @type {string} */ url) => {
      if (url === '/collectivites/mine') return { data: { data: [] } };
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    });
    const lus = textes(await monter((l) => l.includes('Accès retiré')));
    // eslint-disable-next-line max-len
    expect(lus).toEqual(expect.arrayContaining(['Accès retiré', 'Vous ne gérez pas cette collectivité.']));
  });

  it('sur ordinateur : la file (phrase courte) à gauche, la demande ouverte à droite', async () => {
    mockDimensions = ORDINATEUR;
    mockEnAttente = [EN_ATTENTE, SERIE];
    const arbre = await monter((l) => l.includes(PHRASE_1));
    const file = arbre.root.findAll((/** @type {any} */ n) => typeof n.props?.testID === 'string'
      && n.props.testID.startsWith('demande-file-') && typeof n.props?.onPress === 'function');
    // eslint-disable-next-line max-len
    expect(file.map((/** @type {any} */ n) => n.props.testID)).toEqual(['demande-file-rq-1', 'demande-file-rq-serie']);
    // eslint-disable-next-line max-len
    const courte = `Test Fc demande le ${format(new Date(EN_ATTENTE.requestedStart), 'EEE d MMM', { locale: fr })}, ${heure(EN_ATTENTE.requestedStart)} – ${heure(EN_ATTENTE.requestedEnd)}, au Gymnase de la Recette (U15).`;
    expect(textes(arbre)).toContain(courte);
    await appuyer(arbre, 'demande-file-rq-serie');
    expect(textes(arbre)).toContain('Accepter la série');
  });

  it('la notification d’une nouvelle demande (ctaRoute du serveur) mène à cet écran', () => {
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

// TEXTES-COLLECTIVITES (tranche du chef, 01/10 ~16h55 : « A ») — « Demandes de la Ville »
// s'écrivait deux fois : l'en-tête de l'écran, puis le titre de la page. La page porte le NOM.
describe('TEXTES-COLLECTIVITES — « Demandes de la Ville » ne s écrit plus deux fois', () => {
  it('la page porte le nom de la collectivité, une fois', async () => {
    const lus = textes(await monter());
    expect(lus).not.toContain('Demandes de la Ville');
    expect(lus.filter((texte) => texte === 'Ville de Recette')).toHaveLength(1);
    expect(lus).not.toContain('VILLE DE RECETTE');
  });
});
