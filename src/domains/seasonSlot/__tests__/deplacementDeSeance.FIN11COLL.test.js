/* eslint-disable max-len -- des phrases et des appels entiers, compares tels quels */
import { parametresApercuDuDeplacement } from '../seasonSlotDisplay';

// 🧪 FINITIONS11-COLL (03/10/2026), point 7 — décision d'Adel « deplacer A » : quand un club DÉPLACE
// une séance hors de son créneau, la mairie décide, et si elle REFUSE la séance est ANNULÉE. Le club
// doit le lire AVANT d'enregistrer. Pour le savoir, l'écran pose au serveur la question de l'aperçu
// (COLL-FIX2, `GET /facilities/:id/season-slots/preview` au nom du club : `decision.outcome`).
// Cette règle dit QUAND poser la question, et avec quoi : seulement si la séance a bougé (jour,
// heures, installation), comme le juge du serveur (COLL-C2B-BIS, `isSessionMoved`). ROUGE avant.

const SEANCE = {
  club: { documentId: 'club-A' },
  date: new Date(2030, 4, 15, 18, 30),
  documentId: 'ev-1',
  endTime: '20:00:00.000',
  facility: { documentId: 'gym' },
  startTime: '18:30:00.000',
  team: { documentId: 'u15' },
};
const PAREIL = {
  debut: '18:30', facilityId: 'gym', fin: '20:00', jour: '2030-05-15',
};

describe('FINITIONS11-COLL (7) — la question posée au serveur pour une séance déplacée', () => {
  it('rien n a bougé : aucune question (le serveur ne rejuge pas)', () => {
    expect(parametresApercuDuDeplacement(SEANCE, PAREIL)).toBeNull();
  });

  it('un autre jour : au nom du club et de l équipe, ce jour-là seulement', () => {
    expect(parametresApercuDuDeplacement(SEANCE, { ...PAREIL, jour: '2030-05-16' })).toEqual({
      club: 'club-A',
      endTime: '20:00',
      startTime: '18:30',
      team: 'u15',
      validFrom: '2030-05-16',
      validUntil: '2030-05-16',
      weekday: 4,
    });
  });

  it('une autre heure, ou une autre installation : aussi', () => {
    expect(parametresApercuDuDeplacement(SEANCE, { ...PAREIL, debut: '19:00', fin: '20:30' }))
      .toMatchObject({ endTime: '20:30', startTime: '19:00', weekday: 3 });
    expect(parametresApercuDuDeplacement(SEANCE, { ...PAREIL, facilityId: 'dojo' }))
      .toMatchObject({ club: 'club-A', validFrom: '2030-05-15' });
  });

  it('le club et l équipe de la saisie gagnent ; sans club, sans installation ou heure illisible : rien', () => {
    expect(parametresApercuDuDeplacement(SEANCE, {
      ...PAREIL, club: 'club-B', jour: '2030-05-22', team: 'u13',
    })).toMatchObject({ club: 'club-B', team: 'u13' });
    expect(parametresApercuDuDeplacement({ ...SEANCE, club: null }, { ...PAREIL, jour: '2030-05-16' })).toBeNull();
    expect(parametresApercuDuDeplacement(SEANCE, { ...PAREIL, facilityId: '', jour: '2030-05-16' })).toBeNull();
    expect(parametresApercuDuDeplacement(SEANCE, { ...PAREIL, debut: '19h', jour: '2030-05-16' })).toBeNull();
    expect(parametresApercuDuDeplacement(null, PAREIL)).toBeNull();
  });
});
