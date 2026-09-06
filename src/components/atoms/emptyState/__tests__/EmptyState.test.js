import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';

/**
 * TEST CARACTERISANT — ecrit AVANT de toucher a `EmptyState` (regle E6).
 *
 * 🔎 POURQUOI IL EXISTE : ce composant n'avait aucun test, et son bloc JSDoc
 * etait auto-genere (`@param root0.actionLabel`, sans type ni crochets). TS lit
 * ce bloc comme « les 5 proprietes sont OBLIGATOIRES », alors que les appelants
 * du depot en omettent trois depuis toujours. Corriger le bloc est une correction
 * de documentation, mais elle touche un composant partage : ce temoin fige donc
 * le comportement REEL d'aujourd'hui, pour que la correction se prouve.
 *
 * Comportement fige : le titre s'affiche toujours ; la description, l'illustration
 * et le bouton n'apparaissent QUE si on les fournit ; et le bouton exige les DEUX
 * (libelle et action), jamais un seul.
 */

jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const genererStyle = jest.requireActual('@/theme/applicationStyle').default;
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: genererStyle(Colors),
      Colors,
      Fonts: genererPolices(Colors),
      Spaces,
    }),
  };
});

jest.mock('@/components/atoms/button/Button', () => 'Button');

/**
 * Monte l'etat vide avec les proprietes donnees.
 * @param {any} props les proprietes passees au composant
 * @returns {any} l'arbre react-test-renderer
 */
const rendre = (props) => {
  /** @type {any} */
  let arbre;
  // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
  act(() => { arbre = renderer.create(<EmptyState {...props} />); });
  return arbre;
};

/**
 * Tout le texte affiche par un arbre, mis a plat.
 * @param {any} arbre l'arbre rendu
 * @returns {string[]} les chaines reellement rendues
 */
const textes = (arbre) => {
  /** @type {string[]} */
  const sortie = [];
  /**
   * Descend dans un noeud rendu et empile chaque chaine rencontree.
   * @param {any} noeud un noeud de l'arbre rendu
   * @returns {void} rien : la sortie est empilee dans `sortie`
   */
  const parcourir = (noeud) => {
    if (typeof noeud === 'string') { sortie.push(noeud); return; }
    if (Array.isArray(noeud)) { noeud.forEach(parcourir); return; }
    if (noeud && noeud.children) noeud.children.forEach(parcourir);
  };
  parcourir(arbre.toJSON());
  return sortie;
};

describe('EmptyState — le comportement fige avant correction du JSDoc', () => {
  it('avec le TITRE SEUL, il se monte et affiche ce titre', () => {
    const arbre = rendre({ title: 'Aucun programme publie' });

    expect(textes(arbre)).toContain('Aucun programme publie');
  });

  it('n affiche la description que si on la fournit', () => {
    expect(textes(rendre({ title: 'T' }))).toEqual(['T']);
    expect(textes(rendre({ description: 'D', title: 'T' }))).toEqual(['T', 'D']);
  });

  it('n affiche AUCUN bouton tant que le libelle ET l action ne sont pas la', () => {
    expect(rendre({ title: 'T' }).root.findAllByType(Button)).toHaveLength(0);
    expect(rendre({ actionLabel: 'Choisir', title: 'T' }).root.findAllByType(Button))
      .toHaveLength(0);
    expect(rendre({ onAction: () => {}, title: 'T' }).root.findAllByType(Button))
      .toHaveLength(0);
  });

  it('affiche le bouton, avec son libelle et son action, quand les deux sont la', () => {
    const action = jest.fn();
    const boutons = rendre({ actionLabel: 'Choisir', onAction: action, title: 'T' })
      .root.findAllByType(Button);

    expect(boutons).toHaveLength(1);
    expect(boutons[0].props.title).toBe('Choisir');
    expect(boutons[0].props.onPress).toBe(action);
  });

  it('n affiche l illustration que si on la fournit', () => {
    const sansIcone = rendre({ title: 'T' });
    const avecIcone = rendre({ icon: { uri: 'https://exemple.test/i.png' }, title: 'T' });

    expect(sansIcone.root.findAllByType('Image')).toHaveLength(0);
    expect(avecIcone.root.findAllByType('Image')).toHaveLength(1);
  });
});
