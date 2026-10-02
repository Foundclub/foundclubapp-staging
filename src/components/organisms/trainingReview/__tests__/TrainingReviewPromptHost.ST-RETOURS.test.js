import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TrainingReviewPromptHost from '../TrainingReviewPromptHost';

// Le premier rendu charge l ecran entier : sous charge (les portes admin en parallele), il
// depasse les 5 s par defaut. Meme reglage que 93 temoins du depot.
jest.setTimeout(30000);

// ST-RETOURS (02/10) — PLANCHE 20 DU DESIGN VALIDE : « COMMENT S EST PASSE TON ENTRAINEMENT ? »
//
// Ce composant n avait AUCUN temoin (E6). Ce fichier fige d abord ce qui marchait — la note
// est envoyee avec le mot, « Plus tard » ferme pour la session — puis ce que la planche
// demande :
//   · la seance nommee (« Entraînement U13 · jeu. 1 oct., fin à 17:00 ») ;
//   · dix pastilles sur deux rangees de cinq, cibles de 44 px ;
//   · l anonymat dit pres du bouton, avec le prenom de l entraineur ;
//   · un envoi qui echoue LE DIT, et la note est gardee (defaut 11 du releve : pas de catch) ;
//   · un merci, puis la seance suivante s il en reste une.
// L entraineur n a plus de fenetre : c est le serveur qui ne lui rend plus sa seance
// (temoin admin ST-RETOURS-avis-entrainement) ; ici, une liste vide = aucune fenetre.

/** @type {any} */
let mockPayload;
const mockEnvoyer = jest.fn();
const mockFermerPourLaSession = jest.fn();
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
jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ auth: { token: 'jeton-test' } }, () => {}],
}));
jest.mock('@/navigation/navigationService', () => ({
  getCurrentRouteName: () => 'HomeTab',
  navigate: () => {},
  navigationRef: { addListener: () => () => {}, isReady: () => true },
}));
jest.mock('@/context/PopupManagerContext', () => ({
  usePopupEligibility: () => ({
    canShow: true,
    descriptor: { id: 'avis', priority: 1 },
    dismiss: (...args) => mockFermerPourLaSession(...args),
    markShown: () => {},
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
/**
 * Les dix pastilles de note.
 * @param {any} arbre
 * @returns {any[]}
 */
const pastilles = (arbre) => arbre.root.findAll((n) => (
  typeof n.type !== 'string' && n.props.accessibilityRole === 'radio'
  && typeof n.props.onPress === 'function'
));

/** @type {any[]} */
const montes = [];
/**
 * Monte la fenetre.
 * @returns {Promise<any>}
 */
const rendre = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<TrainingReviewPromptHost />);
  });
  montes.push(arbre);
  return arbre;
};

// La seance U13 du jeu. 1 oct., fin a 17:00 — capture S20a de la planche. L heure est construite
// en heure LOCALE : le temoin dit la meme chose a Paris et sur la CI (UTC).
const SEANCE = {
  endedAt: new Date(2026, 9, 1, 17, 0).toISOString(),
  eventDocumentId: 'evt-u13',
  eventName: 'Entraînement',
  key: 'training:evt-u13:review',
  teamName: 'U13',
  trainerFirstname: 'Karim',
};
const SEANCE_SUIVANTE = {
  endedAt: new Date(2026, 8, 29, 17, 0).toISOString(),
  eventDocumentId: 'evt-u13-mardi',
  eventName: 'Entraînement',
  key: 'training:evt-u13-mardi:review',
  teamName: 'U13',
  trainerFirstname: 'Karim',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPayload = { items: [SEANCE], nextPrompt: SEANCE, totalPending: 1 };
  mockEnvoyer.mockResolvedValue({ ok: true });
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('ST-RETOURS · planche 20 — ce qui marchait, fige (E6)', () => {
  it('la note et le mot partent ensemble', async () => {
    const arbre = await rendre();
    await act(async () => {
      pastilles(arbre)[7].props.onPress();
    });
    await act(async () => {
      arbre.root.findByType(TextInput).props.onChangeText('Super séance.');
    });
    await act(async () => {
      appui(arbre, 'Envoyer mon avis').props.onPress();
    });

    expect(mockEnvoyer).toHaveBeenCalledWith('evt-u13', { comment: 'Super séance.', rating: 8 });
  });

  it('« Plus tard » ferme la fenetre pour la session', async () => {
    const arbre = await rendre();
    await act(async () => {
      appui(arbre, 'Plus tard').props.onPress();
    });
    expect(mockFermerPourLaSession).toHaveBeenCalled();
  });

  it('rien a noter (cas de l entraineur, que le serveur exclut) : aucune fenetre', async () => {
    mockPayload = { items: [], nextPrompt: null, totalPending: 0 };
    const arbre = await rendre();
    expect(arbre.toJSON()).toBeNull();
  });
});

describe('ST-RETOURS · planche 20 — la fenetre dessinee', () => {
  it('etat 1 — la seance nommee, le titre, dix pastilles, l anonymat pres du bouton', async () => {
    const arbre = await rendre();
    const t = texte(arbre);

    expect(t).toContain('Entraînement U13 · jeu. 1 oct., fin à 17:00');
    expect(t).toContain('Comment s’est passé ton entraînement ?');
    expect(t).toContain('Anonyme : Karim voit la note, jamais qui l’a mise.');
    expect(pastilles(arbre)).toHaveLength(10);
  });

  it('etat 1 — deux rangees de cinq, cibles de 44 px', async () => {
    const arbre = await rendre();
    const rangees = arbre.root.findAll((n) => (
      n.props.testID === 'training-review-rating-row' && typeof n.type === 'string'
    ));

    expect(rangees).toHaveLength(2);
    rangees.forEach((rangee) => {
      const dansLaRangee = rangee.findAll((n) => (
        typeof n.type !== 'string' && n.props.accessibilityRole === 'radio'
        && typeof n.props.onPress === 'function'
      ));
      expect(dansLaRangee).toHaveLength(5);
    });
    pastilles(arbre).forEach((pastille) => {
      const style = [pastille.props.style].flat(5)
        .reduce((acc, s) => ({ ...acc, ...(s || {}) }), {});
      expect(style.height || style.minHeight).toBeGreaterThanOrEqual(44);
    });
  });

  it('etat 1 → 2 — le bouton s allume des qu une note est choisie', async () => {
    const arbre = await rendre();
    expect(appui(arbre, 'Envoyer mon avis').props.disabled).toBe(true);
    await act(async () => {
      pastilles(arbre)[7].props.onPress();
    });
    expect(appui(arbre, 'Envoyer mon avis').props.disabled).toBe(false);
    expect(pastilles(arbre)[7].props.accessibilityState)
      .toEqual(expect.objectContaining({ checked: true }));
  });

  it('etat 4 — 🔴 l envoi echoue : il le DIT, la note est gardee, on peut renvoyer', async () => {
    mockEnvoyer.mockRejectedValueOnce(new Error('reseau'));
    const arbre = await rendre();
    await act(async () => {
      pastilles(arbre)[7].props.onPress();
    });
    await act(async () => {
      appui(arbre, 'Envoyer mon avis').props.onPress();
    });

    expect(texte(arbre)).toContain('Ton avis n’est pas parti.');
    expect(texte(arbre)).toContain('Vérifie ta connexion, puis réessaie. Ta note est gardée.');
    expect(pastilles(arbre)[7].props.accessibilityState)
      .toEqual(expect.objectContaining({ checked: true }));
    expect(mockFermerPourLaSession).not.toHaveBeenCalled();

    await act(async () => {
      appui(arbre, 'Réessayer').props.onPress();
    });
    expect(mockEnvoyer).toHaveBeenCalledTimes(2);
    expect(mockEnvoyer).toHaveBeenLastCalledWith('evt-u13', { comment: null, rating: 8 });
  });

  it('etat 5 — merci, et la seance suivante a noter s ouvre d un appui', async () => {
    mockPayload = { items: [SEANCE, SEANCE_SUIVANTE], nextPrompt: SEANCE, totalPending: 2 };
    const arbre = await rendre();
    await act(async () => {
      pastilles(arbre)[7].props.onPress();
    });
    await act(async () => {
      appui(arbre, 'Envoyer mon avis').props.onPress();
    });

    const t = texte(arbre);
    expect(t).toContain('Merci, ton avis est parti.');
    expect(t).toContain('Karim verra ta note, pas ton nom.');
    expect(t).toContain('Encore 1 séance à noter');
    expect(t).toContain('Mar. 29 sept., fin à 17:00');

    const ligne = arbre.root.findAll((n) => n.props.testID === 'training-review-next-session')
      .find((n) => typeof n.props.onPress === 'function');
    await act(async () => {
      ligne.props.onPress();
    });
    expect(texte(arbre)).toContain('Entraînement U13 · mar. 29 sept., fin à 17:00');
    expect(appui(arbre, 'Envoyer mon avis').props.disabled).toBe(true);
  });

  it('etat 5 — sans autre seance : le merci, et « Fermer » ferme pour la session', async () => {
    const arbre = await rendre();
    await act(async () => {
      pastilles(arbre)[2].props.onPress();
    });
    await act(async () => {
      appui(arbre, 'Envoyer mon avis').props.onPress();
    });

    expect(texte(arbre)).toContain('Merci, ton avis est parti.');
    expect(texte(arbre)).not.toContain('séance à noter');
    await act(async () => {
      appui(arbre, 'Fermer').props.onPress();
    });
    expect(mockFermerPourLaSession).toHaveBeenCalled();
  });
});
