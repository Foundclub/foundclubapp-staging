import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TrainingReviewPromptHost from '../TrainingReviewPromptHost';

jest.setTimeout(30000);

// Le VRAI fournisseur, charge hors des `import` : `import/order` et `perfectionist`
// exigent deux ordres contraires entre `@/context/...` et `../...`.
const { PopupManagerProvider } = jest.requireActual('@/context/PopupManagerContext');

// FINITIONS8 · POINT 7 (tournee 9) — LES RAPPELS D'APRES-MATCH ET LES AVIS D'ENTRAINEMENT
// ETAIENT REPROPOSES A CHAQUE CHANGEMENT DE COMPTE (et a chaque demarrage).
//
// 🧭 « Plus tard » se retenait EN MEMOIRE, pour la session (`POPUP_DISMISS_SCOPES.SESSION`),
// sous la cle de la fenetre (« training:<seance>:review ») — la MEME pour tous les participants :
//   · un redemarrage (l app tuee, un plantage) l oubliait : la fenetre revenait ;
//   · fermee chez Karim, elle l etait aussi chez Hugo, qui n avait rien repondu.
// ✅ « Plus tard » se retient PAR COMPTE, pour 24 h, dans le stockage du telephone
// (`POPUP_DISMISS_SCOPES.DAY`, cle `<compte>:<fenetre>`). Meme regle pour le rappel d apres-match
// (MatchStatsPromptHost.FINITIONS8.test.js).
// Banc : les doublures de TrainingReviewPromptHost.ST-RETOURS.test.js (fabrique), avec le VRAI
// gestionnaire de fenetres.

/** @type {any} */
let mockPayload;
const mockEnvoyer = jest.fn();
const mockRelire = jest.fn(() => Promise.resolve());

jest.mock('@/services/trainingReview/trainingReviewService', () => ({
  getPendingTrainingReviews: jest.fn(),
  getTrainingReviews: jest.fn(),
  submitTrainingReview: (...args) => mockEnvoyer(...args),
}));
jest.mock('@/services/trainingReview/trainingReviewQueries', () => ({
  PENDING_TRAINING_REVIEWS_QUERY_KEY: ['pendingTrainingReviews'],
  TRAINING_REVIEW_STALE_MS: 30000,
  useGetPendingTrainingReviews: () => ({ data: mockPayload, refetch: mockRelire }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    getQueryCache: () => ({ find: () => null }),
    invalidateQueries: jest.fn(),
  }),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ isBootstrapResolved: true }),
}));
/** Le compte connecte : change quand on « change de compte ». */
/** @type {any} */
let mockAuth;
/** Le stockage du telephone (MMKV) : il SURVIT a un redemarrage de l app. */
const mockStockage = new Map();
jest.mock('@/store/appContext', () => ({
  storage: {
    delete: (/** @type {string} */ cle) => mockStockage.delete(cle),
    getString: (/** @type {string} */ cle) => mockStockage.get(cle),
    set: (/** @type {string} */ cle, /** @type {string} */ valeur) => mockStockage.set(cle, valeur),
  },
  useAppContext: () => [{ auth: mockAuth }, () => {}],
}));
jest.mock('@/navigation/navigationService', () => ({
  getCurrentRouteName: () => 'HomeTab',
  navigate: () => {},
  navigationRef: { addListener: () => () => {}, isReady: () => true },
}));
// Le VRAI gestionnaire de fenetres (PopupManagerContext) : c est lui qui retient « Plus tard ».
// Seule la phase de demarrage est doublee, ouverte.
jest.mock('@/context/StartupPhaseContext', () => ({
  useStartupPhase: () => ({
    activeStartupPromptId: null,
    canShowGlobalStartupPrompt: true,
    canShowLocalScreenPrompt: true,
    currentRouteName: 'HomeTab',
    markStartupPromptDismissed: () => {},
    markStartupPromptShown: () => {},
    phase: 'steady_state',
  }),
}));
jest.mock('@/context/BlockingOverlayContext', () => ({
  useBlockingOverlayLifecycle: () => {},
  useBlockingOverlayPrompt: () => true,
}));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View } = jest.requireActual('react-native');
  return function BottomModalMock(/** @type {any} */ { children, isVisible }) {
    return isVisible ? <View>{children}</View> : null;
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: Appui } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ { disabled, onPress, title }) {
    return (
      <Appui
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={onPress}
      >
        <TexteRN>{title}</TexteRN>
      </Appui>
    );
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
// Les vrais textes de fr.js, avec les {{jetons}} et le pluriel, comme dans l app.
jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  const lire = (/** @type {string} */ cle) => String(cle || '').split('.').reduce(
    (/** @type {any} */ noeud, /** @type {string} */ part) => (
      noeud && typeof noeud === 'object' ? noeud[part] : undefined
    ),
    traductions,
  );
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ a, /** @type {any} */ b) => {
        const options = (a && typeof a === 'object') ? a : (b || {});
        const repli = typeof a === 'string' ? a : options.defaultValue;
        let valeur = typeof options.count === 'number'
          ? lire(`${cle}_${options.count === 1 ? 'one' : 'other'}`)
          : undefined;
        if (typeof valeur !== 'string') valeur = lire(cle);
        if (typeof valeur !== 'string') valeur = typeof repli === 'string' ? repli : cle;
        return valeur.replace(/{{\s*(\w+)\s*}}/g, (_m, nom) => (
          options[nom] === undefined ? '' : String(options[nom])
        ));
      },
    }),
  };
});
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  const fige = {
    Alignments: jest.requireActual('@/theme/alignements').default,
    ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
    Colors: couleurs,
    Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => fige };
});

/**
 * Le texte d un noeud et de ses enfants, mis bout a bout.
 * @param {any} enfants
 * @returns {string}
 */
const aplatir = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
/**
 * Tout le texte visible.
 * @param {any} arbre
 * @returns {string}
 */
const texte = (arbre) => arbre.root.findAllByType(Text)
  .map((n) => aplatir(n.props.children))
  .join(' | ');
/**
 * Ce qu on peut toucher et qui porte exactement ce texte.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any}
 */
const appui = (arbre, libelle) => arbre.root.findAll((n) => (
  typeof n.type !== 'string' && typeof n.props.onPress === 'function'
  && n.findAllByType(Text).some((x) => aplatir(x.props.children).trim() === libelle)
))[0];
const KARIM = { token: 'jeton-karim', user: { documentId: 'karim' } };
const HUGO = { token: 'jeton-hugo', user: { documentId: 'hugo' } };

// La seance U13 : Karim et Hugo y etaient tous les deux, la cle est la meme pour les deux.
const SEANCE = {
  endedAt: new Date(2026, 9, 1, 17, 0).toISOString(),
  eventDocumentId: 'evt-u13',
  eventName: 'Entraînement',
  key: 'training:evt-u13:review',
  teamName: 'U13',
  trainerFirstname: 'Karim',
};

/**
 * La fenetre est-elle ouverte ?
 * @param {any} arbre
 * @returns {boolean}
 */
const fenetreOuverte = (arbre) => texte(arbre).includes('Comment s’est passé ton entraînement ?');

/**
 * L application : le gestionnaire de fenetres et l hote, pour le compte connecte.
 * @returns {import('react').ReactElement}
 */
const lApp = () => (
  <PopupManagerProvider>
    <TrainingReviewPromptHost />
  </PopupManagerProvider>
);

/** @type {any[]} */
const ouverts = [];
/**
 * Demarre l application (un fournisseur NEUF : la memoire de session est vide).
 * @param {any} compte
 * @returns {Promise<any>}
 */
const demarrer = async (compte) => {
  mockAuth = compte;
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(lApp());
  });
  ouverts.push(arbre);
  return arbre;
};
/**
 * « Changer de compte » : l application reste montee, le compte connecte change.
 * @param {any} arbre
 * @param {any} compte
 * @returns {Promise<void>}
 */
const changerDeCompte = async (arbre, compte) => {
  mockAuth = compte;
  await act(async () => {
    arbre.update(lApp());
  });
};
/**
 * « Plus tard ».
 * @param {any} arbre
 * @returns {Promise<void>}
 */
const plusTard = async (arbre) => {
  await act(async () => {
    appui(arbre, 'Plus tard').props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStockage.clear();
  mockPayload = { items: [SEANCE], nextPrompt: SEANCE, totalPending: 1 };
});

afterEach(() => {
  jest.restoreAllMocks();
  act(() => {
    ouverts.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('FINITIONS8 · point 7 — « Plus tard » se retient par compte, 24 h', () => {
  it('jumeau : sans « Plus tard », la fenetre s ouvre', async () => {
    const arbre = await demarrer(KARIM);

    expect(fenetreOuverte(arbre)).toBe(true);
  });

  it('🚨 apres un redemarrage, Karim ne la revoit pas', async () => {
    const avant = await demarrer(KARIM);
    await plusTard(avant);
    expect(fenetreOuverte(avant)).toBe(false);
    act(() => { avant.unmount(); });

    const apres = await demarrer(KARIM);

    expect(fenetreOuverte(apres)).toBe(false);
  });

  it('🚨 fermee chez Karim, elle s ouvre chez Hugo (c est son avis a lui)', async () => {
    const arbre = await demarrer(KARIM);
    await plusTard(arbre);

    await changerDeCompte(arbre, HUGO);

    expect(fenetreOuverte(arbre)).toBe(true);
  });

  it('retour chez Karim apres Hugo : toujours fermee', async () => {
    const arbre = await demarrer(KARIM);
    await plusTard(arbre);
    await changerDeCompte(arbre, HUGO);
    await plusTard(arbre);

    await changerDeCompte(arbre, KARIM);

    expect(fenetreOuverte(arbre)).toBe(false);
  });

  it('le lendemain, la fenetre revient (rappel, pas oubli)', async () => {
    const maintenant = Date.now();
    const avant = await demarrer(KARIM);
    await plusTard(avant);
    act(() => { avant.unmount(); });

    jest.spyOn(Date, 'now').mockReturnValue(maintenant + (25 * 60 * 60 * 1000));
    const lendemain = await demarrer(KARIM);

    expect(fenetreOuverte(lendemain)).toBe(true);
  });
});

describe('🐞 Q3-18 — « Plus tard » sur une seance choisie dans le merci', () => {
  /**
   * Une autre seance du meme joueur.
   * @param {string} id
   * @param {number} jour
   * @returns {any}
   */
  const seance = (id, jour) => ({
    ...SEANCE,
    endedAt: new Date(2026, 8, jour, 17, 0).toISOString(),
    eventDocumentId: id,
    key: `training:${id}:review`,
  });
  const B = seance('evt-b', 29);
  const C = seance('evt-c', 24);

  it('ne revient pas au redemarrage : la pause couvre la fenetre qui reviendrait', async () => {
    // « Plus tard » mettait en pause C (la seance choisie), mais c est B, la
    // prochaine du serveur, qui revenait : la fenetre se rouvrait avant 24 h.
    mockPayload = { items: [SEANCE, B, C], nextPrompt: SEANCE, totalPending: 3 };
    mockEnvoyer.mockResolvedValue({ ok: true });
    const avant = await demarrer(KARIM);
    await act(async () => {
      avant.root.findAll((n) => typeof n.type !== 'string'
        && n.props.accessibilityRole === 'radio' && typeof n.props.onPress === 'function')[7]
        .props.onPress();
    });
    await act(async () => { appui(avant, 'Envoyer mon avis').props.onPress(); });
    // Le serveur relu : la seance notee est partie, B est la prochaine.
    mockPayload = { items: [B, C], nextPrompt: B, totalPending: 2 };
    await act(async () => { avant.update(lApp()); });
    const lignes = avant.root.findAll((n) => n.props.testID === 'training-review-next-session'
      && typeof n.props.onPress === 'function');
    // La DERNIERE ligne : la seance C (24 sept.), pas B, la prochaine du serveur.
    await act(async () => { lignes.at(-1).props.onPress(); });
    expect(texte(avant)).toContain('jeu. 24 sept.');
    await plusTard(avant);
    expect(fenetreOuverte(avant)).toBe(false);
    act(() => { avant.unmount(); });

    const apres = await demarrer(KARIM);

    expect(fenetreOuverte(apres)).toBe(false);
  });
});
