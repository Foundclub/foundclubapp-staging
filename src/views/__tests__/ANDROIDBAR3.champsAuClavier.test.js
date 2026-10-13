import fs from 'fs';
import path from 'path';

// 🤖 ANDROIDBAR-3 — sur Android 15 et 16, la fenêtre ne rétrécit plus quand le clavier s'ouvre
// (bord à bord imposé). Un champ dans le bas d'un écran qui défile n'est protégé que si son
// `ScreenContainer` porte `keyboardAvoiding` : le contenu se raccourcit au-dessus du clavier, son
// ScrollView aussi, et Android y fait défiler le champ focalisé (ScrollView.onSizeChanged).
// Le mécanisme est prouvé par ScreenContainerANDROIDBAR3.clavier.test.js ; ce balayage prouve que
// chaque écran « probable » de la carte des appelants (.tmp/portes/ANDROIDBAR/appelants.md §B)
// le demande bien, sur le conteneur qui porte le champ.
//
// ⛔ `keyboardScroll` seul ne fait RIEN (le gabarit ne le lit que sous `keyboardAvoiding`), et un
// écran qui a DÉJÀ son ScrollView ne doit pas le demander : deux défilements verticaux.

const VUES = path.join(__dirname, '..');

/**
 * Les balises ouvrantes `<nom …>` d'un source, accolades et commentaires compris.
 * @param {string} source
 * @param {string} nom
 * @returns {string[]} le texte de chaque balise, commentaires `//` retirés
 */
const balises = (source, nom) => {
  const sortie = [];
  let debut = source.indexOf(`<${nom}`);
  while (debut !== -1) {
    if (/[\s>/]/.test(source[debut + nom.length + 1])) {
      let profondeur = 0;
      let i = debut + nom.length + 1;
      while (i < source.length) {
        const c = source[i];
        if (profondeur === 0 && c === '/' && source[i + 1] === '/') {
          i = source.indexOf('\n', i);
        } else {
          if (c === '{') profondeur += 1;
          if (c === '}') profondeur -= 1;
          if (c === '>' && profondeur === 0) break;
          i += 1;
        }
      }
      sortie.push(source.slice(debut, i + 1).replace(/\/\/[^\n]*/g, ''));
    }
    debut = source.indexOf(`<${nom}`, debut + 1);
  }
  return sortie;
};

// rang = quel `<ScreenContainer` du fichier porte le champ (les autres : chargement, erreur…).
const ECRANS = [
  {
    champ: 'TrainingTest.js:471 (+ TrainingAttemptCard.js:143)',
    fichier: 'training/TrainingTest.js',
    rang: 1,
  },
  {
    champ: 'TrainingGuided.js:300 (+ TrainingAttemptCard.js:143)',
    fichier: 'training/TrainingGuided.js',
    rang: 1,
  },
  {
    champ: 'ClubSlotRequest.js:836',
    fichier: 'collectivite/ClubSlotRequest.js',
    rang: 2,
  },
  {
    champ: 'CollectiviteActualiteForm.js:516',
    fichier: 'collectivite/CollectiviteActualiteForm.js',
    rang: 1,
  },
  {
    champ: 'CollectiviteFermeture.js:844',
    fichier: 'collectivite/CollectiviteFermeture.js',
    rang: 3,
  },
  {
    champ: 'EcrireAuxDirigeants.js:161',
    fichier: 'collectivite/CollectiviteClubs.js',
    rang: 1,
  },
  {
    champ: 'EcrireAuxDirigeants.js:161',
    fichier: 'collectivite/CollectiviteClubDetails.js',
    rang: 1,
  },
  {
    champ: 'EventParticipants.js:1714',
    fichier: 'event/EventDetails.js',
    rang: 1,
  },
  {
    champ: 'EventFilters.js:727 (ChoixDuSport)',
    fichier: 'event/EventFilters.js',
    rang: 1,
  },
  {
    champ: 'TournamentMatchDetails.js:396',
    fichier: 'event/TournamentMatchDetails.js',
    rang: 1,
  },
  {
    champ: 'TournamentSettingsEdit.js:717',
    fichier: 'event/TournamentSettingsEdit.js',
    rang: 1,
  },
  {
    champ: 'TournamentTeamDetails.js:858',
    fichier: 'event/TournamentTeamDetails.js',
    rang: 1,
  },
  {
    champ: 'EndMatchScreen.js:1619',
    fichier: 'league/match/EndMatchScreen.js',
    rang: 1,
  },
  {
    champ: 'CMLicensesDashboard.js:591',
    fichier: 'license/CMLicensesDashboard.js',
    rang: 1,
  },
  {
    champ: 'MatchStatsEditor.js:1122 (+ FeuilleDeMatchBlocs.js:131)',
    fichier: 'matchStats/MatchStatsEditor.js',
    rang: 1,
  },
  {
    champ: 'MercatoFilters.js:621',
    fichier: 'mercato/MercatoFilters.js',
    rang: 1,
  },
  {
    champ: 'SubscriptionOffers.js:1686',
    fichier: 'profile/SubscriptionOffers.js',
    rang: 1,
  },
  {
    champ: 'RecruitmentAdEdit.js:594',
    fichier: 'recruitment/RecruitmentAdEdit.js',
    rang: 4,
  },
  {
    champ: 'ReservationFilters.js:252',
    fichier: 'reservation/ReservationFilters.js',
    rang: 1,
  },
  {
    champ: 'ClubFilters.js:336 (ChoixDuSport)',
    fichier: 'club/ClubFilters.js',
    rang: 1,
  },
  // 🤖 ANDROIDBAR-5 — la console interne (appelants.md §B, « Console interne (14) »).
  // OffreFoundclubClub.js:418 n'y est pas : son champ vit dans une ConsoleSheet (<Modal>),
  // pas sous un ScreenContainer.
  { champ: 'AdminClaimDetail.js:395', fichier: 'admin/AdminClaimDetail.js', rang: 1 },
  { champ: 'AdminClubForm.js:622', fichier: 'admin/AdminClubForm.js', rang: 1 },
  {
    champ: 'AdminCollectiviteDetail.js:662 (CollectiviteTargetSearch)',
    fichier: 'admin/AdminCollectiviteDetail.js',
    rang: 1,
  },
  { champ: 'AdminCollectiviteForm.js:419', fichier: 'admin/AdminCollectiviteForm.js', rang: 1 },
  { champ: 'AdminLeagueDisputes.js:243', fichier: 'admin/AdminLeagueDisputes.js', rang: 1 },
  { champ: 'AdminPopupCampaignForm.js:484', fichier: 'admin/AdminPopupCampaignForm.js', rang: 1 },
  { champ: 'AdminRevenue.js:786', fichier: 'admin/AdminRevenue.js', rang: 1 },
].map((ecran) => ({
  ...ecran,
  source: fs.readFileSync(path.join(VUES, ecran.fichier), 'utf8'),
}));

describe('ANDROIDBAR-3 — les champs « probables » restent au-dessus du clavier', () => {
  it('le balayage lit bien les 27 écrans (20 côté utilisateurs + 7 de la console)', () => {
    // Témoin anti-faux-vert : un balayage qui ne lit rien passe au vert.
    expect(ECRANS.filter(({ source }) => source.includes('<ScreenContainer'))).toHaveLength(27);
  });

  it.each(ECRANS)('$fichier ($champ) : le conteneur évite le clavier', ({ rang, source }) => {
    const conteneur = balises(source, 'ScreenContainer')[rang - 1];

    expect(conteneur).toMatch(/\skeyboardAvoiding[\s>]/);
  });

  it.each(ECRANS)('$fichier : jamais un 2ᵉ défilement autour du sien', ({ rang, source }) => {
    const conteneur = balises(source, 'ScreenContainer')[rang - 1];
    const aSonDefilement = /<(ScrollView|FlatList|FlashList|SectionList)[\s>]/.test(source);

    if (aSonDefilement) expect(conteneur).not.toMatch(/\bkeyboardScroll\b/);
    expect(aSonDefilement).toBe(true);
  });

  it.each([
    'event/TournamentMatchDetails.js',
    'event/TournamentSettingsEdit.js',
  ])('%s : l enveloppe de données laisse le défilement se raccourcir (flex 1)', (fichier) => {
    const { source } = ECRANS.find((ecran) => ecran.fichier === fichier) || { source: '' };

    // Sans hauteur bornée, le ScrollView prend la hauteur de son contenu : rien ne se raccourcit
    // au-dessus du clavier (et la page ne défile pas). Même réglage que TournamentTeamDetails.
    expect(balises(source, 'WithDataWrapper')[0]).toMatch(/wrapperStyle=\{\{ flex: 1 \}\}/);
  });
});
