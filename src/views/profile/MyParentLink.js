// @ts-nocheck
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, Text, View,
} from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { parentLinkErrorCode } from '@/services/parentLink/parentLinkErrors';
import {
  useAcceptParentLink,
  useParentLinksAsChild,
  useRefuseParentLink,
  useUnlinkParent,
} from '@/services/parentLink/parentLinkQueries';

/** Les refus du serveur que l'écran sait dire, par code ; le reste est « impossible ». */
const MESSAGE_PAR_CODE = {
  PARENT_LINK_ALREADY_LINKED: 'parentLink.child.errors.alreadyLinked',
  PARENT_LINK_CHILD_NOT_ELIGIBLE: 'parentLink.child.errors.notEligible',
  PARENT_LINK_EXPIRED: 'parentLink.child.errors.closed',
  PARENT_LINK_NOT_FOUND: 'parentLink.child.errors.closed',
  PARENT_LINK_NOT_PENDING: 'parentLink.child.errors.closed',
  PARENT_LINK_PARENT_UNAVAILABLE: 'parentLink.child.errors.closed',
};

/**
 * Prénom et nom d'une personne, pour l'afficher.
 * @param {any} personne - Le résumé rendu par le serveur.
 * @returns {string} « Prénom Nom ».
 */
const nomDe = (personne) => `${personne?.firstname || ''} ${personne?.lastname || ''}`.trim();

/**
 * PARENT-LIEN — « MON PARENT » : L'ÉCRAN DE L'ENFANT (13 à 17 ans).
 *
 * C'est ICI, et nulle part ailleurs, que le lien se décide : un parent DEMANDE, l'enfant
 * ACCEPTE ou REFUSE. Une fois relié, il VOIT qui l'est et peut RETIRER le lien à tout moment
 * (effet immédiat côté serveur). L'écran dit ce que le parent verra (les retours du coach)
 * et ce qu'il ne verra jamais (les messages — décision d'Adel du 07/09).
 * @returns {import('react').ReactElement} L'écran.
 */
function MyParentLink() {
  const { t } = useTranslation();
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();

  const { data, error, isLoading } = useParentLinksAsChild();
  const [erreur, setErreur] = useState('');

  const reactions = {
    onError: (err) => {
      const cle = MESSAGE_PAR_CODE[parentLinkErrorCode(err)];
      setErreur(t(cle || 'parentLink.child.errors.generic'));
    },
    onSuccess: () => setErreur(''),
  };
  const { isPending: acceptationEnCours, mutate: accepter } = useAcceptParentLink(reactions);
  const { isPending: refusEnCours, mutate: refuser } = useRefuseParentLink(reactions);
  const { isPending: retraitEnCours, mutate: retirer } = useUnlinkParent(reactions);
  const occupe = acceptationEnCours || refusEnCours || retraitEnCours;

  const parent = data?.parent || null;
  const demandes = Array.isArray(data?.requests) ? data.requests : [];

  const demanderRetrait = useCallback(() => {
    const nomme = { name: nomDe(parent), ...SANS_ECHAPPEMENT };
    Alert.alert(
      t('parentLink.child.unlinkConfirm.title'),
      t('parentLink.child.unlinkConfirm.message', nomme),
      [
        { style: 'cancel', text: t('parentLink.child.unlinkConfirm.cancel') },
        {
          onPress: () => retirer(),
          style: 'destructive',
          text: t('parentLink.child.unlinkConfirm.confirm'),
        },
      ],
    );
  }, [parent, retirer, t]);

  const carteStyle = [
    ApplicationStyle.card,
    Spaces.padding[16],
    { backgroundColor: `${Colors.primary700}73`, borderColor: `${Colors.primary500}80`, gap: 12 },
  ];
  const ligne = { alignItems: 'center', flexDirection: 'row', gap: 12 };

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24]]}
    >
      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 20 }}>
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{t('parentLink.child.title')}</Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>{t('parentLink.child.whatParentSees')}</Text>

        <WithDataWrapper error={error?.message} isLoading={isLoading}>
          <View style={{ gap: 16 }}>
            {parent ? (
              <View style={carteStyle} testID="parent-link-current">
                <Text style={[Fonts.p3, Fonts.neutral200]}>{t('parentLink.child.linkedTo')}</Text>
                <View style={ligne}>
                  <ProfileAvatar
                    enablePreview={false}
                    imageUrl={parent?.avatar?.url}
                    name={nomDe(parent)}
                    size={44}
                  />
                  <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{nomDe(parent)}</Text>
                </View>
                <Button
                  disabled={occupe}
                  isLoading={retraitEnCours}
                  onPress={demanderRetrait}
                  testID="parent-link-unlink"
                  title={t('parentLink.child.unlink')}
                  variant="Danger"
                />
              </View>
            ) : (
              <Text style={[Fonts.p2, Fonts.neutral200]}>{t('parentLink.child.noParent')}</Text>
            )}

            {demandes.map((demande) => (
              <View
                key={demande?.documentId}
                style={carteStyle}
                testID={`parent-link-request-${demande?.documentId}`}
              >
                <View style={ligne}>
                  <ProfileAvatar
                    enablePreview={false}
                    imageUrl={demande?.parent?.avatar?.url}
                    name={nomDe(demande?.parent)}
                    size={44}
                  />
                  <Text style={[Fonts.p2, Fonts.neutral00, { flex: 1 }]}>
                    {t('parentLink.child.requestFrom', {
                      name: nomDe(demande?.parent),
                      ...SANS_ECHAPPEMENT,
                    })}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      disabled={occupe}
                      onPress={() => refuser(demande.documentId)}
                      testID={`parent-link-refuse-${demande?.documentId}`}
                      title={t('parentLink.child.refuse')}
                      variant="Secondary"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      disabled={occupe}
                      onPress={() => accepter(demande.documentId)}
                      testID={`parent-link-accept-${demande?.documentId}`}
                      title={t('parentLink.child.accept')}
                    />
                  </View>
                </View>
              </View>
            ))}

            {!parent && demandes.length === 0 ? (
              <Text style={[Fonts.p3, Fonts.neutral200]}>{t('parentLink.child.emptyHint')}</Text>
            ) : null}

            {erreur ? (
              <Text style={[Fonts.p3, { color: Colors.error500 }]}>{erreur}</Text>
            ) : null}
          </View>
        </WithDataWrapper>
      </ScrollView>
    </ScreenContainer>
  );
}

export default MyParentLink;
