import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { USER_ROLES } from '@/domains/auth/authUseCases';

import EventAnswerButtons from '@/components/molecules/eventAnswerButtons/EventAnswerButtons';

import EventCardNew from '../EventCardNew';

// Filet L03 (E6) : la carte événement n'avait AUCUN test. Ces tests
// caractérisent les DONNÉES qu'elle affiche et les commandes qu'elle expose
// (mêmes données, mêmes handlers) — ils doivent rester verts après la refonte
// visuelle du handoff « Cartes Rechercher » (3b + 4a).

// Le mock officiel de reanimated est en ESM pur, non transformé par la config
// jest du projet — mock manuel minimal des primitives utilisées par la carte.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    Easing: { linear: jest.fn() },
    useAnimatedStyle: (factory) => (typeof factory === 'function' ? factory() : {}),
    useSharedValue: (value) => ({ value }),
    withTiming: (value) => value,
  };
});

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (url) => url,
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

// Le marquee sponsors suspend son animation hors focus : hors navigateur
// (tests), l'écran est considéré comme focus.
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('@/theme/themeContext', () => {
  // Jetons opaques : le contrat de thème interdit les littéraux hex, et un
  // mock n'a pas besoin de vraies couleurs. `couleur-<jeton>` rend chaque
  // usage assertable (ex. la couleur du chip par type d'événement).
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      // `image-<clé>` : rend le fond illustré par type assertable.
      Images: new Proxy({}, { get: (_target, key) => `image-${String(key)}` }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('react-i18next', () => ({
  // La chaîne d'import réelle passe par @/theme/strings qui initialise i18next.
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({
    t: (_key, fallback) => fallback || _key,
  }),
}));

/**
 * RN 0.81 a retire le `forwardRef` autour de `Pressable` : React expose desormais
 * la fonction INTERNE du memo dans l'arbre de test, la ou 0.78 exposait l'objet
 * memo lui-meme. La recherche par type rendait donc 0 apres la montee.
 * Ce predicat accepte les DEUX formes, pour survivre aux deux versions.
 * @param {any} noeud Un noeud de l arbre rendu par react-test-renderer.
 * @returns {boolean} Vrai si ce noeud est un Pressable, quelle que soit la version de RN.
 */
const estPressable = (noeud) => noeud.type === Pressable
  || noeud.type === /** @type {any} */ (Pressable).type;

const mockUserData = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData() }),
}));

const mockHaveIAlreadyJoined = jest.fn();
jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    canEventBeJoined: () => true,
    haveIAlreadyAnsweredNo: () => false,
    haveIAlreadyJoined: (args) => mockHaveIAlreadyJoined(args),
  }),
}));

const collectTexts = (node, acc = []) => {
  if (node === null || node === undefined) return acc;
  if (typeof node === 'string') {
    acc.push(node);
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectTexts(child, acc));
    return acc;
  }
  collectTexts(node.children, acc);
  return acc;
};

const renderCard = (props) => {
  let tree;
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    tree = renderer.create(<EventCardNew {...props} />);
  });
  return tree;
};

const textsOf = (tree) => collectTexts(tree.toJSON()).join('\n');

// Date FUTURE (le flux de participation bloque un événement passé) : le
// mercredi 26 août 2026.
const baseEvent = {
  capacity: 14,
  date: '2026-08-26T17:00:00',
  documentId: 'evt-1',
  endTime: '19:00:00',
  locationDetails: 'Stade Vélodrome, 13008 Marseille',
  missings: [],
  participations: [{ documentId: 'p1' }, { documentId: 'p2' }],
  sessionStatus: 'open',
  startTime: '17:00:00',
  team: {
    activities: [{ name: 'Football' }],
    category: { name: 'Sénior' },
    club: {
      name: 'FC Marseille Nord',
      sponsor: [{ documentId: 'sp-1', logo: {}, title: 'Boulangerie Paul' }],
    },
    name: 'Sénior A',
    section: { name: 'Masculine' },
  },
  type: { name: 'Entraînement' },
};

const playerUser = { documentId: 'me', role: { name: USER_ROLES.player } };

describe('EventCardNew — données affichées (caractérisation)', () => {
  beforeEach(() => {
    mockUserData.mockReturnValue(playerUser);
    mockHaveIAlreadyJoined.mockReturnValue(false);
  });

  it('affiche le club, l equipe, la date longue, le creneau, le lieu et le sport', () => {
    const tree = renderCard({ item: baseEvent });
    const texts = textsOf(tree);

    expect(texts).toContain('FC Marseille Nord');
    expect(texts).toContain('Sénior A');
    expect(texts).toContain('Mercredi 26 août');
    expect(texts).toContain('17:00 - 19:00');
    // getShortAddress raccourcit volontairement en « code postal + ville ».
    expect(texts).toContain('13008 Marseille');
    expect(texts).toContain('Football');
  });

  it('affiche le libellé du type pour un match', () => {
    const tree = renderCard({
      item: { ...baseEvent, type: { name: 'Match' } },
    });
    expect(textsOf(tree)).toMatch(/MATCH/i);
  });

  it('affiche le nom du sponsor du club', () => {
    const tree = renderCard({ item: baseEvent });
    expect(textsOf(tree)).toContain('Boulangerie Paul');
  });

  it('appuie sur la carte -> onPress(item)', () => {
    const onPress = jest.fn();
    const tree = renderCard({ item: baseEvent, onPress });
    const pressables = tree.root.findAll(estPressable);
    act(() => {
      pressables[0].props.onPress();
    });
    expect(onPress).toHaveBeenCalledWith(baseEvent);
  });

  it('rend les boutons de réponse (EventAnswerButtons) pour un joueur', () => {
    const tree = renderCard({ item: baseEvent });
    expect(tree.root.findAllByType(EventAnswerButtons)).toHaveLength(1);
  });

  it('mode share : aucun bouton de réponse', () => {
    const tree = renderCard({ item: baseEvent, mode: 'share' });
    expect(tree.root.findAllByType(EventAnswerButtons)).toHaveLength(0);
  });

  it('dirigeant avec demandes : Valider / Refuser appellent les handlers', () => {
    const onRefuse = jest.fn();
    const onValidate = jest.fn();
    const tree = renderCard({ item: baseEvent, onRefuse, onValidate });
    const texts = textsOf(tree);
    expect(texts).toContain('Valider');
    expect(texts).toContain('Refuser');

    // Dans ce mode, les deux seuls TouchableOpacity de la carte sont
    // Valider puis Refuser — la refonte doit conserver cette paire.
    const touchables = tree.root.findAllByType(TouchableOpacity);
    expect(touchables).toHaveLength(2);
    act(() => {
      touchables[0].props.onPress();
    });
    expect(onValidate).toHaveBeenCalledWith(baseEvent);
    act(() => {
      touchables[1].props.onPress();
    });
    expect(onRefuse).toHaveBeenCalledWith(baseEvent);
  });
});

describe('EventCardNew — réservation (caractérisation)', () => {
  const reservationEvent = {
    ...baseEvent,
    currentPlayers: 6,
    pricePerPerson: 10,
    totalPlayers: 10,
    type: { name: 'Réservation' },
  };

  beforeEach(() => {
    mockUserData.mockReturnValue(playerUser);
    mockHaveIAlreadyJoined.mockReturnValue(false);
  });

  it('affiche le prix par personne', () => {
    const tree = renderCard({ item: reservationEvent });
    expect(textsOf(tree)).toMatch(/10\s?€\s?\/\s?pers/);
  });

  it('déjà inscrit·e : affiche « Je participe ! » sans bouton Réserver', () => {
    mockHaveIAlreadyJoined.mockReturnValue(true);
    const tree = renderCard({ item: reservationEvent });
    const texts = textsOf(tree);
    expect(texts).toContain('Je participe !');
    expect(texts).not.toContain('Réserver');
  });
});

// ————————————————————————————————————————————————————————————————————————
// Preuve du handoff (tour 3b) : chaque type d'événement rend SA couleur de
// chip, SON fond illustré et SON encart d'info. C'est le contrôle final
// demandé par le brief L03.
// ————————————————————————————————————————————————————————————————————————

const getChipColor = (tree, chipLabel) => {
  const chipText = tree.root
    .findAllByType(Text)
    .find((node) => node.props.children === chipLabel);
  if (!chipText) return null;
  return StyleSheet.flatten(chipText.props.style)?.color || null;
};

const getBackgroundSource = (tree) => (
  tree.root.findAllByType(ImageBackground)[0]?.props?.source
);

describe('EventCardNew — déclinaison par type (handoff 3b)', () => {
  beforeEach(() => {
    mockUserData.mockReturnValue(playerUser);
    mockHaveIAlreadyJoined.mockReturnValue(false);
  });

  it('détection : chip cyan, fond détection, encart postes recherchés', () => {
    const tree = renderCard({
      item: {
        ...baseEvent,
        detectionSlots: [
          { position: 'Avant-centre', quantity: 1 },
          { position: 'Ailier gauche', quantity: 2 },
        ],
        type: { name: 'Détection' },
      },
    });
    expect(getChipColor(tree, 'DÉTECTION / ESSAI')).toBe('couleur-primary500');
    expect(getBackgroundSource(tree)).toBe('image-eventCardDetection');
    expect(textsOf(tree)).toContain('Postes recherchés : Avant-centre, Ailier gauche ×2');
  });

  it('entraînement : chip succès, fond entraînement, encart ouverture externe', () => {
    const tree = renderCard({ item: baseEvent });
    // baseEvent est résolu « entraînement ouvert » par la config legacy.
    expect(getChipColor(tree, 'Entraînement OUVERT')).toBe('couleur-success500');
    expect(getBackgroundSource(tree)).toBe('image-eventCardTraining');
    expect(textsOf(tree)).toMatch(/Ouvert aux joueurs externes/);
  });

  it('match : chip violet, fond match, encart adversaire', () => {
    const tree = renderCard({
      item: {
        ...baseEvent,
        description: 'vs AS Cannes · Domicile · Journée 22',
        name: 'vs AS Cannes',
        type: { name: 'Match' },
      },
    });
    expect(getChipColor(tree, 'MATCH')).toBe('couleur-violet500');
    expect(getBackgroundSource(tree)).toBe('image-eventCardMatch');
    expect(textsOf(tree)).toMatch(/vs AS Cannes/);
  });

  it('tournoi : chip rose, fond tournoi, encart format et jauge en équipes', () => {
    const tree = renderCard({
      item: {
        ...baseEvent,
        tournamentActivity: { name: 'Football' },
        tournamentCategory: { name: 'Sénior' },
        tournamentConfig: { maxTeams: 16 },
        tournamentSection: { name: 'Masculine' },
        tournamentTeams: Array.from(
          { length: 12 },
          (_unused, index) => ({ documentId: `tt-${index}` }),
        ),
        type: { name: 'Tournoi' },
      },
    });
    expect(getChipColor(tree, 'TOURNOI')).toBe('couleur-rose500');
    expect(getBackgroundSource(tree)).toBe('image-eventCardTournament');
    const texts = textsOf(tree);
    expect(texts).toContain('Football • Masculine • Sénior');
    expect(texts).toContain('12 / 16 équipes');
  });

  it('stage : chip warning, fond stage, encart description tarif', () => {
    const tree = renderCard({
      item: {
        ...baseEvent,
        description: '90 € la semaine · Repas inclus',
        eventFormat: 'stage_parent',
        stageEndDate: '2026-08-30T17:00:00',
        stageStartDate: '2026-08-26T09:00:00',
        type: { name: 'Stage' },
      },
    });
    expect(getChipColor(tree, 'STAGE')).toBe('couleur-warning500');
    expect(getBackgroundSource(tree)).toBe('image-eventCardStage');
    expect(textsOf(tree)).toContain('90 € la semaine · Repas inclus');
  });

  it('réservation : chip or, fond réservation, encart tarif + capacité', () => {
    const tree = renderCard({
      item: {
        ...baseEvent,
        pricePerPerson: 10,
        totalPlayers: 10,
        type: { name: 'Réservation' },
      },
    });
    expect(getChipColor(tree, 'RÉSERVATION')).toBe('couleur-gold500');
    expect(getBackgroundSource(tree)).toBe('image-eventCardReservation');
    const texts = textsOf(tree);
    expect(texts).toMatch(/10€ \/ pers/);
    expect(texts).toContain('10 joueurs max');
  });

  it('autre : chip neutre, fond autre, encart description libre', () => {
    const tree = renderCard({
      item: {
        ...baseEvent,
        description: 'Sortie cohésion du club',
        type: { name: 'Autre' },
      },
    });
    expect(getChipColor(tree, 'AUTRE')).toBe('couleur-neutral300');
    expect(getBackgroundSource(tree)).toBe('image-eventCardOther');
    expect(textsOf(tree)).toContain('Sortie cohésion du club');
  });

  it('jauge de places : inscrits / capacité', () => {
    const tree = renderCard({ item: baseEvent });
    expect(textsOf(tree)).toContain('2 / 14');
  });
});
