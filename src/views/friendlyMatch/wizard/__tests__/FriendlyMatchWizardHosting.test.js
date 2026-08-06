import { createElement } from 'react';
import { StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FriendlyMatchWizardHosting from '../FriendlyMatchWizardHosting';

// Filet D07 (E6) : cet ecran n'avait AUCUN test, et il porte la seule donnee
// que le lot D07 ne doit surtout pas deplacer — `hostingPreference`, dont les
// valeurs HOST / AWAY / BOTH voyagent jusqu'au serveur. Un renommage cosmetique
// casserait la publication d'annonce, et AUCUNE des quatre portes de `app` ne
// le verrait : le champ n'est type nulle part, et le service se contente de
// `String(...).toUpperCase()`.
//
// Le fichier est ecrit en deux etages, volontairement separes :
//   · « CE QUI NE DOIT PAS BOUGER » decrit le 2026-08-06 AVANT le lot ;
//   · « CE QUE D07 AJOUTE » decrit la maquette validee le 2026-08-05.
// Le premier etage doit rester vert des deux cotes du lot. C'est lui la preuve.
//
// Pilote par le TEXTE VISIBLE et par les valeurs de design (cible tactile,
// jeton de police, taille de tuile), jamais par la forme de l'arbre.

/** @type {any[]} */
const mockPropsDuGabarit = [];
const mockEnvoyer = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte. Un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall, 2026-08-02) et un objet
// invente masquerait un jeton absent — or ce lot consomme justement les jetons
// d'espacement 38 / 44 / 74 ajoutes par D05.
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
      Images: {
        arrowLeft: 'icone-fleche-gauche',
        arrowRight: 'icone-fleche-droite',
        check: 'icone-coche',
        running: 'icone-coureur',
        stadium: 'icone-stade',
      },
      Spaces: espaces,
    }),
  };
});

// Le gabarit de tunnel a son propre filet (25 tests, lot D05) : le remplacer par
// un passe-plat qui ENREGISTRE ses props evite de tirer ScreenContainer, le dock
// et le tour guide, tout en gardant verifiable ce qui est un contrat entre les
// deux fichiers — la grammaire d'en-tete, l'etat du bouton Suivant, le rang.
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockPropsDuGabarit.push(props);
  return props.children;
});

const mockEtatDuBrouillon = { hostingPreference: '' };
jest.mock('../FriendlyMatchWizardContext', () => ({
  __esModule: true,
  useFriendlyMatchWizard: () => ({
    dispatch: (/** @type {any} */ action) => mockEnvoyer(action),
    // Lu a chaque rendu : le test remplace le contenu, jamais la reference.
    state: mockEtatDuBrouillon,
  }),
}));

const polices = require('@/theme/fonts').default(require('@/theme/colors').default());

/**
 * Rend l'etape avec un choix deja fait, ou aucun.
 * @param {string} [choix] Valeur de `hostingPreference` (HOST / AWAY / BOTH).
 * @returns {any} L'arbre rendu.
 */
const rendre = (choix = '') => {
  mockEtatDuBrouillon.hostingPreference = choix;
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(FriendlyMatchWizardHosting, { navigation }));
  });
  return arbre;
};

/**
 * Tous les textes reellement affiches, dans l'ordre du rendu.
 * @param {any} arbre L'arbre rendu.
 * @returns {string[]} Les textes affiches.
 */
const textesVisibles = (arbre) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ noeud) => {
    if (noeud === null || noeud === undefined || typeof noeud === 'boolean') return;
    if (typeof noeud === 'string' || typeof noeud === 'number') {
      sortie.push(String(noeud));
      return;
    }
    if (Array.isArray(noeud)) {
      noeud.forEach(parcourir);
      return;
    }
    parcourir(noeud.children);
  };
  parcourir(arbre.toJSON());
  return sortie;
};

/**
 * Les noeuds d'affichage (pas les composites) qui satisfont le predicat.
 * @param {any} arbre L'arbre rendu.
 * @param {(noeud: any) => boolean} predicat Le filtre applique a chaque noeud.
 * @returns {any[]} Les noeuds retenus.
 */
const noeudsAffiches = (arbre, predicat) => {
  /** @type {any[]} */
  const trouves = [];
  const parcourir = (/** @type {any} */ noeud) => {
    if (!noeud || typeof noeud !== 'object') return;
    if (Array.isArray(noeud)) {
      noeud.forEach(parcourir);
      return;
    }
    if (predicat(noeud)) trouves.push(noeud);
    (noeud.children || []).forEach(parcourir);
  };
  parcourir(arbre.toJSON());
  return trouves;
};

/**
 * Le style d'un noeud, aplati : il peut etre un objet ou un tableau.
 * @param {any} noeud Un noeud d'affichage.
 * @returns {any} Le style aplati.
 */
const style = (noeud) => StyleSheet.flatten(noeud.props.style) || {};

/**
 * Les textes rendus sous un noeud de l'arbre des composants.
 * @param {any} composant Un noeud de l'arbre des composants.
 * @returns {string[]} Les textes trouves dessous.
 */
const textesSous = (composant) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ noeud) => {
    if (typeof noeud === 'string') {
      sortie.push(noeud);
      return;
    }
    if (noeud && Array.isArray(noeud.children)) noeud.children.forEach(parcourir);
  };
  parcourir(composant);
  return sortie;
};

/**
 * Appuie sur l'element pressable qui affiche ce texte.
 * @param {any} arbre L'arbre rendu.
 * @param {string} texte Le libelle affiche sur la cible.
 * @returns {void}
 */
const appuyerSurLeTexte = (arbre, texte) => {
  const cible = arbre.root.findAll(
    (/** @type {any} */ noeud) => typeof noeud.props.onPress === 'function'
      && textesSous(noeud).includes(texte),
  )[0];
  act(() => cible.props.onPress());
};

/**
 * Le dernier jeu de props recu par le gabarit de tunnel.
 * @returns {any} Les props du gabarit.
 */
const dernierGabarit = () => mockPropsDuGabarit[mockPropsDuGabarit.length - 1];

beforeEach(() => {
  mockPropsDuGabarit.length = 0;
  mockEnvoyer.mockClear();
});

describe('Etape 2/7 « Tu peux recevoir ? » — CE QUI NE DOIT PAS BOUGER', () => {
  it('propose les trois reponses, dans l ordre de la spec §3.1', () => {
    const affiches = textesVisibles(rendre());
    expect(affiches).toEqual(expect.arrayContaining(['Je reçois', 'Je me déplace', 'Les deux']));
    expect(affiches.indexOf('Je reçois')).toBeLessThan(affiches.indexOf('Je me déplace'));
    expect(affiches.indexOf('Je me déplace')).toBeLessThan(affiches.indexOf('Les deux'));
  });

  // LE temoin metier du lot. Ces trois chaines partent telles quelles dans
  // `hostingPreference` (friendlyMatchService.js:126) et le serveur les compare
  // en dur. Les traduire « recoit / se_deplace / les_deux » comme le demandait
  // le brief design casserait la publication en silence.
  it.each([
    ['Je reçois', 'HOST'],
    ['Je me déplace', 'AWAY'],
    ['Les deux', 'BOTH'],
  ])('« %s » envoie la valeur %s, jamais un libelle traduit', (libelle, valeur) => {
    const arbre = rendre();
    appuyerSurLeTexte(arbre, libelle);
    expect(mockEnvoyer).toHaveBeenCalledWith({ payload: valeur, type: 'SET_HOSTING_PREFERENCE' });
  });

  it('pose la question et son enjeu, sans jargon', () => {
    rendre();
    expect(dernierGabarit().title).toBe('Tu peux recevoir ?');
    expect(dernierGabarit().subtitle).toBe('C’est ce qui décide où le match se jouera.');
  });

  it('est bien la 2e etape sur 7', () => {
    rendre();
    expect(dernierGabarit().stepIndex).toBe(2);
    expect(dernierGabarit().stepCount).toBe(7);
  });

  // Q1 : aucune valeur par defaut, meme « Les deux ». Un choix implicite serait
  // subi, pas fait — c'est la raison d'etre de l'etape.
  it('interdit de continuer tant que rien n est choisi, et le permet ensuite', () => {
    rendre();
    expect(dernierGabarit().isNextDisabled).toBe(true);

    rendre('BOTH');
    expect(dernierGabarit().isNextDisabled).toBe(false);
  });

  it('ne preselectionne rien : aucune coche a l ouverture', () => {
    const arbre = rendre();
    expect(noeudsAffiches(arbre, (noeud) => noeud.props?.source === 'icone-coche')).toHaveLength(0);
  });
});

describe('Etape 2/7 « Tu peux recevoir ? » — CE QUE D07 AJOUTE', () => {
  // La grammaire d'en-tete D05 est un MODE : on l'ACTIVE, on ne la reecrit pas.
  it('bascule l en-tete sur la grammaire « focus » du pack de design', () => {
    rendre();
    expect(dernierGabarit().headerVariant).toBe('focus');
  });

  // Le coeur du chantier B : la consequence se lit AVANT de choisir, sous
  // CHAQUE carte. Avant D07 elle n'apparaissait que pour l'option deja
  // selectionnee — donc jamais au moment ou elle sert a decider.
  it('montre les trois consequences AVANT tout choix', () => {
    const affiches = textesVisibles(rendre());
    expect(affiches).toContain('Le match se jouera sur ton terrain.');
    expect(affiches).toContain('Tu joues chez l’adversaire.');
    expect(affiches).toContain('Ton annonce touche le plus d’équipes.');
  });

  it('garde les trois consequences visibles une fois le choix fait', () => {
    const affiches = textesVisibles(rendre('HOST'));
    expect(affiches).toContain('Le match se jouera sur ton terrain.');
    expect(affiches).toContain('Tu joues chez l’adversaire.');
    expect(affiches).toContain('Ton annonce touche le plus d’équipes.');
  });

  // 74 pt : la carte porte deux lignes de texte et une tuile d'icone. La valeur
  // vient de la rampe Spaces (ajoutee par D05) — ecrite en dur, elle serait
  // hors rampe et le style serait perdu EN SILENCE.
  it('donne aux trois cartes une hauteur d au moins 74 pt', () => {
    const arbre = rendre();
    const cartes = noeudsAffiches(
      arbre,
      (noeud) => noeud.props?.accessibilityRole === 'radio',
    );
    expect(cartes).toHaveLength(3);
    cartes.forEach((carte) => expect(style(carte).minHeight).toBe(74));
  });

  it('donne a chaque carte sa tuile d icone de 38 pt', () => {
    const arbre = rendre();
    const tuiles = noeudsAffiches(
      arbre,
      (noeud) => style(noeud).height === 38 && style(noeud).width === 38,
    );
    expect(tuiles).toHaveLength(3);
  });

  // Une icone par etat, deduite de la donnee et jamais d'un texte : stade pour
  // « je recois », coureur pour « je me deplace », double fleche pour « les deux ».
  it('donne a chaque etat son icone propre', () => {
    const arbre = rendre();
    const sources = noeudsAffiches(arbre, (noeud) => typeof noeud.props?.source === 'string')
      .map((noeud) => noeud.props.source);
    expect(sources).toContain('icone-stade');
    expect(sources).toContain('icone-coureur');
    expect(sources).toContain('icone-fleche-droite');
    expect(sources).toContain('icone-fleche-gauche');
  });

  // Selection = bord cyan 1,5 + fond cyan 8 % + coche a droite. Le fond passe
  // par withAlpha() : un litteral rgba() ferait rougir verify:theme-contract.
  it('marque le choix par un bord cyan de 1,5 et une coche', () => {
    const arbre = rendre('AWAY');
    const choisies = noeudsAffiches(
      arbre,
      (noeud) => noeud.props?.accessibilityRole === 'radio'
        && noeud.props?.accessibilityState?.selected === true,
    );
    expect(choisies).toHaveLength(1);
    expect(style(choisies[0]).borderWidth).toBe(1.5);
    expect(textesSous(choisies[0])).toContain('Je me déplace');
    expect(noeudsAffiches(arbre, (noeud) => noeud.props?.source === 'icone-coche')).toHaveLength(1);
  });

  it('annonce le choix aux lecteurs d ecran, pas seulement par la couleur', () => {
    const arbre = rendre('BOTH');
    const cartes = noeudsAffiches(arbre, (noeud) => noeud.props?.accessibilityRole === 'radio');
    const etats = cartes.map((carte) => carte.props.accessibilityState.selected);
    expect(etats).toEqual([false, false, true]);
  });

  const DEBUT_LIGNE_INFO = 'Seules les équipes compatibles';

  // Le pave explicatif encadre devient une ligne d'aide discrete : il ne doit
  // plus peser autant qu'une des trois cartes.
  it('remplace le pave explicatif par une ligne d info discrete', () => {
    const affiches = textesVisibles(rendre('HOST'));
    expect(affiches.join(' ')).toContain(
      `${DEBUT_LIGNE_INFO} avec ton choix verront ton annonce`,
    );
    expect(affiches.join(' ')).not.toContain('Personne ne tombe donc sur un message');
  });

  it('ecrit la ligne d info dans le plus petit jeton de la rampe, pas en dur', () => {
    const arbre = rendre();
    const ligne = noeudsAffiches(
      arbre,
      (noeud) => textesSous(noeud).some((texte) => texte.startsWith(DEBUT_LIGNE_INFO)),
    ).pop();
    expect(style(ligne).fontSize).toBe(polices.small.fontSize);
  });

  it('ecrit le libelle d option dans un jeton de la rampe, pas en dur', () => {
    const arbre = rendre();
    const libelle = noeudsAffiches(
      arbre,
      (noeud) => textesSous(noeud).length === 1 && textesSous(noeud)[0] === 'Je reçois',
    ).pop();
    expect(style(libelle).fontSize).toBe(polices.p1Bold.fontSize);
    expect(style(libelle).fontFamily).toBe(polices.p1Bold.fontFamily);
  });
});
