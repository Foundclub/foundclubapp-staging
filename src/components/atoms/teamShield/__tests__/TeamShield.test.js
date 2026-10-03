import { Image } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TeamShield from '../TeamShield';

// D70 (E6) — LE FILET DE L'ECUSSON PARTAGE.
//
// Retour d'Adel du 2026-08-11 : « avec un club qui A un logo, ca garde les
// shields au lieu de mettre le logo du club ».
//
// `TeamShield` est importe par 21 fichiers et n'avait AUCUN test. C'est l'atome
// le plus partage de cette famille, et il etait structurellement incapable de
// montrer une image : il rendait toujours `Images.shield` avec des initiales
// par-dessus. Ce fichier est le filet qu'on pose AVANT de l'elargir.
//
// LA REGLE, ecrite avant le code :
//   L'embleme de l'equipe s'il existe, SINON les initiales sur l'ecusson.
//
// ⚠️ ET LE REPLI EST LE CAS NORMAL, PAS LE CAS D'ERREUR. Sur staging la
// plupart des clubs n'ont pas de logo. Les deux premiers blocs figent donc la
// QUALITE du repli — c'est ce que voit la majorite — et le troisieme protege
// les 21 appelants qui ne passeront jamais d'image.
//
// 🧩 REPARTITION DES ROLES, mesuree et volontaire :
//   - le LOGO DU CLUB reste l'affaire de `ClubLogoMark` (deja teste, deja
//     branche sur ~20 ecrans). On ne le duplique pas ici.
//   - l'EMBLEME DE L'EQUIPE (le `crest` d'une squad) est l'affaire de
//     `TeamShield` : c'est l'objet qu'il represente.
//
// Discipline du projet : on pilote par ce qui est RENDU, le theme est monte
// avec les VRAIS modules (jamais un Proxy, qui rend les echecs Jest illisibles).

jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const genererStyle = jest.requireActual('@/theme/applicationStyle').default;
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererImages = jest.requireActual('@/theme/images').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: genererStyle(Colors),
      Colors,
      Fonts: genererPolices(Colors),
      Images: genererImages('dark'),
      Spaces,
    }),
  };
});

jest.mock('@/utils/imageUrl', () => ({
  __esModule: true,
  default: (/** @type {string} */ url) => url || undefined,
  getImageUrl: (/** @type {string} */ url) => url || undefined,
}));

const CREST = 'https://exemple.test/crest-squad.png';

// 🧭 FINITIONS11-COLL (03/10), point 6 — L EMPREINTE NE DEPEND PLUS DE LA COPIE DE TRAVAIL.
// Le transformeur d images de jest ecrit `testUri` en chemin RELATIF, depuis react-native dans le
// node_modules PARTAGE (D:/App/fc/app) : la copie principale lit « ../../../src/… », une copie
// `.worktrees/<lot>` lit « ../../../../.worktrees/<lot>/src/… », et les 13 empreintes du temoin 3
// rougissaient sans que rien n ait change. Le chemin est ramene a sa forme de la copie principale
// A PARTIR de `src/` : l image comparee reste la meme (`src/assets/icons/shield.png`), seul le
// chemin vers la copie est neutralise. Dans la copie principale, rien ne change (deja a sa forme).
const FORME_PRINCIPALE = '../../../';
const cheminDeLaCopiePrincipale = (/** @type {string} */ testUri) => {
  const chemin = testUri.replace(/\\/g, '/');
  const debut = chemin.lastIndexOf('/src/');
  return debut === -1 ? chemin : `${FORME_PRINCIPALE}${chemin.slice(debut + 1)}`;
};
expect.addSnapshotSerializer({
  serialize: (valeur, config, indentation, profondeur, refs, printer) => printer(
    { ...valeur, testUri: cheminDeLaCopiePrincipale(valeur.testUri) },
    config,
    indentation,
    profondeur,
    refs,
  ),
  test: (valeur) => Boolean(valeur)
    && typeof valeur === 'object'
    && typeof valeur.testUri === 'string'
    && cheminDeLaCopiePrincipale(valeur.testUri) !== valeur.testUri,
});

const rendre = (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    arbre = renderer.create(<TeamShield {...props} />);
  });
  return arbre;
};

/**
 * Le texte visible, aplati — jamais la forme de l'arbre.
 * @param {any} noeud - Noeud rendu.
 * @param {string[]} [acc] - Accumulateur.
 * @returns {string[]} Les morceaux de texte.
 */
const collecterTextes = (noeud, acc = []) => {
  if (noeud === null || noeud === undefined) return acc;
  if (typeof noeud === 'string') {
    acc.push(noeud);
    return acc;
  }
  if (Array.isArray(noeud)) {
    noeud.forEach((enfant) => collecterTextes(enfant, acc));
    return acc;
  }
  collecterTextes(noeud.children, acc);
  return acc;
};

const texteVisible = (/** @type {any} */ arbre) => collecterTextes(arbre.toJSON()).join('\n');

const sourcesImages = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(Image)
  .map((/** @type {any} */ noeud) => noeud.props.source);

// ---------------------------------------------------------------------------
// TEMOIN 2 (et il passe en premier, parce que c'est le cas NORMAL)
// ---------------------------------------------------------------------------

describe('D70 · temoin 2 — sans image, les INITIALES, et elles restent impeccables', () => {
  it('rend les initiales demandees, en majuscules', () => {
    expect(texteVisible(rendre({ initials: 'om' }))).toContain('OM');
  });

  it('coupe a 3 lettres, jamais plus', () => {
    expect(texteVisible(rendre({ initials: 'RCVERNON' }))).toContain('RCV');
  });

  it('retire les espaces au lieu de les afficher', () => {
    expect(texteVisible(rendre({ initials: 'U 15' }))).toContain('U15');
  });

  it('sans initiales du tout : « ? », et jamais « undefined »', () => {
    const texte = texteVisible(rendre({}));
    expect(texte).toContain('?');
    expect(texte).not.toContain('undefined');
  });

  it('garde l\'ecusson dessine sous les initiales', () => {
    expect(sourcesImages(rendre({ initials: 'FC' }))).toHaveLength(1);
  });
});

describe('D70 · temoin 2 bis — la taille et les variantes du repli ne bougent pas', () => {
  const tailleRacine = (/** @type {any} */ props) => {
    const racine = rendre(props).toJSON();
    const aplati = [racine.props.style].flat(Infinity).filter(Boolean);
    return aplati.reduce(
      (/** @type {any} */ acc, /** @type {any} */ couche) => (
        typeof couche?.height === 'number' ? couche.height : acc
      ),
      undefined,
    );
  };

  it('par defaut l\'ecusson fait 90', () => {
    expect(tailleRacine({ initials: 'FC' })).toBe(90);
  });

  it('« isSmall » le met a 60', () => {
    expect(tailleRacine({ initials: 'FC', isSmall: true })).toBe(60);
  });

  it('une taille explicite gagne sur « isSmall »', () => {
    expect(tailleRacine({ initials: 'FC', isSmall: true, size: 32 })).toBe(32);
  });

  it('les 3 variantes de couleur restent 3 rendus DIFFERENTS', () => {
    const parDefaut = JSON.stringify(rendre({ initials: 'FC' }).toJSON());
    const dore = JSON.stringify(rendre({ initials: 'FC', isGold: true }).toJSON());
    const neutre = JSON.stringify(rendre({ initials: 'FC', isNeutral: true }).toJSON());

    expect(dore).not.toBe(parDefaut);
    expect(neutre).not.toBe(parDefaut);
    expect(dore).not.toBe(neutre);
  });
});

// ---------------------------------------------------------------------------
// TEMOIN 1 — ce que le lot ajoute
// ---------------------------------------------------------------------------

describe('D70 · temoin 1 — une equipe qui a un embleme AFFICHE cet embleme', () => {
  it('rend l\'image fournie', () => {
    const sources = sourcesImages(rendre({ imageUrl: CREST, initials: 'FC' }));
    expect(sources).toContainEqual({ uri: CREST });
  });

  it('n\'affiche plus les initiales par-dessus l\'embleme', () => {
    expect(texteVisible(rendre({ imageUrl: CREST, initials: 'FC' }))).not.toContain('FC');
  });

  it('ne dessine plus l\'ecusson de repli sous l\'embleme', () => {
    expect(sourcesImages(rendre({ imageUrl: CREST, initials: 'FC' }))).toHaveLength(1);
  });

  it('garde la taille demandee par l\'appelant', () => {
    const racine = rendre({ imageUrl: CREST, initials: 'FC', size: 62 }).toJSON();
    const aplati = [racine.props.style].flat(Infinity).filter(Boolean);
    const hauteur = aplati.reduce(
      (/** @type {any} */ acc, /** @type {any} */ couche) => (
        typeof couche?.height === 'number' ? couche.height : acc
      ),
      undefined,
    );
    expect(hauteur).toBe(62);
  });

  it('une image VIDE retombe sur les initiales — le repli reste le defaut', () => {
    expect(texteVisible(rendre({ imageUrl: '', initials: 'FC' }))).toContain('FC');
  });

  it('une image ABSENTE retombe sur les initiales', () => {
    expect(texteVisible(rendre({ imageUrl: undefined, initials: 'FC' }))).toContain('FC');
  });
});

// ---------------------------------------------------------------------------
// TEMOIN 3 — LE PLUS IMPORTANT : les 21 appelants ne bougent pas
// ---------------------------------------------------------------------------

describe('D70 · temoin 3 — les appelants qui ne passent PAS d\'image ne changent pas', () => {
  // Les formes ci-dessous sont celles REELLEMENT presentes dans le depot au
  // 2026-08-11. L'empreinte est enregistree AVANT l'elargissement du composant :
  // si le rendu d'un seul de ces appelants bouge, la porte devient rouge.
  it.each([
    ['MultisportSectionsList — initiales + isSmall', { initials: 'US', isSmall: true }],
    ['CMTeamsScreen — initiales + isSmall', { initials: 'RC', isSmall: true }],
    ['RankingScreen — dore, 32', { initials: 'OM', isGold: true, size: 32 }],
    ['LeagueDashboard — dore, 44', { initials: 'OM', isGold: true, size: 44 }],
    ['NextMatchCard — dore, 50', { initials: 'OM', isGold: true, size: 50 }],
    ['EndMatchScreen — dore, 60', { initials: 'OM', isGold: true, size: 60 }],
    ['PastMatchDetails — dore, 62', { initials: 'OM', isGold: true, size: 62 }],
    ['LeagueMatchDetails — dore, 68', { initials: 'OM', isGold: true, size: 68 }],
    ['SquadDetailsScreen — dore, 72', { initials: 'OM', isGold: true, size: 72 }],
    ['TeamListContent — dore, 80', { initials: 'OM', isGold: true, size: 80 }],
    ['ClubLogoMark — neutre, taille explicite', { initials: 'USA', isNeutral: true, size: 60 }],
    ['une seule lettre', { initials: 'A' }],
    ['trois lettres', { initials: 'USA' }],
  ])('%s rend exactement ce qu\'il rendait', (_libelle, props) => {
    expect(rendre(props).toJSON()).toMatchSnapshot();
  });

  it('FIN11-COLL/6 le chemin de l ecusson se lit pareil dans toute copie, image comparee', () => {
    const image = 'src/assets/icons/shield.png';
    expect(cheminDeLaCopiePrincipale(`../../../${image}`)).toBe(`../../../${image}`);
    expect(cheminDeLaCopiePrincipale(`../../../../.worktrees/PERMS-app/${image}`))
      .toBe(`../../../${image}`);
    expect(cheminDeLaCopiePrincipale(
      `..\\..\\..\\..\\.claude\\worktrees\\x\\.worktrees\\FIN11-COLL-app\\${image.replace(/\//g, '\\')}`,
    )).toBe(`../../../${image}`);
    // Une AUTRE image ne se confond jamais avec l ecusson : seul le chemin vers la copie tombe.
    expect(cheminDeLaCopiePrincipale('../../../../.worktrees/X-app/src/assets/icons/ball.png'))
      .toBe('../../../src/assets/icons/ball.png');
  });
});
