/* eslint-disable max-len, react/jsx-props-no-spreading -- les témoins se lisent en entier ; le harnais passe les propriétés du cas. */
import renderer, { act } from 'react-test-renderer';

import TournamentTeamProgress, { getUnpaidSentence } from '../TournamentTeamProgress';

// IMPL-2-EQUIPE (18/11/2026, planches 3a, 4a, 9a, 9c, 9g, 10a ; Adel 18/11 « plus de “paiements”
// seul ») — la carte « Où en est l'équipe » de la PAGE D'ÉQUIPE (`detailed`) : « N places payées sur 5 »,
// la pastille « N places à payer », et la phrase qui dit QUI n'a pas payé et ce qui valide l'équipe.
// Les noms viennent de `payment.members` (absent pour un non-membre : jamais de nom pour lui).
// Sans `detailed` (fiche du tournoi, lot IMPL-1), la carte ne change pas de texte.

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

const membre = (/** @type {string} */ id, /** @type {any} */ user, /** @type {any} */ extra = {}) => ({
  documentId: id, responseStatus: 'present', role: 'member', user, ...extra,
});
const place = (/** @type {string} */ id, /** @type {string} */ status, isSelf = false) => ({ isSelf, memberDocumentId: id, status });
// 4 joueurs, 3 payés (planche 4a) : Karim (capitaine), Nassim, Lucas payés ; Sami doit sa place.
const QUATRE = [
  membre('k', { documentId: 'u-k', firstname: 'Karim', lastname: 'Benali' }, { role: 'captain' }),
  membre('n', { documentId: 'u-n', firstname: 'Nassim', lastname: 'Amrani' }),
  membre('l', { documentId: 'u-l', firstname: 'Lucas', lastname: 'Martin' }),
  membre('s', { documentId: 'u-s', firstname: 'Sami', lastname: 'Haddad' }),
];
const PAIEMENT_4A = {
  entryFeeCents: 2000,
  members: [place('k', 'paid', true), place('n', 'paid'), place('l', 'paid'), place('s', 'due')],
  paidCount: 3,
  paidMembersToValidate: 5,
};

/** @type {any[]} */
const montes = [];
const monter = (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre = null;
  act(() => { arbre = renderer.create(<TournamentTeamProgress detailed teamStatus="pending" tournamentConfig={{}} {...props} />); });
  montes.push(arbre);
  return arbre;
};
const texte = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.type === 'Text')
  .map((/** @type {any} */ n) => [].concat(n.props.children).join('')).join(' | ');
afterEach(() => { act(() => { montes.splice(0).forEach((arbre) => arbre.unmount()); }); });

describe('getUnpaidSentence — qui n’a pas payé', () => {
  test('4a : 3 payés sur 5, Sami doit sa place, 1 place libre', () => {
    expect(getUnpaidSentence({ members: QUATRE, payment: PAIEMENT_4A })).toBe(
      '1 joueur n’a pas encore payé sa place : Sami. 1 place est encore libre. L’équipe sera validée quand les 5 premières places seront payées.',
    );
  });

  test('9a : le lecteur n’a pas payé, ni Léa : « toi et Léa », sans place libre', () => {
    const membres = [
      membre('a', { firstname: 'Sami' }), membre('b', { firstname: 'Nassim' }), membre('c', { firstname: 'Lucas' }),
      membre('moi', { firstname: 'Thomas' }), membre('d', { firstname: 'Léa' }),
    ];
    const paiement = {
      members: [place('a', 'paid'), place('b', 'paid'), place('c', 'paid'), place('moi', 'due', true), place('d', 'due')],
      paidCount: 3,
      paidMembersToValidate: 5,
    };
    expect(getUnpaidSentence({ members: membres, payment: paiement })).toBe(
      '2 joueurs n’ont pas encore payé leur place : toi et Léa. L’équipe sera validée quand les 5 premières places seront payées.',
    );
  });

  test('3a : 2 payés, 3 joueurs : 2 places libres (pluriel)', () => {
    const membres = QUATRE.slice(0, 3).concat([]);
    const paiement = { members: [place('k', 'paid', true), place('n', 'paid'), place('l', 'due')], paidCount: 2, paidMembersToValidate: 5 };
    expect(getUnpaidSentence({ members: membres, payment: paiement })).toBe(
      '1 joueur n’a pas encore payé sa place : Lucas. 2 places sont encore libres. L’équipe sera validée quand les 5 premières places seront payées.',
    );
  });

  test('un joueur sans nom lisible (user null, displayName « Jo B. ») : son prénom ; sinon le nombre seul', () => {
    const membres = [membre('x', null, { displayName: 'Jo B.' }), membre('y', null)];
    const paiement = { members: [place('x', 'due'), place('y', 'due')], paidCount: 0, paidMembersToValidate: 5 };
    expect(getUnpaidSentence({ members: membres, payment: paiement })).toBe(
      '2 joueurs n’ont pas encore payé leur place. 3 places sont encore libres. L’équipe sera validée quand les 5 premières places seront payées.',
    );
  });

  test('non-membre (pas de `payment.members`) ou tournoi gratuit : pas de phrase', () => {
    expect(getUnpaidSentence({ members: QUATRE, payment: { paidCount: 3, paidMembersToValidate: 5 } })).toBeNull();
    expect(getUnpaidSentence({ members: QUATRE, payment: null })).toBeNull();
  });

  test('équipe validée : pas de phrase', () => {
    expect(getUnpaidSentence({ members: QUATRE, payment: PAIEMENT_4A, teamStatus: 'accepted' })).toBeNull();
  });
});

describe('TournamentTeamProgress detailed — la carte de la page d’équipe', () => {
  test('4a : « 2 places à payer », « 3 places payées sur 5 », la phrase ; plus de « Il manque »', () => {
    const contenu = texte(monter({ members: QUATRE, payment: PAIEMENT_4A }));
    expect(contenu).toContain('Où en est l’équipe');
    expect(contenu).toContain('2 places à payer');
    expect(contenu).toContain('3 places payées sur 5');
    expect(contenu).toContain('1 joueur n’a pas encore payé sa place : Sami.');
    expect(contenu).not.toContain('Il manque');
    expect(contenu).not.toContain('3 / 5');
  });

  test('capitaine (`noLimitHint`) : « Pas de limite de joueurs : chacun paie sa place. »', () => {
    expect(texte(monter({ members: QUATRE, noLimitHint: true, payment: PAIEMENT_4A }))).toContain('Pas de limite de joueurs : chacun paie sa place.');
  });

  test('4b : validée à 7 joueurs : « Équipe validée », « 5 payés sur 5 : ton équipe joue le tournoi… »', () => {
    const sept = QUATRE.concat([membre('h', { firstname: 'Hugo' }), membre('t', { firstname: 'Théo' }), membre('y', { firstname: 'Yanis' })]);
    const paiement = { ...PAIEMENT_4A, members: [], paidCount: 6 };
    const contenu = texte(monter({ members: sept, payment: paiement, teamStatus: 'accepted' }));
    expect(contenu).toContain('Équipe validée');
    expect(contenu).toContain('5 payés sur 5 : ton équipe joue le tournoi. Tu peux encore ajouter des joueurs.');
    expect(contenu).not.toContain('places à payer');
  });

  test('visiteur (`viewerIsMember` faux) : la règle neutre, aucun nom', () => {
    const contenu = texte(monter({ members: QUATRE, payment: { paidCount: 3, paidMembersToValidate: 5 }, viewerIsMember: false }));
    expect(contenu).toContain('3 places payées sur 5');
    expect(contenu).not.toContain('Sami');
  });

  test('la barre est bleue, même pleine (plus de vert, Adel 18/11)', () => {
    const arbre = monter({ members: QUATRE, payment: { ...PAIEMENT_4A, paidCount: 5 }, teamStatus: 'accepted' });
    const barre = arbre.root.findAll((/** @type {any} */ n) => n.props?.ratio !== undefined && n.props?.color)[0];
    const Colors = jest.requireActual('@/theme/colors').default();
    expect(barre.props.color).toBe(Colors.primary500);
  });
});
