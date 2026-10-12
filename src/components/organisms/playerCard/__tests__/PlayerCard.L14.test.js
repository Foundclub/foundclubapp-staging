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

import PlayerCard, { planHistorique } from '../PlayerCard';

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

// Toutes les polices React Native rendues : [texte, taille affichee].
const polices = (arbre) => arbre.root
  .findAll((n) => n.type === 'Text')
  .map((n) => [[].concat(n.props.children).join(''), style(n).fontSize]);

const VERROUILLEE = {
  ...COMPLETE, historique: [], locked: true, nom: 'BENALI', numero: '7', photo: undefined,
};

describe('PAR-L14 point 2 — aucun texte sous 10 px a la largeur d un petit telephone', () => {
  const CAS = [
    ['carte complete', COMPLETE],
    ['carte verrouillee d un 13-14 ans', VERROUILLEE],
    ['carte sans historique', { ...COMPLETE, historique: [] }],
    ['panneau tactique (galerie)', {
      ...COMPLETE, bottomPanel: 'tactique', disposition: '4-2-3-1',
    }],
  ];
  // 327 = iPhone SE (375 - 2 x 24) ; 312 = Android de 360 dp.
  [[SE, 'iPhone SE'], [312, 'Android 360 dp']].forEach(([largeur, nom]) => {
    it.each(CAS)(`${nom} : %s`, (_cas, props) => {
      const tropPetits = polices(monter(props, largeur)).filter(([, taille]) => !(taille >= 10));

      expect(tropPetits).toEqual([]);
    });
  });

  it('nom du club sur 2 lignes si la place le permet ; saison et niveau DESSOUS', () => {
    const arbre = monter({ ...COMPLETE, historique: [COMPLETE.historique[1]] });

    const [club] = texte(arbre, 'SPORTING CLUB MONTREDON BONNEVEINE');
    expect(club.props.numberOfLines).toBe(2);
    expect(texte(arbre, '2020–2022 · Régional 1 · Seniors, U20')).toHaveLength(1);
  });
});

describe('PAR-L14 point 3 — le compteur compte des clubs, au singulier comme au pluriel', () => {
  it('il lit le total de clubs donne par l ecran, pas le nombre de lignes', () => {
    expect(texte(monter({ ...COMPLETE, historiqueTotal: 4 }), '4 CLUBS')).toHaveLength(1);
  });

  it('un seul club : « 1 CLUB »', () => {
    const arbre = monter({ ...COMPLETE, historique: [COMPLETE.historique[0]], historiqueTotal: 1 });

    expect(texte(arbre, '1 CLUB')).toHaveLength(1);
  });
});

// Ce que l'ecran envoie quand le profil ne dit rien : « — ».
const SANS_POSTE_NI_VILLE = {
  ...COMPLETE, nationalite: '—', poste: '—', ville: '—',
};

describe('PAR-L14 point 4 — les rangees vides sont retirees, l historique prend la place', () => {
  it('une rangee « — » n apprend rien : POSTE, NATIONALITÉ et VILLE disparaissent', () => {
    const arbre = monter(SANS_POSTE_NI_VILLE);

    ['POSTE', 'NATIONALITÉ', 'VILLE', '—'].forEach((absent) => {
      expect(texte(arbre, absent)).toHaveLength(0);
    });
    ['ÂGE', '26 ANS', 'CLUB', 'STATUT', 'DISPONIBLE'].forEach((present) => {
      expect(texte(arbre, present)).toHaveLength(1);
    });
  });

  it('une valeur vide compte comme absente ; la derniere rangee montree n a pas de trait', () => {
    const arbre = monter({ ...SANS_POSTE_NI_VILLE, age: '' });

    expect(texte(arbre, 'ÂGE')).toHaveLength(0);
    const [statut] = texte(arbre, 'STATUT');
    const rangee = ancetre(statut, (n) => style(n).height !== undefined);
    expect(style(rangee).borderBottomWidth).toBe(0);
  });

  // Point 4 : 3 rangees au lieu de 6 -> deux clubs sur 2 lignes (6 rangees : 1 seule).
  // Point 6 (QR a cote du tableau) : la place gagnee donne en plus 2 lignes a la
  // saison et aux categories quand il y a 3 rangees, 1 ligne avec 6.
  it('moins de rangees, plus de place : les lignes d historique s allongent', () => {
    const NOMS = ['STADE MARSEILLAIS UNIVERSITÉ CLUB', 'SPORTING CLUB MONTREDON BONNEVEINE'];
    const lignes = (props) => {
      const arbre = monter(props);
      return NOMS.map((nom) => {
        const [club] = texte(arbre, nom);
        const colonne = ancetre(club, (n) => style(n).flex === 1);
        const meta = colonne.findAll((n) => n.type === 'Text')[1];
        return [club.props.numberOfLines, meta.props.numberOfLines];
      });
    };

    expect(lignes(SANS_POSTE_NI_VILLE)).toEqual([[2, 2], [2, 2]]);
    expect(lignes(COMPLETE)).toEqual([[2, 1], [2, 1]]);
  });

  it('la place de l historique se calcule : jamais plus que la carte ne contient', () => {
    // Toujours 3 clubs (le plus de donnees), puis le nom sur 2 lignes, puis la saison.
    expect([2, 3, 4, 5, 6].map((rangees) => planHistorique(rangees, 3))).toEqual([
      { lignes: 3, lignesClub: 2, lignesMeta: 1 },
      { lignes: 3, lignesClub: 2, lignesMeta: 1 },
      { lignes: 3, lignesClub: 2, lignesMeta: 1 },
      { lignes: 3, lignesClub: 1, lignesMeta: 1 },
      { lignes: 3, lignesClub: 1, lignesMeta: 1 },
    ]);
    expect(planHistorique(3, 2)).toEqual({ lignes: 2, lignesClub: 2, lignesMeta: 2 });
    expect(planHistorique(6, 2)).toEqual({ lignes: 2, lignesClub: 2, lignesMeta: 1 });
    expect(planHistorique(6, 1)).toEqual({ lignes: 1, lignesClub: 2, lignesMeta: 2 });
    expect(planHistorique(4, 0)).toEqual({ lignes: 0, lignesClub: 1, lignesMeta: 1 });
  });
});

describe('PAR-L14 point 6 — suites de la relecture contradictoire', () => {
  it('carte verrouillee : le dos de maillot garde sa taille d avant (cadre >= 404)', () => {
    const arbre = monter(VERROUILLEE);
    const [dos] = arbre.root.findAll((n) => n.type?.name === 'BackJerseyFallback');
    const cadre = ancetre(dos, (n) => style(n).position === 'absolute');
    const c = style(cadre);

    // Le flocage (BackJerseyFallback, viewBox 100 « meet ») suit le PLUS PETIT cote du cadre.
    expect(Math.min(c.width, c.height) / (SE / 992)).toBeGreaterThanOrEqual(404);
  });

  it('un profil complet (6 rangees) montre ses 3 clubs, pas 2', () => {
    const TROIS = [
      ...COMPLETE.historique,
      { categorie: 'U19', club: 'ES Pennes Mirabeau', periode: '2016–2019' },
    ];
    const arbre = monter({ ...COMPLETE, historique: TROIS });

    expect(texte(arbre, 'ES PENNES MIRABEAU')).toHaveLength(1);
    expect(planHistorique(6, 3).lignes).toBe(3);
  });

  it('une valeur du tableau prend toute la place libre, sans plafond de 62 %', () => {
    const arbre = monter(COMPLETE);
    const [valeur] = texte(arbre, 'AIX-PERD EN BUVETTE');

    expect(style(valeur).maxWidth).toBeUndefined();
    expect(style(valeur).flexShrink).toBe(1);
  });

  it('saison, niveau et categories reunies passent sur 2 lignes quand la place le permet', () => {
    const arbre = monter(SANS_POSTE_NI_VILLE);
    const [meta] = texte(arbre, '2020–2022 · Régional 1 · Seniors, U20');

    expect(meta.props.numberOfLines).toBe(2);
  });
});
