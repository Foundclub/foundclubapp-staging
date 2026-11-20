import renderer, { act } from 'react-test-renderer';

import { useTournamentPlaceClosed } from '../useTournamentTeamName';

// RECOLTE-APP-51 (20/11, M1365 bis) — LA RÈGLE « la place ne se paie plus » : toutes les équipes du lecteur
// dans le tournoi (membre actif) sont refusées ou retirées (archivées), comme le serveur (`isClosedTeam`).
// Preuve POSITIVE seulement : fiche non lue, pas d'événement, pas d'équipe, ou une équipe active => faux.

/** @type {any} */
let mockFiche = { data: null, isSuccess: false };
jest.mock('@tanstack/react-query', () => ({ useQuery: () => mockFiche }));
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => ({ userData: { documentId: 'u-1' } }) }));

const equipe = (/** @type {string} */ id, /** @type {string} */ status, extra = {}) => ({
  documentId: id, members: [{ responseStatus: 'present', user: { documentId: 'u-1' } }], status, ...extra,
});
const lire = (/** @type {any[] | null} */ equipes, eventId = 'evt-1', isSuccess = true) => {
  mockFiche = { data: equipes ? { tournamentTeams: equipes } : null, isSuccess };
  /** @type {any} */
  let resultat;
  const Sonde = () => { resultat = useTournamentPlaceClosed(eventId); return null; };
  act(() => { renderer.create(<Sonde />); });
  return resultat;
};

describe('M1365 bis — useTournamentPlaceClosed', () => {
  test('🔴 équipe archivée (statut ou date) : fermée', () => {
    expect(lire([equipe('a', 'archived')])).toBe(true);
    expect(lire([equipe('a', 'accepted', { archivedAt: '2026-11-19T09:00:00.000Z' })])).toBe(true);
  });
  test('🔴 équipe refusée : fermée', () => {
    expect(lire([equipe('a', 'declined')])).toBe(true);
  });
  test('équipe validée ou en attente : ouverte', () => {
    expect(lire([equipe('a', 'accepted')])).toBe(false);
    expect(lire([equipe('a', 'pending')])).toBe(false);
  });
  test('une refusée et une active (place transférée, D282) : ouverte', () => {
    expect(lire([equipe('a', 'declined'), equipe('b', 'accepted')])).toBe(false);
  });
  test('rien de sûr : fiche non lue, pas d’événement, aucune équipe à lui, membre parti', () => {
    expect(lire([equipe('a', 'archived')], 'evt-1', false)).toBe(false);
    expect(lire([equipe('a', 'archived')], '')).toBe(false);
    expect(lire([])).toBe(false);
    expect(lire([{ ...equipe('a', 'archived'), members: [{ responseStatus: 'left', user: { documentId: 'u-1' } }] }])).toBe(false);
  });
});
