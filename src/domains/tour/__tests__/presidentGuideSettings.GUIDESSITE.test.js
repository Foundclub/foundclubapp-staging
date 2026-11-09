// GUIDES-SITE (décision d'Adel du 09/11) : le guide Dirigeant s'allume sur le site avec
// l'interrupteur du site ; le téléphone garde le sien (éteint dans le code commité).

const lireReglages = (os, surLeSite) => {
  let reglages;
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({ Platform: { OS: os } }));
    jest.doMock('@/config/fonctionsMasquees', () => ({ GUIDE_SUR_LE_SITE: surLeSite }));
    // eslint-disable-next-line global-require -- module relu sous chaque plateforme simulée.
    reglages = require('../presidentGuideSettings').PRESIDENT_GUIDE_SETTINGS;
  });
  return reglages;
};

describe('interrupteurs du guide Dirigeant', () => {
  it('site, interrupteur du site allumé : le guide est allumé', () => {
    expect(lireReglages('web', true).enabled).toBe(true);
  });

  it('site, interrupteur du site éteint : le guide est éteint', () => {
    expect(lireReglages('web', false).enabled).toBe(false);
  });

  it('téléphone : son interrupteur à lui, éteint dans le code commité', () => {
    expect(lireReglages('ios', true).enabled).toBe(false);
    expect(lireReglages('android', true).enabled).toBe(false);
  });

  it('l’interrupteur du site est allumé (09/11)', () => {
    expect(jest.requireActual('@/config/fonctionsMasquees').GUIDE_SUR_LE_SITE).toBe(true);
  });
});
