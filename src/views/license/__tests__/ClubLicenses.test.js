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
  useLicenseCampaign: () => mockRequeteVide,
  useLicenseCampaigns: () => mockCampagnesRequete,
  useLicenseDashboard: () => mockRequeteVide,
  useLicenseMutation: () => mockMutationFigee,
  useLicensePaymentReviews: () => mockRequeteVide,
}));

jest.mock('@/services/auth/authService', () => ({
  switchManagedClub: jest.fn(),
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

jest.mock('../MyLicense', () => function MyLicenseMock() {
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

  const route = { name: 'ClubLicenses', params: { clubId: 'club-hub' } };
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

  describe('l en-tete', () => {
    // ⚠️ ASSERTION QUE LA REFONTE D18 DOIT CHANGER : le design demande UN SEUL
    // titre. Comme le navigateur en pose deja un (`ClubStack.js:172`), c'est
    // celui de l'ecran qui part.
    it('rend son propre titre « Cotisations », en plus de celui du navigateur', () => {
      expect(texteDeLEcran(monterHub())).toContain('Cotisations');
    });

    // ⚠️ ASSERTION QUE LA REFONTE D18 DOIT CHANGER : le sous-titre disparait de
    // la capture `00-hub`. Il porte au passage la faute d'accent « echeanciers ».
    it('affiche un sous-titre ou « echeanciers » est ecrit sans accent', () => {
      expect(texteDeLEcran(monterHub())).toContain('Suivi des paiements, relances et echeanciers du club.');
    });
  });

  describe('les 4 cartes de statistiques', () => {
    // ⚠️ ASSERTIONS QUE LA REFONTE D18 DOIT CHANGER : les 4 cartes de 4 couleurs
    // deviennent un bloc de synthese unique.
    it('affiche les 4 libelles Attendu, Encaisse, Reste et Retards', () => {
      const texte = texteDeLEcran(monterHub());

      expect(texte).toContain('Attendu');
      expect(texte).toContain('Encaisse');
      expect(texte).toContain('Reste');
      expect(texte).toContain('Retards');
    });

    it('affiche les montants en euros formates a la francaise', () => {
      expect(texteDeLEcran(monterHub())).toContain('100,00 €');
    });
  });

  describe('la carte decorative « Vue d ensemble des campagnes »', () => {
    // ⚠️ ASSERTION QUE LA REFONTE D18 DOIT CHANGER : cette carte est purement
    // decorative, le design la supprime.
    it('occupe de la place sans porter aucune action', () => {
      const texte = texteDeLEcran(monterHub());

      expect(texte).toContain('Vue d ensemble des campagnes');
      expect(texte).toContain('Ouvre une campagne pour suivre ses membres, ses relances et ses paiements en detail.');
    });
  });

  describe('la carte de campagne — ce que le dirigeant y lit aujourd hui', () => {
    it('porte le nom de la campagne et sa saison', () => {
      const texte = texteDeLEcran(monterHub());

      expect(texte).toContain('Cotisation licences 2026/2027');
      expect(texte).toContain('Saison 2026-2027');
    });

    // ⚠️ ASSERTION QUE LA REFONTE D18 DOIT CHANGER : le design renomme le
    // statut `active` en « Ouverte ».
    it('affiche le statut d une campagne active sous le libelle « Active »', () => {
      expect(texteDeLEcran(monterHub())).toContain('Active');
    });

    // ⚠️ ASSERTIONS QUE LA REFONTE D18 DOIT CHANGER : les lignes deviennent
    // « Encaisse / Membres / Documents » en deux colonnes.
    it('resume les membres et le montant attendu sur une seule ligne', () => {
      const texte = texteDeLEcran(monterHub());

      expect(texte).toContain('membres - ');
      expect(texte).toContain(' attendus');
    });

    it('compte les documents demandes', () => {
      expect(texteDeLEcran(monterHub())).toContain('document(s) demande(s)');
    });

    // ⚠️ ASSERTION QUE LA REFONTE D18 DOIT CHANGER : le pied devient un bouton
    // plein « Voir le detail » + un bouton « … ».
    it('propose un lien « Voir le detail de la campagne »', () => {
      expect(texteDeLEcran(monterHub())).toContain('Voir le detail de la campagne');
    });

    // ⚠️ ASSERTION QUE LA REFONTE D18 DOIT CHANGER : « Dupliquer » et « Mettre
    // en pause » passent sous le bouton « … ».
    it('empile les actions secondaires en boutons pleine largeur', () => {
      const texte = texteDeLEcran(monterHub());

      expect(texte).toContain('Dupliquer');
      expect(texte).toContain('Mettre en pause');
    });
  });

  describe('le nom de la campagne est tronque', () => {
    // C'est le defaut que la capture `00-hub` corrige : le nom tient sur une
    // seule ligne et se coupe. On l'epingle par la PROP, faute de mise en page
    // reelle dans un rendu de test.
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

    it('coupe le nom a une ligne, meme quand il est long', () => {
      const noeuds = collecterNoeudsTexte(monterHub().toJSON());
      const noeudDuNom = noeuds.find((noeud) => (
        recolterTextes(noeud.children).join('') === 'Cotisation licences 2026/2027'
      ));

      expect(noeudDuNom?.props?.numberOfLines).toBe(1);
    });
  });

  describe('les actions de bas de page', () => {
    // ⚠️ ASSERTIONS QUE LA REFONTE D18 DOIT CHANGER : « Nouvelle campagne »
    // devient une tuile pointillee, et « Modifier l active » rejoint le « … ».
    it('propose « Modifier l active » et « Nouvelle campagne » cote a cote', () => {
      const texte = texteDeLEcran(monterHub());

      expect(texte).toContain('Modifier l active');
      expect(texte).toContain('Nouvelle campagne');
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

    // ⚠️ ASSERTION QUE LA REFONTE D18 DOIT CHANGER : « Reessayer » doit prendre
    // ses accents (« Réessayer »).
    it('propose un bouton « Reessayer » ecrit sans accent', () => {
      expect(texteDeLEcran(monterHub(enPanne))).toContain('Reessayer');
    });
  });
});
