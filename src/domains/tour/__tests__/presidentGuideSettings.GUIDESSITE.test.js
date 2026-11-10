// GUIDES-SITE (décision d'Adel du 09/11) : le guide Dirigeant s'allume sur le site avec
// l'interrupteur du site ; le téléphone garde le sien, allumé depuis le train 8 (« 198- A »),
// comme fc74745d8 sur testflight/2.6.96.

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

  it('téléphone : son interrupteur à lui, allumé sur la ligne du train 8', () => {
    expect(lireReglages('ios', false).enabled).toBe(true);
    expect(lireReglages('android', false).enabled).toBe(true);
  });

  it('l’interrupteur du site est allumé (09/11)', () => {
    expect(jest.requireActual('@/config/fonctionsMasquees').GUIDE_SUR_LE_SITE).toBe(true);
  });
});
