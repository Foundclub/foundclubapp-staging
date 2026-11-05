/* eslint-disable no-underscore-dangle -- __DEV__ est le nom impose par React Native. */
// PAYE-LIMITE (05/11) — un refus de montant passe par `displayErrorAlert`. En production,
// un code sans traduction y devient « une erreur » : le dirigeant ne saurait pas pourquoi.
import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

let mockLangue = fr;

jest.mock('i18next', () => ({
  __esModule: true,
  default: {
    exists: (cle) => mockLangue.APIerrors[cle.replace('APIerrors.', '')] !== undefined,
    t: (cle) => mockLangue.APIerrors[cle.replace('APIerrors.', '')],
  },
}));

const { getErrorMessage } = require('./displayError');

// Forme réelle de ce que l'intercepteur HTTP rejette : `response.data.error`.
const refus = (code, message) => ({
  details: { code }, message, name: 'ValidationError', status: 400,
});

describe('PAYE-LIMITE — le refus d un montant se lit en production', () => {
  const dev = global.__DEV__;

  beforeAll(() => { global.__DEV__ = false; });
  afterAll(() => { global.__DEV__ = dev; });

  test.each([
    [
      'LICENSE_AMOUNT_EXCEEDS_REMAINING',
      "Ce montant dépasse ce qu'il reste à payer sur cette cotisation.",
    ],
    [
      'LICENSE_REFUND_EXCEEDS_REFUNDABLE',
      "Ce montant dépasse ce qu'il reste à rembourser sur ce paiement.",
    ],
  ])('%s garde son motif en français, et existe en anglais', (code, message) => {
    mockLangue = fr;
    expect(getErrorMessage(refus(code, message))).toBe(message);
    mockLangue = en;
    expect(getErrorMessage(refus(code, message))).not.toBe(en.APIerrors.generic);
    expect(en.APIerrors[code]).toEqual(expect.any(String));
  });
});
