import {
  canShowOnboardingSubscriptionOffer,
  getOnboardingViews,
  resolveOnboardingExitRoute,
  USER_ROLES,
} from '@/domains/auth/authUseCases';
import { storage } from '@/store/appContext';

import { RouteNames } from '@/navigation/routeNames';

// D89 — « a la fin de l'onboarding, AVANT l'ecran de bienvenue, on veut ajouter
// le paywall » (demande d'Adel du 2026-08-12).
//
// Le sas de fin de tunnel comptait UNE marche (`Welcome`, D16/D23). Il en compte
// deux : l'offre, puis la bienvenue. Ce fichier mesure la DECISION — a qui on
// montre l'offre, a qui on ne la montre pas — la ou elle vit, c'est-a-dire dans
// `resolveOnboardingExitRoute`, sans monter un seul ecran.
//
// Les quatre cas limites du lot, dans l'ordre du prompt :
//   1. on doit pouvoir passer          -> mesure a l'ecran (SubscriptionOffers.onboarding.test.js)
//   2. a qui on le montre              -> ici
//   3. celui qui est deja abonne       -> ici
//   4. celui qui achete                -> mesure a l'ecran
//
// ⚠️ Ce fichier ne remplace pas `authUseCases.welcome.test.js` : celui-la garde
// le contrat de D23 (le sas EXISTE, il ne se represente pas, il ne porte aucun
// numero d'etape). Les deux doivent rester verts ensemble.

jest.mock('../../store/appContext', () => ({
  storage: {
    getBoolean: jest.fn(),
    getString: jest.fn(),
    set: jest.fn(),
  },
}));

// Profil complet : il ne reste que la ou les dernieres etapes d'affiliation,
// donc le tunnel est sur le point de rendre la main au sas. Copie conforme de
// celui de `authUseCases.welcome.test.js`, pour que les deux fichiers decrivent
// EXACTEMENT la meme situation.
const profilComplet = (role) => ({
  address: 'Marseille',
  avatar: 'avatar.png',
  bestLevel: 'Departemental',
  birthdate: '2000-01-01',
  category: 'Senior',
  documentId: 'user-d89',
  firstname: 'Ada',
  height: 180,
  lastname: 'Test',
  position: 'Pilier',
  preferredSport: 'Rugby',
  role: { name: role },
  section: 'Masculine',
  sportsHistory: [{ club: 'AS Test' }],
  weight: 75,
});

/**
 * La sortie de tunnel pour ce role, dans cet etat d'abonnement.
 * @param {string} role - Le role du compte (USER_ROLES.*).
 * @param {Record<string, any>} [surcharges] - Ce qu'on change a la situation nominale.
 * @returns {string | undefined} La route du sas.
 */
const sortieDeTunnel = (role, surcharges = {}) => {
  const { views } = getOnboardingViews(profilComplet(role));

  return resolveOnboardingExitRoute({
    hasSeenWelcome: false,
    roleKey: {
      [USER_ROLES.coach]: 'coach',
      [USER_ROLES.new]: 'new',
      [USER_ROLES.player]: 'player',
      [USER_ROLES.president]: 'president',
      [USER_ROLES.superAdmin]: 'superAdmin',
    }[role],
    subscriptionAccessLevel: 'FREE',
    userDocumentId: 'user-d89',
    views,
    ...surcharges,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  storage.getBoolean.mockReturnValue(false);
  storage.getString.mockReturnValue(null);
});

describe('D89 ① — a la fin de l\'inscription, l\'offre est proposee AVANT la bienvenue', () => {
  it.each([
    ['entraineur', USER_ROLES.coach],
    ['dirigeant', USER_ROLES.president],
  ])('%s : la sortie de tunnel mene a l\'offre, pas directement a la bienvenue', (_libelle, role) => {
    expect(sortieDeTunnel(role)).toBe(RouteNames.SubscriptionOffers);
  });

  it('l\'offre n\'est PAS un ecran neuf : c\'est celui du bouton « Changer d\'offre »', () => {
    // Le prompt est explicite : « C'est CET ecran, pas un autre. Ne le recree
    // pas. » Le temoin est le nom de route lui-meme.
    expect(sortieDeTunnel(USER_ROLES.coach)).toBe('SubscriptionOffers');
  });
});

describe('D89 ② — a QUI on montre l\'offre', () => {
  // La regle n'est pas inventee ici : elle est deja ecrite DEUX FOIS dans le
  // depot, a l'identique — `SubscriptionOffers.js` (`canShowSubscriptionExperience`,
  // qui rend `null` pour tous les autres) et `Welcome.js`
  // (`canShowSubscriptionWelcome`). Envoyer un JOUEUR sur cet ecran lui
  // afficherait donc une page BLANCHE en fin d'inscription : le cul-de-sac
  // exact que ce lot doit eviter.
  it('un joueur ne voit PAS l\'offre — l\'ecran ne rend rien pour lui', () => {
    expect(sortieDeTunnel(USER_ROLES.player)).toBe(RouteNames.Welcome);
  });

  it.each([
    ['superAdmin', USER_ROLES.superAdmin],
    ['nouveau compte', USER_ROLES.new],
  ])('%s : aucun sas du tout, Welcome est deja une etape comptee de son parcours', (_libelle, role) => {
    expect(sortieDeTunnel(role)).toBeUndefined();
  });

  it.each([
    ['coach', true],
    ['president', true],
    ['player', false],
    ['new', false],
    ['superAdmin', false],
  ])('la regle nue : %s -> %s', (roleKey, attendu) => {
    expect(canShowOnboardingSubscriptionOffer({
      roleKey,
      subscriptionAccessLevel: 'FREE',
    })).toBe(attendu);
  });
});

describe('D89 ③ — celui qui est deja abonne ne se voit pas vendre ce qu\'il a', () => {
  it.each([
    ['une offre Equipe', 'TEAM'],
    ['une offre Club', 'CLUB'],
    ['une offre Club en attente de verification', 'CLUB_UNVERIFIED'],
  ])('%s : l\'etape se saute, on va droit a la bienvenue', (_libelle, niveau) => {
    expect(sortieDeTunnel(USER_ROLES.coach, { subscriptionAccessLevel: niveau }))
      .toBe(RouteNames.Welcome);
  });

  it('le niveau d\'abonnement INCONNU ne montre rien — dans le doute, on ne vend pas', () => {
    // Consigne du lot, mot pour mot : « Si le doute persiste, le chemin le plus
    // sur est de ne PAS montrer. » C'est aussi ce qui garde le contrat de D23
    // intact : `authUseCases.welcome.test.js` appelle cette fonction SANS niveau
    // d'abonnement et attend `Welcome`.
    expect(sortieDeTunnel(USER_ROLES.coach, { subscriptionAccessLevel: undefined }))
      .toBe(RouteNames.Welcome);
    expect(canShowOnboardingSubscriptionOffer({ roleKey: 'coach' })).toBe(false);
  });
});

describe('D89 ④ — les gardes de D23 ne bougent pas d\'un pouce', () => {
  it('une fois la bienvenue vue, plus aucun sas — ni offre, ni bienvenue', () => {
    expect(sortieDeTunnel(USER_ROLES.coach, { hasSeenWelcome: true })).toBeUndefined();
  });

  it('tunnel deja termine (aucune etape) : on ne repousse personne vers l\'offre', () => {
    expect(resolveOnboardingExitRoute({
      hasSeenWelcome: false,
      roleKey: 'coach',
      subscriptionAccessLevel: 'FREE',
      userDocumentId: 'user-d89',
      views: [],
    })).toBeUndefined();
  });

  it('sans utilisateur identifie, pas de sas', () => {
    expect(sortieDeTunnel(USER_ROLES.coach, { userDocumentId: undefined })).toBeUndefined();
  });

  it('les 5 totaux de parcours restent 13 / 5 / 4 / 3 / 13', () => {
    // L'offre est un SAS, pas une etape : elle ne doit apparaitre dans aucun
    // compteur. C'est le meme temoin que D16/D23 pour la bienvenue.
    const totaux = [
      USER_ROLES.player,
      USER_ROLES.coach,
      USER_ROLES.president,
      USER_ROLES.superAdmin,
      USER_ROLES.new,
    ].map((role) => getOnboardingViews({ documentId: 'x', role: { name: role } }).totalViews);

    expect(totaux).toEqual([13, 5, 4, 3, 13]);
  });

  it('l\'offre n\'est une etape comptee d\'AUCUN parcours', () => {
    [
      USER_ROLES.player,
      USER_ROLES.coach,
      USER_ROLES.president,
      USER_ROLES.superAdmin,
      USER_ROLES.new,
    ].forEach((role) => {
      const { views } = getOnboardingViews(profilComplet(role));
      expect(views.map((view) => view.route)).not.toContain(RouteNames.SubscriptionOffers);
    });
  });
});

describe('D89 ⑤ — le temoin de D66 : un dirigeant finit son inscription', () => {
  // D66 a repare un cul-de-sac dans cette meme sequence (un dirigeant restait
  // bloque a l'ecran 1/4). Ce lot ajoute une marche a la FIN du meme tunnel :
  // le temoin verifie qu'elle ne le referme pas.
  it('le dirigeant a TOUJOURS une sortie de tunnel, abonne ou non', () => {
    expect(sortieDeTunnel(USER_ROLES.president)).toBe(RouteNames.SubscriptionOffers);
    expect(sortieDeTunnel(USER_ROLES.president, { subscriptionAccessLevel: 'CLUB' }))
      .toBe(RouteNames.Welcome);
  });

  it('son parcours compte toujours 4 etapes, et la 1re reste « Qui es-tu ? »', () => {
    const { totalViews, views } = getOnboardingViews({
      documentId: 'x',
      role: { name: USER_ROLES.president },
    });

    expect(totalViews).toBe(4);
    expect(views[0].route).toBe(RouteNames.UserName);
  });
});
