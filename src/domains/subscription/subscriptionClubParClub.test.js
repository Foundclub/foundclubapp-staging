import {
  canReceiveOnboardingClubGift,
  resolveOnboardingExitRoute,
} from '@/domains/auth/authUseCases';
import {
  getBlockingClubCoveragePlanCode,
  getPayerSubscriptionsWithClubs,
  getStoreSubscriptionConflict,
  resolveStorePlanChangeTarget,
  resolveSubscriptionChangeTarget,
} from '@/domains/subscription/subscriptionBilling';
import {
  endSentenceAfterName,
  getAccountSubscriptionAccessLevel,
  getCoveringEntitlement,
  getSubscriptionAccessLevel,
  getSubscriptionBadgeLevel,
  getSubscriptionEntryPointLock,
  getSubscriptionQuotaItems,
  isClubOfferCurrentForClub,
} from '@/domains/subscription/subscriptionDecision';

import { RouteNames } from '@/navigation/routeNames';

// ABOPARCLUB (2026-09-29) — LE NIVEAU D'ACCES SUIT LE CLUB AFFICHE.
//
// Decisions d'Adel du 29/09 : « niveau oui » (le niveau d'acces suit le club
// affiche, sur tous les ecrans) et « abo2 A » (depuis un club non couvert,
// l'achat cree un NOUVEL abonnement ; une offre n'est jamais « actuelle » pour
// un club qu'elle ne couvre pas).
//
// Le decor est celui de la recette du 28/09 : un dirigeant paie « Club 100 »
// pour FoundClub Demo et regarde l'app depuis son autre club, AIKI. Le serveur
// refusait a juste titre la compo d'AIKI (403) pendant que l'app, elle, lisait
// le niveau du COMPTE et traitait AIKI comme « Club ».
//
// Ce fichier fige, sur les fonctions PARTAGEES (aucun ecran monte) :
//   · le niveau lui-meme (club couvert / non couvert / inconnu) ;
//   · ce que ses lecteurs en tirent : compteurs gratuits, verrou d'entree,
//     heros « quelqu'un paie pour toi », cadeau de bienvenue, sas du tunnel ;
//   · le rail d'achat : quelle offre est « actuelle », quel abonnement un
//     changement a le droit de viser, et ce que les magasins interdisent.
// Ecrit ROUGE, puis vert.

jest.mock('../../store/appContext', () => ({
  storage: {
    getBoolean: jest.fn(),
    getString: jest.fn(),
    set: jest.fn(),
  },
}));

const MOI = 'u-dirigeant-demo-aiki';
const AUTRE_PAYEUR = 'u-sofiane';
const DEMO = 'club-foundclub-demo';
const AIKI = 'club-aiki';

const droitClub = (clubDocumentId, planCode, payeur = MOI) => ({
  capability: '*',
  paidBy: { documentId: payeur, firstname: payeur === MOI ? 'Adel' : 'Sofiane', lastname: 'F' },
  scopeClubDocumentId: clubDocumentId,
  scopeClubName: clubDocumentId === DEMO ? 'FoundClub Démo' : 'AIKI',
  scopeTeamDocumentId: null,
  scopeType: 'CLUB',
  status: 'active',
  subscriptionPlanCode: planCode,
});

const droitEquipe = (clubDocumentId, teamDocumentId, payeur) => ({
  capability: '*',
  paidBy: { documentId: payeur, firstname: 'Zoe', lastname: 'K' },
  scopeClubDocumentId: clubDocumentId,
  scopeTeamDocumentId: teamDocumentId,
  scopeTeamName: 'U13',
  scopeType: 'TEAM',
  status: 'active',
  subscriptionPlanCode: 'fc_team_1_yearly',
});

const abonnementPaye = (documentId, planCode, provider, scopeClubDocumentIds) => ({
  autoRenew: true,
  billingPeriod: 'yearly',
  currentPeriodEnd: '2027-09-10T00:00:00.000Z',
  documentId,
  isTrial: planCode.startsWith('fc_trial_'),
  planCode,
  provider,
  status: 'active',
  ...(scopeClubDocumentIds ? { scopeClubDocumentIds } : {}),
});

/**
 * Ce que `GET /app/bootstrap` rend a ce dirigeant, club actif = `clubActif`.
 * Les resumes sont ceux que le serveur calcule (subscription-permission.ts) :
 * `requiresClubVerification` est leve des qu'UN droit Club est actif sur le
 * COMPTE, meme s'il couvre un autre club.
 * @param {string} clubActif - Le club affiche.
 * @param {Record<string, any>} [surcharges] - Ce qui change.
 * @returns {any} Les entrees de `getSubscriptionAccessLevel`.
 */
const bootstrap = (clubActif, surcharges = {}) => ({
  clubVerificationSummary: {
    clubDocumentId: clubActif,
    clubVerified: false,
    hasActiveClubEntitlement: clubActif === DEMO,
    requiresClubVerification: clubActif === DEMO,
  },
  entitlementsSummary: [droitClub(DEMO, 'fc_club_tier_1_yearly')],
  subscriptionSummary: {
    activePlanCodes: ['fc_club_tier_1_yearly'],
    hasClubPlan: true,
    hasTeamPlan: false,
    hasVerifiedClubPlan: false,
    payerSubscriptionIds: ['sub-demo'],
    payerSubscriptionsSummary: [abonnementPaye('sub-demo', 'fc_club_tier_1_yearly', 'apple', [DEMO])],
    requiresClubVerification: true,
  },
  userClub: { documentId: clubActif, name: clubActif === DEMO ? 'FoundClub Démo' : 'AIKI' },
  ...surcharges,
});

const COMPTEURS_EPUISES = [
  {
    limit: 1, quotaType: 'EVENT_PUBLISH', remaining: 0, teamDocumentId: null, used: 1,
  },
  {
    limit: 1, quotaType: 'FREE_TEAM', remaining: 1, teamDocumentId: null, used: 0,
  },
];

describe('ABOPARCLUB — le niveau d acces est celui du club AFFICHE', () => {
  it('payeur Club pour Demo, club affiche AIKI non couvert : le niveau est GRATUIT, plus « Club »', () => {
    expect(getSubscriptionAccessLevel(bootstrap(AIKI))).toBe('FREE');
  });

  it('... sauf si une offre Equipe couvre une equipe d AIKI : niveau EQUIPE', () => {
    const entrees = bootstrap(AIKI);
    entrees.entitlementsSummary = [
      ...entrees.entitlementsSummary,
      droitEquipe(AIKI, 'team-aiki-u13', 'u-zoe'),
    ];
    expect(getSubscriptionAccessLevel(entrees)).toBe('TEAM');
  });

  it('une offre Equipe qui ne couvre QUE des equipes de Demo ne vaut rien dans AIKI', () => {
    const entrees = bootstrap(AIKI);
    entrees.entitlementsSummary = [
      ...entrees.entitlementsSummary,
      droitEquipe(DEMO, 'team-demo-seniors', MOI),
    ];
    entrees.subscriptionSummary = { ...entrees.subscriptionSummary, hasTeamPlan: true };
    expect(getSubscriptionAccessLevel(entrees)).toBe('FREE');
  });

  it('TEMOIN « club couvert : inchange » — club affiche Demo : Club (non certifie), puis Club certifie', () => {
    expect(getSubscriptionAccessLevel(bootstrap(DEMO))).toBe('CLUB_UNVERIFIED');

    const certifie = bootstrap(DEMO);
    certifie.clubVerificationSummary = { ...certifie.clubVerificationSummary, clubVerified: true };
    certifie.subscriptionSummary = { ...certifie.subscriptionSummary, hasVerifiedClubPlan: true };
    expect(getSubscriptionAccessLevel(certifie)).toBe('CLUB');
  });

  it('SANS PREUVE, PAS D ACCUSATION — resumes muets sur le club : le niveau du compte, comme avant', () => {
    expect(getSubscriptionAccessLevel({
      entitlementsSummary: [],
      subscriptionSummary: { hasClubPlan: true, requiresClubVerification: true },
      userClub: { documentId: AIKI },
    })).toBe('CLUB_UNVERIFIED');
  });

  it('CE QUE LE COMPTE PAIE reste lisible a part (piege a : « Mon abonnement » ne perd pas le Club 100)', () => {
    expect(getAccountSubscriptionAccessLevel(bootstrap(AIKI))).toBe('CLUB_UNVERIFIED');
  });

  it('le niveau d un AUTRE club que l affiche se demande nommement (un evenement de Demo ouvert depuis AIKI)', () => {
    expect(getSubscriptionAccessLevel({ ...bootstrap(AIKI), clubDocumentId: DEMO })).toBe('CLUB_UNVERIFIED');
    expect(getSubscriptionAccessLevel({ ...bootstrap(DEMO), clubDocumentId: AIKI })).toBe('FREE');
  });
});

describe('ABOPARCLUB — ce que les lecteurs en tirent, depuis AIKI', () => {
  it('les compteurs gratuits reapparaissent (bandeaux de quota, Profil, ecran des offres)', () => {
    const niveau = getSubscriptionAccessLevel(bootstrap(AIKI));
    expect(getSubscriptionQuotaItems(COMPTEURS_EPUISES, niveau).map((item) => item.quotaType))
      .toEqual(['EVENT_PUBLISH', 'FREE_TEAM']);
  });

  it('le point d entree « Ajouter un evenement » se grise d avance (accueil)', () => {
    const verrou = getSubscriptionEntryPointLock({
      freeUsageSummary: COMPTEURS_EPUISES,
      quotaType: 'EVENT_PUBLISH',
      roleKey: 'president',
      subscriptionAccessLevel: getSubscriptionAccessLevel(bootstrap(AIKI)),
    });
    expect(verrou?.decision?.paywall).toBe('EVENT_LIMIT');
  });

  it('TEMOIN « club couvert : inchange » — depuis Demo, aucun compteur ni verrou', () => {
    const niveau = getSubscriptionAccessLevel(bootstrap(DEMO));
    expect(getSubscriptionQuotaItems(COMPTEURS_EPUISES, niveau)).toEqual([]);
    expect(getSubscriptionEntryPointLock({
      freeUsageSummary: COMPTEURS_EPUISES,
      quotaType: 'EVENT_PUBLISH',
      roleKey: 'president',
      subscriptionAccessLevel: niveau,
    })).toBeNull();
  });
});

describe('ABOPARCLUB — piege b : le heros « quelqu un paie pour toi »', () => {
  // Un membre qui ne paie rien ; Sofiane paie le Club 100 de Demo.
  const membreNonPayeur = (clubActif, droitsEnPlus = []) => {
    const entrees = bootstrap(clubActif, {
      entitlementsSummary: [droitClub(DEMO, 'fc_club_tier_1_yearly', AUTRE_PAYEUR), ...droitsEnPlus],
    });
    entrees.subscriptionSummary = {
      ...entrees.subscriptionSummary,
      payerSubscriptionIds: [],
      payerSubscriptionsSummary: [],
    };
    return entrees;
  };

  it('TEMOIN « inchange » — dans Demo, le heros nomme Sofiane', () => {
    const entrees = membreNonPayeur(DEMO);
    const couverture = getCoveringEntitlement({
      clubDocumentId: DEMO,
      entitlementsSummary: entrees.entitlementsSummary,
      subscriptionAccessLevel: getSubscriptionAccessLevel(entrees),
      subscriptionSummary: entrees.subscriptionSummary,
      userDocumentId: MOI,
    });
    expect(couverture?.paidBy?.documentId).toBe(AUTRE_PAYEUR);
  });

  it('dans AIKI, que Sofiane ne couvre pas : AUCUN heros « tu n as rien a payer »', () => {
    const entrees = membreNonPayeur(AIKI);
    expect(getCoveringEntitlement({
      clubDocumentId: AIKI,
      entitlementsSummary: entrees.entitlementsSummary,
      subscriptionAccessLevel: getSubscriptionAccessLevel(entrees),
      subscriptionSummary: entrees.subscriptionSummary,
      userDocumentId: MOI,
    })).toBeNull();
  });

  it('dans AIKI couvert en Equipe par Zoe : le heros nomme Zoe, pas le Club de Demo', () => {
    const entrees = membreNonPayeur(AIKI, [droitEquipe(AIKI, 'team-aiki-u13', 'u-zoe')]);
    const couverture = getCoveringEntitlement({
      clubDocumentId: AIKI,
      entitlementsSummary: entrees.entitlementsSummary,
      subscriptionAccessLevel: getSubscriptionAccessLevel(entrees),
      subscriptionSummary: entrees.subscriptionSummary,
      userDocumentId: MOI,
    });
    expect(couverture?.paidBy?.documentId).toBe('u-zoe');
    expect(couverture?.scopeType).toBe('TEAM');
  });
});

describe('ABOPARCLUB — cadeau de bienvenue et sas du tunnel (avant / apres)', () => {
  it('CADEAU — un dirigeant d AIKI qui paie pour Demo VOIT desormais la page cadeau pour AIKI', () => {
    // Avant : niveau du compte « Club » => page sautee. Apres : AIKI est gratuit,
    // la page s'affiche et c'est `claimOnboardingGift` (serveur) qui accepte ou refuse.
    expect(canReceiveOnboardingClubGift({
      clubDocumentId: AIKI,
      roleKey: 'president',
      subscriptionAccessLevel: getSubscriptionAccessLevel(bootstrap(AIKI)),
    })).toBe(true);
  });

  it('CADEAU, temoin « inchange » — depuis Demo couvert, la page reste sautee', () => {
    expect(canReceiveOnboardingClubGift({
      clubDocumentId: DEMO,
      roleKey: 'president',
      subscriptionAccessLevel: getSubscriptionAccessLevel(bootstrap(DEMO)),
    })).toBe(false);
  });

  it('TUNNEL — en fin d inscription dans AIKI, le sas commence par l ECRAN D OFFRE', () => {
    const sortie = (clubActif) => resolveOnboardingExitRoute({
      hasSeenWelcome: false,
      roleKey: 'president',
      subscriptionAccessLevel: getSubscriptionAccessLevel(bootstrap(clubActif)),
      userDocumentId: MOI,
      views: [{ canShow: true, index: 0, route: 'ProfileClub' }],
    });
    expect(sortie(AIKI)).toBe(RouteNames.SubscriptionOffers);
    // Temoin « inchange » : depuis Demo couvert, droit a la bienvenue.
    expect(sortie(DEMO)).toBe(RouteNames.Welcome);
  });
});

describe('ABOPARCLUB — l ecran des offres ne vend plus rien a travers les clubs', () => {
  it('le Club 100 de Demo n est PAS « Ton offre actuelle » dans AIKI ; il l est dans Demo', () => {
    const actuelle = (clubActif) => isClubOfferCurrentForClub({
      activePlanCodes: ['fc_club_tier_1_yearly'],
      clubDocumentId: clubActif,
      clubVerificationSummary: bootstrap(clubActif).clubVerificationSummary,
      entitlementsSummary: bootstrap(clubActif).entitlementsSummary,
      planCode: 'fc_club_tier_1_yearly',
    });
    expect(actuelle(AIKI)).toBe(false);
    expect(actuelle(DEMO)).toBe(true);
  });

  it('une couverture payee par un AUTRE pour Demo ne grise rien dans AIKI (et grise toujours dans Demo)', () => {
    const droits = [droitClub(DEMO, 'fc_club_tier_2_yearly', AUTRE_PAYEUR)];
    expect(getBlockingClubCoveragePlanCode({
      clubDocumentId: AIKI, entitlementsSummary: droits, userDocumentId: MOI,
    })).toBe('');
    expect(getBlockingClubCoveragePlanCode({
      clubDocumentId: DEMO, entitlementsSummary: droits, userDocumentId: MOI,
    })).toBe('fc_club_tier_2_yearly');
  });

  it('un changement d offre ne vise QUE l abonnement qui couvre le club affiche', () => {
    const cible = (clubActif, scopeType) => resolveSubscriptionChangeTarget({
      catalogEntry: { planCode: scopeType === 'CLUB' ? 'fc_club_tier_2_yearly' : 'fc_team_1_yearly', scopeType },
      clubDocumentId: clubActif,
      clubVerificationSummary: bootstrap(clubActif).clubVerificationSummary,
      entitlementsSummary: bootstrap(clubActif).entitlementsSummary,
      subscriptionSummary: bootstrap(clubActif).subscriptionSummary,
      userDocumentId: MOI,
    });
    // Depuis AIKI : ni l offre Club, ni l offre Equipe ne touchent l abonnement de Demo.
    expect(cible(AIKI, 'CLUB')).toBeNull();
    expect(cible(AIKI, 'TEAM')).toBeNull();
    // Temoin « inchange » : depuis Demo, c est un changement de SON abonnement.
    expect(cible(DEMO, 'CLUB')).toEqual({
      currentPlanCode: 'fc_club_tier_1_yearly',
      provider: 'apple',
      subscriptionDocumentId: 'sub-demo',
    });
  });

  it('sans le champ neuf du serveur, les clubs d un abonnement se deduisent de ses droits (et un doublon de code = inconnu)', () => {
    const resume = {
      payerSubscriptionsSummary: [
        abonnementPaye('sub-demo', 'fc_club_tier_1_yearly', 'apple'),
        abonnementPaye('sub-equipe', 'fc_team_1_yearly', 'google'),
      ],
    };
    const droits = [droitClub(DEMO, 'fc_club_tier_1_yearly'), droitEquipe(AIKI, 'team-aiki-u13', MOI)];
    expect(getPayerSubscriptionsWithClubs({
      entitlementsSummary: droits, subscriptionSummary: resume, userDocumentId: MOI,
    }).map((abonnement) => [abonnement.documentId, abonnement.clubDocumentIds])).toEqual([
      ['sub-demo', [DEMO]],
      ['sub-equipe', [AIKI]],
    ]);

    const doublon = {
      payerSubscriptionsSummary: [
        abonnementPaye('sub-demo', 'fc_club_tier_1_yearly', 'apple'),
        abonnementPaye('sub-aiki', 'fc_club_tier_1_yearly', 'web'),
      ],
    };
    expect(getPayerSubscriptionsWithClubs({
      entitlementsSummary: [droitClub(DEMO, 'fc_club_tier_1_yearly'), droitClub(AIKI, 'fc_club_tier_1_yearly')],
      subscriptionSummary: doublon,
      userDocumentId: MOI,
    }).map((abonnement) => abonnement.clubDocumentIds)).toEqual([null, null]);
  });
});

describe('ABOPARCLUB — recette du 29/09 (tournee 4, defaut 4)', () => {
  it('BADGE — l offre couvre un autre club : il dit l etat du club AFFICHE, plus « Club »', () => {
    const nonCouvert = { activeClubName: 'AIKI', coveredClubNames: ['FoundClub Démo'] };
    expect(getSubscriptionBadgeLevel({
      activeClubLevel: 'FREE', paidLevel: 'CLUB_UNVERIFIED', uncoveredActiveClub: nonCouvert,
    })).toBe('FREE');
    expect(getSubscriptionBadgeLevel({
      activeClubLevel: 'TEAM', paidLevel: 'CLUB_UNVERIFIED', uncoveredActiveClub: nonCouvert,
    })).toBe('TEAM');
    // Un niveau « Club » ne peut pas etre celui d'un club non couvert.
    expect(getSubscriptionBadgeLevel({
      activeClubLevel: 'CLUB_UNVERIFIED', paidLevel: 'CLUB_UNVERIFIED', uncoveredActiveClub: nonCouvert,
    })).toBe('FREE');
    // Temoin « inchange » : club couvert, le badge dit ce que le compte paie.
    expect(getSubscriptionBadgeLevel({
      activeClubLevel: 'CLUB_UNVERIFIED', paidLevel: 'CLUB_UNVERIFIED', uncoveredActiveClub: null,
    })).toBe('CLUB_UNVERIFIED');
  });

  it('POINT FINAL — un nom qui finit par un point n en recoit pas un second', () => {
    expect(endSentenceAfterName("pas ton club 'AIKI-ADVENTURE'.."))
      .toBe("pas ton club 'AIKI-ADVENTURE'.");
    expect(endSentenceAfterName('pas ton club AIKI.')).toBe('pas ton club AIKI.');
    expect(endSentenceAfterName('pas ton club Allez!.')).toBe('pas ton club Allez!');
  });
});

describe('ABOPARCLUB-RAIL — un abonnement pose a la main ne se « change » jamais au magasin', () => {
  it('le cadeau qui couvre AIKI n est pas une cible : acheter Club depuis AIKI est un ACHAT', () => {
    const resume = {
      payerSubscriptionIds: ['sub-cadeau'],
      payerSubscriptionsSummary: [abonnementPaye('sub-cadeau', 'fc_trial_club', 'manual', [AIKI])],
    };
    expect(resolveSubscriptionChangeTarget({
      catalogEntry: { planCode: 'fc_club_tier_1_yearly', scopeType: 'CLUB' },
      clubDocumentId: AIKI,
      entitlementsSummary: [droitClub(AIKI, 'fc_trial_club')],
      subscriptionSummary: resume,
      userDocumentId: MOI,
    })).toBeNull();
  });
});

describe('ABOPARCLUB-RAIL — le mur payant change l abonnement DU MEME MAGASIN au lieu de racheter', () => {
  const abonneEquipeApple = {
    payerSubscriptionIds: ['sub-equipe'],
    payerSubscriptionsSummary: [abonnementPaye('sub-equipe', 'fc_team_1_yearly', 'apple', [DEMO])],
  };
  const cible = (storeProvider) => resolveStorePlanChangeTarget({
    catalogEntry: { planCode: 'fc_club_tier_1_yearly', scopeType: 'CLUB' },
    clubDocumentId: DEMO,
    entitlementsSummary: [],
    storeProvider,
    subscriptionSummary: abonneEquipeApple,
    userDocumentId: MOI,
  });

  it('iPhone : Equipe (Apple) -> Club pour le MEME club = changement de CET abonnement', () => {
    expect(cible('apple')).toEqual({
      currentPlanCode: 'fc_team_1_yearly',
      provider: 'apple',
      subscriptionDocumentId: 'sub-equipe',
    });
  });

  it('un autre magasin, la caisse web ou le rail de test : un achat, comme avant', () => {
    expect(cible('google')).toBeNull();
    expect(cible(null)).toBeNull();
  });
});

describe('ABOPARCLUB — ce que les magasins interdisent pour un 2e club', () => {
  const abonnements = (provider, planCode = 'fc_club_tier_1_yearly') => getPayerSubscriptionsWithClubs({
    entitlementsSummary: [],
    subscriptionSummary: { payerSubscriptionsSummary: [abonnementPaye('sub-demo', planCode, provider, [DEMO])] },
    userDocumentId: MOI,
  });
  const conflit = ({ planCode, provider, storeProvider }) => getStoreSubscriptionConflict({
    catalogEntry: { planCode, scopeType: 'CLUB' },
    clubDocumentId: AIKI,
    payerSubscriptions: abonnements(provider),
    storeProvider,
  });

  it('APPLE — un seul abonnement par groupe : acheter pour AIKI basculerait celui de Demo => bloque', () => {
    expect(conflit({ planCode: 'fc_club_tier_2_yearly', provider: 'apple', storeProvider: 'apple' }))
      .toEqual({ coveredClubDocumentIds: [DEMO], reason: 'apple-single-group' });
  });

  it('GOOGLE — un 2e abonnement d un AUTRE produit est possible ; le MEME produit, non', () => {
    expect(conflit({ planCode: 'fc_club_tier_2_yearly', provider: 'google', storeProvider: 'google' })).toBeNull();
    expect(conflit({ planCode: 'fc_club_tier_1_monthly', provider: 'google', storeProvider: 'google' }))
      .toEqual({ coveredClubDocumentIds: [DEMO], reason: 'google-same-product' });
  });

  it('CAISSE WEB, RAIL DE TEST, ou abonnement Demo pose a la main : rien ne bloque', () => {
    expect(conflit({ planCode: 'fc_club_tier_1_yearly', provider: 'apple', storeProvider: null })).toBeNull();
    expect(conflit({ planCode: 'fc_club_tier_1_yearly', provider: 'manual', storeProvider: 'apple' })).toBeNull();
  });

  it('TEMOIN « inchange » — depuis Demo, changer SON abonnement Apple n est pas un conflit', () => {
    expect(getStoreSubscriptionConflict({
      catalogEntry: { planCode: 'fc_club_tier_2_yearly', scopeType: 'CLUB' },
      changeSourceSubscriptionDocumentId: 'sub-demo',
      clubDocumentId: DEMO,
      payerSubscriptions: abonnements('apple'),
      storeProvider: 'apple',
    })).toBeNull();
  });
});
