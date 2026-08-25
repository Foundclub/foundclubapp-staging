import renderer, { act } from 'react-test-renderer';

import ClubLicenses from '../ClubLicenses';

// D18 (E6) : `ClubLicenses.js` fait 2 138 lignes et n'avait AUCUN test. Ce
// fichier decrit ce que le DIRIGEANT LIT sur le hub des cotisations, juste
// AVANT sa refonte (capture de design `00-hub`).
//
// Il est pilote par le TEXTE VISIBLE, jamais par la forme de l'arbre : aucun
// `testID`, aucune profondeur, aucun pixel. C'est la seule couture qui survive
// au passage de 4 cartes de statistiques a un bloc de synthese.
//
// ⚠️ CE QUE CE FILET NE PEUT PAS VOIR, et il faut le savoir en le lisant :
// l'ecran est monte SANS son navigateur. Le doublon de titre du hub vient
// justement de la : `ClubStack.js:172` declare `headerTitle: 'Cotisations'` ET
// l'ecran rend son propre titre « Cotisations » (`ClubLicenses.js:1356`). Le
// test ne voit que le second. C'est exactement l'angle mort qui avait laisse
// passer les deux fleches de retour empilees du lot D2 : un test qui monte un
// ecran seul est structurellement aveugle a ce que son en-tete ajoute.

/** @type {any} */
let mockAuthContexte;
/** @type {any} */
let mockDonneesAuth;
/** @type {any} */
let mockCampagnesRequete;
/** @type {any} */
let mockCampagneCouranteRequete;
/** @type {any} */
let mockCampagneParIdRequete;
/** @type {any} */
let mockTableauDeBordRequete;

const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockMutationFigee = { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };
const mockInsetsFiges = {
  bottom: 0, left: 0, right: 0, top: 0,
};

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => mockMutationFigee,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsetsFiges,
}));

jest.mock('@/store/appContext', () => ({
  useAppContext: () => mockAuthContexte,
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockDonneesAuth,
}));

// `authUseCases` tire le magasin de session et la navigation : on le double
// entierement plutot que de faire dependre ce filet de la couche de stockage.
jest.mock('@/domains/auth/authUseCases', () => ({
  getUserRoleKey: (/** @type {string} */ nomDeRole) => (
    String(nomDeRole || '').toLowerCase().includes('dirigeant') ? 'president' : 'new'
  ),
}));

// Le VRAI theme, sans le contexte React qui le porte : un Proxy rendrait les
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

// ⛔ Jamais `requireActual` sur un service : le client HTTP refuse de se charger
// sans `API_URL` et fait tomber la suite AVANT le premier rendu.
jest.mock('@/services/license/licenseQueries', () => ({
  deleteDraftLicenseCampaign: jest.fn(),
  duplicateLicenseCampaign: jest.fn(),
  sendBulkLicenseReminder: jest.fn(),
  sendLicenseReminder: jest.fn(),
  transitionLicenseCampaign: jest.fn(),
  useCurrentLicenseCampaign: () => mockCampagneCouranteRequete,
  useLicenseAssignments: () => mockRequeteVide,
  useLicenseCampaign: () => mockCampagneParIdRequete,
  useLicenseCampaigns: () => mockCampagnesRequete,
  useLicenseDashboard: () => mockTableauDeBordRequete,
  useLicenseMutation: () => mockMutationFigee,
  useLicensePaymentReviews: () => mockRequeteVide,
}));

jest.mock('@/services/auth/authService', () => ({
  switchManagedClub: jest.fn(),
}));

// D26 : le hub porte desormais la feuille « Réglages du club — HelloAsso ».
// ⛔ Meme regle que partout : jamais `requireActual` sur un service. Celui-ci
// tire `celebrationRuntime`, qui lit un catalogue au chargement du module et
// fait tomber la suite AVANT le premier rendu.
jest.mock('@/services/license/licenseService', () => ({
  connectLicenseHelloAsso: jest.fn(),
}));

jest.mock('@/components/templates/ScreenContainer', () => function ScreenContainerMock({ children }) {
  return children;
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock() {
  return null;
});

jest.mock('@/components/molecules/clubSelector/ClubSelector', () => function ClubSelectorMock() {
  return null;
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => function ProfileAvatarMock() {
  return null;
});

jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => function SegmentedControlMock() {
  return null;
});

jest.mock('../MyLicenses', () => function MyLicensesMock() {
  return null;
});

// Le bouton est rendu comme un vrai element pressable PORTANT SON LIBELLE :
// c'est ce qui permet de piloter « le texte », que le libelle soit porte par un
// `Button` (avant la refonte) ou par un `Pressable` (apres).
jest.mock('@/components/atoms/button/Button', () => function ButtonMock(/** @type {any} */ props) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return reactActuel.createElement(
    PressableRN,
    {
      accessibilityLabel: props.accessibilityLabel,
      accessibilityRole: 'button',
      disabled: props.disabled || props.isLoading,
      onPress: props.onPress,
    },
    reactActuel.createElement(TexteRN, null, props.title),
  );
});

const CAMPAGNE_OUVERTE = Object.freeze({
  currency: 'EUR',
  defaultAmountCents: 10000,
  documentId: 'camp-hub-1',
  documentRequests: [],
  name: 'Cotisation licences 2026/2027',
  paymentModes: { helloasso: false },
  seasonLabel: 'Saison 2026-2027',
  status: 'active',
  totals: {
    expectedCents: 10000,
    manualReviewCount: 0,
    overdueCount: 0,
    paidCents: 0,
    remainingCents: 10000,
    total: 1,
  },
});

/**
 * Recolte tout le texte reellement affiche, dans l'ordre de lecture.
 * @param {any} noeud
 * @param {string[]} [collecteur]
 * @returns {string[]}
 */
const recolterTextes = (noeud, collecteur = []) => {
  if (noeud === null || noeud === undefined || noeud === false) return collecteur;
  if (typeof noeud === 'string' || typeof noeud === 'number') {
    const texte = String(noeud).trim();
    if (texte) collecteur.push(texte);
    return collecteur;
  }
  if (Array.isArray(noeud)) {
    noeud.forEach((enfant) => recolterTextes(enfant, collecteur));
    return collecteur;
  }
  recolterTextes(noeud.children, collecteur);
  return collecteur;
};

/**
 * @param {any} arbre
 * @returns {string} Tout le texte de l'ecran, colle bout a bout.
 *
 * Les espaces insecables sont ramenes a des espaces ordinaires : `Intl` en
 * glisse une (U+202F) devant le « € » en francais, invisible a l'oeil mais qui
 * fait echouer une comparaison de chaine ecrite au clavier.
 */
const texteDeLEcran = (arbre) => recolterTextes(arbre.toJSON())
  .join(' | ')
  .replace(/[  ]/g, ' ');

/**
 * Dernier arbre monte. Il est demonte apres chaque test : la `FlatList` du hub
 * arme un minuteur differe (`Batchinator`) qui, s'il survit a la fin de la
 * suite, fait tomber le processus Jest ENTIER avec un message trompeur
 * (« import after the Jest environment has been torn down »).
 * @type {any}
 */
let arbreCourant = null;

/**
 * @param {any} [surcharges] - Etat des requetes a simuler.
 * @returns {any} L'arbre rendu du hub, vu par un dirigeant.
 */
const monterHub = (surcharges = {}) => {
  mockAuthContexte = [{ auth: { user: { role: { name: 'Dirigeant', type: 'dirigeant' } } } }];
  mockDonneesAuth = {
    activeClubId: 'club-hub',
    clubs: [{ documentId: 'club-hub', name: 'FC Test' }],
    refetchUserData: jest.fn(),
  };
  mockCampagneCouranteRequete = surcharges.campagneCourante || {
    data: CAMPAGNE_OUVERTE, isError: false, isLoading: false,
  };
  mockCampagnesRequete = surcharges.campagnes || {
    data: { data: [CAMPAGNE_OUVERTE] }, isError: false, isLoading: false,
  };
  mockCampagneParIdRequete = surcharges.campagneParId || mockRequeteVide;
  mockTableauDeBordRequete = surcharges.tableauDeBord || mockRequeteVide;

  const route = {
    name: surcharges.routeName || 'ClubLicenses',
    params: { clubId: 'club-hub', ...(surcharges.params || {}) },
  };
  const navigation = {
    addListener: () => () => {},
    goBack: jest.fn(),
    navigate: jest.fn(),
    setOptions: jest.fn(),
  };

  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<ClubLicenses navigation={navigation} route={route} />);
  });
  arbreCourant = arbre;
  return arbre;
};

describe('ClubLicenses — le hub des cotisations (filet E6, avant la refonte D18)', () => {
  afterEach(() => {
    if (!arbreCourant) return;
    act(() => arbreCourant.unmount());
    arbreCourant = null;
  });

  describe('l en-tete — un seul titre', () => {
    // AVANT : l'ecran rendait « Cotisations » en plus du titre du navigateur.
    // Le dirigeant lisait donc le mot deux fois, l'un sous l'autre.
    it('ne rend plus son propre titre : celui du navigateur suffit', () => {
      expect(texteDeLEcran(monterHub())).not.toContain('Cotisations');
    });

    // AVANT : « Suivi des paiements, relances et echeanciers du club. » — un
    // sous-titre qui n'apprenait rien, et qui portait la faute « echeanciers ».
    it('ne rend plus de sous-titre, donc plus aucun « echeanciers » sans accent', () => {
      expect(texteDeLEcran(monterHub())).not.toContain('echeanciers');
    });
  });

  describe('le bloc de synthese qui remplace les 4 cartes de statistiques', () => {
    // AVANT : 4 cartes de 4 couleurs (Attendu / Encaisse / Reste / Retards),
    // dont deux rouges en permanence.
    it('ne rend plus les 4 cartes de statistiques du hub', () => {
      const texte = texteDeLEcran(monterHub());

      expect(texte).not.toContain('Attendu');
      expect(texte).not.toContain('Retards');
    });

    it('annonce en une phrase ce qui est encaisse sur ce qui est attendu', () => {
      const texte = texteDeLEcran(monterHub());

      expect(texte).toContain('encaissés sur');
      expect(texte).toContain('100,00 €');
    });

    it('annonce le reste a encaisser', () => {
      expect(texteDeLEcran(monterHub())).toContain('Reste');
    });

    it('dit « Aucun retard » quand il n y en a pas', () => {
      expect(texteDeLEcran(monterHub())).toContain('Aucun retard');
    });

    it('compte les retards au pluriel des qu il y en a', () => {
      const campagneEnRetard = {
        ...CAMPAGNE_OUVERTE,
        totals: { ...CAMPAGNE_OUVERTE.totals, overdueCount: 3 },
      };
      const texte = texteDeLEcran(monterHub({
        campagneCourante: { data: campagneEnRetard, isError: false, isLoading: false },
        campagnes: { data: { data: [campagneEnRetard] }, isError: false, isLoading: false },
      }));

      expect(texte).toContain('3 retards');
      expect(texte).not.toContain('Aucun retard');
    });
  });

  describe('la barre de progression', () => {
    /**
     * @param {any} noeud
     * @param {any[]} [collecteur]
     * @returns {any[]} Tous les noeuds qui s'annoncent comme barre de progression.
     */
    const collecterBarres = (noeud, collecteur = []) => {
      if (!noeud || typeof noeud !== 'object') return collecteur;
      if (Array.isArray(noeud)) {
        noeud.forEach((enfant) => collecterBarres(enfant, collecteur));
        return collecteur;
      }
      if (noeud.props?.accessibilityRole === 'progressbar') collecteur.push(noeud);
      collecterBarres(noeud.children, collecteur);
      return collecteur;
    };

    /**
     * @param {number} paidCents
     * @param {number} expectedCents
     * @returns {any} La barre de progression du hub.
     */
    const barrePour = (paidCents, expectedCents) => {
      const campagne = {
        ...CAMPAGNE_OUVERTE,
        totals: {
          ...CAMPAGNE_OUVERTE.totals,
          expectedCents,
          paidCents,
          remainingCents: Math.max(expectedCents - paidCents, 0),
        },
      };
      const arbre = monterHub({
        campagneCourante: { data: campagne, isError: false, isLoading: false },
        campagnes: { data: { data: [campagne] }, isError: false, isLoading: false },
      });
      return collecterBarres(arbre.toJSON())[0];
    };

    it('s annonce comme une barre de progression, avec une valeur lisible', () => {
      const barre = barrePour(2500, 10000);

      expect(barre).toBeDefined();
      expect(barre.props.accessibilityValue).toEqual({
        max: 100, min: 0, now: 25, text: '25 % encaissés',
      });
    });

    it('reste a 0 % quand rien n a ete encaisse', () => {
      expect(barrePour(0, 10000).props.accessibilityValue.now).toBe(0);
    });

    // Une campagne dont on n attend rien n'est pas une campagne soldee : une
    // division par zero aurait rempli la barre a 100 %.
    it('reste a 0 % quand il n y a rien a encaisser', () => {
      expect(barrePour(0, 0).props.accessibilityValue.now).toBe(0);
    });

    // Un trop-percu ne fait pas deborder la barre.
    it('plafonne a 100 % quand on a encaisse plus que prevu', () => {
      expect(barrePour(15000, 10000).props.accessibilityValue.now).toBe(100);
    });
  });

  describe('la carte decorative « Vue d ensemble des campagnes »', () => {
    // AVANT : une carte qui n'affichait aucun chiffre et ne portait aucune
    // action, entre les statistiques et la liste.
    it('a disparu du hub', () => {
      expect(texteDeLEcran(monterHub())).not.toContain('Vue d ensemble des campagnes');
    });
  });

  describe('la carte de campagne', () => {
    it('porte le nom de la campagne, sa saison et son prix par membre', () => {
      // La saison et le prix sont deux morceaux de texte voisins dans le meme
      // paragraphe : le releve les separe, l'ecran les affiche colles.
      const texte = texteDeLEcran(monterHub());

      expect(texte).toContain('Cotisation licences 2026/2027');
      expect(texte).toContain('Saison 2026-2027');
      expect(texte).toContain('· 100,00 € par membre');
    });

    // AVANT : le statut `active` s'affichait « Active ».
    it('affiche une campagne active sous le libelle « Ouverte »', () => {
      const texte = texteDeLEcran(monterHub());

      expect(texte).toContain('Ouverte');
      expect(texte).not.toContain('Active');
    });

    // AVANT : « 1 membres - 100,00 € attendus » et « 0 document(s) demande(s) »,
    // deux phrases collees que l'oeil ne pouvait pas comparer.
    it('range les chiffres en trois lignes libelle / valeur', () => {
      const texte = texteDeLEcran(monterHub());

      expect(texte).toContain('Encaissé');
      expect(texte).toContain('0,00 € sur 100,00 €');
      expect(texte).toContain('Membres');
      expect(texte).toContain('1 · 0 en retard');
      expect(texte).toContain('Documents');
      expect(texte).toContain('Aucun demandé');
    });

    // AVANT : un lien texte « Voir le detail de la campagne ».
    it('propose « Voir le détail » en action principale', () => {
      const texte = texteDeLEcran(monterHub());

      expect(texte).toContain('Voir le détail');
      expect(texte).not.toContain('Voir le detail de la campagne');
    });

    // AVANT : « Dupliquer » et « Mettre en pause » etaient deux boutons de la
    // carte, dont les libelles se tronquaient.
    it('range les actions secondaires derriere un bouton « … », donc hors de la carte', () => {
      const texte = texteDeLEcran(monterHub());

      expect(texte).toContain('…');
      expect(texte).not.toContain('Dupliquer');
      expect(texte).not.toContain('Mettre en pause');
    });

    it('donne au bouton « … » un libelle d accessibilite qui nomme la campagne', () => {
      /**
       * @param {any} noeud
       * @param {any[]} [collecteur]
       * @returns {any[]}
       */
      const collecterLibelles = (noeud, collecteur = []) => {
        if (!noeud || typeof noeud !== 'object') return collecteur;
        if (Array.isArray(noeud)) {
          noeud.forEach((enfant) => collecterLibelles(enfant, collecteur));
          return collecteur;
        }
        if (noeud.props?.accessibilityLabel) collecteur.push(noeud.props.accessibilityLabel);
        collecterLibelles(noeud.children, collecteur);
        return collecteur;
      };

      expect(collecterLibelles(monterHub().toJSON()))
        .toContain('Autres actions pour la campagne Cotisation licences 2026/2027');
    });
  });

  describe('le nom de la campagne n est plus tronque', () => {
    /**
     * @param {any} noeud
     * @param {any[]} [collecteur]
     * @returns {any[]} Tous les noeuds `Text` de l'arbre.
     */
    const collecterNoeudsTexte = (noeud, collecteur = []) => {
      if (!noeud || typeof noeud !== 'object') return collecteur;
      if (Array.isArray(noeud)) {
        noeud.forEach((enfant) => collecterNoeudsTexte(enfant, collecteur));
        return collecteur;
      }
      if (noeud.type === 'Text') collecteur.push(noeud);
      collecterNoeudsTexte(noeud.children, collecteur);
      return collecteur;
    };

    // AVANT : `numberOfLines={1}` coupait le nom en plein milieu.
    it('laisse le nom passer a la ligne au lieu de le couper', () => {
      const noeuds = collecterNoeudsTexte(monterHub().toJSON());
      const noeudDuNom = noeuds.find((noeud) => (
        recolterTextes(noeud.children).join('') === 'Cotisation licences 2026/2027'
      ));

      expect(noeudDuNom).toBeDefined();
      expect(noeudDuNom?.props?.numberOfLines).toBeUndefined();
    });
  });

  describe('la creation d une campagne', () => {
    // AVANT : deux boutons secondaires cote a cote, « Modifier l active » et
    // « Nouvelle campagne » — dont le premier ne disait pas QUELLE campagne.
    it('propose une tuile « + Nouvelle campagne » et plus de « Modifier l active »', () => {
      const texte = texteDeLEcran(monterHub());

      expect(texte).toContain('+ Nouvelle campagne');
      expect(texte).not.toContain('Modifier l active');
    });
  });

  // La vue « detail d'une campagne » est HORS LOT — mais elle partage le meme
  // composant, et le lot D18 a restructure `renderDashboardHeader`. Ces deux
  // controles sont la pour prouver qu'elle n'a rien perdu au passage : sans
  // eux, la seule chose qui garantissait qu'elle rende encore etait un espoir.
  describe('la vue detail d une campagne — hors lot, doit rester intacte', () => {
    /** @returns {any} */
    const monterDetail = () => monterHub({
      campagneParId: { data: CAMPAGNE_OUVERTE, isError: false, isLoading: false },
      params: { campaignId: 'camp-hub-1' },
      routeName: 'ClubLicenseCampaignDetail',
      tableauDeBord: {
        data: { scope: 'club', totals: CAMPAGNE_OUVERTE.totals },
        isError: false,
        isLoading: false,
      },
    });

    it('garde son entete « Cotisations » et son sous-titre de campagne', () => {
      const texte = texteDeLEcran(monterDetail());

      expect(texte).toContain('Cotisations');
      expect(texte).toContain('Detail complet de la campagne Cotisation licences 2026/2027.');
    });

    it('garde ses 4 cartes de statistiques, qui y servent de filtre', () => {
      const texte = texteDeLEcran(monterDetail());

      expect(texte).toContain('Attendu');
      expect(texte).toContain('Encaisse');
      expect(texte).toContain('Reste');
      expect(texte).toContain('Retards');
    });
  });

  describe('l ecran en panne', () => {
    const enPanne = {
      campagneCourante: { data: null, isError: true, isLoading: false },
      campagnes: { data: null, isError: true, isLoading: false },
    };

    it('annonce « Cotisations indisponibles »', () => {
      expect(texteDeLEcran(monterHub(enPanne))).toContain('Cotisations indisponibles');
    });

    // AVANT : « Reessayer », sans accent.
    it('propose un bouton « Réessayer » correctement accentue', () => {
      const texte = texteDeLEcran(monterHub(enPanne));

      expect(texte).toContain('Réessayer');
      expect(texte).not.toContain('Reessayer');
    });
  });
});
