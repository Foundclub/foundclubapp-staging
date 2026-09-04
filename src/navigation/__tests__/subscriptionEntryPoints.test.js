const fs = require('fs');
const path = require('path');

const WEB_ROUTE_PATTERNS = require('../webRoutes').default;

// L33 — LE controle qui protege l'argent de ce lot.
//
// L'ecran Abonnement etait atteint depuis sept endroits. La refonte le coupe en
// trois : un hub qui GERE (aucun catalogue, aucun prix) et un carrousel qui
// VEND. A partir de la, chaque point d'entree doit viser le bon ecran, et se
// tromper coute cher dans un seul sens : quelqu'un qui vient de buter sur un
// mur payant et qui atterrit sur le hub n'a plus AUCUN moyen de payer. C'est
// mot pour mot le trou que le lot L10-A a comble.
//
// Le controle est fait sur la SOURCE plutot qu'au rendu, pour trois raisons :
// il couvre les sept points d'un coup, il monte zero ecran geant (EventDetails
// fait 5 400 lignes), et surtout il ECHOUE quand un huitieme appelant apparait
// sans decision — ce qu'aucun test de rendu ne saurait voir.

const racineSources = path.resolve(__dirname, '..', '..');

/**
 * @param {string} cheminRelatif
 * @returns {string}
 */
const lireSource = (cheminRelatif) => fs.readFileSync(
  path.join(racineSources, cheminRelatif),
  'utf8',
);

/**
 * Routes d'abonnement visees par un fichier, dans l'ordre d'apparition.
 * @param {string} cheminRelatif
 * @returns {string[]}
 */
const routesViseesPar = (cheminRelatif) => (
  lireSource(cheminRelatif).match(/RouteNames\.Subscription(?:Overview|Offers|Compare)/g) || []
).map((occurrence) => occurrence.replace('RouteNames.', ''));

// Les sept points d'entree mesures le 2026-08-05, et la decision prise pour
// chacun. « offers » = le carrousel (on vend), « overview » = le hub (on gere).
const POINTS_D_ENTREE = [
  // S12-B/D6 — LA FEUILLE VISE DESORMAIS DEUX ECRANS, ET C'EST UNE DECISION.
  //
  // Ce garde-fou a fait exactement son travail : il a refuse la deuxieme
  // destination tant qu'elle n'etait pas ecrite ici. La voici.
  //
  // Par defaut la feuille VEND, donc elle vise le carrousel — inchange, c'est le
  // trou que L10-A a comble.
  //
  // ⚠️ LOT CATALOGUE (2026-08-28) — LA SECONDE DESTINATION A DISPARU, ET C'EST
  // UNE REPARATION. Le refus `CLUB_LICENSEE_LIMIT` menait au hub « Mon
  // abonnement » pour y AUGMENTER un nombre de licencies : un club au licencie
  // n'avait rien a acheter. Cette feuille d'augmentation ne s'ouvre que pour
  // l'offre au licencie, supprimee le 28/08 — le bouton menait donc a un ecran
  // ou il ne se passait rien. Un club plein a de nouveau quelque chose a
  // acheter : la TRANCHE SUPERIEURE, qui vit dans le carrousel.
  {
    attendu: 'SubscriptionOffers',
    fichier: 'components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet.js',
    pourquoi: 'elle vend, y compris au club plein : la tranche superieure',
  },
  {
    attendu: 'SubscriptionOffers',
    fichier: 'components/molecules/subscriptionQuotaBanner/SubscriptionQuotaBanner.js',
    pourquoi: 'elle vient de voir un compteur',
  },
  {
    attendu: 'SubscriptionOffers',
    fichier: 'views/event/EventDetails.js',
    pourquoi: 'relance de quota apres publication',
  },
  {
    attendu: 'SubscriptionOffers',
    fichier: 'views/home/HomeHub.js',
    pourquoi: 'la carte d accueil affiche un compteur',
  },
  {
    attendu: 'SubscriptionOverview',
    fichier: 'views/profile/Profile.js',
    pourquoi: '« Mon compte » est un geste de gestion',
  },
  {
    attendu: 'SubscriptionOverview',
    fichier: 'views/subscription/SubscriptionSuccess.js',
    pourquoi: 'elle vient d acheter',
  },
  // D89 — les 8e et 9e points d'entree, et la decision qui va avec : le sas de
  // fin d'inscription VEND, il vise donc le carrousel. Le hub serait le mauvais
  // ecran deux fois — il ne vend rien, et il n'a rien a gerer pour quelqu'un qui
  // n'a jamais eu d'offre.
  //
  // Ils vont par PAIRE et ne voyagent pas separement : `authUseCases.js` NOMME
  // la route de sortie, `PrivateNavigator.js` la MONTE dans la pile du tunnel.
  // Sans le second, le premier envoie vers un nom que cette pile ne connait pas,
  // et `navigate` echoue en silence (piege R06).
  {
    attendu: 'SubscriptionOffers',
    fichier: 'domains/auth/authUseCases.js',
    pourquoi: 'la sortie de tunnel propose l offre avant la bienvenue',
  },
  {
    attendu: 'SubscriptionOffers',
    fichier: 'navigation/private/PrivateNavigator.js',
    pourquoi: 'le sas d inscription monte le carrousel dans la pile du tunnel',
  },
  // C-C — le 10e point d'entree : l'ECRAN 12 du pack composition, le mur payant
  // de la composition en ecran plein. La decision est la meme que celle de la
  // feuille dont il reprend le role : il VEND, il vise donc le carrousel. Le hub
  // serait le mauvais ecran — quelqu'un qui vient d'etre refuse doit trouver
  // quoi payer, et le hub ne porte aucun catalogue (L33).
  {
    attendu: 'SubscriptionOffers',
    fichier: 'views/subscription/CompositionPaywallScreen.js',
    pourquoi: 'elle vient de buter sur le mur payant de la composition',
  },
  // S12-B/D5 — le 11e point d'entree : LA NOTIFICATION DE QUOTA AU LICENCIE.
  //
  // Elle vise le HUB, et c'est le seul choix juste : elle s'adresse a un
  // dirigeant qui PAIE DEJA et dont le club vient de se remplir. Le carrousel
  // lui reproposerait l'offre qu'il a ; ce qu'il lui faut est la feuille
  // d'augmentation, qui vit sur le hub. Elle y arrive avec les deux nombres —
  // ils n'existent NI dans le bootstrap NI dans aucune route de lecture.
  // ESSAI/E6 (28/08) — LE ROUTEUR DE NOTIFICATIONS VISE DESORMAIS DEUX ECRANS,
  // et le garde-fou a encore fait son travail : il a refuse la seconde
  // destination tant qu'elle n'etait pas ecrite ici.
  //
  // 1. Le HUB (inchange, cite en premier dans le fichier) : quota au licencie —
  //    un dirigeant qui PAIE DEJA et dont le club se remplit doit AUGMENTER.
  // 2. Le CARROUSEL (neuf) : `subscriptionEnded` / `subscriptionPaymentFailed` —
  //    la demande d'Adel est explicite, « votre abonnement est termine,
  //    profitez des offres FoundClub », puis l'ecran des offres. Le hub serait
  //    le mauvais ecran : cette personne n'a plus rien a gerer, elle a quelque
  //    chose a reprendre, et le hub ne porte aucun catalogue (L33).
  //
  // UPGRADE (04/09) — LE ROUTEUR VISE MAINTENANT TROIS FOIS, et le garde-fou a
  // encore fait son travail : il a refuse la troisieme destination tant qu'elle
  // n'etait pas ecrite ici.
  //
  // 3. Le HUB, une seconde fois (`subscriptionReplaced`, cite EN DERNIER dans le
  //    fichier — l'ordre des `case` est impose par `perfectionist/sort-switch-case`,
  //    pas choisi) : un autre membre du
  //    club a pris une offre MEILLEURE, la couverture de cette personne est
  //    remplacee — mais Apple ou Google continue de la prelever, et FoundClub
  //    ne peut pas resilier a sa place. Le carrousel serait le pire ecran
  //    possible : lui revendre quelque chose au moment ou elle paie pour rien.
  //    Le hub est le seul qui porte « Gérer ou résilier mon abonnement ».
  //
  // ⚠️ L'ordre compte : le hub reste la PREMIERE route citee du fichier.
  {
    attendu: ['SubscriptionOverview', 'SubscriptionOffers', 'SubscriptionOverview'],
    fichier: 'utils/notifications/notificationNavigation.js',
    pourquoi: 'club plein => hub ; terminee => carrousel ; remplacee => hub (resilier)',
  },
];

describe('Points d\'entree de l\'abonnement — chacun atterrit au bon endroit', () => {
  it.each(POINTS_D_ENTREE)(
    '$fichier vise $attendu ($pourquoi)',
    ({ attendu, fichier }) => {
      // Un point d'entree vise UNE route, sauf decision ecrite ci-dessus : le
      // tableau reste alors la liste EXACTE et ORDONNEE de ce qu'il cite.
      expect(routesViseesPar(fichier)).toEqual(Array.isArray(attendu) ? attendu : [attendu]);
    },
  );

  it('7e point d\'entree — l\'URL web `/profile/subscription` ouvre le HUB', () => {
    expect(WEB_ROUTE_PATTERNS.SubscriptionOverview).toBe('/profile/subscription');
    expect(WEB_ROUTE_PATTERNS.SubscriptionOffers).toBe('/profile/subscription/offers');
    expect(WEB_ROUTE_PATTERNS.SubscriptionCompare).toBe('/profile/subscription/compare');
  });

  it('AUCUN huitieme appelant n\'est apparu sans decision', () => {
    const fichiersAutorises = new Set([
      ...POINTS_D_ENTREE.map((point) => point.fichier),
      // Les trois ecrans du parcours et leur declaration : ils se citent
      // forcement les uns les autres.
      'navigation/private/stacks/ProfileStack.js',
      'navigation/webRoutes.js',
      'views/profile/SubscriptionCompare.js',
      'views/profile/SubscriptionOverview.js',
    ]);

    /**
     * @param {string} dossier
     * @returns {string[]}
     */
    const parcourir = (dossier) => fs.readdirSync(dossier, { withFileTypes: true })
      .flatMap((entree) => {
        const chemin = path.join(dossier, entree.name);
        if (entree.isDirectory()) {
          return entree.name === '__tests__' ? [] : parcourir(chemin);
        }
        // D89 — les tests ne sont pas des points d'entree, et tous ne vivent pas
        // dans un dossier `__tests__` : `src/domains/` les pose A COTE de leur
        // source (`authUseCases.welcome.test.js`). Sans cette seconde exclusion,
        // le premier test qui NOMME une route d'abonnement se declarait lui-meme
        // appelant coupable.
        if (/\.test\.jsx?$/.test(entree.name)) return [];
        return entree.isFile() && /\.jsx?$/.test(entree.name) ? [chemin] : [];
      });

    const coupables = parcourir(racineSources)
      .map((chemin) => path.relative(racineSources, chemin).split(path.sep).join('/'))
      .filter((chemin) => !fichiersAutorises.has(chemin))
      .filter((chemin) => routesViseesPar(chemin).length > 0);

    // Un fichier de plus ici n'est pas une erreur en soi : c'est une DECISION a
    // prendre (hub ou carrousel ?), puis a inscrire dans POINTS_D_ENTREE.
    expect(coupables).toEqual([]);
  });
});

// L40 — deuxieme decision par point d'entree, et elle ne se devine pas non plus.
// Une porte ouverte par un MUR PAYANT interrompt une tache : elle doit dire d'ou
// elle part, sinon l'achat renvoie la personne a l'accueil et lui laisse
// retrouver son chemin toute seule (son brouillon est garde par L10-C, pas son
// chemin). Une entree VOLONTAIRE depuis le hub n'interrompt rien : on y va pour
// acheter, on repart a l'accueil, et ca ne doit PAS changer.
describe('L40 — une porte dit d ou elle part, ou assume l accueil', () => {
  it.each([
    ['components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet.js', true],
    ['components/molecules/subscriptionQuotaBanner/SubscriptionQuotaBanner.js', true],
    ['views/event/EventDetails.js', true],
    // L'accueil EST l'origine : le repli suffit, un retour explicite serait un
    // aller-retour pour rien.
    ['views/home/HomeHub.js', false],
    // Les deux entrees volontaires du hub.
    ['views/profile/SubscriptionCompare.js', false],
    ['views/profile/SubscriptionOverview.js', false],
    // D89 — le sas d'inscription transporte DEUX destinations, et il le doit :
    // sans elles, la personne qui vient de remplir 4 a 8 ecrans repartirait a
    // l'accueil sans jamais finir son inscription.
    ['navigation/private/PrivateNavigator.js', true],
    // C-C — l'ecran 12 interrompt une tache (un enregistrement de compo type
    // refuse) : il transporte donc l'origine, comme la feuille qu'il remplace.
    ['views/subscription/CompositionPaywallScreen.js', true],
  ])('%s transporte une origine : %s', (fichier, transporteUneOrigine) => {
    expect(lireSource(fichier).includes('resumeRouteName')).toBe(transporteUneOrigine);
  });

  // D89 — la SECONDE moitie du colis, celle qui interdit le cul-de-sac. Une
  // origine sans destination de passage laisserait la personne enfermee sur le
  // paywall : c'est le seul risque grave de ce lot, il a donc son propre temoin.
  it('le sas d inscription nomme AUSSI la sortie de celui qui ne paie pas', () => {
    const source = lireSource('navigation/private/PrivateNavigator.js');

    // ESSAI (2026-08-28) — LA DESTINATION DE SORTIE A CHANGE, PAS LA REGLE.
    // Celui qui passe sans acheter va desormais sur la PAGE CADEAU au lieu
    // d'aller droit a la bienvenue : c'est exactement la population d'Adel
    // (« si le dirigeant ne s'est pas abonne… »). Ce que ce temoin garde reste
    // le meme — une sortie NOMMEE, donc pas de cul-de-sac — et la page cadeau
    // rend la main a `Welcome` dans tous les cas, y compris quand elle n'a rien
    // a offrir (entraineur, deja abonne, sans club).
    expect(source).toContain('skipRouteName: RouteNames.OnboardingGift');
    expect(source).toContain('resumeRouteName: RouteNames.Welcome');
  });

  // ESSAI (2026-08-28) — LE SAS A TROIS MARCHES, ET AUCUNE NE DOIT DISPARAITRE.
  // Les trois ecrans sont montes dans LA MEME pile : un nom nu ne se resout que
  // la (piege R06, deja paye et documente dans SubscriptionSuccess.js:95).
  it('les trois marches du sas sont montees dans la pile du tunnel', () => {
    const source = lireSource('navigation/private/PrivateNavigator.js');

    ['SubscriptionOffers', 'OnboardingGift', 'Welcome'].forEach((marche) => {
      expect(source).toContain(`name={RouteNames.${marche}}`);
    });
  });

  // ESSAI/E4 — « UN BOUTON, ET RIEN D'AUTRE » VAUT AUSSI POUR L'ENTETE.
  // `commonOptions` pose une fleche retour (`headerBackImage`) sur TOUS les
  // ecrans de cette pile. Sur la page cadeau elle ramenerait dans le tunnel
  // d'inscription qu'on vient de finir : c'est une seconde sortie, et Adel n'en
  // a demande aucune. Elle est donc explicitement retiree.
  it('la page cadeau n a pas de fleche retour', () => {
    const source = lireSource('navigation/private/PrivateNavigator.js');
    const debut = source.indexOf('name={RouteNames.OnboardingGift}');
    expect(debut).toBeGreaterThan(0);

    // Du nom de la route jusqu'a la fermeture de SA declaration, et pas plus
    // loin : une option lue chez le voisin ne prouverait rien.
    const blocCadeau = source.slice(debut, source.indexOf('/>', debut));

    expect(blocCadeau).toContain('headerLeft: () => null');
  });
});
