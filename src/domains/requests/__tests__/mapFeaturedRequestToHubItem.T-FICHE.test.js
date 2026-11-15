/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
// T-FICHE (14/11) — la liste des demandes de mise en avant (SuperAdmin) nomme le club.
// Un tournoi AUTONOME n'a pas d'équipe, seulement `event.club` : la liste affichait le repli
// « Club » au lieu de « FoundClub Tournois ». Le serveur peuple désormais `event.club`
// (event-highlight-request.ts) ; la liste le lit en DERNIER recours, après le club de l'équipe.
import { mapFeaturedRequestToHubItem } from '@/domains/requests/requestMappers';

const demande = (/** @type {Record<string, any>} */ event) => ({
  createdAt: '2026-11-14T10:00:00.000Z',
  documentId: 'demande-1',
  event: {
    date: '2026-12-19T08:00:00.000Z', documentId: 'event-1', name: 'Tournoi Montpellier', ...event,
  },
  kind: 'PUBLIC',
  multisportClub: null,
  requester: { documentId: 'u-1', firstname: 'Hugo', lastname: 'Lemaire' },
  status: 'PENDING',
  targetClub: null,
});

test('tournoi autonome : le nom du club de l événement apparaît (plus le repli « Club »)', () => {
  const item = mapFeaturedRequestToHubItem(demande({ club: { name: 'FoundClub Tournois' }, team: null }));
  expect(item.meta.clubName).toBe('FoundClub Tournois');
  expect(item.meta.targetName).toBe('FoundClub Tournois');
  expect(item.subtitle).toContain('FoundClub Tournois');
});

test('match d équipe : le club de l équipe reste le nom affiché, même si event.club diffère', () => {
  const item = mapFeaturedRequestToHubItem(demande({
    club: { name: 'Autre club' },
    team: { club: { name: 'Club Un' }, name: 'U13' },
  }));
  expect(item.meta.clubName).toBe('Club Un');
  expect(item.meta.targetName).toBe('Club Un');
});
