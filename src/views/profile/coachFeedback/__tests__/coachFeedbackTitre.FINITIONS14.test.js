/* eslint-disable max-len -- titres et attendus en francais, lus tels quels */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { CoachFeedbackCard } from '../CoachFeedbackList';
import { feedbackMetaLine, feedbackTitle } from '../coachFeedbackModel';

// ==========================================================================
// FINITIONS14 · point 4 (FINITIONS13-STATS 6c/6d) — « RETOURS DU COACH » : LE TITRE.
//
// Planche 19 des statistiques : « AS Montrivage — Test-COMPO », sous-titre « U15 · sam. 5 sept. ·
// victoire 2 - 1 · de Karim ». La T13-bis a vu « Match », « Match de championnat U15 », « Match vs
// Test-COMPO » : la carte affichait `matchLabel` (le nom de l'événement). Le serveur envoie
// désormais `opponentName` (match de club, `null` inconnu) et `clubName` ; le titre suit LA règle
// du rappel (`describeCoachPromptTitle`). Un serveur d'avant, ou un retour de championnat, garde
// `matchLabel`. La fiche de l'enfant (« latest ») porte le même titre en tête de sa ligne.
// ==========================================================================

/**
 * Le repli de t(), interpolé.
 * @param {string} cle - La clé.
 * @param {any} a - Le repli, ou les options.
 * @param {any} b - Les options, quand un repli est donné.
 * @returns {string} Le texte rendu.
 */
const mockTraduire = (/** @type {string} */ cle, /** @type {any} */ a, /** @type {any} */ b) => {
  const options = typeof a === 'string' ? b : a;
  const modele = typeof a === 'string' ? a : ({
    'stRetours.feedback.byAuthor': 'de {{name}}',
    'stRetours.feedback.cardLabel': 'Retour sur {{match}} {{status}}',
    'stRetours.feedback.matchFallback': 'Match',
    'stRetours.feedback.resultWin': 'victoire {{score}}',
  })[cle] || cle;
  return String(modele).replace(/\{\{(\w+)\}\}/g, (tout, nom) => (
    options && nom in options ? String(options[nom]) : tout
  ));
};
jest.mock('i18next', () => ({ __esModule: true, default: { t: (...args) => mockTraduire(...args) } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (...args) => mockTraduire(...args) }),
}));
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => function IconeDouble() { return null; });
jest.mock('@/components/atoms/button/Button', () => function ButtonDouble() { return null; });

const t = (/** @type {string} */ cle, /** @type {any} */ options) => mockTraduire(cle, options);

const retour = (/** @type {any} */ champs = {}) => ({
  authorFirstname: 'Karim',
  clubName: 'AS Montrivage',
  comment: 'Bon pressing.',
  feedbackKey: 'event:m1:u15:v1',
  matchDate: '2026-09-05T13:00:00.000Z',
  matchLabel: 'Match vs Test-COMPO',
  opponentName: 'Test-COMPO',
  rating: 7,
  result: 'win',
  scoreAgainst: 1,
  scoreFor: 2,
  sourceDocumentId: 'm1',
  sourceType: 'event',
  teamDocumentId: 'u15',
  teamName: 'U15',
  ...champs,
});

/**
 * Le retour tel qu un serveur d avant le rend : sans `opponentName`.
 * @param {any} item - Le retour.
 * @returns {any} La copie sans le champ.
 */
const sansAdversaire = (item) => {
  const copie = { ...item };
  delete copie.opponentName;
  return copie;
};

describe('FINITIONS14 · point 4 — le titre d un retour du coach', () => {
  test('🔴 « AS Montrivage — Test-COMPO »', () => {
    expect(feedbackTitle(t, retour())).toBe('AS Montrivage — Test-COMPO');
  });

  test('🔴 adversaire inconnu : « AS Montrivage — adversaire à confirmer »', () => {
    expect(feedbackTitle(t, retour({ matchLabel: 'Match de championnat U15', opponentName: null })))
      .toBe('AS Montrivage — adversaire à confirmer');
  });

  test('🔴 club inconnu : l équipe tient le camp de gauche, « U15 — Test-COMPO »', () => {
    expect(feedbackTitle(t, retour({ clubName: null }))).toBe('U15 — Test-COMPO');
  });

  test('🔒 serveur d AVANT (pas de champ `opponentName`) : `matchLabel`, et « Match » sans rien', () => {
    const avant = sansAdversaire(retour());
    expect(feedbackTitle(t, avant)).toBe('Match vs Test-COMPO');
    expect(feedbackTitle(t, { ...avant, matchLabel: '' })).toBe('Match');
  });

  test('🔒 un retour de CHAMPIONNAT garde `matchLabel`', () => {
    const ligue = sansAdversaire(retour({ matchLabel: 'Journée 3', sourceType: 'league_match' }));
    expect(feedbackTitle(t, ligue)).toBe('Journée 3');
  });

  test('🔴 la fiche de l enfant (« latest ») ouvre sa ligne par le même titre', () => {
    expect(feedbackMetaLine(t, retour(), 'latest').startsWith('AS Montrivage — Test-COMPO · ')).toBe(true);
  });

  test('🔴 la carte de « Retours du coach » le porte, et son étiquette d accessibilité aussi', () => {
    /** @type {any} */
    let arbre;
    act(() => { arbre = renderer.create(<CoachFeedbackCard item={retour()} />); });
    const vus = arbre.root.findAllByType(Text)
      .map((/** @type {any} */ n) => [].concat(n.props.children).filter((c) => typeof c === 'string').join(''));
    const carte = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'coach-feedback-card')[0];

    expect(vus).toContain('AS Montrivage — Test-COMPO');
    expect(vus).not.toContain('Match vs Test-COMPO');
    expect(carte.props.accessibilityLabel).toBe('Retour sur AS Montrivage — Test-COMPO');
    act(() => arbre.unmount());
  });
});
