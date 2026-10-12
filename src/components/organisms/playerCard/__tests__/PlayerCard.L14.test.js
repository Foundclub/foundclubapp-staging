// @ts-nocheck
/**
 * PAR-L14 — les defauts de la carte vus sur l'iPhone d'Adel (12/10), un temoin
 * par defaut. Chacun etait ROUGE sur staging 09ac9a67 avant sa correction.
 * Ce que la carte doit continuer de montrer est garde a part, dans
 * PlayerCard.caracterisation.test.js.
 *
 * La carte est dessinee sur 992 x 1262 puis reduite a la largeur de l'ecran :
 * les tailles se lisent donc EN TAILLE AFFICHEE (style rendu), a la largeur
 * d'un iPhone SE (375 - 2 x 24 de marge = 327).
 */
import { createElement } from 'react';
import { Image, StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PlayerCard from '../PlayerCard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (...args) => jest.requireActual('i18next').t(...args) }),
}));

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

const SE = 327;
const PHOTO = { uri: 'https://cdn.foundclub.test/avatar-karim.jpg' };

const COMPLETE = {
  age: '26 ANS',
  club: 'Aix-Perd en Buvette',
  historique: [
    {
      categorie: 'Départemental 2', club: 'Stade Marseillais Université Club', periode: '2024–Auj.',
    },
    {
      categorie: 'Régional 1 · Seniors, U20',
      club: 'Sporting Club Montredon Bonneveine',
      periode: '2020–2022',
    },
  ],
  nationalite: 'Française',
  nom: 'TESTEUR',
  numero: '52',
  photo: PHOTO,
  poste: 'Milieu',
  prenom: 'Karim',
  qrValue: 'https://foundclub.app/install.html?type=player&id=demo&source=card',
  rarity: 'RARE',
  sport: 'Football',
  statut: 'DISPONIBLE',
  ville: 'Marseille',
};

const monter = (props, width = SE) => {
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(PlayerCard, { ...props, width }));
  });
  return arbre;
};

const style = (noeud) => StyleSheet.flatten(noeud.props.style) || {};

// Le premier ancetre RENDU (View, Text...) qui satisfait `condition`.
const ancetre = (noeud, condition) => {
  let courant = noeud.parent;
  while (courant) {
    if (typeof courant.type === 'string' && condition(courant)) return courant;
    courant = courant.parent;
  }
  return null;
};

const texte = (arbre, valeur) => arbre.root.findAll((n) => (
  n.type === 'Text' && [].concat(n.props.children).join('') === valeur
));

// Opacite d'une couleur CSS / RN (#rrggbb, rgb(), rgba()).
const opacite = (couleur) => {
  const rgba = /rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/.exec(String(couleur));
  return rgba ? Number(rgba[1]) : 1;
};

describe('PAR-L14 point 1 — le portrait tient dans son cadre, le tableau est opaque', () => {
  it('le cadre de la photo ne deborde ni en haut, ni a droite, ni sous le bloc identite', () => {
    const arbre = monter(COMPLETE);
    const [photo] = arbre.root.findAllByType(Image).filter((n) => n.props.source === PHOTO);

    const cadre = ancetre(photo, (n) => style(n).position === 'absolute');
    const bloc = ancetre(cadre, (n) => typeof style(n).height === 'number');
    const c = style(cadre);

    expect(c.top).toBeGreaterThanOrEqual(0);
    expect(c.right).toBeGreaterThanOrEqual(0);
    expect(c.top + c.height).toBeLessThanOrEqual(style(bloc).height);
  });

  it('le tableau et l historique ont un fond opaque (la photo ne passe plus dessous)', () => {
    const arbre = monter(COMPLETE);

    const [club] = texte(arbre, 'CLUB');
    const [historique] = texte(arbre, 'HISTORIQUE SPORTIF');
    const panneau = (n) => ancetre(n, (a) => style(a).backgroundColor !== undefined);

    expect(opacite(style(panneau(club)).backgroundColor)).toBe(1);
    expect(opacite(style(panneau(historique)).backgroundColor)).toBe(1);
  });
});
