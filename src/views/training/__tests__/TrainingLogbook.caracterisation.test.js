import { ScrollView, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';

import TrainingLogbook from '../TrainingLogbook';

/**
 * « MON CARNET » — FILET DE CARACTERISATION (E6).
 *
 * 🔎 POURQUOI CE FICHIER EXISTE : cinq des six ecrans de la section n'avaient
 * AUCUN test, et le pack de design les reecrit. La regle du projet est
 * mecanique : sur un fichier sans filet, on ecrit d'abord un temoin qui decrit
 * le comportement ACTUEL, ensuite seulement on touche. Sans lui, rien ne dirait
 * qu'une branche retiree servait.
 *
 * CE QUE CES TEMOINS FIGENT, et qui ne doit PAS bouger avec la peinture :
 *   1. l'entete (titre, phrase, compteur) est rendue DANS TOUS LES CAS ;
 *   2. le carnet est du texte BRUT, rendu caractere pour caractere, jamais
 *      reformate — c'est ce qui permet de le coller ailleurs puis de le
 *      reimporter ;
 *   3. il vit dans sa PROPRE boite qui defile, l'ecran lui-meme ne defile pas ;
 *   4. le bouton copie le carnet EXACT et son libelle bascule sur « copie » ;
 *   5. sans presse-papiers dans le build, l'appui ne casse rien et ne ment pas ;
 *   6. sans mesure, l'ecran montre un etat vide SANS AUCUNE porte de sortie ;
 *   7. chargement et erreur ne sont PAS dessines par l'ecran : il les delegue
 *      entierement a l'enveloppe de donnees.
 *
 * ⛔ Aucun temoin ne fige une couleur ni une marge : elles vont changer.
 */

/** @type {any} */
let mockCarnet;

/** @type {any} */
let mockPressePapiers;

/** @type {any[]} */
let mockOptionsCrochet;

/** @type {any[]} */
let mockPropsGabarit;

/** @type {any[]} */
let mockPropsEnveloppe;

// ⚠️ Jest refuse toute variable citee dans une doublure qui ne commence pas par
// « mock ». Les cinq ci-dessus portent donc ce prefixe, y compris les journaux
// de props.
jest.mock('@/hooks/useTraining', () => ({
  useTrainingExport: (/** @type {any} */ options) => {
    mockOptionsCrochet.push(options);
    return mockCarnet;
  },
}));

jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const genererStyle = jest.requireActual('@/theme/applicationStyle').default;
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();

  // Le vrai theme rend cinq objets, pas trois : `Button` lit `ApplicationStyle`
  // et tombe sans lui. On sert donc le theme REEL, pas une version amputee.
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: genererStyle(Colors),
      Colors,
      Fonts: genererPolices(Colors),
      Spaces,
    }),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ clef, /** @type {any} */ options) => (
      options ? `${clef}|${JSON.stringify(options)}` : clef
    ),
  }),
}));

// Le presse-papiers est charge A LA DEMANDE par l'ecran, dans un `try`. Cette
// doublure sert les DEUX branches de ce `try` avec une seule variable :
//   . 'ABSENT' -> l'acces au module leve, comme un build ou la dependance
//     facultative n'a pas ete embarquee ;
//   . null -> le module repond, mais sans `setString`.
jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  get default() {
    if (mockPressePapiers === 'ABSENT') throw new Error('presse-papiers absent du build');
    return mockPressePapiers;
  },
}));

// Le gabarit d'ecran pose un fond et des marges : rien a observer, et il tire
// des dependances natives. On garde ses props pour pouvoir affirmer que l'ecran
// ne demande AUCUN defilement de page.
jest.mock('@/components/templates/ScreenContainer', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => {
      mockPropsGabarit.push(props);
      return reactActuel.createElement(VueRN, null, props.children);
    },
  };
});

// L'enveloppe de donnees porte a elle seule le chargement et l'erreur. On la
// remplace par une vue qui rend toujours ses enfants ET journalise ses props :
// c'est le seul moyen d'affirmer que l'ecran DELEGUE au lieu de decider.
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => {
      mockPropsEnveloppe.push(props);
      return reactActuel.createElement(VueRN, null, props.children);
    },
  };
});

// Le format exact decrit par le guide de terrain : un en-tete, puis une mesure
// par ligne. Il est fige tel quel parce que l'ecran ne doit RIEN en changer.
const CSV = [
  'date;jour;test;mesure;unite;cote;essai;valeur;valide',
  '2026-09-06;T;sprint10m;temps;s;;1;1.72;oui',
  '2026-09-06;T;cmj;hauteur;cm;;1;38;oui',
  '2026-09-07;A;souplesse;distance;cm;gauche;1;12;non',
].join('\n');

const REMPLI = {
  data: { csv: CSV, rows: 3 },
  error: null,
  isLoading: false,
  refetch: () => {},
};

const VIDE = {
  data: { csv: '', rows: 0 },
  error: null,
  isLoading: false,
  refetch: () => {},
};

/**
 * Monte l'ecran et rend l'arbre de test.
 * @param {any} [etat] ce que rend le crochet `useTrainingExport`
 * @returns {any} l'arbre react-test-renderer
 */
const rendre = (etat = REMPLI) => {
  mockCarnet = etat;
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<TrainingLogbook />);
  });
  return arbre;
};

/**
 * Tout le texte affiche par un arbre, mis a plat.
 * @param {any} arbre l'arbre rendu
 * @returns {string[]} les chaines reellement rendues
 */
const textes = (arbre) => {
  /** @type {string[]} */
  const sortie = [];
  /**
   * Descend dans un noeud rendu et empile chaque chaine rencontree.
   * @param {any} noeud un noeud de l'arbre rendu
   * @returns {void} rien : la sortie est empilee dans `sortie`
   */
  const parcourir = (noeud) => {
    if (typeof noeud === 'string') { sortie.push(noeud); return; }
    if (Array.isArray(noeud)) { noeud.forEach(parcourir); return; }
    if (noeud && noeud.children) noeud.children.forEach(parcourir);
  };
  parcourir(arbre.toJSON());
  return sortie;
};

beforeEach(() => {
  mockOptionsCrochet = [];
  mockPropsGabarit = [];
  mockPropsEnveloppe = [];
  mockPressePapiers = { setString: jest.fn() };
});

describe('l entete est rendue dans TOUS les cas', () => {
  it('affiche le titre, la phrase d explication et le compteur de mesures', () => {
    const vus = textes(rendre());

    expect(vus).toContain('training.logbook.title');
    expect(vus).toContain('training.logbook.description');
    // Le compteur passe par `count` : c'est lui qui choisit le pluriel.
    expect(vus).toContain('training.logbook.rows|{"count":3}');
  });

  it('garde le compteur quand le carnet est vide, et il annonce ZERO', () => {
    // Ce temoin dit qu'un carnet vide n'efface pas l'entete : le joueur voit
    // toujours de quoi on parle, pas seulement un pave « rien ici ».
    expect(textes(rendre(VIDE))).toContain('training.logbook.rows|{"count":0}');
  });

  it('demande le carnet des l ouverture, sans condition', () => {
    rendre();

    // `enabled: true` en dur : l'ecran ne differe pas sa requete. Si la refonte
    // le rend paresseux, ce temoin doit changer volontairement.
    expect(mockOptionsCrochet[0]).toEqual({ enabled: true });
  });
});

describe('le carnet rempli', () => {
  it('rend le texte BRUT tel quel, caractere pour caractere', () => {
    // 🔒 LE TEMOIN LE PLUS IMPORTANT DU FICHIER : tout l'interet du carnet est
    // d'etre collable ailleurs puis reimportable. Un « joli tableau » qui
    // remplacerait ce texte casserait l'usage sans casser aucun autre temoin.
    expect(textes(rendre())).toContain(CSV);
  });

  it('laisse le texte selectionnable a la main', () => {
    // Seul recours quand le presse-papiers n'est pas dans le build : sans
    // `selectable`, l'ecran deviendrait un cul-de-sac sur ces appareils.
    const selectionnables = rendre().root.findAll(
      (/** @type {any} */ noeud) => noeud.props?.selectable === true,
    );

    expect(selectionnables.length).toBeGreaterThan(0);
    expect(selectionnables[0].props.children).toBe(CSV);
  });

  it('enferme le carnet dans sa propre boite, qui defile dans les deux sens', () => {
    // Deux defilements IMBRIQUES : l'exterieur horizontal (les lignes sont
    // longues), l'interieur vertical. La boite est bornee en hauteur, sinon
    // elle pousserait le bouton hors de l'ecran — et l'ecran, lui, ne defile
    // pas (voir le temoin suivant).
    const boites = rendre().root.findAllByType(ScrollView);

    expect(boites).toHaveLength(2);
    expect(boites[0].props.horizontal).toBe(true);
    expect(boites[1].props.horizontal).toBeFalsy();
    expect(typeof boites[0].props.style.maxHeight).toBe('number');
  });

  it('n offre qu UNE seule zone cliquable : le bouton de copie', () => {
    const arbre = rendre();

    expect(arbre.root.findAllByType(Button)).toHaveLength(1);
    expect(arbre.root.findByType(Button).props.title)
      .toBe('training.actions.copyLogbook');
  });

  it('n affiche PAS l etat vide quand il y a des mesures', () => {
    expect(rendre().root.findAllByType(EmptyState)).toHaveLength(0);
  });
});

describe('l ecran lui-meme ne defile pas et n a aucun champ de saisie', () => {
  it('demande un fond, et AUCUN defilement de page', () => {
    // ⚠️ A savoir avant la refonte : le gabarit ne defile QUE si on lui passe
    // `keyboardScroll`. Tout bloc ajoute sous le bouton deviendra donc
    // inatteignable sur un petit telephone.
    rendre();

    expect(mockPropsGabarit[0].bgImage).toBe('bg2');
    expect(mockPropsGabarit[0].keyboardScroll).toBeUndefined();
    expect(mockPropsGabarit[0].keyboardAvoiding).toBeUndefined();
  });

  it('ne pose aucun champ de saisie : la question du clavier ne se pose pas', () => {
    expect(rendre().root.findAllByType(TextInput)).toHaveLength(0);
  });
});

describe('copier le carnet', () => {
  it('pousse le carnet EXACT dans le presse-papiers et bascule le libelle', () => {
    const arbre = rendre();

    act(() => { arbre.root.findByType(Button).props.onPress(); });

    expect(mockPressePapiers.setString).toHaveBeenCalledWith(CSV);
    expect(arbre.root.findByType(Button).props.title).toBe('training.logbook.copied');
  });

  it('garde « copie » meme apres que le carnet a change', () => {
    // 🪤 L'etat `copied` ne se reinitialise JAMAIS : une fois vrai, il reste
    // vrai pour la duree de vie de l'ecran, meme si les mesures ont ete
    // rechargees depuis. C'est le comportement actuel, fige tel quel.
    const arbre = rendre();

    act(() => { arbre.root.findByType(Button).props.onPress(); });
    mockCarnet = { ...REMPLI, data: { csv: 'date;jour\n2026-09-08;B', rows: 1 } };
    act(() => { arbre.update(<TrainingLogbook />); });

    expect(arbre.root.findByType(Button).props.title).toBe('training.logbook.copied');
  });

  it('ne casse pas quand le presse-papiers n est pas dans le build', () => {
    // La dependance est facultative dans ce depot. L'appui doit rester
    // silencieux : pas d'exception, et surtout pas de « copie » mensonger.
    mockPressePapiers = 'ABSENT';
    const arbre = rendre();

    act(() => { arbre.root.findByType(Button).props.onPress(); });

    expect(arbre.root.findByType(Button).props.title)
      .toBe('training.actions.copyLogbook');
  });

  it('ne casse pas quand le module repond sans savoir ecrire', () => {
    mockPressePapiers = null;
    const arbre = rendre();

    act(() => { arbre.root.findByType(Button).props.onPress(); });

    expect(arbre.root.findByType(Button).props.title)
      .toBe('training.actions.copyLogbook');
  });

  it('ne touche a rien quand le compteur annonce des lignes mais le texte est vide', () => {
    // Cas limite REEL : le compteur et le texte viennent de deux champs
    // separes du serveur. L'ecran affiche alors sa boite et son bouton, mais la
    // copie se garde toute seule.
    const arbre = rendre({ ...REMPLI, data: { csv: '', rows: 2 } });

    act(() => { arbre.root.findByType(Button).props.onPress(); });

    expect(mockPressePapiers.setString).not.toHaveBeenCalled();
    expect(arbre.root.findByType(Button).props.title)
      .toBe('training.actions.copyLogbook');
  });
});

describe('l etat vide', () => {
  it('remplace le carnet par un pave « aucune mesure »', () => {
    const arbre = rendre(VIDE);

    expect(arbre.root.findAllByType(EmptyState)).toHaveLength(1);
    expect(textes(arbre)).toContain('training.logbook.empty');
  });

  it('n offre AUCUNE porte de sortie : zero zone cliquable dans tout l ecran', () => {
    // ⚠️ A savoir avant la refonte : contrairement au planning, le carnet vide
    // est un cul-de-sac. Rien ne propose d'aller faire une mesure.
    expect(rendre(VIDE).root.findAllByType(Button)).toHaveLength(0);
  });

  it('n affiche ni boite ni texte de carnet', () => {
    const arbre = rendre(VIDE);

    expect(arbre.root.findAllByType(ScrollView)).toHaveLength(0);
    expect(textes(arbre)).not.toContain(CSV);
  });
});

describe('les donnees absentes ou incompletes ne font pas tomber l ecran', () => {
  it('tient debout quand le serveur n a encore rien rendu', () => {
    const arbre = rendre({
      data: undefined, error: null, isLoading: false, refetch: () => {},
    });

    expect(arbre.root.findAllByType(EmptyState)).toHaveLength(1);
    expect(textes(arbre)).toContain('training.logbook.rows|{"count":0}');
  });

  it('tient debout quand la reponse est un objet sans carnet ni compteur', () => {
    const arbre = rendre({
      data: {}, error: null, isLoading: false, refetch: () => {},
    });

    expect(arbre.root.findAllByType(EmptyState)).toHaveLength(1);
  });

  it('tient debout quand le compteur est absent mais le texte present', () => {
    // `rows` seul commande l'affichage : un carnet non vide dont le compteur
    // manque est donc rendu comme VIDE, et son texte n'apparait jamais.
    const arbre = rendre({ ...REMPLI, data: { csv: CSV } });

    expect(arbre.root.findAllByType(EmptyState)).toHaveLength(1);
    expect(textes(arbre)).not.toContain(CSV);
  });
});

describe('chargement et erreur : l ecran ne les dessine pas, il les delegue', () => {
  it('passe l attente, l erreur et la relance a l enveloppe de donnees', () => {
    const refetch = () => {};
    const erreur = new Error('reseau');
    rendre({
      data: undefined, error: erreur, isLoading: true, refetch,
    });

    expect(mockPropsEnveloppe[0].isLoading).toBe(true);
    expect(mockPropsEnveloppe[0].error).toBe(erreur);
    // La relance est celle du crochet : le bouton « Reessayer » de l'enveloppe
    // rejoue la requete du carnet, pas un balayage global.
    expect(mockPropsEnveloppe[0].onRetry).toBe(refetch);
  });

  it('n a AUCUNE branche a lui pour l attente : il construit son contenu quand meme', () => {
    // 🔎 Information a connaitre avant de refondre : il n'existe ni squelette
    // ni message d'erreur ECRIT DANS CET ECRAN. Tout vient de l'enveloppe.
    const arbre = rendre({ ...REMPLI, isLoading: true });

    expect(textes(arbre)).toContain(CSV);
  });

  it('n a AUCUNE branche a lui pour l erreur non plus', () => {
    const arbre = rendre({ ...REMPLI, error: new Error('reseau') });

    expect(textes(arbre)).toContain(CSV);
  });
});
