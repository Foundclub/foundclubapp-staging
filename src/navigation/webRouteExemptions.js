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

  // --- Ecrit, monte cote app, pas encore route cote web ---
  // TODO(web) « Mes activites » (lot D35) DOIT exister sur le web : c est un
  // ecran de gestion, pas un capteur. Il n est pas exempte par principe mais
  // par sequencement — l enregistrer cote app ferait passer check:routes au
  // rouge tant que web/src/routes/screenRegistry.tsx ne porte pas son entree,
  // et ce fichier vit dans l autre depot. A retirer d ici DES QUE le registre
  // web declare MyActivities (une ligne), puis ajouter son motif dans
  // webRoutes.js.
  [RouteNames.MyActivities]:
    'TODO(web) ecran de gestion ecrit et monte cote app ; attend son entree dans web/src/routes/screenRegistry.tsx',

  // TODO(web) ESSAI (2026-08-28) — la page cadeau du dirigeant DOIT exister sur
  // le web : l'inscription s'y fait aussi, et un dirigeant qui s'inscrit depuis
  // le navigateur a droit au meme cadeau. Elle est exemptee par SEQUENCEMENT,
  // pas par principe, exactement comme MyActivities ci-dessus : l'enregistrer
  // cote app ferait passer `check:routes` au rouge tant que
  // web/src/routes/screenRegistry.tsx ne porte pas son entree, et ce fichier
  // vit dans l'autre depot — hors du perimetre de ce lot.
  // A retirer d'ici DES QUE le registre web declare OnboardingGift (une ligne),
  // puis ajouter son motif dans webRoutes.js (ex. /onboarding/gift).
  [RouteNames.OnboardingGift]:
    'TODO(web) page cadeau ecrite et montee cote app ; attend son entree dans web/src/routes/screenRegistry.tsx',

  // TODO(web) BLOQUER (2026-09-02) — « Personnes bloquees » DOIT exister sur le
  // web : la messagerie y tourne aussi, et Apple comme Google exigent qu on
  // puisse DEBLOQUER aussi facilement qu on bloque. Elle est exemptee par
  // SEQUENCEMENT, pas par principe, exactement comme MyActivities et
  // OnboardingGift ci-dessus : l enregistrer cote app ferait passer
  // `check:routes` au rouge tant que web/src/routes/screenRegistry.tsx ne porte
  // pas son entree, et ce fichier vit dans l autre depot — hors du perimetre
  // de ce lot.
  // ⚠️ Ce n est PAS un trou de conformite : les DEUX boutons de blocage
  // (fiche d une personne, menu d une conversation) sont routes cote web, et le
  // serveur REFUSE de lui-meme. Seul l ecran de gestion attend.
  // A retirer d ici DES QUE le registre web declare BlockedUsers (une ligne),
  // puis ajouter son motif dans webRoutes.js (ex. /profile/blocked).
  [RouteNames.BlockedUsers]:
    'TODO(web) ecran « Personnes bloquees » ecrit et monte cote app ; attend son entree dans web/src/routes/screenRegistry.tsx',

  // TODO(web) PARENT-LIEN (2026-09-30) — les deux ecrans du lien parent <-> compte d un enfant
  // sont exemptes par SEQUENCEMENT, exactement comme BlockedUsers : les router cote app ferait
  // passer `check:routes` au rouge tant que web/src/routes/screenRegistry.tsx (autre depot, hors
  // du perimetre de ce lot) ne porte pas leurs entrees. D ici la, les deux portes de l app
  // passent par `navigateOrExplainOnWeb` : sur le site, « Bientot sur le site » au lieu d un
  // atterrissage muet sur l accueil. A retirer d ici quand le registre web les declare, puis
  // ajouter leurs motifs dans webRoutes.js (ex. /profile/children/link et /profile/parent).
  [RouteNames.MyParentLink]:
    'TODO(web) MyParentLink screen (the child accepts or removes the link) is built and'
    + ' mounted in the app; waiting for its entry in web/src/routes/screenRegistry.tsx',
  [RouteNames.ParentLinkInvite]:
    'TODO(web) ParentLinkInvite screen is built and mounted in the app;'
    + ' waiting for its entry in web/src/routes/screenRegistry.tsx',

  // TODO(web) PERF « Entrainement perso » (2026-09-06) — les six ecrans de la
  // section Entrainement sont exemptes par SEQUENCEMENT, comme les quatre
  // au-dessus, mais avec UNE raison de plus, et elle est technique, pas
  // organisationnelle :
  //   1. `web/src/routes/screenRegistry.tsx` vit dans l autre depot, hors du
  //      perimetre de ce lot (app + admin) ;
  //   2. ⚠️ le pont SVG du site (`web/src/shims/react-native-svg.tsx`) N EXPORTE
  //      PAS `SvgXml` — verifie le 2026-09-06, il ne porte que des primitives
  //      (`Circle`, `Path`, `Rect`...). Or les fiches de test affichent les
  //      schemas cotes du guide en SVG brut venu du serveur. Router ces ecrans
  //      sur le web AVANT d avoir ajoute `SvgXml` au pont ferait tomber la page.
  //   3. Et cet ajout n est pas une ligne : sur le web, poser du SVG venu du
  //      serveur dans le DOM ouvre une injection (`<script>`, `onload=`) que
  //      `SvgXml` ferme toute seule cote natif. Il faudra donc l assainir, et
  //      c est une decision de securite a prendre a part.
  // Ce n est PAS un trou fonctionnel : l entrainement se fait sur un terrain, un
  // telephone a la main. Le site le rendra quand le pont saura dessiner.
  // A retirer d ici DES QUE le pont web porte `SvgXml` assaini ET que le
  // registre web declare ces ecrans, puis ajouter leurs motifs dans webRoutes.js
  // (ex. /training, /training/catalog, /training/programs/:programId).
  [RouteNames.TrainingCatalog]:
    'TODO(web) catalogue des programmes ; attend `SvgXml` au pont web + son entree dans screenRegistry.tsx',
  [RouteNames.TrainingDay]:
    'TODO(web) journee d entrainement ; attend `SvgXml` au pont web + son entree dans screenRegistry.tsx',
  [RouteNames.TrainingEnrolled]:
    'TODO(web) confirmation d inscription ; attend `SvgXml` au pont web '
    + '+ son entree dans screenRegistry.tsx',
  [RouteNames.TrainingFreshness]:
    'TODO(web) les cinq questions de forme ; attend `SvgXml` au pont web'
    + ' + son entree dans screenRegistry.tsx',
  [RouteNames.TrainingGuided]:
    'TODO(web) le parcours guide d un test ; attend `SvgXml` au pont web'
    + ' + son entree dans screenRegistry.tsx',
  [RouteNames.TrainingLogbook]:
    'TODO(web) carnet de resultats ; attend `SvgXml` au pont web + son entree dans screenRegistry.tsx',
  [RouteNames.TrainingPlan]:
    'TODO(web) plan « mon entrainement » ; attend `SvgXml` au pont web + son entree dans screenRegistry.tsx',
  [RouteNames.TrainingProgramDetail]:
    'TODO(web) fiche d un programme ; attend `SvgXml` au pont web + son entree dans screenRegistry.tsx',
  [RouteNames.TrainingSchema]:
    'TODO(web) le schema en grand ; attend `SvgXml` au pont web'
    + ' + son entree dans screenRegistry.tsx',
  [RouteNames.TrainingSessionNow]:
    'TODO(web) le tableau de bord d une seance en cours ; attend `SvgXml` au pont web'
    + ' + son entree dans screenRegistry.tsx',
  [RouteNames.TrainingSessions]:
    'TODO(web) toutes mes seances ; attend `SvgXml` au pont web '
    + '+ son entree dans screenRegistry.tsx',
  [RouteNames.TrainingTest]:
    'TODO(web) fiche d un test ; attend `SvgXml` au pont web + son entree dans screenRegistry.tsx',
  [RouteNames.TrainingVideoEntry]:
    'TODO(web) le releve d un essai ; attend `SvgXml` au pont web'
    + ' + son entree dans screenRegistry.tsx',
  [RouteNames.TrainingVideoQueue]:
    'TODO(web) la file des releves video ; attend `SvgXml` au pont web'
    + ' + son entree dans screenRegistry.tsx',

  // --- Alias interne de navigateur ---
  // Accueil du membre connecte (HomeHub), initialRouteName de SearchStack. Depuis le
  // 2026-07-19 ce nom est declare dans routeNames.js (il etait une chaine en dur) ; sa
  // valeur n'a pas change. L'accueil est deja expose cote web par HomeTab (/).
  [RouteNames.SearchHome]:
    'Accueil interne de SearchStack (initialRouteName) ; l\'accueil web est HomeTab (/)',

  // --- COLL-ACCUEIL (01/10/2026) ---
  // La barre d onglets de la Ville (CollectiviteTabNavigator) : un navigateur, pas un ecran.
  // Ses quatre onglets ont deja leur adresse (/collectivite/:id, .../requests,
  // .../installations, /messages) ; sur le site, le menu lateral de l AppShell les porte.
  [RouteNames.CollectiviteSpace]:
    'Tab navigator of the town space; on the website, the AppShell side menu carries its tabs',

  // --- RESA-L5A1 (13/10/2026) ---
  // Le gérant de complexe : écrans cachés par l interrupteur COMPLEXES_GERANT (serveur non
  // livré). Leur adresse sur le site viendra avec le lot web du gérant (screenRegistry.tsx).
  [RouteNames.ComplexeEspace]:
    'RESA-L5A1 : tab navigator of the venue space (hidden by COMPLEXES_GERANT), not a screen',
  // RESA-L7-1 (20/10/2026) : les 9 autres écrans du gérant (RESA-L5A1 / L5A2) et les 6 du joueur
  // (RESA-L6A) ont leur adresse sur le site (webRoutes.js) ; sur ordinateur, le menu latéral de
  // l AppShell porte les onglets de l espace du complexe. ComplexeDevenirGerant a la sienne
  // (/onboarding/complexe, RESA-INSCRIPTION) — intégration du soutien, 20/10.
  // RESA-FIN-SITE (21/10/2026) : la confirmation la veille (E-P14) et « Mes réservations » (E-P10)
  // ont leur adresse (webRoutes.js) et sortent de cette liste.
  // --- RESA-L6B-2 (20/10/2026) ---
  // La page d'invitation DANS l'app (E-P08) : sur le site, le lien `/r/<code>` est une page
  // publique à part (lot RESA-L7-2), lue sans compte.
  // RESA-FIN-SITE (21/10/2026) : ReserverAnnonce (E-P09) et ReserverFavoris (E-P11) ont leur
  // adresse.
  [RouteNames.ReserverInvitation]:
    'RESA-L6B-2 : hidden by COMPLEXES_JOUEUR; the website invitation page is /r/:code (RESA-L7-2)',
  // RESA-L5B-2 (20/10/2026) : la fiche d'un client du complexe (RESA-L5B-1) a son adresse
  // (/mon-complexe/clients/:joueurId) et sort de cette liste.
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
  // RESA-L6A (14/10/2026) — les écrans téléphone étaient morts (aucune porte) et sont retirés ; le
  // site sert toujours BookingCalendar.web.js et MissingPlayersView.web.js à ces adresses.
  [RouteNames.BookingCalendar]:
    'RESA-L6A : website-only screen (BookingCalendar.web.js); the dead phone screen was removed',
  [RouteNames.MissingPlayersView]:
    'RESA-L6A : website-only screen (MissingPlayersView.web.js); the dead phone screen was removed',
  // ReservationEdit.web.js existe et est explicitement une variante web (adaptateur vers
  // EventEdit). Il n'a jamais ete branche dans une stack.
  [RouteNames.ReservationEdit]:
    'ReservationEdit.web.js existe et vise le web, reste a l\'enregistrer (TODO webRoutes.js)',
};

module.exports = {
  MOBILE_ONLY_SCREENS,
  UNREGISTERED_WEB_PATTERNS,
};
