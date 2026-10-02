/* eslint-disable max-len -- titres et attendus en francais, lus tels quels (ST-MATCH) */
import renderer, { act } from 'react-test-renderer';

import EventHeader from '../EventHeader';

// Lot N3 — LA CARTE DU MATCH (planche 03, cadres A / B / I).
//
// Ce fichier temoigne de ce que l'ENTETE sait faire quand on lui donne un
// `matchScoreSummary` enrichi. Le calcul, lui, vit dans `EventDetails.js` et se
// temoigne dans `EventDetailsN3CarteMatch.test.js` : la separation n'est pas
// cosmetique, c'est la decision D3 — l'orientation (un lecteur de l'equipe
// INVITEE voit « À l'extérieur » la ou l'organisateur lit « À domicile ») se
// calcule au-dessus, la ou l'ecran sait QUI regarde.
//
// Ce que ce filet couvre ici :
//   · D4 — le titre du match est le nom du CLUB (Q1 = C, Adel 20/08), et le
//     sous-titre ne repete plus « Domicile - » (D1 : la pastille le dit deja).
//   · D5 — l'encart existe AVANT le match, des qu'un adversaire est connu.
//     ⚠️ L'ecran passe la DONNEE (`opponentName`) ; c'est l'entete qui compose
//     « Test FC — FC Bonneveine », parce que le nom du club y est deja resolu.
//     Le temoin 2 verifie donc la chaine RENDUE, pas une chaine recopiee.
//   · D6/D7 — le verdict et ses trois couleurs.
//   · D9/D10 — « Nommer l'adversaire », et le pointille sans bouton.
//
// ⚠️ CE QUE CE FILET NE PROUVE PAS : Jest n'a pas de moteur de mise en page. Il
// lit ce qui est MONTE et les styles POSES, jamais le rendu reel. La recette
// visuelle reste due.

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);

// Le VRAI theme, pas un Proxy : ce lot temoigne de COULEURS precises
// (`success500`, `error300`, `primary100`) et un attrape-tout rendrait
// « verdict vert » et « verdict rouge » indiscernables. Meme motif que
// `EventDetailsN1PetitsBlocs.test.js`.
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

// Le `t` rend le REPLI, INTERPOLE, et note la clef demandee : sans ce releve,
// une clef mal orthographiee afficherait le meme texte et ne serait jamais
// traduite. Meme motif qu'AE01.
jest.mock('react-i18next', () => {
  const askedKeys = /** @type {string[]} */ ([]);
  const rendre = (/** @type {any} */ modele, /** @type {any} */ options) => String(modele)
    .replace(
      /\{\{(\w+)\}\}/g,
      (/** @type {any} */ _tout, /** @type {any} */ nom) => (
        options && nom in options ? String(options[nom]) : `{{${nom}}}`
      ),
    );
  return {
    askedKeys,
    initReactI18next: { init: jest.fn(), type: '3rdParty' },
    useTranslation: () => ({
      t: (
        /** @type {string} */ key,
        /** @type {any} */ fallback,
        /** @type {any} */ options,
      ) => {
        askedKeys.push(key);
        const modele = typeof fallback === 'string' ? fallback : key;
        const reglages = typeof fallback === 'string' ? options : fallback;
        return rendre(modele, reglages);
      },
    }),
  };
});

const CLUB_NAME = 'Test FC';
const ADVERSAIRE = 'FC Bonneveine';
// Le tiret CADRATIN (U+2014), et aucun mot entre les deux noms : c'est la
// decision Q1 = C. Un « vs » reviendrait a redire ce que la mise en page dit.
const TIRET_CADRATIN = '—';

const COULEURS = jest.requireActual('@/theme/colors').default();

/**
 * Un match, tel que l'API le sert.
 * @param {any} overrides Ce qui change d'un cas a l'autre.
 * @returns {any} L'evenement.
 */
const matchEvent = (overrides = {}) => ({
  date: '2026-09-12T18:00:00.000Z',
  documentId: 'evt-n3',
  endTime: '20:00:00',
  facility: null,
  location: 'Stade municipal, Lyon',
  name: `Match vs ${ADVERSAIRE}`,
  opponentName: ADVERSAIRE,
  startTime: '18:00:00',
  team: {
    club: { documentId: 'club-1', name: CLUB_NAME },
    documentId: 'team-1',
    name: 'U15 A',
  },
  type: { documentId: 'type-1', name: 'Match' },
  ...overrides,
});

/**
 * Rend l'entete une fois et rend son arbre JSON, sans laisser de montage vivant.
 * @param {any} event L'evenement.
 * @param {any} matchScoreSummary L'objet enrichi par `EventDetails`.
 * @returns {any} L'arbre rendu.
 */
const renderHeader = (event, matchScoreSummary = null) => {
  /** @type {any} */
  let tree;
  act(() => {
    tree = renderer.create(
      <EventHeader event={event} matchScoreSummary={matchScoreSummary} />,
    );
  });
  const json = tree.toJSON();
  act(() => {
    tree.unmount();
  });
  return json;
};

/**
 * Rend TOUS les noeuds de l'arbre qui satisfont `predicate`.
 * @param {any} node Le noeud de depart.
 * @param {(candidate: any) => boolean} predicate Le crible.
 * @param {any[]} acc L'accumulateur.
 * @returns {any[]} Les noeuds trouves.
 */
const findAll = (node, predicate, acc = []) => {
  if (!node || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, predicate, acc));
    return acc;
  }
  if (predicate(node)) acc.push(node);
  findAll(node.children, predicate, acc);
  return acc;
};

/**
 * Le premier noeud portant ce `testID`.
 * @param {any} tree L'arbre rendu.
 * @param {string} testID L'etiquette cherchee.
 * @returns {any} Le noeud, ou null.
 */
const nodeByTestId = (tree, testID) => (
  findAll(tree, (/** @type {any} */ c) => c?.props?.testID === testID)[0] || null
);

/**
 * Rassemble tout le texte porte par un noeud rendu et ses enfants.
 * @param {any} node Le noeud.
 * @param {string[]} acc L'accumulateur.
 * @returns {string[]} Les morceaux de texte.
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
 * Le texte entier d'un noeud, replie en une seule chaine.
 * @param {any} node Le noeud.
 * @returns {string} Le texte.
 */
const texteDe = (node) => textContentOf(node).join(' ').replace(/\s+/g, ' ').trim();

/**
 * Aplati un style RN (tableau imbrique, valeurs nulles) en un seul objet.
 * @param {any} style Le style tel que pose sur le noeud.
 * @param {any} acc L'accumulateur.
 * @returns {any} Le style resultant.
 */
const aplatirStyle = (style, acc = {}) => {
  if (!style) return acc;
  if (Array.isArray(style)) {
    style.forEach((part) => aplatirStyle(part, acc));
    return acc;
  }
  if (typeof style === 'object') Object.assign(acc, style);
  return acc;
};

/**
 * Le style aplati d'un noeud rendu.
 * @param {any} node Le noeud.
 * @returns {any} Le style.
 */
const styleDe = (node) => aplatirStyle(node?.props?.style);

/**
 * Le TITRE PRINCIPAL : le premier `Text` de l'entete. `ClubLogoMark` etant
 * mocke a null, rien ne le precede — c'est la garantie que fait tenir AE01, et
 * c'est pour cela que l'encart de N3 est monte APRES le titre.
 * @param {any} tree L'arbre rendu.
 * @returns {string} Le titre.
 */
const primaryTitleOf = (tree) => {
  const premier = findAll(tree, (/** @type {any} */ c) => c?.type === 'Text')[0];
  return texteDe(premier?.children);
};

const ENCART = 'event-header-match-encart';
const BOUTON_ADVERSAIRE = 'event-header-nommer-adversaire';

describe('N3 - la carte du match : titre, encart, verdict, adversaire', () => {
  test('N3 · temoin 1 — le titre est le CLUB, et le sous-titre ne dit plus « Domicile »', () => {
    // Q1 = C (Adel, 20/08) : le match garde le nom du club en titre. Avant ce
    // lot il affichait « VS FC Bonneveine » et repoussait le club dans un
    // sous-titre « Domicile - Test FC ». L'adversaire vit desormais dans
    // l'encart, et le lieu dans la pastille de type hors carte (D1).
    const arbre = renderHeader(matchEvent(), {
      badgeLabel: 'Score du match',
      opponentName: ADVERSAIRE,
      value: 'Score en attente',
    });

    expect(primaryTitleOf(arbre)).toBe(CLUB_NAME);

    // Le sous-titre ne doit plus porter le lieu. On le cherche partout : s'il
    // subsistait ailleurs dans la carte, le temoin doit le voir.
    const textes = textContentOf(arbre);
    expect(textes).not.toContain('Domicile - Test FC');
    expect(textes.join(' ')).not.toMatch(/Domicile|Exterieur/);
  });

  // 🆚 ST-MATCH (02/10) — ADAPTE : l'encart « Club — Adversaire » devient le FACE-À-FACE du
  // design valide (pack 05C) : deux camps, le score au centre. Le temoin garde son sujet (D5 :
  // l'encart existe avant le match, l'adversaire y est nomme) sur la nouvelle mise en page.
  test('N3 · temoin 2 — le face-à-face : le club, l\'adversaire, « Score en attente » au centre (D5)', () => {
    const arbre = renderHeader(matchEvent(), {
      centerLabel: 'Score en attente',
      opponentName: ADVERSAIRE,
      value: '– –',
    });

    expect(nodeByTestId(arbre, ENCART)).not.toBeNull();
    expect(texteDe(nodeByTestId(arbre, 'event-header-camp-club'))).toBe(CLUB_NAME);
    expect(texteDe(nodeByTestId(arbre, 'event-header-camp-adversaire'))).toBe(ADVERSAIRE);
    expect(texteDe(nodeByTestId(arbre, 'event-header-score'))).toBe('– – Score en attente');
    // ⛔ Aucun mot entre les deux noms : ni « vs », ni « contre ».
    expect(texteDe(nodeByTestId(arbre, ENCART))).not.toMatch(/\bvs\b/i);
    // Le tiret cadratin « Club — Adversaire » n'a plus lieu d'etre : les camps le disent.
    expect(texteDe(nodeByTestId(arbre, ENCART))).not.toContain(TIRET_CADRATIN);
  });

  // 🆚 ST-MATCH (02/10) — ADAPTE : D6/D7 sont REMPLACES par le design valide. Le verdict ne
  // peint plus le badge ni la bordure de l'encart : il est DIT par la pastille de type
  // (« MATCH · TERMINÉ · VICTOIRE », temoignee dans EventDetailsN3CarteMatch). L'encart montre
  // le score, une seule fois, au centre.
  test('N3 · temoin 3 — le verdict ne peint plus l\'encart : le score est au centre (ST-MATCH)', () => {
    ['win', 'loss', 'draw'].forEach((verdict) => {
      const arbre = renderHeader(matchEvent(), {
        centerLabel: 'Score saisi',
        isScoreShown: true,
        opponentName: ADVERSAIRE,
        value: '3 - 1',
        verdict,
      });
      const encart = nodeByTestId(arbre, ENCART);
      expect(texteDe(nodeByTestId(arbre, 'event-header-score'))).toBe('3 - 1 Score saisi');
      expect(texteDe(encart)).not.toMatch(/Victoire|Défaite|Nul|Score du match/);
      expect(styleDe(encart).borderColor).toBeUndefined();
    });
  });

  // 🆚 ST-MATCH (02/10) — ADAPTE : l'encart n'a plus de bordure ; la couleur du LIEU reste sur
  // le lisere (temoin 5) et sur la pastille du lieu, que le face-à-face porte sous les camps.
  test('N3 · temoin 4 — la couleur du LIEU reste sur la pastille du lieu, dans l\'encart', () => {
    const facility = { documentId: 'facility-nord', name: 'Stade Nord' };
    const couleurDuLieu = jest
      .requireActual('@/utils/facilityPlanningColor')
      .resolveFacilityPlanningColor(facility);
    const arbre = renderHeader(matchEvent({ facility }), {
      centerLabel: 'Score en attente',
      opponentName: ADVERSAIRE,
      value: '– –',
      verdict: null,
    });

    const { withAlpha } = jest.requireActual('@/theme/colors');
    const pastille = findAll(
      nodeByTestId(arbre, ENCART),
      (/** @type {any} */ c) => c?.type === 'View' && texteDe(c) === 'Stade Nord',
    )[0];
    expect(styleDe(pastille).backgroundColor).toBe(withAlpha(couleurDuLieu, 0.14));
    expect(texteDe(nodeByTestId(arbre, ENCART))).not.toMatch(/Victoire|Défaite|Nul/);
  });

  test('N3 · temoin 5 — le verdict ne touche JAMAIS le lisere du lieu (AD10)', () => {
    // 🪤 Le lisere gauche code la couleur de l'INSTALLATION et rien d'autre :
    // 7 temoins d'AD09/AD10 en dependent. Un verdict qui le repeindrait ferait
    // mentir la carte sur le lieu — et ces temoins-la ne le verraient pas,
    // puisqu'ils ne montent jamais de score.
    // ⛔ AUCUN hex ecrit ici : `verify:theme-contract` scanne AUSSI les tests
    // (piege paye au lot paywall), et une couleur en dur y coute une entree
    // d'allowlist. On demande sa couleur a la fonction qui la calcule — le
    // temoin en devient plus juste : il compare le lisere a LA couleur du
    // lieu, pas a une valeur recopiee qui pourrait deriver.
    const facility = { documentId: 'facility-nord', name: 'Stade Nord' };
    const couleurDuLieu = jest
      .requireActual('@/utils/facilityPlanningColor')
      .resolveFacilityPlanningColor(facility);
    const arbre = renderHeader(matchEvent({ facility }), {
      badgeLabel: 'Score du match',
      opponentName: ADVERSAIRE,
      value: '3 - 1',
      verdict: 'win',
    });

    const carte = findAll(
      arbre,
      (/** @type {any} */ c) => styleDe(c).borderLeftWidth === 4,
    )[0];
    expect(carte).not.toBeNull();
    expect(styleDe(carte).borderLeftColor).toBe(couleurDuLieu);
    expect(styleDe(carte).borderLeftColor).not.toBe(COULEURS.success500);
  });

  // 🆚 ST-MATCH (02/10) — ADAPTE : « Nommer l'adversaire » prend la MEME emprise que l'autre
  // camp (design 05C, etat 2). Chez l'organisateur, le bouton REMPLACE le camp de droite ; chez
  // le spectateur, le camp de droite dit « Adversaire à confirmer », en pointille (D10).
  test('N3 · temoin 6 — « Nommer l\'adversaire », seulement si permis (D9/D10)', () => {
    const onNameOpponent = jest.fn();

    const organisateur = renderHeader(matchEvent({ name: 'Match', opponentName: null }), {
      awaitingOpponent: true,
      centerLabel: 'Score en attente',
      onNameOpponent,
      value: '– –',
    });
    const bouton = nodeByTestId(organisateur, BOUTON_ADVERSAIRE);
    expect(bouton).not.toBeNull();
    expect(texteDe(bouton)).toContain('Nommer l\'adversaire');
    expect(styleDe(bouton).borderStyle).toBe('dashed');
    expect(nodeByTestId(organisateur, 'event-header-camp-adversaire')).toBeNull();

    // D10 — le lecteur qui n'organise pas voit le meme etat, en POINTILLE,
    // et SANS bouton : lui proposer une action qu'il n'a pas le droit de faire
    // serait un bouton muet (regle 5 du pack).
    const spectateur = renderHeader(matchEvent({ name: 'Match', opponentName: null }), {
      awaitingOpponent: true,
      centerLabel: 'Score en attente',
      onNameOpponent: null,
      value: '– –',
    });
    const campSpectateur = nodeByTestId(spectateur, 'event-header-camp-adversaire');
    expect(texteDe(campSpectateur)).toBe('Adversaire à confirmer');
    expect(nodeByTestId(spectateur, BOUTON_ADVERSAIRE)).toBeNull();
    expect(styleDe(campSpectateur).borderStyle).toBe('dashed');
  });

  // 🆚 ST-MATCH (02/10) — ADAPTE : les cles du verdict ne sont plus demandees par l'entete
  // (la pastille de type les porte). Les libelles neufs de l'encart passent par t().
  test('N3 · temoin 7 — les libelles neufs passent tous par t()', () => {
    const { askedKeys } = jest.requireMock('react-i18next');
    askedKeys.length = 0;

    renderHeader(matchEvent({ name: 'Match', opponentName: null }), {
      awaitingOpponent: true,
      onNameOpponent: jest.fn(),
      value: '– –',
    });
    expect(askedKeys).toContain('eventDetails.matchCard.nameOpponent');

    askedKeys.length = 0;
    renderHeader(matchEvent({ name: 'Match', opponentName: null }), {
      awaitingOpponent: true,
      onEnterScore: jest.fn(),
      value: '– –',
    });
    expect(askedKeys).toContain('eventDetails.matchCard.opponentToConfirm');
    expect(askedKeys).toContain('stMatch.encart.enterScore');

    askedKeys.length = 0;
    renderHeader(matchEvent(), {
      isScoreShown: true,
      onSeeStats: jest.fn(),
      opponentName: ADVERSAIRE,
      value: '3 - 1',
      verdict: 'win',
    });
    expect(askedKeys).toContain('stMatch.encart.seeMatchStats');
  });
});

// FINITIONS7 · POINT 7 (tournee 8) — sur la fiche d un entrainement, la date s affichait « jeu »
// seul (le texte etait « jeu 01/10/2026 »). C est le piege d Android 16 deja paye par les
// FINITIONS du 29/09 : un texte de plusieurs mots, dans une boite a sa largeur mesuree, perd son
// DERNIER mot. Parade du depot : `texteInsecable` — le texte se comporte comme un mot seul. Et la
// colonne de droite (categorie, niveau) peut desormais retrecir au lieu de pousser la date.
// ⚠️ Jest ne mesure aucun pixel : ce temoin lit le TEXTE pose et la CONTRAINTE de la colonne.
describe('FINITIONS7 · point 7 — la date de la fiche reste entiere', () => {
  const ENTRAINEMENT = {
    date: '2026-10-01T12:00:00.000Z',
    documentId: 'evt-f7',
    endTime: '19:00:00',
    name: 'Entrainement',
    startTime: '18:00:00',
    team: {
      category: { name: 'SÉNIOR (+18 ANS)' },
      club: { documentId: 'club-1', name: CLUB_NAME },
      documentId: 'team-1',
      level: { name: 'Régional' },
      name: 'U13',
    },
    type: { documentId: 'type-2', name: 'Entraînement' },
  };

  test('🚨 « jeu 01/10/2026 » est pose d un seul tenant (espace insecable)', () => {
    const arbre = renderHeader(ENTRAINEMENT);
    const textes = findAll(arbre, (/** @type {any} */ c) => c?.type === 'Text')
      .map((c) => textContentOf(c.children).join(''));

    expect(textes).toContain(`jeu${String.fromCharCode(160)}01/10/2026`);
    expect(textes).not.toContain('jeu 01/10/2026');
  });

  test('🚨 la colonne categorie / niveau peut retrecir : elle ne pousse plus la date', () => {
    const arbre = renderHeader(ENTRAINEMENT);
    const colonne = findAll(arbre, (/** @type {any} */ c) => (
      c?.type === 'View' && findAll(c.children, (/** @type {any} */ t) => (
        t?.type === 'Text' && t?.props?.numberOfLines === 1 && /SÉNIOR/i.test(texteDe(t.children))
      )).length > 0 && !findAll(c.children, (/** @type {any} */ t) => /01\/10\/2026/.test(texteDe(t?.children))).length
    )).pop();

    expect(colonne).toBeDefined();
    expect(styleDe(colonne).flexShrink).toBe(1);
  });
});
