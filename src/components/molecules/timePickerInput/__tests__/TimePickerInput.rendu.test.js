import { createElement } from 'react';
import { Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TimePickerInput from '../TimePickerInput';

// Filet D19 (E6) — ce que le selecteur d'heure MONTE, avant qu'on touche a sa
// mise en page. Le fichier n'avait aucun test : la regle impose donc d'ecrire
// d'abord ce qu'il fait aujourd'hui.
//
// Motif du lot : a la recette du 2026-08-07, Adel constate que « les colonnes du
// selecteur d'heure sont mal alignees et mal centrees » dans l'etape
// « Date & horaire ». Deux attentes de ce fichier sont donc ECRITES POUR ROUGIR
// puis INVERSEES ; le motif de chaque inversion est ecrit sur place.
//
// ⚠️ CE QUE CE FICHIER NE PROUVE PAS, et il faut le dire : Jest ne mesure aucun
// pixel. Il epingle les CONTRAINTES DE MISE EN PAGE passees au composant natif,
// pas le rendu. Le rendu se constate sur un telephone.

/** Les proprietes recues par le selecteur natif, dans l'ordre du rendu. */
const mockRoues = [];

// Le selecteur natif ne se monte pas dans Jest : on le double par une sonde qui
// releve ses proprietes et ne rend rien.
jest.mock('@react-native-community/datetimepicker', () => function RoueMock(
  /** @type {any} */ props,
) {
  mockRoues.push(props);
  return null;
});

// Le VRAI theme, sans le contexte React qui le porte. ⛔ Jamais un Proxy : les
// echecs Jest deviennent illisibles.
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

/**
 * Tous les textes rendus sous un noeud de l'arbre de test.
 * @param {any} noeud Noeud de depart.
 * @returns {string[]} Les textes, dans l'ordre du rendu.
 */
const textesSous = (noeud) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      sortie.push(String(enfant));
      return;
    }
    if (Array.isArray(enfant)) {
      enfant.forEach(parcourir);
      return;
    }
    if (enfant?.children) enfant.children.forEach(parcourir);
  };
  parcourir(noeud.children);
  return sortie;
};

/**
 * Aplatit un style RN (tableau, valeurs nulles) en un seul objet.
 * @param {any} style Style tel que passe au composant.
 * @returns {Record<string, any>} Le style resolu.
 */
const styleAplati = (style) => (Array.isArray(style)
  ? style.filter(Boolean).reduce((acc, part) => ({ ...acc, ...styleAplati(part) }), {})
  : (style || {}));

/** @type {any} */
let arbre;
/** Les heures rendues par `onChange`, dans l'ordre. */
let heuresRendues = [];

/**
 * Monte le champ et rend de quoi l'inspecter.
 * @param {any} [props] Proprietes supplementaires.
 * @returns {{ pressables: any[], textes: string[] }} L'ecran monte.
 */
const afficherLeChamp = (props = {}) => {
  mockRoues.length = 0;
  heuresRendues = [];

  act(() => {
    arbre = renderer.create(createElement(TimePickerInput, {
      label: 'Heure de début',
      onChange: (/** @type {string} */ heure) => heuresRendues.push(heure),
      value: '09:30',
      ...props,
    }));
  });

  return {
    pressables: arbre.root.findAll(
      (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function',
      { deep: true },
    ),
    textes: textesSous(arbre.root),
  };
};

/**
 * Presse le premier pressable portant ce texte visible.
 * @param {string} libelle Texte visible du pressable.
 */
const presserLeTexte = (libelle) => {
  const pressables = arbre.root.findAll(
    (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function',
    { deep: true },
  );
  const cible = pressables.find((noeud) => textesSous(noeud).includes(libelle));
  if (!cible) {
    const vus = pressables.map((noeud) => textesSous(noeud).join('|')).filter(Boolean);
    throw new Error(
      `aucun pressable ne porte le texte « ${libelle} ». Pressables vus : ${JSON.stringify(vus)}`,
    );
  }
  act(() => cible.props.onPress());
};

/** Les dernieres proprietes recues par la roue native. */
const derniereRoue = () => mockRoues[mockRoues.length - 1];

/** L'entete de la feuille : la rangee qui porte « Annuler » et « OK ». */
const enteteDeLaFeuille = () => arbre.root.findAll(
  (/** @type {any} */ noeud) => {
    const textes = textesSous(noeud);
    return textes.includes('Annuler') && textes.includes('OK') && !noeud.props?.onPress;
  },
  { deep: true },
).pop();

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('D19 — le selecteur d heure, etat du 2026-08-07', () => {
  test('ferme, il montre son libelle et son heure', () => {
    const { textes } = afficherLeChamp();

    expect(textes).toContain('Heure de début');
    expect(textes).toContain('09:30');
    // Rien n'est monte tant qu'on n'a pas ouvert : la roue coute cher.
    expect(mockRoues).toHaveLength(0);
  });

  test('sans valeur, il montre le gabarit de saisie', () => {
    const { textes } = afficherLeChamp({ value: '' });

    expect(textes).toContain('HH:mm');
  });

  test('toucher le champ ouvre la feuille : Annuler, le libelle, OK', () => {
    afficherLeChamp();

    presserLeTexte('09:30');

    const textes = textesSous(arbre.root);
    expect(textes).toContain('Annuler');
    expect(textes).toContain('OK');
    expect(mockRoues.length).toBeGreaterThan(0);
  });

  test('la roue est une roue FRANCAISE, au pas de 5 minutes', () => {
    afficherLeChamp();

    presserLeTexte('09:30');

    expect(derniereRoue().display).toBe('spinner');
    expect(derniereRoue().mode).toBe('time');
    expect(derniereRoue().locale).toBe('fr-FR');
    expect(derniereRoue().minuteInterval).toBe(5);
  });

  test('elle s ouvre sur l heure deja saisie', () => {
    afficherLeChamp();

    presserLeTexte('09:30');

    expect(derniereRoue().value.getHours()).toBe(9);
    expect(derniereRoue().value.getMinutes()).toBe(30);
  });

  // SAIS (08/10, décision d'Adel « heure A ») — sur iPhone, tourner ne fait que bouger la roue ;
  // c'est « OK » qui ÉCRIT (avant : chaque cran écrivait, et « OK » sans tourner n'écrivait rien).
  test('tourner la roue puis « OK » rend l heure au format HH:mm', () => {
    afficherLeChamp();
    presserLeTexte('09:30');

    const choisie = new Date();
    choisie.setHours(7, 5, 0, 0);
    act(() => derniereRoue().onChange({}, choisie));
    expect(heuresRendues).toEqual([]);

    const ok = arbre.root.findAll(
      (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
        && textesSous(noeud).includes('OK'),
      { deep: true },
    ).pop();
    act(() => ok.props.onPress());

    expect(heuresRendues).toEqual(['07:05']);
  });

  test('« OK » referme la feuille', () => {
    afficherLeChamp();
    presserLeTexte('09:30');

    presserLeTexte('OK');

    expect(textesSous(arbre.root)).not.toContain('Annuler');
  });

  // INVERSE PAR D19 — motif : le selecteur natif SE MESURE TOUT SEUL. Sa vue
  // d'ombre porte une fonction de mesure Yoga qui interroge `sizeThatFits` du
  // UIDatePicker (`RNDateTimePickerShadowView.m:71`, dans le paquet installe).
  // AVANT ce lot, le code lui imposait `height: 200` et ne lui donnait aucun
  // `alignSelf` : la roue etait donc comprimee sous sa hauteur naturelle ET
  // etiree sur toute la largeur de la feuille, alors que ses colonnes gardent
  // leur largeur propre. C'est la contrainte, pas le composant natif, qui
  // decentre. On rend la main a la mesure native : une SUPPRESSION de
  // contrainte, pas un reglage a la main.
  // ⚠️ Ce test epingle la contrainte passee, PAS le pixel rendu.
  test('la roue est laissee A SA TAILLE NATURELLE, et centree', () => {
    afficherLeChamp();

    presserLeTexte('09:30');

    const style = styleAplati(derniereRoue().style);
    expect(style.height).toBeUndefined();
    expect(style.alignSelf).toBe('center');
  });

  // INVERSE PAR D19 — motif : le titre de la feuille etait pose entre « Annuler »
  // et « OK » par un simple `justifySpaceBetween`. Trois enfants de largeurs
  // differentes ⇒ le titre tombe la ou l'espace restant le pousse, jamais au
  // centre. Trois tiers egaux le centrent pour de bon.
  test('le titre de la feuille est VRAIMENT au centre, pas « entre les deux »', () => {
    afficherLeChamp();

    presserLeTexte('09:30');

    const entete = enteteDeLaFeuille();
    expect(styleAplati(entete.props.style).justifyContent).toBeUndefined();

    const titre = entete.findAll(
      (/** @type {any} */ noeud) => textesSous(noeud).includes('Heure de début'),
      { deep: true },
    ).pop();
    expect(styleAplati(titre.props.style).textAlign).toBe('center');
    expect(styleAplati(titre.props.style).flex).toBe(1);
  });
});

// FINITIONS16 · POINT 6 (tranche `heure oui`, 06/10) — LE SELECTEUR D'HEURE ETAIT INERTE SUR LE
// SITE, comme celui des dates (point 3) : la roue ne se montait que sur iOS et Android. 11 champs
// du site (assistant de creation d'evenement, creneaux et conditions de match amical, tournoi).
// Sur le site : un vrai champ d'heure du navigateur. ROUGE avant.
describe('FINITIONS16 6 — sur le site, un vrai champ d heure du navigateur', () => {
  const osDOrigine = Platform.OS;
  const champDHeure = () => arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.type === 'input' && noeud.props.type === 'time',
  );

  beforeEach(() => {
    Platform.OS = 'web';
  });

  afterEach(() => {
    Platform.OS = osDOrigine;
  });

  test('🔴 le champ d heure est la, sans appui prealable, sur l heure saisie', () => {
    afficherLeChamp();

    expect(champDHeure()).toHaveLength(1);
    expect(champDHeure()[0].props.value).toBe('09:30');
    expect(mockRoues).toHaveLength(0);
  });

  test('🔴 sans valeur, le champ est vide (le navigateur montre --:--)', () => {
    afficherLeChamp({ value: '' });

    expect(champDHeure()[0].props.value).toBe('');
  });

  test('🔴 un choix rend HH:mm, comme la roue ; vider rend une chaine vide', () => {
    afficherLeChamp();

    act(() => { champDHeure()[0].props.onChange({ currentTarget: { value: '19:05' } }); });
    act(() => { champDHeure()[0].props.onChange({ currentTarget: { value: '' } }); });

    expect(heuresRendues).toEqual(['19:05', '']);
  });

  test('🔴 le champ porte le libelle (lecteur d ecran) ; le libelle reste visible', () => {
    const { textes } = afficherLeChamp();

    expect(champDHeure()[0].props['aria-label']).toBe('Heure de début');
    expect(textes).toContain('Heure de début');
  });
});

// T19 (08/10, téléphone Android, « Attribuer un créneau ») — « CANCEL » sur le
// sélecteur natif ÉCRIVAIT l'heure du moment dans le champ (17:30 ⇒ 02:00).
// La bibliothèque rappelle `onChange` aussi à la fermeture, avec
// `{ type: 'dismissed' }` et la valeur d'origine : le champ ne regardait pas le
// type. Annuler ne doit RIEN écrire ; choisir (« set ») écrit l'heure choisie.
describe('T19 — Android : « Annuler » sur le sélecteur natif n écrit rien', () => {
  const osDOrigine = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'android';
  });

  afterEach(() => {
    Platform.OS = osDOrigine;
  });

  test('🔴 fermer le sélecteur (dismissed) ne change pas le champ', () => {
    afficherLeChamp({ value: '' });
    presserLeTexte('HH:mm');
    const maintenant = new Date();
    act(() => derniereRoue().onChange({ type: 'dismissed' }, maintenant));

    expect(heuresRendues).toEqual([]);
  });

  test('choisir une heure (set) l écrit au format HH:mm', () => {
    afficherLeChamp({ value: '17:30' });
    presserLeTexte('17:30');
    const choisie = new Date(2026, 9, 8, 18, 45, 0, 0);
    act(() => derniereRoue().onChange({ type: 'set' }, choisie));

    expect(heuresRendues).toEqual(['18:45']);
  });
});
