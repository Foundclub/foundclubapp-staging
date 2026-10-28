import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserDetails from '../UserDetails';

// D06 (E6) : `UserDetails.js` fait 1 211 lignes, porte DOUZE points d'entree
// (recrutement, equipe, conversation, club, notifications, hub de demandes...)
// et n'avait AUCUN test. C'est LUI l'ecran « INFOS PROFIL / DIRIGEANT » que le
// pack design voulait fusionner avec le formulaire — pas `Profile.js`, qui est
// l'ecran « Mon compte » (abonnement, bascule de compte, deconnexion).
//
// Ce fichier a d'abord FIGE l'ecran d'origine, puis a suivi la refonte.
//
// CE QUI EN A ETE RETIRE, ET OU C'EST PARTI — rien n'a ete supprime, tout a
// suivi le comportement qu'il decrit. Les cinq tests « mon propre profil »
// (champs joueur montres a un dirigeant, « Non renseigne » repete neuf fois,
// titre « INFOS PROFIL », nom de club tronque a une ligne, equipes entrainees)
// decrivaient un ecran qui n'existe plus : depuis D06, `UserDetails` delegue
// `isSelfProfile` a `SelfProfileUnified`. Ils sont devenus leur contraire dans
// `UserDetails.profilUnifie.test.js`, qui verifie la CIBLE du pack.
//
// Ce qui reste ici est le chemin que la refonte ne traverse pas et ne doit
// jamais casser : le profil de QUELQU'UN D'AUTRE, avec son masquage « Prive ».
//
// Il n'observe que le TEXTE VISIBLE, jamais la forme de l'arbre. Theme et
// traductions sont les VRAIS modules : un mock en Proxy rend les echecs Jest
// illisibles (constat du lot paywall du 2026-08-02).

/** @type {any} */
let mockAuthValue;
/** @type {any} */
let mockFetchedUser;
/** @type {any} */
let mockPersonalStats;
/** @type {any} */
let mockPersonalStatsError;
/** PAR-L12 — le mode parent d'un compte sportif. */
let mockIsParentMode = false;
const mockNavigate = jest.fn();

// BLOQUER (02/09) — `UserDetails` lit desormais la liste des personnes que j ai
// bloquees. Ce module-la importe le client HTTP, qui refuse de se charger sans
// `.env` — absent de TOUT worktree. Sans cette doublure, la suite ENTIERE
// echoue AU CHARGEMENT, sans executer un seul test (« Test Suites: 1 failed,
// Tests: 0 »).
jest.mock('@/services/userBlock/userBlockQueries', () => ({
  useBlockUser: () => ({ isPending: false, mutate: jest.fn() }),
  useGetMyBlockedUsers: () => ({ data: [], refetch: jest.fn() }),
  useUnblockUser: () => ({ isPending: false, mutate: jest.fn() }),
}));

// ST-RETOURS (02/10) — le profil lit « ce que j ai deja lu » des retours du coach. Le service
// importe le client HTTP, qui refuse de se charger sans .env : il est double ici comme les autres.
jest.mock('@/services/coachFeedback/coachFeedbackQueries', () => ({
  useGetCoachFeedbackFollow: () => ({ data: {}, isSuccess: true }),
  useUpdateCoachFeedbackFollow: () => ({ mutate: jest.fn() }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    // D39 — `UserDetails` tire desormais le contrat de formulaire, qui tire
    // `@/theme/strings` pour Joi, et ce module amorce i18next au chargement.
    // Sans cette doublure la suite ne se charge plus du tout.
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = String(cle || '').split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        if (typeof valeur === 'string') return valeur;
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthValue,
}));

jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({
    getClubInitials: (/** @type {string} */ nom) => String(nom || '').slice(0, 2).toUpperCase(),
  }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    startGroupChat: jest.fn(),
    startWhisperChat: jest.fn(),
  }),
}));

jest.mock('@/services/auth/authQueries', () => ({
  useGetUserById: () => ({
    data: mockFetchedUser,
    error: undefined,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useUserCurrentLicense: () => ({ data: undefined, refetch: jest.fn() }),
}));

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetPersonalStats: () => ({
    data: mockPersonalStats,
    error: mockPersonalStatsError,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/services/userHistory/userHistoryQueries', () => ({
  useGetMyHistories: () => ({ refetch: jest.fn() }),
  useGetUserHistories: () => ({ refetch: jest.fn() }),
}));

// PAR-L7 (13/10) — « Mon profil » d'un parent porte le bloc « Mes enfants » (`BlocMesEnfants`,
// qui lit trois services) : doublure commune, « aucun enfant » par defaut.
jest.mock('@/views/profile/parent/useMesEnfantsEnBref');

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

// `UserDetails` importe desormais `SelfProfileUnified`, qui tire
// `AutocompleteAddressInput` -> `react-native-bouncy-checkbox`, publie en ESM
// pur et absent de `transformIgnorePatterns`. Sans cette doublure, la suite ne
// se charge pas — meme si aucun test ici ne rend l'ecran unifie.
jest.mock('@/views/profile/SelfProfileUnified', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>ECRAN PROFIL UNIFIE</TexteRN>,
  };
});

// D39 — meme raison, pour l'ecran joueur/entraineur. Ce fichier caracterise
// l'AIGUILLAGE de `UserDetails`, pas le contenu des ecrans qu'il delegue.
jest.mock('@/views/profile/SelfProfilePlayerCoach', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>ECRAN PROFIL JOUEUR OU ENTRAINEUR</TexteRN>,
  };
});

// Le VRAI theme, sans le contexte React qui le porte. `Images` est le seul
// element stub, pour ne pas faire dependre ce test de la resolution des assets.
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
      Images: {
        arrowRight: 1,
        calendar: 1,
        check: 1,
        edit: 1,
        envelope: 1,
        phone: 1,
        pin: 1,
        running: 1,
        shield: 1,
        users: 1,
      },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

// La doublure GARDE ses proprietes : D40 verifie ou renvoie le bouton
// « + Ajouter » de la liste, et ca ne se lit pas dans le texte rendu.
const propsSectionHistorique = { current: /** @type {any} */ (null) };

jest.mock('@/components/organisms/userHistorySection/UserHistorySection', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => {
      propsSectionHistorique.current = props;
      return <TexteRN>SECTION HISTORIQUE SPORTIF</TexteRN>;
    },
  };
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { name }) => <TexteRN>{`AVATAR:${name}`}</TexteRN>,
  };
});

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { club }) => <TexteRN>{`BLASON:${club?.name || ''}`}</TexteRN>,
  };
});

jest.mock('@/components/atoms/teamShield/TeamShield', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { initials }) => <TexteRN>{`ECUSSON:${initials}`}</TexteRN>,
  };
});

/**
 * Aplati les enfants React en une chaine, pour lire le texte rendu.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tout le texte visible de l'arbre rendu, concatene.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * Monte l'ecran pour l'utilisateur courant donne.
 * @param {any} utilisateurCourant
 * @param {any} [parametresRoute]
 * @returns {Promise<any>}
 */
const rendre = async (utilisateurCourant, parametresRoute = {}) => {
  mockAuthValue = {
    refetchUserData: jest.fn(),
    USER_ROLES: {
      coach: 'Entraineur',
      new: 'Authenticated',
      player: 'Joueur',
      president: 'Dirigeant',
      superAdmin: 'SuperAdmin',
    },
    userData: utilisateurCourant,
    // PAR-L12 — le mode parent (choix d'affichage) : faux, sauf quand un temoin le demande.
    isParentMode: mockIsParentMode,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <UserDetails
        navigation={/** @type {any} */ ({ navigate: mockNavigate })}
        route={/** @type {any} */ ({ params: parametresRoute })}
      />,
    );
  });
  return arbre;
};

/** L'utilisateur qui REGARDE : un dirigeant, connecte. */
const dirigeantConnecte = { documentId: 'user-1', role: { name: 'Dirigeant', type: 'president' } };

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchedUser = undefined;
  mockPersonalStats = undefined;
  mockPersonalStatsError = undefined;
  propsSectionHistorique.current = null;
});

describe('UserDetails — la liste d\'experiences renvoie SUR la liste (D40 marche 3)', () => {
  // Le bouton « + Ajouter une experience » et le crayon vivent DANS la liste
  // (`UserHistorySection`). Ils annoncaient `Profile` comme route de retour :
  // on ajoutait depuis sa liste, et on atterrissait ailleurs. Il fallait
  // retraverser pour en ajouter une seconde — l'aller-retour que le motif
  // LinkedIn supprime.
  //
  // PROFIL-JOUEUR (A18, 30/09) — ces deux temoins passaient par l'APERCU
  // (`preview: true`) pour atteindre la page publique en proprietaire : ils
  // EXIGEAIENT donc que l'apercu garde « + Ajouter » et le crayon, c'est-a-dire
  // le defaut lui-meme. Ils atteignent desormais la meme page par un compte qui
  // y edite pour de vrai, sans ecran « voir = modifier ».
  // PAR-L7 (13/10, design parent E03) — ce compte etait un PARENT. Son profil n'a plus
  // d'historique sportif (le design le RETIRE au parent : il ne joue pas), donc il ne peut
  // plus porter ce contrat. Le design proposait de le rejouer « sur un profil de joueur » :
  // impossible ici, le joueur a son propre ecran (`SelfProfilePlayerCoach`, sans cette
  // liste). Le seul proprietaire qui arrive encore sur CETTE page avec la liste est un
  // compte SANS ROLE (« Membre ») : c'est lui qui la porte. Le contrat D40 (la route de
  // retour) est inchange, mot pour mot.
  const membreConnecte = {
    documentId: 'user-m',
    role: { name: 'Authenticated', type: 'authenticated' },
  };

  it('« + Ajouter » annonce la LISTE comme route de retour, pas le profil', async () => {
    await rendre(membreConnecte);

    const { onAddPress } = propsSectionHistorique.current;
    expect(onAddPress).toBeDefined();

    onAddPress();
    expect(mockNavigate).toHaveBeenCalledWith('HistoryWizardCategory', {
      resetContext: true,
      returnRoute: 'UserDetails',
    });
  });

  it('modifier une ligne revient AUSSI sur la liste', async () => {
    await rendre(membreConnecte);

    const { onEditPress } = propsSectionHistorique.current;
    expect(onEditPress).toBeDefined();

    onEditPress({ documentId: 'histo-1' });
    expect(mockNavigate).toHaveBeenCalledWith('HistoryWizardCategory', {
      editingEntry: { documentId: 'histo-1' },
      returnRoute: 'UserDetails',
    });
  });

  it('A18 — en APERCU, ni l\'un ni l\'autre n\'existe : la vitrine ne s\'edite pas', async () => {
    await rendre(dirigeantConnecte, { preview: true });

    const { isOwnProfile, onAddPress, onEditPress } = propsSectionHistorique.current;
    expect(isOwnProfile).toBe(false);
    expect(onAddPress).toBeUndefined();
    expect(onEditPress).toBeUndefined();
  });
});

describe('UserDetails — profil d\'AUTRUI : le garde-fou que D06 ne doit pas casser', () => {
  it('masque telephone, email et adresse derriere « Prive »', async () => {
    mockFetchedUser = {
      documentId: 'autre-1',
      email: 'secret@example.com',
      firstname: 'Autre',
      lastname: 'Joueur',
      phoneNumber: '+33699999999',
      role: { name: 'Joueur' },
    };

    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });
    const texte = texteVisible(arbre);

    expect(texte).toContain('Privé');
    expect(texte).not.toContain('secret@example.com');
    expect(texte).not.toContain('+33699999999');
  });

  it("n'affiche pas « Retours du coach » sur le profil de quelqu'un d'autre", async () => {
    mockFetchedUser = {
      documentId: 'autre-1', firstname: 'Autre', lastname: 'Joueur', role: { name: 'Joueur' },
    };

    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });

    expect(texteVisible(arbre)).not.toContain('Retours du coach');
  });

  it('garde la fiche detaillee : stats de match, profil sportif, infos personnelles', async () => {
    mockFetchedUser = {
      documentId: 'autre-1',
      firstname: 'Autre',
      height: '1.80',
      lastname: 'Joueur',
      position: 'Ailier',
      role: { name: 'Joueur' },
      weight: '75',
    };

    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });
    const texte = texteVisible(arbre);

    // ST-VUES (02/10, planche 17, « profil A ») : les stats d un joueur sont PRIVEES ;
    // un dirigeant qui n entraine pas son equipe ne les voit plus sur sa fiche.
    expect(texte).not.toContain('Stats de match');
    expect(texte).toContain('Profil sportif');
    expect(texte).toContain('Taille');
    expect(texte).toContain('Poids');
    expect(texte).toContain('Poste');
  });

  // VA1 — Sentry REACT-NATIVE-2 : `GET /api/users/:id/personal-stats` -> 403
  // « You cannot access personal stats for this user » depuis UserDetails, sur
  // les builds 2.6.35 a 2.6.43. Le serveur ne les montre qu'a la personne
  // elle-meme (admin firebase-auth.ts:1570) ; l'ecran affichait des ZEROS.
  it('stats de match refusees (403) : le dire, et ne pas afficher de zeros', async () => {
    mockFetchedUser = {
      documentId: 'autre-1', firstname: 'Autre', lastname: 'Joueur', role: { name: 'Joueur' },
    };
    mockPersonalStatsError = {
      details: {},
      message: 'You cannot access personal stats for this user',
      name: 'ForbiddenError',
      status: 403,
    };

    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });
    const texte = texteVisible(arbre);

    // ST-VUES (02/10, planche 17) : le refus ne se DIT plus par une carte « privé » —
    // la carte disparait (note « retiré »). Toujours aucun zero.
    expect(texte).not.toContain('Stats de match');
    expect(texte).not.toContain('Ces statistiques ne sont visibles que par la personne elle-même.');
    expect(texte).not.toContain('Victoires');
    expect(texte).not.toContain('Passes décisives');
  });

  it('GARDE-FOU : sans refus, les cartes de stats restent la', async () => {
    mockFetchedUser = {
      documentId: 'autre-1', firstname: 'Autre', lastname: 'Joueur', role: { name: 'Joueur' },
    };
    // ST-VUES (02/10, planche 17, « b oui ») : quand le serveur ACCORDE les stats
    // (ici : a l entraineur de l equipe du joueur, `scope`), elles sont la.
    mockPersonalStats = {
      overall: { football: { goals: 2 }, matches: 4, minutesPlayed: 300 },
      scope: { teams: [{ documentId: 'u15', name: 'U15' }], viewer: 'coach' },
    };

    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });
    const texte = texteVisible(arbre);

    // (La doublure de traduction de ce banc n interpole pas : « {{teams}} » reste tel quel.)
    expect(texte).toContain('Coach / Prof');
    expect(texte).toContain('300');
    expect(texte).toContain('Minutes');
    expect(texte).not.toContain('Ces statistiques ne sont visibles que par la personne elle-même.');
  });

  it('conserve « Non renseigne » sur la fiche de quelqu\'un d\'autre', async () => {
    mockFetchedUser = {
      documentId: 'autre-1', firstname: 'Autre', lastname: 'Joueur', role: { name: 'Joueur' },
    };

    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });

    expect(texteVisible(arbre)).toContain('Non renseigné');
  });

  it('rend chaque equipe comme un bouton qui ouvre sa fiche', async () => {
    mockFetchedUser = {
      documentId: 'autre-1',
      firstname: 'Autre',
      lastname: 'Joueur',
      myTeams: [{ documentId: 'team-1', name: 'Seniors A' }],
      role: { name: 'Joueur' },
    };

    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });

    const boutonEquipe = arbre.root
      .findAllByType(TouchableOpacity)
      .find((/** @type {any} */ noeud) => noeud
        .findAllByType(Text)
        .some((/** @type {any} */ texte) => (
          aplatirTexte(texte.props.children).trim() === 'Seniors A'
        )));

    expect(boutonEquipe).toBeDefined();
    await act(async () => {
      boutonEquipe.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalled();
  });
});

describe('UserDetails — mon propre profil part vers l\'ecran unifie', () => {
  it('delegue a `SelfProfileUnified` quand la route ne vise personne', async () => {
    const arbre = await rendre(dirigeantConnecte);

    expect(texteVisible(arbre)).toContain('ECRAN PROFIL UNIFIE');
  });

  it('y delegue aussi quand la route vise MON propre identifiant', async () => {
    const arbre = await rendre(dirigeantConnecte, { userId: 'user-1' });

    expect(texteVisible(arbre)).toContain('ECRAN PROFIL UNIFIE');
  });
});

// PAR-L7 (13/10, design parent E03, decision D1 A d'Adel du 12/10) — « MON PROFIL » D'UN PARENT :
// son identite, SES ENFANTS, ses infos personnelles. Rien de sportif : il ne joue pas.
describe('PAR-L7 — « Mon profil » d un PARENT : ses enfants, ses infos, rien de sportif', () => {
  const parentConnecte = {
    documentId: 'user-p',
    email: 'nadia@exemple.test',
    firstname: 'Nadia',
    lastname: 'Haddad',
    role: { name: 'Parent', type: 'parent' },
  };

  it('le titre dit « MON PROFIL », et le role reste dit dessous (« PARENT »)', async () => {
    const texte = texteVisible(await rendre(parentConnecte));

    expect(texte).toContain('MON PROFIL');
    expect(texte).not.toContain('INFOS PROFIL');
    expect(texte).toContain('PARENT');
  });

  it('dans l ordre : son identite, « Mes enfants », puis « Infos personnelles »', async () => {
    const texte = texteVisible(await rendre(parentConnecte));
    const identite = texte.indexOf('AVATAR:');
    const enfants = texte.indexOf('Mes enfants');
    const infos = texte.indexOf('Infos personnelles');

    expect(identite).toBeGreaterThan(-1);
    expect(enfants).toBeGreaterThan(identite);
    expect(infos).toBeGreaterThan(enfants);
  });

  it.each([
    ['SECTION HISTORIQUE SPORTIF', 'son historique sportif'],
    ['Profil sportif', 'son profil sportif'],
    ['Retours du coach', 'les retours d un coach (vides pour un parent)'],
    ['Équipes', 'ses equipes'],
  ])('il ne voit plus « %s » : %s', async (bloc) => {
    expect(texteVisible(await rendre(parentConnecte))).not.toContain(bloc);
  });

  it('LE GARDE-FOU : le profil d un parent vu par QUELQU UN D AUTRE ne change pas', async () => {
    mockFetchedUser = {
      documentId: 'user-parent-vu',
      firstname: 'Nadia',
      lastname: 'Haddad',
      role: { name: 'Parent', type: 'parent' },
    };
    const texte = texteVisible(await rendre(dirigeantConnecte, { userId: 'user-parent-vu' }));

    expect(texte).toContain('INFOS PROFIL');
    expect(texte).toContain('Profil sportif');
    expect(texte).not.toContain('Mes enfants');
  });
});

// PAR-L12 (13/10, design parent §2 bis, décision D6 A d'Adel du 12/10) — EN MODE PARENT, « Mon
// profil » d'un compte sportif est celui d'un parent (ses enfants, ses infos) ; hors mode parent,
// son écran sportif (« voir = modifier ») ne change pas. Son rôle de compte reste le sien.
describe('PAR-L12 — « Mon profil » suit le mode parent', () => {
  const joueurConnecte = {
    documentId: 'user-j',
    firstname: 'Youss',
    lastname: 'B',
    role: { name: 'Joueur', type: 'joueur' },
  };

  afterEach(() => { mockIsParentMode = false; });

  it('en mode parent : « MON PROFIL », « PARENT », ses enfants, sans l ecran sportif', async () => {
    mockIsParentMode = true;
    const texte = texteVisible(await rendre(joueurConnecte));

    expect(texte).toContain('MON PROFIL');
    expect(texte).toContain('PARENT');
    expect(texte).toContain('Mes enfants');
    expect(texte).not.toContain('ECRAN PROFIL JOUEUR OU ENTRAINEUR');
    expect(texte).not.toContain('Profil sportif');
  });

  it('hors mode parent : son ecran de joueur, comme avant', async () => {
    const texte = texteVisible(await rendre(joueurConnecte));

    expect(texte).toContain('ECRAN PROFIL JOUEUR OU ENTRAINEUR');
  });
});

// VIDEOCV (28/10, planche validée par Adel) — la vidéo YouTube du profil.
const CANONIQUE = 'https://www.youtube.com/watch?v=k3Lm9QpX2aE';
const joueurVu = {
  documentId: 'autre-1',
  firstname: 'Lucas',
  lastname: 'Martin',
  position: 'Ailier',
  role: { name: 'Joueur' },
};

/**
 * La carte « Vidéo » du profil vu.
 * @param {any} arbre
 * @returns {any[]}
 */
const carteVideo = (arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props.testID === 'user-details-video-card',
);

describe('VIDEOCV — la carte « Vidéo » du profil d un autre', () => {
  it('M8 — sans lien, RIEN : ni carte, ni espace', async () => {
    mockFetchedUser = joueurVu;
    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });
    expect(carteVideo(arbre)).toHaveLength(0);
  });

  it('M7 — avec lien : la carte, sa miniature, entre l identité et le profil sportif', async () => {
    mockFetchedUser = { ...joueurVu, videoCvUrl: CANONIQUE };
    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });
    expect(carteVideo(arbre)).not.toHaveLength(0);
    const miniature = arbre.root.findAll(
      (/** @type {any} */ n) => n.props.testID === 'video-cv-player-thumbnail' && n.props.source,
    )[0];
    expect(miniature.props.source.uri).toBe('https://i.ytimg.com/vi/k3Lm9QpX2aE/hqdefault.jpg');
    const texte = texteVisible(arbre);
    expect(texte.indexOf('Lucas Martin')).toBeLessThan(texte.indexOf('Vidéo'));
    expect(texte.indexOf('Vidéo')).toBeLessThan(texte.indexOf('Profil sportif'));
  });

  it('décision 2- A — un lien resté sur un ancien joueur ne s affiche pas', async () => {
    mockFetchedUser = { ...joueurVu, role: { name: 'Entraineur' }, videoCvUrl: CANONIQUE };
    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });
    expect(carteVideo(arbre)).toHaveLength(0);
  });
});
