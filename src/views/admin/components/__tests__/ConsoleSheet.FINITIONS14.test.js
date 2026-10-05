import renderer, { act } from 'react-test-renderer';

import ConsoleSheet from '../ConsoleSheet';

// FINITIONS14 · point 5 (T13-bis, planche 16 « Fenêtres de confirmation », état B) — « Retirer
// l'offre à 2 clubs » était un bouton rouge en CONTOUR ; la planche le veut rouge PLEIN
// (`btn-dp`), comme « Détacher » et « Retirer Karim Benali » (états C et D). Toutes ces fenêtres
// passent par ConsoleSheet : son geste principal qui RETIRE (`variant: 'Danger'`) se peint
// en plein, une fois, ici. Le second bouton (« Annuler », « Quitter ») ne change pas.

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BottomModalDouble(/** @type {any} */ props) {
    if (!props.isVisible) return null;
    return react.createElement(
      rn.View,
      null,
      props.headerComponent,
      props.children,
      props.footerComponent,
    );
  };
});
/** @type {any[]} */
const mockBoutons = [];
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    mockBoutons.push(props);
    return react.createElement(rn.Text, null, props.title || '');
  };
});

/**
 * Monte la fenêtre et rend les props du bouton qui porte ce libellé.
 * @param {any} props - Les props de la fenêtre.
 * @param {string} libelle - Le libellé du bouton.
 * @returns {any} Ses props (dernier rendu).
 */
const boutonDe = (props, libelle) => {
  mockBoutons.length = 0;
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ConsoleSheet
        onClose={() => {}}
        primary={props.primary}
        secondary={props.secondary}
        title="Couper Ville de Montrivage ?"
        visible
      />,
    );
  });
  const trouve = [...mockBoutons].reverse().find((b) => b.title === libelle);
  act(() => arbre.unmount());
  return trouve;
};

describe('FINITIONS14 · planche 16 — le geste qui retire est rouge PLEIN', () => {
  test('🚨 « Retirer l offre à 2 clubs » : variante pleine', () => {
    const bouton = boutonDe({
      primary: { label: 'Retirer l’offre à 2 clubs', onPress: () => {}, variant: 'Danger' },
      secondary: { label: 'Annuler' },
    }, 'Retirer l’offre à 2 clubs');
    expect(bouton.variant).toBe('DangerFilled');
  });

  test('🔒 un geste principal bleu reste bleu ; le second « Danger » reste en contour', () => {
    expect(boutonDe({
      primary: { label: 'Activer', onPress: () => {} },
      secondary: { label: 'Annuler' },
    }, 'Activer').variant).toBe('Primary');
    expect(boutonDe({
      primary: { label: 'Rester', onPress: () => {} },
      secondary: { label: 'Quitter', onPress: () => {}, variant: 'Danger' },
    }, 'Quitter').variant).toBe('Danger');
  });

  test('🚨 la variante pleine existe dans le thème : fond et bord rouges, texte blanc', () => {
    const couleurs = jest.requireActual('@/theme/colors').default();
    const styles = jest.requireActual('@/theme/components/buttonStyle').default(couleurs);
    expect(styles.buttonDangerFilled.backgroundColor).toBe(couleurs.error500);
    expect(styles.buttonDangerFilled.borderColor).toBe(couleurs.error500);
    expect(styles.buttonTextDangerFilled.color).toBe(couleurs.neutral00);
    // Le contour d'avant ne bouge pas (14 autres boutons s'en servent).
    expect(styles.buttonDanger.backgroundColor).toBe('transparent');
  });
});
