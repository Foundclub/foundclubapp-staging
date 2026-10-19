import { RouteNames } from '../routeNames';
import { MOBILE_ONLY_SCREENS } from '../webRouteExemptions';
import { buildWebPath, getWebRoutePattern, isWebRouteSupported } from '../webRoutes';

// RESA-L7-1 (20/10/2026) — LES ADRESSES DU SITE DES ÉCRANS DE RÉSERVATION (gérant RESA-L5A1 / L5A2,
// joueur RESA-L6A). Jusqu'ici exemptés « mobile seulement » en attendant ce lot ; le site les
// déclare chacun derrière son interrupteur (web/src/routes/screenRegistry.tsx). Décisions E4 du
// lot (banc .local/bancs/RESAL71-20261020/DECISIONS_E4.md) :
//   · le gérant sous /mon-complexe, l'identifiant du complexe en paramètre d'adresse
//     (?complexeId=) : les écrans le lisent comme un paramètre facultatif ;
//   · la page du complexe EST la page publique de l'annuaire (planche OR2), par son slug ;
//   · les écrans du joueur qui demandent un compte sous /reserver-un-terrain.
// ROUGE avant le lot : aucune de ces 15 adresses n'existe, les 15 sont exemptées.

const GERANT = {
  [RouteNames.ComplexeAccueil]: '/mon-complexe',
  [RouteNames.ComplexeCreneaux]: '/mon-complexe/installations/:terrainId/creneaux',
  [RouteNames.ComplexeDemandes]: '/mon-complexe/demandes',
  [RouteNames.ComplexeFermetures]: '/mon-complexe/fermetures',
  [RouteNames.ComplexeInstallations]: '/mon-complexe/installations',
  [RouteNames.ComplexePlanning]: '/mon-complexe/planning',
  [RouteNames.ComplexeReglages]: '/mon-complexe/reglages',
  [RouteNames.ComplexeReservation]: '/mon-complexe/reservations/:reservationId',
  [RouteNames.ComplexeReservations]: '/mon-complexe/reservations',
  [RouteNames.ComplexeTerrain]: '/mon-complexe/terrain/:terrainId?',
};

const JOUEUR = {
  [RouteNames.ReserverComplexe]: '/annuaire/complexes/:slug',
  [RouteNames.ReserverCreneau]: '/reserver-un-terrain/:slug/:terrainId',
  [RouteNames.ReserverEchec]: '/reserver-un-terrain/echec',
  [RouteNames.ReserverMaReservation]: '/reservation-terrain/:reservationId',
  [RouteNames.ReserverRecapitulatif]: '/reserver-un-terrain/:slug/:terrainId/recapitulatif',
  [RouteNames.ReserverResultat]: '/reserver-un-terrain/resultat',
};

describe('RESA-L7-1 — les écrans de réservation ont leur adresse sur le site', () => {
  it.each(Object.entries({ ...GERANT, ...JOUEUR }))('%s ⇒ %s, plus exempté', (route, adresse) => {
    expect(isWebRouteSupported(route)).toBe(true);
    expect(getWebRoutePattern(route)).toBe(adresse);
    expect(Object.keys(MOBILE_ONLY_SCREENS)).not.toContain(route);
  });

  it('le gérant porte son complexe en paramètre d adresse', () => {
    expect(buildWebPath(RouteNames.ComplexeDemandes, { complexeId: 'cx-1' }))
      .toBe('/mon-complexe/demandes?complexeId=cx-1');
    expect(buildWebPath(RouteNames.ComplexeTerrain, { complexeId: 'cx-1' }))
      .toBe('/mon-complexe/terrain?complexeId=cx-1');
  });

  it('ouvrir l espace du complexe ouvre son accueil (le premier onglet du téléphone)', () => {
    expect(buildWebPath(RouteNames.ComplexeEspace, { complexeId: 'cx-1' }))
      .toBe('/mon-complexe?complexeId=cx-1');
    expect(buildWebPath(RouteNames.ComplexeEspace, {
      params: { complexeId: 'cx-1', date: '2026-10-21' },
      screen: RouteNames.ComplexePlanning,
    })).toBe('/mon-complexe/planning?complexeId=cx-1&date=2026-10-21');
  });

  it('la page du complexe est la page publique de l annuaire, par son slug', () => {
    expect(buildWebPath(RouteNames.ReserverComplexe, { slug: 'le-five' }))
      .toMatch(/^\/annuaire\/complexes\/le-five(\?|$)/);
  });

  it('restent exemptés : le navigateur à onglets, et le tunnel (lot RESA-INSCRIPTION)', () => {
    expect(Object.keys(MOBILE_ONLY_SCREENS)).toEqual(expect.arrayContaining([
      RouteNames.ComplexeDevenirGerant,
      RouteNames.ComplexeEspace,
    ]));
  });
});
