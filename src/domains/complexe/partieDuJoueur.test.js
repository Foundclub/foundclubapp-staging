import { reactI18next } from '@/theme/strings/__mocks__/doublureTraduction';

import {
  apercuDeLaFidelite,
  echeancesDeCollecte,
  jourEtHeure,
  messageDInvitation,
  participantsDeLOnglet,
  peutChercherDesJoueurs,
  texteEcheance,
} from './partieDuJoueur';

// RESA-L6B-2 (20/10/2026) — les règles PURES du joueur à plusieurs (serveur RESA-L3) et de sa
// communauté (serveur RESA-L4) : plan E-P04, E-P05, E-P07, E-P09, E-P10 ; planches EP04 (état 3),
// EP07 (états 1-4), EP09, EP13 (variantes 1, 2, 7).

const { t } = reactI18next.useTranslation();

describe('les dates de la collecte (RG-QUORUM, Q3)', () => {
  it('« lundi 18 h » : le jour de la semaine et l’heure de PARIS', () => {
    expect(jourEtHeure(t, '2026-10-12T16:00:00.000Z')).toBe('lundi 18 h');
    expect(jourEtHeure(t, '2026-10-13T16:30:00.000Z')).toBe('mardi 18 h 30');
    expect(jourEtHeure(t, null)).toBe('');
  });

  it('« Lundi 12/10, 18 h » : l’échéance lisible', () => {
    expect(texteEcheance(t, '2026-10-12T16:00:00.000Z')).toBe('Lundi 12/10, 18 h');
    expect(texteEcheance(t, 'pas une date')).toBe('');
  });

  it('les échéances proposées : la plus tardive permise, puis 1 et 2 jours avant, à venir', () => {
    const plusTard = '2026-10-15T16:00:00.000Z';
    expect(echeancesDeCollecte(plusTard, new Date('2026-10-12T08:00:00.000Z'))).toEqual([
      '2026-10-15T16:00:00.000Z',
      '2026-10-14T16:00:00.000Z',
      '2026-10-13T16:00:00.000Z',
    ]);
    // Moins d'une heure devant soi : l'échéance n'est pas proposée.
    expect(echeancesDeCollecte(plusTard, new Date('2026-10-14T15:30:00.000Z'))).toEqual([
      '2026-10-15T16:00:00.000Z',
    ]);
    expect(echeancesDeCollecte(plusTard, new Date('2026-10-15T15:30:00.000Z'))).toEqual([]);
    expect(echeancesDeCollecte(null)).toEqual([]);
  });
});

describe('les participants (E-P07 bloc 3)', () => {
  const participants = [
    {
      isBooker: true, isMe: true, label: 'Julien M.', response: 'present', via: 'reserveur',
    },
    {
      isBooker: false, isMe: false, label: 'Karim B.', response: 'present', via: 'lien',
    },
    {
      isBooker: false, isMe: false, label: 'Théo L.', response: 'absent', via: 'lien',
    },
    {
      isBooker: false, isMe: false, label: 'Noah R.', response: 'sans_reponse', via: 'equipe',
    },
  ];

  it('Tous · Présents · Absents · Sans réponse', () => {
    expect(participantsDeLOnglet(participants, 'tous')).toHaveLength(4);
    expect(participantsDeLOnglet(participants, 'presents').map((p) => p.label))
      .toEqual(['Julien M.', 'Karim B.']);
    expect(participantsDeLOnglet(participants, 'absents').map((p) => p.label)).toEqual(['Théo L.']);
    expect(participantsDeLOnglet(participants, 'sansReponse').map((p) => p.label))
      .toEqual(['Noah R.']);
    expect(participantsDeLOnglet(null, 'tous')).toEqual([]);
  });
});

describe('« Il me manque des joueurs » (E-P07 bloc 4, A-P09)', () => {
  const maintenant = new Date('2026-10-12T08:00:00.000Z');
  const groupe = {
    counts: { absents: 0, presents: 8, sansReponse: 0 },
    places: 10,
    role: 'reserveur',
    status: 'confirmee',
  };
  const reservation = { startsAt: '2026-10-14T16:00:00.000Z' };

  it('le réserveur, s’il manque du monde et que le créneau est à venir', () => {
    expect(peutChercherDesJoueurs(groupe, reservation, maintenant)).toBe(true);
    expect(peutChercherDesJoueurs({ ...groupe, status: 'en_collecte' }, reservation, maintenant))
      .toBe(true);
  });

  it('jamais un participant, une partie complète, passée ou finie', () => {
    expect(peutChercherDesJoueurs({ ...groupe, role: 'participant' }, reservation, maintenant))
      .toBe(false);
    expect(peutChercherDesJoueurs(
      { ...groupe, counts: { ...groupe.counts, presents: 10 } },
      reservation,
      maintenant,
    )).toBe(false);
    expect(peutChercherDesJoueurs(groupe, { startsAt: '2026-10-11T16:00:00.000Z' }, maintenant))
      .toBe(false);
    expect(peutChercherDesJoueurs({ ...groupe, status: 'annulee' }, reservation, maintenant))
      .toBe(false);
    expect(peutChercherDesJoueurs(null, reservation, maintenant)).toBe(false);
  });
});

describe('le message du lien (E-P07 état 4, RG-LIEN)', () => {
  it('le sport, le jour, l’heure, le complexe, puis le lien', () => {
    expect(messageDInvitation(t, {
      complexe: 'Le Five de Montrivage',
      date: '2026-10-14',
      from: '18:00',
      sport: 'Football à 5',
      url: 'https://foundclub.app/r/K7Q2M9',
    })).toBe('Football à 5, mercredi 14/10 à 18 h, Le Five de Montrivage. Réponds ici : '
      + 'https://foundclub.app/r/K7Q2M9');
    expect(messageDInvitation(t, {
      complexe: 'Le Five',
      date: '2026-10-14',
      from: '18:00',
      sport: '',
      url: 'https://foundclub.app/r/X',
    })).toBe('Mercredi 14/10 à 18 h, Le Five. Réponds ici : https://foundclub.app/r/X');
  });
});

describe('la fidélité vue par le joueur (RG-FIDELITE, RC-G10)', () => {
  it('n sur x et ce qui reste, avec la récompense du complexe', () => {
    expect(apercuDeLaFidelite(t, {
      count: 8, disponible: false, restant: 2, reward: '1 partie offerte', threshold: 10,
    })).toEqual({
      compte: 8,
      disponible: false,
      seuil: 10,
      texte: 'Encore 2 réservations avant « 1 partie offerte »',
    });
    expect(apercuDeLaFidelite(t, {
      count: 9, disponible: false, restant: 1, reward: null, threshold: 10,
    }).texte).toBe('Encore 1 réservation avant ta récompense');
  });

  it('arrivé au bout : la récompense se valide sur place', () => {
    expect(apercuDeLaFidelite(t, {
      count: 10, disponible: true, restant: 0, reward: '1 partie offerte', threshold: 10,
    }).texte).toBe('« 1 partie offerte » t’attend : présente-toi à l’accueil.');
    expect(apercuDeLaFidelite(t, null)).toBeNull();
  });
});
