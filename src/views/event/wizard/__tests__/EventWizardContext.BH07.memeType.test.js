/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';

// BH07 / P8-03 (24/10) — re-choisir le MEME type depuis le Recap ne doit effacer ni les
// creneaux de detection ni les equipes invitees du tournoi.

/** @type {any} */
let sonde = null;

/**
 * Sonde sans rendu : expose l'etat et le dispatch du tunnel.
 * @returns {null} Rien.
 */
function Sonde() {
  sonde = useEventWizard();
  return null;
}

const monter = () => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(createElement(EventWizardProvider, null, createElement(Sonde))); });
  return arbre;
};

test.each([
  ['detection', { documentId: 'type-detection', name: 'Detection' }, 'detectionSlots'],
  ['tournoi', { documentId: 'type-tournoi', name: 'Tournoi' }, 'invitedTeams'],
])('P8-03 — %s : le meme type re-choisi garde %s', (_nom, type, champ) => {
  const arbre = monter();
  act(() => sonde.dispatch({ payload: type, type: 'SET_TYPE' }));
  act(() => sonde.dispatch({ payload: { [champ]: [{ documentId: 'x' }] }, type: 'SET_META' }));
  act(() => sonde.dispatch({ payload: { ...type }, type: 'SET_TYPE' }));
  expect(sonde.state[champ]).toEqual([{ documentId: 'x' }]);
  act(() => sonde.dispatch({ payload: { ...type, documentId: 'type-autre' }, type: 'SET_TYPE' }));
  expect(sonde.state[champ]).toEqual([]);
  act(() => arbre.unmount());
});
