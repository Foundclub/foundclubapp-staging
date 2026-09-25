/* eslint-env jest */
const { createElement } = require('react');
const { StatusBar } = require('react-native');
const renderer = require('react-test-renderer');

/**
 * Garde-fou du lot CI-VERTE (2026-09-25) : LA FAUSSE HORLOGE NE DOIT PAS
 * DÉRÉGLER LA VRAIE.
 *
 * Du 22 au 25/09, les tests unitaires de la CI `app` ne s'arrêtaient plus
 * (20 lancements tués à 6 HEURES). Aucun témoin n'était rouge. Le mécanisme,
 * mesuré poignée par poignée :
 *
 *   1. un témoin passe en fausse horloge (`jest.useFakeTimers`) pendant qu'un
 *      écran portant un `StatusBar` est ouvert ;
 *   2. `StatusBar` range son `setImmediate` dans une variable STATIQUE
 *      (`StatusBar._updateImmediate`, react-native 0.81) — ici une poignée
 *      FACTICE, qui survit au retour à la vraie horloge ;
 *   3. à la mise à jour suivante, `StatusBar` passe cette poignée factice au
 *      VRAI `clearImmediate`. Node 20 et 22 décomptent alors un `setImmediate`
 *      qui n'a jamais existé : leur file se dérègle, et un `setImmediate`
 *      posé ensuite peut ne plus partir du tout. Jest l'attend. Six heures.
 *
 * Node 24 tolère ce cas (mesuré : 24.11 et 24.16 sains, 20.9 et 22.13
 * déréglés). ⚠️ Ce témoin n'est donc DISCRIMINANT que sous Node 20 ou 22 —
 * c'est-à-dire sur la CI (`node-version: 22`), là où la panne vivait.
 *
 * Le correctif vit dans `jest.setup.js` (le filet partagé) : le vrai
 * `clearImmediate` n'y accepte plus que de vrais `Immediate`.
 */

/**
 * Laisse passer un tour de la VRAIE horloge et dit qui a gagné : le
 * `setImmediate` posé depuis un `setTimeout`, ou la garde d'une seconde.
 * @returns {Promise<'setImmediate' | 'garde'>} le premier arrivé
 */
const unTourDeVraieHorloge = () => new Promise((resoudre) => {
  const garde = setTimeout(() => resoudre('garde'), 1000);
  setTimeout(() => {
    setImmediate(() => {
      clearTimeout(garde);
      resoudre('setImmediate');
    });
  }, 0);
});

describe('filet — la fausse horloge ne dérègle pas la vraie', () => {
  it('une poignée FACTICE passée au vrai clearImmediate est sans effet', async () => {
    jest.useFakeTimers();
    const poigneeFactice = setImmediate(() => {});
    jest.useRealTimers();

    clearImmediate(poigneeFactice);

    await expect(unTourDeVraieHorloge()).resolves.toBe('setImmediate');
  });

  it('StatusBar ouvert sous fausse horloge, mis à jour puis refermé sous la vraie', async () => {
    jest.useFakeTimers();
    let arbre;
    renderer.act(() => {
      arbre = renderer.create(createElement(StatusBar, { barStyle: 'light-content' }));
    });
    jest.useRealTimers();

    // Chacun de ces deux gestes rappelle `clearImmediate(StatusBar._updateImmediate)`.
    renderer.act(() => { arbre.update(createElement(StatusBar, { barStyle: 'dark-content' })); });
    renderer.act(() => { arbre.unmount(); });

    await expect(unTourDeVraieHorloge()).resolves.toBe('setImmediate');
  });
});
