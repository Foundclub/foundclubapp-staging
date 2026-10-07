import fs from 'fs';
import path from 'path';

import { parse } from '@babel/parser';

// ICÔNES — décision d'Adel du 01/10/2026 (« icône go ») : les icônes provisoires
// posées par le lot SANS-EMOJI (flèche gauche, stade, loupe, « ? » en texte) sont
// remplacées par des icônes faites pour leur place.
//
// Ce témoin lit le CODE de chaque endroit et vérifie que l'icône demandée à
// `SvgIcon` est la bonne. Il complète `SvgIcon.test.js` (l'icône existe dans la
// table) : une icône qui existe mais n'est demandée nulle part ne sert à rien, et
// un nom mal écrit ne lève aucune erreur — `SvgIcon` rend alors un vide.
//
// Pourquoi lire le code plutôt que monter l'écran : la conversation, la
// messagerie et le Match Center font 2 000 à 6 000 lignes chacun et ne
// s'affichent qu'avec un serveur, une session et une ligue moqués. La touche du
// pavé vidéo, elle, est vérifiée à l'écran (TrainingVideo.caracterisation).

const RACINE = path.resolve(__dirname, '..', '..', '..', '..', '..');
const SRC = path.join(RACINE, 'src');
const DOSSIERS_EXCLUS = ['__mocks__', '__tests__', 'node_modules', 'testSupport'];

const lire = (relatif) => parse(fs.readFileSync(path.join(RACINE, relatif), 'utf8'), {
  plugins: ['jsx'],
  sourceType: 'module',
});

const CLES_IGNOREES = new Set([
  'comments', 'end', 'extra', 'innerComments', 'leadingComments', 'loc', 'start',
  'trailingComments',
]);

/**
 * Parcourt l'arbre et appelle `visiter(noeud, ancetres)` sur chaque nœud.
 * @param {any} noeud le nœud courant
 * @param {(noeud: any, ancetres: any[]) => void} visiter la visite
 * @param {any[]} [ancetres] du plus proche au plus lointain
 */
const parcourir = (noeud, visiter, ancetres = []) => {
  if (!noeud || typeof noeud.type !== 'string') return;
  visiter(noeud, ancetres);
  const suivants = [noeud, ...ancetres];
  Object.keys(noeud).forEach((cle) => {
    if (CLES_IGNOREES.has(cle)) return;
    const valeur = noeud[cle];
    if (Array.isArray(valeur)) valeur.forEach((enfant) => parcourir(enfant, visiter, suivants));
    else if (valeur && typeof valeur === 'object') parcourir(valeur, visiter, suivants);
  });
};

/**
 * Les noms demandés à `SvgIcon` sous un nœud, dans l'ordre du code.
 * @param {any} racine le nœud
 * @returns {string[]} les noms (« <calculé> » quand le nom n'est pas écrit en clair)
 */
const nomsSvgIcon = (racine) => {
  const noms = [];
  parcourir(racine, (noeud) => {
    if (noeud.type !== 'JSXElement' || noeud.openingElement.name.name !== 'SvgIcon') return;
    const attribut = noeud.openingElement.attributes.find((a) => a.name && a.name.name === 'name');
    const valeur = attribut && attribut.value;
    const expression = valeur && valeur.expression;
    if (valeur && valeur.type === 'StringLiteral') noms.push(valeur.value);
    else if (expression && expression.type === 'StringLiteral') noms.push(expression.value);
    else noms.push('<calculé>');
  });
  return noms;
};

/**
 * Les icônes de l'endroit : en partant d'une ancre (un libellé, une fonction),
 * on remonte jusqu'au premier bloc qui contient au moins une `SvgIcon`.
 * @param {string} fichier chemin depuis la racine du dépôt
 * @param {(noeud: any) => boolean} estAncre reconnaît l'ancre
 * @returns {string[]} les noms demandés dans ce bloc ; vide si aucun
 */
const iconesAutourDe = (fichier, estAncre) => {
  const ancres = [];
  parcourir(lire(fichier), (noeud, ancetres) => {
    if (estAncre(noeud)) ancres.push([noeud, ...ancetres]);
  });
  if (ancres.length !== 1) throw new Error(`${fichier} : ${ancres.length} ancre(s) au lieu d'une`);
  const bloc = ancres[0].find((noeud) => nomsSvgIcon(noeud).length > 0);
  return bloc ? nomsSvgIcon(bloc) : [];
};

/**
 * Reconnaît l'appel `t('<clef>', …)`.
 * @param {string} clef la clé de traduction
 * @returns {(noeud: any) => boolean} le test
 */
const appelT = (clef) => (noeud) => noeud.type === 'CallExpression'
  && noeud.callee.type === 'Identifier' && noeud.callee.name === 't'
  && noeud.arguments[0] && noeud.arguments[0].value === clef;

/**
 * Reconnaît la constante `const <nom> = …`.
 * @param {string} nom son nom
 * @returns {(noeud: any) => boolean} le test
 */
const constante = (nom) => (noeud) => noeud.type === 'VariableDeclarator'
  && noeud.id.type === 'Identifier' && noeud.id.name === nom;

/**
 * Reconnaît le `case '<valeur>':` d'un switch.
 * @param {string} valeur la valeur du cas
 * @returns {(noeud: any) => boolean} le test
 */
const casDuSwitch = (valeur) => (noeud) => noeud.type === 'SwitchCase'
  && noeud.test && noeud.test.value === valeur;

describe('ICÔNES — chaque endroit demande la bonne icône', () => {
  it('2 · la pastille qui apparaît en glissant un message montre « répondre »', () => {
    // MSG1A (§3.3) — le rond du pack superpose DEUX disques (gris, puis cyan au seuil) :
    // la meme icone « repondre » sur chacun.
    expect(iconesAutourDe('src/views/Conversation.js', constante('renderReplySwipeAction')))
      .toEqual(['reply', 'reply']);
  });

  it('3 · l avatar d une conversation de ligue est un trophée', () => {
    // MSG1A (§3.13) — l'aiguillage des avatars de fil a quitte `Messaging.js` pour
    // `AvatarDuFil.js` (partage par la liste et l'en-tete du fil) : le temoin le suit.
    expect(iconesAutourDe('src/views/chat/AvatarDuFil.js', casDuSwitch('league_match')))
      .toEqual(['trophy']);
  });

  it('4 · « Recherche active » du Match Center montre le radar', () => {
    expect(iconesAutourDe(
      'src/views/league/match/MatchCenterScreen.js',
      appelT('matchCenterScreen.mission.radar.title'),
    )).toEqual(['radar']);
  });

  it('4 · « Recherche en cours » du Match Center montre le radar', () => {
    expect(iconesAutourDe(
      'src/views/league/match/MatchCenterScreen.js',
      appelT('matchCenterScreen.searching.title'),
    )).toEqual(['radar']);
  });

  it('7 · « Duel confirmé » est précédé des épées croisées', () => {
    expect(iconesAutourDe(
      'src/views/league/match/MatchCenterScreen.js',
      appelT('matchCenterScreen.found.duelConfirmed'),
    )).toEqual(['swords']);
  });

  it('8 · les deux ronds de l adversaire masqué du Match Center ont le blason mystère', () => {
    // Le rond à la place du blason : `isOpponentAnonymous ? <ici> : <TeamShield …>`,
    // dans la carte « Duel confirmé » (88 px) et dans la carte de l'adversaire trouvé (80 px).
    const estLeRond = (noeud) => noeud.type === 'ConditionalExpression'
      && noeud.test.type === 'Identifier' && noeud.test.name === 'isOpponentAnonymous'
      && noeud.alternate.type === 'JSXElement'
      && noeud.alternate.openingElement.name.name === 'TeamShield';
    const ronds = [];
    parcourir(lire('src/views/league/match/MatchCenterScreen.js'), (noeud) => {
      if (estLeRond(noeud)) ronds.push(noeud);
    });
    expect(ronds).toHaveLength(2);
    expect(ronds.map((rond) => nomsSvgIcon(rond.consequent)))
      .toEqual([['shield-question'], ['shield-question']]);
  });

  it('8 · « Adversaire mystère » de la carte Prochain match a le blason mystère', () => {
    expect(iconesAutourDe(
      'src/views/league/match/components/NextMatchCard.js',
      appelT('nextMatchCard.mysteryOpponent'),
    )).toEqual(['shield-question']);
  });
});

describe('ICÔNES — aucun nom d icône mal écrit dans l app', () => {
  /**
   * Les clés de la table `icons` de SvgIcon.js.
   * @returns {Set<string>} les noms connus
   */
  const nomsConnus = () => {
    const connus = new Set();
    parcourir(lire('src/components/atoms/SvgIcon/SvgIcon.js'), (noeud) => {
      if (noeud.type !== 'VariableDeclarator' || noeud.id.name !== 'icons') return;
      noeud.init.properties.forEach((p) => connus.add(p.key.name || p.key.value));
    });
    return connus;
  };

  const fichiersSrc = (dossier) => fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) {
      return DOSSIERS_EXCLUS.includes(e.name) ? [] : fichiersSrc(path.join(dossier, e.name));
    }
    return /\.(js|jsx)$/.test(e.name) && !/\.test\.js$/.test(e.name) ? [path.join(dossier, e.name)] : [];
  });

  it('chaque <SvgIcon name="…"> écrit en clair existe dans la table (sinon : un vide)', () => {
    const connus = nomsConnus();
    const inconnus = fichiersSrc(SRC).flatMap((fichier) => {
      const relatif = path.relative(RACINE, fichier).split(path.sep).join('/');
      return nomsSvgIcon(lire(relatif))
        .filter((nom) => nom !== '<calculé>' && !connus.has(nom))
        .map((nom) => `${relatif} : ${nom}`);
    });
    expect(inconnus).toEqual([]);
  });
});
