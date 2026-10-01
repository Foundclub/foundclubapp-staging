import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useCollectiviteInvitationPreview,
  useMyClubsForCollectiviteInvitation,
  useRequestCollectiviteAttach,
} from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * 🏛️ « REJOINDRE LA VILLE » — COLL-CLUBS (01/10/2026), design HY521H1 page 7 (« P7v3-inviter »,
 * etats 4 et 5). Un dirigeant connecte, venu du lien de la Ville, choisit lequel de SES clubs
 * rattacher (le serveur ne propose que ceux qu il dirige). Si le club n est pas dans la commune,
 * il le lit AVANT de demander. La demande part a l equipe FoundClub, qui verifie, puis rattache
 * (D70) : aucun delai n est annonce, « Tu seras prevenu ». « tu » : le club.
 * @returns {import('react').ReactElement} L ecran.
 */
function CollectiviteJoinRequest() {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const routeParams = /** @type {{ token?: string } | undefined} */ (route?.params);
  const token = routeParams?.token || null;

  const apercu = useCollectiviteInvitationPreview(token);
  const clubs = useMyClubsForCollectiviteInvitation(token);
  const demander = useRequestCollectiviteAttach();
  const [choix, setChoix] = useState(/** @type {string | null} */ (null));
  const [resultat, setResultat] = useState(/** @type {any} */ (null));

  const nomDeLaVille = /** @type {any} */ (apercu.data)?.collectivite?.name || '';
  const ville = nomDeLaVille
    ? formatCollectiviteOfferedBy(nomDeLaVille)
    : t('collectiviteClubs.detail.theCity', 'la Ville');
  // « Montrivage » : le nom de la commune, pour « Ce club n est pas a Montrivage ».
  const commune = nomDeLaVille.replace(/^(Ville|Commune) (de |d['’]|du |des )/u, '') || ville;
  const liste = Array.isArray(clubs.data) ? clubs.data : [];
  const choisi = liste.find((club) => club?.documentId === choix)
    || (liste.length === 1 ? liste[0] : null);

  const envoyer = () => {
    if (!choisi?.documentId || !token) return;
    demander.mutate({ clubId: choisi.documentId, token }, {
      onSuccess: (data) => setResultat({ ...data, clubId: choisi.documentId }),
    });
  };
  const allerAMonClub = () => {
    /** @type {any} */ (navigation).navigate(RouteNames.Club, { clubId: resultat?.clubId });
  };

  if (resultat) {
    const dejaRattache = resultat.status === 'attached';
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <View style={[Spaces.padding[24], Alignments.alignCenter, { gap: 16 }]}>
          <Text
            accessibilityRole="header"
            style={[Fonts.h2Black, Fonts.neutral00, Fonts.textCenter]}
          >
            {dejaRattache
              ? t('collectiviteClubs.join.alreadyAttachedTitle', 'Ton club est déjà rattaché')
              : t('collectiviteClubs.join.sentTitle', 'Demande envoyée')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100, Fonts.textCenter]}>
            {dejaRattache
              ? t(
                'collectiviteClubs.join.alreadyAttachedBody',
                'Il est déjà rattaché à {{ville}}.',
                { ville, ...SANS_ECHAPPEMENT },
              )
              : t(
                'collectiviteClubs.join.sentBody',
                // eslint-disable-next-line max-len
                'L’équipe FoundClub vérifie que ton club est bien à {{commune}}, puis le rattache à la Ville. Tu seras prévenu.',
                { commune, ...SANS_ECHAPPEMENT },
              )}
          </Text>
          {dejaRattache ? null : (
            <Text style={[Fonts.p3, Fonts.neutral300, Fonts.textCenter]}>
              {t(
                'collectiviteClubs.join.sentMeanwhile',
                'D’ici là, ton club fonctionne déjà normalement.',
              )}
            </Text>
          )}
          <Button
            onPress={allerAMonClub}
            title={t('collectiviteClubs.join.goToClub', 'Aller à mon club')}
          />
        </View>
      </ScreenContainer>
    );
  }

  let contenu;
  if (clubs.isLoading || apercu.isLoading) {
    contenu = <Loader />;
  } else if (clubs.error || apercu.error) {
    contenu = (
      <Text style={[Fonts.p2, Fonts.neutral100]}>
        {getErrorMessage(/** @type {any} */ (clubs.error || apercu.error))}
      </Text>
    );
  } else if (liste.length === 0) {
    contenu = (
      <View style={{ gap: 12 }}>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {t(
            'collectiviteClubs.join.noClub',
            // eslint-disable-next-line max-len
            'Tu ne diriges aucun club sur FoundClub. Inscris d’abord ton club, puis rouvre le lien de la Ville.',
          )}
        </Text>
        <Button
          onPress={() => /** @type {any} */ (navigation).navigate(RouteNames.ClubStack, {
            params: { entry: 'collectivite-invitation' },
            screen: RouteNames.ClubWizardName,
          })}
          title={t('collectiviteClubs.join.register', 'Inscrire mon club')}
        />
      </View>
    );
  } else {
    contenu = (
      <View style={{ gap: 12 }}>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {t('collectiviteClubs.join.pick', 'Quel club veux-tu rattacher à {{ville}} ?', {
            ville, ...SANS_ECHAPPEMENT,
          })}
        </Text>
        {liste.map((/** @type {any} */ club) => {
          const coche = choisi?.documentId === club?.documentId;
          const bloque = club?.attachedElsewhere === true;
          return (
            <TouchableOpacity
              accessibilityRole="radio"
              accessibilityState={{ checked: coche, disabled: bloque }}
              disabled={bloque}
              key={club?.documentId}
              onPress={() => setChoix(club?.documentId)}
              style={[
                Alignments.row,
                Alignments.alignCenter,
                Spaces.padding[12],
                {
                  backgroundColor: withAlpha(Colors.neutral00, coche ? 0.08 : 0.03),
                  borderColor: coche ? Colors.primary500 : withAlpha(Colors.neutral00, 0.12),
                  borderRadius: 14,
                  borderWidth: 1,
                  gap: 12,
                  opacity: bloque ? 0.5 : 1,
                },
              ]}
              testID={`rejoindre-club-${club?.documentId}`}
            >
              <ClubLogoMark name={club?.name} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{club?.name}</Text>
                {club?.address ? (
                  <Text style={[Fonts.p3, Fonts.neutral300]}>{club.address}</Text>
                ) : null}
                {bloque ? (
                  <Text style={[Fonts.p3, Fonts.neutral300]}>
                    {t(
                      'collectiviteClubs.join.attachedElsewhere',
                      'Déjà rattaché à une autre collectivité.',
                    )}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
        {choisi && choisi.inCommune === false ? (
          <View
            style={[
              Spaces.padding[12],
              {
                backgroundColor: withAlpha(Colors.warning500, 0.12),
                borderColor: withAlpha(Colors.warning500, 0.45),
                borderRadius: 14,
                borderWidth: 1,
                gap: 6,
              },
            ]}
            testID="rejoindre-hors-commune"
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t('collectiviteClubs.join.outsideTitle', 'Ce club n’est pas à {{commune}}', {
                commune, ...SANS_ECHAPPEMENT,
              })}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'collectiviteClubs.join.outsideBody',
                'L’équipe FoundClub vérifiera avec la Ville avant de le rattacher.',
              )}
            </Text>
          </View>
        ) : null}
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'collectiviteClubs.join.onlyYours',
            'Seuls les clubs dont tu es dirigeant sont proposés.',
          )}
        </Text>
        <Button
          disabled={!choisi || choisi.attachedElsewhere === true}
          isLoading={demander.isPending}
          onPress={envoyer}
          title={t('collectiviteClubs.join.request', 'Demander le rattachement')}
        />
        {demander.error ? (
          <Text style={[Fonts.p3, Fonts.error300]}>
            {getErrorMessage(/** @type {any} */ (demander.error))}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{
          gap: 16, maxWidth: 640, paddingBottom: 24, paddingTop: 12, width: '100%',
        }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {contenu}
      </ScrollView>
    </ScreenContainer>
  );
}

export default CollectiviteJoinRequest;
