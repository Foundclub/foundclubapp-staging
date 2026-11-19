import { getOnboardingViews, USER_ROLES } from '@/domains/auth/authUseCases';

import { RouteNames } from '@/navigation/routeNames';

// INSCRIPTION-CODE (19/11/2026, V1 3.5 corrigée par la V2, v2_01 « ok ») — L'ORDRE DE L'INSCRIPTION,
// rôle par rôle, pour un compte NEUF (rien de rempli). Témoin caractérisant (E6) : il a d'abord
// décrit l'ordre d'avant (Rôle › Qui es-tu ? › … › Sport), puis l'ordre voté :
// Activité › Qui es-tu ? › Rôle, pour TOUS les parcours (« tout le monde commence par elle »).

jest.mock('../../../store/appContext', () => ({
  storage: { getBoolean: jest.fn(() => false), getString: jest.fn(), set: jest.fn() },
}));

const R = RouteNames;
const parcours = (roleName, extra = {}) => getOnboardingViews({
  documentId: 'u1', role: { name: roleName }, ...extra,
}).views.filter((v) => v.canShow).map((v) => v.route);

const PREFIXE = [R.UserSport, R.UserName, R.UserRole];

describe('INSCRIPTION-CODE — Activité › Qui es-tu ? › Rôle en tête de tous les parcours', () => {
  it('compte neuf (rôle provisoire) : le sport, puis « Qui es-tu ? », puis le rôle', () => {
    expect(parcours(USER_ROLES.new).slice(0, 3)).toEqual(PREFIXE);
  });

  it.each([
    ['player', [R.UserSport, R.UserSection, R.UserAddress, R.UserAvatar, R.UserPosition,
      R.UserPhysique, R.UserLevel, R.UserCategory, R.UserSportHistory, R.UserClubSearch,
      R.UserAffiliationGuide, R.UserTeamAffiliation]],
    ['coach', [R.UserSport, R.UserAddress, R.UserAvatar, R.UserAffiliationGuide,
      R.UserTrainedTeams]],
    ['president', [R.UserSport, R.UserAddress, R.UserAvatar, R.UserAffiliationGuide]],
    ['parent', [R.UserSport, R.UserAvatar, R.UserChild]],
  ])('rôle %s posé, identité connue : le sport d\'abord, puis la suite d\'aujourd\'hui', (role, attendu) => {
    expect(parcours(USER_ROLES[role], {
      birthdate: '1990-01-01', firstname: 'Lina', lastname: 'Morel',
    })).toEqual(attendu);
  });

  it('les numéros suivent l\'ordre, sans trou (le compteur « Étape n sur N »)', () => {
    const { totalViews, views } = getOnboardingViews({ documentId: 'u1', role: { name: USER_ROLES.player } });
    expect(views.map((v) => v.index)).toEqual(views.map((_, i) => i + 1));
    expect(totalViews).toBe(views.length);
  });

  it('un mineur de 14 ans : la déclaration parentale suit « Qui es-tu ? », avant le rôle', () => {
    const quatorze = new Date();
    quatorze.setFullYear(quatorze.getFullYear() - 14);
    const routes = parcours(USER_ROLES.new, {
      birthdate: quatorze.toISOString().slice(0, 10), preferredSport: 'Football',
    });
    expect(routes.slice(0, 3)).toEqual([R.UserName, R.UserParentalDeclaration, R.UserRole]);
  });

  it('le sport déjà donné ne se redemande pas', () => {
    expect(parcours(USER_ROLES.new, { preferredSport: 'Judo' })[0]).toBe(R.UserName);
  });
});
