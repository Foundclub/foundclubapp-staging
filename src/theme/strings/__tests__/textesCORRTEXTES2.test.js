/* eslint-disable max-len -- les phrases de fr.js sont citées en entier */
import fs from 'fs';
import path from 'path';

import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

// CORR-TEXTES-2 (31/10/2026) — fin du point 24 de FEUILLE-REFERENCE-3010.md (A + C) :
// les « (s) » restants de fr.js reçoivent le nombre réel (_one / _other), plus les textes
// du tournoi relevés au point 133 et le « recherche » du point 31. Le témoin lit fr.js par la
// vraie résolution d'i18next, et la source des écrans pour vérifier que chacun passe `count`
// (sans `count`, i18next ne trouve plus la clef et affiche son chemin). ROUGE avant le lot.

const i18nextTemoin = require('i18next');

const i18n = i18nextTemoin.createInstance();
i18n.init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  lng: 'fr',
  resources: { fr: { translation: fr } },
});

const SRC = path.resolve(__dirname, '..', '..', '..');
const lire = (...morceaux) => fs.readFileSync(path.join(SRC, ...morceaux), 'utf8');

/**
 * Les textes d'un dictionnaire (feuilles), chemin pointé → valeur.
 * @param {Record<string, any>} noeud - Le dictionnaire.
 * @param {string[]} [prefixe] - Le chemin parcouru.
 * @returns {Array<[string, string]>} Les couples.
 */
const feuilles = (noeud, prefixe = []) => Object.entries(noeud).flatMap(([clef, valeur]) => {
  const chemin = prefixe.concat(clef);
  if (valeur !== null && typeof valeur === 'object') return feuilles(valeur, chemin);
  return [[chemin.join('.'), String(valeur)]];
});
const FR = new Map(feuilles(fr));
const EN = new Map(feuilles(en));

/**
 * Les arguments de chaque appel `t('<clef>', …)` d'une source, parenthèses équilibrées.
 * @param {string} source - Le code de l'écran.
 * @param {string} clef - La clef appelée.
 * @returns {string[]} Le texte de chaque appel.
 */
const appels = (source, clef) => {
  const trouves = [];
  let debut = source.indexOf(`'${clef}'`);
  while (debut !== -1) {
    let profondeur = 1;
    let fin = debut;
    while (profondeur > 0 && fin < source.length) {
      fin += 1;
      if (source[fin] === '(') profondeur += 1;
      if (source[fin] === ')') profondeur -= 1;
    }
    trouves.push(source.slice(debut, fin));
    debut = source.indexOf(`'${clef}'`, fin);
  }
  return trouves;
};

// Clef accordée → écran qui l'appelle (chemin depuis src/).
const ACCORDEES = {
  'adminClubDetail.itemsCount': 'views/admin/AdminClubDetail.js',
  'adminLeagueDisputes.count': 'views/admin/AdminLeagueDisputes.js',
  'adminNotificationsHealth.tokens.linkedAccounts': 'views/admin/AdminNotificationsHealth.js',
  'adminNotificationsHealth.tokens.subscribedLocal': 'views/admin/AdminNotificationsHealth.js',
  'adminNotificationsHealth.tokens.subscriptionsCount': 'views/admin/AdminNotificationsHealth.js',
  'adminNotificationsHealth.tokens.unsubscribedLocal': 'views/admin/AdminNotificationsHealth.js',
  'adminReports.shownCount': 'views/admin/AdminReports.js',
  'assignCoachTeams.errors.partial': 'views/club/AssignCoachTeams.js',
  'clubLicenseCampaignSettings.audience.teamsChecked': 'views/license/ClubLicenseCampaignSettings.js',
  'clubLicenseCampaignSettings.payment.filledCount': 'views/license/ClubLicenseCampaignSettings.js',
  'clubLicenseCampaignSettings.review.audience.players': 'views/license/ClubLicenseCampaignSettings.js',
  'clubLicenseCampaignSettings.review.documentCount': 'views/license/ClubLicenseCampaignSettings.js',
  'clubLicenseCampaignSettings.review.ruleCount': 'views/license/ClubLicenseCampaignSettings.js',
  'clubLicenses.installments.summary': 'views/license/ClubLicenses.js',
  'clubLicenses.memberList.inViewSummary': 'views/license/ClubLicenses.js',
  'clubLicenses.memberList.previewShort': 'views/license/ClubLicenses.js',
  'clubLicenses.memberList.previewSummary': 'views/license/ClubLicenses.js',
  'clubLicenses.memberList.shownSummary': 'views/license/ClubLicenses.js',
  'clubLicenses.overview.moreRules': 'views/license/ClubLicenses.js',
  'clubLicenses.payments.declarations': 'views/license/ClubLicenses.js',
  'clubLicenses.remindersTab.reminderCount': 'views/license/ClubLicenses.js',
  'clubLicenses.reminderTiming.maxCount': 'views/license/ClubLicenses.js',
  'clubLicenses.target.categories': 'views/license/ClubLicenses.js',
  'clubLicenses.target.levels': 'views/license/ClubLicenses.js',
  'clubLicenses.target.sections': 'views/license/ClubLicenses.js',
  'clubLicenses.target.teams': 'views/license/ClubLicenses.js',
  'cmLicensesDashboard.alerts.bulkCreate.message': 'views/license/CMLicensesDashboard.js',
  'cmLicensesDashboard.alerts.bulkCreated.message': 'views/license/CMLicensesDashboard.js',
  'cmLicensesDashboard.alerts.resyncDone.message': 'views/license/CMLicensesDashboard.js',
  'eventDetails.approved2': 'views/event/EventDetails.web.js',
  'eventDetails.approvedPending': 'views/event/EventDetails.js',
  'eventDetails.assignmentS': 'views/event/EventDetails.js',
  'eventDetails.externalSpotsSetting': 'views/event/EventDetails.web.js',
  'eventDetails.invitationS': 'views/event/EventDetails.web.js',
  'eventDetails.lastSavedExternalSpotsSetting': 'views/event/EventDetails.web.js',
  'eventDetails.openTraining.pendingSuffix': 'views/event/EventDetails.js',
  'eventDetails.openTraining.publicLine': 'views/event/EventDetails.js',
  'eventDetails.openTraining.seatsLeft': 'views/event/EventDetails.js',
  'eventDetails.requestS': 'views/event/EventDetails.web.js',
  'eventDetails.teamS': 'views/event/EventDetails.web.js',
  'eventDetectionSlots.remaining': 'views/event/components/EventDetectionSlots.js',
  'eventTasksSection.memberSReadyToBe': 'views/event/components/EventTasksSection.js',
  'eventWizard.partial.summary': 'views/event/wizard/EventWizardRecap.js',
  'friendlyMatchAdDetails.cancelWithApplications': 'views/friendlyMatch/FriendlyMatchAdDetails.js',
  'multiTeamCompositionBoard.branchCountPill': 'views/tactical_v2/MultiTeamCompositionBoard.js',
  'multiTeamCompositionBoard.convokedCount': 'views/tactical_v2/MultiTeamCompositionBoard.js',
  'multiTeamCompositionBoard.teamCountPill': 'views/tactical_v2/MultiTeamCompositionBoard.js',
  'nextMatchCard.quorum.missing': 'views/league/match/components/NextMatchCard.js',
  'recruitmentProfilesList.pills.filters': 'components/organisms/recruitmentProfilesList/RecruitmentProfilesList.js',
  'squadRequestsScreen.pendingCount': 'views/league/details/SquadRequestsScreen.js',
  'superAdminContentManager.bulkModal.description': 'views/admin/SuperAdminEntryList.js',
  'superAdminContentManager.feedback.bulkApplied': 'views/admin/SuperAdminEntryList.js',
  'superAdminContentManager.list.selectedEntries': 'views/admin/SuperAdminEntryList.js',
  'tournamentSettingsEdit.teamSAlreadyAcceptedWill': 'views/event/TournamentSettingsEdit.js',
};

describe('CORR-TEXTES-2 24 — plus aucun « (s) » : le nombre réel', () => {
  it('fr.js n’a plus de « (s) », « (x) », « (es) », « (aux) », sauf l’adresse http(s)://', () => {
    const restes = [...FR.entries()]
      .filter(([, texte]) => /\((s|x|es|aux)\)/.test(texte.replace('http(s)://', '')))
      .map(([clef, texte]) => `${clef} : ${texte}`);
    expect(restes).toEqual([]);
  });

  it('chaque clef accordée a ses deux formes, en français comme en anglais', () => {
    const fautes = Object.keys(ACCORDEES).filter((clef) => FR.has(clef) || EN.has(clef)
      || !FR.has(`${clef}_one`) || !FR.has(`${clef}_other`)
      || !EN.has(`${clef}_one`) || !EN.has(`${clef}_other`));
    expect(fautes).toEqual([]);
  });

  it('chaque écran passe `count` à chaque appel d’une clef accordée', () => {
    const fautes = Object.entries(ACCORDEES).flatMap(([clef, fichier]) => {
      const trouves = appels(lire(...fichier.split('/')), clef);
      if (!trouves.length) return [`${clef} : aucun appel dans ${fichier}`];
      return trouves.filter((appel) => !/\bcount\b/.test(appel)).map(() => `${clef} : sans count dans ${fichier}`);
    });
    expect(fautes).toEqual([]);
  });

  it('un, puis plusieurs : la phrase s’accorde', () => {
    expect(i18n.t('clubLicenses.target.teams', { count: 1, teams: 1 })).toBe('1 équipe');
    expect(i18n.t('clubLicenses.target.teams', { count: 3, teams: 3 })).toBe('3 équipes');
    expect(i18n.t('clubLicenses.target.levels', { count: 2, levels: 2 })).toBe('2 niveaux');
    expect(i18n.t('adminReports.shownCount', { count: 1 })).toBe('signalement affiché');
    expect(i18n.t('adminReports.shownCount', { count: 5 })).toBe('signalements affichés');
    expect(i18n.t('adminNotificationsHealth.tokens.subscribedLocal', { count: 2 })).toBe('comptes locaux abonnés sur cet appareil.');
    expect(i18n.t('eventDetails.openTraining.seatsLeft', { count: 1, left: 1, quota: 4 })).toBe('1 place externe restante sur 4');
    expect(i18n.t('tournamentSettingsEdit.teamSAlreadyAcceptedWill', { count: 1, teamsCount: 1 }))
      .toBe('1 équipe déjà acceptée deviendra non conforme avec ces règles. Son statut restera « acceptée », avec un avertissement visible.');
  });

  it('deux nombres dans une phrase : le premier s’accorde, les autres ne demandent aucun accord', () => {
    expect(i18n.t('cmLicensesDashboard.alerts.bulkCreated.message', { count: 1, created: 1, errors: 0, skipped: 2 }))
      .toBe('1 créée · ignorées : 2 · erreurs : 0.');
    expect(i18n.t('eventWizard.partial.summary', { count: 1, failed: 1, success: 3 })).toBe('3 succès / 1 échec.');
  });

  it('les parenthèses sans nombre sont reformulées', () => {
    expect(i18n.t('onboarding.position.title')).toBe('Quels postes ?');
    expect(i18n.t('teamSlotCreationForm.dayS')).toBe('Jours');
    expect(i18n.t('requestMappers.team.waitForManagers')).toBe('Ton équipe doit attendre la validation des dirigeants de ton club.');
    expect(FR.has('eventDetails.teamSPublished2')).toBe(false);
  });
});

describe('CORR-TEXTES-2 31 et 133 — accents du recrutement et du tournoi', () => {
  it('31 — « 1 profil coach recherché »', () => {
    expect(i18n.t('adWizardRecap.needs.coachSummary', { count: 1, role: 'Entraîneur' })).toBe('1 profil coach recherché pour le rôle Entraîneur.');
    expect(i18n.t('adWizardRecap.needs.coachSummary', { count: 2, role: 'Entraîneur' })).toBe('2 profils coach recherchés pour le rôle Entraîneur.');
  });

  it('133 — les textes du tournoi prennent leurs accents', () => {
    expect(i18n.t('tournamentCompetitionComponents.noGroupHasBeenDrawn')).toBe('Aucune poule n’a encore été tirée.');
    expect(i18n.t('tournamentCompetitionComponents.noKnockoutBracketGeneratedYet')).toBe('Aucun tableau final généré pour le moment.');
    expect(i18n.t('tournamentCompetitionComponents.noStandingsComputedYet')).toBe('Aucun classement calculé pour le moment.');
    expect(i18n.t('tournamentManagement.noMatchGeneratedYet')).toBe('Aucun match généré pour le moment.');
    expect(i18n.t('tournamentManagement.theTournamentIsNowClosed')).toBe('Le tournoi est maintenant fermé et les équipes éphémères sont archivées.');
    expect(i18n.t('tournamentManagement.thisActionArchivesAllTemporary')).toBe('Cette action archive toutes les équipes éphémères et gèle les modifications de la compétition.');
    expect(i18n.t('tournamentManagement.tournamentClosed')).toBe('Tournoi clôturé');
    expect(i18n.t('tournamentSettingsEdit.onlyTheTournamentCreatorCan')).toBe('Seul le créateur du tournoi peut modifier ces paramètres globaux.');
    expect(i18n.t('tournamentSettingsEdit.rosterImpactDetected')).toBe('Impact sur l’effectif détecté');
    expect(i18n.t('tournamentSettingsEdit.seedingRandom')).toBe('Aléatoire');
    expect(i18n.t('tournamentUtils.scheduled')).toBe('Programmé');
    const aleatoires = [...FR.entries()].filter(([, texte]) => /\bAleatoire\b/.test(texte)).map(([clef]) => clef);
    expect(aleatoires).toEqual([]);
  });
});
