import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { FriendlyMatchWizardProvider } from '../FriendlyMatchWizardContext';
import FriendlyMatchWizardDates from '../FriendlyMatchWizardDates';

// Filet D24 (E6) : l'etape 3/7 du tunnel amical n'avait AUCUN test, et c'est
// celle qu'Adel declare BLOQUANTE (recette du 2026-08-07 : « on ne peut pas
// ajouter d'heure dans le tunnel, ca ne marche pas et on est donc bloque »).
//
// Ce filet TRAVERSE : il ne monte pas l'ecran, il va de la roue native jusqu'a
// « Suivant ». Le brouillon est le VRAI (FriendlyMatchWizardProvider) et le
// selecteur de creneaux est le VRAI — un mock de l'un ou de l'autre aurait
// prouve que le test marche, pas que le tunnel marche. Seule la roue native
// (`@react-native-community/datetimepicker`) est doublee : elle n'existe pas
// sous Jest, et c'est elle qui rend les valeurs a l'ecran qui les consomme.

/** Les props de chaque roue native montee, dans l'ordre de rendu. */
/** @type {any[]} */
const mockRoues = [];
/** Les props recues par le gabarit de tunnel, dans l'ordre de rendu. */
/** @type {any[]} */
const mockPropsDuGabarit = [];

jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = jest.requireActual('react-native');
  const { createElement: creer } = jest.requireActual('react');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => {
      mockRoues.push(props);
      return creer(View, { testID: `roue-${props.mode}` });
    },
  };
});

// Le VRAI theme, sans le contexte React qui le porte. Un Proxy rendrait les
// echecs Jest illisibles (constat du lot paywall, 2026-08-02) et un objet
// invente masquerait un jeton d'espacement absent.
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

// Le gabarit de tunnel a son propre filet (25 tests, lot D05) : le remplacer par
// un passe-plat qui ENREGISTRE ses props evite de tirer ScreenContainer, le dock
// et le tour guide, tout en gardant verifiable le seul contrat qui compte ici —
// l'etat du bouton « Suivant » et ou il mene.
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockPropsDuGabarit.push(props);
  return props.children;
});

/** Une date volontairement lointaine : le filet ne doit pas expirer. */
const JOUR_CHOISI = new Date(2099, 4, 12);
const JOUR_AFFICHE = 'mardi 12 mai';

/**
 * Monte l'etape avec un brouillon vierge.
 * @returns {any} L'arbre rendu et sa navigation espionnee.
 */
const rendre = () => {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(
      FriendlyMatchWizardProvider,
      null,
      createElement(FriendlyMatchWizardDates, { navigation }),
    ));
  });
  return { arbre, navigation };
};

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
 * L'arbre des composants, qu'on recoive le rendu entier ou deja un sous-arbre.
 * @param {any} cible Le rendu (`.root`) ou un noeud.
 * @returns {any} Le noeud a explorer.
 */
const racineDe = (cible) => (cible && cible.root ? cible.root : cible);

/**
 * La cible pressable la plus englobante qui affiche ce texte.
 * @param {any} racine L'arbre (ou un sous-arbre) des composants.
 * @param {string} texte Le libelle affiche sur la cible.
 * @returns {any} Le noeud pressable.
 */
const cibleParTexte = (racine, texte) => racineDe(racine).findAll(
  (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
    && textesSous(noeud).includes(texte),
)[0];

/**
 * Appuie sur la cible qui affiche ce texte — et respecte son etat grise, comme
 * le ferait un doigt. Un test qui appelle `onPress()` sur un bouton desactive
 * prouve le contraire de ce qu'on veut savoir.
 * @param {any} racine L'arbre des composants.
 * @param {string} texte Le libelle affiche sur la cible.
 * @returns {boolean} `false` si la cible etait morte.
 */
const appuyer = (racine, texte) => {
  const cible = cibleParTexte(racine, texte);
  if (!cible) throw new Error(`Aucune cible pressable ne porte « ${texte} »`);
  if (cible.props.disabled) return false;
  act(() => cible.props.onPress());
  return true;
};

/**
 * Le champ d'un selecteur, retrouve par son etiquette.
 * @param {any} arbre L'arbre rendu.
 * @param {string} etiquette L'etiquette du selecteur.
 * @returns {any} Le composite du selecteur.
 */
const selecteur = (arbre, etiquette) => arbre.root.findAll(
  (/** @type {any} */ noeud) => noeud.props?.label === etiquette
    && typeof noeud.props?.onChange === 'function',
)[0];

/**
 * Ouvre un selecteur, fait tourner sa roue, puis valide par « OK ».
 * @param {any} arbre L'arbre rendu.
 * @param {string} etiquette L'etiquette du selecteur.
 * @param {Date} valeur La valeur choisie sur la roue.
 * @returns {void}
 */
const choisirDansLaRoue = (arbre, etiquette, valeur) => {
  const champ = selecteur(arbre, etiquette);
  const ouvrir = champ.findAll(
    (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function',
  )[0];
  act(() => ouvrir.props.onPress());

  const roue = mockRoues[mockRoues.length - 1];
  act(() => roue.onChange({ type: 'set' }, valeur));

  appuyer(champ, 'OK');
};

/**
 * Le dernier jeu de props recu par le gabarit de tunnel.
 * @returns {any} Les props du gabarit.
 */
const dernierGabarit = () => mockPropsDuGabarit[mockPropsDuGabarit.length - 1];

beforeEach(() => {
  mockRoues.length = 0;
  mockPropsDuGabarit.length = 0;
});

describe('Etape 3/7 « Quand veux-tu jouer ? » — le tunnel doit se TRAVERSER', () => {
  it('est bien la 3e etape sur 7 et bloque tant qu aucune date n est posee', () => {
    const { arbre } = rendre();
    expect(dernierGabarit().stepIndex).toBe(3);
    expect(dernierGabarit().stepCount).toBe(7);
    expect(dernierGabarit().isNextDisabled).toBe(true);
    expect(textesVisibles(arbre)).toContain('Propose au moins une date.');
  });

  // LE test qui compte : une date, un ajout, et l'etape suivante est atteinte.
  it('une date choisie puis ajoutee libere « Suivant » et mene a l etape 4', () => {
    const { arbre, navigation } = rendre();

    choisirDansLaRoue(arbre, 'Date', JOUR_CHOISI);
    expect(appuyer(arbre, 'Ajouter cette date')).toBe(true);

    expect(textesVisibles(arbre)).toContain('1 date proposée');
    expect(textesVisibles(arbre)).toContain(JOUR_AFFICHE);
    expect(dernierGabarit().isNextDisabled).toBe(false);

    act(() => dernierGabarit().onNext());
    expect(navigation.navigate).toHaveBeenCalledWith('FriendlyMatchWizardLocation');
  });

  it('une date ET ses deux heures partent ensemble dans le creneau', () => {
    const { arbre } = rendre();

    choisirDansLaRoue(arbre, 'Date', JOUR_CHOISI);
    choisirDansLaRoue(arbre, 'Début (facultatif)', new Date(2099, 4, 12, 18, 0));
    choisirDansLaRoue(arbre, 'Fin (facultatif)', new Date(2099, 4, 12, 20, 0));
    expect(appuyer(arbre, 'Ajouter cette date')).toBe(true);

    expect(textesVisibles(arbre)).toContain('de 18:00 à 20:00');
  });
});

// 🧨 DEFAUT ⑥ de la recette du 2026-08-07 : « on ne peut pas ajouter d'heure
// dans le tunnel, ca ne marche pas et on est donc bloque ».
//
// Le mecanisme MESURE (ces deux tests etaient ROUGES avant le lot) : l'horaire
// est facultatif, mais la DATE est la seule chose qui libere « Suivant », et
// « Ajouter cette date » etait `disabled={!dayValue}`. Or `dayValue` est vide
// dans les DEUX situations ou l'on cherche a poser une heure :
//   · a l'ouverture, si l'on remplit d'abord « Début » / « Fin » — les deux
//     champs sont juste sous celui de la date ;
//   · apres un premier ajout, puisque le formulaire se vide tout seul.
// Le bouton etait donc gris ET MUET : le message « Choisis d'abord une date. »
// que `handleAdd` sait produire ne pouvait JAMAIS s'afficher.
describe('Etape 3/7 — DEFAUT ⑥ : poser une heure ne doit jamais buter sur un bouton mort', () => {
  // Le geste exact qu'Adel decrit : la date est posee (« horaire a convenir »),
  // il veut y attacher un horaire.
  it('un creneau deja pose se reprend d un appui, pour lui donner son horaire', () => {
    const { arbre } = rendre();

    choisirDansLaRoue(arbre, 'Date', JOUR_CHOISI);
    appuyer(arbre, 'Ajouter cette date');
    expect(textesVisibles(arbre)).toContain('horaire à convenir');

    // On rappelle le creneau dans le formulaire, on lui donne son heure.
    expect(appuyer(arbre, 'Modifier')).toBe(true);
    choisirDansLaRoue(arbre, 'Début (facultatif)', new Date(2099, 4, 12, 18, 0));
    expect(appuyer(arbre, 'Mettre à jour cette date')).toBe(true);

    expect(textesVisibles(arbre)).toContain('à partir de 18:00');
    expect(textesVisibles(arbre)).not.toContain('horaire à convenir');
    expect(textesVisibles(arbre)).toContain('1 date proposée');
  });

  // Le bouton doit dire ce qu'il va faire : sur un jour deja pose, il MET A
  // JOUR (l'appelant remplace le creneau du meme jour), il n'empile pas.
  it('le bouton annonce « mettre a jour » des que le jour saisi est deja pose', () => {
    const { arbre } = rendre();

    choisirDansLaRoue(arbre, 'Date', JOUR_CHOISI);
    expect(textesVisibles(arbre)).toContain('Ajouter cette date');

    appuyer(arbre, 'Ajouter cette date');
    appuyer(arbre, 'Modifier');
    expect(textesVisibles(arbre)).toContain('Mettre à jour cette date');
  });

  // Le meme cul-de-sac pris par l'autre bout : on remplit les heures d'abord.
  it('une heure saisie sans date dit ce qui manque, au lieu d un bouton mort', () => {
    const { arbre } = rendre();

    choisirDansLaRoue(arbre, 'Début (facultatif)', new Date(2099, 4, 12, 18, 0));
    expect(appuyer(arbre, 'Ajouter cette date')).toBe(true);

    expect(textesVisibles(arbre)).toContain('Choisis d’abord une date.');
    expect(dernierGabarit().isNextDisabled).toBe(true);
  });

  // La croix reste une SUPPRESSION, elle ne doit pas devenir une correction.
  it('la croix retire le creneau, elle ne le reprend pas', () => {
    const { arbre } = rendre();

    choisirDansLaRoue(arbre, 'Date', JOUR_CHOISI);
    appuyer(arbre, 'Ajouter cette date');

    const croix = arbre.root.findAll(
      (/** @type {any} */ noeud) => noeud.props?.accessibilityLabel
        === `Retirer la date du ${JOUR_AFFICHE}`,
    )[0];
    act(() => croix.props.onPress());

    expect(textesVisibles(arbre)).toContain('Aucune date proposée pour l’instant.');
    expect(dernierGabarit().isNextDisabled).toBe(true);
  });
});
