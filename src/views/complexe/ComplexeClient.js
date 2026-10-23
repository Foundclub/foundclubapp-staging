import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import {
  BAN_RAISON_MAX,
  clientDepuis,
  corpsDuBan,
  etatDuBan,
  ligneHistorique,
  nomComplet,
  prochaineReservation,
} from '@/domains/complexe/clientDuComplexe';
import {
  initialesDe, lignesDesPages, messageDeRefusResa, nomCourt,
} from '@/domains/complexe/complexeReservation';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import Input from '@/components/molecules/input/Input';
import ScreenContainer from '@/components/templates/ScreenContainer';
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';
import PastillesReservation from '@/views/complexe/components/PastillesReservation';

import { RouteNames } from '@/navigation/routeNames';

import {
  useBannir,
  useClientDuComplexe,
  useClientsDuComplexe,
  useComplexeChoisi,
  useComplexeGere,
  useDebannir,
  useEcrireAuReserveur,
  useHistoriqueClient,
  useReservationGeree,
} from '@/services/complexe/complexeQueries';

import { getServerErrorCode } from '@/utils/errors/displayError';
import texteInsecable from '@/utils/texteInsecable';

/** « Jusqu'au » : un jour à venir, dans les 5 ans (la borne du serveur, `BAN_DAYS_MAX`). */
const CINQ_ANS_EN_MS = 5 * 365 * 24 * 60 * 60 * 1000;

/** @typedef {{ complexeId?: string, joueurId?: string, reservationId?: string }} ParamsDuClient */
/** @typedef {{ texte: string, ton: 'interdit' | 'ok' }} MessageDuClient */

/**
 * Un nombre du serveur, ou 0.
 * @param {unknown} valeur - La valeur.
 * @returns {number} Le nombre.
 */
const nombre = (valeur) => (Number.isFinite(Number(valeur)) ? Number(valeur) : 0);

/**
 * E-G15 — LA FICHE D'UN CLIENT DU COMPLEXE — RESA-L5B-1 (20/10/2026), planche EG15 états 2 à 5,
 * plan :970-1010, RG-BAN ; serveur RESA-L2B (`GET /complexes/:id/clients/:joueurId`,
 * `POST /complexes/:id/bannis`, `POST /complexes/:id/bannis/:joueurId/lever`).
 * Dans l'ordre : l'identité (initiales, nom ; la pastille « Banni »), les chiffres de CE complexe
 * (non honorées, annulations hors délai, réservations à venir), puis le bloc « Bannissement » :
 * « Non banni » et « Bannir » ; ou « Banni depuis le 14/10 · automatique : 3 réservations non
 * honorées » / « Banni jusqu'au 30/11 · raison privée : … », « Julien M. ne peut plus réserver chez
 * toi. », ce que le joueur lit, et « Débannir » (avec sa confirmation).
 * La feuille « Bannir » : raison PRIVÉE obligatoire (200 caractères), « Jusqu'au » facultatif (sans
 * date de fin par défaut), « Annuler aussi ses 2 réservations à venir » (décochée), « Bannir ».
 * ⚠️ La raison n'est lue que par le gérant : le joueur banni ne lit que « Tu ne peux plus réserver
 * dans ce complexe. » (RC-P08, E-P13) ; il n'est pas prévenu d'un bannissement à la main (RG-BAN).
 * Entrées : le nom du réserveur sur la fiche d'une réservation (E-G05, `joueurId`) ; la
 * notification du bannissement automatique (N-12), qui ne porte que la réservation
 * (`reservationId`) : le joueur est lu dans sa fiche.
 * RESA-L5B-2 (20/10/2026, serveur RESA-L4) : « Client depuis le 02/09 » (sa plus ancienne
 * réservation ICI, quand l'historique est entier), les parties jouées et la fidélité « 8/10 » (lue
 * dans la LISTE des clients, cherchée par son nom : la fiche du serveur ne la porte pas) parmi les
 * chiffres, l'« Historique » (ses 50 dernières réservations ICI ; toucher une ligne ouvre sa fiche,
 * E-G05) et « Écrire » SEULEMENT s'il a une réservation à venir (AT-04 : la conversation de CETTE
 * réservation, RESA-L3). La liste elle-même : `ComplexeClients`.
 * Paramètres de route : `complexeId` et `joueurId`, ou `reservationId`. Caché par
 * `COMPLEXES_GERANT`.
 * @param {object} [props] - Les propriétés (seulement dans le volet de la liste, sur ordinateur).
 * @param {string | null} [props.complexeId] - Le complexe.
 * @param {boolean} [props.dansUnVolet] - Dans le volet de droite de E-G15.
 * @param {string | null} [props.joueurId] - Le client.
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeClient({
  complexeId: complexeDuVolet = null,
  dansUnVolet = false,
  joueurId: joueurDuVolet = null,
} = {}) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  // RESA-FIN-APP (20/10) — sur ordinateur, la fiche s'ouvre DANS LE VOLET de droite de la liste
  // (plan :279, :1007 ; reste de RESA-L5B-2) : ses paramètres viennent alors de la liste.
  const params = /** @type {ParamsDuClient | undefined} */ (dansUnVolet
    ? { complexeId: complexeDuVolet || undefined, joueurId: joueurDuVolet || undefined }
    : route?.params);
  // RESA-L5B-2 : sans `?complexeId=` (site), le complexe du compte.
  const { complexeId } = useComplexeChoisi(params?.complexeId);
  // N-12 ne porte que la réservation : le joueur est lu dans sa fiche (rien n'est lu sinon).
  const viaReservation = useReservationGeree(
    params?.joueurId ? null : complexeId,
    params?.joueurId ? null : params?.reservationId,
  );
  const joueurId = params?.joueurId || viaReservation.data?.booker?.documentId || null;
  const lecture = useClientDuComplexe(complexeId, joueurId);
  // Le seuil vit sous `rules` dans la lecture du gérant (`toManagedView`, RESA-L1A).
  const seuil = Number(useComplexeGere(complexeId).data?.rules?.autoBanNoShows);
  const bannir = useBannir();
  const debannir = useDebannir();
  // RESA-L5B-2 — l'historique et les parties (RESA-L4) ; la fidélité, dans la liste cherchée par
  // son nom (ponytail: une lecture de la liste pour UN client — plafond : la fiche du serveur ne
  // porte pas la fidélité ; voie de sortie : `fidelite` dans `GET /clients/:joueurId`).
  const historique = useHistoriqueClient(complexeId, joueurId);
  const nomCherche = nomComplet(lecture.data);
  const parSonNom = useClientsDuComplexe(
    complexeId,
    { onglet: 'tous', recherche: nomCherche },
    { enabled: Boolean(nomCherche) },
  );
  const fidelite = lignesDesPages(parSonNom.data)
    .find((/** @type {any} */ ligne) => ligne?.documentId === joueurId)?.fidelite || null;
  const ecrire = useEcrireAuReserveur();
  const [erreurEcrire, setErreurEcrire] = useState('');

  /** @typedef {'' | 'bannir' | 'debannir'} FeuilleDuClient */
  const [feuille, setFeuille] = useState(/** @type {FeuilleDuClient} */ (''));
  const [raison, setRaison] = useState('');
  const [jusqua, setJusqua] = useState('');
  const [annulerAVenir, setAnnulerAVenir] = useState(false);
  const [erreurFeuille, setErreurFeuille] = useState('');
  const [message, setMessage] = useState(/** @type {MessageDuClient | null} */ (null));

  // Chaque ouverture de « Bannir » repart d'une feuille vide (la case DÉCOCHÉE, RG-BAN).
  useEffect(() => {
    if (feuille === 'bannir') {
      setRaison('');
      setJusqua('');
      setAnnulerAVenir(false);
    }
    setErreurFeuille('');
  }, [feuille]);

  const carte = {
    backgroundColor: withAlpha(Colors.primary700, 0.45),
    borderColor: withAlpha(Colors.primary500, 0.5),
    borderRadius: 16,
    borderWidth: 1,
  };
  const client = lecture.data;
  const nomDuClient = client ? (nomCourt(client) || nomComplet(client)) : '';
  const prenom = String(client?.firstname || '').trim() || nomDuClient;
  const avecNom = { nom: nomDuClient, prenom, ...SANS_ECHAPPEMENT };
  const aVenir = nombre(client?.upcoming);
  const repli = t('complexeReservations.fiche.erreurGeste', 'Le geste n’a pas pu être fait.');
  const nePeutPlus = t(
    'complexeClients.ban.nePeutPlus',
    '{{nom}} ne peut plus réserver chez toi.',
    avecNom,
  );
  // Le champ porte son libellé pour le lecteur d'écran (sur le site, le libellé d'`Input` est un
  // texte à côté du champ, pas son nom).
  const libelleRaison = t(
    'complexeClients.bannir.raison',
    'Raison (privée, jamais montrée à {{prenom}})',
    avecNom,
  );
  const fermer = () => setFeuille('');
  const erreurDeLaFeuille = erreurFeuille ? (
    <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{erreurFeuille}</Text>
  ) : null;

  // ── Le corps ───────────────────────────────────────────────────────────────────────────
  let corps;
  if (lecture.isLoading || viaReservation.isLoading) {
    corps = (
      <View accessibilityState={{ busy: true }} style={{ gap: 12 }} testID="client-squelette">
        {[64, 96, 132].map((hauteur) => (
          <View
            key={hauteur}
            style={[
              ApplicationStyle.borderRadius16,
              { backgroundColor: withAlpha(Colors.neutral00, 0.06), height: hauteur },
            ]}
          />
        ))}
      </View>
    );
  } else if (!client) {
    const code = getServerErrorCode(lecture.error || viaReservation.error);
    const definitif = code === 'COMPLEXE_CLIENT_NOT_FOUND'
      || code === 'COMPLEXE_RESERVATION_NOT_FOUND';
    let texte = t('complexeClients.fiche.erreur', 'Impossible de charger la fiche du client.');
    if (code === 'COMPLEXE_CLIENT_NOT_FOUND') {
      texte = t('complexeClients.fiche.jamaisVenu', 'Ce joueur n’a jamais réservé chez toi.');
    } else if (code === 'COMPLEXE_RESERVATION_NOT_FOUND') {
      texte = t('complexeReservations.refus.introuvable', 'Cette réservation n’existe plus.');
    }
    corps = (
      <View
        accessibilityRole="alert"
        style={[carte, Spaces.padding[24], Alignments.alignCenter, { gap: 12 }]}
      >
        <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter]}>{texte}</Text>
        {definitif ? null : (
          <Button
            onPress={() => (lecture.error ? lecture.refetch?.() : viaReservation.refetch?.())}
            title={t('complexeGerant.accueil.reessayer', 'Réessayer')}
            variant="Secondary"
          />
        )}
      </View>
    );
  } else {
    const banni = Boolean(client.ban);
    const reservationsIci = Array.isArray(historique.data?.reservations)
      ? historique.data.reservations
      : [];
    const parties = historique.data ? nombre(historique.data.parties) : null;
    const seuilFidelite = Number(fidelite?.threshold);
    const depuis = clientDepuis(reservationsIci);
    const aEcrire = prochaineReservation(reservationsIci);
    const ecrireAuClient = async () => {
      if (!aEcrire) return;
      setErreurEcrire('');
      try {
        const reponse = await ecrire.mutateAsync({
          complexeId, reservationId: aEcrire.documentId,
        });
        const chatId = reponse?.data?.chat;
        // RESA-FIN-APP-3 : `espace: 'complexe'` — sur le site, la conversation garde la barre du
        // gérant (comme le canal, ComplexeCanal), au lieu des onglets du joueur (tournée 3).
        if (chatId) navigation.navigate(RouteNames.Conversation, { chatId, espace: 'complexe' });
      } catch (erreur) {
        setErreurEcrire(messageDeRefusResa(t, erreur, repli));
      }
    };
    // RESA-FIN-APP-3 — `noShowsSinceLift` (RESA-FIN-SERVEUR 9/11) : moins que le total = un ban levé.
    const depuisLaLevee = Number.isInteger(client.noShowsSinceLift)
      ? client.noShowsSinceLift
      : null;
    const leveeDuBan = depuisLaLevee !== null && depuisLaLevee < nombre(client.noShows);
    /** @type {Array<{ cle: string, depuis?: string | null, libelle: string, valeur: any }>} */
    const chiffres = [
      ...(parties === null ? [] : [{
        cle: 'parties',
        libelle: t('complexeClients.chiffres.parties', 'parties jouées', {
          count: parties,
          defaultValue_one: 'partie jouée',
          defaultValue_other: 'parties jouées',
        }),
        valeur: parties,
      }]),
      {
        cle: 'non-honorees',
        // RESA-FIN-APP-3 (23/10/2026) — le compte depuis la levée du dernier ban, quand il diffère
        // du total : c'est lui que le ban automatique regarde (tournée 3).
        depuis: leveeDuBan ? t('complexeClients.chiffres.depuisLaLevee', '{{nombre}} depuis la levée du ban', {
          nombre: depuisLaLevee,
        }) : null,
        libelle: t('complexeClients.chiffres.nonHonorees', 'non honorée', {
          count: nombre(client.noShows),
          defaultValue_one: 'non honorée',
          defaultValue_other: 'non honorées',
        }),
        valeur: nombre(client.noShows),
      },
      {
        cle: 'hors-delai',
        libelle: t('complexeClients.chiffres.horsDelai', 'annulation hors délai', {
          count: nombre(client.lateCancellations),
          defaultValue_one: 'annulation hors délai',
          defaultValue_other: 'annulations hors délai',
        }),
        valeur: nombre(client.lateCancellations),
      },
      ...(fidelite && Number.isInteger(seuilFidelite) && seuilFidelite > 0 ? [{
        cle: 'fidelite',
        libelle: t('complexeClients.chiffres.fidelite', 'fidélité'),
        valeur: `${nombre(fidelite.count)}/${seuilFidelite}`,
      }] : []),
      {
        cle: 'a-venir',
        libelle: t('complexeClients.chiffres.aVenir', 'réservation à venir', {
          count: aVenir,
          defaultValue_one: 'réservation à venir',
          defaultValue_other: 'réservations à venir',
        }),
        valeur: aVenir,
      },
    ];
    corps = (
      <View style={{ gap: 16 }}>
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
          <View
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              {
                backgroundColor: Colors.primary700, borderRadius: 999, height: 64, width: 64,
              },
            ]}
          >
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{initialesDe(client)}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
              {nomComplet(client)}
            </Text>
            {depuis ? (
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t('complexeClients.fiche.depuis', 'Client depuis le {{jour}}', {
                  jour: depuis, ...SANS_ECHAPPEMENT,
                })}
              </Text>
            ) : null}
            {banni ? (
              <View
                style={[
                  Alignments.row,
                  Alignments.alignCenter,
                  {
                    alignSelf: 'flex-start',
                    backgroundColor: withAlpha(Colors.error500, 0.14),
                    borderColor: withAlpha(Colors.error500, 0.55),
                    borderRadius: 999,
                    borderWidth: 1,
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  },
                ]}
                testID="client-pastille-banni"
              >
                <GlyphIcon color={Colors.error500} name="ban" size={12} />
                <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                  {t('complexeClients.fiche.banni', 'Banni')}
                </Text>
              </View>
            ) : null}
          </View>
          {aEcrire ? (
            <View testID="client-ecrire">
              <Button
                isLoading={Boolean(ecrire.isPending)}
                onPress={ecrireAuClient}
                size="sm"
                title={t('complexeClients.fiche.ecrire', 'Écrire')}
                variant="Secondary"
              />
            </View>
          ) : null}
        </View>
        {erreurEcrire ? (
          <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>
            {erreurEcrire}
          </Text>
        ) : null}
        {message ? (
          <BandeauComplexe testID="client-message" texte={message.texte} ton={message.ton} />
        ) : null}
        <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
          {chiffres.map((chiffre) => (
            <View
              key={chiffre.cle}
              style={{
                backgroundColor: withAlpha(Colors.primary500, 0.06),
                borderColor: withAlpha(Colors.primary500, 0.18),
                borderRadius: 12,
                borderWidth: 1,
                flexBasis: 140,
                flexGrow: 1,
                gap: 2,
                padding: 12,
              }}
              testID={`client-chiffre-${chiffre.cle}`}
            >
              <Text style={[Fonts.h3Black, Fonts.neutral00]}>{String(chiffre.valeur)}</Text>
              <Text style={[Fonts.p3, Fonts.neutral100]}>{chiffre.libelle}</Text>
              {chiffre.depuis ? (
                <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{chiffre.depuis}</Text>
              ) : null}
            </View>
          ))}
        </View>
        {reservationsIci.length ? (
          <View style={{ gap: 8 }} testID="client-historique">
            <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
              {t('complexeClients.fiche.historique', 'Historique').toUpperCase()}
            </Text>
            {reservationsIci.map((/** @type {any} */ reservation) => {
              const ligne = ligneHistorique(reservation);
              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  key={reservation.documentId}
                  onPress={() => navigation.navigate(RouteNames.ComplexeReservation, {
                    complexeId, reservationId: reservation.documentId,
                  })}
                  style={[Alignments.row, Alignments.alignCenter, Alignments.wrap, {
                    gap: 8, minHeight: 44,
                  }]}
                  testID={`client-historique-${reservation.documentId}`}
                >
                  <Text style={[Fonts.p2, Fonts.neutral100]}>{texteInsecable(ligne.texte)}</Text>
                  <PastillesReservation statut={ligne.etat} />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        <View
          style={[
            carte,
            Spaces.padding[16],
            { gap: 8 },
            banni ? { borderColor: withAlpha(Colors.error500, 0.45) } : null,
          ]}
          testID="client-bannissement"
        >
          <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
            {t('complexeClients.ban.titre', 'Bannissement').toUpperCase()}
          </Text>
          <Text style={[banni ? Fonts.p2Bold : Fonts.p2, Fonts.neutral00]}>
            {etatDuBan(t, client.ban)}
          </Text>
          {banni ? (
            <Text style={[Fonts.p2, Fonts.neutral00]}>
              {nePeutPlus}
            </Text>
          ) : null}
          {banni ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'complexeClients.ban.ceQuIlLit',
                '{{prenom}} lit seulement « Tu ne peux plus réserver dans ce complexe. »',
                avecNom,
              )}
            </Text>
          ) : null}
          {!banni && Number.isInteger(seuil) && seuil > 0 ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'complexeClients.ban.automatiqueAu',
                'Bannissement automatique au bout de {{count}} non honorées.',
                {
                  count: seuil,
                  defaultValue_one: 'Bannissement automatique à la 1re non honorée.',
                  defaultValue_other: 'Bannissement automatique au bout de {{count}} non honorées.',
                  ...SANS_ECHAPPEMENT,
                },
              )}
            </Text>
          ) : null}
          {!banni && leveeDuBan && Number.isInteger(seuil) && seuil > 0 ? (
            <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
              {t(
                'complexeClients.ban.repartDeLaLevee',
                'Le compteur repart de la levée du ban : {{nombre}} sur {{seuil}}.',
                { nombre: depuisLaLevee, seuil },
              )}
            </Text>
          ) : null}
          <View testID={banni ? 'client-debannir' : 'client-bannir'}>
            <Button
              onPress={() => {
                setMessage(null);
                setFeuille(banni ? 'debannir' : 'bannir');
              }}
              title={banni
                ? t('complexeClients.ban.debannir', 'Débannir')
                : t('complexeClients.ban.bannir', 'Bannir')}
              variant={banni ? 'Secondary' : 'Danger'}
            />
          </View>
        </View>
      </View>
    );
  }

  // ── Les gestes ─────────────────────────────────────────────────────────────────────────
  const raisonNette = raison.replace(/\s+/g, ' ').trim();
  const confirmerLeBan = async () => {
    if (!client || !raisonNette) return;
    setErreurFeuille('');
    try {
      await bannir.mutateAsync({
        ban: corpsDuBan({
          annulerAVenir, joueur: String(client.documentId), jusqua, raison: raisonNette,
        }),
        complexeId,
      });
      setFeuille('');
      setMessage({
        texte: nePeutPlus,
        ton: 'interdit',
      });
    } catch (erreur) {
      setErreurFeuille(messageDeRefusResa(t, erreur, repli));
    }
  };
  const confirmerLaLevee = async () => {
    if (!client) return;
    setErreurFeuille('');
    try {
      await debannir.mutateAsync({ complexeId, joueurId: String(client.documentId) });
      setFeuille('');
      setMessage({
        texte: t('complexeClients.ban.peutANouveau', '{{nom}} peut à nouveau réserver.', avecNom),
        ton: 'ok',
      });
    } catch (erreur) {
      setErreurFeuille(messageDeRefusResa(t, erreur, repli));
    }
  };
  const boutonsDeLaFeuille = (
    /** @type {string} */ testID,
    /** @type {import('react').ReactElement} */ confirmer,
  ) => (
    <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
      <View style={{ flexBasis: 140, flexGrow: 1 }}>
        <Button
          onPress={fermer}
          title={t('complexeReservations.feuille.annuler', 'Annuler')}
          variant="Ghost"
        />
      </View>
      <View style={{ flexBasis: 140, flexGrow: 1 }} testID={testID}>{confirmer}</View>
    </View>
  );

  const boutonBannir = (
    <Button
      disabled={!raisonNette || Boolean(bannir.isPending)}
      isLoading={Boolean(bannir.isPending)}
      onPress={confirmerLeBan}
      title={t('complexeClients.ban.bannir', 'Bannir')}
      variant="DangerFilled"
    />
  );
  const boutonDebannir = (
    <Button
      isLoading={Boolean(debannir.isPending)}
      onPress={confirmerLaLevee}
      title={t('complexeClients.ban.debannir', 'Débannir')}
    />
  );

  const enveloppe = (/** @type {import('react').ReactNode} */ contenu) => (dansUnVolet ? (
    <View style={[Alignments.fill]}>{contenu}</View>
  ) : (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[12], Spaces.paddingBottom[16], Alignments.fill]}
    >
      {contenu}
    </ScreenContainer>
  ));

  return enveloppe(
    <>
      <ScrollView
        // Sur ordinateur, une colonne de 720 px au plus, centrée (comme E-G09).
        contentContainerStyle={{
          alignSelf: 'center', gap: 16, maxWidth: 720, paddingBottom: 24, width: '100%',
        }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {corps}
      </ScrollView>

      <BottomModal close={fermer} isVisible={feuille === 'bannir'} webPresentation="dialog">
        <View style={{ gap: 16 }} testID="feuille-bannir">
          <View style={{ gap: 4 }}>
            <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
              {t('complexeClients.bannir.titre', 'Bannir {{nom}}', avecNom)}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t(
                'complexeClients.bannir.dit',
                'Il ne pourra plus réserver chez toi. Rien ne change ailleurs.',
              )}
            </Text>
          </View>
          <Input
            accessibilityLabel={libelleRaison}
            label={libelleRaison}
            maxLength={BAN_RAISON_MAX}
            multiline
            onChangeText={setRaison}
            value={raison}
          />
          <DatePickerInput
            label={t('complexeClients.bannir.jusqua', 'Jusqu’au (facultatif)')}
            maximumDate={new Date(Date.now() + CINQ_ANS_EN_MS)}
            minimumDate={new Date()}
            onChange={(/** @type {string} */ valeur) => setJusqua(valeur)}
            placeholder={t('complexeClients.bannir.sansFin', 'Sans date de fin')}
            testID="feuille-bannir-jusqua"
            value={jusqua}
          />
          {aVenir > 0 ? (
            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{ checked: annulerAVenir }}
              onPress={() => setAnnulerAVenir((avant) => !avant)}
              style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 44 }]}
              testID="feuille-bannir-annuler-a-venir"
            >
              <View
                style={[
                  Alignments.alignCenter,
                  Alignments.justifyCenter,
                  {
                    backgroundColor: annulerAVenir ? Colors.primary500 : 'transparent',
                    borderColor: withAlpha(Colors.primary500, annulerAVenir ? 1 : 0.6),
                    borderRadius: 6,
                    borderWidth: 2,
                    height: 22,
                    width: 22,
                  },
                ]}
              >
                {annulerAVenir ? (
                  <GlyphIcon color={Colors.neutral00} name="check" size={14} />
                ) : null}
              </View>
              <Text style={[Fonts.p2, Fonts.neutral00, { flex: 1 }]}>
                {t(
                  'complexeClients.bannir.annulerAVenir',
                  'Annuler aussi ses {{count}} réservations à venir',
                  {
                    count: aVenir,
                    defaultValue_one: 'Annuler aussi sa réservation à venir',
                    defaultValue_other: 'Annuler aussi ses {{count}} réservations à venir',
                    ...SANS_ECHAPPEMENT,
                  },
                )}
              </Text>
            </TouchableOpacity>
          ) : null}
          {erreurDeLaFeuille}
          {boutonsDeLaFeuille('feuille-bannir-confirmer', boutonBannir)}
        </View>
      </BottomModal>

      <BottomModal close={fermer} isVisible={feuille === 'debannir'} webPresentation="dialog">
        <View style={{ gap: 16 }} testID="feuille-debannir">
          <View style={{ gap: 4 }}>
            <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
              {t('complexeClients.debannir.titre', 'Débannir {{nom}} ?', avecNom)}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t(
                'complexeClients.debannir.dit',
                '{{nom}} pourra à nouveau réserver chez toi.',
                avecNom,
              )}
            </Text>
          </View>
          {erreurDeLaFeuille}
          {boutonsDeLaFeuille('feuille-debannir-confirmer', boutonDebannir)}
        </View>
      </BottomModal>
    </>,
  );
}

export default ComplexeClient;
