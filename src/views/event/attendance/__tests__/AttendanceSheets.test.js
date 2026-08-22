import renderer, { act } from 'react-test-renderer';

import EventAttendanceCall from '../EventAttendanceCall';

/**
 * L5-A · ETAPE 5 — LES TROIS FEUILLES : 2D cloture, 2E retard, 2F corriger.
 *
 * 🔬 CE QUE CES TEMOINS TIENNENT :
 *   8.  2D — la cloture NOMME les personnes concernees, dit l heure du passage
 *       serveur, et NE FAIT AUCUN APPEL RESEAU. C est un geste d ECRAN : aucune
 *       route de cloture n existe cote serveur, c est le cron de fin de match
 *       qui passe les non-pointes en « Non pointé ».
 *   9.  2E — six paliers, aucun clavier par defaut, et l envoi porte
 *       `lateMinutes` ET `arrivedAt` = debut + minutes.
 *   10. 2F — « Dépointer » remet en attente, « Annuler la note du staff »
 *       renvoie le retard COURANT avec une note vide.
 */

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

/** @type {any} */
let mockEvent;
/** @type {any} */
let mockAttendance;

const mockBulkMutate = jest.fn();
const mockCoachArrivalMutate = jest.fn();
const mockLateMutate = jest.fn();
const mockResetMutate = jest.fn();

const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { eventId: 'evt-1' } }),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({
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
  useGetEventAttendance: () => ({ data: mockAttendance, isFetching: false, refetch: jest.fn() }),
}));

// 🪤 Surtout PAS de `requireActual` : le hook tire `eventService`, donc
// `react-native-blob-util`, publie en ESM non transforme — la suite entiere
// mourrait au chargement, 0 test execute.
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
  return { __esModule: true, default: () => <TexteRN>RETOUR</TexteRN> };
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { name }) => <TexteRN>{`AVATAR:${name || ''}`}</TexteRN>,
  };
});

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

// ⚠️ `snapPoints` est OBLIGATOIRE des qu une feuille porte un en-tete ET un
// pied : la doublure le RELAIE, pour qu un oubli se voie ici.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ {
      children, footerComponent, headerComponent, isVisible, snapPoints,
    }) => (
      isVisible ? (
        <VueRN testID={`sheet-snap-${(snapPoints || []).join('|') || 'AUCUN'}`}>
          {headerComponent}
          {children}
          {footerComponent}
        </VueRN>
      ) : null
    ),
  };
});

const DEBUT_ISO = '2026-08-19T16:00:00.000Z'; // 18:00 a Paris
const OUVRE_ISO = '2026-08-19T15:30:00.000Z'; // 17:30 a Paris
const FERME_ISO = '2026-08-19T20:00:00.000Z'; // 22:00 a Paris — fin 20:00 + 2 h

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants - Un noeud React quelconque.
 * @returns {string} - Le texte concatene.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') {
    const directs = Object.prototype.hasOwnProperty.call(enfants, 'children')
      ? enfants.children
      : enfants?.props?.children;
    return aplatirTexte(directs);
  }
  return String(enfants);
};

/**
 * L etiquette et le texte d un noeud, colles.
 * @param {any} noeud - Un noeud de l arbre.
 * @returns {string} - Etiquette + texte.
 */
const decrire = (noeud) => (
  `${noeud.props?.accessibilityLabel || ''} ${aplatirTexte(noeud.props?.children)}`
);

/**
 * Le premier noeud appuyable portant `texte`.
 * @param {any} arbre - L arbre monte.
 * @param {string} texte - Un fragment de libelle.
 * @returns {any} - Le noeud trouve.
 */
const appuyable = (arbre, texte) => arbre.root.findAll(
  (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
    && decrire(noeud).includes(texte),
  { deep: true },
)[0];

/**
 * Fabrique une ligne de la feuille de presence.
 * @param {any} options - Les traits de la ligne voulue.
 * @returns {any} - L element de la reponse serveur.
 */
const ligne = ({
  arrivedAt = null,
  firstname,
  lateMinutes = 0,
  note = null,
  rsvpStatus = 'participating',
  userId,
}) => ({
  attendance: arrivedAt ? { arrivedAt, lateMinutes, note } : null,
  attendanceStatus: arrivedAt ? 'arrived_on_time' : 'not_marked',
  countsInTeamStats: {},
  finalOperationalStatus: 'pending',
  isLate: lateMinutes > 0,
  rsvpStatus,
  user: {
    avatar: null, documentId: userId, firstname, lastname: 'Dupont',
  },
});

/**
 * Monte l ecran avec une reponse donnee.
 * @param {any[]} items - Les lignes de la feuille.
 * @returns {Promise<any>} - L arbre monte.
 */
const monter = async (items) => {
  mockAttendance = {
    data: {
      eventId: 'evt-1',
      eventStartAt: DEBUT_ISO,
      items,
      participantIdentitiesHidden: false,
      serverNow: '2026-08-19T16:06:00.000Z', // 18:06 a Paris — l appel est ouvert
      timezone: 'Europe/Paris',
      window: { closesAt: FERME_ISO, enabled: true, opensAt: OUVRE_ISO },
    },
  };
  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(<EventAttendanceCall />); });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEvent = {
    date: DEBUT_ISO,
    documentId: 'evt-1',
    endTime: '20:00',
    name: 'Entraînement',
    team: { documentId: 'team-1', name: 'Seniors A' },
  };
});

describe('L5-A · 2D — la cloture ne ment pas sur ce qu elle fait', () => {
  test('elle NOMME les jamais-vus, dit l heure du passage serveur, et n appelle RIEN', async () => {
    const items = [
      ligne({ arrivedAt: '2026-08-19T15:56:00.000Z', firstname: 'Leo', userId: 'u1' }),
      ligne({
        arrivedAt: '2026-08-19T16:12:00.000Z', firstname: 'Hugo', lateMinutes: 12, userId: 'u2',
      }),
      ligne({ firstname: 'Malo', userId: 'u3' }),
      ligne({ firstname: 'Aron', userId: 'u4' }),
    ];
    const arbre = await monter(items);

    await act(async () => { appuyable(arbre, "Clôturer l'appel").props.onPress(); });
    const texte = aplatirTexte(arbre.toJSON());

    expect(texte).toContain("CLÔTURER L'APPEL");
    expect(texte).toContain('2 pointés · 2 jamais vus');

    // Les deux compteurs de la maquette (l.255-258).
    expect(texte).toContain('Arrivé·e·s');
    expect(texte).toContain('Arrivé·e·s en retard');

    // 🗣️ LES PERSONNES SONT NOMMEES — rien d irreversible en silence.
    expect(texte).toContain('Malo');
    expect(texte).toContain('Aron');

    // ⛔ Le bouton ne fait PAS passer en « Non pointé » : c est le cron, a la
    // fin du match. La feuille dit QUI le fait et QUAND — 20:00 a Paris, donc
    // premier passage du cron a 20:13 ; correction possible jusqu a 22:00.
    expect(texte).toContain('20:13');
    expect(texte).toContain('22:00');
    expect(texte).not.toContain('vont passer en « Non pointé »');

    // 🔌 AUCUN APPEL RESEAU — la cloture est un geste d ECRAN.
    await act(async () => { appuyable(arbre, "Clôturer l'appel maintenant").props.onPress(); });
    expect(mockBulkMutate).not.toHaveBeenCalled();
    expect(mockCoachArrivalMutate).not.toHaveBeenCalled();
    expect(mockLateMutate).not.toHaveBeenCalled();
    expect(mockResetMutate).not.toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('la feuille declare sa hauteur — sans quoi en-tete et pied ne tiennent pas', async () => {
    // ⚠️ Il FAUT au moins un pointage : sans lui le pied affiche « Pointe au
    // moins une personne » et le bouton de cloture n existe pas.
    const arbre = await monter([
      ligne({ arrivedAt: '2026-08-19T15:56:00.000Z', firstname: 'Leo', userId: 'u1' }),
      ligne({ firstname: 'Malo', userId: 'u3' }),
    ]);
    await act(async () => { appuyable(arbre, "Clôturer l'appel").props.onPress(); });

    const feuille = arbre.root.findAll(
      (/** @type {any} */ noeud) => typeof noeud.type === 'string'
        && String(noeud.props?.testID || '').startsWith('sheet-snap-'),
      { deep: true },
    );
    expect(feuille).toHaveLength(1);
    expect(feuille[0].props.testID).toBe('sheet-snap-68%');
  });
});

describe('L5-A · 2E — pointer un retard', () => {
  test('six paliers, aucun clavier par defaut, envoi avec lateMinutes ET arrivedAt', async () => {
    const arbre = await monter([ligne({ firstname: 'Hugo', userId: 'u2' })]);

    await act(async () => { appuyable(arbre, 'Retard pour Hugo').props.onPress(); });
    const texte = aplatirTexte(arbre.toJSON());

    expect(texte).toContain('RETARD CONSTATÉ');
    ["À l'heure", '+5', '+10', '+15', '+30', 'Autre heure'].forEach((palier) => {
      expect(texte).toContain(palier);
    });

    // ⌨️ « Jamais un clavier par défaut » : aucune saisie ne prend le focus,
    // et la saisie d heure libre n existe qu apres « Autre heure ».
    const saisies = arbre.root.findAll(
      (/** @type {any} */ noeud) => typeof noeud.type === 'string' && noeud.type === 'TextInput',
      { deep: true },
    );
    saisies.forEach((/** @type {any} */ saisie) => {
      expect(saisie.props.autoFocus).toBeFalsy();
    });

    await act(async () => { appuyable(arbre, '+10').props.onPress(); });
    // Debut 18:00 a Paris + 10 min = 18:10 — c est ce que la maquette annonce.
    expect(aplatirTexte(arbre.toJSON())).toContain('Arrivé +10 min à 18:10');

    await act(async () => { appuyable(arbre, 'Enregistrer').props.onPress(); });

    expect(mockCoachArrivalMutate).toHaveBeenCalledTimes(1);
    const envoi = mockCoachArrivalMutate.mock.calls[0][0];
    expect(envoi.userId).toBe('u2');
    expect(envoi.payload.lateMinutes).toBe(10);
    // 🧨 Sans `arrivedAt`, le serveur poserait SON instant courant — l ecran
    // afficherait « Arrivé +10 min à 18:42 » pour un match de 18:00.
    expect(envoi.payload.arrivedAt).toBe('2026-08-19T16:10:00.000Z');
  });
});

describe('L5-A · 2F — corriger un pointage', () => {
  test('« Dépointer » remet en attente, « Annuler la note » garde le retard courant', async () => {
    const arbre = await monter([
      ligne({
        arrivedAt: '2026-08-19T16:12:00.000Z',
        firstname: 'Hugo',
        lateMinutes: 12,
        note: 'Bus en retard',
        userId: 'u2',
      }),
    ]);

    await act(async () => { appuyable(arbre, 'Corriger Hugo').props.onPress(); });
    const texte = aplatirTexte(arbre.toJSON());
    expect(texte).toContain("Changer l'heure d'arrivée");
    expect(texte).toContain('Annuler la note du staff');
    expect(texte).toContain('Dépointer');

    // 🧨 `patchLate` EXIGE `lateMinutes` : annuler la note se fait en renvoyant
    // le retard COURANT avec `note: null`. Envoyer 0 effacerait le retard.
    await act(async () => { appuyable(arbre, 'Annuler la note du staff').props.onPress(); });
    expect(mockLateMutate).toHaveBeenCalledTimes(1);
    expect(mockLateMutate.mock.calls[0][0]).toEqual({
      payload: { lateMinutes: 12, note: null },
      userId: 'u2',
    });

    await act(async () => { appuyable(arbre, 'Corriger Hugo').props.onPress(); });
    await act(async () => { appuyable(arbre, 'Dépointer').props.onPress(); });
    expect(mockResetMutate).toHaveBeenCalledTimes(1);
    expect(mockResetMutate.mock.calls[0][0]).toEqual({ userId: 'u2' });
  });
});
