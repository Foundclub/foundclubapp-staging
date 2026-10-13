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

  it('Accueil, puis Messages (le lot L5A2 insère Demandes et Planning)', () => {
    const noms = [...source.matchAll(/name=\{RouteNames\.(\w+)\}/g)].map((m) => m[1]);
    expect(noms).toEqual(['ComplexeAccueil', 'Chat']);
  });

  it('l’accueil est celui du gérant, la messagerie celle du compte', () => {
    expect(source).toContain("require('@/views/complexe/ComplexeAccueil')");
    expect(source).toContain("require('@/views/Messaging')");
    expect(source).toContain('initialRouteName={RouteNames.ComplexeAccueil}');
  });
});

describe('RESA-L5A1 RB — le gérant n’existe que si l’interrupteur est allumé', () => {
  const source = lire('PrivateNavigator.js');

  it('l’espace et « Devenir gérant » ne sont déclarés que sous COMPLEXES_GERANT', () => {
    ['ComplexeDevenirGerant', 'ComplexeEspace'].forEach((nom) => {
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
