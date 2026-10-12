import { StrictMode, useEffect } from 'react';
import renderer, { act } from 'react-test-renderer';

import useSafeTimers from '../useSafeTimers';

// SITE-MSG-FENETRES (T20, 08/10) — LES MINUTERIES « SURES » MOURAIENT AU SITE DE DEVELOPPEMENT.
//
// Le site de dev tourne en `<StrictMode>` (web/src/main.tsx) : React y monte chaque composant,
// le DEMONTE, puis le remonte. Le nettoyage de `useSafeTimers` posait
// `isMountedRef.current = false` et rien ne le remettait a `true` au remontage : ensuite, chaque
// `setSafeTimeout` /
// `setSafeInterval` sortait sans rien faire. Vu par la tournee T20 : « Renvoyer le code (59 s) »
// fige plus d une heure sur `/register` (OTPForm), et le meme sort pour le minuteur
// d entrainement, le rafraichissement des notifications et la carte de recherche.
//
// Les deux derniers temoins tiennent la promesse du crochet : un composant VRAIMENT demonte ne
// rappelle plus rien.

/**
 * Un composant qui pose une minuterie (ou un intervalle) des son montage.
 * @param {{ intervalle?: boolean, onTic: () => void }} props - Le genre de minuterie, le rappel.
 * @returns {null} Rien a dessiner.
 */
function Minuterie({ intervalle = false, onTic }) {
  const { setSafeInterval, setSafeTimeout } = useSafeTimers();
  useEffect(() => {
    if (intervalle) setSafeInterval(onTic, 1000);
    else setSafeTimeout(onTic, 1000);
  }, [intervalle, onTic, setSafeInterval, setSafeTimeout]);
  return null;
}

/**
 * Monte la minuterie, en mode strict ou non.
 * @param {{ intervalle?: boolean, strict?: boolean }} options - Le montage voulu.
 * @returns {{ arbre: any, onTic: jest.Mock }} L arbre et le rappel espionne.
 */
const monter = ({ intervalle = false, strict = true } = {}) => {
  const onTic = jest.fn();
  const element = <Minuterie intervalle={intervalle} onTic={onTic} />;
  let arbre;
  act(() => {
    arbre = renderer.create(strict ? <StrictMode>{element}</StrictMode> : element);
  });
  return { arbre, onTic };
};

describe('useSafeTimers — le double montage du mode strict', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('une minuterie posee apres le remontage du mode strict sonne', () => {
    const { onTic } = monter({ strict: true });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onTic).toHaveBeenCalledTimes(1);
  });

  it('un intervalle pose apres le remontage du mode strict bat chaque seconde', () => {
    const { onTic } = monter({ intervalle: true, strict: true });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onTic).toHaveBeenCalledTimes(3);
  });

  it('sans mode strict (le telephone, la production), rien ne change', () => {
    const { onTic } = monter({ strict: false });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onTic).toHaveBeenCalledTimes(1);
  });

  it('un composant VRAIMENT demonte ne rappelle plus rien', () => {
    const { arbre, onTic } = monter({ intervalle: true, strict: true });
    act(() => {
      arbre.unmount();
    });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onTic).not.toHaveBeenCalled();
  });

  it('isMountedRef dit vrai apres le remontage du mode strict, faux apres le demontage', () => {
    /** @type {{ current: boolean } | null} */
    let reference = null;
    /**
     * Expose la reference du crochet au temoin.
     * @returns {null} Rien a dessiner.
     */
    function Lecteur() {
      const { isMountedRef } = useSafeTimers();
      reference = isMountedRef;
      return null;
    }
    let arbre;
    act(() => {
      arbre = renderer.create(<StrictMode><Lecteur /></StrictMode>);
    });
    expect(reference?.current).toBe(true);
    act(() => {
      arbre.unmount();
    });
    expect(reference?.current).toBe(false);
  });
});
