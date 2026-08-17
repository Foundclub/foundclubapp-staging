import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import AppUpdateRequiredScreen from '@/views/appUpdate/AppUpdateRequiredScreen';

// S09 — l'ecran lui-meme : ce qu'il dit, et les deux portes qu'il ouvre.
//
// 🔒 Le second bouton n'est pas une politesse : un ecran bloquant sans moyen de
// joindre quelqu'un transforme un incident de version en desinstallation.

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
      Images: { logo: 1 },
      Spaces: espaces,
    }),
  };
});

/**
 * Monte l'ecran avec le jeu de props du scenario.
 * @param {Record<string, unknown>} [props]
 * @returns {import('react-test-renderer').ReactTestRenderer} L'arbre rendu.
 */
const rendre = (props = {}) => {
  let arbre;
  act(() => {
    // `createElement` plutot que du JSX : etaler les props en JSX est interdit
    // par la porte lint, et chaque test a un jeu de props different.
    arbre = renderer.create(createElement(AppUpdateRequiredScreen, props));
  });
  return arbre;
};

// `findAll` remonte aussi les composants composites : on ne garde que les
// elements natifs, sinon chaque bouton compte plusieurs fois.
const boutons = (arbre) => arbre.root.findAll(
  (noeud) => noeud.props?.accessibilityRole === 'button' && typeof noeud.type === 'string',
);

// Celui qui porte reellement `onPress` est le composite, pas l'element natif.
const trouverBouton = (arbre, libelle) => arbre.root.find(
  (noeud) => noeud.props?.accessibilityLabel === libelle
    && typeof noeud.props?.onPress === 'function',
);

// ---------------------------------------------------------------------------
// TEMOIN 6 — le bouton mene a la boutique de LA plateforme du telephone.
// ---------------------------------------------------------------------------

test('le bouton de mise a jour ouvre l\'adresse de boutique recue', () => {
  const ouvertures = [];
  const arbre = rendre({
    contactUrl: 'https://foundclub.app',
    onOpenUrl: (url) => ouvertures.push(url),
    storeUrl: 'https://play.google.com/store/apps/details?id=com.foundclub',
  });

  act(() => {
    trouverBouton(arbre, 'Mettre à jour').props.onPress();
  });

  expect(ouvertures).toEqual(['https://play.google.com/store/apps/details?id=com.foundclub']);
});

// ---------------------------------------------------------------------------
// L'ISSUE DE SECOURS — jamais de cul-de-sac.
// ---------------------------------------------------------------------------

test('un second bouton mene au contact', () => {
  const ouvertures = [];
  const arbre = rendre({
    contactUrl: 'https://foundclub.app',
    onOpenUrl: (url) => ouvertures.push(url),
    storeUrl: 'https://apple.example/fc',
  });

  act(() => {
    trouverBouton(arbre, 'Un problème ? Nous contacter').props.onPress();
  });

  expect(ouvertures).toEqual(['https://foundclub.app']);
});

// ---------------------------------------------------------------------------
// L'ECRAN DIT POURQUOI — pas seulement « mettez a jour ».
// ---------------------------------------------------------------------------

test('l\'ecran explique la raison du blocage', () => {
  const arbre = rendre({
    contactUrl: 'https://foundclub.app',
    currentVersion: '2.6.7',
    minimumVersion: '2.6.9',
    storeUrl: 'https://play.example/fc',
  });

  const texte = JSON.stringify(arbre.toJSON());

  expect(texte).toContain('Des corrections importantes sont arrivées depuis');
  expect(texte).toContain('Tes données et ton compte sont intacts');
  expect(texte).toContain('Version installée : 2.6.7');
  expect(texte).toContain('Version demandée : 2.6.9');
});

// ---------------------------------------------------------------------------
// ♿ ACCESSIBILITE — les deux actions s'annoncent comme des boutons.
// ---------------------------------------------------------------------------

test('les deux actions sont annoncees comme des boutons, avec un intitule', () => {
  const arbre = rendre({
    contactUrl: 'https://foundclub.app',
    storeUrl: 'https://play.example/fc',
  });

  const intitules = boutons(arbre).map((noeud) => noeud.props.accessibilityLabel);

  expect(intitules).toEqual(['Mettre à jour', 'Un problème ? Nous contacter']);
  boutons(arbre).forEach((noeud) => {
    expect(typeof noeud.props.accessibilityHint).toBe('string');
    expect(noeud.props.accessibilityHint.length).toBeGreaterThan(0);
  });
});
