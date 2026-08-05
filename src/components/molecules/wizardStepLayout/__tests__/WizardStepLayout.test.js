import { StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import WizardStepLayout from '../WizardStepLayout';

// Filet D05 (E6) : WizardStepLayout est importe par 59 ecrans repartis sur 8
// tunnels (evenement, recrutement, equipe, console admin, amical, historique
// sportif, club, licence) et n'avait AUCUN test. Une regression ici casse huit
// tunnels d'un coup, et aucune des quatre portes de `app` ne le verrait : les
// tests qui existent testent des ecrans, pas la piece commune.
//
// Ce fichier DECRIT le comportement du 2026-08-05, il ne le corrige pas. Deux
// bizarreries sont donc figees telles quelles et signalees en commentaire : la
// barre de progression vaut deja 1/N a la premiere etape, et `stepIndex={null}`
// allume la progression au lieu de l'eteindre. Les corriger est un autre lot.
//
// Il est pilote par le TEXTE VISIBLE et par les valeurs de design (taille de
// cible, hauteur de barre, jeton de police), jamais par la forme de l'arbre :
// c'est le seul point d'appui qui survit a une refonte de mise en page.

/** @type {any[]} */
const propsDuBouton = [];
/** @type {any[]} */
const propsDuConteneur = [];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Le gabarit appelle `t` de deux facons : avec un repli en chaine
    // (`t('common.back', 'Retour')`) et avec un objet portant `defaultValue`
    // (le compteur d'etape). Les deux rendent le repli, jamais la cle.
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
      return cle;
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall, 2026-08-02) et un objet
// invente masquerait un jeton absent — or ce lot ajoute justement des jetons.
// `Images` est le seul element stube, pour ne pas dependre de la resolution des
// fichiers d'assets.
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
      Images: { arrowLeft: 1, close: 2 },
      Spaces: espaces,
    }),
  };
});

// Passe-plat : ScreenContainer a son propre filet
// (`templates/__tests__/ScreenContainer.tour.test.js`) et tirerait ici quatre
// dependances hors sujet (tour guide, degrade, en-tete de navigation, dock).
// Ses props sont enregistrees parce que le couplage des deux fichiers, lui, est
// un invariant : ce gabarit gere son propre retrait bas.
jest.mock('@/components/templates/ScreenContainer', () => function ScreenContainerMock(
  /** @type {any} */ props,
) {
  propsDuConteneur.push(props);
  return props.children;
});

// Le bouton est rendu comme un vrai element pressable portant son `title` :
// c'est ce qui permet d'appuyer « sur le texte », que le libelle soit porte par
// un Button (aujourd'hui) ou par autre chose (apres une refonte).
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    propsDuBouton.push(props);
    return reactActuel.createElement(
      PressableRN,
      {
        accessibilityRole: 'button',
        disabled: Boolean(props.disabled || props.isLoading),
        onPress: props.onPress,
      },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

const polices = require('@/theme/fonts').default(require('@/theme/colors').default());

const rendre = (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <WizardStepLayout title="Quel type d'evenement ?" {...props} />,
    );
  });
  return arbre;
};

/**
 * Tous les textes reellement affiches, dans l'ordre du rendu.
 * @param {any} arbre
 * @returns {string[]}
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
 * @param {any} arbre
 * @param {(noeud: any) => boolean} predicat
 * @returns {any[]}
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
 * @param {any} noeud
 * @returns {any}
 */
const style = (noeud) => StyleSheet.flatten(noeud.props.style) || {};

/**
 * Le pressable portant ce libelle d'accessibilite, ou undefined.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any}
 */
const pressableNomme = (arbre, libelle) => noeudsAffiches(
  arbre,
  (noeud) => noeud.props?.accessibilityLabel === libelle,
)[0];

// Les gestes se pilotent sur l'arbre des composants, pas sur celui des noeuds
// d'affichage : un TouchableOpacity rend un hote qui ne porte PAS `onPress`
// (il porte les gestionnaires de « responder »). Et comme il expose deux noeuds
// pressables — le composite et le sien —, on prend toujours le premier, le plus
// exterieur.

/**
 * Les textes rendus sous ce composant.
 * @param {any} composant
 * @returns {string[]}
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
 * @param {any} arbre
 * @param {string} texte
 */
const appuyerSurLeTexte = (arbre, texte) => {
  const cible = arbre.root.findAll(
    (/** @type {any} */ noeud) => typeof noeud.props.onPress === 'function'
      && textesSous(noeud).includes(texte),
  )[0];
  act(() => cible.props.onPress());
};

/**
 * Appuie sur l'element pressable portant ce libelle d'accessibilite.
 * @param {any} arbre
 * @param {string} libelle
 */
const appuyerSurLeBoutonNomme = (arbre, libelle) => {
  const cible = arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.props.accessibilityLabel === libelle
      && typeof noeud.props.onPress === 'function',
  )[0];
  act(() => cible.props.onPress());
};

/**
 * Le texte affichant le titre de l'ecran.
 * @param {any} arbre
 * @param {string} titre
 * @returns {any}
 */
const noeudDuTexte = (arbre, titre) => noeudsAffiches(
  arbre,
  (noeud) => Array.isArray(noeud.children) && noeud.children.includes(titre),
)[0];

/** La barre pleine : le seul noeud dont la largeur est un pourcentage. */
const remplissageDeBarre = (/** @type {any} */ arbre) => noeudsAffiches(
  arbre,
  (noeud) => typeof style(noeud).width === 'string' && style(noeud).width.endsWith('%'),
)[0];

/** La gouttiere de la barre : le seul noeud qui rogne son contenu. */
const gouttiereDeBarre = (/** @type {any} */ arbre) => noeudsAffiches(
  arbre,
  (noeud) => style(noeud).overflow === 'hidden',
)[0];

beforeEach(() => {
  propsDuBouton.length = 0;
  propsDuConteneur.length = 0;
});

describe("WizardStepLayout — l'en-tete", () => {
  it('affiche le titre, et le sous-titre seulement quand il est fourni', () => {
    expect(textesVisibles(rendre({ subtitle: 'Choisis pour commencer' })))
      .toEqual(expect.arrayContaining(["Quel type d'evenement ?", 'Choisis pour commencer']));

    expect(textesVisibles(rendre({}))).not.toContain('Choisis pour commencer');
  });

  it('rend le titre avec le jeton h1 (28 pt, Montserrat-Regular)', () => {
    // Le gabarit code ce jeton en dur (l.270) : sa signature ne porte aucune
    // propriete de style de titre, la surcharge est donc impossible aujourd'hui.
    const titre = style(noeudDuTexte(rendre({}), "Quel type d'evenement ?"));

    expect(titre.fontSize).toBe(polices.h1.fontSize);
    expect(titre.fontFamily).toBe(polices.h1.fontFamily);
  });

  it('rend le sous-titre en p2 avec un interlignage force a 22', () => {
    const arbre = rendre({ subtitle: 'Choisis pour commencer' });
    const sousTitre = style(noeudDuTexte(arbre, 'Choisis pour commencer'));

    expect(sousTitre.fontSize).toBe(polices.p2.fontSize);
    expect(sousTitre.lineHeight).toBe(22);
    expect(sousTitre.maxWidth).toBe(720);
  });

  it('laisse le titre sur autant de lignes qu il faut, hors repli d en-tete', () => {
    expect(noeudDuTexte(rendre({}), "Quel type d'evenement ?").props.numberOfLines)
      .toBeUndefined();
  });

  it('garde toujours deux emplacements de 40 pt sur les cotes, boutons ou vides', () => {
    // C'est ce qui tient « Étape n/N » au centre : que le retour et la
    // fermeture existent ou non, leur place est reservee.
    const largeurs40 = (/** @type {any} */ arbre) => noeudsAffiches(
      arbre,
      (noeud) => style(noeud).width === 40,
    ).length;

    expect(largeurs40(rendre({ onBack: jest.fn(), onClose: jest.fn() }))).toBe(2);
    expect(largeurs40(rendre({ onBack: jest.fn() }))).toBe(2);
    expect(largeurs40(rendre({}))).toBe(2);
  });

  it('demande au conteneur de ne pas ajouter de plancher bas', () => {
    // Le gabarit applique lui-meme insets.bottom : un plancher de plus le
    // compterait deux fois (invariant partage avec ScreenContainer.tour.test.js).
    rendre({});
    expect(propsDuConteneur[0].bottomInsetMode).toBe('edge-to-edge');
  });
});

describe("WizardStepLayout — l'indicateur d'etape", () => {
  it('affiche « Étape n/N » quand les deux valeurs sont fournies', () => {
    expect(textesVisibles(rendre({ stepCount: 5, stepIndex: 2 }))).toContain('Étape 2/5');
  });

  it("remplit la barre a stepIndex/stepCount — donc deja 1/5 a la premiere etape", () => {
    // DESCRIPTION, PAS APPROBATION : a l'etape 1 sur 5 la barre est deja a 20 %,
    // et elle atteint 100 % sur l'ecran de recapitulatif. Corriger ce decalage
    // changerait les 52 ecrans qui affichent la progression : autre lot.
    expect(remplissageDeBarre(rendre({ stepCount: 5, stepIndex: 1 })).props.style.width)
      .toBe('20%');
    expect(remplissageDeBarre(rendre({ stepCount: 5, stepIndex: 5 })).props.style.width)
      .toBe('100%');
  });

  it('borne la barre a 100 % quand stepIndex depasse stepCount', () => {
    expect(remplissageDeBarre(rendre({ stepCount: 3, stepIndex: 9 })).props.style.width)
      .toBe('100%');
  });

  it('donne 8 pt de hauteur a la gouttiere de progression', () => {
    expect(style(gouttiereDeBarre(rendre({ stepCount: 5, stepIndex: 2 }))).height).toBe(8);
  });

  it("n'affiche NI compteur NI barre quand stepIndex est absent", () => {
    // C'est exactement le tunnel Historique sportif : 7 ecrans sur 59 ne passent
    // ni stepIndex ni stepCount. Les 52 autres en passent deux. 52 / 7.
    const arbre = rendre({});

    expect(textesVisibles(arbre).some((texte) => texte.startsWith('Étape'))).toBe(false);
    expect(remplissageDeBarre(arbre)).toBeUndefined();
    expect(gouttiereDeBarre(arbre)).toBeUndefined();
  });

  it("n'affiche rien non plus quand stepCount vaut 0 ou n'est pas un nombre", () => {
    expect(remplissageDeBarre(rendre({ stepCount: 0, stepIndex: 1 }))).toBeUndefined();
    expect(remplissageDeBarre(rendre({ stepCount: 'beaucoup', stepIndex: 1 }))).toBeUndefined();
  });

  it('accepte des valeurs en chaine, et affiche alors la chaine telle quelle', () => {
    // Le compteur lit les props BRUTES (l.226-227) tandis que la barre lit leur
    // conversion en nombre (l.106-113) : les deux lectures cohabitent.
    const arbre = rendre({ stepCount: '5', stepIndex: '2' });

    expect(textesVisibles(arbre)).toContain('Étape 2/5');
    expect(remplissageDeBarre(arbre).props.style.width).toBe('40%');
  });

  it('allume la progression pour stepIndex={null} — Number(null) vaut 0, pas NaN', () => {
    // DEFAUT DECRIT, PAS ENDOSSE : un ecran qui passe explicitement null croit
    // eteindre la progression et obtient une barre a 0 % avec « Étape null/N ».
    // Aucun ecran ne le fait aujourd'hui ; le figer empeche de le decouvrir un
    // jour comme une regression de ce lot.
    const arbre = rendre({ stepCount: 5, stepIndex: null });

    expect(remplissageDeBarre(arbre).props.style.width).toBe('0%');
    expect(textesVisibles(arbre)).toContain('Étape null/5');
  });
});

describe('WizardStepLayout — le bouton d action principal', () => {
  it('porte « Suivant » par defaut, et le libelle fourni sinon', () => {
    expect(textesVisibles(rendre({ onNext: jest.fn() }))).toContain('Suivant');
    expect(textesVisibles(rendre({ nextLabel: 'Publier', onNext: jest.fn() })))
      .toContain('Publier');
  });

  it("n'affiche aucun bouton principal quand onNext est absent", () => {
    rendre({});
    expect(propsDuBouton).toHaveLength(0);
    expect(textesVisibles(rendre({}))).not.toContain('Suivant');
  });

  it('transmet la desactivation et le chargement, et se declenche au repos', () => {
    const onNext = jest.fn();
    const arbre = rendre({ onNext });

    expect(propsDuBouton[0].disabled).toBe(false);
    expect(propsDuBouton[0].isLoading).toBe(false);

    appuyerSurLeTexte(arbre, 'Suivant');
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('marque le bouton desactive quand isNextDisabled est vrai', () => {
    rendre({ isNextDisabled: true, onNext: jest.fn() });
    expect(propsDuBouton[0].disabled).toBe(true);
  });

  it('marque le bouton en chargement quand isNextLoading est vrai', () => {
    rendre({ isNextLoading: true, onNext: jest.fn() });
    expect(propsDuBouton[0].isLoading).toBe(true);
  });

  it("propose « Passer cette étape » seulement si showSkip est demande", () => {
    const onSkip = jest.fn();
    const arbre = rendre({ onSkip, showSkip: true });

    expect(textesVisibles(arbre)).toContain('Passer cette étape');
    expect(textesVisibles(rendre({ onSkip }))).not.toContain('Passer cette étape');

    expect(textesVisibles(rendre({ onSkip, showSkip: true, skipLabel: 'Plus tard' })))
      .toContain('Plus tard');
  });
});

describe('WizardStepLayout — le retour et la fermeture', () => {
  it('affiche le retour quand onBack est fourni, et le declenche a l appui', () => {
    const onBack = jest.fn();
    const arbre = rendre({ onBack });

    expect(pressableNomme(arbre, 'Retour')).toBeDefined();
    appuyerSurLeBoutonNomme(arbre, 'Retour');
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("n'affiche aucun retour quand onBack est absent", () => {
    expect(pressableNomme(rendre({}), 'Retour')).toBeUndefined();
  });

  it('affiche la fermeture quand onClose est fourni, et la declenche a l appui', () => {
    const onClose = jest.fn();
    const arbre = rendre({ onClose });

    expect(pressableNomme(arbre, 'Fermer')).toBeDefined();
    appuyerSurLeBoutonNomme(arbre, 'Fermer');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("n'affiche aucune fermeture quand onClose est absent", () => {
    expect(pressableNomme(rendre({}), 'Fermer')).toBeUndefined();
  });

  it('donne 40 pt de cible tactile aux deux boutons ronds', () => {
    // La maquette des deux packs de design en demande 44 : ce chiffre est donc
    // le temoin qui dira si un tunnel a bascule ou non.
    const arbre = rendre({ onBack: jest.fn(), onClose: jest.fn() });

    expect(style(pressableNomme(arbre, 'Retour')).height).toBe(40);
    expect(style(pressableNomme(arbre, 'Retour')).width).toBe(40);
    expect(style(pressableNomme(arbre, 'Fermer')).height).toBe(40);
  });
});
