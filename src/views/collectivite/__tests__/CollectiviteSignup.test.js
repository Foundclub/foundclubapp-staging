import {
  ScrollView, Text, TextInput, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { updateMe } from '@/services/auth/authService';

import CollectiviteSignup from '../CollectiviteSignup';
import CollectiviteSignupStatus from '../CollectiviteSignupStatus';

// 🏛️ COLL-ACCUEIL (01/10/2026) — PLANCHE 5 : l'inscription « Je représente une collectivité »
// (`P1-inscription-tel` / `-ordi`, états 2 à 6) et ce que voit la personne ensuite
// (`P2-gestion`, état 7). ROUGE avant le lot : aucun de ces écrans n'existait.
//   - étape 1 « Votre collectivité » : un type, un nom ; une collectivité déjà sur FoundClub
//     se choisit, une autre devient une demande d'ouverture ;
//   - étape 2 « Vous » : prénom, nom, fonction, e-mail professionnel, l'erreur sous son champ ;
//   - l'envoi crée une DEMANDE (aucun accès), et mène à « Demande envoyée » ;
//   - au VOUS, et AUCUNE question de sport.

/** @type {any} */
let mockTrouvees;
/** @type {any} */
let mockDemandes;
/** @type {any} */
let mockVilles;
/** @type {any} */
let mockParams;
const mockNavigate = jest.fn();
const mockReset = jest.fn();
const mockGoBack = jest.fn();
const mockEnvoi = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate, reset: mockReset }),
  useRoute: () => ({ params: mockParams }),
}));

jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        let texte = cle;
        if (typeof valeur === 'string') texte = valeur;
        else if (typeof repli === 'string') texte = repli;
        return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''));
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

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    refetchUserData: jest.fn(async () => {}),
    userData: { documentId: 'agent', firstname: '', lastname: '' },
  }),
}));

jest.mock('@/services/auth/authService', () => ({ updateMe: jest.fn(async () => ({})) }));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  // VILLE-INSCRIPTION (07/10) — les listes du référentiel, muettes ici : la saisie libre reste.
  useCollectiviteReferentiel: () => ({ data: [], isLoading: false }),
  useCollectiviteSignupSearch: () => mockTrouvees,
  // COLL-CONSOLE-BIS (03/10) — le référentiel des communes, muet ici : la saisie libre reste.
  useCommuneSearch: () => ({ data: [], isLoading: false }),
  useCreateManagerRequest: () => ({ isPending: false, mutateAsync: mockEnvoi }),
  useMyCollectivites: () => mockVilles,
  useMyManagerRequests: () => mockDemandes,
}));

jest.mock(
  '@/components/templates/FormScreenContainer',
  () => function FormScreenContainerMock({ children }) { return children; },
);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock(
  '@/components/molecules/profileButton/ProfileButton',
  () => function ProfileButtonMock() { return null; },
);
jest.mock('@/components/molecules/input/Input', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TextInput: Saisie, View: Vue } = jest.requireActual('react-native');
  return function InputMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      Vue,
      null,
      reactActuel.createElement(TexteRN, null, props.label),
      reactActuel.createElement(Saisie, {
        onBlur: props.onBlur,
        onChangeText: props.onChangeText,
        testID: props.testID,
        value: props.value,
      }),
      props.error ? reactActuel.createElement(TexteRN, null, props.error) : null,
    );
  };
});
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

const monter = async (/** @type {any} */ Ecran) => {
  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(<Ecran />); });
  return arbre;
};
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  const [cible] = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === testID
    && typeof n.props?.onPress === 'function');
  expect(cible).toBeDefined();
  await act(async () => { await cible.props.onPress(); });
};
const saisir = async (
  /** @type {any} */ arbre,
  /** @type {string} */ testID,
  /** @type {string} */ valeur,
) => {
  const champ = arbre.root.findAll((/** @type {any} */ n) => n.type === TextInput
    && n.props.testID === testID)[0];
  await act(async () => { champ.props.onChangeText(valeur); });
  await act(async () => { champ.props.onBlur?.(); });
};

const MONTRIVAGE = { documentId: 'ville-montrivage', name: 'Ville de Montrivage', type: 'commune' };

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockTrouvees = { data: [], isLoading: false };
  mockDemandes = { data: [], isLoading: false, refetch: jest.fn() };
  mockVilles = { data: [], isLoading: false, refetch: jest.fn() };
  mockEnvoi.mockResolvedValue({ data: { status: 'pending' } });
});

describe('COLL-ACCUEIL — planche 5 : « Votre collectivité » (étape 1 sur 2)', () => {
  it('au vous : le titre, la phrase, les 4 types ; « Continuer » attend un choix', async () => {
    const arbre = await monter(CollectiviteSignup);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Étape 1 sur 2',
      'Votre collectivité',
      'Laquelle représentez-vous ? FoundClub vérifie, puis vous en confie la gestion.',
      'Commune', 'Intercommunalité', 'Département', 'Région',
      'Nom de la commune',
    ]));
    const [continuer] = arbre.root.findAll((/** @type {any} */ n) => n.type === TouchableOpacity
      && n.props.testID === 'bouton-Continuer');
    expect(continuer.props.disabled).toBe(true);
  });

  it('une collectivité DÉJÀ sur FoundClub se choisit, puis l étape « Vous »', async () => {
    mockTrouvees = { data: [MONTRIVAGE], isLoading: false };
    const arbre = await monter(CollectiviteSignup);
    await saisir(arbre, 'collectivite-inscription-nom', 'Ville de Montriv');
    expect(textes(arbre))
      .toEqual(expect.arrayContaining(['Ville de Montrivage', 'Déjà sur FoundClub']));
    await appuyer(arbre, 'collectivite-inscription-trouvee-ville-montrivage');
    await appuyer(arbre, 'bouton-Continuer');
    expect(textes(arbre)).toEqual(expect.arrayContaining(['Étape 2 sur 2', 'Vous']));
  });

  it('une collectivité ABSENTE devient une demande d ouverture, et l écran le dit', async () => {
    const arbre = await monter(CollectiviteSignup);
    await saisir(arbre, 'collectivite-inscription-nom', 'Valfleuri');
    expect(textes(arbre))
      .toEqual(expect.arrayContaining(['Valfleuri', 'Pas encore sur FoundClub']));
    await appuyer(arbre, 'collectivite-inscription-nouvelle');
    expect(textes(arbre)).toContain(
      'Valfleuri n’a pas encore d’espace FoundClub. Continuez : votre demande servira à l’ouvrir.',
    );
  });
});

describe('COLL-ACCUEIL — planche 5 : « Vous » (étape 2 sur 2) et l envoi', () => {
  const allerAVous = async () => {
    mockTrouvees = { data: [MONTRIVAGE], isLoading: false };
    const arbre = await monter(CollectiviteSignup);
    await saisir(arbre, 'collectivite-inscription-nom', 'Montriv');
    await appuyer(arbre, 'collectivite-inscription-trouvee-ville-montrivage');
    await appuyer(arbre, 'bouton-Continuer');
    return arbre;
  };

  it('ce qu il faut pour vérifier, RIEN de sportif', async () => {
    const arbre = await allerAVous();
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Prénom', 'Nom', 'Votre fonction', 'E-mail professionnel',
    ]));
    expect(lus.some((texte) => /poste|catégorie|niveau|taille|poids/i.test(texte))).toBe(false);
  });

  it('l erreur s écrit SOUS le champ fautif dès qu on le quitte', async () => {
    const arbre = await allerAVous();
    await saisir(arbre, 'collectivite-inscription-professionalEmail', 'sports@');
    expect(textes(arbre)).toContain('Écrivez une adresse complète, par exemple sports@mairie.fr.');
    expect(mockEnvoi).not.toHaveBeenCalled();
  });

  it('envoyer : le nom du compte, puis LA DEMANDE (aucun accès), puis l envoi dit', async () => {
    const arbre = await allerAVous();
    await saisir(arbre, 'collectivite-inscription-firstname', 'Agnès');
    await saisir(arbre, 'collectivite-inscription-lastname', 'Mairie');
    await saisir(arbre, 'collectivite-inscription-jobTitle', 'Service des sports');
    await saisir(arbre, 'collectivite-inscription-professionalEmail', 'Sports@Montrivage.fr ');
    await appuyer(arbre, 'bouton-Envoyer ma demande');
    expect(updateMe).toHaveBeenCalledWith({ firstname: 'Agnès', lastname: 'Mairie' });
    expect(mockEnvoi).toHaveBeenCalledWith({
      collectiviteDocumentId: 'ville-montrivage',
      jobTitle: 'Service des sports',
      professionalEmail: 'sports@montrivage.fr',
    });
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'CollectiviteSignupStatus', params: { justSent: true } }],
    });
  });

  it('une demande déjà en cours se dit en français', async () => {
    mockEnvoi.mockRejectedValue({
      details: { code: 'COLLECTIVITE_MANAGER_REQUEST_DUPLICATE' }, status: 409,
    });
    const arbre = await allerAVous();
    await saisir(arbre, 'collectivite-inscription-firstname', 'Agnès');
    await saisir(arbre, 'collectivite-inscription-lastname', 'Mairie');
    await saisir(arbre, 'collectivite-inscription-jobTitle', 'Service des sports');
    await saisir(arbre, 'collectivite-inscription-professionalEmail', 'sports@montrivage.fr');
    await appuyer(arbre, 'bouton-Envoyer ma demande');
    expect(textes(arbre))
      .toContain('Une demande pour cette collectivité est déjà en cours de vérification.');
    expect(mockReset).not.toHaveBeenCalled();
  });
});

describe('COLL-ACCUEIL — planche 5 (états 5, 6), P2-gestion (état 7) : la demande', () => {
  const EN_ATTENTE = {
    collectivite: { documentId: 'ville-montrivage', name: 'Ville de Montrivage', type: 'commune' },
    createdAt: '2026-10-01T09:00:00.000Z',
    decidedAt: null,
    documentId: 'dm-1',
    refusalReason: null,
    status: 'pending',
  };

  it('juste envoyée : ce qui va se passer, sans date promise ; puis l attente', async () => {
    mockParams = { justSent: true };
    mockDemandes = { data: [EN_ATTENTE], isLoading: false, refetch: jest.fn() };
    const arbre = await monter(CollectiviteSignupStatus);
    expect(textes(arbre)).toContain('Demande envoyée');
    await appuyer(arbre, 'bouton-Compris');
    expect(textes(arbre)).toContain('Demande en cours de vérification');
  });

  it('en attente : la Ville, la date, et ce que l espace permettra', async () => {
    mockDemandes = { data: [EN_ATTENTE], isLoading: false, refetch: jest.fn() };
    const lus = textes(await monter(CollectiviteSignupStatus));
    expect(lus).toEqual(expect.arrayContaining([
      'Demande en cours de vérification',
      'Ville de Montrivage',
      'Ce que votre espace permettra',
      'Trancher les demandes de créneau des clubs, avec un message.',
      'Nous contacter',
    ]));
    expect(lus.some((texte) => texte.startsWith('Demande envoyée le '))).toBe(true);
  });

  it('refusée : le MOTIF de l équipe, « Nous contacter » et « Refaire une demande »', async () => {
    mockDemandes = {
      data: [{
        ...EN_ATTENTE,
        decidedAt: '2026-10-02T09:00:00.000Z',
        refusalReason: 'Lien non vérifié.',
        status: 'refused',
      }],
      isLoading: false,
      refetch: jest.fn(),
    };
    const arbre = await monter(CollectiviteSignupStatus);
    expect(textes(arbre))
      .toEqual(expect.arrayContaining(['Demande refusée', '« Lien non vérifié. »']));
    await appuyer(arbre, 'bouton-Refaire une demande');
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteSignup');
  });

  // FINITIONS14 · point 5 (T13-bis, planche 7, état 5) — « Compris » était collé sous le texte ;
  // la planche le pose EN PIED (`pied-fixe`), hors de la zone qui défile. Et les dates
  // s'écrivent comme la planche : « Demande envoyée le jeu. 1 oct. ».
  it('FIN14 · 🚨 juste envoyée : « Compris » est EN PIED, hors de la zone qui défile', async () => {
    mockParams = { justSent: true };
    mockDemandes = { data: [EN_ATTENTE], isLoading: false, refetch: jest.fn() };
    const arbre = await monter(CollectiviteSignupStatus);
    const [bouton] = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'bouton-Compris'
        && typeof n.props?.onPress === 'function',
    );
    let parent = bouton?.parent;
    let dansLeDefilement = false;
    while (parent) {
      if (parent.type === ScrollView) dansLeDefilement = true;
      parent = parent.parent;
    }
    expect(bouton).toBeDefined();
    expect(dansLeDefilement).toBe(false);
  });

  it('FIN14 · 🚨 les dates comme la planche : « jeu. 1 oct. », « ven. 2 oct. »', async () => {
    mockDemandes = { data: [EN_ATTENTE], isLoading: false, refetch: jest.fn() };
    expect(textes(await monter(CollectiviteSignupStatus)))
      .toContain('Demande envoyée le jeu. 1 oct.');
    mockDemandes = {
      data: [{
        ...EN_ATTENTE,
        decidedAt: '2026-10-02T09:00:00.000Z',
        refusalReason: 'Non.',
        status: 'refused',
      }],
      isLoading: false,
      refetch: jest.fn(),
    };
    expect(textes(await monter(CollectiviteSignupStatus))).toContain('Réponse du ven. 2 oct.');
  });

  it('acceptée : l espace de la Ville s ouvre', async () => {
    mockDemandes = {
      data: [{ ...EN_ATTENTE, status: 'accepted' }], isLoading: false, refetch: jest.fn(),
    };
    mockVilles = { data: [MONTRIVAGE], isLoading: false, refetch: jest.fn() };
    const arbre = await monter(CollectiviteSignupStatus);
    expect(textes(arbre)).toContain('Votre espace est ouvert');
    await appuyer(arbre, 'bouton-Ouvrir mon espace');
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'CollectiviteSpace', params: { collectiviteId: 'ville-montrivage' } }],
    });
  });
});

// 🏛️ VINSC2 (07/10/2026) — trouvé par la tournée T18 sur le site (capture
// SITE_I06_site_apres_compris_espace_ouvert_montrivage) : un compte DÉJÀ gestionnaire d'une
// Ville (Montrivage) qui demande une AUTRE Ville (Rouvres) voyait, après « Compris », « Votre
// espace est ouvert · Vous gérez désormais la Ville de Montrivage » — et RIEN sur sa demande en
// attente. ROUGE avant le lot : l'écran ne montrait qu'UN état, et « espace ouvert » gagnait.
// Les dates sont relatives à aujourd'hui : aucun témoin daté en dur (TEMOINS-DATES).
describe('VINSC2 — une demande en attente ne disparaît jamais derrière un autre état', () => {
  const JOUR = 24 * 60 * 60 * 1000;
  const ilYA = (/** @type {number} */ jours) => new Date(Date.now() - jours * JOUR).toISOString();
  const VILLE_ROUVRES = {
    documentId: 'ville-rouvres', name: 'Ville de Rouvres', type: 'commune',
  };
  const MONTRIVAGE_ACCEPTEE = {
    collectivite: MONTRIVAGE,
    createdAt: ilYA(20),
    decidedAt: ilYA(19),
    documentId: 'dm-montrivage',
    refusalReason: null,
    status: 'accepted',
  };
  const ROUVRES_EN_ATTENTE = {
    collectivite: VILLE_ROUVRES,
    createdAt: ilYA(0),
    decidedAt: null,
    documentId: 'dm-rouvres',
    refusalReason: null,
    status: 'pending',
  };
  const servir = (/** @type {any[]} */ data) => ({ data, isLoading: false, refetch: jest.fn() });

  it('🔴 T18 : gère Montrivage, demande Rouvres ⇒ après « Compris », les DEUX', async () => {
    mockParams = { justSent: true };
    mockDemandes = servir([MONTRIVAGE_ACCEPTEE, ROUVRES_EN_ATTENTE]);
    mockVilles = servir([MONTRIVAGE]);
    const arbre = await monter(CollectiviteSignupStatus);
    expect(textes(arbre).join(' ')).toContain('vous représentez bien la Ville de Rouvres');
    await appuyer(arbre, 'bouton-Compris');
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Votre espace est ouvert',
      'Vous gérez désormais la Ville de Montrivage sur FoundClub.',
      'Demande en cours de vérification',
      'Ville de Rouvres',
    ]));
    expect(lus.some((texte) => texte.startsWith('Demande envoyée le '))).toBe(true);
    // L'espace ouvert reste le geste principal.
    await appuyer(arbre, 'bouton-Ouvrir mon espace');
    expect(mockReset).toHaveBeenCalledWith(expect.objectContaining({
      routes: [expect.objectContaining({ params: { collectiviteId: 'ville-montrivage' } })],
    }));
  });

  it('🔴 déjà gestionnaire : le REFUS récent d une autre Ville se lit, motif compris', async () => {
    mockDemandes = servir([MONTRIVAGE_ACCEPTEE, {
      ...ROUVRES_EN_ATTENTE,
      decidedAt: ilYA(0),
      refusalReason: 'Lien non vérifié.',
      status: 'refused',
    }]);
    mockVilles = servir([MONTRIVAGE]);
    expect(textes(await monter(CollectiviteSignupStatus))).toEqual(expect.arrayContaining([
      'Votre espace est ouvert', 'Demande refusée', 'Ville de Rouvres', '« Lien non vérifié. »',
    ]));
  });

  it('🔒 un refus de plus de 30 jours ne s affiche plus à côté de l espace ouvert', async () => {
    mockDemandes = servir([MONTRIVAGE_ACCEPTEE, {
      ...ROUVRES_EN_ATTENTE,
      createdAt: ilYA(45),
      decidedAt: ilYA(40),
      refusalReason: 'Lien non vérifié.',
      status: 'refused',
    }]);
    mockVilles = servir([MONTRIVAGE]);
    const lus = textes(await monter(CollectiviteSignupStatus));
    expect(lus).toContain('Votre espace est ouvert');
    expect(lus).not.toContain('Demande refusée');
  });

  it('🔴 deux demandes en attente, aucun espace : les DEUX Villes se lisent', async () => {
    mockDemandes = servir([
      {
        ...ROUVRES_EN_ATTENTE, collectivite: MONTRIVAGE, createdAt: ilYA(3), documentId: 'dm-2',
      },
      ROUVRES_EN_ATTENTE,
    ]);
    const lus = textes(await monter(CollectiviteSignupStatus));
    expect(lus).toEqual(expect.arrayContaining([
      'Demande en cours de vérification', 'Ville de Rouvres', 'Ville de Montrivage',
    ]));
  });

  it('🔴 la plus récente REFUSÉE, une plus ancienne EN ATTENTE : les deux se lisent', async () => {
    mockDemandes = servir([
      {
        ...ROUVRES_EN_ATTENTE, collectivite: MONTRIVAGE, createdAt: ilYA(3), documentId: 'dm-2',
      },
      {
        ...ROUVRES_EN_ATTENTE,
        decidedAt: ilYA(0),
        refusalReason: 'Adresse non officielle.',
        status: 'refused',
      },
    ]);
    const lus = textes(await monter(CollectiviteSignupStatus));
    expect(lus).toEqual(expect.arrayContaining([
      'Demande refusée', '« Adresse non officielle. »',
      'Demande en cours de vérification', 'Ville de Montrivage',
    ]));
  });
});
