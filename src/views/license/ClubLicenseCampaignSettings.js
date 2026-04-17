import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import {
  Alert, ScrollView, Switch, Text, TextInput, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  createLicenseCampaign,
  updateLicenseCampaign,
  useCurrentLicenseCampaign,
  useLicenseMutation,
} from '@/services/license/licenseQueries';
import { connectLicenseHelloAsso, connectLicenseStripe, saveLicenseExternalLink } from '@/services/license/licenseService';

const euroToCents = (value) => Math.round(Number(String(value || '0').replace(',', '.')) * 100);
const centsToEuro = (value) => String(((value || 0) / 100).toFixed(2)).replace('.', ',');
const normalizeReminderAutomation = (campaign) => {
  const automation = campaign?.reminderAutomation || {};
  return {
    enabled: automation.enabled !== undefined ? Boolean(automation.enabled) : true,
    frequencyDays: String(automation.frequencyDays || 14),
    maxCount: String(automation.maxCount || 5),
    startDate: automation.startDate || '',
  };
};

/**
 *
 * @param root0
 * @param root0.label
 * @param root0.onChangeText
 * @param root0.placeholder
 * @param root0.value
 */
function Field({
  label, onChangeText, placeholder, value,
}) {
  const { Colors, Fonts, Spaces } = useTheme();
  return (
    <View style={Spaces.gap[8]}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{label}</Text>
      <TextInput
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.neutral400}
        style={{
          borderBottomColor: Colors.neutral200, borderBottomWidth: 1, color: Colors.neutral00, minHeight: 48, paddingVertical: 14,
        }}
        value={value}
      />
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function ClubLicenseCampaignSettings({ navigation, route }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const clubId = route?.params?.clubId;
  const routeCampaignId = route?.params?.campaignId;
  const campaignQuery = useCurrentLicenseCampaign(useMemo(() => ({ clubId, includeDraft: true }), [clubId]), { enabled: Boolean(clubId && !routeCampaignId) });
  const campaign = routeCampaignId ? route?.params?.campaign : campaignQuery.data;
  const campaignId = routeCampaignId || campaign?.documentId || campaign?.id;
  const [seasonLabel, setSeasonLabel] = useState(campaign?.seasonLabel || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`);
  const [amount, setAmount] = useState(centsToEuro(campaign?.defaultAmountCents || 0));
  const [overdueAfterDate, setOverdueAfterDate] = useState(campaign?.dueDate || '');
  const [allowInstallments, setAllowInstallments] = useState(Boolean(campaign?.allowInstallments));
  const [installmentCount, setInstallmentCount] = useState(String(campaign?.installmentCount || 3));
  const [externalUrl, setExternalUrl] = useState(campaign?.externalPaymentUrl || '');
  const [reminderMessage, setReminderMessage] = useState(campaign?.reminderMessage || '');
  const initialAutomation = normalizeReminderAutomation(campaign);
  const [autoReminderEnabled, setAutoReminderEnabled] = useState(initialAutomation.enabled);
  const [reminderFrequencyDays, setReminderFrequencyDays] = useState(initialAutomation.frequencyDays);
  const [reminderMaxCount, setReminderMaxCount] = useState(initialAutomation.maxCount);
  const [reminderStartDate, setReminderStartDate] = useState(initialAutomation.startDate);

  useEffect(() => {
    if (!campaign) return;
    const automation = normalizeReminderAutomation(campaign);
    setSeasonLabel(campaign.seasonLabel || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`);
    setAmount(centsToEuro(campaign.defaultAmountCents || 0));
    setOverdueAfterDate(campaign.dueDate || '');
    setAllowInstallments(Boolean(campaign.allowInstallments));
    setInstallmentCount(String(campaign.installmentCount || 3));
    setExternalUrl(campaign.externalPaymentUrl || '');
    setReminderMessage(campaign.reminderMessage || '');
    setAutoReminderEnabled(automation.enabled);
    setReminderFrequencyDays(automation.frequencyDays);
    setReminderMaxCount(automation.maxCount);
    setReminderStartDate(automation.startDate);
  }, [campaign]);

  const saveMutation = useLicenseMutation(async () => {
    const frequencyDays = Math.max(3, Number(reminderFrequencyDays) || 14);
    const maxCount = Math.max(1, Number(reminderMaxCount) || 5);
    const payload = {
      allowInstallments,
      clubId,
      defaultAmountCents: euroToCents(amount),
      dueDate: overdueAfterDate.trim() || null,
      externalPaymentUrl: externalUrl,
      installmentCount: Number(installmentCount) || 1,
      paymentModes: {
        bank_transfer: true, cash: true, check: true, external_link: Boolean(externalUrl), helloasso: Boolean(externalUrl), stripe: false,
      },
      reminderAutomation: {
        enabled: autoReminderEnabled,
        frequencyDays,
        maxCount,
        minIntervalDays: 3,
        startDate: reminderStartDate.trim() || null,
      },
      reminderMessage,
      seasonLabel,
      status: 'active',
    };
    if (campaignId) return updateLicenseCampaign(campaignId, payload);
    return createLicenseCampaign(payload);
  }, campaignId);

  const providerMutation = useLicenseMutation(async () => {
    if (externalUrl) await saveLicenseExternalLink({ clubId, externalPaymentUrl: externalUrl, status: 'active' });
    return true;
  }, campaignId);

  const save = useCallback(() => {
    saveMutation.mutate(undefined, {
      onSuccess: (saved) => {
        providerMutation.mutate();
        Alert.alert('Campagne enregistree', 'Les parametres de cotisations sont prets.');
        navigation.navigate(RouteNames.ClubLicenses, { campaignId: saved?.documentId || saved?.id, clubId });
      },
    });
  }, [clubId, navigation, providerMutation, saveMutation]);

  return (
    <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
      <ScrollView contentContainerStyle={[Spaces.gap[24], { paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={[Fonts.h2, Fonts.neutral00]}>Parametres cotisations</Text>
          <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[8]]}>Definis le prix, les relances automatiques et les moyens de paiement.</Text>
        </View>
        <View style={[ApplicationStyle.card, Spaces.gap[16], {
          backgroundColor: Colors.primary700, borderColor: `${Colors.primary500}55`, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 20,
        }]}
        >
          <Field label="Saison" onChangeText={setSeasonLabel} placeholder="2026-2027" value={seasonLabel} />
          <Field label="Prix par defaut (EUR)" onChangeText={setAmount} placeholder="250" value={amount} />
        </View>

        <View style={[ApplicationStyle.card, Spaces.gap[16], {
          backgroundColor: Colors.primary700, borderColor: `${Colors.primary500}55`, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 20,
        }]}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
            <View style={[Spaces.gap[4], { flex: 1, paddingRight: 16 }]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Relances automatiques</Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>Relance les membres tant que leur cotisation reste a payer.</Text>
            </View>
            <Switch onValueChange={setAutoReminderEnabled} value={autoReminderEnabled} />
          </View>
          {autoReminderEnabled ? (
            <>
              <Field label="Frequence de relance (jours)" onChangeText={setReminderFrequencyDays} placeholder="14" value={reminderFrequencyDays} />
              <Field label="Nombre maximum de relances" onChangeText={setReminderMaxCount} placeholder="5" value={reminderMaxCount} />
              <Field label="Premiere relance a partir du (optionnel)" onChangeText={setReminderStartDate} placeholder="2026-09-01" value={reminderStartDate} />
              <Field label="Message de relance" onChangeText={setReminderMessage} placeholder="Rappel: votre cotisation reste a regler." value={reminderMessage} />
            </>
          ) : null}
          <Field label="Marquer en retard apres le (optionnel)" onChangeText={setOverdueAfterDate} placeholder="2026-09-30" value={overdueAfterDate} />
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            Sans date, les membres restent en attente et peuvent quand meme etre relances.
          </Text>
        </View>

        <View style={[ApplicationStyle.card, Spaces.gap[16], {
          backgroundColor: Colors.primary700, borderColor: `${Colors.primary500}55`, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 20,
        }]}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
            <View style={[Spaces.gap[4], { flex: 1, paddingRight: 16 }]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Paiement en plusieurs fois</Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>Genere automatiquement des echeances.</Text>
            </View>
            <Switch onValueChange={setAllowInstallments} value={allowInstallments} />
          </View>
          {allowInstallments ? <Field label="Nombre d'echeances" onChangeText={setInstallmentCount} placeholder="3" value={installmentCount} /> : null}
          <Field label="Lien externe / HelloAsso" onChangeText={setExternalUrl} placeholder="https://..." value={externalUrl} />
        </View>
        <View style={Spaces.gap[12]}>
          <Button isLoading={saveMutation.isPending} onPress={save} title="Enregistrer" />
          <Button onPress={() => connectLicenseHelloAsso({ clubId, externalPaymentUrl: externalUrl, status: externalUrl ? 'active' : 'pending' })} title="Connecter HelloAsso" variant="Secondary" />
          <Button onPress={() => connectLicenseStripe({ clubId, status: 'pending' })} title="Preparer Stripe Connect" variant="Secondary" />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default ClubLicenseCampaignSettings;
