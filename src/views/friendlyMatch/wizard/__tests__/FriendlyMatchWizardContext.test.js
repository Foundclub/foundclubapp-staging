import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { FriendlyMatchWizardProvider, useFriendlyMatchWizard } from '../FriendlyMatchWizardContext';
import { buildFriendlyMatchAdPayload } from '../friendlyMatchWizardSteps';

// Filet D24 (E6) — le brouillon du tunnel amical n'avait aucun test a lui.
//
// Il en porte un maillon fragile depuis ce lot : `entryOrigin`, la seule donnee
// de NAVIGATION du brouillon (defaut ⑤). Elle traverse 6 ecrans entre l'etape 1
// qui la releve et le recapitulatif qui s'en sert. Si le reducteur cessait de
// la ranger, tout resterait vert ailleurs et le defaut se rouvrirait en silence.

/** @type {any} */
let sonde = null;

/**
 * Une sonde qui expose le brouillon et son expediteur d'actions.
 * @returns {null} Elle ne dessine rien.
 */
function Sonde() {
  sonde = useFriendlyMatchWizard();
  return null;
}

const monter = () => {
  sonde = null;
  act(() => {
    renderer.create(createElement(FriendlyMatchWizardProvider, null, createElement(Sonde)));
  });
};

describe('Le brouillon du tunnel amical', () => {
  it('naît sans origine et sans date', () => {
    monter();
    expect(sonde.state.entryOrigin).toBe('');
    expect(sonde.state.candidateDates).toEqual([]);
    expect(sonde.state.hostingPreference).toBe('');
  });

  it('range l origine du tunnel, nettoyee', () => {
    monter();
    act(() => sonde.dispatch({ payload: '  EventStack  ', type: 'SET_ENTRY_ORIGIN' }));
    expect(sonde.state.entryOrigin).toBe('EventStack');
  });

  // Une origine ABSENTE doit EFFACER celle d'avant, pas la laisser en place :
  // sur le web le brouillon survit dans `sessionStorage`, et une origine
  // perimee ferait effacer un tunnel jamais ouvert.
  it('une origine absente efface la precedente', () => {
    monter();
    act(() => sonde.dispatch({ payload: 'EventStack', type: 'SET_ENTRY_ORIGIN' }));
    act(() => sonde.dispatch({ payload: undefined, type: 'SET_ENTRY_ORIGIN' }));
    expect(sonde.state.entryOrigin).toBe('');
  });

  it('l origine ne part pas au serveur, meme posee', () => {
    monter();
    act(() => sonde.dispatch({ payload: 'EventStack', type: 'SET_ENTRY_ORIGIN' }));
    expect(buildFriendlyMatchAdPayload(sonde.state)).not.toHaveProperty('entryOrigin');
  });

  it('RESET remet tout a zero, origine comprise', () => {
    monter();
    act(() => sonde.dispatch({ payload: 'EventStack', type: 'SET_ENTRY_ORIGIN' }));
    act(() => sonde.dispatch({ payload: 'BOTH', type: 'SET_HOSTING_PREFERENCE' }));
    act(() => sonde.dispatch({ type: 'RESET' }));

    expect(sonde.state.entryOrigin).toBe('');
    expect(sonde.state.hostingPreference).toBe('');
  });
});
