/* eslint-disable max-len -- des phrases entieres */
import * as authUseCases from '@/domains/auth/authUseCases';
import { storage } from '@/store/appContext';

import { RouteNames } from '@/navigation/routeNames';

// TUNNELREPRISE (29/10/2026, decision d'Adel « 1- A », diagnostic DIAG-ROLE-TUNNEL) — un « Passer »
// n'enregistrait rien et « inscription finie » ne s'ecrivait qu'au DERNIER ecran : fermer l'app au
// milieu ramenait, a la reouverture, sur la premiere etape vide, meme passee (joueur ferme sur
// « Niveau » => rouvre sur « Sport 5/13 », 9 etapes dues). 6 personnes en prod ont lache la.
// Regle : une REOUVERTURE (inscription commencee sur cet appareil, mais pas dans ce lancement de
// l'app) d'un compte a qui il ne manque que des etapes qui se passent => l'accueil, et
// l'inscription est marquee finie. Dans le MEME lancement, le tunnel garde ses etapes facultatives.
// ROUGE avant.

jest.mock('../../../store/appContext', () => ({
  storage: { getBoolean: jest.fn(), getString: jest.fn(), set: jest.fn() },
}));

const { getOnboardingViews, markOnboardingStarted, USER_ROLES } = authUseCases;

const IDENTITE = {
  birthdate: '1995-03-15', documentId: 'compte-reprise', firstname: 'Luc', lastname: 'Harne',
};
const JOUEUR_FERME_SUR_NIVEAU = {
  ...IDENTITE,
  address: { label: 'Gardanne' },
  avatar: { url: '/uploads/luc.jpg' },
  role: { name: USER_ROLES.player },
  section: 'Masculine',
};

const etapes = (/** @type {any} */ resultat) => (resultat.views || [])
  .filter((/** @type {any} */ vue) => vue.canShow)
  .map((/** @type {any} */ vue) => vue.route);

/** L'inscription a commence sur cet appareil (cle `onboardingStarted_`), sans drapeau de fin. */
const commenceeSurCetAppareil = () => {
  /** @type {any} */ (storage.getBoolean).mockImplementation(
    (/** @type {string} */ cle) => String(cle).startsWith('onboardingStarted_'),
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  // Chaque test est un NOUVEAU lancement de l'app : aucun tunnel ouvert dans ce lancement.
  /** @type {any} */ (authUseCases).resetOnboardingSessionForTests?.();
  commenceeSurCetAppareil();
});

describe('TUNNELREPRISE — une reouverture ne ramene plus aux etapes qui se passent', () => {
  it('🔴 joueur ferme sur « Niveau » (ville + photo faites, Sport/Poste/Physique passes) : l accueil, inscription finie', () => {
    const resultat = getOnboardingViews(JOUEUR_FERME_SUR_NIVEAU);
    expect(etapes(resultat)).toEqual([]);
    expect(resultat.finieALaReouverture).toBe(true);
  });

  it('🔴 joueur qui a passe « Section » (2/13) : l accueil', () => {
    const resultat = getOnboardingViews({ ...IDENTITE, address: { label: 'Gardanne' }, role: { name: USER_ROLES.player } });
    expect(etapes(resultat)).toEqual([]);
    expect(resultat.finieALaReouverture).toBe(true);
  });

  it('🔴 entraineur sans ville, sans photo, sans equipe : l accueil', () => {
    const resultat = getOnboardingViews({ ...IDENTITE, club: { documentId: 'club-1' }, role: { name: USER_ROLES.coach } });
    expect(etapes(resultat)).toEqual([]);
  });

  it('🔴 dirigeant sans ville ni photo : l accueil', () => {
    const resultat = getOnboardingViews({ ...IDENTITE, role: { name: USER_ROLES.president } });
    expect(etapes(resultat)).toEqual([]);
  });

  it('🔴 parent sans photo ni enfant declare : l accueil', () => {
    const resultat = getOnboardingViews({ ...IDENTITE, role: { name: USER_ROLES.parent } });
    expect(etapes(resultat)).toEqual([]);
  });

  it('🔒 dans le MEME lancement, le tunnel garde ses etapes facultatives', () => {
    markOnboardingStarted(IDENTITE.documentId);
    const resultat = getOnboardingViews(JOUEUR_FERME_SUR_NIVEAU);
    expect(etapes(resultat)[0]).toBe(RouteNames.UserSport);
    expect(resultat.finieALaReouverture).toBeUndefined();
  });

  it('🔒 une etape OBLIGATOIRE manque (date de naissance) : elle seule est redemandee, rien n est marque fini', () => {
    const resultat = getOnboardingViews({ ...JOUEUR_FERME_SUR_NIVEAU, birthdate: null });
    expect(etapes(resultat)).toEqual([RouteNames.UserName]);
    expect(resultat.finieALaReouverture).toBeUndefined();
  });

  it('🔒 moins de 15 ans sans declaration parentale : elle reste due', () => {
    const resultat = getOnboardingViews({ ...JOUEUR_FERME_SUR_NIVEAU, birthdate: '2014-01-01' });
    expect(etapes(resultat)).toEqual([RouteNames.UserParentalDeclaration]);
    expect(resultat.finieALaReouverture).toBeUndefined();
  });

  it('🔒 role pas encore choisi : l ecran du statut reste du', () => {
    const resultat = getOnboardingViews({ documentId: IDENTITE.documentId, role: { name: USER_ROLES.new } });
    expect(etapes(resultat)[0]).toBe(RouteNames.UserRole);
  });

  it('🔒 inscription jamais commencee sur cet appareil (compte cree par un club, 1re ouverture) : le tunnel', () => {
    /** @type {any} */ (storage.getBoolean).mockReturnValue(false);
    const resultat = getOnboardingViews({ ...IDENTITE, club: { documentId: 'club-1' }, role: { name: USER_ROLES.coach } });
    expect(etapes(resultat)[0]).toBe(RouteNames.UserAddress);
  });
});
