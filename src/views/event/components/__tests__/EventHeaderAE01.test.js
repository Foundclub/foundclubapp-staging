import renderer, { act } from 'react-test-renderer';

import EventHeader from '../EventHeader';

// Lot AE01 — « chaque type porte SON fond et SON titre » (planche 03 du pack
// de design « detail evenement »).
// Ce fichier COMPLETE EventHeaderAD09.test.js sans y toucher : AD09 ne
// temoigne que de l'accent de l'installation (couleur, lisere, pastille du
// lieu). Ni le fond, ni le titre principal n'y avaient de temoin — or c'est
// exactement ce que ce lot deplace. Le filet manquait ici, il est pose ici (E6).

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);

// Meme mock de theme qu'AD09 : le vrai theme construit
// `Fonts.<jeton de couleur>` = { color: valeur } et
// `ApplicationStyle.backgroundColor.<jeton>` = { backgroundColor: valeur }.
// Des Proxy a formes PRECISES, jamais un attrape-tout : un attrape-tout rend
// les echecs illisibles (piege paye au lot paywall).
jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const COLOR_TOKEN = /^(primary|secondary|neutral|success|error|warning|info)/;
  const colorValue = (key) => `couleur-${String(key)}`;
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, {
        get: (_target, group) => {
          if (group === 'backgroundColor') {
            return new Proxy({}, { get: (_t, key) => ({ backgroundColor: colorValue(key) }) });
          }
          if (group === 'tintColor') {
            return new Proxy({}, { get: (_t, key) => ({ tintColor: colorValue(key) }) });
          }
          return makeRamp();
        },
      }),
      Colors: new Proxy({}, { get: (_target, key) => colorValue(key) }),
      Fonts: new Proxy({}, {
        get: (_target, key) => (
          COLOR_TOKEN.test(String(key)) ? { color: colorValue(key) } : styleLeaf
        ),
      }),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

// Le `t` du mock rend le REPLI : c'est exactement ce que l'utilisateur voit
// tant que la clef n'existe pas dans fr.js. Il note au passage les clefs
// demandees — sans ce releve, une clef mal orthographiee resterait invisible
// pour toujours, puisque le repli s'afficherait quand meme.
jest.mock('react-i18next', () => {
  const askedKeys = [];
  return {
    askedKeys,
    initReactI18next: { init: jest.fn(), type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ key, /** @type {string} */ fallback) => {
        askedKeys.push(key);
        return fallback || key;
      },
    }),
  };
});

// Trois noms VOLONTAIREMENT differents : c'est le seul moyen de voir QUELLE
// donnee arrive dans le titre. Si les trois se ressemblaient, un temoin vert
// ne prouverait rien.
const CLUB_NAME = 'FC Test';
const TEAM_NAME = 'U15 A';
const EVENT_NAME = 'Rendez-vous de rentree';
const OPPONENT_NAME = 'FC Bonneveine';

// Un stage ne se reconnait PAS a son libelle de type mais a son FORMAT :
// `EventDetails.js` et `EventCardNew.js` lisent tous les deux `eventFormat`.
const STAGE_PARENT = { eventFormat: 'stage_parent', typeName: 'Stage' };
const STAGE_DAY = { eventFormat: 'stage_day', typeName: 'Autre' };

/**
 * Fabrique un evenement de recette : meme squelette, type et format variables.
 * @param {{
 *   eventFormat?: string | null;
 *   name?: string;
 *   teamName?: string;
 *   typeName: string;
 * }} params
 * @returns {any}
 */
const makeEvent = ({
  eventFormat = null, name = EVENT_NAME, teamName = TEAM_NAME, typeName,
}) => ({
  date: '2026-09-12T18:00:00.000Z',
  documentId: 'evt-ae01',
  endTime: '20:00:00',
  eventFormat,
  facility: null,
  location: 'Stade municipal, Lyon',
  name,
  startTime: '18:00:00',
  team: {
    club: { documentId: 'club-1', name: CLUB_NAME },
    documentId: 'team-1',
    name: teamName,
  },
  type: { documentId: 'type-1', name: typeName },
});

/**
 * Rend l entete une fois et rend son arbre JSON, sans laisser de montage vivant.
 * @param {any} event
 * @returns {any}
 */
const renderHeader = (event) => {
  /** @type {any} */
  let tree;
  act(() => {
    tree = renderer.create(<EventHeader event={event} />);
  });
  const json = tree.toJSON();
  act(() => {
    tree.unmount();
  });
  return json;
};

/**
 * Rend le premier noeud de l arbre rendu qui satisfait `predicate`.
 * @param {any} node
 * @param {(candidate: any) => boolean} predicate
 * @returns {any}
 */
const findNode = (node, predicate) => {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    return node.reduce(
      (/** @type {any} */ found, /** @type {any} */ child) => found || findNode(child, predicate),
      null,
    );
  }
  if (predicate(node)) return node;
  return findNode(node.children, predicate);
};

/**
 * Rassemble tout le texte porte par un noeud rendu et ses enfants.
 * @param {any} node
 * @param {string[]} acc
 * @returns {string[]}
 */
const textContentOf = (node, acc = []) => {
  if (node === null || node === undefined || node === false) return acc;
  if (typeof node === 'string' || typeof node === 'number') {
    acc.push(String(node));
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => textContentOf(child, acc));
    return acc;
  }
  textContentOf(node.children, acc);
  return acc;
};

/**
 * Dit si un noeud rendu porte une image IMPORTEE. Jest remplace un import
 * d image par `{ testUri: '.../card-xxx.png' }` (assetFileTransformer de
 * react-native) : le nom du fichier EST la preuve du fond choisi. Les icones
 * du theme, elles, sont mockees a un nombre et ne portent aucun `testUri`.
 * @param {any} candidate
 * @returns {boolean}
 */
const carriesImportedAsset = (candidate) => (
  typeof candidate?.props?.source?.testUri === 'string'
);

/**
 * Dit si un noeud rendu est un `Text`.
 * @param {any} candidate
 * @returns {boolean}
 */
const isTextNode = (candidate) => candidate?.type === 'Text';

/**
 * Rend le nom de fichier du fond illustre pose par `ImageBackground`.
 * @param {any} tree
 * @returns {string}
 */
const backgroundFileOf = (tree) => {
  const node = findNode(tree, carriesImportedAsset);
  return String(node?.props?.source?.testUri || '').split('/').pop() || '';
};

/**
 * Rend le TITRE PRINCIPAL de la carte : le premier `Text` de l entete, juste
 * apres le logo du club — `ClubLogoMark` etant mocke a null, rien ne le precede.
 * @param {any} tree
 * @returns {string}
 */
const primaryTitleOf = (tree) => {
  const node = findNode(tree, isTextNode);
  return textContentOf(node?.children).join('').trim();
};

/**
 * Raccourci de recette : le fond obtenu pour un evenement decrit en une ligne.
 * @param {any} params
 * @returns {string}
 */
const backgroundOf = (params) => backgroundFileOf(renderHeader(makeEvent(params)));

/**
 * Raccourci de recette : le titre principal obtenu pour ce meme evenement.
 * @param {any} params
 * @returns {string}
 */
const titleOf = (params) => primaryTitleOf(renderHeader(makeEvent(params)));

describe('AE01 - le fond et le titre de la carte d entete, type par type', () => {
  test('AE01 · temoin 1 — chaque type porte SON fond, tournoi et stage compris', () => {
    // Les cinq types qui avaient deja LEUR fond : ils ne bougent pas.
    expect(backgroundOf({ typeName: 'Match' })).toBe('card-match.png');
    expect(backgroundOf({ typeName: 'Entrainement' })).toBe('card-entrainement.png');
    expect(backgroundOf({ typeName: 'Detection' })).toBe('card-detection.png');
    expect(backgroundOf({ typeName: 'Reservation' })).toBe('card-reservation.png');
    expect(backgroundOf({ typeName: 'Autre' })).toBe('card-autre.png');

    // CE QUE CE LOT CORRIGE : le tournoi empruntait le fond du match, et le
    // stage tombait dans le fond « autre ». Les deux images dediees existaient
    // pourtant (`src/assets/background-card-event/`) et les CARTES de liste
    // les posaient deja (`EventCardNew.js:53-62`) — seule l entete les
    // ignorait. Source qui fait foi : RESTE_A_FAIRE_DESIGN.md (L6-B, 22/08),
    // et NON la planche 03 v2, qui gardait le fond du match pour le tournoi
    // sur une premisse fausse (« tournoi et stage n ont pas de visuel dedie »).
    expect(backgroundOf({ typeName: 'Tournoi' })).toBe('card-tournoi.png');
    expect(backgroundOf(STAGE_PARENT)).toBe('card-stage.png');
    expect(backgroundOf(STAGE_DAY)).toBe('card-stage.png');
  });

  test('AE01 · temoin 2 — le titre suit le TYPE : equipe, evenement, ou club', () => {
    const matchTitle = `VS ${OPPONENT_NAME}`;

    // Ce que demande la planche 03 (cadres C, D, E, G, H) : ces quatre
    // familles affichaient le nom du CLUB. Le club ne DISPARAIT pas de la
    // carte pour autant — il reste porte par le logo et par le sous-titre.
    expect(titleOf({ typeName: 'Entrainement' })).toBe(TEAM_NAME);
    expect(titleOf({ typeName: 'Detection' })).toBe(EVENT_NAME);
    expect(titleOf(STAGE_PARENT)).toBe(EVENT_NAME);
    expect(titleOf(STAGE_DAY)).toBe(EVENT_NAME);
    expect(titleOf({ typeName: 'Autre' })).toBe(EVENT_NAME);

    // Le repli quand la donnee voulue manque : le nom du club, comme avant.
    // Sans ce repli, une carte sans nom d equipe afficherait un titre VIDE.
    expect(titleOf({ teamName: '', typeName: 'Entrainement' })).toBe(CLUB_NAME);
    expect(titleOf({ name: '', typeName: 'Detection' })).toBe(CLUB_NAME);

    // Les deux qui ne bougent ni avec AE01 ni avec N3.
    expect(titleOf({ typeName: 'Tournoi' })).toBe(EVENT_NAME);
    expect(titleOf({ typeName: 'Reservation' })).toBe(CLUB_NAME);

    // ✏️ REECRIT PAR N3 — DECISION Q1 = C (Adel, 20/08). Ce n'est pas une
    // regression : c'est la decision qui a change, pas le code qui a derape.
    //
    // AE01 avait fige ici « un match affiche VS <adversaire> », en notant que
    // le match SANS adversaire (cadre 03 · I) gardait le nom du club. Q1 a
    // tranche l'inverse : le match garde TOUJOURS le nom du club en titre, et
    // l'adversaire vit dans l'encart, face a lui — « Test FC — FC Bonneveine »
    // (temoigne dans EventHeaderN3CarteMatch, temoin 2).
    //
    // ✅ Ce que ce couple garde vivant : le titre d'un match ne depend PLUS de
    // l'adversaire. Avec ou sans lui, la meme chose s'affiche — et c'est
    // exactement ce que l'ancien code ne faisait pas.
    expect(titleOf({ name: matchTitle, typeName: 'Match' })).toBe(CLUB_NAME);
    expect(titleOf({ typeName: 'Match' })).toBe(CLUB_NAME);
  });

  test('AE01 · temoin 3 — les 2 libelles de la carte passent par t(), sans changer', () => {
    // Ce que l utilisateur voit ne bouge pas : un tournoi sans nom retombe sur
    // le mot « Tournoi », et la liste des invites garde son intitule.
    const sansNom = renderHeader(makeEvent({ name: '', typeName: 'Tournoi' }));
    expect(primaryTitleOf(sansNom)).toBe('Tournoi');

    const avecInvites = renderHeader({
      ...makeEvent({ typeName: 'Tournoi' }),
      invitedTeams: [{ name: 'US Marseille' }],
    });
    const textes = textContentOf(avecInvites);
    expect(textes).toContain('Équipes invitées');
    expect(textes).toContain('US Marseille');

    // Et les deux sont bien PASSES par t() avec la clef attendue. C est la
    // seule chose qu un repli ne peut pas prouver tout seul : une clef mal
    // orthographiee afficherait le meme texte et ne serait jamais traduite.
    const { askedKeys } = jest.requireMock('react-i18next');
    expect(askedKeys).toContain('eventDetails.header.tournamentFallback');
    expect(askedKeys).toContain('eventDetails.header.invitedTeams');
  });
});

describe('R9 - LE TITRE NE MONTE PLUS DANS LES BOUTONS DE LA BARRE', () => {
  // 🧨 LE CONSTAT DE RECETTE DU 24/08 : sur une detection, le titre CHEVAUCHE
  // les deux boutons du haut (le drapeau et le ⋯).
  //
  // 🔍 LA MECANIQUE, mesuree : la barre de navigation est TRANSPARENTE pour
  // toute la pile (`commonOptions.js`, `headerTransparent: true`) et les deux
  // glyphes n ont aucun fond. Le contenu passe donc DESSOUS — c est voulu, c est
  // ce qui donne l entete pleine largeur. Ce qui ne l est pas, c est qu un titre
  // long grimpe dedans : ce `Text` n avait AUCUNE limite de lignes.
  //
  // ⛔ CE QUI N EST PAS FAIT ICI : toucher `commonOptions`. Ce fichier commande
  // TOUS les ecrans de l app ; y rendre la barre opaque pour reparer une
  // detection serait un changement global non demande.

  // Le titre principal est le PREMIER noeud Text de l entete — c est deja par la
  // que passe `primaryTitleOf`, le raccourci des temoins d AE01.
  const titreNodeOf = (/** @type {any} */ params) => findNode(
    renderHeader(makeEvent(params)),
    isTextNode,
  );

  test('R9 · temoin 28 — le titre principal est BORNE a deux lignes', () => {
    const titre = titreNodeOf({ typeName: 'Detection' });

    expect(textContentOf(titre?.children).join('').trim()).toBe(EVENT_NAME);
    expect(titre.props.numberOfLines).toBe(2);
  });

  test('R9 · temoin 29 — un titre TRES long reste borne, il ne pousse pas vers le haut', () => {
    // Le cas reel : un nom de detection sur quatre lignes remontait dans la
    // barre. La borne vaut pour tous les types, pas seulement la detection.
    const nomTresLong = 'Detection gardiens et joueurs de champ nes entre 2010 et 2013'
      + ' secteur nord, samedi matin';
    const titre = titreNodeOf({ name: nomTresLong, typeName: 'Detection' });

    expect(textContentOf(titre?.children).join('').trim()).toBe(nomTresLong);
    expect(titre.props.numberOfLines).toBe(2);
  });
});
