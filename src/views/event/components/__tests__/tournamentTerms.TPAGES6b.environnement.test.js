/**
 * T-PAGES-6b (18/11/2026, point 5 du chef ; capture Android de la recette 45) — « Lire les
 * conditions » ouvrait Chrome sur foundclub.app, la PRODUCTION, depuis l'app de RECETTE. Au
 * téléphone, `window` n'existe pas, la base de l'API est écartée (ce n'est pas le site) et sans
 * WEB_APP_URL dans le fichier d'environnement, le repli était la production. L'adresse suit
 * maintenant l'environnement de l'app : la base du site de la config si elle est posée, sinon la
 * même règle que les liens d'invitation (production pour une build de production, recette sinon).
 * Sur le site, rien ne change : l'adresse du site qui sert la page.
 * ROUGE avant le lot : l'app de recette ouvrait la production.
 */
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn() } }));

const { tournamentTermsUrl } = require('../tournamentTerms');

test('🔴 app de recette, sans base du site dans la config : les conditions de la recette', () => {
  expect(tournamentTermsUrl({ appEnv: 'staging', os: 'android', webUrl: '' }))
    .toBe('https://staging.foundclub.app/conditions-tournoi');
});

test('caractérisant : app de production : la production ; base du site configurée : elle', () => {
  expect(tournamentTermsUrl({ appEnv: 'production', os: 'ios', webUrl: '' }))
    .toBe('https://foundclub.app/conditions-tournoi');
  expect(tournamentTermsUrl({ appEnv: 'staging', os: 'android', webUrl: 'https://staging.foundclub.app/' }))
    .toBe('https://staging.foundclub.app/conditions-tournoi');
});

test('caractérisant : sur le site, l adresse du site qui sert la page', () => {
  const avant = global.window;
  global.window = /** @type {any} */ ({ location: { origin: 'https://staging.foundclub.app' } });
  try {
    expect(tournamentTermsUrl({ appEnv: 'production', os: 'web', webUrl: '' }))
      .toBe('https://staging.foundclub.app/conditions-tournoi');
  } finally {
    global.window = avant;
  }
});
