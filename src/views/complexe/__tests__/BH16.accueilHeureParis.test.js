// BH16 P13-11 — l'accueil du gérant lit le jour et l'heure de Paris, pas ceux du téléphone.

jest.mock('@/domains/auth/useAuth', () => ({ useAuth: () => ({}) }));
jest.mock('@/services/complexe/complexeQueries', () => ({}));
jest.mock('@/store/appContext', () => ({}));
jest.mock('@/services/client', () => ({}));
jest.mock('@/views/home/FeuillePratiqueAussi', () => () => null);
jest.mock('@/components/templates/ScreenContainer', () => () => null);
/* eslint-disable global-require */
jest.mock('react-native-gesture-handler', () => (
  require('@/testSupport/animationDouble').gestureHandler()
));
jest.mock('react-native-reanimated', () => require('@/testSupport/animationDouble').reanimated());
/* eslint-enable global-require */

const { jourEtHeure } = jest.requireActual('@/views/complexe/ComplexeAccueil');

describe('BH16 P13-11 — accueil du gérant à l’heure de Paris', () => {
  it('23:30 UTC le 14/10 = 15/10 à 01:30 à Paris, même sur un téléphone réglé sur UTC', () => {
    // Le téléphone vit à l'heure UTC : ses lectures « locales » sont celles d'UTC.
    ['FullYear', 'Month', 'Date', 'Hours', 'Minutes'].forEach((nom) => {
      jest.spyOn(Date.prototype, `get${nom}`).mockImplementation(function lu() {
        return this[`getUTC${nom}`]();
      });
    });
    expect(jourEtHeure(new Date('2026-10-14T23:30:00Z')))
      .toEqual({ date: '2026-10-15', minutes: 90 });
  });
});
