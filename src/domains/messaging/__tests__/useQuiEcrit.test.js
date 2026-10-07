import { act } from 'react';
import renderer from 'react-test-renderer';

import useQuiEcrit, { DELAI_D_EXTINCTION_MS } from '../useQuiEcrit';

// Les noms d evenements de la socket, ceux que le crochet ecoute.
const { EVENTS } = jest.requireActual('@/hooks/useSocket');

// MSG1W — « … écrit » sur le site : la regle de la minuterie du telephone (MSGLIVE).

const BRUNO_DANS_LE_FIL = { chatDocumentId: 'fil-1', userDocumentId: 'bruno' };

const fausseSocket = () => {
  /** @type {Map<string, Set<Function>>} */
  const ecoutes = new Map();
  return {
    emettre: (evenement, charge) => (ecoutes.get(evenement) || new Set()).forEach((f) => f(charge)),
    off: jest.fn((evenement, f) => ecoutes.get(evenement)?.delete(f)),
    on: jest.fn((evenement, f) => {
      if (!ecoutes.has(evenement)) ecoutes.set(evenement, new Set());
      ecoutes.get(evenement).add(f);
    }),
  };
};

/**
 * Monte une sonde qui lit le crochet.
 * @param {any} socket - La socket du banc.
 * @returns {{ arbre: any, resultat: { quiEcrit: string[] } }} L arbre et la lecture.
 */
const monter = (socket) => {
  const resultat = { quiEcrit: /** @type {string[]} */ ([]) };
  /**
   * La sonde : elle lit le crochet a chaque rendu.
   * @returns {null} Rien a l ecran.
   */
  function Sonde() {
    resultat.quiEcrit = useQuiEcrit({ chatId: 'fil-1', moi: 'moi', socket });
    return null;
  }
  let arbre;
  act(() => { arbre = renderer.create(<Sonde />); });
  return { arbre, resultat };
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useQuiEcrit', () => {
  it('allume la personne qui ecrit dans CE fil, et ignore moi et les autres fils', () => {
    const socket = fausseSocket();
    const { resultat } = monter(socket);

    act(() => {
      socket.emettre(EVENTS.TYPING_STARTED, { chatDocumentId: 'fil-1', userDocumentId: 'bruno' });
      socket.emettre(EVENTS.TYPING_STARTED, { chatDocumentId: 'fil-1', userDocumentId: 'moi' });
      socket.emettre(EVENTS.TYPING_STARTED, { chatDocumentId: 'fil-2', userDocumentId: 'sami' });
    });
    expect(resultat.quiEcrit).toEqual(['bruno']);

    act(() => socket.emettre(EVENTS.TYPING_STOPPED, BRUNO_DANS_LE_FIL));
    expect(resultat.quiEcrit).toEqual([]);
  });

  it('s eteint tout seul apres 6 s sans nouvelle, et chaque signal rearme la minuterie', () => {
    const socket = fausseSocket();
    const { resultat } = monter(socket);

    act(() => socket.emettre(EVENTS.TYPING_STARTED, BRUNO_DANS_LE_FIL));
    act(() => { jest.advanceTimersByTime(DELAI_D_EXTINCTION_MS - 1000); });
    act(() => socket.emettre(EVENTS.TYPING_STARTED, BRUNO_DANS_LE_FIL));
    act(() => { jest.advanceTimersByTime(DELAI_D_EXTINCTION_MS - 1000); });
    expect(resultat.quiEcrit).toEqual(['bruno']);

    act(() => { jest.advanceTimersByTime(1500); });
    expect(resultat.quiEcrit).toEqual([]);
  });

  it('se desabonne en partant', () => {
    const socket = fausseSocket();
    const { arbre } = monter(socket);
    act(() => arbre.unmount());
    expect(socket.off).toHaveBeenCalledWith(EVENTS.TYPING_STARTED, expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith(EVENTS.TYPING_STOPPED, expect.any(Function));
  });
});
