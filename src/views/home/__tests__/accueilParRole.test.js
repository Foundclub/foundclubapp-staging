const fs = require('fs');
const path = require('path');

// D72 — L'INVENTAIRE DES 4 ACCUEILS (pack accueil, criteres de recette 1, 5 et 6).
//
// Le pack fixe un nombre de cases EXACT par role — 20 / 20 / 13 / 17 — et leur
// ORDRE, section par section. C'est la seule chose qu'aucune porte existante ne
// sait voir : jest, type-check et lint restent verts si une case disparait.
//
// Le controle est fait sur la SOURCE, pour la meme raison que ses deux voisins
// (`myActivitiesEntryPoint.test.js` et `subscriptionEntryPoints.test.js`) :
// HomeHub fait 2 500 lignes et dépend d'une vingtaine de contextes React. Un
// test de rendu couterait plus cher que l'ecran, et surtout il ne dirait rien
// des branches NON PRISES — or c'est precisement ce qu'on veut mesurer ici :
// les quatre accueils a la fois, dont trois qu'un rendu donne ne montre pas.
//
// ⚠️ Chaque decoupe LEVE si son repere a disparu. Un refactor qui renomme une
// garde rend donc ce fichier ROUGE au lieu de le rendre vert par accident.

const SOURCE = fs.readFileSync(path.resolve(__dirname, '..', 'HomeHub.js'), 'utf8');

/**
 * Le corps d'un `useMemo` nomme. Deux formes de fin cohabitent dans ce fichier :
 * `}, [` (corps a accolades) et `]), [` (retour direct d'un tableau) — prendre
 * la PREMIERE des deux, sinon on deborde sur le memo suivant.
 * @param {string} nom
 * @returns {string}
 */
const corpsDuMemo = (nom) => {
  const debut = SOURCE.indexOf(`const ${nom} = useMemo(`);
  if (debut === -1) throw new Error(`HomeHub n'a plus de memo « ${nom} »`);
  const fins = ['}, [', ']), ['].map((marque) => SOURCE.indexOf(marque, debut)).filter((i) => i !== -1);
  if (!fins.length) throw new Error(`Le memo « ${nom} » n'a pas de tableau de dependances`);
  return SOURCE.slice(debut, Math.min(...fins));
};

/**
 * Les clefs de carte d'un fragment, DANS L'ORDRE d'ecriture.
 * @param {string} texte
 * @returns {string[]}
 */
const clefsDeCartes = (texte) => (texte.match(/key: '([^']+)'/g) || [])
  .map((occurrence) => occurrence.slice(6, -1));

/**
 * Le fragment compris entre deux reperes. Lever si l'un manque : une decoupe
 * muette rendrait une liste vide, donc un test vert sur un ecran casse.
 * @param {string} texte
 * @param {string | null} depuis
 * @param {string | null} jusqu
 * @returns {string}
 */
const entre = (texte, depuis, jusqu) => {
  let a = 0;
  let b = texte.length;
  if (depuis) {
    a = texte.indexOf(depuis);
    if (a === -1) throw new Error(`Repere introuvable dans HomeHub : « ${depuis} »`);
  }
  if (jusqu) {
    b = texte.indexOf(jusqu);
    if (b === -1) throw new Error(`Repere introuvable dans HomeHub : « ${jusqu} »`);
  }
  return texte.slice(a, b);
};

const MANAGE = corpsDuMemo('manageSectionCards');
const SEARCH = corpsDuMemo('searchCards');
const PROFILE = corpsDuMemo('profileCards');

const SECTIONS = {
  account: clefsDeCartes(corpsDuMemo('accountCards')),
  league: clefsDeCartes(corpsDuMemo('leagueCards')),
  manageAdmin: clefsDeCartes(entre(MANAGE, 'if (isSuperAdmin) {', null)),
  manageCoach: clefsDeCartes(entre(MANAGE, 'if (isCoach) {', 'if (isSuperAdmin) {')),
  managePresident: clefsDeCartes(entre(MANAGE, 'if (isPresident) {', 'if (isCoach) {')),
  profileAbonnement: clefsDeCartes(entre(PROFILE, 'if (canShowSubscriptionExperience) {', null)),
  profileBase: clefsDeCartes(entre(PROFILE, null, 'if (hasManageSection || isSuperAdmin) {')),
  profileCotisation: clefsDeCartes(entre(PROFILE, 'if (!isSuperAdmin) {', 'if (canShowSubscriptionExperience) {')),
  profileEdition: clefsDeCartes(entre(PROFILE, 'if (hasManageSection || isSuperAdmin) {', 'if (!isSuperAdmin) {')),
  searchBase: clefsDeCartes(entre(SEARCH, null, 'if (hasManageSection) {')),
  searchHorsStaff: clefsDeCartes(entre(SEARCH, 'if (!hasManageSection) {', '// Matchs amicaux')),
  searchQueue: clefsDeCartes(entre(SEARCH, '// Matchs amicaux', null)),
  searchStaff: clefsDeCartes(entre(SEARCH, 'if (hasManageSection) {', 'if (!hasManageSection) {')),
};

/**
 * L'accueil d'un role, section par section, dans l'ordre de l'ecran.
 * @param {'president' | 'coach' | 'player' | 'superAdmin'} role
 * @returns {string[][]}
 */
const accueilDe = (role) => {
  const estStaff = role === 'president' || role === 'coach';
  const estAdmin = role === 'superAdmin';

  let gerer = [];
  if (role === 'president') gerer = SECTIONS.managePresident;
  if (role === 'coach') gerer = SECTIONS.manageCoach;
  if (estAdmin) gerer = SECTIONS.manageAdmin;

  const rechercher = [
    ...SECTIONS.searchBase,
    ...(estStaff ? SECTIONS.searchStaff : SECTIONS.searchHorsStaff),
    ...SECTIONS.searchQueue,
  ];

  // `profileBase` = [voir, historique, alertes]. « Modifier » s'insere en 1,
  // « Ma cotisation » s'ajoute a la fin, « Mon abonnement » passe en tete.
  const profil = [...SECTIONS.profileBase];
  if (estStaff || estAdmin) profil.splice(1, 0, ...SECTIONS.profileEdition);
  if (!estAdmin) profil.push(...SECTIONS.profileCotisation);
  if (estStaff) profil.unshift(...SECTIONS.profileAbonnement);

  return [gerer, rechercher, SECTIONS.league, profil, SECTIONS.account];
};

/**
 * @param {'president' | 'coach' | 'player' | 'superAdmin'} role
 * @returns {string[]}
 */
const toutesLesCartes = (role) => accueilDe(role).flat();

// Les quatre tableaux du pack, recopies clef par clef. C'est la reference : si
// un lot futur deplace une case, c'est ICI que la discussion doit avoir lieu.
const ATTENDU = {
  coach: [
    ['manage-club', 'manage-requests', 'manage-add-event', 'manage-add-ad', 'manage-my-ads', 'manage-licenses'],
    ['search-events', 'search-clubs', 'search-reservations', 'search-profiles', 'search-amicaux'],
    ['league-entry'],
    ['profile-subscription', 'profile-view', 'profile-edit', 'profile-history', 'profile-alerts', 'profile-license'],
    ['account-switch', 'account-logout'],
  ],
  player: [
    [],
    ['search-events', 'search-clubs', 'search-reservations', 'search-ads', 'search-my-activities', 'search-amicaux'],
    ['league-entry'],
    ['profile-view', 'profile-history', 'profile-alerts', 'profile-license'],
    ['account-switch', 'account-logout'],
  ],
  president: [
    ['manage-club', 'manage-requests', 'manage-add-event', 'manage-add-ad', 'manage-my-ads', 'manage-licenses'],
    ['search-events', 'search-clubs', 'search-reservations', 'search-profiles', 'search-amicaux'],
    ['league-entry'],
    ['profile-subscription', 'profile-view', 'profile-edit', 'profile-history', 'profile-alerts', 'profile-license'],
    ['account-switch', 'account-logout'],
  ],
  superAdmin: [
    ['admin-triage', 'admin-users-clubs', 'admin-dashboard', 'admin-league'],
    ['search-events', 'search-clubs', 'search-reservations', 'search-ads', 'search-my-activities', 'search-amicaux'],
    ['league-entry'],
    ['profile-view', 'profile-edit', 'profile-history', 'profile-alerts'],
    ['account-switch', 'account-logout'],
  ],
};

describe('D72 — critere 1 : le bon nombre de cases, dans le bon ordre', () => {
  it.each([
    ['president', 20],
    ['coach', 20],
    ['player', 13],
    ['superAdmin', 17],
  ])('%s affiche exactement %i cartes', (role, attendu) => {
    expect(toutesLesCartes(/** @type {any} */ (role))).toHaveLength(attendu);
  });

  it.each(['president', 'coach', 'player', 'superAdmin'])(
    'l ordre des cases de %s est celui du tableau du pack, section par section',
    (role) => {
      expect(accueilDe(/** @type {any} */ (role))).toEqual(ATTENDU[role]);
    },
  );
});

describe('D72 — critere 5 : « Navigation rapide » n existe plus', () => {
  it('LE TEMOIN : aucune carte de l ancienne section n est rendue', () => {
    ['quick-planning', 'quick-teams', 'quick-chat', 'quick-license'].forEach((clef) => {
      expect(SOURCE).not.toContain(`key: '${clef}'`);
    });
  });

  it('la section elle-meme n est plus construite ni affichee', () => {
    expect(SOURCE).not.toContain('quickNavCards');
    expect(SOURCE).not.toContain("t('homeHub.sections.quickNav')");
  });

  it('« Ma cotisation » n est pas perdue : elle a rejoint « Mon profil »', () => {
    expect(SECTIONS.profileCotisation).toEqual(['profile-license']);
  });

  // Le tour guide chainait « Gerer mes alertes » vers `homehub-quickPlanning`,
  // une etape qui n'existe plus : un pas dans le vide.
  it('aucune etape du tour ne vise plus une case supprimee', () => {
    expect(SOURCE).not.toContain('homehub-quickPlanning');
    expect(SOURCE).not.toContain('scrollToQuickSection');
  });
});

describe('D72 — critere 6 : « Modifier mon profil » au bon endroit', () => {
  it('ABSENTE cote joueur — le crayon de la page profil la remplace', () => {
    expect(toutesLesCartes('player')).not.toContain('profile-edit');
  });

  it('PRESENTE cote super admin — c est sa seule porte d entree', () => {
    expect(toutesLesCartes('superAdmin')).toContain('profile-edit');
  });
});

describe('D72 — ce que le pack retire au super admin, et ce qu il lui donne', () => {
  it('ni « Mon abonnement » ni « Ma cotisation » : il ne paie rien', () => {
    const cartes = toutesLesCartes('superAdmin');

    expect(cartes).not.toContain('profile-subscription');
    expect(cartes).not.toContain('profile-license');
  });

  it('il gagne le rayon « Administration », qui n existait pas', () => {
    expect(SECTIONS.manageAdmin).toEqual([
      'admin-triage', 'admin-users-clubs', 'admin-dashboard', 'admin-league',
    ]);
  });

  it('et un libelle de role : il lisait « JOUEUR » sous le titre', () => {
    expect(SOURCE).toContain("t('homeHub.roles.superAdmin', 'Super admin')");
  });
});
