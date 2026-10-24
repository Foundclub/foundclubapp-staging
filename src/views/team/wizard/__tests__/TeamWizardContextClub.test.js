import { teamWizardReducer } from '../TeamWizardContext';

// BH12 P12-01 : rouvrir l'assistant depuis un AUTRE club ne doit pas garder le club precedent.
describe('teamWizardReducer INIT_FROM_PARAMS', () => {
  it('repart de zero quand le club de la route differe du club en memoire', () => {
    const avant = {
      activities: 'a', category: 'c', clubId: 'club-A', description: 'd', level: 'l',
      name: 'Equipe A', preselectedTrainerId: 'coach-A', section: 's', trainers: ['coach-A'],
    };
    const apres = teamWizardReducer(avant, { payload: { clubId: 'club-B' }, type: 'INIT_FROM_PARAMS' });
    expect(apres.clubId).toBe('club-B');
    expect(apres.name).toBe('');
    expect(apres.trainers).toEqual([]);
  });

  it('garde la saisie quand le club est le meme', () => {
    const avant = { clubId: 'club-A', name: 'Equipe A', preselectedTrainerId: '', trainers: [] };
    const apres = teamWizardReducer(avant, { payload: { clubId: 'club-A' }, type: 'INIT_FROM_PARAMS' });
    expect(apres.name).toBe('Equipe A');
  });
});
