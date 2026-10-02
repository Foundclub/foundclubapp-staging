import { readFileSync } from 'fs';
import { join } from 'path';

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TeamRecordTiles from '../performance/TeamRecordTiles';

// STATS-VND (24/09) — LE BILAN DE L EQUIPE SUR LA PAGE EQUIPE.
//
// Decision B d Adel (24/09) : « compter le score et la victoire ou la defaite
// des la saisie ». Le serveur sert `totals.wins / draws / losses` depuis
// STATS-SCORE (admin `5346c1c`) ; la carte « Performance » ne les lisait pas
// (`TeamDetails.js` : Matchs, Minutes, Buts, Passes, score cumule — aucun V/N/D).
//
// 🧪 `TeamDetails.js` fait plus de 4 300 lignes et n est pas monte en test (voir
// `D8DateStatsSansEntitesHtml.test.js`, meme compromis) : le bilan vit donc dans
// son propre composant, rendu ici pour de vrai, et la ligne qui le branche dans
// l ecran est verifiee dans la source.

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

// Le VRAI theme, sans fournisseur : les tuiles portent les memes styles qu a l ecran.
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

const rendre = (/** @type {any} */ totals) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<TeamRecordTiles totals={totals} />);
  });
  montes.push(arbre);
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => String(n.props.children));

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('STATS-VND — trois tuiles : victoires, nuls, defaites', () => {
  // ST-VUES (02/10, planche 13 du design valide) : le CHIFFRE d abord, le mot dessous,
  // au singulier ou au pluriel. Ces trois temoins disaient l inverse avant ce lot.
  test('le bilan servi s affiche, chaque libelle sous son chiffre', () => {
    const arbre = rendre({ draws: 2, losses: 1, wins: 5 });

    expect(textes(arbre)).toEqual(['5', 'Victoires', '2', 'Nuls', '1', 'Défaite']);
  });

  test('un bilan vierge montre ses zeros : c est une vraie information', () => {
    expect(textes(rendre({ draws: 0, losses: 0, wins: 0 })))
      .toEqual(['0', 'Victoire', '0', 'Nul', '0', 'Défaite']);
  });

  test('un lecteur d ecran entend le chiffre avec son libelle', () => {
    const tuiles = rendre({ draws: 2, losses: 1, wins: 5 }).root
      .findAll((/** @type {any} */ n) => n.props.accessible === true && typeof n.type === 'string');

    expect(tuiles.map((/** @type {any} */ n) => n.props.accessibilityLabel))
      .toEqual(['5 Victoires', '2 Nuls', '1 Défaite']);
  });

  test('🔒 un serveur plus ancien (champs absents) : rien, plutot qu un « 0 » qui mentirait', () => {
    expect(rendre({ matches: 4 }).toJSON()).toBeNull();
    expect(rendre(null).toJSON()).toBeNull();
    expect(rendre({ draws: 1, wins: 2 }).toJSON()).toBeNull();
  });
});

describe('STATS-VND — la carte « Performance » branche le bilan', () => {
  // ST-VUES (02/10) : la carte vit desormais dans `performance/TeamPerformancePanel.js`
  // (planche 13) ; le bilan y suit « Saison · N matchs » et precede la ligne des buts.
  const SOURCE = readFileSync(join(__dirname, '..', 'performance', 'TeamPerformancePanel.js'), 'utf8');

  test('juste sous « Saison · N matchs », avant les buts marques', () => {
    const saison = SOURCE.indexOf("'teamStatsPanel.season'");
    const bilan = SOURCE.indexOf('<TeamRecordTiles totals={totals} />');
    const buts = SOURCE.indexOf("'teamStatsPanel.goalsScored'");

    expect(saison).toBeGreaterThan(-1);
    expect(bilan).toBeGreaterThan(saison);
    expect(bilan).toBeLessThan(buts);
  });
});
