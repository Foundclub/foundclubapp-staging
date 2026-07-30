import {
  assertOtpSendAllowed,
  getOtpCooldownRemainingMs,
  getOtpCooldownRemainingSeconds,
  markOtpSendAttempt,
  OTP_SEND_COOLDOWN_MS,
  OTP_SEND_THROTTLED_CODE,
  resetOtpSendThrottle,
} from './otpSendThrottle';

const NUMERO = '+33750840728';
const AUTRE_NUMERO = '+33612345678';

const attendre = (ms) => jest.setSystemTime(Date.now() + ms);

describe('otpSendThrottle', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-07-30T02:00:00Z') });
    resetOtpSendThrottle();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('autorise le premier envoi', () => {
    expect(getOtpCooldownRemainingMs(NUMERO)).toBe(0);
    expect(() => assertOtpSendAllowed(NUMERO)).not.toThrow();
  });

  test('refuse un second envoi immédiat pour le même numéro', () => {
    markOtpSendAttempt(NUMERO);

    let thrown;
    try {
      assertOtpSendAllowed(NUMERO);
    } catch (error) {
      thrown = error;
    }

    expect(thrown?.code).toBe(OTP_SEND_THROTTLED_CODE);
    expect(thrown?.details?.retryAfterSeconds).toBe(60);
    expect(String(thrown?.message)).toContain('60 s');
  });

  // Le scénario exact qui a bloqué la recette : 4 demandes en 45 secondes.
  test('4 tentatives en 45 secondes : une seule passe', () => {
    let envoisAutorises = 0;
    [0, 12000, 20000, 13000].forEach((ecartMs) => {
      attendre(ecartMs);
      try {
        assertOtpSendAllowed(NUMERO);
        markOtpSendAttempt(NUMERO);
        envoisAutorises += 1;
      } catch (error) { /* refusé localement, aucun SMS parti */ }
    });

    expect(envoisAutorises).toBe(1);
  });

  test('réautorise l\'envoi une fois le délai écoulé', () => {
    markOtpSendAttempt(NUMERO);
    attendre(OTP_SEND_COOLDOWN_MS - 1);
    expect(() => assertOtpSendAllowed(NUMERO)).toThrow();

    attendre(1);
    expect(getOtpCooldownRemainingMs(NUMERO)).toBe(0);
    expect(() => assertOtpSendAllowed(NUMERO)).not.toThrow();
  });

  test('le délai est par numéro : corriger une faute de frappe n\'attend pas', () => {
    markOtpSendAttempt(NUMERO);
    expect(() => assertOtpSendAllowed(AUTRE_NUMERO)).not.toThrow();
  });

  test('ignore les espaces et séparateurs du même numéro', () => {
    markOtpSendAttempt('+33 7 50 84 07 28');
    expect(() => assertOtpSendAllowed('+33750840728')).toThrow();
    expect(() => assertOtpSendAllowed('+33-7-50-84-07-28')).toThrow();
  });

  test('un numéro vide ne pose et ne déclenche aucun verrou', () => {
    markOtpSendAttempt('');
    expect(getOtpCooldownRemainingMs('')).toBe(0);
    expect(() => assertOtpSendAllowed(undefined)).not.toThrow();
  });

  test('une horloge qui recule ne gèle pas l\'envoi', () => {
    markOtpSendAttempt(NUMERO);
    attendre(-3600000);

    expect(getOtpCooldownRemainingMs(NUMERO)).toBe(0);
    expect(() => assertOtpSendAllowed(NUMERO)).not.toThrow();
  });

  test('les secondes restantes sont arrondies au supérieur', () => {
    markOtpSendAttempt(NUMERO);
    attendre(1200);
    expect(getOtpCooldownRemainingSeconds(NUMERO)).toBe(59);
  });
});
