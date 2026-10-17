import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventChildResponses, {
  EventChildResponsesForOrganizer,
} from '../components/EventChildResponses';

// REC17-003 : les réponses sont portées par l'enfant, jamais par son parent ni sa fratrie.
const mockMine = { current: {} };
const mockOrganizer = { current: {} };
const mockMutation = { pending: false };
const mockAnswer = jest.fn();
const mockRefetch = jest.fn();

jest.mock('@/services/eventChildResponse/eventChildResponseQueries', () => ({
  useAnswerForChild: () => ({ isPending: mockMutation.pending, mutateAsync: mockAnswer }),
  useChildEventResponsesForOrganizer: () => mockOrganizer.current,
  useMyChildEventResponses: () => mockMine.current,
}));
jest.mock('react-i18next', () => {
  const i18next = jest.requireActual('i18next');
  return {
    initReactI18next: { init: jest.fn(), type: '3rdParty' },
    useTranslation: () => ({ t: (key, options) => i18next.t(key, options) }),
  };
});
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

/** @type {any} */
let tree;
const row = (documentId, firstname, extra = {}) => ({
  answer: null,
  blockedCode: null,
  canAnswer: true,
  child: { documentId, firstname },
  team: { documentId: 'team-u11', name: 'U11 Filles' },
  ...extra,
});
const render = (element = <EventChildResponses eventId="event-u11" />) => {
  act(() => { tree = renderer.create(element); });
};
const textOf = (node) => node.children.map((child) => (
  typeof child === 'string' || typeof child === 'number' ? child : textOf(child)
)).join(' ');
const byId = (testID) => {
  const nodes = tree.root.findAll((node) => node.props.testID === testID);
  if (!nodes.length) throw new Error(`Élément absent : ${testID}; écran : ${textOf(tree.root)}`);
  return nodes[nodes.length - 1];
};
const control = (testID) => {
  const [, answer, child] = testID.match(/^child-rsvp-(present|absent)-(.+)$/) || [];
  const firstname = child === 'romain' ? 'Romain' : 'Greg';
  const label = `${answer === 'present' ? 'Présent' : 'Absent'} pour ${firstname}`;
  const controls = tree.root.findAll((node) => node.props.accessibilityLabel === label);
  let node = controls[controls.length - 1];
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  if (!node) throw new Error(`Action absente : ${testID}`);
  return node;
};
const disabled = (testID) => {
  const node = control(testID);
  return Boolean(node.props.disabled || node.props.accessibilityState?.disabled);
};
const press = async (testID) => {
  if (disabled(testID)) return;
  await act(async () => { await control(testID).props.onPress(); });
};

beforeEach(() => {
  mockAnswer.mockReset().mockResolvedValue({ answer: 'present' });
  mockRefetch.mockReset().mockResolvedValue({});
  mockMutation.pending = false;
  mockMine.current = {
    data: [row('romain', 'Romain'), row('greg', 'Greg')],
    isError: false,
    isLoading: false,
    refetch: mockRefetch,
  };
  mockOrganizer.current = {
    data: [], isError: false, isLoading: false, refetch: mockRefetch,
  };
});

describe('REC17-003 — réponses du parent pour ses enfants membres', () => {
  test('chaque enfant a sa ligne et ses deux choix, sans demande de réinscription', () => {
    render();
    expect(textOf(byId('child-rsvp-romain'))).toContain('Réponse pour Romain');
    expect(textOf(byId('child-rsvp-greg'))).toContain('Réponse pour Greg');
    ['romain', 'greg'].forEach((child) => {
      expect(textOf(control(`child-rsvp-present-${child}`))).toContain('Présent');
      expect(textOf(control(`child-rsvp-absent-${child}`))).toContain('Absent');
      expect(disabled(`child-rsvp-present-${child}`)).toBe(false);
      expect(disabled(`child-rsvp-absent-${child}`)).toBe(false);
    });
    expect(textOf(tree.root)).not.toContain('Inscrire mes enfants');
  });

  test('Absent pour Romain ne répond ni pour Greg ni pour le compte du parent', async () => {
    render();
    await press('child-rsvp-absent-romain');
    expect(mockAnswer).toHaveBeenCalledTimes(1);
    expect(mockAnswer).toHaveBeenCalledWith({ answer: 'absent', child: 'romain' });
    expect(byId('child-rsvp-greg')).toBeTruthy();
  });

  test('Présent pour Greg transmet uniquement son identité enfant', async () => {
    render();
    await press('child-rsvp-present-greg');
    expect(mockAnswer).toHaveBeenCalledTimes(1);
    expect(mockAnswer).toHaveBeenCalledWith({ answer: 'present', child: 'greg' });
  });

  test('les deux réponses déjà enregistrées restent indépendantes à la réouverture', () => {
    mockMine.current.data = [
      row('romain', 'Romain', { answer: 'present' }),
      row('greg', 'Greg', { answer: 'absent' }),
    ];
    render();
    expect(textOf(byId('child-rsvp-state-romain'))).toMatch(/présent/i);
    expect(textOf(byId('child-rsvp-state-greg'))).toMatch(/absent/i);
    expect(mockAnswer).not.toHaveBeenCalled();
  });

  test('une ligne refusée par le serveur garde ses actions désactivées', async () => {
    mockMine.current.data = [row('romain', 'Romain', {
      blockedCode: 'EVENT_CLOSED', canAnswer: false,
    })];
    render();
    expect(disabled('child-rsvp-present-romain')).toBe(true);
    expect(disabled('child-rsvp-absent-romain')).toBe(true);
    await press('child-rsvp-present-romain');
    expect(mockAnswer).not.toHaveBeenCalled();
  });

  test('un envoi en cours empêche les doubles réponses', async () => {
    mockMutation.pending = true;
    render();
    expect(disabled('child-rsvp-present-romain')).toBe(true);
    expect(disabled('child-rsvp-absent-romain')).toBe(true);
    await press('child-rsvp-absent-romain');
    expect(mockAnswer).not.toHaveBeenCalled();
  });

  test('un échec conserve les enfants et permet de réessayer la même réponse', async () => {
    mockAnswer.mockRejectedValueOnce(new Error('Réseau indisponible'));
    render();
    await press('child-rsvp-absent-romain');
    expect(textOf(byId('child-rsvp-error-romain'))).not.toBe('');
    expect(byId('child-rsvp-romain')).toBeTruthy();
    expect(byId('child-rsvp-greg')).toBeTruthy();
    expect(disabled('child-rsvp-absent-romain')).toBe(false);
    await press('child-rsvp-absent-romain');
    expect(mockAnswer).toHaveBeenCalledTimes(2);
    expect(mockAnswer).toHaveBeenLastCalledWith({ answer: 'absent', child: 'romain' });
  });

  test('un échec de lecture propose une reprise explicite', async () => {
    mockMine.current = { ...mockMine.current, data: undefined, isError: true };
    render();
    let retry = tree.root.findAll((node) => node.type === Text)
      .find((node) => textOf(node).includes('Réessayer'));
    expect(retry).toBeTruthy();
    while (retry && typeof retry.props.onPress !== 'function') retry = retry.parent;
    expect(retry).toBeTruthy();
    await act(async () => { await retry.props.onPress(); });
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(mockAnswer).not.toHaveBeenCalled();
  });

  test('sans enfant éligible, aucun bouton ne répond pour le parent à sa place', () => {
    mockMine.current.data = [];
    render();
    expect(tree.root.findAll((node) => /^Présent pour /.test(
      node.props.accessibilityLabel || '',
    ))).toHaveLength(0);
    expect(mockAnswer).not.toHaveBeenCalled();
  });

  test('l’organisateur distingue les deux enfants et leurs réponses, sans action parent', () => {
    mockOrganizer.current.data = [
      row('romain', 'Romain', { answer: 'present', parent: { firstname: 'Yann' } }),
      row('greg', 'Greg', { answer: 'absent', parent: { firstname: 'Yann' } }),
    ];
    render(<EventChildResponsesForOrganizer eventId="event-u11" />);
    expect(textOf(tree.root)).toContain('Romain');
    expect(textOf(tree.root)).toContain('Greg');
    expect(textOf(tree.root)).toMatch(/présent/i);
    expect(textOf(tree.root)).toMatch(/absent/i);
    expect(tree.root.findAll((node) => /^Présent pour /.test(
      node.props.accessibilityLabel || '',
    ))).toHaveLength(0);
    expect(mockAnswer).not.toHaveBeenCalled();
  });
});
