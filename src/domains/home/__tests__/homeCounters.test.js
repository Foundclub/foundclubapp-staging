import {
  EMPTY_HOME_COUNTERS,
  formatBannerShortTime,
  formatBannerTitle,
  normalizeHomeCounters,
  selectBannerLines,
  selectHomeAlerts,
  selectModerationTotal,
} from '../homeCounters';

// D72 — LE COEUR DE LA TACHE 4, teste seul.
//
// L'endpoint qui alimente ces compteurs N'EXISTE PAS encore (mesure du
// 2026-08-11, cf. l'entete de homeCounters.js). Ce module est donc, aujourd'hui,
// la seule chose du lot qu'on puisse exercer avec des valeurs NON NULLES : il
// decrit ce que l'accueil fera le jour ou le lot serveur livrera. Sans lui, le
// comportement « une pastille par file en attente » ne serait prouve nulle part.

describe('D72 — l etat par defaut : rien en attente', () => {
  it('tous les compteurs sont a zero', () => {
    expect(EMPTY_HOME_COUNTERS.demandes).toBe(0);
    expect(EMPTY_HOME_COUNTERS.impayes).toEqual({ amount: 0, count: 0 });
    expect(EMPTY_HOME_COUNTERS.prochaineSeance).toBeNull();
  });

  // C'EST LE CRITERE DE RECETTE 3, prouve a la racine : si aucune carte ne
  // ressort de ce selecteur, aucune pastille ne peut apparaitre a l'ecran.
  it('AUCUNE carte ne porte de pastille', () => {
    const alertes = selectHomeAlerts(EMPTY_HOME_COUNTERS);

    expect(Object.values(alertes).every((valeur) => valeur === false)).toBe(true);
  });

  it('AUCUN bandeau ne s affiche, quel que soit le role', () => {
    ['president', 'coach', 'superAdmin', 'player'].forEach((role) => {
      expect(selectBannerLines(EMPTY_HOME_COUNTERS, role)).toEqual([]);
    });
  });
});

describe('D72 — une pastille = une action en attente', () => {
  it('chaque compteur non nul allume SA carte, et elle seule', () => {
    const alertes = selectHomeAlerts({ ...EMPTY_HOME_COUNTERS, demandes: 3 });

    expect(alertes['manage-requests']).toBe(true);
    expect(alertes['manage-my-ads']).toBe(false);
    expect(alertes['search-reservations']).toBe(false);
  });

  it('« Ma cotisation » s allume des qu il reste a payer', () => {
    expect(selectHomeAlerts({ ...EMPTY_HOME_COUNTERS, maCotisationDue: 0 })['profile-license']).toBe(false);
    expect(selectHomeAlerts({ ...EMPTY_HOME_COUNTERS, maCotisationDue: 40 })['profile-license']).toBe(true);
  });

  it('les cotisations du club suivent le NOMBRE d impayes, pas le montant', () => {
    const alertes = selectHomeAlerts({
      ...EMPTY_HOME_COUNTERS,
      impayes: { amount: 620, count: 0 },
    });

    expect(alertes['manage-licenses']).toBe(false);
  });

  // ⛔ LA REGLE DU PACK, RENDUE MECANIQUE : les conteneurs, les actions de
  // creation, les reglages et la section Compte ne PEUVENT pas porter de
  // pastille — ils n'ont aucune source de compteur.
  it('les cartes interdites de pastille n en ont AUCUNE source', () => {
    const toutPlein = {
      ...EMPTY_HOME_COUNTERS,
      candidatures: 9,
      demandes: 9,
      impayes: { amount: 999, count: 9 },
      maCotisationDue: 9,
      mesReponses: 9,
      propositionsMatch: 9,
      reservations: 9,
    };
    const allumees = Object.keys(selectHomeAlerts(toutPlein));

    ['manage-club', 'manage-add-event', 'manage-add-ad', 'profile-subscription',
      'league-entry', 'account-switch', 'account-logout', 'profile-alerts',
    ].forEach((carteInterdite) => {
      expect(allumees).not.toContain(carteInterdite);
    });
  });
});

describe('D72 — le bandeau : une ligne a zero disparait', () => {
  it('le dirigeant n a que les lignes qui ont quelque chose a dire', () => {
    const lignes = selectBannerLines({
      ...EMPTY_HOME_COUNTERS,
      demandes: 3,
      impayes: { amount: 620, count: 4 },
    }, 'president');

    expect(lignes.map((ligne) => ligne.key)).toEqual(['demandes', 'impayes']);
    expect(lignes[0]).toEqual({ hasAlert: true, key: 'demandes', value: 3 });
  });

  it('la ligne « prochain evenement » existe des que l evenement existe', () => {
    const lignes = selectBannerLines({
      ...EMPTY_HOME_COUNTERS,
      prochainEvenement: { id: 'e1', label: 'SMUC S1 – Aubagne HB', startsAt: '2026-08-15T14:00:00' },
    }, 'president');

    expect(lignes.map((ligne) => ligne.key)).toEqual(['prochainEvenement']);
  });

  it('le super admin voit ses quatre files, et jamais plus de quatre lignes', () => {
    const lignes = selectBannerLines({
      ...EMPTY_HOME_COUNTERS,
      moderation: {
        aLaUne: 2, clubsAOnboarder: 3, revendications: 3, signalements: 6,
      },
    }, 'superAdmin');

    expect(lignes.map((ligne) => ligne.key)).toEqual([
      'signalements', 'revendications', 'aLaUne', 'clubsAOnboarder',
    ]);
    expect(lignes.length).toBeLessThanOrEqual(4);
  });

  it('le total de la pilule « A traiter » est la somme des quatre files', () => {
    expect(selectModerationTotal({
      ...EMPTY_HOME_COUNTERS,
      moderation: {
        aLaUne: 2, clubsAOnboarder: 3, revendications: 3, signalements: 6,
      },
    })).toBe(14);
  });
});

describe('D72 — la reponse serveur est remise en forme, quoi qu elle contienne', () => {
  it('une reponse absente rend l etat vide, sans lever', () => {
    expect(normalizeHomeCounters(null)).toEqual(EMPTY_HOME_COUNTERS);
    expect(normalizeHomeCounters(undefined)).toEqual(EMPTY_HOME_COUNTERS);
  });

  // C'est ce qui rend le lot serveur INCREMENTAL : il peut livrer un compteur a
  // la fois sans que l'ecran casse sur les autres.
  it('une reponse partielle laisse les compteurs manquants a zero', () => {
    const compteurs = normalizeHomeCounters({ demandes: 3 });

    expect(compteurs.demandes).toBe(3);
    expect(compteurs.candidatures).toBe(0);
    expect(compteurs.impayes).toEqual({ amount: 0, count: 0 });
  });

  it('une valeur illisible ou negative retombe a zero', () => {
    const compteurs = normalizeHomeCounters({ demandes: 'trois', reservations: -2 });

    expect(compteurs.demandes).toBe(0);
    expect(compteurs.reservations).toBe(0);
  });
});

describe('D72 — les deux formats de date du bandeau', () => {
  it('le titre d un evenement se lit « Samedi 15 · 15:00 »', () => {
    expect(formatBannerTitle('2026-08-15T15:00:00')).toBe('Samedi 15 · 15:00');
  });

  it('la valeur d une ligne de liste se lit « sam. 14:00 »', () => {
    expect(formatBannerShortTime('2026-08-15T14:00:00')).toBe('sam. 14:00');
  });

  it('une date absente ou illisible ne rend rien, plutot que « Invalid Date »', () => {
    expect(formatBannerTitle(null)).toBe('');
    expect(formatBannerShortTime('pas une date')).toBe('');
  });
});
