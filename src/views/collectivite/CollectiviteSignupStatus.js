import {
  useFocusEffect, useNavigation, useRoute,
} from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  latestManagerRequest,
  pendingManagerRequests,
  recentRefusedManagerRequest,
} from '@/domains/collectivite/collectiviteAccueil';
import {
  collectiviteInitial,
  formatCollectiviteDay,
} from '@/domains/collectivite/collectiviteDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useMyCollectivites,
  useMyManagerRequests,
} from '@/services/collectivite/collectiviteQueries';

import { SUPPORT_CONTACT_MAILTO } from '@/config/legalUrls';

/**
 * 🏛️ OÙ EN EST MA DEMANDE — COLL-ACCUEIL (01/10/2026), planches `P1-inscription` (états 5
 * et 6) et `P2-gestion` (état 7, côté agent). Pas d'espace encore : pas de barre d'onglets.
 *   - juste envoyée : « Demande envoyée », ce qui va se passer, sans date promise ;
 *   - en attente : « Demande en cours de vérification », et ce que l'espace permettra ;
 *   - refusée : le motif de l'équipe, « Nous contacter » et « Refaire une demande » ;
 *   - acceptée : l'espace de la Ville s'ouvre.
 * VINSC2 (07/10, tournée T18) : une demande EN ATTENTE (et un refus de moins de 30 jours) se lit
 * quel que soit l'état principal — un gestionnaire de Montrivage qui demande Rouvres voit les deux.
 * Le serveur est le seul juge : l'écran lit `/collectivite-manager-requests/mine` et
 * `/collectivites/mine`, à chaque retour sur l'écran.
 * @returns {import('react').ReactElement} L'écran.
 */
function CollectiviteSignupStatus() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const params = /** @type {{ justSent?: boolean } | undefined} */ (route?.params);
  const [envoyeeVue, setEnvoyeeVue] = useState(!params?.justSent);

  const demandes = useMyManagerRequests();
  const villes = useMyCollectivites();
  const derniere = latestManagerRequest(demandes.data);
  const enAttente = pendingManagerRequests(demandes.data);
  const refusRecent = recentRefusedManagerRequest(demandes.data);
  const villeGeree = Array.isArray(villes.data) ? villes.data[0] : null;

  const relireDemandes = demandes.refetch;
  const relireVilles = villes.refetch;
  useFocusEffect(useCallback(() => {
    relireDemandes?.();
    relireVilles?.();
  }, [relireDemandes, relireVilles]));

  const contacter = () => {
    Promise.resolve(Linking.openURL(SUPPORT_CONTACT_MAILTO)).catch(() => {});
  };
  const ouvrirEspace = () => {
    if (!villeGeree?.documentId) return;
    const ecran = Platform.OS === 'web'
      ? RouteNames.CollectiviteHome
      : RouteNames.CollectiviteSpace;
    navigation.reset({
      index: 0,
      routes: [{ name: ecran, params: { collectiviteId: villeGeree.documentId } }],
    });
  };

  // Un voile du bleu de la marque sous les initiales : l encre blanche y reste lisible.
  const fondEcusson = withAlpha(Colors.primary500, 0.2);
  const carteStyle = {
    backgroundColor: withAlpha(Colors.primary700, 0.45),
    borderColor: withAlpha(Colors.primary500, 0.5),
    gap: 12,
  };

  const enTete = Platform.OS === 'web' ? null : (
    <View
      style={[
        Spaces.marginTop[16],
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween,
      ]}
    >
      <Image
        accessibilityLabel="FoundClub"
        resizeMode="contain"
        source={Images.logo}
        style={{ height: 26, width: 140 }}
      />
      <ProfileButton />
    </View>
  );

  const carteDemande = (/** @type {any} */ demande, /** @type {string} */ sousTitre) => (
    <View
      key={demande?.documentId}
      style={[ApplicationStyle.card, Spaces.padding[16], carteStyle]}
    >
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
        <View
          style={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            ApplicationStyle.borderRadius12,
            { backgroundColor: fondEcusson, height: 40, width: 40 },
          ]}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {/* SITE-VILLE-FINITIONS (T19) : la regle unique des collectivites (VT18E), comme la
                console ; « RE » pour « Ville de Rouvres T18 essai » (initiales d un club). */}
            {collectiviteInitial(demande?.collectivite?.name)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{demande?.collectivite?.name}</Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>{sousTitre}</Text>
        </View>
      </View>
      {demande?.status === 'refused' && demande?.refusalReason ? (
        <Text style={[Fonts.p2, Fonts.neutral100, { fontStyle: 'italic' }]}>
          {`« ${demande.refusalReason} »`}
        </Text>
      ) : (
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'collectiviteAccueil.demande.attente.texte',
            // eslint-disable-next-line max-len
            'L’équipe FoundClub vérifie que vous représentez bien la collectivité. Vous serez prévenu dans l’app dès que votre espace sera ouvert.',
          )}
        </Text>
      )}
    </View>
  );

  // La ligne sous le nom : la date de l'envoi (en attente) ou de la réponse (refusée).
  const sousTitreDe = (/** @type {any} */ demande) => (demande?.status === 'refused'
    ? t('collectiviteAccueil.demande.refusee.le', 'Réponse du {{date}}', {
      date: formatCollectiviteDay(demande?.decidedAt),
      ...SANS_ECHAPPEMENT,
    })
    : t('collectiviteAccueil.demande.attente.le', 'Demande envoyée le {{date}}', {
      date: formatCollectiviteDay(demande?.createdAt),
      ...SANS_ECHAPPEMENT,
    }));

  // VINSC2 — une demande à suivre à côté de l'état principal : son titre, puis sa carte.
  const suiviDeDemande = (/** @type {any} */ demande) => (
    <View
      key={demande?.documentId}
      style={{ gap: 8 }}
      testID={`collectivite-demande-suivi-${demande?.documentId}`}
    >
      <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
        {demande?.status === 'refused'
          ? t('collectiviteAccueil.demande.refusee.titre', 'Demande refusée')
          : t('collectiviteAccueil.demande.attente.titre', 'Demande en cours de vérification')}
      </Text>
      {carteDemande(demande, sousTitreDe(demande))}
    </View>
  );

  let contenu;
  // FINITIONS14 (T13-bis, planche 7, état 5) — le geste de l'écran « Demande envoyée » vit EN
  // PIED (`pied-fixe`), hors de la zone qui défile : il était collé sous le texte.
  let piedDePage = null;
  if (demandes.isLoading || villes.isLoading) {
    contenu = <Loader />;
  } else if (!envoyeeVue) {
    // État 5 : juste envoyée. Ce qui va se passer, en une phrase ; pas de date promise.
    contenu = (
      <View
        style={[Alignments.alignCenter, { gap: 20, paddingTop: 48 }]}
        testID="collectivite-demande-envoyee"
      >
        <View
          style={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            {
              backgroundColor: withAlpha(Colors.success500, 0.18),
              borderRadius: 40,
              height: 80,
              width: 80,
            },
          ]}
        >
          <Image
            source={Images.check}
            style={{ height: 32, tintColor: Colors.success500, width: 32 }}
          />
        </View>
        <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00, Fonts.textCenter]}>
          {t('collectiviteAccueil.demande.envoyee.titre', 'Demande envoyée')}
        </Text>
        <Text style={[Fonts.p1, Fonts.neutral200, Fonts.textCenter]}>
          {t(
            'collectiviteAccueil.demande.envoyee.texte',
            // eslint-disable-next-line max-len
            'L’équipe FoundClub vérifie que vous représentez bien la {{nom}}, puis vous nomme gestionnaire. Vous serez prévenu dans l’app.',
            { nom: derniere?.collectivite?.name || '', ...SANS_ECHAPPEMENT },
          )}
        </Text>
      </View>
    );
    piedDePage = (
      <View
        style={{
          alignSelf: 'center', maxWidth: 640, paddingTop: 12, width: '100%',
        }}
        testID="collectivite-demande-envoyee-pied"
      >
        <Button
          onPress={() => setEnvoyeeVue(true)}
          title={t('collectiviteAccueil.demande.envoyee.compris', 'Compris')}
          variant="Primary"
        />
      </View>
    );
  } else if (villeGeree?.documentId) {
    // Acceptée : l'espace est ouvert.
    contenu = (
      <View style={{ gap: 16 }} testID="collectivite-demande-acceptee">
        <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
          {t('collectiviteAccueil.demande.acceptee.titre', 'Votre espace est ouvert')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'collectiviteAccueil.demande.acceptee.texte',
            'Vous gérez désormais la {{nom}} sur FoundClub.',
            { nom: villeGeree.name || '', ...SANS_ECHAPPEMENT },
          )}
        </Text>
        <Button
          onPress={ouvrirEspace}
          title={t('collectiviteAccueil.demande.acceptee.ouvrir', 'Ouvrir mon espace')}
          variant="Primary"
        />
        {/* VINSC2 (T18) — une demande pour une AUTRE collectivité ne disparaît pas. */}
        {[...enAttente, ...(refusRecent ? [refusRecent] : [])].map(suiviDeDemande)}
      </View>
    );
  } else if (derniere?.status === 'refused') {
    contenu = (
      <View style={{ gap: 20 }} testID="collectivite-demande-refusee">
        <View style={{ gap: 4 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t('collectivite.home.kicker', 'Ma collectivité').toUpperCase()}
          </Text>
          <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('collectiviteAccueil.demande.refusee.titre', 'Demande refusée')}
          </Text>
        </View>
        {carteDemande(derniere, sousTitreDe(derniere))}
        <View style={[Alignments.row, Alignments.wrap, { gap: 12 }]}>
          <Button
            onPress={contacter}
            title={t('collectiviteAccueil.nousContacter', 'Nous contacter')}
            variant="Secondary"
          />
          <Button
            onPress={() => navigation.navigate(RouteNames.CollectiviteSignup)}
            title={t('collectiviteAccueil.demande.refusee.refaire', 'Refaire une demande')}
            variant="Secondary"
          />
        </View>
        {/* VINSC2 — une demande plus ancienne, encore en attente, se lit aussi. */}
        {enAttente.map(suiviDeDemande)}
      </View>
    );
  } else if (derniere) {
    // État 6 : en attente. Où en est la demande, et ce que l'espace permettra.
    const promesses = [
      {
        cle: 'demandes',
        icone: Images.envelope,
        texte: t(
          'collectiviteAccueil.demande.attente.demandes',
          'Trancher les demandes de créneau des clubs, avec un message.',
        ),
      },
      {
        cle: 'planning',
        icone: Images.calendar,
        texte: t(
          'collectiviteAccueil.demande.attente.planning',
          'Voir qui occupe vos installations, jour par jour.',
        ),
      },
      {
        cle: 'clubs',
        icone: Images.users,
        texte: t(
          'collectiviteAccueil.demande.attente.clubs',
          'Retrouver le contact général des clubs rattachés.',
        ),
      },
    ];
    contenu = (
      <View style={{ gap: 24 }} testID="collectivite-demande-attente">
        <View style={{ gap: 4 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t('collectivite.home.kicker', 'Ma collectivité').toUpperCase()}
          </Text>
          <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('collectiviteAccueil.demande.attente.titre', 'Demande en cours de vérification')}
          </Text>
        </View>
        {/* VINSC2 — chaque demande en attente, la plus récente d'abord. */}
        {(enAttente.length > 0 ? enAttente : [derniere])
          .map((demande) => carteDemande(demande, sousTitreDe(demande)))}
        <View style={{ gap: 12 }}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t('collectiviteAccueil.demande.attente.permettra', 'Ce que votre espace permettra')}
          </Text>
          {promesses.map((promesse) => (
            <View
              key={promesse.cle}
              style={[Alignments.row, { alignItems: 'flex-start', gap: 10 }]}
            >
              <Image
                source={promesse.icone}
                style={[
                  ApplicationStyle.icon16,
                  ApplicationStyle.tintColor.primary200,
                  { marginTop: 3 },
                ]}
              />
              <Text style={[Fonts.p2, Fonts.neutral200, { flex: 1 }]}>{promesse.texte}</Text>
            </View>
          ))}
        </View>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            onPress={contacter}
            title={t('collectiviteAccueil.nousContacter', 'Nous contacter')}
            variant="Secondary"
          />
        </View>
      </View>
    );
  } else {
    contenu = (
      <View style={{ gap: 16 }} testID="collectivite-demande-aucune">
        <Text style={[Fonts.p1, Fonts.neutral200]}>
          {t('collectiviteAccueil.demande.aucune', 'Aucune demande en cours.')}
        </Text>
        <Button
          onPress={() => navigation.navigate(RouteNames.CollectiviteSignup)}
          title={t('collectiviteAccueil.demande.faire', 'Faire une demande')}
          variant="Primary"
        />
      </View>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Spaces.paddingBottom[24], Alignments.fill]}
    >
      {enTete}
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center', gap: 24, maxWidth: 640, paddingTop: 16, width: '100%',
        }}
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => {
              relireDemandes?.();
              relireVilles?.();
            }}
            refreshing={Boolean(demandes.isRefetching || villes.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
      >
        {contenu}
      </ScrollView>
      {piedDePage}
    </ScreenContainer>
  );
}

export default CollectiviteSignupStatus;
