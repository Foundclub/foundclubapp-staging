// ORGANISATEUR-VISIBLE (19/11, D258 « 2- A ») : « Proposé par Prénom N. » sur la fiche et la carte.
import { libelleOrganisateur } from '../organisateurEvenement';

const sortie = (organizer, extra = {}) => ({
  name: 'Sortie du soir', organizer, type: { name: 'Autre' }, ...extra,
});

describe('libelleOrganisateur', () => {
  it('donne le prénom et l\'initiale du nom', () => {
    expect(libelleOrganisateur(sortie({ firstname: 'Camille', lastname: 'durand' }))).toBe('Camille D.');
  });

  it('nettoie les espaces en trop', () => {
    expect(libelleOrganisateur(sortie({ firstname: '  Camille ', lastname: '  Durand' }))).toBe('Camille D.');
  });

  it('se contente du prénom sans nom', () => {
    expect(libelleOrganisateur(sortie({ firstname: 'Camille', lastname: '' }))).toBe('Camille');
  });

  it('ne montre rien sans prénom (identité masquée par le serveur, mineur compris)', () => {
    expect(libelleOrganisateur(sortie({ firstname: '', lastname: 'Durand' }))).toBe('');
    expect(libelleOrganisateur(sortie({ firstname: null, lastname: null }))).toBe('');
  });

  it('ne retombe jamais sur l\'e-mail ni l\'identifiant', () => {
    expect(libelleOrganisateur(sortie({ email: 'a@b.fr', username: 'a@b.fr' }))).toBe('');
  });

  it('ne montre rien sans organisateur', () => {
    expect(libelleOrganisateur(sortie(null))).toBe('');
    expect(libelleOrganisateur(null)).toBe('');
  });

  it('ne s\'affiche pas pour un tournoi (déjà « Organisé par » le complexe)', () => {
    const organizer = { firstname: 'Camille', lastname: 'Durand' };
    expect(libelleOrganisateur(sortie(organizer, { type: { name: 'Tournoi' } }))).toBe('');
    expect(libelleOrganisateur(sortie(organizer, { tournamentScopeMode: 'autonomous' }))).toBe('');
  });

  it('s\'affiche sur une sortie ordinaire, dont le serveur rend tournamentScopeMode « team » par défaut', () => {
    const organizer = { firstname: 'Camille', lastname: 'Durand' };
    expect(libelleOrganisateur(sortie(organizer, { tournamentScopeMode: 'team' }))).toBe('Camille D.');
  });
});
