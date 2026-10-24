import { isPendingRequestForClub } from '../pendingRequestMatch';

// BH03 · P11-11 — une demande en attente pour le club X bloquait le club Y qui
// porte le meme nom : le nom ne doit servir que si la demande n'a pas d'identifiant.
describe('BH03 · P11-11 — isPendingRequestForClub', () => {
  const demandeX = { clubName: 'AS Saint-Pierre', searchContext: { clubId: 'club-x' } };

  it('une demande pour X ne vaut pas pour Y, meme nom', () => {
    expect(isPendingRequestForClub(demandeX, 'club-y', 'AS Saint-Pierre')).toBe(false);
  });

  it('une demande pour X vaut pour X', () => {
    expect(isPendingRequestForClub(demandeX, 'club-x', 'Autre nom')).toBe(true);
  });

  it('une demande sans identifiant se reconnait encore a son nom', () => {
    const demandeSansId = { clubName: ' as saint-pierre ' };
    expect(isPendingRequestForClub(demandeSansId, 'club-y', 'AS Saint-Pierre')).toBe(true);
  });
});
