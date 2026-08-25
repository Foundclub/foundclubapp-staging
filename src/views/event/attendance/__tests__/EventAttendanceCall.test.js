import renderer, { act } from 'react-test-renderer';

import EventAttendanceCall from '../EventAttendanceCall';

/**
 * L5-A · ETAPE 4 — L ECRAN « FAIRE L APPEL », cadres 2A / 2B / 2C.
 *
 * 🔬 CE QUE CES TEMOINS TIENNENT :
 *   1. 2A — avant l heure, le bouton DIT quand ca ouvre. Jamais un bouton muet.
 *   2. 2B — dans la fenetre, le depart : « 0 pointé sur 22 », les compteurs de
 *      PRESENCE (jamais ceux de reponse en meme temps), et un pied desactive.
 *   3. 2C — un sans-reponse se pointe D UN GESTE (c est l ouverture serveur
 *      AD04 : le verrou est l audience, plus « a dit oui »).
 *   4. « Tout pointer » passe par l envoi GROUPE, et un refus s affiche.
 *   5. La ligne n est PAS cliquable ; ses deux cibles font 44.
 *   6. `participantIdentitiesHidden` est respecte : aucun nom rendu.
 *   7. L horloge du TELEPHONE ne decide de rien.
 *   7b. Un non-pointe passe `no_show` par le cron reste POINTABLE.
 *
 * 🌍 LA MACHINE DE TEST EST EN Asia/Bangkok (mesure du 2026-08-23). C est une
 * chance : un ecran qui formaterait l heure d ouverture sur l horloge locale
 * afficherait « 22:30 » pour un match parisien de 18:00, et ces temoins le
 * verraient. C est exactement ce qui arrive a un coach qui voyage.
 */

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

/** @type {any} */
let mockRouteParams = { eventId: 'evt-1' };
/** @type {any} */
let mockEvent;
/** @type {any} */
let mockAttendance;

const mockBulkMutate = jest.fn();
const mockCoachArrivalMutate = jest.fn();
const mockLateMutate = jest.fn();
const mockResetMutate = jest.fn();

// 🧨 L objet `navigation` est FIGE : le recreer a chaque rendu relance les
// effets qui en dependent, et Jest part en boucle infinie SANS message utile.
const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({
    // i18next rend le REPLI quand la clef n existe pas : `fr.js` appartient au
    // lot L4, ce lot-ci n y ecrit rien et vit sur ses replis francais.
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({ data: mockEvent, isFetching: false }),
  useGetEventAttendance: () => ({
    data: mockAttendance,
    isFetching: false,
    refetch: jest.fn(),
  }),
}));

// 🪤 PIEGE DE COPIE DE TRAVAIL : surtout PAS de `requireActual` ici. Le hook
// importe `eventService`, qui importe `react-native-blob-util` — publie en ESM
// et non transforme : la SUITE ENTIERE meurt au chargement, 0 test execute.
jest.mock('../useAttendanceCallMutations', () => ({
  useAttendanceCallMutations: () => ({
    bulkMutation: { isPending: false, mutate: mockBulkMutate },
    coachArrivalMutation: { isPending: false, mutate: mockCoachArrivalMutate },
    invalidateAll: jest.fn(),
    lateMinutesMutation: { isPending: false, mutate: mockLateMutate },
    resetMutation: { isPending: false, mutate: mockResetMutate },
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
      Images: { arrowLeft: 1, chevronLeft: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>RETOUR</TexteRN>,
  };
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { name }) => <TexteRN>{`AVATAR:${name || ''}`}</TexteRN>,
  };
});

// `SegmentedControl` tire `react-native-gesture-handler`, publie en TypeScript
// non transforme : sans doublure, la suite meurt au CHARGEMENT. Celle-ci est
// FIDELE — elle rend les segments appuyables, parce que le temoin 2C doit
// pouvoir changer d onglet pour de vrai.
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onChange, options }) => (
      options.map((/** @type {any} */ option) => (
        <TouchableOpacity key={option.value} onPress={() => onChange(option.value)}>
          <TexteRN>{option.label}</TexteRN>
        </TouchableOpacity>
      ))
    ),
  };
});

// La feuille n existe dans l arbre QUE quand elle est ouverte, et son pied est
// rendu avec elle (meme doublure que MatchCallUpSelection.test.js).
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, footerComponent, isVisible }) => (
      isVisible ? (
        <VueRN>
          {children}
          {footerComponent}
        </VueRN>
      ) : null
    ),
  };
});

const DEBUT_ISO = '2026-08-19T16:00:00.000Z'; // 18:00 a Paris
const OUVRE_ISO = '2026-08-19T15:30:00.000Z'; // 17:30 a Paris
const FERME_ISO = '2026-08-19T20:00:00.000Z'; // 22:00 a Paris

/**
 * Aplati les enfants React en une chaine, pour lire le texte rendu.
 * @param {any} enfants - Un noeud React quelconque.
 * @returns {string} - Le texte concatene.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') {
    // 🪤 Deux formes d arbre coexistent : `toJSON()` pose les enfants a la
    // RACINE du noeud, l arbre d instances les pose sous `props`. Lire une
    // seule des deux rend une chaine VIDE — et un temoin qui compare du vide
    // a du vide passerait au vert sans rien mesurer.
    const directs = Object.prototype.hasOwnProperty.call(enfants, 'children')
      ? enfants.children
      : enfants?.props?.children;
    return aplatirTexte(directs);
  }
  return String(enfants);
};

/**
 * Fabrique une ligne de la feuille de presence.
 * @param {any} options - Les traits de la ligne voulue.
 * @returns {any} - L element de la reponse serveur.
 */
const ligne = ({
  arrivedAt = null,
  attendanceStatus = 'not_marked',
  firstname,
  isLate = false,
  lateMinutes = 0,
  rsvpStatus = 'participating',
  userId,
}) => ({
  attendance: arrivedAt ? { arrivedAt, lateMinutes, note: null } : null,
  attendanceStatus,
  countsInTeamStats: {},
  finalOperationalStatus: 'pending',
  isLate,
  rsvpStatus,
  user: {
    avatar: null, documentId: userId, firstname, lastname: 'Dupont',
  },
});

/**
 * Construit la reponse de `list`.
 * @param {any} options - Ce qui change d un temoin a l autre.
 * @returns {any} - La reponse complete.
 */
const reponseAttendance = ({
  identitiesHidden = false,
  items,
  serverNow,
  window: fenetre = { closesAt: FERME_ISO, enabled: true, opensAt: OUVRE_ISO },
}) => ({
  data: {
    eventId: 'evt-1',
    eventStartAt: DEBUT_ISO,
    items,
    participantIdentitiesHidden: identitiesHidden,
    serverNow,
    timezone: 'Europe/Paris',
    window: fenetre,
  },
});

/**
 * Monte l ecran et rend l arbre.
 * @returns {Promise<any>} - L arbre monte.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<EventAttendanceCall />);
  });
  return arbre;
};

/**
 * L etiquette et le texte d un noeud, colles — de quoi le reconnaitre.
 * @param {any} noeud - Un noeud de l arbre.
 * @returns {string} - Etiquette + texte.
 */
const decrire = (noeud) => (
  `${noeud.props?.accessibilityLabel || ''} ${aplatirTexte(noeud.props?.children)}`
);

/**
 * Tous les noeuds HOTES portant `accessibilityRole: 'button'`.
 *
 * 🪤 `findAll` traverse aussi les composants COMPOSITES : sans le filtre sur
 * `typeof type === 'string'`, un `TouchableOpacity` compte DEUX fois (lui-meme
 * et la vue qu il rend), et « deux cibles par ligne » deviendrait quatre.
 * @param {any} arbre - L arbre monte.
 * @returns {any[]} - Les cibles trouvees.
 */
const boutons = (arbre) => arbre.root.findAll(
  (/** @type {any} */ noeud) => typeof noeud.type === 'string'
    && noeud.props?.accessibilityRole === 'button',
  { deep: true },
);

/**
 * La cible dont le libelle contient `texte`.
 * @param {any} arbre - L arbre monte.
 * @param {string} texte - Un fragment de libelle ou d etiquette.
 * @returns {any} - La premiere cible correspondante.
 */
const bouton = (arbre, texte) => boutons(arbre).find(
  (/** @type {any} */ noeud) => decrire(noeud).includes(texte),
);

/**
 * N importe quoi d appuyable portant `texte` — y compris les segments du
 * `SegmentedControl`, qui ne declarent pas de `accessibilityRole`.
 * @param {any} arbre - L arbre monte.
 * @param {string} texte - Un fragment de libelle ou d etiquette.
 * @returns {any} - Le premier noeud appuyable correspondant.
 */
const appuyable = (arbre, texte) => arbre.root.findAll(
  (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
    && decrire(noeud).includes(texte),
  { deep: true },
)[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = { eventId: 'evt-1' };
  mockEvent = {
    date: DEBUT_ISO,
    documentId: 'evt-1',
    endTime: '20:00',
    name: 'Entraînement',
    team: { documentId: 'team-1', name: 'Seniors A' },
  };
  mockAttendance = null;
});

describe('L5-A · 2A — avant l heure, le bouton dit quand ca ouvre', () => {
  test('« Ouvre à 17:30 », desactive, avec les compteurs de REPONSES', async () => {
    mockAttendance = reponseAttendance({
      items: [
        ligne({ firstname: 'Leo', rsvpStatus: 'participating', userId: 'u1' }),
        ligne({ firstname: 'Enzo', rsvpStatus: 'participating', userId: 'u2' }),
        ligne({ firstname: 'Malo', rsvpStatus: 'missing', userId: 'u3' }),
        ligne({ firstname: 'Ilan', rsvpStatus: 'not_answered', userId: 'u4' }),
      ],
      serverNow: '2026-08-19T15:12:00.000Z', // 17:12 a Paris — 18 min avant l ouverture
    });

    const arbre = await monter();
    const texte = aplatirTexte(arbre.toJSON());

    // 🌍 Le point qui compte : « 17:30 », pas « 22:30 ». La machine est en
    // Asia/Bangkok — seule une lecture dans le fuseau du club donne 17:30.
    expect(texte).toContain('Ouvre à 17:30');
    expect(texte).toContain("L'appel est ouvert dès la création de l'événement");

    // Compteurs de REPONSES.
    expect(texte).toContain('Présent·e·s');
    expect(texte).toContain('Absent·e·s');
    expect(texte).toContain('Sans réponse');

    // ⛔ « Réponse ≠ présence » : jamais les deux echelles ensemble.
    expect(texte).not.toContain('Arrivé·e·s');
    expect(texte).not.toContain('En attente');

    const ouvre = bouton(arbre, 'Ouvre à 17:30');
    expect(ouvre).toBeTruthy();
    expect(ouvre.props.accessibilityState?.disabled).toBe(true);
  });

  test('sans `window` dans la reponse, le repli calcule endTime puis 30 / 120', async () => {
    mockAttendance = reponseAttendance({
      items: [ligne({ firstname: 'Leo', userId: 'u1' })],
      serverNow: '2026-08-19T15:12:00.000Z',
      window: undefined,
    });

    const arbre = await monter();
    const texte = aplatirTexte(arbre.toJSON());

    // Repli : debut 18:00 - 30 min = 17:30 a Paris, calcule sans le serveur.
    expect(texte).toContain('Ouvre à 17:30');
  });
});

describe('L5-A · fenetre DEJA FERMEE — le bouton ne raconte pas l ouverture', () => {
  test('apres la fermeture, il dit « Fermé depuis 22:00 », jamais « Ouvre à 17:30 »', async () => {
    mockAttendance = reponseAttendance({
      items: [ligne({ firstname: 'Leo', userId: 'u1' })],
      serverNow: '2026-08-19T21:00:00.000Z', // 23:00 a Paris — 1 h APRES la fermeture
    });

    const arbre = await monter();
    const texte = aplatirTexte(arbre.toJSON());

    // 🧨 Le defaut corrige : le cadre « avant l heure » servait aussi apres la
    // fermeture, et annoncait une ouverture deja passee depuis des heures.
    expect(texte).toContain('Fermé depuis 22:00');
    expect(texte).not.toContain('Ouvre à');
    expect(texte).toContain("L'appel est clos");

    // Et on ne bascule pas non plus dans le mode d appel.
    expect(texte).not.toContain('Tout pointer');
  });
});

describe('L5-A · 2A — le bandeau dit CE QU ON VA POINTER', () => {
  test('type, equipe et creneau, lus dans le fuseau du club', async () => {
    mockEvent = { ...mockEvent, type: { documentId: 't1', name: 'Entraînement' } };
    mockAttendance = reponseAttendance({
      items: [ligne({ firstname: 'Leo', userId: 'u1' })],
      serverNow: '2026-08-19T15:12:00.000Z',
    });

    const arbre = await monter();
    const texte = aplatirTexte(arbre.toJSON());

    expect(texte).toContain('ENTRAÎNEMENT');
    expect(texte).toContain('Seniors A');
    // 🌍 « mer. 19/08 · 18:00 – 20:00 » : la machine est en Asia/Bangkok, ou
    // cet instant est deja 23:00. Seule une lecture dans le fuseau du club
    // donne le bon JOUR comme la bonne heure.
    expect(texte).toContain('mer. 19/08 · 18:00 – 20:00');
  });
});

describe('L5-A · 2B — dans la fenetre, le depart', () => {
  test('« 0 pointé sur 22 », compteurs de PRESENCE, pied desactive', async () => {
    mockAttendance = reponseAttendance({
      items: Array.from({ length: 22 }, (_valeur, index) => ligne({
        firstname: `Joueur${index}`,
        userId: `u${index}`,
      })),
      serverNow: '2026-08-19T15:58:00.000Z', // 17:58 a Paris
    });

    const arbre = await monter();
    const texte = aplatirTexte(arbre.toJSON());

    expect(texte).toContain('0 pointé sur 22');
    // Le mot « APPEL » ne disparait pas quand l appel s ouvre (entete 2B).
    expect(texte).toContain('APPEL');
    expect(texte).toContain('Arrivé·e·s');
    expect(texte).toContain('En retard');
    expect(texte).toContain('En attente');

    // ⛔ Jamais l echelle des reponses ici.
    expect(texte).not.toContain('Absent·e·s');

    expect(appuyable(arbre, 'Tout pointer')).toBeTruthy();
    expect(appuyable(arbre, 'Tout dépointer')).toBeTruthy();

    expect(texte).toContain('Pointe au moins une personne');
  });
});

describe('L5-A · 2C — un sans-reponse se pointe d un geste', () => {
  test('l onglet « Sans réponse » explique AVANT le geste, et « Là » pointe', async () => {
    mockAttendance = reponseAttendance({
      items: [
        ligne({ firstname: 'Leo', rsvpStatus: 'participating', userId: 'u1' }),
        ligne({ firstname: 'Ilan', rsvpStatus: 'not_answered', userId: 'u9' }),
      ],
      serverNow: '2026-08-19T16:06:00.000Z', // 18:06 a Paris
    });

    const arbre = await monter();
    await act(async () => { appuyable(arbre, 'Sans réponse').props.onPress(); });

    const texte = aplatirTexte(arbre.toJSON());
    expect(texte).toContain("Ils n'ont jamais répondu");
    expect(texte).toContain('Présent·e et Arrivé·e en même temps');

    // 🧨 La maquette annonce « Ils reçoivent une notification ». C est FAUX :
    // `performCoachArrival` n envoie rien au joueur. La phrase est retiree.
    expect(texte).not.toContain('reçoivent une notification');

    await act(async () => { appuyable(arbre, 'Là').props.onPress(); });

    expect(mockCoachArrivalMutate).toHaveBeenCalledTimes(1);
    expect(mockCoachArrivalMutate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ userId: 'u9' }),
    );
  });
});

describe('L5-A · « Tout pointer » passe par l envoi groupe', () => {
  test('3 non-pointes -> UN appel groupe avec 3 identifiants', async () => {
    mockAttendance = reponseAttendance({
      items: [
        ligne({ arrivedAt: '2026-08-19T15:56:00.000Z', firstname: 'Leo', userId: 'u1' }),
        ligne({ firstname: 'Enzo', userId: 'u2' }),
        ligne({ firstname: 'Nina', userId: 'u3' }),
        ligne({ firstname: 'Adam', userId: 'u4' }),
      ],
      serverNow: '2026-08-19T16:06:00.000Z',
    });

    const arbre = await monter();
    await act(async () => { appuyable(arbre, 'Tout pointer').props.onPress(); });

    expect(mockBulkMutate).toHaveBeenCalledTimes(1);
    expect(mockBulkMutate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ userIds: ['u2', 'u3', 'u4'] }),
    );
  });

  test('22 refus pour la MEME cause donnent UNE phrase, pas vingt-deux', async () => {
    mockAttendance = reponseAttendance({
      items: Array.from({ length: 22 }, (_valeur, index) => ligne({
        firstname: `Joueur${index}`,
        userId: `u${index}`,
      })),
      serverNow: '2026-08-19T16:06:00.000Z',
    });

    const arbre = await monter();
    await act(async () => { appuyable(arbre, 'Tout pointer').props.onPress(); });

    // Le rappel de succes recoit le bilan : 22 refus, une seule cause.
    const options = mockBulkMutate.mock.calls[0][1];
    expect(typeof options?.onSuccess).toBe('function');
    await act(async () => {
      options.onSuccess({
        failedCount: 22,
        failures: Array.from({ length: 22 }, (_valeur, index) => ({
          code: 'EVENT_ATTENDANCE_WINDOW_CLOSED',
          message: 'Attendance can only be marked…',
          userDocumentId: `u${index}`,
        })),
        markedCount: 0,
      });
    });

    const texte = aplatirTexte(arbre.toJSON());
    const phrase = "Personne n'a été pointé : l'appel n'est pas ouvert en ce moment.";
    expect(texte).toContain(phrase);
    expect(texte.split(phrase)).toHaveLength(2); // une occurrence, pas vingt-deux
    expect(texte).not.toMatch(/Attendance can only/i);
  });
});

describe('L5-A · la ligne n est pas cliquable, ses 2 cibles font 44', () => {
  test('deux cibles par ligne, 44 de haut, et aucun appui sur la ligne', async () => {
    mockAttendance = reponseAttendance({
      items: [ligne({ firstname: 'Leo', userId: 'u1' })],
      serverNow: '2026-08-19T16:06:00.000Z',
    });

    const arbre = await monter();
    const cibles = boutons(arbre).filter((/** @type {any} */ noeud) => (
      String(noeud.props?.accessibilityLabel || '').includes('Leo')
    ));

    expect(cibles).toHaveLength(2);
    cibles.forEach((/** @type {any} */ cible) => {
      const styles = [cible.props.style].flat(Infinity).filter(Boolean);
      const hauteur = styles.reduce(
        (/** @type {number} */ trouvee, /** @type {any} */ style) => (
          style?.minHeight ? Number(style.minHeight) : trouvee
        ),
        0,
      );
      expect(hauteur).toBeGreaterThanOrEqual(44);
    });

    // ⛔ La ligne elle-meme n est pas cliquable : au bord d un terrain, un
    // appui parasite ne doit pas ouvrir une fiche.
    const rangee = arbre.root.findAll(
      (/** @type {any} */ noeud) => typeof noeud.type === 'string'
        && noeud.props?.testID === 'attendance-row-u1',
      { deep: true },
    );
    expect(rangee).toHaveLength(1);
    expect(rangee[0].props.onPress).toBeUndefined();
  });
});

describe('L5-A · identites masquees respectees', () => {
  test('`participantIdentitiesHidden` -> aucun nom rendu', async () => {
    mockAttendance = reponseAttendance({
      identitiesHidden: true,
      items: [
        ligne({ firstname: 'Leo', userId: 'u1' }),
        ligne({ firstname: 'Enzo', userId: 'u2' }),
      ],
      serverNow: '2026-08-19T16:06:00.000Z',
    });

    const arbre = await monter();
    const texte = aplatirTexte(arbre.toJSON());

    expect(texte).not.toContain('Leo');
    expect(texte).not.toContain('Enzo');
    expect(texte).not.toContain('Dupont');
  });
});

describe('L5-A · l horloge du telephone ne decide de rien', () => {
  test('systeme 3 h en avance : le mode et le libelle ne bougent pas', async () => {
    // ⚠️ `setSystemTime` et pas `spyOn(Date, 'now')` : l espion ne couvre pas
    // `new Date()`, et c est justement par la qu une horloge locale rentre.
    jest.useFakeTimers({ now: new Date('2026-08-19T18:12:00.000Z') });

    mockAttendance = reponseAttendance({
      items: [ligne({ firstname: 'Leo', userId: 'u1' })],
      serverNow: '2026-08-19T15:12:00.000Z', // le SERVEUR dit 17:12 a Paris
    });

    const arbre = await monter();
    const texte = aplatirTexte(arbre.toJSON());

    // Le telephone croit qu il est 20:12 a Paris — donc bien APRES l ouverture.
    // L ecran doit rester en 2A parce que le SERVEUR dit 17:12.
    expect(texte).toContain('Ouvre à 17:30');
    expect(texte).not.toContain('0 pointé sur 1');

    jest.useRealTimers();
  });
});

describe('L5-A · un non-pointe passe no_show par le cron reste pointable', () => {
  test('range dans « En attente », pastille « Non pointé », bouton actif', async () => {
    mockAttendance = reponseAttendance({
      items: [ligne({ attendanceStatus: 'no_show', firstname: 'Malo', userId: 'u7' })],
      serverNow: '2026-08-19T19:30:00.000Z', // apres la fin, DANS la fenetre encore
    });

    const arbre = await monter();
    const texte = aplatirTexte(arbre.toJSON());

    expect(texte).toContain('Non pointé');
    expect(texte).toContain('En attente');

    // La cible existe bien avec son role et son etat (noeud hote)…
    const hote = bouton(arbre, 'Malo');
    expect(hote).toBeTruthy();
    expect(hote.props.accessibilityState?.disabled).toBeFalsy();

    // …et elle se presse par son composite, qui porte `onPress`.
    await act(async () => { appuyable(arbre, 'Malo').props.onPress(); });
    expect(mockCoachArrivalMutate).toHaveBeenCalledTimes(1);
  });
});
