import { createElement } from 'react';
import { Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AppUpdateRequiredScreen from '@/views/appUpdate/AppUpdateRequiredScreen';

// S09 — l'ecran lui-meme : ce qu'il dit, et les deux portes qu'il ouvre.
// R3 y ajoute l'habillage du pack : pastille de version, nouveautes, et le
// message « store injoignable ».
//
// 🔒 Le second bouton n'est pas une politesse : un ecran bloquant sans moyen de
// joindre quelqu'un transforme un incident de version en desinstallation.

// 🧨 CETTE DOUBLURE A DEJA MENTI UNE FOIS, ET C'EST POUR CA QU'ELLE ECHAPPE.
// Recette du 2026-08-26 sur iPhone : l'ecran affichait « vers l&#39;App Store ».
// La doublure d'alors remplacait `{{store}}` SANS echapper — plus gentille que
// la vraie bibliotheque — donc le temoin restait VERT sur l'ecran casse.
// i18next echappe les valeurs INTERPOLEES (&, ', <, >, ", /) ; la chaine source,
// elle, n'est jamais touchee. La doublure fait exactement pareil.
jest.mock('react-i18next', () => {
  /**
   * @param {unknown} valeur
   * @returns {string}
   */
  const echapper = (valeur) => String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');

  return {
    useTranslation: () => ({
      t: (/** @type {string} */ _cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        if (typeof repli === 'string') return repli;
        const source = (repli && typeof repli === 'object') ? repli : (options || {});
        return String(source.defaultValue || '').replace(
          /\{\{(\w+)\}\}/g,
          (_motif, /** @type {string} */ nom) => echapper(source[nom] ?? ''),
        );
      },
    }),
  };
});

// 📱 Un vrai iPhone a encoche : 59 px de barre systeme en haut, 34 en bas.
// C'est CE chiffre qui rend le temoin du degagement capable d'etre rouge.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
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

// ---------------------------------------------------------------------------
// R3 bis — DEUX DEFAUTS VUS SUR L'IPHONE D'ADEL LE 2026-08-26.
// ---------------------------------------------------------------------------

// ⬆️ DEFAUT 1 — le logo passait SOUS la barre d'etat : l'heure, le reseau et la
// batterie s'affichaient PAR-DESSUS. L'ecran ne demandait aucune marge de
// securite, et `Spaces.padding[24]` ne connait pas la hauteur de la barre.
test('le logo laisse un vrai degagement sous la barre systeme', () => {
  const arbre = rendre({ storeUrl: 'https://play.example/fc' });

  const defilement = arbre.root.find((noeud) => noeud.type === 'RCTScrollView');
  const styles = [defilement.props.contentContainerStyle].flat(Infinity).filter(Boolean);
  const paddingTop = styles.reduce(
    (retenu, style) => (typeof style?.paddingTop === 'number' ? style.paddingTop : retenu),
    0,
  );

  // 🔒 STRICTEMENT au-dessus de la barre : etre EGAL a 59 collerait le logo
  // juste sous l'heure, ce qui est le defaut d'a cote (S6, corrige la veille).
  expect(paddingTop).toBeGreaterThan(59);
});

test('le bas laisse passer la barre de geste du telephone', () => {
  const arbre = rendre({ contactUrl: 'https://foundclub.app', storeUrl: 'https://play.example/fc' });

  const defilement = arbre.root.find((noeud) => noeud.type === 'RCTScrollView');
  const styles = [defilement.props.contentContainerStyle].flat(Infinity).filter(Boolean);
  const paddingBottom = styles.reduce(
    (retenu, style) => (typeof style?.paddingBottom === 'number' ? style.paddingBottom : retenu),
    0,
  );

  expect(paddingBottom).toBeGreaterThan(34);
});

// 🔤 DEFAUT 2 — « Tu seras redirige·e vers l&#39;App Store. » i18next echappe
// les valeurs interpolees : toute chaine a apostrophe passee par {{...}} ressort
// en entite HTML. La correction est a la SOURCE — plus aucune interpolation ne
// transporte de texte a apostrophe.
test.each([
  ['iOS', 'ios'],
  ['Android', 'android'],
])('%s : aucune entite HTML n\'atterrit a l\'ecran', (_libelle, plateforme) => {
  const precedent = Platform.OS;
  Platform.OS = plateforme;

  try {
    const arbre = rendre({
      contactUrl: 'https://foundclub.app',
      currentVersion: '3.0.1',
      minimumVersion: '3.2.0',
      releaseNotes: ["Paiement de l'adhesion en plusieurs fois"],
      storeUrl: 'https://play.example/fc',
    });

    const texte = JSON.stringify(arbre.toJSON());

    expect(texte).not.toContain('&#39;');
    expect(texte).not.toContain('&amp;');
    expect(texte).not.toContain('&quot;');
    expect(texte).not.toContain('&#x2F;');
  } finally {
    Platform.OS = precedent;
  }
});

test('le nom du store est ecrit en toutes lettres, avec son apostrophe', () => {
  const precedent = Platform.OS;
  Platform.OS = 'ios';

  try {
    const arbre = rendre({ storeUrl: 'https://apple.example/fc' });
    expect(JSON.stringify(arbre.toJSON())).toContain("vers l'App Store");
  } finally {
    Platform.OS = precedent;
  }
});
