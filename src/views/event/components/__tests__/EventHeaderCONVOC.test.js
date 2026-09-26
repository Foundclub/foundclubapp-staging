import { Alert, Linking } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventHeader from '../EventHeader';

// CONVOC (demande d'Adel du 26/09) — LA FICHE DE L'EVENEMENT PROPOSE LE MEME CHOIX
// D'APPLI GPS QUE « TU ES CONVOQUE ». Meme geste, meme choix, partout.
//
// Avant ce lot, la fiche ouvrait une seule adresse (`maps:` sur iPhone, `geo:` sur
// Android, Google Maps en secours), sans jamais demander — et sur iPhone
// `canOpenURL('maps:')` rendait faux faute de declaration : c'est la page Google
// Maps qui s'ouvrait. Jest tourne en iOS (preset react-native).

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: new Proxy({}, { get: (_cible, cle) => `couleur-${String(cle)}` }),
      Fonts: new Proxy({}, { get: () => styleLeaf }),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

const ADRESSE = 'Stade de Pélissanne, 13330 Pélissanne';

const EVENEMENT = {
  date: '2026-09-28T17:30:00.000Z',
  documentId: 'evt-1',
  location: { lat: 43.63, lng: 5.15 },
  locationDetails: JSON.stringify({ address: ADRESSE }),
  name: 'Match',
  startTime: '19:30:00',
  team: {
    club: { documentId: 'club-1', name: 'FC Test' },
    documentId: 'team-1',
    name: 'Senior 1',
  },
  type: { documentId: 'type-1', name: 'Match' },
};

/** @type {any} */
let arbre;

/**
 * Le pressable qui porte le lieu : celui dont le texte contient l'adresse.
 * @returns {any}
 */
const lieu = () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return arbre.root.findAll((/** @type {any} */ noeud) => (
    typeof noeud.props?.onPress === 'function'
    && noeud.findAllByType(TexteRN)
      .some((/** @type {any} */ texte) => texte.props.children === ADRESSE)
  ))[0];
};

const toucherLeLieu = async () => {
  await act(async () => {
    lieu().props.onPress();
    await new Promise((resoudre) => { setTimeout(resoudre, 0); });
  });
};

/** @type {jest.SpyInstance} */
let espionAlerte;
/** @type {jest.SpyInstance} */
let espionOuvrir;
/** @type {jest.SpyInstance} */
let espionSonde;

beforeEach(() => {
  // `Linking` est DEJA une doublure dans le preset Jest : `spyOn` la reutilise,
  // et ses appels passeraient d'un temoin a l'autre sans cette remise a zero.
  jest.clearAllMocks();
  espionAlerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  espionOuvrir = jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve(true));
  espionSonde = jest.spyOn(Linking, 'canOpenURL').mockImplementation(() => Promise.resolve(true));
  act(() => {
    arbre = renderer.create(<EventHeader event={EVENEMENT} />);
  });
});

afterEach(() => {
  act(() => arbre.unmount());
  jest.restoreAllMocks();
});

describe('CONVOC — le lieu de la fiche propose l’appli GPS', () => {
  it('témoin 1 — toucher le lieu propose Plans, Google Maps et Waze installés', async () => {
    await toucherLeLieu();

    expect(espionAlerte).toHaveBeenCalledTimes(1);
    const [titre, , boutons] = espionAlerte.mock.calls[0];
    expect(titre).toBe('Ouvrir le lieu avec');
    expect(boutons.map((/** @type {any} */ bouton) => bouton.text))
      .toEqual(['Annuler', 'Plans', 'Google Maps', 'Waze']);
  });

  it('témoin 2 — choisir Google Maps ouvre l’appli Google Maps sur le lieu', async () => {
    await toucherLeLieu();

    const [, , boutons] = espionAlerte.mock.calls[0];
    await act(async () => {
      boutons.find((/** @type {any} */ bouton) => bouton.text === 'Google Maps').onPress();
    });

    expect(espionOuvrir).toHaveBeenCalledWith(
      `comgooglemaps://?q=${encodeURIComponent(ADRESSE)}&center=43.63,5.15`,
    );
  });

  it('témoin 3 — seul Plans est là : il s’ouvre directement, sans question', async () => {
    espionSonde.mockImplementation(() => Promise.resolve(false));
    await toucherLeLieu();

    expect(espionAlerte).not.toHaveBeenCalled();
    expect(espionOuvrir).toHaveBeenCalledWith(
      `https://maps.apple.com/?ll=43.63,5.15&q=${encodeURIComponent(ADRESSE)}`,
    );
  });
});
