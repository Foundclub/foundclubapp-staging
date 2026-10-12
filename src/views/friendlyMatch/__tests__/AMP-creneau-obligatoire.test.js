// I18N-4 : le code teste lit ses textes par i18next ; ce temoin initialise le VRAI i18next en
// francais, sans rien changer a ce qu il affirme.
import '@/theme/strings';
import { Alert, Modal } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FriendlyMatchApplicationCard from '../components/FriendlyMatchApplicationCard';
import FriendlyMatchApplySheet from '../components/FriendlyMatchApplySheet';

// ---------------------------------------------------------------------------------------------
// AMICAUX-PROPOSITIONS, points 2 et 3 (13/10). Decision d Adel (12/10 vers 23 h) : « il faut
// obliger en cas de postulation sur un match amical proposé un créneau » — une DATE, un
// HORAIRE, un LIEU. Le serveur refuse desormais une proposition incomplete (admin
// friendly-match-workflow.ts, AMP2) ; la feuille ne doit donc pas laisser envoyer ce qu il
// refusera, et reprendre ce que l annonce donne deja.
// Point 3 : une proposition incomplete DEJA envoyee se refuse toujours, et « Accepter ce
// match » demande ce qui manque au lieu d un bouton qui repond « Aucune date convenue ».
// ---------------------------------------------------------------------------------------------

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));
jest.mock('@react-native-community/datetimepicker', () => function RoueMock() { return null; });
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

const mockApply = jest.fn();
const mockRespond = jest.fn();
jest.mock('@/services/friendlyMatch/friendlyMatchService', () => ({
  applyToFriendlyMatchAd: (/** @type {any} */ a, /** @type {any} */ b) => mockApply(a, b),
  respondToFriendlyMatchApplication: (/** @type {any} */ a, /** @type {any} */ b) => (
    mockRespond(a, b)
  ),
}));

jest.mock('@/theme/colors', () => ({ withAlpha: (/** @type {any} */ color) => color }));
jest.mock('@/theme/themeContext', () => {
  /**
   * Echelle de style tolerante.
   * @returns {any}
   */
  const anyScale = () => new Proxy({}, {
    get: (/** @type {any} */ _target, /** @type {any} */ key) => (
      typeof key === 'symbol' ? undefined : anyScale()
    ),
  });
  return {
    __esModule: true,
    default: () => ({
      Alignments: anyScale(),
      ApplicationStyle: anyScale(),
      Colors: new Proxy({}, { get: () => 'couleur' }),
      Fonts: anyScale(),
      Images: anyScale(),
      Spaces: anyScale(),
    }),
  };
});

const AD = {
  // Le 15 a un horaire, le 16 n en a pas.
  candidateDates: [{ date: '2099-05-15', end: '20:00', start: '18:00' }, { date: '2099-05-16' }],
  documentId: 'ad-1',
  hostingPreference: 'BOTH',
  location: { city: 'Montrivage', label: 'Stade du Moulin' },
  status: 'open',
  team: { documentId: 'team-annonceur', name: 'Montrivage U13' },
};
const MY_TEAM = { documentId: 'team-candidat', name: 'Rivelac U13' };

/**
 * Tous les textes rendus, aplatis.
 * @param {any} node
 * @returns {string[]}
 */
const collectText = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return collectText(node.children);
};
const allText = (/** @type {any} */ tree) => collectText(tree.toJSON()).join(' | ');
/**
 * Les noeuds composants dont les props repondent au predicat.
 * @param {any} root
 * @param {(props: any) => boolean} predicate
 * @returns {any[]}
 */
const findAllByProps = (root, predicate) => root.findAll(
  (/** @type {any} */ node) => typeof node.type !== 'string' && predicate(node.props || {}),
  { deep: true },
);
const chips = (/** @type {any} */ tree, /** @type {string} */ title) => (
  findAllByProps(
    tree.root,
    (props) => props.title === title && typeof props.onSelect === 'function',
  )[0]
);
const buttonIn = (/** @type {any} */ root, /** @type {string} */ title) => (
  findAllByProps(root, (props) => props.title === title && typeof props.onPress === 'function')[0]
);

const renderSheet = async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <FriendlyMatchApplySheet
        ad={AD}
        managedTeams={[MY_TEAM]}
        onClose={jest.fn()}
        onSubmitted={jest.fn()}
        visible
      />,
    );
  });
  return /** @type {any} */ (tree);
};
/**
 * Choisit une pastille d un groupe.
 * @param {any} tree
 * @param {string} title
 * @param {any} value
 * @returns {Promise<void>}
 */
const select = async (tree, title, value) => {
  await act(async () => { chips(tree, title).props.onSelect(value); });
};
const sendButton = (/** @type {any} */ tree) => buttonIn(tree.root, 'Envoyer ma proposition');

beforeEach(() => {
  mockApply.mockReset();
  mockRespond.mockReset();
  mockApply.mockResolvedValue({ documentId: 'app-neuve' });
  mockRespond.mockResolvedValue({ application: {}, event: null });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AMP2 — « Proposer un match » ne laisse pas partir une proposition incomplète', () => {
  it('ne propose plus « Peu importe » : une date de l annonce se choisit', async () => {
    const tree = await renderSheet();
    const dates = chips(tree, 'Quelle date');
    const values = dates.props.options.map((/** @type {any} */ option) => option.value);
    expect(values).toEqual(['2099-05-15', '2099-05-16']);
  });

  it('sans date, « Envoyer » reste éteint et dit ce qui manque', async () => {
    const tree = await renderSheet();
    await select(tree, 'Pour ce match', 'AWAY');
    expect(sendButton(tree).props.disabled).toBe(true);
    expect(allText(tree)).toContain('Pour envoyer, choisis la date.');
  });

  it('« Je me déplace » un jour avec horaire : horaire et lieu de l annonce repris', async () => {
    const tree = await renderSheet();
    await select(tree, 'Pour ce match', 'AWAY');
    await select(tree, 'Quelle date', '2099-05-15');

    expect(allText(tree)).toContain('Horaire : de 18:00 à 20:00');
    expect(allText(tree)).toContain('Lieu : Stade du Moulin');
    const heures = findAllByProps(tree.root, (props) => props.label === 'Heure du coup d’envoi');
    expect(heures).toHaveLength(0);
    expect(sendButton(tree).props.disabled).toBe(false);

    await act(async () => { await sendButton(tree).props.onPress(); });
    expect(mockApply).toHaveBeenCalledWith('ad-1', {
      chosenDate: '2099-05-15', chosenHosting: 'AWAY', team: 'team-candidat',
    });
  });

  it('« Je reçois » un jour sans horaire : horaire et lieu saisis, et envoyés', async () => {
    const tree = await renderSheet();
    await select(tree, 'Pour ce match', 'HOST');
    await select(tree, 'Quelle date', '2099-05-16');
    expect(sendButton(tree).props.disabled).toBe(true);
    expect(allText(tree)).toContain('Pour envoyer, choisis l’horaire et le lieu.');

    const [heure] = findAllByProps(tree.root, (props) => props.label === 'Heure du coup d’envoi');
    await act(async () => { heure.props.onChange('18:30'); });
    const [lieu] = findAllByProps(
      tree.root,
      (props) => props.accessibilityLabel === 'Lieu du match',
    );
    await act(async () => { lieu.props.onChangeText('Stade Nord, terrain 2'); });
    expect(sendButton(tree).props.disabled).toBe(false);

    await act(async () => { await sendButton(tree).props.onPress(); });
    expect(mockApply).toHaveBeenCalledWith('ad-1', {
      chosenDate: '2099-05-16',
      chosenHosting: 'HOST',
      chosenTime: '18:30',
      proposedVenue: 'Stade Nord, terrain 2',
      team: 'team-candidat',
    });
  });
});

describe('AMP3 — proposition incomplète déjà envoyée : refuser marche, accepter complète', () => {
  const renderCard = async (/** @type {any} */ application) => {
    let tree;
    await act(async () => {
      tree = renderer.create(
        <FriendlyMatchApplicationCard
          ad={{ ...AD, applicationsCount: 1 }}
          application={{
            chosenHosting: 'AWAY',
            documentId: 'app-1',
            status: 'pending',
            team: MY_TEAM,
            ...application,
          }}
          onOpenConversation={jest.fn()}
          onResponded={jest.fn()}
        />,
      );
    });
    return /** @type {any} */ (tree);
  };
  const openSheet = (/** @type {any} */ tree) => tree.root.findAll(
    (/** @type {any} */ node) => node.type === Modal && node.props.visible === true,
  )[0];

  it('sans date : « Refuser » part tel quel', async () => {
    const tree = await renderCard({ chosenDate: null });
    await act(async () => { await buttonIn(tree.root, 'Refuser').props.onPress(); });
    expect(mockRespond).toHaveBeenCalledWith('app-1', { action: 'decline' });
  });

  it('sans date : « Accepter ce match » ouvre ce qui manque, sans appeler le serveur', async () => {
    const tree = await renderCard({ chosenDate: null });
    await act(async () => { buttonIn(tree.root, 'Accepter ce match').props.onPress(); });
    expect(mockRespond).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    const sheet = openSheet(tree);
    expect(sheet).toBeTruthy();

    const accept = buttonIn(sheet, 'Accepter ce match');
    expect(accept.props.disabled).toBe(true);
    await act(async () => { chips({ root: sheet }, 'Quel jour').props.onSelect('2099-05-16'); });
    const [heure] = findAllByProps(sheet, (props) => props.label === 'Heure du coup d’envoi');
    await act(async () => { heure.props.onChange('17:30'); });
    expect(buttonIn(sheet, 'Accepter ce match').props.disabled).toBe(false);

    await act(async () => { await buttonIn(sheet, 'Accepter ce match').props.onPress(); });
    expect(mockRespond).toHaveBeenCalledTimes(1);
    const [id, payload] = mockRespond.mock.calls[0];
    expect(id).toBe('app-1');
    expect(payload.action).toBe('accept');
    const attendu = new Date(2099, 4, 16, 17, 30).toISOString();
    expect(payload.agreedTerms.date.slice(0, 10)).toBe(attendu.slice(0, 10));
    expect(new Date(payload.agreedTerms.date).getHours()).toBe(17);
  });

  it('« elle reçoit » sans lieu : accepter exige le lieu, et l envoie', async () => {
    const tree = await renderCard({ chosenDate: '2099-05-15', chosenHosting: 'HOST' });
    await act(async () => { buttonIn(tree.root, 'Accepter ce match').props.onPress(); });
    const sheet = openSheet(tree);
    expect(sheet).toBeTruthy();
    const [heure] = findAllByProps(sheet, (props) => props.label === 'Heure du coup d’envoi');
    await act(async () => { heure.props.onChange('18:00'); });
    expect(buttonIn(sheet, 'Accepter ce match').props.disabled).toBe(true);
    const [lieu] = findAllByProps(sheet, (props) => props.accessibilityLabel === 'Lieu du match');
    await act(async () => { lieu.props.onChangeText('Stade des Rivelacois'); });
    await act(async () => { await buttonIn(sheet, 'Accepter ce match').props.onPress(); });
    expect(mockRespond.mock.calls[0][1].agreedTerms.venue).toBe('Stade des Rivelacois');
  });

  it('une proposition complète garde la confirmation d avant', async () => {
    const tree = await renderCard({ chosenDate: '2099-05-15T16:00:00.000Z' });
    await act(async () => { buttonIn(tree.root, 'Accepter ce match').props.onPress(); });
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(openSheet(tree)).toBeFalsy();
  });
});
