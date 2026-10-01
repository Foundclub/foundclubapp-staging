const fs = require('fs');
const path = require('path');

const genererImages = require('../../../theme/images').default;
const { collectiviteTabs } = require('../../../domains/collectivite/collectiviteAccueil');
const { RouteNames } = require('../../routeNames');
const { MOBILE_ONLY_SCREENS } = require('../../webRouteExemptions');

// 🏛️ COLL-ACCUEIL (01/10/2026) — PLANCHE 2 : la NAVIGATION de l'espace de la Ville.
// Design validé (HY521H1) : sur téléphone, une barre du bas « Accueil · Demandes · Planning ·
// Messages » (décision d'Adel du 01/10 : la messagerie reste), l'icône `inbox-arrow-down` et
// la pastille du nombre de demandes sur « Demandes ». Chaque onglet mène à un écran qui EXISTE.
// Un compte « Ville seule » (aucun rôle sportif) arrive DIRECTEMENT dans cet espace.
// ROUGE avant le lot : ni barre, ni route, ni icône branchée, ni atterrissage.
//
// Contrôlé sur la SOURCE pour la navigation (monter la vraie barre tire Messaging et
// FacilityList derrière elle) et sur la fonction PURE pour les onglets.

const SRC = path.resolve(__dirname, '..', '..', '..');
const lire = (/** @type {string} */ relatif) => fs.readFileSync(path.join(SRC, relatif), 'utf8');

const t = (/** @type {string} */ _cle, /** @type {string} */ repli, /** @type {any} */ options) => (
  String(repli).replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''))
);

describe('COLL-ACCUEIL — planche 2 : la barre de l espace de la Ville', () => {
  it('quatre onglets, dans l ordre de la planche', () => {
    const onglets = collectiviteTabs({
      Images: genererImages(), pendingCount: 0, t, unreadCount: 0,
    });
    expect(onglets.map((onglet) => onglet.label)).toEqual([
      'Accueil', 'Demandes', 'Planning', 'Messages',
    ]);
    expect(onglets.map((onglet) => onglet.name)).toEqual([
      RouteNames.CollectiviteHome,
      RouteNames.CollectiviteRequests,
      RouteNames.CollectiviteInstallations,
      RouteNames.Chat,
    ]);
  });

  it('« Demandes » porte l icône dessinée et la pastille du nombre en attente', () => {
    const Images = genererImages();
    const [, demandes, , messages] = collectiviteTabs({
      Images, pendingCount: 2, t, unreadCount: 3,
    });
    expect(demandes.icon).toBe(Images.inboxArrowDown);
    expect(demandes.badge).toBe(2);
    expect(demandes.a11y).toBe('Demandes, 2 en attente');
    expect(messages.badge).toBe(3);
  });

  it('chaque onglet monte un écran qui EXISTE, avec la Ville en paramètre', () => {
    const source = lire('navigation/private/CollectiviteTabNavigator.js');
    [
      ['CollectiviteHome', 'views/collectivite/CollectiviteHome.js'],
      ['CollectiviteRequests', 'views/collectivite/CollectiviteRequests.js'],
      ['CollectiviteInstallations', 'views/facility/FacilityList.js'],
      ['Chat', 'views/Messaging.js'],
    ].forEach(([nom, fichier]) => {
      expect(source).toContain(`name={RouteNames.${nom}}`);
      expect(fs.existsSync(path.join(SRC, fichier))).toBe(true);
      expect(source).toContain(`require('@/${fichier.replace(/\.js$/, '')}')`);
    });
    // L'accueil sait qu'il est dans l'espace (il pose son en-tête : logo, cloche, Mon compte).
    expect(source).toMatch(/initialParams=\{\{ collectiviteId, returnLabel: params\?\.returnLabel, space: true \}\}/);
  });

  it('l icône est posée dans les DEUX tables (native et site), et le fichier existe', () => {
    expect(genererImages().inboxArrowDown).toBeDefined();
    expect(lire('theme/images.js'))
      .toContain("inboxArrowDown: require('../assets/icons/inbox-arrow-down.png')");
    expect(lire('theme/images.web.js'))
      .toContain("inboxArrowDown: createAssetSource('../assets/icons/inbox-arrow-down.png')");
  });
});

describe('COLL-ACCUEIL — planche 2 : où arrive un compte « Ville seule »', () => {
  const racine = lire('navigation/private/PrivateNavigator.js');

  it('l espace de la Ville est monté à la racine, sans en-tête de pile', () => {
    expect(racine).toContain("require('./CollectiviteTabNavigator')");
    expect(racine).toContain('name={RouteNames.CollectiviteSpace}');
  });

  it('Ville seule : l espace de la Ville AVANT le tunnel sportif', () => {
    const memo = racine.slice(racine.indexOf('const initialRouteName = useMemo('));
    const ville = memo.indexOf('if (villeSeule) return RouteNames.CollectiviteSpace;');
    const tunnel = memo.indexOf('if (route) return route;');
    expect(ville).toBeGreaterThan(-1);
    expect(ville).toBeLessThan(tunnel);
  });

  it('la lecture de « mes collectivités » ne part QUE pour un compte sans rôle sportif', () => {
    expect(racine)
      .toContain("const sansRoleSportif = Boolean(userData?.documentId) && roleKey === 'new';");
    expect(racine).toContain('useMyCollectivites({ enabled: sansRoleSportif })');
    // La pile choisit son écran d'arrivée une seule fois : elle attend la réponse.
    expect(racine).toContain('if (userDataLoading || villeEnLecture) {');
  });

  it('sur le site, la barre est le menu latéral : exemption justifiée', () => {
    expect(MOBILE_ONLY_SCREENS[RouteNames.CollectiviteSpace]).toMatch(/side menu/);
  });
});
