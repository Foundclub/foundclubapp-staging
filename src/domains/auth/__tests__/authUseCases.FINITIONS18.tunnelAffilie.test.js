/* eslint-disable max-len -- des phrases entieres */
import { getOnboardingViews, USER_ROLES } from '@/domains/auth/authUseCases';
import { storage } from '@/store/appContext';

import { RouteNames } from '@/navigation/routeNames';

// FINITIONS18 · POINT 4 (tournee T16, REPRODUIT sur l'emulateur le 06/10 a 21:01 UTC avec la
// ligne `[AUTH] ONBOARDING_DECISION`) — Hugo (joueur, 3 equipes) sort de l'app par « retour », la
// rouvre : « Etape 10 sur 13 · Ton parcours sportif ».
//
// La ligne l'a dit : `drapeau=false role=player etapes=UserSportHistory,UserClubSearch`, AUSSI au
// demarrage a froid. Le drapeau `hasCompletedOnboarding_<id>` est PAR APPAREIL : sur ce telephone,
// Hugo ne l'a jamais pose ; sans lui, le tunnel reprend a sa premiere etape non remplie, meme
// FACULTATIVE (le parcours sportif est vide, et « trouve ton club » n'est jamais « remplie »). A
// froid l'accueil ne s'affichait que par accident (la pile naissait sur « Adresse », que la
// session du telephone croit vide, puis cette etape disparaissait a la reponse du serveur et la
// pile retombait sur l'accueil) ; au remontage, la reponse du serveur est en cache et la pile nait
// sur l'etape 10.
// Regle : un compte DEJA dans une equipe ou un club, a qui il ne manque que des etapes
// facultatives, a fini son inscription — drapeau ou pas. Il ne garde que le point de controle de
// l'age (AGE-OBLIGATOIRE-3). ROUGE avant.

jest.mock('../../../store/appContext', () => ({
  storage: { getBoolean: jest.fn(), getString: jest.fn(), set: jest.fn() },
}));

const HUGO = {
  address: { city: 'Montrivage' },
  avatar: { url: '/uploads/hugo.jpg' },
  bestLevel: 'Regional',
  birthdate: '2012-03-01',
  category: 'U15',
  clubs: [{ documentId: 'club-montrivage' }],
  documentId: 'xf8nhqxdtl2sipkiq0wmzpxh',
  firstname: 'Hugo',
  height: 160,
  lastname: 'Lemaire',
  myTeams: [{ documentId: 'u15' }, { documentId: 'senior' }, { documentId: 'basket' }],
  parentalDeclarationAccepted: true,
  position: 'Gardien',
  preferredSport: 'Football',
  role: { name: 'Player', type: 'player' },
  section: { documentId: 'section-foot' },
  sportsHistory: null,
  trainedTeams: [],
};

const etapes = (/** @type {any} */ resultat) => (resultat.views || [])
  .filter((/** @type {any} */ vue) => vue.canShow)
  .map((/** @type {any} */ vue) => vue.route);

beforeEach(() => {
  /** @type {any} */ (storage.getBoolean).mockReturnValue(false);
});

describe('FINITIONS18 4 — un compte deja affilie n a plus de tunnel pour des etapes facultatives', () => {
  it('🔴 Hugo (3 equipes, parcours sportif vide, pas de drapeau sur ce telephone) : aucune etape', () => {
    expect(etapes(getOnboardingViews(HUGO))).toEqual([]);
  });

  it('🔴 le meme sans date de naissance : le point de controle de l age, rien d autre', () => {
    const resultat = getOnboardingViews({ ...HUGO, birthdate: null });
    expect(resultat.isEntryCheckpoint).toBe(true);
    expect(etapes(resultat)).toEqual([RouteNames.UserName]);
  });

  it('🔒 un compte affilie sans une etape OBLIGATOIRE (la photo) garde le tunnel', () => {
    const resultat = getOnboardingViews({ ...HUGO, avatar: null });
    expect(etapes(resultat)[0]).toBe(RouteNames.UserAvatar);
  });

  it('🔒 une inscription NEUVE (aucune equipe, aucun club) garde tout son tunnel facultatif', () => {
    const neuf = { ...HUGO, clubs: [], myTeams: [] };
    expect(etapes(getOnboardingViews(neuf))).toEqual(expect.arrayContaining([
      RouteNames.UserSportHistory, RouteNames.UserClubSearch,
    ]));
  });

  it('🔒 l entraineur deja affilie a qui il ne manque que le guide : aucune etape', () => {
    const coach = {
      ...HUGO,
      clubs: [],
      myTeams: [],
      role: { name: USER_ROLES.coach },
      trainedTeams: [{ documentId: 'u15' }],
    };
    expect(etapes(getOnboardingViews(coach))).toEqual([]);
  });
});
