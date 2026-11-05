import t from '@/domains/tour/presidentText';

// Guide Dirigeant·e, M1 « Gérer ton club ». Étapes posées par les lots L2 et L3.
export const M1_MISSION = {
  gaugeStep: 25,
  id: 'president_m1',
  locked: true,
  get title() { return t('missions.m1', 'Gérer ton club'); },
};

/** @type {any[]} */
export const M1_STEPS = [];
