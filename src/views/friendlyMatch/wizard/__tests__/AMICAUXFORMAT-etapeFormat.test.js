/* eslint-disable max-len -- intitulés de témoins et données d'exemple, lus en entier. */
/**
 * AMICAUX-FORMAT (10/11/2026, maquette validée par Adel) — l'étape « Format »,
 * en 2/8 juste après l'équipe, et ce qui part au serveur.
 * Réponses : 1 A (étape à part en 2/8), 2 A (durée dans formatDetails), 3 A (obligatoire).
 */
import { friendlyMatchWizardReducer } from '../FriendlyMatchWizardContext';
import {
  buildFriendlyMatchAdPayload,
  FRIENDLY_MATCH_WIZARD_STEPS,
  getFriendlyMatchWizardBlockingStep,
  getFriendlyMatchWizardStepCount,
  getFriendlyMatchWizardStepIndex,
  getFriendlyMatchWizardStepIssue,
} from '../friendlyMatchWizardSteps';

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

const FUTURE = '2099-06-12';
const baseDraft = (extra = {}) => ({
  activity: { documentId: 'act-foot', name: 'Football' },
  candidateDates: [{ date: FUTURE }],
  hostingPreference: 'HOST',
  location: {
    city: 'Marseille', label: 'Marseille', lat: 43.3, lng: 5.4,
  },
  team: { documentId: 'team-1' },
  travelRadiusKm: 25,
  ...extra,
});

describe('AMICAUX-FORMAT — l’étape Format', () => {
  it('1 A : 8 étapes, « format » juste après « team »', () => {
    expect(FRIENDLY_MATCH_WIZARD_STEPS).toEqual([
      'team', 'format', 'hosting', 'dates', 'location', 'opponent', 'description', 'recap',
    ]);
    expect(getFriendlyMatchWizardStepCount()).toBe(8);
    expect(getFriendlyMatchWizardStepIndex('format')).toBe(2);
  });

  it('3 A : sans format, l’étape bloque et le récapitulatif renvoie vers elle', () => {
    expect(getFriendlyMatchWizardStepIssue('format', baseDraft())).toBe('Choisis un format.');
    expect(getFriendlyMatchWizardBlockingStep(baseDraft())).toBe('format');
  });

  it('sport à formats connus : 11 contre 11 en 2 × 45 min part au serveur', () => {
    const draft = baseDraft({ format: '11v11', formatDuration: { minutes: 45, periods: 2 } });
    expect(getFriendlyMatchWizardStepIssue('format', draft)).toBeNull();
    const payload = buildFriendlyMatchAdPayload(draft);
    expect(payload.format).toBe('11v11');
    expect(payload.formatDetails).toEqual({ duration: { minutes: 45, periods: 2 } });
  });

  it('un format choisi sans durée bloque', () => {
    expect(getFriendlyMatchWizardStepIssue('format', baseDraft({ format: '11v11', formatDuration: null })))
      .toBe('Choisis une durée.');
  });

  it('personnalisé : 10 contre 11, 3 sets gagnants, précision → code 10v11', () => {
    const draft = baseDraft({
      format: 'custom',
      formatCustom: { them: 11, themTouched: true, us: 10 },
      formatDuration: { sets: 3, setsMode: 'win' },
      formatPrecision: '  mi-terrain ',
    });
    expect(getFriendlyMatchWizardStepIssue('format', draft)).toBeNull();
    const payload = buildFriendlyMatchAdPayload(draft);
    expect(payload.format).toBe('10v11');
    expect(payload.formatDetails).toEqual({ duration: { sets: 3, setsMode: 'win' }, precision: 'mi-terrain' });
  });

  it('personnalisé hors bornes bloque (0 joueur, 16 joueurs)', () => {
    const custom = (us, them) => baseDraft({
      format: 'custom', formatCustom: { them, us }, formatDuration: { minutes: 30, periods: 2 },
    });
    expect(getFriendlyMatchWizardStepIssue('format', custom(0, 5))).not.toBeNull();
    expect(getFriendlyMatchWizardStepIssue('format', custom(5, 16))).not.toBeNull();
  });

  it('« Quel adversaire ? » ne porte plus le format : elle ne bloque jamais', () => {
    expect(getFriendlyMatchWizardStepIssue('opponent', baseDraft({ format: '' }))).toBeNull();
  });
});

describe('AMICAUX-FORMAT — le brouillon', () => {
  const reduce = (state, ...actions) => actions.reduce(friendlyMatchWizardReducer, state);

  it('choisir un format pose sa durée par défaut ; changer d’équipe efface le format', () => {
    let state = reduce({}, { payload: { code: '7v7', duration: { minutes: 30, periods: 2 } }, type: 'SET_FORMAT' });
    expect(state.format).toBe('7v7');
    expect(state.formatDuration).toEqual({ minutes: 30, periods: 2 });
    state = reduce(state, { payload: { documentId: 't2', sport: { name: 'Handball' } }, type: 'SET_TEAM' });
    expect(state.format).toBe('');
    expect(state.formatDuration).toBeNull();
  });

  it('personnalisé : « Eux » suit « Nous » tant qu’on ne le touche pas', () => {
    let state = reduce(
      { formatCustom: { them: 7, themTouched: false, us: 7 } },
      { payload: { us: 9 }, type: 'SET_FORMAT_CUSTOM' },
    );
    expect(state.formatCustom).toEqual({ them: 9, themTouched: false, us: 9 });
    state = reduce(state, { payload: { them: 11 }, type: 'SET_FORMAT_CUSTOM' }, { payload: { us: 10 }, type: 'SET_FORMAT_CUSTOM' });
    expect(state.formatCustom).toEqual({ them: 11, themTouched: true, us: 10 });
  });
});
