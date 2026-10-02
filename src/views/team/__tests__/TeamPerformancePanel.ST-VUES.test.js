import { readFileSync } from 'fs';
import { join } from 'path';

import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TeamPerformancePanel from '../performance/TeamPerformancePanel';

// ST-VUES (02/10) — L ONGLET « PERFORMANCE » DE L EQUIPE, PLANCHE 13 DU DESIGN VALIDE.
//
// Les blocs, dans l ordre : « Saison · N matchs » et la forme ; les tuiles
// V / N / D ; les buts marques · encaisses · difference ; la note du coach et
// celle des joueurs ; « Joueurs », trie par buts, passes ou minutes.
// « moyenne B » (decision d Adel du 02/10) : chez le joueur, la note des
// joueurs sous 3 reponses se dit « Joueurs : dès 3 réponses ».
//
// 🧪 `TeamDetails.js` fait plus de 6 000 lignes et n est pas monte en test : la
// planche vit dans son propre composant, rendu ici pour de vrai, et la ligne qui
// le branche dans l ecran est verifiee dans la source (meme compromis que
// `TeamRecordTiles.test.js`).

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
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

/** @type {any[]} */
const montes = [];

const rendre = (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <TeamPerformancePanel
        currentUserDocumentId={props.currentUserDocumentId}
        isLoading={props.isLoading}
        onPressPlayer={props.onPressPlayer}
        stats={props.stats}
      />,
    );
  });
  montes.push(arbre);
  return arbre;
};

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

const texteDe = (/** @type {any} */ noeud) => {
  const morceaux = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (enfant === null || enfant === undefined || enfant === false) return;
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      morceaux.push(String(enfant));
      return;
    }
    if (Array.isArray(enfant)) {
      enfant.forEach(parcourir);
      return;
    }
    parcourir(enfant?.props?.children);
  };
  parcourir(noeud?.props?.children);
  return morceaux.join('');
};

// Les Text de premier niveau, dans l ordre de l ecran (un Text imbrique est lu avec son parent).
const textes = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.type === Text, { deep: false }).map(texteDe);

const parTestID = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === id, { deep: false });

// La saison pleine de la planche (etat 2), Seniors A en exemple.
const SAISON = {
  form: ['win', 'win', 'draw', 'loss', 'win'],
  players: [
    {
      assists: 5,
      documentId: 'hugo',
      firstname: 'Hugo',
      goals: 7,
      lastname: 'Roux',
      minutesPlayed: 780,
    },
    {
      assists: 2,
      documentId: 'leo',
      firstname: 'Léo',
      goals: 11,
      lastname: 'Diallo',
      minutesPlayed: 712,
    },
    {
      assists: 3,
      documentId: 'enzo',
      firstname: 'Enzo',
      goals: 5,
      lastname: 'Petit',
      minutesPlayed: 645,
    },
  ],
  sport: 'football',
  totals: {
    averageCollectiveRating: 7.6,
    draws: 1,
    losses: 2,
    matches: 9,
    playerCollectiveRatingAverage: 7.2,
    playerCollectiveRatingCount: 48,
    scoreAgainstTotal: 21,
    scoreForTotal: 34,
    wins: 6,
  },
};

describe('ST-VUES planche 13 — les blocs du design, dans l ordre', () => {
  test('« Saison », V / N / D, buts, notes, puis les joueurs', () => {
    const lus = textes(rendre({ stats: SAISON }));
    const rang = (/** @type {string} */ debut) => lus.findIndex((texte) => texte.startsWith(debut));

    const ordre = [
      'Saison · 9 matchs',
      '6',
      'Buts marqués',
      '7,6/10',
      '7,2/10',
      'Joueurs',
      'Léo Diallo',
    ].map(rang);
    expect(ordre.every((index) => index >= 0)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
  });

  test('la FORME : cinq lettres, dans l ordre, et une phrase pour le lecteur d ecran', () => {
    const [forme] = parTestID(rendre({ stats: SAISON }), 'team-performance-form');

    expect(forme.props.accessibilityLabel).toBe(
      'Forme : victoire, victoire, nul, défaite, victoire',
    );
    expect(forme.findAllByType(Text).map((n) => n.props.children)).toEqual(['V', 'V', 'N', 'D', 'V']);
  });

  test('les tuiles disent le chiffre PUIS le mot, au singulier ou au pluriel', () => {
    const lus = textes(
      rendre({
        stats: {
          ...SAISON,
          totals: {
            ...SAISON.totals,
            draws: 0,
            losses: 2,
            wins: 1,
          },
        },
      }),
    );

    expect(lus).toEqual(expect.arrayContaining(['Victoire', 'Nul', 'Défaites']));
    expect(lus.indexOf('1')).toBeLessThan(lus.indexOf('Victoire'));
  });

  test('« Buts marqués 34 · encaissés 21 · différence +13 », en une ligne', () => {
    const [ligne] = parTestID(rendre({ stats: SAISON }), 'team-performance-goals');

    expect(texteDe(ligne)).toBe('Buts marqués 34 · encaissés 21 · différence +13');
  });

  test('la note des joueurs dit sur combien de notes elle repose', () => {
    expect(textes(rendre({ stats: SAISON }))).toEqual(
      expect.arrayContaining(['Note des joueurs · 48']),
    );
  });

  test('basket : points marques, et le classement par points', () => {
    const arbre = rendre({
      stats: {
        ...SAISON,
        players: [
          {
            assists: 4,
            documentId: 'a',
            firstname: 'Ana',
            lastname: 'Bo',
            points: 18,
          },
        ],
        sport: 'basketball',
      },
    });

    expect(
      texteDe(parTestID(arbre, 'team-performance-goals')[0]).startsWith('Points marqués'),
    ).toBe(true);
    expect(parTestID(arbre, 'team-performance-sort-points')).toHaveLength(1);
  });
});

describe('ST-VUES planche 13 — le classement des joueurs', () => {
  const ordreDesJoueurs = (/** @type {any} */ arbre) => textes(arbre).filter((texte) => ['Enzo Petit', 'Hugo Roux', 'Léo Diallo'].includes(texte));

  test('trie par buts d abord, puis par passes au toucher', () => {
    const arbre = rendre({ stats: SAISON });
    expect(ordreDesJoueurs(arbre)).toEqual(['Léo Diallo', 'Hugo Roux', 'Enzo Petit']);

    act(() => {
      parTestID(arbre, 'team-performance-sort-assists')[0].props.onPress();
    });
    expect(ordreDesJoueurs(arbre)).toEqual(['Hugo Roux', 'Enzo Petit', 'Léo Diallo']);
  });

  test('la ligne du lecteur dit « toi » et ne s ouvre pas ; les autres s ouvrent chez l encadrement', () => {
    const ouvert = jest.fn();
    const arbre = rendre({ currentUserDocumentId: 'hugo', onPressPlayer: ouvert, stats: SAISON });

    expect(textes(arbre)).toEqual(expect.arrayContaining(['Hugo Roux · toi']));
    expect(parTestID(arbre, 'team-performance-player-hugo')[0].type).not.toBe(TouchableOpacity);
    act(() => {
      parTestID(arbre, 'team-performance-player-leo')[0].props.onPress();
    });
    expect(ouvert).toHaveBeenCalledWith({ documentId: 'leo' });
  });

  test('sans `onPressPlayer` (un joueur qui lit), aucune ligne ne s ouvre', () => {
    const arbre = rendre({ stats: SAISON });

    expect(
      arbre.root
        .findAllByType(TouchableOpacity)
        .filter((n) => String(n.props.testID || '').startsWith('team-performance-player-')),
    ).toHaveLength(0);
  });
});

describe('ST-VUES planche 13 — les etats', () => {
  test('🔒 « moyenne B » : chez le joueur, sous 3 reponses, la tuile dit « dès 3 réponses »', () => {
    const lus = textes(
      rendre({
        stats: {
          ...SAISON,
          totals: {
            ...SAISON.totals,
            playerCollectiveRatingAverage: null,
            playerCollectiveRatingCount: 1,
            playerCollectiveRatingHidden: true,
          },
        },
      }),
    );

    expect(lus).toEqual(expect.arrayContaining(['Joueurs : dès 3 réponses']));
    expect(lus).not.toEqual(expect.arrayContaining(['Note des joueurs · 1']));
  });

  test('pas encore de match : une phrase, pas une grille de zeros', () => {
    const arbre = rendre({
      stats: {
        form: [],
        players: [],
        sport: 'football',
        totals: { matches: 0 },
      },
    });

    expect(parTestID(arbre, 'team-performance-empty')).toHaveLength(1);
    expect(textes(arbre)).toEqual(expect.arrayContaining(['Pas encore de résultat']));
  });

  test('chargement : des formes, pas de chiffres', () => {
    const arbre = rendre({ isLoading: true, stats: null });

    expect(parTestID(arbre, 'team-performance-loading')).toHaveLength(1);
    expect(textes(arbre)).toEqual([]);
  });
});

describe('ST-VUES planche 13 — TeamDetails branche la planche', () => {
  const SOURCE = readFileSync(join(__dirname, '..', 'TeamDetails.js'), 'utf8');

  test('le panneau remplace l ancienne carte « Récap du groupe »', () => {
    expect(SOURCE).toContain('<TeamPerformancePanel');
    expect(SOURCE).not.toContain("t('teamDetails.perf.title', 'Récap du groupe')");
    expect(SOURCE).not.toContain("'teamDetails.perf.recentTitle'");
  });

  test('un sport sans stats de match n a pas le bouton « Performance » ; le dirigeant a son bandeau', () => {
    expect(SOURCE).toMatch(
      /\{canLoadTeamPerformanceStats \? \(\s*<View style=\{\[Alignments\.row, Spaces\.gap\[8\]\]\}>/,
    );
    expect(SOURCE).toContain('testID="team-stats-manager-banner"');
  });
});
