/* eslint-disable max-len -- des phrases entieres de l ecran, comparees telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  decideRelocation, getRelocationOptions, proposeRelocation, updateEvent,
} from '@/services/event/eventService';

import DeplacerLaSeance from '../DeplacerLaSeance';

// 🚚 COLL-R-DEPLACER A8 (14/10/2026, COL-013, décision d'Adel « D9 = b ») — « DÉPLACER LA SÉANCE »,
// planches P5v4-deplacer-tel (écrans 2 à 6, 9 à 12) et P5v4-deplacer-ville-tel (écran 4 b).
// ROUGES avant le lot : le tunnel n'existait pas (l'étiquette « à déplacer » ouvrait la
// modification générale, où il fallait deviner une installation libre).

jest.setTimeout(30000);

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
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
      Images: {},
      Spaces: espaces,
    }),
  };
});
jest.mock('@/services/event/eventService', () => ({
  decideRelocation: jest.fn(),
  getRelocationOptions: jest.fn(),
  proposeRelocation: jest.fn(),
  updateEvent: jest.fn(),
}));
// Le gabarit du tunnel : son titre, son sous-titre, son contenu, et son bouton (actif ou non).
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN, View: VueRN } = jest.requireActual('react-native');
  return function WizardStepLayoutMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      VueRN,
      { testID: `etape-${props.stepIndex}` },
      reactActuel.createElement(TexteRN, { testID: 'titre' }, props.title),
      reactActuel.createElement(TexteRN, { testID: 'sous-titre' }, props.subtitle),
      props.children,
      reactActuel.createElement(
        PressableRN,
        { disabled: props.isNextDisabled, onPress: props.onNext, testID: 'suivant' },
        reactActuel.createElement(TexteRN, null, props.nextLabel || 'Suivant'),
      ),
    );
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: props.testID },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function DatePickerInputMock() {
  return null;
});
/** @type {Record<string, any>} */
const mockHeures = {};
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => function TimePickerInputMock(/** @type {any} */ props) {
  mockHeures[props.testID] = props;
  return null;
});

const SEANCE = {
  club: { documentId: 'club-A', name: 'AS Ville A' },
  date: '2031-01-10',
  documentId: 'seance-1',
  endTime: '19:30',
  facility: { documentId: 'gym-ville', name: 'Gymnase des Tilleuls' },
  series: false,
  startTime: '18:00',
  team: { documentId: 'team-U15-A', name: 'U15' },
};
const FERMETURE = {
  documentId: 'fermeture-1', endDate: '2031-01-12', endTime: null, kind: 'closure', label: null, reason: 'vacances', startDate: '2031-01-10', startTime: null,
};
const PLACES = [
  {
    closure: null, current: false, documentId: 'stade-ville', inClubSlot: true, name: 'Stade municipal', reason: null, state: 'libre',
  },
  {
    closure: null, current: false, documentId: 'dojo-ville', inClubSlot: false, name: 'Dojo municipal', reason: null, state: 'villeDecidera',
  },
  {
    closure: null, current: false, documentId: 'college', inClubSlot: false, name: 'Gymnase du Collège', reason: 'facilityFull', state: 'complet',
  },
  {
    closure: FERMETURE, current: true, documentId: 'gym-ville', inClubSlot: false, name: 'Gymnase des Tilleuls', reason: null, state: 'ferme',
  },
];
const FENETRE = { date: '2031-01-10', end: '19:30', start: '18:00' };

/**
 * Le serveur de recette : la liste des places, un lieu sur plusieurs jours, ou une fenêtre précise.
 * @param {{ facilities?: any[], seance?: any, viewer?: string }} [options] - Ce qu'il rend.
 */
const servir = ({ facilities = PLACES, seance = SEANCE, viewer = 'club' } = {}) => {
  getRelocationOptions.mockImplementation(async (_eventId, params = {}) => {
    const base = {
      closure: FERMETURE, event: seance, viewer, window: { date: params.date || FENETRE.date, end: params.end || FENETRE.end, start: params.start || FENETRE.start },
    };
    if (!params.facility) return { ...base, facilities };
    const lieu = facilities.find((place) => place.documentId === params.facility);
    const jours = Number(params.days) || 1;
    const days = Array.from({ length: jours }, (_, rang) => {
      const date = `2031-01-${String(Number((params.date || FENETRE.date).slice(8, 10)) + rang).padStart(2, '0')}`;
      const state = rang === 0 ? lieu.state : 'villeDecidera';
      return {
        closure: null, date, endAt: null, inClubSlot: rang === 0 && lieu.inClubSlot, reason: null, startAt: `${date}T17:00:00.000Z`, state,
      };
    });
    return { ...base, days, facility: { documentId: lieu.documentId, name: lieu.name } };
  });
};

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((noeud) => aplatir(noeud.props.children));
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  const bouton = arbre.root.findAll((noeud) => noeud.props.testID === testID && noeud.type === TouchableOpacity)[0];
  if (!bouton) throw new Error(`bouton introuvable : ${testID}`);
  expect(bouton.props.disabled).toBeFalsy();
  await act(async () => { bouton.props.onPress(); });
};
const attendre = async () => {
  for (let tour = 0; tour < 6; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((resoudre) => { setTimeout(resoudre, 0); }); });
  }
};

/** @type {any} */
let navigation;
const monter = async (/** @type {any} */ props = {}) => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <DeplacerLaSeance
          eventId="seance-1"
          navigation={navigation}
          onIndisponible={props.onIndisponible}
          proposalId={props.proposalId}
          viewer={props.viewer}
        />
      </QueryClientProvider>,
    );
  });
  await attendre();
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  navigation = { goBack: jest.fn() };
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('CRDEP — Déplacer la séance, côté club', () => {
  it('1/4 « Où la déplacer ? » : même jour, même heure, chaque installation avec son état', async () => {
    servir();
    const arbre = await monter();
    expect(getRelocationOptions).toHaveBeenCalledWith('seance-1', { as: undefined });
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Où la déplacer ?',
      'U15 · ven. 10 janv. · 18:00 – 19:30',
      'Le Gymnase des Tilleuls est fermé ce jour-là (vacances).',
      'Libres à cette heure',
      'Stade municipal', 'Dans ton créneau du vendredi', 'Libre',
      'Dojo municipal', 'Hors des créneaux de ton club', 'La Ville décidera',
      'Pas possible à cette heure',
      'Gymnase du Collège', 'Plus de place à cette heure', 'Complet',
      'Gymnase des Tilleuls', 'Vacances, du ven. 10 janv. au dim. 12 janv.', 'Fermé',
    ]));
    const ligneComplete = arbre.root.findAll((noeud) => noeud.props.testID === 'deplacer-lieu-college' && noeud.type === TouchableOpacity)[0];
    expect(ligneComplete.props.disabled).toBe(true);
    expect(arbre.root.findByProps({ testID: 'suivant' }).props.disabled).toBe(true);
  });

  it('du choix du lieu au récapitulatif : une séance, jamais la série ; les joueurs prévenus', async () => {
    servir();
    const arbre = await monter();
    await appuyer(arbre, 'deplacer-lieu-stade-ville');
    await appuyer(arbre, 'suivant');
    await attendre();
    expect(getRelocationOptions).toHaveBeenLastCalledWith('seance-1', {
      as: undefined, date: '2031-01-10', days: 7, end: '19:30', facility: 'stade-ville', start: '18:00',
    });
    expect(textes(arbre)).toEqual(expect.arrayContaining(['Quel jour ?', 'Ven. 10 janv.', 'Le jour prévu', 'Sam. 11 janv.']));
    await appuyer(arbre, 'deplacer-jour-2031-01-10');
    await appuyer(arbre, 'suivant');
    await attendre();
    expect(getRelocationOptions).toHaveBeenLastCalledWith('seance-1', {
      as: undefined, date: '2031-01-10', days: 1, end: '19:30', facility: 'stade-ville', start: '18:00',
    });
    expect(mockHeures['deplacer-debut'].value).toBe('18:00');
    expect(mockHeures['deplacer-fin'].value).toBe('19:30');
    expect(textes(arbre)).toEqual(expect.arrayContaining(['À quelle heure ?', 'Ven. 10 janv. 18:00 – 19:30 : libre', 'Dans ton créneau du vendredi']));
    await appuyer(arbre, 'suivant');
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Récapitulatif',
      'Relis, puis déplace. Tes joueurs sont prévenus.',
      'AS Ville A · U15',
      'Gymnase des Tilleuls · ven. 10 janv. · 18:00 – 19:30',
      'Stade municipal · ven. 10 janv. · 18:00 – 19:30',
      'Place libre, dans ton créneau',
      'Seule cette séance bouge.',
      'Déplacer la séance',
    ]));
    expect(arbre.root.findByProps({ testID: 'deplacer-avant' }).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ textDecorationLine: 'line-through' })]),
    );
    updateEvent.mockResolvedValue({ data: {} });
    await appuyer(arbre, 'suivant');
    await attendre();
    expect(updateEvent).toHaveBeenCalledWith({
      documentId: 'seance-1',
      eventData: {
        date: '2031-01-10T17:00:00.000Z', endTime: '19:30:00.000', facility: 'stade-ville', startTime: '18:00:00.000',
      },
    });
    expect(updateEvent.mock.calls[0][0].recurrenceMode).toBeUndefined();
    expect(proposeRelocation).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Séance déplacée au Stade municipal', 'Les joueurs de U15 sont prévenus.');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('hors du créneau du club : les deux phrases de « deplacer A » sont dites avant d’envoyer la demande', async () => {
    servir();
    const arbre = await monter();
    await appuyer(arbre, 'deplacer-lieu-dojo-ville');
    await appuyer(arbre, 'suivant');
    await attendre();
    await appuyer(arbre, 'deplacer-jour-2031-01-10');
    await appuyer(arbre, 'suivant');
    await attendre();
    await appuyer(arbre, 'suivant');
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Relis, puis envoie. La Ville répond.',
      'Hors des créneaux de ton club : la mairie décidera, même s’il reste de la place.',
      'Si la mairie refuse, la séance sera annulée.',
      'D’ici sa réponse, la séance reste « à déplacer » ; tu es prévenu dès qu’elle répond.',
      'Envoyer la demande',
    ]));
    updateEvent.mockResolvedValue({ data: {} });
    await appuyer(arbre, 'suivant');
    await attendre();
    expect(updateEvent.mock.calls[0][0].eventData.facility).toBe('dojo-ville');
    expect(Alert.alert.mock.calls[0][0]).toBe('Demande envoyée à la Ville');
  });

  it('« Choisir une autre place » (une proposition de la Ville attend) : la proposition est déclinée, puis la séance déplacée', async () => {
    servir();
    const arbre = await monter({ proposalId: 'prop-1' });
    await appuyer(arbre, 'deplacer-lieu-stade-ville');
    await appuyer(arbre, 'suivant');
    await attendre();
    await appuyer(arbre, 'deplacer-jour-2031-01-10');
    await appuyer(arbre, 'suivant');
    await attendre();
    await appuyer(arbre, 'suivant');
    const ordre = [];
    decideRelocation.mockImplementation(async () => { ordre.push('refuse'); throw Object.assign(new Error('tombée'), { details: { code: 'RELOCATION_PROPOSAL_CLOSED' }, status: 409 }); });
    updateEvent.mockImplementation(async () => { ordre.push('deplacer'); return { data: {} }; });
    await appuyer(arbre, 'suivant');
    await attendre();
    expect(decideRelocation).toHaveBeenCalledWith('prop-1', 'refuse');
    expect(ordre).toEqual(['refuse', 'deplacer']);
    expect(Alert.alert.mock.calls[0][0]).toBe('Séance déplacée au Stade municipal');
  });

  it('une séance d’une série : le récapitulatif redit qu’elle seule bouge', async () => {
    servir({ seance: { ...SEANCE, series: true } });
    const arbre = await monter();
    await appuyer(arbre, 'deplacer-lieu-stade-ville');
    await appuyer(arbre, 'suivant');
    await attendre();
    await appuyer(arbre, 'deplacer-jour-2031-01-10');
    await appuyer(arbre, 'suivant');
    await attendre();
    await appuyer(arbre, 'suivant');
    expect(textes(arbre)).toContain('Cette séance fait partie d’une série. Seule celle du ven. 10 janv. est déplacée.');
  });

  it('rien de libre ce jour-là : on le dit, et on propose tout de suite un autre jour', async () => {
    servir({ facilities: PLACES.filter((place) => ['complet', 'ferme'].includes(place.state)) });
    const arbre = await monter();
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Aucune installation libre ven. 10 janv. à 18:00',
      'Garde un lieu et choisis un autre jour.',
    ]));
    await appuyer(arbre, 'deplacer-autre-jour');
    await attendre();
    expect(arbre.root.findAllByProps({ testID: 'etape-2' }).length).toBeGreaterThan(0);
    expect(getRelocationOptions).toHaveBeenLastCalledWith('seance-1', expect.objectContaining({ days: 7, facility: 'gym-ville' }));
  });

  it('les places n’ont pas pu être lues : on le dit, la séance n’a pas bougé, on peut réessayer', async () => {
    getRelocationOptions.mockRejectedValue({
      details: {}, message: 'boom', name: 'InternalServerError', status: 500,
    });
    const indisponible = jest.fn();
    const arbre = await monter({ onIndisponible: indisponible });
    expect(textes(arbre)).toContain('Les places libres n’ont pas pu être lues. Vérifie la connexion, puis réessaie. Ta séance n’a pas bougé.');
    expect(indisponible).not.toHaveBeenCalled();
    servir();
    await appuyer(arbre, 'deplacer-reessayer');
    await attendre();
    expect(textes(arbre)).toContain('Stade municipal');
  });
});

describe('CRDEP — un serveur d’AVANT ce lot', () => {
  it('la route n’existe pas (404 sans code du lot) : l’écran rend la modification de la séance, sans planter', async () => {
    getRelocationOptions.mockRejectedValue({
      details: {}, message: 'Not Found', name: 'NotFoundError', status: 404,
    });
    const indisponible = jest.fn();
    await monter({ onIndisponible: indisponible });
    expect(indisponible).toHaveBeenCalledTimes(1);
  });

  it('un vrai refus du lot (403 RELOCATION_FORBIDDEN) n’est PAS un serveur d’avant', async () => {
    getRelocationOptions.mockRejectedValue({ details: { code: 'RELOCATION_FORBIDDEN' }, name: 'ForbiddenError', status: 403 });
    const indisponible = jest.fn();
    const arbre = await monter({ onIndisponible: indisponible });
    expect(indisponible).not.toHaveBeenCalled();
    expect(arbre.root.findAllByProps({ testID: 'deplacer-erreur' }).length).toBeGreaterThan(0);
  });
});

describe('CRDEP — la Ville propose une place (« D9 = b »)', () => {
  it('ses installations, « vous », et « Envoyer la proposition » : elle n’écrit jamais la séance', async () => {
    servir({
      facilities: [
        { ...PLACES[0], inClubSlot: false }, { ...PLACES[1], state: 'libre' }, PLACES[2], PLACES[3],
      ],
      viewer: 'ville',
    });
    const arbre = await monter({ viewer: 'ville' });
    expect(getRelocationOptions).toHaveBeenCalledWith('seance-1', { as: 'ville' });
    expect(textes(arbre)).toContain('AS Ville A · U15 · ven. 10 janv. · 18:00 – 19:30');
    expect(textes(arbre)).not.toContain('Hors des créneaux de ton club');
    await appuyer(arbre, 'deplacer-lieu-stade-ville');
    await appuyer(arbre, 'suivant');
    await attendre();
    await appuyer(arbre, 'deplacer-jour-2031-01-10');
    await appuyer(arbre, 'suivant');
    await attendre();
    await appuyer(arbre, 'suivant');
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Relisez, puis proposez. Le club répond.',
      'Place proposée',
      'AS Ville A reçoit votre proposition. Il l’accepte d’un appui, ou choisit une autre place. D’ici là, la séance reste « à déplacer ».',
      'Envoyer la proposition',
    ]));
    expect(arbre.root.findAllByProps({ testID: 'deplacer-avant' })).toHaveLength(0);
    proposeRelocation.mockResolvedValue({ documentId: 'proposition-1', status: 'pending' });
    await appuyer(arbre, 'suivant');
    await attendre();
    expect(proposeRelocation).toHaveBeenCalledWith('seance-1', {
      date: '2031-01-10', end: '19:30', facility: 'stade-ville', start: '18:00',
    });
    expect(updateEvent).not.toHaveBeenCalled();
    expect(Alert.alert.mock.calls[0][0]).toBe('Proposition envoyée');
  });
});
