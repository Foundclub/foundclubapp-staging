import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { formatEuros, libelleSport, texteDuree } from '@/domains/complexe/complexeTerrain';
import {
  choixDesOptions,
  lignesAReglerSurPlace,
  quantitesInitiales,
} from '@/domains/complexe/optionsTerrain';
import {
  contenuDEchec,
  demandeDeReservation,
  parametresDEchec,
  texteAnnulation,
  texteCeQuePaieLeGroupe,
  texteCreneau,
  texteJourLong,
  varianteDEchec,
} from '@/domains/complexe/reserverTerrain';
import { getManagedTeams } from '@/domains/team/teamMembership';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import Input from '@/components/molecules/input/Input';
import ScreenContainer from '@/components/templates/ScreenContainer';
import BlocOptions from '@/views/reserverTerrain/components/BlocOptions';
import BlocPourQui from '@/views/reserverTerrain/components/BlocPourQui';
import BlocReglerSurPlace from '@/views/reserverTerrain/components/BlocReglerSurPlace';
import BlocTonGroupe from '@/views/reserverTerrain/components/BlocTonGroupe';

import { RouteNames } from '@/navigation/routeNames';

import {
  useApercuDeReservation,
  useComplexePublic,
  usePublierUneAnnonce,
  useReserverUnCreneau,
} from '@/services/complexe/complexeJoueurQueries';

import { isBirthdateUnderAge, PARENTAL_POWER_ENDS_AGE } from '@/constants/parentalDeclaration';
import { useIsDesktop } from '@/responsive';

const COLONNE = 560;
const MOT_MAX = 140;
// La date limite d'essai qui fait rendre au serveur la plus tardive permise (RG-QUORUM, Q3) :
// une heure et une minute devant soi. RESA-JOUEUR : la réservation en construction prend toujours
// cette date la plus tardive (le joueur ne la choisit plus, maquette « 232- ok »).
const ESSAI_DE_COLLECTE_MS = 61 * 60 * 1000;

/**
 * Le prix FIGÉ du récapitulatif (D4), au mot du joueur : « 60 €, à régler sur place » ; par
 * joueur : « 6 € par joueur, à régler sur place ».
 * @param {any} t - Traduction.
 * @param {{ amount?: number | null, unit?: string | null } | null | undefined} prix - Le prix.
 * @returns {string} Le texte, ou ''.
 */
const prixSurPlace = (t, prix) => {
  if (!prix || !Number.isFinite(Number(prix.amount))) return '';
  const montant = formatEuros(Number(prix.amount));
  const base = prix.unit === 'joueur'
    ? t('reserverTerrain.prix.parJoueur', '{{prix}} par joueur', {
      prix: montant,
      ...SANS_ECHAPPEMENT,
    })
    : montant;
  return t('reserverTerrain.prix.surPlace', '{{prix}}, à régler sur place', {
    prix: base,
    ...SANS_ECHAPPEMENT,
  });
};

/**
 * E-P04 — « LE RÉCAPITULATIF » — RESA-L6A (14/10/2026), planches EP04, P00 bloc 7 et OR3 (gabarit
 * B), plan E-P04. Juste avant de réserver, dans l'ordre de la fiche :
 *   1. « Ta réservation » : complexe, terrain, sport, jour, heures, le prix FIGÉ par le serveur
 *      (« à régler sur place », D4) ; « Modifier » ramène au choix du créneau ;
 *   2. « Combien de joueurs ? » : de 2 à la capacité du terrain ;
 *   3. « Un petit mot » (140 caractères, facultatif) ;
 *   4. la case « Partager mon numéro avec le complexe » DÉCOCHÉE (D7) — absente pour un mineur
 *      (AT-04 ; le serveur l'ignore aussi) ;
 *   5. le mot du complexe (A-G26) ;
 *   6. l'engagement sur l'honneur, en TEXTE SEUL juste au-dessus du bouton (RG-HONNEUR, AT-14 :
 *      rien à cocher, le bouton est actif d'emblée), et le délai d'annulation figé ;
 *   7. « Réserver » (automatique) ou « Envoyer la demande » (sur demande).
 * RESA-L6B-2 (20/10/2026, serveur RESA-L3 ; planche EP04 états 2 et 3) : « Pour qui ? » pour un
 * encadrant MAJEUR d'au moins une équipe (A-P04, AT-03 B : le serveur confirme l'équipe et le
 * nombre de joueurs ajoutés), et l'option collecte (A-P07, RC-P05, Q3 : le nombre requis, la date
 * limite que le complexe permet, « Lancer la collecte »).
 * Le serveur recalcule tout (RG-SECU) : l'app n'envoie que sa liste blanche. Refus ⇒ E-P13 (à la
 * place de cet écran) ; sans réseau ⇒ « La réservation n'est pas partie », tout reste rempli.
 * Paramètres : `slug`, `terrainId`, `date`, `from`, et `apercu` (la réponse du serveur à E-P03 ;
 * sans elle — un lien —, l'écran la demande).
 * Caché par `COMPLEXES_JOUEUR`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ReserverRecapitulatif() {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  /**
   * @type {{ apercu?: any, date?: string, durationMinutes?: number, from?: string, slug?: string,
   *   terrainId?: string }}
   */
  const params = /** @type {any} */ (route?.params) || {};
  // DT-3 (maquette J2) : la durée, SEULEMENT quand le joueur l'a choisie parmi plusieurs (E-P03) ;
  // elle repart au serveur avec chaque demande (DT-1 : absente, c'est la plus courte).
  const dureeChoisie = Number(params.durationMinutes) > 0 ? Number(params.durationMinutes) : null;
  const avecDuree = dureeChoisie ? { durationMinutes: dureeChoisie } : {};
  const { userData } = useAuth();
  const surOrdinateur = useIsDesktop();
  const reserver = useReserverUnCreneau();
  const publierLAnnonce = usePublierUneAnnonce();
  const lireLApercu = useApercuDeReservation();

  const [apercu, setApercu] = useState(/** @type {any} */ (params.apercu || null));
  const capacite = Number(apercu?.terrain?.capacity) > 0 ? Number(apercu.terrain.capacity) : 10;
  // RESA-JOUEUR (D50) : « On a assez de joueurs » / « Il nous manque des joueurs » ; le nombre
  // requis est celui du complexe (la capacité du terrain).
  const [choixDuGroupe, setChoixDuGroupe] = useState(/** @type {'assez' | 'manque'} */ ('assez'));
  const [combien, setCombien] = useState(1);
  const [publication, setPublication] = useState(false);
  const [mot, setMot] = useState('');
  const [partager, setPartager] = useState(false);
  const [bandeau, setBandeau] = useState(/** @type {string | null} */ (null));
  const [pourQui, setPourQui] = useState(/** @type {'equipe' | 'moi'} */ ('moi'));
  const [equipe, setEquipe] = useState(/** @type {any} */ (null));
  const [equipeEnCours, setEquipeEnCours] = useState(/** @type {string | null} */ (null));
  const [refusEquipe, setRefusEquipe] = useState(/** @type {string | null} */ (null));
  // RESA-OPTIONS (D61) : les options que CE terrain propose (le récapitulatif du serveur) et leurs
  // compteurs ; une option obligatoire part à 1.
  const offertes = /** @type {any[]} */ (Array.isArray(apercu?.options) ? apercu.options : []);
  const [quantites, setQuantites] = useState(/** @type {Record<string, number>} */ ({}));
  const offertesLues = offertes.map((option) => option.id).join('|');
  useEffect(() => {
    setQuantites(quantitesInitiales(offertes));
    // Les compteurs repartent quand les options proposées changent, pas à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offertesLues]);
  const choisies = offertes.map((option) => ({
    ...option,
    quantity: Number(quantites[option.id]) || 0,
  }));
  const aReglerSurPlace = lignesAReglerSurPlace(t, apercu?.price, capacite, choisies);
  const slugDuComplexe = params.slug || apercu?.complexe?.slug || null;
  const ageMinimum = Number(useComplexePublic(slugDuComplexe)?.data?.rules?.minAge) || null;

  const vaVersLEchec = (/** @type {any} */ erreur, /** @type {any} */ source) => {
    navigation.replace(
      RouteNames.ReserverEchec,
      parametresDEchec({
        complexe: source?.complexe?.name,
        creneau: { from: source?.from || params.from, to: source?.to },
        date: source?.date || params.date,
        erreur,
        slug: params.slug,
        telephone: source?.complexe?.phoneNumber,
        terrain: source?.terrain || { documentId: params.terrainId },
        variante: varianteDEchec(erreur),
      }),
    );
  };

  useEffect(() => {
    if (apercu || !params.terrainId || !params.date || !params.from) return undefined;
    let vivant = true;
    lireLApercu
      .mutateAsync({
        date: params.date,
        ...avecDuree,
        from: params.from,
        terrain: String(params.terrainId),
      })
      .then((reponse) => {
        if (!vivant) return;
        setApercu(reponse);
      })
      .catch((erreur) => {
        if (vivant) vaVersLEchec(erreur, null);
      });
    return () => {
      vivant = false;
    };
    // Une seule lecture, à l'arrivée sans récapitulatif.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const naissance = /** @type {any} */ (userData)?.birthdate;
  const majeur = Boolean(naissance) && !isBirthdateUnderAge(naissance, PARENTAL_POWER_ENDS_AGE);
  const peutPartagerNumero = apercu?.canSharePhone === true && majeur;
  const surDemande = apercu?.willBe === 'en_attente';
  // A-P04, AT-03 B : « Pour mon équipe » est le geste d'un encadrant MAJEUR (le serveur le redit).
  const equipesEncadrees = majeur ? getManagedTeams(userData) : [];
  const leCreneau = () => ({
    date: String(apercu?.date || params.date),
    ...avecDuree,
    from: String(apercu?.from || params.from),
    terrain: String(apercu?.terrain?.documentId || params.terrainId),
  });

  const choisirPourQui = (/** @type {'equipe' | 'moi'} */ choix) => {
    setPourQui(choix);
    setRefusEquipe(null);
    if (choix === 'moi') setEquipe(null);
  };
  const choisirEquipe = async (/** @type {any} */ une) => {
    setRefusEquipe(null);
    setEquipe(null);
    setEquipeEnCours(une.documentId);
    try {
      const reponse = await lireLApercu.mutateAsync({ ...leCreneau(), team: une.documentId });
      setEquipe({
        documentId: une.documentId,
        membres: reponse?.equipe?.membres ?? null,
        name: reponse?.equipe?.name || une.name,
      });
    } catch (erreur) {
      setRefusEquipe(contenuDEchec(t, varianteDEchec(erreur), { erreur }).titre);
    } finally {
      setEquipeEnCours(null);
    }
  };
  const equipeAttendue = pourQui === 'equipe' && !equipe;

  const enConstruction = choixDuGroupe === 'manque';
  // RESA-JOUEUR : « Il nous manque des joueurs » — la collecte du serveur (le nombre requis = celui
  // du complexe ; la date limite la plus tardive qu'il permet, lue par un récapitulatif d'essai),
  // puis l'annonce (places = ce qui manque). L'annonce qui échoue ne défait pas la réservation : la
  // page « Ma réservation » permet de la publier.
  const laConstruction = async () => {
    const essai = await lireLApercu.mutateAsync({
      ...leCreneau(),
      collectDeadline: new Date(Date.now() + ESSAI_DE_COLLECTE_MS).toISOString(),
      externalPlayers: combien - 1,
      players: capacite,
      quorum: capacite,
    });
    const plusTard = String(essai?.collecte?.latestDeadline || '');
    if (!plusTard || new Date(plusTard).getTime() <= Date.now()) {
      setBandeau(t(
        'reserverTerrain.collecte.tropProche',
        'Trop près du créneau pour attendre les réponses : réserve directement.',
      ));
      return null;
    }
    return { collectDeadline: plusTard, externalPlayers: combien - 1, quorum: capacite };
  };

  const envoyer = async () => {
    if (!apercu || equipeAttendue) return;
    setBandeau(null);
    setPublication(true);
    try {
      const collecte = enConstruction ? await laConstruction() : null;
      if (enConstruction && !collecte) return;
      const reservation = await reserver.mutateAsync(
        demandeDeReservation({
          collecte,
          date: String(apercu.date || params.date),
          duree: dureeChoisie,
          equipe: pourQui === 'equipe' ? equipe?.documentId : null,
          from: String(apercu.from || params.from),
          joueurs: capacite >= 2 ? capacite : null,
          mot,
          options: choixDesOptions(offertes, quantites),
          partagerNumero: partager,
          peutPartagerNumero,
          terrainId: String(apercu?.terrain?.documentId || params.terrainId),
        }),
      );
      // RESA-JOUEUR-2 (E-P05) : le résultat ne dit « Ton annonce est en ligne » que si elle l'est.
      let annoncePartie = false;
      if (collecte && reservation?.documentId) {
        annoncePartie = Boolean(await publierLAnnonce.mutateAsync({
          annonce: { notifyFavorites: true, places: capacite - combien },
          reservationId: reservation.documentId,
        }).catch(() => null));
      }
      // E-P05 lit le nombre requis et l'équipe ajoutée : la réservation du serveur ne les dit pas.
      navigation.replace(RouteNames.ReserverResultat, {
        ...(collecte ? {
          collecte: {
            annonce: annoncePartie,
            collectDeadline: collecte.collectDeadline,
            presents: combien,
            quorum: collecte.quorum,
          },
        } : {}),
        ...(pourQui === 'equipe' && equipe ? {
          equipe: { membres: equipe.membres, name: equipe.name },
        } : {}),
        reservation,
        // RESA-FIN-SITE : l'identifiant voyage dans l'adresse du site ; l'objet, en mémoire.
        reservationId: reservation?.documentId,
      });
    } catch (erreur) {
      const variante = varianteDEchec(erreur);
      if (variante === 'reseau' || variante === 'panne') {
        setBandeau(contenuDEchec(t, variante).titre);
        return;
      }
      vaVersLEchec(erreur, apercu);
    } finally {
      setPublication(false);
    }
  };

  const carte = {
    backgroundColor: withAlpha(Colors.primary800, 0.6),
    borderColor: withAlpha(Colors.primary500, 0.24),
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  };

  if (!apercu) {
    return (
      <ScreenContainer
        bgImage="bg2"
        bottomInsetMode="screen"
        contentContainerStyle={[Alignments.fill]}
      >
        <View style={{ gap: 12, paddingTop: 12 }} testID="reserver-recapitulatif-squelette">
          {[120, 160].map((hauteur) => (
            <View
              accessibilityState={{ busy: true }}
              key={hauteur}
              style={{
                backgroundColor: withAlpha(Colors.neutral00, 0.06),
                borderRadius: 16,
                height: hauteur,
              }}
            />
          ))}
        </View>
      </ScreenContainer>
    );
  }

  const ligneDuLieu = [
    apercu?.complexe?.name,
    apercu?.terrain?.name,
    libelleSport(apercu?.terrain?.sport),
  ]
    .filter(Boolean)
    .join(' · ');
  const quand = t('reserverTerrain.recapitulatif.quand', '{{jour}} · {{creneau}}', {
    creneau: texteCreneau(apercu.from, apercu.to),
    jour: texteJourLong(t, apercu.date),
    ...SANS_ECHAPPEMENT,
  });
  const motDuComplexe = String(apercu?.complexe?.playersNote || '').trim();
  let titreDuBouton = t('reserverTerrain.recapitulatif.reserver', 'Réserver');
  if (enConstruction) {
    titreDuBouton = t(
      'reserverTerrain.recapitulatif.reserverEtPublier',
      'Réserver et publier l’annonce',
    );
  } else if (surDemande) {
    titreDuBouton = t('reserverTerrain.recapitulatif.envoyerLaDemande', 'Envoyer la demande');
  }
  const lignesDEngagement = [
    {
      cle: 'honneur',
      gras: true,
      texte: t('reserverTerrain.recapitulatif.honneur', 'Tu t’engages sur l’honneur à venir.'),
    },
    {
      cle: 'tous',
      gras: false,
      texte: t(
        'reserverTerrain.recapitulatif.pourTous',
        'La réservation vaut pour tous les participants.',
      ),
    },
    {
      cle: 'paiement',
      gras: false,
      texte: t('reserverTerrain.recapitulatif.paiement', 'Le paiement se fait sur place.'),
    },
    // RESA-JOUEUR (230- B) : au complet, l'avertissement juste au-dessus de « Réserver ».
    ...(enConstruction ? [] : [{
      cle: 'banni',
      gras: false,
      texte: t(
        'reserverTerrain.recapitulatif.avertissementBanni',
        'Si ton groupe ne vient pas, tu pourras être banni de ce complexe, et FoundClub peut '
          + 'suspendre ton compte.',
      ),
    }]),
  ];

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          gap: 16,
          maxWidth: surOrdinateur ? COLONNE : undefined,
          paddingBottom: 24,
          paddingTop: 12,
          width: '100%',
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
          {t('reserverTerrain.recapitulatif.titre', 'Récapitulatif')}
        </Text>

        <View style={carte}>
          <View
            style={[Alignments.row, Alignments.alignCenter, { justifyContent: 'space-between' }]}
          >
            <Text style={[Fonts.p3Bold, Fonts.primary200]}>
              {t('reserverTerrain.recapitulatif.taReservation', 'Ta réservation')}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              hitSlop={{
                bottom: 10,
                left: 10,
                right: 10,
                top: 10,
              }}
              onPress={() => navigation.goBack()}
              style={{ justifyContent: 'center', minHeight: 24 }}
            >
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                {t('reserverTerrain.recapitulatif.modifier', 'Modifier')}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{ligneDuLieu}</Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {quand}
            {dureeChoisie ? (
              <Text style={[Fonts.p2Bold, Fonts.primary200]}>
                {` · ${texteDuree(dureeChoisie)}`}
              </Text>
            ) : null}
          </Text>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{prixSurPlace(t, apercu.price)}</Text>
          {surDemande ? (
            <Text style={[Fonts.p3Bold, Fonts.primary200]}>
              {t('reserverTerrain.creneau.surDemande', 'Sur demande : le complexe te répond')}
            </Text>
          ) : null}
        </View>

        {equipesEncadrees.length ? (
          <BlocPourQui
            ageMinimum={ageMinimum}
            equipe={equipe}
            equipeEnCours={equipeEnCours}
            equipes={equipesEncadrees}
            onChoisirEquipe={choisirEquipe}
            onPourQui={choisirPourQui}
            pourQui={pourQui}
            refus={refusEquipe}
          />
        ) : null}

        <BlocTonGroupe
          choix={choixDuGroupe}
          combien={combien}
          onChoix={setChoixDuGroupe}
          onCombien={setCombien}
          paie={texteCeQuePaieLeGroupe(t, apercu.price, capacite)}
          requis={capacite}
        />

        {offertes.length ? (
          <BlocOptions
            offertes={offertes}
            onQuantite={(id, quantite) => setQuantites((avant) => ({ ...avant, [id]: quantite }))}
            quantites={quantites}
          />
        ) : null}
        {aReglerSurPlace ? (
          <BlocReglerSurPlace
            bloc={aReglerSurPlace}
            indicatif
            titre={t('complexeOptions.aReglerSurPlace', 'À régler sur place')}
          />
        ) : null}

        <View style={{ gap: 6 }}>
          <Input
            accessibilityLabel={t('reserverTerrain.recapitulatif.petitMot', 'Un petit mot')}
            label={t(
              'reserverTerrain.recapitulatif.petitMotFacultatif',
              'Un petit mot (facultatif)',
            )}
            maxLength={MOT_MAX}
            onChangeText={setMot}
            placeholder={t('reserverTerrain.recapitulatif.petitMotExemple', 'Ex. : Foot du jeudi')}
            testID="reserver-petit-mot"
            value={mot}
          />
          <Text style={[Fonts.p3, Fonts.neutral200]}>{`${mot.length} / ${MOT_MAX}`}</Text>
        </View>

        {peutPartagerNumero ? (
          <TouchableOpacity
            accessibilityLabel={t(
              'reserverTerrain.recapitulatif.partagerNumero',
              'Partager mon numéro avec le complexe pour cette réservation',
            )}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: partager }}
            onPress={() => setPartager((avant) => !avant)}
            style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 44 }]}
            testID="reserver-partager-numero"
          >
            <View
              style={[
                Alignments.alignCenter,
                Alignments.justifyCenter,
                {
                  backgroundColor: partager ? Colors.primary500 : 'transparent',
                  borderColor: partager ? Colors.primary500 : Colors.primary200,
                  borderRadius: 6,
                  borderWidth: 2,
                  height: 24,
                  width: 24,
                },
              ]}
            >
              {partager ? (
                <SvgIcon color={Colors.primary900} height={16} name="check" width={16} />
              ) : null}
            </View>
            <Text style={[Fonts.p2, Fonts.neutral00, { flex: 1 }]}>
              {t(
                'reserverTerrain.recapitulatif.partagerNumero',
                'Partager mon numéro avec le complexe pour cette réservation',
              )}
            </Text>
          </TouchableOpacity>
        ) : null}

        {motDuComplexe ? (
          <View style={carte}>
            <Text style={[Fonts.p3Bold, Fonts.primary200]}>
              {t('reserverTerrain.complexe.motDuComplexe', 'Le mot du complexe')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral00]}>{motDuComplexe}</Text>
          </View>
        ) : null}

        <View
          style={{
            ...carte,
            borderColor: Colors.primary500,
            borderLeftWidth: 4,
          }}
          testID="reserver-engagement"
        >
          {lignesDEngagement.map((ligne) => (
            <Text key={ligne.cle} style={[ligne.gras ? Fonts.p2Bold : Fonts.p2, Fonts.neutral00]}>
              {ligne.texte}
            </Text>
          ))}
          <View
            style={{
              backgroundColor: withAlpha(Colors.primary500, 0.3),
              height: 1,
              marginVertical: 4,
            }}
          />
          <Text style={[Fonts.p3, Fonts.neutral100]}>
            {t(
              'reserverTerrain.recapitulatif.annulation',
              '{{regle}}. Ensuite, appelle le complexe.',
              {
                regle: texteAnnulation(t, apercu?.complexe?.cancellationDelayHours),
                ...SANS_ECHAPPEMENT,
              },
            )}
          </Text>
        </View>

        {bandeau ? (
          <View
            accessibilityRole="alert"
            style={{
              backgroundColor: withAlpha(Colors.error500, 0.1),
              borderColor: withAlpha(Colors.error500, 0.45),
              borderRadius: 16,
              borderWidth: 1,
              padding: 12,
            }}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{bandeau}</Text>
          </View>
        ) : null}

      </ScrollView>
      {/* RESA-FIN-APP (20/10) — le bouton en PIED FIXE (planche EP04) : il était au bas de la page,
          il fallait défiler pour le trouver (tournées 1 et 2). */}
      <View
        style={{
          alignSelf: 'center',
          maxWidth: surOrdinateur ? COLONNE : undefined,
          paddingBottom: 12,
          paddingTop: 12,
          width: '100%',
        }}
      >
        <Button
          disabled={equipeAttendue}
          isLoading={Boolean(reserver?.isPending) || publication}
          onPress={envoyer}
          title={titreDuBouton}
          variant="Primary"
        />
      </View>
    </ScreenContainer>
  );
}

export default ReserverRecapitulatif;
