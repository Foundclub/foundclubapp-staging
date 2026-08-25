import {
  Circle,
  Line,
  Path,
  Polyline,
  Rect,
  Svg,
} from 'react-native-svg';
import renderer, { act } from 'react-test-renderer';

import { colors as COULEURS } from '@/theme/colors';

import GlyphIcon from '../GlyphIcon';

// AD07 (T3 · T4 · T5 · T7) — LES SIX GLYPHES QUE PERSONNE N'AVAIT DESSINES.
//
// Constat du 2026-08-21 : les six noms reclames par les maquettes
// (`dotsVertical`, `lock`, `arrowDownToBracket`, `triangleExclamation`,
// `wifiSlash`, `chartColumn`) faisaient 0 occurrence dans tout `src/`. Aucun
// PNG n'existe pour eux et personne ne peut en dessiner : ils sont donc ecrits
// en texte avec `react-native-svg`, comme `ChatAttachmentActionIcon.js`.
//
// ⚠️ T4 est LE temoin qui compte : sans lui, six `<Svg/>` VIDES passeraient au
// vert et l'ecran n'afficherait rien du tout. Un glyphe se prouve par sa
// GEOMETRIE, jamais par le fait qu'un `Svg` sorte du rendu.

// S9, vague S — les 18 glyphes du pack « Mes cotisations » entrent dans la
// MEME liste, donc sous les MEMES quatre temoins. Un glyphe ajoute sans
// geometrie, sans couleur ou sans taille tombe au rouge ici, pas a l ecran.
const NOMS = [
  'arrowDownToBracket',
  'ban',
  'calendar',
  'calendarDays',
  'chartColumn',
  'chevronLeft',
  'chevronRight',
  'circleCheck',
  'circleInformation',
  'clock',
  'creditCard',
  'dotsVertical',
  'envelope',
  'euroCircle',
  'fileArrowUp',
  'fileCheck',
  'gift',
  'hourglass',
  'idCard',
  'landmark',
  'lock',
  'receiptAlt',
  'triangleExclamation',
  'wifiSlash',
];

// Les cinq primitives que le pont Vite du site sait rendre
// (`web/src/shims/react-native-svg.tsx`), avec les attributs SANS lesquels
// elles ne dessinent rien.
const PRIMITIVES = [
  { champs: ['r'], nom: 'Circle', type: Circle },
  { champs: ['x1', 'x2', 'y1', 'y2'], nom: 'Line', type: Line },
  { champs: ['d'], nom: 'Path', type: Path },
  { champs: ['points'], nom: 'Polyline', type: Polyline },
  { champs: ['height', 'width'], nom: 'Rect', type: Rect },
];

/**
 * Monte un glyphe et rend l'arbre de test.
 * @param {string} nom
 * @param {number} [taille]
 * @returns {any}
 */
const rendre = (nom, taille) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <GlyphIcon color={COULEURS.neutral100} name={nom} size={taille} />,
    );
  });
  return arbre;
};

/**
 * Tous les noeuds de dessin d'un arbre, avec la primitive qui les a produits.
 * @param {any} arbre
 * @returns {any[]}
 */
const noeudsDeDessin = (arbre) => PRIMITIVES.flatMap(({ champs, nom, type }) => arbre.root
  .findAllByType(type)
  .map((/** @type {any} */ noeud) => ({ champs, nom, props: noeud.props })));

describe('AD07 — GlyphIcon, les six glyphes ecrits en texte', () => {
  it('T3 — les six glyphes existent et rendent un Svg', () => {
    const sansSvg = NOMS.filter((nom) => rendre(nom).root.findAllByType(Svg).length !== 1);
    expect(sansSvg).toEqual([]);
  });

  it('T3 — un nom inconnu rend null sans jeter', () => {
    expect(() => rendre('glypheQuiNExistePas')).not.toThrow();
    expect(rendre('glypheQuiNExistePas').toJSON()).toBeNull();
  });

  it('T4 — aucun glyphe n est vide : chacun porte une geometrie reelle', () => {
    const vides = NOMS.filter((nom) => {
      const dessins = noeudsDeDessin(rendre(nom));
      return !dessins.some(({ champs, props }) => champs.every((champ) => {
        const valeur = props[champ];
        return valeur !== undefined && valeur !== null && String(valeur).trim() !== '';
      }));
    });

    expect(vides).toEqual([]);
  });

  it('T5 — la couleur passee arrive sur le trait de chaque glyphe', () => {
    const sansCouleur = NOMS.filter((nom) => {
      const dessins = noeudsDeDessin(rendre(nom));
      return !dessins.some(({ props }) => props.stroke === COULEURS.neutral100
        || props.fill === COULEURS.neutral100);
    });

    expect(sansCouleur).toEqual([]);
  });

  it('T7 — la taille par defaut est 20, et la taille demandee est respectee', () => {
    const parDefaut = NOMS.map((nom) => {
      const { props } = rendre(nom).root.findByType(Svg);
      return `${nom}:${props.height}x${props.width}`;
    });
    expect(parDefaut).toEqual(NOMS.map((nom) => `${nom}:20x20`));

    const en32 = NOMS.map((nom) => {
      const { props } = rendre(nom, 32).root.findByType(Svg);
      return `${nom}:${props.height}x${props.width}`;
    });
    expect(en32).toEqual(NOMS.map((nom) => `${nom}:32x32`));
  });
});
