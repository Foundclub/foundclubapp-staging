import { firstTrainedTeamId, isTeamTrainer } from '../teamMembership';

// TUTOE-CALIBRAGE (27/10) — tournée émulateur : « Ton équipe est déjà là :
// ouvre-la » montrait la 1re carte de « Mes équipes », une équipe où le coach
// est JOUEUR (U15, coach Karim Benali) ; ses équipes entraînées étaient dans
// un autre club. Le guide doit viser une équipe qu'il ENTRAÎNE.

const moi = { documentId: 'moi' };

describe('isTeamTrainer', () => {
  test('une équipe listée dans trainedTeams : oui', () => {
    expect(isTeamTrainer({ documentId: 'eq-1' }, { ...moi, trainedTeams: [{ documentId: 'eq-1' }] }))
      .toBe(true);
  });

  test('une équipe qui me compte dans ses trainers (source fraîche) : oui', () => {
    expect(isTeamTrainer({ documentId: 'eq-2', trainers: [moi] }, { ...moi, trainedTeams: [] }))
      .toBe(true);
  });

  test('une équipe où je ne fais que jouer : non', () => {
    const user = { ...moi, myTeams: [{ documentId: 'eq-3' }], trainedTeams: [] };
    expect(isTeamTrainer({ documentId: 'eq-3', players: [moi], trainers: [] }, user)).toBe(false);
  });
});

describe('firstTrainedTeamId', () => {
  test('saute l’équipe de joueur et rend la première équipe entraînée', () => {
    const user = { ...moi, trainedTeams: [{ documentId: 'u13' }] };
    const teams = [
      { documentId: 'u15', players: [moi], trainers: [{ documentId: 'karim' }] },
      { documentId: 'u13', trainers: [] },
    ];
    expect(firstTrainedTeamId(teams, user)).toBe('u13');
  });

  test('aucune équipe entraînée à l’écran : null', () => {
    expect(firstTrainedTeamId([{ documentId: 'u15', players: [moi] }], { ...moi })).toBeNull();
  });
});
