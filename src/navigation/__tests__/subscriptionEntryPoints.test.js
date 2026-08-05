const fs = require('fs');
const path = require('path');

const WEB_ROUTE_PATTERNS = require('../webRoutes').default;

// L33 — LE controle qui protege l'argent de ce lot.
//
// L'ecran Abonnement etait atteint depuis sept endroits. La refonte le coupe en
// trois : un hub qui GERE (aucun catalogue, aucun prix) et un carrousel qui
// VEND. A partir de la, chaque point d'entree doit viser le bon ecran, et se
// tromper coute cher dans un seul sens : quelqu'un qui vient de buter sur un
// mur payant et qui atterrit sur le hub n'a plus AUCUN moyen de payer. C'est
// mot pour mot le trou que le lot L10-A a comble.
//
// Le controle est fait sur la SOURCE plutot qu'au rendu, pour trois raisons :
// il couvre les sept points d'un coup, il monte zero ecran geant (EventDetails
// fait 5 400 lignes), et surtout il ECHOUE quand un huitieme appelant apparait
// sans decision — ce qu'aucun test de rendu ne saurait voir.

const racineSources = path.resolve(__dirname, '..', '..');

/**
 * @param {string} cheminRelatif
 * @returns {string}
 */
const lireSource = (cheminRelatif) => fs.readFileSync(
  path.join(racineSources, cheminRelatif),
  'utf8',
);

/**
 * Routes d'abonnement visees par un fichier, dans l'ordre d'apparition.
 * @param {string} cheminRelatif
 * @returns {string[]}
 */
const routesViseesPar = (cheminRelatif) => (
  lireSource(cheminRelatif).match(/RouteNames\.Subscription(?:Overview|Offers|Compare)/g) || []
).map((occurrence) => occurrence.replace('RouteNames.', ''));

// Les sept points d'entree mesures le 2026-08-05, et la decision prise pour
// chacun. « offers » = le carrousel (on vend), « overview » = le hub (on gere).
const POINTS_D_ENTREE = [
  {
    attendu: 'SubscriptionOffers',
    fichier: 'components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet.js',
    pourquoi: 'elle vient de buter sur un mur payant',
  },
  {
    attendu: 'SubscriptionOffers',
    fichier: 'components/molecules/subscriptionQuotaBanner/SubscriptionQuotaBanner.js',
    pourquoi: 'elle vient de voir un compteur',
  },
  {
    attendu: 'SubscriptionOffers',
    fichier: 'views/event/EventDetails.js',
    pourquoi: 'relance de quota apres publication',
  },
  {
    attendu: 'SubscriptionOffers',
    fichier: 'views/home/HomeHub.js',
    pourquoi: 'la carte d accueil affiche un compteur',
  },
  {
    attendu: 'SubscriptionOverview',
    fichier: 'views/profile/Profile.js',
    pourquoi: '« Mon compte » est un geste de gestion',
  },
  {
    attendu: 'SubscriptionOverview',
    fichier: 'views/subscription/SubscriptionSuccess.js',
    pourquoi: 'elle vient d acheter',
  },
];

describe('Points d\'entree de l\'abonnement — chacun atterrit au bon endroit', () => {
  it.each(POINTS_D_ENTREE)(
    '$fichier vise $attendu ($pourquoi)',
    ({ attendu, fichier }) => {
      expect(routesViseesPar(fichier)).toEqual([attendu]);
    },
  );

  it('7e point d\'entree — l\'URL web `/profile/subscription` ouvre le HUB', () => {
    expect(WEB_ROUTE_PATTERNS.SubscriptionOverview).toBe('/profile/subscription');
    expect(WEB_ROUTE_PATTERNS.SubscriptionOffers).toBe('/profile/subscription/offers');
    expect(WEB_ROUTE_PATTERNS.SubscriptionCompare).toBe('/profile/subscription/compare');
  });

  it('AUCUN huitieme appelant n\'est apparu sans decision', () => {
    const fichiersAutorises = new Set([
      ...POINTS_D_ENTREE.map((point) => point.fichier),
      // Les trois ecrans du parcours et leur declaration : ils se citent
      // forcement les uns les autres.
      'navigation/private/stacks/ProfileStack.js',
      'navigation/webRoutes.js',
      'views/profile/SubscriptionCompare.js',
      'views/profile/SubscriptionOverview.js',
    ]);

    /**
     * @param {string} dossier
     * @returns {string[]}
     */
    const parcourir = (dossier) => fs.readdirSync(dossier, { withFileTypes: true })
      .flatMap((entree) => {
        const chemin = path.join(dossier, entree.name);
        if (entree.isDirectory()) {
          return entree.name === '__tests__' ? [] : parcourir(chemin);
        }
        return entree.isFile() && /\.jsx?$/.test(entree.name) ? [chemin] : [];
      });

    const coupables = parcourir(racineSources)
      .map((chemin) => path.relative(racineSources, chemin).split(path.sep).join('/'))
      .filter((chemin) => !fichiersAutorises.has(chemin))
      .filter((chemin) => routesViseesPar(chemin).length > 0);

    // Un fichier de plus ici n'est pas une erreur en soi : c'est une DECISION a
    // prendre (hub ou carrousel ?), puis a inscrire dans POINTS_D_ENTREE.
    expect(coupables).toEqual([]);
  });
});
