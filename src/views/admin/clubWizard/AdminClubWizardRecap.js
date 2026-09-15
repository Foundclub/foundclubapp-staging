// @ts-nocheck
/* eslint-disable jsdoc/require-description, jsdoc/require-param-type, jsdoc/require-returns, max-len */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import {
  buildClubWritePayload,
  getClubInitials,
  getClubRelationLabel,
  normalizeText,
} from '@/services/admin/adminClubContentModel';
import { useCreateAdminClubContent } from '@/services/admin/adminClubContentQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

import {
  ADMIN_CLUB_WIZARD_TOTAL_STEPS,
  useAdminClubWizard,
} from './AdminClubWizardContext';
import {
  hasInvalidSponsorRows,
  isValidOptionalEmail,
  sanitizeSponsorRows,
} from './helpers';
import useAdminClubWizardExit from './useAdminClubWizardExit';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function AdminClubWizardRecap({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const {
    reset,
    setField,
    state,
  } = useAdminClubWizard();
  const handleExitWizard = useAdminClubWizardExit(navigation);
  const createMutation = useCreateAdminClubContent();
  const hasInvalidEmail = !isValidOptionalEmail(state.email);
  const hasInvalidSponsors = hasInvalidSponsorRows(state.sponsor);

  const sanitizedSponsors = useMemo(
    () => sanitizeSponsorRows(state.sponsor),
    [state.sponsor],
  );
  const selectedActivities = useMemo(
    () => (Array.isArray(state.activites) ? state.activites : [])
      .map((activity) => activity?.name)
      .filter(Boolean),
    [state.activites],
  );

  const isReady = Boolean(
    normalizeText(state.name)
    && !hasInvalidEmail
    && !hasInvalidSponsors,
  );

  const summarySections = useMemo(() => ([
    {
      action: RouteNames.AdminClubWizardIdentity,
      lines: [
        normalizeText(state.name) || t('adminClubWizardRecap.sections.missingName', 'Nom manquant'),
        state.logo?.url ? t(
          'adminClubWizardRecap.sections.logoImported',
          'Logo importe',
        ) : t('adminClubWizardRecap.sections.noLogo', 'Pas de logo'),
      ],
      title: t('adminClubWizardRecap.sections.identity', 'Identite'),
    },
    {
      action: RouteNames.AdminClubWizardContact,
      lines: [
        normalizeText(state.email) || t(
          'adminClubWizardRecap.sections.noEmail',
          'Email non renseigne',
        ),
        normalizeText(state.phoneNumber) || t(
          'adminClubWizardRecap.sections.noPhone',
          'Téléphone non renseigne',
        ),
      ],
      title: 'Contact',
    },
    {
      action: RouteNames.AdminClubWizardAddress,
      lines: [
        normalizeText(state.addressLabel) || t(
          'adminClubWizardRecap.sections.noAddress',
          'Adresse non renseignée',
        ),
        [normalizeText(state.city), normalizeText(state.postcode)].filter(Boolean).join(' - ') || t(
          'adminClubWizardRecap.sections.noCity',
          'Ville non renseignée',
        ),
      ],
      title: t('adminClubWizardRecap.sections.address', 'Adresse'),
    },
    {
      action: RouteNames.AdminClubWizardActivities,
      lines: selectedActivities.length > 0
        ? selectedActivities
        : [t('adminClubWizardRecap.sections.noActivity', 'Aucune activité sélectionnée')],
      title: t('adminClubWizardRecap.sections.activities', 'Activites'),
    },
    {
      action: RouteNames.AdminClubWizardBusiness,
      lines: [
        state.clubPartner ? t('adminClubWizardRecap.sections.partner', 'Club partenaire') : t(
          'adminClubWizardRecap.sections.standard',
          'Club standard',
        ),
        state.clubVerified ? t('adminClubWizardRecap.sections.verified', 'Club certifié') : t(
          'adminClubWizardRecap.sections.notVerified',
          'Club non certifié',
        ),
        state.isReservationProvider ? t(
          'adminClubWizardRecap.sections.reservationOn',
          'Réservation active',
        ) : t(
          'adminClubWizardRecap.sections.reservationOff',
          'Pas réservation',
        ),
        t(
          'adminClubWizardRecap.sections.subscriptionsNote',
          'Abonnements et capacité Équipe geres depuis les opérations abonnements',
        ),
      ],
      title: t('adminClubWizardRecap.sections.status', 'Statut'),
    },
    {
      action: RouteNames.AdminClubWizardMultisport,
      lines: [
        state.parentMultisport
          ? getClubRelationLabel(state.parentMultisport)
          : t('adminClubWizardRecap.sections.noMultisport', 'Aucun parent multisport'),
      ],
      title: 'Multisport',
    },
    {
      action: RouteNames.AdminClubWizardSponsors,
      lines: sanitizedSponsors.length > 0
        ? sanitizedSponsors.map((item) => `${item.title}${item.link ? ` - ${item.link}` : ''}`)
        : [t('adminClubWizardRecap.sections.noSponsor', 'Aucun sponsor')],
      title: 'Sponsors',
    },
  ]), [sanitizedSponsors, selectedActivities, state, t]);

  const handleSubmit = async () => {
    if (!isReady) return;

    try {
      const result = await createMutation.mutateAsync({
        data: buildClubWritePayload({
          ...state,
          sponsor: sanitizedSponsors,
        }),
        reason: normalizeText(state.saveReason) || 'Création Club SuperAdmin via wizard',
      });
      const nextDocumentId = result?.data?.documentId || result?.documentId || null;
      reset();
      // D81 — LES 8 ETAPES QUITTENT LA PILE. `replace` ne retirait QUE le
      // recapitulatif : les 7 etapes precedentes restaient sous la fiche du
      // club, et le premier « Retour » retombait sur « Sponsors ». On repose la
      // liste des clubs sous la fiche : c'est de la qu'on entre dans ce tunnel,
      // et c'est la que le retour doit ramener.
      if (nextDocumentId) {
        navigation.reset({
          index: 1,
          routes: [
            { name: RouteNames.AdminClubList },
            { name: RouteNames.AdminClubDetail, params: { clubId: nextDocumentId } },
          ],
        });
        return;
      }
      navigation.reset({ index: 0, routes: [{ name: RouteNames.AdminClubList }] });
    } catch (error) {
      Alert.alert(t(
        'adminClubWizardRecap.createError',
        'Création impossible',
      ), getErrorMessage(error, 'generic'));
    }
  };

  return (
    <WizardStepLayout
      isNextDisabled={!isReady}
      isNextLoading={createMutation.isPending}
      nextLabel={t('adminClubWizardRecap.create', 'Créer le club')}
      onBack={() => navigation.goBack()}
      onClose={handleExitWizard}
      onNext={handleSubmit}
      stepCount={ADMIN_CLUB_WIZARD_TOTAL_STEPS}
      stepIndex={8}
      subtitle={t(
        'adminClubWizardRecap.subtitle',
        'Tu retrouves ici tout le tunnel avant enregistrement. Le club pourra toujours être edite après création, mais la base sera propre des le depart.',
      )}
      title={t('adminClubWizardRecap.title', 'Recapitulatif')}
    >
      <View style={[Spaces.gap[18]]}>
        <View
          style={[
            ApplicationStyle.card,
            Spaces.padding[16],
            Spaces.gap[12],
            {
              backgroundColor: isReady ? 'rgba(4, 31, 44, 0.82)' : 'rgba(73, 24, 12, 0.72)',
              borderColor: isReady ? 'rgba(1, 179, 244, 0.32)' : Colors.warning500,
            },
          ]}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[14]]}>
            <View
              style={[
                Alignments.alignCenter,
                Alignments.justifyCenter,
                {
                  backgroundColor: Colors.primary700,
                  borderColor: `${Colors.primary500}55`,
                  borderRadius: 22,
                  borderWidth: 1,
                  height: 74,
                  overflow: 'hidden',
                  width: 74,
                },
              ]}
            >
              {state.logo?.url ? (
                <Image
                  resizeMode="cover"
                  source={{ uri: state.logo.url }}
                  style={{ height: 74, width: 74 }}
                />
              ) : (
                <Text style={[Fonts.h4Bold, { color: Colors.primary200 }]}>
                  {getClubInitials({ name: state.name })}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                {normalizeText(state.name) || t(
                  'adminClubWizardRecap.unnamedClub',
                  'Club sans nom',
                )}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[4]]}>
                {isReady ? t('adminClubWizardRecap.ready', 'Prêt à créer') : t(
                  'adminClubWizardRecap.incomplete',
                  'Des informations restent à compléter',
                )}
              </Text>
            </View>
          </View>
        </View>

        {summarySections.map((section) => (
          <View
            key={section.title}
            style={[
              ApplicationStyle.card,
              Spaces.padding[16],
              Spaces.gap[10],
              {
                backgroundColor: 'rgba(4, 31, 44, 0.82)',
                borderColor: 'rgba(1, 179, 244, 0.18)',
              },
            ]}
          >
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>{section.title}</Text>
              <TouchableOpacity onPress={() => navigation.navigate(section.action)}>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                  {t('adminClubWizardRecap.edit', 'Modifier')}
                </Text>
              </TouchableOpacity>
            </View>
            {section.lines.map((line) => (
              <Text key={`${section.title}-${String(line)}`} style={[Fonts.p2, Fonts.neutral100]}>
                {line}
              </Text>
            ))}
          </View>
        ))}

        <Input
          label={t('adminClubWizardRecap.auditReason.label', "Raison d'audit")}
          multiline
          numberOfLines={4}
          onChangeText={(value) => setField('saveReason', value)}
          placeholder={t(
            'adminClubWizardRecap.auditReason.placeholder',
            'Ex: Création initiale dans le dashboard admin',
          )}
          style={{ minHeight: 100, textAlignVertical: 'top' }}
          value={state.saveReason}
        />
      </View>
    </WizardStepLayout>
  );
}

export default AdminClubWizardRecap;
