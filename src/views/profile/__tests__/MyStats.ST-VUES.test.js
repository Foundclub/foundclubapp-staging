import { readFileSync } from 'fs';
import { join } from 'path';

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MySeasonCard from '../stats/MySeasonCard';
import MyStatsPage from '../stats/MyStatsPage';

// ST-VUES (02/10) — « MA SAISON » ET LA PAGE « MES STATS », PLANCHE 16 DU DESIGN VALIDE.
//
// La rangee de mon profil a un titre et « Tout voir », compte les NULS (servis par le
// serveur depuis ST-VUES) et « Ma note », suit le sport, et dit ce qu elle compte. La
// page « Mes stats » montre ce que le serveur calculait sans le montrer : mes derniers
// matchs, mes chiffres, mon mot. Un sport sans stats de match le dit franchement.

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

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      { accessibilityRole: 'button', onPress: props.onPress, testID: 'bouton' },
      react.createElement(rn.Text, null, props.title || ''),
    );
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
const textes = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.type === Text, { deep: false }).map(texteDe);
const parTestID = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === id, { deep: false });

// Hugo, U15 : 1 match, 2 - 1, 90 min, 1 but, sa note 8 (planche 16, etats 1 et 4).
const HUGO = {
  bySport: [
    {
      assists: 0,
      averageSelfRating: 8,
      draws: 0,
      goals: 1,
      losses: 0,
      matches: 1,
      minutesPlayed: 90,
      sport: 'football',
      wins: 1,
    },
  ],
  overall: { matches: 1 },
  recentMatches: [
    {
      assists: 0,
      documentId: 'm1',
      goals: 1,
      matchDate: '2026-09-05T13:00:00.000Z',
      matchLabel: 'AS Montrivage — Test-COMPO',
      minutesPlayed: 90,
      result: 'win',
      scoreAgainst: 1,
      scoreFor: 2,
      selfComment: 'Bon match',
      selfRating: 8,
      sport: 'football',
      teamName: 'U15',
    },
  ],
};

describe('ST-VUES planche 16 — « Ma saison » sur mon profil', () => {
  test('un titre, six cases dans l ordre, et ce qu elle compte', () => {
    const voir = jest.fn();
    const arbre = monter(<MySeasonCard onPressSeeAll={voir} stats={HUGO} />);

    expect(textes(arbre)).toEqual([
      'Ma saison · football',
      'Tout voir',
      '1',
      'Match',
      '1·0·0',
      'V · N · D',
      '90',
      'Minutes',
      '1',
      'But',
      '0',
      'Passe déc.',
      '8',
      'Ma note',
      'Comptés : les matchs où tu as répondu au questionnaire.',
    ]);
    act(() => {
      parTestID(arbre, 'my-season-see-all')[0].props.onPress();
    });
    expect(voir).toHaveBeenCalled();
  });

  test('les NULS comptent : « 1·1·0 »', () => {
    const lus = textes(
      monter(<MySeasonCard stats={{ bySport: [{ ...HUGO.bySport[0], draws: 1, matches: 2 }] }} />),
    );

    expect(lus).toEqual(expect.arrayContaining(['1·1·0', 'Matchs']));
  });

  test('aucun match : la rangee reste, dit comment elle se remplit, sans « Tout voir »', () => {
    const arbre = monter(
      <MySeasonCard onPressSeeAll={jest.fn()} sportHint="Football" stats={{ bySport: [] }} />,
    );

    expect(textes(arbre)).toEqual(
      expect.arrayContaining([
        '0',
        '0·0·0',
        '—',
        'Ta saison se remplit à chaque retour de match que tu envoies.',
      ]),
    );
    expect(parTestID(arbre, 'my-season-see-all')).toHaveLength(0);
  });

  test('un basketteur : points et rebonds, jamais « Buts »', () => {
    const lus = textes(
      monter(
        <MySeasonCard
          stats={{
            bySport: [
              {
                assists: 21,
                averageSelfRating: 7.1,
                draws: 0,
                losses: 4,
                matches: 12,
                points: 148,
                rebounds: 37,
                sport: 'basketball',
                wins: 8,
              },
            ],
          }}
        />,
      ),
    );

    expect(lus).toEqual(
      expect.arrayContaining(['Ma saison · basket', '148', 'Points', '37', 'Rebonds', '7,1']),
    );
    expect(lus.some((texte) => texte.startsWith('But'))).toBe(false);
  });
});

describe('ST-VUES planche 16 — la page « Mes stats »', () => {
  test('mes chiffres, puis mes derniers matchs, avec mon mot', () => {
    const lus = textes(monter(<MyStatsPage stats={HUGO} />));

    expect(lus).toEqual(
      expect.arrayContaining([
        '1',
        'Match',
        '1·0·0',
        'V · N · D',
        '8',
        'Ma note moy.',
        'Mes derniers matchs',
        'AS Montrivage — Test-COMPO',
        'V',
        'U15 · sam. 5 sept. · 2 - 1',
        '90 minutes · 1 but · 0 passe · 8 ma note',
        'Mon mot : « Bon match » — lu par toi et ton entraîneur.',
      ]),
    );
  });

  test('un sport sans stats de match le dit, et ouvre la fiche de l equipe', () => {
    const ouvrir = jest.fn();
    const u13 = { activities: [{ name: 'Arts martiaux' }], documentId: 'u13', name: 'U13' };
    const arbre = monter(<MyStatsPage onOpenTeam={ouvrir} stats={HUGO} teams={[u13]} />);

    act(() => {
      parTestID(arbre, 'my-stats-filter-arts martiaux')[0].props.onPress();
    });
    expect(textes(arbre)).toEqual(
      expect.arrayContaining(['Pas de stats de match en arts martiaux', 'Ouvrir les U13']),
    );
    act(() => {
      parTestID(arbre, 'bouton')[0].props.onPress();
    });
    expect(ouvrir).toHaveBeenCalledWith(u13);
  });
});

describe('ST-VUES planche 16 — les ecrans branchent la planche', () => {
  const RACINE = join(__dirname, '..');
  const PROFIL = readFileSync(join(RACINE, 'SelfProfilePlayerCoach.js'), 'utf8');
  const FICHE = readFileSync(join(RACINE, 'UserDetails.js'), 'utf8');

  test('mon profil montre « Ma saison » et « Suivi › Mes stats » ; l ancienne rangee est partie', () => {
    expect(PROFIL).toContain('<MySeasonCard');
    expect(PROFIL).toContain("label={t('myStats.rowLabel', 'Mes stats')}");
    expect(PROFIL).not.toContain('const statCards');
  });

  test('la page « Mes stats » vit sur la route du profil, pour le proprietaire', () => {
    expect(FICHE).toContain(
      "const isMyStatsView = isOwnerView && route?.params?.view === 'myStats';",
    );
    expect(FICHE).toContain('<MyStatsPage');
  });
});
