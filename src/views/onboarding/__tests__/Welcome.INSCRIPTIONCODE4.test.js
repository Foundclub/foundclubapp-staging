/* eslint-disable max-len */
import { Platform, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Welcome from '../Welcome';

// INSCRIPTION-CODE-4 (20/11/2026, planche V2 B1-B5 « ok », décisions du chef du 20/11 01:31) —
// LES CINQ « BIENVENUE » BRANCHÉS. B1 joueur avec club, B2 sans club, B3 pratiquant, B4 coach,
// B5 parent. Dirigeant et super-admin gardent l'écran d'aujourd'hui (décision n° 1).

const mockStartTour = jest.fn(() => true);
const mockMarkOnboardingComplete = jest.fn();
const mockInviter = jest.fn();
const mockRole = { current: 'player' };
const mockUser = { current: /** @type {any} */ ({}) };
const mockEnfants = { current: /** @type {any[]} */ ([]) };
const mockSubscriptionSummary = { current: /** @type {any} */ (null) };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ arg) => {
      const repli = typeof arg === 'string' ? arg : arg?.defaultValue;
      if (typeof repli !== 'string') return key;
      return repli.replace(/{{(\w+)}}/g, (_, k) => String(arg?.[k] ?? ''));
    },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('@/theme/themeContext', () => {
  const leaf = {};
  const ramp = () => new Proxy({}, { get: () => leaf });
  const { colors } = jest.requireActual('@/theme/colors');
  return {
    __esModule: true,
    default: () => ({
      Alignments: ramp(),
      Colors: colors,
      Fonts: ramp(),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => ramp() }),
    }),
  };
});
jest.mock('@/domains/auth/authUseCases', () => ({
  ...jest.requireActual('@/domains/auth/authUseCases'),
  getUserRoleKey: () => mockRole.current,
  markOnboardingComplete: (/** @type {string} */ id) => mockMarkOnboardingComplete(id),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    clubVerificationSummary: null,
    entitlementsSummary: null,
    getPostOnboardingHomeRoute: () => 'HomeTab',
    inviteTeamPlayers: (/** @type {any} */ x) => mockInviter(x),
    refetchUserData: jest.fn(),
    subscriptionAccessLevel: null,
    subscriptionSummary: mockSubscriptionSummary.current,
    userData: mockUser.current,
    userDataError: null,
    userDataLoading: false,
  }),
}));
jest.mock('@/services/declaredChild/declaredChildQueries', () => ({
  useGetMyDeclaredChildren: () => ({ data: mockEnfants.current }),
}));
jest.mock('@/store/appContext', () => ({
  storage: { getBoolean: () => false, set: jest.fn() },
  useAppContext: () => [{ auth: { user: { documentId: 'u-4' } } }, jest.fn()],
}));
jest.mock('@/context/TourContext', () => ({ useTour: () => ({ startTour: mockStartTour }) }));
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: T, TouchableOpacity: P } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onPress, title }) => <P accessibilityRole="button" onPress={onPress}><T>{title}</T></P>,
  };
});
jest.mock('@/components/templates/FormScreenContainer', () => {
  const { View: V } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children }) => <V>{children}</V> };
});

const ilYA = (/** @type {number} */ ans) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - ans, 0, 1);
  return d.toISOString().slice(0, 10);
};
const LINA = {
  address: { city: 'Marseille' },
  birthdate: ilYA(30),
  documentId: 'u-4',
  firstname: 'Lina',
  lastname: 'Morel',
  position: 'Milieu',
  preferredSport: 'Football',
};
const DEMANDE = { club: { documentId: 'club-1', name: 'US Exemple Marseille' }, state: 'pending' };

const rendre = () => {
  const navigation = { navigate: jest.fn(), replace: jest.fn(), reset: jest.fn() };
  let arbre;
  act(() => { arbre = renderer.create(<Welcome navigation={/** @type {any} */ (navigation)} />); });
  return { navigation, tree: /** @type {any} */ (arbre) };
};
const textes = (tree) => tree.root.findAllByType(Text)
  .map((n) => n.props.children).flat().filter((v) => typeof v === 'string');
const presser = (tree, libelle) => {
  const cible = tree.root.findAllByType(TouchableOpacity)
    .find((n) => n.findAllByType(Text).some((x) => String(x.props.children) === libelle));
  if (!cible) throw new Error(`pas de bouton « ${libelle} »`);
  act(() => { cible.props.onPress(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRole.current = 'player';
  mockUser.current = { ...LINA };
  mockEnfants.current = [];
  mockSubscriptionSummary.current = null;
});

describe('B1 — joueur, un club choisi', () => {
  it('titre, phrase, carte, deux actions, la petite ligne et une sortie', () => {
    mockUser.current = { ...LINA, clubMembershipRequests: [DEMANDE], jerseyNumber: 7 };
    const lus = textes(rendre().tree);
    expect(lus).toEqual(expect.arrayContaining([
      'Bienvenue, Lina',
      'Ton compte est prêt. US Exemple Marseille a reçu ta demande.',
      'LINA MOREL',
      'FOOTBALL · MILIEU',
      '30 ans',
      'En attente',
      'Ce que tu peux faire maintenant',
      'Voir les matchs et les entraînements près de chez toi',
      'Compléter ta carte : il manque ta photo',
      'Reste informé·e des nouveautés grâce aux notifications.',
      'Aller à mon accueil',
    ]));
    // Avant : « Bienvenue dans » + logo + « Prêt·e à trouver ton club et évoluer dans le sport ? ».
    expect(lus).not.toContain('Prêt·e à trouver ton club et évoluer dans le sport ?');
  });

  it('« Aller à mon accueil » : le tour du joueur, puis l accueil (comme « Allons-y ! » avant)', () => {
    mockUser.current = { ...LINA, clubMembershipRequests: [DEMANDE] };
    const { navigation, tree } = rendre();
    presser(tree, 'Aller à mon accueil');
    expect(mockStartTour).toHaveBeenCalledWith('player');
    expect(mockMarkOnboardingComplete).toHaveBeenCalledWith('u-4');
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'HomeTab' }] });
  });

  it('déjà membre, photo posée : « Tu fais partie de », sans la ligne de la photo', () => {
    mockUser.current = { ...LINA, avatar: { url: 'x.png' }, club: { documentId: 'c2', name: 'FC Membre' } };
    const lus = textes(rendre().tree);
    expect(lus).toContain('Ton compte est prêt. Tu fais partie de FC Membre.');
    expect(lus).toContain('FC Membre');
    expect(lus).not.toContain('Compléter ta carte : il manque ta photo');
  });

  it('une action quitte l inscription vers son écran, l accueil dessous', () => {
    mockUser.current = { ...LINA, clubMembershipRequests: [DEMANDE] };
    const { navigation, tree } = rendre();
    presser(tree, 'Voir les matchs et les entraînements près de chez toi');
    expect(mockMarkOnboardingComplete).toHaveBeenCalledWith('u-4');
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 1, routes: [{ name: 'HomeTab' }, { name: 'SearchEvents' }],
    });
  });

  it('sans prénom : « Bienvenue »', () => {
    mockUser.current = { ...LINA, clubMembershipRequests: [DEMANDE], firstname: '' };
    expect(textes(rendre().tree)).toContain('Bienvenue');
  });
});

describe('B2 — joueur sans club', () => {
  it('phrase, recherche par activité et ville, « Trouver un club » mène à la recherche', () => {
    const { navigation, tree } = rendre();
    const lus = textes(tree);
    expect(lus).toEqual(expect.arrayContaining([
      'Ton compte est prêt. Tu n’as pas encore de club : on t’aide à en trouver un.',
      'Voir les clubs de football près de Marseille',
      'Voir les séances d’essai et les détections ouvertes',
      'Aucun',
    ]));
    // Avant : « Rejoins un club et progresse dans ta carrière sportive » : déplacé vers ces lignes.
    expect(lus).not.toContain(' et progresse dans ta carrière sportive.');
    presser(tree, 'Trouver un club');
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 1, routes: [{ name: 'HomeTab' }, { name: 'SearchClubs' }],
    });
  });

  it('sans ville : « près de chez toi »', () => {
    mockUser.current = { ...LINA, address: null };
    expect(textes(rendre().tree)).toContain('Voir les clubs de football près de chez toi');
  });

  it('hors compétition (danse) : ni détection ni poste ni numéro, la carte sans terrain', () => {
    mockUser.current = { ...LINA, jerseyNumber: 7, preferredSport: 'Danse' };
    const lus = textes(rendre().tree);
    expect(lus).toContain('Voir les cours d’essai ouverts');
    expect(lus.join(' ')).not.toContain('détection');
    expect(lus).toContain('DANSE');
    expect(lus).toContain('VILLE');
    expect(lus).not.toContain('7');
  });

  it('nature (spéléologie) : « séances découverte »', () => {
    mockUser.current = { ...LINA, preferredSport: 'Spéléologie' };
    expect(textes(rendre().tree)).toContain('Voir les séances découverte ouvertes');
  });

  describe('sur le site', () => {
    let plateforme;
    beforeEach(() => { plateforme = jest.replaceProperty(Platform, 'OS', 'web'); });
    afterEach(() => plateforme.restore());
    it('l accueil remplace l inscription, puis la recherche s ouvre', () => {
      const { navigation, tree } = rendre();
      presser(tree, 'Trouver un club');
      expect(navigation.replace).toHaveBeenCalledWith('HomeTab');
      expect(navigation.navigate).toHaveBeenCalledWith('SearchClubs', undefined);
      expect(navigation.navigate.mock.invocationCallOrder[0])
        .toBeGreaterThan(navigation.replace.mock.invocationCallOrder[0]);
    });
  });
});

describe('B3 — pratiquant', () => {
  it('spéléologie : les mots du club, carte sans âge ni numéro, « Écrire au club »', () => {
    mockUser.current = {
      ...LINA, clubMembershipRequests: [DEMANDE], jerseyNumber: 7, preferredSport: 'Spéléologie',
    };
    const { navigation, tree } = rendre();
    const lus = textes(tree);
    expect(lus).toEqual(expect.arrayContaining([
      'Ton compte est prêt. Ton club a reçu ta demande : tu verras ses sorties dès qu’il t’aura accepté.',
      'Voir les sorties ouvertes près de chez toi',
      'Écrire au club',
      'VILLE',
      'Marseille',
      'SPÉLÉOLOGIE',
    ]));
    expect(lus).not.toContain('ÂGE');
    expect(lus).not.toContain('7');
    presser(tree, 'Écrire au club');
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 1,
      routes: [{ name: 'HomeTab' }, { name: 'ClubStack', params: { params: { clubId: 'club-1' }, screen: 'Club' } }],
    });
  });

  it('culture (danse) : « cours », pas « sorties »', () => {
    mockUser.current = { ...LINA, clubMembershipRequests: [DEMANDE], preferredSport: 'Danse' };
    const lus = textes(rendre().tree);
    expect(lus).toContain('Voir les cours ouverts près de chez toi');
    expect(lus).toContain('Ton compte est prêt. Ton club a reçu ta demande : tu verras ses cours dès qu’il t’aura accepté.');
    expect(lus.join(' ')).not.toContain('sorties');
  });
});

describe('B4 — coach', () => {
  beforeEach(() => { mockRole.current = 'coach'; });

  it('phrase de l équipe demandée, l offre gratuite en une ligne, les offres derrière un lien', () => {
    mockUser.current = {
      ...LINA,
      teamMembershipRequests: [{ direction: 'request', state: 'pending', team: { name: 'Seniors 1' } }],
    };
    const { tree } = rendre();
    const lus = textes(tree);
    expect(lus).toEqual(expect.arrayContaining([
      'Ton compte de coach est prêt. Le club a reçu ta demande pour les Seniors 1.',
      'Créer ton premier entraînement',
      'Offre gratuite',
      '1 équipe',
      'Les offres payantes viennent après, seulement si tu en as besoin.',
      'Voir les offres',
      'Aller à mon accueil',
    ]));
    // Décision n° 4 : sans équipe acceptée, pas de ligne d'invitation.
    expect(lus).not.toContain('Inviter tes joueurs par un lien');
    // Coach sans carte ; pas de petite ligne des notifications (joueur et parent seulement).
    expect(lus).not.toContain('LINA MOREL');
    // Décision n° 5 : le bloc d'aujourd'hui, ENTIER, derrière « Voir les offres ».
    expect(lus).not.toContain('Commence sans payer');
    presser(tree, 'Voir les offres');
    expect(textes(tree)).toEqual(expect.arrayContaining([
      'Commence sans payer', 'Débloque tes équipes', 'Pilote tout le club', 'Démarrer le tour guidé',
    ]));
  });

  it('« Aller à mon accueil » lance le tour guidé du coach, comme aujourd hui', () => {
    const { navigation, tree } = rendre();
    presser(tree, 'Aller à mon accueil');
    expect(mockStartTour).toHaveBeenCalledWith('coach');
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'HomeTab' }] });
  });

  it('tour obligatoire : « Créer ton premier entraînement » se lit, ne sort pas', () => {
    const { tree } = rendre();
    expect(() => presser(tree, 'Créer ton premier entraînement')).toThrow('pas de bouton');
  });

  it('avec une équipe acceptée, « Inviter tes joueurs par un lien » envoie le lien', () => {
    mockUser.current = {
      ...LINA,
      club: { name: 'US Exemple' },
      trainedTeams: [{ club: { name: 'US Exemple' }, documentId: 't-1', name: 'Seniors 1' }],
    };
    const { tree } = rendre();
    presser(tree, 'Inviter tes joueurs par un lien');
    expect(mockInviter).toHaveBeenCalledWith({ clubName: 'US Exemple', teamId: 't-1', teamName: 'Seniors 1' });
  });

  it('cadeau Club en cours (« 110- A ») : la phrase du cadeau à la place de « 1 équipe »', () => {
    mockSubscriptionSummary.current = {
      payerSubscriptionsSummary: [{
        currentPeriodEnd: '2099-01-01T00:00:00.000Z', isTrial: true, planCode: 'fc_trial_club', status: 'active',
      }],
    };
    const lus = textes(rendre().tree);
    expect(lus).toContain('Offre Club offerte 7 jours');
    expect(lus).not.toContain('1 équipe');
  });
});

describe('B5 — parent', () => {
  beforeEach(() => { mockRole.current = 'parent'; });

  it('un enfant déclaré : « déclaré·e », son club, un autre enfant', () => {
    mockEnfants.current = [{ documentId: 'e1', firstname: 'Noé' }];
    const { navigation, tree } = rendre();
    const lus = textes(tree);
    expect(lus).toEqual(expect.arrayContaining([
      'Ton compte de parent est prêt. Noé est déclaré·e : tu réponds à ses convocations à sa place.',
      'Trouver le club de football de Noé',
      'Déclarer un autre enfant',
      'Reste informé·e des nouveautés grâce aux notifications.',
      'Trouver son club',
    ]));
    expect(lus).not.toContain('LINA MOREL');
    presser(tree, 'Déclarer un autre enfant');
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 1, routes: [{ name: 'HomeTab' }, { name: 'ProfileStack', params: { screen: 'ChildEdit' } }],
    });
  });

  it('aucun enfant encore : « Déclarer ton enfant »', () => {
    const lus = textes(rendre().tree);
    expect(lus).toContain('Déclarer ton enfant');
    expect(lus).toContain('Trouver un club pour ton enfant');
  });

  it('deux enfants : la phrase au pluriel', () => {
    mockEnfants.current = [{ firstname: 'Noé' }, { firstname: 'Lou' }];
    expect(textes(rendre().tree)).toContain(
      'Ton compte de parent est prêt. Tes 2 enfants sont déclaré·es : tu réponds à leurs convocations à leur place.',
    );
  });
});

describe('Dirigeant et super-admin : l écran d aujourd hui (décision n° 1)', () => {
  it.each(['president', 'superAdmin'])('%s : les offres, sans cas B', (role) => {
    mockRole.current = role;
    const lus = textes(rendre().tree);
    expect(lus).toContain('Commence sans payer');
    expect(lus).not.toContain('Ce que tu peux faire maintenant');
  });
});
