// @ts-nocheck
/**
 * CARTECODE (26/10/2026) — la carte v2, direction C « Terrain » (planche validée, Q9 C).
 * Ce que la carte MONTRE, et ce qu'elle tait : à l'écran ce qui manque se voit, dans l'image
 * partagée il disparaît ; une case non fournie n'existe pas (enfant : ni taille ni poids) ;
 * carte verrouillée : dos de maillot, aucun code QR ; aucun or.
 */
import i18next from 'i18next';
import { createElement } from 'react';
import { Image } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BackJerseyFallback from '../BackJerseyFallback';
import PlayerCard, {
  CardLogo,
  normalizeRarity,
  RARITY_LOOKS,
  RARITY_THEME,
  ticketPath,
} from '../PlayerCard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (...args) => jest.requireActual('i18next').t(...args) }),
}));

jest.mock('react-native-svg', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  const Boite = ({ children }) => reactActuel.createElement(VueRN, null, children);
  const TexteSvg = ({ children }) => reactActuel.createElement('SvgText', null, children);
  return new Proxy(
    { __esModule: true, default: Boite, Text: TexteSvg },
    {
      get: (cible, cle) => (cle in cible ? cible[cle] : Boite),
    },
  );
});

jest.mock('react-native-linear-gradient', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return ({ children }) => reactActuel.createElement(VueRN, null, children);
});

jest.mock(
  'react-native-qrcode-svg',
  () => function QRCodeDoublure() {
    return null;
  },
);

const QRCode = require('react-native-qrcode-svg');

const ADULTE = {
  age: '26 ANS',
  categorie: 'Sénior',
  club: 'Aix-Perd en Buvette',
  clubLogoUrl: 'https://cdn.test/aix.png',
  equipe: 'Séniors B',
  historique: [
    { club: 'SMUC', logoUrl: 'https://cdn.test/smuc.png', periode: '2024–Auj.' },
    { club: 'SC Montredon', logoUrl: null, periode: '2020–2022' },
  ],
  nationalite: 'France',
  niveau: 'Dép. 2',
  nom: 'Ferchichi',
  numero: '9',
  photo: { uri: 'https://cdn.test/adel.jpg' },
  poids: '74 KG',
  poste: 'Attaquant',
  prenom: 'Adel',
  qrLabel: 'mon profil',
  qrValue: 'https://foundclub.app/install.html?id=u162',
  rarity: 'EPIC',
  section: 'Masculine',
  sport: 'Football',
  statut: 'DISPONIBLE',
  taille: '1,78 M',
  ville: 'Aix-en-Provence 13090',
};

const monter = (props, width = 342) => {
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(PlayerCard, { ...props, width }));
  });
  return arbre;
};
const lire = (n) => [].concat(n.props.children).join('');
const textes = (arbre) => arbre.root.findAll((n) => n.type === 'Text').map(lire);
const svgTextes = (arbre) => arbre.root.findAll((n) => n.type === 'SvgText').map(lire);

describe('CARTECODE — la carte v2 « Terrain »', () => {
  beforeAll(() => expect(i18next.isInitialized).toBe(true));

  it('identité, club et équipe, 6 cases, parcours, ville, statut', () => {
    const lus = textes(monter(ADULTE));
    expect(lus).toEqual(
      expect.arrayContaining([
        'ADEL',
        'FERCHICHI',
        'FOOTBALL · ATTAQUANT',
        'Masculine',
        'ÉPIQUE',
        'AIX-PERD EN BUVETTE',
        'Séniors B',
        'ÂGE',
        '26 ANS',
        'TAILLE',
        '1,78 M',
        'POIDS',
        '74 KG',
        'NIVEAU',
        'DÉP. 2',
        'CATÉGORIE',
        'SÉNIOR',
        'NATION.',
        'FRANCE',
        'PARCOURS',
        '2024–Auj.',
        '2020–2022',
        'VILLE',
        'Aix-en-Provence 13090',
        'DISPONIBLE',
        'mon profil',
      ]),
    );
  });

  it('le grand numéro est dessiné en contour, et le code QR porte le lien', () => {
    const arbre = monter(ADULTE);
    expect(svgTextes(arbre)).toContain('9');
    expect(arbre.root.findByType(QRCode).props.value).toBe(ADULTE.qrValue);
  });

  it('les logos : l’image du club, sinon le shield FoundClub aux initiales', () => {
    const arbre = monter(ADULTE);
    const logos = arbre.root.findAllByType(CardLogo).map((n) => n.props.uri);
    expect(logos).toEqual(['https://cdn.test/aix.png', 'https://cdn.test/smuc.png', null]);
    expect(textes(arbre)).toContain('SM'); // « SC Montredon » sans logo : shield aux initiales
  });

  it('à l’écran, ce qui manque se voit ; dans l’image partagée, il disparaît', () => {
    const incomplet = {
      ...ADULTE,
      numero: '',
      photo: undefined,
      poids: '',
      taille: '',
      ville: '',
    };
    const ecran = textes(monter({ ...incomplet, mode: 'ecran' }));
    expect(ecran).toEqual(
      expect.arrayContaining(['+ à compléter', '+ N°', '+ PHOTO', 'TAILLE', 'POIDS']),
    );
    const image = textes(monter(incomplet));
    expect(image).not.toContain('+ à compléter');
    expect(image).not.toContain('TAILLE');
    expect(image).not.toContain('+ N°');
  });

  it('une case non fournie n’existe pas (enfant : ni taille ni poids)', () => {
    const { poids, taille, ...enfant } = ADULTE;
    const lus = textes(monter({ ...enfant, mode: 'ecran' }));
    expect(lus).not.toContain('TAILLE');
    expect(lus).not.toContain('POIDS');
  });

  it('verrouillée : dos de maillot, aucune photo, aucun code QR (case « FC »)', () => {
    const arbre = monter({ ...ADULTE, locked: true });
    expect(arbre.root.findAllByType(BackJerseyFallback)).toHaveLength(1);
    expect(arbre.root.findAllByType(QRCode)).toHaveLength(0);
    expect(
      arbre.root.findAll((n) => n.type === Image && n.props.source === ADULTE.photo),
    ).toHaveLength(0);
    expect(textes(arbre)).toContain('FC');
  });

  it('sans statut (fiche d’enfant) : ni DISPONIBLE ni INDISPONIBLE', () => {
    const lus = textes(monter({ ...ADULTE, statut: null }));
    expect(lus).not.toContain('DISPONIBLE');
    expect(lus).not.toContain('INDISPONIBLE');
  });

  it('4 raretés ; « ultra » et « most rare » deviennent légendaire ; aucun or', () => {
    expect(
      ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MOST_RARE', 'ULTRA_RARE', 'x'].map(normalizeRarity),
    ).toEqual(['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'LEGENDARY', 'LEGENDARY', 'COMMON']);
    const couleurs = JSON.stringify([RARITY_LOOKS, RARITY_THEME]).toLowerCase();
    expect(couleurs).not.toContain('f5b301');
    expect(textes(monter({ ...ADULTE, rarity: 'LEGENDARY' }))).toContain('LÉGENDAIRE');
  });

  it('le billet a deux encoches à 82 % de la hauteur', () => {
    expect(ticketPath(0, 44, 34)).toContain('V1001 A34,34 0 0 0 992,1069');
  });
});
