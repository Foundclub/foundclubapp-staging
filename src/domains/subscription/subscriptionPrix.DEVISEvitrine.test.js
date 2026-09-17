import {
  formatSubscriptionMonthlyEquivalentLabel,
  formatSubscriptionPriceLabel,
  resolveSubscriptionCatalogPrices,
} from './subscriptionBilling';
import { mapRevenueCatStorePricesInCents } from './subscriptionRevenueCat';

// DEVISE — « 229,99 USD/an » SUR L ECRAN, DES EUROS DANS LA FENETRE D APPLE.
//
// ☠️ LE DEFAUT, VU LE 2026-09-16 (iPhone d Adel, TestFlight 2.6.46, compte Apple
// en France) : l ecran « Changer d offre » ecrivait « 229,99 USD/an ». Depuis
// INTL1 (26d06bbb, 2.6.44), l app croit la devise que rend StoreKit. Or en
// TestFlight / bac a sable, StoreKit rend des prix en DOLLARS quel que soit le
// pays du compte (limite connue d Apple, confirmee par RevenueCat), pendant que
// la fenetre de paiement, elle, facture dans la devise du compte.
//
// 🎯 LES REGLES FIGEES ICI :
//   1. vitrine d un pays de la zone euro + prix dans une autre devise ⇒ ces prix
//      sont faux pour cet ecran : on les ecarte, le catalogue serveur (en euros)
//      s affiche — exactement l ecran d avant la 2.6.44 ;
//   2. plusieurs devises dans le meme magasin ⇒ aucune ne decide pour les
//      autres : tous les prix du magasin sont ecartes, aucune carte ne perd son
//      prix ;
//   3. Suisse, Emirats, et vitrine inconnue : la devise du magasin est gardee
//      (INTL1 intact).

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const mockWarn = jest.fn();
jest.mock('@/utils/logger/logger', () => ({
  createLogger: () => ({ error: jest.fn(), info: jest.fn(), warn: (...args) => mockWarn(...args) }),
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
 * @param {string | null} vitrine - `Purchases.getStorefront().countryCode`
 * @returns {{ annuel: string, soit: string, mensuel: string }}
 */
const carteClub = (storeOfferings, vitrine) => {
  const releve = mapRevenueCatStorePricesInCents(storeOfferings, CATALOGUE, vitrine);
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

beforeEach(() => {
  mockWarn.mockClear();
});

describe('DEVISE — une vitrine en euros n affiche jamais un prix en dollars', () => {
  it('le cas d Adel : compte Apple en France, StoreKit rend des USD ⇒ les euros du serveur', () => {
    expect(carteClub(offerings(['USD', 22.99], ['USD', 229.99]), 'FRA')).toEqual({
      annuel: '249,99 €/an',
      mensuel: '24,99 €/mois',
      soit: 'soit 20,83 €/mois',
    });
  });

  it('meme cas sur Android (code pays a deux lettres)', () => {
    expect(carteClub(offerings(['USD', 22.99], ['USD', 229.99]), 'FR')).toEqual({
      annuel: '249,99 €/an',
      mensuel: '24,99 €/mois',
      soit: 'soit 20,83 €/mois',
    });
  });

  it('l ecart est journalise, sans donnee personnelle', () => {
    mapRevenueCatStorePricesInCents(offerings(['USD', 22.99], ['USD', 229.99]), CATALOGUE, 'FRA');
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn.mock.calls[0][1])
      .toEqual({ currencyCode: 'USD', storefrontCountryCode: 'FRA' });
  });

  it('France en euros : les prix du magasin s affichent, comme avant', () => {
    expect(carteClub(offerings(['EUR', 23.99], ['EUR', 239.99]), 'FRA')).toEqual({
      annuel: '239,99 €/an',
      mensuel: '23,99 €/mois',
      soit: 'soit 20,00 €/mois',
    });
    expect(mockWarn).not.toHaveBeenCalled();
  });
});

describe('DEVISE — INTL1 intact hors zone euro', () => {
  it('Suisse : CHF garde', () => {
    expect(carteClub(offerings(['CHF', 24], ['CHF', 239]), 'CHE').annuel).toBe('239,00 CHF/an');
  });

  it('Emirats : AED garde', () => {
    expect(carteClub(offerings(['AED', 99.99], ['AED', 999.99]), 'ARE').annuel)
      .toBe('999,99 AED/an');
  });

  it('vitrine inconnue : la devise du magasin est crue', () => {
    expect(carteClub(offerings(['USD', 22.99], ['USD', 229.99]), null).annuel)
      .toBe('229,99 USD/an');
  });
});

describe('DEVISE — deux devises dans le meme magasin : aucune ne decide pour l autre', () => {
  it('USD en tete, EUR ensuite : aucune carte sans prix, aucun dollar', () => {
    expect(carteClub(offerings(['USD', 22.99], ['EUR', 239.99]), null)).toEqual({
      annuel: '249,99 €/an',
      mensuel: '24,99 €/mois',
      soit: 'soit 20,83 €/mois',
    });
  });

  it('EUR en tete, USD ensuite : meme resultat, l ordre ne compte pas', () => {
    expect(carteClub(offerings(['EUR', 23.99], ['USD', 229.99]), null)).toEqual({
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
