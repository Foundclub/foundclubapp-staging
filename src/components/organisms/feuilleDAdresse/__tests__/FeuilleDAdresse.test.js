import { Linking } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FeuilleDAdresse from '../FeuilleDAdresse';

// MSG1A (§3.18) — la feuille d'une adresse touchee dans le fil : les applis de cartes DU
// TELEPHONE, puis « Copier l'adresse ».

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli?.defaultValue) return repli.defaultValue.replace('{{app}}', repli.app);
      return cle;
    },
  }),
}));
// ANDROIDBAR-2 — la feuille lit la barre du bas du systeme (iPhone : 34).
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));
jest.mock('react-native-svg', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    Circle: VueRN,
    default: VueRN,
    Line: VueRN,
    Path: VueRN,
    Polyline: VueRN,
    Rect: VueRN,
    Svg: VueRN,
  };
});
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const Colors = generateColors();
  return { __esModule: true, default: () => ({ Colors }) };
});
jest.mock('@/platform/maps/externalMap', () => ({
  buildExternalMapLinks: () => ({ google: 'https://google' }),
  listExternalMapApps: () => Promise.resolve([
    { key: 'apple', url: 'https://apple' },
    { key: 'waze', url: 'waze://ici' },
  ]),
}));

/**
 * Aide du temoin : `parId`.
 * @param {any} arbre
 * @param {string} id
 * @returns {any}
 */
const parId = (arbre, id) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === id && typeof n.props?.onPress === 'function',
)[0];

describe('FeuilleDAdresse', () => {
  test(
    'F1 — les applis du telephone, puis Copier ; une appli ouvre son lien et ferme',
    async () => {
      const ouvrirUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
      const onClose = jest.fn();
      /** @type {any} */
      let arbre;
      await act(async () => {
        arbre = renderer.create(
          <FeuilleDAdresse
            adresse={{ label: '12 rue Pasteur' }}
            onClose={onClose}
            onCopy={jest.fn()}
          />,
        );
      });

      expect(parId(arbre, 'feuille-adresse-apple')).toBeTruthy();
      expect(parId(arbre, 'feuille-adresse-waze')).toBeTruthy();
      expect(parId(arbre, 'feuille-adresse-copier')).toBeTruthy();

      await act(async () => {
        parId(arbre, 'feuille-adresse-waze').props.onPress();
      });
      expect(ouvrirUrl).toHaveBeenCalledWith('waze://ici');
      expect(onClose).toHaveBeenCalled();
      ouvrirUrl.mockRestore();
    },
  );

  test('F2 — « Copier l adresse » copie le texte affiche et ferme', async () => {
    const onClose = jest.fn();
    const onCopy = jest.fn();
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <FeuilleDAdresse adresse={{ label: '12 rue Pasteur' }} onClose={onClose} onCopy={onCopy} />,
      );
    });

    act(() => {
      parId(arbre, 'feuille-adresse-copier').props.onPress();
    });
    expect(onCopy).toHaveBeenCalledWith('12 rue Pasteur');
    expect(onClose).toHaveBeenCalled();
  });

  test('F3 — sans adresse, la feuille est fermee', async () => {
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <FeuilleDAdresse adresse={null} onClose={jest.fn()} onCopy={jest.fn()} />,
      );
    });
    const modale = arbre.root.findAll((/** @type {any} */ n) => n.props?.visible !== undefined)[0];
    expect(modale.props.visible).toBe(false);
  });
});
