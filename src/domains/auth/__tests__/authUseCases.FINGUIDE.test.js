import { RouteNames } from '@/navigation/routeNames';

import { resolveOnboardingOriginAfterTeam, resolveNextOnboardingRoute } from '../authUseCases';

// FIN-GUIDE, point 2 (Adel, 02/11) : inscription, « C'est mon club », « Créer ma première équipe » :
// après la création, le didacticiel ne se lançait pas. Cause racine : `TeamWizardRecap` repartait
// droit sur l'accueil, sans passer par `Welcome`, seul écran qui lance le guide. Le tunnel doit
// reprendre après son étape « équipes », sans jamais recommencer au début : une étape inconnue
// donnerait l'index 0 à `resolveNextOnboardingRoute`.

const COACH = [
  { canShow: true, index: 1, route: RouteNames.UserRole },
  { canShow: true, index: 4, route: RouteNames.UserAffiliationGuide },
  { canShow: false, index: 5, route: RouteNames.UserTrainedTeams },
];
const PRESIDENT = [
  { canShow: true, index: 1, route: RouteNames.UserRole },
  { canShow: true, index: 4, route: RouteNames.UserAffiliationGuide },
];

describe('resolveOnboardingOriginAfterTeam', () => {
  it('entraîneur : on reprend après « Quelles équipes entraînes-tu ? »', () => {
    expect(resolveOnboardingOriginAfterTeam(COACH)).toBe(RouteNames.UserTrainedTeams);
  });

  it('dirigeant, dont le tunnel s’arrête au club : on reprend après le club', () => {
    expect(resolveOnboardingOriginAfterTeam(PRESIDENT)).toBe(RouteNames.UserAffiliationGuide);
  });

  it('inscription finie (parcours vide) : rien à reprendre', () => {
    expect(resolveOnboardingOriginAfterTeam([])).toBeUndefined();
    expect(resolveOnboardingOriginAfterTeam(undefined)).toBeUndefined();
  });

  it('parcours sans ces étapes : rien à reprendre, le tunnel ne recommence jamais', () => {
    const autre = [{ canShow: true, index: 1, route: RouteNames.UserRole }];
    expect(resolveOnboardingOriginAfterTeam(autre)).toBeUndefined();
  });

  it('témoin : l’étape « équipes » déjà faite ne rend pas un écran du tunnel', () => {
    const origine = resolveOnboardingOriginAfterTeam(COACH);
    expect(resolveNextOnboardingRoute({ currentRoute: origine, views: COACH })).toBeUndefined();
  });
});
