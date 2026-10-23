import {
  gestesPossibles,
  heureCourte,
  jourCourt,
  lignesDuJournal,
  motifValide,
  nomCourt,
  pastillesDuComplexe,
} from '@/domains/complexe/consoleDesComplexes';

// RESA-L5B-2 (20/10/2026) — E-S01, LA CONSOLE DES COMPLEXES (serveur RESA-L4, routes
// /superadmin/complexes) : ce que la liste et la fiche calculent sans le serveur.

describe('E-S01 — la console des complexes, sans le serveur', () => {
  it('le motif : 3 caractères au moins, 300 au plus, espaces resserrés', () => {
    expect(motifValide('  ab ')).toBe(false);
    expect(motifValide('abc')).toBe(true);
    expect(motifValide('a'.repeat(300))).toBe(true);
    expect(motifValide('a'.repeat(301))).toBe(false);
    expect(motifValide(undefined)).toBe(false);
  });

  it('les pastilles d’une ligne : signalements, suspendu, retiré, nouveau', () => {
    expect(pastillesDuComplexe({ nouveau: true, signalementsATraiter: 2, status: 'actif' }))
      .toEqual([{ cle: 'signalements', nombre: 2 }, { cle: 'nouveau' }]);
    expect(pastillesDuComplexe({ nouveau: false, signalementsATraiter: 0, status: 'suspendu' }))
      .toEqual([{ cle: 'suspendu' }]);
    expect(pastillesDuComplexe({ nouveau: true, signalementsATraiter: 0, status: 'retire' }))
      .toEqual([{ cle: 'retire' }]);
  });

  it('les gestes permis par l’état du complexe', () => {
    expect(gestesPossibles({ status: 'actif', verified: false })).toEqual({
      reactiver: false, retirer: true, suspendre: true, verifier: true,
    });
    expect(gestesPossibles({ status: 'suspendu', verified: true })).toEqual({
      reactiver: true, retirer: true, suspendre: false, verifier: true,
    });
    expect(gestesPossibles({ status: 'retire', verified: true })).toEqual({
      reactiver: false, retirer: false, suspendre: false, verifier: false,
    });
  });

  it('un nom court : prénom et initiale, jamais un numéro', () => {
    expect(nomCourt({ firstname: 'Sofia', lastname: 'Leroy' })).toBe('Sofia L.');
    expect(nomCourt({ firstname: 'Sofia', lastname: null })).toBe('Sofia');
    expect(nomCourt(null)).toBe('');
  });

  it('le journal : les gestes du plus récent au plus ancien, puis la création', () => {
    const lignes = lignesDuJournal({
      complexe: { createdAt: '2026-10-13T08:00:00.000Z' },
      journal: [
        {
          action: 'SUPERADMIN_COMPLEXE_SUSPENDED',
          reason: 'vérification',
          timestamp: '2026-10-14T09:00:00.000Z',
        },
        { action: 'SUPERADMIN_INCONNU', reason: null, timestamp: '2026-10-14T08:00:00.000Z' },
      ],
    });
    expect(lignes).toEqual([
      {
        auteur: null, cle: 'suspendu', motif: 'vérification', quand: '2026-10-14T09:00:00.000Z',
      },
      {
        auteur: null, cle: 'cree', motif: null, quand: '2026-10-13T08:00:00.000Z',
      },
    ]);
  });

  it('le jour et l’heure de Paris : « 13/10 », « 21 h 10 » ; rien sans date', () => {
    expect(jourCourt('2026-10-13T19:10:00.000Z')).toBe('13/10');
    expect(heureCourte('2026-10-13T19:10:00.000Z')).toBe('21 h 10');
    expect(jourCourt(null)).toBe('');
    expect(heureCourte('pas une date')).toBe('');
  });
});
