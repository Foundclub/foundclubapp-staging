import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  managerEmail,
  splitAdminInvitations,
  splitDisplayName,
} from '@/domains/collectivite/collectiviteConsole';
import {
  collectiviteTypeLabel,
  toAdminCollectiviteDetail,
} from '@/domains/collectivite/collectiviteDisplay';
import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import MemberAvatar from '@/components/molecules/memberAvatar/MemberAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';
import CollectiviteActivation from '@/views/admin/components/CollectiviteActivation';
import { PastilleAPoint } from '@/views/admin/components/CollectiviteBadges';
import CollectiviteTargetSearch from '@/views/admin/components/CollectiviteTargetSearch';
import ConsoleSheet from '@/views/admin/components/ConsoleSheet';
import ManagerRequestsLink from '@/views/admin/components/ManagerRequestsLink';

import { RouteNames } from '@/navigation/routeNames';

import {
  useAddAdminCollectiviteGestionnaire,
  useAdminCollectivite,
  useAdminCollectiviteInvitations,
  useAdminCollectiviteOfferStates,
  useAttachAdminCollectiviteClub,
  useDetachAdminCollectiviteClub,
  useRemoveAdminCollectiviteGestionnaire,
} from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';
import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';

/** @typedef {{ ok: boolean, texte: string } | null} Retour */
/**
 * @typedef {{ cible: { documentId: string, logoUrl?: string | null, name: string },
 *   kind: 'detacher' | 'retirer' } | null} AConfirmer
 */

/**
 * Le bouton « Plus d'actions » d'une ligne (icône dots-horizontal, validée par Adel le 01/10) : un
 * geste qui retire (« Détacher », « Retirer ») ne se fait plus d'un appui distrait sur la ligne
 * (planche P2-fiche, « retiré, et pourquoi »). Son menu est `MenuDActions`, posé SOUS la ligne.
 * @param {{ libelle: string, ouvert: boolean, onBasculer: () => void, testID: string }} props -
 *   Le bouton.
 * @returns {import('react').ReactElement} Le bouton.
 */
function PlusDActions({
  libelle, onBasculer, ouvert, testID,
}) {
  const { Alignments, Colors } = useTheme();
  return (
    <TouchableOpacity
      accessibilityLabel={libelle}
      accessibilityRole="button"
      accessibilityState={{ expanded: ouvert }}
      hitSlop={{
        bottom: 8, left: 8, right: 8, top: 8,
      }}
      onPress={onBasculer}
      style={[Alignments.alignCenter, Alignments.justifyCenter, { height: 44, width: 44 }]}
      testID={testID}
    >
      <SvgIcon color={Colors.neutral200} height={22} name="dots-horizontal" width={22} />
    </TouchableOpacity>
  );
}

/**
 * Le menu d'une ligne, déplié SOUS elle, sur toute sa largeur.
 * 🐞 COLL-FIX2 (03/10), tournée T10 (T10_C16_2) : il se dépliait DANS la ligne, sous le bouton,
 * et la colonne du menu écrasait celle du nom (« AS Montriv / age »).
 * @param {{ actions: Array<{ danger?: boolean, label: string, onPress: () => void }>,
 *   testID: string }} props - Les actions, et le testID du bouton qui l'ouvre.
 * @returns {import('react').ReactElement} Le menu.
 */
function MenuDActions({ actions, testID }) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  return (
    <View
      style={[
        ApplicationStyle.borderRadius16,
        Spaces.padding[8],
        {
          backgroundColor: Colors.primary700,
          borderColor: withAlpha(Colors.primary500, 0.5),
          borderWidth: 1,
          gap: 4,
        },
      ]}
      testID={`${testID}-menu`}
    >
      {actions.map((action) => (
        // ♿ VT18E (07/10, capture S10a) — « Détacher de la Ville » manquait à l arbre
        // d accessibilité : chaque action porte son libellé, pas seulement son texte enfant.
        <TouchableOpacity
          accessibilityLabel={action.label}
          accessibilityRole="button"
          key={action.label}
          onPress={action.onPress}
          style={[Spaces.paddingHorizontal[12], { justifyContent: 'center', minHeight: 44 }]}
        >
          <Text style={[Fonts.p2Bold, action.danger ? Fonts.error300 : Fonts.neutral00]}>
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/**
 * 🏛️ CONSOLE › COLLECTIVITÉS › UNE COLLECTIVITÉ (D61, 2026-09-29), restylée par COLL-CONSOLE
 * (02/10/2026) selon la planche P2-fiche (design HY521H1, page 2, écran 4).
 *
 * Dans l'ordre de l'écran :
 *   1. le nom, le type, l'INSEE et le SIREN ; après une création, ce qui reste à faire ;
 *   2. le BANDEAU D'ÉTAT (CollectiviteActivation) : ce que l'activation changera, club par
 *      club, puis « Activer » (bleu) ou « Couper » (rouge) ;
 *   3. les CLUBS rattachés, chacun avec l'état de SON offre (« À l'activation », « Offerte par
 *      la Ville », « Paie lui-même », lu dans l'aperçu du serveur) et son menu « Plus
 *      d'actions » (« Voir la fiche du club », « Détacher de la Ville », en rouge) ; la
 *      recherche dit la ville de chaque club ; le message après un rattachement reste sous
 *      la recherche ; les demandes de rattachement de CETTE Ville ont leur porte ;
 *   4. les GESTIONNAIRES, chacun avec « Plus d'actions » (« Retirer », en rouge), la
 *      recherche (« Déjà gestionnaire ») et la porte de la file des demandes de gestionnaire ;
 *   5. les INSTALLATIONS, en lecture (« Gymnase · 2 équipes à la fois »).
 * Chaque geste relit la collectivité depuis le serveur : l'écran affiche ce qu'il rend.
 * COLL-CONSOLE-BIS (03/10/2026), planche 15 : la ville de chaque club rattaché ; la ville, le
 * sport et la proximité (commune, puis département) dans la recherche de clubs ; le rond aux
 * initiales et l'e-mail de chaque gestionnaire (rien si l'e-mail n'est qu'un remplissage) ; la
 * pastille de couleur de chaque installation, celle du planning.
 * @returns {import('react').ReactElement} L'écran.
 */
function AdminCollectiviteDetail() {
  const { t } = useTranslation();
  const navigation = /** @type {any} */ (useNavigation());
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const route = useRoute();
  /** @type {{ collectiviteId?: string, justCreated?: boolean } | undefined} */
  const routeParams = /** @type {any} */ (route?.params);
  const collectiviteId = routeParams?.collectiviteId || null;
  // COLL-CONSOLE (02/10) — la fiche qui remplace le formulaire de creation dit ce qui reste.
  const justCreated = routeParams?.justCreated === true;

  const lecture = useAdminCollectivite(collectiviteId);
  const detail = toAdminCollectiviteDetail(lecture.data);
  const offre = useAdminCollectiviteOfferStates(detail);
  const demandes = useAdminCollectiviteInvitations();
  const [retourClubs, setRetourClubs] = useState(/** @type {Retour} */ (null));
  const [retourGestionnaires, setRetourGestionnaires] = useState(/** @type {Retour} */ (null));
  const [menuOuvert, setMenuOuvert] = useState(/** @type {string | null} */ (null));
  // COLL-CONSOLE (02/10) — le geste qui retire, en attente de sa fenetre (planche P2-fenetres).
  const [aConfirmer, setAConfirmer] = useState(/** @type {AConfirmer} */ (null));
  const erreur = (/** @type {any} */ e) => ({ ok: false, texte: getErrorMessage(e) });

  const rattacher = useAttachAdminCollectiviteClub();
  const detacher = useDetachAdminCollectiviteClub();
  const nommer = useAddAdminCollectiviteGestionnaire();
  const retirer = useRemoveAdminCollectiviteGestionnaire();

  if (lecture.isLoading) {
    return (
      <AdminStateView
        description={t('adminCollectivites.detail.loading', 'Lecture de la collectivité…')}
        isLoading
        title={t('adminCollectivites.list.title', 'Collectivités')}
      />
    );
  }
  if (lecture.error) {
    return (
      <AdminStateView
        actionLabel={t('adminCollectivites.list.retry', 'Réessayer')}
        description={getErrorMessage(/** @type {any} */ (lecture.error))}
        onAction={() => lecture.refetch?.()}
        title={t('adminCollectivites.list.errorTitle', 'Collectivités indisponibles')}
      />
    );
  }
  if (!detail) {
    return (
      <AdminStateView
        description={t(
          'APIerrors.COLLECTIVITE_NOT_FOUND',
          'Cette collectivité est introuvable : elle a peut-être été supprimée.',
        )}
        title={t('adminCollectivites.list.title', 'Collectivités')}
      />
    );
  }

  const ville = { collectivite: formatCollectiviteOfferedBy(detail.name), ...SANS_ECHAPPEMENT };
  const ids = { collectiviteId: detail.documentId };
  const etats = /** @type {Record<string, string> | null} */ (offre.data || null);
  const carteStyle = [
    ApplicationStyle.borderRadius16,
    Spaces.padding[16],
    {
      backgroundColor: withAlpha(Colors.primary700, 0.45),
      borderColor: withAlpha(Colors.primary500, 0.5),
      borderWidth: 1,
      gap: 12,
    },
  ];
  const demandesDeLaVille = splitAdminInvitations(
    (Array.isArray(demandes.data) ? demandes.data : [])
      .filter((demande) => demande?.collectivite?.documentId === detail.documentId),
  );
  const nbDemandesClubs = demandesDeLaVille.attachRequests.length
    + demandesDeLaVille.foundclub.length;

  const basculerMenu = (/** @type {string} */ cle) => setMenuOuvert(
    (avant) => (avant === cle ? null : cle),
  );

  const onRattacher = (/** @type {any} */ cible) => {
    setRetourClubs(null);
    const valeurs = { club: cible?.label, ...ville };
    rattacher.mutate({ ...ids, clubId: cible?.documentId }, {
      onError: (/** @type {any} */ e) => setRetourClubs(erreur(e)),
      onSuccess: (/** @type {any} */ reponse) => {
        const verdict = reponse?.data?.offer;
        let texte = t('adminCollectivites.detail.attachedInactive', valeurs);
        if (verdict === 'granted') texte = t('adminCollectivites.detail.attachedGranted', valeurs);
        if (verdict === 'already-paid') {
          texte = t('adminCollectivites.detail.attachedAlreadyPaid', valeurs);
        }
        // Un PREMIER rattachement previent les dirigeants du club (serveur, « prevenu A »).
        if (reponse?.data?.changed === true) {
          texte = `${texte} ${t(
            'collectiviteConsole.demandes.dirigeantsPrevenus',
            'Ses dirigeants sont prévenus.',
          )}`;
        }
        setRetourClubs({ ok: true, texte });
      },
    });
  };

  // « Détacher » et « Retirer » ouvrent la fenetre de l app (planche P2-fenetres, etats 3 et 4) ;
  // un echec s ecrit DANS la fenetre, qui reste ouverte (« Réessayer »).
  const ouvrirConfirmation = (/** @type {NonNullable<AConfirmer>} */ geste) => {
    setMenuOuvert(null);
    detacher.reset?.();
    retirer.reset?.();
    setAConfirmer(geste);
  };
  const onDetacher = (/** @type {{ documentId: string, name: string }} */ club) => (
    ouvrirConfirmation({ cible: club, kind: 'detacher' })
  );
  const detacherConfirme = (/** @type {{ documentId: string, name: string }} */ club) => {
    const valeurs = { club: club.name, ...ville };
    setRetourClubs(null);
    detacher.mutate({ ...ids, clubId: club.documentId }, {
      onSuccess: () => {
        setAConfirmer(null);
        setRetourClubs({
          ok: true,
          texte: t('adminCollectivites.detail.detached', '{{club}} est détaché.', valeurs),
        });
      },
    });
  };

  const onNommer = (/** @type {any} */ cible) => {
    setRetourGestionnaires(null);
    const valeurs = { nom: cible?.label, ...ville };
    nommer.mutate({ ...ids, userId: cible?.documentId }, {
      onError: (/** @type {any} */ e) => setRetourGestionnaires(erreur(e)),
      onSuccess: () => setRetourGestionnaires({
        ok: true,
        texte: t('adminCollectivites.detail.managerAdded', valeurs),
      }),
    });
  };

  const onRetirer = (/** @type {{ documentId: string, name: string }} */ compte) => (
    ouvrirConfirmation({ cible: compte, kind: 'retirer' })
  );
  const retirerConfirme = (/** @type {{ documentId: string, name: string }} */ compte) => {
    const valeurs = { nom: compte.name, ...ville };
    setRetourGestionnaires(null);
    retirer.mutate({ ...ids, userId: compte.documentId }, {
      onSuccess: () => {
        setAConfirmer(null);
        setRetourGestionnaires({
          ok: true,
          texte: t(
            'adminCollectivites.detail.managerRemoved',
            '{{nom}} ne gère plus {{collectivite}}.',
            valeurs,
          ),
        });
      },
    });
  };

  // La fenetre du geste qui retire : ce que le club (ou le compte) garde, ce qu il perd.
  const fenetreDuGeste = () => {
    if (!aConfirmer) {
      return {
        corps: null, geste: () => {}, libelle: '', mutation: null, titre: '',
      };
    }
    const { cible, kind } = aConfirmer;
    if (kind === 'detacher') {
      const etat = etats?.[cible.documentId];
      let message = t('adminCollectivites.detail.detachMessage', { club: cible.name, ...ville });
      if (etat === 'offered') {
        message = t(
          'collectiviteConsole.fenetres.detacherOffre',
          // eslint-disable-next-line max-len
          'Le club reste intact : équipes, membres et événements. Il recevait l’offre Club offerte par {{collectivite}} : elle lui est retirée.',
          ville,
        );
      } else if (etat) {
        message = t(
          'collectiviteConsole.fenetres.detacherSansOffre',
          // eslint-disable-next-line max-len
          'Le club reste intact : équipes, membres et événements. Il ne recevait pas l’offre de {{collectivite}} : rien ne change pour son abonnement.',
          ville,
        );
      }
      return {
        corps: (
          <>
            <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
              <ClubLogoMark logoUrl={cible.logoUrl || undefined} name={cible.name} size={36} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{cible.name}</Text>
                {pastilleOffre(cible.documentId)}
              </View>
            </View>
            <Text style={[Fonts.p2, Fonts.neutral100]}>{message}</Text>
          </>
        ),
        geste: () => detacherConfirme(cible),
        libelle: t('collectiviteConsole.fenetres.detacherBouton', 'Détacher {{club}}', {
          club: cible.name, ...SANS_ECHAPPEMENT,
        }),
        mutation: detacher,
        titre: t('adminCollectivites.detail.detachTitle', 'Détacher {{club}} ?', {
          club: cible.name, ...ville, ...SANS_ECHAPPEMENT,
        }),
      };
    }
    const seul = detail.gestionnaires.length === 1;
    return {
      corps: (
        <>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('adminCollectivites.detail.removeManagerMessage', { nom: cible.name, ...ville })}
          </Text>
          {seul ? (
            <Text
              style={[Fonts.p2Bold, Fonts.warning500]}
              testID="admin-collectivite-seul-gestionnaire"
            >
              {t(
                'collectiviteConsole.fenetres.seulGestionnaire',
                // eslint-disable-next-line max-len
                'C’est le seul gestionnaire. Sans gestionnaire, les demandes de créneau des clubs attendront sans réponse.',
              )}
            </Text>
          ) : null}
        </>
      ),
      geste: () => retirerConfirme(cible),
      libelle: t('collectiviteConsole.fenetres.retirerBouton', 'Retirer {{nom}}', {
        nom: cible.name, ...SANS_ECHAPPEMENT,
      }),
      mutation: retirer,
      titre: t('adminCollectivites.detail.removeManagerTitle', 'Retirer {{nom}} ?', {
        nom: cible.name, ...ville, ...SANS_ECHAPPEMENT,
      }),
    };
  };

  const afficherRetour = (/** @type {Retour} */ retour) => (retour ? (
    <Text
      accessibilityRole={retour.ok ? undefined : 'alert'}
      style={[Fonts.p3Bold, retour.ok ? Fonts.success500 : Fonts.error300]}
    >
      {retour.texte}
    </Text>
  ) : null);

  const titreSection = (/** @type {string} */ texte) => (
    <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>{texte}</Text>
  );

  /**
   * L'état de l'offre de CHAQUE club, tel que l'aperçu du serveur l'a dit (rien s'il ne l'a pas
   * dit). Une déclaration de fonction : la fenêtre « Détacher » (plus haut) s'en sert aussi.
   * @param {string} clubId - Le documentId du club.
   * @returns {import('react').ReactElement | null} La pastille, ou rien.
   */
  function pastilleOffre(clubId) {
    const etat = etats?.[clubId];
    if (etat === 'offered') {
      return (
        <PastilleAPoint
          color={Colors.success500}
          label={t('collectiviteConsole.fiche.offreOfferte', 'Offerte par la Ville')}
          testID={`admin-collectivite-offre-${clubId}`}
        />
      );
    }
    if (etat === 'atActivation') {
      return (
        <PastilleAPoint
          color={Colors.primary200}
          label={t('collectiviteConsole.fiche.offreALActivation', 'À l’activation')}
          testID={`admin-collectivite-offre-${clubId}`}
        />
      );
    }
    if (etat === 'paysItself') {
      return (
        <PastilleAPoint
          color={Colors.neutral300}
          label={t('collectiviteConsole.fiche.offrePaieLuiMeme', 'Paie lui-même')}
          testID={`admin-collectivite-offre-${clubId}`}
        />
      );
    }
    return null;
  }

  const geste = fenetreDuGeste();
  const echecDuGeste = geste.mutation?.error;

  const identite = [
    collectiviteTypeLabel(t, detail.type),
    detail.codeInsee
      ? t('collectiviteConsole.fiche.insee', 'INSEE {{code}}', { code: detail.codeInsee }) : null,
    detail.siren
      ? t('collectiviteConsole.fiche.siren', 'SIREN {{code}}', { code: detail.siren }) : null,
  ].filter(Boolean).join(' · ');

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 12 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => lecture.refetch?.()}
            refreshing={Boolean(lecture.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={{ gap: 6 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t('adminCollectivites.list.title', 'Collectivités').toUpperCase()}
          </Text>
          <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
            {detail.name}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral300]}>{identite}</Text>
        </View>

        {justCreated ? (
          <View
            accessibilityRole="summary"
            style={[
              ApplicationStyle.borderRadius16,
              Spaces.padding[16],
              {
                backgroundColor: withAlpha(Colors.success500, 0.12),
                borderColor: withAlpha(Colors.success500, 0.4),
                borderWidth: 1,
                gap: 4,
              },
            ]}
            testID="admin-collectivite-creee"
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t('collectiviteConsole.creer.creee', '{{name}} est créée, inactive.', {
                name: detail.name, ...SANS_ECHAPPEMENT,
              })}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'collectiviteConsole.creer.ensuite',
                'Ensuite : rattache ses clubs, nomme un gestionnaire, puis active-la.',
              )}
            </Text>
          </View>
        ) : null}

        <CollectiviteActivation collectivite={detail} etats={etats} />

        <View style={carteStyle} testID="admin-collectivite-clubs">
          {titreSection(t('adminCollectivites.list.clubsCount', 'Clubs rattachés : {{nombre}}', {
            nombre: detail.clubs.length,
          }))}
          {detail.clubs.length === 0 ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t(
                'collectiviteConsole.fiche.aucunClub',
                'Aucun club rattaché. Cherche les clubs de la commune par leur nom.',
              )}
            </Text>
          ) : detail.clubs.map((/** @type {any} */ club) => (
            <View key={club.documentId} style={{ gap: 4 }}>
              <View
                style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}
                testID={`admin-collectivite-club-${club.documentId}`}
              >
                <ClubLogoMark logoUrl={club.logoUrl} name={club.name} size={36} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {club.name}
                  </Text>
                  {club.city ? (
                    <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral300]}>{club.city}</Text>
                  ) : null}
                  {pastilleOffre(club.documentId)}
                </View>
                <PlusDActions
                  libelle={t('collectiviteConsole.fiche.plusDActions', 'Plus d’actions : {{nom}}', {
                    nom: club.name, ...SANS_ECHAPPEMENT,
                  })}
                  onBasculer={() => basculerMenu(`club-${club.documentId}`)}
                  ouvert={menuOuvert === `club-${club.documentId}`}
                  testID={`admin-collectivite-club-${club.documentId}-actions`}
                />
              </View>
              {menuOuvert === `club-${club.documentId}` ? (
                <MenuDActions
                  actions={[
                    {
                      label: t('collectiviteConsole.fiche.voirClub', 'Voir la fiche du club'),
                      onPress: () => {
                        setMenuOuvert(null);
                        navigation.navigate(RouteNames.AdminClubDetail, {
                          clubId: club.documentId,
                        });
                      },
                    },
                    {
                      danger: true,
                      label: t('collectiviteConsole.fiche.detacher', 'Détacher de la Ville'),
                      onPress: () => onDetacher(club),
                    },
                  ]}
                  testID={`admin-collectivite-club-${club.documentId}-actions`}
                />
              ) : null}
            </View>
          ))}
          <CollectiviteTargetSearch
            codeInseeProche={detail.codeInsee}
            deja={new Set(detail.clubs.map((/** @type {any} */ club) => club.documentId))}
            dejaTexte={t('adminCollectivites.detail.alreadyAttached', 'Déjà rattaché')}
            enCours={rattacher.isPending}
            kind="club"
            libelleAction={t('adminCollectivites.detail.attach', 'Rattacher')}
            onChoisir={onRattacher}
            placeholder={t('adminCollectivites.detail.searchClub', 'Rattacher un club : son nom')}
            testID="admin-collectivite-recherche-club"
          />
          {afficherRetour(retourClubs)}
          {nbDemandesClubs > 0 ? (
            <Button
              onPress={() => navigation.navigate(RouteNames.AdminCollectiviteInvitations, {
                collectiviteId: detail.documentId,
                onglet: demandesDeLaVille.attachRequests.length > 0 ? 'rattachements' : 'foundclub',
              })}
              size="sm"
              title={t('collectiviteConsole.fiche.demandesClubs', {
                count: nbDemandesClubs,
                defaultValue_one: '{{count}} demande de club pour cette collectivité',
                defaultValue_other: '{{count}} demandes de clubs pour cette collectivité',
              })}
              variant="Ghost"
            />
          ) : null}
        </View>

        <View style={carteStyle} testID="admin-collectivite-gestionnaires">
          {titreSection(t('adminCollectivites.detail.managersCount', 'Gestionnaires : {{nombre}}', {
            nombre: detail.gestionnaires.length,
          }))}
          {detail.gestionnaires.length === 0 ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t('adminCollectivites.detail.noManager', 'Aucun gestionnaire.')}
            </Text>
          ) : detail.gestionnaires.map((/** @type {any} */ compte) => {
            const nom = compte.name || compte.email || compte.documentId;
            const email = managerEmail(compte);
            const initiales = splitDisplayName(compte.name);
            return (
              <View key={compte.documentId} style={{ gap: 4 }}>
                <View
                  style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}
                  testID={`admin-collectivite-gestionnaire-${compte.documentId}`}
                >
                  <MemberAvatar
                    firstname={initiales.firstname}
                    lastname={initiales.lastname}
                    size={40}
                  />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>{nom}</Text>
                    {email ? (
                      <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral300]}>{email}</Text>
                    ) : null}
                  </View>
                  <PlusDActions
                    libelle={t(
                      'collectiviteConsole.fiche.plusDActions',
                      'Plus d’actions : {{nom}}',
                      { nom, ...SANS_ECHAPPEMENT },
                    )}
                    onBasculer={() => basculerMenu(`gestionnaire-${compte.documentId}`)}
                    ouvert={menuOuvert === `gestionnaire-${compte.documentId}`}
                    testID={`admin-collectivite-gestionnaire-${compte.documentId}-actions`}
                  />
                </View>
                {menuOuvert === `gestionnaire-${compte.documentId}` ? (
                  <MenuDActions
                    actions={[{
                      danger: true,
                      label: t('adminCollectivites.detail.removeManager', 'Retirer'),
                      onPress: () => onRetirer({ documentId: compte.documentId, name: nom }),
                    }]}
                    testID={`admin-collectivite-gestionnaire-${compte.documentId}-actions`}
                  />
                ) : null}
              </View>
            );
          })}
          <CollectiviteTargetSearch
            deja={new Set(detail.gestionnaires.map((/** @type {any} */ c) => c.documentId))}
            dejaTexte={t('adminCollectivites.detail.alreadyManager', 'Déjà gestionnaire')}
            enCours={nommer.isPending}
            kind="user"
            libelleAction={t('adminCollectivites.detail.addManager', 'Ajouter')}
            onChoisir={onNommer}
            placeholder={t(
              'collectiviteConsole.fiche.ajouterGestionnaire',
              'Ajouter : nom ou e-mail',
            )}
            testID="admin-collectivite-recherche-compte"
          />
          {afficherRetour(retourGestionnaires)}
          {/* COLL-ACCUEIL (01/10) — le lien « Ouvrir dans la file », s'il y a une demande. */}
          <ManagerRequestsLink collectiviteId={collectiviteId} />
        </View>

        <View style={carteStyle} testID="admin-collectivite-installations">
          {titreSection(t(
            'adminCollectivites.detail.installationsCount',
            'Installations : {{nombre}}',
            { nombre: detail.installations.length },
          ))}
          {detail.installations.length === 0 ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t(
                'adminCollectivites.detail.noInstallation',
                'Aucune installation : le gestionnaire les ajoute depuis « Ma collectivité ».',
              )}
            </Text>
          ) : detail.installations.map((/** @type {any} */ installation) => (
            <View key={installation.documentId} style={{ gap: 2 }}>
              <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
                <View
                  style={{
                    backgroundColor: resolveFacilityPlanningColor(installation) ?? undefined,
                    borderRadius: 6,
                    height: 12,
                    width: 12,
                  }}
                  testID={`admin-collectivite-installation-${installation.documentId}-couleur`}
                />
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{installation.name}</Text>
              </View>
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {[
                  installation.type,
                  installation.maxSlots === null ? null : t('collectiviteConsole.fiche.equipes', {
                    count: installation.maxSlots,
                    defaultValue_one: '{{count}} équipe à la fois',
                    defaultValue_other: '{{count}} équipes à la fois',
                  }),
                ].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <ConsoleSheet
        error={echecDuGeste ? getErrorMessage(/** @type {any} */ (echecDuGeste)) : null}
        onClose={() => setAConfirmer(null)}
        primary={{
          isLoading: Boolean(geste.mutation?.isPending),
          label: echecDuGeste ? t('adminCollectivites.list.retry', 'Réessayer') : geste.libelle,
          onPress: geste.geste,
          variant: 'Danger',
        }}
        secondary={{ label: t('adminCollectivites.activation.cancel', 'Annuler') }}
        testID={`admin-collectivite-fenetre-${aConfirmer?.kind || 'geste'}`}
        title={geste.titre}
        visible={Boolean(aConfirmer)}
      >
        {geste.corps}
      </ConsoleSheet>
    </ScreenContainer>
  );
}

export default AdminCollectiviteDetail;
