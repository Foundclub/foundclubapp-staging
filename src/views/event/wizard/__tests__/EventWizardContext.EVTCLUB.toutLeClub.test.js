import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';

// EVT-CLUB-ECRANS (14/11/2026, D121) — ce que retient le tunnel quand le dirigeant choisit
// « Tous les membres du club » (ecran 2, « Oui, tout le club »).

let capte = { dispatch: () => {}, state: {} };

/**
 * Capte l'etat et le dispatch du tunnel.
 * @returns {null} Rien.
 */
function Sonde() {
  capte = useEventWizard();
  return null;
}

let arbre;
const monter = () => {
  act(() => { arbre = renderer.create(createElement(EventWizardProvider, null, createElement(Sonde))); });
};
const envoyer = (action) => act(() => capte.dispatch(action));

const CLUB = { documentId: 'club-1', name: 'AS Les Bruyeres' };
const EQUIPE = { club: CLUB, documentId: 'eq-1', name: 'Seniors A' };
const COMPTES = {
  children: 51, coaches: 10, members: 6, parents: 41, players: 111, total: 168,
};

beforeEach(() => {
  if (typeof window !== 'undefined' && window.sessionStorage) window.sessionStorage.clear();
  monter();
});
afterEach(() => { act(() => arbre.unmount()); });

describe('EVT-CLUB — SET_CLUB_AUDIENCE', () => {
  test('un evenement neuf n est pas « tout le club »', () => {
    expect(capte.state.audienceScope).toBeNull();
    expect(capte.state.clubAudienceCounts).toBeNull();
  });

  test('hors Match / Tournoi : rattache au club, sans equipe, une date seule', () => {
    envoyer({ payload: { documentId: 't-autre', name: 'Autre' }, type: 'SET_TYPE' });
    envoyer({ payload: EQUIPE, type: 'SET_TEAM' });
    envoyer({ payload: { isRecurrent: true }, type: 'SET_LOGISTICS' });
    envoyer({ payload: { audienceScope: 'club', club: CLUB, counts: COMPTES }, type: 'SET_CLUB_AUDIENCE' });

    expect(capte.state.audienceScope).toBe('club');
    expect(capte.state.club).toEqual(CLUB);
    expect(capte.state.team).toBeNull();
    expect(capte.state.clubAudienceCounts).toEqual(COMPTES);
    expect(capte.state.isRecurrent).toBe(false);
  });

  test('Match (R1 A) : l equipe choisie ensuite ne retire pas « tout le club »', () => {
    envoyer({ payload: { documentId: 't-match', name: 'Match' }, type: 'SET_TYPE' });
    envoyer({ payload: { audienceScope: 'club', club: CLUB, counts: COMPTES }, type: 'SET_CLUB_AUDIENCE' });
    envoyer({ payload: EQUIPE, type: 'SET_TEAM' });

    expect(capte.state.audienceScope).toBe('club');
    expect(capte.state.team).toEqual(EQUIPE);
  });

  test('hors Match : choisir une equipe ensuite revient a un evenement d equipe', () => {
    envoyer({ payload: { documentId: 't-autre', name: 'Autre' }, type: 'SET_TYPE' });
    envoyer({ payload: { audienceScope: 'club', club: CLUB, counts: COMPTES }, type: 'SET_CLUB_AUDIENCE' });
    envoyer({ payload: EQUIPE, type: 'SET_TEAM' });

    expect(capte.state.audienceScope).toBeNull();
    expect(capte.state.clubAudienceCounts).toBeNull();
    expect(capte.state.team).toEqual(EQUIPE);
  });

  test('changer de type efface le choix ; CLEAR_CLUB_AUDIENCE aussi', () => {
    envoyer({ payload: { documentId: 't-autre', name: 'Autre' }, type: 'SET_TYPE' });
    envoyer({ payload: { audienceScope: 'club', club: CLUB, counts: COMPTES }, type: 'SET_CLUB_AUDIENCE' });
    envoyer({ payload: { documentId: 't-entr', name: 'Entraînement' }, type: 'SET_TYPE' });
    expect(capte.state.audienceScope).toBeNull();

    envoyer({ payload: { documentId: 't-match', name: 'Match' }, type: 'SET_TYPE' });
    envoyer({ payload: { audienceScope: 'club', club: CLUB, counts: COMPTES }, type: 'SET_CLUB_AUDIENCE' });
    envoyer({ type: 'CLEAR_CLUB_AUDIENCE' });
    expect(capte.state.audienceScope).toBeNull();
    expect(capte.state.clubAudienceCounts).toBeNull();
  });
});
