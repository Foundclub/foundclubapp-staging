import { rattachementsAVoir } from './collectiviteAccueil';

// CORR-COLLECTIVITES 89 (31/10/2026, décision d'Adel A) — « Rien ne vous attend » alors qu'un club
// demande à rejoindre la Ville : ces demandes comptent dans « Ce qui vous attend ».
describe('CORR-COLLECTIVITES 89 — les demandes de clubs qui attendent la Ville', () => {
  it('seules les demandes VENUES d’un club, en attente, auxquelles la Ville peut répondre', () => {
    const demandes = [
      { canAnswer: true, documentId: 'a', kind: 'attach_request', state: 'pending' },
      { canAnswer: false, documentId: 'b', kind: 'proposal', state: 'pending' },
      { canAnswer: true, documentId: 'c', kind: 'attach_request', state: 'refused' },
      { canAnswer: false, documentId: 'd', kind: 'attach_request', state: 'pending' },
    ];
    expect(rattachementsAVoir(demandes).map((d) => d.documentId)).toEqual(['a']);
    expect(rattachementsAVoir(undefined)).toEqual([]);
  });
});
