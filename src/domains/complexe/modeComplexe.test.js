import { storage } from '@/store/appContext';

import { ecrireModeComplexe, lireModeComplexe } from './modeComplexe';

// RESA-L5A1 (13/10/2026) — planche RB : la bascule « mode complexe / mode joueur » est un CHOIX
// D'AFFICHAGE gardé sur le téléphone, une clé par compte, jamais un droit (AT-01).

jest.mock('@/store/appContext', () => {
  const valeurs = new Map();
  return {
    storage: {
      delete: jest.fn((cle) => valeurs.delete(cle)),
      getString: jest.fn((cle) => valeurs.get(cle)),
      set: jest.fn((cle, valeur) => valeurs.set(cle, valeur)),
    },
  };
});

const mockStorage = /** @type {any} */ (storage);

describe('RESA-L5A1 RB — le mode complexe, gardé sur le téléphone', () => {
  it('éteint par défaut, allumé puis éteint, compte par compte', () => {
    expect(lireModeComplexe('compte-1')).toBe(false);
    ecrireModeComplexe('compte-1', true);
    expect(mockStorage.set).toHaveBeenLastCalledWith('user.complexe_mode.compte-1', 'on');
    expect(lireModeComplexe('compte-1')).toBe(true);
    expect(lireModeComplexe('compte-2')).toBe(false);
    ecrireModeComplexe('compte-1', false);
    expect(mockStorage.delete).toHaveBeenLastCalledWith('user.complexe_mode.compte-1');
    expect(lireModeComplexe('compte-1')).toBe(false);
  });

  it('sans compte : rien n’est lu ni écrit', () => {
    ecrireModeComplexe('', true);
    ecrireModeComplexe(null, true);
    expect(mockStorage.set).not.toHaveBeenCalledWith(expect.stringMatching(/complexe_mode\.$/), 'on');
    expect(lireModeComplexe(undefined)).toBe(false);
  });

  it('un stockage en panne laisse l’app en mode joueur, sans casser', () => {
    mockStorage.getString.mockImplementationOnce(() => {
      throw new Error('stockage indisponible');
    });
    expect(lireModeComplexe('compte-1')).toBe(false);
    mockStorage.set.mockImplementationOnce(() => {
      throw new Error('stockage indisponible');
    });
    expect(() => ecrireModeComplexe('compte-1', true)).not.toThrow();
  });
});
