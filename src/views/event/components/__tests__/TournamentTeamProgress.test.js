/* eslint-disable max-len -- les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

import TournamentTeamProgress, {
  getMissingLine, getTodoDetail, getTodoTitle, getTournamentTeamProgress,
} from '../TournamentTeamProgress';

// T-PAGES-1 (17/11) — la carte « Où en est l'équipe » (maquette validée, (b) et (c)) : le calcul
// depuis `team.payment` et les membres, puis le rendu. Pas de 5 en dur : `paidMembersToValidate`
// et `minRosterSize` décident.

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

const membre = (/** @type {string} */ id, /** @type {string} */ prenom, /** @type {any} */ extra = {}) => ({
  documentId: id, responseStatus: 'pending', role: 'member', user: { documentId: `u-${id}`, firstname: prenom }, ...extra,
});
const MEMBRES = [
  membre('m1', 'Dorian', { responseStatus: 'present', role: 'captain' }),
  membre('m2', 'Ado', { parentalConsentPending: true }),
  membre('m3', 'Michel'),
  membre('m4', 'Parti', { responseStatus: 'declined' }),
];
const PAIEMENT = {
  entryFeeCents: 2000,
  members: [
    {
      isSelf: true, jerseySize: 'M', memberDocumentId: 'm1', status: 'paid',
    },
    {
      isSelf: false, jerseySize: null, memberDocumentId: 'm2', status: 'due',
    },
    {
      isSelf: false, jerseySize: null, memberDocumentId: 'm3', status: 'due',
    },
  ],
  paidCount: 1,
  paidMembersToValidate: 5,
};
const CONFIG = { jerseySizeRequired: true, maxRosterSize: 8, minRosterSize: 5 };

/** @type {any[]} */
const montes = [];
const monter = (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre = null;
  act(() => { arbre = renderer.create(<TournamentTeamProgress footer={props.footer} members={props.members} payment={props.payment} showTodo={props.showTodo} teamStatus={props.teamStatus} tournamentConfig={props.tournamentConfig} />); });
  montes.push(arbre);
  return arbre;
};
const texte = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.type === 'Text')
  .map((/** @type {any} */ n) => [].concat(n.props.children).join('')).join(' | ');
afterEach(() => { act(() => { montes.splice(0).forEach((arbre) => arbre.unmount()); }); });

describe('getTournamentTeamProgress — le calcul', () => {
  test('capitaine, 1 place payée sur 5, 3 joueurs : 2 joueurs à trouver, 2 places à payer, 1 autorisation, 1 taille sur 3, sa place payée', () => {
    const p = getTournamentTeamProgress({
      members: MEMBRES, payment: PAIEMENT, teamStatus: 'pending', tournamentConfig: CONFIG,
    });
    expect(p).toMatchObject({
      done: 1, isPaid: true, isValidated: false, missingPayments: 4, missingPlayers: 2, needed: 5, playersCount: 3,
    });
    expect(p.ratio).toBeCloseTo(0.2);
    expect(p.todo).toEqual([
      {
        count: 3, kind: 'players', max: 8, missing: 2,
      },
      { count: 2, kind: 'payments', names: ['Ado', 'Michel'] },
      { count: 1, kind: 'consents', names: ['Ado'] },
      {
        chosen: 1, kind: 'jerseys', names: ['Ado', 'Michel'], total: 3,
      },
      { kind: 'selfPaid', size: 'M' },
    ]);
  });

  test('le seuil vient du serveur : paidMembersToValidate 3 ⇒ « 1 / 3 », pas 5', () => {
    const p = getTournamentTeamProgress({ members: MEMBRES, payment: { ...PAIEMENT, paidMembersToValidate: 3 }, tournamentConfig: { minRosterSize: 3 } });
    expect(p).toMatchObject({ missingPayments: 2, missingPlayers: 0, needed: 3 });
  });

  test('équipe validée : plus de liste « à faire » (sauf « Ta place est payée »), barre pleine', () => {
    const p = getTournamentTeamProgress({
      members: MEMBRES, payment: { ...PAIEMENT, paidCount: 5 }, teamStatus: 'accepted', tournamentConfig: CONFIG,
    });
    expect(p.isValidated).toBe(true);
    expect(p.ratio).toBe(1);
    expect(p.todo).toEqual([{ kind: 'selfPaid', size: 'M' }]);
  });

  test('joueur dont la place est due : « Ta place est à payer » en tête ; sans clé jerseySize (pas le droit) aucune ligne de tailles', () => {
    const payment = {
      ...PAIEMENT,
      members: [{ isSelf: false, memberDocumentId: 'm1', status: 'paid' }, { isSelf: true, memberDocumentId: 'm2', status: 'due' }],
    };
    const p = getTournamentTeamProgress({ members: MEMBRES, payment, tournamentConfig: CONFIG });
    expect(p.todo[0]).toEqual({ kind: 'selfDue' });
    expect(p.todo.some((item) => item.kind === 'jerseys')).toBe(false);
  });

  test('tournoi gratuit (pas de payment) : on compte les joueurs sur minRosterSize, aucun paiement ; la marque d autorisation du serveur reste', () => {
    const p = getTournamentTeamProgress({ members: MEMBRES, payment: null, tournamentConfig: { minRosterSize: 5 } });
    expect(p).toMatchObject({
      done: 3, isPaid: false, missingPayments: 0, missingPlayers: 2, needed: 5,
    });
    expect(p.todo.map((item) => item.kind)).toEqual(['players', 'consents']);
  });

  test('sans membres ni réglage : rien ne casse', () => {
    expect(getTournamentTeamProgress()).toMatchObject({
      done: 0, needed: 0, ratio: 0, todo: [],
    });
  });
});

describe('les phrases', () => {
  test('« Il manque 2 joueurs et 4 paiements. » ; un seul morceau ; rien', () => {
    expect(getMissingLine({ missingPayments: 4, missingPlayers: 2 })).toBe('Il manque 2 joueurs et 4 paiements.');
    expect(getMissingLine({ missingPayments: 1, missingPlayers: 0 })).toBe('Il manque 1 paiement.');
    expect(getMissingLine({ missingPayments: 0, missingPlayers: 0 })).toBeNull();
  });

  test('titres et détails des lignes', () => {
    expect(getTodoTitle({
      count: 3, kind: 'players', max: 5, missing: 2,
    })).toBe('Trouver 2 joueurs');
    expect(getTodoDetail({
      count: 3, kind: 'players', max: 5, missing: 2,
    })).toBe('3 joueurs sur 5 dans l’équipe.');
    expect(getTodoTitle({ count: 2, kind: 'payments', names: [] })).toBe('2 places à payer');
    expect(getTodoTitle({ count: 1, kind: 'consents', names: ['Ado'] })).toBe('1 autorisation parentale');
    expect(getTodoTitle({
      chosen: 1, kind: 'jerseys', names: [], total: 3,
    })).toBe('Tailles de maillot : 1 choisie sur 3');
    expect(getTodoTitle({ kind: 'selfPaid', size: 'M' })).toBe('Ta place est payée');
    expect(getTodoDetail({ kind: 'selfPaid', size: 'M' })).toBe('Taille choisie : M');
  });
});

describe('TournamentTeamProgress — le rendu', () => {
  test('« Pas encore validée », « 1 / 5 », la règle des 5, la phrase du manque ; la liste seulement si showTodo', () => {
    const sans = monter({
      members: MEMBRES, payment: PAIEMENT, teamStatus: 'pending', tournamentConfig: CONFIG,
    });
    const contenu = texte(sans);
    expect(contenu).toContain('Où en est l’équipe');
    expect(contenu).toContain('Pas encore validée');
    expect(contenu).toContain('1 / 5');
    expect(contenu).toContain('Pas encore validée : 1 place payée sur 5. Ton équipe est validée dès la 5ᵉ place payée.');
    expect(contenu).toContain('Il manque 2 joueurs et 4 paiements.');
    expect(sans.root.findAll((/** @type {any} */ n) => n.props.testID === 'tournament-team-progress-todo')).toHaveLength(0);

    const avec = monter({
      members: MEMBRES, payment: PAIEMENT, showTodo: true, teamStatus: 'pending', tournamentConfig: CONFIG,
    });
    expect(texte(avec)).toContain('Il te reste à faire');
    expect(texte(avec)).toContain('Trouver 2 joueurs');
    expect(texte(avec)).toContain('Taille choisie : M');
  });

  test('équipe validée : « Équipe validée », pas de « Il manque », pas de liste à faire', () => {
    const arbre = monter({
      members: MEMBRES, payment: { ...PAIEMENT, paidCount: 5 }, showTodo: true, teamStatus: 'accepted', tournamentConfig: CONFIG,
    });
    const contenu = texte(arbre);
    expect(contenu).toContain('Équipe validée');
    expect(contenu).not.toContain('Pas encore validée');
    expect(contenu).not.toContain('Il manque');
    expect(contenu).not.toContain('Trouver');
  });
});
