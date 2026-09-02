import { Switch, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserDetails from '../UserDetails';

// D06 — la CIBLE du pack design « profil unifié » (lg-screens2.jsx, composant
// `ProfilU`). Ce fichier a ete ecrit ROUGE avant la refonte, puis rendu vert.
//
// Il fige les trois regles qui font la valeur du lot :
//   1. un champ vide propose « Ajouter », plus jamais « Non renseigne » x9 ;
//   2. l'edition se fait en place, une sheet a UN SEUL champ, et la sauvegarde
//      n'envoie QUE ce champ (l'API l'accepte : `firebase-auth.ts:1120-1136`
//      n'ecrit un champ que s'il est `!== undefined`) ;
//   3. les champs JOUEUR disparaissent pour un dirigeant, et le nom du club
//      n'est jamais tronque.
//
// Il n'observe que le TEXTE VISIBLE et les proprietes de troncature.
// L'etat d'AVANT est fige dans `UserDetails.caracterisation.test.js`.

/** @type {any} */
let mockAuthValue;
/** @type {any} */
let mockFetchedUser;
/** @type {any[]} */
let mockChampsSheet = [];
/** @type {any} */
let mockProprietesFeuille = null;
const mockNavigate = jest.fn();
const mockUpdateMe = jest.fn();

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

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    // D39 — `UserDetails` tire desormais le contrat de formulaire, qui tire
    // `@/theme/strings` pour Joi, et ce module amorce i18next au chargement.
    // Sans cette doublure la suite ne se charge plus du tout. Meme ligne que
    // dans `ProfileEdit.caracterisation.test.js`.
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

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: async (/** @type {any} */ entree) => {
      const resultat = await options.mutationFn(entree);
      await options.onSuccess?.(resultat);
    },
  }),
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
  }),
}));

jest.mock('@/services/auth/authService', () => ({
  updateMe: (/** @type {any} */ charge) => {
    mockUpdateMe(charge);
    return Promise.resolve({ ...charge });
  },
}));

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
  default: () => ({ startGroupChat: jest.fn(), startWhisperChat: jest.fn() }),
}));

jest.mock('@/services/auth/authQueries', () => ({
  useGetUserById: () => ({
    data: mockFetchedUser, error: undefined, isLoading: false, refetch: jest.fn(),
  }),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useUserCurrentLicense: () => ({ data: undefined, refetch: jest.fn() }),
}));

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetPersonalStats: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
}));

jest.mock('@/services/userHistory/userHistoryQueries', () => ({
  useGetMyHistories: () => ({ refetch: jest.fn() }),
  useGetUserHistories: () => ({ refetch: jest.fn() }),
}));

// D39 — l'ecran joueur/entraineur charge les niveaux et les sections. Ces
// modules descendent vers le client HTTP, qui EXIGE `API_URL` au chargement et
// jette sinon : sans doublure, la suite ne se charge pas du tout.
jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({ data: [] }),
}));

jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => ({ data: [] }),
}));

// AC03 — le sport et la categorie viennent desormais des listes du SERVEUR.
// Sans ces doublures, l'ecran tire le vrai client HTTP et la suite ne se charge
// meme pas (« API_URL is missing »), comme pour les niveaux et les sections.
jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [{ documentId: 'act-1', name: 'Football' }] }),
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [{ documentId: 'cat-1', name: 'U13 (13 ans)' }] }),
}));

jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: () => 'geohash-test' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

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
        trophy: 1,
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

jest.mock('@/components/organisms/userHistorySection/UserHistorySection', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>SECTION HISTORIQUE SPORTIF</TexteRN>,
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

// La sheet d'edition rend ses enfants tant qu'elle est visible : c'est ce qui
// permet de lire le champ et d'appuyer sur « Enregistrer ».
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => {
      mockProprietesFeuille = proprietes;
      return proprietes.isVisible ? <View>{proprietes.children}</View> : null;
    },
  };
});

// `AutocompleteAddressInput` tire `react-native-bouncy-checkbox`, publie en ESM
// pur et absent de `transformIgnorePatterns` : sans cette doublure, la suite ne
// se charge pas du tout.
jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => {
      mockChampsSheet.push(proprietes);
      return <TexteRN>{`ADRESSE:${proprietes.label ?? ''}`}</TexteRN>;
    },
  };
});

// D39 — l'ecran joueur/entraineur tire `AutocompleteSelect` et `SelectAvatar`,
// qui descendent tous deux vers `react-native-bouncy-checkbox` (ESM pur, hors
// `transformIgnorePatterns`). Sans ces doublures la suite ne se charge pas.
jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => (
      <TexteRN>{`CHAMP:${proprietes.label ?? ''}`}</TexteRN>
    ),
  };
});

jest.mock('@/components/molecules/selectAvatar/SelectAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>SELECTEUR AVATAR</TexteRN>,
  };
});

jest.mock('@/components/molecules/input/Input', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => {
      mockChampsSheet.push(proprietes);
      return <TexteRN>{`CHAMP:${proprietes.label ?? ''}`}</TexteRN>;
    },
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { disabled, onPress, title }) => (
      <Pressable disabled={disabled} onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </Pressable>
    ),
  };
});

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

/**
 * Tout le texte visible de l'arbre rendu.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * Le noeud Text portant exactement ce contenu.
 * @param {any} arbre
 * @param {string} contenu
 * @returns {any}
 */
const texteExact = (arbre, contenu) => arbre.root
  .findAllByType(Text)
  .find((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children).trim() === contenu);

/**
 * Le pressable portant ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any}
 */
const pressablePortant = (arbre, libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud
    .findAllByType(Text)
    .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children).trim() === libelle));

/**
 * Appuie sur le pressable portant ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyerSur = async (arbre, libelle) => {
  const cible = pressablePortant(arbre, libelle);
  if (!cible) throw new Error(`Aucun pressable ne porte le libelle « ${libelle} »`);
  await act(async () => {
    cible.props.onPress();
  });
};

/** Le dirigeant du pack : nom, club, equipes entrainees, rien d'autre. */
const dirigeant = {
  club: { clubVerified: true, documentId: 'club-1', name: 'Olympique de Marseille' },
  documentId: 'user-1',
  firstname: 'Philippe',
  lastname: 'Courtoi',
  myTeams: [],
  phoneNumber: '+33612345678',
  role: { name: 'Dirigeant', type: 'president' },
  trainedTeams: [
    { documentId: 'team-1', name: 'Seniors A' },
    { documentId: 'team-2', name: 'U15 Filles' },
  ],
};

/**
 * Monte l'ecran pour l'utilisateur donne.
 * @param {any} utilisateurCourant
 * @param {any} [parametresRoute]
 * @returns {Promise<any>}
 */
const rendre = async (utilisateurCourant, parametresRoute = {}) => {
  mockAuthValue = {
    // D39 — l'ecran joueur/entraineur derive l'age de la date de naissance.
    formatBirthdateToDisplay: (/** @type {string} */ valeur) => String(valeur || ''),
    formatBirthdateToSend: (/** @type {string} */ valeur) => String(valeur || ''),
    getAuthTokens: () => ({ token: 'jeton-test' }),
    isCurrentClubVerified: utilisateurCourant?.club?.clubVerified === true,
    refetchUserData: jest.fn(),
    USER_ROLES: {
      coach: 'Entraineur',
      new: 'Authenticated',
      player: 'Joueur',
      president: 'Dirigeant',
      superAdmin: 'SuperAdmin',
    },
    userData: utilisateurCourant,
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

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchedUser = undefined;
  mockChampsSheet = [];
  mockProprietesFeuille = null;
});

describe('D06 · regle 1 — un champ vide propose « Ajouter »', () => {
  it('n\'ecrit plus jamais « Non renseigne »', async () => {
    const arbre = await rendre(dirigeant);

    expect(texteVisible(arbre)).not.toContain('Non renseigné');
  });

  it('propose « Ajouter » sur chaque coordonnee vide', async () => {
    const arbre = await rendre(dirigeant);

    // Email et Ville sont vides sur ce profil : les deux rangees le proposent.
    expect(pressablePortant(arbre, 'Email')).toBeDefined();
    expect(pressablePortant(arbre, 'Ville')).toBeDefined();
    expect(texteVisible(arbre)).toContain('Ajouter');
  });

  it('affiche la VALEUR quand le champ est rempli, pas « Ajouter »', async () => {
    const arbre = await rendre(dirigeant);

    const rangeeTelephone = pressablePortant(arbre, 'Téléphone');
    expect(rangeeTelephone).toBeDefined();
    const texteDeLaRangee = rangeeTelephone
      .findAllByType(Text)
      .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children).trim());
    expect(texteDeLaRangee).toContain('+33612345678');
    expect(texteDeLaRangee).not.toContain('Ajouter');
  });
});

describe('D06 · regle 2 — edition en place, un champ a la fois', () => {
  it('ouvre une sheet a UN SEUL champ quand on tape une rangee', async () => {
    const arbre = await rendre(dirigeant);

    await appuyerSur(arbre, 'Email');

    expect(mockChampsSheet).toHaveLength(1);
    expect(texteVisible(arbre)).toContain('Enregistrer');
    expect(texteVisible(arbre)).toContain('Annuler');
  });

  it('n\'envoie QUE le champ modifie', async () => {
    const arbre = await rendre(dirigeant);

    await appuyerSur(arbre, 'Email');
    await act(async () => {
      mockChampsSheet[0].onChangeText('philippe@example.com');
    });
    await appuyerSur(arbre, 'Enregistrer');

    expect(mockUpdateMe).toHaveBeenCalledTimes(1);
    expect(mockUpdateMe.mock.calls[0][0]).toEqual({ email: 'philippe@example.com' });
  });

  it('« Annuler » referme la sheet sans rien envoyer', async () => {
    const arbre = await rendre(dirigeant);

    await appuyerSur(arbre, 'Email');
    await appuyerSur(arbre, 'Annuler');

    expect(mockUpdateMe).not.toHaveBeenCalled();
    expect(texteVisible(arbre)).not.toContain('Enregistrer');
  });

  // Le numero de telephone est l'identifiant de connexion Firebase, et le
  // formulaire actuel le rend `readOnly`. Le pack le dessine comme une rangee
  // editable : on garde la rangee, mais PAS l'edition — la rendre modifiable
  // depuis le profil est un geste sur l'authentification, pas du design.
  it('laisse le telephone en lecture seule : la rangee n\'ouvre aucune sheet', async () => {
    const arbre = await rendre(dirigeant);

    const rangeeTelephone = pressablePortant(arbre, 'Téléphone');
    expect(rangeeTelephone).toBeDefined();
    await act(async () => {
      rangeeTelephone.props.onPress?.();
    });

    expect(mockChampsSheet).toHaveLength(0);
    expect(mockUpdateMe).not.toHaveBeenCalled();
  });

  it('ne garde AUCUN bouton « Continuer » global', async () => {
    const arbre = await rendre(dirigeant);

    expect(texteVisible(arbre)).not.toContain('Continuer');
  });
});

// ---------------------------------------------------------------------------
// D31 — les trois defauts de la recette du 2026-08-07 au soir sur cet ecran.
// ---------------------------------------------------------------------------

describe('D31 ① — la feuille d`edition doit pouvoir remonter au-dessus du clavier', () => {
  it('demande a Android le mode qui laisse la bibliotheque deplacer la feuille', async () => {
    const arbre = await rendre(dirigeant);
    await appuyerSur(arbre, 'Email');

    // `adjustResize` (le defaut de BottomModal) fait renoncer @gorhom a tout
    // deplacement sur Android, et Android 15 ne redimensionne plus la fenetre
    // a sa place : personne ne remontait la feuille.
    expect(mockProprietesFeuille.androidKeyboardInputMode).toBe('adjustPan');
  });

  it('n`impose RIEN a iOS : le comportement clavier reste celui par defaut', async () => {
    const arbre = await rendre(dirigeant);
    await appuyerSur(arbre, 'Email');

    // Le correctif passe par `android_keyboardInputMode`, ignore sur iOS ou le
    // mode `interactive` fonctionne deja. Toucher `keyboardBehavior` aurait au
    // contraire supprime l'evitement qui marche la-bas.
    expect(mockProprietesFeuille.keyboardBehavior).toBeUndefined();
  });
});

describe('D31 ② — le nom du champ n`est plus ecrit deux fois', () => {
  it('le champ texte ne reprend plus le libelle deja porte par le titre', async () => {
    const arbre = await rendre(dirigeant);

    await appuyerSur(arbre, 'Email');

    // La doublure rend « CHAMP:<label> » : le libelle du champ doit etre vide.
    expect(texteVisible(arbre)).toContain('CHAMP:');
    expect(texteVisible(arbre)).not.toContain('CHAMP:Email');
    expect(mockChampsSheet[0].label).toBeUndefined();
  });

  it('mais le champ garde un NOM ACCESSIBLE : l`etiquette part, pas l`accessibilite', async () => {
    const arbre = await rendre(dirigeant);

    await appuyerSur(arbre, 'Email');

    expect(mockChampsSheet[0].accessibilityLabel).toBe('Email');
  });

  it('le titre de la feuille, lui, reste : c`est lui qui dit ce qu`on edite', async () => {
    const arbre = await rendre(dirigeant);

    await appuyerSur(arbre, 'Email');

    expect(texteExact(arbre, 'Email')).toBeDefined();
  });

  it('meme regle sur la ligne Ville, dont le placeholder porte le nom accessible', async () => {
    const arbre = await rendre(dirigeant);

    await appuyerSur(arbre, 'Ville');

    expect(texteVisible(arbre)).not.toContain('ADRESSE:Ville');
    expect(mockChampsSheet[0].label).toBeUndefined();
    expect(mockChampsSheet[0].placeholder).toBe('Rechercher une ville');
  });
});

describe('D31 ③ — la MESURE : la feuille « Ville » s`ouvre-t-elle depuis cet ecran ?', () => {
  // Adel : « l'onglet ville ne s'ouvre pas pour modifier ». Le prompt demandait
  // de trancher entre « la feuille ne s'ouvre pas » (ce lot) et « elle s'ouvre
  // et la recherche a l'interieur ne repond pas » (lot D32). Ces deux tests
  // sont la mesure : ils prouvent que la MOITIE portee par cet ecran fonctionne.
  it('la rangee Ville est bien pressable et ouvre la feuille', async () => {
    const arbre = await rendre(dirigeant);

    expect(mockProprietesFeuille.isVisible).toBe(false);
    await appuyerSur(arbre, 'Ville');

    expect(mockProprietesFeuille.isVisible).toBe(true);
  });

  it('et la feuille monte bien le champ de recherche d`adresse, pas un champ texte', async () => {
    const arbre = await rendre(dirigeant);

    await appuyerSur(arbre, 'Ville');

    expect(texteVisible(arbre)).toContain('ADRESSE:');
    expect(texteVisible(arbre)).toContain('Enregistrer');
    expect(mockChampsSheet).toHaveLength(1);
  });
});

describe('D06 · regle 3 — les champs JOUEUR disparaissent pour un dirigeant', () => {
  it('n\'affiche ni taille ni poids a un dirigeant', async () => {
    const arbre = await rendre(dirigeant);
    const texte = texteVisible(arbre);

    expect(texte).not.toContain('Taille');
    expect(texte).not.toContain('Poids');
  });

  it('n\'affiche ni poste ni section a un dirigeant', async () => {
    const arbre = await rendre(dirigeant);
    const texte = texteVisible(arbre);

    expect(texte).not.toContain('Poste');
    expect(texte).not.toContain('Section');
  });

  it('n\'affiche ni stats de match ni retours du coach a un dirigeant', async () => {
    const arbre = await rendre(dirigeant);
    const texte = texteVisible(arbre);

    expect(texte).not.toContain('Stats de match');
    expect(texte).not.toContain('Retours du coach');
  });

  // ⚠️ LES DEUX TESTS SUIVANTS ONT ETE INVERSES PAR LE LOT D39, VOLONTAIREMENT.
  //
  // Ce qu'ils exigeaient jusqu'au 2026-08-08 : « un joueur ou un entraineur qui
  // regarde son propre profil garde la fiche actuelle, avec ses stats, ses
  // retours du coach et ses equipes ». La raison etait juste : le pack de D06
  // ne montrait AUCUNE destination a ces trois blocs, donc les faire entrer
  // dans l'ecran unifie les aurait effaces. Une perte, pas une refonte.
  //
  // Ce qui a change : le pack « Profils JOUEUR & ENTRAINEUR »
  // (`claude design/export/design_handoff_profils_joueur_entraineur/`) leur
  // DONNE une destination, capture a l'appui —
  //   · les stats -> la rangee compacte a 6 valeurs (`captures_profil_joueur/01a`)
  //   · les retours du coach et les equipes -> les rangees 52 pt de « Suivi »
  //     (`captures_profil_joueur/01c`)
  // — et il pose la regle d'or qui commande le reste : « le contenu vient du
  // ROLE du compte — aucun bloc joueur atteignable sur un profil coach, et
  // inversement ». C'est cette derniere phrase qui retire les stats de match au
  // COACH : chez lui elles affichaient 0 partout, c'etait un heritage joueur.
  //
  // ⛔ La regle 3 elle-meme n'est PAS abandonnee : les trois tests ci-dessus
  // (le dirigeant ne voit ni taille, ni poids, ni poste, ni stats) restent
  // intacts et verts. Ce qui change, c'est que joueur et entraineur ont
  // desormais CHACUN leur propre soustraction, au lieu de n'en avoir aucune.
  //
  // Le detail du contenu de ces deux ecrans se prouve dans
  // `SelfProfilePlayerCoach.test.js` ; ici on ne fige que l'AIGUILLAGE et
  // l'absence de perte.
  it('donne au JOUEUR sa page editable, sans rien perdre de D06', async () => {
    const arbre = await rendre({
      ...dirigeant,
      height: '1.80',
      myTeams: [{ documentId: 'team-9', name: 'Seniors B' }],
      position: 'Ailier',
      role: { name: 'Joueur' },
      trainedTeams: [],
      weight: '75',
    });
    const texte = texteVisible(arbre);

    // Les champs joueur restent, a leur place du pack.
    expect(texte).toContain('Taille');
    expect(texte).toContain('Poids');
    expect(texte).toContain('Poste');
    // Les trois blocs que D06 protegeait ont chacun leur destination.
    expect(texte).toContain('Matchs');
    expect(texte).toContain('Retours du coach');
    expect(texte).toContain('Mes équipes');
  });

  it('retire au COACH les blocs joueur, stats de match comprises', async () => {
    const arbre = await rendre({ ...dirigeant, role: { name: 'Entraineur' } });
    const texte = texteVisible(arbre);

    expect(texte).not.toContain('Matchs');
    expect(texte).not.toContain('Retours du coach');
    expect(texte).not.toContain('Poste');
    // Ce qui lui revient, en revanche, est bien la.
    expect(texte).toContain('Équipes entraînées');
  });
});

describe('D06 · regle 4 — le nom du club n\'est JAMAIS tronque', () => {
  const nomLong = 'Association Sportive et Culturelle des Quartiers Nord de Marseille';

  it('ne borne pas le nombre de lignes', async () => {
    const arbre = await rendre({
      ...dirigeant,
      club: { clubVerified: true, documentId: 'club-1', name: nomLong },
    });

    const noeud = texteExact(arbre, nomLong);
    expect(noeud).toBeDefined();
    expect(noeud.props.numberOfLines).toBeUndefined();
  });

  it('ne le coupe ni par ellipse ni par capitales', async () => {
    const arbre = await rendre({
      ...dirigeant,
      club: { clubVerified: true, documentId: 'club-1', name: nomLong },
    });

    const noeud = texteExact(arbre, nomLong);
    const styleAplati = [noeud.props.style].flat(Infinity).filter(Boolean);
    const enCapitales = styleAplati.some(
      (/** @type {any} */ style) => style?.textTransform === 'uppercase',
    );
    expect(enCapitales).toBe(false);
    expect(noeud.props.ellipsizeMode).toBeUndefined();
    expect(texteVisible(arbre)).toContain(nomLong);
  });
});

describe('D06 · la structure du pack', () => {
  it('titre l\'ecran « Mon profil », sans capitales', async () => {
    const arbre = await rendre(dirigeant);
    const texte = texteVisible(arbre);

    expect(texte).toContain('Mon profil');
    expect(texte).not.toContain('INFOS PROFIL');
  });

  it('porte les quatre sections du pack', async () => {
    const arbre = await rendre(dirigeant);
    const texte = texteVisible(arbre);

    expect(texte).toContain('Coordonnées');
    expect(texte).toContain('Profil sportif');
    expect(texte).toContain('Équipes entraînées');
    expect(texte).toContain('Visibilité');
  });

  it('marque le role par une chip, et la certification du club', async () => {
    const arbre = await rendre(dirigeant);
    const texte = texteVisible(arbre);

    expect(texte).toContain('Dirigeant');
    expect(texte).toContain('Certifié');
  });

  // La chip lit le role reel plutot que d'ecrire « Dirigeant » en dur : si
  // l'ecran est un jour ouvert aux autres roles, elle suivra sans correctif.
  it('lit le role au lieu de l\'ecrire en dur', async () => {
    const { getUserRoleKey } = jest.requireActual('@/domains/auth/authUseCases');

    expect(getUserRoleKey('Dirigeant')).toBe('president');
    expect(getUserRoleKey('Joueur')).toBe('player');
    expect(getUserRoleKey('Entraineur')).toBe('coach');
  });

  // Le club non certifie ne doit pas porter la chip verte.
  it('ne montre « Certifié » que si le club l\'est', async () => {
    const arbre = await rendre({
      ...dirigeant,
      club: { clubVerified: false, documentId: 'club-1', name: 'Olympique de Marseille' },
    });

    expect(texteVisible(arbre)).not.toContain('Certifié');
    expect(texteVisible(arbre)).toContain('Olympique de Marseille');
  });

  it('porte un interrupteur « Profil visible » avec sa phrase d\'aide', async () => {
    const arbre = await rendre(dirigeant);

    expect(texteVisible(arbre)).toContain('Profil visible');
    expect(arbre.root.findAllByType(Switch)).toHaveLength(1);
    expect(texteVisible(arbre)).toContain('recherche');
  });

  it('liste chaque equipe entrainee comme une rangee', async () => {
    const arbre = await rendre(dirigeant);

    expect(pressablePortant(arbre, 'Seniors A')).toBeDefined();
    expect(pressablePortant(arbre, 'U15 Filles')).toBeDefined();
  });

  it('mene a l\'ecran d\'edition complet par le crayon de la carte identite', async () => {
    const arbre = await rendre(dirigeant);

    const crayon = arbre.root
      .findAllByType(TouchableOpacity)
      .find((/** @type {any} */ noeud) => (
        noeud.props.accessibilityLabel === 'Modifier mon nom et ma photo'
      ));
    expect(crayon).toBeDefined();
    await act(async () => {
      crayon.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('ProfileEdit');
  });
});

describe('D06 · le garde-fou : le profil d\'AUTRUI ne change pas', () => {
  it('garde « Prive » sur les coordonnees de quelqu\'un d\'autre', async () => {
    mockFetchedUser = {
      documentId: 'autre-1',
      email: 'secret@example.com',
      firstname: 'Autre',
      lastname: 'Joueur',
      phoneNumber: '+33699999999',
      role: { name: 'Joueur' },
    };

    const arbre = await rendre(
      { documentId: 'user-1', role: { name: 'Dirigeant' } },
      { userId: 'autre-1' },
    );
    const texte = texteVisible(arbre);

    expect(texte).toContain('Privé');
    expect(texte).not.toContain('secret@example.com');
    expect(texte).not.toContain('+33699999999');
  });

  it('n\'offre AUCUNE rangee editable sur le profil de quelqu\'un d\'autre', async () => {
    mockFetchedUser = {
      documentId: 'autre-1', firstname: 'Autre', lastname: 'Joueur', role: { name: 'Joueur' },
    };

    const arbre = await rendre(
      { documentId: 'user-1', role: { name: 'Dirigeant' } },
      { userId: 'autre-1' },
    );

    expect(texteVisible(arbre)).not.toContain('Ajouter');
    expect(mockChampsSheet).toHaveLength(0);
  });
});
