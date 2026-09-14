import {
  formatSubscriptionMonthlyEquivalentLabel,
  formatSubscriptionPriceLabel,
  getSubscriptionCatalogEntryMeta,
  resolveSubscriptionCatalogPrices,
} from './subscriptionBilling';
import { mapRevenueCatStorePricesInCents } from './subscriptionRevenueCat';

// INTL1 — EN SUISSE ET AUX EMIRATS, LE MAGASIN FACTURE EN CHF / AED.
//
// ☠️ LE DEFAUT, MESURE LE 2026-09-14 : `mapRevenueCatStorePricesInCents`
// ecartait tout prix du magasin qui n etait pas en EUR (« devise non geree »).
// L ecran retombait alors sur le prix SERVEUR, affiche « 59,99 €/an », pendant
// qu Apple ou Google facturait « 99,00 CHF ». Un faux prix, sur un ecran de vente.
//
// 🎯 LA REGLE FIGEE ICI :
//   1. le prix du magasin est affiche DANS SA DEVISE ;
//   2. quand la devise du magasin n est pas l euro, AUCUN prix euro ne
//      s affiche — un palier absent du magasin perd son prix au lieu de garder
//      celui du serveur ;
//   3. en euros, rien ne change (les 178 temoins des surfaces de vente le figent).

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

jest.mock('@/utils/logger/logger', () => ({
  createLogger: () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }),
}));

const CATALOGUE = [
  {
    billingPeriod: 'monthly',
    planCode: 'fc_team_1_monthly',
    referencePriceEurCents: 799,
    scopeType: 'TEAM',
    slotCount: 1,
  },
  {
    billingPeriod: 'yearly',
    planCode: 'fc_team_1_yearly',
    referencePriceEurCents: 5999,
    scopeType: 'TEAM',
    slotCount: 1,
  },
];

/**
 * Ce que l ecran lit d une ligne : code, centimes, devise.
 * @param {any} entry
 * @returns {any[]}
 */
const lecture = (entry) => [entry.planCode, entry.referencePriceEurCents, entry.priceCurrencyCode];

/**
 * Offerings RevenueCat de la famille `fc_team_1` dans une devise donnee.
 * @param {string} currencyCode
 * @param {number} mensuel
 * @param {number} annuel
 * @returns {any}
 */
const offeringsEn = (currencyCode, mensuel, annuel) => {
  const monthly = { product: { currencyCode, identifier: 'fc_team_1:monthly', price: mensuel } };
  const annual = { product: { currencyCode, identifier: 'fc_team_1_yearly', price: annuel } };
  return { all: { fc_team_1: { annual, availablePackages: [monthly, annual], monthly } } };
};

describe('INTL1 — le releve des prix du magasin garde leur devise', () => {
  it('Suisse : les prix en CHF sont RELEVES, avec leur devise', () => {
    expect(mapRevenueCatStorePricesInCents(offeringsEn('CHF', 7.9, 59), CATALOGUE)).toEqual({
      currencyCode: 'CHF',
      pricesInCents: { fc_team_1_monthly: 790, fc_team_1_yearly: 5900 },
    });
  });

  it('France / Belgique : euros, memes centimes qu avant', () => {
    expect(mapRevenueCatStorePricesInCents(offeringsEn('EUR', 7.99, 59.99), CATALOGUE)).toEqual({
      currencyCode: 'EUR',
      pricesInCents: { fc_team_1_monthly: 799, fc_team_1_yearly: 5999 },
    });
  });

  it('deux devises dans le meme magasin (incoherent) : seule la premiere est gardee', () => {
    const offerings = offeringsEn('AED', 29.99, 219.99);
    offerings.all.fc_team_1.annual.product.currencyCode = 'EUR';
    expect(mapRevenueCatStorePricesInCents(offerings, CATALOGUE)).toEqual({
      currencyCode: 'AED',
      pricesInCents: { fc_team_1_monthly: 2999 },
    });
  });
});

describe('INTL1 — la resolution du catalogue n affiche jamais un euro en CHF', () => {
  it('magasin en CHF qui couvre tout : prix du magasin + devise sur chaque ligne', () => {
    const { entries, mismatches, missingFromStorePlanCodes } = resolveSubscriptionCatalogPrices({
      serverEntries: CATALOGUE,
      storeCurrencyCode: 'CHF',
      storePricesEurCents: { fc_team_1_monthly: 790, fc_team_1_yearly: 5900 },
    });

    expect(entries.map(lecture)).toEqual([
      ['fc_team_1_monthly', 790, 'CHF'],
      ['fc_team_1_yearly', 5900, 'CHF'],
    ]);
    // Comparer des CHF a des euros n a pas de sens : aucun « ecart » invente.
    expect(mismatches).toEqual([]);
    expect(missingFromStorePlanCodes).toEqual([]);
  });

  it('magasin en AED sans l annuel : l annuel PERD son prix euro au lieu de le garder', () => {
    const { entries, missingFromStorePlanCodes } = resolveSubscriptionCatalogPrices({
      serverEntries: CATALOGUE,
      storeCurrencyCode: 'AED',
      storePricesEurCents: { fc_team_1_monthly: 2999 },
    });

    const annuel = entries.find((entry) => entry.planCode === 'fc_team_1_yearly');
    expect(annuel.referencePriceEurCents).toBeUndefined();
    expect(annuel.priceCurrencyCode).toBe('AED');
    expect(formatSubscriptionPriceLabel(
      annuel.referencePriceEurCents,
      'yearly',
      annuel.priceCurrencyCode,
    )).toBe('');
    expect(missingFromStorePlanCodes).toEqual(['fc_team_1_yearly']);

    const mensuel = entries.find((entry) => entry.planCode === 'fc_team_1_monthly');
    expect([mensuel.referencePriceEurCents, mensuel.priceCurrencyCode]).toEqual([2999, 'AED']);
  });

  it('magasin en EUR : exactement le comportement d avant (aucune devise posee)', () => {
    const avant = resolveSubscriptionCatalogPrices({
      serverEntries: CATALOGUE,
      storePricesEurCents: { fc_team_1_monthly: 799, fc_team_1_yearly: 5999 },
    });
    const apres = resolveSubscriptionCatalogPrices({
      serverEntries: CATALOGUE,
      storeCurrencyCode: 'EUR',
      storePricesEurCents: { fc_team_1_monthly: 799, fc_team_1_yearly: 5999 },
    });
    expect(apres).toEqual(avant);
    expect(apres.entries.every((entry) => entry.priceCurrencyCode === undefined)).toBe(true);
  });
});

describe('INTL1 — la mise en forme porte la devise', () => {
  it('euros : libelles identiques a avant', () => {
    expect(formatSubscriptionPriceLabel(5999, 'yearly')).toBe('59,99 €/an');
    expect(formatSubscriptionPriceLabel(5999, 'yearly', 'EUR')).toBe('59,99 €/an');
    expect(formatSubscriptionMonthlyEquivalentLabel(5999)).toBe('soit 5,00 €/mois');
  });

  it('CHF et AED : le code de la devise remplace le €', () => {
    expect(formatSubscriptionPriceLabel(790, 'monthly', 'CHF')).toBe('7,90 CHF/mois');
    expect(formatSubscriptionPriceLabel(21999, 'yearly', 'aed')).toBe('219,99 AED/an');
    expect(formatSubscriptionMonthlyEquivalentLabel(5900, 'CHF')).toBe('soit 4,92 CHF/mois');
  });

  it('la fiche d une ligne de catalogue lit la devise de la ligne', () => {
    const meta = getSubscriptionCatalogEntryMeta({
      billingPeriod: 'yearly',
      planCode: 'fc_team_1_yearly',
      priceCurrencyCode: 'CHF',
      referencePriceEurCents: 5900,
      scopeType: 'TEAM',
      slotCount: 1,
    });
    expect(meta.priceLabel).toBe('59,00 CHF/an');
  });
});
