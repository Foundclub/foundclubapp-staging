const SANS_CHANGEMENT = { conteneur: {}, retraitDuDefilement: 0 };

/**
 * T3-BANDEAU-HAUT — le site garde sa barre fine et sa page qui défile : rien à faire ici.
 * @returns {{ conteneur: object, retraitDuDefilement: number }} Rien à réserver.
 */
function useEnteteFlottant() {
  return SANS_CHANGEMENT;
}

export default useEnteteFlottant;
