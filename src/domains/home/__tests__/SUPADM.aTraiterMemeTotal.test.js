import fs from 'fs';
import path from 'path';

import {
  EMPTY_HOME_COUNTERS, selectBannerLines, selectModerationTotal, selectTriageTarget,
} from '../homeCounters';

// SUPADM (recette iPhone d'Adel du 23/10, point 1, captures 01-*) — la carte « À traiter » disait
// 4, le bandeau « Revendications de club 3 · À la une — à valider 1 · Mairies à activer 1 », soit
// 5 : la carte ne comptait que les 4 files du serveur, le bandeau y ajoutait les 2 lignes
// « Collectivités ». Et un appui ouvrait TOUJOURS « Signalements », vide ce jour-là.
// 🔒 LA RÈGLE : la carte additionne LES MÊMES LIGNES que le bandeau, et ouvre la première non vide.

const RECETTE_23_10 = {
  ...EMPTY_HOME_COUNTERS,
  moderation: {
    aLaUne: 1, clubsAOnboarder: 0, revendications: 3, signalements: 0,
  },
};

describe('SUPADM — la carte « À traiter » et le bandeau disent le même nombre', () => {
  it('le cas de la recette : 3 + 1 + 1 = 5 sur la carte, comme sur le bandeau', () => {
    const collectivites = { demandesGestionnaire: 0, mairiesAActiver: 1 };
    const bandeau = selectBannerLines(RECETTE_23_10, 'superAdmin', collectivites)
      .reduce((somme, ligne) => somme + ligne.value, 0);
    expect(bandeau).toBe(5);
    expect(selectModerationTotal(RECETTE_23_10, collectivites)).toBe(bandeau);
  });

  it('au-delà des 4 lignes du bandeau, la carte compte toujours tout', () => {
    const tout = {
      ...EMPTY_HOME_COUNTERS,
      moderation: {
        aLaUne: 1, clubsAOnboarder: 1, revendications: 1, signalements: 1,
      },
    };
    expect(selectModerationTotal(tout, { demandesGestionnaire: 1, mairiesAActiver: 1 })).toBe(6);
  });

  it('un appui ouvre la première file non vide, dans l ordre du bandeau', () => {
    expect(selectTriageTarget(RECETTE_23_10, { mairiesAActiver: 1 })).toBe('revendications');
    expect(selectTriageTarget(EMPTY_HOME_COUNTERS, { mairiesAActiver: 1 })).toBe('mairiesAActiver');
    // Rien à traiter : les signalements, comme avant.
    expect(selectTriageTarget(EMPTY_HOME_COUNTERS, {})).toBe('signalements');
  });

  it('l accueil branche la carte sur ces deux règles, avec les nombres des collectivités', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../../views/home/HomeHub.js'), 'utf8');
    expect(source).toContain('badgeCount: selectModerationTotal(homeCounters, collectivitesATraiter)');
    expect(source).toContain('selectTriageTarget(homeCounters, collectivitesATraiter)');
  });
});
