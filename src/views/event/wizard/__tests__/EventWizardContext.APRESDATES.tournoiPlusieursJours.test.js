import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';

// APRESDATES / Q4-10 (27/10) — le lien « modifier » du type, au Recap, re-choisit le MEME type :
// un tournoi de plusieurs jours y retombait sur un seul jour, son programme efface (P8-03 avait
// protege les creneaux de detection et les equipes invitees, pas ces deux champs).

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

const tournoi = { documentId: 'type-tournoi', name: 'Tournoi' };
const programme = [
  {
    date: '2026-11-07', endTime: '18:00', isActive: true, startTime: '09:00',
  },
  {
    date: '2026-11-08', endTime: '17:00', isActive: true, startTime: '09:00',
  },
];

const monterUnTournoiDeDeuxJours = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(EventWizardProvider, null, createElement(Sonde)));
  });
  act(() => sonde.dispatch({ payload: tournoi, type: 'SET_TYPE' }));
  act(() => sonde.dispatch({
    payload: { isMultiDayTournament: true, stageSchedule: programme },
    type: 'SET_LOGISTICS',
  }));
  return arbre;
};

test('le meme type re-choisi garde les deux jours du tournoi et leur programme', () => {
  const arbre = monterUnTournoiDeDeuxJours();
  expect(sonde.state.isMultiDayTournament).toBe(true);

  act(() => sonde.dispatch({ payload: { ...tournoi }, type: 'SET_TYPE' }));

  expect(sonde.state.isMultiDayTournament).toBe(true);
  expect(sonde.state.stageSchedule).toEqual(programme);
  act(() => arbre.unmount());
});

test('un AUTRE type remet toujours un seul jour, sans programme', () => {
  const arbre = monterUnTournoiDeDeuxJours();

  const match = { documentId: 'type-match', name: 'Match' };
  act(() => sonde.dispatch({ payload: match, type: 'SET_TYPE' }));

  expect(sonde.state.isMultiDayTournament).toBe(false);
  expect(sonde.state.stageSchedule).toEqual([]);
  act(() => arbre.unmount());
});
