import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubSlotRequest from '../ClubSlotRequest';

// 🏛️ COLL-C3B (02/10) — L'ÉCRAN OÙ LE CLUB DEMANDE (planches P8v2-demande, tel et ordi ;
// artefact HY521H1). Écran NEUF : ce témoin était rouge faute d'écran.
//
// De bout en bout côté app : les VRAIES lectures (installations de la Ville du club, équipes,
// types, place libre §4.2, planning du jour) et le VRAI envoi (POST /events, une séance par date).
// Seul le client HTTP est doublé. Ce que ce témoin fige :
//   - la place se lit pendant la saisie, avec qui est déjà là (club · équipe, « ton club ») ;
//   - complet : on ne bloque pas (« Tu peux demander quand même : la mairie décidera »,
//     « Envoyer quand même ») et les heures libres du même jour se choisissent d'un appui ;
//   - le SEUL blocage : hors des heures d'ouverture (l'erreur dit l'heure) ;
//   - l'envoi pose l'entraînement de l'équipe, le mot pour la mairie compris ; « chaque semaine »
//     pose une séance par semaine jusqu'au 30 juin, d'une même série ;
//   - l'accusé dit à qui c'est parti, la suite, et « En attente de la mairie ».

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockNavigate = jest.fn();
let mockParams = {};

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: jest.fn(),
  },
}));
// Le vrai service des evenements (POST /events) charge un module natif de fichiers : double.
jest.mock('react-native-blob-util', () => ({ __esModule: true, default: { fs: {} } }));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { club: { documentId: 'club-A' }, role: { type: 'president' } } }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    // L ecran lit les regles des evenements, qui demarrent la langue (initReactI18next).
    initReactI18next: { init: () => {}, type: '3rdParty' },
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
jest.mock('@/components/molecules/input/Input', () => {
  const reactActuel = jest.requireActual('react');
  const { TextInput: SaisieRN } = jest.requireActual('react-native');
  return function InputMock(/** @type {any} */ props) {
    return reactActuel.createElement(SaisieRN, {
      onChangeText: props.onChangeText, testID: props.testID, value: props.value,
    });
  };
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function DatePickerMock(/** @type {any} */ props) {
    return reactActuel.createElement(TexteRN, { testID: 'demande-jour' }, props.value);
  };
});

const INSTALLATION = {
  closingTime: '22:00:00.000',
  collectivite: { documentId: 'ville', name: 'Ville de Montrivage' },
  documentId: 'gym-ville',
  maxSlots: 2,
  name: 'Gymnase des Tilleuls',
  openingTime: '08:00:00.000',
};
// Un jeudi. Les blocs du planning sont à l'heure de Paris (18:00 – 19:30 = 16:00Z en été).
const JOUR = '2030-10-03';
const bloc = (/** @type {string} */ club) => ({
  club: { documentId: club, name: club },
  endAt: '2030-10-03T17:30:00.000Z',
  endTime: '19:30:00.000',
  hasExplicitTime: true,
  kind: 'event',
  startAt: '2030-10-03T16:00:00.000Z',
  startTime: '18:00:00.000',
});
const APERCU_LIBRE = {
  capacity: 2,
  occupants: [{
    club: { documentId: 'club-A', name: 'AS Montrivage' },
    endTime: '19:30',
    startTime: '18:00',
    team: { name: 'U15' },
    validFrom: JOUR,
    validUntil: JOUR,
  }],
  peak: 1,
  remaining: 1,
};
const APERCU_COMPLET = {
  ...APERCU_LIBRE,
  occupants: [
    ...APERCU_LIBRE.occupants,
    {
      club: { documentId: 'club-B', name: 'Montrivage FC' },
      endTime: '19:30',
      startTime: '18:00',
      team: { name: 'Senior B' },
      validFrom: JOUR,
      validUntil: JOUR,
    },
  ],
  peak: 2,
  remaining: 0,
};

let mockApercu = APERCU_LIBRE;
let mockStatut = 'pending_validation';
// DECISIONS-SOIR (02/10) — qui décide d'une séance en attente : la mairie (`facility_overbooking`)
// ou le dirigeant du club (`club_slot_overflow`, D32). Le serveur le dit dans `pendingReason`.
let mockRaison = 'facility_overbooking';

// 🧯 COLL-FIX-DEMANDES (02/10) — LE DOUBLE DU SERVEUR APPLIQUE SA RÈGLE DES ENTRAÎNEMENTS.
// Tournée G3 : aucune demande ne partait, POST /api/events répondait 400 « Les entrainements
// ouverts exigent au moins une place externe ». Ce témoin était vert parce que son POST acceptait
// tout. Copie de la règle d'admin (src/api/event/controllers/event.ts,
// applyTrainingOpenMutationRules) : un entraînement sans `sessionStatus` est OUVERT, et un
// entraînement ouvert exige au moins une place pour le dehors.
const regleDesEntrainementsDuServeur = (/** @type {any} */ corps) => {
  const entrainement = corps?.data?.type === 'type-entr';
  const ouvert = String(corps?.data?.sessionStatus || 'open').trim().toLowerCase() !== 'closed';
  if (entrainement && ouvert && !(Number(corps?.data?.externalParticipantLimit) >= 1)) {
    const refus = /** @type {any} */ (new Error('Request failed with status code 400'));
    refus.response = {
      data: { error: { message: 'Les entrainements ouverts exigent au moins une place externe.' } },
      status: 400,
    };
    throw refus;
  }
};

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatir(n.props.children).trim());
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  const cible = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === testID
    && typeof n.props?.onPress === 'function')[0];
  await act(async () => { await cible.props.onPress(); });
};
// eslint-disable-next-line max-len
const saisir = async (/** @type {any} */ arbre, /** @type {string} */ testID, /** @type {string} */ texte) => {
  const champ = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === testID
    && typeof n.props?.onChangeText === 'function')[0];
  await act(async () => { champ.props.onChangeText(texte); });
};
const bouton = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root
  // eslint-disable-next-line max-len
  .findAll((/** @type {any} */ n) => n.props?.testID === `bouton-${titre}` && typeof n.props?.onPress === 'function')[0];

jest.setTimeout(20000);
const attendre = async (/** @type {() => boolean} */ condition) => {
  for (let essai = 0; essai < 150 && !condition(); essai += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((r) => { setTimeout(r, 20); }); });
  }
};
const monter = async (/** @type {(lus: string[]) => boolean} */ pret) => {
  // eslint-disable-next-line max-len
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <ClubSlotRequest />
      </QueryClientProvider>,
    );
  });
  await attendre(() => pret(textes(arbre)));
  return arbre;
};

beforeEach(() => {
  mockApercu = APERCU_LIBRE;
  mockStatut = 'pending_validation';
  mockRaison = 'facility_overbooking';
  mockParams = {
    clubId: 'club-A', date: JOUR, endTime: '19:30', facilityId: 'gym-ville', startTime: '18:00',
  };
  mockGet.mockReset();
  mockPost.mockReset();
  mockNavigate.mockReset();
  mockGet.mockImplementation(async (/** @type {string} */ url) => {
    // eslint-disable-next-line max-len
    if (url === '/clubs/club-A/collectivite-installations') return { data: { data: [INSTALLATION] } };
    if (url === '/teams') {
      // eslint-disable-next-line max-len
      return { data: { data: [{ documentId: 'u13', name: 'U13' }, { documentId: 'u15', name: 'U15' }] } };
    }
    // eslint-disable-next-line max-len
    if (url === '/event-types') return { data: { data: [{ documentId: 'type-entr', name: 'Entraînement' }] } };
    if (url === '/facilities/gym-ville/season-slots/preview') return { data: { data: mockApercu } };
    if (url === '/facilities/gym-ville/planning') {
      // eslint-disable-next-line max-len
      return { data: { data: [bloc('club-A'), bloc('club-B')], meta: { facility: { maxSlots: 2 } } } };
    }
    throw new Error(`GET inattendu ${url}`);
  });
  mockPost.mockImplementation(async (/** @type {string} */ url, /** @type {any} */ corps) => {
    if (url === '/events') regleDesEntrainementsDuServeur(corps);
    return {
      data: {
        corps,
        data: {
          documentId: `ev-${mockPost.mock.calls.length}`,
          pendingReason: mockStatut === 'pending_validation' ? mockRaison : 'none',
          status: mockStatut,
        },
      },
    };
  });
});

describe('COLL-C3B — planche P8v2 : le club demande un créneau', () => {
  // eslint-disable-next-line max-len
  it('la place se lit pendant la saisie : il reste 1 place, « AS Montrivage · U15 (ton club) »', async () => {
    const lus = textes(await monter((l) => l.includes('Il y a déjà 1 équipe : il reste 1 place.')));
    expect(lus).toEqual(expect.arrayContaining([
      'Demander un créneau',
      'Gymnase des Tilleuls',
      'Ville de Montrivage · 2 équipes à la fois',
      'Il y a déjà 1 équipe : il reste 1 place.',
      'Déjà là : AS Montrivage · U15 (ton club), de 18:00 à 19:30.',
      'La Ville de Montrivage accepte ou refuse ; tu reçois sa réponse en notification.',
      'Envoyer la demande',
    ]));
  });

  // eslint-disable-next-line max-len
  it('complet : on ne bloque pas, la mairie décidera ; les heures libres du jour d’un appui', async () => {
    mockApercu = APERCU_COMPLET;
    const arbre = await monter((l) => l.includes('Il y a déjà 2 équipes : c’est complet.'));
    await attendre(() => textes(arbre).includes('08:00 – 18:00'));
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      // eslint-disable-next-line max-len
      'Déjà là : AS Montrivage · U15 (ton club), de 18:00 à 19:30 et Montrivage FC · Senior B, de 18:00 à 19:30.',
      'Tu peux demander quand même : la mairie décidera.',
      'Libre ce jeudi :',
      '08:00 – 18:00',
      '19:30 – 22:00',
      'Envoyer quand même',
    ]));
    await appuyer(arbre, 'demande-libre-19:30');
    const debut = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'demande-debut'
      && typeof n.props?.onChangeText === 'function')[0];
    expect(debut.props.value).toBe('19:30');
  });

  it('hors des heures d’ouverture : le seul blocage, l’erreur dit l’heure', async () => {
    const arbre = await monter((l) => l.includes('Il y a déjà 1 équipe : il reste 1 place.'));
    await saisir(arbre, 'demande-fin', '22:30');
    // eslint-disable-next-line max-len
    expect(textes(arbre)).toContain('L’installation ferme à 22:00. Termine à 22:00, ou commence plus tôt.');
    expect(bouton(arbre, 'Envoyer la demande').props.disabled).toBe(true);
  });

  // eslint-disable-next-line max-len
  it('une fois : l’entraînement de l’équipe, le mot pour la mairie compris ; puis l’accusé', async () => {
    const arbre = await monter((l) => l.includes('Il y a déjà 1 équipe : il reste 1 place.'));
    await appuyer(arbre, 'demande-equipe-u13');
    await saisir(arbre, 'demande-mot', 'Séance supplémentaire avant le match');
    await attendre(() => bouton(arbre, 'Envoyer la demande').props.disabled === false);
    await appuyer(arbre, 'bouton-Envoyer la demande');
    await attendre(() => textes(arbre).includes('Demande envoyée à la Ville de Montrivage'));
    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, corps] = mockPost.mock.calls[0];
    expect(url).toBe('/events');
    expect(corps.data).toEqual(expect.objectContaining({
      club: 'club-A',
      facility: 'gym-ville',
      facilityRequestNote: 'Séance supplémentaire avant le match',
      team: 'u13',
      type: 'type-entr',
    }));
    // COLL-FIX-DEMANDES : une demande à la Ville est la séance de l'équipe, FERMÉE au dehors ;
    // aucune place externe n'est inventée : le serveur refusait la limite 0 d'un entraînement
    // ouvert.
    expect(corps.data.sessionStatus).toBe('closed');
    expect('externalParticipantLimit' in corps.data).toBe(false);
    expect('externalParticipantValidationMode' in corps.data).toBe(false);
    // eslint-disable-next-line max-len
    expect(new Date(corps.data.endDate).getTime() - new Date(corps.data.date).getTime()).toBe(90 * 60 * 1000);
    expect('recurrenceGroupId' in corps.data).toBe(false);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'U13 · jeu. 3 oct., 18:00 – 19:30 · Gymnase des Tilleuls',
      'La mairie l’accepte ou la refuse. Tu reçois sa réponse en notification, avec son mot.',
      'En attente de la mairie',
    ]));
    await appuyer(arbre, 'bouton-Voir mes demandes');
    expect(mockNavigate).toHaveBeenCalledWith('ClubSlotRequests', { clubId: 'club-A' });
  });

  it('chaque semaine : une séance par jeudi jusqu’au 30 juin, d’une même série', async () => {
    const arbre = await monter((l) => l.includes('Il y a déjà 1 équipe : il reste 1 place.'));
    await appuyer(arbre, 'demande-equipe-u13');
    await appuyer(arbre, 'demande-chaque-semaine');
    await attendre(() => bouton(arbre, 'Envoyer la demande')?.props.disabled === false);
    await appuyer(arbre, 'bouton-Envoyer la demande');
    await attendre(() => textes(arbre).includes('Demande envoyée à la Ville de Montrivage'));
    // Du jeudi 3 octobre 2030 au jeudi 26 juin 2031 : 39 jeudis.
    expect(mockPost).toHaveBeenCalledTimes(39);
    const groupes = new Set(mockPost.mock.calls.map(([, corps]) => corps.data.recurrenceGroupId));
    expect(groupes.size).toBe(1);
    // COLL-FIX-DEMANDES : chaque séance de la série est fermée au dehors.
    // eslint-disable-next-line max-len
    expect(mockPost.mock.calls.every(([, corps]) => corps.data.sessionStatus === 'closed')).toBe(true);
    expect([...groupes][0]).toBeTruthy();
    // eslint-disable-next-line max-len
    expect(textes(arbre)).toContain('U13 · chaque jeudi, 18:00 – 19:30, jusqu’au 30 juin · Gymnase des Tilleuls');
  });

  // DECISIONS-SOIR (02/10) — SPEC-PLACE, règle d'Adel : « Si c'est une place libre attribuée au
  // club, ça se valide seul ; sinon, si c'est hors attribution au club, ça demande une validation
  // à la mairie. » Le serveur ne confirme d'office QUE dans un créneau du club : l'accusé le dit.
  // eslint-disable-next-line max-len
  it('SPEC-PLACE : le serveur confirme (créneau du club) : l’accusé dit que c’est posé DANS son créneau', async () => {
    mockStatut = 'confirmed';
    const arbre = await monter((l) => l.includes('Il y a déjà 1 équipe : il reste 1 place.'));
    await appuyer(arbre, 'demande-equipe-u13');
    await attendre(() => bouton(arbre, 'Envoyer la demande').props.disabled === false);
    await appuyer(arbre, 'bouton-Envoyer la demande');
    await attendre(() => textes(arbre).includes('C’est posé : c’est dans ton créneau'));
    // eslint-disable-next-line max-len
    expect(textes(arbre)).toContain('Ton entraînement est confirmé : la Ville a déjà attribué ce créneau à ton club.');
    expect(textes(arbre)).not.toContain('C’est posé : il restait de la place');
  });

  // eslint-disable-next-line max-len
  it('SPEC-PLACE : hors créneau, place LIBRE, le serveur met en attente : « Demande envoyée à la Ville »', async () => {
    const arbre = await monter((l) => l.includes('Il y a déjà 1 équipe : il reste 1 place.'));
    await appuyer(arbre, 'demande-equipe-u13');
    await attendre(() => bouton(arbre, 'Envoyer la demande').props.disabled === false);
    await appuyer(arbre, 'bouton-Envoyer la demande');
    await attendre(() => textes(arbre).includes('Demande envoyée à la Ville de Montrivage'));
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'La mairie l’accepte ou la refuse. Tu reçois sa réponse en notification, avec son mot.',
      'En attente de la mairie',
    ]));
  });

  // eslint-disable-next-line max-len
  it('D32 : dans le créneau du club mais déjà au complet : l’accusé dit que c’est le DIRIGEANT qui décide', async () => {
    mockRaison = 'club_slot_overflow';
    const arbre = await monter((l) => l.includes('Il y a déjà 1 équipe : il reste 1 place.'));
    await appuyer(arbre, 'demande-equipe-u13');
    await attendre(() => bouton(arbre, 'Envoyer la demande').props.disabled === false);
    await appuyer(arbre, 'bouton-Envoyer la demande');
    await attendre(() => textes(arbre).includes('Demande envoyée à ton dirigeant'));
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      // eslint-disable-next-line max-len
      'Ton club est déjà au complet dans son créneau à ce moment : ton dirigeant l’accepte ou la refuse. Tu reçois sa réponse en notification.',
      'En attente de ton dirigeant',
    ]));
    expect(textes(arbre)).not.toContain('En attente de la mairie');
    expect(textes(arbre)).not.toContain('Demande envoyée à la Ville de Montrivage');
  });
});
