import { lieuAOuvrir, presenceDansLeFil, resumeDesParticipants } from './evenementDansLeFil';

// MSG1A (§3.8 / §3.9) — la bulle d'un evenement partage : qui voit Present | Absent,
// et les trois nombres de la ligne « Participants ».

const MAINTENANT = Date.parse('2026-10-07T12:00:00Z');
const DEMAIN = '2026-10-08T18:00:00Z';
const HIER = '2026-10-06T18:00:00Z';

const moi = { documentId: 'moi', role: { name: 'Joueur' } };
const lui = { documentId: 'lui', firstname: 'Hugo' };
const elle = { documentId: 'elle', firstname: 'Lea' };
const coach = { documentId: 'coach', firstname: 'Karim' };

/**
 * Un evenement de l'equipe, a qui l'on peut tout ajouter.
 * @param {any} [surcharge]
 * @returns {any}
 */
const evenement = (surcharge = {}) => ({
  date: DEMAIN,
  documentId: 'ev-1',
  missings: [],
  participations: [],
  team: { documentId: 'eq-1', players: [moi, lui, elle], trainers: [coach] },
  ...surcharge,
});

describe('presenceDansLeFil — le selecteur Present | Absent de la bulle', () => {
  test('E1 — un membre convie qui n a pas repondu : selecteur, sans reponse', () => {
    expect(presenceDansLeFil({ evenement: evenement(), maintenantMs: MAINTENANT, utilisateur: moi }))
      .toEqual({ reponse: null });
  });

  test('E2 — la reponse vient de L EVENEMENT : present, puis absent', () => {
    expect(presenceDansLeFil({
      evenement: evenement({ participations: [moi] }),
      maintenantMs: MAINTENANT,
      utilisateur: moi,
    })).toEqual({ reponse: 'present' });
    expect(presenceDansLeFil({
      evenement: evenement({ missings: [moi] }),
      maintenantMs: MAINTENANT,
      utilisateur: moi,
    })).toEqual({ reponse: 'absent' });
  });

  test('E3 — pas membre d une equipe conviee : pas de selecteur (il demande sa place sur la fiche)', () => {
    expect(presenceDansLeFil({
      evenement: evenement({ team: { documentId: 'eq-2', players: [lui] } }),
      maintenantMs: MAINTENANT,
      utilisateur: moi,
    })).toBeNull();
  });

  test('E4 — reponses fermees par l organisateur, evenement passe ou annule : pas de selecteur', () => {
    const cas = [
      evenement({ rsvpEnabled: false }),
      evenement({ date: HIER }),
      evenement({ isActive: false }),
    ];
    cas.forEach((ev) => {
      expect(presenceDansLeFil({ evenement: ev, maintenantMs: MAINTENANT, utilisateur: moi }))
        .toBeNull();
    });
  });

  test('E5 — sans evenement ou sans compte : rien', () => {
    expect(presenceDansLeFil({ evenement: null, utilisateur: moi })).toBeNull();
    expect(presenceDansLeFil({ evenement: evenement(), utilisateur: null })).toBeNull();
  });
});

describe('resumeDesParticipants — la ligne « Participants »', () => {
  test('P1 — presents, absents, sans reponse : joueurs seulement, l encadrant n est pas compte', () => {
    const resume = resumeDesParticipants(evenement({
      missings: [elle],
      participations: [lui, coach],
    }));
    expect(resume).toEqual({
      absents: 1,
      presents: 1,
      sansReponse: 1,
      visages: [lui],
    });
  });

  test('P2 — identites masquees : les nombres restent, aucun visage', () => {
    const masque = () => ({ firstname: 'Membre' });
    const resume = resumeDesParticipants(evenement({
      missings: [masque()],
      participations: [masque(), masque()],
      team: { documentId: 'eq-1', players: [masque(), masque(), masque(), masque()] },
    }));
    expect(resume).toEqual({
      absents: 1,
      presents: 2,
      sansReponse: 1,
      visages: [],
    });
  });

  test('P3 — rien a compter : pas de ligne', () => {
    expect(resumeDesParticipants(evenement({ team: null }))).toBeNull();
    expect(resumeDesParticipants(null)).toBeNull();
  });
});

describe('lieuAOuvrir — l adresse que la feuille ouvre', () => {
  test('L1 — l adresse complete et ses coordonnees quand l evenement les porte', () => {
    expect(lieuAOuvrir({
      locationDetails: JSON.stringify({ label: '12 rue Pasteur, 83000 Toulon', lat: 43.12, lng: 5.93 }),
    }, 'Toulon')).toEqual({ label: '12 rue Pasteur, 83000 Toulon', latitude: 43.12, longitude: 5.93 });
  });

  test('L2 — sinon, ce que la bulle affiche', () => {
    expect(lieuAOuvrir({ locationDetails: 'Stade Leo Lagrange' }, 'Stade Leo Lagrange'))
      .toEqual({ label: 'Stade Leo Lagrange', latitude: undefined, longitude: undefined });
  });
});
