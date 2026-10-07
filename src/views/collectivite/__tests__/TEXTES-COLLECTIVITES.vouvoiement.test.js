import { readFileSync } from 'fs';
import { join } from 'path';

import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

// 🏛️ TEXTES-COLLECTIVITES (lot 1, 01/10/2026 — décision d'Adel « ton A ») : on VOUVOIE la
// mairie, on TUTOIE les clubs et les membres.
//
// Ce que ce témoin exige (ROUGE avant le lot) :
//   - toute clef lue par les trois écrans réservés au gestionnaire (accueil, demandes,
//     clubs) est sans tutoiement — la liste des clefs est RELUE dans le code des écrans,
//     pas recopiée ici : un texte ajouté demain est contrôlé sans qu'on y pense ;
//   - les écrans PARTAGÉS avec les clubs (liste et formulaire d'installation) lisent, en
//     mode mairie, des clefs À PART (`facilityForm.collectivite.*`), vouvoyées ;
//   - les refus du serveur que la mairie peut lire sont sans tutoiement ;
// et ce qu'il garde (VERT avant comme après) : les textes des CLUBS ne sont jamais
// vouvoyés par ricochet.

const SRC = join(__dirname, '..', '..', '..');

const lire = (/** @type {string} */ clef) => clef.split('.').reduce(
  // eslint-disable-next-line max-len
  (/** @type {any} */ noeud, part) => (noeud === null || noeud === undefined ? undefined : noeud[part]),
  fr,
);
const lireEn = (/** @type {string} */ clef) => clef.split('.').reduce(
  // eslint-disable-next-line max-len
  (/** @type {any} */ noeud, part) => (noeud === null || noeud === undefined ? undefined : noeud[part]),
  en,
);

// « tu », « ton », « ta », « tes », « toi », « te », « t' », et les impératifs en -e/-s de
// 2e personne que ces écrans emploient (« Écris », « Ajoute », « Sélectionne », « Réessaie »).
const TUTOIEMENT = new RegExp(
  // COLL-ACCUEIL (01/10) : « FoundClub vérifie » (3e personne, texte de la planche validée)
  // n'est pas un impératif ; « Vérifie la connexion » en reste un.
  // eslint-disable-next-line max-len
  '(^|[^\\p{L}])(tu|ton|ta|tes|toi|te|t[\'’]\\p{L}+|écris|ajoute|sélectionne|choisis|réessaie|(?<!FoundClub )vérifie|'
  + 'détache-le)(?=$|[^\\p{L}])',
  'iu',
);

const clefsDe = (/** @type {string} */ relatif) => {
  const source = readFileSync(join(SRC, relatif), 'utf8');
  return [...source.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)].map((m) => m[1]);
};

// Les trois écrans que SEUL un gestionnaire de mairie ouvre (garde serveur
// is-gestionnaire-collectivite) : chacune de leurs clefs est lue par la mairie.
const ECRANS_MAIRIE = [
  'views/collectivite/CollectiviteHome.js',
  'views/collectivite/CollectiviteRequests.js',
  'views/collectivite/CollectiviteClubs.js',
  // COLL-ACCUEIL (01/10) : la fenetre Accepter / Refuser, sortie de CollectiviteRequests et
  // partagee avec l accueil de la Ville. Ses clefs restent controlees ici.
  'views/collectivite/components/DecisionCreneauModal.js',
  // COLL-ACCUEIL (01/10) : l inscription de la mairie et l ecran « ou en est ma demande ».
  'views/collectivite/CollectiviteSignup.js',
  'views/collectivite/CollectiviteSignupStatus.js',
  // VILLE-INVITER-CLUB (07/10) : la recherche « Deja sur FoundClub », et « Demandes de
  // rattachement ».
  'views/collectivite/components/AjouterUnClub.js',
  'views/collectivite/components/DemandesDeRattachement.js',
];

// Les clefs que la mairie lit dans les écrans PARTAGÉS avec les clubs.
const CLEFS_MAIRIE_ECRANS_PARTAGES = [
  'facilityList.collectiviteEmpty',
  'facilityForm.collectivite.conflictModes.allow.description',
  'facilityForm.collectivite.conflictModes.pending.description',
  'facilityForm.collectivite.errors.addressGeocodeRequired',
  'facilityForm.collectivite.errors.planningColorInvalid',
  'facilityForm.collectivite.state.retryLater',
  'facilityForm.collectivite.validation.colorInvalid',
  'facilityForm.collectivite.validation.colorRequired',
];

// Les refus du serveur qu'un écran de la mairie peut afficher (getErrorMessage).
const REFUS_LUS_PAR_LA_MAIRIE = [
  'APIerrors.COLLECTIVITE_GESTIONNAIRE_REQUIRED',
  'APIerrors.COLLECTIVITE_INSTALLATION_NOT_FOUND',
  'APIerrors.COLLECTIVITE_INVALID_PAYLOAD',
  'APIerrors.FACILITY_OVERRIDE_CAPACITY_CHANGED',
  'APIerrors.FACILITY_OVERRIDE_OWNER_REQUIRED',
  // VILLE-INVITER-CLUB (07/10) : envoyer, relancer, juger une demande de rattachement.
  'APIerrors.COLLECTIVITE_ATTACH_REQUEST_PENDING',
  'APIerrors.COLLECTIVITE_CLUB_WITHOUT_LEADER',
  'APIerrors.COLLECTIVITE_DEMO_FORBIDDEN',
  'APIerrors.COLLECTIVITE_INVITATION_ANSWERED_BY_FOUNDCLUB',
  'APIerrors.COLLECTIVITE_INVITATION_DECIDED',
  'APIerrors.COLLECTIVITE_PROPOSAL_REMIND_TOO_SOON',
];

describe('TEXTES-COLLECTIVITES — la mairie est vouvoyée', () => {
  it('le détecteur VOIT le tutoiement (sinon tout ce qui suit serait vert à vide)', () => {
    expect('Écris le motif : le club le lira.').toMatch(TUTOIEMENT);
    expect('Ton message : {{message}}').toMatch(TUTOIEMENT);
    expect('Tu ne gères pas cette collectivité.').toMatch(TUTOIEMENT);
    // COLL-ACCUEIL (01/10) : avec « FoundClub » pour sujet, « vérifie » est une 3e personne.
    expect('Vérifie la connexion, puis réessaie.').toMatch(TUTOIEMENT);
    expect('Laquelle représentez-vous ? FoundClub vérifie, puis vous en confie la gestion.')
      .not.toMatch(TUTOIEMENT);
    expect('Le club reçoit ta réponse.').toMatch(TUTOIEMENT);
    expect('Écrivez le motif : le club le lira.').not.toMatch(TUTOIEMENT);
    expect('Votre message : {{message}}').not.toMatch(TUTOIEMENT);
  });

  it.each(ECRANS_MAIRIE)('%s : chaque clef lue est sans tutoiement', (ecran) => {
    const clefs = clefsDe(ecran);
    expect(clefs.length).toBeGreaterThan(0);
    const tutoyees = clefs
      .map((clef) => [clef, lire(clef)])
      .filter(([, texte]) => typeof texte === 'string' && TUTOIEMENT.test(texte));
    expect(tutoyees).toEqual([]);
  });

  // eslint-disable-next-line max-len
  it('écrans partagés avec les clubs : la mairie a ses clefs, vouvoyées, en français ET en anglais', () => {
    const fautes = CLEFS_MAIRIE_ECRANS_PARTAGES.flatMap((clef) => {
      const texte = lire(clef);
      if (typeof texte !== 'string') return [`${clef} : absente de fr.js`];
      if (typeof lireEn(clef) !== 'string') return [`${clef} : absente de en.js`];
      return TUTOIEMENT.test(texte) ? [`${clef} : ${texte}`] : [];
    });
    expect(fautes).toEqual([]);
  });

  it('les refus du serveur lus par la mairie sont sans tutoiement', () => {
    const tutoyes = REFUS_LUS_PAR_LA_MAIRIE
      .map((clef) => [clef, lire(clef)])
      .filter(([, texte]) => typeof texte !== 'string' || TUTOIEMENT.test(texte));
    expect(tutoyes).toEqual([]);
  });

  it('les phrases fausses relevées par la session des écrans ont disparu', () => {
    expect(lire('adminCollectivites.list.hint')).not.toMatch(/Activer offre/);
    expect(lire('facilityForm.collectivite.conflictModes.pending.description'))
      .not.toMatch(/dirigeant/);
    expect(lire('collectivite.home.subtitle')).not.toMatch(/de \{\{name\}\}/);
  });
});

describe('TEXTES-COLLECTIVITES — « offert » est réservé à l offre de la Ville (point 6)', () => {
  it('l essai s appelle « Essai Club » / « Essai Équipe », sans « offert »', () => {
    expect(lire('subscriptionOverview.trialPlans.club')).toBe('Essai Club');
    expect(lire('subscriptionOverview.trialPlans.team')).toBe('Essai Équipe');
    // eslint-disable-next-line max-len
    expect(lire('subscriptionOverview.trialBanner.title')).toBe('Essai {{scope}} · J-{{remainingDays}}');
    expect(lireEn('subscriptionOverview.trialPlans.club')).toBe('Club trial');
  });
});

describe('TEXTES-COLLECTIVITES — les clubs restent tutoyés (aucun ricochet)', () => {
  it.each([
    ['facilityList.empty.description', 'Ajoute les terrains, gymnases ou salles de ton club.'],
    // eslint-disable-next-line max-len
    ['facilityForm.errors.addressGeocodeRequired', 'Sélectionne une adresse géolocalisée dans la liste.'],
    // eslint-disable-next-line max-len
    ['facilityForm.conflictModes.pending.description', 'Le créneau passe en demande, un dirigeant valide avant confirmation.'],
    // eslint-disable-next-line max-len
    ['facilityForm.conflictModes.allow.description', 'Le créneau reste confirmé, les dirigeants sont notifiés.'],
    ['facilityForm.state.retryLater', 'Réessaie dans quelques instants.'],
    ['clubDetails.collectiviteOffer.banner', 'Offert par {{who}}'],
    // eslint-disable-next-line max-len
    ['profile.subscription.status.clubUnverified', 'Tes droits Club sont actifs. Ton club est en cours de certification par la plateforme.'],
  ])('%s garde son texte de club', (clef, texte) => {
    expect(lire(clef)).toBe(texte);
  });
});
