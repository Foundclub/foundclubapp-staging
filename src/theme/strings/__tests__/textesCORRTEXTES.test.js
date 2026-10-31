/* eslint-disable max-len -- les phrases de fr.js sont citées en entier */
import fs from 'fs';
import path from 'path';

import fr from '@/theme/strings/translations/fr';

// CORR-TEXTES (30/10/2026) — thème C de la recette du site, décisions d'Adel figées dans
// FEUILLE-REFERENCE-3010.md (points 23 à 39, sauf 33). Ce témoin lit fr.js par la vraie
// résolution d'i18next (pluriels compris) et, pour ce qui vit dans le code, la source des
// écrans. Aucune clef retirée sans ses deux formes _one / _other. ROUGE avant le lot.

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
 * Les textes de fr.js (feuilles), chemin pointé → valeur.
 * @param {Record<string, any>} noeud - Le dictionnaire.
 * @param {string[]} [prefixe] - Le chemin parcouru.
 * @returns {Array<[string, string]>} Les couples.
 */
const feuilles = (noeud, prefixe = []) => Object.entries(noeud).flatMap(([clef, valeur]) => {
  const chemin = prefixe.concat(clef);
  if (valeur !== null && typeof valeur === 'object') return feuilles(valeur, chemin);
  return [[chemin.join('.'), String(valeur)]];
});
const TEXTES = feuilles(fr);

describe('CORR-TEXTES 23 — les erreurs de Firebase se disent en français', () => {
  it('un code faux, un envoi impossible : une phrase qui dit quoi faire', () => {
    expect(i18n.t('APIerrors.auth/invalid-verification-code')).toBe('Code incorrect. Vérifie le SMS ou renvoie un code.');
    expect(i18n.t('APIerrors.auth/billing-not-enabled')).toBe('Le code ne peut pas être envoyé pour le moment. Réessaie dans quelques minutes.');
    expect(i18n.t('APIerrors.auth/too-many-requests')).toBe('Trop d’essais. Patiente quelques minutes avant de réessayer.');
    expect(i18n.t('APIerrors.OTP_ERROR')).not.toMatch(/OTP/);
  });

  it('les écrans de connexion ne recopient plus error.message', () => {
    ['Login.js', 'Register.js'].forEach((ecran) => {
      const source = lire('views', ecran);
      expect(source).not.toContain('loginMutation.error?.message');
      expect(source).toContain("getErrorMessage(authError, 'OTP_ERROR')");
    });
  });
});

describe('CORR-TEXTES 24 — accents, apostrophes, pluriels, anglais', () => {
  it('plus aucune apostrophe manquante dans fr.js (« l équipe », « n a »)', () => {
    const elision = /(^|[\s(«])(?:[lLdDjJnNsScCmMtT]|[Qq]u) (?=[aeiouyhéèêàâîôûAEIOUYHÉÈÊÀÂÎÔÛ])/u;
    const unite = /\}\} [jsh] |\d [jsh] /u;
    const fautes = TEXTES.filter(([, texte]) => elision.test(texte.replace(/\{\{[^}]*\}\}/g, '0')) && !unite.test(texte))
      .map(([clef, texte]) => `${clef} : ${texte}`);
    expect(fautes).toEqual([]);
  });

  it('les textes cités par la recette sont corrigés', () => {
    expect(i18n.t('eventWizard.steps.opponent.inviteTitle')).toBe('Inviter l’équipe adverse sur FoundClub');
    expect(i18n.t('adminUserList.sortHint')).toBe('Trier par date d’inscription');
    expect(i18n.t('tournamentSettingsEdit.teamsAndEligibility')).toBe('Équipes et éligibilité');
    expect(i18n.t('recruitmentAdDetails.coachProfile.availability')).toBe('Disponibilités');
    expect(i18n.t('adWizardRecap.needs.titleCoach')).toBe('Rôle recherché');
    expect(i18n.t('eventWizardTournamentStructure.automaticShuffleOfTheAccepted')).toBe('Mélange automatique des équipes acceptées.');
  });

  it('« Poule Poule A » : le libellé du serveur dit déjà « Poule A »', () => {
    expect(i18n.t('tournamentCompetitionComponents.groupLabel', { label: 'Poule A' })).toBe('Poule A');
    expect(i18n.t('tournamentMatchDetails.groupLabel', { label: 'Poule A' })).toBe('Poule A');
  });

  it('la détection accorde : « 1 membre de U11 Tunnel forme une équipe »', () => {
    const o = { teamName: 'U11 Tunnel' };
    expect(i18n.t('detection.squad.preview.grouped', { ...o, count: 1 })).toBe('1 membre de U11 Tunnel forme une équipe.');
    expect(i18n.t('detection.squad.preview.grouped', { ...o, count: 4 })).toBe('4 membres de U11 Tunnel forment une équipe.');
    expect(i18n.t('detection.squad.checkIn.subtitle', { count: 1 })).not.toMatch(/rarement 1/);
    expect(i18n.t('detection.squad.checkIn.subtitle', { count: 8 })).toBe('Sur 8 inscrits, rarement tous se présentent. Générer avant le pointage produit des équipes fausses.');
    expect(i18n.t('detection.teams.manual.subtitle', { count: 1 })).toBe('Détection · 1 présent');
    expect(i18n.t('detection.teams.auto.preview.text', { count: 1 })).toBe('1 équipe');
  });

  it('le planning accorde ses deux nombres : « 3 événements sur 1 jour »', () => {
    expect(`${i18n.t('planningWeekTimelineViewV2.summary', { count: 3 })} ${i18n.t('planningWeekTimelineViewV2.summaryDays', { count: 1 })}`)
      .toBe('3 événements sur 1 jour');
  });

  it('les « (s) » qui comptent {{count}} sont accordés', () => {
    expect(i18n.t('eventWizard.recap.invitesCount', { count: 1 })).toBe('1 équipe invitée');
    expect(i18n.t('eventWizard.recap.invitesCount', { count: 2 })).toBe('2 équipes invitées');
    expect(i18n.t('collectiviteClubs.join.capacity', { count: 1, nombre: 1 })).toBe('1 équipe à la fois');
    const restes = TEXTES.filter(([, texte]) => /\{\{count\}\}/.test(texte) && /\((s|x|es)\)/.test(texte));
    expect(restes).toEqual([]);
  });

  it('le tournoi affiche la phrase du serveur, jamais « Error drawing tournament groups: … »', () => {
    // 4- B du chef (30/10) : `details.error` porte la phrase sans le préfixe technique ;
    // le site reste propre même si le serveur (0b2fb329) part plus tard.
    const source = lire('views', 'event', 'TournamentManagement.js');
    expect(source).not.toMatch(/(?<!details\?\.error \|\| )mutationError\?\.message \|\|/);
    expect(source.match(/mutationError\?\.details\?\.error \|\| mutationError\?\.message \|\|/g)).toHaveLength(7);
  });

  it('les dates écrites dans le code disent « à », plus « a »', () => {
    expect(lire('views', 'notification', 'NotificationDetails.js')).not.toContain("'a' HH");
    expect(lire('views', 'league', 'match', 'LeagueMatchDetails.js')).not.toContain("'a' HH");
    expect(lire('views', 'league', 'match', 'PastMatchDetails.js')).not.toContain("'a' HH");
    expect(lire('utils', 'date.js')).not.toMatch(/\} a \$\{hours\}/);
  });
});

describe('CORR-TEXTES 25 — un refus n’est pas une panne, un profil effacé le dit', () => {
  it('les textes existent', () => {
    expect(i18n.t('recrutementListContent.refused.title')).toBe('Cette page n’est pas ouverte à ton profil.');
    expect(i18n.t('userDetails.gone.title')).toBe('Ce profil n’existe plus.');
  });

  it('les écrans lisent le statut 403 / 404', () => {
    expect(lire('components', 'organisms', 'recrutementListContent', 'RecrutementListContent.js')).toContain('getErrorStatus(error) === 403');
    expect(lire('views', 'profile', 'UserDetails.js')).toContain('getErrorStatus(fetchedUserError) === 404');
  });
});

describe('CORR-TEXTES 26 à 39 — un point, une preuve', () => {
  it('26 — sur le site, « Demande envoyée » est un bandeau, plus une boîte grise', () => {
    expect(lire('views', 'club', 'ClubDetails.js')).toMatch(/Platform\.OS === 'web'\) \{\n\s*showBanner\(/);
  });

  it('27 — pas de badge d’offre sur un club que la Ville paie, et « Offert par … » dans le parcours', () => {
    expect(lire('views', 'home', 'HomeHub.js')).toMatch(/teamCardPremiumScope = \(clubCouvertParLaVille/);
    expect(i18n.t('subscriptionQuotaBanner.covered.offeredBy', { coveredThing: 'tout le club', who: 'la Ville de Marseille' }))
      .toBe('Offert par la Ville de Marseille pour tout le club.');
  });

  it('28 — la liste des équipes invitées n’est plus rendue deux fois sur le site', () => {
    expect(lire('views', 'event', 'EventEdit.web.js')).not.toContain('<select\n                      multiple');
  });

  it('29 — le récapitulatif dit le nom du terrain, l’adresse en petit dessous', () => {
    expect(lire('components', 'organisms', 'facilitySelector', 'FacilitySelector.js')).toContain('name: String(selectedFacility.name');
    expect(lire('views', 'event', 'wizard', 'EventWizardRecap.js')).toContain('recap-adresse-du-terrain');
  });

  it('31 — le rôle par son libellé, certifications et disponibilités au récapitulatif', () => {
    expect(lire('views', 'recruitment', 'wizard', 'AdWizardDescription.js')).toContain('getCoachRoleLabel(state.coachRole, state.coachRoleOther)');
    const recap = lire('views', 'recruitment', 'wizard', 'AdWizardRecap.js');
    expect(recap).toContain('ad-recap-certifications');
    expect(recap).toContain('ad-recap-disponibilites');
  });

  it('32 — une annonce annulée ne dit plus que le secteur la voit', () => {
    expect(i18n.t('friendlyMatchAdDetails.cancelledNobodySees')).toBe('Annonce annulée, plus personne ne la voit.');
    expect(lire('views', 'friendlyMatch', 'FriendlyMatchAdDetails.js')).toContain("applications.length === 0 && ad.status === 'open'");
  });

  it('34 — le coach lit « rien à suivre », plus un bandeau seul', () => {
    expect(i18n.t('clubLicenses.emptyStates.coachTitle')).toBe('Aucune cotisation à suivre pour tes équipes');
  });

  it('35 — tutoiement partout', () => {
    expect(i18n.t('assignCoachTeams.header.hint')).toBe('Coche une ou plusieurs équipes, puis valide.');
  });

  it('36 — le compteur de « modifier une annonce » prend le registre sombre du thème', () => {
    expect(lire('views', 'recruitment', 'RecruitmentAdEdit.js')).toContain('tone="tunnel"');
  });

  it('37 — « Supprimer ton compte ? » dit ce qui part et ce qui reste', () => {
    const texte = i18n.t('profile.alerts.deleteAlert.consequences');
    expect(texte).toContain('Ce qui part : ton nom, ton numéro, ta photo');
    expect(texte).toContain('Ton club n’est pas supprimé.');
  });

  it('39 — l’inscription d’un mineur ne dit plus que le site est fermé au parent', () => {
    expect(i18n.t('userParentalDeclaration.parentLink.web')).not.toContain('pas encore possible sur le site');
    expect(i18n.t('parentAccountRequired.steps')).toContain('Il crée son compte FoundClub (site ou application)');
  });

  it('titre de la barre fine : court, il tient à 390 px', () => {
    expect(i18n.t('profile.titles.edit')).toBe('Mes informations');
  });
});
