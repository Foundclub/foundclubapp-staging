// C10BIS · P12-05 — « Configurer la FFBB » se lit sur l'EQUIPE affichee, pas seulement dans
// les equipes du compte : un president hors de l'equipe n'a pas cette equipe dans `myTeams`
// ni `trainedTeams`, alors que le serveur l'autorise a configurer la synchronisation.
import { isExternalCompetitionEligibleTeam } from '@/domains/team/externalCompetitionEligibility';

describe('isExternalCompetitionEligibleTeam (C10BIS · P12-05)', () => {
  it('une equipe de basket ou de football est eligible, accents et casse gommes', () => {
    expect(isExternalCompetitionEligibleTeam({ activities: [{ name: 'Basket-ball' }] })).toBe(true);
    expect(isExternalCompetitionEligibleTeam({ activities: [{ name: 'Football' }] })).toBe(true);
    expect(isExternalCompetitionEligibleTeam({ activities: [{ name: 'BASKET' }] })).toBe(true);
  });

  it('une autre activite, ou aucune, ne l est pas', () => {
    expect(isExternalCompetitionEligibleTeam({ activities: [{ name: 'Handball' }] })).toBe(false);
    expect(isExternalCompetitionEligibleTeam({ activities: [] })).toBe(false);
    expect(isExternalCompetitionEligibleTeam(null)).toBe(false);
  });

  it('le drapeau du serveur, quand il est la, suffit', () => {
    expect(isExternalCompetitionEligibleTeam({ externalCompetitionEligible: true })).toBe(true);
  });
});
