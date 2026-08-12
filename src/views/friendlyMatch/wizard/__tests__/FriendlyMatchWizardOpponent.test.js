import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import FriendlyMatchWizardOpponent from '../FriendlyMatchWizardOpponent';

// Filet D90 (E6) : cette etape n'avait AUCUN test, et c'est elle que la demande
// d'Adel du 2026-08-12 change — « je dois pouvoir selectionner PLUSIEURS
// categories et niveaux ».
//
// Ce que ce fichier surveille, et qu'aucune porte de `app` ne voit :
//   · cocher une 2e categorie AJOUTE, elle ne REMPLACE pas ;
//   · rappuyer DECOCHE (une bascule qui ne rebascule pas est un piege connu) ;
//   · « rien de coche » a un sens ECRIT a l'ecran, et pas seulement dans la tete
//     de celui qui a code le filtre.
//
// Pilote par le TEXTE VISIBLE et par l'etat d'accessibilite, jamais par la forme
// de l'arbre.

/** @type {any[]} */
const mockPropsDuGabarit = [];
const mockEnvoyer = jest.fn();

const CATEGORIES = [
  { documentId: 'cat-u15', name: 'U15' },
  { documentId: 'cat-u17', name: 'U17' },
  { documentId: 'cat-u19', name: 'U19' },
];
const NIVEAUX = [
  { documentId: 'lvl-d1', name: 'Départemental 1' },
  { documentId: 'lvl-d2', name: 'Départemental 2' },
];

jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: CATEGORIES }),
}));

jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({ data: NIVEAUX }),
}));

// Le VRAI theme, sans le contexte React qui le porte. Un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall, 2026-08-02).
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockPropsDuGabarit.push(props);
  return props.children;
});

/** @type {any} */
const mockEtatDuBrouillon = { activity: { name: 'Football' }, categories: [], levels: [] };
jest.mock('../FriendlyMatchWizardContext', () => ({
  __esModule: true,
  useFriendlyMatchWizard: () => ({
    dispatch: (/** @type {any} */ action) => mockEnvoyer(action),
    // Lu a chaque rendu : le test remplace le contenu, jamais la reference.
    state: mockEtatDuBrouillon,
  }),
}));

/**
 * Rend l'etape avec des categories et des niveaux deja coches, ou aucun.
 * @param {any[]} [categories] Les categories deja choisies.
 * @param {any[]} [levels] Les niveaux deja choisis.
 * @returns {any} L'arbre rendu.
 */
const rendre = (categories = [], levels = []) => {
  mockEtatDuBrouillon.categories = categories;
  mockEtatDuBrouillon.levels = levels;
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(FriendlyMatchWizardOpponent, { navigation }));
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
 * Les pastilles d'un groupe, reperees par leur etiquette d'accessibilite.
 * @param {any} arbre L'arbre rendu.
 * @param {string} titre Le titre du groupe (« Catégories », « Niveaux »).
 * @returns {any[]} Les pastilles du groupe, dans l'ordre.
 */
const pastilles = (arbre, titre) => {
  /** @type {any[]} */
  const trouvees = [];
  const parcourir = (/** @type {any} */ noeud) => {
    if (!noeud || typeof noeud !== 'object') return;
    if (Array.isArray(noeud)) {
      noeud.forEach(parcourir);
      return;
    }
    if (String(noeud.props?.accessibilityLabel || '').startsWith(`${titre} : `)) {
      trouvees.push(noeud);
    }
    (noeud.children || []).forEach(parcourir);
  };
  parcourir(arbre.toJSON());
  return trouvees;
};

/**
 * La pastille qui porte ce libelle, dans ce groupe.
 * @param {any} arbre L'arbre rendu.
 * @param {string} titre Le titre du groupe.
 * @param {string} libelle Le libelle affiche sur la pastille.
 * @returns {any} La pastille trouvee.
 */
const pastille = (arbre, titre, libelle) => pastilles(arbre, titre)
  .find((noeud) => noeud.props.accessibilityLabel === `${titre} : ${libelle}`);

/**
 * Appuie sur la pastille qui porte ce libelle.
 * @param {any} arbre L'arbre rendu.
 * @param {string} titre Le titre du groupe.
 * @param {string} libelle Le libelle affiche sur la pastille.
 * @returns {void}
 */
const appuyer = (arbre, titre, libelle) => {
  const cible = arbre.root.findAll(
    (/** @type {any} */ noeud) => typeof noeud.props.onPress === 'function'
      && noeud.props.accessibilityLabel === `${titre} : ${libelle}`,
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

describe('Etape 5/7 « Quel adversaire ? » — CE QUI NE DOIT PAS BOUGER', () => {
  it('est bien la 5e etape sur 7, et on peut la sauter', () => {
    rendre();
    expect(dernierGabarit().stepIndex).toBe(5);
    expect(dernierGabarit().stepCount).toBe(7);
    expect(dernierGabarit().showSkip).toBe(true);
    expect(dernierGabarit().skipLabel).toBe('Peu importe, je prends tout');
  });

  it('ne bloque jamais « Suivant » : les trois champs restent facultatifs', () => {
    rendre();
    expect(dernierGabarit().isNextDisabled).toBe(false);
  });

  it('propose le catalogue de formats du sport de l equipe, plus « Autre »', () => {
    const affiches = textesVisibles(rendre());
    ['11v11', '8v8', '7v7', '5v5', 'Autre'].forEach((format) => {
      expect(affiches).toContain(format);
    });
  });
});

describe('D90 — on coche PLUSIEURS categories et PLUSIEURS niveaux', () => {
  it('cocher une 2e categorie AJOUTE, elle ne remplace pas la 1re', () => {
    const arbre = rendre([CATEGORIES[0]]);
    appuyer(arbre, 'Catégories', 'U17');

    expect(mockEnvoyer).toHaveBeenCalledWith({
      payload: [CATEGORIES[0], CATEGORIES[1]],
      type: 'SET_CATEGORIES',
    });
  });

  it('rappuyer sur une categorie deja cochee la DECOCHE', () => {
    const arbre = rendre([CATEGORIES[0], CATEGORIES[1]]);
    appuyer(arbre, 'Catégories', 'U15');

    expect(mockEnvoyer).toHaveBeenCalledWith({
      payload: [CATEGORIES[1]],
      type: 'SET_CATEGORIES',
    });
  });

  it('les niveaux se cochent exactement pareil', () => {
    const arbre = rendre([], [NIVEAUX[0]]);
    appuyer(arbre, 'Niveaux', 'Départemental 2');

    expect(mockEnvoyer).toHaveBeenCalledWith({
      payload: [NIVEAUX[0], NIVEAUX[1]],
      type: 'SET_LEVELS',
    });
  });

  it('montre les trois categories cochees en meme temps', () => {
    const arbre = rendre(CATEGORIES);
    const cochees = pastilles(arbre, 'Catégories')
      .filter((noeud) => noeud.props.accessibilityState?.checked === true);

    expect(cochees.map((noeud) => noeud.props.accessibilityLabel)).toEqual([
      'Catégories : U15',
      'Catégories : U17',
      'Catégories : U19',
    ]);
  });

  it('annonce des CASES A COCHER, pas des boutons : la couleur seule ne dit rien', () => {
    const arbre = rendre([CATEGORIES[0]]);
    const groupe = pastilles(arbre, 'Catégories');

    expect(groupe.map((noeud) => noeud.props.accessibilityRole))
      .toEqual(['checkbox', 'checkbox', 'checkbox', 'checkbox']);
    expect(groupe.map((noeud) => noeud.props.accessibilityState.checked))
      .toEqual([false, true, false, false]);
  });
});

describe('D90 — « rien de coche » veut dire TOUTES, et l ecran le dit', () => {
  it('allume « Toutes » tant qu aucune categorie n est cochee', () => {
    const arbre = rendre();

    expect(pastille(arbre, 'Catégories', 'Toutes').props.accessibilityState.checked).toBe(true);
    expect(pastille(arbre, 'Niveaux', 'Tous').props.accessibilityState.checked).toBe(true);
  });

  it('eteint « Toutes » des qu une categorie est cochee', () => {
    const arbre = rendre([CATEGORIES[0]]);

    expect(pastille(arbre, 'Catégories', 'Toutes').props.accessibilityState.checked).toBe(false);
  });

  it('appuyer sur « Toutes » relache tout ce qui etait coche, meme le pre-rempli', () => {
    const arbre = rendre([CATEGORIES[0], CATEGORIES[1]]);
    appuyer(arbre, 'Catégories', 'Toutes');

    expect(mockEnvoyer).toHaveBeenCalledWith({ payload: [], type: 'SET_CATEGORIES' });
  });

  it('ecrit en toutes lettres ce que « rien de coche » veut dire', () => {
    const affiches = textesVisibles(rendre());

    expect(affiches).toContain('Coche autant de catégories que tu veux. Rien de coché : toutes.');
    expect(affiches).toContain('Coche autant de niveaux que tu veux. Rien de coché : tous.');
    expect(dernierGabarit().subtitle)
      .toBe('Tout est facultatif : laisse vide et tu verras plus de monde.');
  });

  it('titre les deux groupes au PLURIEL : on en attend plusieurs', () => {
    const arbre = rendre();

    expect(pastilles(arbre, 'Catégories').length).toBeGreaterThan(0);
    expect(pastilles(arbre, 'Niveaux').length).toBeGreaterThan(0);
    expect(textesVisibles(arbre)).toContain('Catégories');
    expect(textesVisibles(arbre)).toContain('Niveaux');
  });
});
