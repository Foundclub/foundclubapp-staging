import {
  estArchivePourMoi,
  estEpinglePourMoi,
  filtrerLesFils,
  trierLesFils,
} from './messagingUseCases';

// SMF (T20, 08/10) — UNE SEULE LISTE DES CONVERSATIONS. L ordre et le filtre vivaient en ligne dans
// IPH09 (09/10) actualise la regle produit : seul le club garde sa priorite automatique.
// Messaging.js (la page du telephone) ; la colonne « Messages » du site n en avait aucun : ni
// epingles en tete, ni recherche, ni « Toutes / Classique / League ». Ces regles en sortent telles
// quelles et servent aux deux (MessagingMSG1A, MessagingARCHIVEES, MessagingMSG1BA restent verts).

const MOI = 'moi';
const fil = (documentId, type, updatedAt, extra = {}) => ({
  documentId, messages: updatedAt ? [{ createdAt: updatedAt }] : [], type, updatedAt, ...extra,
});

describe('trierLesFils — la regle de Messaging.js', () => {
  test('IPH09 — mes epingles et le club, puis tous les types par dernier message', () => {
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
      'club',
      'inconnu',
      'groupe-epingle-par-un-autre',
      'prive-recent',
      'equipe-recente',
      'equipe-ancienne',
      'multisport',
      'ligue',
    ]);
  });

  // R17-CANAUX (19/10, REC17-004) — « Toute la ville » s'affiche EN TÊTE de la liste : après mes
  // épingles (mon choix), avant le canal du club, quel que soit son dernier message.
  test('R17-CANAUX — « Toute la ville » en tête, après mes épingles', () => {
    const fils = [
      fil('prive-recent', 'whisper', '2026-10-19T10:00:00Z'),
      fil('club', 'club', '2026-10-18T10:00:00Z'),
      fil('toute-la-ville', 'collectivite_ville', '2026-09-01T10:00:00Z'),
      fil('prive-epingle', 'whisper', '2026-09-02T10:00:00Z', { pinnedBy: [{ documentId: MOI }] }),
    ];
    expect(trierLesFils(fils, MOI).map(({ documentId }) => documentId))
      .toEqual(['prive-epingle', 'toute-la-ville', 'club', 'prive-recent']);
  });

  test('IPH09 — renommer, lire ou rejoindre ne fait pas remonter un vieux message', () => {
    const recent = fil('prive', 'whisper', '2026-10-09T10:00:00Z');
    const ancien = fil('groupe-renomme', 'group', '2026-10-09T12:00:00Z', {
      messages: [{ createdAt: '2026-10-08T10:00:00Z', updatedAt: '2026-10-09T12:00:00Z' }],
    });
    expect(trierLesFils([ancien, recent], MOI).map(({ documentId }) => documentId))
      .toEqual(['prive', 'groupe-renomme']);
    const nouveau = { ...ancien, messages: [...ancien.messages, { createdAt: '2026-10-09T13:00:00Z' }] };
    expect(trierLesFils([recent, nouveau], MOI).map(({ documentId }) => documentId))
      .toEqual(['groupe-renomme', 'prive']);
  });

  test('IPH09 — dates identiques/manquantes/invalides : ordre stable, sans privilegier le type', () => {
    const fils = [
      fil('sans-message', 'group', '2026-10-09T23:00:00Z', { messages: [] }),
      fil('invalide', 'team', '', { messages: [{ createdAt: 'invalide' }] }),
      fil('prive', 'whisper', '2026-10-09T10:00:00Z'),
      fil('groupe', 'group', '2026-10-09T10:00:00Z'),
      fil('ancien', 'team', '', {
        messages: [{ createdAt: 'invalide' }, { createdAt: '2026-10-08T10:00:00Z' }],
      }),
    ];
    Object.freeze(fils);
    expect(trierLesFils(fils, MOI).map(({ documentId }) => documentId))
      .toEqual(['prive', 'groupe', 'ancien', 'sans-message', 'invalide']);
  });

  test('IPH09 — archives personnelles et epingles individuelles conservent leur etat', () => {
    const fils = [
      fil('archive-autre', 'group', '2026-10-09T10:00:00Z', { archivedBy: [{ documentId: 'autre' }] }),
      fil('epingle', 'whisper', '2026-09-01T10:00:00Z', { pinnedBy: [{ documentId: MOI }] }),
      fil('archive-moi', 'team', '2026-10-09T11:00:00Z', { archivedBy: [{ documentId: MOI }] }),
    ];
    const tries = trierLesFils(fils, MOI);
    expect(tries.filter((chat) => !estArchivePourMoi(chat, MOI)).map(({ documentId }) => documentId))
      .toEqual(['epingle', 'archive-autre']);
    expect(tries.filter((chat) => estArchivePourMoi(chat, MOI)).map(({ documentId }) => documentId))
      .toEqual(['archive-moi']);
    expect(fils[1].pinnedBy).toEqual([{ documentId: MOI }]);
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
