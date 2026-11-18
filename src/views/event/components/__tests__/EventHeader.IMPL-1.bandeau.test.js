/* eslint-disable max-len -- titres de témoins en phrases, et relevés ligne à ligne */
import { ImageBackground, Text } from 'react-native';
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

// IMPL-1-FICHE (18/11/2026, pack T-DESIGN-TOURNOI, écran 6b, remarque 1 d'Adel) — le haut de la
// fiche d'un tournoi : l'image du tournoi en bandeau (celle de la carte), le nom et « Organisé par …
// · lieu court » sur le dégradé, puis les pastilles sur UNE ligne : TOURNOI (bleu), l'état, l'âge.
// « Mixte » et l'activité passent dans le format (« L'essentiel »). Plus aucun vert.

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

const texte = (/** @type {any} */ noeud) => [].concat(noeud.props.children).join('');

const monter = (/** @type {any} */ tournamentHero, event = TOURNOI) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<EventHeader event={event} tournamentHero={tournamentHero} />);
  });
  const { root } = arbre;
  const parId = (/** @type {string} */ id) => root.findAll(
    (/** @type {any} */ n) => n.props?.testID === id,
    { deep: false },
  )[0] || null;
  const bandeau = parId('event-header-tournament-banner');
  const rangee = parId('event-header-tournament-tags');
  const resultat = {
    bandeau,
    etiquettes: rangee ? rangee.findAllByType(Text).map(texte) : null,
    fond: bandeau ? bandeau.findAllByType(ImageBackground).length : 0,
    styleEtat: rangee ? JSON.stringify(rangee.findAllByType(Text).map((n) => n.props.style)) : '',
    tous: root.findAllByType(Text).map(texte),
  };
  act(() => arbre.unmount());
  return resultat;
};

describe('IMPL-1 (6b) — le bandeau du tournoi', () => {
  test('🔴 un bandeau image, le nom puis « Organisé par AR Soccer · Montpellier »', () => {
    const { bandeau, fond, tous } = monter({ statusLabel: 'Inscriptions ouvertes' });
    expect(bandeau).not.toBeNull();
    expect(fond).toBe(1);
    expect(tous.slice(0, 2)).toEqual(['FoundClub x AR Soccer', 'Organisé par AR Soccer · Montpellier']);
  });

  test('🔴 les pastilles sur une ligne : TOURNOI, l état, « Dès 16 ans » ; ni « Mixte » ni catégorie', () => {
    expect(monter({ statusLabel: 'Inscriptions ouvertes' }).etiquettes)
      .toEqual(['TOURNOI', 'Inscriptions ouvertes', 'Dès 16 ans']);
  });

  test('🔴 plus aucun vert : l état est en bleu primaire', () => {
    const { styleEtat } = monter({ statusLabel: 'Ton équipe est inscrite' });
    expect(styleEtat).toContain('couleur-primary500');
    expect(styleEtat).not.toMatch(/success/);
  });

  test('🔴 un club organisateur autre que le lieu : « Organisé par FoundClub · AR Soccer · Montpellier »', () => {
    const { tous } = monter({ statusLabel: null }, { ...TOURNOI, club: { name: 'FoundClub' } });
    expect(tous).toContain('Organisé par FoundClub · AR Soccer · Montpellier');
  });

  test('🔴 jamais « Terrain A » pour le joueur ; l organisateur garde la pastille', () => {
    const avecTerrain = { ...TOURNOI, facility: { name: 'Terrain A' } };
    expect(monter({ statusLabel: null }, avecTerrain).tous).not.toContain('Terrain A');
    expect(monter({ showFacility: true, statusLabel: null }, avecTerrain).tous).toContain('Terrain A');
  });

  test('sans bandeau demandé (autres écrans) : l en-tête d avant, sans bandeau', () => {
    const { bandeau, tous } = monter(undefined);
    expect(bandeau).toBeNull();
    expect(tous).toContain('20 € par joueur');
  });
});
