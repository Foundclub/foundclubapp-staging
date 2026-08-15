import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import FriendlyMatchWizardLocation from '../FriendlyMatchWizardLocation';

// Filet C-G (E6) : l'etape 4 du tunnel amical n'avait AUCUN test, et le lot lui
// ajoute une porte d'entree — choisir une installation du club plutot que de
// retaper une adresse qu'on connait deja.
//
// Le fichier est ecrit en deux etages, volontairement separes :
//   · « CE QUI NE DOIT PAS BOUGER » decrit l'ecran du 2026-08-15 AVANT le lot.
//     Il doit rester vert des DEUX cotes du lot : c'est lui la preuve que la
//     saisie libre d'une ville, seule facon de jouer ailleurs que chez soi,
//     n'a pas ete remplacee par la liste des installations.
//   · « CE QUE C-G AJOUTE » decrit la demande d'Adel du 2026-08-13.
//
// Pilote par le TEXTE VISIBLE et par ce qui part dans le brouillon, jamais par
// la forme de l'arbre.

/** @type {any[]} */
const mockPropsDuGabarit = [];
/** @type {any[]} */
const mockPropsDeLaSaisieLibre = [];
const mockEnvoyer = jest.fn();
/** @type {{ data: any, isLoading: boolean }} */
const mockReponseInstallations = { data: undefined, isLoading: false };
/** @type {any[]} */
const mockAppelsAuLecteur = [];

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

// Le mock resout dans le VRAI catalogue, jamais un objet invente : les tests de
// texte lisent donc ce que l'app affichera.
jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;

  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        if (typeof valeur === 'string') return valeur;
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend les
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
      Images: { check: 'icone-coche' },
      Spaces: espaces,
    }),
  };
});

// Le gabarit de tunnel a son propre filet (25 tests, lot D05) : un passe-plat
// qui ENREGISTRE ses props garde verifiable ce qui est un contrat entre les deux
// fichiers — le rang de l'etape et l'etat du bouton Suivant.
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockPropsDuGabarit.push(props);
  return props.children;
});

// La saisie libre tire le service de geocodage et une feuille de recherche : on
// la remplace par un passe-plat qui enregistre ses props et laisse le test
// declencher `setAddress`, c'est-a-dire « l'organisateur a tape une ville ».
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => function SaisieLibreMock(/** @type {any} */ props) {
    mockPropsDeLaSaisieLibre.push(props);
    return null;
  },
);

// LE lecteur d'installations du depot — celui que FacilitySelector utilise deja
// (meme service, meme clef de cache `['facilities', clubId]`). Le mock enregistre
// ce qu'on lui demande : un club sans installation ne doit pas declencher
// d'appel inutile, et surtout l'ecran ne doit pas se fabriquer un second lecteur.
jest.mock('@/services/facility/facilityQueries', () => ({
  useGetFacilities: (/** @type {any} */ clubId) => {
    mockAppelsAuLecteur.push(clubId);
    // Le VRAI hook porte `enabled: !!clubId` (facilityQueries.js:62) : sans club,
    // la requete ne part pas et `data` reste `undefined`. Un mock qui repondrait
    // quand meme rendrait le temoin « equipe sans club » toujours vert.
    if (!clubId) return { data: undefined, isLoading: false };
    return mockReponseInstallations;
  },
}));

const mockEtatDuBrouillon = /** @type {any} */ ({});
jest.mock('../FriendlyMatchWizardContext', () => ({
  __esModule: true,
  useFriendlyMatchWizard: () => ({
    dispatch: (/** @type {any} */ action) => mockEnvoyer(action),
    state: mockEtatDuBrouillon,
  }),
}));

const catalogueFr = require('@/theme/strings/translations/fr').default;

const CLUB_ID = 'club-1';

/** L'adresse telle que FacilityForm l'ecrit en base : une description + un point GeoJSON. */
const ADRESSE_VELODROME = {
  description: '3 Boulevard Michelet 13008 Marseille (13008)',
  geometry: { coordinates: [5.3959, 43.2699], type: 'Point' },
};

const INSTALLATIONS = [
  {
    address: ADRESSE_VELODROME,
    documentId: 'inst-velodrome',
    name: 'Stade Vélodrome',
  },
  {
    address: {
      description: '1 Rue du Gymnase 13010 Marseille (13010)',
      geometry: { coordinates: [5.42, 43.28], type: 'Point' },
    },
    documentId: 'inst-gymnase',
    name: 'Gymnase Nord',
  },
];

/**
 * Rend l'etape avec un brouillon et une reponse du lecteur d'installations.
 * @param {any} [brouillon] Ce que porte deja le brouillon.
 * @param {any[] | null} [installations] Les installations rendues par le serveur.
 * @returns {any} L'arbre rendu.
 */
const rendre = (brouillon = {}, installations = null) => {
  Object.keys(mockEtatDuBrouillon).forEach((cle) => delete mockEtatDuBrouillon[cle]);
  Object.assign(mockEtatDuBrouillon, {
    hostingPreference: 'HOST',
    installation: null,
    location: null,
    team: { club: { documentId: CLUB_ID }, documentId: 'team-1' },
    travelRadiusKm: 25,
    ...brouillon,
  });
  mockReponseInstallations.data = installations ? { data: installations } : undefined;
  mockReponseInstallations.isLoading = false;

  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(FriendlyMatchWizardLocation, { navigation }));
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
 * Les noeuds AFFICHES (pas les composites) qui satisfont le predicat. Compter
 * sur `root.findAll` compterait le meme element a chaque etage de composant.
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

/**
 * Le dernier jeu de props recu par la saisie libre d'adresse.
 * @returns {any} Les props de la saisie libre.
 */
const derniereSaisieLibre = () => mockPropsDeLaSaisieLibre[mockPropsDeLaSaisieLibre.length - 1];

beforeEach(() => {
  mockPropsDuGabarit.length = 0;
  mockPropsDeLaSaisieLibre.length = 0;
  mockAppelsAuLecteur.length = 0;
  mockEnvoyer.mockClear();
});

describe('Etape 4/7 « Où ça se passe ? » — CE QUI NE DOIT PAS BOUGER', () => {
  it('est bien la 4e etape sur 7', () => {
    rendre();
    expect(dernierGabarit().stepIndex).toBe(4);
    expect(dernierGabarit().stepCount).toBe(7);
  });

  it('pose la question et son enjeu, sans jargon', () => {
    rendre();
    expect(dernierGabarit().title).toBe('Où ça se passe ?');
    expect(dernierGabarit().subtitle)
      .toBe('Là où tu reçois, et jusqu’où les autres peuvent venir.');
  });

  it('dit autre chose a qui se deplace : c est un point de depart, pas un terrain', () => {
    rendre({ hostingPreference: 'AWAY' });
    expect(dernierGabarit().subtitle)
      .toBe('Ton point de départ, et jusqu’où tu acceptes de te déplacer.');
  });

  // 🔒 LE temoin de non-regression du lot. Un organisateur peut jouer ailleurs
  // que chez lui : la saisie libre est la seule facon de le dire.
  it('propose TOUJOURS la saisie libre d une ville, meme avec des installations', () => {
    rendre({}, INSTALLATIONS);
    expect(derniereSaisieLibre().label).toBe('Ville ou adresse');
    expect(derniereSaisieLibre().placeholder).toBe('Ex : Marseille, Stade Vélodrome...');
  });

  it('ecrit dans le brouillon la ville tapee a la main, sans installation', () => {
    const arbre = rendre({}, INSTALLATIONS);
    const villeTapee = {
      city: 'Lyon', label: 'Lyon (69000)', lat: 45.75, lng: 4.85, value: '4.85|45.75',
    };
    act(() => derniereSaisieLibre().setAddress(villeTapee));

    expect(mockEnvoyer).toHaveBeenCalledWith({
      payload: { location: villeTapee },
      type: 'SET_LOCATION_SELECTION',
    });
    expect(arbre).toBeTruthy();
  });

  // ⚠️ Le rayon dit jusqu'ou l'equipe accepte de se deplacer : ce n'est PAS le
  // lieu. Choisir une installation ne le remplace pas.
  it('garde les quatre rayons, et les garde avec des installations', () => {
    const affiches = textesVisibles(rendre({}, INSTALLATIONS));
    expect(affiches).toEqual(expect.arrayContaining(['10 km', '25 km', '50 km', '100 km']));
  });

  it('envoie le rayon choisi tel quel', () => {
    const arbre = rendre({}, INSTALLATIONS);
    appuyerSurLeTexte(arbre, '50 km');
    expect(mockEnvoyer).toHaveBeenCalledWith({ payload: 50, type: 'SET_TRAVEL_RADIUS' });
  });

  it('interdit de continuer sans lieu, et le permet des qu il y en a un', () => {
    rendre({ location: null });
    expect(dernierGabarit().isNextDisabled).toBe(true);

    rendre({ location: { label: 'Marseille', lat: 43.3, lng: 5.4 } });
    expect(dernierGabarit().isNextDisabled).toBe(false);
  });
});

describe('Etape 4/7 « Où ça se passe ? » — CE QUE C-G AJOUTE', () => {
  // ① Le temoin principal : la demande d'Adel du 2026-08-13.
  it('propose les installations du club, par leur nom', () => {
    const affiches = textesVisibles(rendre({}, INSTALLATIONS));
    expect(affiches).toContain('Stade Vélodrome');
    expect(affiches).toContain('Gymnase Nord');
  });

  it('demande les installations au club de l equipe, et a personne d autre', () => {
    rendre({}, INSTALLATIONS);
    expect(mockAppelsAuLecteur).toEqual([CLUB_ID]);
  });

  // ② Le coeur du lot : choisir une installation REMPLIT le lieu de l'annonce.
  it('choisir une installation remplit le lieu, coordonnees comprises', () => {
    const arbre = rendre({}, INSTALLATIONS);
    appuyerSurLeTexte(arbre, 'Stade Vélodrome');

    expect(mockEnvoyer).toHaveBeenCalledTimes(1);
    const { payload, type } = mockEnvoyer.mock.calls[0][0];
    expect(type).toBe('SET_LOCATION_SELECTION');
    expect(payload.installation).toEqual({
      documentId: 'inst-velodrome',
      name: 'Stade Vélodrome',
    });
    expect(payload.location).toMatchObject({
      label: '3 Boulevard Michelet 13008 Marseille (13008)',
      lat: 43.2699,
      lng: 5.3959,
    });
  });

  // 🧨 Le format du lieu est un CONTRAT avec le serveur : il derive `city` et
  // `geohash` de `location` (lifecycles.ts:62-91). Une adresse d'installation
  // envoyee telle quelle — `{ description, geometry }` — ne lui donne NI l'un
  // NI l'autre, et l'annonce sort de tous les tris par distance sans un mot.
  it('envoie le lieu dans le MEME format que la saisie libre, pas celui de la base', () => {
    const arbre = rendre({}, INSTALLATIONS);
    appuyerSurLeTexte(arbre, 'Stade Vélodrome');
    const { location } = mockEnvoyer.mock.calls[0][0].payload;

    expect(location).not.toHaveProperty('description');
    expect(location).not.toHaveProperty('geometry');
    expect(location.value).toBe('5.3959|43.2699');
    expect(Object.keys(location).sort()).toEqual(
      ['city', 'context', 'label', 'lat', 'lng', 'postcode', 'value'],
    );
  });

  it('marque l installation choisie, et une seule', () => {
    const arbre = rendre(
      { installation: { documentId: 'inst-gymnase', name: 'Gymnase Nord' } },
      INSTALLATIONS,
    );
    // Cible les pastilles D'INSTALLATION, pas celles du rayon : « 25 km » est
    // selectionne par defaut, et il compterait dans le total.
    const choisies = noeudsAffiches(
      arbre,
      (/** @type {any} */ noeud) => noeud.props?.accessibilityState?.selected === true
        && String(noeud.props?.accessibilityLabel || '').startsWith('Une installation de ton club'),
    );
    expect(choisies).toHaveLength(1);
    expect(textesSous(choisies[0])).toContain('Gymnase Nord');
  });

  // ③ Un club sans installation ne voit pas une liste vide : il voit l'ecran
  // d'avant, a l'identique. Une commodite absente ne se signale pas.
  it('un club SANS installation ne voit ni liste vide, ni titre orphelin', () => {
    const affiches = textesVisibles(rendre({}, []));
    expect(affiches.join(' ')).not.toContain('installation');
    expect(affiches.join(' ')).not.toContain('Installation');
    expect(derniereSaisieLibre().label).toBe('Ville ou adresse');
  });

  it('un club sans installation garde le mot a mot de l ecran d avant', () => {
    const affiches = textesVisibles(rendre({}, [])).join(' ');
    expect(affiches).toContain(
      'Le terrain exact n’est pas demandé ici : il se convient dans la'
      + ' discussion qui s’ouvre quand une équipe te répond.',
    );
  });

  // Ce que l'organisateur VOIT une fois le terrain choisi : le champ d'adresse
  // porte l'adresse de l'installation. C'est ca, « remplir le lieu » — un
  // brouillon rempli en silence ne se verifie pas a l'ecran.
  it('affiche l adresse de l installation dans le champ d adresse', () => {
    rendre(
      {
        installation: { documentId: 'inst-velodrome', name: 'Stade Vélodrome' },
        location: {
          label: '3 Boulevard Michelet 13008 Marseille (13008)', lat: 43.2699, lng: 5.3959,
        },
      },
      INSTALLATIONS,
    );
    expect(derniereSaisieLibre().address.label)
      .toBe('3 Boulevard Michelet 13008 Marseille (13008)');
  });

  // La ligne d'info d'avant disait « le terrain exact n'est PAS demandé ici ».
  // Des qu'on propose des installations, elle devient fausse : on la remplace.
  it('corrige la ligne d info quand le terrain devient choisissable', () => {
    const affiches = textesVisibles(rendre({}, INSTALLATIONS)).join(' ');
    expect(affiches).toContain(
      'Le terrain exact reste modifiable : il se convient dans la discussion'
      + ' qui s’ouvre quand une équipe te répond.',
    );
    expect(affiches).not.toContain('Le terrain exact n’est pas demandé ici');
  });

  // Une installation sans coordonnees ne pourrait pas remplir le lieu : la
  // proposer fabriquerait une annonce sans geohash, donc invisible.
  it('ne propose pas une installation dont l adresse n a pas de coordonnees', () => {
    const affiches = textesVisibles(rendre({}, [
      { address: null, documentId: 'inst-sans-adresse', name: 'Terrain sans adresse' },
      INSTALLATIONS[0],
    ]));
    expect(affiches).not.toContain('Terrain sans adresse');
    expect(affiches).toContain('Stade Vélodrome');
  });

  it('une equipe sans club ne demande rien et ne montre aucune installation', () => {
    const affiches = textesVisibles(rendre({ team: { documentId: 'team-1' } }, INSTALLATIONS));
    expect(mockAppelsAuLecteur).toEqual([null]);
    expect(affiches).not.toContain('Stade Vélodrome');
  });

  // 📌 L'installation est une COMMODITE, pas une contrainte : taper une ville a
  // la main apres avoir choisi un terrain doit lacher le terrain, sinon
  // l'annonce proposerait un stade a 300 km de la ville annoncee.
  it('taper une ville a la main lache l installation choisie', () => {
    const choisie = { documentId: 'inst-velodrome', name: 'Stade Vélodrome' };
    rendre({ installation: choisie }, INSTALLATIONS);
    act(() => derniereSaisieLibre().setAddress({ label: 'Lyon', lat: 45.75, lng: 4.85 }));

    const { payload } = mockEnvoyer.mock.calls[0][0];
    expect(payload.installation).toBeUndefined();
  });
});

// Les tests ci-dessus prouvent que le texte AFFICHE est le bon — ils passeraient
// encore si toutes les clefs manquaient, puisque le repli porte le meme texte.
// Ceux-ci prouvent l'autre moitie : la clef EXISTE dans `fr.js`.
describe('C-G — la copy ajoutee vit dans fr.js, mot pour mot', () => {
  /**
   * Lit une clef pointee dans le catalogue francais.
   * @param {string} cle La clef, segments separes par des points.
   * @returns {any} La valeur trouvee, ou undefined.
   */
  const lireDansFr = (cle) => cle
    .split('.')
    .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogueFr);

  const RACINE = 'friendlyMatch.wizard.location.facilities';

  it.each([
    [`${RACINE}.title`, 'Une installation de ton club'],
    [
      `${RACINE}.hint`,
      'Choisis-en une et l’adresse se remplit toute seule. Sinon, tape une ville ci-dessous.',
    ],
    [
      `${RACINE}.info`,
      'Le terrain exact reste modifiable : il se convient dans la discussion'
      + ' qui s’ouvre quand une équipe te répond.',
    ],
  ])('%s porte le texte affiche', (cle, texte) => {
    expect(lireDansFr(cle)).toBe(texte);
  });
});
