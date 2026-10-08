import { ligneDeRendezVous, lireRendezVous } from '../playerConvocationUtils';

// CONVOC-RDV — CE QUE LES ECRANS LISENT DU RENDEZ-VOUS (carte du fil, « Tu es convoque »).
//
// Le serveur range `rendezVous: { time, place }` dans la convocation publiee. Une carte postee
// AVANT n'en a pas, et une valeur abimee ne doit jamais s'imprimer : on lit, on ne devine pas.

describe('CRDV — lireRendezVous', () => {
  test('l heure et le lieu', () => {
    expect(lireRendezVous({ place: 'Au club', time: '13:30' }))
      .toEqual({ place: 'Au club', time: '13:30' });
  });

  test('un seul des deux suffit', () => {
    expect(lireRendezVous({ place: null, time: '09:05' })).toEqual({ place: '', time: '09:05' });
    expect(lireRendezVous({ place: 'Parking', time: null }))
      .toEqual({ place: 'Parking', time: '' });
  });

  test('absent, vide ou abime : rien', () => {
    expect(lireRendezVous(undefined)).toBeNull();
    expect(lireRendezVous(null)).toBeNull();
    expect(lireRendezVous('13:30 au club')).toBeNull();
    expect(lireRendezVous({ place: '  ', time: '' })).toBeNull();
    expect(lireRendezVous({ place: { objet: 1 }, time: '99:99' })).toBeNull();
  });
});

describe('CRDV — ligneDeRendezVous', () => {
  test('« 13:30 · Au club », ou ce qui existe', () => {
    expect(ligneDeRendezVous({ place: 'Au club', time: '13:30' })).toBe('13:30 · Au club');
    expect(ligneDeRendezVous({ place: '', time: '13:30' })).toBe('13:30');
    expect(ligneDeRendezVous({ place: 'Parking', time: '' })).toBe('Parking');
    expect(ligneDeRendezVous(null)).toBe('');
  });
});
