import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';

import { markOnboardingComplete } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import WizardOptionCard from '@/components/molecules/wizardOptionCard/WizardOptionCard';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { createSelfOnboardClub } from '@/services/club/clubService';

import { useClubWizard } from './ClubWizardContext';

const STEP_COUNT = 5;

/**
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
  const [duplicates, setDuplicates] = useState(/** @type {any[]} */ ([]));

  const activityNames = useMemo(() => {
    const list = Array.isArray(activities) ? activities : [];
    const selected = Array.isArray(state.activityDocumentIds) ? state.activityDocumentIds : [];
    return list
      .filter((activity) => selected.includes(activity.documentId))
      .map((activity) => activity.name);
  }, [activities, state.activityDocumentIds]);

  const resumeAfterSuccess = async (createdClub) => {
    dispatch({ type: 'RESET' });

    // T10 — LA NAVIGATION ATTEND LE PROFIL, elle ne part plus devant.
    // Ces quatre rafraichissements partaient sans `await` : l'ecran suivant se
    // montait sur l'ANCIEN profil, celui d'avant la creation, et annoncait donc
    // le contraire de ce qui venait de se passer. Un echec de rafraichissement
    // ne doit pas retenir quelqu'un dans un tunnel dont le club est deja cree :
    // on repart quand meme, avec l'identifiant qu'on tient (T10 ① ci-dessous).
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['app-bootstrap'] }),
        queryClient.invalidateQueries({ queryKey: ['get-me'] }),
        queryClient.invalidateQueries({ queryKey: ['clubs'] }),
        typeof refetchUserData === 'function' ? refetchUserData() : null,
      ]);
    } catch {
      // Le club EST cree : on continue, l'ecran suivant se rafraichira seul.
    }

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
        navigation.reset({ index: 0, routes: [{ name: RouteNames.ClubList }] });
        return;
      }
      markOnboardingComplete(userData?.documentId);
      parentNavigation.reset({
        index: 0,
        routes: [{ name: getPostOnboardingHomeRoute() }],
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
    try {
      const result = await createSelfOnboardClub({
        activityDocumentIds: state.activityDocumentIds,
        addressDetails: option?.label,
        addressLabel: option?.label,
        alsoDirector: state.alsoDirector === true,
        coordinates: { lat: option.lat, lng: option.lng },
        email: state.email,
        forceCreate,
        name: String(state.name).trim(),
        phoneNumber: state.phoneNumber,
        screen: 'club_wizard',
      });

      if (result?.duplicate) {
        setDuplicates(Array.isArray(result.suggestions) ? result.suggestions : []);
        return;
      }

      Alert.alert(
        t('clubWizard.recap.successTitle', 'Club créé !'),
        t(
          'clubWizard.recap.successDescription',
          'Ton club est en ligne. Notre équipe le vérifiera prochainement.',
        ),
        [{ onPress: () => resumeAfterSuccess(result?.club), text: t('common.actions.ok', 'OK') }],
        { cancelable: false },
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
      isNextDisabled={!hasDuplicates && !canSubmit}
      isNextLoading={isSubmitting}
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

      {hasDuplicates ? (
        <View style={[Spaces.marginTop[24]]}>
          <Text style={[Fonts.p3Bold, { color: Colors.error700 }, Spaces.marginBottom[8]]}>
            {t('clubWizard.recap.duplicateTitle', 'Un club très proche existe déjà')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginBottom[12]]}>
            {t(
              'clubWizard.recap.duplicateHint',
              'Rejoins-le s\'il s\'agit du tien, ou touche « Créer quand même » si c\'est un autre club.',
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
