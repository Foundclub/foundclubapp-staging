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

// COLL-C3B-BIS (03/10) — planche 43 (P8v2-demande, tel et ordi ; liste du plan, ligne 43). ROUGE
// avant : l'installation choisie ne se changeait pas, et la saisie n'existait qu'en écran entier
// (sur ordinateur, la planche l'ouvre en PANNEAU à droite du planning, qui dessine la place
// demandée en pointillé pendant la saisie).
describe('COLL-C3B-BIS — planche 43 : « Changer » d’installation, et la saisie en panneau', () => {
  it('« Changer » rend le choix de l’installation', async () => {
    const arbre = await monter((l) => l.includes('Gymnase des Tilleuls'));
    expect(textes(arbre)).toContain('Changer');
    await appuyer(arbre, 'demande-installation-changer');
    const puces = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.testID === 'demande-installation-gym-ville' && typeof n.props?.onPress === 'function'
    ));
    expect(puces.length).toBeGreaterThan(0);
  });

  // eslint-disable-next-line max-len
  it('en panneau : « Demander ce créneau », rempli par le planning ; le brouillon remonte au planning', async () => {
    mockParams = {};
    const brouillon = jest.fn();
    const fermer = jest.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <QueryClientProvider client={client}>
          <ClubSlotRequest
            enPanneau
            initial={{
              clubId: 'club-A',
              date: JOUR,
              endTime: '19:30',
              facilityId: 'gym-ville',
              startTime: '18:00',
            }}
            onBrouillon={brouillon}
            onFermer={fermer}
          />
        </QueryClientProvider>,
      );
    });
    await attendre(() => textes(arbre).includes('Gymnase des Tilleuls'));
    expect(textes(arbre)).toContain('Demander ce créneau');
    expect(textes(arbre)).not.toContain('Demander un créneau');
    await appuyer(arbre, 'demande-equipe-u13');
    expect(brouillon).toHaveBeenLastCalledWith({
      date: JOUR, endTime: '19:30', equipe: 'U13', facilityId: 'gym-ville', startTime: '18:00',
    });
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

  // VILLE-INSTALLATION (07/10) — décision d Adel « on ne met pas d ouverture ni de fermeture »,
  // puis décision du chef d orchestre, dans sa ligne : des horaires que plus personne ne peut
  // modifier ne BLOQUENT plus rien. Cette installation garde 08:00 - 22:00 en base (comme
  // l installation 73 de la prod) : finir à 22:30 ne dit plus rien et s envoie.
  it('hors des heures d’ouverture enregistrées : ni blocage, ni avertissement', async () => {
    const arbre = await monter((l) => l.includes('Il y a déjà 1 équipe : il reste 1 place.'));
    await appuyer(arbre, 'demande-equipe-u13');
    await saisir(arbre, 'demande-fin', '22:30');
    expect(textes(arbre).join(' | ')).not.toMatch(/L’installation (ferme|ouvre) à/);
    expect(arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'demande-hors-ouverture',
    )).toHaveLength(0);
    await attendre(() => bouton(arbre, 'Envoyer la demande').props.disabled === false);
    expect(bouton(arbre, 'Envoyer la demande').props.disabled).toBe(false);
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
    // SERIE-ANNONCE (06/10) : une seule séance n'est pas une série — ni « j'annoncerai »,
    // ni « annoncer la série ».
    expect('announceSeriesLater' in corps).toBe(false);
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
    // SERIE-ANNONCE (06/10) : les POST /events seulement (« annoncer la série » est à part).
    const poses = mockPost.mock.calls.filter(([url]) => url === '/events');
    expect(poses).toHaveLength(39);
    const groupes = new Set(poses.map(([, corps]) => corps.data.recurrenceGroupId));
    expect(groupes.size).toBe(1);
    // COLL-FIX-DEMANDES : chaque séance de la série est fermée au dehors.
    expect(poses.every(([, corps]) => corps.data.sessionStatus === 'closed')).toBe(true);
    expect([...groupes][0]).toBeTruthy();
    // COLL-FIX2 (T10) : la fin dite est la DERNIÈRE séance (le jeudi 26 juin), comme côté Ville et
    // dans « Tes demandes à la Ville » — plus la fin de saison (30 juin), qui n'est pas un jeudi.
    // eslint-disable-next-line max-len
    expect(textes(arbre)).toContain('U13 · chaque jeudi, 18:00 – 19:30, jusqu’au 26 juin · Gymnase des Tilleuls');
  });

  // SERIE-ANNONCE (06/10, décision du chef « serie A ») — une série posée d'office dans le
  // créneau du club s'annonce UNE fois à l'équipe, et dit la série : chaque séance part
  // « j'annoncerai » (à la RACINE du corps, jamais dans `data`), puis UN appel « annoncer la
  // série » avec la première séance posée.
  // eslint-disable-next-line max-len
  it('chaque semaine : chaque séance part « j’annoncerai », puis UN appel « annoncer la série »', async () => {
    mockStatut = 'confirmed';
    const arbre = await monter((l) => l.includes('Il y a déjà 1 équipe : il reste 1 place.'));
    await appuyer(arbre, 'demande-equipe-u13');
    await appuyer(arbre, 'demande-chaque-semaine');
    await attendre(() => bouton(arbre, 'Envoyer la demande')?.props.disabled === false);
    await appuyer(arbre, 'bouton-Envoyer la demande');
    await attendre(() => textes(arbre).includes('C’est posé : c’est dans ton créneau'));
    const poses = mockPost.mock.calls.filter(([url]) => url === '/events');
    expect(poses).toHaveLength(39);
    expect(poses.every(([, corps]) => corps.announceSeriesLater === true)).toBe(true);
    expect(poses.some(([, corps]) => 'announceSeriesLater' in corps.data)).toBe(false);
    const annonces = mockPost.mock.calls
      .filter(([url]) => String(url).endsWith('/announce-series'));
    expect(annonces).toEqual([['/events/ev-1/announce-series']]);
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

// 🧭 COLL-FIX2 (03/10) — point 2, planche 43 (tournée T10) : L'APERÇU DIT CE QUE LE SERVEUR FERA.
// Le formulaire disait « c'est complet · Tu peux demander quand même : la mairie décidera », puis
// l'accusé « C'est posé » : le club avait SON créneau ce jour-là (D32). L'aperçu ne lisait que la
// place de l'installation. Le serveur (admin COLL-FIX2, `judgeSession`) rend désormais `decision`
// quand l'app lui donne le club et l'équipe : les mêmes juges, dans le même ordre qu'event.create.
describe('COLL-FIX2 — l’aperçu dit qui décidera (D32, SPEC-PLACE)', () => {
  const apercusDemandes = () => mockGet.mock.calls
    .filter(([url]) => url === '/facilities/gym-ville/season-slots/preview')
    .map(([, options]) => options?.params || {});
  const MAIRIE_DECIDE = 'Tu peux demander quand même : la mairie décidera.';
  // eslint-disable-next-line max-len
  const LA_VILLE_REPOND = 'La Ville de Montrivage accepte ou refuse ; tu reçois sa réponse en notification.';

  it('l’aperçu est demandé au nom du club et de l’équipe choisie', async () => {
    const arbre = await monter((l) => l.includes('Il y a déjà 1 équipe : il reste 1 place.'));
    await appuyer(arbre, 'demande-equipe-u13');
    await attendre(() => apercusDemandes().some((p) => p.team === 'u13'));
    expect(apercusDemandes().at(-1))
      .toEqual(expect.objectContaining({ club: 'club-A', team: 'u13' }));
  });

  // eslint-disable-next-line max-len
  it('dans le créneau du club, gymnase complet : posé tout de suite, pas « la mairie décidera »', async () => {
    mockApercu = { ...APERCU_COMPLET, decision: { inClubSlot: true, outcome: 'direct' } };
    const phrase = 'C’est dans le créneau de ton club : ton entraînement sera posé tout de suite.';
    const arbre = await monter((l) => l.includes(phrase));
    const lus = textes(arbre);
    expect(lus).toContain(phrase);
    expect(lus).toContain('Il y a déjà 2 équipes : c’est complet.');
    expect(lus).not.toContain(MAIRIE_DECIDE);
    expect(lus).not.toContain(LA_VILLE_REPOND);
    expect(lus).not.toContain('Libre ce jeudi :');
    expect(lus).toContain('Poser l’entraînement');
    expect(lus).not.toContain('Envoyer quand même');
  });

  // eslint-disable-next-line max-len
  it('le club déjà au complet dans son créneau : son dirigeant décidera, pas la mairie', async () => {
    mockApercu = { ...APERCU_LIBRE, decision: { inClubSlot: true, outcome: 'dirigeant' } };
    const phrase = 'Ton club est déjà au complet dans son créneau : ton dirigeant décidera.';
    const arbre = await monter((l) => l.includes(phrase));
    const lus = textes(arbre);
    expect(lus).toContain(phrase);
    // eslint-disable-next-line max-len
    expect(lus).toContain('Ton dirigeant accepte ou refuse ; tu reçois sa réponse en notification.');
    expect(lus).not.toContain(LA_VILLE_REPOND);
    expect(lus).not.toContain(MAIRIE_DECIDE);
    expect(lus).toContain('Envoyer la demande');
  });

  // eslint-disable-next-line max-len
  it('hors des créneaux du club, place libre : la mairie décidera quand même (SPEC-PLACE)', async () => {
    mockApercu = { ...APERCU_LIBRE, decision: { inClubSlot: false, outcome: 'mairie' } };
    // eslint-disable-next-line max-len
    const phrase = 'Hors des créneaux de ton club : la mairie décidera, même s’il reste de la place.';
    const arbre = await monter((l) => l.includes(phrase));
    expect(textes(arbre))
      .toEqual(expect.arrayContaining([phrase, LA_VILLE_REPOND, 'Envoyer la demande']));
  });

  it('complet, et l’installation n’accepte aucune équipe en plus : l’envoi est fermé', async () => {
    mockApercu = { ...APERCU_COMPLET, decision: { inClubSlot: false, outcome: 'complet' } };
    // eslint-disable-next-line max-len
    const phrase = 'C’est complet : l’installation n’accepte pas d’équipe en plus. Choisis une autre heure.';
    const arbre = await monter((l) => l.includes(phrase));
    await appuyer(arbre, 'demande-equipe-u13');
    expect(textes(arbre)).toContain(phrase);
    expect(textes(arbre)).not.toContain(MAIRIE_DECIDE);
    expect(bouton(arbre, 'Envoyer la demande').props.disabled).toBe(true);
  });

  it('qui tranche lui-même, place libre : posé tout de suite', async () => {
    mockApercu = { ...APERCU_LIBRE, decision: { inClubSlot: false, outcome: 'direct' } };
    const arbre = await monter((l) => l.includes('Ton entraînement sera posé tout de suite.'));
    expect(textes(arbre)).toContain('Ton entraînement sera posé tout de suite.');
    expect(textes(arbre)).toContain('Poser l’entraînement');
    expect(textes(arbre)).not.toContain(LA_VILLE_REPOND);
  });
});

// 🧮 FINITIONS12-COLL (03/10) — point 2 : L'APERÇU D'UNE SÉRIE ADDITIONNAIT LES DATES. Tournée T11
// (C43_6) : « Il y a déjà 39 équipes : c'est complet » et « AS Montrivage · U13 » deux fois, pour
// une série de 38 jeudis dont UN seul est plein (la Ville : « Complet 1 fois sur 38 »). Le serveur
// rend une ligne d'occupant par séance datée de la saison, et la place au PIC ; il dit désormais
// combien de dates sont pleines (`occurrences`). ROUGE avant le lot.
describe('FINITIONS12-COLL point 2 — l’aperçu d’une série se lit date par date', () => {
  // 37 séances datées des U13 (une par jeudi) et 1 des U15 : 38 lignes, UN jeudi plein.
  const ligne = (/** @type {string} */ equipe, /** @type {string} */ jour) => ({
    club: { documentId: 'club-A', name: 'AS Montrivage' },
    endTime: '19:30',
    startTime: '18:00',
    team: { name: equipe },
    validFrom: jour,
    validUntil: jour,
  });
  const SERIE_UN_PLEIN = {
    capacity: 2,
    occupants: [
      ...Array.from({ length: 37 }, () => ligne('U13', JOUR)),
      ligne('U15', JOUR),
    ],
    occurrences: { count: 38, fullCount: 1, fullDates: [JOUR] },
    peak: 2,
    remaining: 0,
  };

  it('1 jeudi plein sur 38 : « Complet 1 fois sur 38 dates », jamais « 38 équipes »', async () => {
    mockApercu = SERIE_UN_PLEIN;
    const arbre = await monter((l) => l.includes('Gymnase des Tilleuls'));
    await appuyer(arbre, 'demande-chaque-semaine');
    await attendre(() => textes(arbre).some((t) => t.startsWith('Complet 1 fois')));
    const lus = textes(arbre);
    expect(lus).toContain('Complet 1 fois sur 38 dates : jeu. 3 oct.');
    expect(lus.join(' | ')).not.toMatch(/38 équipes|39 équipes/);
    // Les noms ne se répètent plus : une ligne par club · équipe · heures.
    expect(lus).toContain(
      // eslint-disable-next-line max-len
      'Déjà là : AS Montrivage · U13 (ton club), de 18:00 à 19:30 et AS Montrivage · U15 (ton club), de 18:00 à 19:30.',
    );
  });

  it('tous les jeudis pleins : « Complet chaque semaine : il y a déjà 2 équipes. »', async () => {
    mockApercu = {
      ...SERIE_UN_PLEIN, occurrences: { count: 38, fullCount: 38, fullDates: [JOUR] },
    };
    const arbre = await monter((l) => l.includes('Gymnase des Tilleuls'));
    await appuyer(arbre, 'demande-chaque-semaine');
    await attendre(() => textes(arbre).some((t) => t.startsWith('Complet chaque semaine')));
    expect(textes(arbre)).toContain('Complet chaque semaine : il y a déjà 2 équipes.');
  });
});

// 🏛️ FINITIONS12-COLL (03/10) — point 6, `creation` (tranché par le chef) : la demande DIT ce qui
// arrive si la mairie refuse, comme le déplacement (FINITIONS11-COLL point 7, même clé). À une
// condition, REMPLIE : un témoin serveur prouve qu'une séance CRÉÉE hors créneau puis REFUSÉE est
// annulée — banc vrai moteur du lot (P6 : POST /api/events hors créneau ⇒ pending_validation ;
// refus de la Ville ⇒ cancelled, inactive, 404 pour l'entraîneur) et admin
// tests/authz/COLL3A-demandes-le-proprietaire-tranche.test.js (T5). ROUGE avant le lot.
describe('FINITIONS12-COLL point 6 — « Si la mairie refuse, la séance sera annulée. »', () => {
  const PHRASE = 'Si la mairie refuse, la séance sera annulée.';

  it('la mairie décidera : la phrase est là, avant l’envoi', async () => {
    mockApercu = { ...APERCU_LIBRE, decision: { inClubSlot: false, outcome: 'mairie' } };
    const arbre = await monter((l) => l.includes(PHRASE));
    expect(textes(arbre)).toContain(PHRASE);
  });

  it.each([
    ['posée tout de suite', { inClubSlot: true, outcome: 'direct' }],
    ['le dirigeant décidera', { inClubSlot: true, outcome: 'dirigeant' }],
  ])('%s : pas de phrase sur la mairie', async (_cas, decision) => {
    mockApercu = { ...APERCU_LIBRE, decision };
    const arbre = await monter((l) => l.includes('Gymnase des Tilleuls'));
    await attendre(() => textes(arbre).some((texte) => /posé|dirigeant/.test(texte)));
    expect(textes(arbre)).not.toContain(PHRASE);
  });
});
