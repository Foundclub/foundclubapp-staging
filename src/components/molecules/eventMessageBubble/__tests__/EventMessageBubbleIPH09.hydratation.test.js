import renderer, { act } from 'react-test-renderer';

import { presenceDansLeFil } from '@/domains/messaging/evenementDansLeFil';
import {
  resolveClientResponderDecision,
  resolveParticipationFlow,
} from '@/domains/participation/participationFlow';

import EventMessageBubble from '../EventMessageBubble';

// IPH09/6 — les boutons lisent l evenement complet ; leur action doit transmettre
// CET objet a la conversation, dont l apercu ne prouve pas l appartenance.
// Donnees fabriquees, sans nouvelle regle ni appel d une API reelle.
const mockNavigate = jest.fn();
const mockEvenementComplet = jest.fn();
const mockGetEvent = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    Easing: { linear: jest.fn() },
    useAnimatedStyle: (/** @type {any} */ fabrique) => (
      typeof fabrique === 'function' ? fabrique() : {}
    ),
    useSharedValue: (/** @type {any} */ valeur) => ({ value: valeur }),
    withTiming: (/** @type {any} */ valeur) => valeur,
  };
});
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-svg', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    Circle: VueRN,
    default: VueRN,
    Line: VueRN,
    Path: VueRN,
    Polyline: VueRN,
    Rect: VueRN,
    Svg: VueRN,
  };
});

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli.count === 'number') return `${repli.count} ${cle.split('.').pop()}`;
      if (repli && repli.name) return `Équipe : ${repli.name}`;
      return cle;
    },
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: (_cible, cle) => `image-${String(cle)}` }),
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'moi', role: { name: 'Joueur' } } }),
}));
jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: (/** @type {string} */ eventId) => {
    mockGetEvent(eventId);
    return { data: mockEvenementComplet(), dataUpdatedAt: 1 };
  },
}));
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => <VueRN testID={`avatar-${props.name}`} />,
  };
});

const MAINTENANT = Date.parse('2026-10-09T12:00:00Z');
const DEMAIN = '2026-10-10T18:00:00Z';
const HIER = '2026-10-08T18:00:00Z';
const MOI = { documentId: 'moi', role: { name: 'Joueur' } };
const APERCU = {
  documentId: 'ev-1',
  id: 81,
  name: 'Apercu compact du chat',
  type: { id: 1, name: 'Entrainement' },
};

/**
 * La fiche autorisee, deja obtenue par le hook.
 * @param {any} [surcharge] Donnees propres au cas teste.
 * @returns {any} Evenement complet fabrique.
 */
const evenement = (surcharge = {}) => ({
  ...APERCU,
  date: DEMAIN,
  isActive: true,
  missings: [],
  name: 'Entrainement Seniors',
  participationRequests: [],
  participations: [],
  sessionStatus: 'closed',
  team: {
    documentId: 'eq-1',
    name: 'Seniors 1',
    players: [{ documentId: 'moi' }, { documentId: 'lui' }],
  },
  ...surcharge,
});

/**
 * Arbre natif, sans ecran de conversation double.
 * @param {any} [props] Actions a observer.
 * @returns {any} Arbre rendu.
 */
const rendre = (props = {}) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <EventMessageBubble
        event={APERCU}
        onDecline={props.onDecline}
        onParticipate={props.onParticipate}
      />,
    );
  });
  return arbre;
};

/**
 * Retrouve une option rendue et interactive.
 * @param {any} arbre Arbre rendu.
 * @param {'present' | 'absent'} choix Option recherchee.
 * @returns {any[]} Boutons correspondants.
 */
const options = (arbre, choix) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === `evenement-presence-${choix}`
    && typeof n.props?.onPress === 'function',
);

/**
 * Appuie sur une option disponible.
 * @param {any} arbre Arbre rendu.
 * @param {'present' | 'absent'} choix Option a choisir.
 * @returns {Promise<void>} L'aller-retour de l'appui.
 */
const appuyer = async (arbre, choix) => {
  const bouton = options(arbre, choix)[0];
  expect(bouton).toBeDefined();
  expect(bouton.props.disabled).toBe(false);
  await act(async () => { await bouton.props.onPress(); });
};

describe('IPH09/6 — reponse depuis une projection compacte du chat', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(MAINTENANT);
    mockNavigate.mockClear();
    mockGetEvent.mockClear();
    mockEvenementComplet.mockReset();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('H1 — Present transmet exactement l evenement complet autorise relu par la fiche', async () => {
    const complet = evenement();
    mockEvenementComplet.mockReturnValue(complet);
    const onParticipate = jest.fn();
    const onDecline = jest.fn();
    const arbre = rendre({ onDecline, onParticipate });

    expect(mockGetEvent).toHaveBeenCalledWith('ev-1');
    expect(resolveParticipationFlow(APERCU, { user: MOI }).submitMode).not.toBe('rsvpPresent');
    expect(resolveParticipationFlow(complet, { user: MOI })).toMatchObject({
      canAct: true,
      submitMode: 'rsvpPresent',
    });
    await appuyer(arbre, 'present');

    expect(onParticipate).toHaveBeenCalledTimes(1);
    expect(onParticipate).toHaveBeenCalledWith(complet);
    expect(onParticipate.mock.calls[0][0]).toBe(complet);
    expect(onDecline).not.toHaveBeenCalled();
  });

  test('H2 — Absent transmet aussi l evenement complet, au lieu de perdre son format', async () => {
    const complet = evenement();
    mockEvenementComplet.mockReturnValue(complet);
    const onParticipate = jest.fn();
    const onDecline = jest.fn();
    const arbre = rendre({ onDecline, onParticipate });

    await appuyer(arbre, 'absent');

    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledWith(complet);
    expect(onDecline.mock.calls[0][0]).toBe(complet);
    expect(onParticipate).not.toHaveBeenCalled();
  });

  test('H3 — viewerCanRespond=true ne donne pas de choix a un non-membre', () => {
    const complet = evenement({
      team: { documentId: 'eq-2', players: [{ documentId: 'lui' }] },
      viewerCanRespond: true,
    });
    mockEvenementComplet.mockReturnValue(complet);
    const onParticipate = jest.fn();
    const onDecline = jest.fn();
    const arbre = rendre({ onDecline, onParticipate });

    expect(resolveClientResponderDecision(complet, MOI).sourceTeam).toBeNull();
    expect(presenceDansLeFil({ evenement: complet, utilisateur: MOI })).toBeNull();
    expect(options(arbre, 'present')).toHaveLength(0);
    expect(options(arbre, 'absent')).toHaveLength(0);
    expect(onParticipate).not.toHaveBeenCalled();
    expect(onDecline).not.toHaveBeenCalled();
  });

  test.each([
    ['present', 'absent', 'participations', 'onDecline'],
    ['absent', 'present', 'missings', 'onParticipate'],
  ])('H4 — changement %s vers %s conserve la fiche dans l action', async (
    /** @type {string} */ initial,
    /** @type {'present' | 'absent'} */ choix,
    /** @type {string} */ collection,
    /** @type {string} */ callback,
  ) => {
    const complet = evenement({ [collection]: [{ documentId: 'moi' }] });
    mockEvenementComplet.mockReturnValue(complet);
    const onParticipate = jest.fn().mockResolvedValue(undefined);
    const onDecline = jest.fn().mockResolvedValue(undefined);
    const arbre = rendre({ onDecline, onParticipate });
    const action = callback === 'onDecline' ? onDecline : onParticipate;

    expect(options(arbre, /** @type {'present' | 'absent'} */ (initial))[0]
      .props.accessibilityState).toEqual({ selected: true });
    await appuyer(arbre, choix);

    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith(complet);
    expect(action.mock.calls[0][0]).toBe(complet);
    // Le succès de l'appel ne fabrique pas une présence avant la relecture serveur.
    expect(options(arbre, choix)[0].props.accessibilityState).toEqual({ selected: false });
  });

  test.each([
    ['date passee', { date: HIER }],
    ['reponses fermees', { rsvpEnabled: false }],
    ['evenement annule', { isActive: false }],
  ])('H5 — %s : aucune reponse depuis le fil', (_libelle, surcharge) => {
    mockEvenementComplet.mockReturnValue(evenement(surcharge));
    const arbre = rendre();
    expect(options(arbre, 'present')).toHaveLength(0);
    expect(options(arbre, 'absent')).toHaveLength(0);
  });

  test.each(['present', 'absent'])(
    'H6 — stage_day hydrate transmet le format et le parent en repondant %s',
    async (/** @type {'present' | 'absent'} */ choix) => {
      const complet = evenement({
        eventFormat: 'stage_day',
        parentEvent: { documentId: 'stage-1' },
      });
      mockEvenementComplet.mockReturnValue(complet);
      const onParticipate = jest.fn();
      const onDecline = jest.fn();
      const arbre = rendre({ onDecline, onParticipate });

      await appuyer(arbre, choix);

      const action = choix === 'present' ? onParticipate : onDecline;
      expect(action).toHaveBeenCalledTimes(1);
      expect(action).toHaveBeenCalledWith(complet);
      expect(action.mock.calls[0][0]).toBe(complet);
    },
  );

  test.each([
    ['ancien evenement sans drapeau RSVP', {}],
    ['nouvel evenement avec drapeau RSVP', { rsvpEnabled: true }],
  ])('H7 — %s : meme preuve d appartenance que le detail', (_libelle, surcharge) => {
    const complet = evenement(surcharge);
    mockEvenementComplet.mockReturnValue(complet);
    const arbre = rendre();
    const decisionDetail = resolveClientResponderDecision(complet, MOI);
    const decisionFil = presenceDansLeFil({ evenement: complet, utilisateur: MOI });

    expect(decisionDetail.sourceTeam).toBe(complet.team);
    expect(Boolean(decisionFil)).toBe(Boolean(decisionDetail.sourceTeam));
    expect(decisionFil).toEqual({ reponse: null });
    expect(options(arbre, 'present').length).toBeGreaterThan(0);
    expect(options(arbre, 'absent').length).toBeGreaterThan(0);
  });

  test('H8 — le refus rend les boutons sans afficher une présence acquise', async () => {
    mockEvenementComplet.mockReturnValue(evenement());
    const onParticipate = jest.fn().mockRejectedValue(new Error('403'));
    const arbre = rendre({ onParticipate });
    await appuyer(arbre, 'present');
    expect(options(arbre, 'present')[0].props.disabled).toBe(false);
    expect(options(arbre, 'present')[0].props.accessibilityState).toEqual({ selected: false });
    await appuyer(arbre, 'present');
    expect(onParticipate).toHaveBeenCalledTimes(2);
  });
  test('H9 — une réponse en cours prend les deux boutons puis rend les touches', async () => {
    mockEvenementComplet.mockReturnValue(evenement());
    let finish;
    const onParticipate = jest.fn(() => new Promise((resolve) => { finish = resolve; }));
    const arbre = rendre({ onParticipate });
    let pending;
    act(() => { pending = options(arbre, 'present')[0].props.onPress(); });
    expect(options(arbre, 'present')[0].props.accessibilityState.busy).toBe(true);
    expect(options(arbre, 'present')[0].props.disabled).toBe(true);
    expect(options(arbre, 'absent')[0].props.disabled).toBe(true);
    await act(async () => { finish(); await pending; });
    expect(options(arbre, 'present')[0].props.disabled).toBe(false);
    expect(options(arbre, 'absent')[0].props.disabled).toBe(false);
  });
  test('H10 — un appelant sans promesse garde son appui jusqu’à relecture ou délai', async () => {
    mockEvenementComplet.mockReturnValue(evenement());
    const onParticipate = jest.fn();
    const arbre = rendre({ onParticipate });
    await appuyer(arbre, 'present');
    expect(options(arbre, 'present')[0].props.accessibilityState).toEqual({ busy: true, selected: true });
    expect(options(arbre, 'absent')[0].props.disabled).toBe(true);
    act(() => { jest.advanceTimersByTime(10000); });
    expect(options(arbre, 'present')[0].props.accessibilityState).toEqual({ selected: false });
    expect(options(arbre, 'absent')[0].props.disabled).toBe(false);
  });
});
