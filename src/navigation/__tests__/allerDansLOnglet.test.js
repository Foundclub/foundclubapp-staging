import fs from 'fs';
import path from 'path';

import allerDansLOnglet from '../allerDansLOnglet';
import { RouteNames } from '../routeNames';

/**
 * 🔴 LE DEFAUT QUE CE FILET FERME, mesure a l ecran le 2026-09-08.
 *
 * On repondait aux cinq questions de forme, on appuyait sur « Commencer ma seance »
 * — et RIEN. Le verdict partait bien au serveur, la seance passait « en cours »,
 * mais l ecran ne bougeait pas. Le journal de l appareil disait :
 *
 *   The action 'NAVIGATE' with payload {"name":"TrainingSessionNow",...}
 *   was not handled by any navigator. Do you have a screen named ... ?
 *
 * SIX navigations etaient mortes de la meme facon, dans quatre ecrans.
 *
 * 🔎 LA CAUSE. Les ecrans de TACHE vivent sur la pile RACINE — c est ce qui cache
 * le dock, et c est le motif maison. Les ecrans de CONSULTATION vivent dans
 * `SearchStack`, DEUX niveaux plus bas. `navigate` remonte vers les parents ; il ne
 * descend jamais chez un voisin.
 *
 * ⚠️ AUCUNE PORTE NE POUVAIT LE VOIR : ce n est ni une erreur de type, ni une regle
 * de style, ni un test de rendu — l ecran se monte parfaitement, c est le GESTE qui
 * ne mene nulle part. Seul un filet qui relit l ARBRE de navigation l attrape.
 */

const RACINE = path.join(__dirname, '..', 'private', 'PrivateNavigator.js');
const ONGLET = path.join(__dirname, '..', 'private', 'stacks', 'SearchStack.js');

/**
 * Les routes declarees par un fichier de navigation.
 * @param {string} fichier le chemin du fichier
 * @returns {Set<string>} les noms de routes qu il monte
 */
const routesDe = (fichier) => {
  const source = fs.readFileSync(fichier, 'utf8');
  return new Set([...source.matchAll(/name=\{RouteNames\.(\w+)\}/g)].map((m) => m[1]));
};

describe('la forme imbriquee', () => {
  it('nomme le chemin complet : onglet d accueil, puis la pile, puis l ecran', () => {
    const navigation = { navigate: jest.fn() };

    allerDansLOnglet(navigation, RouteNames.TrainingSessionNow, { sessionId: 'abc' });

    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.HomeTab, {
      params: { params: { sessionId: 'abc' }, screen: RouteNames.TrainingSessionNow },
      screen: RouteNames.Search,
    });
  });

  it('accepte un ecran sans parametre', () => {
    const navigation = { navigate: jest.fn() };

    allerDansLOnglet(navigation, RouteNames.TrainingVideoQueue);

    expect(navigation.navigate.mock.calls[0][1].params.params).toBeUndefined();
  });
});

describe('🚨 AUCUN ECRAN DE LA RACINE N APPELLE DIRECTEMENT UN ECRAN D ONGLET', () => {
  const surLaRacine = routesDe(RACINE);
  const dansLOnglet = routesDe(ONGLET);

  /*
   * NAVMORTE (2026-09-11) -- la liste des ecrans surveilles etait ECRITE A LA MAIN
   * (cinq ecrans d entrainement). « C est dans ton entrainement » a ete monte sur la
   * racine la meme nuit sans y etre ajoute : ses deux boutons ne faisaient RIEN sur
   * iPhone, et ce filet restait vert. Les ecrans de la racine ET les routes de TOUS
   * les onglets sont donc desormais LUS dans les fichiers de navigation : un ecran
   * ajoute a la racine demain est surveille sans que personne n y pense.
   */
  const DOSSIER_NAVIGATION = path.join(__dirname, '..', 'private');
  const SOURCES = path.join(__dirname, '..', '..');

  /**
   * Toutes les routes montees dans un navigateur imbrique (onglets et piles).
   * @returns {Set<string>} les noms de routes
   */
  const routesDesOnglets = () => {
    const fichiers = [
      path.join(DOSSIER_NAVIGATION, 'PrivateTabNavigator.js'),
      path.join(DOSSIER_NAVIGATION, 'LeagueTabNavigator.js'),
      // La pile LEAGUE vit HORS de private/ : sans elle, « Voir tout » de
      // l historique des matchs (MatchHistoryScreen) echappait au filet.
      path.join(DOSSIER_NAVIGATION, '..', 'LeagueNavigator.js'),
      ...fs.readdirSync(path.join(DOSSIER_NAVIGATION, 'stacks'))
        .filter((nom) => nom.endsWith('.js'))
        .map((nom) => path.join(DOSSIER_NAVIGATION, 'stacks', nom)),
    ];
    const routes = new Set();
    fichiers.forEach((fichier) => routesDe(fichier).forEach((route) => routes.add(route)));
    return routes;
  };

  /**
   * Resout un chemin d import ('@/views/x' ou relatif) vers un fichier existant.
   * @param {string} specifieur le chemin tel qu ecrit dans l import
   * @returns {string | undefined} le fichier, s il existe
   */
  const resoudre = (specifieur) => {
    const base = specifieur.startsWith('@/')
      ? path.join(SOURCES, specifieur.slice(2))
      : path.resolve(DOSSIER_NAVIGATION, specifieur);
    return ['.js', '.native.js', '/index.js']
      .map((suffixe) => `${base}${suffixe}`)
      .find((candidat) => fs.existsSync(candidat));
  };

  /**
   * Les fichiers des ecrans montes sur la racine, par getComponent ou par component={X}.
   * @returns {string[]} leurs chemins
   */
  const ecransDeLaRacine = () => {
    const source = fs.readFileSync(RACINE, 'utf8');
    const imports = new Map(
      [...source.matchAll(/import\s+(\w+)\s+from\s+'([^']+)'/g)].map((m) => [m[1], m[2]]),
    );
    const specifieurs = [
      ...[...source.matchAll(/getComponent=\{\(\) => require\('([^']+)'\)/g)].map((m) => m[1]),
      ...[...source.matchAll(/component=\{(\w+)\}/g)].map((m) => imports.get(m[1])).filter(Boolean),
    ];
    return [...new Set(specifieurs)]
      .filter((specifieur) => specifieur.includes('/views/'))
      .map((specifieur) => resoudre(specifieur))
      .filter(Boolean);
  };

  const relatif = (fichier) => path.relative(SOURCES, fichier).split(path.sep).join('/');
  const ongletsLus = routesDesOnglets();
  const ecrans = ecransDeLaRacine();

  it('les piles et les ecrans sont bien lus (sinon ce filet ne mesure rien)', () => {
    // Un filet qui lit un fichier deplace passerait au vert sans rien verifier.
    expect(surLaRacine.size).toBeGreaterThan(20);
    expect(dansLOnglet.size).toBeGreaterThan(10);
    expect(surLaRacine.has('TrainingFreshness')).toBe(true);
    expect(dansLOnglet.has('TrainingSessionNow')).toBe(true);
    expect(ongletsLus.size).toBeGreaterThan(dansLOnglet.size);
    expect(ongletsLus.has('MatchHistoryScreen')).toBe(true);
    expect(ecrans.length).toBeGreaterThan(40);
    expect(ecrans.map(relatif)).toEqual(expect.arrayContaining([
      'views/training/TrainingEnrolled.js',
      'views/training/TrainingFreshness.js',
      'views/training/TrainingGuided.js',
    ]));
  });

  it('aucun ecran de la racine ne vise un ecran d onglet en direct', () => {
    const morts = ecrans.flatMap((fichier) => {
      const source = fs.readFileSync(fichier, 'utf8');
      // `\s*` : un appel ecrit sur plusieurs lignes (« Passer ce test aujourd hui »,
      // TrainingGuided) passait sous l ancienne expression, qui l exigeait sur une seule.
      return [...source.matchAll(/navigation\.navigate\(\s*RouteNames\.(\w+)/g)]
        .map((m) => m[1])
        .filter((route) => ongletsLus.has(route) && !surLaRacine.has(route))
        .map((route) => `${relatif(fichier)} -> ${route}`);
    });

    // Le message porte l ecran ET la route : sur le terrain, c est ce qu on cherche.
    expect(morts).toEqual([]);
  });
});
