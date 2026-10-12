import { getCreationErrorMessage } from '../eventWizardCreationErrors';

const t = (_key, fallback) => fallback;

describe('IPH09 — refus de creation en francais', () => {
  it('comprend le refus exact du serveur production (sans changer la regle)', () => {
    const message = getCreationErrorMessage({
      response: {
        data: {
          error: {
            details: { code: 'MISSING_REQUIRED_FIELD' },
            message: 'Error creating event: Les entrainements ouverts exigent au moins une place externe.',
          },
        },
      },
    }, 'Erreur', t);
    expect(message).toContain('Minimum : 1 place externe.');
    expect(message).not.toMatch(/Error creating/);
  });
  it('explique une fermeture survenue depuis la selection', () => {
    const message = getCreationErrorMessage({
      code: 'ERR_BAD_REQUEST',
      response: {
        data: {
          error: {
            details: { code: 'EVENT_FACILITY_CLOSED' }, message: 'Error creating event: fermeture',
          },
        },
      },
    }, 'Erreur', t);
    expect(message).toMatch(/mairie.*indisponible/);
    expect(message).not.toMatch(/Error creating/);
  });
  it('conserve une autre erreur utile', () => {
    expect(getCreationErrorMessage({ message: 'Date incorrecte' }, 'Erreur', t)).toBe('Date incorrecte');
  });
});
