// @ts-nocheck
/**
 * PAR-L14 (E6) — PlayerCard.js n'avait AUCUN test qui le rende : les deux
 * temoins qui l'importent le remplacent par une doublure. Ce fichier fige ce que
 * la carte MONTRE avant la reparation de l'ecran « Ma carte de collection » :
 *  - la carte complete d'un adulte (photo, tableau, historique, code QR) ;
 *  - la carte VERROUILLEE d'un 13-14 ans (dos de maillot, voile, pas de QR) ;
 *  - la carte sans historique.
 *
 * Il ne decrit que des choses qui doivent SURVIVRE a la reparation : quels
 * textes, quelles donnees, quel garde-fou. Les defauts (taille des textes,
 * portrait en debord, rangees vides, transparence) ont leurs propres temoins
 * dans PlayerCard.L14.test.js.
 */
import i18next from 'i18next';
import { createElement } from 'react';
import { Image } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BackJerseyFallback from '../BackJerseyFallback';
import PlayerCard from '../PlayerCard';

// La vraie fr.js (demarree par jest.setup.js) : les libelles sont ceux de l'app.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (...args) => jest.requireActual('i18next').t(...args) }),
}));

// SVG : des boites vides suffisent, le texte SVG (flocage du maillot, mini-terrain)
// n'est pas un <Text> React Native et n'est pas lu ici.
jest.mock('react-native-svg', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  const doublures = {
    Boite({ children }) {
      return reactActuel.createElement(VueRN, null, children);
    },
    TexteSvg() {
      return null;
    },
  };
  const { Boite } = doublures;
  return {
    __esModule: true,
    Circle: Boite,
    default: Boite,
    Defs: Boite,
    Ellipse: Boite,
    G: Boite,
    Line: Boite,
    LinearGradient: Boite,
    Path: Boite,
    Polygon: Boite,
    RadialGradient: Boite,
    Rect: Boite,
    Stop: Boite,
    Text: doublures.TexteSvg,
  };
});

jest.mock('react-native-linear-gradient', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return ({ children }) => reactActuel.createElement(VueRN, null, children);
});

jest.mock('react-native-qrcode-svg', () => function QRCodeDoublure() {
  return null;
});

// La doublure ci-dessus, pour la retrouver dans l'arbre rendu.
const QRCode = require('react-native-qrcode-svg');

const PHOTO = { uri: 'https://cdn.foundclub.test/avatar-adel.jpg' };
const QR = 'https://foundclub.app/install.html?type=player&id=demo&source=card';

const ADULTE = {
  age: '26 ANS',
  club: 'Aix-Perd en Buvette',
  historique: [
    {
      categorie: 'Départemental 2', club: 'Stade Marseillais Université Club', periode: '2024–Auj.',
    },
    { categorie: 'Régional 1', club: 'Sporting Club Montredon Bonneveine', periode: '2020–2022' },
    { categorie: 'U19', club: 'ES Pennes Mirabeau', periode: '2016–2019' },
  ],
  nationalite: 'Française',
  nom: 'FERCHICHI',
  numero: '52',
  photo: PHOTO,
  poste: 'Milieu',
  prenom: 'Adel',
  qrValue: QR,
  rarity: 'RARE',
  sport: 'Football',
  statut: 'DISPONIBLE',
  ville: 'Marseille',
};

/** Carte d'un 13-14 ans sans accord : le modele retire la photo, l'ecran verrouille. */
const VERROUILLEE = {
  ...ADULTE,
  age: '14 ANS',
  historique: [],
  locked: true,
  nom: 'BENALI',
  numero: '7',
  photo: undefined,
  prenom: 'Sami',
};

// Monte la carte a la largeur donnee (327 = iPhone SE : 375 - 2 x 24 de marge).
const monter = (props, width = 327) => {
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(PlayerCard, { ...props, width }));
  });
  return arbre;
};

// Tous les textes React Native rendus, dans l'ordre.
const textes = (arbre) => arbre.root
  .findAll((n) => n.type === 'Text')
  .map((n) => [].concat(n.props.children).join(''));

describe('PAR-L14 — caracterisation de la carte (ce qui doit survivre)', () => {
  beforeAll(() => {
    expect(i18next.isInitialized).toBe(true);
  });

  it('carte d adulte : identite, sport, tableau et statut', () => {
    const lus = textes(monter(ADULTE));

    expect(lus).toEqual(expect.arrayContaining([
      '52', 'ADEL', 'FERCHICHI', 'FOOTBALL', 'RARE',
      'ÂGE', '26 ANS', 'CLUB', 'AIX-PERD EN BUVETTE', 'STATUT', 'DISPONIBLE',
      'POSTE', 'MILIEU', 'NATIONALITÉ', 'FRANÇAISE', 'VILLE', 'MARSEILLE',
    ]));
  });

  it('carte d adulte : l historique montre ses clubs, ses periodes et son titre', () => {
    const lus = textes(monter(ADULTE)).join(' | ');

    expect(lus).toContain('HISTORIQUE SPORTIF');
    expect(lus).toContain('STADE MARSEILLAIS UNIVERSITÉ CLUB');
    expect(lus).toContain('SPORTING CLUB MONTREDON BONNEVEINE');
    expect(lus).toMatch(/2024–AUJ\./i);
    expect(lus).toContain('2020–2022');
    expect(lus).toMatch(/Régional 1/i);
  });

  it('carte d adulte : la photo est montree et le code QR porte le lien', () => {
    const arbre = monter(ADULTE);

    const photos = arbre.root.findAllByType(Image).filter((n) => n.props.source === PHOTO);
    expect(photos).toHaveLength(1);
    expect(arbre.root.findAllByType(BackJerseyFallback)).toHaveLength(0);

    const qr = arbre.root.findAllByType(QRCode);
    expect(qr).toHaveLength(1);
    expect(qr[0].props.value).toBe(QR);
    expect(textes(arbre)).not.toContain('APERÇU — ACCORD PARENTAL REQUIS');
  });

  it('carte verrouillee d un 13-14 ans : dos de maillot, voile, et JAMAIS de code QR', () => {
    const arbre = monter(VERROUILLEE);

    const dos = arbre.root.findAllByType(BackJerseyFallback);
    expect(dos).toHaveLength(1);
    expect(dos[0].props).toMatchObject({ name: 'BENALI', number: '7' });
    expect(arbre.root.findAllByType(Image).filter((n) => n.props.source === PHOTO)).toHaveLength(0);
    expect(arbre.root.findAllByType(QRCode)).toHaveLength(0);
    expect(textes(arbre)).toContain('APERÇU — ACCORD PARENTAL REQUIS');
    expect(textes(arbre)).toEqual(expect.arrayContaining(['7', 'SAMI', 'BENALI']));
  });

  it('carte sans historique : « parcours a completer », sans compteur de clubs', () => {
    const lus = textes(monter({
      ...ADULTE, historique: [], historiqueEmptyLabel: 'Parcours à compléter',
    }));

    expect(lus).toContain('PARCOURS À COMPLÉTER');
    expect(lus.join(' ')).not.toMatch(/\d+ CLUBS?\b/);
  });

  it('sans sport renseigne, pas de pastille « — » (moignon retire en FINITIONS)', () => {
    const lus = textes(monter({ ...ADULTE, sport: '' }));

    expect(lus).not.toContain('FOOTBALL');
    expect(lus).not.toContain('—');
  });

  it('indisponible : le statut le dit', () => {
    expect(textes(monter({ ...ADULTE, statut: 'INDISPONIBLE' }))).toContain('INDISPONIBLE');
  });
});
