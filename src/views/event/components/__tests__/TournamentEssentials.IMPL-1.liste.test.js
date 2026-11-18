/* eslint-disable max-len -- titres de témoins en phrases, et relevés ligne à ligne */
import { Image, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TournamentEssentials, { getTournamentEssentials } from '../TournamentEssentials';

// IMPL-1-FICHE (18/11/2026, pack T-DESIGN-TOURNOI, écran 6b) — « Lire date, lieu, prix et format
// d'un coup d'œil » : les infos en UNE seule carte, une ligne par info avec son icône (plus de
// grille de 4 cases). Les cases d'avant restent pour les autres écrans (page d'équipe, accueil).

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));
jest.mock('@/theme/strings/localeDesFormats', () => ({ __esModule: true, default: () => 'fr-FR' }));
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
      Images: new Proxy({}, { get: (_i, cle) => `icone-${String(cle)}` }),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

const TOURNOI = {
  date: '2026-12-19T12:00:00.000Z',
  endTime: '23:00:00',
  location: 'AR Soccer, 119 rue de la Rauze basse, 34070 Montpellier',
  startTime: '19:00:00',
  tournamentConfig: {
    entryFeeCents: 2000, jerseySizeRequired: true, maxTeams: 24, minAge: 16, minRosterSize: 5,
  },
};

const monter = (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<TournamentEssentials formatPrefix={props.formatPrefix} items={getTournamentEssentials(TOURNOI)} variant={props.variant} />);
  });
  const { root } = arbre;
  const ids = [...new Set(root.findAll((/** @type {any} */ n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('tournament-essentials'))
    .map((/** @type {any} */ n) => n.props.testID))];
  /** @type {Record<string, string[] | null>} */
  const parCle = {};
  ['date', 'place', 'price', 'format'].forEach((cle) => {
    const [ligne] = root.findAll((/** @type {any} */ n) => n.props?.testID === `tournament-essentials-${cle}`, { deep: false });
    parCle[cle] = ligne ? ligne.findAllByType(Text).map((/** @type {any} */ t) => [].concat(t.props.children).join('')) : null;
  });
  const lignes = (/** @type {string} */ cle) => parCle[cle];
  const icones = root.findAllByType(Image).map((/** @type {any} */ n) => n.props.source);
  const resultat = { icones, ids, lignes };
  act(() => arbre.unmount());
  return resultat;
};

describe('IMPL-1 (6b) — l essentiel en une carte, une ligne par info', () => {
  test('🔴 variante « liste » : une carte, 4 lignes avec leur icône, dans l ordre', () => {
    const { icones, ids } = monter({ variant: 'liste' });
    expect(ids).toEqual(expect.arrayContaining(['tournament-essentials', 'tournament-essentials-date', 'tournament-essentials-place', 'tournament-essentials-price', 'tournament-essentials-format']));
    expect(icones).toEqual(['icone-calendar', 'icone-pin', 'icone-euroCircle', 'icone-users']);
  });

  test('🔴 chaque ligne en une phrase : « sam. 19 décembre · 19:00 – 23:00 », le lieu entier, le prix et le maillot', () => {
    const { lignes } = monter({ variant: 'liste' });
    expect(lignes('date')?.[0]).toMatch(/^sam\.? 19 décembre · 19:00 – 23:00$/);
    expect(lignes('place')?.[0]).toBe('AR Soccer, 119 rue de la Rauze basse, 34070 Montpellier');
    expect(lignes('price')?.[0]).toBe('20 € par joueur · Maillot offert en bonus, taille choisie au paiement');
  });

  test('🔴 le format reçoit l activité et la section (« Mixte » quitte les pastilles)', () => {
    const { lignes } = monter({ formatPrefix: 'Foot à 5, Mixte', variant: 'liste' });
    expect(lignes('format')?.[0]).toBe('Foot à 5, Mixte · 5 joueurs par équipe · À partir de 16 ans · 24 équipes au plus');
  });

  test('sans variante : les cases d avant, sans icône (page d équipe, accueil)', () => {
    const { icones, lignes } = monter({});
    expect(icones).toEqual([]);
    expect(lignes('price')).toEqual(['Prix', '20 € par joueur', 'Maillot offert en bonus, taille choisie au paiement']);
  });
});
