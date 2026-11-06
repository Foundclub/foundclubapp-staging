import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { exampleCampaignMembers } from '@/domains/tour/tourExamples';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import TourTarget from '@/components/molecules/tour/TourTarget';
import ScreenContainer from '@/components/templates/ScreenContainer';
import {
  formatLicenseMoney,
  licenseRadius,
  licenseSpacing,
} from '@/views/license/licenseDesignSystem';

// Montant du pack (captures 10-cotisations), si le tunnel n'en a pas reçu.
const AMOUNT_FALLBACK_CENTS = 25000;

/**
 * Tuile de chiffre, à l'image de `StatCard` (`ClubLicenses`).
 * @param {{ label: string, tone: string, value: string }} props - Libellé, couleur et valeur.
 * @returns {import('react').ReactElement} Tuile.
 */
function Tuile({ label, tone, value }) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  return (
    <View style={[ApplicationStyle.card, {
      backgroundColor: Colors.primary700,
      borderColor: withAlpha(tone, 0.53),
      borderRadius: licenseRadius.card,
      flex: 1,
      padding: licenseSpacing.cardPadding,
    }]}
    >
      <Text style={[Fonts.p3, Fonts.neutral200]}>{label}</Text>
      <Text numberOfLines={1} style={[Fonts.h3, Spaces.marginTop[8], { color: tone }]}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Puce de l'écran réel (onglet, filtre) : montrée, pas à toucher.
 * @param {{ active?: boolean, label: string }} props - Libellé, et puce choisie.
 * @returns {import('react').ReactElement} Puce.
 */
function Puce({ active = false, label }) {
  const { Colors, Fonts, Spaces } = useTheme();
  return (
    <View style={[Spaces.paddingHorizontal[12], Spaces.paddingVertical[8], {
      backgroundColor: active ? Colors.primary500 : 'transparent',
      borderColor: active ? Colors.primary500 : withAlpha(Colors.neutral00, 0.3),
      borderRadius: licenseRadius.pill,
      borderWidth: 1,
    }]}
    >
      <Text style={[Fonts.p3Bold, { color: active ? Colors.neutral900 : Colors.neutral00 }]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Guide Dirigeant·e, fin de B1 (décision « 80- B », capture `10-cotisations/12`) : la campagne
 * qu'on vient de remplir, comme ouverte. Elle remplace le récap de `ClubLicenseCampaignSettings` le
 * temps de l'étape. Tout est local, aucun service n'est importé ici : « A payé » et « Relancer » ne
 * changent que cet écran, et rien ne reste après lui.
 *
 * ponytail: pas la vraie fiche (`ClubLicenses`, 4 500 lignes qui lisent et écrivent partout) ; les
 * cartes en reprennent les mesures. Sortie : extraire `StatCard` et la carte de membre.
 * ponytail: un retour pris à l'étape quitte l'écran et le guide propose de passer. Sortie : bloquer
 * le retour si la recette le demande.
 * @param {{ amountCents?: number, currency?: string, name?: string, navigation?: any }} props
 *   Ce que le tunnel a saisi, et la navigation de son écran.
 * @returns {import('react').ReactElement} Écran.
 */
function TourCampagneExemple({
  amountCents = 0, currency = 'EUR', name = '', navigation,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = useTheme();
  const [members] = useState(exampleCampaignMembers);
  const [paidIds, setPaidIds] = useState(/** @type {string[]} */ ([]));
  const [remindedId, setRemindedId] = useState('');
  const scrollRef = useRef(/** @type {any} */ (null));
  const campaignName = name || t('tourExamples.campaign.name', 'Cotisation licences');
  const amount = amountCents > 0 ? amountCents : AMOUNT_FALLBACK_CENTS;
  const expected = members.length * amount;
  const paid = paidIds.length * amount;
  const money = (/** @type {number} */ value) => formatLicenseMoney(value, currency);

  useLayoutEffect(() => {
    navigation?.setOptions?.({ headerTitle: campaignName });
    return () => navigation?.setOptions?.({
      headerTitle: t('clubStack.headers.feeSettings', 'Paramètres cotisations'),
    });
  }, [campaignName, navigation, t]);

  return (
    <ScreenContainer bottomInsetMode="none" withHeaderPadding>
      <ScrollView
        contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[32]]}
        // La bulle parle des membres : ils sont à l'écran dès l'arrivée (capture 13).
        onContentSizeChange={() => scrollRef.current?.scrollToEnd?.({ animated: false })}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
      >
        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
            {t('tourExamples.responders.label', 'Exemple · rien n’est envoyé')}
          </Text>
          <Text style={[Fonts.h2, Fonts.neutral00]}>
            {t('tourExamples.campaign.title', 'Cotisations')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('tourExamples.campaign.subtitle', 'Détail complet de la campagne {{name}}.', {
              name: campaignName, ...SANS_ECHAPPEMENT,
            })}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
          <Tuile
            label={t('clubLicenses.quickFilters.expected', 'Attendu')}
            tone={Colors.primary500}
            value={money(expected)}
          />
          <Tuile
            label={t('tourExamples.campaign.paid', 'Encaissé')}
            tone={Colors.success500}
            value={money(paid)}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
          <Tuile
            label={t('clubLicenses.quickFilters.remaining', 'Reste')}
            tone={Colors.warning500}
            value={money(expected - paid)}
          />
          <Tuile
            label={t('clubLicenses.quickFilters.overdue', 'Retards')}
            tone={Colors.error500}
            value="0"
          />
        </View>

        <View style={[Spaces.gap[8], { flexDirection: 'row', flexWrap: 'wrap' }]}>
          <Puce label={t('tourExamples.campaign.tabOverview', 'Vue d’ensemble')} />
          <Puce active label={t('tourExamples.campaign.tabMembers', 'Membres')} />
          <Puce label={t('tourExamples.campaign.tabPayments', 'Paiements')} />
        </View>

        <Text style={[Fonts.h4, Fonts.neutral00]}>
          {t('tourExamples.campaign.tabMembers', 'Membres')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral300, Spaces.paddingBottom[8], {
          borderBottomColor: Colors.neutral00,
          borderBottomWidth: 1,
        }]}
        >
          {t('tourExamples.campaign.search', 'Rechercher un membre')}
        </Text>
        <View style={[Spaces.gap[8], { flexDirection: 'row', flexWrap: 'wrap' }]}>
          <Puce active label={t('tourExamples.campaign.filterAll', 'Tous')} />
          <Puce label={t('tourExamples.campaign.filterPending', 'En attente')} />
          <Puce label={t('tourExamples.campaign.filterPartial', 'Partiel')} />
          <Puce label={t('tourExamples.campaign.filterOverdue', 'En retard')} />
        </View>

        <TourTarget id="camp-list">
          <View style={Spaces.gap[12]}>
            {members.map((member, index) => {
              const isPaid = paidIds.includes(member.documentId);
              const fullName = `${member.firstname} ${member.lastname}`;
              const relance = (
                <Button
                  onPress={() => setRemindedId(member.documentId)}
                  size="sm"
                  title={t('clubLicenses.actions.remind', 'Relancer')}
                  variant="Secondary"
                />
              );
              return (
                <View
                  key={member.documentId}
                  style={[Spaces.gap[12], {
                    backgroundColor: Colors.primary700,
                    borderColor: withAlpha(isPaid ? Colors.success500 : Colors.primary500, 0.53),
                    borderRadius: licenseRadius.hero,
                    borderWidth: 1,
                    padding: licenseSpacing.cardPadding,
                  }]}
                >
                  <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                    <ProfileAvatar enablePreview={false} name={fullName} size={48} />
                    <View style={[Spaces.gap[4], { flex: 1 }]}>
                      <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>
                        {fullName}
                      </Text>
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        {t('tourExamples.campaign.memberTeam', 'Senior')}
                      </Text>
                    </View>
                    <View style={[Spaces.gap[4], { alignItems: 'flex-end' }]}>
                      <Text style={[Fonts.p2Bold, {
                        color: isPaid ? Colors.success500 : Colors.primary500,
                      }]}
                      >
                        {isPaid
                          ? t('tourExamples.campaign.statusPaid', 'Payé')
                          : t('tourExamples.campaign.filterPending', 'En attente')}
                      </Text>
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        {isPaid
                          ? t('tourExamples.campaign.settled', 'Réglé')
                          : `${money(amount)} ${t('clubLicenses.assignment.remaining', 'reste')}`}
                      </Text>
                    </View>
                  </View>
                  {remindedId === member.documentId ? (
                    <Text style={[Fonts.p3, { color: Colors.primary500 }]}>
                      {t(
                        'tourExamples.campaign.reminded',
                        'Une vraie relance partirait ici : rien n’est envoyé à ce membre.',
                      )}
                    </Text>
                  ) : null}
                  {isPaid ? null : (
                    <View style={{
                      alignItems: 'center',
                      flexDirection: 'row',
                      gap: licenseSpacing.actionGap,
                      justifyContent: 'flex-end',
                    }}
                    >
                      {index === 0 ? <TourTarget id="camp-relance">{relance}</TourTarget> : relance}
                      <Button
                        onPress={() => setPaidIds((ids) => [...ids, member.documentId])}
                        size="sm"
                        // Recette L11 : mesuré à sa largeur, le libellé tombait à « A ».
                        style={{ minWidth: 96 }}
                        title={t('clubLicenses.assignment.markPaid', 'A payé')}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </TourTarget>
      </ScrollView>
    </ScreenContainer>
  );
}

export default TourCampagneExemple;
