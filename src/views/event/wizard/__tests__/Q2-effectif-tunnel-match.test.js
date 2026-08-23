import { createElement } from 'react';
import { ActivityIndicator } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardParticipants from '../EventWizardParticipants';

// Q2 — LE CONSTAT D'ADEL EN RECETTE DU 2026-08-23.
//
// 🧨 Dans le tunnel de creation d'un MATCH, l'etape « Participants » affiche
// pendant une seconde ou deux un message FAUX : « Cette equipe n'a encore aucun
// joueur », avec un compteur « 0 sur 0 ». Puis la liste « pop » d'un coup.
//
// 🎯 LA CAUSE MESUREE, ET CE QUE CE TEMOIN GARDE. L'ecran ne destructurait que
// `data` de `useGetTeam` (`EventWizardParticipants.js:156`) : l'etat « la
// requete vole encore » et l'etat « l'equipe est vraiment vide » rendaient
// EXACTEMENT le meme ecran, parce que `squadPlayers` vaut `[]` dans les deux
// cas. Le rendu ne mentait pas par erreur de calcul — il n'avait aucun moyen de
// distinguer les deux situations.
//
// 🔒 LE GARDE-FOU DU LOT est le temoin ②. Cacher le message pendant le vol est
// facile ; le cacher POUR TOUJOURS serait une regression silencieuse — une
// equipe reellement sans joueur doit continuer a le dire, sinon l'organisateur
// reste devant un cadre vide sans explication.
//
// ⛔ Les temoins AC04 et AE04 existants doublent `useGetTeam` avec
// `isLoading: false` en dur : ils ne voient jamais le vol, et restaient donc
// VERTS sur l'ecran menteur.

/** L'etat servi par la doublure de `useGetTeam` — pilotable par chaque temoin. */
const mockRequeteEffectif = {
  /** @type {any} */
  data: undefined,
  isLoading: false,
};

/** L'effectif complet, tel que `getTeamById` le rend. */
const EQUIPE_COMPLETE = {
  club: { documentId: 'club-1', name: 'FC Test' },
  documentId: 'equipe-1',
  name: 'U15 A',
  players: [
    { documentId: 'j1', firstname: 'Karim', lastname: 'Benali' },
    { documentId: 'j2', firstname: 'Louis', lastname: 'Marchand' },
    { documentId: 'j3', firstname: 'Theo', lastname: 'Nguyen' },
  ],
  sport: { documentId: 'sport-1', name: 'Football' },
};

/** La MEME equipe, mais reellement sans joueur : le vrai cas vide. */
const EQUIPE_SANS_JOUEUR = { ...EQUIPE_COMPLETE, players: [] };

/** L'equipe telle que l'etape 2 la depose : ses joueurs n'ont qu'un id. */
const EQUIPE_DU_TUNNEL = {
  club: { documentId: 'club-1', name: 'FC Test' },
  documentId: 'equipe-1',
  name: 'U15 A',
  players: [{ documentId: 'j1' }, { documentId: 'j2' }, { documentId: 'j3' }],
  sport: { documentId: 'sport-1', name: 'Football' },
};

const TYPE_MATCH = { documentId: 'type-match', name: 'Match' };

// ⚠️ CETTE DOUBLURE INTERPOLE, contrairement a celle d'AC04/AE04. Sans ca, le
// compteur rendrait le GABARIT (« {{count}} sur {{total}} ») et le temoin ne
// pourrait pas voir le « 0 sur 0 » que Adel a lu a l'ecran.
jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
      let modele = cle;
      if (typeof repli === 'string') modele = repli;
      else if (repli && typeof repli.defaultValue === 'string') modele = repli.defaultValue;

      const valeurs = (repli && typeof repli === 'object') ? repli : options;
      if (!valeurs) return modele;

      return String(modele).replace(
        /\{\{(\w+)\}\}/g,
        (/** @type {string} */ trouve, /** @type {string} */ nom) => (
          valeurs[nom] === undefined ? trouve : String(valeurs[nom])
        ),
      );
    },
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte. ⛔ Jamais un Proxy : il
// rend les echecs Jest illisibles (constat du lot paywall, 02/08).
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
      Images: { arrowLeft: 1, chevronDown: 1, close: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  return props.children;
});

jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => () => null);

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL` et
// la suite entiere meurt au chargement (0 test execute).
jest.mock('@/services/team/teamQueries', () => ({
  useGetTeam: (/** @type {string} */ identifiant, /** @type {any} */ options) => (
    options?.enabled === false || !identifiant
      ? { data: undefined, isLoading: false }
      : { data: mockRequeteEffectif.data, isLoading: mockRequeteEffectif.isLoading }
  ),
}));

/** Le dispatch du tunnel, capte pour semer un etat de depart. */
let semer = () => {};

/**
 * Sonde sans rendu : elle expose le `dispatch` du tunnel.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  semer = useEventWizard().dispatch;
  return null;
}

/**
 * Tous les textes rendus sous ce noeud, dans l'ordre du rendu.
 * ⚠️ On marche sur `children` de l'instance de test, PAS sur `toJSON()`.
 * @param {any} instance Instance de test (ou racine).
 * @param {string[]} [recueil] Accumulateur.
 * @returns {string[]} Les textes trouves.
 */
const textesDe = (instance, recueil = []) => {
  const enfants = instance?.children || [];
  enfants.forEach((/** @type {any} */ enfant) => {
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      recueil.push(String(enfant));
      return;
    }
    textesDe(enfant, recueil);
  });
  return recueil;
};

/**
 * Monte l'etape Participants d'un MATCH, equipe semee.
 * @returns {any} L'arbre, ses textes et son demontage.
 */
const monterEtapeParticipants = () => {
  const navigation = {
    canGoBack: () => true,
    goBack: () => {},
    navigate: () => {},
    push: () => {},
    replace: () => {},
    reset: () => {},
    setParams: () => {},
  };

  const rendre = (/** @type {any} */ contenu) => createElement(
    EventWizardProvider,
    null,
    createElement(PriseDeCourant),
    contenu,
  );

  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(rendre(null)); });
  act(() => semer({ payload: TYPE_MATCH, type: 'SET_TYPE' }));
  act(() => semer({ payload: EQUIPE_DU_TUNNEL, type: 'SET_TEAM' }));
  act(() => {
    arbre.update(rendre(createElement(
      EventWizardParticipants,
      { navigation, route: { params: {} } },
    )));
  });

  return {
    arbre,
    demonter: () => act(() => arbre.unmount()),
    indicateurs: () => arbre.root.findAllByType(ActivityIndicator),
    textes: () => textesDe(arbre.root),
  };
};

/**
 * L'etape Participants PENDANT que l'effectif vole encore.
 * @returns {any} L'ecran monte.
 */
const monterPendantLeVol = () => {
  mockRequeteEffectif.isLoading = true;
  mockRequeteEffectif.data = undefined;
  return monterEtapeParticipants();
};

beforeEach(() => {
  mockRequeteEffectif.data = undefined;
  mockRequeteEffectif.isLoading = false;
});

describe("Q2 — l'effectif du match pendant qu'il vole encore", () => {
  test("①a pendant le vol, l'ecran ne dit PAS que l'equipe n'a aucun joueur", () => {
    const { demonter, textes } = monterPendantLeVol();

    // Le constat d'Adel, mot pour mot : ce message s'affichait pendant le vol.
    expect(textes().some((texte) => texte.includes('aucun joueur'))).toBe(false);

    demonter();
  });

  test('①b pendant le vol, le compteur ne dit PAS « 0 sur 0 »', () => {
    const { demonter, textes } = monterPendantLeVol();

    expect(textes()).not.toContain('0 sur 0');

    demonter();
  });

  test("①c pendant le vol, un indicateur de chargement tient la place de la liste", () => {
    const { demonter, indicateurs } = monterPendantLeVol();

    expect(indicateurs().length).toBeGreaterThan(0);

    demonter();
  });

  test('② une equipe VRAIMENT sans joueur le dit toujours — le garde-fou du lot', () => {
    mockRequeteEffectif.isLoading = false;
    mockRequeteEffectif.data = EQUIPE_SANS_JOUEUR;

    const { demonter, indicateurs, textes } = monterEtapeParticipants();
    const rendus = textes();

    expect(rendus.some((texte) => texte.includes('aucun joueur'))).toBe(true);
    // Le vol est fini : plus d'indicateur, et le compteur redit la verite.
    expect(indicateurs().length).toBe(0);
    expect(rendus).toContain('0 sur 0');

    demonter();
  });

  test('③ effectif arrive : les trois joueurs sont la, et comptes', () => {
    mockRequeteEffectif.isLoading = false;
    mockRequeteEffectif.data = EQUIPE_COMPLETE;

    const { demonter, indicateurs, textes } = monterEtapeParticipants();
    const rendus = textes();

    expect(rendus).toContain('Karim Benali');
    expect(rendus).toContain('Louis Marchand');
    expect(rendus).toContain('Theo Nguyen');
    expect(rendus.some((texte) => texte.includes('aucun joueur'))).toBe(false);
    expect(rendus).toContain('3 sur 3');
    expect(indicateurs().length).toBe(0);

    demonter();
  });
});
