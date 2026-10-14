/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import { getCreationErrorMessage } from '../eventWizardCreationErrors';

// CRFERM (13/10) : un double de traduction qui remplit les « {{…}} » comme i18next (la phrase de
// fermeture est faite de morceaux interpolés).
const t = (/** @type {string} */ _key, /** @type {any} */ fallback, /** @type {any} */ options) => {
  const texte = typeof fallback === 'string' ? fallback : fallback?.defaultValue || _key;
  const valeurs = typeof fallback === 'object' && fallback ? fallback : (options || {});
  return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(valeurs?.[nom] ?? ''));
};

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
  // CRFERM (13/10, COL-011) : plus « La mairie a rendu cette installation indisponible sur ce
  // créneau. Choisissez… » (vouvoiement, ni motif ni dates) ; un serveur d avant, sans la
  // fermeture, garde une phrase au « tu ».
  it('explique une fermeture survenue depuis la selection, au « tu »', () => {
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
    expect(message).toBe('La Ville a fermé cette installation à ce moment-là. Choisis un autre jour ou une autre installation.');
    expect(message).not.toMatch(/Error creating|Choisissez|indisponible/);
  });
  it('CRFERM-6/5 le refus porte la fermeture : la phrase dit les jours et le motif', () => {
    const message = getCreationErrorMessage({
      response: {
        data: {
          error: {
            details: {
              closure: {
                documentId: 'f1', endDate: '2026-10-15', endTime: null, kind: 'closure', label: null, reason: 'vacances', startDate: '2026-10-11', startTime: null,
              },
              code: 'EVENT_FACILITY_CLOSED',
            },
            message: 'La mairie a rendu cette installation indisponible sur ce créneau.',
          },
        },
      },
    }, 'Erreur', t);
    expect(message).toBe('Cette installation est fermée du dimanche 11 octobre au jeudi 15 octobre (vacances). Choisis un autre jour ou une autre installation.');
  });
  it('conserve une autre erreur utile', () => {
    expect(getCreationErrorMessage({ message: 'Date incorrecte' }, 'Erreur', t)).toBe('Date incorrecte');
  });
});
