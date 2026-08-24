import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import AppUpdateRecommendedSheet from '@/views/appUpdate/AppUpdateRecommendedSheet';

// R3 — L'INVITATION QU'ON PEUT REFUSER (planche C du pack).
//
// 🟠 CE QUE CES TEMOINS PROTEGENT : que cette feuille reste DOUCE. Elle porte
// deux boutons, et le second doit toujours rendre la main. Une invitation dont
// on ne peut pas sortir est un ecran bloquant qui ne dit pas son nom.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ _cle, /** @type {any} */ repli, /** @type {any} */ options) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli === 'object') {
        return String(repli.defaultValue || '').replace('{{version}}', String(repli.version || ''));
      }
      return String(options?.defaultValue || '');
    },
  }),
}));

// 🚪 `BottomModal` appartient a un autre lot : on ne le teste pas ici, on
// verifie seulement qu'on lui parle correctement. La doublure respecte le seul
// contrat qui nous concerne — elle n'affiche rien quand `isVisible` est faux.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (props.isVisible
      ? reactActuel.createElement(VueRN, { testID: 'feuille-maj' }, props.children)
      : null),
  };
});

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: { check: 2, logo: 1 },
      Spaces: espaces,
    }),
  };
});

/**
 * Monte la feuille avec le jeu de props du scenario.
 * @param {Record<string, unknown>} [props]
 * @returns {import('react-test-renderer').ReactTestRenderer} L'arbre rendu.
 */
const rendre = (props = {}) => {
  let arbre;
  act(() => {
    // `createElement` plutot que du JSX : etaler les props en JSX est interdit
    // par la porte lint, et chaque test a un jeu de props different.
    arbre = renderer.create(createElement(AppUpdateRecommendedSheet, {
      isVisible: true,
      storeUrl: 'https://play.example/fc',
      ...props,
    }));
  });
  return arbre;
};

// Celui qui porte reellement `onPress` est le composite, pas l'element natif.
const trouverBouton = (arbre, libelle) => arbre.root.find(
  (noeud) => noeud.props?.accessibilityLabel === libelle
    && typeof noeud.props?.onPress === 'function',
);

const boutons = (arbre) => arbre.root.findAll(
  (noeud) => noeud.props?.accessibilityRole === 'button' && typeof noeud.type === 'string',
);

// ---------------------------------------------------------------------------
// LE TEMOIN DU LOT — « Plus tard » rend la main.
// ---------------------------------------------------------------------------

test('« Plus tard » referme la feuille et ne mene nulle part', () => {
  const refus = [];
  const ouvertures = [];
  const arbre = rendre({
    onLater: () => refus.push('ferme'),
    onOpenUrl: (url) => ouvertures.push(url),
  });

  act(() => {
    trouverBouton(arbre, 'Plus tard').props.onPress();
  });

  expect(refus).toEqual(['ferme']);
  // 🔒 Refuser ne doit RIEN ouvrir : ni la boutique, ni un lien.
  expect(ouvertures).toEqual([]);
});

test('le bouton de mise a jour ouvre la boutique recue', () => {
  const ouvertures = [];
  const arbre = rendre({ onOpenUrl: (url) => ouvertures.push(url) });

  act(() => {
    trouverBouton(arbre, 'Mettre à jour').props.onPress();
  });

  expect(ouvertures).toEqual(['https://play.example/fc']);
});

// ---------------------------------------------------------------------------
// ELLE NE S'AFFICHE QUE QUAND ON LE DEMANDE.
// ---------------------------------------------------------------------------

test('invisible : la feuille ne rend rien du tout', () => {
  const arbre = rendre({ isVisible: false });

  expect(arbre.toJSON()).toBeNull();
});

// ---------------------------------------------------------------------------
// CE QU'ELLE DIT (planche C).
// ---------------------------------------------------------------------------

test('elle annonce la mise a jour, sa version, et pourquoi', () => {
  const arbre = rendre({ recommendedVersion: '3.2.0' });

  const texte = JSON.stringify(arbre.toJSON());

  expect(texte).toContain('Une mise à jour est disponible');
  expect(texte).toContain('Version 3.2.0');
  expect(texte).toContain('profiter des dernières nouveautés');
});

test('sans version connue, aucune ligne de version a trou', () => {
  const arbre = rendre({ recommendedVersion: null });

  const texte = JSON.stringify(arbre.toJSON());

  expect(texte).toContain('Une mise à jour est disponible');
  expect(texte).not.toContain('Version {{version}}');
  expect(texte).not.toContain('Version </Text>');
});

// ---------------------------------------------------------------------------
// 🏪 STORE INJOIGNABLE — un message factuel, et le bouton garde son etat.
// ---------------------------------------------------------------------------

test('store injoignable : un message factuel apparait sous le bouton', async () => {
  const arbre = rendre({
    onOpenUrl: () => Promise.reject(new Error('no activity found')),
  });

  expect(JSON.stringify(arbre.toJSON())).not.toContain("Impossible d'ouvrir le store");

  await act(async () => {
    await trouverBouton(arbre, 'Mettre à jour').props.onPress();
  });

  const texte = JSON.stringify(arbre.toJSON());
  expect(texte).toContain("Impossible d'ouvrir le store. Réessaie.");
  // Le bouton reste la, et reste appuyable : le pack demande qu'il garde son etat.
  expect(trouverBouton(arbre, 'Mettre à jour')).toBeTruthy();
});

// ---------------------------------------------------------------------------
// ♿ ACCESSIBILITE — les deux actions s'annoncent comme des boutons.
// ---------------------------------------------------------------------------

test('les deux actions sont annoncees comme des boutons, avec un intitule', () => {
  const arbre = rendre();

  const intitules = boutons(arbre).map((noeud) => noeud.props.accessibilityLabel);

  expect(intitules).toEqual(['Mettre à jour', 'Plus tard']);
  boutons(arbre).forEach((noeud) => {
    expect(typeof noeud.props.accessibilityHint).toBe('string');
    expect(noeud.props.accessibilityHint.length).toBeGreaterThan(0);
  });
});
