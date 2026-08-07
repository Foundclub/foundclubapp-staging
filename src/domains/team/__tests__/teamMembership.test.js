import { getProfileTeamIds, isMyTeam } from '../teamMembership';

// D25 ① — le juge partage « est-ce MON equipe ? ».
// Les 4 premiers tests decrivent la regle d'AVANT (le profil seul) : ils
// doivent rester verts pour toujours, c'est le filet de non-regression.
// Les suivants decrivent la source ajoutee (l'equipe elle-meme).

const moi = { documentId: 'moi' };

describe('D25 ① — isMyTeam', () => {
  test('sans identifiant d equipe, la reponse est non', () => {
    expect(isMyTeam(null, { documentId: 'moi', trainedTeams: [] })).toBe(false);
    expect(isMyTeam({}, { documentId: 'moi', trainedTeams: [] })).toBe(false);
  });

  test('REGLE D AVANT — une equipe listee dans trainedTeams est la mienne', () => {
    const user = { ...moi, trainedTeams: [{ documentId: 'eq-1' }] };

    expect(isMyTeam({ documentId: 'eq-1' }, user)).toBe(true);
  });

  test('REGLE D AVANT — une equipe listee dans myTeams est la mienne', () => {
    const user = { ...moi, myTeams: [{ documentId: 'eq-2' }] };

    expect(isMyTeam({ documentId: 'eq-2' }, user)).toBe(true);
  });

  test('REGLE D AVANT — une equipe absente du profil ne l est pas', () => {
    const user = {
      ...moi,
      myTeams: [{ documentId: 'eq-2' }],
      trainedTeams: [{ documentId: 'eq-1' }],
    };

    expect(isMyTeam({ documentId: 'eq-3' }, user)).toBe(false);
  });

  test('l equipe que je viens de creer est la mienne AVANT que mon profil le sache', () => {
    // Le profil est celui d'avant la creation : le cache serveur le sert encore.
    const profilPerime = { ...moi, myTeams: [], trainedTeams: [] };
    const equipeFraiche = { documentId: 'eq-neuve', trainers: [{ documentId: 'moi' }] };

    expect(isMyTeam(equipeFraiche, profilPerime)).toBe(true);
  });

  test('un joueur inscrit dans l equipe la reconnait aussi', () => {
    const profilPerime = { ...moi, myTeams: [], trainedTeams: [] };
    const equipeFraiche = { documentId: 'eq-neuve', players: [{ documentId: 'moi' }] };

    expect(isMyTeam(equipeFraiche, profilPerime)).toBe(true);
  });

  test('l equipe d un AUTRE entraineur reste une equipe du club, pas la mienne', () => {
    const user = { ...moi, myTeams: [], trainedTeams: [] };
    const equipe = {
      documentId: 'eq-voisine',
      players: [{ documentId: 'un-joueur' }],
      trainers: [{ documentId: 'un-autre' }],
    };

    expect(isMyTeam(equipe, user)).toBe(false);
  });

  test('sans compte connecte, la source fraiche ne peut rien affirmer', () => {
    const equipe = { documentId: 'eq-1', trainers: [{ documentId: 'moi' }] };

    expect(isMyTeam(equipe, null)).toBe(false);
    expect(isMyTeam(equipe, {})).toBe(false);
  });

  test('les encadrants reduits a leur identifiant sont compris', () => {
    const equipe = { documentId: 'eq-1', trainers: ['moi'] };

    expect(isMyTeam(equipe, { ...moi, trainedTeams: [] })).toBe(true);
  });

  test('une equipe masquee (aucun membre rendu) retombe sur le profil', () => {
    const user = { ...moi, trainedTeams: [{ documentId: 'eq-1' }] };

    expect(isMyTeam({ documentId: 'eq-1' }, user)).toBe(true);
    expect(isMyTeam({ documentId: 'eq-9' }, user)).toBe(false);
  });

  test('un identifiant d equipe seul (sans objet) est accepte', () => {
    const user = { ...moi, trainedTeams: [{ documentId: 'eq-1' }] };

    expect(isMyTeam('eq-1', user)).toBe(true);
  });
});

describe('D25 ① — getProfileTeamIds', () => {
  test('il reunit myTeams et trainedTeams, sans les vides', () => {
    const user = {
      myTeams: [{ documentId: 'eq-2' }, { documentId: '' }, null],
      trainedTeams: [{ documentId: 'eq-1' }],
    };

    expect(getProfileTeamIds(user)).toEqual(['eq-2', 'eq-1']);
  });

  test('un profil absent ne fait pas tomber le juge', () => {
    expect(getProfileTeamIds(null)).toEqual([]);
    expect(getProfileTeamIds({})).toEqual([]);
  });
});
