import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';
import { RouteNames } from '@/navigation/routeNames';

import { useCollectiviteInvitationPreview } from '@/services/collectivite/collectiviteQueries';

import { getFacilityTypeLabel } from '@/utils/facilityTypes';

import { useIsDesktop } from '@/responsive';

/**
 * 🏛️ LA PAGE QU OUVRE LE CLUB INVITE — COLL-CLUBS (01/10/2026), design HY521H1 page 7
 * (« P7v3-inviter », etats 3 et A). PUBLIQUE : elle s ouvre sans compte, depuis le lien que
 * la mairie a colle dans un e-mail ou donne au telephone.
 *
 * Qui invite, ce que la Ville ouvre au club, ses installations (nom, type, capacite, adresse),
 * et deux boutons : « Inscrire mon club » (le tunnel de creation de club existant ; sans compte,
 * la connexion d abord) et « Mon club est deja sur FoundClub » (demander le rattachement).
 * Rien d autre n est public : ni les clubs deja rattaches, ni leurs horaires (le serveur ne les
 * rend pas : temoin admin COLL-CLUBS I4). « tu » : le club.
 * @returns {import('react').ReactElement} L ecran.
 */
function CollectiviteJoin() {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const isDesktop = useIsDesktop();
  const { userData } = useAuth();
  const routeParams = /** @type {{ token?: string } | undefined} */ (route?.params);
  const token = routeParams?.token || null;
  const apercu = useCollectiviteInvitationPreview(token);
  const page = /** @type {any} */ (apercu.data) || null;
  const connecte = Boolean(userData?.documentId);

  const ville = page?.collectivite?.name
    ? formatCollectiviteOfferedBy(page.collectivite.name)
    : t('collectiviteClubs.detail.theCity', 'la Ville');
  const villeEnTete = ville.charAt(0).toUpperCase() + ville.slice(1);
  // L ecusson de la Ville (design : une initiale) : « Ville de Montrivage » -> « M ».
  const initiale = String(page?.collectivite?.name || '?')
    .replace(/^(Ville|Commune) (de |d['’]|du |des )/u, '')
    .charAt(0)
    .toUpperCase();
  const installations = Array.isArray(page?.installations) ? page.installations : [];

  const inscrireMonClub = () => {
    if (!connecte) {
      openPublicAuthFlow(navigation);
      return;
    }
    /** @type {any} */ (navigation).navigate(RouteNames.ClubStack, {
      params: { entry: 'collectivite-invitation' },
      screen: RouteNames.ClubWizardName,
    });
  };
  const monClubEstDejaLa = () => {
    if (!connecte) {
      openPublicAuthFlow(navigation);
      return;
    }
    /** @type {any} */ (navigation).navigate(RouteNames.CollectiviteJoinRequest, { token });
  };

  if (apercu.isLoading) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <Loader />
      </ScreenContainer>
    );
  }

  if (apercu.error || !page) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <View style={[Spaces.padding[24], { gap: 8 }]}>
          <Text accessibilityRole="header" style={[Fonts.h3Black, Fonts.neutral00]}>
            {t('collectiviteClubs.join.invalidTitle', 'Ce lien d’invitation ne marche plus.')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'collectiviteClubs.join.invalidBody',
              'La Ville l’a peut-être changé : demande-lui le nouveau lien.',
            )}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const gains = [
    t(
      'collectiviteClubs.join.gainSlots',
      // eslint-disable-next-line max-len
      'demander un créneau dans les installations de la Ville, et voir tout de suite s’il reste de la place ;',
    ),
    t('collectiviteClubs.join.gainPlanning', 'voir leur planning et les heures libres ;'),
    t(
      'collectiviteClubs.join.gainNews',
      'recevoir les actualités de la Ville : fermetures, subventions, forums.',
    ),
  ];

  const invitation = (
    <View style={{ flex: 1, gap: 16 }}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: withAlpha(Colors.primary500, 0.2),
          borderRadius: 16,
          height: 56,
          justifyContent: 'center',
          width: 56,
        }}
      >
        <Text style={[Fonts.h3Black, Fonts.neutral00]}>
          {initiale}
        </Text>
      </View>
      <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
        {t(
          'collectiviteClubs.join.title',
          '{{ville}} t’invite à inscrire ton club sur FoundClub',
          { ville: villeEnTete, ...SANS_ECHAPPEMENT },
        )}
      </Text>
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {t(
          'collectiviteClubs.join.gainsIntro',
          'Une fois ton club rattaché à la Ville, tu pourras :',
        )}
      </Text>
      <View style={{ gap: 10 }}>
        {gains.map((gain) => (
          <View key={gain} style={[Alignments.row, { gap: 10 }]}>
            <View
              style={{
                backgroundColor: Colors.primary500,
                borderRadius: 4,
                height: 8,
                marginTop: 7,
                width: 8,
              }}
            />
            <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>{gain}</Text>
          </View>
        ))}
      </View>
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {t(
          'collectiviteClubs.join.clubToo',
          'Et pour ton club : planning, convocations, messages avec tes joueurs.',
        )}
      </Text>
      <View style={{ gap: 8 }}>
        <Button
          onPress={inscrireMonClub}
          title={t('collectiviteClubs.join.register', 'Inscrire mon club')}
        />
        <Button
          onPress={monClubEstDejaLa}
          title={t('collectiviteClubs.join.alreadyThere', 'Mon club est déjà sur FoundClub')}
          variant="Ghost"
        />
      </View>
    </View>
  );

  const lesInstallations = installations.length ? (
    <View style={{ flex: isDesktop ? 1 : undefined, gap: 10 }}>
      <Text accessibilityRole="header" style={[Fonts.p1Bold, Fonts.primary200]}>
        {t('collectiviteClubs.join.facilities', 'Les installations de la Ville')}
      </Text>
      {installations.map((/** @type {any} */ installation) => (
        <View
          key={`${installation?.name}-${installation?.type}`}
          style={[
            Spaces.padding[12],
            {
              backgroundColor: withAlpha(Colors.neutral00, 0.04),
              borderColor: withAlpha(Colors.neutral00, 0.09),
              borderRadius: 14,
              borderWidth: 1,
              gap: 2,
            },
          ]}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{installation?.name}</Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {[
              installation?.type ? getFacilityTypeLabel(installation.type) : null,
              Number.isInteger(installation?.maxSlots)
                ? t('collectiviteClubs.join.capacity', '{{nombre}} équipe(s) à la fois', {
                  nombre: installation.maxSlots,
                })
                : null,
              installation?.address || null,
            ].filter(Boolean).join(' · ')}
          </Text>
        </View>
      ))}
    </View>
  ) : null;

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={[
          { gap: 24, paddingBottom: 32, paddingTop: 32 },
          isDesktop ? { flexDirection: 'row', maxWidth: 1040, width: '100%' } : null,
        ]}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {invitation}
        {lesInstallations}
      </ScrollView>
    </ScreenContainer>
  );
}

export default CollectiviteJoin;
