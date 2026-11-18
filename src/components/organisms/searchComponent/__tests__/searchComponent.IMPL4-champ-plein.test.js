// Le VRAI i18next : les libellés viennent de `fr.js` / `en.js`, pas d'un repli.
import '@/theme/strings';

import { createElement } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SearchComponent from '../searchComponent';

// IMPL-4-ACCUEIL, page 7 (planche T-DESIGN-TOURNOI 7a-7c, Adel 18/11) — « le champ sur toute la
// largeur, les filtres dedans ». Avant : un champ souligné, et le bouton des filtres À CÔTÉ, qui
// lui prenait sa largeur. L'option `filtresDansLeChamp` (posée par la recherche seulement :
// SearchHubScreen → EventListContent / ClubListContent) met la loupe, le texte, « effacer » et
// les filtres dans une seule case bordée. Sans elle, les 7 autres listes ne changent pas.

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
    Images: { close: 2, filter: 1, search: 3 },
    Spaces: espaces,
  };
  return { __esModule: true, default: () => theme };
});

/** @type {any} */
let arbre = null;

const monter = (/** @type {Record<string, any>} */ props = {}) => {
  const ouvrir = jest.fn();
  const chercher = jest.fn();
  act(() => {
    arbre = renderer.create(createElement(SearchComponent, {
      handleSearchField: chercher,
      openFilters: ouvrir,
      placeholder: 'Rechercher un événement',
      ...props,
    }));
  });
  return { chercher, ouvrir };
};

const boutonsDeFiltre = (/** @type {jest.Mock} */ ouvrir) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.onPress === ouvrir && n.props?.accessibilityRole === 'button',
);

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  jest.useRealTimers();
});

describe('IMPL-4 page 7 — le champ de recherche pleine largeur, filtres dedans', () => {
  it('pose le champ et le bouton des filtres dans UNE case bordée', () => {
    const { ouvrir } = monter({ filtresDansLeChamp: true });
    const caseDuChamp = arbre.root.findByProps({ testID: 'champ-de-recherche' });
    const style = StyleSheet.flatten(caseDuChamp.props.style);
    expect(style.borderWidth).toBe(1);
    expect(style.borderRadius).toBe(12);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    expect(caseDuChamp.findAllByType(TextInput)).toHaveLength(1);
    const filtres = caseDuChamp.findAll(
      (/** @type {any} */ n) => n.props?.onPress === ouvrir
        && n.props?.accessibilityRole === 'button',
    );
    expect(filtres.length).toBeGreaterThan(0);
  });

  it('le bouton des filtres garde son nom, sa cible de 44 px et son geste', () => {
    const { ouvrir } = monter({ filtresDansLeChamp: true });
    const [bouton] = boutonsDeFiltre(ouvrir);
    expect(bouton.props.accessibilityLabel).toBe('Filtrer');
    const style = StyleSheet.flatten(bouton.props.style);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    act(() => bouton.props.onPress());
    expect(ouvrir).toHaveBeenCalledTimes(1);
  });

  it('dit combien de filtres sont actifs', () => {
    const { ouvrir } = monter({ filterNumber: 2, filtresDansLeChamp: true });
    expect(boutonsDeFiltre(ouvrir)[0].props.accessibilityLabel).toBe('Filtrer, 2 filtres actifs');
    const textes = arbre.root.findAll((/** @type {any} */ n) => n.props?.children === 2);
    expect(textes.length).toBeGreaterThan(0);
  });

  it('« effacer » n apparaît qu une fois du texte tapé, et vide la recherche', () => {
    const { chercher } = monter({ filtresDansLeChamp: true });
    const effacer = () => arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.accessibilityLabel === 'Effacer la recherche'
        && typeof n.props?.onPress === 'function',
    );
    expect(effacer()).toHaveLength(0);
    act(() => arbre.root.findByType(TextInput).props.onChangeText('tournoi'));
    act(() => jest.advanceTimersByTime(300));
    expect(chercher).toHaveBeenLastCalledWith('tournoi');
    expect(effacer().length).toBeGreaterThan(0);
    act(() => effacer()[0].props.onPress());
    act(() => jest.advanceTimersByTime(300));
    expect(arbre.root.findByType(TextInput).props.value).toBe('');
    expect(chercher).toHaveBeenLastCalledWith('');
  });

  it('📌 sans l option, le bouton des filtres reste à côté du champ (les 7 autres listes)', () => {
    monter();
    expect(arbre.root.findAllByProps({ testID: 'champ-de-recherche' })).toHaveLength(0);
  });
});
