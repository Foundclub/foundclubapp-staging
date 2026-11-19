/* eslint-disable max-len -- titres de témoins en phrases, et relevés ligne à ligne */
import {
  getTournamentShortPlace,
  getTournamentTeamCaptainShort,
  getTournamentTeamLookingFor,
  getTournamentTeamPublicPlayers,
  getTournamentTeamsThreshold,
} from '../tournamentJoinRules';

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

// IMPL-1-FICHE (18/11/2026, pack T-DESIGN-TOURNOI, pages 6, 7 et 8) — les règles partagées par la
// fiche du tournoi (téléphone et site) et la carte d'événement des listes.

describe('IMPL-1 — le lieu court d un tournoi (« AR Soccer · Montpellier »)', () => {
  test('🔴 le complexe et la ville, sans la rue ni le code postal', () => {
    expect(getTournamentShortPlace({ location: 'AR Soccer, 119 rue de la Rauze basse, 34070 Montpellier' }))
      .toBe('AR Soccer · Montpellier');
  });

  test('🔴 un « France » final ne passe pas pour la ville', () => {
    expect(getTournamentShortPlace({ location: 'AR Soccer, 119 rue de la Rauze basse, 34070 Montpellier, France' }))
      .toBe('AR Soccer · Montpellier');
  });

  test('🔴 un lieu en un seul morceau reste tel quel ; rien sans lieu', () => {
    expect(getTournamentShortPlace({ location: 'Stade de Lattes' })).toBe('Stade de Lattes');
    expect(getTournamentShortPlace({})).toBe('');
  });

  test('🔴 jamais le nom du terrain (« Terrain A ») : il n est pas un lieu', () => {
    expect(getTournamentShortPlace({
      facility: { name: 'Terrain A' },
      location: 'AR Soccer, 119 rue de la Rauze basse, 34070 Montpellier',
    })).toBe('AR Soccer · Montpellier');
  });
});

describe('IMPL-1 — le seuil d affichage des équipes (30 %, page 8)', () => {
  test('🔴 8 pour 24 équipes, 1 pour 3, rien sans capacité', () => {
    expect(getTournamentTeamsThreshold(24)).toBe(8);
    expect(getTournamentTeamsThreshold(3)).toBe(1);
    expect(getTournamentTeamsThreshold(null)).toBeNull();
  });
});

describe('IMPL-1 — « Cherche N joueurs » = seuil des payés − effectif, équipe ouverte seulement', () => {
  const ouverte = {
    documentId: 'e1', isOpenToJoinRequests: true, membersSummary: { count: 3 }, sourceType: 'custom_team', status: 'pending',
  };

  test('🔴 3 joueurs, équipe ouverte : cherche 2', () => {
    expect(getTournamentTeamLookingFor(ouverte, { paidMembersToValidate: 5 })).toBe(2);
  });

  test('🔴 seuil absent : 5 par défaut', () => {
    expect(getTournamentTeamLookingFor(ouverte)).toBe(2);
  });

  test('🔴 équipe fermée aux demandes : 0, quel que soit l effectif', () => {
    expect(getTournamentTeamLookingFor({ ...ouverte, isOpenToJoinRequests: false })).toBe(0);
  });

  test('🔴 5 joueurs ou plus : 0 ; effectif inconnu : 0', () => {
    expect(getTournamentTeamLookingFor({ ...ouverte, membersSummary: { count: 7 } })).toBe(0);
    expect(getTournamentTeamLookingFor({ ...ouverte, membersSummary: undefined })).toBe(0);
  });
});

describe('IMPL-1 — les joueurs d une équipe vus de l extérieur (aperçu 8e)', () => {
  test('🔴 « Prénom I. », jamais le paiement de chacun', () => {
    const joueurs = getTournamentTeamPublicPlayers({
      membersSummary: { list: [{ firstName: 'Yanis', lastInitial: 'R', paid: true }, { firstName: 'Inès', lastInitial: 'M.', paid: false }] },
    });
    expect(joueurs).toEqual([{ label: 'Yanis R.', minor: false }, { label: 'Inès M.', minor: false }]);
    expect(JSON.stringify(joueurs)).not.toContain('paid');
  });

  test('🔴 un mineur (drapeau du serveur) n a pas de prénom', () => {
    expect(getTournamentTeamPublicPlayers({
      membersSummary: { list: [{ firstName: 'Léo', isMinor: true, lastInitial: 'D' }] },
    })).toEqual([{ label: null, minor: true }]);
  });

  test('🔴 rien à lire : liste vide', () => {
    expect(getTournamentTeamPublicPlayers({})).toEqual([]);
  });

  test('🔴 le capitaine en « Prénom I. » ; inconnu pour un tiers (captainUser nul) : vide', () => {
    expect(getTournamentTeamCaptainShort({ captainUser: { firstname: 'Yanis', lastname: 'Roux' } })).toBe('Yanis R.');
    expect(getTournamentTeamCaptainShort({ captainUser: null })).toBe('');
  });
});

// IMPL-1-FICHE × IMPL-5 (contrat du chef, 18/11) — ce que le serveur rend à un lecteur qui n'est ni
// membre, ni capitaine, ni organisateur : `membersSummary.paidHidden: true`, `list[]` sans `paid`,
// un mineur aux champs vides, `captainDisplayName` (« Yanis R. »).
describe('IMPL-1 × IMPL-5 — le résumé masqué d une équipe', () => {
  const { formatTournamentPlayersShortList } = jest.requireActual('../tournamentUtils');
  const PAYANT = { entryFeeCents: 2000 };
  const MASQUE = {
    count: 2, list: [{ firstName: 'Yanis', lastInitial: 'R' }, { firstName: '', lastInitial: '' }], paidCount: 1, paidHidden: true, pendingCount: 0,
  };

  test('🔴 paidHidden : aucun état de paiement (« · en attente ») sur la liste courte', () => {
    const liste = formatTournamentPlayersShortList(MASQUE, PAYANT);
    expect(liste).not.toMatch(/en attente|payé/);
    expect(liste.split('\n')[0]).toBe('Yanis R.');
  });

  test('🔴 paidHidden : un joueur aux champs vides est « Joueur (moins de 18 ans) »', () => {
    expect(formatTournamentPlayersShortList(MASQUE, PAYANT).split('\n')[1]).toBe('Joueur (moins de 18 ans)');
  });

  test('sans paidHidden (membre, organisateur) : l état de paiement reste', () => {
    expect(formatTournamentPlayersShortList({ list: [{ firstName: 'Yanis', lastInitial: 'R', paid: true }] }, PAYANT)).toBe('Yanis R. · payé');
  });

  test('🔴 l aperçu : le joueur aux champs vides d un résumé masqué est un mineur, sans prénom', () => {
    expect(getTournamentTeamPublicPlayers({ membersSummary: MASQUE })).toEqual([{ label: 'Yanis R.', minor: false }, { label: null, minor: true }]);
  });

  test('🔴 le capitaine vient de captainDisplayName quand captainUser est réduit', () => {
    expect(getTournamentTeamCaptainShort({ captainDisplayName: 'Yanis R.', captainUser: { documentId: 'c1' } })).toBe('Yanis R.');
  });
});

// IMPL-1-FICHE, commit de suite (chef, 19/11, Q4) — un tournoi ANONYMISÉ
// (`participantIdentityVisibility: 'ANONYMIZED'`) rend lui aussi des champs vides : là, un joueur
// sans prénom est « Joueur », jamais « Joueur (moins de 18 ans) ». Le drapeau `isMinor` explicite
// du serveur sera un lot admin.
describe('IMPL-1 — tournoi anonymisé : un joueur aux champs vides n est pas un mineur', () => {
  const { formatTournamentPlayersShortList } = jest.requireActual('../tournamentUtils');
  const MASQUE = {
    count: 2, list: [{ firstName: 'Yanis', lastInitial: 'R' }, { firstName: '', lastInitial: '' }], paidCount: 1, paidHidden: true,
  };
  const ANONYME = { participantIdentityVisibility: 'ANONYMIZED' };

  test('🔴 la liste courte dit « Joueur »', () => {
    expect(formatTournamentPlayersShortList(MASQUE, { entryFeeCents: 2000 }, ANONYME).split('\n')).toEqual(['Yanis R.', 'Joueur']);
  });

  test('🔴 l aperçu : « Joueur », pas un mineur (la casse du réglage ne compte pas)', () => {
    expect(getTournamentTeamPublicPlayers({ membersSummary: MASQUE }, { participantIdentityVisibility: 'anonymized' }))
      .toEqual([{ label: 'Yanis R.', minor: false }, { label: 'Joueur', minor: false }]);
  });

  test('identités visibles : le mineur reste « Joueur (moins de 18 ans) »', () => {
    expect(formatTournamentPlayersShortList(MASQUE, {}, { participantIdentityVisibility: 'VISIBLE' }).split('\n')[1]).toBe('Joueur (moins de 18 ans)');
    expect(getTournamentTeamPublicPlayers({ membersSummary: MASQUE }, { participantIdentityVisibility: 'VISIBLE' })[1]).toEqual({ label: null, minor: true });
  });

  test('un drapeau isMinor du serveur l emporte, même anonymisé', () => {
    expect(getTournamentTeamPublicPlayers({ membersSummary: { list: [{ firstName: '', isMinor: true }], paidHidden: true } }, ANONYME))
      .toEqual([{ label: null, minor: true }]);
  });
});
