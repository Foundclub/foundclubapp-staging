import {
  formatSubscriptionMonthlyEquivalentLabel,
  formatSubscriptionPriceLabel,
  resolveSubscriptionCatalogPrices,
} from './subscriptionBilling';
import { mapRevenueCatStorePricesInCents } from './subscriptionRevenueCat';

// DEVISE — LE RELEVE DES PRIX DU MAGASIN, CARTE CLUB DE BOUT EN BOUT.
//
// La regle TestFlight (StoreKit y rend la vitrine americaine : « 229,99 USD/an »
// sur l iPhone d Adel, 16-17/09) se lit dans subscriptionRevenueCat.test.js,
// bloc « installation de test Apple ».
//
// 🎯 LES REGLES FIGEES ICI :
//   1. plusieurs devises dans le meme magasin ⇒ aucune ne decide pour les
//      autres : tous les prix du magasin sont ecartes, aucune carte ne perd son
//      prix (avant : la premiere devise gagnait, l autre offre restait sans prix) ;
//   2. une seule devise : elle est gardee, euro ou pas (INTL1 intact).

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

jest.mock('@/utils/logger/logger', () => ({
  createLogger: () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }),
}));

const CATALOGUE = [
  {
    billingPeriod: 'monthly',
    planCode: 'fc_club_tier_2_monthly',
    referencePriceEurCents: 2499,
    scopeType: 'CLUB',
    slotCount: 100,
  },
  {
    billingPeriod: 'yearly',
    planCode: 'fc_club_tier_2_yearly',
    referencePriceEurCents: 24999,
    scopeType: 'CLUB',
    slotCount: 100,
  },
];

/**
 * Offerings RevenueCat de la famille `fc_club_tier_2`, une devise par produit.
 * @param {[string, number]} mensuel - [devise, prix]
 * @param {[string, number]} annuel - [devise, prix]
 * @returns {any}
 */
const offerings = ([deviseMensuel, prixMensuel], [deviseAnnuel, prixAnnuel]) => {
  const monthly = {
    product: {
      currencyCode: deviseMensuel,
      identifier: 'fc_club_tier_2_monthly',
      price: prixMensuel,
    },
  };
  const annual = {
    product: { currencyCode: deviseAnnuel, identifier: 'fc_club_tier_2_yearly', price: prixAnnuel },
  };
  return { all: { fc_club_tier_2: { annual, availablePackages: [monthly, annual], monthly } } };
};

/**
 * Ce que la carte Club ecrit, de bout en bout : releve du magasin → catalogue
 * resolu → libelles de l ecran « Changer d offre ».
 * @param {any} storeOfferings
 * @returns {{ annuel: string, soit: string, mensuel: string }}
 */
const carteClub = (storeOfferings) => {
  const releve = mapRevenueCatStorePricesInCents(storeOfferings, CATALOGUE);
  const { entries } = resolveSubscriptionCatalogPrices({
    serverEntries: CATALOGUE,
    storeCurrencyCode: releve.currencyCode,
    storePricesEurCents: releve.pricesInCents,
  });
  const annuel = entries.find((entry) => entry.billingPeriod === 'yearly');
  const mensuel = entries.find((entry) => entry.billingPeriod === 'monthly');
  /**
   * Libelle d une ligne, dans sa devise.
   * @param {any} entry
   * @param {string} period
   * @returns {string}
   */
  const libelle = (entry, period) => formatSubscriptionPriceLabel(
    entry.referencePriceEurCents,
    period,
    entry.priceCurrencyCode,
  );
  return {
    annuel: libelle(annuel, 'yearly'),
    mensuel: libelle(mensuel, 'monthly'),
    soit: formatSubscriptionMonthlyEquivalentLabel(
      annuel.referencePriceEurCents,
      annuel.priceCurrencyCode,
    ),
  };
};

describe('DEVISE — une seule devise : elle est gardee', () => {
  it('France : les prix du magasin s affichent en euros', () => {
    expect(carteClub(offerings(['EUR', 23.99], ['EUR', 239.99]))).toEqual({
      annuel: '239,99 €/an',
      mensuel: '23,99 €/mois',
      soit: 'soit 20,00 €/mois',
    });
  });

  it('Suisse : CHF garde', () => {
    expect(carteClub(offerings(['CHF', 24], ['CHF', 239])).annuel).toBe('239,00 CHF/an');
  });

  it('Emirats : AED garde', () => {
    expect(carteClub(offerings(['AED', 99.99], ['AED', 999.99])).annuel).toBe('999,99 AED/an');
  });
});

describe('DEVISE — deux devises dans le meme magasin : aucune ne decide pour l autre', () => {
  it('USD en tete, EUR ensuite : aucune carte sans prix, aucun dollar', () => {
    expect(carteClub(offerings(['USD', 22.99], ['EUR', 239.99]))).toEqual({
      annuel: '249,99 €/an',
      mensuel: '24,99 €/mois',
      soit: 'soit 20,83 €/mois',
    });
  });

  it('EUR en tete, USD ensuite : meme resultat, l ordre ne compte pas', () => {
    expect(carteClub(offerings(['EUR', 23.99], ['USD', 229.99]))).toEqual({
      annuel: '249,99 €/an',
      mensuel: '24,99 €/mois',
      soit: 'soit 20,83 €/mois',
    });
  });

  it('le releve rend alors une liste vide en euros', () => {
    expect(mapRevenueCatStorePricesInCents(offerings(['AED', 99.99], ['EUR', 239.99]), CATALOGUE))
      .toEqual({ currencyCode: 'EUR', pricesInCents: {} });
  });
});
