import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardParticipants from '../EventWizardParticipants';

// AE04 — LE TEMOIN D'ECRAN DU PLANTAGE CONSTATE PAR ADEL LE 2026-08-22.
//
// 🧨 Sur l'emulateur, l'etape Participants d'un match mourait en « Render
// Error : url.startsWith is not a function (it is undefined) » des qu'UN joueur
// de l'equipe avait une photo. La cause n'etait pas `ProfileAvatar` : l'ecran
// lui passait l'OBJET media de Strapi (`{ url, formats, ... }`) au lieu de
// l'adresse de la photo.
//
// 🎯 CE TEMOIN NE REGARDE PAS DES PIXELS, il regarde CE QUE L'ECRAN PASSE. La
// doublure de `ProfileAvatar` capture ses proprietes, et le temoin exige deux
// choses que la seule garde de `imageUrl.js` ne donnerait PAS :
//   ① l'ecran monte sans jeter ;
//   ② la photo est bien TRANSMISE (une string), pas remplacee par les
//      initiales — c'est ce que la garde seule aurait fait.
//
// ⚠️ L'avatar d'un joueur de compo est TANTOT une string (l'instantane d'une
// composition publiee) TANTOT un objet media (l'effectif rendu par le
// serveur). Les deux formes sont dans la meme equipe ci-dessous, exprès.
//
// ⛔ Les temoins AC04 existants doublent `ProfileAvatar` en `() => null` : ils
// ne voient pas ses proprietes, et restaient donc VERTS sur le code casse.

/** Les proprietes recues par chaque `ProfileAvatar` rendu, dans l'ordre. */
const mockAvatarsRecus = [];

/** L'effectif rendu par le serveur : les 3 formes d'avatar, dans une equipe. */
const EQUIPE_COMPLETE = {
  club: { documentId: 'club-1', name: 'FC Test' },
  documentId: 'equipe-1',
  name: 'U15 A',
  players: [
    {
      avatar: {
        formats: { thumbnail: { url: '/uploads/thumbnail_karim.jpg' } },
        id: 7,
        url: '/uploads/karim.jpg',
      },
      documentId: 'j1',
      firstname: 'Karim',
      lastname: 'Benali',
    },
    {
      avatar: '/uploads/louis.jpg',
      documentId: 'j2',
      firstname: 'Louis',
      lastname: 'Marchand',
    },
    { avatar: null, documentId: 'j3', firstname: 'Theo', lastname: 'Nguyen' },
  ],
  sport: { documentId: 'sport-1', name: 'Football' },
};

/** L'equipe telle que l'etape 2 la depose : ses joueurs n'ont qu'un id. */
const EQUIPE_DU_TUNNEL = {
  club: { documentId: 'club-1', name: 'FC Test' },
  documentId: 'equipe-1',
  name: 'U15 A',
  players: [{ documentId: 'j1' }, { documentId: 'j2' }, { documentId: 'j3' }],
  sport: { documentId: 'sport-1', name: 'Football' },
};

const TYPE_MATCH = { documentId: 'type-match', name: 'Match' };

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
      return cle;
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

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL` et
// la suite entiere meurt au chargement (0 test execute).
jest.mock('@/services/team/teamQueries', () => ({
  useGetTeam: (/** @type {string} */ identifiant, /** @type {any} */ options) => (
    options?.enabled === false || !identifiant
      ? { data: undefined, isLoading: false }
      : { data: EQUIPE_COMPLETE, isLoading: false }
  ),
}));

// LA DOUBLURE QUI VOIT. Elle note ce que l'ecran lui passe, puis ne rend rien.
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => function AvatarMock(
  /** @type {any} */ props,
) {
  mockAvatarsRecus.push(props);
  return null;
});

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
 * Monte l'etape Participants d'un MATCH, equipe semee.
 * @returns {any} L'arbre et son demontage.
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

  return { arbre, demonter: () => act(() => arbre.unmount()) };
};

/**
 * Les DERNIERES proprietes recues par l'avatar de ce joueur.
 * ⚠️ L'ecran se rend plusieurs fois (montage, puis l'effet qui rappelle
 * l'equipe complete) : on lit le dernier rendu, pas le premier.
 * @param {string} nom Le nom affiche du joueur.
 * @returns {any} Les proprietes, ou `undefined`.
 */
const avatarDe = (nom) => mockAvatarsRecus
  .filter((/** @type {any} */ props) => props.name === nom)
  .pop();

beforeEach(() => {
  mockAvatarsRecus.length = 0;
});

describe("AE04 — l'etape Participants d'un match, avec des joueurs qui ont une photo", () => {
  it("monte sans jeter — c'est le plantage constate par Adel le 22/08", () => {
    const { demonter } = monterEtapeParticipants();

    // ⛔ Pas de comptage : l'ecran se rend plusieurs fois, et un nombre exact
    // ferait echouer ce temoin au moindre rendu de plus. Ce qui compte est que
    // les TROIS joueurs de l'effectif soient bien passes par l'avatar — sans
    // ca, le temoin serait vert sur un ecran vide.
    const nomsVus = new Set(mockAvatarsRecus.map((/** @type {any} */ p) => p.name));
    expect(nomsVus).toEqual(new Set(['Karim Benali', 'Louis Marchand', 'Theo Nguyen']));

    demonter();
  });

  it("ne passe JAMAIS un objet a ProfileAvatar — une string ou rien", () => {
    const { demonter } = monterEtapeParticipants();

    mockAvatarsRecus.forEach((/** @type {any} */ props) => {
      const recu = props.imageUrl;
      expect(recu === null || typeof recu === 'string').toBe(true);
    });

    demonter();
  });

  it("TRANSMET la photo du joueur dont l'avatar est un objet media", () => {
    const { demonter } = monterEtapeParticipants();

    expect(avatarDe('Karim Benali').imageUrl).toBe('/uploads/karim.jpg');

    demonter();
  });

  it("transmet telle quelle la photo deja sous forme de string", () => {
    const { demonter } = monterEtapeParticipants();

    expect(avatarDe('Louis Marchand').imageUrl).toBe('/uploads/louis.jpg');

    demonter();
  });

  it("laisse les initiales au joueur sans photo", () => {
    const { demonter } = monterEtapeParticipants();

    expect(avatarDe('Theo Nguyen').imageUrl).toBeNull();

    demonter();
  });
});
