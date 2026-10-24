import { buildTeamParticipationSections, getEventTrainerKeys } from '../eventParticipantSections';

// 🐞 BUGHUNT P1-17 (BH06) — l'entraîneur d'une équipe, avec une participation en attente,
// tombait dans « Participants externes » : seuls les joueurs étaient exclus de ce filtre.

const t = (/** @type {string} */ _key, /** @type {string} */ fallback) => fallback;
const entraineur = { documentId: 'coach-1', firstname: 'Coach', lastname: 'Senior' };
const event = {
  documentId: 'evt',
  invitedTeams: [],
  missings: [],
  participations: [],
  team: {
    documentId: 'team-1', name: 'Senior', players: [{ documentId: 'j1' }], trainers: [entraineur],
  },
};

test('BH06 P1-17 — un entraîneur en attente n est pas un participant externe', () => {
  const resultat = buildTeamParticipationSections({
    canEdit: true,
    event,
    inactiveParticipations: [],
    pendingParticipations: [{ documentId: 'p-1', user: entraineur }],
    t,
    trainerKeys: getEventTrainerKeys(event),
  });
  const pendingExternes = resultat.externalParticipationSection?.pending || [];
  expect(pendingExternes.map((/** @type {any} */ p) => p.user.documentId)).not.toContain('coach-1');
});
