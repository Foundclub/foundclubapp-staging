import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { isOwnClubRequest } from '@/domains/collectivite/collectiviteAccueil';
import {
  dateDeDecision,
  estDemandeHebdo,
  etatDeLaPlace,
  lieuAvecPreposition,
  momentDeLaDemande,
  occupantsParHoraire,
} from '@/domains/collectivite/collectiviteDemandes';
import { findManagedCollectivite } from '@/domains/collectivite/collectiviteDisplay';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';
import DecisionCreneauModal from '@/views/collectivite/components/DecisionCreneauModal';

import {
  useCollectiviteRequests,
  useMyCollectivites,
} from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/** @typedef {{ kind: 'approve' | 'refuse', request: any }} Decision */

// Au-delà de cette largeur (ordinateur), la file à gauche et la demande ouverte à droite.
const LARGEUR_DEUX_VOLETS = 1024;

/**
 * 🏛️ « DEMANDES DE LA VILLE » — le gestionnaire tranche (COLLECTIVITES 1c, SPEC §2 E).
 *
 * COLL-C3B (02/10) — planches P6v2-phrase (tel, ordi) et P6-demandes : CHAQUE DEMANDE EST
 * UNE PHRASE, celle qu'on dirait au téléphone (« AS Montrivage demande le jeudi 1 oct., de
 * 18:00 à 19:30, au Gymnase des Tilleuls, pour ses U13. »). Puis ce qu'il y a sur place, en
 * une phrase ; qui est déjà là ; la conséquence ; le motif et l'encadrant qui demande, avec sa
 * fonction (décision d'Adel « nom B »). Une série « chaque semaine » est UNE carte, qui se
 * tranche d'un geste (« Accepter la série » : elle devient un créneau de saison, contrat §10).
 * La mention « Demande de votre club » (D69) quand le club demandeur est celui du compte.
 * Sur ordinateur : la file à gauche, la demande ouverte à droite.
 *
 * Accepter ou refuser passe par la fenêtre partagée avec l'accueil (DecisionCreneauModal).
 * Le serveur juge (le propriétaire tranche) et prévient le demandeur et les clubs déjà là.
 * @returns {import('react').ReactElement} L'écran.
 */
function CollectiviteRequests() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { width } = useWindowDimensions();
  const deuxVolets = width >= LARGEUR_DEUX_VOLETS;
  const route = useRoute();
  const routeParams = /** @type {{ collectiviteId?: string } | undefined} */ (route?.params);
  const collectiviteId = routeParams?.collectiviteId || null;
  const { userData } = useAuth();

  const [onglet, setOnglet] = useState(/** @type {'pending' | 'decided'} */ ('pending'));
  const [decision, setDecision] = useState(/** @type {Decision | null} */ (null));
  const [ouverte, setOuverte] = useState(/** @type {string | null} */ (null));

  const mine = useMyCollectivites();
  const collectivite = findManagedCollectivite(mine.data, collectiviteId);
  const pending = useCollectiviteRequests(collectiviteId, 'pending');
  const decided = useCollectiviteRequests(collectiviteId, 'decided', {
    enabled: Boolean(collectiviteId) && onglet === 'decided',
  });

  const refetchPending = pending.refetch;
  useFocusEffect(useCallback(() => {
    refetchPending?.();
  }, [refetchPending]));

  const liste = onglet === 'pending' ? pending : decided;
  const demandes = Array.isArray(liste.data) ? liste.data : [];
  const nbEnAttente = Array.isArray(pending.data) ? pending.data.length : 0;

  const ouvrir = (/** @type {'approve' | 'refuse'} */ kind, /** @type {any} */ request) => {
    setDecision({ kind, request });
  };

  // ─── Les mots ────────────────────────────────────────────────────────────────────────────
  const nombreDEquipes = (/** @type {number} */ nombre) => (nombre === 1
    ? t('collectiviteDemandes.nombre.uneEquipe', '1 équipe')
    : t('collectiviteDemandes.nombre.equipes', '{{nombre}} équipes', { nombre }));
  const nombreDePlaces = (/** @type {number} */ nombre) => (nombre === 1
    ? t('collectiviteDemandes.nombre.unePlace', '1 place')
    : t('collectiviteDemandes.nombre.places', '{{nombre}} places', { nombre }));

  /**
   * La phrase de la demande : longue (la carte) ou courte (la file, sur ordinateur).
   * @param {any} demande - La demande.
   * @param {boolean} courte - La version de la file.
   * @returns {string} La phrase.
   */
  const phraseDe = (demande, courte = false) => {
    const moment = momentDeLaDemande(demande);
    const valeurs = {
      club: demande?.club?.name || t('collectivite.requests.unknownClub', 'Club'),
      debut: moment?.debut || '',
      equipe: demande?.team?.name || '',
      fin: moment?.fin || '',
      jour: courte ? moment?.jourCourt || '' : moment?.jour || '',
      jourSemaine: moment?.jourSemaine || '',
      jusquAu: moment?.jusquAu || '',
      lieu: lieuAvecPreposition(demande?.facility?.name, t),
      ...SANS_ECHAPPEMENT,
    };
    const hebdo = estDemandeHebdo(demande);
    if (courte) {
      return hebdo
        // eslint-disable-next-line max-len
        ? t('collectiviteDemandes.phraseCourte.serie', '{{club}} demande chaque {{jourSemaine}}, {{debut}} – {{fin}}, {{lieu}} ({{equipe}}).', valeurs)
        // eslint-disable-next-line max-len
        : t('collectiviteDemandes.phraseCourte.unique', '{{club}} demande le {{jour}}, {{debut}} – {{fin}}, {{lieu}} ({{equipe}}).', valeurs);
    }
    if (hebdo && valeurs.jusquAu) {
      return t(
        'collectiviteDemandes.phrase.serie',
        // eslint-disable-next-line max-len
        '{{club}} demande chaque {{jourSemaine}}, de {{debut}} à {{fin}}, {{lieu}}, pour ses {{equipe}}, jusqu’au {{jusquAu}}.',
        valeurs,
      );
    }
    if (hebdo) {
      // eslint-disable-next-line max-len
      return t('collectiviteDemandes.phrase.serieSansFin', '{{club}} demande chaque {{jourSemaine}}, de {{debut}} à {{fin}}, {{lieu}}, pour ses {{equipe}}.', valeurs);
    }
    // eslint-disable-next-line max-len
    return t('collectiviteDemandes.phrase.unique', '{{club}} demande le {{jour}}, de {{debut}} à {{fin}}, {{lieu}}, pour ses {{equipe}}.', valeurs);
  };

  // La pastille d'état : « Complet » (orange) ou « 1 place libre » (vert).
  const pastilleDePlace = (/** @type {any} */ demande) => {
    const place = etatDeLaPlace(demande?.conflict);
    if (!place) return null;
    if (place.complet) {
      // eslint-disable-next-line max-len
      return { couleur: Colors.warning500, texte: t('collectiviteDemandes.pastille.complet', 'Complet') };
    }
    return {
      couleur: Colors.success500,
      texte: place.restantes === 1
        ? t('collectiviteDemandes.pastille.unePlaceLibre', '1 place libre')
        // eslint-disable-next-line max-len
        : t('collectiviteDemandes.pastille.placesLibres', '{{nombre}} places libres', { nombre: place.restantes }),
    };
  };

  /**
   * Une pastille.
   * @param {string} texte - Son texte.
   * @param {string} couleur - Sa couleur.
   * @param {string} testID - Son identifiant de test.
   * @returns {import('react').ReactElement} La pastille.
   */
  const pastille = (texte, couleur, testID) => (
    <View
      key={testID}
      style={[
        ApplicationStyle.borderRadius12,
        { backgroundColor: `${couleur}24`, borderColor: `${couleur}80`, borderWidth: 1 },
        { paddingHorizontal: 10, paddingVertical: 2 },
      ]}
      testID={testID}
    >
      <Text style={[Fonts.p3Bold, { color: couleur }]}>{texte}</Text>
    </View>
  );

  // Les pastilles d'une carte : la place, une fois / chaque semaine, et « Demande de votre club ».
  const pastillesDe = (/** @type {any} */ demande) => {
    const place = demande?.status === 'pending' ? pastilleDePlace(demande) : null;
    return (
      <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
        {place ? pastille(place.texte, place.couleur, 'demande-pastille-place') : null}
        {pastille(
          estDemandeHebdo(demande)
            ? t('collectiviteDemandes.pastille.chaqueSemaine', 'Chaque semaine')
            : t('collectiviteDemandes.pastille.uneFois', 'Une fois'),
          Colors.neutral300,
          'demande-pastille-frequence',
        )}
        {isOwnClubRequest(demande, userData)
          // eslint-disable-next-line max-len
          ? pastille(t('collectiviteDemandes.pastille.votreClub', 'Demande de votre club'), Colors.primary200, 'demande-votre-club')
          : null}
      </View>
    );
  };

  // Ce qu'il y a sur place, en une phrase ; qui est déjà là ; la conséquence.
  const surPlace = (/** @type {any} */ demande) => {
    const place = etatDeLaPlace(demande?.conflict);
    if (!place) return null;
    let phrasePlace;
    if (place.equipes === 0) {
      // eslint-disable-next-line max-len
      phrasePlace = t('collectiviteDemandes.place.personne', 'Personne n’y est : il reste {{places}}.', {
        places: nombreDePlaces(place.restantes), ...SANS_ECHAPPEMENT,
      });
    } else if (place.complet) {
      // eslint-disable-next-line max-len
      phrasePlace = t('collectiviteDemandes.place.complet', 'Il y a déjà {{equipes}} : c’est complet.', {
        equipes: nombreDEquipes(place.equipes), ...SANS_ECHAPPEMENT,
      });
    } else {
      // eslint-disable-next-line max-len
      phrasePlace = t('collectiviteDemandes.place.reste', 'Il y a déjà {{equipes}} : il reste {{places}}.', {
        // eslint-disable-next-line max-len
        equipes: nombreDEquipes(place.equipes), places: nombreDePlaces(place.restantes), ...SANS_ECHAPPEMENT,
      });
    }
    const groupes = occupantsParHoraire(demande?.conflict);
    const et = t('collectiviteDemandes.liaison.et', ' et ');
    const moment = momentDeLaDemande(demande);
    return (
      <View
        style={[
          ApplicationStyle.borderRadius12,
          Spaces.padding[12],
          {
            backgroundColor: `${place.depasse ? Colors.warning500 : Colors.success500}1F`,
            borderColor: `${place.depasse ? Colors.warning500 : Colors.success500}66`,
            borderWidth: 1,
            gap: 4,
          },
        ]}
        testID="collectivite-request-conflict"
      >
        {estDemandeHebdo(demande) && moment ? (
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('collectiviteDemandes.place.premiereDate', 'Pour la première date, le {{jour}} :', {
              jour: moment.jour, ...SANS_ECHAPPEMENT,
            })}
          </Text>
        ) : null}
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{phrasePlace}</Text>
        {groupes.map((groupe) => (
          <Text key={`${groupe.debut}-${groupe.fin}`} style={[Fonts.p2, Fonts.neutral100]}>
            {t('collectiviteDemandes.place.dejaLa', '{{noms}}, de {{debut}} à {{fin}}.', {
              debut: groupe.debut, fin: groupe.fin, noms: groupe.noms.join(et), ...SANS_ECHAPPEMENT,
            })}
          </Text>
        ))}
        <Text
          style={[Fonts.p3Bold, { color: place.depasse ? Colors.warning500 : Colors.success500 }]}
        >
          {place.depasse
            // eslint-disable-next-line max-len
            ? t('collectiviteDemandes.consequence.depasse', 'Accepter met {{equipes}} pour {{places}}.', {
              // eslint-disable-next-line max-len
              equipes: nombreDEquipes(place.apres), places: nombreDePlaces(place.capacite), ...SANS_ECHAPPEMENT,
            })
            : t('collectiviteDemandes.consequence.libre', 'Accepter ne gêne personne.')}
        </Text>
      </View>
    );
  };

  // Le motif et l'encadrant qui demande, en petit : « « Séance … » · Karim Benali, dirigeant ».
  const motifEtDemandeur = (/** @type {any} */ demande) => {
    // eslint-disable-next-line max-len
    const personne = [demande?.requestedBy?.firstname, demande?.requestedBy?.lastname].filter(Boolean).join(' ');
    let fonction = '';
    // eslint-disable-next-line max-len
    if (demande?.requesterFunction === 'manager') fonction = t('collectiviteDemandes.fonction.manager', 'dirigeant');
    // eslint-disable-next-line max-len
    if (demande?.requesterFunction === 'trainer') fonction = t('collectiviteDemandes.fonction.trainer', 'entraîneur');
    const qui = [personne, fonction].filter(Boolean).join(', ');
    const morceaux = [
      demande?.reason ? `« ${demande.reason} »` : '',
      qui,
    ].filter(Boolean);
    if (!morceaux.length) return null;
    return (
      <Text style={[Fonts.p3, Fonts.neutral300]} testID="demande-motif-demandeur">
        {morceaux.join(' · ')}
      </Text>
    );
  };

  // Les deux gestes : Refuser / Accepter (« Accepter la série » pour une série).
  const gestes = (/** @type {any} */ demande) => (
    <View style={[Alignments.row, { gap: 12 }]}>
      <View style={{ flex: 1 }}>
        <Button
          onPress={() => ouvrir('refuse', demande)}
          title={t('collectivite.requests.actions.refuse', 'Refuser')}
          variant="Secondary"
        />
      </View>
      <View style={{ flex: 1 }}>
        <Button
          onPress={() => ouvrir('approve', demande)}
          title={estDemandeHebdo(demande) && demande?.series
            ? t('collectiviteDemandes.actions.accepterSerie', 'Accepter la série')
            : t('collectivite.requests.actions.approve', 'Accepter')}
          variant="Primary"
        />
      </View>
    </View>
  );

  const carteStyle = {
    backgroundColor: `${Colors.primary700}73`,
    borderColor: `${Colors.primary500}80`,
    gap: 10,
  };

  // Une demande EN ATTENTE, entière : pastilles, phrase, place, motif, gestes.
  const renderEnAttente = (/** @type {any} */ demande) => (
    <View
      key={demande?.documentId}
      style={[ApplicationStyle.card, Spaces.padding[16], carteStyle]}
      testID={`collectivite-request-${demande?.documentId}`}
    >
      {pastillesDe(demande)}
      <Text style={[Fonts.p1Bold, Fonts.neutral00]} testID="demande-phrase">
        {phraseDe(demande)}
      </Text>
      {surPlace(demande)}
      {motifEtDemandeur(demande)}
      {gestes(demande)}
    </View>
  );

  // Une demande TRAITÉE : l'issue en grosse pastille, la phrase, votre message, « prévenu ».
  const renderTraitee = (/** @type {any} */ demande) => {
    const acceptee = demande?.status === 'approved';
    const date = dateDeDecision(demande);
    let prevenu = t('collectiviteDemandes.traitee.prevenu', 'Le club a été prévenu.');
    if (date) {
      prevenu = acceptee
        // eslint-disable-next-line max-len
        ? t('collectiviteDemandes.traitee.prevenuAcceptee', 'Le club a été prévenu · acceptée le {{date}}', { date })
        // eslint-disable-next-line max-len
        : t('collectiviteDemandes.traitee.prevenuRefusee', 'Le club a été prévenu · refusée le {{date}}', { date });
    }
    return (
      <View
        key={demande?.documentId}
        style={[ApplicationStyle.card, Spaces.padding[16], carteStyle]}
        testID={`collectivite-request-${demande?.documentId}`}
      >
        <View style={[Alignments.row, Alignments.alignCenter, { flexWrap: 'wrap', gap: 8 }]}>
          {pastille(
            acceptee
              ? t('collectivite.requests.status.approved', 'Acceptée')
              : t('collectivite.requests.status.refused', 'Refusée'),
            acceptee ? Colors.success500 : Colors.error500,
            'demande-issue',
          )}
          {pastillesDe(demande)}
        </View>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]} testID="demande-phrase">
          {phraseDe(demande)}
        </Text>
        {motifEtDemandeur(demande)}
        {demande?.decisionReason ? (
          <View style={{
            borderLeftColor: `${Colors.neutral00}33`, borderLeftWidth: 2, gap: 2, paddingLeft: 12,
          }}
          >
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t('collectiviteDemandes.traitee.votreMessage', 'Votre message')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>{`« ${demande.decisionReason} »`}</Text>
          </View>
        ) : null}
        <Text style={[Fonts.p3, Fonts.neutral300]}>{prevenu}</Text>
      </View>
    );
  };

  // Sur ordinateur, une ligne de la file : la pastille et la phrase courte.
  const renderLigneDeFile = (/** @type {any} */ demande, /** @type {boolean} */ active) => {
    const place = pastilleDePlace(demande);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        key={demande?.documentId}
        onPress={() => setOuverte(demande?.documentId || null)}
        style={[
          ApplicationStyle.borderRadius16,
          Spaces.padding[16],
          {
            backgroundColor: active ? `${Colors.primary500}1F` : `${Colors.neutral00}08`,
            borderColor: active ? Colors.primary500 : `${Colors.neutral00}17`,
            borderWidth: 1,
            gap: 6,
          },
        ]}
        testID={`demande-file-${demande?.documentId}`}
      >
        {place ? <Text style={[Fonts.p3Bold, { color: place.couleur }]}>{place.texte}</Text> : null}
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{phraseDe(demande, true)}</Text>
      </Pressable>
    );
  };

  const refusDAcces = Number(/** @type {any} */ (liste.error)?.status) === 403;

  let contenu;
  if (liste.isLoading) {
    contenu = <Loader />;
  } else if (refusDAcces) {
    contenu = (
      <View style={{ gap: 8 }} testID="demandes-acces-retire">
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('collectiviteDemandes.acces.titre', 'Accès retiré')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t('collectiviteDemandes.acces.texte', 'Vous ne gérez pas cette collectivité.')}
        </Text>
      </View>
    );
  } else if (liste.error) {
    contenu = (
      <View style={{ gap: 12 }} testID="demandes-erreur">
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('collectiviteDemandes.erreur.titre', 'Les demandes n’ont pas pu être lues.')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {getErrorMessage(/** @type {any} */ (liste.error))}
        </Text>
        <Button
          onPress={() => liste.refetch?.()}
          title={t('collectivite.requests.retry', 'Réessayer')}
          variant="Secondary"
        />
      </View>
    );
  } else if (demandes.length === 0) {
    contenu = onglet === 'pending' ? (
      <View style={{ gap: 8 }} testID="demandes-vide">
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('collectivite.requests.emptyPending', 'Aucune demande en attente.')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'collectiviteDemandes.vide.attente',
            // eslint-disable-next-line max-len
            'Quand un club veut une place sur une installation déjà complète, sa demande arrive ici. Vous l’acceptez ou la refusez, avec un mot ; le club est prévenu.',
          )}
        </Text>
      </View>
    ) : (
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {t('collectivite.requests.emptyDecided', 'Aucune demande traitée pour l’instant.')}
      </Text>
    );
  } else if (onglet === 'decided') {
    contenu = demandes.map(renderTraitee);
  } else if (deuxVolets) {
    const active = demandes.find((d) => d?.documentId === ouverte) || demandes[0];
    contenu = (
      <View style={[Alignments.row, { alignItems: 'flex-start', gap: 24 }]}>
        <View style={{ gap: 12, width: 380 }}>
          {demandes.map((d) => renderLigneDeFile(d, d?.documentId === active?.documentId))}
        </View>
        <View style={{ flex: 1 }}>{renderEnAttente(active)}</View>
      </View>
    );
  } else {
    contenu = demandes.map(renderEnAttente);
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <DecisionCreneauModal decision={decision} onClose={() => setDecision(null)} />

      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingTop: 12 }}
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => liste.refetch?.()}
            refreshing={Boolean(liste.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {/* TEXTES-COLLECTIVITES (01/10) : « Demandes de la Ville » est l en-tete de l ecran, */}
        {/* et s ecrivait deux fois. La page porte le NOM de la collectivite, comme les */}
        {/* installations. */}
        <View style={{ gap: 4 }}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {collectivite?.name || t('collectivite.requests.title', 'Demandes de la Ville')}
          </Text>
        </View>
        <SegmentedControl
          onChange={(/** @type {string} */ valeur) => setOnglet(
            valeur === 'decided' ? 'decided' : 'pending',
          )}
          options={[
            {
              // `nombre`, pas `count` : `count` ferait chercher a i18next une forme plurielle.
              label: t('collectivite.requests.tabs.pending', 'En attente ({{nombre}})', {
                nombre: nbEnAttente,
              }),
              value: 'pending',
            },
            { label: t('collectivite.requests.tabs.decided', 'Traitées'), value: 'decided' },
          ]}
          value={onglet}
        />
        {contenu}
      </ScrollView>
    </ScreenContainer>
  );
}

export default CollectiviteRequests;
