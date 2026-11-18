import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventHeader from '../EventHeader';

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);

jest.mock('@/theme/themeContext', () => {
  const vide = {};
  const rampe = () => new Proxy({}, { get: () => vide });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, { get: () => rampe() }),
      Colors: new Proxy({}, { get: (_c, cle) => `couleur-${String(cle)}` }),
      Fonts: new Proxy({}, { get: () => vide }),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

// T-PAGES-4b (18/11, chef, maquette design/DESIGN-TOURNOI-PAGES planche (b), téléphone) — le haut
// de la fiche d'un tournoi est un BANDEAU : le titre, « Organisé par … », puis les étiquettes
// « Ton équipe est inscrite / Mixte / À partir de 16 ans ». La date, le lieu et le prix vivent dans
// « L'essentiel », sous « Mon équipe » : l'en-tête ne les redit plus, et l'âge ne s'écrit qu'une
// fois (M1328).

const TOURNOI = {
  club: { name: 'AR Soccer' },
  date: '2099-12-19T18:00:00.000Z',
  documentId: 'event-1',
  location: 'AR Soccer, 119 rue de la Rauze basse, 34070 Montpellier',
  name: 'FoundClub x AR Soccer',
  startTime: '19:00:00',
  tournamentActivity: { name: 'Foot à 5' },
  tournamentCategory: { name: 'Sénior (+18 ans)' },
  tournamentConfig: { entryFeeCents: 2000, minAge: 16 },
  tournamentSection: { name: 'Mixte' },
  type: { name: 'Tournoi' },
};

const monter = (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<EventHeader event={TOURNOI} tournamentHero={props.tournamentHero} />);
  });
  const { root } = arbre;
  const texte = (/** @type {any} */ noeud) => [].concat(noeud.props.children).join('');
  const tous = root.findAllByType(Text).map(texte);
  const [rangee] = root.findAll(
    (/** @type {any} */ n) => n.props?.testID === 'event-header-tournament-tags',
    { deep: false },
  );
  const etiquettes = rangee ? rangee.findAllByType(Text).map(texte) : null;
  act(() => arbre.unmount());
  return { etiquettes, tous };
};

describe('T-PAGES-4b — le bandeau du tournoi au téléphone (maquette b)', () => {
  test('🔴 titre, « Organisé par AR Soccer · Foot à 5 », puis les 3 étiquettes de la maquette', () => {
    const statusLabel = 'Ton équipe est inscrite';
    const { etiquettes, tous } = monter({ tournamentHero: { statusLabel } });
    expect(tous.slice(0, 2))
      .toEqual(['FoundClub x AR Soccer', 'Organisé par AR Soccer · Foot à 5']);
    expect(etiquettes)
      .toEqual(['Ton équipe est inscrite', 'Mixte', 'À partir de 16 ans']);
  });

  test('🔴 l âge une seule fois ; ni date, ni lieu, ni prix (ils sont dans « L essentiel »)', () => {
    const { tous } = monter({ tournamentHero: { statusLabel: 'Inscriptions ouvertes' } });
    expect(tous.filter((ligne) => ligne.includes('16 ans'))).toHaveLength(1);
    expect(tous.some((ligne) => ligne.includes('par joueur'))).toBe(false);
    expect(tous.some((ligne) => ligne.includes('Rauze'))).toBe(false);
    expect(tous.some((ligne) => ligne.includes('19:00'))).toBe(false);
  });

  test('🔴 sans statut à dire (inscriptions closes) : Mixte et l âge seuls', () => {
    expect(monter({ tournamentHero: { statusLabel: null } }).etiquettes)
      .toEqual(['Mixte', 'À partir de 16 ans']);
  });

  test('sans bandeau demandé : le bloc d avant reste (prix, lieu), aucune étiquette', () => {
    const { etiquettes, tous } = monter({});
    expect(etiquettes).toBeNull();
    expect(tous).toContain('20 € par joueur');
    expect(tous.some((ligne) => ligne.includes('Rauze'))).toBe(true);
  });
});
