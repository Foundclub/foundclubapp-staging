import {
  estEpinglePourMoi,
  filtrerLesFils,
  trierLesFils,
} from './messagingUseCases';

// SMF (T20, 08/10) — UNE SEULE LISTE DES CONVERSATIONS. L ordre et le filtre vivaient en ligne dans
// Messaging.js (la page du telephone) ; la colonne « Messages » du site n en avait aucun : ni
// epingles en tete, ni recherche, ni « Toutes / Classique / League ». Ces regles en sortent telles
// quelles et servent aux deux (MessagingMSG1A, MessagingARCHIVEES, MessagingMSG1BA restent verts).

const MOI = 'moi';
const fil = (documentId, type, updatedAt, extra = {}) => ({
  documentId, type, updatedAt, ...extra,
});

describe('trierLesFils — la regle de Messaging.js', () => {
  test('mes epingles d abord, puis le rang du type, puis le plus recent', () => {
    const fils = [
      fil('prive-recent', 'whisper', '2026-10-08T10:00:00Z'),
      fil('equipe-ancienne', 'team', '2026-10-01T10:00:00Z'),
      fil('equipe-recente', 'team', '2026-10-07T10:00:00Z'),
      fil('club', 'club', '2026-09-01T10:00:00Z'),
      fil('prive-epingle', 'whisper', '2026-09-02T10:00:00Z', { pinnedBy: [{ documentId: MOI }] }),
      fil('groupe-epingle-par-un-autre', 'group', '2026-10-08T11:00:00Z', {
        pinnedBy: [{ documentId: 'autre' }],
      }),
      fil('multisport', 'multisport', '2026-08-01T10:00:00Z'),
      fil('ligue', 'league_match', '2026-08-01T10:00:00Z'),
      fil('inconnu', 'autre_chose', '2026-10-08T12:00:00Z'),
    ];
    expect(trierLesFils(fils, MOI).map(({ documentId }) => documentId)).toEqual([
      'prive-epingle',
      'multisport',
      'club',
      'ligue',
      'equipe-recente',
      'equipe-ancienne',
      'groupe-epingle-par-un-autre',
      'prive-recent',
      'inconnu',
    ]);
  });

  test('rend une copie, ne touche pas la liste recue ; une liste absente vaut vide', () => {
    const fils = [
      fil('b', 'whisper', '2026-10-01T00:00:00Z'),
      fil('a', 'club', '2026-10-01T00:00:00Z'),
    ];
    const copie = [...fils];
    trierLesFils(fils, MOI);
    expect(fils).toEqual(copie);
    expect(trierLesFils(undefined, MOI)).toEqual([]);
  });

  test('epingle « par moi » seulement', () => {
    expect(estEpinglePourMoi({ pinnedBy: [{ documentId: MOI }] }, MOI)).toBe(true);
    expect(estEpinglePourMoi({ pinnedBy: [{ documentId: 'autre' }] }, MOI)).toBe(false);
    expect(estEpinglePourMoi({}, MOI)).toBe(false);
  });
});

describe('filtrerLesFils — portee puis recherche', () => {
  const fils = [
    fil('u15', 'team', '', { nom: 'U15' }),
    fil('match', 'league_match', '', { nom: 'Match du 12/10' }),
    fil('covoit', 'group', '', { nom: 'Covoiturage du jeudi' }),
  ];
  const nomDuFil = (/** @type {any} */ chat) => chat.nom;
  const ids = (/** @type {any[]} */ liste) => liste.map(({ documentId }) => documentId);

  test('Toutes, Classique, League', () => {
    expect(ids(filtrerLesFils(fils, { nomDuFil }))).toEqual(['u15', 'match', 'covoit']);
    expect(ids(filtrerLesFils(fils, { nomDuFil, portee: 'classic' }))).toEqual(['u15', 'covoit']);
    expect(ids(filtrerLesFils(fils, { nomDuFil, portee: 'league' }))).toEqual(['match']);
  });

  test('la recherche ignore la casse et garde l ordre', () => {
    expect(ids(filtrerLesFils(fils, { nomDuFil, recherche: 'COVOIT' }))).toEqual(['covoit']);
    expect(ids(filtrerLesFils(fils, { nomDuFil, portee: 'league', recherche: 'u15' }))).toEqual([]);
    expect(ids(filtrerLesFils(fils, { nomDuFil: () => '', recherche: 'x' }))).toEqual([]);
  });
});
