import { RouteNames } from '@/navigation/routeNames';

import { getEventWizardStepRoutes } from '../eventWizardDetectionUtils';

// 🗓️ DATESDABORD (25/10/2026, décision d'Adel « 6- B ») — LE LIEU D'ABORD : on choisit
// l'installation, puis l'étape « Date & horaire » dit, à chaque horaire touché, si le créneau est
// libre ou déjà pris pour CETTE installation. Le stage garde son programme (dates et lieux par
// jour) avant le lieu. ROUGE avant : « Date & horaire » venait avant « Lieu ».

const R = RouteNames;
const debut = (/** @type {string} */ type, /** @type {any} */ suite = {}) => (
  getEventWizardStepRoutes({ type: { name: type }, ...suite }).slice(0, 5)
);

describe('DATESDABORD 6- B — l ordre des étapes de la création d un événement', () => {
  test('un entraînement : Type › Équipe › Lieu › Date & horaire', () => {
    expect(debut('Entraînement').slice(0, 4)).toEqual([
      R.EventWizardType, R.EventWizardTeam, R.EventWizardLocation, R.EventWizardLogistics,
    ]);
  });

  test('un match : Lieu › Date & horaire › Contre qui ?', () => {
    expect(debut('Match')).toEqual([
      R.EventWizardType, R.EventWizardTeam, R.EventWizardLocation, R.EventWizardLogistics,
      R.EventWizardOpponent,
    ]);
  });

  test('un tournoi : Lieu › Date & horaire › Réglages du tournoi', () => {
    expect(debut('Tournoi')).toEqual([
      R.EventWizardType, R.EventWizardTeam, R.EventWizardLocation, R.EventWizardLogistics,
      R.EventWizardTournamentSettings,
    ]);
  });

  test('un stage garde son programme avant le lieu', () => {
    expect(debut('Stage').slice(0, 4)).toEqual([
      R.EventWizardType, R.EventWizardTeam, R.EventWizardStageProgram, R.EventWizardLocation,
    ]);
  });

  test('le lieu n apparaît qu une fois', () => {
    ['Entraînement', 'Match', 'Tournoi', 'Stage', 'Détection'].forEach((type) => {
      expect(getEventWizardStepRoutes({ type: { name: type } })
        .filter((nom) => nom === R.EventWizardLocation)).toHaveLength(1);
    });
  });
});
