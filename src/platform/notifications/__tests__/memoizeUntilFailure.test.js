import { memoizeUntilFailure } from '../memoizeUntilFailure';

// BUGHUNT C03 / P3-08 — notifications.web.js ne se charge pas sous Jest
// (`import('firebase/messaging')` exige --experimental-vm-modules) : la regle de
// cache qu'il utilise est donc prouvee ici, a part.
describe('memoizeUntilFailure', () => {
  test('une reussite est partagee : le travail ne se fait qu une fois', async () => {
    const travail = jest.fn(async () => 'ok');
    const une = memoizeUntilFailure(travail);
    await expect(une()).resolves.toBe('ok');
    await expect(une()).resolves.toBe('ok');
    expect(travail).toHaveBeenCalledTimes(1);
  });

  test('P3-08 — un echec n est pas garde : l appel suivant reessaie', async () => {
    const travail = jest.fn()
      .mockRejectedValueOnce(new Error('service worker refuse'))
      .mockResolvedValueOnce('enregistre');
    const une = memoizeUntilFailure(travail);
    await expect(une()).rejects.toThrow('service worker refuse');
    await expect(une()).resolves.toBe('enregistre');
    expect(travail).toHaveBeenCalledTimes(2);
  });

  test('P3-08 — un resultat marque temporaire n est pas garde non plus', async () => {
    const travail = jest.fn()
      .mockResolvedValueOnce({ serviceWorkerRegistration: null })
      .mockResolvedValueOnce({ serviceWorkerRegistration: { scope: '/' } });
    const une = memoizeUntilFailure(travail, (runtime) => !runtime.serviceWorkerRegistration);
    await une();
    await expect(une()).resolves.toEqual({ serviceWorkerRegistration: { scope: '/' } });
    await une();
    expect(travail).toHaveBeenCalledTimes(2);
  });

  test('deux appels simultanes partagent le meme essai', async () => {
    const travail = jest.fn(async () => 'ok');
    const une = memoizeUntilFailure(travail);
    await Promise.all([une(), une()]);
    expect(travail).toHaveBeenCalledTimes(1);
  });
});
