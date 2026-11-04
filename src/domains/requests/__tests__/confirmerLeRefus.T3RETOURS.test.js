import { readFileSync } from 'fs';
import { join } from 'path';

import { Alert } from 'react-native';

import { confirmerLeRefus } from '../confirmerLeRefus';

// T3-RETOURS-0411 (M0251, « 1- A » du chef) : les refus d'une demande reçue qui partaient au premier
// clic passent par la même fenêtre, sans texte neuf. Le témoin lit les sources : il dit qui l'appelle.

describe('confirmerLeRefus', () => {
  const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const t = (/** @type {string} */ cle) => cle;

  beforeEach(() => alerte.mockClear());

  test('rien ne part avant la confirmation ; Annuler ne fait rien', () => {
    const refuser = jest.fn();
    confirmerLeRefus(t, refuser);
    expect(refuser).not.toHaveBeenCalled();
    expect(alerte).toHaveBeenCalledWith(
      'requests.rejectConfirmTitle',
      'requests.rejectConfirmMessage',
      expect.any(Array),
    );
    const boutons = /** @type {any[]} */ (alerte.mock.calls[0][2]);
    expect(boutons.find((b) => b.style === 'cancel').onPress).toBeUndefined();
    boutons.find((b) => b.style === 'destructive').onPress();
    expect(refuser).toHaveBeenCalledTimes(1);
  });

  test.each([
    'views/event/EventDetails.js',
    'views/event/EventDetails.web.js',
    'views/event/TournamentManagement.js',
    'views/event/components/EventTeamAudiencesSection.js',
    'views/friendlyMatch/components/FriendlyMatchApplicationCard.js',
    'views/league/details/SquadRequestsScreen.js',
    'views/recruitment/RecruitmentAdDetails.js',
  ])('%s confirme son refus', (chemin) => {
    const source = readFileSync(join(__dirname, '../../..', chemin), 'utf8');
    expect(source).toMatch(/confirmerLeRefus\(\s*t,/);
  });
});
