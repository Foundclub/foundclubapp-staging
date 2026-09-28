import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '../Button';

// LOT ROLES2 (recette émulateur du 2026-09-28, Android 16) — « Publier la co… » :
// le bouton partagé tient son libellé sur UNE ligne (hauteur fixe de 47) et le
// coupait d'une ellipse dès qu'il manquait quelques pixels. Il rétrécit désormais
// la police (jusqu'à 70 %) avant de couper. Écrit ROUGE.

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: alignements,
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Images: {},
    Spaces: espaces,
  };
  return { __esModule: true, default: () => theme };
});

describe('ROLES2 — le libellé du bouton partagé rétrécit avant d être coupé', () => {
  it('une ligne, mais la police s adapte (au plus bas 70 %)', () => {
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(
        <Button onPress={() => {}} title="Publier la convocation" variant="Primary" />,
      );
    });
    const libelle = arbre.root.findAllByType(Text)
      .find((/** @type {any} */ noeud) => noeud.props.children === 'Publier la convocation');

    expect(libelle.props.numberOfLines).toBe(1);
    expect(libelle.props.adjustsFontSizeToFit).toBe(true);
    expect(libelle.props.minimumFontScale).toBe(0.7);
    act(() => arbre.unmount());
  });
});
