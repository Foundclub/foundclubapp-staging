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

/**
 * Les clefs que l'accueil RETIRE au parent. Elles sont lues dans la source de
 * HomeHub, jamais recopiees ici : une liste doublee finirait par diverger de
 * celle qui agit vraiment a l'ecran.
 * @type {string[]}
 */
const MASQUEES_AU_PARENT = (() => {
  const debut = SOURCE.indexOf('const CARTES_MASQUEES_AU_PARENT = new Set([');
  if (debut === -1) throw new Error('HomeHub n a plus de liste « CARTES_MASQUEES_AU_PARENT »');
  const bloc = SOURCE.slice(debut, SOURCE.indexOf(']);', debut));
  return (bloc.match(/'[a-z-]+'/g) || []).map((occurrence) => occurrence.slice(1, -1));
})();

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
  // PARENT — la carte d'appel est ECRITE en dernier mais LUE en premier
  // (`unshift`). Son repere borne aussi `searchQueue` : sans cela, les quatre
  // accueils d'origine compteraient une case de plus qu'ils n'en affichent.
  searchParent: clefsDeCartes(entre(SEARCH, 'if (isParent) {', null)),
  searchQueue: clefsDeCartes(entre(SEARCH, '// Matchs amicaux', 'if (isParent) {')),
  searchStaff: clefsDeCartes(entre(SEARCH, 'if (hasManageSection) {', 'if (!hasManageSection) {')),
  // PERF (2026-09-06) — la section « Entrainement » : TROIS cases (corrige le
  // 2026-09-08 : elle en portait deux a l ecriture, elle en porte trois depuis),
  // les MEMES pour tous les roles, PARENT COMPRIS. C est la seule section de
  // l accueil sans garde de role, et c est voulu : un entrainement personnel
  // s adresse d abord au Joueur.
  training: clefsDeCartes(corpsDuMemo('trainingCards')),
};

/**
 * L'accueil d'un role, section par section, dans l'ordre de l'ecran.
 * @param {'president' | 'coach' | 'player' | 'parent' | 'superAdmin'} role
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

  // PARENT — l'accueil part de celui du joueur, puis deux gestes seulement :
  // il OTE les cases du masque, et il AJOUTE une case en tete de « Rechercher ».
  // La section League tombe a zero carte ; `HomeSection` ne rend alors ni son
  // titre ni son rayon (`if (!cards.length) return null`).
  //
  // 🤝 RESOLU A LA FUSION DU 2026-09-08. La resolution avait garde une phrase
  // FAUSSE, corrigee le soir meme apres verification dans le rendu :
  //  · le lot PARENT P0 retire au parent SIX cases, listees dans
  //    `CARTES_MASQUEES_AU_PARENT` — et AUCUNE n est une case d entrainement ;
  //  · le lot PERF pose « Entrainement » en DERNIERE section (decision d Adel :
  //    « tout en bas, c est en bonus »), SANS aucun garde de role.
  // ⇒ Le parent la voit, comme tout le monde. Adel l a confirme deux fois :
  //   « pour tout le monde ». Ce tableau disait le contraire et restait vert.
  if (role === 'parent') {
    const horsMasque = (/** @type {string} */ clef) => !MASQUEES_AU_PARENT.includes(clef);

    // 🩹 CORRIGE LE 2026-09-08 : ce tableau AFFIRMAIT que le parent n avait pas
    // la section Entrainement. C ETAIT FAUX, et le temoin restait vert parce
    // qu il ne lit pas le JSX — il se compare a un second tableau ecrit a la
    // main (`ATTENDU`). Le rendu, lui, pose `<HomeSection cards={trainingCards}>`
    // SANS AUCUN garde de role : le parent la voit depuis toujours.
    // C est aussi ce qu Adel a tranche, deux fois : « pour tout le monde ».
    // Le temoin « la section Entrainement n est gardee par aucun role » ci-dessous
    // lit le JSX, lui, et empechera ce mensonge de revenir.
    return [
      gerer,
      [...SECTIONS.searchParent, ...rechercher].filter(horsMasque),
      [],
      profil.filter(horsMasque),
      SECTIONS.account,
      SECTIONS.training,
    ];
  }

  // ⚠️ Ce temoin fabrique l ordre LUI-MEME a partir des corps de memo : il ne lit
  // PAS le JSX. Il ne peut donc pas attraper un deplacement dans le rendu — c est
  // justement pourquoi cette ligne et les tableaux ci-dessous doivent etre
  // corriges A LA MAIN quand une section bouge, sinon ils restent VERTS en
  // decrivant un ecran faux.
  return [gerer, rechercher, SECTIONS.league, profil, SECTIONS.account, SECTIONS.training];
};

/**
 * @param {'president' | 'coach' | 'player' | 'parent' | 'superAdmin'} role
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
    ['training-mine', 'training-find', 'training-logbook'],
  ],
  // PARENT — le lot P0 lui retire « Offres de recrutement », « Mes reponses »,
  // « Matchs amicaux », League, « Historique sportif » et « Mes cotisations ».
  // PARENT P2 (10/09) — « Mes enfants » entre sur l accueil, EN TETE.
  // 🖥️ Trouve sur emulateur : l accueil du parent n avait AUCUNE porte vers
  // « Mes enfants ». Il fallait passer par le profil — pour quelqu un dont
  // c est la SEULE raison d etre dans l app. Le plan (A3) le demandait deja :
  // « Mes enfants : une carte par enfant, ou un grand bouton s il n y en a
  // aucun ». C est la premiere moitie : la porte.
  // 🧹 11/09 (Adel) : « Chercher un club pour mon enfant », posee par P0, est
  // RETIREE — elle ouvrait le MEME ecran que « Club », deux cases plus bas.
  parent: [
    [],
    ['search-my-children', 'search-events', 'search-clubs', 'search-reservations'],
    [],
    ['profile-view', 'profile-alerts'],
    ['account-switch', 'account-logout'],
    ['training-mine', 'training-find', 'training-logbook'],
  ],
  player: [
    [],
    ['search-events', 'search-clubs', 'search-reservations', 'search-ads', 'search-my-activities', 'search-amicaux'],
    ['league-entry'],
    ['profile-view', 'profile-history', 'profile-alerts', 'profile-license'],
    ['account-switch', 'account-logout'],
    ['training-mine', 'training-find', 'training-logbook'],
  ],
  president: [
    ['manage-club', 'manage-requests', 'manage-add-event', 'manage-add-ad', 'manage-my-ads', 'manage-licenses'],
    ['search-events', 'search-clubs', 'search-reservations', 'search-profiles', 'search-amicaux'],
    ['league-entry'],
    ['profile-subscription', 'profile-view', 'profile-edit', 'profile-history', 'profile-alerts', 'profile-license'],
    ['account-switch', 'account-logout'],
    ['training-mine', 'training-find', 'training-logbook'],
  ],
  superAdmin: [
    ['admin-triage', 'admin-users-clubs', 'admin-dashboard', 'admin-league'],
    ['search-events', 'search-clubs', 'search-reservations', 'search-ads', 'search-my-activities', 'search-amicaux'],
    ['league-entry'],
    ['profile-view', 'profile-edit', 'profile-history', 'profile-alerts'],
    ['account-switch', 'account-logout'],
    ['training-mine', 'training-find', 'training-logbook'],
  ],
};

describe('D72 — critere 1 : le bon nombre de cases, dans le bon ordre', () => {
  it.each([
    // RECOLTE 2026-09-08 : les comptes viennent de PERF, et « parent » du lot P0.
    // 🩹 CORRIGE le meme jour : le parent etait compte a 8, comme s il n avait pas
    // la section Entrainement. Il l a — le rendu ne la garde par AUCUN role.
    // 8 + 3 = 11. Tous les roles la recoivent, EN DERNIER.
    ['president', 23],
    ['coach', 23],
    ['player', 16],
    // 🧹 11/09 : 12 → 11. La case « Chercher un club pour mon enfant » est
    // retiree : elle doublait « Club ».
    ['parent', 11],
    ['superAdmin', 20],
  ])('%s affiche exactement %i cartes', (role, attendu) => {
    expect(toutesLesCartes(/** @type {any} */ (role))).toHaveLength(attendu);
  });

  it.each(['president', 'coach', 'player', 'parent', 'superAdmin'])(
    'l ordre des cases de %s est celui du tableau du pack, section par section',
    (role) => {
      expect(accueilDe(/** @type {any} */ (role))).toEqual(ATTENDU[role]);
    },
  );
});

describe('🩹 LE MENSONGE DU 2026-09-08 — ces deux temoins lisent le RENDU, pas un tableau', () => {
  // POURQUOI ILS EXISTENT. Les deux tableaux ci-dessus sont ecrits A LA MAIN et
  // se comparent l un a l autre : ils peuvent donc etre FAUX TOUS LES DEUX et
  // rester verts. C est exactement ce qui est arrive — ils affirmaient que le
  // parent n avait pas la section Entrainement, alors que le rendu la lui donne
  // depuis toujours. Le fichier l avoue lui-meme plus haut : « il ne lit PAS le
  // JSX ». Ces deux-la le lisent.

  /**
   * Le rendu de la section Entrainement, tel qu il est ecrit dans le JSX,
   * COMMENTAIRES RETIRES.
   *
   * 🪤 Sans ce nettoyage le temoin se trompe de cible : le long commentaire qui
   * precede ce rendu NOMME les drapeaux de role (« le couple `hasManageSection`,
   * `isSuperAdmin` existe deja »). Un test qui cherche un garde y trouverait des
   * mots au lieu de code, et tomberait sur du texte explicatif.
   */
  const RENDU_ENTRAINEMENT = (() => {
    const marque = 'cards={trainingCards}';
    const i = SOURCE.indexOf(marque);
    if (i === -1) throw new Error('HomeHub ne rend plus « cards={trainingCards} »');
    const debutBalise = SOURCE.lastIndexOf('<HomeSection', i);
    if (debutBalise === -1) throw new Error('Le rendu de l entrainement n est plus une HomeSection');
    // On part de la FIN du commentaire qui precede, pas d une fenetre de taille
    // fixe : une fenetre fixe tombe AU MILIEU du commentaire, et plus aucune
    // expression reguliere ne peut alors le retirer — elle n en voit pas le debut.
    const finCommentaire = SOURCE.lastIndexOf('*/}', debutBalise);
    const debut = finCommentaire === -1 ? Math.max(0, debutBalise - 300) : finCommentaire + 3;
    return SOURCE.slice(debut, i + marque.length);
  })();

  it('la section Entrainement n est gardee par AUCUN role', () => {
    // Si un lot futur veut la reserver a certains roles, ce temoin tombe et la
    // discussion a lieu — au lieu d une divergence silencieuse entre l ecran et
    // le tableau qui pretend le decrire.
    const gardes = ['isParent', 'isPlayer', 'isCoach', 'isPresident', 'isSuperAdmin', 'roleKey ==='];
    const trouves = gardes.filter((garde) => RENDU_ENTRAINEMENT.includes(garde));

    expect(trouves).toEqual([]);
  });

  it('elle est rendue en DERNIER, apres la section Compte', () => {
    // La decision d Adel du 2026-09-08 : « tout en bas, c est en bonus ».
    const compte = SOURCE.indexOf('cards={accountCards}');
    const entrainement = SOURCE.indexOf('cards={trainingCards}');

    expect(compte).toBeLessThan(entrainement);
  });
});

describe('P0 — l accueil du PARENT (2 comptes reels en production le 07/09)', () => {
  it('LE TEMOIN : il ne lit plus « JOUEUR » en haut, mais « PARENT »', () => {
    expect(SOURCE).toContain("t('homeHub.roles.parent', 'Parent')");
  });

  it('le libelle du parent est teste AVANT le repli sur « Joueur »', () => {
    expect(SOURCE.indexOf('homeHub.roles.parent')).toBeLessThan(SOURCE.indexOf('homeHub.roles.player'));
  });

  it.each([
    ['search-ads', 'les offres de recrutement — il ne cherche pas a etre recrute'],
    ['search-my-activities', 'ses candidatures — il n en depose aucune'],
    ['search-amicaux', 'les matchs amicaux — il n a pas d equipe'],
    ['league-entry', 'League — la competition n est pas la sienne'],
    ['profile-history', 'son historique sportif — il ne joue pas'],
    ['profile-license', 'ses cotisations — il n en a aucune a lui'],
  ])('il ne voit plus « %s » : %s', (clef) => {
    expect(toutesLesCartes('parent')).not.toContain(clef);
  });

  it('mais il garde ce qui le concerne : chercher, son profil, son compte', () => {
    const cartes = toutesLesCartes('parent');

    expect(cartes).toContain('search-clubs');
    expect(cartes).toContain('search-events');
    expect(cartes).toContain('profile-view');
    expect(cartes).toContain('account-logout');
  });

  // 🩹 CORRIGE LE 2026-09-10 par PARENT P2 : « Mes enfants » passe devant —
  // l ordre que le plan demandait deja (A3, GO Adel du 07/09).
  it('P2 — « Mes enfants » ouvre la marche', () => {
    expect(accueilDe('parent')[1][0]).toBe('search-my-children');
  });

  // 🧹 LE DOUBLON RETIRE LE 2026-09-11, vu a l ecran par Adel. Le lot P0 avait
  // pose « Chercher un club pour mon enfant » en tete, raccourci vers la
  // recherche de clubs EXISTANTE — en laissant « Club » deux cases plus bas.
  // Deux cases, UN SEUL ecran, et aucun filtre pour l enfant.
  // ⚠️ On compte la DESTINATION, pas la clef : une case renommee qui rouvrirait
  // le meme ecran rendrait ce temoin rouge, lui aussi.
  it('une seule case de « Rechercher » ouvre la recherche de clubs', () => {
    const ouvertures = SEARCH.match(/navigation\.navigate\(RouteNames\.SearchClubs\b/g) || [];

    expect(ouvertures).toHaveLength(1);
    expect(toutesLesCartes('parent')).not.toContain('search-club-for-child');
  });

  it('LE GARDE-FOU : le masque ne touche AUCUN autre role', () => {
    ['player', 'coach', 'president', 'superAdmin'].forEach((role) => {
      expect(toutesLesCartes(/** @type {any} */ (role))).toContain('league-entry');
    });
  });
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
