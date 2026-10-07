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
// La lueur du squelette (Reanimated, MaskedView) n'est pas l'objet du témoin : ses blocs, si.
jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return function SkeletonLoaderMock(/** @type {any} */ props) {
    return reactActuel.createElement(VueRN, { testID: 'squelette-lueur' }, props.children);
  };
});
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
      // COLL-C3B-BIS (planche 33) : l'encadrant AVEC sa fonction, comme la planche.
      'Demandé par Paul Veuillet, dirigeant',
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
    // FINITIONS12-COLL (03/10), point 10 : depuis SPEC-PLACE, une demande nait aussi sur une place
    // LIBRE hors des creneaux du club (tournee T11, C31) ; « deja complete » etait faux.
    // eslint-disable-next-line max-len
    expect(lus).toContain('Quand un club demande une place hors de ses créneaux, complète ou non, sa demande arrive ici. Vous l’acceptez ou la refusez, avec un mot ; le club est prévenu.');
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

// COLL-C3B-BIS (03/10) — planche 31 (P6-demandes, états 3, 5 et 6 ; liste du plan, ligne 31) :
// ce que la tournée T10 a laissé. ROUGE avant : un rond de chargement au lieu des cartes, un
// « Accès retiré » sans personne à qui écrire, un écran vide et un « prévenu » sans icône.
// (Le pluriel « 1 demande à trancher » de la porte est déjà corrigé par COLL-FIX2.)
describe('COLL-C3B-BIS — planche 31 : squelettes, « Nous contacter », icônes', () => {
  const trouver = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root
    .findAll((/** @type {any} */ n) => n.props?.testID === testID);

  // eslint-disable-next-line max-len
  it('pendant la lecture : des squelettes à la forme des cartes, et l’onglet « En attente (…) »', async () => {
    mockGet.mockImplementation(async (/** @type {string} */ url) => {
      if (url === '/collectivites/mine') return { data: { data: [VILLE] } };
      return new Promise(() => {});
    });
    const arbre = await monter((l) => l.includes('Ville de Recette'));
    expect(trouver(arbre, 'demandes-squelette').length).toBeGreaterThanOrEqual(1);
    expect(textes(arbre)).toContain('En attente (…)');
  });

  // eslint-disable-next-line max-len
  it('refus d’accès : le drapeau, « Accès retiré », et « Nous contacter » écrit à l’équipe', async () => {
    const { Linking } = jest.requireActual('react-native');
    const ouvrirLien = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockGet.mockImplementation(async (/** @type {string} */ url) => {
      if (url === '/collectivites/mine') return { data: { data: [] } };
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    });
    const arbre = await monter((l) => l.includes('Accès retiré'));
    expect(trouver(arbre, 'demandes-acces-icone').length).toBeGreaterThanOrEqual(1);
    // La planche n'a plus d'onglets : il n'y a rien à lire ici.
    expect(textes(arbre)).not.toContain('Traitées');
    await appuyer(arbre, 'bouton-Nous contacter');
    const { SUPPORT_CONTACT_MAILTO } = jest.requireActual('@/config/legalUrls');
    expect(ouvrirLien).toHaveBeenCalledWith(SUPPORT_CONTACT_MAILTO);
    ouvrirLien.mockRestore();
  });

  it('en attente, vide : l’enveloppe au-dessus du texte', async () => {
    mockEnAttente = [];
    const arbre = await monter((l) => l.includes('Aucune demande en attente.'));
    expect(trouver(arbre, 'demandes-vide-icone').length).toBeGreaterThanOrEqual(1);
  });

  it('« Traitées » : la coche devant « Le club a été prévenu »', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'onglet-decided');
    await attendre(() => textes(arbre).includes('Acceptée'));
    expect(trouver(arbre, 'demande-prevenu-coche').length).toBeGreaterThanOrEqual(1);
  });
});

// COLL-C3B-BIS (03/10) — planche 32 (P6-ordi, P6v2-ordi ; liste du plan, ligne 32) : sur
// ordinateur. ROUGE avant : « Traitées » empilait des cartes pleine largeur, la file ne disait
// la place qu'en couleur de texte, et la demande ouverte était la carte du téléphone.
describe('COLL-C3B-BIS — planche 32 : la file, la demande ouverte, « Traitées » en grille', () => {
  const trouver = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root
    .findAll((/** @type {any} */ n) => n.props?.testID === testID && typeof n.type === 'string');
  const styleDe = (/** @type {any} */ noeud) => Object.assign(
    {},
    ...[noeud.props.style].flat(Infinity).filter(Boolean),
  );

  // eslint-disable-next-line max-len
  it('la file : une pastille qui dit la place (« Complet · déjà 1 équipe », « Il reste 2 places »)', async () => {
    mockDimensions = ORDINATEUR;
    mockEnAttente = [EN_ATTENTE, SERIE];
    const arbre = await monter((l) => l.includes(PHRASE_1));
    const pastilles = trouver(arbre, 'demande-file-pastille');
    expect(pastilles).toHaveLength(2);
    // Une pastille : un fond et un bord, pas un texte de couleur.
    expect(styleDe(pastilles[0]).borderWidth).toBe(1);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Complet · déjà 1 équipe',
      'Il reste 2 places',
    ]));
  });

  // eslint-disable-next-line max-len
  it('la demande ouverte : la phrase en grand, « Motif » et « Demandé par » côte à côte, les gestes à droite', async () => {
    mockDimensions = ORDINATEUR;
    const arbre = await monter();
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Motif',
      '« Match de coupe avancé »',
      'Demandé par',
      'Paul Veuillet, dirigeant · Test Fc',
    ]));
    const [colonnes] = trouver(arbre, 'demande-ouverte-motif-demandeur');
    expect(styleDe(colonnes).flexDirection).toBe('row');
    const [gestes] = trouver(arbre, 'demande-ouverte-gestes');
    expect(styleDe(gestes).justifyContent).toBe('flex-end');
    const [phrase] = trouver(arbre, 'demande-ouverte-phrase');
    expect(styleDe(phrase).fontSize).toBeGreaterThanOrEqual(22);
  });

  // eslint-disable-next-line max-len
  it('« Traitées » sur ordinateur : une grille de deux colonnes ; au téléphone, la pile', async () => {
    mockDimensions = ORDINATEUR;
    const arbre = await monter();
    await appuyer(arbre, 'onglet-decided');
    await attendre(() => textes(arbre).includes('Acceptée'));
    const [grille] = trouver(arbre, 'demandes-traitees-grille');
    expect(styleDe(grille)).toEqual(expect.objectContaining({
      flexDirection: 'row', flexWrap: 'wrap',
    }));

    mockDimensions = PORTRAIT;
    const telephone = await monter();
    await appuyer(telephone, 'onglet-decided');
    await attendre(() => textes(telephone).includes('Acceptée'));
    expect(trouver(telephone, 'demandes-traitees-grille')).toHaveLength(0);
  });
});

// COLL-C3B-BIS (03/10) — planche 33 (P6-fenetre ; liste du plan, ligne 33). ROUGE avant : la
// feuille posée en bas sans poignée, et « Accepter la série » en tout ou rien (le serveur ne
// recevait jamais de dates).
describe('COLL-C3B-BIS — planche 33 : la poignée, et accepter une série date par date', () => {
  const trouver = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root
    .findAll((/** @type {any} */ n) => n.props?.testID === testID
      && typeof n.props?.onPress === 'function');
  const jourCourt = (/** @type {string} */ iso) => format(new Date(iso), 'EEE d MMM', {
    locale: fr,
  });
  // Une date de la série, comme le serveur la rend (`seriesDates`) : le mercredi, 17:30 - 19:00.
  const date = (/** @type {string} */ documentId, /** @type {string} */ jour, taken = 0) => ({
    documentId,
    maxSlots: 2,
    remaining: 2 - taken,
    requestedEnd: `${jour}T17:00:00.000Z`,
    requestedStart: `${jour}T15:30:00.000Z`,
    taken,
  });
  const SERIE_DATES = {
    ...SERIE,
    seriesDates: [
      date('rq-serie', '2030-10-09'),
      date('rq-serie-2', '2030-10-16', 2),
      date('rq-serie-3', '2030-10-23', 1),
    ],
  };

  // eslint-disable-next-line max-len
  it('au téléphone, la feuille a sa poignée ; l’appuyer la ferme ; sur ordinateur, pas de poignée', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'bouton-Accepter');
    expect(textes(arbre)).toContain('Accepter la demande');
    expect(trouver(arbre, 'fenetre-poignee')).toHaveLength(1);
    await appuyer(arbre, 'fenetre-poignee');
    expect(textes(arbre)).not.toContain('Accepter la demande');

    mockDimensions = ORDINATEUR;
    const ordinateur = await monter();
    await appuyer(ordinateur, 'bouton-Accepter');
    expect(trouver(ordinateur, 'fenetre-poignee')).toHaveLength(0);
  });

  // eslint-disable-next-line max-len
  it('une série : chaque date se coche, avec sa place ; toutes cochées, « Accepter la série »', async () => {
    mockEnAttente = [SERIE_DATES];
    const arbre = await monter((lus) => lus.includes('Accepter la série'));
    await appuyer(arbre, 'bouton-Accepter la série');
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Les dates de la série',
      jourCourt('2030-10-09T15:30:00.000Z'),
      '2 places libres',
      jourCourt('2030-10-16T15:30:00.000Z'),
      'Complet · 2 sur 2',
      '1 place libre',
    ]));
    const cases = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityRole === 'checkbox' && typeof n.props?.onPress === 'function'
    ));
    expect(cases).toHaveLength(3);
    expect(cases.every((/** @type {any} */ c) => c.props.accessibilityState?.checked)).toBe(true);
  });

  // eslint-disable-next-line max-len
  it('décocher une date : « Accepter 2 dates sur 3 », la feuille dit le sort de l’autre, le serveur reçoit les dates', async () => {
    mockEnAttente = [SERIE_DATES];
    const arbre = await monter((lus) => lus.includes('Accepter la série'));
    await appuyer(arbre, 'bouton-Accepter la série');
    await appuyer(arbre, 'date-serie-rq-serie-2');
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Accepter 2 dates sur 3',
      'L’autre date sera refusée : le club lira « Date non retenue ».',
    ]));
    await appuyer(arbre, 'bouton-Accepter 2 dates sur 3');
    expect(mockPost).toHaveBeenCalledWith(
      '/facility-override-requests/rq-serie/approve',
      { data: { dates: ['rq-serie', 'rq-serie-3'], decisionReason: '', series: true } },
    );
  });

  it('aucune date cochée : le bouton se tait et la feuille le dit', async () => {
    mockEnAttente = [SERIE_DATES];
    const arbre = await monter((lus) => lus.includes('Accepter la série'));
    await appuyer(arbre, 'bouton-Accepter la série');
    await appuyer(arbre, 'date-serie-rq-serie');
    await appuyer(arbre, 'date-serie-rq-serie-2');
    await appuyer(arbre, 'date-serie-rq-serie-3');
    expect(textes(arbre)).toContain('Cochez au moins une date.');
    // La carte et la feuille portent chacune « Accepter la série » : celle de la feuille (la seule
    // qui reçoit `disabled`) se tait, et l'appuyer quand même n'envoie rien.
    const enFenetre = trouver(arbre, 'bouton-Accepter la série')
      .filter((/** @type {any} */ b) => b.props.disabled !== undefined);
    expect(enFenetre.length).toBeGreaterThan(0);
    expect(enFenetre.every((/** @type {any} */ b) => b.props.disabled === true)).toBe(true);
    await act(async () => { await enFenetre[0].props.onPress(); });
    expect(mockPost).not.toHaveBeenCalled();
  });
});

// COLL-C3B-BIS (03/10) — planche 34 (P6v2-phrase ; liste du plan, ligne 34). ROUGE avant : une
// série se lisait sur sa PREMIÈRE date (« Pour la première date, le mercredi 9 oct. : … »).
// Elle se lit EN ENTIER : combien de semaines, du … au …, et combien sont pleines.
describe('COLL-C3B-BIS — planche 34 : une série se lit en entier', () => {
  const semaine = (/** @type {string} */ documentId, /** @type {string} */ jour, taken = 0) => ({
    documentId,
    maxSlots: 2,
    remaining: 2 - taken,
    requestedEnd: `${jour}T17:00:00.000Z`,
    requestedStart: `${jour}T15:30:00.000Z`,
    taken,
  });
  const serieDe = (/** @type {number[]} */ pris) => ({
    ...SERIE,
    seriesDates: ['2030-10-09', '2030-10-16', '2030-10-23']
      .map((jour, rang) => semaine(rang ? `rq-serie-${rang + 1}` : 'rq-serie', jour, pris[rang])),
  });
  const PHRASE_SERIE = (/** @type {any} */ demande) => [
    `Montrivage Basket demande chaque mercredi, de ${heure(demande.requestedStart)}`,
    `à ${heure(demande.requestedEnd)}, au Gymnase de la Recette, pour ses Seniors Basket,`,
    'jusqu’au 30 juin.',
  ].join(' ');
  const SEIZE_OCT = format(new Date('2030-10-16T15:30:00.000Z'), 'EEE d MMM', { locale: fr });

  it('une semaine pleine sur trois : laquelle, et ce que coûte accepter ces jours-là', async () => {
    const demande = serieDe([0, 2, 1]);
    mockEnAttente = [demande];
    const lus = textes(await monter((l) => l.includes(PHRASE_SERIE(demande))));
    expect(lus).toEqual(expect.arrayContaining([
      '3 mercredis du 9 octobre au 23 octobre :',
      `Complet 1 fois sur 3 : ${SEIZE_OCT}`,
      'Accepter met 3 équipes pour 2 places ces jours-là.',
      'Complet 1 fois sur 3',
    ]));
    expect(lus.some((texte) => texte.startsWith('Pour la première date'))).toBe(false);
  });

  it('aucune semaine pleine : « … aucune semaine », la pastille « Place libre »', async () => {
    const demande = serieDe([0, 0, 0]);
    mockEnAttente = [demande];
    const lus = textes(await monter((l) => l.includes(PHRASE_SERIE(demande))));
    expect(lus).toEqual(expect.arrayContaining([
      '3 mercredis du 9 octobre au 23 octobre :',
      'Personne n’y est : il reste 2 places.',
      'Accepter ne gêne personne, aucune semaine.',
      'Place libre',
    ]));
  });

  it('toutes pleines : « Complet chaque semaine », la conséquence chaque semaine', async () => {
    const demande = serieDe([2, 2, 2]);
    mockEnAttente = [demande];
    const lus = textes(await monter((l) => l.includes(PHRASE_SERIE(demande))));
    expect(lus).toEqual(expect.arrayContaining([
      'Complet chaque semaine : il y a déjà 2 équipes.',
      'Accepter met 3 équipes pour 2 places, chaque semaine.',
      'Complet',
    ]));
  });

  // 🧮 FINITIONS13-COLL (04/10) point 5 — tournée T13 (C2_1c) : toutes les semaines pleines, mais
  // pas avec le même nombre d'équipes (« 2 sur 2 » chaque jeudi, « 3 sur 2 » le 8 oct.). L'en-tête
  // disait « il y a déjà 3 équipes » (le MAXIMUM) ; il suit le compte date par date. ROUGE avant.
  it('toutes pleines, pas pareilles : le nombre de chaque semaine, puis l’écart', async () => {
    const demande = serieDe([2, 3, 2]);
    mockEnAttente = [demande];
    const lus = textes(await monter((l) => l.includes(PHRASE_SERIE(demande))));
    expect(lus).toEqual(expect.arrayContaining([
      // « 16 oct. » finit déjà la phrase : un seul point.
      `Complet chaque semaine : il y a déjà 2 équipes, 3 le ${SEIZE_OCT}`,
      `Accepter met 3 équipes pour 2 places, chaque semaine (4 le ${SEIZE_OCT}).`,
      'Complet',
    ]));
    expect(lus.join(' | ')).not.toMatch(/il y a déjà 3 équipes\./);
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

// FINITIONS16 · POINT 21 (tournee T15, photo SITE_C32b ; planche 32, P6-ordi) — SUR LE SITE, la
// page s'intitulait « Ville de Montrivage ». Le site n'a pas l'en-tete du telephone (qui dit
// deja « Demandes de la Ville ») : la planche y met le nom de la Ville en surtitre, puis
// « Demandes de la Ville ». Le telephone ne change pas (temoin ci-dessus). ROUGE avant.
describe('FINITIONS16 21 — planche 32 sur le site : « Demandes de la Ville »', () => {
  const { Platform } = jest.requireActual('react-native');
  const osAvant = Platform.OS;
  afterEach(() => {
    Platform.OS = osAvant;
  });

  it('🔴 le surtitre dit la Ville, le titre dit « Demandes de la Ville »', async () => {
    Platform.OS = 'web';
    const arbre = await monter();
    const lus = textes(arbre);
    const titre = lus.indexOf('Demandes de la Ville');
    expect(titre).toBeGreaterThan(0);
    expect(lus[titre - 1]).toBe('Ville de Recette');
    expect(lus.filter((texte) => texte === 'Demandes de la Ville')).toHaveLength(1);
  });
});

// 🗓️ VILLE-T18C (07/10) — point 4, tournée T18 (G51) : dans « Traitées », deux cartes de la MÊME
// série au texte IDENTIQUE (« chaque jeudi, de 19:00 à 20:00 … jusqu’au 15 octobre »), l'une
// Refusée, l'autre Acceptée : la refusée ne disait pas QUELLE date. `series` décrit la récurrence
// entière (ses séances non annulées : les dates MAINTENUES). Côté club, « Tes demandes à la Ville »
// le savait déjà (FINITIONS13-COLL) ; la règle est désormais partagée (domaine). ROUGE avant.
describe('VILLE-T18C point 4 — « Traitées » : une carte refusée d’une série dit SES dates', () => {
  const ACCEPTEE = {
    ...SERIE,
    documentId: 'rq-s1',
    series: { ...SERIE.series, until: '2030-10-23', untilLabel: '23 oct.' },
    seriesCount: 2,
    status: 'approved',
    updatedAt: '2030-10-05T09:00:00.000Z',
  };
  const REFUSEE = {
    ...ACCEPTEE,
    decisionReason: 'Date non retenue : la Ville a accepté les autres dates de la série.',
    documentId: 'rq-s2',
    requestedEnd: '2030-10-16T17:00:00.000Z',
    requestedStart: '2030-10-16T15:30:00.000Z',
    seriesCount: 1,
    status: 'refused',
  };
  const lireTraitees = async (/** @type {any[]} */ cartes) => {
    mockGet.mockImplementation(async (/** @type {string} */ url, /** @type {any} */ config) => {
      if (url === '/collectivites/mine') return { data: { data: [VILLE] } };
      if (url === '/collectivites/ville-de-recette/requests') {
        return { data: { data: config?.params?.status === 'decided' ? cartes : mockEnAttente } };
      }
      throw new Error(`GET inattendu ${url}`);
    });
    const arbre = await monter();
    await appuyer(arbre, 'onglet-decided');
    await attendre(() => textes(arbre).includes('Refusée'));
    return textes(arbre);
  };

  it('une date refusée : sa date, et la pastille « Une date de la série »', async () => {
    const lus = await lireTraitees([REFUSEE, ACCEPTEE]);
    expect(lus).toEqual(expect.arrayContaining([
      // eslint-disable-next-line max-len
      `Montrivage Basket demande le ${jourLong(REFUSEE.requestedStart)}, de ${heure(REFUSEE.requestedStart)} à ${heure(REFUSEE.requestedEnd)}, au Gymnase de la Recette, pour ses Seniors Basket.`,
      'Une date de la série',
      // eslint-disable-next-line max-len
      `Montrivage Basket demande chaque mercredi, de ${heure(ACCEPTEE.requestedStart)} à ${heure(ACCEPTEE.requestedEnd)}, au Gymnase de la Recette, pour ses Seniors Basket, jusqu’au 23 octobre.`,
      'Chaque semaine',
    ]));
  });

  // AJOUT T18 (chef, 07/10 ~19h10) : une série REFUSÉE se lit jusqu'à SA dernière date (le serveur
  // décrit désormais une carte tranchée par ses propres dates : admin VILLE-T18C).
  // eslint-disable-next-line max-len
  it('trois dates refusées : la série jusqu’à sa dernière date, pastille « 3 dates de la série »', async () => {
    const lus = await lireTraitees([{
      ...REFUSEE, series: { ...REFUSEE.series, until: '2030-10-30' }, seriesCount: 3,
    }]);
    expect(lus).toEqual(expect.arrayContaining([
      // eslint-disable-next-line max-len
      `Montrivage Basket demande chaque mercredi, de ${heure(REFUSEE.requestedStart)} à ${heure(REFUSEE.requestedEnd)}, au Gymnase de la Recette, pour ses Seniors Basket, jusqu’au 30 octobre.`,
      '3 dates de la série',
    ]));
  });
});

// ⏳ VILLE-T18C (07/10) — ajout T18 du chef (G49c) : « Refuser la série » attendait 15,3 s avec
// pour seul signe un bouton qui tourne. Le serveur répond désormais avant de prévenir (admin
// VILLE-T18C) ; la fenêtre dit en plus ce qui s'écrit, pendant l'attente. ROUGE avant.
describe('VILLE-T18C point 4 — trancher une série : la fenêtre dit ce qui s’écrit', () => {
  it('refuser la série : « Refus des 30 dates en cours… » pendant l’attente', async () => {
    mockEnAttente = [SERIE];
    /** La réponse du serveur, tenue jusqu’à la fin de la mesure. @type {(valeur: any) => void} */
    let repondre = () => {};
    mockPost.mockImplementation(() => new Promise((resolve) => { repondre = resolve; }));
    const arbre = await monter((l) => l.some((texte) => (
      texte.startsWith('Montrivage Basket demande chaque')
    )));
    await appuyer(arbre, 'bouton-Refuser');
    await appuyer(arbre, 'motif-complet');
    const bouton = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.testID === 'bouton-Refuser et annuler les entraînements'
      && typeof n.props?.onPress === 'function'
    ))[0];
    await act(async () => { bouton.props.onPress(); });
    await attendre(() => textes(arbre).some((texte) => texte.startsWith('Refus des 30 dates')));
    expect(textes(arbre)).toContain(
      'Refus des 30 dates en cours : patientez quelques secondes, la fenêtre se fermera seule.',
    );
    await act(async () => { repondre({ data: { data: { documentId: 'rq-serie' } } }); });
  });
});
