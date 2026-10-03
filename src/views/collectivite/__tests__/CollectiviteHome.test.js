import { readFileSync } from 'fs';
import { join } from 'path';

import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteHome from '../CollectiviteHome';

// 🏛️ COLL-ACCUEIL (01/10/2026) — PLANCHE 1 : l'accueil de la Ville, VERSION 2 (design validé,
// artefact HY521H1, `P3v2-accueil-tel` / `-ordi`). Il part de la FONCTION d'une collectivité :
//   1. « Ce qui vous attend » : le nombre de demandes, et la PLUS ANCIENNE en carte (club ·
//      équipe, places, ce qu'accepter donnerait, Refuser / Accepter), puis « Voir les N » ;
//   2. « Vos actions » : SEULEMENT celles dont l'écran existe (ajouter une installation) —
//      attribuer, publier, fermer, bloquer, inviter attendent leurs lots ;
//   3. « Cette semaine » : chaque installation, ses séances, le moment où elle est complète ;
//   4. « Vos clubs » : clubs, équipes, membres en NOMBRES, jamais une personne de club ;
//   5. les actualités de la Ville ne sont PAS dessinées ici (lot C4a).
// États : rempli · rien n'attend · erreur partielle (le bloc en panne le dit, le reste vit) ·
// refus d'accès. ROUGE sur l'accueil v1 (trois cartes nombre), VERT sur la v2.
// Piloté par le TEXTE VISIBLE ; `t` résout dans le VRAI fr.js, interpolation comprise.

/** @type {any} */
let mockRequetes;
/** @type {any} */
let mockInstallations;
/** @type {any} */
let mockClubs;
/** @type {any} */
let mockSemaine;
/** @type {any} */
let mockChiffresSemaine;
/** @type {any} */
let mockMine;
/** @type {any} */
let mockParams;
/** @type {any} */
let mockUserData;
/** @type {any} */
let mockActualites;
/** @type {any} */
let mockFermetures;
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

// COLL-ACCUEIL-BIS (03/10) — la largeur de l'écran : 390 (téléphone) par défaut, 1280 pour la
// planche « ordinateur » (l'accueil passe en colonnes à partir de 1024).
let mockLargeur = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 900, scale: 1, width: mockLargeur,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));

jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        // FINITIONS11-COLL (03/10) : `t(cle, { count })` lit `cle_one` / `cle_other`, comme
        // i18next (règle du pluriel français : 0 et 1 au singulier).
        const valeurs = typeof repli === 'object' && repli !== null ? repli : options;
        const suffixe = typeof valeurs?.count === 'number'
          ? `_${new Intl.PluralRules('fr').select(valeurs.count)}`
          : '';
        const lire = (/** @type {string} */ chemin) => chemin
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        const valeur = (suffixe ? lire(`${cle}${suffixe}`) : undefined) ?? lire(String(cle || ''));
        let texte = cle;
        if (typeof valeur === 'string') texte = valeur;
        else if (typeof repli === 'string') texte = repli;
        return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(valeurs?.[nom] ?? ''));
      },
    }),
  };
});

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

// L'appareil : ce que l'accueil retient (mot d'accueil lu, clubs ouverts, guide masqué).
const mockRetenu = new Map();
jest.mock('@/platform/storage', () => ({
  getItem: (/** @type {string} */ cle) => mockRetenu.get(cle),
  setItem: (/** @type {string} */ cle, /** @type {string} */ valeur) => {
    mockRetenu.set(cle, valeur);
  },
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData }),
}));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  // COLL-C5 (03/10) : la jauge lit le taux de la semaine (les chiffres de la Ville).
  useCollectiviteChiffres: () => mockChiffresSemaine,
  useCollectiviteClubs: () => mockClubs,
  useCollectiviteInstallations: () => mockInstallations,
  useCollectiviteRequests: () => mockRequetes,
  useCollectiviteWeek: () => mockSemaine,
  useMyCollectivites: () => mockMine,
}));

// COLL-C4A (02/10) — le bloc « Actualités de la Ville » et le 4e premier pas lisent le serveur :
// doublés ici (une liste pilotée par mockActualites, vide par défaut).
jest.mock('@/services/collectivite/collectiviteActualiteQueries', () => ({
  useCollectiviteActualites: () => mockActualites,
}));

// COLL-C4B (02/10) — « Fermeture a venir » lit le serveur : double ici (vide par defaut).
jest.mock('@/services/facilityClosure/facilityClosureQueries', () => ({
  useCollectiviteClosures: () => mockFermetures,
}));

jest.mock('@/services/facility/facilityQueries', () => ({
  useApproveFacilityOverrideRequest: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useRefuseFacilityOverrideRequest: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock(
  '@/components/molecules/notificationBadge/NotificationBadge',
  () => function NotificationBadgeMock() { return null; },
);
jest.mock(
  '@/components/molecules/profileButton/ProfileButton',
  () => function ProfileButtonMock() { return null; },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

const lu = (/** @type {any} */ data) => ({
  data, error: null, isLoading: false, refetch: jest.fn(),
});

const DEMANDE_RECENTE = {
  club: { documentId: 'club-fc', name: 'Montrivage FC' },
  conflict: { maxSlots: 2, occupants: [], remaining: 1 },
  createdAt: '2026-10-01T09:00:00.000Z',
  documentId: 'rq-recente',
  facility: { documentId: 'tilleuls', name: 'Gymnase des Tilleuls' },
  requestedBy: { firstname: 'Léa', lastname: 'Martin' },
  requestedEnd: '2030-10-08T18:30:00.000Z',
  requestedStart: '2030-10-08T17:00:00.000Z',
  status: 'pending',
  team: { name: 'U15' },
};
const DEMANDE_ANCIENNE = {
  ...DEMANDE_RECENTE,
  club: { documentId: 'club-as', name: 'AS Montrivage' },
  conflict: {
    maxSlots: 2,
    occupants: [{ club: 'Montrivage Basket', team: 'U13' }, { club: 'Montrivage FC', team: 'U13' }],
    remaining: 0,
  },
  createdAt: '2026-09-29T09:00:00.000Z',
  documentId: 'rq-ancienne',
  requestedBy: { firstname: 'Karim', lastname: 'Benali' },
  team: { name: 'U13' },
};
const CLUBS = [
  {
    documentId: 'club-as',
    email: 'contact@as-montrivage.fr',
    membersCount: 3,
    name: 'AS Montrivage',
    phoneNumber: '0102030405',
    teamsCount: 4,
  },
  {
    documentId: 'club-fc',
    email: null,
    membersCount: 2,
    name: 'Montrivage FC',
    phoneNumber: null,
    teamsCount: 2,
  },
  {
    documentId: 'club-bk',
    email: null,
    membersCount: 0,
    name: 'Montrivage Basket',
    phoneNumber: null,
    teamsCount: 0,
  },
];
const TILLEULS = {
  documentId: 'tilleuls', maxSlots: 2, name: 'Gymnase des Tilleuls', planningColor: null,
};
const DOJO = {
  documentId: 'dojo', maxSlots: 1, name: 'Dojo municipal', planningColor: null,
};

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<CollectiviteHome />);
  });
  return arbre;
};

const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  const [cible] = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === testID
    && typeof n.props?.onPress === 'function');
  expect(cible).toBeDefined();
  await act(async () => { await cible.props.onPress(); });
};

beforeEach(() => {
  mockLargeur = 390;
  mockRetenu.clear();
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockParams = { collectiviteId: 'ville-montrivage' };
  mockUserData = { club: { documentId: 'club-fc', name: 'Montrivage FC' }, documentId: 'agent' };
  mockMine = {
    data: [{ documentId: 'ville-montrivage', name: 'Ville de Montrivage', type: 'commune' }],
    isLoading: false,
  };
  mockRequetes = lu([DEMANDE_RECENTE, DEMANDE_ANCIENNE]);
  mockInstallations = lu([TILLEULS, DOJO]);
  mockClubs = lu(CLUBS);
  mockActualites = lu([]);
  mockFermetures = lu({ data: [] });
  mockChiffresSemaine = { data: null, error: null, isLoading: false };
  mockSemaine = [
    {
      installation: TILLEULS,
      query: lu({
        data: [
          { date: '2030-10-03', endTime: '19:30', startTime: '18:00' },
          { date: '2030-10-03', endTime: '19:30', startTime: '18:00' },
          { date: '2030-10-04', endTime: '20:00', startTime: '19:00' },
        ],
        meta: { total: 3 },
      }),
    },
    { installation: DOJO, query: lu({ data: [], meta: { total: 0 } }) },
  ];
});

describe('COLL-ACCUEIL — planche 1 : l accueil de la Ville, version 2', () => {
  it('en tête : « Ma collectivité », le nom de la Ville, et ce que fait l espace', async () => {
    const lus = textes(await monter());
    expect(lus).toEqual(expect.arrayContaining([
      'MA COLLECTIVITÉ',
      'Ville de Montrivage',
      'Vos installations, les demandes des clubs, vos messages aux clubs.',
    ]));
  });

  it('« Ce qui vous attend » : le nombre, et la demande la PLUS ANCIENNE en carte', async () => {
    const lus = textes(await monter());
    expect(lus).toEqual(expect.arrayContaining([
      'Ce qui vous attend',
      'AS Montrivage · U13',
      'Complet',
      'Demandé par Karim Benali',
      'Accepter met 3 équipes pour 2 places.',
      'Voir les 2 demandes',
    ]));
    // La plus récente n'est pas en carte : une seule demande se tranche depuis l'accueil.
    expect(lus).not.toContain('Montrivage FC · U15');
    expect(lus.some((texte) => texte.startsWith('Gymnase des Tilleuls · '))).toBe(true);
  });

  it('le compteur des demandes a la couleur de la pastille de la cloche (error700)', async () => {
    const chemin = ['..', '..', '..', 'components', 'molecules', 'notificationBadge'];
    const cloche = readFileSync(join(__dirname, ...chemin, 'NotificationBadge.js'), 'utf8');
    const jeton = (cloche.match(/styles\.badge,\s*\{\s*backgroundColor: Colors\.(\w+)/) || [])[1];
    expect(jeton).toBe('error700');
    const couleurs = jest.requireActual('@/theme/colors').default();
    const arbre = await monter();
    const [vue] = arbre.root.findAll((/** @type {any} */ n) => typeof n.type === 'string'
      && n.props?.testID === 'collectivite-home-attente-compteur');
    expect(StyleSheet.flatten(vue.props.style).backgroundColor).toBe(couleurs[jeton]);
  });

  it('« Voir les 2 demandes » ouvre « Demandes » de CETTE collectivité', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'collectivite-home-voir-demandes');
    expect(mockNavigate)
      .toHaveBeenCalledWith('CollectiviteRequests', { collectiviteId: 'ville-montrivage' });
  });

  it('Refuser et Accepter ouvrent la fenêtre de décision sur CETTE demande', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'bouton-Accepter');
    expect(textes(arbre)).toContain('Accepter la demande');
  });

  it('rien n attend : une phrase calme, sans carte de demande', async () => {
    mockRequetes = lu([]);
    const lus = textes(await monter());
    expect(lus).toContain('Rien ne vous attend : aucune demande, aucune fermeture prévue.');
    expect(lus).not.toContain('Ce qui vous attend');
  });

  it('demandes illisibles : le bloc le dit avec « Réessayer » ; les actions restent', async () => {
    const refetch = jest.fn();
    mockRequetes = {
      data: undefined, error: new Error('réseau'), isLoading: false, refetch,
    };
    const arbre = await monter();
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Les demandes n’ont pas pu être lues.',
      'Vérifiez la connexion, puis réessayez. Rien n’a été perdu.',
      'Ajouter une installation',
    ]));
    await appuyer(arbre, 'bouton-Réessayer');
    expect(refetch).toHaveBeenCalled();
  });

  it('« Vos actions » : chacune ouvre son écran', async () => {
    const arbre = await monter();
    const lus = textes(arbre);
    expect(lus).toContain('Vos actions');
    expect(lus).toContain('Ajouter une installation');
    // COLL-C4A (02/10) : « Publier une actualité » a son écran (« Nouvelle actualité »).
    expect(lus).toContain('Publier une actualité');
    // COLL-C4B (02/10) : « Fermer une installation » et « Bloquer un créneau » ont leur écran.
    expect(lus).toContain('Fermer une installation');
    expect(lus).toContain('Bloquer un créneau');
    await appuyer(arbre, 'collectivite-home-action-publishNews');
    expect(mockNavigate).toHaveBeenCalledWith(
      'CollectiviteActualiteForm',
      { collectiviteId: 'ville-montrivage' },
    );
    await appuyer(arbre, 'collectivite-home-action-addInstallation');
    expect(mockNavigate).toHaveBeenCalledWith(
      'CollectiviteInstallationForm',
      { collectiviteId: 'ville-montrivage' },
    );
  });

  it('« Cette semaine » : chaque installation, ses séances, et le moment complet', async () => {
    const arbre = await monter();
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Cette semaine',
      'Gymnase des Tilleuls',
      // COLL-C5 (03/10) — la ligne de la planche : « 9 séances · occupation : — » sans taux.
      '3 séances · occupation : —',
      'Dojo municipal',
      'Aucune séance',
      'libre',
    ]));
    expect(lus.some((texte) => /^complet .+ 18:00$/.test(texte))).toBe(true);
    await appuyer(arbre, 'collectivite-home-voir-planning');
    expect(mockNavigate)
      .toHaveBeenCalledWith('CollectiviteInstallations', { collectiviteId: 'ville-montrivage' });
  });

  // 🎨 COLL-FIX2 (03/10), planche 2 (tournée T10, T10_C02_1) : « Vos clubs » s'affichait « Vos »
  // sous Android 16 (gras de plusieurs mots dans une boîte à sa largeur mesurée). La parade
  // éprouvée : la boîte du titre est ÉTIRÉE (flexGrow), jamais à sa largeur mesurée.
  it('les titres de section sont étirés : « Vos clubs » ne perd plus « clubs »', async () => {
    const arbre = await monter();
    const titre = arbre.root.findAllByType(Text)
      .find((/** @type {any} */ n) => n.props.accessibilityRole === 'header'
        && aplatirTexte(n.props.children).trim() === 'Vos clubs');
    expect(titre).toBeDefined();
    expect(StyleSheet.flatten(titre.props.style)).toEqual(expect.objectContaining({ flexGrow: 1 }));
  });

  it('« Vos clubs » : des NOMBRES, et aucune coordonnée de club ni de personne', async () => {
    const arbre = await monter();
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Vos clubs', '3', '6', '5', 'clubs', 'équipes', 'membres',
    ]));
    expect(lus).toContain('AS Montrivage, Montrivage FC, Montrivage Basket');
    const tout = lus.join(' | ');
    expect(tout).not.toContain('contact@as-montrivage.fr');
    expect(tout).not.toContain('0102030405');
    await appuyer(arbre, 'collectivite-home-voir-clubs');
    expect(mockNavigate)
      .toHaveBeenCalledWith('CollectiviteClubs', { collectiviteId: 'ville-montrivage' });
  });

  it('un compteur de membres illisible s écrit « — », jamais 0', async () => {
    mockClubs = lu([{ ...CLUBS[0], membersCount: null }]);
    const lus = textes(await monter());
    expect(lus).toContain('—');
  });

  // COLL-C4A (02/10) : le bloc « Actualités de la Ville » est posé à la place réservée.
  it('les actualités de la Ville : le bloc du lot C4a (aucune : « la première »)', async () => {
    const arbre = await monter();
    const lus = textes(arbre);
    expect(lus).toContain('Actualités de la Ville');
    expect(lus).toContain(
      'Aucune actualité publiée. Les membres de vos 3 clubs la liront dans leurs messages.',
    );
    await appuyer(arbre, 'bouton-Publier la première');
    expect(mockNavigate).toHaveBeenCalledWith(
      'CollectiviteActualiteForm',
      { collectiviteId: 'ville-montrivage' },
    );
    const source = readFileSync(join(__dirname, '..', 'CollectiviteHome.js'), 'utf8');
    expect(source).not.toContain('PLACE RÉSERVÉE AU LOT C4a');
  });

  // PLANCHE 3 (compte mixte) — D69, décision d'Adel « conflit A » : il tranche, et le sait.
  it('compte mixte : la demande de SON club porte « Demande de votre club »', async () => {
    mockUserData = { club: { documentId: 'club-as', name: 'AS Montrivage' } };
    const arbre = await monter();
    expect(textes(arbre)).toContain('Demande de votre club');
  });

  it('la demande d un AUTRE club ne porte pas la mention', async () => {
    const lus = textes(await monter());
    expect(lus).not.toContain('Demande de votre club');
  });

  it('compte mixte : « ‹ AS Montrivage » en haut ramène à son accueil de club', async () => {
    mockParams = { collectiviteId: 'ville-montrivage', returnLabel: 'AS Montrivage', space: true };
    const arbre = await monter();
    expect(textes(arbre)).toContain('AS Montrivage');
    await appuyer(arbre, 'collectivite-home-retour');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('refus d accès : « Accès retiré », en clair, et à qui écrire', async () => {
    mockMine = { data: [], isLoading: false };
    const lus = textes(await monter());
    expect(lus).toEqual(expect.arrayContaining([
      'Accès retiré',
      'Nous contacter',
    ]));
    expect(lus.some((texte) => texte.startsWith('Vous ne gérez pas cette collectivité.')))
      .toBe(true);
  });
});

// 🏛️ COLL-ACCUEIL-BIS (03/10/2026) — PLANCHES 2 et 3, l'accueil COMPLET (P3v2-accueil-tel et
// -ordi), élément par élément contre l'écran :
//   - la carte de la demande dit la FONCTION de qui demande (« Karim Benali, dirigeant ») : le
//     serveur la rend depuis C3B (`requesterFunction`), l'écran « Demandes » la disait déjà ;
//   - les SIX actions de la planche, dans son ordre, chacune vers son VRAI écran : « Attribuer un
//     créneau » (C2b : les créneaux de l'installation, ou la liste s'il y en a plusieurs) et
//     « Inviter un club » (C-CLUBS) manquaient ;
//   - sur ordinateur : les six actions en UNE rangée, l'icône à gauche du titre ; la colonne
//     « Ce qui vous attend » montre la 2e demande en carte compacte, sans boutons.
// ROUGES avant le lot.
describe('COLL-ACCUEIL-BIS — planches 2 et 3 : l accueil de la Ville complet', () => {
  const ORDRE_DE_LA_PLANCHE = [
    'assignSlot', 'publishNews', 'closeInstallation', 'blockSlot', 'inviteClub', 'addInstallation',
  ];
  // Une carte par testID : la plus extérieure (le TouchableOpacity et son style ; ses enfants
  // internes reprennent le même testID).
  const cartesDAction = (/** @type {any} */ arbre) => {
    const vus = new Set();
    return arbre.root.findAll((/** @type {any} */ n) => String(n.props?.testID || '')
      .startsWith('collectivite-home-action-') && typeof n.props?.onPress === 'function')
      .filter((/** @type {any} */ n) => !vus.has(n.props.testID) && vus.add(n.props.testID));
  };
  const actionsAffichees = (/** @type {any} */ arbre) => cartesDAction(arbre)
    .map((/** @type {any} */ n) => n.props.testID.replace('collectivite-home-action-', ''));

  it('la carte dit la FONCTION de qui demande : « Karim Benali, dirigeant »', async () => {
    mockRequetes = lu([{ ...DEMANDE_ANCIENNE, requesterFunction: 'manager' }, DEMANDE_RECENTE]);
    const lus = textes(await monter());
    expect(lus).toContain('Demandé par Karim Benali, dirigeant');
  });

  it('un entraîneur : « …, entraîneur » ; une fonction inconnue : le nom seul', async () => {
    mockRequetes = lu([{ ...DEMANDE_ANCIENNE, requesterFunction: 'trainer' }]);
    expect(textes(await monter())).toContain('Demandé par Karim Benali, entraîneur');
    mockRequetes = lu([{ ...DEMANDE_ANCIENNE, requesterFunction: null }]);
    expect(textes(await monter())).toContain('Demandé par Karim Benali');
  });

  it('les SIX actions de la planche, dans son ordre', async () => {
    const arbre = await monter();
    expect(actionsAffichees(arbre)).toEqual(ORDRE_DE_LA_PLANCHE);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Attribuer un créneau', 'Inviter un club',
    ]));
  });

  it('« Attribuer un créneau » : la liste, ou les créneaux de l installation unique', async () => {
    const plusieurs = await monter();
    await appuyer(plusieurs, 'collectivite-home-action-assignSlot');
    expect(mockNavigate).toHaveBeenLastCalledWith(
      'CollectiviteInstallations',
      { collectiviteId: 'ville-montrivage' },
    );
    mockInstallations = lu([TILLEULS]);
    const une = await monter();
    await appuyer(une, 'collectivite-home-action-assignSlot');
    expect(mockNavigate).toHaveBeenLastCalledWith('CollectiviteInstallation', {
      collectiviteId: 'ville-montrivage', facilityId: 'tilleuls',
    });
  });

  it('« Inviter un club » ouvre l invitation de CETTE Ville (le lien, lot C-CLUBS)', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'collectivite-home-action-inviteClub');
    expect(mockNavigate)
      .toHaveBeenLastCalledWith('CollectiviteInviteClub', { collectiviteId: 'ville-montrivage' });
  });

  it('ordinateur : les six actions sur UNE rangée, l icône à gauche du titre', async () => {
    mockLargeur = 1280;
    const arbre = await monter();
    const cartes = cartesDAction(arbre);
    expect(cartes).toHaveLength(6);
    cartes.forEach((/** @type {any} */ carte) => {
      const style = StyleSheet.flatten(carte.props.style);
      // Six parts égales : aucune ne passe à la ligne, aucune largeur plafonnée.
      expect(style).toEqual(expect.objectContaining({
        flexBasis: 0, flexDirection: 'row', flexGrow: 1,
      }));
      expect(style.maxWidth).toBeUndefined();
    });
  });

  it('ordinateur : la 2e demande en carte COMPACTE, sans boutons (téléphone : une)', async () => {
    const telephone = await monter();
    expect(textes(telephone)).not.toContain('Montrivage FC · U15');
    mockLargeur = 1280;
    const ordinateur = await monter();
    const lus = textes(ordinateur);
    expect(lus).toContain('AS Montrivage · U13');
    expect(lus).toContain('Montrivage FC · U15');
    expect(lus).toContain('1 place libre');
    const compacte = ordinateur.root.findAll((/** @type {any} */ n) => n.props?.testID
      === 'collectivite-home-attente-carte-compacte');
    expect(compacte.length).toBeGreaterThan(0);
    // Un seul « Accepter » : la carte compacte se tranche dans « Demandes ».
    expect(lus.filter((texte) => texte === 'Accepter')).toHaveLength(1);
  });
});

// 🏛️ COLL-ACCUEIL — PLANCHE 7 : les PREMIERS PAS d'une Ville toute neuve (P1v3-premiers-pas),
// et le mot d'accueil de la première visite (P2-gestion, état 6). Juste sous le nom de la Ville :
// les étapes se cochent d'elles-mêmes, une seule porte un bouton, masquables une fois faites.
// « Attribuer les créneaux » (lot C2a) est MASQUÉE ; « Présentez-vous aux clubs » paraît depuis
// le lot C4a (02/10) et se coche à la première actualité.
// 📊 COLL-C5 (03/10/2026), point 3 — PLANCHES 2 et 3 : la jauge d'occupation de « Cette semaine »
// (design HY521H1 page 1), le TAUX de la semaine lu dans les chiffres de la Ville (contrat §5).
describe('COLL-C5 — planches 2 et 3 : la jauge d occupation de la semaine', () => {
  it('une jauge par installation, remplie du taux ; « occupation : 23 % »', async () => {
    mockChiffresSemaine = {
      data: { installations: [{ documentId: TILLEULS.documentId, taux: 23 }] },
      error: null,
      isLoading: false,
    };
    const arbre = await monter();
    expect(textes(arbre))
      .toEqual(expect.arrayContaining(['3 séances · occupation : 23 %', 'Aucune séance']));
    const jauge = (/** @type {string} */ id) => arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === `collectivite-home-jauge-${id}`
        && typeof n.props?.accessibilityLabel === 'string',
    )[0];
    expect(jauge(TILLEULS.documentId).props.accessibilityLabel).toBe('Occupation : 23 %');
    expect(jauge(DOJO.documentId).props.accessibilityLabel).toBe('Occupation : —');
  });
});

describe('COLL-ACCUEIL — planche 7 : les premiers pas d une Ville toute neuve', () => {
  it('Ville toute neuve : 0 sur 4, et SEULE la première étape porte un bouton', async () => {
    mockInstallations = lu([]);
    mockClubs = lu([]);
    mockSemaine = [];
    const arbre = await monter();
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Vos premiers pas', '0 sur 4', 'Ajoutez vos installations', 'Vérifiez vos clubs',
      'Présentez-vous aux clubs', 'Une première actualité, lue par leurs membres.',
    ]));
    const boutons = arbre.root.findAll((/** @type {any} */ n) => String(n.props?.testID || '')
      .startsWith('bouton-') && typeof n.props?.onPress === 'function')
      .map((/** @type {any} */ n) => n.props.testID);
    expect(boutons).toContain('bouton-Ajouter une installation');
    expect(boutons).not.toContain('bouton-Voir les clubs');
    // COLL-ACCUEIL-BIS (03/10) : l étape 3 (C2b) est montrée, EN ATTENTE de l étape 1 (grisée,
    // sans bouton), comme la planche.
    expect(boutons).not.toContain('bouton-Attribuer un créneau');
    expect(lus).toEqual(expect.arrayContaining([
      'Attribuez les créneaux de la saison', 'Après l’étape 1 : qui joue où, chaque semaine.',
    ]));
    const [enAttente] = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID
      === 'collectivite-home-pas-creneaux');
    expect(StyleSheet.flatten(enAttente.props.style)).toEqual(expect.objectContaining({
      opacity: 0.55,
    }));
  });

  it('une étape faite se résume en une ligne ; la suivante prend le bouton', async () => {
    const arbre = await monter();
    expect(textes(arbre)).toEqual(expect.arrayContaining(['1 sur 4', '2 installations ajoutées']));
    await appuyer(arbre, 'bouton-Voir les clubs');
    expect(mockNavigate)
      .toHaveBeenCalledWith('CollectiviteClubs', { collectiviteId: 'ville-montrivage' });
  });

  it('tout est fait : une ligne qu on peut MASQUER, et qui le reste', async () => {
    // COLL-C4A : la 3e étape se coche d elle-même, à la première actualité en ligne.
    mockActualites = lu([{
      audience: 'membres',
      category: 'forum',
      documentId: 'actu-forum',
      publishedAt: '2026-10-01T08:00:00.000Z',
      recipients: { clubsCount: 3 },
      title: 'Forum des associations',
    }]);
    // COLL-ACCUEIL-BIS : l étape 3 se coche d elle-même, dès qu un créneau de saison paraît
    // dans le planning de la semaine (contrat C2A §7 : `slot` sur le bloc).
    mockSemaine = [{
      installation: TILLEULS,
      query: lu({
        data: [{
          date: '2030-10-03',
          endTime: '19:30',
          origin: 'slot',
          slot: { documentId: 'cr1' },
          startTime: '18:00',
        }],
        meta: { total: 1 },
      }),
    }];
    const premier = await monter();
    await appuyer(premier, 'collectivite-home-voir-clubs');
    const second = await monter();
    expect(textes(second)).toContain('Vos premiers pas sont faits : 4 sur 4.');
    await appuyer(second, 'bouton-Masquer');
    expect(textes(second)).not.toContain('Vos premiers pas sont faits : 4 sur 4.');
    const troisieme = await monter();
    expect(textes(troisieme)).not.toContain('Vos premiers pas');
    expect(textes(troisieme)).not.toContain('Vos premiers pas sont faits : 4 sur 4.');
  });

  // 🏛️ COLL-ACCUEIL-BIS (03/10/2026) — l étape 3, « Attribuez les créneaux de la saison » (C2b),
  // et la planche 10 (P1v3-premiers-pas-ordi) : les quatre étapes en COLONNES. ROUGES avant.
  it('étape 3 : son bouton « Attribuer un créneau » ouvre les écrans du créneau', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'collectivite-home-voir-clubs');
    const ensuite = await monter();
    expect(textes(ensuite)).toEqual(expect.arrayContaining([
      '2 sur 4',
      'Attribuez les créneaux de la saison',
      'Qui joue où, chaque semaine, toute la saison.',
    ]));
    await appuyer(ensuite, 'bouton-Attribuer un créneau');
    expect(mockNavigate).toHaveBeenLastCalledWith(
      'CollectiviteInstallations',
      { collectiviteId: 'ville-montrivage' },
    );
  });

  it('étape 3 faite : « 2 créneaux attribués », un créneau compté une fois', async () => {
    const bloc = (/** @type {string} */ id, /** @type {string} */ jour) => ({
      date: jour, endTime: '19:30', origin: 'slot', slot: { documentId: id }, startTime: '18:00',
    });
    mockSemaine = [{
      installation: TILLEULS,
      query: lu({
        data: [bloc('cr1', '2030-10-01'), bloc('cr1', '2030-10-03'), bloc('cr2', '2030-10-02')],
      }),
    }];
    expect(textes(await monter())).toContain('2 créneaux attribués');
  });

  it('étape 2 : « Un club manque ? Invitez-le. »', async () => {
    const lus = textes(await monter());
    expect(lus).toContain('L’équipe FoundClub a rattaché 3 clubs. Un club manque ? Invitez-le.');
  });

  it('ordinateur (planche 10) : les quatre étapes en COLONNES, la suivante bordée', async () => {
    mockLargeur = 1280;
    const arbre = await monter();
    const [colonnes] = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID
      === 'collectivite-home-premiers-pas-colonnes');
    expect(colonnes).toBeDefined();
    expect(StyleSheet.flatten(colonnes.props.style)).toEqual(expect.objectContaining({
      flexDirection: 'row',
    }));
    const etapes = ['installations', 'clubs', 'creneaux', 'actualite'].map((cle) => arbre.root
      .findAll((/** @type {any} */ n) => n.props?.testID === `collectivite-home-pas-${cle}`)[0]);
    etapes.forEach((/** @type {any} */ etape) => {
      expect(StyleSheet.flatten(etape.props.style)).toEqual(expect.objectContaining({
        flexBasis: 0, flexGrow: 1,
      }));
    });
    // La suivante (étape 2, « Vérifiez vos clubs ») porte la bordure primary500.
    const couleurs = jest.requireActual('@/theme/colors').default();
    expect(StyleSheet.flatten(etapes[1].props.style).borderColor).toBe(couleurs.primary500);
  });

  it('le mot d accueil se lit à la PREMIÈRE visite, puis plus jamais', async () => {
    expect(textes(await monter())).toContain('Bienvenue dans votre espace.');
    expect(textes(await monter())).not.toContain('Bienvenue dans votre espace.');
  });
});

// 🚧 COLL-C4B (02/10/2026) — « FERMETURE A VENIR » (P3v2-accueil : « en haut, la plus ancienne
// demande a trancher et les fermetures a venir ») et les deux actions « Fermer une installation »,
// « Bloquer un créneau » (design HY521H1 page 4). ROUGES avant le lot.
describe('COLL-C4B — « Fermeture à venir » et les deux actions de fermeture', () => {
  const FERMETURE = {
    documentId: 'f1',
    endDate: '2030-10-04',
    endTime: null,
    facility: { documentId: 'tilleuls', name: 'Gymnase des Tilleuls' },
    kind: 'closure',
    reason: 'travaux',
    startDate: '2030-10-04',
    startTime: null,
  };
  const BLOCAGE = {
    documentId: 'f2',
    endDate: '2030-10-05',
    endTime: '13:00',
    facility: { documentId: 'dojo', name: 'Dojo municipal' },
    kind: 'block',
    label: 'Forum des associations',
    reason: null,
    startDate: '2030-10-05',
    startTime: '09:00',
  };

  it('les fermetures à venir s ajoutent à « Ce qui vous attend » ; chacune s ouvre', async () => {
    mockFermetures = lu({ data: [FERMETURE, BLOCAGE] });
    const arbre = await monter();
    const lus = textes(arbre);
    expect(lus.filter((texte) => texte === 'Fermeture à venir')).toHaveLength(2);
    expect(lus).toContain('Gymnase des Tilleuls');
    expect(lus).toContain('ven. 4 oct. · Toute la journée · Fermeture · travaux');
    expect(lus).toContain('sam. 5 oct. · 09:00 – 13:00 · Blocage · Ville');
    await appuyer(arbre, 'collectivite-home-fermeture-f1');
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteInstallation', {
      collectiviteId: 'ville-montrivage', facilityId: 'tilleuls', onglet: 'fermetures',
    });
  });

  it('aucune demande, une fermeture : le bloc, sans « Rien ne vous attend »', async () => {
    mockRequetes = lu([]);
    mockFermetures = lu({ data: [FERMETURE] });
    const lus = textes(await monter());
    expect(lus).toContain('Ce qui vous attend');
    expect(lus).toContain('Fermeture à venir');
    const calme = 'Rien ne vous attend : aucune demande, aucune fermeture prévue.';
    expect(lus).not.toContain(calme);
  });

  it('« Fermer une installation » et « Bloquer un créneau » ouvrent le formulaire', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'collectivite-home-action-closeInstallation');
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteFermeture', {
      collectiviteId: 'ville-montrivage', mode: 'fermer',
    });
    await appuyer(arbre, 'collectivite-home-action-blockSlot');
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteFermeture', {
      collectiviteId: 'ville-montrivage', mode: 'bloquer',
    });
  });
});

// 🧪 FINITIONS11-COLL (03/10), point 2 — planches 2-3 (« P3v2-accueil ») : la fermeture a venir dit
// « aucun club n y a de seance : personne a prevenir » quand le serveur compte 0 seance touchee
// (`touchedSessionsCount`, admin FINITIONS11-COLL) ; « n seances touchees » sinon ; rien si le
// serveur ne le dit pas (ancien serveur, ou lecture en panne : null). ROUGE avant le lot.
describe('FINITIONS11-COLL (2) — la fermeture a venir dit qui est a prevenir', () => {
  const VACANCES = {
    documentId: 'f-dojo',
    endDate: '2030-10-25',
    endTime: null,
    facility: { documentId: 'dojo', name: 'Dojo municipal' },
    kind: 'closure',
    reason: 'vacances',
    startDate: '2030-10-17',
    startTime: null,
  };
  const personne = 'Aucun club n’y a de séance : personne à prévenir.';

  it('0 seance touchee : personne a prevenir', async () => {
    mockFermetures = lu({ data: [{ ...VACANCES, touchedSessionsCount: 0 }] });
    const lus = textes(await monter());
    expect(lus).toContain('Dojo municipal');
    expect(lus).toContain(personne);
  });

  it('des seances touchees : leur nombre, et jamais « personne a prevenir »', async () => {
    mockFermetures = lu({ data: [{ ...VACANCES, touchedSessionsCount: 3 }] });
    const lus = textes(await monter());
    expect(lus).toContain('3 séances touchées');
    expect(lus).not.toContain(personne);
  });

  it('le serveur ne le dit pas (null, ou absent) : la carte n en dit rien', async () => {
    mockFermetures = lu({
      data: [{ ...VACANCES, touchedSessionsCount: null }, { ...VACANCES, documentId: 'f-2' }],
    });
    const lus = textes(await monter());
    expect(lus.filter((texte) => texte === 'Fermeture à venir')).toHaveLength(2);
    expect(lus).not.toContain(personne);
    expect(lus.join(' ')).not.toMatch(/touchée/);
  });
});
