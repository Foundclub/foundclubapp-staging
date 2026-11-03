import {
  metaApresLecture, nonLusDansLaVille, nonLusHorsDeLaVille,
} from './nonLusDeLEspace';

// T3-PASTILLE (03/11, Adel « 8- A ») — la pastille compte ce que montre la liste de l'espace.

const fil = (documentId, type, unreadCount, extra = {}) => ({
  documentId, type, unreadCount, ...extra,
});
const CANAL = fil('canal', 'collectivite_dirigeants', 1, { collectivite: { documentId: 'v1' } });
const AUTRE_VILLE = fil('autre', 'collectivite_dirigeants', 5, {
  collectivite: { documentId: 'v2' },
});
const TOUTE_LA_VILLE = fil('toute', 'collectivite_ville', 2, {
  collectivite: { documentId: 'v1' },
});
const CLUB_A = fil('club-a', 'collectivite_club', 3, {
  collectivite: { documentId: 'v1' }, collectiviteClub: { documentId: 'c-a' },
});

describe('dans l espace de la Ville', () => {
  test('19 au total dont 1 dans la Ville : la pastille dit 1 (contre-recette du train 1)', () => {
    expect(nonLusDansLaVille([CANAL], 'v1')).toBe(1);
  });

  test('aucun fil de la Ville non lu : 0, même avec 19 non-lus côté club', () => {
    expect(nonLusDansLaVille([], 'v1')).toBe(0);
  });

  test('seuls les fils de CETTE Ville comptent', () => {
    expect(nonLusDansLaVille([CANAL, AUTRE_VILLE, TOUTE_LA_VILLE, CLUB_A], 'v1')).toBe(6);
  });
});

describe('hors de la Ville : le total, moins ce que la liste cache', () => {
  const dirigeant = { mineur: false, monClubId: 'c-a' };

  test('le canal des dirigeants reste compté : il est dans la liste du club', () => {
    expect(nonLusHorsDeLaVille(19, [CANAL], dirigeant)).toBe(19);
  });

  test('la conversation d un autre club est retirée', () => {
    expect(nonLusHorsDeLaVille(10, [CLUB_A], { mineur: false, monClubId: 'c-b' })).toBe(7);
  });

  test('sa propre conversation de club reste comptée', () => {
    expect(nonLusHorsDeLaVille(10, [CLUB_A], dirigeant)).toBe(10);
  });

  test('« Toute la ville » est retirée pour un mineur', () => {
    expect(nonLusHorsDeLaVille(4, [TOUTE_LA_VILLE], { mineur: true, monClubId: null })).toBe(2);
  });

  test('jamais sous zéro', () => {
    expect(nonLusHorsDeLaVille(1, [TOUTE_LA_VILLE], { mineur: true, monClubId: null })).toBe(0);
  });
});

describe('après une lecture', () => {
  test('sans détail du serveur : la meta ne change pas', () => {
    const meta = { unreadTotal: 3 };
    expect(metaApresLecture(meta, 'canal', 0)).toBe(meta);
    expect(metaApresLecture(undefined, 'canal', 0)).toBeUndefined();
  });

  test('le fil lu sort du détail', () => {
    const meta = { unreadVille: [CANAL, TOUTE_LA_VILLE] };
    expect(metaApresLecture(meta, 'canal', 0).unreadVille).toEqual([TOUTE_LA_VILLE]);
  });

  test('le serveur donne un nouveau compte : le détail le prend', () => {
    const meta = { unreadVille: [CANAL] };
    expect(metaApresLecture(meta, 'canal', 4).unreadVille[0].unreadCount).toBe(4);
  });

  test('un fil de la Ville marqué non lu entre dans le détail', () => {
    const { unreadCount, ...chat } = CANAL;
    expect(metaApresLecture({ unreadVille: [] }, 'canal', 1, [chat]).unreadVille)
      .toEqual([{ ...chat, unreadCount: 1 }]);
  });

  test('un fil de club marqué non lu n y entre pas', () => {
    const meta = { unreadVille: [] };
    const fils = [{ documentId: 'equipe', type: 'team' }];
    expect(metaApresLecture(meta, 'equipe', 1, fils)).toBe(meta);
  });
});
