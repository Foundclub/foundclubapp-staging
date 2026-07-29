import { getTeamMemberCount } from './teamMemberCount';

// Le serveur (api::team.team, applyTeamPublicMemberVisibility) RETIRE les listes
// `players` / `trainers` de la réponse et ne renvoie plus que des compteurs
// (`playersCount` / `trainersCount` + `membersAreHidden`) quand le club a coché
// « masquer mes membres ». L'écran de détail (TeamDetails) lit déjà ces compteurs ;
// la carte, non — elle affichait donc « 0 membre » sur une équipe pleine.

const buildMember = (documentId) => ({ documentId, firstname: `Membre-${documentId}` });

describe('getTeamMemberCount — comportement existant (filet de caractérisation)', () => {
  it('compte les joueurs et les entraîneurs renvoyés par le serveur', () => {
    const team = {
      players: [buildMember('p1'), buildMember('p2'), buildMember('p3')],
      trainers: [buildMember('c1')],
    };

    expect(getTeamMemberCount(team)).toBe(4);
  });

  it('ne compte qu\'une fois une personne à la fois joueuse et entraîneuse', () => {
    const team = {
      players: [buildMember('p1'), buildMember('shared')],
      trainers: [buildMember('shared')],
    };

    expect(getTeamMemberCount(team)).toBe(2);
  });

  it('accepte la liste `members` des équipes League', () => {
    const team = { members: [buildMember('m1'), buildMember('m2')] };

    expect(getTeamMemberCount(team)).toBe(2);
  });

  it('retombe sur la taille des listes quand les membres n\'ont pas d\'identifiant', () => {
    const team = { players: [{}, {}], trainers: [{}] };

    expect(getTeamMemberCount(team)).toBe(3);
  });

  it('renvoie 0 pour une équipe réellement vide', () => {
    expect(getTeamMemberCount({ players: [], trainers: [] })).toBe(0);
  });

  it('renvoie 0 quand aucune équipe n\'est fournie', () => {
    expect(getTeamMemberCount(undefined)).toBe(0);
  });
});

describe('getTeamMemberCount — membres masqués par le serveur', () => {
  it('lit les compteurs quand le serveur a retiré les listes de membres', () => {
    // Charge réelle renvoyée par GET /api/teams quand les membres sont masqués :
    // ni `players` ni `trainers`, seulement les compteurs.
    const team = {
      documentId: 'team-1',
      membersAreHidden: true,
      name: 'Seniors A',
      playersCount: 13,
      trainersCount: 1,
    };

    expect(getTeamMemberCount(team)).toBe(14);
  });

  it('préfère les compteurs du serveur aux listes vidées', () => {
    const team = {
      membersAreHidden: true,
      players: [],
      playersCount: 13,
      trainers: [],
      trainersCount: 1,
    };

    expect(getTeamMemberCount(team)).toBe(14);
  });

  it('ignore un compteur absent au lieu de produire NaN', () => {
    const team = { membersAreHidden: true, playersCount: 13 };

    expect(getTeamMemberCount(team)).toBe(13);
  });

  it('ignore un compteur illisible et retombe sur les listes', () => {
    const team = {
      membersAreHidden: true,
      players: [buildMember('p1')],
      playersCount: 'beaucoup',
    };

    expect(getTeamMemberCount(team)).toBe(1);
  });
});

describe('getTeamMemberCount — charges malformées', () => {
  it('ne casse pas quand une relation vaut null', () => {
    expect(() => getTeamMemberCount({ players: null, trainers: null })).not.toThrow();
    expect(getTeamMemberCount({ players: null, trainers: null })).toBe(0);
  });

  it('ne casse pas quand une relation n\'est pas une liste', () => {
    expect(getTeamMemberCount({ players: { count: 13 } })).toBe(0);
  });
});
