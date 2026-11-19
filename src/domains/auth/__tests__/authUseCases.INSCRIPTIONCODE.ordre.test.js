import { getOnboardingViews, USER_ROLES } from '@/domains/auth/authUseCases';

import { RouteNames } from '@/navigation/routeNames';

// INSCRIPTION-CODE (19/11/2026, V1 3.5 corrigée par la V2, v2_01 « ok ») — L'ORDRE DE
// L'INSCRIPTION,
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
    // INSCRIPTION-CODE-2 (19/11) — Avant : coach, dirigeant et parent commençaient AUSSI par
    // R.UserSport. Mais l'activité vient avant le rôle : un compte qui a déjà l'un de ces rôles
    // l'a passée, ou c'est un ANCIEN compte (ces parcours ne la demandaient pas) ; la lui montrer
    // cassait le point de contrôle de l'âge (AGE-OBLIGATOIRE-3) et la reprise (TUNNELREPRISE,
    // FINCHEMINS, RATTRAPAGE) : 8 témoins rouges. Le joueur la garde (elle était à lui).
    ['coach', [R.UserAddress, R.UserAvatar, R.UserAffiliationGuide, R.UserTrainedTeams]],
    ['president', [R.UserAddress, R.UserAvatar, R.UserAffiliationGuide]],
    ['parent', [R.UserAvatar, R.UserChild]],
  ])('rôle %s posé, identité connue : la suite d’aujourd’hui', (role, attendu) => {
    expect(parcours(USER_ROLES[role], {
      birthdate: '1990-01-01', firstname: 'Lina', lastname: 'Morel',
    })).toEqual(attendu);
  });

  it('les numéros suivent l\'ordre, sans trou (le compteur « Étape n sur N »)', () => {
    const { totalViews, views } = getOnboardingViews({
      documentId: 'u1', role: { name: USER_ROLES.player },
    });
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

// INSCRIPTION-CODE (c) — un parcours par famille (V2 2.1, v2_03, v2_04, v2_06).
describe('INSCRIPTION-CODE (c) — le parcours du joueur suit la famille de son activité', () => {
  const joueur = (activite) => parcours(USER_ROLES.player, {
    birthdate: '1990-01-01', firstname: 'Lina', lastname: 'Morel', preferredSport: activite,
  });

  it('football : section, postes, physique, niveau, catégorie, parcours, recrutement', () => {
    expect(joueur('Football')).toEqual([R.UserSection, R.UserAddress, R.UserAvatar, R.UserPosition,
      R.UserPhysique, R.UserLevel, R.UserCategory, R.UserSportHistory, R.UserClubSearch,
      R.UserAffiliationGuide, R.UserTeamAffiliation]);
  });

  it('judo (combat) : la même chose, sans les postes', () => {
    expect(joueur('Judo')).toEqual([R.UserSection, R.UserAddress, R.UserAvatar, R.UserPhysique,
      R.UserLevel, R.UserCategory, R.UserSportHistory, R.UserClubSearch, R.UserAffiliationGuide,
      R.UserTeamAffiliation]);
  });

  it.each(['Spéléologie', 'Randonnée', 'Danse', 'Musique'])('%s : niveau seulement', (activite) => {
    expect(joueur(activite)).toEqual([R.UserAddress, R.UserAvatar, R.UserLevel,
      R.UserAffiliationGuide, R.UserTeamAffiliation]);
  });

  it('sans activité (« je ne trouve pas ») : le parcours d’avant', () => {
    expect(joueur(undefined)).toContain(R.UserSection);
  });
});
