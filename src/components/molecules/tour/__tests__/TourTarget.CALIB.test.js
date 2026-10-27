import { NavigationContext } from '@react-navigation/native';
import { View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  measureTourTarget,
  registerTourTarget,
  resetTourTargetsForTests,
} from '@/domains/tour/tourTargetRegistry';

import TourTarget from '../TourTarget';

// TUTOE-CALIBRAGE (27/10) — tunnel équipe, étape « Sport » (tw4), mesuré à
// l'émulateur :
// 1. un 3e cadre décalé en bas à gauche : l'ancre « Passer » de l'écran
//    PRÉCÉDENT, resté monté sous la pile (et poussé par l'animation). Une
//    ancre ne compte que sur l'écran qui a le focus ;
// 2. la découpe du champ descendait 239 px sous la zone visible (liste longue
//    dans un ScrollView) : une ancre est coupée à la zone visible de son
//    conteneur (registre `clipTo`, posé par une ancre `clipChildren`).

/**
 * Navigation simulée : focus réglable, écouteurs focus / blur.
 * @param {boolean} focused - Focus de départ.
 * @returns {any} Navigation.
 */
const fakeNavigation = (focused) => {
  const listeners = { blur: new Set(), focus: new Set() };
  const nav = {
    addListener: (name, cb) => {
      listeners[name].add(cb);
      return () => listeners[name].delete(cb);
    },
    emit: (name) => {
      nav.focused = name === 'focus';
      listeners[name].forEach((cb) => cb());
    },
    focused,
    isFocused: () => nav.focused,
  };
  return nav;
};

const RECT = {
  height: 50, width: 100, x: 0, y: 10,
};

const mount = (navigation) => {
  let tree;
  act(() => {
    tree = renderer.create(
      <NavigationContext.Provider value={navigation}>
        <TourTarget id="cible"><View /></TourTarget>
      </NavigationContext.Provider>,
    );
  });
  const host = tree.root.findAll((node) => node.props.testID === 'tour.target.cible'
    && typeof node.type !== 'string')[0];
  host.instance.measureInWindow = (cb) => cb(RECT.x, RECT.y, RECT.width, RECT.height);
  return tree;
};

beforeEach(() => resetTourTargetsForTests());

describe('TourTarget — seul l’écran qui a le focus compte', () => {
  it('écran sous la pile (sans focus) : l’ancre n’est pas mesurée', async () => {
    mount(fakeNavigation(false));
    await expect(measureTourTarget('cible')).resolves.toBeNull();
  });

  it('l’écran reprend le focus : mesurée ; il le perd : retirée', async () => {
    const navigation = fakeNavigation(false);
    mount(navigation);
    act(() => navigation.emit('focus'));
    await expect(measureTourTarget('cible')).resolves.toEqual(RECT);
    act(() => navigation.emit('blur'));
    await expect(measureTourTarget('cible')).resolves.toBeNull();
  });

  // Émulateur, M3 « ouvre l'accueil » vu de l'onglet Équipes : chaque bouton de
  // la barre reçoit la navigation de SON onglet (sans focus hors de l'onglet).
  // La barre est à l'écran tant que l'écran qui CONTIENT les onglets a le focus.
  it('bouton de la barre d’onglets : le focus est celui de l’écran parent', async () => {
    const parent = fakeNavigation(true);
    const tab = { ...fakeNavigation(false), getParent: () => parent };
    let tree;
    act(() => {
      tree = renderer.create(
        <NavigationContext.Provider value={tab}>
          <TourTarget focusFromParent id="cible"><View /></TourTarget>
        </NavigationContext.Provider>,
      );
    });
    const host = tree.root.findAll((node) => node.props.testID === 'tour.target.cible'
      && typeof node.type !== 'string')[0];
    host.instance.measureInWindow = (cb) => cb(RECT.x, RECT.y, RECT.width, RECT.height);
    await expect(measureTourTarget('cible')).resolves.toEqual(RECT);
    act(() => parent.emit('blur'));
    await expect(measureTourTarget('cible')).resolves.toBeNull();
  });

  it('hors navigation (feuille en portail, barre d’onglets) : mesurée', async () => {
    mount(undefined);
    await expect(measureTourTarget('cible')).resolves.toEqual(RECT);
  });
});

describe('registre — ancre coupée à la zone visible de son conteneur', () => {
  it('la mesure est l’intersection avec l’ancre `clipTo`', async () => {
    registerTourTarget('liste', (done) => done({
      height: 2000, width: 300, x: 20, y: 300,
    }), { clipTo: 'zone' });
    registerTourTarget('zone', (done) => done({
      height: 1200, width: 340, x: 0, y: 250,
    }));
    await expect(measureTourTarget('liste')).resolves.toEqual({
      height: 1150, width: 300, x: 20, y: 300,
    });
  });

  // Émulateur, M3 « Date & horaire » : le bloc date, posé DANS le contenu du
  // tunnel, débordait aussi de 239 px. La zone visible coupe toutes ses ancres.
  it('une ancre posée dans une zone `clipChildren` est coupée sans rien déclarer', async () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <TourTarget clipChildren id="zone">
          <TourTarget id="bloc"><View /></TourTarget>
        </TourTarget>,
      );
    });
    const instance = (testID) => tree.root.findAll((node) => node.props.testID === testID
      && typeof node.type !== 'string')[0].instance;
    instance('tour.target.zone').measureInWindow = (cb) => cb(0, 250, 340, 1200);
    instance('tour.target.bloc').measureInWindow = (cb) => cb(20, 300, 300, 2000);
    await expect(measureTourTarget('bloc')).resolves.toEqual({
      height: 1150, width: 300, x: 20, y: 300,
    });
  });

  it('sans conteneur monté, la mesure reste entière', async () => {
    registerTourTarget('liste', (done) => done({
      height: 2000, width: 300, x: 20, y: 300,
    }), { clipTo: 'zone' });
    await expect(measureTourTarget('liste')).resolves.toEqual({
      height: 2000, width: 300, x: 20, y: 300,
    });
  });
});
