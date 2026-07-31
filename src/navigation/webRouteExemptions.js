/**
 * SOURCE DE VERITE UNIQUE des exemptions de parite de routage app <-> web.
 *
 * Consommee par LES DEUX filets de parite :
 *   - app  : src/navigation/webRoutes.parity.test.js (jest, scan des declarations Screen)
 *   - web  : web/scripts/check-web-route-coverage.mjs (scan de routeNames.js),
 *            qui lit ce fichier par regex `[RouteNames.X]:`
 *
 * Avant le 2026-07-20, chaque filet avait sa propre liste : SearchHome etait
 * exempte cote app (19/07) mais inconnu du script web -> check:routes rouge.
 * Une exemption se decide ICI, une fois, avec sa raison.
 */

const { RouteNames } = require('./routeNames');

/**
 * LISTE BLANCHE DES ECRANS VOLONTAIREMENT SANS ROUTE WEB.
 *
 * Chaque entree porte sa raison. On n'ajoute une ligne ici QUE si l'ecran n'a
 * legitimement aucun sens sur le web (conteneur de navigation, achat in-app natif,
 * camera, capteur...). Si l'ecran devrait exister sur le web mais n'est pas encore
 * route, on l'ajoute avec un TODO explicite plutot que de le passer sous silence.
 */
const MOBILE_ONLY_SCREENS = {
  // --- Conteneurs de navigation (stacks) ---
  // Ce ne sont pas des ecrans terminaux : ils n'affichent rien par eux-memes et
  // servent uniquement a grouper des enfants. Cote web, ce sont les ENFANTS qui
  // portent une URL (ex: ClubStack n'a pas d'URL, mais /clubs/:clubId oui). Router
  // le conteneur n'aurait pas de sens : on ne saurait pas quel enfant afficher.
  [RouteNames.AdminStack]:
    'Conteneur de stack : les ecrans /admin/* sont routes individuellement',
  [RouteNames.AdWizardStack]:
    'Conteneur de stack : les etapes /recruitment/wizard/* sont routees individuellement',
  [RouteNames.ClubStack]:
    'Conteneur de stack : les ecrans /clubs/* sont routes individuellement',
  [RouteNames.EventStack]:
    'Conteneur de stack : les ecrans /events/* sont routes individuellement',
  [RouteNames.FriendlyMatchWizardStack]:
    'Conteneur de stack : les etapes de l assistant amicaux sont routees individuellement',
  [RouteNames.ProfileStack]:
    'Conteneur de stack : les ecrans /profile/* sont routes individuellement',
  [RouteNames.PublicAuthStack]:
    'Conteneur de stack public : /login et /register sont routes individuellement',
  [RouteNames.TeamStack]:
    'Conteneur de stack : les ecrans /teams/* sont routes individuellement',

  // --- Onglets-leurres du menu public (PublicTabNavigator) ---
  // Ces onglets ne montent jamais de contenu : leur listener tabPress fait
  // preventDefault() et ouvre le tunnel d'authentification. Ils n'existent que pour
  // dessiner l'icone dans la barre d'onglets d'un visiteur non connecte. Cote web
  // l'equivalent est la redirection vers /login : pas d'URL propre a leur donner.
  [RouteNames.AuthStackAccount]:
    'Onglet-leurre public : déclenche le tunnel de connexion, ne monte aucun écran',
  [RouteNames.AuthStackMessaging]:
    'Onglet-leurre public : déclenche le tunnel de connexion, ne monte aucun écran',
  [RouteNames.AuthStackPlanning]:
    'Onglet-leurre public : déclenche le tunnel de connexion, ne monte aucun écran',

  // --- TODO(L7) : matchs amicaux, ecrans ecrits mais pas encore routes sur le web ---
  // Ces 8 ecrans DEVRAIENT exister sur le web (la liste des annonces y est deja
  // publique, spec Q12) : ils sont ici parce que leur routage web est le lot L7,
  // pas parce que le web n'aurait pas de sens.
  //
  // Pourquoi ils ne peuvent pas etre routes depuis le depot `app` seul : poser un
  // motif dans WEB_ROUTE_PATTERNS sans l'entree correspondante dans
  // web/src/routes/screenRegistry.tsx fait echouer `npm run check:routes` cote web
  // (unsupportedByRegistry, check-web-route-coverage.mjs:73-77). L7 fait les deux
  // gestes ensemble ; l'exemption disparait alors toute seule, le test de parite
  // « ne contient pas d'entree obsolete » le prouve.
  //
  // CE QUE L7 DOIT FAIRE, pour chacun des 8 :
  //   1. retirer sa ligne ici ;
  //   2. ajouter son motif dans app/src/navigation/webRoutes.js ;
  //   3. ajouter son import lazy + son defineSharedScreen dans
  //      web/src/routes/screenRegistry.tsx ;
  //   4. ajouter les 7 etapes au Set d'un FriendlyMatchWizardRouteProvider dans
  //      web/src/routes/sharedRouteProviders.tsx (sinon useFriendlyMatchWizard leve).
  //
  // En attendant, aucun atterrissage silencieux sur « / » : les points d'entree
  // passent par navigateOrExplainOnWeb() (navigation/webNavigationGuard.js), qui
  // lit isWebRouteSupported() et se desactive tout seul des que le motif existe.
  [RouteNames.FriendlyMatchAdDetails]:
    'TODO(L7) : ecran ecrit, routage web = lot L7 (screenRegistry.tsx a completer)',
  [RouteNames.FriendlyMatchWizardDates]:
    'TODO(L7) : etape ecrite, routage web = lot L7 (screenRegistry.tsx a completer)',
  [RouteNames.FriendlyMatchWizardDescription]:
    'TODO(L7) : etape ecrite, routage web = lot L7 (screenRegistry.tsx a completer)',
  [RouteNames.FriendlyMatchWizardHosting]:
    'TODO(L7) : etape ecrite, routage web = lot L7 (screenRegistry.tsx a completer)',
  [RouteNames.FriendlyMatchWizardLocation]:
    'TODO(L7) : etape ecrite, routage web = lot L7 (screenRegistry.tsx a completer)',
  [RouteNames.FriendlyMatchWizardOpponent]:
    'TODO(L7) : etape ecrite, routage web = lot L7 (screenRegistry.tsx a completer)',
  [RouteNames.FriendlyMatchWizardRecap]:
    'TODO(L7) : etape ecrite, routage web = lot L7 (screenRegistry.tsx a completer)',
  [RouteNames.FriendlyMatchWizardTeam]:
    'TODO(L7) : etape ecrite, routage web = lot L7 (screenRegistry.tsx a completer)',

  // --- Alias interne de navigateur ---
  // Accueil du membre connecte (HomeHub), initialRouteName de SearchStack. Depuis le
  // 2026-07-19 ce nom est declare dans routeNames.js (il etait une chaine en dur) ; sa
  // valeur n'a pas change. L'accueil est deja expose cote web par HomeTab (/).
  [RouteNames.SearchHome]:
    'Accueil interne de SearchStack (initialRouteName) ; l\'accueil web est HomeTab (/)',
};

/**
 * LISTE BLANCHE DES MOTIFS WEB SANS ECRAN ENREGISTRE.
 *
 * Un motif web dont aucun navigateur ne declare l'ecran est une URL morte : elle est
 * construite par buildWebPath(), partagee, mise en signet, potentiellement indexee, et
 * n'aboutit sur rien. Le symetrique exact de la panne du 18/07.
 *
 * On n'ajoute une ligne ici QUE pour un ecran REELLEMENT prevu et deja ecrit, dont il ne
 * reste que l'enregistrement dans un navigateur a faire. Un motif qui ne correspond a
 * aucun code existant se supprime, il ne s'exempte pas.
 */
const UNREGISTERED_WEB_PATTERNS = {
  // ReservationEdit.web.js existe et est explicitement une variante web (adaptateur vers
  // EventEdit). Il n'a jamais ete branche dans une stack.
  [RouteNames.ReservationEdit]:
    'ReservationEdit.web.js existe et vise le web, reste a l\'enregistrer (TODO webRoutes.js)',
};

module.exports = {
  MOBILE_ONLY_SCREENS,
  UNREGISTERED_WEB_PATTERNS,
};
