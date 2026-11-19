// INSCRIPTION-CODE-3 (19/11/2026, planche V2 B1-B5, v2 « ok ») — QUEL « BIENVENUE » POUR QUI.
// B1 joueur avec un club demandé, B2 joueur sans club, B3 pratiquant (loisir, nature, culture)
// avec un club, B4 coach, B5 parent. Dirigeant et super-admin : aucun cas (écran d'aujourd'hui).
import { casDeBienvenue } from '@/domains/auth/casDeBienvenue';

const DEMANDE = { club: { documentId: 'club-1', name: 'US Exemple Marseille' }, state: 'pending' };

describe('casDeBienvenue', () => {
  test('B1 : un joueur de football dont la demande au club est partie', () => {
    expect(casDeBienvenue({
      roleKey: 'player',
      userData: { clubMembershipRequests: [DEMANDE], preferredSport: 'Football' },
    })).toEqual({
      cas: 'joueurAvecClub', club: DEMANDE.club, enAttente: true, equipe: null,
    });
  });

  test('B1 : un joueur déjà membre de son club (pas de demande en attente)', () => {
    const club = { documentId: 'club-2', name: 'FC Membre' };
    expect(casDeBienvenue({ roleKey: 'player', userData: { club, preferredSport: 'Football' } }))
      .toEqual({
        cas: 'joueurAvecClub', club, enAttente: false, equipe: null,
      });
  });

  test('B2 : un joueur sans club', () => {
    expect(casDeBienvenue({ roleKey: 'player', userData: { preferredSport: 'Football' } }).cas)
      .toBe('sansClub');
  });

  test('B3 : un pratiquant de spéléologie dont la demande est partie', () => {
    expect(casDeBienvenue({
      roleKey: 'player',
      userData: { clubMembershipRequests: [DEMANDE], preferredSport: 'Spéléologie' },
    }).cas).toBe('pratiquant');
  });

  test('un pratiquant sans club : le cas sans club', () => {
    expect(casDeBienvenue({ roleKey: 'player', userData: { preferredSport: 'Danse' } }).cas)
      .toBe('sansClub');
  });

  test('une activité inconnue garde les mots de la compétition', () => {
    expect(casDeBienvenue({
      roleKey: 'player',
      userData: { clubMembershipRequests: [DEMANDE], preferredSport: 'Sport inconnu' },
    }).cas).toBe('joueurAvecClub');
  });

  test('B4 : un coach, et l’équipe qu’il a demandée', () => {
    expect(casDeBienvenue({
      roleKey: 'coach',
      userData: {
        teamMembershipRequests: [
          { direction: 'invite', state: 'pending', team: { name: 'U15' } },
          { direction: 'request', state: 'pending', team: { name: 'Seniors 1' } },
        ],
      },
    })).toEqual({
      cas: 'coach', club: null, enAttente: false, equipe: 'Seniors 1',
    });
  });

  test('B5 : un parent', () => {
    expect(casDeBienvenue({ roleKey: 'parent', userData: {} }).cas).toBe('parent');
  });

  test('dirigeant et super-admin : aucun cas, l’écran d’aujourd’hui', () => {
    expect(casDeBienvenue({ roleKey: 'president', userData: {} })).toBeNull();
    expect(casDeBienvenue({ roleKey: 'superAdmin', userData: {} })).toBeNull();
  });
});
