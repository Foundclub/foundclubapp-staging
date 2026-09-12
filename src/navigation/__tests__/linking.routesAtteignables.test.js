import fs from 'fs';
import path from 'path';

import { getStateFromPath } from '@react-navigation/native';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import AppNavigator from '../appNavigator';

/**
 * MECANISME 3 (NAVMORTE2, 2026-09-11) -- un lien profond vers un club ne mene
 * nulle part quand on est connecte.
 *
 * appNavigator.js declare `Club: 'club/:clubId'` au PREMIER niveau de la config
 * linking. Connecte, `Club` n est monte que dans ClubStack
 * (private/stacks/ClubStack.js), jamais sur la pile racine
 * (private/PrivateNavigator.js). A la reception du lien, React Navigation fait
 * (node_modules/@react-navigation/native/src/useLinking.native.tsx:188-190) :
 *
 *   if (state.routes.some((r) => !rootState?.routeNames.includes(r.name))) return;
 *
 * -> aucune action, aucun message : l ecran ne bouge pas. Application fermee, la
 * pile racine filtre la route inconnue et ouvre l accueil
 * (node_modules/@react-navigation/routers/src/StackRouter.tsx:207-208, 239-249).
 *
 * AUCUNE PORTE NE LE VOIT : la config est un objet valide, l ecran existe, c est
 * l ADRESSE qui ne descend pas dans la bonne pile. Ce filet rejoue ce que fait la
 * bibliotheque, pour chaque motif et pour chaque mode : le VRAI getStateFromPath
 * sur la VRAIE config passee par appNavigator.js au NavigationContainer, puis la
 * garde de useLinking.native.tsx:189 contre les routes LUES dans le fichier
 * racine, puis, niveau par niveau, les routes du navigateur imbrique vise.
 *
 * Un meme motif ne peut pas viser deux ecrans (getStateFromPath.tsx:323-330) :
 * connecte et deconnecte ont donc chacun leur forme, comme TeamDetails
 * (appNavigator.js:65-81). Les deux modes sont mesures ici.
 */

const mockLinkings = /** @type {any[]} */ ([]);
let mockEtatApp = /** @type {any} */ ({ auth: null, isAddingAccount: false });

// Le conteneur ne sert qu a lire la config telle qu appNavigator la lui passe.
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  __esModule: true,
  NavigationContainer: (/** @type {any} */ props) => {
    mockLinkings.push(props.linking);
    return null;
  },
}));
jest.mock('@/store/appContext', () => ({
  __esModule: true,
  useAppContext: () => [mockEtatApp],
}));
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    ApplicationStyle: { darkNavigationTheme: {}, lightNavigationTheme: {} },
    Colors: {},
    scheme: 'light',
  }),
}));
jest.mock('@/utils/logger/logger', () => ({
  __esModule: true,
  createLogger: () => ({
    debug: () => {}, error: () => {}, info: () => {}, warn: () => {},
  }),
}));
jest.mock('@/navigation/navigationService', () => ({
  __esModule: true,
  navigationRef: { getCurrentRoute: () => null },
}));
jest.mock('@/components/molecules/tour/TourBanner', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/navigation/private/PrivateNavigator', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../public/PublicMainNavigator', () => ({
  __esModule: true,
  default: () => null,
}));

const NAVIGATION = path.join(__dirname, '..');
const SOURCES = path.join(NAVIGATION, '..');
const RACINE_CONNECTEE = path.join(NAVIGATION, 'private', 'PrivateNavigator.js');
const RACINE_DECONNECTEE = path.join(NAVIGATION, 'public', 'PublicMainNavigator.js');

const CONNECTE = { auth: { token: 'jeton-temoin' }, isAddingAccount: false };
const DECONNECTE = { auth: null, isAddingAccount: false };
const AJOUT_DE_COMPTE = { auth: { token: 'jeton-temoin' }, isAddingAccount: true };

/**
 * Le chemin d un fichier, lu depuis src/.
 * @param {string} fichier un chemin absolu
 * @returns {string} le chemin depuis src/, en barres obliques
 */
const relatif = (fichier) => path.relative(SOURCES, fichier).split(path.sep).join('/');

/**
 * Les routes montees par un fichier de navigation (meme lecture que
 * allerDansLOnglet.test.js). Un ecran conditionnel (AdminStack) compte comme monte.
 * @param {string} fichier le chemin du fichier
 * @returns {Set<string>} les noms de routes
 */
const routesDe = (fichier) => new Set(
  [...fs.readFileSync(fichier, 'utf8').matchAll(/name=\{RouteNames\.(\w+)\}/g)].map((m) => m[1]),
);

/**
 * Resout un chemin d import ('@/x' ou relatif) vers un fichier existant.
 * @param {string} specifieur le chemin tel qu ecrit dans l import ou le require
 * @param {string} dossier le dossier du fichier qui l ecrit
 * @returns {string | undefined} le fichier, s il existe
 */
const resoudre = (specifieur, dossier) => {
  const base = specifieur.startsWith('@/')
    ? path.join(SOURCES, specifieur.slice(2))
    : path.resolve(dossier, specifieur);
  return ['.js', '.native.js', '/index.js']
    .map((suffixe) => `${base}${suffixe}`)
    .find((candidat) => fs.existsSync(candidat));
};

/**
 * Pour chaque route d un fichier de navigation, le fichier qu elle monte
 * (getComponent={() => require('...')} ou component={X} importe).
 * @param {string} fichier le chemin du fichier de navigation
 * @returns {Map<string, string>} route -> fichier monte
 */
const montagesDe = (fichier) => {
  const source = fs.readFileSync(fichier, 'utf8');
  const imports = new Map(
    [...source.matchAll(/import\s+(\w+)\s+from\s+'([^']+)'/g)].map((m) => [m[1], m[2]]),
  );
  const montages = new Map();
  source.split(/<\w+\.Screen\b/).slice(1).forEach((bloc) => {
    const nom = bloc.match(/name=\{RouteNames\.(\w+)\}/)?.[1];
    const composant = bloc.match(/\bcomponent=\{(\w+)\}/)?.[1];
    const specifieur = bloc.match(/getComponent=\{\(\) => require\('([^']+)'\)/)?.[1]
      ?? (composant ? imports.get(composant) : undefined);
    const cible = specifieur ? resoudre(specifieur, path.dirname(fichier)) : undefined;
    if (nom && cible) montages.set(nom, cible);
  });
  return montages;
};

const FICHIERS_NAVIGATION = ['private', path.join('private', 'stacks'), 'public']
  .flatMap((dossier) => fs.readdirSync(path.join(NAVIGATION, dossier))
    .filter((nom) => nom.endsWith('.js'))
    .map((nom) => path.join(NAVIGATION, dossier, nom)))
  .concat(path.join(NAVIGATION, 'LeagueNavigator.js'));

/**
 * Les fichiers de navigation qui montent une route : dit OU vit l ecran vise.
 * @param {string} route un nom de route
 * @returns {string} les fichiers, separes par des virgules
 */
const declarePar = (route) => FICHIERS_NAVIGATION
  .filter((fichier) => routesDe(fichier).has(route))
  .map(relatif)
  .join(', ') || 'aucun fichier de navigation';

/**
 * Tous les motifs declares, niveaux imbriques compris.
 * @param {Record<string, any>} screens le champ `screens` d une config linking
 * @param {string} [parent] le motif du navigateur parent
 * @returns {string[]} les motifs complets
 */
const motifsDe = (screens, parent = '') => Object.values(screens).flatMap((valeur) => {
  if (typeof valeur === 'string') return [[parent, valeur].filter(Boolean).join('/')];
  const aUnChemin = typeof valeur?.path === 'string';
  const debut = valeur?.exact ? '' : parent;
  const propre = aUnChemin ? [debut, valeur.path].filter(Boolean).join('/') : parent;
  return [
    ...(aUnChemin ? [propre] : []),
    ...(valeur?.screens ? motifsDe(valeur.screens, propre) : []),
  ];
});

/**
 * Un chemin concret pour un motif : chaque parametre devient `id-1`.
 * @param {string} motif ex. 'club/:clubId'
 * @returns {string} ex. 'club/id-1'
 */
const cheminExemple = (motif) => motif.split('/')
  .map((segment) => (segment.startsWith(':') ? 'id-1' : segment))
  .join('/');

/**
 * Les liens declares que React Navigation abandonnerait, avec l ecran vise et
 * le fichier ou il est reellement monte.
 * @param {{ screens: Record<string, any> }} config la config linking
 * @param {string} racine le fichier du navigateur racine du mode
 * @returns {string[]} un message par lien mort
 */
const liensMorts = (config, racine) => motifsDe(config.screens).flatMap((motif) => {
  const lien = `foundclub://${cheminExemple(motif)}`;
  const etat = /** @type {any} */ (getStateFromPath(cheminExemple(motif), config));
  if (!etat) return [`${lien} : aucun ecran ne correspond au motif`];

  const noms = /** @type {string[]} */ ([]);
  let niveau = etat;
  while (niveau?.routes?.length) {
    const route = niveau.routes[niveau.routes.length - 1];
    noms.push(route.name);
    niveau = route.state;
  }
  const chaine = noms.join(' > ');
  const ecran = noms[noms.length - 1];
  /**
   * Le message d un lien mort.
   * @param {string} route la route manquante
   * @param {string} fichier le navigateur ou elle manque
   * @returns {string[]} le message
   */
  const mort = (route, fichier) => [
    `${lien} -> ${chaine} : ${route} n est pas monte dans ${relatif(fichier)}`
      + ` (${ecran} est monte dans : ${declarePar(ecran)})`,
  ];

  // Niveau 0 : la garde de useLinking.native.tsx:189, telle quelle.
  const racineLue = routesDe(racine);
  const absente = etat.routes.find((/** @type {any} */ route) => !racineLue.has(route.name));
  if (absente) return mort(absente.name, racine);

  // Niveaux suivants : le navigateur imbrique doit monter l ecran vise.
  let fichier = racine;
  for (let i = 1; i < noms.length; i += 1) {
    const suivant = montagesDe(fichier).get(noms[i - 1]);
    if (!suivant) {
      const ou = relatif(fichier);
      return [`${lien} -> ${chaine} : navigateur ${noms[i - 1]} introuvable dans ${ou}`];
    }
    fichier = suivant;
    if (!routesDe(fichier).has(noms[i])) return mort(noms[i], fichier);
  }
  return [];
});

/**
 * Monte appNavigator.js dans un etat d authentification et rend la config linking
 * qu il passe au NavigationContainer.
 * @param {any} etatApp { auth, isAddingAccount }
 * @returns {{ screens: Record<string, any> }} la config
 */
const configDuMode = (etatApp) => {
  mockEtatApp = etatApp;
  mockLinkings.length = 0;
  act(() => {
    renderer.create(createElement(AppNavigator, {
      navigationIntegration: { registerNavigationContainer: () => {} },
    }));
  });
  return mockLinkings[mockLinkings.length - 1]?.config;
};

describe('liens foundclub:// -- le filet mesure vraiment', () => {
  it('lit la config de CHAQUE mode dans appNavigator.js, et les deux racines', () => {
    const connecte = configDuMode(CONNECTE);
    const deconnecte = configDuMode(DECONNECTE);

    // Les deux branches de appNavigator.js:71-81 ont bien ete prises.
    expect(Object.keys(connecte.screens)).toContain('TeamStack');
    expect(Object.keys(deconnecte.screens)).toContain('TeamDetails');
    // Ajout de compte (jeton + isAddingAccount) : racine publique, config publique.
    expect(configDuMode(AJOUT_DE_COMPTE)).toEqual(deconnecte);
    expect(motifsDe(connecte.screens)).toEqual(expect.arrayContaining(
      ['club/:clubId', 'event/:eventId', 'squad/:teamId', 'team/:teamId'],
    ));
    expect(motifsDe(deconnecte.screens)).toEqual(expect.arrayContaining(
      ['club/:clubId', 'event/:eventId', 'login', 'register', 'squad/:teamId', 'team/:teamId'],
    ));

    const racineConnectee = routesDe(RACINE_CONNECTEE);
    expect(racineConnectee.size).toBeGreaterThan(50);
    expect([...racineConnectee]).toEqual(expect.arrayContaining(
      ['HomeTab', 'ClubStack', 'EventStack', 'TeamStack', 'SquadDetails'],
    ));
    const clubStack = montagesDe(RACINE_CONNECTEE).get('ClubStack');
    expect(clubStack && relatif(clubStack)).toBe('navigation/private/stacks/ClubStack.js');
    expect(clubStack && routesDe(clubStack).has('Club')).toBe(true);

    expect([...routesDe(RACINE_DECONNECTEE)]).toEqual(expect.arrayContaining(
      ['PublicAuthStack', 'HomeTab', 'Club', 'EventDetails', 'TeamDetails', 'SquadDetails'],
    ));
    const pileAuth = montagesDe(RACINE_DECONNECTEE).get('PublicAuthStack');
    expect(pileAuth && relatif(pileAuth)).toBe('navigation/public/AuthStackNavigator.js');
  });

  it('le contrat separe un lien mort d un lien imbrique (temoin du temoin)', () => {
    const auPremierNiveau = { screens: { Club: 'club/:clubId' } };
    const sousSaPile = { screens: { ClubStack: { screens: { Club: 'club/:clubId' } } } };
    const pileFausse = { screens: { ClubStack: { screens: { Inexistant: 'club/:clubId' } } } };

    expect(liensMorts(auPremierNiveau, RACINE_CONNECTEE)).toHaveLength(1);
    expect(liensMorts(sousSaPile, RACINE_CONNECTEE)).toEqual([]);
    expect(liensMorts(pileFausse, RACINE_CONNECTEE)).toHaveLength(1);
    expect(liensMorts(auPremierNiveau, RACINE_DECONNECTEE)).toEqual([]);
  });

  it('aucun motif ne vise deux ecrans a la fois (getStateFromPath leverait)', () => {
    [CONNECTE, DECONNECTE].forEach((etatApp) => {
      const config = configDuMode(etatApp);
      expect(() => getStateFromPath('club/id-1', config)).not.toThrow();
    });
  });
});

describe('CONNECTE -- racine privee (PrivateNavigator.js)', () => {
  it('MECANISME 3 : foundclub://club/<id> ouvre la fiche du club', () => {
    const morts = liensMorts(configDuMode(CONNECTE), RACINE_CONNECTEE)
      .filter((message) => message.startsWith('foundclub://club/'));

    expect(morts).toEqual([]);
  });

  it('aucun lien declare pour le mode connecte n est abandonne', () => {
    expect(liensMorts(configDuMode(CONNECTE), RACINE_CONNECTEE)).toEqual([]);
  });
});

describe('DECONNECTE -- racine publique (PublicMainNavigator.js)', () => {
  it('club, equipe et squad atterrissent aujourd hui : le correctif doit les garder', () => {
    const morts = liensMorts(configDuMode(DECONNECTE), RACINE_DECONNECTEE)
      .filter((message) => /^foundclub:\/\/(club|team|squad)\//.test(message));

    expect(morts).toEqual([]);
  });

  it('aucun lien declare pour le mode deconnecte n est abandonne', () => {
    expect(liensMorts(configDuMode(DECONNECTE), RACINE_DECONNECTEE)).toEqual([]);
  });
});

/**
 * L objet linking ENTIER passe au NavigationContainer : sa config ET son filtre.
 * @param {any} etatApp { auth, isAddingAccount }
 * @returns {any} l objet linking
 */
const linkingDuMode = (etatApp) => {
  configDuMode(etatApp);
  return mockLinkings[mockLinkings.length - 1];
};

// NAVMORTE2, relecture adverse, constat 3. Une adresse foundclub://<sujet>/<id>?invite=true
// est lue par DEUX ecouteurs : React Navigation, et la fenetre d invitation
// (InvitationLinkHost.js:152-160), dont la regle est « lire un lien ne fait RIEN »
// (InvitationLinkHost.js:7-10) : on n emmene sur l ecran qu apres l appui. En rendant
// club/ (connecte) et event/ (public) atteignables, React Navigation ouvrait l ecran
// AVANT la reponse. La page d installation fabrique ces liens, et club, squad, equipe
// y sont TOUJOURS des invitations (admin/public/install.html:136-141). Le seul juge
// d une invitation est readInviteLink (inviteLink.js:2) : React Navigation ne prend
// que ce qu il refuse.
describe('🔒 UN LIEN D INVITATION ATTEND LA REPONSE -- React Navigation le laisse passer', () => {
  const INVITATIONS = [
    'foundclub://club/c-1?invite=true',
    'foundclub://event/e-1?invite=true',
    'foundclub://squad/s-1?invite=true',
    'foundclub://team/t-1?invite=true',
  ];
  const LIENS_ORDINAIRES = [
    'foundclub://club/c-1',
    'foundclub://event/e-1',
    'foundclub://team/t-1',
  ];

  it.each([
    ['connecte', CONNECTE],
    ['deconnecte', DECONNECTE],
    ['ajout de compte', AJOUT_DE_COMPTE],
  ])('%s : aucune invitation n est prise, les liens ordinaires si', (_mode, etatApp) => {
    const { filter } = linkingDuMode(etatApp);
    /**
     * Ce que React Navigation accepte de traiter (sans filtre : tout).
     * @param {string} url l adresse recue
     * @returns {boolean} vrai si React Navigation la prend
     */
    const prend = (url) => typeof filter !== 'function' || filter(url);

    expect({
      invitationsPrises: INVITATIONS.filter(prend),
      ordinairesPris: LIENS_ORDINAIRES.filter(prend),
    }).toEqual({
      invitationsPrises: [],
      ordinairesPris: LIENS_ORDINAIRES,
    });
  });
});
