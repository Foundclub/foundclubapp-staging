import annuaireDesMembres from '../annuaireDesMembres';

// 🐞 T19-RESTES (08/10, recette) — « Créé par mouri nio » pour un sondage de Karim Benali.
//
// Le serveur garde dans CHAQUE message une copie FIGÉE du nom de son auteur au moment de
// l'envoi (`lightPayloadSnapshot`). Karim s'appelait « mouri nio » quand il a écrit ses messages
// du 28-29/09 ; il s'appelle « Karim Benali » depuis. Les écrans inscrivaient leurs sources dans
// un ordre où le PLUS VIEUX message parlait en dernier, et gagnait (journal du site :
// `.recette/t19r/JOURNAL_voterDirectory_site.txt`).
//
// La règle commune : pour chaque identifiant, la première source qui a un nom l'emporte, de la
// plus fraîche à la plus figée — votants lus au serveur, participants du fil, compte connecté,
// puis l'auteur des messages du PLUS RÉCENT au plus ancien.

const KARIM_AUJOURDHUI = { documentId: 'karim', firstname: 'Karim', lastname: 'Benali' };
const KARIM_LE_29 = { documentId: 'karim', firstname: 'mouri', lastname: 'nio' };

const message = (/** @type {string} */ createdAt, /** @type {any} */ sender) => ({
  createdAt, documentId: `m-${createdAt}`, sender,
});

const nomDe = (/** @type {Map<string, any>} */ annuaire, /** @type {string} */ id) => {
  const personne = annuaire.get(id);
  return `${personne?.firstname || ''} ${personne?.lastname || ''}`.trim();
};

describe('T19R — annuaireDesMembres : le nom le plus frais l emporte', () => {
  test('messages du plus récent au plus ancien (ordre du serveur) : le récent gagne', () => {
    const annuaire = annuaireDesMembres({
      messages: [
        message('2026-10-08T00:08:30.019Z', KARIM_AUJOURDHUI),
        message('2026-09-29T19:14:15.726Z', KARIM_LE_29),
      ],
    });
    expect(nomDe(annuaire, 'karim')).toBe('Karim Benali');
  });

  test('messages du plus ancien au plus récent (fil du site) : le récent gagne aussi', () => {
    const annuaire = annuaireDesMembres({
      messages: [
        message('2026-09-29T19:14:15.726Z', KARIM_LE_29),
        message('2026-10-08T00:08:30.019Z', KARIM_AUJOURDHUI),
      ],
    });
    expect(nomDe(annuaire, 'karim')).toBe('Karim Benali');
  });

  test('le compte connecté l emporte sur la copie figée de ses vieux messages', () => {
    const annuaire = annuaireDesMembres({
      messages: [message('2026-09-29T19:14:15.726Z', KARIM_LE_29)],
      userData: KARIM_AUJOURDHUI,
    });
    expect(nomDe(annuaire, 'karim')).toBe('Karim Benali');
  });

  test('les participants (lus au serveur) l emportent sur mon compte et les messages', () => {
    const annuaire = annuaireDesMembres({
      messages: [message('2026-10-08T00:08:30.019Z', KARIM_LE_29)],
      participants: [KARIM_AUJOURDHUI],
      userData: { ...KARIM_LE_29 },
    });
    expect(nomDe(annuaire, 'karim')).toBe('Karim Benali');
  });

  test('les votants lus au serveur l emportent sur tout (une table ou une liste)', () => {
    const votants = new Map([['karim', KARIM_AUJOURDHUI]]);
    const sources = {
      messages: [message('2026-10-08T00:08:30.019Z', KARIM_LE_29)],
      participants: [KARIM_LE_29],
      userData: KARIM_LE_29,
    };
    expect(nomDe(annuaireDesMembres({ ...sources, votants }), 'karim')).toBe('Karim Benali');
    expect(nomDe(annuaireDesMembres({ ...sources, votants: votants.values() }), 'karim'))
      .toBe('Karim Benali');
  });

  test('une source sans nom ne cache pas la suivante ; l avatar : la première qui en a un', () => {
    const annuaire = annuaireDesMembres({
      messages: [message('2026-10-08T00:08:30.019Z', {
        ...KARIM_AUJOURDHUI, avatar: { url: '/uploads/karim.png' },
      })],
      participants: [{ documentId: 'karim', firstname: '', lastname: '' }],
    });
    expect(nomDe(annuaire, 'karim')).toBe('Karim Benali');
    expect(annuaire.get('karim')?.avatar?.url).toBe('/uploads/karim.png');
  });

  test('un message sans date (envoi en cours) est le plus récent ; sans identifiant, rien', () => {
    const annuaire = annuaireDesMembres({
      messages: [
        message('2026-09-29T19:14:15.726Z', KARIM_LE_29),
        { documentId: 'temp-1', sender: KARIM_AUJOURDHUI },
        { documentId: 'sans-auteur', sender: null },
        message('2026-10-01T10:00:00.000Z', { firstname: 'Sans', lastname: 'Id' }),
      ],
    });
    expect(nomDe(annuaire, 'karim')).toBe('Karim Benali');
    expect([...annuaire.keys()]).toEqual(['karim']);
  });

  test('l identifiant numérique sert quand le documentId manque', () => {
    const annuaire = annuaireDesMembres({ userData: { firstname: 'Ada', id: 7, lastname: 'L' } });
    expect(nomDe(annuaire, '7')).toBe('Ada L');
  });
});
