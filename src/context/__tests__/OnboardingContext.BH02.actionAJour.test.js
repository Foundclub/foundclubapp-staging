// BH02 (BUGHUNT 24/10) — P2-13 : réenregistrer une étape avec une NOUVELLE action « Suivant »
// doit remplacer l'ancienne, sinon le tutoriel appelle une fonction périmée.
import renderer, { act } from 'react-test-renderer';

import { OnboardingProvider, useOnboarding } from '@/context/OnboardingContext';

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    delete: jest.fn(), getString: jest.fn(() => undefined), set: jest.fn(),
  })),
}));

/** @type {any} */
let ctx;
function Sonde() {
  ctx = useOnboarding();
  return null;
}

it('la dernière action enregistrée est celle que garde l\'étape', () => {
  act(() => { renderer.create(<OnboardingProvider><Sonde /></OnboardingProvider>); });
  const ancienne = jest.fn();
  const nouvelle = jest.fn();
  act(() => { ctx.registerStep('etape', null, 1, 'Titre', 'Texte', null, ancienne); });
  act(() => { ctx.registerStep('etape', null, 1, 'Titre', 'Texte', null, nouvelle); });
  expect(ctx.getStepById('etape').onNext).toBe(nouvelle);
});
