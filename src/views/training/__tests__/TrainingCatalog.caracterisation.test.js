import { ScrollView, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import TrainingCatalog from '../TrainingCatalog';

/**
 * « RECHERCHER UN ENTRAINEMENT » — FILET DE CARACTERISATION (E6).
 *
 * 🔎 POURQUOI CE FICHIER EXISTE : cet ecran n'avait AUCUN test, et le pack de
 * design le reecrit. La regle du projet est mecanique : sur un fichier sans
 * filet, on ecrit d'abord un temoin qui decrit le comportement ACTUEL, ensuite
 * seulement on touche. Sans lui, rien ne dirait qu'une branche retiree servait.
 *
 * CE QUE CE FILET FIGE, et qui ne doit PAS bouger quand la peinture change :
 *   1. l'entete (titre + sous-titre) est HORS de l'enveloppe de donnees : elle
 *      reste affichee en chargement comme en erreur ;
 *   2. une carte tactile par programme, dans l'ORDRE rendu par le serveur ;
 *   3. ce que porte une carte : titre, sous-titre facultatif, deux compteurs,
 *      un niveau — avec leurs valeurs de repli quand la donnee manque ;
 *   4. la pastille « en cours » ne se pose que sur le programme deja suivi ;
 *   5. toucher une carte ouvre le detail de CE programme-la ;
 *   6. liste vide, absente ou pas encore chargee : le meme etat vide, et il est
 *      SANS BOUTON — c'est un cul-de-sac, et c'est une information a savoir
 *      avant de refondre l'ecran ;
 *   7. l'ecran ne peint NI chargement NI erreur lui-meme : il delegue les deux
 *      a l'enveloppe partagee, en lui donnant de quoi reessayer.
 *
 * ⛔ Aucun temoin ne regarde une couleur ni une marge : la peinture va changer.
 */

/** @type {any} */
let mockCatalogue;
/** @type {any} */
let mockMonEntrainement;
/** @type {any[]} */
let mockPropsEnveloppe = [];

jest.mock('@/hooks/useTraining', () => ({
  useMyTraining: () => mockMonEntrainement,
  useTrainingCatalog: () => mockCatalogue,
}));

jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const genererStyle = jest.requireActual('@/theme/applicationStyle').default;
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();

  // Le vrai theme rend cinq objets, pas trois : l'etat vide passe par
  // `ApplicationStyle` et `Alignments`, et il tombe sans eux. On sert donc le
  // theme REEL, pas une version amputee.
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

// La traduction rend la CLE, et colle ses variables derriere une barre : c'est
// ce qui permet de verifier qu'un compteur absent devient bien 0 et non `NaN`.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ clef, /** @type {any} */ options) => (
      options ? `${clef}|${JSON.stringify(options)}` : clef
    ),
  }),
}));

// Le gabarit d'ecran pose un fond et des marges : rien a observer ici, et il
// tire des dependances natives (degrade, image de fond, retraits systeme).
jest.mock('@/components/templates/ScreenContainer', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }) => reactActuel.createElement(VueRN, null, children),
  };
});

// L'enveloppe de donnees est remplacee par un MOUCHARD : elle rend toujours ses
// enfants, et retient ce qu'on lui a passe. C'est le seul moyen de figer le
// chargement et l'erreur, puisque l'ecran ne les peint pas lui-meme — il les
// delegue entierement. On mesure donc la DELEGATION, pas le dessin du voisin.
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

const PROGRAMMES = [
  {
    documentId: 'prog-a',
    level: 'debutant',
    sessionsCount: 8,
    subtitle: 'Huit journees pour reprendre',
    testsCount: 4,
    title: 'Reprise athletique',
  },
  {
    documentId: 'prog-b',
    level: 'avance',
    sessionsCount: 12,
    subtitle: 'Vitesse et detente',
    testsCount: 6,
    title: 'Explosivite',
  },
  // Le troisieme est VOLONTAIREMENT nu : ni sous-titre, ni compteurs, ni
  // niveau. C'est le cas limite que le serveur produit des qu'un programme est
  // publie sans son contenu, et l'ecran ne doit pas tomber dessus.
  { documentId: 'prog-c', title: 'Programme nu' },
];

const CATALOGUE_PLEIN = {
  data: PROGRAMMES, error: null, isLoading: false, refetch: () => {},
};
const SANS_INSCRIPTION = { enrollment: null };
const INSCRIT_SUR_B = { enrollment: { program: { documentId: 'prog-b' } } };

/**
 * Monte l'ecran et rend l'arbre de test.
 * @param {any} [catalogue] ce que rend le crochet `useTrainingCatalog`
 * @param {any} [entrainement] ce que rend le crochet `useMyTraining`
 * @param {any} [navigation] la navigation moquee
 * @returns {any} l'arbre react-test-renderer
 */
const rendre = (
  catalogue = CATALOGUE_PLEIN,
  entrainement = SANS_INSCRIPTION,
  navigation = { navigate: () => {} },
) => {
  mockCatalogue = catalogue;
  mockMonEntrainement = entrainement;
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<TrainingCatalog navigation={navigation} />);
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

/**
 * Les chaines rendues sous UN noeud de l'arbre, via ses `Text`.
 *
 * Sert a distinguer ce qui est DANS la zone qui defile de ce qui reste fixe :
 * `toJSON()` mettrait tout a plat sans dire ou ca vit.
 * @param {any} noeud une instance de test (root, ou un enfant trouve)
 * @returns {string[]} les chaines portees par les `Text` de ce sous-arbre
 */
const textesSous = (noeud) => noeud
  .findAllByType(Text)
  .flatMap((/** @type {any} */ t) => [].concat(t.props.children ?? []))
  .filter((/** @type {any} */ v) => typeof v === 'string');

beforeEach(() => { mockPropsEnveloppe = []; });

describe('l entete du catalogue ne depend d aucune donnee', () => {
  it('affiche son titre et son sous-titre des le montage', () => {
    expect(textes(rendre())).toEqual(expect.arrayContaining([
      'training.catalog.title', 'training.catalog.subtitle',
    ]));
  });

  it('garde son entete meme quand la requete est en erreur', () => {
    // L'entete est ECRITE HORS de l'enveloppe de donnees. C'est ce qui evite
    // qu'un hoquet reseau laisse le joueur devant un ecran anonyme.
    const enErreur = {
      data: undefined, error: new Error('reseau'), isLoading: false, refetch: () => {},
    };

    expect(textes(rendre(enErreur))).toContain('training.catalog.title');
  });
});

describe('une carte tactile par programme, dans l ordre du serveur', () => {
  it('rend autant de cartes que de programmes, et rien de plus', () => {
    // L'etat vide de cet ecran ne pose AUCUN bouton : le compte des zones
    // tactiles est donc exactement le compte des programmes.
    expect(rendre().root.findAllByType(TouchableOpacity))
      .toHaveLength(PROGRAMMES.length);
  });

  it('n applique AUCUN tri : l ordre affiche est celui recu', () => {
    const titres = textes(rendre())
      .filter((v) => ['Explosivite', 'Programme nu', 'Reprise athletique'].includes(v));

    expect(titres).toEqual(['Reprise athletique', 'Explosivite', 'Programme nu']);
  });

  it('affiche le titre, le sous-titre, les deux compteurs et le niveau', () => {
    expect(textes(rendre())).toEqual(expect.arrayContaining([
      'Reprise athletique',
      'Huit journees pour reprendre',
      'training.program.days|{"count":8}',
      'training.program.tests|{"count":4}',
      'training.program.level.debutant',
    ]));
  });
});

describe('un programme nu ne fait pas tomber l ecran', () => {
  it('remplace les compteurs absents par 0 et le niveau absent par « intermediaire »', () => {
    // 🪤 Le repli est ecrit avec `||` : un compteur a 0 comme un compteur absent
    // donnent la MEME chaine. Un futur `??` changerait ce comportement.
    expect(textes(rendre())).toEqual(expect.arrayContaining([
      'training.program.days|{"count":0}',
      'training.program.tests|{"count":0}',
      'training.program.level.intermediaire',
    ]));
  });

  it('n affiche PAS de ligne de sous-titre quand il n y en a pas', () => {
    const cartes = rendre().root.findAllByType(TouchableOpacity);

    // Carte pleine : titre + sous-titre + 3 etiquettes. Carte nue : titre + 3.
    expect(textesSous(cartes[0])).toHaveLength(5);
    expect(textesSous(cartes[2])).toHaveLength(4);
  });
});

describe('la pastille dit lequel on suit deja', () => {
  it('ne se pose que sur le programme suivi, et une seule fois', () => {
    const vus = textes(rendre(CATALOGUE_PLEIN, INSCRIT_SUR_B));
    const cartes = rendre(CATALOGUE_PLEIN, INSCRIT_SUR_B).root
      .findAllByType(TouchableOpacity);

    expect(vus.filter((v) => v === 'training.status.in_progress')).toHaveLength(1);
    expect(textesSous(cartes[1])).toContain('training.status.in_progress');
  });

  it('n en pose AUCUNE quand on ne suit aucun programme', () => {
    // `enrollment` vaut `null` tant que le joueur n'a rien choisi : la chaine
    // optionnelle rend alors `undefined`, qu'aucun `documentId` n'egale.
    expect(textes(rendre(CATALOGUE_PLEIN, SANS_INSCRIPTION)))
      .not.toContain('training.status.in_progress');
  });
});

describe('toucher une carte ouvre le detail de CE programme', () => {
  it('navigue avec l identifiant ET le titre du programme touche', () => {
    // Le titre voyage en parametre parce que l'entete de l'ecran suivant
    // l'affiche avant meme d'avoir charge quoi que ce soit.
    const navigate = jest.fn();
    const arbre = rendre(CATALOGUE_PLEIN, SANS_INSCRIPTION, { navigate });

    act(() => { arbre.root.findAllByType(TouchableOpacity)[1].props.onPress(); });

    expect(navigate).toHaveBeenCalledWith(
      RouteNames.TrainingProgramDetail,
      { programId: 'prog-b', title: 'Explosivite' },
    );
  });
});

describe('l etat vide, et ce qu il ne propose PAS', () => {
  /**
   * Les trois formes que prend « aucun programme a montrer ».
   * @param {any} donnees ce que le crochet met dans `data`
   * @returns {any} le retour complet du crochet du catalogue
   */
  const catalogueAvec = (donnees) => ({
    data: donnees, error: null, isLoading: false, refetch: () => {},
  });

  it.each([
    ['une liste vide', []],
    ['une donnee jamais arrivee', undefined],
    ['une donnee qui n est pas une liste', null],
  ])('affiche l etat vide pour %s', (_libelle, donnees) => {
    const arbre = rendre(catalogueAvec(donnees));

    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'training.catalog.empty.title', 'training.catalog.empty.description',
    ]));
  });

  it('⛔ est un CUL-DE-SAC : aucun bouton, aucune sortie depuis l etat vide', () => {
    // 🧨 A savoir AVANT de refondre : `EmptyState` sait rendre un bouton
    // (`actionLabel` + `onAction`), mais l'ecran ne lui en donne pas. Quelqu'un
    // qui arrive ici sans programme publie n'a que le retour systeme.
    expect(rendre(catalogueAvec([])).root.findAllByType(TouchableOpacity))
      .toHaveLength(0);
  });
});

describe('chargement et erreur sont DELEGUES, jamais peints ici', () => {
  it('passe l attente, l erreur et la relance a l enveloppe partagee', () => {
    const refetch = jest.fn();
    rendre({
      data: undefined, error: null, isLoading: true, refetch,
    });

    expect(mockPropsEnveloppe).toHaveLength(1);
    expect(mockPropsEnveloppe[0]).toMatchObject({ error: null, isLoading: true });
    // La relance est celle du CATALOGUE, pas un rechargement global : c'est
    // elle qui rend le bouton « Reessayer » actif au lieu d'inerte.
    expect(mockPropsEnveloppe[0].onRetry).toBe(refetch);
  });

  it('transmet l erreur telle quelle, sans la traduire ni la remplacer', () => {
    const panne = new Error('reseau');
    rendre({
      data: undefined, error: panne, isLoading: false, refetch: () => {},
    });

    expect(mockPropsEnveloppe[0].error).toBe(panne);
  });

  it('ne pose qu UNE enveloppe : tout l ecran depend de la meme requete', () => {
    rendre();

    expect(mockPropsEnveloppe).toHaveLength(1);
  });
});

describe('la structure de defilement', () => {
  it('ne fait defiler QUE la liste : l entete reste fixe au-dessus', () => {
    // 🔎 A savoir avant de refondre : il y a UN seul defilement, et l'entete
    // (titre + sous-titre) est ECRITE EN DEHORS. Deplacer l'entete dedans, ou
    // ajouter un second defilement, changerait ce que le joueur voit en haut.
    const arbre = rendre();
    const zonesDefilantes = arbre.root.findAllByType(ScrollView);

    expect(zonesDefilantes).toHaveLength(1);
    expect(textesSous(zonesDefilantes[0])).not.toContain('training.catalog.title');
    expect(textes(arbre)).toContain('training.catalog.title');
  });
});
