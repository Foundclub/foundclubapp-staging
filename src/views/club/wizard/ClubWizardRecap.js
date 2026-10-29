import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';

import {
  attachCreatedClubToProfile,
  getUserRoleKey,
  markOnboardingComplete,
} from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { lienDeLaVilleRetenu, oublierLienDeLaVille } from '@/domains/collectivite/lienDeLaVille';
import { emitGuidanceAction } from '@/domains/guidance/guidanceRuntime';
import { invalidateAfterAction } from '@/domains/refresh/afterAction';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import WizardOptionCard from '@/components/molecules/wizardOptionCard/WizardOptionCard';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { LigneDeChoix } from '@/components/organisms/choixDuSport/ChoixDuSport';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { cheminFicheAnnuaire } from '@/services/annuaire/slugAnnuaire';
import { createSelfOnboardClub } from '@/services/club/clubService';

import { buildPublicWebUrl, buildShareMessageWithUrl } from '@/utils/shareLinks';

// L'alias plateforme est « unknown » pour perfectionist mais « internal » pour import/order.
import SharePlatform from '@/platform/share';

// eslint-disable-next-line perfectionist/sort-imports
import { useClubWizard } from './ClubWizardContext';

const STEP_COUNT = 5;

// FINITIONS-VILLE — décision d'Adel « créateur C » (08/10) : qui dirige le club que crée un
// ENTRAÎNEUR. « Moi » le rend dirigeant (`alsoDirector`) ; sans dirigeant, personne n'a « Gérer
// mon club » et une Ville ne peut pas l'inviter.
const REPONSES_QUI_DIRIGE = Object.freeze(['moi', 'autre', 'inconnu']);

/**
 * Une ligne du récapitulatif du club.
 * @param {any} props
 * @returns {import('react').ReactElement}
 */
function RecapRow({ label, value }) {
  const { Alignments, Fonts, Spaces } = useTheme();
  return (
    <View style={[Alignments.row, Alignments.justifySpaceBetween, Spaces.marginBottom[12]]}>
      <Text style={[Fonts.p3, Fonts.neutral200]}>{label}</Text>
      <Text style={[Fonts.p3Bold, Fonts.neutral00, { flexShrink: 1, textAlign: 'right' }]}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Étape 5/5 — récapitulatif + création. Gère le 409 doublon (suggestions +
 * « créer quand même ») et la reprise du parcours selon le point d'entrée.
 * @param {any} props
 * @returns {import('react').ReactElement}
 */
function ClubWizardRecap({ navigation, route }) {
  const { t } = useTranslation();
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { dispatch, state } = useClubWizard();
  const {
    getNextOnboardingRoute,
    getPostOnboardingHomeRoute,
    refetchUserData,
    userData,
  } = useAuth();
  const queryClient = useQueryClient();
  const { data: activities } = useGetActivities();

  const entry = route?.params?.entry || 'search';
  const [isSubmitting, setIsSubmitting] = useState(false);
  // FINITIONS-VILLE (T19-bis, T20 P09) : le club est créé — le bouton ne se rallume plus jamais
  // (un second appui créait un second club pendant que le profil se relisait).
  const [cree, setCree] = useState(false);
  const [duplicates, setDuplicates] = useState(/** @type {any[]} */ ([]));
  // « créateur C » : la réponse est OBLIGATOIRE pour un entraîneur (un dirigeant l'est déjà).
  const roleDuCreateur = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const doitDireQuiDirige = roleDuCreateur === 'coach';
  const [quiDirige, setQuiDirige] = useState(/** @type {string | null} */ (null));

  const activityNames = useMemo(() => {
    const list = Array.isArray(activities) ? activities : [];
    const selected = Array.isArray(state.activityDocumentIds) ? state.activityDocumentIds : [];
    return list
      .filter((activity) => selected.includes(activity.documentId))
      .map((activity) => activity.name);
  }, [activities, state.activityDocumentIds]);

  const resumeAfterSuccess = async (
    createdClub,
    collectiviteInvitation = null,
    lienDeLaVille = null,
  ) => {
    dispatch({ type: 'RESET' });

    // Les invalidations, elles, ne s'attendent PAS : `invalidateQueries` marque
    // les requetes perimees de facon SYNCHRONE, et le `queryClient` est un
    // singleton qui survit a cet ecran. Attendre ne ferait que faire patienter
    // — decision mesuree au lot D19 (`EventWizardRecap.creation.test.js`).
    // U05 — la liste ecrite a la main (trois cles) est remplacee par la
    // declaration du module : creer un club change aussi la fiche du club, la
    // liste des equipes et le resume d'accueil.
    invalidateAfterAction(queryClient, 'createClub').catch(() => {});
    // Guide Entraîneur (TUTOE, « Je ne trouve pas mon club ») : le club existe.
    emitGuidanceAction('club.created');

    // T10 — MAIS LE PROFIL, SI : la navigation ne part plus devant lui.
    // `refetchUserData()` partait sans `await`, donc l'etape suivante se montait
    // sur l'ANCIEN profil — celui d'avant la creation. Or c'est le profil qui
    // decide quelles etapes du tunnel existent encore (`PrivateNavigator`), et
    // c'est lui que l'etape suivante lit. Elle annoncait le contraire de ce qui
    // venait de se passer. Un echec de rafraichissement ne doit pas retenir
    // quelqu'un dans un tunnel dont le club EST cree : on repart quand meme.
    if (typeof refetchUserData === 'function') {
      try {
        await refetchUserData();
      } catch {
        // Le club est cree : on continue, l'ecran suivant se rafraichira seul.
      }
    }

    // AA04 ② — ET LE PROFIL RELU NE CONNAIT TOUJOURS PAS LE CLUB. Le serveur a
    // bien affilie son createur (`club-self-onboard.ts`, etape 2b), mais il sert
    // `/firebase-auth/me` depuis un cache que la creation n'invalide pas
    // (`meProfileRuntimeCache` : 60 s de fraicheur, 4 min de sursis). Attendre
    // ne sert a rien — le cache ne bougera pas — et c'est ce trou de quelques
    // minutes qui produit les trois constats d'Adel : la fiche du club propose
    // « Je fais partie de ce club » a celui qui vient de le creer, et « creer
    // mon equipe » repond « il te faut d'abord un club ».
    //
    // On pose donc dans le cache de l'app ce que le serveur VIENT de faire.
    // `attachCreatedClubToProfile` refuse de toucher un profil qui a deja un
    // club : rien ne peut se substituer a un rattachement existant.
    // ⚠️ APRES le `refetch` ci-dessus, jamais avant : la reponse perimee
    // ecraserait la correction.
    queryClient.setQueriesData(
      { queryKey: ['get-me'] },
      (/** @type {any} */ previousProfile) => (
        attachCreatedClubToProfile(previousProfile, createdClub)
      ),
    );

    const clubDocumentId = createdClub?.documentId;

    if (entry === 'onboarding') {
      const parentNavigation = navigation.getParent?.() || navigation;
      const nextRoute = typeof getNextOnboardingRoute === 'function'
        ? getNextOnboardingRoute(RouteNames.UserAffiliationGuide)
        : null;
      if (nextRoute) {
        // T10 ① — L'ETAPE SUIVANTE DOIT SAVOIR DE QUEL CLUB ON PARLE.
        // `navigate(nextRoute)` ne transmettait RIEN : l'etape suivante devait
        // deviner « mon club » depuis le profil, et sa 3e devinette est la
        // demande d'adhesion `pending` — donc le club consulte pendant la
        // recherche. Constat d'Adel du 2026-08-17 : « ca m'a propose de
        // rejoindre une equipe DU PREMIER CLUB sur lequel j'avais clique ».
        parentNavigation.navigate(
          nextRoute,
          clubDocumentId ? { clubId: clubDocumentId } : undefined,
        );

        // T10 ② — ET LE TUNNEL QUITTE SA PILE, meme motif que la branche
        // voisine (D81) : les 5 etapes restaient empilees SOUS l'etape
        // suivante, donc un seul « Retour » reposait le doigt sur « Creer mon
        // club ». On vide la pile du club APRES le depart, sur la pile qu'on
        // possede — un `reset` sur la pile PARENTE depuis une sous-pile est
        // servi par la sous-pile et la renvoie a son ecran initial (mesure du
        // 2026-08-17, filet `clubWizardOnboardingAtterrissage`).
        // RWDIRIG (29/10) : seulement s'il y a VRAIMENT une sous-pile. Sur le site, l'adaptateur
        // est son propre parent et n'a qu'une adresse : ce reset remplaçait l'étape suivante
        // qu'on venait d'ouvrir par « Trouver mon club ».
        if (parentNavigation !== navigation) {
          navigation.reset({ index: 0, routes: [{ name: RouteNames.ClubList }] });
        }
        return;
      }
      markOnboardingComplete(userData?.documentId);
      parentNavigation.reset({
        index: 0,
        routes: [{ name: getPostOnboardingHomeRoute() }],
      });
      return;
    }

    // COLL-ACCUEIL-BIS (03/10, planche 38, ecran 5) — LE CLUB VENAIT DU LIEN D UNE VILLE : sa
    // demande de rattachement est partie toute seule (le serveur l a posee). Il le lit
    // (« Demande envoyee »), et la fiche du club reste dessous : « Retour » y mene.
    if (clubDocumentId && collectiviteInvitation?.status && lienDeLaVille) {
      const parentNavigation = navigation.getParent?.() || navigation;
      parentNavigation.navigate(RouteNames.CollectiviteJoinRequest, {
        resultat: { ...collectiviteInvitation, clubId: clubDocumentId },
        token: lienDeLaVille,
      });
      navigation.reset({
        index: 0,
        routes: [{ name: RouteNames.Club, params: { clubId: clubDocumentId } }],
      });
      return;
    }

    // D81 — LES 5 ETAPES QUITTENT LA PILE. `navigate` posait la fiche du club
    // PAR-DESSUS elles : un seul « Retour » ramenait sur le recapitulatif d'un
    // club deja cree, bouton « Creer mon club » sous le doigt. Le retour depuis
    // la fiche ressort maintenant du tunnel, la ou l'utilisateur etait avant
    // d'y entrer. Meme motif que `TeamWizardRecap` et `EventWizardRecap`.
    if (clubDocumentId) {
      navigation.reset({
        index: 0,
        routes: [{ name: RouteNames.Club, params: { clubId: clubDocumentId } }],
      });
      return;
    }

    // Club cree mais sans identifiant : on referme quand meme le tunnel.
    // `goBack` y revenait etape par etape, donc permettait de le creer deux fois.
    navigation.reset({ index: 0, routes: [{ name: RouteNames.ClubList }] });
  };

  const submit = async ({ forceCreate = false } = {}) => {
    if (cree || isSubmitting || (doitDireQuiDirige && !quiDirige)) return;
    const option = state.addressOption || {};
    const hasCoordinates = Number.isFinite(option?.lat) && Number.isFinite(option?.lng);
    if (!String(state.name || '').trim() || !hasCoordinates) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('clubWizard.recap.missing', 'Renseigne au moins le nom et l\'adresse du club.'),
      );
      return;
    }

    setIsSubmitting(true);
    // COLL-ACCUEIL-BIS (planche 38) : le lien de la Ville retenu (moins de 48 h) part avec le club.
    const lienDeLaVille = lienDeLaVilleRetenu();
    try {
      const result = await createSelfOnboardClub({
        activityDocumentIds: state.activityDocumentIds,
        addressDetails: option?.label,
        addressLabel: option?.label,
        alsoDirector: doitDireQuiDirige && quiDirige === 'moi',
        coordinates: { lat: option.lat, lng: option.lng },
        email: state.email,
        forceCreate,
        name: String(state.name).trim(),
        phoneNumber: state.phoneNumber,
        screen: 'club_wizard',
        ...(lienDeLaVille ? { collectiviteInvitationToken: lienDeLaVille } : {}),
      });

      if (result?.duplicate) {
        setDuplicates(Array.isArray(result.suggestions) ? result.suggestions : []);
        return;
      }
      // Le club est cree : le lien a servi, un second club ne repart pas vers la meme Ville.
      if (lienDeLaVille) oublierLienDeLaVille();
      setCree(true);

      const autreDirigeant = doitDireQuiDirige && quiDirige === 'autre';
      const nomDuClub = result?.club?.name || String(state.name).trim();
      const lienDuClub = buildPublicWebUrl({
        path: cheminFicheAnnuaire({ ...result?.club, name: nomDuClub }),
      });
      const inviterDirigeant = async () => {
        try {
          await SharePlatform.share({
            message: buildShareMessageWithUrl({
              intro: t(
                'clubWizard.recap.quiDirige.invitation',
                'Rejoins {{clubName}} sur FoundClub avec ton compte dirigeant. '
                  + 'Sur la fiche, touche « Je dirige ce club » pour demander sa gestion ; '
                  + 'FoundClub vérifiera ta demande.',
                { ...SANS_ECHAPPEMENT, clubName: nomDuClub },
              ),
              url: lienDuClub,
            }),
            title: nomDuClub,
            url: lienDuClub,
          });
        } catch (error) {
          if (error?.name === 'AbortError') return;
          Alert.alert(
            t('common.error', 'Erreur'),
            t(
              'clubWizard.recap.quiDirige.partageErreur',
              'Le partage a échoué. Tu peux partager la fiche du club plus tard.',
            ),
          );
        }
      };

      // FINITIONS-VILLE (T19-bis, T20 P09) : l'alerte INFORME, elle ne commande plus la suite. La
      // suite attendait son « OK » (sur le site, un `window.confirm` : « Annuler » laissait le
      // récapitulatif affiché, bouton rallumé) ; elle part maintenant, quoi qu'on réponde.
      Alert.alert(
        t('clubWizard.recap.successTitle', 'Club créé !'),
        // « créateur C » : un entraîneur ne peut pas nommer un dirigeant ; le dirigeant le demande
        // lui-même depuis la fiche du club (« Je dirige ce club »), l'équipe FoundClub valide.
        autreDirigeant
          ? t(
            'clubWizard.recap.quiDirige.autreSuite',
            'Ton club est en ligne. Invite son dirigeant à ouvrir sa fiche '
              + 'et à toucher « Je dirige ce club ». '
              + 'L’équipe FoundClub vérifiera sa demande.',
          )
          : t(
            'clubWizard.recap.successDescription',
            'Ton club est en ligne. Notre équipe le vérifiera prochainement.',
          ),
        autreDirigeant && lienDuClub ? [
          { style: 'cancel', text: t('clubWizard.recap.quiDirige.plusTard', 'Plus tard') },
          {
            onPress: inviterDirigeant,
            text: t('clubWizard.recap.quiDirige.inviter', 'Inviter le dirigeant'),
          },
        ] : [{ text: t('common.actions.ok', 'OK') }],
      );
      await resumeAfterSuccess(
        result?.club,
        result?.collectiviteInvitation,
        lienDeLaVille,
      );
    } catch (error) {
      Alert.alert(
        t('common.error', 'Erreur'),
        error?.message || t('clubWizard.recap.error', 'Impossible de créer le club.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasDuplicates = duplicates.length > 0;
  const recapAddressOption = state.addressOption || {};
  const canSubmit = Boolean(String(state.name || '').trim())
    && Number.isFinite(recapAddressOption?.lat)
    && Number.isFinite(recapAddressOption?.lng);

  return (
    <WizardStepLayout
      isNextDisabled={cree || (!hasDuplicates && !canSubmit) || (doitDireQuiDirige && !quiDirige)}
      isNextLoading={isSubmitting || cree}
      nextLabel={hasDuplicates
        ? t('clubWizard.recap.createAnyway', 'Créer quand même')
        : t('clubWizard.recap.create', 'Créer mon club')}
      onBack={() => navigation.goBack()}
      onClose={() => navigation.goBack()}
      onNext={() => submit({ forceCreate: hasDuplicates })}
      stepCount={STEP_COUNT}
      stepIndex={5}
      subtitle={t('clubWizard.recap.subtitle', 'Vérifie les informations avant de créer ton club.')}
      title={t('clubWizard.recap.title', 'Récapitulatif')}
    >
      <View
        style={[
          ApplicationStyle.card,
          Spaces.padding[16],
          {
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderColor: 'rgba(255,255,255,0.10)',
            borderRadius: 16,
            borderWidth: 1,
          },
        ]}
      >
        <RecapRow label={t('clubWizard.recap.name', 'Nom')} value={state.name || '—'} />
        <RecapRow
          label={t('clubWizard.recap.address', 'Adresse')}
          value={state.addressOption?.label || '—'}
        />
        <RecapRow
          label={t('clubWizard.recap.sports', 'Sports')}
          value={activityNames.length ? activityNames.join(', ') : '—'}
        />
        <RecapRow
          label={t('clubWizard.recap.email', 'Email')}
          value={state.email || '—'}
        />
        <RecapRow
          label={t('clubWizard.recap.phone', 'Téléphone')}
          value={state.phoneNumber || '—'}
        />
      </View>

      {doitDireQuiDirige ? (
        <View style={[Spaces.marginTop[24], { gap: 8 }]} testID="club-wizard-qui-dirige">
          <Text accessibilityRole="header" style={[Fonts.p1Bold, Fonts.neutral00]}>
            {t('clubWizard.recap.quiDirige.titre', 'Qui dirige ce club ?')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'clubWizard.recap.quiDirige.aide',
              'Sans dirigeant, personne ne gère le club et une Ville ne peut pas l’inviter.',
            )}
          </Text>
          {REPONSES_QUI_DIRIGE.map((cle) => {
            let libelle = t('clubWizard.recap.quiDirige.inconnu', 'Je ne sais pas encore');
            if (cle === 'moi') libelle = t('clubWizard.recap.quiDirige.moi', 'Moi');
            if (cle === 'autre') {
              libelle = t('clubWizard.recap.quiDirige.autre', 'Quelqu’un d’autre, je l’inviterai');
            }
            return (
              <LigneDeChoix
                coche={quiDirige === cle}
                key={cle}
                libelle={libelle}
                onPress={() => setQuiDirige(cle)}
              />
            );
          })}
        </View>
      ) : null}

      {hasDuplicates ? (
        <View style={[Spaces.marginTop[24]]}>
          <Text style={[Fonts.p3Bold, { color: Colors.error700 }, Spaces.marginBottom[8]]}>
            {t('clubWizard.recap.duplicateTitle', 'Un club très proche existe déjà')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginBottom[12]]}>
            {t(
              'clubWizard.recap.duplicateHint',
              'Rejoins-le s\'il s\'agit du tien, ou touche « Créer quand même » '
                + 'si c\'est un autre club.',
            )}
          </Text>
          {duplicates.map((club) => (
            <View key={club.documentId} style={[Spaces.marginBottom[8]]}>
              <WizardOptionCard
                compact
                onPress={() => navigation.navigate(RouteNames.Club, {
                  clubId: club.documentId,
                  ...(entry === 'onboarding' ? { fromOnboardingAffiliation: true } : {}),
                })}
                subtitle={club?.addressDetails || undefined}
                title={club?.name}
              />
            </View>
          ))}
        </View>
      ) : null}
    </WizardStepLayout>
  );
}

export default ClubWizardRecap;
