import { gesteDeLaVille } from '../collectiviteRattachement';

it('P2-11 : la nouvelle proposition en attente prime sur l’ancienne refusée', () => {
  const club = { documentId: 'c1' };
  const demandes = [
    { club, kind: 'proposal', state: 'refused' },
    { club, kind: 'proposal', state: 'pending' },
  ];
  expect(gesteDeLaVille(demandes, 'c1')).toBe('envoyee');
});
