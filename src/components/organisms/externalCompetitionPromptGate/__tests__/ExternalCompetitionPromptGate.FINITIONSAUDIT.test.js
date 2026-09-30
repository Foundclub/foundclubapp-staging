import { createElement } from 'react';
import { InteractionManager } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ExternalCompetitionPromptGate from '../ExternalCompetitionPromptGate';

// FINITIONS-AUDIT, point 4b (30/09) — le rappel « Ajoute le classement de ta ligue », a
// l'accueil. Ce fichier n'avait AUCUN temoin (E6) : les quatre premiers cas decrivent ce
// qu'il fait, et restent verts.
//
// 🚨 Le cas verifie : le rappel comptait les equipes de `myTeams` — celles ou l'on JOUE.
// Un simple joueur se voyait donc inviter a « Ajouter le classement », et le bouton
// l'envoyait sur la fiche d'equipe, qui n'ouvre la configuration qu'a un entraineur ou
// un dirigeant du club (`TeamDetails.js`, `canConfigureFFBB`) : une impasse.
//
// Couture : le TEXTE affiche et l'ecran ouvert, pas la forme de l'arbre.

const mockNavigate = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte. ⛔ Jamais un Proxy.
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Spaces: espaces,
    }),
  };
});

jest.mock('@/navigation/navigationService', () => ({
  navigate: (/** @type {any[]} */ ...args) => mockNavigate(...args),
}));

// Le gestionnaire de fenetres : il laisse passer ce que le rappel demande d'afficher.
jest.mock('@/context/PopupManagerContext', () => ({
  usePopupEligibility: (/** @type {string} */ id, /** @type {boolean} */ enabled) => ({
    canShow: Boolean(enabled),
    descriptor: { id, priority: 1 },
    dismiss: () => {},
    markShown: () => {},
    trackEvent: () => {},
  }),
}));
jest.mock('@/context/BlockingOverlayContext', () => ({
  useBlockingOverlayLifecycle: () => {},
  useBlockingOverlayPrompt: (/** @type {string} */ _id, /** @type {boolean} */ canShow) => canShow,
}));

jest.mock('@/components/atoms/button/Button', () => function BoutonMock(/** @type {any} */ props) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.title),
  );
});

const CLUB = { documentId: 'club-1', name: 'BC Rivage' };
/** Une equipe inscrite en championnat, sans lien de classement. */
const U17 = {
  club: CLUB, documentId: 'eq-u17', externalCompetitionEligible: true, name: 'U17 Filles',
};

/** @type {any} */
let arbre;

/**
 * Monte le rappel, laisse passer son delai d'ouverture, et rend ce qu'il affiche.
 * @param {any} userData Le compte connecte.
 * @param {{ enabled?: boolean }} [options] Le rappel est-il autorise par l'accueil.
 * @returns {string[]} Les textes affiches.
 */
const rappel = (userData, { enabled = true } = {}) => {
  act(() => {
    arbre = renderer.create(createElement(ExternalCompetitionPromptGate, {
      enabled, openDelayMs: 0, userData,
    }));
  });
  act(() => { jest.runOnlyPendingTimers(); });
  return arbre.root
    .findAll((/** @type {any} */ noeud) => noeud.type === 'Text')
    .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''));
};

beforeEach(() => {
  jest.useFakeTimers();
  mockNavigate.mockClear();
  const toutDeSuite = (/** @type {any} */ tache) => {
    tache();
    return /** @type {any} */ ({ cancel: () => {}, done: () => {}, then: () => {} });
  };
  jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation(toutDeSuite);
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const ENTRAINEUR = {
  documentId: 'u-coach', myTeams: [], role: { name: 'Entraineur' }, trainedTeams: [U17],
};

describe('FINITIONS-AUDIT (4b) — caracterisation du rappel « Ajoute le classement »', () => {
  it('l entraineur d une equipe sans classement est invite, le bouton ouvre SA fiche', () => {
    const textes = rappel(ENTRAINEUR);
    expect(textes).toContain('Ajoute le classement de ta ligue');
    expect(textes).toContain('U17 Filles');

    const libelle = (/** @type {any} */ n) => (
      n.type === 'Text' && n.props.children === 'Ajouter le classement'
    );
    const bouton = arbre.root.findAll((/** @type {any} */ noeud) => (
      noeud.props?.accessibilityRole === 'button' && noeud.findAll(libelle).length > 0
    ))[0];
    act(() => { bouton.props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('TeamStack', expect.objectContaining({
      params: expect.objectContaining({ openExternalSourceSetup: true, teamId: 'eq-u17' }),
    }));
  });

  it('une equipe deja reliee a son classement : aucun rappel', () => {
    const reliee = { ...U17, externalStandingUrl: 'https://ffbb.example/u17' };
    expect(rappel({ ...ENTRAINEUR, trainedTeams: [reliee] })).toEqual([]);
  });

  it('une equipe hors championnat : aucun rappel', () => {
    const horsChampionnat = { ...U17, externalCompetitionEligible: false };
    expect(rappel({ ...ENTRAINEUR, trainedTeams: [horsChampionnat] })).toEqual([]);
  });

  it('l accueil ne l autorise pas : aucun rappel', () => {
    expect(rappel(ENTRAINEUR, { enabled: false })).toEqual([]);
  });

  it('le dirigeant du club, meme s il ne fait qu y jouer, est invite', () => {
    const textes = rappel({
      club: CLUB,
      documentId: 'u-pres',
      myTeams: [U17],
      role: { name: 'Dirigeant' },
      trainedTeams: [],
    });
    expect(textes).toContain('U17 Filles');
  });
});

describe('FINITIONS-AUDIT (4b) — « ou je JOUE » n est pas « ce que je GERE »', () => {
  it('🚨 un JOUEUR de l equipe n est pas invite a configurer son classement', () => {
    expect(rappel({
      documentId: 'u-joueuse', myTeams: [U17], role: { name: 'Joueur' }, trainedTeams: [],
    })).toEqual([]);
  });
});
