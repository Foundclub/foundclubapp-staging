import renderer, { act } from 'react-test-renderer';

import EventMessageBubble from '../EventMessageBubble';

// MSG1A (§3.8 / §3.9) — LA BULLE DE L'EVENEMENT PARTAGE, au dessin du pack.
//
// Avant ce lot, la bulle montait `EventCardNew mode="share"`, qui CACHE ses boutons : un
// joueur convie ne pouvait pas repondre depuis le fil. Ce temoin decrit le pack : le
// selecteur « Present | Absent » pour qui est convie, la reponse lue sur l'EVENEMENT, la
// ligne « Participants » et le pied « Ouvrir l'evenement ».

const mockNavigate = jest.fn();
const mockEvenementComplet = jest.fn();

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
  useGetEvent: () => ({ data: mockEvenementComplet(), dataUpdatedAt: 1 }),
}));
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => <VueRN testID={`avatar-${props.name}`} />,
  };
});

const DEMAIN = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

/**
 * L'evenement complet, tel que la fiche le relit.
 * @param {any} [surcharge]
 * @returns {any}
 */
const evenement = (surcharge = {}) => ({
  date: DEMAIN,
  documentId: 'ev-1',
  locationDetails: 'Stade Leo Lagrange, Toulon',
  missings: [],
  name: 'Entrainement Seniors',
  participations: [],
  team: {
    documentId: 'eq-1',
    name: 'Seniors 1',
    players: [{ documentId: 'moi' }, { documentId: 'lui', firstname: 'Hugo' }],
  },
  type: { name: 'Entrainement' },
  ...surcharge,
});

/**
 * Aide du temoin : `rendre`.
 * @param {any} [props]
 * @returns {any}
 */
const rendre = (props = {}) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <EventMessageBubble
        event={{ documentId: 'ev-1', name: 'Apercu' }}
        onDecline={props.onDecline}
        onParticipate={props.onParticipate}
      />,
    );
  });
  return arbre;
};

/**
 * Aide du temoin : `textes`.
 * @param {any} arbre
 * @returns {string}
 */
const textes = (arbre) => arbre.root
  .findAll((/** @type {any} */ n) => typeof n.props?.children === 'string')
  .map((/** @type {any} */ n) => n.props.children)
  .join(' | ');

/**
 * Aide du temoin : `parId`.
 * @param {any} arbre
 * @param {string} id
 * @returns {any[]}
 */
const parId = (arbre, id) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === id && typeof n.props?.onPress === 'function',
);

describe('EventMessageBubble — l evenement partage du fil (pack MSG1A)', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  test('B1 — le contenu du pack : surtitre, titre complet relu, equipe, lieu, pied', () => {
    mockEvenementComplet.mockReturnValue(evenement());
    const arbre = rendre();
    const vu = textes(arbre);
    expect(vu).toContain('Événement partagé');
    expect(vu).toContain('Entrainement Seniors');
    expect(vu).toContain('Équipe : Seniors 1');
    expect(vu).toContain('Ouvrir l’événement');
  });

  test(
    'B2 — un membre convie voit « Ta presence » et les deux options ; Absent appelle le refus',
    () => {
      mockEvenementComplet.mockReturnValue(evenement());
      const onDecline = jest.fn();
      const arbre = rendre({ onDecline });
      expect(textes(arbre)).toContain('Ta présence');

      act(() => {
        parId(arbre, 'evenement-presence-absent')[0].props.onPress();
      });

      expect(onDecline).toHaveBeenCalledTimes(1);
      // L'option appuyee s'allume tout de suite, et le libelle passe a « Ta reponse ».
      expect(parId(arbre, 'evenement-presence-absent')[0].props.accessibilityState).toEqual({
        selected: true,
      });
      expect(textes(arbre)).toContain('Ta réponse');
    },
  );

  test(
    'B3 — la reponse vient de L EVENEMENT : present surligne, un tap sur Absent la change',
    () => {
      mockEvenementComplet.mockReturnValue(evenement({ participations: [{ documentId: 'moi' }] }));
      const onDecline = jest.fn();
      const arbre = rendre({ onDecline });
      expect(parId(arbre, 'evenement-presence-present')[0].props.disabled).toBe(true);
      expect(parId(arbre, 'evenement-presence-present')[0].props.accessibilityState).toEqual({
        selected: true,
      });

      act(() => {
        parId(arbre, 'evenement-presence-absent')[0].props.onPress();
      });
      expect(onDecline).toHaveBeenCalledTimes(1);
    },
  );

  test('B4 — pas convie, ou reponses fermees : pas de selecteur, bulle normale', () => {
    mockEvenementComplet.mockReturnValue(
      evenement({ team: { documentId: 'eq-2', name: 'U15', players: [] } }),
    );
    expect(parId(rendre(), 'evenement-presence-present')).toHaveLength(0);

    mockEvenementComplet.mockReturnValue(evenement({ rsvpEnabled: false }));
    expect(parId(rendre(), 'evenement-presence-present')).toHaveLength(0);
  });

  test(
    'B5 — la ligne Participants compte presents / absents / sans reponse et ouvre l evenement',
    () => {
      mockEvenementComplet.mockReturnValue(
        evenement({ participations: [{ documentId: 'lui', firstname: 'Hugo' }] }),
      );
      const arbre = rendre();
      expect(textes(arbre)).toContain('1 present · 1 noAnswer');
      expect(
        arbre.root.findAll(
          (/** @type {any} */ n) => typeof n.type === 'string' && n.props?.testID === 'avatar-Hugo',
        ),
      ).toHaveLength(1);

      act(() => {
        parId(arbre, 'evenement-participants')[0].props.onPress();
      });
      expect(mockNavigate).toHaveBeenCalledWith('EventStack', {
        params: { eventId: 'ev-1' },
        screen: 'EventDetails',
      });
    },
  );

  test('B6 — sans evenement relu (hors ligne), l apercu du message suffit', () => {
    mockEvenementComplet.mockReturnValue(undefined);
    const arbre = rendre();
    expect(textes(arbre)).toContain('Apercu');
    expect(parId(arbre, 'evenement-ouvrir').length).toBeGreaterThan(0);
  });
});
