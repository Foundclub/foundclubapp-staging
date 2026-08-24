import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import AppUpdateRequiredScreen from '@/views/appUpdate/AppUpdateRequiredScreen';

// S09 — l'ecran lui-meme : ce qu'il dit, et les deux portes qu'il ouvre.
// R3 y ajoute l'habillage du pack : pastille de version, nouveautes, et le
// message « store injoignable ».
//
// 🔒 Le second bouton n'est pas une politesse : un ecran bloquant sans moyen de
// joindre quelqu'un transforme un incident de version en desinstallation.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ _cle, /** @type {any} */ repli, /** @type {any} */ options) => {
      if (typeof repli === 'string') return repli;
      const source = (repli && typeof repli === 'object') ? repli : (options || {});
      // Le vrai i18next remplace TOUS les jetons `{{x}}` par l'option de meme
      // nom. La doublure fait pareil, sinon un libelle a trou passerait vert.
      return String(source.defaultValue || '').replace(
        /\{\{(\w+)\}\}/g,
        (_motif, /** @type {string} */ nom) => String(source[nom] ?? ''),
      );
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
      Images: { check: 2, logo: 1 },
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
//
// ⚖️ Le pack (planche A) dessine « une seule sortie : le store ». On garde
// pourtant ce second bouton, et ce temoin existe pour que le choix reste
// VISIBLE : le supprimer fera echouer ce test, pas passer inapercu.
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

test('l\'ecran explique la raison du blocage et rassure sur les donnees', () => {
  const arbre = rendre({
    contactUrl: 'https://foundclub.app',
    currentVersion: '2.6.7',
    minimumVersion: '2.6.9',
    storeUrl: 'https://play.example/fc',
  });

  const texte = JSON.stringify(arbre.toJSON());

  expect(texte).toContain('Une mise à jour est disponible');
  expect(texte).toContain('Télécharge la nouvelle version de FoundClub');
  // 🔒 Sans cette phrase, une mise a jour forcee ressemble a une perte de compte.
  expect(texte).toContain('Tes données et ton compte sont intacts');
});

// ---------------------------------------------------------------------------
// R3 — LA PASTILLE DE VERSION (planche A). Sans elle, l'ecran ressemble a une
// panne de l'app plutot qu'a une version depassee.
// ---------------------------------------------------------------------------

test('la pastille dit la version exigee ET celle installee', () => {
  const arbre = rendre({
    currentVersion: '3.0.1',
    minimumVersion: '3.2.0',
    storeUrl: 'https://play.example/fc',
  });

  const texte = JSON.stringify(arbre.toJSON());

  expect(texte).toContain('Version 3.2.0 requise · tu es en 3.0.1');
  // Aucun jeton de libelle ne doit rester a l'ecran.
  expect(texte).not.toContain('{{');
});

test('une seule version connue : on retombe sur la ligne simple, jamais un trou', () => {
  const arbre = rendre({ minimumVersion: '3.2.0', storeUrl: 'https://play.example/fc' });

  const texte = JSON.stringify(arbre.toJSON());

  expect(texte).toContain('Version demandée : 3.2.0');
  expect(texte).not.toContain('{{');
});

test('aucune version connue : aucune pastille', () => {
  const arbre = rendre({ storeUrl: 'https://play.example/fc' });

  const texte = JSON.stringify(arbre.toJSON());

  expect(texte).not.toContain('requise');
  expect(texte).not.toContain('Version demandée');
});

// ---------------------------------------------------------------------------
// R3 — LES NOUVEAUTES (planche B). « S'il est vide, l'ecran A s'affiche tel
// quel — jamais de carte vide. »
// ---------------------------------------------------------------------------

test('les nouveautes recues s\'affichent sous un intitule', () => {
  const arbre = rendre({
    releaseNotes: ['Paiement en plusieurs fois', 'Notifications plus fiables'],
    storeUrl: 'https://play.example/fc',
  });

  const texte = JSON.stringify(arbre.toJSON());

  expect(texte).toContain('Dans cette version');
  expect(texte).toContain('Paiement en plusieurs fois');
  expect(texte).toContain('Notifications plus fiables');
});

test.each([
  ['aucune nouveaute', []],
  ['champ absent', undefined],
  ['valeur qui n\'est pas un tableau', 'Paiement'],
  ['lignes vides seulement', ['', '   ']],
])('%s : AUCUNE carte n\'est dessinee', (_libelle, notes) => {
  const arbre = rendre({ releaseNotes: notes, storeUrl: 'https://play.example/fc' });

  expect(JSON.stringify(arbre.toJSON())).not.toContain('Dans cette version');
});

// ---------------------------------------------------------------------------
// R3 — 🏪 STORE INJOIGNABLE. Le pack : « un message factuel s'affiche sous le
// bouton — pas de toast, l'ecran est deja minimal ».
// ---------------------------------------------------------------------------

test('store injoignable : le message remplace l\'avis de redirection', async () => {
  const arbre = rendre({
    contactUrl: 'https://foundclub.app',
    onOpenUrl: () => Promise.reject(new Error('no activity found')),
    storeUrl: 'https://play.example/fc',
  });

  expect(JSON.stringify(arbre.toJSON())).toContain('Tu seras redirigé·e vers');

  await act(async () => {
    await trouverBouton(arbre, 'Mettre à jour').props.onPress();
  });

  const texte = JSON.stringify(arbre.toJSON());
  expect(texte).toContain("Impossible d'ouvrir le store. Réessaie.");
  // 🔒 Les deux sorties restent la : un echec d'ouverture ne doit pas murer l'ecran.
  expect(trouverBouton(arbre, 'Mettre à jour')).toBeTruthy();
  expect(trouverBouton(arbre, 'Un problème ? Nous contacter')).toBeTruthy();
});

test('ouverture reussie : aucun message d\'echec', async () => {
  const arbre = rendre({
    onOpenUrl: () => Promise.resolve(),
    storeUrl: 'https://play.example/fc',
  });

  await act(async () => {
    await trouverBouton(arbre, 'Mettre à jour').props.onPress();
  });

  expect(JSON.stringify(arbre.toJSON())).not.toContain("Impossible d'ouvrir le store");
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
