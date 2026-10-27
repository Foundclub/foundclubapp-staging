// @ts-nocheck
/**
 * CARTEAFF (27/10/2026) — défauts d'affichage de « Ma carte joueur » vus par Adel sur iPhone
 * (TestFlight 2.6.81). Témoins de STRUCTURE : iOS n'est pas disponible au banc, on vérifie ce
 * qui produisait chaque défaut.
 *  1/4. le shield d'un club sans logo n'avait que `absoluteFill` : sur iPhone, dessiné à sa taille
 *       native (361 pt) — la grande forme bleu clair — et le sigle restait sur fond sombre ;
 *  2.   la photo, un rectangle à bords durs sous un fondu de nom ancré au jugé (bande sombre) ;
 *  3.   le terrain dessiné dans un <Svg> imbriqué, qui étirait sur iPhone ce qui venait après
 *       (le grand numéro : traits violets 1,8 fois plus épais à l'horizontale) ;
 *  5.   la grille en largeurs fixes : un arrondi faisait passer la 3ᵉ case à la ligne ;
 *  6.   « Sénior (+18 ans) » coupé ;
 *  7.   l'image partagée sans ville : le statut seul tout en bas, un grand vide au-dessus.
 */
import { createElement } from 'react';
import { Image, StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PlayerCard, {
  CARD_EXPORT_HEIGHT, CARD_EXPORT_WIDTH, CardLogo, RARITY_LOOKS,
} from '../PlayerCard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (...args) => jest.requireActual('i18next').t(...args) }),
}));

// Chaque élément SVG devient un élément nommé (« svg:G », « svg:Svg »…) qui garde ses props.
jest.mock('react-native-svg', () => {
  const reactActuel = jest.requireActual('react');
  const fabrique = (nom) => ({ children, ...props }) => (
    reactActuel.createElement(`svg:${nom}`, props, children)
  );
  const cache = {};
  return new Proxy(
    { __esModule: true },
    {
      get: (cible, cle) => {
        if (cle === '__esModule') return true;
        const nom = cle === 'default' ? 'Racine' : String(cle);
        cache[nom] = cache[nom] || fabrique(nom);
        return cache[nom];
      },
    },
  );
});

jest.mock('react-native-linear-gradient', () => {
  const reactActuel = jest.requireActual('react');
  return ({ children, ...props }) => reactActuel.createElement('LinearGradient', props, children);
});

jest.mock('react-native-qrcode-svg', () => function QRCodeDoublure() {
  return null;
});

const ADULTE = {
  age: '26 ANS',
  categorie: 'Sénior (+18 ans)',
  club: 'Aix-Perd en Buvette',
  clubLogoUrl: 'https://cdn.test/aix.png',
  equipe: 'Aix-Perd en Buvette',
  historique: [
    { club: 'SMUC', logoUrl: 'https://cdn.test/smuc.png', periode: '2024–2025' },
    { club: 'SCM', logoUrl: null, periode: '2020–2022' },
  ],
  nationalite: 'FRA',
  niveau: 'Régional 1',
  nom: 'Ferchichi',
  numero: '9',
  photo: { uri: 'https://cdn.test/adel.jpg' },
  poids: '75 KG',
  prenom: 'Adel',
  qrLabel: 'mon profil',
  qrValue: 'https://foundclub.app/install.html?id=u162',
  rarity: 'EPIC',
  sport: 'Football',
  statut: 'DISPONIBLE',
  taille: '1,77 M',
  ville: '',
};

const monter = (props, width = 343) => {
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(PlayerCard, { ...props, width }));
  });
  return arbre;
};
const plat = (style) => StyleSheet.flatten(style) || {};
const lire = (n) => [].concat(n.props.children).join('');
const textes = (arbre) => arbre.root.findAll((n) => n.type === 'Text').map(lire);
// les vues natives (« View ») portant ce testID
const hotes = (arbre, testID) => arbre.root.findAll(
  (n) => n.props.testID === testID && typeof n.type === 'string',
);

describe('CARTEAFF — rien ne sort de la carte', () => {
  it('la racine de la carte découpe ce qui dépasse (overflow hidden, coins du billet)', () => {
    const arbre = monter(ADULTE);
    const racine = plat(arbre.root.findAll((n) => n.type === 'View')[0].props.style);
    expect(racine.overflow).toBe('hidden');
    expect(racine.borderRadius).toBeCloseTo(44 * (343 / CARD_EXPORT_WIDTH));
  });
});

describe('CARTEAFF 1 et 4 — le shield d’un club sans logo', () => {
  it('a la taille de sa case, écrite en toutes lettres (pas seulement absoluteFill)', () => {
    let arbre;
    act(() => {
      arbre = renderer.create(createElement(CardLogo, {
        accent: RARITY_LOOKS.EPIC.accent, name: 'SCM', s: 0.5, size: 64,
      }));
    });
    const image = arbre.root.findByType(Image);
    const style = plat(image.props.style);
    expect(style.width).toBe(32);
    expect(style.height).toBe(32);
    const boite = plat(arbre.root.findAll((n) => n.type === 'View')[0].props.style);
    expect(boite.overflow).toBe('hidden');
    expect(textes(arbre)).toContain('S');
  });

  it('les initiales suivent ClubLogoMark : sans les mots de liaison, 3 lettres au plus', () => {
    const sigle = (name) => {
      let arbre;
      act(() => {
        arbre = renderer.create(createElement(CardLogo, {
          accent: RARITY_LOOKS.EPIC.accent, name, s: 0.5, size: 64,
        }));
      });
      return textes(arbre)[0];
    };
    expect(sigle('Sporting Club de Marseille')).toBe('SCM');
    expect(sigle('Union Sportive de la Ville de Paris')).toBe('USV');
  });
});

describe('CARTEAFF 3 — le terrain ne déforme plus le reste du dessin', () => {
  it('aucun <Svg> imbriqué : le terrain est un groupe mis à l’échelle, découpé à la scène', () => {
    const arbre = monter(ADULTE);
    expect(arbre.root.findAll((n) => n.type === 'svg:Svg')).toHaveLength(0);
    const terrain = arbre.root.find((n) => n.type === 'svg:G' && /scale\(/.test(String(n.props.transform)));
    expect(terrain).toBeTruthy();
    const scene = arbre.root.find(
      (n) => n.type === 'svg:G' && n.props.clipPath === 'url(#cadreScene)',
    );
    // le numéro et le terrain sont dans la scène
    expect(scene.findAll((n) => n.type === 'svg:Text').map(lire)).toContain('9');
    expect(scene.findAll((n) => n === terrain)).toHaveLength(1);
  });
});

describe('CARTEAFF 2 — la photo se fond dans la carte', () => {
  it('la photo est une image du dessin, de taille écrite, fondue par un masque', () => {
    const arbre = monter(ADULTE);
    // plus d'Image RN à bords durs pour la photo
    const imagesRN = arbre.root.findAll((n) => n.type === Image && n.props.source === ADULTE.photo);
    expect(imagesRN).toHaveLength(0);
    const photo = arbre.root.find((n) => n.type === 'svg:Image');
    // une chaîne : le site passe les props SVG telles quelles au DOM
    expect(photo.props.href).toBe(ADULTE.photo.uri);
    expect(photo.props.preserveAspectRatio).toBe('xMidYMid slice');
    expect(photo.props.width).toBeGreaterThan(0);
    expect(photo.props.height).toBeGreaterThan(0);
    const masques = arbre.root.findAll((n) => n.type === 'svg:Mask').map((n) => n.props.id);
    expect(masques).toEqual(expect.arrayContaining(['fonduPhotoCotes', 'fonduPhotoBas']));
  });

  it('plus de fondu opaque posé sur la photo (la bande sombre)', () => {
    const arbre = monter(ADULTE);
    const opaques = arbre.root.findAll(
      (n) => n.type === 'LinearGradient' && (n.props.colors || []).includes('rgba(5,34,49,1)'),
    );
    expect(opaques).toHaveLength(0);
  });

  it('le fondu du nom est ancré au BAS de la scène, sur toute la largeur intérieure', () => {
    const width = 343;
    const s = width / CARD_EXPORT_WIDTH;
    const arbre = monter(ADULTE, width);
    const fondu = arbre.root.find(
      (n) => n.type === 'LinearGradient' && (n.props.colors || []).includes('rgba(2,22,32,0.92)'),
    );
    const style = plat(fondu.props.style);
    expect(style.top).toBeUndefined();
    expect(style.bottom).toBeCloseTo((CARD_EXPORT_HEIGHT - (11 + 555)) * s);
    expect(style.left).toBeCloseTo(11 * s);
    expect(style.right).toBeCloseTo(11 * s);
  });
});

describe('CARTEAFF 5 — la grille : 3 colonnes, toujours', () => {
  it('6 cases : 2 rangées de 3, cases souples (aucune largeur fixe)', () => {
    const arbre = monter(ADULTE);
    const rangees = hotes(arbre, 'carte-grille-rangee');
    expect(rangees).toHaveLength(2);
    rangees.forEach((r) => {
      expect(r.children).toHaveLength(3);
      r.children.forEach((c) => {
        const st = plat(c.props.style);
        expect(st.width).toBeUndefined();
        expect(st.flex).toBe(1);
      });
    });
  });

  it('4 cases (enfant sans taille ni poids) : la 2ᵉ rangée garde ses 3 places', () => {
    const { poids, taille, ...enfant } = ADULTE;
    const arbre = monter(enfant);
    const rangees = hotes(arbre, 'carte-grille-rangee');
    expect(rangees.map((r) => r.children.length)).toEqual([3, 3]);
  });
});

describe('CARTEAFF 6 — la catégorie tient dans sa case', () => {
  it('« Sénior (+18 ans) » s’affiche « SÉNIOR » (la précision d’âge reste au profil)', () => {
    const lus = textes(monter(ADULTE));
    expect(lus).toContain('SÉNIOR');
    expect(lus.join('|')).not.toMatch(/\+18/);
  });
});

describe('CARTEAFF 7 — l’image partagée sans ville', () => {
  const pied = (arbre) => plat(
    hotes(arbre, 'carte-pied')[0].props.style,
  );

  it('le statut se centre à côté du code QR (pas de grand vide au-dessus)', () => {
    expect(pied(monter(ADULTE)).alignItems).toBe('center');
  });

  it('avec une ville : ville et statut alignés en bas, comme la planche', () => {
    expect(pied(monter({ ...ADULTE, ville: 'Aix-en-Provence 13090' })).alignItems).toBe('flex-end');
  });
});
