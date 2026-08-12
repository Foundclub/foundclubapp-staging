/* global globalThis */

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

// D90 — le brouillon porte deux LISTES : plusieurs categories, plusieurs
// niveaux. Ce qui se joue ici est moins le pluriel que la RECONDUITE : ce que
// l equipe pre-remplit doit rester elargissable, et un brouillon deja ouvert au
// moment de la mise a jour ne doit rien perdre.
describe('D90 — le brouillon porte plusieurs categories et plusieurs niveaux', () => {
  const U15 = { documentId: 'cat-u15', name: 'U15' };
  const U17 = { documentId: 'cat-u17', name: 'U17' };
  const D2 = { documentId: 'lvl-d2', name: 'Départemental 2' };

  it('naît avec deux listes VIDES, jamais null', () => {
    monter();
    expect(sonde.state.categories).toEqual([]);
    expect(sonde.state.levels).toEqual([]);
  });

  it('range la liste entiere, et une liste vide est une valeur legitime', () => {
    monter();
    act(() => sonde.dispatch({ payload: [U15, U17], type: 'SET_CATEGORIES' }));
    expect(sonde.state.categories).toEqual([U15, U17]);

    act(() => sonde.dispatch({ payload: [], type: 'SET_CATEGORIES' }));
    expect(sonde.state.categories).toEqual([]);
  });

  it('se protege d une charge qui n est pas une liste', () => {
    monter();
    act(() => sonde.dispatch({ payload: U15, type: 'SET_CATEGORIES' }));
    expect(sonde.state.categories).toEqual([]);
    act(() => sonde.dispatch({ payload: undefined, type: 'SET_LEVELS' }));
    expect(sonde.state.levels).toEqual([]);
  });

  // Le pre-remplissage reste une PROPOSITION : l equipe pose la premiere valeur,
  // et l etape 5 permet d en ajouter d autres. C est la demande d Adel.
  it('l equipe pre-remplit la PREMIERE valeur de chaque liste, pas la seule', () => {
    monter();
    act(() => sonde.dispatch({
      payload: { category: U15, documentId: 'team-1', level: D2 },
      type: 'SET_TEAM',
    }));

    expect(sonde.state.categories).toEqual([U15]);
    expect(sonde.state.levels).toEqual([D2]);

    act(() => sonde.dispatch({ payload: [U15, U17], type: 'SET_CATEGORIES' }));
    expect(sonde.state.categories).toEqual([U15, U17]);
  });

  it('une equipe sans categorie ni niveau ne fabrique pas de liste a trous', () => {
    monter();
    act(() => sonde.dispatch({ payload: { documentId: 'team-2' }, type: 'SET_TEAM' }));

    expect(sonde.state.categories).toEqual([]);
    expect(sonde.state.levels).toEqual([]);
  });

  it('RESET rend les deux listes vides', () => {
    monter();
    act(() => sonde.dispatch({ payload: [U15, U17], type: 'SET_CATEGORIES' }));
    act(() => sonde.dispatch({ type: 'RESET' }));

    expect(sonde.state.categories).toEqual([]);
    expect(sonde.state.levels).toEqual([]);
  });
});

// Sur le web, chaque etape du tunnel est une URL a part : le brouillon survit
// dans `sessionStorage`. Quelqu un qui avait le tunnel ouvert au moment de la
// mise a jour relit donc un brouillon ecrit AVANT D90, au singulier.
describe('D90 — un brouillon web ecrit AVANT le lot ne perd rien', () => {
  const U15 = { documentId: 'cat-u15', name: 'U15' };
  const D2 = { documentId: 'lvl-d2', name: 'Départemental 2' };
  /** @type {any} */
  let stockageInitial;

  /**
   * Installe un sessionStorage qui rend ce brouillon-la.
   * @param {any} brouillon Le contenu deja ecrit.
   * @returns {void}
   */
  const poserBrouillon = (brouillon) => {
    globalThis.sessionStorage = /** @type {any} */ ({
      getItem: () => JSON.stringify(brouillon),
      setItem: () => {},
    });
  };

  beforeEach(() => {
    stockageInitial = globalThis.sessionStorage;
  });

  afterEach(() => {
    globalThis.sessionStorage = stockageInitial;
  });

  it('reprend la categorie et le niveau au singulier dans les nouvelles listes', () => {
    poserBrouillon({ category: U15, hostingPreference: 'BOTH', level: D2 });
    monter();

    expect(sonde.state.categories).toEqual([U15]);
    expect(sonde.state.levels).toEqual([D2]);
    expect(sonde.state.hostingPreference).toBe('BOTH');
  });

  it('ne laisse trainer aucune valeur au singulier dans le brouillon repris', () => {
    poserBrouillon({ category: U15, level: D2 });
    monter();

    expect(sonde.state).not.toHaveProperty('category');
    expect(sonde.state).not.toHaveProperty('level');
  });

  it('laisse intact un brouillon deja ecrit au pluriel', () => {
    poserBrouillon({ categories: [U15], levels: [] });
    monter();

    expect(sonde.state.categories).toEqual([U15]);
    expect(sonde.state.levels).toEqual([]);
  });
});
