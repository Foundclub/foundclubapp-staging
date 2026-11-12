/* eslint-disable max-len */
/**
 * RESA-OPTIONS (12/11/2026) — le domaine des options d'un terrain (D61, maquette section 4 bis) :
 * la saisie du gérant, le catalogue, les compteurs du joueur, le total « à régler sur place ».
 */
import {
  catalogueAvec,
  catalogueSans,
  choixDesOptions,
  erreursDOption,
  lignesAReglerSurPlace,
  maxDeLOption,
  minDeLOption,
  montantDuTerrain,
  quantitesInitiales,
  texteDUneOption,
} from '@/domains/complexe/optionsTerrain';

const t = (_cle, repli, vars = {}) => String(repli).replace(/{{(\w+)}}/g, (_, nom) => String(vars[nom] ?? ''));
const CHASUBLES = {
  id: 'a1', name: 'Location de chasubles', price: 5, required: false, unit: 'reservation',
};
const BALLON = {
  id: 'b2', name: 'Ballon de match', price: 3, required: false, unit: 'unite',
};
const ARBITRE = {
  id: 'c3', name: 'Arbitre', price: 20, required: true, unit: 'reservation',
};
const NBSP = ' ';

describe('RESA-OPTIONS — domaine', () => {
  it('dit le prix d’une option : « 5 € par réservation », « 3 € par unité », obligatoire', () => {
    expect(texteDUneOption(t, CHASUBLES)).toBe(`5${NBSP}€ par réservation`);
    expect(texteDUneOption(t, BALLON)).toBe(`3${NBSP}€ par unité`);
    expect(texteDUneOption(t, ARBITRE)).toBe(`20${NBSP}€ par réservation · obligatoire`);
  });

  it('juge la saisie du gérant : un nom de 2 à 60 signes, un prix de 0 à 999 €', () => {
    expect(erreursDOption({ nom: 'Chasubles', prix: '5' })).toEqual({});
    expect(erreursDOption({ nom: 'C', prix: '5' })).toEqual({ nom: true });
    expect(erreursDOption({ nom: 'Chasubles', prix: '' })).toEqual({ prix: true });
    expect(erreursDOption({ nom: 'Chasubles', prix: '1000' })).toEqual({ prix: true });
    expect(erreursDOption({ nom: 'Chasubles', prix: '2,50' })).toEqual({});
  });

  it('ajoute, remplace et retire une option du catalogue (envoyé entier au serveur)', () => {
    const neuve = {
      name: 'Arbitre', price: 20, required: true, unit: 'reservation',
    };
    expect(catalogueAvec([CHASUBLES], neuve)).toEqual([
      {
        id: 'a1', name: 'Location de chasubles', price: 5, required: false, unit: 'reservation',
      },
      neuve,
    ]);
    expect(catalogueAvec([CHASUBLES, BALLON], { ...BALLON, price: 4 })).toEqual([CHASUBLES, { ...BALLON, price: 4 }]);
    expect(catalogueSans([CHASUBLES, BALLON], 'a1')).toEqual([BALLON]);
  });

  it('les compteurs du joueur : 0 à 9 par unité, 0 ou 1 par réservation, une obligatoire part à 1', () => {
    expect([minDeLOption(BALLON), maxDeLOption(BALLON)]).toEqual([0, 9]);
    expect([minDeLOption(CHASUBLES), maxDeLOption(CHASUBLES)]).toEqual([0, 1]);
    expect([minDeLOption(ARBITRE), maxDeLOption(ARBITRE)]).toEqual([1, 1]);
    expect(quantitesInitiales([CHASUBLES, BALLON, ARBITRE])).toEqual({ a1: 0, b2: 0, c3: 1 });
    expect(choixDesOptions([CHASUBLES, BALLON, ARBITRE], { a1: 1, b2: 0, c3: 1 })).toEqual([
      { id: 'a1', quantity: 1 }, { id: 'c3', quantity: 1 },
    ]);
    expect(choixDesOptions([], {})).toEqual([]);
  });

  it('le total à régler sur place : le terrain, une ligne par option choisie, le total (maquette : 150 + 5 + 6 = 161 €)', () => {
    expect(montantDuTerrain({ amount: 15, unit: 'joueur' }, 10)).toBe(150);
    expect(montantDuTerrain({ amount: 60, unit: 'creneau' }, 10)).toBe(60);
    expect(montantDuTerrain(null, 10)).toBeNull();
    const lignes = lignesAReglerSurPlace(t, { amount: 15, unit: 'joueur' }, 10, [
      { ...CHASUBLES, quantity: 1 }, { ...BALLON, quantity: 2 },
    ]);
    expect(lignes).toEqual({
      lignes: [
        { cle: 'terrain', libelle: 'Terrain · 10 joueurs', montant: `150${NBSP}€` },
        { cle: 'a1', libelle: 'Location de chasubles × 1', montant: `5${NBSP}€` },
        { cle: 'b2', libelle: 'Ballon de match × 2', montant: `6${NBSP}€` },
      ],
      options: `11${NBSP}€`,
      total: `161${NBSP}€`,
    });
    // Sans prix du terrain : les options seules, le total reste juste.
    expect(lignesAReglerSurPlace(t, null, 10, [{ ...BALLON, quantity: 2 }]).total).toBe(`6${NBSP}€`);
    // Sans option : rien.
    expect(lignesAReglerSurPlace(t, { amount: 60, unit: 'creneau' }, 10, [])).toBeNull();
  });
});
