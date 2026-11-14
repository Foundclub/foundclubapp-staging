import {
  applyClubAudienceToFormData,
  canSeeClubAudience,
  CLUB_AUDIENCE_ALL,
  countClubAudienceRows,
  filterClubAudienceRows,
  getClubRelanceState,
  isClubAudienceEvent,
  keepsTeamWithClubAudience,
  sortClubAudienceRows,
} from '../clubAudience';

// EVT-CLUB-ECRANS (14/11/2026, D121) — les regles pures de « tout le club », cote app.
// Contrat serveur : fix/EVT-CLUB-admin 6ffd967b (GET /events/:id/club-audience, POST /events/:id/remind).

const ROLES = { president: 'Président', trainer: 'Entraîneur' };

const ligne = (cle, champs = {}) => ({
  ageBracket: 'adult',
  answer: null,
  answeredByParent: false,
  firstname: cle,
  isCoach: false,
  key: cle,
  kind: 'player',
  lastInitial: 'A',
  remindedAt: null,
  section: 'masculine',
  sport: null,
  team: { documentId: 'seniors', name: 'Seniors A' },
  ...champs,
});

const LIGNES = [
  ligne('Yanis', { answer: 'present' }),
  ligne('Ines', { ageBracket: 'under13', answer: 'absent', answeredByParent: true, kind: 'child', section: 'feminine', team: { documentId: 'u9', name: 'U9' } }),
  ligne('Noe', { ageBracket: 'under13', kind: 'child', team: { documentId: 'u11', name: 'U11' } }),
  ligne('Marc', { kind: 'member', section: null, team: null }),
  ligne('Hugo', { ageBracket: 'teen', team: { documentId: 'u15', name: 'U15' } }),
];

describe('EVT-CLUB — qui voit quoi', () => {
  test('un evenement est « tout le club » seulement si audienceScope est pose', () => {
    expect(isClubAudienceEvent({ audienceScope: 'club' })).toBe(true);
    expect(isClubAudienceEvent({ audienceScope: 'all_sections' })).toBe(true);
    expect(isClubAudienceEvent({ audienceScope: null })).toBe(false);
    expect(isClubAudienceEvent({})).toBe(false);
    expect(isClubAudienceEvent(null)).toBe(false);
  });

  test('Q1 A / Q10 B : le dirigeant du club voit la liste, pas l entraineur', () => {
    const event = { audienceScope: 'club', club: { documentId: 'c1' } };
    const president = { club: { documentId: 'c1' }, role: { name: ROLES.president } };
    const entraineur = { club: { documentId: 'c1' }, role: { name: ROLES.trainer } };
    const autreClub = { club: { documentId: 'c2' }, role: { name: ROLES.president } };
    const adminOmnisports = { multisportClubs: [{ documentId: 'm1' }], role: { name: ROLES.trainer } };
    const eventOmni = { audienceScope: 'club', club: { documentId: 'c1', parentMultisport: { documentId: 'm1' } } };

    expect(canSeeClubAudience(event, president, ROLES)).toBe(true);
    expect(canSeeClubAudience(event, entraineur, ROLES)).toBe(false);
    expect(canSeeClubAudience(event, autreClub, ROLES)).toBe(false);
    expect(canSeeClubAudience({ ...event, audienceScope: null }, president, ROLES)).toBe(false);
    expect(canSeeClubAudience(eventOmni, adminOmnisports, ROLES)).toBe(true);
    // Match « tout le club » (R1 A) : le club se lit par l equipe.
    expect(canSeeClubAudience({ audienceScope: 'club', team: { club: { documentId: 'c1' } } }, president, ROLES)).toBe(true);
  });
});

describe('EVT-CLUB — la liste du dirigeant (Q12 B, R4 A, R5 C)', () => {
  test('ordre alphabetique par prenom', () => {
    expect(sortClubAudienceRows(LIGNES).map((row) => row.key)).toEqual(['Hugo', 'Ines', 'Marc', 'Noe', 'Yanis']);
  });

  test('les filtres s additionnent : age, section, equipe, « sans equipe »', () => {
    const tous = { ...CLUB_AUDIENCE_ALL };
    expect(filterClubAudienceRows(LIGNES, { ...tous, age: 'under13' }).map((row) => row.key)).toEqual(['Ines', 'Noe']);
    expect(filterClubAudienceRows(LIGNES, { ...tous, age: 'under13', section: 'feminine' }).map((row) => row.key)).toEqual(['Ines']);
    expect(filterClubAudienceRows(LIGNES, { ...tous, team: 'u11' }).map((row) => row.key)).toEqual(['Noe']);
    expect(filterClubAudienceRows(LIGNES, { ...tous, team: 'none' }).map((row) => row.key)).toEqual(['Marc']);
    expect(filterClubAudienceRows(LIGNES, { ...tous, answer: 'unanswered' }).map((row) => row.key)).toEqual(['Noe', 'Marc', 'Hugo']);
    expect(filterClubAudienceRows(LIGNES, { ...tous, search: 'hug' }).map((row) => row.key)).toEqual(['Hugo']);
  });

  test('les 4 compteurs suivent les filtres, sauf celui de la reponse', () => {
    expect(countClubAudienceRows(LIGNES, { ...CLUB_AUDIENCE_ALL })).toEqual({
      absent: 1, all: 5, present: 1, unanswered: 3,
    });
    expect(countClubAudienceRows(LIGNES, { ...CLUB_AUDIENCE_ALL, age: 'under13', answer: 'present' })).toEqual({
      absent: 1, all: 2, present: 0, unanswered: 1,
    });
  });
});

describe('EVT-CLUB — la relance (Q13, R3 A)', () => {
  const maintenant = new Date('2026-12-01T14:32:00.000Z');

  test('elle porte sur les sans reponse AFFICHES', () => {
    const affiches = filterClubAudienceRows(LIGNES, { ...CLUB_AUDIENCE_ALL, age: 'under13' });
    const etat = getClubRelanceState({ available: true, lastRemindedAt: null, nextReminderAt: null }, affiches, maintenant);
    expect(etat).toEqual(expect.objectContaining({ keys: ['Noe'], visible: true, waiting: false }));
  });

  test('grise 24 h apres une relance, avec l heure de la prochaine', () => {
    const relance = {
      available: true,
      lastRemindedAt: '2026-12-01T14:00:00.000Z',
      nextReminderAt: '2026-12-02T14:00:00.000Z',
    };
    const etat = getClubRelanceState(relance, LIGNES, maintenant);
    expect(etat.visible).toBe(true);
    expect(etat.waiting).toBe(true);
    expect(etat.nextReminderAt).toBe('2026-12-02T14:00:00.000Z');
  });

  test('absent quand l evenement a commence (available faux) ou sans « sans reponse » affiche', () => {
    expect(getClubRelanceState({ available: false }, LIGNES, maintenant).visible).toBe(false);
    const repondus = LIGNES.filter((row) => row.answer);
    expect(getClubRelanceState({ available: true }, repondus, maintenant).visible).toBe(false);
  });
});

describe('EVT-CLUB — la charge de creation (contrat POST /events)', () => {
  const base = {
    club: 'c1', isRecurrent: false, team: 'seniors', type: 't-autre',
  };

  test('un evenement ordinaire ne change pas : aucune cle audienceScope', () => {
    const charge = applyClubAudienceToFormData(base, { audienceScope: null, type: { name: 'Autre' } });
    expect(charge).toEqual(base);
    expect('audienceScope' in charge).toBe(false);
  });

  test('hors Match / Tournoi : audienceScope + club, et PAS d equipe ; une date seule', () => {
    const charge = applyClubAudienceToFormData(
      { ...base, isRecurrent: true },
      { audienceScope: 'club', club: { documentId: 'c1' }, team: null, type: { name: 'Autre' } },
    );
    expect(charge.audienceScope).toBe('club');
    expect(charge.club).toBe('c1');
    expect(charge.team).toBeUndefined();
    expect(charge.isRecurrent).toBe(false);
  });

  test('Match (R1 A) : l equipe reste, audienceScope en plus', () => {
    const charge = applyClubAudienceToFormData(base, {
      audienceScope: 'club', club: { documentId: 'c1' }, team: { documentId: 'seniors' }, type: { name: 'Match' },
    });
    expect(charge).toEqual(expect.objectContaining({ audienceScope: 'club', team: 'seniors' }));
  });

  test('Match et Tournoi gardent leur equipe ; les autres types non', () => {
    expect(keepsTeamWithClubAudience('Match')).toBe(true);
    expect(keepsTeamWithClubAudience('Tournoi')).toBe(true);
    expect(keepsTeamWithClubAudience('Entraînement')).toBe(false);
    expect(keepsTeamWithClubAudience('Autre')).toBe(false);
  });
});
