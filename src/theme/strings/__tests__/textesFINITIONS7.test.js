import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

import { POSITION_GROUPS_BY_SPORT } from '@/constants/positions';
import i18n from '@/theme/strings';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

// FINITIONS7 — POINT 3 (recette emulateur, tournee 8, 01/10, « 🟡 finitions ») : LES TEXTES.
//
// Releves a l ecran par T8 : « Refuse » (etat), « Aucune cotisation n est », « Interets »,
// « Cet evenement est deja passe », « Exterieur », « Defense », « ont repondu », les quatre
// textes de l assistant « Recruter » (« poste recherche », « dediee a », « les etapes, les
// libelles », « cible sportive recherchee », « qui evolue … ambiance serieuse »), « Envoyer un
// e-mail a » (lecteur d ecran), le message de capacite sans apostrophes — et le « Lu » ecrit
// EN DUR sous le doigt qui glisse une notification (F6-6).
//
// Chaque clef corrigee est RENDUE par le vrai i18next de l app. Les textes de secours du code
// (deuxieme argument de `t`, ou ecrits en dur) sont balayes : un ecran dont la clef manque ne
// doit pas ressortir l ancienne graphie.
// Ecrit ROUGE contre app `915ebc96`.

const RACINE_SRC = join(__dirname, '..', '..', '..');
const TRADUCTIONS = join('theme', 'strings', 'translations');

/**
 * Tous les fichiers .js de l app, hors temoins et hors traductions (lues par i18next).
 * @param {string} dossier - Le dossier a parcourir.
 * @returns {string[]} Les chemins.
 */
const sources = (dossier) => readdirSync(dossier).flatMap((nom) => {
  const chemin = join(dossier, nom);
  if (statSync(chemin).isDirectory()) {
    return nom === '__tests__' || chemin.endsWith(TRADUCTIONS) ? [] : sources(chemin);
  }
  return /\.js$/.test(nom) && !/\.test\.js$/.test(nom) ? [chemin] : [];
});

const fautifs = (/** @type {RegExp} */ motif) => sources(RACINE_SRC)
  .filter((chemin) => motif.test(readFileSync(chemin, 'utf8')))
  .map((chemin) => relative(RACINE_SRC, chemin).replace(/\\/g, '/'));

const CORRIGEES = [
  ['adminReports.filters.rejected', 'Refusés'],
  ['adminReports.status.rejected', 'Refusé'],
  ['eventTasksSection.declined', 'Refusé'],
  ['licenseDesignSystem.statusLabels.refused', 'Refusé'],
  ['recruitmentAdDetails.status.declined', 'Refusé'],
  ['eventDetails.declined', 'Refusée'],
  ['eventTeamAudiencesSection.declined', 'Refusée'],
  ['proposalMessageBubble.badge.declined', 'Refusée'],
  ['tournamentManagement.filterDeclined', 'Refusées'],
  ['myLicenses.empty.description', 'Aucune cotisation n’est encore rattachée à ton compte.'],
  ['requestsHub.filters.interest', 'Intérêts'],
  ['participationFlow.thisBookingIsAlreadyOver', 'Cette réservation est déjà passée.'],
  ['participationFlow.thisEventIsAlreadyOver', 'Cet événement est déjà passé.'],
  ['eventEdit.locationMode.external', 'Extérieur'],
  ['teamDetails.external.report.away', 'Extérieur'],
  ['adWizardAudienceType.players.description',
    'Publie une annonce par poste recherché, avec le volume de recrutement et les informations sportives de l’équipe.'],
  ['adWizardAudienceType.coach.description',
    'Publie une annonce dédiée à un rôle d’encadrement : entraîneur principal, adjoint, préparateur physique ou autre besoin staff.'],
  ['adWizardAudienceType.footnote',
    'Le tunnel adapte ensuite automatiquement les étapes, les libellés et l’affichage final de l’annonce.'],
  ['adWizardInfo.subtitle', 'Précise la cible sportive recherchée avant de passer au lieu de publication.'],
  ['adWizardDescription.need.placeholder',
    'Ex. Nous recherchons un gardien expérimenté pour notre équipe U20 qui évolue en régional. '
    + 'Entraînements les mardis et jeudis soir, ambiance sérieuse et bienveillante.'],
  ['eventEdit.thisSlotExceedsTheFacility',
    'Ce créneau dépasse la capacité de l’installation. L’événement restera en demande en attente '
    + 'jusqu’au traitement d’un dirigeant.'],
  ['eventEdit.thisSlotExceedsTheFacility2',
    'Ce créneau dépasse la capacité de l’installation, mais ce club est configuré en Autorise et notifier. '
    + 'L’événement restera confirmé et les dirigeants seront prévenus.'],
  ['notificationList.markReadSwipe', 'Lu'],
];

afterAll(async () => {
  await i18n.changeLanguage('fr');
});

describe('FINITIONS7 point 3 — les textes, en francais', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('fr');
  });

  test.each(CORRIGEES)('🚨 %s : « %s »', (clef, attendu) => {
    expect(i18n.t(clef)).toBe(attendu);
  });

  test('🚨 « joueurs ont répondu », chiffres interpoles', () => {
    expect(i18n.t('squadDetailsScreen.reports.responses', { eligible: 12, responded: 9 }))
      .toBe('9/12 joueurs ont répondu');
  });

  test('🚨 lecteur d ecran : « Envoyer un e-mail à », l adresse du club sortie TELLE QUELLE', () => {
    expect(i18n.t('clubDetails.a11y.emailClub', { email: 'contact/o\'neil@club.fr', ...SANS_ECHAPPEMENT }))
      .toBe('Envoyer un e-mail à contact/o\'neil@club.fr');
    // L ecran passe bien l option (sans elle, « / » ressort en « &#x2F; », lecon de COLL-C4A).
    const ecran = readFileSync(join(RACINE_SRC, 'views', 'club', 'ClubDetails.js'), 'utf8');
    const appel = ecran.slice(ecran.indexOf("t('clubDetails.a11y.emailClub', {"));
    expect(appel.slice(0, appel.indexOf('})}'))).toContain('...SANS_ECHAPPEMENT');
  });
});

describe('FINITIONS7 point 3 — l anglais garde la meme forme', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en');
  });

  test('« Lu » a son pendant anglais', () => {
    expect(i18n.t('notificationList.markReadSwipe')).toBe('Read');
  });
});

// ⚠️ « Refuse » et « Exterieur » ne sont cherches QUE comme texte de secours d un `t()` : trois
// endroits les ecrivent EN DUR hors de `t()` (`externalMatchDisplay.js`, `Conversation.web.js`,
// l etiquette morte de `ProposalMessageBubble.js`). Les accentuer les rendrait visibles au temoin
// `francais-en-dur` (il reconnait le francais a ses accents) et le ferait monter : ils restent pour
// un lot qui les passera par `t()`.
describe('FINITIONS7 point 3 — les textes de secours', () => {
  test.each([
    ['« Refuse » / « Refusee » / « Refuses » / « Refusees »', /t\(\s*'[^']+',\s*'Refus(e|ee|es|ees)'/],
    ['« Interets »', /'Interets'/],
    ['« Exterieur »', /t\(\s*'[^']+',\s*'Exterieur'/],
    ['« deja passe(e) »', /déjà passee?\./],
    ['« Aucune cotisation n est »', /Aucune cotisation n est/],
    ['« poste recherche, »', /poste recherche,/],
    ['« dédiée a un »', /dédiée a un/],
    ['« les etapes, les libelles »', /les etapes, les libelles/],
    ['« recherchee »', /cible sportive recherchee/],
    ['« qui evolue … serieuse »', /qui evolue|ambiance serieuse/],
    ['« Envoyer un e-mail a »', /Envoyer un e-mail a \{/],
    ['« capacité de l installation »', /capacité de l installation/],
    ['« ont repondu » (texte de l ecran)', /\{\{eligible\}\} joueurs ont repondu/],
    ['« Lu » ecrit en dur', />Lu<\/Text>/],
  ])('🚨 plus aucun fichier ne porte %s', (_nom, motif) => {
    expect(fautifs(motif)).toEqual([]);
  });

  // « Interieur » (basket) reste : sa ligne n a aucun autre accent, l accentuer ferait monter
  // `francais-en-dur` d une ligne. « Défense » et « Charnière » partagent la leur avec un poste
  // deja accentue (« Défenseur central », « Demi de mêlée ») : elles ne comptent pas en plus.
  test('🚨 les sections du choix de poste : « Défense », « Charnière »', () => {
    const libelles = Object.values(POSITION_GROUPS_BY_SPORT).flat().map((groupe) => groupe.label);
    expect(libelles).toEqual(expect.arrayContaining(['Défense', 'Charnière']));
    expect(libelles).not.toEqual(expect.arrayContaining(['Defense']));
    expect(libelles).not.toEqual(expect.arrayContaining(['Charniere']));
  });
});
