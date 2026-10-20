import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  availableHomeActions,
  clePremierPas,
  clubInitials,
  clubTotals,
  firstFullMoment,
  formatWeekMoment,
  homeActionTarget,
  isOwnClubRequest,
  oldestPendingRequest,
  premiersPas,
  seasonSlotsSeen,
  summarizeConflict,
} from '@/domains/collectivite/collectiviteAccueil';
import {
  dureeLisible,
  phraseOccupation,
  seancesDeLInstallation,
} from '@/domains/collectivite/collectiviteChiffres';
import { findManagedCollectivite, formatSlot } from '@/domains/collectivite/collectiviteDisplay';
import { checkDayMonth } from '@/domains/facilityCheck/facilityCheckDisplay';
import {
  closureDaysLabel,
  closureHoursLabel,
  closureTagLabel,
} from '@/domains/facilityClosure/facilityClosureDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import ScreenContainer from '@/components/templates/ScreenContainer';
// 📰 COLL-C4A (02/10) — « Actualités de la Ville », à la place laissée par COLL-ACCUEIL, et
// le bandeau « Votre actualité · en ligne » (planche P3b-bandeau-tel, écran 1).
import ActualitesDeLaVille from '@/views/collectivite/components/ActualitesDeLaVille';
import { BandeauActualiteMairie } from '@/views/collectivite/components/BandeauActualiteVille';
import DecisionCreneauModal from '@/views/collectivite/components/DecisionCreneauModal';
import JaugeOccupation from '@/views/collectivite/components/JaugeOccupation';

import { RouteNames } from '@/navigation/routeNames';

import { useCollectiviteActualites } from '@/services/collectivite/collectiviteActualiteQueries';
import {
  useCollectiviteChiffres,
  useCollectiviteClubs,
  useCollectiviteInstallations,
  useCollectiviteRequests,
  useCollectiviteWeek,
  useMyCollectivites,
} from '@/services/collectivite/collectiviteQueries';
import {
  useCollectiviteFacilityChecksSummary,
} from '@/services/facilityCheck/facilityCheckQueries';
import { useCollectiviteClosures } from '@/services/facilityClosure/facilityClosureQueries';
import {
  useCollectiviteFacilityReportsSummary,
} from '@/services/facilityReport/facilityReportQueries';

import { SUPPORT_CONTACT_MAILTO } from '@/config/legalUrls';
import { getItem, setItem } from '@/platform/storage';

// Largeur à partir de laquelle l'accueil passe en colonnes (planche « ordinateur », 900 px de
// contenu utile à côté du menu latéral du site).
const LARGEUR_COLONNES = 1024;

/** @typedef {{ kind: 'approve' | 'refuse', request: any }} Decision */

/**
 * 🏛️ L'ACCUEIL DE LA VILLE — COLL-ACCUEIL (01/10/2026), version 2 du design validé
 * (artefact HY521H1, planches `P3v2-accueil-tel` et `P3v2-accueil-ordi`).
 *
 * Il part de ce que FAIT une collectivité (planche « Ce que fait une collectivité »,
 * SPEC §2 A-H) : ce qui l'attend (la plus ancienne demande, à trancher d'ici), ses actions,
 * la vision de sa semaine (installation par installation) et de ses clubs (des NOMBRES,
 * jamais une personne de club : SPEC §2 H), puis ses actualités (lot C4a, place réservée).
 *
 * Chaque bloc lit le serveur à part et se dit seul en panne : une lecture qui échoue
 * n'éteint pas l'écran. Le serveur est le seul juge : un compte qui n'est pas gestionnaire
 * de CETTE collectivité ne la trouve pas dans `/collectivites/mine`, et lit « Accès retiré ».
 *
 * Paramètres de route : `collectiviteId` ; `space` (vrai dans l'espace de la Ville, qui
 * cache l'en-tête de la pile : l'écran pose alors le sien, logo, cloche, Mon compte) ;
 * `returnLabel` (compte mixte : le nom de son club, pour « ‹ AS Montrivage »).
 * @returns {import('react').ReactElement} L'écran.
 */
function CollectiviteHome() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  /** @type {{ collectiviteId?: string, returnLabel?: string, space?: boolean } | undefined} */
  const routeParams = (route?.params);
  const collectiviteId = routeParams?.collectiviteId || null;
  const { width } = useWindowDimensions();
  const enColonnes = width >= LARGEUR_COLONNES;
  const [decision, setDecision] = useState(/** @type {Decision | null} */ (null));
  const { userData } = useAuth();

  // Ce que l'accueil retient POUR CE COMPTE ET CETTE VILLE, sur l'appareil : le mot d'accueil
  // déjà lu, la liste des clubs déjà ouverte (2e premier pas), le guide masqué.
  // ponytail: retenu sur l'appareil, pas au serveur — un autre téléphone revoit le guide une
  // fois ; voie de sortie : un champ du compte si les agents changent souvent d'appareil.
  const cleRetenue = (/** @type {string} */ nom) => (
    clePremierPas(nom, userData?.documentId, collectiviteId)
  );
  const lireRetenu = (/** @type {string} */ nom) => {
    try {
      return getItem(cleRetenue(nom)) === '1';
    } catch {
      return false;
    }
  };
  const retenir = (/** @type {string} */ nom) => {
    try {
      setItem(cleRetenue(nom), '1');
    } catch {
      // Sans stockage, l'accueil reste juste : il redira seulement le guide.
    }
  };
  const [bienvenue] = useState(() => !lireRetenu('bienvenue-vue'));
  const [clubsVus, setClubsVus] = useState(() => lireRetenu('clubs-vus'));
  const [guideMasque, setGuideMasque] = useState(() => lireRetenu('guide-masque'));
  // Le mot d'accueil se lit UNE fois : dès son premier affichage, il est retenu.
  useEffect(() => {
    if (bienvenue && collectiviteId && userData?.documentId) retenir('bienvenue-vue');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bienvenue, collectiviteId, userData?.documentId]);

  const mine = useMyCollectivites();
  const collectivite = findManagedCollectivite(mine.data, collectiviteId);
  const pending = useCollectiviteRequests(collectiviteId, 'pending');
  const installations = useCollectiviteInstallations(collectiviteId);
  const clubs = useCollectiviteClubs(collectiviteId);
  const semaine = useCollectiviteWeek(installations.data, { enabled: Boolean(collectivite) });
  // COLL-C5 (03/10) — planches 2 et 3 : la jauge lit le TAUX de la semaine (contrat §5), la meme
  // lecture que la page « Chiffres ». Seulement pour le gestionnaire de CETTE Ville.
  const chiffresSemaine = useCollectiviteChiffres(collectivite ? collectiviteId : null, 'semaine');
  // COLL-C4A : le 4e premier pas (« Présentez-vous aux clubs ») se coche à la 1re actualité.
  const actualitesEnLigne = useCollectiviteActualites(collectiviteId);
  // COLL-C4B (02/10) — « Fermeture à venir » (P3v2-accueil, point d accroche de COLL-ACCUEIL) :
  // ce qui dure ou vient, toutes installations ; les deux premières.
  const fermetures = useCollectiviteClosures(collectiviteId);
  // R17-SIGNALER-1 (19/10, planche P11-securite-ou-ca-vit 1) — « Ce qui vous attend » gagne les
  // signalements à traiter (« Envoyé »). Seulement pour le gestionnaire de CETTE Ville.
  const signalements = useCollectiviteFacilityReportsSummary(collectivite ? collectiviteId : null);
  // R17-CONTROLES (20/10, Q6 B) — les controles a refaire dans les 30 jours, ou en retard.
  const controles = useCollectiviteFacilityChecksSummary(collectivite ? collectiviteId : null);
  // VILLE-T18B (c) (T18, G42b) — les deux premières, et « Voir les N fermetures à venir » les
  // montre toutes : couper à deux sans rien de plus en faisait disparaître (Stade, 8 oct.).
  const [toutesLesFermetures, setToutesLesFermetures] = useState(false);
  const listeDesFermetures = Array.isArray(fermetures.data?.data) ? fermetures.data.data : [];
  const fermeturesAVenir = toutesLesFermetures
    ? listeDesFermetures
    : listeDesFermetures.slice(0, 2);

  const refetchPending = pending.refetch;
  // Au retour d'une demande tranchée, le compteur doit déjà être juste.
  // FINITIONS18 · POINT 10 (T16) — et « Verifiez vos clubs » se relit : la liste des clubs a pu
  // etre ouverte par une autre entree (le menu de la Ville du site) ; elle coche la meme cle.
  useFocusEffect(useCallback(() => {
    refetchPending?.();
    if (lireRetenu('clubs-vus')) setClubsVus(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchPending, userData?.documentId, collectiviteId]));

  const ouvrir = (/** @type {string} */ ecran, /** @type {Record<string, any>} */ extra = {}) => {
    // Ouvrir la liste des clubs rattachés coche le 2e premier pas (« Vérifiez vos clubs »).
    if (ecran === RouteNames.CollectiviteClubs && !clubsVus) {
      retenir('clubs-vus');
      setClubsVus(true);
    }
    navigation.navigate(ecran, { collectiviteId, ...extra });
  };
  const contacter = () => {
    Promise.resolve(Linking.openURL(SUPPORT_CONTACT_MAILTO)).catch(() => {});
  };

  const carteStyle = {
    backgroundColor: withAlpha(Colors.primary700, 0.45),
    borderColor: withAlpha(Colors.primary500, 0.5),
    gap: 10,
  };
  const verreStyle = {
    backgroundColor: withAlpha(Colors.neutral00, 0.04),
    borderColor: withAlpha(Colors.neutral00, 0.09),
    borderWidth: 1,
  };

  if (mine.isLoading) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Alignments.fill, Alignments.justifyCenter]}
      >
        <Loader />
      </ScreenContainer>
    );
  }

  // Refus d'accès : le compte n'est (plus) gestionnaire. Il le lit en clair, et sait à qui écrire.
  if (!collectivite) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Alignments.fill, Alignments.justifyCenter, Spaces.padding[24]]}
      >
        <View
          style={[ApplicationStyle.card, Spaces.padding[24], Alignments.alignCenter, carteStyle]}
          testID="collectivite-home-refus"
        >
          <Image
            source={Images.flag}
            style={[{ height: 40, width: 40 }, ApplicationStyle.tintColor.primary200]}
          />
          <Text style={[Fonts.h3Black, Fonts.neutral00, Fonts.textCenter]}>
            {t('collectiviteAccueil.refus.titre', 'Accès retiré')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200, Fonts.textCenter]}>
            {t(
              'collectiviteAccueil.refus.texte',
              // eslint-disable-next-line max-len
              'Vous ne gérez pas cette collectivité. Si c’est une erreur, écrivez à l’équipe FoundClub : elle vous rattache à nouveau.',
            )}
          </Text>
          <Button
            onPress={contacter}
            title={t('collectiviteAccueil.nousContacter', 'Nous contacter')}
            variant="Secondary"
          />
        </View>
      </ScreenContainer>
    );
  }

  const demandes = Array.isArray(pending.data) ? pending.data : [];
  const enTete = oldestPendingRequest(demandes);
  // Sur ordinateur, la colonne « Ce qui vous attend » montre aussi la suivante (compacte).
  const deuxieme = enColonnes
    ? oldestPendingRequest(demandes.filter((demande) => demande !== enTete))
    : null;
  const actions = availableHomeActions();
  const totaux = clubTotals(clubs.data);
  const listeClubs = Array.isArray(clubs.data) ? clubs.data : [];

  const refreshing = Boolean(
    pending.isRefetching || installations.isRefetching || clubs.isRefetching,
  );
  const onRefresh = () => {
    pending.refetch?.();
    installations.refetch?.();
    clubs.refetch?.();
    semaine.forEach(({ query }) => query?.refetch?.());
    // VILLE-T18B (b) — « Chiffres » aussi : une installation créée pendant la visite y manquait
    // (sa ligne disait « — », tournée T18, G03b).
    chiffresSemaine.refetch?.();
  };

  const lienFleche = (
    /** @type {string} */ libelle,
    /** @type {string} */ testID,
    /** @type {() => void} */ onPress,
  ) => (
    <TouchableOpacity
      accessibilityRole="link"
      hitSlop={{
        bottom: 8, left: 8, right: 8, top: 8,
      }}
      onPress={onPress}
      style={[Alignments.row, Alignments.alignCenter, { gap: 4 }]}
      testID={testID}
    >
      <Text style={[Fonts.p2Bold, Fonts.primary500]}>{libelle}</Text>
      <Image
        source={Images.arrowRight}
        style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.primary500]}
      />
    </TouchableOpacity>
  );

  // 🎨 COLL-FIX2 (03/10), planche 2 (tournée T10) : « Vos clubs » s'affichait « Vos ». Un texte
  // GRAS de plusieurs mots, dans une boîte à sa largeur mesurée, perd son dernier mot sous
  // Android 16 (mémoire piege-android16-gras-dernier-mot-perdu) : la boîte est ÉTIRÉE.
  const titreSection = (/** @type {string} */ libelle) => (
    <Text
      accessibilityRole="header"
      style={[Fonts.h4Bold, Fonts.neutral00, { flexGrow: 1, flexShrink: 1 }]}
    >
      {libelle}
    </Text>
  );

  const squelette = (/** @type {number} */ hauteur) => (
    <View
      style={[
        ApplicationStyle.borderRadius16,
        { backgroundColor: withAlpha(Colors.neutral00, 0.06), height: hauteur },
      ]}
    />
  );

  // ── 1. CE QUI VOUS ATTEND ──────────────────────────────────────────────────────────────
  // COLL-ACCUEIL-BIS (03/10) — `compacte` : la 2e demande de la colonne « ordinateur »
  // (P3v2-accueil-ordi) ; elle se lit, elle se tranche dans « Demandes ».
  const renderCarteDemande = (/** @type {any} */ demande, compacte = false) => {
    const club = demande?.club?.name || t('collectivite.requests.unknownClub', 'Club');
    const equipe = demande?.team?.name;
    const personne = [demande?.requestedBy?.firstname, demande?.requestedBy?.lastname]
      .filter(Boolean).join(' ');
    // COLL-ACCUEIL-BIS — « Karim Benali, dirigeant » : la fonction que le serveur rend depuis
    // C3B (`requesterFunction`), avec les mots de l'écran « Demandes ».
    let fonction = '';
    if (demande?.requesterFunction === 'manager') {
      fonction = t('collectiviteDemandes.fonction.manager', 'dirigeant');
    } else if (demande?.requesterFunction === 'trainer') {
      fonction = t('collectiviteDemandes.fonction.trainer', 'coach / prof');
    }
    const auteur = personne ? [personne, fonction].filter(Boolean).join(', ') : '';
    const conflit = summarizeConflict(demande?.conflict);
    let pastille = null;
    if (conflit?.full) {
      pastille = {
        couleur: Colors.warning500,
        texte: t('collectiviteAccueil.attente.complet', 'Complet'),
      };
    } else if (conflit) {
      pastille = {
        couleur: Colors.success500,
        texte: conflit.remaining === 1
          ? t('collectiviteAccueil.attente.unePlaceLibre', '1 place libre')
          : t('collectiviteAccueil.attente.placesLibres', '{{nombre}} places libres', {
            nombre: conflit.remaining,
          }),
      };
    }
    return (
      <View
        style={[
          ApplicationStyle.card, Spaces.padding[16], carteStyle, compacte ? { gap: 4 } : null,
        ]}
        testID={compacte
          ? 'collectivite-home-attente-carte-compacte'
          : 'collectivite-home-attente-carte'}
      >
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00, { flex: 1 }]}>
            {equipe ? `${club} · ${equipe}` : club}
          </Text>
          {pastille ? (
            <View
              style={[
                ApplicationStyle.borderRadius12,
                {
                  backgroundColor: withAlpha(pastille.couleur, 0.16),
                  borderColor: withAlpha(pastille.couleur, 0.5),
                  borderWidth: 1,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                },
              ]}
            >
              <Text style={[Fonts.p3Bold, { color: pastille.couleur }]}>{pastille.texte}</Text>
            </View>
          ) : null}
        </View>
        {isOwnClubRequest(demande, userData) ? (
          <View
            style={[
              ApplicationStyle.borderRadius12,
              {
                alignSelf: 'flex-start',
                backgroundColor: withAlpha(Colors.neutral00, 0.08),
                paddingHorizontal: 8,
                paddingVertical: 2,
              },
            ]}
            testID="collectivite-home-votre-club"
          >
            <Text style={[Fonts.p3Bold, Fonts.neutral100]}>
              {t('collectiviteAccueil.attente.votreClub', 'Demande de votre club')}
            </Text>
          </View>
        ) : null}
        {auteur ? (
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('collectivite.requests.requestedBy', 'Demandé par {{name}}', {
              name: auteur,
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
        ) : null}
        <Text style={[Fonts.p2Bold, Fonts.primary200]}>
          {`${demande?.facility?.name || ''} · ${
            formatSlot(demande?.requestedStart, demande?.requestedEnd)}`}
        </Text>
        {/* VILLE-T18B point 2 (T18, G02) — la jauge ne vient qu'avec sa légende,
            « Accepter met… » : sur une demande qui a de la place, elle n'était que des pastilles
            grises sans mot, et la pastille d'en-tête dit déjà « 2 places libres » (planche
            P3v2-accueil : Complet seul). */}
        {conflit?.full && !compacte ? (
          <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
            <View
              accessibilityLabel={t(
                'collectiviteAccueil.attente.placesPrises',
                '{{prises}} places prises sur {{total}}',
                { prises: conflit.taken, total: conflit.maxSlots, ...SANS_ECHAPPEMENT },
              )}
              accessible
              style={[Alignments.row, { gap: 4 }]}
            >
              {Array.from({ length: conflit.maxSlots }, (_valeur, index) => (
                <View
                  key={index}
                  style={{
                    backgroundColor: index < conflit.taken
                      ? Colors.warning500
                      : withAlpha(Colors.neutral00, 0.12),
                    borderRadius: 3,
                    height: 10,
                    width: 18,
                  }}
                />
              ))}
            </View>
            <Text style={[Fonts.p3, Fonts.neutral200, { flex: 1 }]}>
              {t(
                'collectiviteAccueil.attente.accepterMet',
                'Accepter met {{equipes}} équipes pour {{places}} places.',
                {
                  equipes: conflit.teamsIfAccepted,
                  places: conflit.maxSlots,
                  ...SANS_ECHAPPEMENT,
                },
              )}
            </Text>
          </View>
        ) : null}
        {compacte ? null : (
          <View style={[Alignments.row, { gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <Button
                onPress={() => setDecision({ kind: 'refuse', request: demande })}
                title={t('collectivite.requests.actions.refuse', 'Refuser')}
                variant="Secondary"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                onPress={() => setDecision({ kind: 'approve', request: demande })}
                title={t('collectivite.requests.actions.approve', 'Accepter')}
                variant="Primary"
              />
            </View>
          </View>
        )}
      </View>
    );
  };

  // COLL-C4B — une fermeture à venir : la toucher ouvre l onglet « Fermetures » de l installation.
  const carteDeFermeture = (/** @type {any} */ fermeture) => (
    <TouchableOpacity
      accessibilityRole="button"
      key={fermeture.documentId}
      onPress={() => ouvrir(RouteNames.CollectiviteInstallation, {
        facilityId: fermeture.facility?.documentId,
        onglet: 'fermetures',
      })}
      style={[
        ApplicationStyle.card,
        Spaces.padding[16],
        {
          backgroundColor: withAlpha(Colors.warning500, 0.08),
          borderColor: withAlpha(Colors.warning500, 0.45),
          gap: 4,
        },
      ]}
      testID={`collectivite-home-fermeture-${fermeture.documentId}`}
    >
      <Text style={[Fonts.p3Bold, { color: Colors.warning500 }]}>
        {t('collectiviteFermetures.accueil.aVenir', 'Fermeture à venir')}
      </Text>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{fermeture.facility?.name || ''}</Text>
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {[
          closureDaysLabel(t, fermeture),
          closureHoursLabel(t, fermeture),
          closureTagLabel(t, fermeture),
        ].filter(Boolean).join(' · ')}
      </Text>
      {/* FINITIONS11-COLL (03/10, planches 2-3) : qui est à prévenir, compté par le serveur
          (`touchedSessionsCount`) ; il ne dit rien (null) : la carte non plus. */}
      {typeof fermeture.touchedSessionsCount === 'number' ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {fermeture.touchedSessionsCount === 0
            ? t(
              'collectiviteFermetures.accueil.personneAPrevenir',
              'Aucun club n’y a de séance : personne à prévenir.',
            )
            // FINITIONS-VILLE (registre n° 50) : le serveur compte les blocs du planning, séances
            // ET créneaux sans séance — la répartition n'est pas connue ici (touchedCountLabel).
            : t('collectiviteFermetures.carte.seancesOuCreneaux', {
              count: fermeture.touchedSessionsCount,
              defaultValue_one: '{{count}} séance ou créneau touché',
              defaultValue_other: '{{count}} séances ou créneaux touchés',
            })}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
  const blocDesFermetures = fermeturesAVenir.length ? (
    <View style={{ gap: 8 }} testID="collectivite-home-fermetures">
      {fermeturesAVenir.map(carteDeFermeture)}
      {listeDesFermetures.length > fermeturesAVenir.length ? (
        <TouchableOpacity
          accessibilityRole="button"
          hitSlop={{
            bottom: 8, left: 8, right: 8, top: 8,
          }}
          onPress={() => setToutesLesFermetures(true)}
          style={{ alignSelf: 'flex-start' }}
          testID="collectivite-home-fermetures-toutes"
        >
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>
            {t(
              'collectiviteFermetures.accueil.voirToutes',
              'Voir les {{count}} fermetures à venir',
              { count: listeDesFermetures.length },
            )}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  ) : null;

  // R17-SIGNALER-1 — les signalements à traiter : le plus récent, et un appui l'ouvre.
  const aTraiter = Array.isArray(signalements.data?.meta?.toHandle)
    ? signalements.data.meta.toHandle
    : [];
  const nombreATraiter = Number(signalements.data?.meta?.toHandleCount) || aTraiter.length;
  const blocDesSignalements = aTraiter.length ? (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => ouvrir(RouteNames.FacilityReportDetails, {
        espace: 'ville',
        reportId: aTraiter[0].documentId,
      })}
      style={[
        ApplicationStyle.card,
        Spaces.padding[16],
        {
          backgroundColor: withAlpha(Colors.warning500, 0.08),
          borderColor: withAlpha(Colors.warning500, 0.45),
          gap: 4,
        },
      ]}
      testID="collectivite-home-signalements"
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {t('facilityReports.ville.accueil', { ...SANS_ECHAPPEMENT, count: nombreATraiter })}
      </Text>
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {t('facilityReports.ville.accueilDetail', {
          ...SANS_ECHAPPEMENT,
          category: t(
            `facilityReports.categoriesCourtes.${aTraiter[0].category}`,
            aTraiter[0].category,
          ),
          facility: aTraiter[0].facility?.name || '',
          title: aTraiter[0].title,
        })}
      </Text>
    </TouchableOpacity>
  ) : null;

  // R17-CONTROLES (20/10, REC17-011 lot 2, Q6 B ; planche P11-securite-ou-ca-vit porte 1) —
  // « Contrôle à refaire avant le 12 mars » : le plus urgent des controles a refaire dans les 30
  // jours (ou en retard), « n contrôles à refaire » s il y en a plusieurs ; un appui ouvre l onglet
  // « Sécurité et suivi » de SON installation.
  const aRefaire = Array.isArray(controles.data?.data) ? controles.data.data : [];
  const plusUrgent = aRefaire[0] || null;
  let titreDesControles = '';
  if (aRefaire.length > 1) {
    titreDesControles = t('facilityReports.controles.accueilPlusieurs', {
      ...SANS_ECHAPPEMENT,
      count: aRefaire.length,
    });
  } else if (plusUrgent) {
    titreDesControles = t(
      plusUrgent.state === 'en_retard'
        ? 'facilityReports.controles.accueilRetard'
        : 'facilityReports.controles.accueilAvant',
      { ...SANS_ECHAPPEMENT, date: checkDayMonth(plusUrgent.nextDue) },
    );
  }
  const blocDesControles = plusUrgent ? (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => ouvrir(RouteNames.CollectiviteInstallation, {
        facilityId: plusUrgent.facility?.documentId,
        onglet: 'securite',
      })}
      style={[
        ApplicationStyle.card,
        Spaces.padding[16],
        {
          backgroundColor: withAlpha(Colors.warning500, 0.08),
          borderColor: withAlpha(Colors.warning500, 0.45),
          gap: 4,
        },
      ]}
      testID="collectivite-home-controles"
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{titreDesControles}</Text>
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {t('facilityReports.controles.accueilDetail', {
          ...SANS_ECHAPPEMENT,
          facility: plusUrgent.facility?.name || '',
          label: plusUrgent.label,
        })}
      </Text>
    </TouchableOpacity>
  ) : null;

  const renderAttente = () => {
    if (pending.isLoading) {
      return (
        <View style={{ gap: 12 }}>
          {titreSection(t('collectiviteAccueil.attente.titre', 'Ce qui vous attend'))}
          {squelette(120)}
        </View>
      );
    }
    if (pending.error) {
      return (
        <View style={{ gap: 12 }}>
          {titreSection(t('collectiviteAccueil.attente.titre', 'Ce qui vous attend'))}
          <View
            accessibilityRole="alert"
            style={[
              ApplicationStyle.card,
              Spaces.padding[16],
              {
                backgroundColor: withAlpha(Colors.error500, 0.08),
                borderColor: withAlpha(Colors.error500, 0.4),
                gap: 8,
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t('collectiviteAccueil.attente.erreurTitre', 'Les demandes n’ont pas pu être lues.')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'collectiviteAccueil.attente.erreurTexte',
                'Vérifiez la connexion, puis réessayez. Rien n’a été perdu.',
              )}
            </Text>
            <View style={{ alignSelf: 'flex-start' }}>
              <Button
                onPress={() => pending.refetch?.()}
                title={t('collectiviteAccueil.reessayer', 'Réessayer')}
                variant="Secondary"
              />
            </View>
          </View>
        </View>
      );
    }
    // COLL-C4B — aucune demande, mais une fermeture à venir (R17-SIGNALER-1 : ou un signalement
    // à traiter) : elle seule attend.
    if (!enTete && (blocDesSignalements || blocDesControles || blocDesFermetures)) {
      return (
        <View style={{ gap: 12 }}>
          {titreSection(t('collectiviteAccueil.attente.titre', 'Ce qui vous attend'))}
          {blocDesSignalements}
          {blocDesControles}
          {blocDesFermetures}
        </View>
      );
    }
    if (!enTete) {
      return (
        <View
          style={[
            ApplicationStyle.card,
            Spaces.padding[16],
            Alignments.row,
            Alignments.alignCenter,
            verreStyle,
            { gap: 12 },
          ]}
          testID="collectivite-home-rien"
        >
          <Image
            source={Images.check}
            style={[ApplicationStyle.icon16, { tintColor: Colors.success500 }]}
          />
          <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>
            {t(
              'collectiviteAccueil.attente.rien',
              'Rien ne vous attend : aucune demande, aucune fermeture prévue.',
            )}
          </Text>
        </View>
      );
    }
    return (
      <View style={{ gap: 12 }}>
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
          {titreSection(t('collectiviteAccueil.attente.titre', 'Ce qui vous attend'))}
          <View
            accessibilityLabel={demandes.length === 1
              ? t('collectiviteAccueil.attente.compteurA11yUne', '1 demande en attente')
              : t(
                'collectiviteAccueil.attente.compteurA11y',
                '{{nombre}} demandes en attente',
                { nombre: demandes.length },
              )}
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              {
                // Même jeton que la pastille de la cloche (NotificationBadge) : 5,2:1.
                backgroundColor: Colors.error700,
                borderRadius: 999,
                minWidth: 24,
                paddingHorizontal: 6,
              },
            ]}
            testID="collectivite-home-attente-compteur"
          >
            <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{String(demandes.length)}</Text>
          </View>
        </View>
        {renderCarteDemande(enTete)}
        {deuxieme ? renderCarteDemande(deuxieme, true) : null}
        <View style={{ alignSelf: 'flex-start' }}>
          {lienFleche(
            demandes.length === 1
              ? t('collectiviteAccueil.attente.voirUne', 'Voir la demande')
              : t('collectiviteAccueil.attente.voirToutes', 'Voir les {{nombre}} demandes', {
                nombre: demandes.length,
              }),
            'collectivite-home-voir-demandes',
            () => ouvrir(RouteNames.CollectiviteRequests),
          )}
        </View>
        {blocDesSignalements}
        {blocDesControles}
        {blocDesFermetures}
      </View>
    );
  };

  // ── 2. VOS ACTIONS ─────────────────────────────────────────────────────────────────────
  const texteAction = (/** @type {string} */ cle) => {
    switch (cle) {
      // R17-EVT-1 (20/10) — la 7e action (planche P11-evenement-ou-ca-vit).
      case 'addEvent':
        return {
          dit: t('collectiviteAccueil.actions.addEvent.dit', 'Fête du sport, tournoi, réunion.'),
          titre: t('collectiviteAccueil.actions.addEvent.titre', 'Ajouter un événement'),
        };
      case 'assignSlot':
        return {
          dit: t(
            'collectiviteAccueil.actions.assignSlot.dit',
            'Une installation, un jour, un club, toute la saison.',
          ),
          titre: t('collectiviteAccueil.actions.assignSlot.titre', 'Attribuer un créneau'),
        };
      case 'blockSlot':
        return {
          dit: t('collectiviteAccueil.actions.blockSlot.dit', 'Forum, manifestation de la Ville.'),
          titre: t('collectiviteAccueil.actions.blockSlot.titre', 'Bloquer un créneau'),
        };
      case 'closeInstallation':
        return {
          dit: t(
            'collectiviteAccueil.actions.closeInstallation.dit',
            'Vacances, travaux : les clubs sont prévenus.',
          ),
          titre: t(
            'collectiviteAccueil.actions.closeInstallation.titre',
            'Fermer une installation',
          ),
        };
      case 'inviteClub':
        return {
          dit: t(
            'collectiviteAccueil.actions.inviteClub.dit',
            'Le trouver sur FoundClub, ou l’inviter.',
          ),
          titre: t('collectiviteAccueil.actions.inviteClub.titre', 'Inviter un club'),
        };
      case 'publishNews':
        return {
          dit: t(
            'collectiviteAccueil.actions.publishNews.dit',
            'Lue par tous les membres de vos clubs.',
          ),
          titre: t('collectiviteAccueil.actions.publishNews.titre', 'Publier une actualité'),
        };
      default:
        return {
          dit: t('collectiviteAccueil.actions.addInstallation.dit', 'Gymnase, terrain, salle.'),
          titre: t('collectiviteAccueil.actions.addInstallation.titre', 'Ajouter une installation'),
        };
    }
  };

  const renderActions = () => (
    <View style={{ gap: 12 }}>
      {titreSection(t('collectiviteAccueil.actions.titre', 'Vos actions'))}
      <View style={[Alignments.row, Alignments.wrap, { gap: 12 }]}>
        {actions.map((action, index) => {
          const texte = texteAction(action.key);
          const cible = homeActionTarget(action, installations.data);
          return (
            <TouchableOpacity
              accessibilityRole="button"
              key={action.key}
              onPress={() => ouvrir(cible.route, cible.params)}
              style={[
                ApplicationStyle.card,
                Spaces.padding[16],
                carteStyle,
                {
                  // La première action est la plus forte (la planche la borde de bleu).
                  borderColor: index === 0 ? Colors.primary500 : carteStyle.borderColor,
                  flexBasis: 150,
                  flexGrow: 1,
                  minHeight: 112,
                },
                // COLL-ACCUEIL-BIS (03/10), P3v2-accueil-ordi : les six actions en UNE rangée de
                // parts égales, l'icône à gauche du titre. FINITIONS16 21 (T15, 1 280 px) : la
                // carte fait 150 px ; un cadre serré laisse 94 px au titre, il tient sur deux
                // lignes (« Attribuer un » = 90,6 px en Montserrat gras 14).
                // R17-EVT-1-BIS (i) (20/10) : 7 actions, DEUX rangées (4 puis 3) ; une seule
                // repliait les libellés sur 3 lignes à 1 360 px. Un quart chacune, les 3 dernières
                // s élargissent.
                enColonnes ? {
                  alignItems: 'center',
                  flexBasis: '22%',
                  flexDirection: 'row',
                  gap: 8,
                  minHeight: 56,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                } : null,
              ]}
              testID={`collectivite-home-action-${action.key}`}
            >
              <View
                style={[
                  Alignments.alignCenter,
                  Alignments.justifyCenter,
                  ApplicationStyle.borderRadius12,
                  {
                    backgroundColor: withAlpha(Colors.primary500, 0.18),
                    height: enColonnes ? 28 : 36,
                    width: enColonnes ? 28 : 36,
                  },
                ]}
              >
                <Image
                  source={/** @type {any} */ (Images)[action.icon]}
                  style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.primary200]}
                />
              </View>
              <Text style={[Fonts.p2Bold, Fonts.neutral00, enColonnes ? { flexShrink: 1 } : null]}>
                {texte.titre}
              </Text>
              {enColonnes ? null : (
                <Text style={[Fonts.p3, Fonts.neutral300]}>{texte.dit}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ── 3. CETTE SEMAINE ───────────────────────────────────────────────────────────────────
  // 🧮 FINITIONS12-COLL (03/10) — MÊME MOT, MÊME NOMBRE (tournée T11, C02_4 / C30_1) : le nombre
  // de séances de la semaine est celui de « Chiffres » (`seances` de la ligne : tenues + à venir,
  // admin docs/CONTRAT_CHIFFRES_VILLE.md §5), la même lecture que le taux. Avant : les BLOCS du
  // planning, créneaux compris (« 14 séances » contre 10) ; un créneau n'est pas une séance (§1).
  // FINITIONS13-COLL (04/10) : la règle est partagée avec la liste des installations.
  const seancesSelonChiffres = (/** @type {string | undefined} */ facilityId) => (
    seancesDeLInstallation(chiffresSemaine.data, facilityId)
  );
  const libelleSeances = (/** @type {string | undefined} */ facilityId) => {
    if (chiffresSemaine.isLoading) return '…';
    const total = seancesSelonChiffres(facilityId);
    if (total === null) return '—';
    if (total === 0) return t('collectiviteAccueil.semaine.aucuneSeance', 'Aucune séance');
    if (total === 1) return t('collectiviteAccueil.semaine.uneSeance', '1 séance');
    return t('collectiviteAccueil.semaine.seances', '{{nombre}} séances', { nombre: total });
  };

  // La ligne de « Chiffres » d'une installation, ou null tant qu'elle ne se lit pas.
  const ligneDeLaSemaine = (/** @type {string | undefined} */ facilityId) => {
    const lignes = /** @type {any} */ (chiffresSemaine.data)?.installations;
    return Array.isArray(lignes) ? lignes.find((l) => l?.documentId === facilityId) || null : null;
  };

  // COLL-C5 (03/10) : le taux d une installation, ou null (jamais un 0 invente).
  const tauxDeLaSemaine = (/** @type {string | undefined} */ facilityId) => {
    const ligne = ligneDeLaSemaine(facilityId);
    return typeof ligne?.taux === 'number' ? ligne.taux : null;
  };

  // 🧮 VILLE-T18B (b) (07/10) — décision du chef d'orchestre (tournée T18, G03b) : une installation
  // LUE sans taux (sans horaires : les horaires sont retirés, décision d'Adel) n'a pas de jauge
  // vide « Occupation : — » ; sa ligne dit ce qui se mesure sans eux, les heures réservées.
  const sansTauxMesurable = (/** @type {string | undefined} */ facilityId) => (
    Boolean(ligneDeLaSemaine(facilityId)) && tauxDeLaSemaine(facilityId) === null
  );

  // La planche dit « occupation » seulement quand il y a des séances (sinon « Aucune séance »).
  const seancesDansLaSemaine = (/** @type {string | undefined} */ facilityId) => (
    seancesSelonChiffres(facilityId) || 0
  );

  const libelleDeLaSemaine = (/** @type {string | undefined} */ facilityId) => {
    if (seancesDansLaSemaine(facilityId) === 0) return libelleSeances(facilityId);
    if (!sansTauxMesurable(facilityId)) {
      const occupation = phraseOccupation(
        t,
        tauxDeLaSemaine(facilityId),
        ligneDeLaSemaine(facilityId)?.sur24h === true,
      );
      return `${libelleSeances(facilityId)} · ${occupation}`;
    }
    const minutes = ligneDeLaSemaine(facilityId)?.minutes;
    if (typeof minutes !== 'number') return libelleSeances(facilityId);
    return `${libelleSeances(facilityId)} · ${t(
      'collectiviteAccueil.semaine.reservees',
      '{{duree}} réservées cette semaine',
      { duree: dureeLisible(minutes), ...SANS_ECHAPPEMENT },
    )}`;
  };

  const renderSemaine = () => {
    let corps;
    if (installations.isLoading) corps = squelette(96);
    else if (installations.error) {
      corps = <Text style={[Fonts.p2, Fonts.neutral200]}>—</Text>;
    } else if (semaine.length === 0) {
      corps = (
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'collectiviteAccueil.semaine.aucuneInstallation',
            'Aucune installation pour l’instant.',
          )}
        </Text>
      );
    } else {
      corps = (
        <View style={[ApplicationStyle.card, Spaces.padding[16], carteStyle, { gap: 14 }]}>
          {semaine.map(({ installation, query }) => {
            const blocs = Array.isArray(query?.data?.data) ? query.data.data : [];
            const complet = firstFullMoment(blocs, installation?.maxSlots);
            let etat = null;
            if (complet) {
              etat = (
                <Text style={[Fonts.p3Bold, Fonts.warning500]}>
                  {t('collectiviteAccueil.semaine.complet', 'complet {{moment}}', {
                    moment: formatWeekMoment(complet),
                    ...SANS_ECHAPPEMENT,
                  })}
                </Text>
              );
            } else if (!query?.isLoading && !query?.error && blocs.length === 0) {
              etat = (
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {t('collectiviteAccueil.semaine.libre', 'libre')}
                </Text>
              );
            }
            // FINITIONS-VILLE (T20) : la ligne ouvre le planning de SA semaine (comme l'onglet
            // « Planning » de l'installation).
            return (
              <TouchableOpacity
                accessibilityRole="button"
                key={installation?.documentId}
                onPress={() => navigation.navigate(RouteNames.PlanningWeekFullscreen, {
                  contextDetailLabel: installation?.name || null,
                  espace: 'ville',
                  facilityId: installation?.documentId,
                  sourceType: 'facility',
                })}
                style={{ gap: 4 }}
                testID={`collectivite-home-semaine-${installation?.documentId}`}
              >
                <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
                  <View
                    style={{
                      backgroundColor: installation?.planningColor || Colors.primary500,
                      borderRadius: 5,
                      height: 10,
                      width: 10,
                    }}
                  />
                  <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
                    {installation?.name}
                  </Text>
                  {etat}
                </View>
                {/* COLL-C5 (03/10) — planches 2 et 3 : la jauge d'occupation de la semaine */}
                {/* (contrat §5) ; lecture en cours ou en panne, elle reste vide et dit « — ». */}
                {/* VILLE-T18B (b) : lue SANS taux (pas d'horaires), pas de jauge du tout. */}
                {sansTauxMesurable(installation?.documentId) ? null : (
                  <JaugeOccupation
                    couleur={complet ? Colors.warning500 : installation?.planningColor}
                    taux={tauxDeLaSemaine(installation?.documentId)}
                    testID={`collectivite-home-jauge-${installation?.documentId}`}
                  />
                )}
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {libelleDeLaSemaine(installation?.documentId)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }
    return (
      <View style={{ gap: 12 }}>
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
          {titreSection(t('collectiviteAccueil.semaine.titre', 'Cette semaine'))}
          {/* FINITIONS-VILLE (T20) : il ouvre la liste des installations, il le dit. */}
          {lienFleche(
            t('collectiviteAccueil.semaine.installations', 'Installations'),
            'collectivite-home-voir-planning',
            () => ouvrir(RouteNames.CollectiviteInstallations),
          )}
        </View>
        {corps}
      </View>
    );
  };

  // ── 4. VOS CLUBS ───────────────────────────────────────────────────────────────────────
  const chiffre = (/** @type {number | null} */ valeur) => {
    if (clubs.isLoading) return '…';
    if (clubs.error || valeur === null) return '—';
    return String(valeur);
  };

  const renderClubs = () => {
    const tuiles = [
      {
        cle: 'clubs',
        libelle: totaux.clubs === 1
          ? t('collectiviteAccueil.clubs.club', 'club')
          : t('collectiviteAccueil.clubs.clubs', 'clubs'),
        valeur: chiffre(totaux.clubs),
      },
      {
        cle: 'equipes',
        libelle: totaux.teams === 1
          ? t('collectiviteAccueil.clubs.equipe', 'équipe')
          : t('collectiviteAccueil.clubs.equipes', 'équipes'),
        valeur: chiffre(totaux.teams),
      },
      {
        cle: 'membres',
        libelle: totaux.members === 1
          ? t('collectiviteAccueil.clubs.membre', 'membre')
          : t('collectiviteAccueil.clubs.membres', 'membres'),
        valeur: chiffre(totaux.members),
      },
    ];
    return (
      <View style={{ gap: 12 }}>
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
          {titreSection(t('collectiviteAccueil.clubs.titre', 'Vos clubs'))}
          {lienFleche(
            t('collectiviteAccueil.clubs.voir', 'Voir les clubs'),
            'collectivite-home-voir-clubs',
            () => ouvrir(RouteNames.CollectiviteClubs),
          )}
        </View>
        <View style={[Alignments.row, { gap: 8 }]}>
          {tuiles.map((tuile) => (
            <View
              key={tuile.cle}
              style={[
                Alignments.alignCenter,
                ApplicationStyle.borderRadius12,
                Spaces.paddingVertical[12],
                verreStyle,
                { flex: 1 },
              ]}
            >
              <Text style={[Fonts.h2Black, Fonts.neutral00]}>{tuile.valeur}</Text>
              <Text style={[Fonts.p3, Fonts.neutral300]}>{tuile.libelle}</Text>
            </View>
          ))}
        </View>
        {listeClubs.length > 0 ? (
          <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
            {listeClubs.slice(0, 4).map((club) => (
              <View
                key={club?.documentId}
                style={[
                  Alignments.alignCenter,
                  Alignments.justifyCenter,
                  {
                    backgroundColor: withAlpha(Colors.primary500, 0.2),
                    borderColor: withAlpha(Colors.primary500, 0.5),
                    borderRadius: 14,
                    borderWidth: 1,
                    height: 28,
                    width: 28,
                  },
                ]}
              >
                <Text style={[Fonts.p4Bold, Fonts.neutral00]}>{clubInitials(club?.name)}</Text>
              </View>
            ))}
            <Text numberOfLines={2} style={[Fonts.p3, Fonts.neutral300, { flex: 1 }]}>
              {listeClubs.map((club) => club?.name).filter(Boolean).join(', ')}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  // ── EN-TÊTE ────────────────────────────────────────────────────────────────────────────
  // Dans l'espace de la Ville sur téléphone, la pile cache son en-tête : l'écran pose le sien
  // (logo, cloche, Mon compte). Le compte mixte y lit « ‹ son club » à la place du logo.
  const enTeteEspace = Platform.OS !== 'web' && routeParams?.space === true;
  const retour = routeParams?.returnLabel;
  let enTeteEcran = null;
  if (retour) {
    enTeteEcran = (
      <TouchableOpacity
        accessibilityLabel={t('collectiviteAccueil.retourA11y', 'Revenir à {{nom}}', {
          nom: retour,
          ...SANS_ECHAPPEMENT,
        })}
        accessibilityRole="button"
        onPress={() => navigation.goBack()}
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Spaces.marginTop[12],
          { gap: 4, minHeight: 44 },
        ]}
        testID="collectivite-home-retour"
      >
        <Image
          source={Images.arrowLeft}
          style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.primary500]}
        />
        {/* COLL-FIX2 (T10) : « ← AS Montrivage » s'affichait « ← AS » : même parade. */}
        <Text style={[Fonts.p2Bold, Fonts.primary500, { flexGrow: 1, flexShrink: 1 }]}>
          {retour}
        </Text>
      </TouchableOpacity>
    );
  } else if (enTeteEspace) {
    enTeteEcran = (
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
        <View style={[Alignments.row, Alignments.alignCenter]}>
          <NotificationBadge />
          <ProfileButton />
        </View>
      </View>
    );
  }

  const hautDePage = (
    <View style={{ gap: 4 }}>
      <Text style={[Fonts.p3Bold, Fonts.primary200]}>
        {t('collectivite.home.kicker', 'Ma collectivité').toUpperCase()}
      </Text>
      <Text
        accessibilityRole="header"
        style={[enColonnes ? Fonts.h1Black : Fonts.h2Black, Fonts.neutral00]}
      >
        {collectivite?.name}
      </Text>
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {t(
          'collectiviteAccueil.sousTitre',
          'Vos installations, les demandes des clubs, vos messages aux clubs.',
        )}
      </Text>
    </View>
  );

  // ── PREMIERS PAS (planche P1v3) et MOT D'ACCUEIL (planche P2-gestion, état 6) ─────────────
  // COLL-ACCUEIL-BIS — l'étape 3 se coche au premier créneau de saison vu dans la semaine.
  const nombreCreneaux = seasonSlotsSeen(semaine);
  const guide = premiersPas({
    actualitesCount: Array.isArray(actualitesEnLigne.data) ? actualitesEnLigne.data.length : 0,
    clubsVus,
    creneauxCount: nombreCreneaux,
    installationsCount: Array.isArray(installations.data) ? installations.data.length : 0,
  });
  const nombreActualites = Array.isArray(actualitesEnLigne.data)
    ? actualitesEnLigne.data.length
    : 0;
  const nombreClubs = Array.isArray(clubs.data) ? clubs.data.length : 0;
  const nombreInstallations = Array.isArray(installations.data) ? installations.data.length : 0;
  const texteEtape = (
    /** @type {string} */ cle,
    /** @type {boolean} */ fait,
    /** @type {boolean} */ attend = false,
  ) => {
    // COLL-ACCUEIL-BIS (03/10) — « Attribuez les créneaux de la saison » (planche P1v3, étape 3).
    if (cle === 'creneaux') {
      if (fait) {
        return {
          titre: nombreCreneaux === 1
            ? t('collectiviteAccueil.premiersPas.creneaux.faitUn', '1 créneau attribué')
            : t('collectiviteAccueil.premiersPas.creneaux.faits', '{{nombre}} créneaux attribués', {
              nombre: nombreCreneaux,
            }),
        };
      }
      return {
        bouton: t('collectiviteAccueil.actions.assignSlot.titre', 'Attribuer un créneau'),
        dit: attend
          ? t(
            'collectiviteAccueil.premiersPas.creneaux.attend',
            'Après l’étape 1 : qui joue où, chaque semaine.',
          )
          : t(
            'collectiviteAccueil.premiersPas.creneaux.dit',
            'Qui joue où, chaque semaine, toute la saison.',
          ),
        titre: t(
          'collectiviteAccueil.premiersPas.creneaux.titre',
          'Attribuez les créneaux de la saison',
        ),
      };
    }
    // COLL-C4A (02/10) — « Présentez-vous aux clubs » (planche P1v3, étape 4).
    if (cle === 'actualite') {
      if (fait) {
        return {
          titre: nombreActualites === 1
            ? t('collectiviteActualites.premiersPas.faiteUne', '1 actualité publiée')
            : t('collectiviteActualites.premiersPas.faites', '{{nombre}} actualités publiées', {
              nombre: nombreActualites,
            }),
        };
      }
      return {
        bouton: t('collectiviteActualites.publier', 'Publier une actualité'),
        dit: t(
          'collectiviteActualites.premiersPas.dit',
          'Une première actualité, lue par leurs membres.',
        ),
        titre: t('collectiviteActualites.premiersPas.titre', 'Présentez-vous aux clubs'),
      };
    }
    if (cle === 'installations') {
      if (fait) {
        return {
          titre: nombreInstallations === 1
            ? t('collectiviteAccueil.premiersPas.installations.faiteUne', '1 installation ajoutée')
            : t(
              'collectiviteAccueil.premiersPas.installations.faites',
              '{{nombre}} installations ajoutées',
              {
                nombre: nombreInstallations,
              },
            ),
        };
      }
      return {
        bouton: t('collectiviteAccueil.actions.addInstallation.titre', 'Ajouter une installation'),
        dit: t(
          'collectiviteAccueil.premiersPas.installations.dit',
          'Gymnases, terrains, salles : la base de tout le reste.',
        ),
        titre: t(
          'collectiviteAccueil.premiersPas.installations.titre',
          'Ajoutez vos installations',
        ),
      };
    }
    if (fait) {
      return {
        titre: nombreClubs === 1
          ? t('collectiviteAccueil.premiersPas.clubs.faitUn', '1 club vérifié')
          : t('collectiviteAccueil.premiersPas.clubs.faits', '{{nombre}} clubs vérifiés', {
            nombre: nombreClubs,
          }),
      };
    }
    const rattaches = nombreClubs === 1
      ? t('collectiviteAccueil.premiersPas.clubs.ditUn', 'L’équipe FoundClub a rattaché 1 club.')
      : t(
        'collectiviteAccueil.premiersPas.clubs.dit',
        'L’équipe FoundClub a rattaché {{nombre}} clubs.',
        {
          nombre: nombreClubs,
        },
      );
    return {
      bouton: t('collectiviteAccueil.clubs.voir', 'Voir les clubs'),
      // COLL-ACCUEIL-BIS : « Un club manque ? Invitez-le. » (l'action « Inviter un club »).
      dit: `${rattaches} ${t(
        'collectiviteAccueil.premiersPas.clubs.manque',
        'Un club manque ? Invitez-le.',
      )}`,
      titre: t('collectiviteAccueil.premiersPas.clubs.titre', 'Vérifiez vos clubs'),
    };
  };

  const motDAccueil = bienvenue ? (
    <View
      style={[
        ApplicationStyle.card,
        Spaces.padding[16],
        {
          backgroundColor: withAlpha(Colors.primary500, 0.1),
          borderColor: withAlpha(Colors.primary500, 0.3),
          gap: 4,
        },
      ]}
      testID="collectivite-home-bienvenue"
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {t('collectiviteAccueil.bienvenue.titre', 'Bienvenue dans votre espace.')}
      </Text>
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {t(
          'collectiviteAccueil.bienvenue.texte',
          // eslint-disable-next-line max-len
          'Vos installations, les demandes des clubs, le planning et vos messages aux clubs : tout part de cet accueil.',
        )}
      </Text>
    </View>
  ) : null;

  let premiersPasBloc = null;
  if (!guideMasque && !installations.isLoading && !clubs.isLoading) {
    premiersPasBloc = guide.tousFaits ? (
      <View
        style={[
          ApplicationStyle.card,
          Spaces.padding[16],
          Alignments.row,
          Alignments.alignCenter,
          verreStyle,
          { gap: 12 },
        ]}
        testID="collectivite-home-premiers-pas-faits"
      >
        <Image
          source={Images.check}
          style={[ApplicationStyle.icon16, { tintColor: Colors.success500 }]}
        />
        <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>
          {t(
            'collectiviteAccueil.premiersPas.faits',
            'Vos premiers pas sont faits : {{faits}} sur {{total}}.',
            { faits: guide.faits, total: guide.total },
          )}
        </Text>
        <Button
          onPress={() => {
            retenir('guide-masque');
            setGuideMasque(true);
          }}
          size="sm"
          title={t('collectiviteAccueil.premiersPas.masquer', 'Masquer')}
          variant="Ghost"
        />
      </View>
    ) : (() => {
      const compte = (
        <Text style={[Fonts.p3Bold, Fonts.primary200]}>
          {t('collectiviteAccueil.premiersPas.compte', '{{faits}} sur {{total}}', {
            faits: guide.faits,
            total: guide.total,
          })}
        </Text>
      );
      const jauge = (
        <View
          accessibilityLabel={t('collectiviteAccueil.premiersPas.titre', 'Vos premiers pas')}
          accessibilityRole="progressbar"
          accessibilityValue={{ max: guide.total, min: 0, now: guide.faits }}
          style={[
            { backgroundColor: withAlpha(Colors.neutral00, 0.12), borderRadius: 3, height: 6 },
            // Planche 10 (ordinateur) : la jauge, 240 px, à droite du titre.
            enColonnes ? { width: 240 } : null,
          ]}
        >
          <View
            style={{
              backgroundColor: Colors.success500,
              borderRadius: 3,
              height: 6,
              width: `${guide.total ? Math.round((guide.faits / guide.total) * 100) : 0}%`,
            }}
          />
        </View>
      );
      const etapes = guide.etapes.map((etape, index) => {
        const texte = texteEtape(etape.key, etape.fait, etape.attend);
        // L'étape des créneaux mène où mène l'action « Attribuer un créneau ».
        const cible = etape.key === 'creneaux'
          ? homeActionTarget({ key: 'assignSlot', route: etape.route }, installations.data)
          : { params: {}, route: etape.route };
        let fondDuNumero = withAlpha(Colors.neutral00, 0.08);
        if (etape.fait) fondDuNumero = withAlpha(Colors.success500, 0.2);
        else if (etape.suivante) fondDuNumero = Colors.primary500;
        return (
          <View
            key={etape.key}
            style={[
              Alignments.row,
              { alignItems: 'flex-start', gap: 12 },
              // La planche grise l'étape qui attend la précédente (« Après l'étape 1 »).
              etape.attend ? { opacity: 0.55 } : null,
              // Planche 10 : une colonne par étape, la suivante bordée de bleu.
              enColonnes ? [
                ApplicationStyle.card,
                Spaces.padding[16],
                verreStyle,
                {
                  flexBasis: 0, flexDirection: 'column', flexGrow: 1, gap: 8,
                },
                etape.suivante ? {
                  backgroundColor: withAlpha(Colors.primary500, 0.1),
                  borderColor: Colors.primary500,
                } : null,
              ] : null,
            ]}
            testID={`collectivite-home-pas-${etape.key}`}
          >
            <View
              accessibilityLabel={etape.fait
                ? t('collectiviteAccueil.premiersPas.fait', 'Fait')
                : undefined}
              style={[
                Alignments.alignCenter,
                Alignments.justifyCenter,
                {
                  backgroundColor: fondDuNumero,
                  borderRadius: 12,
                  height: 24,
                  width: 24,
                },
              ]}
            >
              {etape.fait ? (
                <Image
                  source={Images.check}
                  style={{ height: 12, tintColor: Colors.success500, width: 12 }}
                />
              ) : (
                <Text
                  style={[
                    Fonts.p3Bold,
                    etape.suivante ? { color: Colors.primary900 } : Fonts.neutral100,
                  ]}
                >
                  {String(index + 1)}
                </Text>
              )}
            </View>
            <View style={{ flex: enColonnes ? undefined : 1, gap: 4 }}>
              <Text
                style={etape.fait
                  ? [Fonts.p2, Fonts.neutral200]
                  : [Fonts.p2Bold, Fonts.neutral00]}
              >
                {texte.titre}
              </Text>
              {texte.dit ? <Text style={[Fonts.p3, Fonts.neutral200]}>{texte.dit}</Text> : null}
              {etape.suivante && texte.bouton ? (
                <View style={{ alignSelf: 'flex-start' }}>
                  <Button
                    onPress={() => ouvrir(cible.route, cible.params)}
                    size="sm"
                    testID={`collectivite-home-pas-${etape.key}-bouton`}
                    title={texte.bouton}
                    variant="Primary"
                  />
                </View>
              ) : null}
            </View>
          </View>
        );
      });
      // COLL-ACCUEIL-BIS (03/10) — planche 10 (P1v3-premiers-pas-ordi) : le titre, la jauge et le
      // compte sur une ligne, puis les quatre étapes en colonnes.
      if (enColonnes) {
        return (
          <View
            accessibilityLabel={t('collectiviteAccueil.premiersPas.titre', 'Vos premiers pas')}
            style={{ gap: 12 }}
            testID="collectivite-home-premiers-pas"
          >
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
              {titreSection(t('collectiviteAccueil.premiersPas.titre', 'Vos premiers pas'))}
              <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
                {jauge}
                {compte}
              </View>
            </View>
            <View
              style={[Alignments.row, { alignItems: 'stretch', gap: 12 }]}
              testID="collectivite-home-premiers-pas-colonnes"
            >
              {etapes}
            </View>
          </View>
        );
      }
      return (
        <View
          accessibilityLabel={t('collectiviteAccueil.premiersPas.titre', 'Vos premiers pas')}
          style={[ApplicationStyle.card, Spaces.padding[16], carteStyle, { gap: 12 }]}
          testID="collectivite-home-premiers-pas"
        >
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
            <Text accessibilityRole="header" style={[Fonts.p1Bold, Fonts.neutral00]}>
              {t('collectiviteAccueil.premiersPas.titre', 'Vos premiers pas')}
            </Text>
            {compte}
          </View>
          {jauge}
          {etapes}
        </View>
      );
    })();
  }

  const actualites = <ActualitesDeLaVille collectiviteId={String(collectiviteId)} />;
  // COLL-C4A planche 3 — sous le titre : l'accueil validé n'est pas modifié, le bandeau se pose
  // au-dessus. Il mène à « Actualités de la Ville ».
  const bandeauActualite = (
    <BandeauActualiteMairie
      collectiviteId={String(collectiviteId)}
      nomVille={String(collectivite?.name || '')}
      onOuvrir={() => ouvrir(RouteNames.CollectiviteActualites)}
      userId={userData?.documentId || null}
    />
  );

  // Téléphone : une colonne, dans l'ordre de la planche. Ordinateur : les actions en tête,
  // puis trois colonnes — ce qui attend · la vision (semaine, clubs) · les actualités.
  const corps = enColonnes ? (
    <>
      {renderActions()}
      <View style={[Alignments.row, { alignItems: 'flex-start', gap: 24 }]}>
        <View style={{ flex: 1, gap: 12 }}>{renderAttente()}</View>
        <View style={{ flex: 1, gap: 24 }}>
          {renderSemaine()}
          {renderClubs()}
        </View>
        <View style={{ flex: 1 }}>{actualites}</View>
      </View>
    </>
  ) : (
    <>
      {renderAttente()}
      {renderActions()}
      {renderSemaine()}
      {renderClubs()}
      {actualites}
    </>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <DecisionCreneauModal
        collectiviteId={collectiviteId}
        decision={decision}
        onClose={() => setDecision(null)}
      />
      {enTeteEcran}
      <ScrollView
        contentContainerStyle={{ gap: 28, paddingBottom: 24, paddingTop: 12 }}
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {hautDePage}
        {bandeauActualite}
        {motDAccueil}
        {premiersPasBloc}
        {corps}
      </ScrollView>
    </ScreenContainer>
  );
}

export default CollectiviteHome;
