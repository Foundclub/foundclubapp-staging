/* eslint-disable max-len */
import { apercuDeLaFidelite } from '@/domains/complexe/partieDuJoueur';

// FIDELITE (12/11/2026, D63, maquette « 237- ok ») — ce que voit le JOUEUR (page du complexe,
// Ma réservation, « Ma fidélité ») avec un programme automatique : le compteur et « Encore 2
// réservations avant ta partie offerte » ; un bonus débloqué : « Bonus débloqué : … », et le
// prochain bonus repart de 0. Un programme « libre » : le texte d'avant (témoins RESA-L6B).

const { t } = jest.requireActual('@/theme/strings/__mocks__/doublureTraduction');

describe('FIDELITE — apercuDeLaFidelite', () => {
  it('partie offerte, 8 sur 10 : « Encore 2 réservations avant ta partie offerte »', () => {
    expect(apercuDeLaFidelite(t, {
      bonus: [], count: 8, disponible: false, restant: 2, reward: '1 partie offerte', rewardType: 'partie', scope: 'joueur', threshold: 10,
    })).toEqual({
      compte: 8, disponible: false, seuil: 10, texte: 'Encore 2 réservations avant ta partie offerte',
    });
  });

  it('remise 20 % : « Encore 1 réservation avant 20 % de réduction »', () => {
    expect(apercuDeLaFidelite(t, {
      bonus: [], count: 4, percent: 20, restant: 1, rewardType: 'remise', threshold: 5,
    }).texte).toBe('Encore 1 réservation avant 20 % de réduction');
  });

  it('un bonus débloqué : « Bonus débloqué », où l’utiliser, et le prochain bonus à 0 sur 10', () => {
    expect(apercuDeLaFidelite(t, {
      bonus: [{
        percent: null, restant: 1, rewardType: 'partie', scope: 'joueur',
      }],
      count: 0,
      disponible: true,
      restant: 10,
      rewardType: 'partie',
      threshold: 10,
    })).toEqual({
      compte: 0,
      disponible: true,
      seuil: 10,
      texte: 'Bonus débloqué : Partie offerte (ta part). Tu l’utilises au récapitulatif de ta prochaine réservation. Prochain bonus : 0 sur 10.',
    });
  });

  it('un programme « libre » : le texte d’avant', () => {
    expect(apercuDeLaFidelite(t, {
      count: 8, disponible: false, restant: 2, reward: '1 pizza', threshold: 10,
    }).texte).toBe('Encore 2 réservations avant « 1 pizza »');
  });
});
