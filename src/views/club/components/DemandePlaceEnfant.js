import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import WizardOptionCard from '@/components/molecules/wizardOptionCard/WizardOptionCard';
import { feedbackCardStyle } from '@/views/profile/coachFeedback/CoachFeedbackList';

import { pendingChildRequestKey } from '../clubDetailsActionMatrix';

const NOMBRE_D_ETAPES = 3;

/**
 * @typedef {import('../clubDetailsActionMatrix').EnfantDeLaFeuille} EnfantDeLaFeuille
 * @typedef {{ details: string, documentId: string, name: string }} EquipeDeLaFeuille
 * @typedef {{ enfant: EnfantDeLaFeuille, equipe: EquipeDeLaFeuille }} ChoixDeLaFeuille
 * @typedef {(choix: ChoixDeLaFeuille) => void} EnvoiDeLaFeuille
 */

/**
 * 👶 PAR-L4 (13/10, design parent E11 a E13, planche 5) — « DEMANDER UNE PLACE », EN TROIS TEMPS,
 * COMME UN GUICHET : pour quel enfant ? → quelle equipe ? → recapitulatif.
 *
 * Avant, la feuille choisissait l'enfant a la place du parent quand un seul etait admissible, ne
 * montrait pas les autres, posait l'equipe et l'envoi sur la meme ligne, et confirmait par une
 * alerte systeme (recette PAR-009 et PAR-005, 11/10). Ici :
 *   · TOUS les enfants sont montres ; celui qui ne peut pas est grise, avec SA raison ;
 *   · un seul enfant admissible, ou un enfant venu de sa fiche : il est coche, et on le DIT ;
 *   · l'enfant reste visible a l'etape de l'equipe (« Pour Anissa (11 ans) » · « Changer ») ;
 *   · une equipe deja demandee POUR CET ENFANT est grisee — jamais pour son frere ;
 *   · l'erreur du serveur s'affiche ici, au recapitulatif, et nomme l'enfant ; les choix restent.
 *
 * L'etat (etape, enfant, equipe) vit ICI : la fiche club remonte ce composant a chaque ouverture
 * (`key`), donc une feuille rouverte repart de l'etape 1. L'envoi, lui, reste a la fiche club,
 * qui tient la mutation.
 * @param {object} props - Les proprietes.
 * @param {string} props.clubName - Le club (recapitulatif).
 * @param {Set<string>} props.clesEnAttente - Les paires equipe + enfant deja demandees ici.
 * @param {EnfantDeLaFeuille[]} props.enfants - Tous les enfants, avec leur raison.
 * @param {string} [props.enfantDeLaFiche] - L'enfant venu de SA fiche (identifiant), ou rien.
 * @param {boolean} props.envoiEnCours - La demande part.
 * @param {EquipeDeLaFeuille[]} props.equipes - Les equipes du club, dans l'ordre de la fiche.
 * @param {string} [props.erreur] - Le refus du serveur, deja nomme.
 * @param {EnvoiDeLaFeuille} props.onEnvoyer - « Envoyer la demande ».
 * @returns {import('react').ReactElement} La feuille.
 */
function DemandePlaceEnfant({
  clesEnAttente,
  clubName,
  enfantDeLaFiche = '',
  enfants,
  envoiEnCours,
  equipes,
  erreur = '',
  onEnvoyer,
}) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts,
  } = useTheme();

  const admissibles = enfants.filter((enfant) => !enfant.reason);
  const venuDeSaFiche = admissibles.find((enfant) => enfant.documentId === enfantDeLaFiche);
  const seulAdmissible = admissibles.length === 1 ? admissibles[0] : null;
  const enfantDeDepart = venuDeSaFiche || seulAdmissible;

  const [etape, setEtape] = useState(1);
  const [enfantId, setEnfantId] = useState(enfantDeDepart?.documentId || '');
  const [equipeId, setEquipeId] = useState('');

  const enfant = admissibles.find((ligne) => ligne.documentId === enfantId) || null;
  const equipe = equipes.find((ligne) => ligne.documentId === equipeId) || null;
  const nomme = { firstname: enfant?.firstname || '', ...SANS_ECHAPPEMENT };

  const titres = {
    1: t('clubDetails.childInterest.stepChild', 'Pour quel enfant ?'),
    2: t('clubDetails.childInterest.stepTeam', 'Quelle équipe ?'),
    3: t('clubDetails.childInterest.stepRecap', 'Récapitulatif'),
  };

  /**
   * « Anissa · 11 ans », ou le prenom seul si l'age manque.
   * @param {EnfantDeLaFeuille} ligne - L'enfant.
   * @returns {string} Le titre de sa rangee.
   */
  const titreDeLEnfant = (ligne) => (ligne.age === null
    ? ligne.firstname
    : t('clubDetails.childInterest.childWithAge', {
      age: ligne.age,
      defaultValue: '{{firstname}} · {{age}} ans',
      firstname: ligne.firstname,
      ...SANS_ECHAPPEMENT,
    }));

  /**
   * Ce que la rangee d'un enfant dit de lui, ici.
   * @param {EnfantDeLaFeuille} ligne - L'enfant.
   * @returns {string} Sa situation, ou sa raison.
   */
  const situationDe = (ligne) => {
    const variables = { firstname: ligne.firstname, teamName: ligne.teamName, ...SANS_ECHAPPEMENT };
    if (ligne.reason === 'placed') {
      return t('clubDetails.childInterest.reasonPlaced', {
        defaultValue: 'Déjà dans {{teamName}}', ...variables,
      });
    }
    if (ligne.reason === 'teen') {
      return t('clubDetails.childInterest.reasonTeen', {
        defaultValue: 'À partir de 13 ans, {{firstname}} fait sa demande depuis son propre compte.',
        ...variables,
      });
    }
    if (ligne.reason === 'unknownAge') {
      return t(
        'clubDetails.childInterest.reasonUnknownAge',
        'Âge inconnu : complète sa date de naissance',
      );
    }
    if (ligne.pendingHereCount === 1) {
      return t('clubDetails.childInterest.pendingHereOne', '1 demande en attente ici');
    }
    if (ligne.pendingHereCount > 1) {
      return t('clubDetails.childInterest.pendingHereMany', {
        count: ligne.pendingHereCount,
        defaultValue: '{{count}} demandes en attente ici',
      });
    }
    return t('clubDetails.childInterest.noTeamYet', 'Pas encore d’équipe');
  };

  let noteDeDepart = '';
  if (venuDeSaFiche && enfantId === venuDeSaFiche.documentId) {
    noteDeDepart = t('clubDetails.childInterest.fromChildPage', {
      defaultValue: 'Tu viens de la fiche de {{firstname}} : son nom est déjà coché.',
      firstname: venuDeSaFiche.firstname,
      ...SANS_ECHAPPEMENT,
    });
  } else if (!venuDeSaFiche && seulAdmissible && enfantId === seulAdmissible.documentId) {
    noteDeDepart = t('clubDetails.childInterest.onlyOneEligible', {
      defaultValue: 'Choix fait pour toi : {{firstname}}, seul enfant qui peut demander'
        + ' une place ici.',
      firstname: seulAdmissible.firstname,
      ...SANS_ECHAPPEMENT,
    });
  }

  const pourLEnfant = enfant && enfant.age !== null
    ? t('clubDetails.childInterest.forChildWithAge', {
      age: enfant.age,
      defaultValue: 'Pour {{firstname}} ({{age}} ans)',
      ...nomme,
    })
    : t('clubDetails.childInterest.forChild', { defaultValue: 'Pour {{firstname}}', ...nomme });

  const ligneDuRecapitulatif = (libelle, valeur) => (
    <View style={{ gap: 2 }}>
      <Text style={[Fonts.p3, Fonts.neutral200]}>{libelle}</Text>
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{valeur}</Text>
    </View>
  );

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <Text accessibilityLiveRegion="polite" style={[Fonts.p3Bold, Fonts.neutral200]}>
          {t('eventWizard.common.stepCounter', {
            current: etape,
            defaultValue: 'Étape {{current}}/{{total}}',
            total: NOMBRE_D_ETAPES,
          })}
        </Text>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ max: NOMBRE_D_ETAPES, min: 1, now: etape }}
          style={{
            backgroundColor: withAlpha(Colors.primary500, 0.24),
            borderRadius: 2,
            height: 4,
          }}
        >
          <View
            style={{
              backgroundColor: Colors.primary500,
              borderRadius: 2,
              height: 4,
              width: `${(etape / NOMBRE_D_ETAPES) * 100}%`,
            }}
          />
        </View>
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
          {titres[etape]}
        </Text>
      </View>

      {etape === 1 ? (
        <View style={{ gap: 4 }}>
          {noteDeDepart ? (
            <Text style={[Fonts.p2, Fonts.primary200, { marginBottom: 8 }]}>{noteDeDepart}</Text>
          ) : null}
          {admissibles.length === 0 ? (
            <Text style={[Fonts.p2, Fonts.neutral200, { marginBottom: 8 }]}>
              {t(
                'clubDetails.childInterest.noneEligible',
                'Aucun de tes enfants ne peut demander une place ici pour le moment.',
              )}
            </Text>
          ) : null}
          {enfants.map((ligne) => (
            <WizardOptionCard
              accessibilityRole="radio"
              avatar={{ firstname: ligne.firstname, lastname: ligne.lastname }}
              disabled={Boolean(ligne.reason)}
              key={`enfant-${ligne.documentId}`}
              onPress={() => {
                if (ligne.reason) return;
                if (ligne.documentId !== enfantId) setEquipeId('');
                setEnfantId(ligne.documentId);
              }}
              selected={!ligne.reason && ligne.documentId === enfantId}
              subtitle={situationDe(ligne)}
              subtitleLines={3}
              testID={`demande-enfant-choix-${ligne.documentId}`}
              title={titreDeLEnfant(ligne)}
              titleLines={2}
            />
          ))}
          <Button
            disabled={!enfant}
            onPress={() => setEtape(2)}
            style={{ marginTop: 8 }}
            testID="demande-enfant-suivant"
            title={t('clubDetails.childInterest.chooseTeamAction', 'Choisir l’équipe')}
            variant="Primary"
          />
        </View>
      ) : null}

      {etape === 2 && enfant ? (
        <View style={{ gap: 4 }}>
          <View style={[Alignments.row, Alignments.alignCenter, { gap: 12, marginBottom: 8 }]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00, { flex: 1 }]}>{pourLEnfant}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setEtape(1)}
              style={[Alignments.justifyCenter, { minHeight: 44, minWidth: 44 }]}
              testID="demande-enfant-changer"
            >
              <Text style={[Fonts.p2Bold, Fonts.primary300]}>
                {t('clubDetails.childInterest.change', 'Changer')}
              </Text>
            </TouchableOpacity>
          </View>
          {equipes.map((ligne) => {
            const dejaDemandee = clesEnAttente.has(
              pendingChildRequestKey(ligne.documentId, enfant.documentId),
            );
            return (
              <WizardOptionCard
                accessibilityRole="radio"
                disabled={dejaDemandee}
                key={`equipe-${ligne.documentId}`}
                onPress={() => {
                  if (!dejaDemandee) setEquipeId(ligne.documentId);
                }}
                selected={!dejaDemandee && ligne.documentId === equipeId}
                subtitle={dejaDemandee
                  ? t('clubDetails.childInterest.teamAlreadyAsked', {
                    defaultValue: 'Demande déjà envoyée pour {{firstname}}',
                    ...nomme,
                  })
                  : ligne.details}
                subtitleLines={2}
                testID={`demande-enfant-equipe-${ligne.documentId}`}
                title={ligne.name}
                titleLines={2}
              />
            );
          })}
          <Button
            disabled={!equipe}
            onPress={() => setEtape(3)}
            style={{ marginTop: 8 }}
            testID="demande-enfant-suivant"
            title={t('clubDetails.childInterest.continueAction', 'Continuer')}
            variant="Primary"
          />
        </View>
      ) : null}

      {etape === 3 && enfant && equipe ? (
        <View style={{ gap: 16 }}>
          <View style={feedbackCardStyle(Colors, false)}>
            {ligneDuRecapitulatif(
              t('clubDetails.childInterest.recapChild', 'Enfant'),
              enfant.age === null
                ? `${enfant.firstname} ${enfant.lastname}`.trim()
                : t('clubDetails.childInterest.recapChildValue', {
                  age: enfant.age,
                  defaultValue: '{{name}}, {{age}} ans',
                  name: `${enfant.firstname} ${enfant.lastname}`.trim(),
                  ...SANS_ECHAPPEMENT,
                }),
            )}
            {ligneDuRecapitulatif(t('clubDetails.childInterest.recapTeam', 'Équipe'), equipe.name)}
            {ligneDuRecapitulatif(t('clubDetails.childInterest.recapClub', 'Club'), clubName)}
          </View>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('clubDetails.childInterest.confirmDescription', {
              defaultValue: 'Les responsables de {{teamName}} verront son prénom et son âge,'
                + ' et pourront accepter ou refuser.',
              teamName: equipe.name,
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
          {erreur ? (
            <Text
              accessibilityLiveRegion="assertive"
              accessibilityRole="alert"
              style={[Fonts.p2Bold, { color: Colors.error300 }]}
              testID="demande-enfant-erreur"
            >
              {erreur}
            </Text>
          ) : null}
          <View style={{ gap: 8 }}>
            <Button
              isLoading={envoiEnCours}
              onPress={() => onEnvoyer({ enfant, equipe })}
              testID="demande-enfant-envoyer"
              title={t('clubDetails.childInterest.sendRequestAction', 'Envoyer la demande')}
              variant="Primary"
            />
            <Button
              disabled={envoiEnCours}
              onPress={() => setEtape(2)}
              testID="demande-enfant-retour"
              title={t('common.back', 'Retour')}
              variant="Ghost"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default DemandePlaceEnfant;
