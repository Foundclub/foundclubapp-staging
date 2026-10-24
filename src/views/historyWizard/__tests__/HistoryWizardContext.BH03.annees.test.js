import { historyWizardReducer } from '../HistoryWizardContext';

// BH03 · P14-09 — « toujours dans ce club » active, annee de debut changee, puis
// interrupteur desactive : l'annee de fin restait ANTERIEURE a l'annee de debut.
describe('BH03 · P14-09 — historyWizardReducer', () => {
  it('desactiver « toujours dans ce club » ne laisse jamais fin < debut', () => {
    let state = /** @type {any} */ ({ endYear: 2018, isCurrentlyActive: false, startYear: 2016 });
    state = historyWizardReducer(state, { payload: true, type: 'SET_CURRENTLY_ACTIVE' });
    state = historyWizardReducer(state, { payload: 2022, type: 'SET_START_YEAR' });
    state = historyWizardReducer(state, { payload: false, type: 'SET_CURRENTLY_ACTIVE' });

    expect(Number(state.endYear)).toBeGreaterThanOrEqual(Number(state.startYear));
  });
});
