import {
  EMPTY_HOME_COUNTERS,
  normalizeHomeCounters,
  selectHomeAlerts,
  selectMyApplicationsStatus,
} from '../homeCounters';

// MES-CANDIDATURES (audit V1, A13 — 01/10) : « QUAND ON POSTULE, ON A UNE PASTILLE
// ROUGE QUI APPARAIT ET QUI NE DISPARAIT JAMAIS ».
//
// 🔴 LA CAUSE, lue dans le code : la pastille de la case « Mes reponses » suivait
// `mesReponses`, le nombre de MES candidatures EN ATTENTE (serveur :
// app-home-summary.ts, tache 6). Elle restait donc allumee tant que le CLUB ne
// repondait pas — alors qu'une pastille rouge veut dire « a TOI d'agir ».
//
// ✅ LA REGLE (reco du document, confirmee par Adel) :
//   · une attente s'ECRIT, en gris : « 1 en attente » (le sous-titre de la case) ;
//   · le rouge ne s'allume que pour une REPONSE NON VUE (`mesReponsesNonVues`,
//     lu par le serveur dans les notifications de reponse non lues) ;
//   · il s'eteint quand la personne a ouvert « Mes candidatures ».

describe('A13 — le rouge = une reponse du club que je n ai pas encore vue', () => {
  it('LE TEMOIN : une candidature qui ATTEND n allume plus la pastille', () => {
    const alertes = selectHomeAlerts({ ...EMPTY_HOME_COUNTERS, mesReponses: 1 });

    expect(alertes['search-my-activities']).toBe(false);
  });

  it('une reponse NON VUE l allume', () => {
    const alertes = selectHomeAlerts({ ...EMPTY_HOME_COUNTERS, mesReponsesNonVues: 1 });

    expect(alertes['search-my-activities']).toBe(true);
  });

  it('une fois vue (le serveur rend 0), elle s eteint, meme s il reste une attente', () => {
    const alertes = selectHomeAlerts({
      ...EMPTY_HOME_COUNTERS, mesReponses: 2, mesReponsesNonVues: 0,
    });

    expect(alertes['search-my-activities']).toBe(false);
  });

  it('le compteur de reponses non vues est lu, et protege comme les autres', () => {
    expect(normalizeHomeCounters({ mesReponsesNonVues: '3' }).mesReponsesNonVues).toBe(3);
    expect(normalizeHomeCounters({ mesReponsesNonVues: null }).mesReponsesNonVues).toBe(0);
    expect(normalizeHomeCounters({ mesReponsesNonVues: -2 }).mesReponsesNonVues).toBe(0);
    // Un serveur d'avant ce lot ne l'envoie pas : 0, jamais de pastille fantome.
    expect(normalizeHomeCounters({ mesReponses: 4 }).mesReponsesNonVues).toBe(0);
    expect(EMPTY_HOME_COUNTERS.mesReponsesNonVues).toBe(0);
  });
});

describe('A13 — ce que la case ECRIT : l attente en toutes lettres, en gris', () => {
  it('rien en attente, rien de neuf : la case garde son sous-titre d origine', () => {
    expect(selectMyApplicationsStatus(EMPTY_HOME_COUNTERS)).toEqual([]);
  });

  it('une attente seule : « 1 en attente »', () => {
    expect(selectMyApplicationsStatus({ ...EMPTY_HOME_COUNTERS, mesReponses: 1 }))
      .toEqual([{ count: 1, key: 'pending' }]);
  });

  it('une reponse non vue passe EN TETE, l attente la suit', () => {
    expect(selectMyApplicationsStatus({
      ...EMPTY_HOME_COUNTERS, mesReponses: 2, mesReponsesNonVues: 1,
    })).toEqual([{ count: 1, key: 'unseen' }, { count: 2, key: 'pending' }]);
  });
});
