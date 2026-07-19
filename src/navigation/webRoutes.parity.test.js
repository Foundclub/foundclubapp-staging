/**
 * TEST DE PARITE DE ROUTAGE app <-> web.
 *
 * Pourquoi ce test existe :
 * les deux pannes du 18/07 (messagerie blanche, tunnel de creation de club non
 * route) viennent du meme angle mort. Un ecran etait enregistre dans un navigateur
 * react-navigation cote app, mais n'avait AUCUN motif dans WEB_ROUTE_PATTERNS
 * (src/navigation/webRoutes.js). Le controle etait purement declaratif : personne
 * ne verifiait que le registre web couvrait reellement le registre app.
 *
 * Le piege est silencieux : getWebRoutePattern() retombe sur '/' quand un ecran est
 * inconnu. Sur le web, naviguer vers un ecran non route ne leve donc aucune erreur.
 * On atterrit sur l'accueil ou sur un ecran blanc, sans le moindre signal.
 *
 * Ce que fait le test :
 * il scanne les sources a la recherche de toutes les declarations
 * <X.Screen name={...} />, puis verifie la parite DANS LES DEUX SENS.
 *
 * Sens app -> web : chaque ecran enregistre a bien un motif web (isWebRouteSupported).
 * Toute exemption doit etre EXPLICITE et JUSTIFIEE dans MOBILE_ONLY_SCREENS.
 *
 * Sens web -> app : chaque motif de WEB_ROUTE_PATTERNS vise bien un ecran enregistre.
 * Un motif orphelin est une URL morte : elle est publiee, partageable, indexable, mais
 * aucun navigateur ne sait quoi monter dessus. Toute exemption doit etre EXPLICITE et
 * JUSTIFIEE dans UNREGISTERED_WEB_PATTERNS.
 *
 * Le scan est statique (lecture de fichiers) et non un rendu react-navigation. Il
 * capte donc aussi les ecrans montes conditionnellement (superadmin, etapes
 * d'onboarding, mode gold...) qu'un rendu de test ne monterait jamais.
 */

const fs = require('fs');
const path = require('path');

const { RouteNames } = require('./routeNames');
const { isWebRouteSupported, WEB_ROUTE_PATTERNS } = require('./webRoutes');

const SRC_DIR = path.resolve(__dirname, '..');

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
    'Onglet-leurre public : declenche le tunnel de connexion, ne monte aucun ecran',
  [RouteNames.AuthStackMessaging]:
    'Onglet-leurre public : declenche le tunnel de connexion, ne monte aucun ecran',
  [RouteNames.AuthStackPlanning]:
    'Onglet-leurre public : declenche le tunnel de connexion, ne monte aucun ecran',

  // --- Alias interne de navigateur ---
  // Nom d'ecran interne a SearchStack (constante locale SEARCH_STACK_HOME), utilise
  // comme initialRouteName de la stack. L'accueil est deja expose cote web par HomeTab.
  SearchHome:
    'Alias interne de SearchStack pour son initialRouteName ; l\'accueil web est HomeTab (/)',
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

/**
 * Ecrans dont la parite web est directement liee aux pannes du 18/07.
 * On les verifie nommement pour que ces regressions precises ne puissent pas
 * revenir, meme si le scan generique se degradait un jour.
 */
const REGRESSION_GUARD_SCREENS = [
  // Panne « messagerie blanche »
  RouteNames.Chat,
  RouteNames.Conversation,
  RouteNames.NewConversation,
  // Panne « tunnel de creation de club non route »
  RouteNames.CreateClub,
  RouteNames.ClubWizardName,
  RouteNames.ClubWizardAddress,
  RouteNames.ClubWizardActivities,
  RouteNames.ClubWizardContact,
  RouteNames.ClubWizardRecap,
];

const SOURCE_FILE_PATTERN = /\.(js|jsx|ts|tsx)$/;
const TEST_FILE_PATTERN = /\.(test|spec)\.(js|jsx|ts|tsx)$/;
const IGNORED_DIRECTORIES = new Set(['__snapshots__', 'node_modules']);

const SCREEN_TAG_PATTERN = /<[A-Za-z_$][\w$]*\.Screen[\s/>]/g;
const NAME_PROP_ALTERNATIVES = [
  '\\{RouteNames\\.([A-Za-z0-9_$]+)\\}', // name={RouteNames.Foo}
  '\\{([A-Za-z0-9_$]+)\\}', //             name={SOME_LOCAL_CONST}
  '"([^"]*)"', //                          name="Foo"
  "'([^']*)'", //                          name='Foo'
].join('|');
const NAME_PROP_PATTERN = new RegExp(`\\bname=(?:${NAME_PROP_ALTERNATIVES})`);
const LOCAL_STRING_CONST_PATTERN = /(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*['"]([^'"]+)['"]/g;

/**
 * Liste recursivement les fichiers source (hors tests) d'un repertoire.
 * @param {string} directory Repertoire absolu a parcourir.
 * @returns {string[]} Chemins absolus des fichiers source trouves.
 */
const listSourceFiles = (directory) => fs
  .readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name) ? [] : listSourceFiles(fullPath);
    }
    if (!SOURCE_FILE_PATTERN.test(entry.name)) return [];
    if (TEST_FILE_PATTERN.test(entry.name)) return [];
    return [fullPath];
  });

/**
 * Extrait la balise ouvrante JSX complete a partir de son '<'.
 * On suit la profondeur d'accolades et l'etat de chaine pour ne pas s'arreter sur le
 * '>' d'une fonction flechee (`getComponent={() => require(...)}`) ni sur celui
 * d'une chaine de caracteres.
 * @param {string} source Contenu complet du fichier.
 * @param {number} startIndex Index du '<' ouvrant la balise.
 * @returns {string} Texte de la balise ouvrante, '>' final inclus.
 */
const readOpeningTag = (source, startIndex) => {
  let quote = null;
  let depth = 0;
  let index = startIndex;

  while (index < source.length) {
    const char = source[index];

    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
    } else if (char === "'" || char === '"' || char === '`') {
      quote = char;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
    } else if (char === '>' && depth === 0) {
      return source.slice(startIndex, index + 1);
    }

    index += 1;
  }

  return source.slice(startIndex);
};

/**
 * Resout le nom d'ecran porte par la prop name= d'une balise <X.Screen />.
 * @param {string} openingTag Texte de la balise ouvrante.
 * @param {Record<string, string>} localConstants Constantes chaines du fichier.
 * @returns {{ error?: string, screenName?: string }} Nom resolu ou raison de l'echec.
 */
const resolveScreenName = (openingTag, localConstants) => {
  const nameMatch = openingTag.match(NAME_PROP_PATTERN);
  if (!nameMatch) return { error: 'aucune prop name= trouvee' };

  const [, routeNamesKey, identifier, doubleQuoted, singleQuoted] = nameMatch;

  if (routeNamesKey) {
    const screenName = RouteNames[routeNamesKey];
    if (!screenName) {
      return { error: `RouteNames.${routeNamesKey} n'existe pas dans routeNames.js` };
    }
    return { screenName };
  }

  if (identifier) {
    const screenName = localConstants[identifier];
    if (!screenName) {
      return { error: `constante ${identifier} non resolvable statiquement` };
    }
    return { screenName };
  }

  const literal = doubleQuoted || singleQuoted;
  if (!literal) return { error: 'prop name= vide' };
  return { screenName: literal };
};

/**
 * Scanne src/ et recense tous les ecrans enregistres dans un navigateur.
 * @returns {{ registrations: Map<string, string[]>, unresolved: string[] }}
 *   registrations : nom d'ecran -> emplacements de declaration ;
 *   unresolved : declarations dont le nom n'a pas pu etre resolu statiquement.
 */
const collectRegisteredScreens = () => {
  const registrations = new Map();
  const unresolved = [];

  listSourceFiles(SRC_DIR).forEach((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    if (!source.includes('.Screen')) return;

    const relativePath = path.relative(SRC_DIR, filePath).split(path.sep).join('/');

    const localConstants = {};
    Array.from(source.matchAll(LOCAL_STRING_CONST_PATTERN))
      .forEach(([, constantName, constantValue]) => {
        localConstants[constantName] = constantValue;
      });

    Array.from(source.matchAll(SCREEN_TAG_PATTERN)).forEach((tagMatch) => {
      const openingTag = readOpeningTag(source, tagMatch.index);
      const line = source.slice(0, tagMatch.index).split('\n').length;
      const location = `${relativePath}:${line}`;
      const { error, screenName } = resolveScreenName(openingTag, localConstants);

      if (error) {
        unresolved.push(`${location} (${error})`);
        return;
      }

      if (!registrations.has(screenName)) registrations.set(screenName, []);
      registrations.get(screenName).push(location);
    });
  });

  return { registrations, unresolved };
};

describe('parite de routage app <-> web', () => {
  const { registrations, unresolved } = collectRegisteredScreens();

  test('le scan des navigateurs trouve bien des ecrans (garde anti-test-vide)', () => {
    // Sans ce garde, une regression du scan (renommage de dossier, refonte des
    // navigateurs, regex cassee) rendrait le test de parite vert alors qu'il ne
    // verifierait plus rien. C'est exactement le mode de panne du 18/07 : un
    // controle qui se declare complet alors qu'il ne regarde plus rien.
    expect(registrations.size).toBeGreaterThanOrEqual(150);
  });

  test('toutes les declarations <X.Screen /> ont un nom resolvable', () => {
    // Une declaration dont le nom n'est pas resolvable echappe au controle de
    // parite. Si ce test casse : soit la prop name= manque, soit elle utilise une
    // valeur dynamique (a remplacer par RouteNames.X ou une constante chaine locale).
    expect(unresolved).toEqual([]);
  });

  test('chaque ecran enregistre a un motif web ou une exemption justifiee', () => {
    const missing = [...registrations.entries()]
      .filter(([screenName]) => !isWebRouteSupported(screenName))
      .filter(([screenName]) => !(screenName in MOBILE_ONLY_SCREENS))
      .map(([screenName, locations]) => `${screenName} <- ${locations.join(', ')}`)
      .sort();

    if (missing.length > 0) {
      throw new Error(
        `${missing.length} ecran(s) enregistre(s) cote app n'ont aucun motif web.\n`
        + 'Sur le web ils retomberont silencieusement sur "/" (accueil ou page blanche).\n\n'
        + `${missing.map((entry) => `  - ${entry}`).join('\n')}\n\n`
        + 'Corriger en ajoutant le motif dans WEB_ROUTE_PATTERNS (webRoutes.js), ou en\n'
        + 'ajoutant l\'ecran dans MOBILE_ONLY_SCREENS avec sa raison si le web n\'a pas de sens.',
      );
    }

    expect(missing).toEqual([]);
  });

  test('chaque motif web vise un ecran enregistre ou une exemption justifiee', () => {
    const dead = Object.entries(WEB_ROUTE_PATTERNS)
      .filter(([screenName]) => !registrations.has(screenName))
      .filter(([screenName]) => !(screenName in UNREGISTERED_WEB_PATTERNS))
      .map(([screenName, pattern]) => `${screenName} -> ${pattern}`)
      .sort();

    if (dead.length > 0) {
      throw new Error(
        `${dead.length} motif(s) web ne visent aucun ecran enregistre dans un navigateur.\n`
        + 'Ce sont des URLs mortes : construites, partageables, indexables, mais rien ne\n'
        + 's\'y monte.\n\n'
        + `${dead.map((entry) => `  - ${entry}`).join('\n')}\n\n`
        + 'Corriger en enregistrant l\'ecran (<X.Screen name={RouteNames.X} />), ou en\n'
        + 'supprimant le motif de WEB_ROUTE_PATTERNS (webRoutes.js) s\'il est obsolete.\n'
        + 'En dernier recours seulement, si l\'ecran existe deja et attend son cablage,\n'
        + 'l\'ajouter dans UNREGISTERED_WEB_PATTERNS avec sa raison.',
      );
    }

    expect(dead).toEqual([]);
  });

  test('la liste blanche des motifs web orphelins ne contient pas d\'entree obsolete', () => {
    // Hygiene : des que l'ecran est enfin enregistre, l'exemption doit disparaitre.
    const obsolete = Object.keys(UNREGISTERED_WEB_PATTERNS)
      .map((screenName) => {
        if (!isWebRouteSupported(screenName)) {
          return `${screenName} : n'a plus de motif web, retirer l'exemption`;
        }
        if (registrations.has(screenName)) {
          return `${screenName} : est desormais enregistre, retirer l'exemption et son TODO`;
        }
        return null;
      })
      .filter(Boolean);

    expect(obsolete).toEqual([]);
  });

  test('chaque exemption de motif web orphelin porte une raison lisible', () => {
    const withoutReason = Object.entries(UNREGISTERED_WEB_PATTERNS)
      .filter(([, reason]) => typeof reason !== 'string' || reason.trim().length < 15)
      .map(([screenName]) => screenName);

    expect(withoutReason).toEqual([]);
  });

  test.each(REGRESSION_GUARD_SCREENS)('%s (panne du 18/07) reste route cote web', (screenName) => {
    expect(registrations.has(screenName)).toBe(true);
    expect(isWebRouteSupported(screenName)).toBe(true);
  });

  test('la liste blanche mobile-only ne contient pas d\'entree obsolete', () => {
    // Hygiene de la liste blanche : une exemption doit rester justifiee. Si ce test
    // casse, c'est une bonne nouvelle -> supprimer la ligne concernee.
    const obsolete = Object.keys(MOBILE_ONLY_SCREENS)
      .map((screenName) => {
        if (isWebRouteSupported(screenName)) {
          return `${screenName} : a desormais un motif web, retirer l'exemption`;
        }
        if (!registrations.has(screenName)) {
          return `${screenName} : n'est plus enregistre nulle part, retirer l'exemption`;
        }
        return null;
      })
      .filter(Boolean);

    expect(obsolete).toEqual([]);
  });

  test('chaque exemption mobile-only porte une raison lisible', () => {
    const withoutReason = Object.entries(MOBILE_ONLY_SCREENS)
      .filter(([, reason]) => typeof reason !== 'string' || reason.trim().length < 15)
      .map(([screenName]) => screenName);

    expect(withoutReason).toEqual([]);
  });
});
