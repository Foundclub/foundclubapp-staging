// @ts-nocheck
import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { isPlausibleInvitePhone } from '@/domains/team/teamInviteSuggestions';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import SmsRepliCopie from '@/components/molecules/smsRepliCopie/SmsRepliCopie';
import ParentalDeclarationCard
  from '@/components/molecules/parentalDeclarationCard/ParentalDeclarationCard';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetMyDeclaredChildren } from '@/services/declaredChild/declaredChildQueries';
import { parentLinkErrorCode } from '@/services/parentLink/parentLinkErrors';
import { useRequestParentLink } from '@/services/parentLink/parentLinkQueries';
import { openInviteSms, resolveInviteLinkOrigin } from '@/services/teamInvite/teamInviteShare';

import { PARENTAL_DECLARATION_SIGNATORIES } from '@/constants/parentalDeclaration';

/**
 * Les refus du serveur que l'écran sait dire, par code. Seuls parlent les refus qui
 * concernent ce que le parent sait déjà (son âge, sa saisie, SA fiche) : le serveur n'en
 * rend pas d'autres — un numéro ne révèle rien.
 */
const MESSAGE_PAR_CODE = {
  DECLARED_CHILD_ADULT: 'parentLink.invite.errors.adult',
  DECLARED_CHILD_ALREADY_HAS_ACCOUNT: 'parentLink.invite.errors.alreadyHasAccount',
  DECLARED_CHILD_TOO_YOUNG: 'parentLink.invite.errors.tooYoung',
  LEGAL_ACCEPTANCE_REQUIRED: 'parentLink.invite.errors.declaration',
  PARENT_LINK_PHONE_INVALID: 'parentLink.invite.errors.phone',
  PARENT_LINK_REQUESTER_AGE_REQUIRED: 'parentLink.invite.errors.ageRequired',
  PARENT_LINK_REQUESTER_NOT_ADULT: 'parentLink.invite.errors.notAdult',
  PARENT_LINK_SELF: 'parentLink.invite.errors.self',
};

/**
 * PARENT-LIEN — « RELIER LE COMPTE DE MON ENFANT » et F20 « DONNER UN COMPTE À LINA ».
 *
 * UN SEUL ÉCRAN POUR LES DEUX PORTES, parce que le serveur n'a qu'UN rail : le parent donne
 * le numéro de son enfant et SIGNE la déclaration parentale ; l'enfant accepte depuis son
 * compte. Avec `childDocumentId` (la fiche de Lina, 13 ans), la demande porte la fiche :
 * Lina crée son compte par SMS avec ce numéro, la demande l'attend, et son acceptation
 * accroche la fiche à son compte.
 *
 * 🤐 UN NUMÉRO NE RÉVÈLE RIEN — et l'écran non plus. Après l'envoi, le MÊME message
 * s'affiche quoi qu'il existe derrière le numéro : jamais « compte trouvé » ni « introuvable ».
 * @returns {import('react').ReactElement} L'écran.
 */
function ParentLinkInvite() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const { Colors, Fonts, Spaces } = useTheme();

  const childDocumentId = String(route?.params?.childDocumentId || '').trim();
  // RW-PARENT e1 (29/10) — le prénom du mineur ne voyage plus dans l'adresse (le site la montre
  // et la garde dans l'historique) : on le relit dans la fiche, par son identifiant.
  const { data: enfantsDeclares } = useGetMyDeclaredChildren();
  const childFirstname = useMemo(() => String(
    (Array.isArray(enfantsDeclares) ? enfantsDeclares : [])
      .find((enfant) => enfant?.documentId === childDocumentId)?.firstname || '',
  ).trim(), [enfantsDeclares, childDocumentId]);
  const pourUneFiche = Boolean(childDocumentId);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [declarationCochee, setDeclarationCochee] = useState(false);
  const [erreur, setErreur] = useState('');
  const [envoyee, setEnvoyee] = useState(false);
  // CORR-MESSAGERIE p61 — le texte du dernier SMS ouvert : sur le site, il se copie si rien ne s'ouvre.
  const [messageDuSms, setMessageDuSms] = useState('');

  const nomme = { firstname: childFirstname, ...SANS_ECHAPPEMENT };

  /**
   * Le refus du serveur, dit en français.
   * @param {any} error - L'erreur préservée.
   * @returns {string} Le message.
   */
  const messageDErreur = (error) => {
    if (Number(error?.status) === 429) return t('parentLink.invite.errors.tooMany');
    const cle = MESSAGE_PAR_CODE[parentLinkErrorCode(error)];
    return cle ? t(cle, nomme) : t('parentLink.invite.errors.generic');
  };

  const { isPending: envoiEnCours, mutate: demander } = useRequestParentLink({
    onError: (error) => setErreur(messageDErreur(error)),
    onSuccess: () => {
      setErreur('');
      setEnvoyee(true);
    },
  });

  const envoyer = useCallback(() => {
    if (!isPlausibleInvitePhone(phoneNumber)) {
      setErreur(t('parentLink.invite.errors.phone'));
      return;
    }
    if (!declarationCochee) {
      setErreur(t('parentLink.invite.errors.declaration'));
      return;
    }
    setErreur('');
    demander({ declaredChildDocumentId: childDocumentId || undefined, phoneNumber });
  }, [childDocumentId, declarationCochee, demander, phoneNumber, t]);

  /** F20 — le SMS part DU TÉLÉPHONE DU PARENT : l'app n'envoie pas de SMS. */
  const prevenirParSms = useCallback(() => {
    const url = resolveInviteLinkOrigin();
    const message = t('parentLink.invite.smsMessage', { url, ...SANS_ECHAPPEMENT });
    setMessageDuSms(message);
    openInviteSms({ message, phoneNumber, url });
  }, [phoneNumber, t]);

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24]]}
      keyboardAvoiding
      keyboardScroll
    >
      <View style={[Spaces.gap[24], Spaces.paddingTop[24]]}>
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {pourUneFiche
            ? t('parentLink.invite.titleForChild', nomme)
            : t('parentLink.invite.title')}
        </Text>

        {envoyee ? (
          <View style={[Spaces.gap[16]]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t('parentLink.invite.sentTitle')}
            </Text>
            {/* 🤐 Le MÊME texte quoi qu'il y ait derrière le numéro. */}
            <Text style={[Fonts.p2, Fonts.neutral200]}>{t('parentLink.invite.sentBody')}</Text>
            {pourUneFiche ? (
              <Button
                onPress={prevenirParSms}
                testID="parent-link-sms"
                title={t('parentLink.invite.sendSms', nomme)}
                variant="Secondary"
              />
            ) : null}
            {pourUneFiche ? (
              <SmsRepliCopie message={messageDuSms} testID="parent-link-sms-copie" />
            ) : null}
            <Button
              onPress={() => navigation.goBack()}
              testID="parent-link-done"
              title={t('parentLink.invite.done')}
            />
          </View>
        ) : (
          <View style={[Spaces.gap[24]]}>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {pourUneFiche
                ? t('parentLink.invite.hintForChild', nomme)
                : t('parentLink.invite.hint')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>{t('parentLink.invite.whatYouSee')}</Text>

            <Input
              keyboardType="phone-pad"
              label={t('parentLink.invite.phoneLabel')}
              onChangeText={setPhoneNumber}
              placeholder={t('parentLink.invite.phonePlaceholder')}
              testID="parent-link-phone"
              textContentType="telephoneNumber"
              value={phoneNumber}
            />

            <ParentalDeclarationCard
              checked={declarationCochee}
              description={t('parentLink.invite.declaration')}
              onChange={setDeclarationCochee}
              signatory={PARENTAL_DECLARATION_SIGNATORIES.PARENT}
              title={t('parentLink.invite.declarationTitle')}
            />

            {erreur ? (
              <Text style={[Fonts.p3, { color: Colors.error500 }]}>{erreur}</Text>
            ) : null}

            <Button
              disabled={envoiEnCours}
              isLoading={envoiEnCours}
              onPress={envoyer}
              testID="parent-link-submit"
              title={t('parentLink.invite.submit')}
            />
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

export default ParentLinkInvite;
