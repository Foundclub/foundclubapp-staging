import { createElement } from 'react';
import {
  Image, Platform, StyleSheet, Text,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '../Button';

// COL-004 (recette collectivité du 11/10, iPhone) — « Attribuer un créneau » écrit en ~4 points.
//
// 🧨 LE MÉCANISME, lu dans React Native 0.81.6 (nouvelle architecture) :
// · sur iPhone, `minimumFontScale` n'est lu par AUCUN fichier de la nouvelle architecture
//   (RCTTextLayoutManager.mm:243-246 ne connaît qu'un minimum absolu : 4 points) ;
// · NSTextStorage+FontScaling.m cherche la plus grande police qui tient en largeur ET en
//   hauteur, mais ne réduit que la police : avec un interligne FIXE (23), la hauteur ne
//   baisse jamais. Si la boîte du texte fait un rien de moins que 23 (sur un écran 3x, la
//   hauteur est la différence de deux positions arrondies au tiers de point, en flottants
//   32 bits : 22,999996 selon la place du bouton), AUCUNE taille ne tient et la police
//   tombe au minimum, 4 points.
// IPH09 (FC-010, 09/10) a retiré l'interligne fixe sur iPhone pour les boutons AVEC icône.
// Les 1 073 libellés SANS icône (carte du 12/10) gardaient le défaut. Écrit ROUGE.
//
// ⚠️ Jest vérifie le contrat de styles envoyé au natif, pas le dessin de TextKit :
// la preuve finale est une recette iPhone.

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  const theme = {
    Alignments: jest.requireActual('@/theme/alignements').default,
    ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
    Colors: couleurs,
    Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
    Images: { check: 1, plus: 2 },
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => theme };
});

const plateformeDOrigine = Platform.OS;
/** @type {any[]} */
const montes = [];
afterEach(() => {
  montes.splice(0).forEach((arbre) => act(() => arbre.unmount()));
  Platform.OS = plateformeDOrigine;
});

/**
 * Monte un bouton sur une plateforme et rend le style aplati de son libellé.
 * @param {'ios'|'android'|'web'} plateforme - La plateforme simulée.
 * @param {any} props - Les props du bouton.
 * @returns {{ arbre: any, libelle: any, noeud: any }} - L'arbre, le style aplati et le nœud Text.
 */
const monter = (plateforme, props) => {
  Platform.OS = /** @type {any} */ (plateforme);
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(Button, { onPress: jest.fn(), ...props }));
  });
  montes.push(arbre);
  const noeud = arbre.root.findByType(Text);
  return { arbre, libelle: StyleSheet.flatten(noeud.props.style), noeud };
};

// Les familles de la carte des appelants (303 fichiers, 1 154 usages) : la taille normale,
// la petite (219 usages), l'option de 44 pt (38), la largeur contrainte (158), et la police
// changée par l'appelant sans toucher l'interligne (MatchCenterScreen).
const BOUTONS_SANS_ICONE = [
  ['Attribuer un créneau (le bouton de COL-004)', { title: 'Attribuer un créneau' }, 16],
  ['petit bouton (sm)', { size: 'sm', title: 'Valider' }, 14],
  ['petit bouton (small)', { size: 'small', title: 'Valider' }, 14],
  ['option de 44 pt', { isOption: true, title: 'Voir le profil', variant: 'Secondary' }, 16],
  ['largeur contrainte', { style: { width: 120 }, title: 'Publier la convocation' }, 16],
  [
    'police changée par l appelant',
    { textStyle: { fontSize: 13, fontWeight: 'bold' }, title: 'Valider le score' },
    13,
  ],
];

describe('COL-004 — iPhone : aucun libellé de bouton n a d interligne fixe', () => {
  test.each(BOUTONS_SANS_ICONE)(
    '🔴 %s : sans icône, l interligne suit la police (plus de chute à 4 points)',
    (_nom, props, taille) => {
      const { libelle } = monter('ios', props);

      expect(libelle.lineHeight).toBeUndefined();
      expect(libelle.fontSize).toBe(taille);
    },
  );

  test('🔒 le bouton garde son remplissage centré FINITIONS', () => {
    const { libelle } = monter('ios', { title: 'Attribuer un créneau' });

    expect(libelle).toMatchObject({ flexGrow: 1, textAlign: 'center' });
    expect(libelle.flex).toBeUndefined();
  });
});

describe('COL-004 — ce qui ne bouge pas (caractérisation de l existant)', () => {
  test.each(['android', 'web'])(
    '🔒 %s : sans icône, l interligne fixe et le remplissage restent (ROLES2, FINITIONS)',
    (plateforme) => {
      const normal = monter(plateforme, { title: 'Attribuer un créneau' }).libelle;
      const petit = monter(plateforme, { size: 'sm', title: 'Valider' }).libelle;

      expect(normal).toMatchObject({
        flexGrow: 1, fontSize: 16, lineHeight: 23, textAlign: 'center',
      });
      expect(petit).toMatchObject({ fontSize: 14, lineHeight: 21 });
    },
  );

  test.each(['ios', 'android', 'web'])(
    '🔒 %s : une ligne, la police s adapte, plancher 0,7 transmis (lu par Android seul)',
    (plateforme) => {
      const { noeud } = monter(plateforme, { title: 'Attribuer un créneau' });

      expect(noeud.props).toMatchObject({
        adjustsFontSizeToFit: true, minimumFontScale: 0.7, numberOfLines: 1,
      });
    },
  );

  test('🔒 un interligne passé EXPLICITEMENT par l appelant l emporte toujours', () => {
    const { libelle } = monter('ios', { textStyle: { lineHeight: 26 }, title: 'Valider' });

    expect(libelle.lineHeight).toBe(26);
  });

  test('🔒 FC-010 inchangé : avec icône sur iPhone, remplissage et interligne libre', () => {
    const { arbre, libelle } = monter('ios', { icon: 'check', isOption: true, title: 'Accepter' });

    expect(libelle).toMatchObject({ flexGrow: 1, flexShrink: 1, textAlign: 'center' });
    expect(libelle.lineHeight).toBeUndefined();
    expect(arbre.root.findAllByType(Image)).toHaveLength(1);
  });
});
