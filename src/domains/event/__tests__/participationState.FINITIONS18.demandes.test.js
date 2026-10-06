import fs from 'fs';
import path from 'path';

import * as etat from '../participationState';

// FINITIONS18 · POINT 9 (tournee T16, site, fiche d'un entrainement chez Karim) — le bloc
// « Demandes en attente » montrait « Hugo Lemaire · Statut: accepted · Equipe source: U15 » :
// une reponse « Je participe » presentee comme une demande, et le statut brut en anglais. Le
// telephone, lui, n'y met que les demandes ACTIVES au statut « pending » ; le site listait TOUT
// `event.participationRequests`. Une seule regle, pour les deux. ROUGE avant.

const HUGO = { documentId: 'hugo', firstname: 'Hugo', lastname: 'Lemaire' };
const LINA = { documentId: 'lina', firstname: 'Lina', lastname: 'Roux' };
const ENZO = { documentId: 'enzo', firstname: 'Enzo', lastname: 'Petit' };

test('🔴 une demande en attente : active, au statut « pending » — une reponse acceptee n en est pas une', () => {
  expect(typeof etat.isPendingParticipationRequest).toBe('function');
  const demandes = [
    { isActive: true, participationStatus: 'accepted', sourceTeam: { name: 'U15' }, user: HUGO },
    { isActive: true, participationStatus: 'pending', user: LINA },
    { isActive: false, participationStatus: 'pending', user: ENZO },
    { participationStatus: 'PENDING', user: ENZO },
    { isActive: true, participationStatus: 'declined', user: LINA },
  ];
  expect(demandes.filter(etat.isPendingParticipationRequest).map((demande) => demande.user.documentId))
    .toEqual(['lina', 'enzo']);
});

test('🔴 le site et le telephone lisent CETTE regle, et le bloc du site n affiche plus de statut brut', () => {
  const lire = (fichier) => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'views', 'event', fichier), 'utf8');
  const site = lire('EventDetails.web.js');
  const telephone = lire('EventDetails.js');
  expect(site).toMatch(/isPendingParticipationRequest/);
  expect(telephone).toMatch(/isPendingParticipationRequest/);
  const bloc = site.slice(site.indexOf("'eventDetails.pendingRequests'"), site.indexOf("'eventDetails.sourceTeam2'"));
  expect(bloc).not.toMatch(/participationRequests\.map/);
  expect(bloc).not.toMatch(/participationStatus \|\| 'pending'/);
});
