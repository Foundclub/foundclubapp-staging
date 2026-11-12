/* eslint-disable max-len */
import {
  apercuDuJoueur,
  corpsDuProgramme,
  libelleDuBonus,
  reglerSurPlaceAvecRemise,
} from '@/domains/complexe/fideliteDuComplexe';

// FIDELITE (12/11/2026, D63, maquette validée « 237- ok ») — trois types de récompense : « partie »
// (n parties offertes, la part du joueur ou le terrain entier), « remise » (X % sur n parties),
// « libre » (le texte remis sur place, comme avant). Le serveur calcule et FIGE la remise ; l'app
// l'affiche : prix barré, puis prix remisé.

const { t } = jest.requireActual('@/theme/strings/__mocks__/doublureTraduction');

describe('FIDELITE — les règles pures', () => {
  it('le corps d’« Enregistrer » : partie et remise sans texte, avec nombre et part ; libre comme avant', () => {
    expect(corpsDuProgramme({
      active: true,
      counts: 'reserveur',
      percent: 30,
      reward: 'ignoré',
      rewardType: 'partie',
      rewardUses: 2,
      scope: 'terrain',
      threshold: 10,
    })).toEqual({
      active: true, counts: 'reserveur', rewardType: 'partie', rewardUses: 2, scope: 'terrain', threshold: 10,
    });
    expect(corpsDuProgramme({
      active: true, counts: 'participants', percent: 250, rewardType: 'remise', rewardUses: 40, threshold: 5,
    })).toEqual({
      active: true,
      counts: 'participants',
      percent: 100,
      rewardType: 'remise',
      rewardUses: 10,
      scope: 'joueur',
      threshold: 5,
    });
    expect(corpsDuProgramme({
      active: true, counts: 'reserveur', reward: '1 pizza', rewardType: 'libre', threshold: 10,
    })).toEqual({
      active: true, counts: 'reserveur', reward: '1 pizza', rewardType: 'libre', threshold: 10,
    });
  });

  it('« Ce que voit le joueur » : « Encore 2 réservations avant ta partie offerte » / « avant 20 % de réduction »', () => {
    expect(apercuDuJoueur(t, { rewardType: 'partie', threshold: 10 }))
      .toEqual({ compte: 8, seuil: 10, texte: 'Encore 2 réservations avant ta partie offerte' });
    expect(apercuDuJoueur(t, { percent: 20, rewardType: 'remise', threshold: 5 }).texte)
      .toBe('Encore 2 réservations avant 20 % de réduction');
  });

  it('le libellé d’un bonus : le type et la part', () => {
    expect(libelleDuBonus(t, { rewardType: 'partie', scope: 'joueur' })).toBe('Partie offerte (ta part)');
    expect(libelleDuBonus(t, { rewardType: 'partie', scope: 'terrain' })).toBe('Partie offerte (le terrain entier)');
    expect(libelleDuBonus(t, { percent: 20, rewardType: 'remise', scope: 'joueur' })).toBe('Réduction de 20 % (ta part)');
    expect(libelleDuBonus(t, null)).toBe('');
  });

  it('« À régler sur place » avec la remise : le terrain, les options pleines, la ligne « − », le total barré puis remisé', () => {
    const bloc = reglerSurPlaceAvecRemise(t, { amount: 150, unit: 'creneau' }, 10, [
      {
        id: 'ballon', name: 'Ballon', price: 5, quantity: 1,
      },
    ], { amount: 15, rewardType: 'partie', scope: 'joueur' });
    // formatEuros pose une espace insécable avant « € » : le témoin lit des espaces simples.
    const net = (/** @type {string} */ texte) => texte.replace(/\s/g, ' ');
    expect(bloc.lignes.map((ligne) => [ligne.cle, ligne.libelle, net(ligne.montant)])).toEqual([
      ['terrain', 'Terrain · 10 joueurs', '150 €'],
      ['ballon', 'Ballon × 1', '5 €'],
      ['fidelite', 'Partie offerte (ta part)', '− 15 €'],
    ]);
    expect([net(bloc.avant), net(bloc.total)]).toEqual(['155 €', '140 €']);
    expect(reglerSurPlaceAvecRemise(t, { amount: 150, unit: 'creneau' }, 10, [], null)).toBeNull();
  });
});
