/* eslint-disable max-len -- les libellés du design se lisent en entier. */
import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// 🎯 ST-MATCH (écran 7) — LA CARTE « APRÈS LE MATCH » ET « LE BILAN DE … »
//
// Design des statistiques validé le 02/10, planche « écran 7 » :
//   · entraîneur : une carte à trois étapes ; l'auteur et le jour du score ; la feuille
//     « publiée le 1 oct. à 22:39 » (plus de « Version v1 ») ; l'étape 3 NOMME qui
//     manque et porte « Relancer » ; les deux notes sur une ligne, le mot dessous ;
//     avant la fin, plus de bouton éteint ;
//   · joueur : « Le bilan de Karim » — en préparation, puis publié ; la moyenne des
//     joueurs n'apparaît qu'à partir de 3 réponses (« moyenne B ») ;
//   · dirigeant qui n'entraîne pas (« score A ») : qui saisit, et où sont les résultats.
// ==========================================================================

// La doublure INTERPOLE les {{…}} et sait les pluriels de i18next (0 et 1 au singulier).
jest.mock('react-i18next', () => {
  const remplir = (/** @type {string} */ modele, /** @type {any} */ valeurs) => modele.replace(
    /\{\{(\w+)\}\}/g,
    (/** @type {string} */ tout, /** @type {string} */ nom) => (
      valeurs && nom in valeurs ? String(valeurs[nom]) : tout
    ),
  );
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ key, /** @type {any} */ fallback, /** @type {any} */ options) => {
        if (typeof fallback === 'string') return remplir(fallback, options);
        if (fallback && fallback.defaultValue_one) {
          const modele = Number(fallback.count) <= 1 ? fallback.defaultValue_one : fallback.defaultValue_other;
          return remplir(String(modele), fallback);
        }
        return key;
      },
    }),
  };
});

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      {
        accessibilityRole: 'button',
        disabled: Boolean(props.disabled),
        onPress: props.onPress,
      },
      react.createElement(rn.Text, null, props.title || ''),
    );
  };
});

// eslint-disable-next-line import/first
import MatchBilanCard from '../MatchBilanCard';
// eslint-disable-next-line import/first
import PostMatchJourneyCard from '../PostMatchJourneyCard';

/** @type {any[]} */
const montes = [];

const rendre = (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre = null;
  act(() => { arbre = renderer.create(element); });
  montes.push(arbre);
  return arbre.root;
};

const carte = (/** @type {any} */ props = {}) => rendre(createElement(
  PostMatchJourneyCard,
  { onPressEtape: jest.fn(), scoreLibelle: '3 - 1', ...props },
));

const bilan = (/** @type {any} */ props = {}) => rendre(createElement(MatchBilanCard, props));

const textOf = (/** @type {any} */ node) => {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node.props?.children !== undefined) return textOf(node.props.children);
  return '';
};

const textes = (/** @type {any} */ root) => root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => textOf(node.props.children).trim())
  .filter(Boolean);

const parTestID = (/** @type {any} */ root, /** @type {string} */ id) => root
  .findAll((/** @type {any} */ node) => node.props?.testID === id, { deep: false })[0];

const boutonSous = (/** @type {any} */ root, /** @type {string} */ id) => parTestID(root, id)
  ?.findAll((/** @type {any} */ node) => typeof node.props?.onPress === 'function', { deep: false })[0];

const AVEC_SCORE = { scoreDisponible: true, scoreOrigine: 'manual' };
const PUBLIEE = '2026-10-01T20:39:00.000Z';
const moment = (/** @type {string} */ iso) => ({
  heure: new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  jour: new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
});

afterEach(() => {
  montes.splice(0).forEach((arbre) => act(() => arbre.unmount()));
});

describe('ST-MATCH écran 7 — la carte de l entraîneur', () => {
  test('⏳ état 1 — avant la fin : plus de bouton éteint, la carte dit QUAND tout s ouvre', () => {
    const root = carte({ avantLaFin: true, finDuMatch: 'sam. 5 sept. à 20:00' });

    expect(textes(root)).toEqual(expect.arrayContaining([
      'Après le match',
      'Toi, à la fin du match',
      'Ils reçoivent le questionnaire à la fin du match',
      'Tout s’ouvre à la fin du match, sam. 5 sept. à 20:00.',
    ]));
    expect(parTestID(root, 'post-match-action')).toBeUndefined();
  });

  test('📝 un brouillon commencé : « Brouillon commencé à … », le bouton REPREND la feuille', () => {
    const brouillon = '2026-10-01T20:12:00.000Z';
    const root = carte({ ...AVEC_SCORE, feuilleBrouillonDepuis: brouillon });

    expect(textes(root)).toEqual(expect.arrayContaining([
      'Après le match · étape 2 sur 3',
      `Brouillon commencé à ${moment(brouillon).heure}`,
      'Reprendre la feuille',
    ]));
  });

  test('📅 la feuille publiée se lit en mots : « Le 1 oct. à 22:39 », jamais « Version v1 »', () => {
    const root = carte({
      ...AVEC_SCORE,
      feuillePublieeLe: PUBLIEE,
      reponsesAttendues: 12,
      reponsesRecues: 4,
      statsFinalisees: true,
    });
    const { heure, jour } = moment(PUBLIEE);

    expect(textes(root)).toEqual(expect.arrayContaining(['Feuille publiée', `Le ${jour} à ${heure}`]));
    expect(textes(root).some((texte) => /Version|v\d/.test(texte))).toBe(false);
  });

  test('🔔 étape 3 : la carte NOMME qui manque, et « Relancer les 2 » appelle la relance', () => {
    const onRelancer = jest.fn();
    const root = carte({
      ...AVEC_SCORE,
      manquants: ['Léo', 'Nina'],
      onRelancer,
      reponsesAttendues: 3,
      reponsesRecues: 1,
      statsFinalisees: true,
    });

    expect(textes(root)).toEqual(expect.arrayContaining([
      '1 sur 3 a répondu · manquent Léo, Nina',
      'Relancer les 2',
    ]));
    act(() => { boutonSous(root, 'post-match-relancer').props.onPress(); });
    expect(onRelancer).toHaveBeenCalledTimes(1);
  });

  test('🔔 un seul manquant : « Relancer 1 joueur » ; une relance en cours ne repart pas', () => {
    const root = carte({
      ...AVEC_SCORE,
      manquants: ['Léo'],
      onRelancer: jest.fn(),
      relanceEnCours: true,
      reponsesAttendues: 3,
      reponsesRecues: 2,
      statsFinalisees: true,
    });

    expect(textes(root)).toEqual(expect.arrayContaining(['2 sur 3 ont répondu · manquent Léo']));
    const relancer = boutonSous(root, 'post-match-relancer');
    expect(relancer.props.disabled).toBe(true);
  });

  test('🪤 sans fonction de relance (le site) ou sans manquant : pas de bouton « Relancer »', () => {
    const sansFonction = carte({
      ...AVEC_SCORE, manquants: ['Léo'], reponsesAttendues: 3, reponsesRecues: 2, statsFinalisees: true,
    });
    const sansManquant = carte({
      ...AVEC_SCORE, onRelancer: jest.fn(), reponsesAttendues: 3, reponsesRecues: 2, statsFinalisees: true,
    });

    expect(parTestID(sansFonction, 'post-match-relancer')).toBeUndefined();
    expect(parTestID(sansManquant, 'post-match-relancer')).toBeUndefined();
  });

  test('⭐ les deux notes sur une ligne, avec le nombre de notes ; le mot de l entraîneur dessous', () => {
    const root = carte({
      ...AVEC_SCORE,
      feuillePublieeLe: PUBLIEE,
      motDuCoach: 'Bon pressing, on lâche la fin.',
      moyenneJoueurs: { average: 6.5, count: 4 },
      noteEquipe: 7,
      reponsesAttendues: 4,
      reponsesRecues: 4,
      statsFinalisees: true,
    });

    expect(parTestID(root, 'post-match-notes')).toBeTruthy();
    expect(textes(root)).toEqual(expect.arrayContaining([
      'Après le match · c’est complet',
      'Ta note',
      '7/10',
      'Les joueurs · 4 notes',
      '6.5/10',
      'Bon pressing, on lâche la fin.',
    ]));
  });

  test('🚩 score officiel changé : la fédération et la feuille côte à côte, le bouton fait vérifier', () => {
    const root = carte({
      ...AVEC_SCORE,
      scoreDeLaFeuille: '3 - 1',
      scoreOfficiel: '2 - 1',
      statsFinalisees: true,
      verificationRequise: true,
    });

    expect(textes(root)).toEqual(expect.arrayContaining([
      'Après le match · à vérifier',
      'Score officiel changé',
      'La fédération indique 2 - 1 ; ta feuille dit 3 - 1',
      'Vérifier la feuille',
    ]));
  });
});

describe('ST-MATCH écran 7 — le bilan, vu par le joueur et le dirigeant', () => {
  test('⏳ avant la fin : le joueur lit QUAND tout s ouvre, sans bouton', () => {
    const root = bilan({ avantLaFin: true, entraineur: 'Karim', finDuMatch: 'sam. 5 sept. à 20:00' });

    expect(parTestID(root, 'st-match-bilan-avant')).toBeTruthy();
    expect(textes(root)).toEqual(expect.arrayContaining([
      'Score, statistiques et retours s’ouvriront à la fin du match, sam. 5 sept. à 20:00.',
    ]));
    expect(root.findAll((/** @type {any} */ node) => typeof node.props?.onPress === 'function')).toHaveLength(0);
  });

  test('📝 état 1 — en préparation : une phrase, aucun bouton éteint', () => {
    const root = bilan({ entraineur: 'Karim' });

    expect(parTestID(root, 'st-match-bilan-preparation')).toBeTruthy();
    expect(textes(root)).toEqual(expect.arrayContaining([
      'Le bilan de Karim',
      'En préparation',
      'Karim prépare la feuille du match. Tu la liras ici dès qu’il la publie.',
    ]));
    expect(root.findAll((/** @type {any} */ node) => typeof node.props?.onPress === 'function')).toHaveLength(0);
  });

  test('🔒 moyenne B — sous 3 réponses, le joueur ne lit AUCUNE moyenne : « dès 3 réponses »', () => {
    const root = bilan({
      entraineur: 'Karim',
      moyenneJoueurs: { average: null, count: 2, hidden: true },
      noteEquipe: 7,
      publiee: true,
      publieeLe: PUBLIEE,
    });

    expect(textes(root)).toEqual(expect.arrayContaining(['Vos notes : dès 3 réponses', '—']));
    expect(textes(root).some((texte) => texte.includes('réponses') && /\d+(\.\d+)?\/10/.test(texte))).toBe(false);
  });

  test('🪤 moyenne B — même si une moyenne arrivait marquée « cachée », elle ne s affiche pas', () => {
    const root = bilan({
      entraineur: 'Karim',
      moyenneJoueurs: { average: 9, count: 2, hidden: true },
      publiee: true,
    });

    expect(textes(root)).not.toEqual(expect.arrayContaining(['9/10']));
  });

  test('🏁 publié : la note de l équipe selon Karim, la moyenne dès 3 réponses, le mot, les buteurs, la confidentialité', () => {
    const root = bilan({
      buteurs: 'Hugo L. · Léo D. ×2',
      entraineur: 'Karim',
      motDuCoach: 'Bon pressing.',
      moyenneJoueurs: { average: 6.8, count: 4 },
      noteEquipe: 7,
      publiee: true,
      publieeLe: PUBLIEE,
    });
    const { heure, jour } = moment(PUBLIEE);

    expect(parTestID(root, 'st-match-bilan-publie')).toBeTruthy();
    expect(textes(root)).toEqual(expect.arrayContaining([
      'Le bilan de Karim',
      `Publié le ${jour} à ${heure}`,
      'L’équipe, selon Karim',
      '7/10',
      'Vos notes · 4 réponses',
      '6.8/10',
      'Bon pressing.',
      'Hugo L. · Léo D. ×2',
      'Ton retour individuel est dans « Mon match ». Ceux des autres joueurs restent entre eux et Karim.',
    ]));
  });

  test('🏛️ score A — le dirigeant lit qui saisit, et le lien mène aux résultats de l équipe', () => {
    const onVoirLesResultats = jest.fn();
    const root = bilan({
      entraineur: 'Karim', equipe: 'U15', mode: 'dirigeant', onVoirLesResultats,
    });

    expect(textes(root)).toEqual(expect.arrayContaining([
      'Le score et la feuille sont saisis par l’entraîneur de l’équipe, Karim.',
      'Les résultats de U15',
    ]));
    const lien = root.findAll((/** @type {any} */ node) => node.props?.accessibilityRole === 'link')[0];
    act(() => { lien.props.onPress(); });
    expect(onVoirLesResultats).toHaveBeenCalledTimes(1);
  });

  test('🏛️ score A — sans entraîneur connu, la phrase ne laisse pas de trou', () => {
    const root = bilan({ mode: 'dirigeant' });

    expect(textes(root)).toEqual(expect.arrayContaining([
      'Le score et la feuille sont saisis par l’entraîneur de l’équipe.',
    ]));
  });
});
