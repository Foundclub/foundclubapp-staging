import fs from 'fs';
import path from 'path';

import { EMPTY_HOME_COUNTERS, selectBannerLines } from '../homeCounters';

// 🏛️ COLL-CONSOLE-BIS (03/10/2026), point 8 — LES DEUX LIGNES « COLLECTIVITÉS » DE « À TRAITER »
// sur l'accueil du SuperAdmin (planche 12, `P2-console-tel` état 2 et `-ordi` état B) :
// « Mairies à activer » et « Demandes de gestionnaire ». Le chef les avait écartées
// (« accueil B ») ; la maquette les montre et Adel a demandé le 03/10 que tout soit fait.
// Leurs nombres viennent des lectures EXISTANTES de la console (aucune lecture neuve), pour le
// SuperAdmin seul. ROUGE avant le lot : le bandeau ne connaissait que la modération.
//   - les lignes suivent l'ordre de la planche (après « À la une »), un zéro ne s'affiche pas ;
//   - le plafond de 4 lignes du pack reste ;
//   - sans compteurs de collectivités, le bandeau est celui d'avant ;
//   - l'accueil les branche, et chaque ligne ouvre son écran de la console.

const SOURCE_HUB = fs.readFileSync(
  path.resolve(__dirname, '..', '..', '..', 'views', 'home', 'HomeHub.js'),
  'utf8',
);

const MODERATION = (valeurs) => ({
  ...EMPTY_HOME_COUNTERS,
  moderation: {
    aLaUne: 0, clubsAOnboarder: 0, revendications: 0, signalements: 0, ...valeurs,
  },
});

describe('COLL-CONSOLE-BIS — les lignes « Collectivités » du bandeau du SuperAdmin', () => {
  it('l ordre de la planche : Revendications, À la une, Mairies, Demandes de gestionnaire', () => {
    const lignes = selectBannerLines(
      MODERATION({ aLaUne: 2, revendications: 3 }),
      'superAdmin',
      { demandesGestionnaire: 1, mairiesAActiver: 1 },
    );
    expect(lignes).toEqual([
      { hasAlert: true, key: 'revendications', value: 3 },
      { hasAlert: false, key: 'aLaUne', value: 2 },
      { hasAlert: true, key: 'mairiesAActiver', value: 1 },
      { hasAlert: true, key: 'demandesGestionnaire', value: 1 },
    ]);
  });

  it('un zéro ne s affiche pas ; le plafond de 4 lignes reste', () => {
    expect(selectBannerLines(
      MODERATION({}),
      'superAdmin',
      { demandesGestionnaire: 0, mairiesAActiver: 2 },
    ).map((ligne) => ligne.key)).toEqual(['mairiesAActiver']);
    expect(selectBannerLines(
      MODERATION({
        aLaUne: 1, clubsAOnboarder: 1, revendications: 1, signalements: 1,
      }),
      'superAdmin',
      { demandesGestionnaire: 1, mairiesAActiver: 1 },
    )).toHaveLength(4);
  });

  it('sans compteurs de collectivités, le bandeau d avant ; un autre rôle ne les voit pas', () => {
    const avant = MODERATION({ aLaUne: 2, clubsAOnboarder: 3 });
    expect(selectBannerLines(avant, 'superAdmin').map((ligne) => ligne.key))
      .toEqual(['aLaUne', 'clubsAOnboarder']);
    expect(selectBannerLines(
      { ...EMPTY_HOME_COUNTERS, demandes: 2 },
      'president',
      { demandesGestionnaire: 4, mairiesAActiver: 4 },
    ).map((ligne) => ligne.key)).toEqual(['demandes']);
  });

  it('l accueil les branche pour le SuperAdmin ; chaque ligne ouvre son écran', () => {
    expect(SOURCE_HUB).toContain('useAdminCollectivitesATraiter(isSuperAdmin)');
    expect(SOURCE_HUB).toContain('selectBannerLines(homeCounters, roleKey, collectivitesATraiter)');
    expect(SOURCE_HUB).toContain('openAdmin(RouteNames.AdminCollectiviteList)');
    expect(SOURCE_HUB).toContain('openAdmin(RouteNames.AdminManagerRequests)');
  });
});
