const fs = require('fs');
const path = require('path');

// S06 — LE BANDEAU DE L'ACCUEIL MENE A L'EVENEMENT, PAS AU PLANNING.
//
// Constat d'Adel en recette de la `2.6.19` : « dans le bandeau, quand on clique
// dessus, ça nous renvoie sur le PLANNING alors que ça devrait nous renvoyer sur
// les détails de l'événement. »
//
// 🔬 OU C'ETAIT, ET CE QUE LA MESURE A CONTREDIT. Le point 32 de la recette parle
// du rappel de compo pose sur la page d'un match ; ce n'est PAS celui-la. Ce
// rappel mene deja au bon endroit, et son propre filet le prouve
// (`EventDetailsCompoReminder.test.js` : « il mene a la composition QUI EXISTE
// DEJA »). Le bandeau qui emmenait ailleurs est celui de L'ACCUEIL — le bloc
// « Aujourd'hui » du dirigeant, que les tests de ce dossier appellent deja
// `bandeau` (`compteursAccueil.test.js`). Sa 3e ligne NOMME le prochain
// evenement, avec son heure… et son `onPress` etait `handleOpenPlanning`, donc
// l'onglet du planning. L'identifiant de l'evenement etait pourtant deja en main
// (`homeCounters.js:36` : `prochainEvenement` porte `{ id, label, startsAt }`).
//
// 🧩 ET LE DEFAUT ETAIT DE FAMILLE, pas isole (§1 bis — la cause racine). Les
// deux autres variantes du meme bandeau (« Ouvrir la compo » du coach, et
// « Présent »/« Absent » du joueur) visaient bien l'evenement, mais par
// `navigate(EventDetails, …)` — or `EventDetails` n'est pas une route de la
// barre d'onglets : il vit dans `EventStack`. Les six autres appelants de l'app
// passent tous par `navigate(EventStack, { screen: EventDetails, params })`
// (`EventListContent`, `PersonalPlanningContainer`, `CMPlanningContent`,
// `FeaturedEvents`, `ReservationListContent`, `EventMessageBubble`).
// ⇒ trois endroits qui devaient ouvrir un evenement, trois ecritures
//   differentes, dont une fausse et deux fragiles. Le lot les ramene a UNE.
//
// Le controle est fait sur la SOURCE, pour la meme raison que ses quatre voisins
// de ce dossier : HomeHub fait plus de 2 600 lignes et depend d'une vingtaine de
// contextes React (`accueilParRole.test.js:10`, `compteursAccueil.test.js:27`).

const SOURCE = fs.readFileSync(path.resolve(__dirname, '..', 'HomeHub.js'), 'utf8');

/**
 * Le nombre d'occurrences d'un motif dans un texte.
 * @param {string} texte - Le texte a fouiller.
 * @param {string} motif - Le motif cherche.
 * @returns {number} Le compte.
 */
const compter = (texte, motif) => texte.split(motif).length - 1;

/**
 * Le corps du memo qui fabrique le bandeau, decoupe jusqu'a son tableau de
 * dependances. LEVE si le repere a disparu — un renommage rend ce fichier ROUGE
 * plutot que vert par accident.
 * @returns {string} Le corps du memo `headBanner`.
 */
const corpsDuBandeau = () => {
  const debut = SOURCE.indexOf('const headBanner = useMemo(');
  if (debut === -1) throw new Error("HomeHub n'a plus de memo « headBanner »");
  const fin = SOURCE.indexOf('}, [', debut);
  if (fin === -1) throw new Error("Le memo « headBanner » n'a plus de tableau de dependances");
  return SOURCE.slice(debut, fin);
};

/**
 * Le bloc d'une ligne du bandeau, de sa clef a la clef suivante.
 * @param {string} clef - La clef de la ligne (ex. `prochainEvenement`).
 * @returns {string} Le fragment de source de cette ligne.
 */
const ligneDuBandeau = (clef) => {
  const bandeau = corpsDuBandeau();
  const debut = bandeau.indexOf(`${clef}: {`);
  if (debut === -1) throw new Error(`Le bandeau n'a plus de ligne « ${clef} »`);
  const suite = bandeau.indexOf('\n        },', debut);
  return bandeau.slice(debut, suite === -1 ? undefined : suite);
};

describe('S06 — le bandeau de l accueil mene a l evenement, jamais au planning', () => {
  it('temoin 5 — la ligne « prochain evenement » du dirigeant ouvre L EVENEMENT', () => {
    const ligne = ligneDuBandeau('prochainEvenement');

    // Le defaut, nomme : c'est cette fonction-la qui emmenait sur l'onglet.
    expect(ligne).not.toContain('handleOpenPlanning');
    expect(ligne).not.toContain('MyEventList');
    // Et la destination attendue, avec l'identifiant deja disponible.
    expect(ligne).toContain('handleOpenEvent');
    expect(ligne).toContain('prochainEvenement?.id');
  });

  it('temoin 5 bis — tout ce qui OUVRE un evenement passe par LE MEME chemin', () => {
    const bandeau = corpsDuBandeau();

    // Coach (« Ouvrir la compo ») et dirigeant (ligne « prochain evenement ») :
    // plus aucune route d'evenement ecrite a la main dans le bandeau. Les
    // navigations du super-admin (`openAdmin`) ne sont pas concernees : elles ne
    // visent pas un evenement.
    expect(compter(bandeau, 'RouteNames.EventDetails')).toBe(0);
    // ⚠️ CE COMPTE EST PASSE DE 4 A 2 LE 2026-08-17, ET C'EST VOULU (lot T02).
    // S06 avait ramene les TROIS variantes a une seule ecriture, dont les deux
    // boutons du joueur. T02 change leur INTENTION : « Présent » / « Absent »
    // repondent maintenant sur place et n'ouvrent plus rien (constat d'Adel :
    // « ça doit envoyer la réponse DIRECT »). Restent donc 1 pour le dirigeant et
    // 1 pour le coach — leurs boutons, eux, ouvrent toujours l'evenement, et
    // `reponseDepuisAccueil.test.js` (temoin 5) le verifie nommement.
    expect(compter(bandeau, 'handleOpenEvent(')).toBe(2);
  });

  it('temoin 5 ter — « ouvrir un evenement » emprunte le chemin que l app emploie deja', () => {
    const debut = SOURCE.indexOf('const handleOpenEvent = useCallback(');
    expect(debut).toBeGreaterThan(-1);
    const corps = SOURCE.slice(debut, SOURCE.indexOf('}, [', debut));

    // `EventDetails` n'est pas une route de la barre d'onglets : on passe par sa
    // pile, comme les six autres appelants de l'app.
    expect(corps).toContain('RouteNames.EventStack');
    expect(corps).toContain('RouteNames.EventDetails');
    expect(corps).toContain('eventId');
  });

  it('temoin 5 quater — aucun raccourci vers le planning ne subsiste dans le bandeau', () => {
    // `handleOpenPlanning` n'avait qu'UN seul lecteur : la ligne fautive. Il
    // disparait avec elle (suppression plutot qu'ajout). On mesure la
    // DECLARATION, pour que le commentaire qui explique le defaut puisse
    // continuer a le nommer.
    expect(SOURCE).not.toContain('const handleOpenPlanning');
    expect(corpsDuBandeau()).not.toContain('MyEventList');
  });
});
