// RESA-L5B-2 (20/10/2026) — N-11, LE STATUT DU COMPLEXE (serveur RESA-L4 : type `complexeStatut`,
// `data.change` = `suspendu | retabli | retire`, `motif` ; plan E-G02 « N-11 ⇒ bandeau ») : la
// notification ouvre l'accueil du gérant (E-G02), où le bandeau dit l'état ; elle porte la pastille
// « Mode complexe » et l'icône du bouclier. Éteint (`COMPLEXES_GERANT`) : rien.

/**
 * Charge le module avec l'interrupteur voulu.
 * @param {boolean} allume - COMPLEXES_GERANT.
 * @returns {any} Le module.
 */
const charger = (allume) => {
  jest.resetModules();
  jest.doMock('@/config/fonctionsMasquees', () => ({
    ...jest.requireActual('@/config/fonctionsMasquees'),
    COMPLEXES_GERANT: allume,
  }));
  // eslint-disable-next-line global-require
  return require('@/domains/complexe/notificationsDuComplexe');
};

describe('N-11 — la suspension, le rétablissement, le retrait du complexe', () => {
  it('allumé : la pastille, le bouclier, et l’accueil du complexe', () => {
    const module = charger(true);
    expect(module.estNotificationDuComplexe('complexeStatut')).toBe(true);
    expect(module.iconeDuGerant('complexeStatut', { change: 'suspendu' })).toBe('shield');
    expect(module.destinationDuGerant({ change: 'suspendu', complexeId: 'cx-five', motif: 'x' }))
      .toEqual({
        params: { params: { complexeId: 'cx-five' }, screen: 'ComplexeAccueil' },
        route: 'ComplexeEspace',
      });
    expect(module.estTypeDuGerant('complexeStatut')).toBe(true);
    expect(module.estTypeDuGerant('complexeReservationGerant')).toBe(true);
    expect(module.estTypeDuGerant('complexeFidelite')).toBe(false);
  });

  it('éteint : ni pastille, ni icône, ni destination', () => {
    const module = charger(false);
    expect(module.estNotificationDuComplexe('complexeStatut')).toBe(false);
    expect(module.iconeDuGerant('complexeStatut', { change: 'suspendu' })).toBeNull();
    expect(module.destinationDuGerant({ change: 'suspendu', complexeId: 'cx-five' })).toBeNull();
  });
});
