import { useQuery } from '@tanstack/react-query';
import {
  useCallback, useLayoutEffect, useMemo, useState,
} from 'react';

import {
  getPlanningDefaultDate,
  getPlanningItemDate,
  normalizePlanningItems,
} from '@/utils/planning/planningSlots';
import {
  plageDeLaSuite,
  vueDeBaseVide,
  vueInitiale,
} from '@/utils/planning/vueInitiale';

/** @typedef {{ date: Date, vue: string }} DecisionDeVue */

/** @type {Array<Date | null>} */
const SANS_DATES = [];

/**
 * 🗓️ R17-VUE (19/10/2026, REC17-010) — LA VUE A L ARRIVEE, pour les 5 plannings.
 *
 * Decide UNE fois par arrivee (le montage de l ecran ; revenir d une fiche ne la rejoue pas) :
 * la vue de base pleine ⇒ elle reste, sans rien lire de plus ; vide ⇒ la semaine si elle est
 * connue et pleine, sinon le mois du prochain evenement, cherche dans la liste deja lue (onglet
 * perso) ou par UNE lecture bornee (`plageDeLaSuite`, 31 jours). Un choix fait a la main avant
 * la decision l emporte : la regle se retire.
 * @param {{
 *   actif?: boolean,
 *   appliquer: (decision: DecisionDeVue) => void,
 *   datesDeLaListe?: Array<Date | null>,
 *   evenements: any[] | undefined,
 *   lectureDeLaSuite?: {
 *     queryFn: (plage: { from: string, to: string }) => Promise<any>,
 *     queryKey: any[],
 *   } | null,
 *   listeConnue?: boolean,
 *   vueDeBase: string,
 * }} options - `evenements` : les blocs lus pour la vue de base (undefined tant que la lecture
 *   n est pas revenue) ; `datesDeLaListe` / `listeConnue` : les evenements a venir deja lus
 *   ailleurs ; `lectureDeLaSuite` : comment lire la suite (source du planning) ; `appliquer` :
 *   appele une fois, avec la decision (la vue de base comprise).
 * @returns {{ enDecision: boolean, garderLeChoix: () => void }} `enDecision` : la regle attend
 *   encore une lecture ; `garderLeChoix` : a appeler sur chaque choix fait a la main.
 */
const useVueInitiale = ({
  actif = true,
  appliquer,
  datesDeLaListe = SANS_DATES,
  evenements,
  lectureDeLaSuite = null,
  listeConnue = true,
  vueDeBase,
}) => {
  const [aujourdhui] = useState(getPlanningDefaultDate);
  const [decidee, setDecidee] = useState(/** @type {DecisionDeVue | null} */ (null));
  const [choixFait, setChoixFait] = useState(false);
  const enJeu = actif && !decidee && !choixFait;

  const dates = useMemo(() => (evenements
    ? [...evenements.map(getPlanningItemDate), ...datesDeLaListe]
    : null), [datesDeLaListe, evenements]);
  const baseVide = Boolean(dates) && vueDeBaseVide(vueDeBase, aujourdhui, dates || SANS_DATES);
  // Vue de base vide : attendre la liste deja demandee ailleurs (onglet perso) avant de trancher.
  const sansLaSuite = dates && (!baseVide || listeConnue)
    ? vueInitiale({ aujourdhui, dates, vueDeBase })
    : null;
  const besoinDeLaSuite = Boolean(
    enJeu && lectureDeLaSuite && baseVide && sansLaSuite?.vue === vueDeBase,
  );
  const plage = plageDeLaSuite(vueDeBase, aujourdhui);
  const suite = useQuery({
    enabled: besoinDeLaSuite,
    queryFn: () => (lectureDeLaSuite ? lectureDeLaSuite.queryFn(plage) : Promise.resolve(null)),
    queryKey: [
      ...(lectureDeLaSuite?.queryKey || ['planning']), 'vueInitiale', plage.from, plage.to,
    ],
    retry: false,
    staleTime: 60 * 1000,
  });

  /** @type {DecisionDeVue | null} */
  let calculee = null;
  if (enJeu && sansLaSuite) {
    if (!besoinDeLaSuite) {
      calculee = sansLaSuite;
    } else if (suite.data) {
      calculee = vueInitiale({
        aujourdhui,
        dates: [
          ...(dates || SANS_DATES),
          ...normalizePlanningItems(suite.data?.data || []).map(getPlanningItemDate),
        ],
        vueDeBase,
      });
    } else if (suite.isError) {
      // La suite n a pas pu etre lue : la vue de base, avec son etat vide.
      calculee = sansLaSuite;
    }
  }

  // Avant d etre peinte (pas d eclair de la vue de base vide quand la regle en change).
  useLayoutEffect(() => {
    if (!calculee) return;
    setDecidee(calculee);
    appliquer(calculee);
  }, [appliquer, calculee]);

  const garderLeChoix = useCallback(() => setChoixFait(true), []);

  return { enDecision: enJeu, garderLeChoix };
};

export default useVueInitiale;
