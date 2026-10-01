import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useState } from 'react';
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
  clubInitials,
  clubTotals,
  firstFullMoment,
  formatWeekMoment,
  isOwnClubRequest,
  oldestPendingRequest,
  summarizeConflict,
} from '@/domains/collectivite/collectiviteAccueil';
import { findManagedCollectivite, formatSlot } from '@/domains/collectivite/collectiviteDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import ScreenContainer from '@/components/templates/ScreenContainer';
import DecisionCreneauModal from '@/views/collectivite/components/DecisionCreneauModal';

import { RouteNames } from '@/navigation/routeNames';

import {
  useCollectiviteClubs,
  useCollectiviteInstallations,
  useCollectiviteRequests,
  useCollectiviteWeek,
  useMyCollectivites,
} from '@/services/collectivite/collectiviteQueries';

import { SUPPORT_CONTACT_MAILTO } from '@/config/legalUrls';

// 📰 PLACE RÉSERVÉE AU LOT C4a — « Actualités de la Ville » (planche P3v2-accueil : dernier
// bloc sur téléphone, troisième colonne sur ordinateur ; contenu : « Publier une actualité »,
// les deux dernières actualités envoyées aux clubs, « Toutes les actualités »).
// COLL-ACCUEIL (01/10) ne dessine RIEN dedans : les actualités n'existent pas encore côté
// serveur, et un exemple affiché à une vraie mairie serait faux. Le lot C4a pose ici son
// composant (props : `{ collectiviteId }`) ; il apparaît alors à sa place, sur les deux formats.
/** @type {null | ((props: { collectiviteId: string }) => any)} */
const ActualitesDeLaVille = null;

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

  const mine = useMyCollectivites();
  const collectivite = findManagedCollectivite(mine.data, collectiviteId);
  const pending = useCollectiviteRequests(collectiviteId, 'pending');
  const installations = useCollectiviteInstallations(collectiviteId);
  const clubs = useCollectiviteClubs(collectiviteId);
  const semaine = useCollectiviteWeek(installations.data, { enabled: Boolean(collectivite) });

  const refetchPending = pending.refetch;
  // Au retour d'une demande tranchée, le compteur doit déjà être juste.
  useFocusEffect(useCallback(() => {
    refetchPending?.();
  }, [refetchPending]));

  const ouvrir = (/** @type {string} */ ecran) => navigation.navigate(ecran, { collectiviteId });
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

  const titreSection = (/** @type {string} */ libelle) => (
    <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>{libelle}</Text>
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
  const renderCarteDemande = (/** @type {any} */ demande) => {
    const club = demande?.club?.name || t('collectivite.requests.unknownClub', 'Club');
    const equipe = demande?.team?.name;
    const auteur = [demande?.requestedBy?.firstname, demande?.requestedBy?.lastname]
      .filter(Boolean).join(' ');
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
        style={[ApplicationStyle.card, Spaces.padding[16], carteStyle]}
        testID="collectivite-home-attente-carte"
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
        {conflit ? (
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
            {conflit.full ? (
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
            ) : null}
          </View>
        ) : null}
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
      </View>
    );
  };

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
            accessibilityLabel={t(
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
      </View>
    );
  };

  // ── 2. VOS ACTIONS ─────────────────────────────────────────────────────────────────────
  const texteAction = (/** @type {string} */ cle) => {
    switch (cle) {
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
            'Un club de la commune absent de FoundClub.',
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
          return (
            <TouchableOpacity
              accessibilityRole="button"
              key={action.key}
              onPress={() => ouvrir(String(action.route))}
              style={[
                ApplicationStyle.card,
                Spaces.padding[16],
                carteStyle,
                {
                  // La première action est la plus forte (la planche la borde de bleu).
                  borderColor: index === 0 ? Colors.primary500 : carteStyle.borderColor,
                  flexBasis: enColonnes ? 180 : 150,
                  flexGrow: 1,
                  maxWidth: enColonnes ? 260 : undefined,
                  minHeight: enColonnes ? 56 : 112,
                },
              ]}
              testID={`collectivite-home-action-${action.key}`}
            >
              <View
                style={[
                  Alignments.alignCenter,
                  Alignments.justifyCenter,
                  ApplicationStyle.borderRadius12,
                  { backgroundColor: withAlpha(Colors.primary500, 0.18), height: 36, width: 36 },
                ]}
              >
                <Image
                  source={/** @type {any} */ (Images)[action.icon]}
                  style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.primary200]}
                />
              </View>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{texte.titre}</Text>
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
  const libelleSeances = (/** @type {any} */ query) => {
    if (query?.isLoading) return '…';
    if (query?.error) return '—';
    const lignes = Array.isArray(query?.data?.data) ? query.data.data.length : NaN;
    const total = Number(query?.data?.meta?.total ?? lignes);
    if (!Number.isFinite(total)) return '—';
    if (total === 0) return t('collectiviteAccueil.semaine.aucuneSeance', 'Aucune séance');
    if (total === 1) return t('collectiviteAccueil.semaine.uneSeance', '1 séance');
    return t('collectiviteAccueil.semaine.seances', '{{nombre}} séances', { nombre: total });
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
            return (
              <View key={installation?.documentId} style={{ gap: 4 }}>
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
                {/* La jauge d'occupation de la planche attend le taux (lot 5) : */}
                {/* rien plutôt qu'une jauge vide. */}
                <Text style={[Fonts.p3, Fonts.neutral300]}>{libelleSeances(query)}</Text>
              </View>
            );
          })}
        </View>
      );
    }
    return (
      <View style={{ gap: 12 }}>
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
          {titreSection(t('collectiviteAccueil.semaine.titre', 'Cette semaine'))}
          {lienFleche(
            t('collectiviteAccueil.semaine.planning', 'Planning'),
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
        <Text style={[Fonts.p2Bold, Fonts.primary500]}>{retour}</Text>
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

  const actualites = ActualitesDeLaVille
    ? <ActualitesDeLaVille collectiviteId={String(collectiviteId)} />
    : null;

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
        {actualites ? <View style={{ flex: 1 }}>{actualites}</View> : null}
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
      <DecisionCreneauModal decision={decision} onClose={() => setDecision(null)} />
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
        {corps}
      </ScrollView>
    </ScreenContainer>
  );
}

export default CollectiviteHome;
