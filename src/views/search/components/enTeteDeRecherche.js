import { createContext, useContext, useLayoutEffect } from 'react';

/**
 * CORR-RECHERCHE point 2 (recette du site, 30/10, décision A) — « toute la page défile ».
 * `SearchScreenShell` posait son en-tête (logo, cloche, avatar, onglets) AU-DESSUS d'une liste qui
 * défilait seule : 20 % de l'écran restaient figés en haut (mesure du 31/10 : 168 px sur 844).
 * La coque le confie désormais à la liste, qui le pose en tête de ce qu'elle fait défiler.
 * Une liste qui le pose le « réclame » : tant que personne ne l'a réclamé, la coque le garde
 * au-dessus, comme avant — un contenu qui ne le sait pas ne perd jamais ses onglets.
 * @type {import('react').Context<{ enTete: import('react').ReactNode; reclamer: () => () => void } | null>}
 */
export const EnTeteDeRechercheContext = createContext(
  /** @type {{ enTete: import('react').ReactNode; reclamer: () => () => void } | null} */ (null),
);

/**
 * L'en-tête de la recherche, à poser en tête de ce qui défile ; `null` hors de la coque.
 * @returns {import('react').ReactNode}
 */
export const useEnTeteDeRecherche = () => {
  const valeur = useContext(EnTeteDeRechercheContext);
  const reclamer = valeur?.reclamer;
  useLayoutEffect(() => (reclamer ? reclamer() : undefined), [reclamer]);
  return valeur?.enTete ?? null;
};
