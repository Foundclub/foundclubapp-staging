import { Alert, Linking, Platform } from 'react-native';

import {
  buildExternalMapLinks,
  listExternalMapApps,
  openExternalMap,
} from './externalMap';

// CONVOC (demande d'Adel du 26/09) — l'aide partagee qui ouvre un lieu dans l'appli
// GPS de son choix. Les temoins d'ecran (« Tu es convoque », fiche) couvrent iOS ;
// ceux-ci couvrent ce qu'un ecran ne montre pas : Android, le site, les bords.

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

const LIEU = { label: 'Stade de Pélissanne', latitude: 43.63, longitude: 5.15 };
const osDOrigine = Platform.OS;

/**
 * Double de `canOpenURL` : repond oui aux seules adresses dont le debut est liste.
 * @param {string[]} installes
 * @returns {jest.SpyInstance}
 */
const installer = (installes) => jest.spyOn(Linking, 'canOpenURL').mockImplementation(
  (url) => Promise.resolve(installes.some((debut) => String(url).startsWith(debut))),
);

/** @type {jest.SpyInstance} */
let espionAlerte;
/** @type {jest.SpyInstance} */
let espionOuvrir;

beforeEach(() => {
  // `Linking` est DEJA une doublure dans le preset Jest : `spyOn` la reutilise,
  // et ses appels passeraient d'un temoin a l'autre sans cette remise a zero.
  jest.clearAllMocks();
  espionAlerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  espionOuvrir = jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve(true));
});

afterEach(() => {
  Platform.OS = osDOrigine;
  jest.restoreAllMocks();
});

describe('CONVOC — buildExternalMapLinks', () => {
  it('rien à ouvrir sans adresse ni coordonnées', () => {
    expect(buildExternalMapLinks({})).toBeNull();
    expect(buildExternalMapLinks({ label: '   ' })).toBeNull();
  });

  it('une coordonnée ABSENTE n’est jamais lue comme 0', () => {
    const liens = buildExternalMapLinks({ label: 'Stade', latitude: null, longitude: null });

    expect(liens?.waze).toBe('waze://?q=Stade&navigate=yes');
    expect(liens?.device).toBe('geo:0,0?q=Stade');
    expect(liens?.apple).toBe('https://maps.apple.com/?q=Stade');
  });

  it('l’adresse est encodée, les coordonnées placent le point', () => {
    const liens = buildExternalMapLinks(LIEU);
    const adresse = encodeURIComponent('Stade de Pélissanne');

    expect(liens?.google).toBe(`https://www.google.com/maps/search/?api=1&query=${adresse}`);
    expect(liens?.device).toBe(`geo:43.63,5.15?q=43.63,5.15(${adresse})`);
  });
});

describe('CONVOC — listExternalMapApps', () => {
  it('iOS — Plans toujours, Google Maps et Waze seulement s’ils répondent', async () => {
    const liens = /** @type {any} */ (buildExternalMapLinks(LIEU));

    installer([]);
    expect((await listExternalMapApps(liens, 'ios')).map((app) => app.key)).toEqual(['apple']);

    installer(['waze://']);
    expect((await listExternalMapApps(liens, 'ios')).map((app) => app.key))
      .toEqual(['apple', 'waze']);
  });

  it('Android — Google Maps et Waze, jamais l’appli du téléphone en doublon', async () => {
    const liens = /** @type {any} */ (buildExternalMapLinks(LIEU));
    installer(['google.navigation:', 'waze://', 'geo:']);

    expect((await listExternalMapApps(liens, 'android')).map((app) => app.key))
      .toEqual(['google', 'waze']);
  });

  it('Android sans Google Maps — l’appli de cartes du téléphone prend sa place', async () => {
    const liens = /** @type {any} */ (buildExternalMapLinks(LIEU));
    installer(['waze://', 'geo:']);

    expect((await listExternalMapApps(liens, 'android')).map((app) => app.key))
      .toEqual(['device', 'waze']);
  });

  it('une sonde qui échoue vaut « pas installée »', async () => {
    const liens = /** @type {any} */ (buildExternalMapLinks(LIEU));
    jest.spyOn(Linking, 'canOpenURL').mockImplementation(() => Promise.reject(new Error('refus')));

    expect((await listExternalMapApps(liens, 'ios')).map((app) => app.key)).toEqual(['apple']);
  });
});

describe('CONVOC — openExternalMap', () => {
  it('Android — le choix tient dans les 3 boutons qu’Android sait afficher', async () => {
    Platform.OS = 'android';
    installer(['google.navigation:', 'waze://', 'geo:']);

    await openExternalMap(LIEU);

    const [, , boutons] = espionAlerte.mock.calls[0];
    expect(boutons.length).toBeLessThanOrEqual(3);
    expect(boutons.map((/** @type {any} */ bouton) => bouton.text))
      .toEqual(['Annuler', 'Google Maps', 'Waze']);
  });

  it('aucune appli ne répond — la page Google Maps s’ouvre', async () => {
    Platform.OS = 'android';
    installer([]);

    await openExternalMap(LIEU);

    expect(espionAlerte).not.toHaveBeenCalled();
    expect(espionOuvrir).toHaveBeenCalledWith(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Stade de Pélissanne')}`,
    );
  });

  it('l’appli choisie refuse de s’ouvrir — la page Google Maps prend le relais', async () => {
    installer(['waze://']);
    espionOuvrir.mockImplementationOnce(() => Promise.reject(new Error('refus')));

    await openExternalMap(LIEU);
    const [, , boutons] = espionAlerte.mock.calls[0];
    await boutons.find((/** @type {any} */ bouton) => bouton.text === 'Waze').onPress();
    await new Promise((resoudre) => { setTimeout(resoudre, 0); });

    expect(espionOuvrir).toHaveBeenLastCalledWith(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Stade de Pélissanne')}`,
    );
  });

  it('sur le site — Google Maps dans un nouvel onglet, sans question', async () => {
    Platform.OS = 'web';
    const espionOnglet = jest.fn();
    const fenetreDOrigine = global.window.open;
    global.window.open = espionOnglet;

    await openExternalMap(LIEU);
    global.window.open = fenetreDOrigine;

    expect(espionAlerte).not.toHaveBeenCalled();
    expect(espionOnglet).toHaveBeenCalledWith(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Stade de Pélissanne')}`,
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('rien à ouvrir — rien ne s’ouvre', async () => {
    expect(await openExternalMap({ label: '' })).toBe(false);
    expect(espionOuvrir).not.toHaveBeenCalled();
    expect(espionAlerte).not.toHaveBeenCalled();
  });
});
