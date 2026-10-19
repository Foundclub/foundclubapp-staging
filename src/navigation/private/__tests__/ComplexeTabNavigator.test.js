const fs = require('fs');
const path = require('path');

// RESA-L5A1 (13/10/2026) — l'espace du complexe (planche EG02, coquille de l'espace Ville) et
// l'arrivée en mode complexe (planche RB). Lecture de la SOURCE, comme le témoin de l'espace de
// la Ville (CollectiviteTabNavigator.test.js) : l'ordre des onglets, ce que chaque onglet monte,
// et l'ordre des règles de l'écran d'arrivée.

const lire = (/** @type {string} */ nom) => fs.readFileSync(
  path.join(__dirname, '..', nom),
  'utf8',
);

describe('RESA-L5A1 E-G02 — la barre du bas de l’espace du complexe', () => {
  const source = lire('ComplexeTabNavigator.js');

  it('Accueil, Demandes, Planning (RESA-L5A2), puis Messages', () => {
    const noms = [...source.matchAll(/name=\{RouteNames\.(\w+)\}/g)].map((m) => m[1]);
    expect(noms).toEqual(['ComplexeAccueil', 'ComplexeDemandes', 'ComplexePlanning', 'Chat']);
  });

  it('RESA-L5A2 — « Planning » ouvre E-G03', () => {
    expect(source).toContain("require('@/views/complexe/ComplexePlanning')");
  });

  it('RESA-L5A2 — « Demandes » ouvre E-G06 et porte le nombre de demandes en attente', () => {
    expect(source).toContain("require('@/views/complexe/ComplexeDemandes')");
    expect(source).toContain("useReservationsDuComplexe(complexeId, { vue: 'demandes' })");
  });

  it('l’accueil est celui du gérant, la messagerie celle du compte', () => {
    expect(source).toContain("require('@/views/complexe/ComplexeAccueil')");
    expect(source).toContain("require('@/views/Messaging')");
    expect(source).toContain('initialRouteName={RouteNames.ComplexeAccueil}');
  });
});

describe('RESA-L5A1 RB — le gérant n’existe que si l’interrupteur est allumé', () => {
  const source = lire('PrivateNavigator.js');

  it('l’espace et ses écrans ne sont déclarés que sous COMPLEXES_GERANT', () => {
    [
      'ComplexeDevenirGerant',
      'ComplexeEspace',
      // RESA-L5A2 (14/10/2026)
      'ComplexeFermetures',
      'ComplexeReservation',
      'ComplexeReservations',
    ].forEach((nom) => {
      const declaration = source.indexOf(`name={RouteNames.${nom}}`);
      const interrupteur = source.lastIndexOf('{COMPLEXES_GERANT ? (', declaration);
      expect(declaration).toBeGreaterThan(-1);
      expect(interrupteur).toBeGreaterThan(-1);
      expect(source.slice(interrupteur, declaration)).not.toContain(') : null}');
    });
    expect(source).toContain("require('./ComplexeTabNavigator')");
  });

  it('le mode complexe ouvre l’app sur l’espace du complexe, APRÈS l’onboarding', () => {
    const onboarding = source.indexOf('if (route) return route;');
    const mode = source.indexOf('if (COMPLEXES_GERANT && lireModeComplexe(userData?.documentId))');
    const ligue = source.indexOf('if (isGold) return RouteNames.LeagueHomeTab;');
    expect(onboarding).toBeGreaterThan(-1);
    expect(mode).toBeGreaterThan(onboarding);
    expect(ligue).toBeGreaterThan(mode);
  });

  it('l’espace du complexe n’est pas pris pour une étape d’onboarding', () => {
    expect(source).toContain('|| initialRouteName === RouteNames.ComplexeEspace');
  });
});

// RESA-INSCRIPTION (19/10/2026) — un compte né « pour un complexe » garde le rôle provisoire (aucun
// rôle sportif) : son parcours d'inscription commence toujours par le choix du statut. Sans règle,
// l'app le lui reposait à CHAQUE ouverture (et « Je gère un complexe » finissait en « Tu gères déjà
// un complexe. »). Même règle que la Ville seule (COLL-ACCUEIL) : il arrive sur l'espace de son
// complexe, et la lecture ne part que pour un compte sans rôle sportif, interrupteur allumé.
describe('RESA-INSCRIPTION — un compte « complexe seul » arrive sur son complexe', () => {
  const source = lire('PrivateNavigator.js');

  it('ses complexes ne sont lus que pour un compte sans rôle sportif, interrupteur allumé', () => {
    expect(source).toContain('useMesComplexes({ enabled: COMPLEXES_GERANT && sansRoleSportif })');
    expect(source).toContain(
      'const complexeSeul = COMPLEXES_GERANT && sansRoleSportif && complexesGeres.length > 0;',
    );
  });

  it('la règle passe APRÈS la Ville seule et AVANT le parcours d’inscription', () => {
    const ville = source.indexOf('if (villeSeule) {');
    const complexe = source.indexOf('if (complexeSeul) return RouteNames.ComplexeEspace;');
    const onboarding = source.indexOf('if (route) return route;');
    expect(ville).toBeGreaterThan(-1);
    expect(complexe).toBeGreaterThan(ville);
    expect(onboarding).toBeGreaterThan(complexe);
  });

  it('la pile attend la lecture, comme pour la Ville (écran d’arrivée choisi UNE fois)', () => {
    expect(source).toContain('if (userDataLoading || villeEnLecture || complexeEnLecture) {');
    expect(source).toContain('&& !villeEnLecture && !complexeEnLecture');
  });
});

describe('RESA-L5A2 RB état 4 — la notification du complexe, en mode joueur', () => {
  it('l’espace, une fois ouvert (par une notification aussi), repasse en mode complexe', () => {
    const source = lire('ComplexeTabNavigator.js');
    expect(source).toContain('ecrireModeComplexe(userData?.documentId, true)');
  });

  it('la liste des notifications porte la pastille « Mode complexe »', () => {
    const liste = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'views', 'notification', 'NotificationList.js'),
      'utf8',
    );
    expect(liste).toContain('estNotificationDuComplexe(notification.type)');
    expect(liste).toContain('<PastilleModeComplexe />');
  });
});
