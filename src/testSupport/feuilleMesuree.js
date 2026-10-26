import { createElement, forwardRef, useImperativeHandle } from 'react';
import { Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// RECETTEWEB retour 5 (26/10) — LA HAUTEUR D'UNE FEUILLE EN DIMENSIONNEMENT AUTOMATIQUE.
//
// `@gorhom/bottom-sheet` 5.2.4 donne a une feuille sans snapPoints la hauteur de la zone qu'il
// MESURE : le contenu de `BottomSheetScrollView` (`onContentSizeChange`) ou la vue de
// `BottomSheetView` (`onLayout`). Tout texte rendu hors de cette zone n'est pas compte : la feuille
// est trop courte d'autant, et son bas sort de l'ecran.
//
// Usage, dans un temoin d'ecran :
//   jest.mock('@gorhom/bottom-sheet', () => (
//     jest.requireActual('@/testSupport/feuilleMesuree').gorhomQuiMesure()));
//   ... l'ecran monte avec un BottomModal double qui garde ses props, puis :
//   const mesure = mesurerLaFeuille(BottomModalReel, propsRecues);
//   expect(mesure.textesHorsMesure).toEqual([]);
// Le VRAI BottomModal (requireActual dans le temoin) est monte avec les props que l'ecran lui a
// passees. Aucun `jest` ici : hors d'un fichier de test, ESLint ne le connait pas (no-undef).
// ⚠️ Jest n'a pas de moteur de mise en page : la regle est lue dans la bibliotheque, la hauteur
// se constate sur l'iPhone et l'emulateur.

const ZONE = 'zone-mesuree';

/**
 * Doublure de `@gorhom/bottom-sheet` : la feuille garde ses reglages de taille, les deux zones
 * que la bibliotheque mesure portent la marque `zone-mesuree`.
 * @returns {Record<string, any>} Le module double.
 */
export const gorhomQuiMesure = () => {
  const zone = (/** @type {any} */ props) => createElement(
    View,
    { style: props.style, testID: ZONE },
    props.children,
  );
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: forwardRef((/** @type {any} */ props, /** @type {any} */ ref) => {
      useImperativeHandle(ref, () => ({ dismiss: () => {}, present: () => {} }));
      return createElement(View, {
        enableDynamicSizing: props.enableDynamicSizing,
        snapPoints: props.snapPoints,
        testID: 'feuille-mesuree',
      }, props.children);
    }),
    BottomSheetScrollView: zone,
    BottomSheetView: zone,
    useBottomSheetInternal: () => null, // CLAVREGLE : lu par BottomModal
  };
};

/**
 * Le texte d'un noeud `Text`, enfants imbriques compris.
 * @param {any} enfants Les enfants du noeud.
 * @returns {string} Le texte a plat.
 */
const aPlat = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aPlat).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aPlat(enfants?.props?.children);
  return String(enfants);
};

/**
 * Les textes d'un element monte seul (l'en-tete d'une feuille, par exemple).
 * @param {any} element L'element.
 * @returns {string[]} Ses textes.
 */
export const textesDe = (element) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(element);
  });
  const textes = arbre.root.findAllByType(Text)
    .map((/** @type {any} */ n) => aPlat(n.props.children));
  act(() => arbre.unmount());
  return textes.filter(Boolean);
};

/**
 * Monte le VRAI BottomModal, ouvert, avec les props qu'un ecran lui a passees.
 * @param {any} BottomModal Le vrai composant (`jest.requireActual` dans le temoin).
 * @param {Record<string, any>} props Les props recues par la doublure de l'ecran.
 * @returns {{ dynamique: boolean, textesDansLaMesure: string[], textesHorsMesure: string[] }}
 *   Le mode de la feuille, et ses textes dans et hors de la zone mesuree.
 */
export const mesurerLaFeuille = (BottomModal, props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(BottomModal, { ...props, isVisible: true }));
  });
  const zones = arbre.root.findAllByProps({ testID: ZONE })
    .filter((/** @type {any} */ n) => typeof n.type === 'string');
  const dansUneZone = (/** @type {any} */ noeud) => {
    for (let n = noeud; n; n = n.parent) if (zones.includes(n)) return true;
    return false;
  };
  const dans = [];
  const hors = [];
  arbre.root.findAllByType(Text).forEach((/** @type {any} */ n) => {
    const texte = aPlat(n.props.children);
    if (texte) (dansUneZone(n) ? dans : hors).push(texte);
  });
  const feuille = arbre.root.findAllByProps({ testID: 'feuille-mesuree' }).pop();
  const dynamique = Boolean(feuille?.props.enableDynamicSizing);
  act(() => arbre.unmount());
  return { dynamique, textesDansLaMesure: dans, textesHorsMesure: hors };
};
