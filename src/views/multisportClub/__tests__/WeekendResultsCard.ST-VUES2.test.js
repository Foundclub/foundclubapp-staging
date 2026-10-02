import { readFileSync } from 'fs';
import { join } from 'path';

import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import WeekendResultsCard from '../components/WeekendResultsCard';

// ST-VUES2 (02/10) — « RÉSULTATS DU WEEK-END » ET « RELANCER », ÉCRAN 18 DU DESIGN VALIDÉ.
//
// Sur « Gestion du club », la carte montre le score de chaque équipe le week-end, et celles
// où il manque. Décision d'Adel du 02/10, « score A » : le dirigeant qui n'entraîne pas
// l'équipe ne saisit pas ; il RELANCE l'entraîneur (« Relancer », la cloche). Celui qui
// entraîne l'équipe a « Saisir ». Un week-end sans match annonce le prochain ; un club sans
// équipe dit par où commencer. Les données viennent de GET /cm/:cmId/weekend-results
// (témoin serveur : admin tests/authz/ST-VUES2-resultats-du-week-end.test.js).

jest.mock(
  'react-i18next',
  () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next,
);

jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(colors),
      Colors: colors,
      Fonts: jest.requireActual('@/theme/fonts').default(colors),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

/** @type {any[]} */
const montes = [];
const monter = (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(element);
  });
  montes.push(arbre);
  return arbre;
};
afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});
const textes = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
const bouton = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ n) => n.props.accessibilityLabel === libelle);

// L'heure d'un match comme l'écran l'écrit (heure de l'appareil) : le témoin ne dépend
// pas du fuseau de la machine qui le lance.
const heure = (/** @type {string} */ iso) => new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(iso));

const SAMEDI = {
  endAt: '2026-09-06T22:00:00.000Z',
  saturday: '2026-09-05',
  startAt: '2026-09-04T22:00:00.000Z',
  sunday: '2026-09-06',
};
const ligne = (/** @type {any} */ extra) => ({
  canRemind: false,
  date: '2026-09-05T17:00:00.000Z',
  eventId: 'e1',
  opponentName: 'Test-COMPO',
  result: null,
  scoreAgainst: null,
  scoreFor: null,
  sport: 'Football',
  status: 'scored',
  teamId: 'u15',
  teamName: 'U15',
  trainers: [{ documentId: 'karim', firstname: 'Karim' }],
  viewerIsTrainer: true,
  ...extra,
});
const carte = (/** @type {any} */ extra) => ({
  nextMatch: null,
  rows: [],
  teamCount: 2,
  teamsWithoutMatchScores: [],
  weekend: SAMEDI,
  ...extra,
});
const rendre = (/** @type {any} */ props) => monter(
  <WeekendResultsCard
    data={props.data}
    emptyAction={props.emptyAction}
    onEnterScore={props.onEnterScore || jest.fn()}
    onOpenMatch={props.onOpenMatch || jest.fn()}
    onRemind={props.onRemind || jest.fn()}
    remindedKeys={props.remindedKeys}
  />,
);

describe('ST-VUES2 écran 18 — la carte « Résultats du week-end »', () => {
  test('état 1 : chaque score, « Saisir » chez son entraîneur, le sport sans score', () => {
    const ouvrir = jest.fn();
    const saisir = jest.fn();
    const donnees = carte({
      rows: [
        ligne({ result: 'win', scoreAgainst: 1, scoreFor: 2 }),
        ligne({
          date: '2026-09-05T19:00:00.000Z',
          eventId: 'e2',
          opponentName: null,
          status: 'missing',
        }),
      ],
      teamsWithoutMatchScores: [{ sport: 'Arts martiaux', teamId: 'u13', teamName: 'U13' }],
    });
    const arbre = rendre({ data: donnees, onEnterScore: saisir, onOpenMatch: ouvrir });

    expect(textes(arbre)).toEqual([
      'Résultats du week-end',
      'Sam. 5 sept.',
      'V',
      'U15 — Test-COMPO',
      `Football · ${heure('2026-09-05T17:00:00.000Z')}`,
      '2 - 1',
      '?',
      'U15 — adversaire à confirmer',
      'Score à saisir',
      'Saisir',
      'Les U13 (arts martiaux) n’ont pas de score de match.',
    ]);

    const ouvrirLeMatch = 'U15 contre Test-COMPO : victoire 2 - 1. Ouvrir le match.';
    act(() => bouton(arbre, ouvrirLeMatch).props.onPress());
    expect(ouvrir).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'e1' }));
    act(() => bouton(arbre, 'Saisir le score de U15').props.onPress());
    expect(saisir).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'e2' }));
  });

  test('état 2 : « score A » — le dirigeant qui n entraîne pas relance l entraîneur', () => {
    const relancer = jest.fn();
    const manquant = ligne({
      canRemind: true,
      eventId: 'e2',
      opponentName: null,
      status: 'missing',
      teamId: 'u15b',
      teamName: 'U15 B',
      trainers: [{ documentId: 'leo', firstname: 'Léo' }],
      viewerIsTrainer: false,
    });
    const arbre = rendre({ data: carte({ rows: [manquant] }), onRemind: relancer });

    expect(textes(arbre)).toEqual(expect.arrayContaining(['Score à saisir · Léo', 'Relancer']));
    expect(textes(arbre)).not.toContain('Saisir');
    act(() => bouton(arbre, 'Relancer Léo pour le score').props.onPress());
    expect(relancer).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'e2', teamId: 'u15b' }),
    );

    // Une fois relancé : plus de bouton, la ligne le dit.
    const apres = rendre({
      data: carte({ rows: [manquant] }),
      onRemind: relancer,
      remindedKeys: new Set(['e2:u15b']),
    });
    expect(textes(apres)).toContain('Relancé');
    expect(bouton(apres, 'Relancer Léo pour le score')).toBeUndefined();
  });

  test('ni saisie ni relance pour un match à venir, ni pour un score fédéral attendu', () => {
    const arbre = rendre({
      data: carte({
        rows: [
          ligne({ eventId: 'e5', status: 'upcoming' }),
          ligne({ date: '2026-09-06T13:00:00.000Z', eventId: 'e8', status: 'official_pending' }),
        ],
      }),
    });

    expect(textes(arbre)).toEqual(
      expect.arrayContaining(['À venir', 'Score officiel attendu', '5 – 6 sept.']),
    );
    expect(textes(arbre)).not.toContain('Saisir');
    expect(textes(arbre)).not.toContain('Relancer');
    expect(textes(arbre)).toContain(`Football · sam. ${heure('2026-09-05T17:00:00.000Z')}`);
  });

  test('état 3 : un week-end sans match le dit, et annonce le prochain', () => {
    const prochain = {
      date: '2026-10-03T11:00:00.000Z',
      eventId: 'e7',
      opponentName: 'Équipe visiteuse',
      teamId: 'u15',
      teamName: 'U15',
    };
    const arbre = rendre({
      data: carte({
        nextMatch: prochain,
        weekend: { ...SAMEDI, saturday: '2026-09-26', sunday: '2026-09-27' },
      }),
    });

    expect(textes(arbre)).toEqual([
      'Résultats du week-end',
      '26 – 27 sept.',
      'Aucun match ce week-end.',
      `Prochain : sam. 3 oct. à ${heure(prochain.date)}, U15 contre Équipe visiteuse.`,
    ]);
  });

  test('état 4 : un club sans équipe dit par où commencer', () => {
    const arbre = rendre({
      data: carte({ teamCount: 0 }),
      emptyAction: { label: 'Créer une équipe', onPress: jest.fn() },
    });

    expect(textes(arbre)).toEqual([
      'Pas encore d’équipe',
      'Crée une équipe : ses résultats apparaîtront ici chaque week-end.',
      'Créer une équipe',
    ]);
  });
});

describe('ST-VUES2 écran 18 — branchement', () => {
  const SERVICE = readFileSync(
    join(__dirname, '..', '..', '..', 'services', 'multisportClub', 'multisportClubService.js'),
    'utf8',
  );
  const PAGE = readFileSync(join(__dirname, '..', 'CMDashboard.js'), 'utf8');

  test('le service lit la carte du club et envoie la relance aux deux routes du serveur', () => {
    expect(SERVICE).toMatch(/client\.get\(`\/cm\/\$\{cmId\}\/weekend-results`\)/);
    expect(SERVICE).toMatch(
      /client\.post\(`\/cm\/\$\{cmId\}\/weekend-results\/remind`, \{ eventId, teamId \}\)/,
    );
  });

  test('« Gestion du club » montre la carte sous les trois chiffres, au seul dirigeant', () => {
    expect(PAGE).toContain("queryKey: ['cm-weekend-results', resolvedCmId]");
    expect(PAGE).toContain('enabled: Boolean(resolvedCmId) && isCmAdmin');
    const ordre = ['<MultisportStatsRow', '<WeekendResultsCard', 'testID="cm-team-stats-link"']
      .map((marque) => PAGE.indexOf(marque));
    expect(ordre.every((position) => position > 0)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
  });
});
