import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';

// CORR-EVENEMENTS point 128 (recette du site, 30/10) — un stage proposait 06:00 – 07:00 par
// défaut (l'heure d'ouverture de l'assistant + 1 h, sur une heure). Décision A : des horaires
// par défaut 09:00 – 17:00.

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

test('🐞 un stage part sur 09:00 – 17:00, à n importe quelle heure d ouverture', () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 10, 30, 5, 20));
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(EventWizardProvider, null, createElement(Sonde)));
  });
  const stage = { documentId: 'type-stage', name: 'Stage' };
  act(() => sonde.dispatch({ payload: stage, type: 'SET_TYPE' }));

  const debut = new Date(sonde.state.stageDefaultStartTime);
  const fin = new Date(sonde.state.stageDefaultEndTime);
  expect([debut.getHours(), debut.getMinutes()]).toEqual([9, 0]);
  expect([fin.getHours(), fin.getMinutes()]).toEqual([17, 0]);

  act(() => arbre.unmount());
  jest.useRealTimers();
});
