/* eslint-disable max-len -- les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

import TournamentEssentials, { getTournamentEssentials } from '../TournamentEssentials';

// T-PAGES-1 (17/11) — l'essentiel en 4 cases (maquette validée, (a) et (b)) : date, lieu, prix,
// format ; une case absente si la donnée manque ; l'âge vient de tournamentConfig.minAge.

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
      Images: new Proxy({}, { get: () => 1 }),
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
    entryFeeCents: 2000, jerseySizeRequired: true, maxRosterSize: 8, maxTeams: 8, minAge: 16, minRosterSize: 5,
  },
};

describe('getTournamentEssentials', () => {
  test('les 4 cases dans l ordre, avec leurs valeurs', () => {
    const cases = getTournamentEssentials(TOURNOI);
    expect(cases.map((item) => item.key)).toEqual(['date', 'place', 'price', 'format']);
    const [date, lieu, prix, format] = cases;
    expect(date.value).toMatch(/sam\.? 19 décembre/);
    expect(date.note).toBe('19:00 – 23:00');
    expect(lieu).toMatchObject({ note: '119 rue de la Rauze basse, 34070 Montpellier', value: 'AR Soccer' });
    expect(prix).toMatchObject({ note: 'Maillot offert en bonus, taille choisie au paiement', value: '20 € par joueur' });
    expect(format).toMatchObject({ note: 'À partir de 16 ans · 8 équipes au plus', value: '5 joueurs par équipe' }); // T-SANS-PLAFOND (D239) : plus de maximum
  });

  test('une case absente si la donnée manque : gratuit, sans lieu, sans date', () => {
    const cases = getTournamentEssentials({ tournamentConfig: { minRosterSize: 5 } });
    expect(cases.map((item) => item.key)).toEqual(['format']);
    expect(cases[0]).toMatchObject({ note: null, value: '5 joueurs par équipe' });
  });

  test('l âge vient de minAge (pas de la catégorie) ; sans minAge, pas de mention d âge', () => {
    const avec = getTournamentEssentials({ category: { name: 'Sénior (+18 ans)' }, tournamentConfig: { minAge: 16 } });
    expect(avec[0].value).toBe('À partir de 16 ans');
    const sans = getTournamentEssentials({ tournamentConfig: { maxTeams: 8, minRosterSize: 5 } });
    expect(JSON.stringify(sans)).not.toContain('ans');
  });

  test('rien du tout : aucune case', () => {
    expect(getTournamentEssentials(null)).toEqual([]);
  });
});

describe('TournamentEssentials — le rendu', () => {
  test('une case par élément, l action sous sa case ; rien sans élément', () => {
    /** @type {any} */
    let arbre = null;
    /**
     * Un lien d itinéraire factice.
     * @returns {null} Rien.
     */
    function Itineraire() {
      return null;
    }
    act(() => {
      arbre = renderer.create(<TournamentEssentials actions={{ place: <Itineraire /> }} items={getTournamentEssentials(TOURNOI)} />);
    });
    ['date', 'place', 'price', 'format'].forEach((key) => {
      expect(arbre.root.findAll((/** @type {any} */ n) => n.props.testID === `tournament-essentials-${key}` && typeof n.type === 'string')).toHaveLength(1);
    });
    const lieu = arbre.root.find((/** @type {any} */ n) => n.props.testID === 'tournament-essentials-place' && typeof n.type === 'string');
    expect(lieu.findAllByType(Itineraire)).toHaveLength(1);
    act(() => arbre.update(<TournamentEssentials items={[]} />));
    expect(arbre.toJSON()).toBeNull();
    act(() => arbre.unmount());
  });
});
