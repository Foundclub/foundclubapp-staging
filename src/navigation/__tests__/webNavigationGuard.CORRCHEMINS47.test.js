import { Alert, Linking, Platform } from 'react-native';

import { navigateOrExplainOnWeb } from '../webNavigationGuard';
import { RouteNames } from '../routeNames';

// CORR-CHEMINS (30/10, point 47, décision d'Adel « B ») — une tuile dont l'écran n'existe que dans
// l'application (programmes, carnet d'entraînement…) ne promet plus « Bientôt sur le site » :
// elle dit « Disponible sur l'app » et propose d'ouvrir la boutique. Le téléphone n'est pas touché.
describe('CORR-CHEMINS 47 : « Disponible sur l app », avec la boutique', () => {
  let alerte;
  let ouvrir;

  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web');
    alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    ouvrir = jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('l alerte dit « Disponible sur l app » et son bouton ouvre la boutique', () => {
    const navigation = { navigate: jest.fn() };

    expect(navigateOrExplainOnWeb(navigation, RouteNames.TrainingCatalog)).toBe(false);
    expect(navigation.navigate).not.toHaveBeenCalled();

    const [titre, , boutons] = alerte.mock.calls[0];
    expect(titre).toBe('Disponible sur l’app');
    const boutique = (boutons || []).find((bouton) => bouton.style !== 'cancel');
    expect(boutique).toBeDefined();
    boutique.onPress();
    expect(ouvrir).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/(apps\.apple\.com|play\.google\.com)\//));
    expect((boutons || []).some((bouton) => bouton.style === 'cancel')).toBe(true);
  });

  test('un écran qui a son adresse sur le site navigue normalement', () => {
    const navigation = { navigate: jest.fn() };

    expect(navigateOrExplainOnWeb(navigation, RouteNames.MyActivities)).toBe(true);
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.MyActivities, undefined);
    expect(alerte).not.toHaveBeenCalled();
  });
});
