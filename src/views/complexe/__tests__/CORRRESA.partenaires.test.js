import renderer, { act } from 'react-test-renderer';

import PartenairesDuComplexe from '@/views/complexe/components/PartenairesDuComplexe';

import { lisibles, pressable } from '@/testSupport/temoinComplexe';

// CORR-RESA (76 A, 31/10/2026) — « Ajouter un partenaire » (RA5) : « Ajouter le partenaire » reste
// gris sans logo ni nom ; leurs libellés disent « (obligatoire) ». Doublures recopiées de
// EG11.maPage.L5B2.test.js.

jest.mock('@/services/complexe/complexeQueries', () => ({
  useEnregistrerPartenaires: () => ({ isPending: false, mutateAsync: jest.fn() }),
  usePartenairesDuComplexe: () => ({ data: [], isLoading: false }),
}));
jest.mock('@/services/complexe/complexeService', () => ({
  televerserPhoto: jest.fn(),
}));
jest.mock('@/platform/media', () => ({
  __esModule: true,
  default: { pickImage: async () => ({ assets: [] }) },
}));

jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseSaisie(/** @type {any} */ {
    accessibilityLabel, label, onChangeText, value,
  }) {
    return (
      <Saisie
        accessibilityHint={label}
        accessibilityLabel={accessibilityLabel}
        onChangeText={onChangeText}
        value={value}
      />
    );
  };
});
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

/**
 * Monte le bloc et ouvre la feuille « Ajouter un partenaire ».
 * @returns {Promise<any>} L'arbre.
 */
const ouvrirLAjout = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<PartenairesDuComplexe complexeId="cx-five" />);
  });
  await act(async () => {
    pressable(arbre, 'Ajouter un partenaire').props.onPress();
  });
  return arbre;
};

describe('CORR-RESA (76 A) RA5 — les champs obligatoires le disent', () => {
  it('le logo : « Logo du partenaire (obligatoire) », lu et dit au lecteur d’écran', async () => {
    const arbre = await ouvrirLAjout();
    expect(lisibles(arbre)).toContain('Logo du partenaire (obligatoire)');
    const logo = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityLabel === 'Logo du partenaire (obligatoire)'
      && typeof n.props?.onPress === 'function'
    ));
    expect(logo.length).toBeGreaterThan(0);
  });

  it('le nom : libellé et nom du champ « Nom du partenaire (obligatoire) »', async () => {
    const arbre = await ouvrirLAjout();
    // La doublure d'`Input` rend le libellé (`label`) en `accessibilityHint`.
    const champs = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityLabel === 'Nom du partenaire (obligatoire)'
      && n.props?.accessibilityHint === 'Nom du partenaire (obligatoire)'
      && typeof n.props?.onChangeText === 'function'
    ));
    expect(champs.length).toBeGreaterThan(0);
  });

  it('le lien reste « (facultatif) »', async () => {
    const arbre = await ouvrirLAjout();
    expect(arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityHint === 'Lien vers le site du partenaire (facultatif)'
    )).length).toBeGreaterThan(0);
  });
});
