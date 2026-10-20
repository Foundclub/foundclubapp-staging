import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import {
  erreursDuTerrain,
  lirePrix,
  messageDeRefus,
  payloadDuTerrain,
  PHOTO_OCTETS_MAX,
  PHOTOS_MAX,
  prixEnSaisie,
  TEXTE_TELEPHONE_PAR_DEFAUT,
} from '@/domains/complexe/complexeGerant';
import {
  CAPACITE_PAR_DEFAUT,
  libelleSport,
  lignesDePrix,
  sportsPopulaires,
} from '@/domains/complexe/complexeTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import Loader from '@/components/atoms/loader/Loader';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ChoiceChipGroup from '@/components/molecules/choiceChipGroup/ChoiceChipGroup';
import Input from '@/components/molecules/input/Input';
import ChoixDuSport from '@/components/organisms/choixDuSport/ChoixDuSport';
import PhoneInput from '@/components/organisms/phoneInput/PhoneInput';
import ScreenContainer from '@/components/templates/ScreenContainer';
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';
import FeuilleRetrait from '@/views/complexe/components/FeuilleRetrait';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import {
  useApercuRetrait,
  useComplexeChoisi,
  useComplexeGere,
  useEnregistrerTerrain,
  useReservationsDuComplexe,
  useTerrains,
} from '@/services/complexe/complexeQueries';
import { televerserPhoto } from '@/services/complexe/complexeService';

import MediaPlatform from '@/platform/media';

const VIGNETTE = 72;

/**
 * E-G08 — LA FICHE D'UN TERRAIN — RESA-L5A1 (13/10/2026), planches EG08 et RA3 (retours
 * d'Adel du 13/10 13h03, qui remplacent les blocs « Sport » et « Prix indicatif ») ; modèle
 * `FacilityForm.js`.
 *   · « Le terrain » : nom, sport (Foot à 5 · Padel · Tennis, puis « + de sports » : tous les
 *     sports de l'app), intérieur / extérieur, nombre de joueurs (pré-rempli par le sport, il sert
 *     aussi au prix par joueur), photos (5 au plus, 10 Mo chacune).
 *   · « Comment on le réserve » : automatique, validation manuelle, téléphone seulement (le texte
 *     affiché et le numéro, pré-remplis avec ceux du complexe).
 *   · « Prix » : au créneau ou par joueur, prix de base facultatif, « Ce que voient les joueurs ».
 * Créé : on enchaîne sur ses créneaux (E-G09). Modifié : « Modifications enregistrées. ».
 * RESA-L5A2 (14/10/2026) — en modification : « Voir le planning » (E-G03), « Retirer ce terrain »
 * (le compte des réservations à venir, puis le retrait), et deux avertissements après
 * l'enregistrement : quitter la validation manuelle laisse les demandes en attente à trancher ;
 * passer en « Téléphone seulement » garde les réservations à venir.
 * Paramètres de route : `complexeId`, `terrainId` (absent : un terrain neuf).
 * Caché par `COMPLEXES_GERANT`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeTerrain() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const params = /** @type {{ complexeId?: string, terrainId?: string } | undefined} */ (
    route?.params
  );
  // RESA-L5B-2 : sans `?complexeId=` (site), le complexe du compte.
  const { complexeId } = useComplexeChoisi(params?.complexeId);
  const terrainId = params?.terrainId || null;
  const terrainsLus = useTerrains(complexeId);
  const complexe = useComplexeGere(complexeId);
  const activites = useGetActivities();
  const enregistrer = useEnregistrerTerrain();

  const terrains = Array.isArray(terrainsLus.data) ? terrainsLus.data : [];
  const existant = terrainId ? terrains.find((terrain) => terrain?.documentId === terrainId) : null;
  // RESA-L5A2 — les demandes en attente d'un terrain en validation manuelle, et le compte des
  // réservations à venir (l'aperçu du retrait, rien n'est écrit).
  const demandesLues = useReservationsDuComplexe(
    complexeId,
    { terrain: terrainId || undefined, vue: 'demandes' },
    { enabled: existant?.bookingMode === 'manuel' },
  );
  const apercuRetrait = useApercuRetrait();
  const [aRetirer, setARetirer] = useState(/** @type {any} */ (null));
  const [avertissements, setAvertissements] = useState(/** @type {string[]} */ ([]));

  const [rempli, setRempli] = useState(false);
  const [nom, setNom] = useState('');
  const [sport, setSport] = useState(/** @type {string | null} */ (null));
  const [lieu, setLieu] = useState(/** @type {string | null} */ (null));
  const [joueurs, setJoueurs] = useState(CAPACITE_PAR_DEFAUT);
  const [joueursTouches, setJoueursTouches] = useState(false);
  const [photos, setPhotos] = useState(/** @type {Array<{ id: number, url?: string }>} */ ([]));
  const [mode, setMode] = useState('automatique');
  const [texteTelephone, setTexteTelephone] = useState(TEXTE_TELEPHONE_PAR_DEFAUT);
  const [telephone, setTelephone] = useState('');
  const [unite, setUnite] = useState('creneau');
  const [prix, setPrix] = useState('');
  const [tente, setTente] = useState(false);
  const [refus, setRefus] = useState('');
  const [enregistre, setEnregistre] = useState(false);
  const [photoRefus, setPhotoRefus] = useState('');
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const [feuilleSports, setFeuilleSports] = useState(false);

  // Modifier : la fiche se remplit UNE fois avec le terrain lu (jamais par-dessus une saisie).
  useEffect(() => {
    if (rempli || !existant) return;
    setNom(String(existant.name || ''));
    setSport(existant.sport?.documentId || null);
    setLieu(existant.setting || null);
    setJoueurs(Number(existant.capacity) || CAPACITE_PAR_DEFAUT);
    setPhotos((existant.photos || []).filter((/** @type {any} */ photo) => photo?.id));
    setMode(existant.bookingMode || 'automatique');
    setTexteTelephone(existant.bookingPhoneText || TEXTE_TELEPHONE_PAR_DEFAUT);
    setTelephone(existant.bookingPhone || '');
    setUnite(existant.priceUnit === 'joueur' ? 'joueur' : 'creneau');
    setPrix(prixEnSaisie(existant.basePrice));
    setRempli(true);
  }, [existant, rempli]);

  const liste = Array.isArray(activites.data) ? activites.data : [];
  const populaires = sportsPopulaires(liste);
  const autre = sport && !populaires.some((p) => p.documentId === sport)
    ? liste.find((activite) => String(activite?.documentId) === sport)
    : null;
  const optionsSports = [
    ...populaires.map((p) => ({ label: p.label, value: p.documentId })),
    ...(autre ? [{ label: libelleSport(autre), value: String(autre.documentId) }] : []),
  ];

  const choisirSport = (/** @type {string} */ id) => {
    setSport(id);
    // Le nombre de joueurs suit le sport tant que le gérant n'y a pas touché (RA3).
    if (!joueursTouches) {
      setJoueurs(populaires.find((p) => p.documentId === id)?.capacite || CAPACITE_PAR_DEFAUT);
    }
  };
  const changerJoueurs = (/** @type {number} */ pas) => {
    setJoueursTouches(true);
    setJoueurs((avant) => Math.min(50, Math.max(1, avant + pas)));
  };
  const choisirMode = (/** @type {string} */ valeur) => {
    setMode(valeur);
    if (valeur === 'telephone' && !telephone) {
      setTelephone(String(complexe.data?.phoneNumber || ''));
    }
  };

  const ajouterUnePhoto = async () => {
    setPhotoRefus('');
    const choisie = await MediaPlatform.pickImage();
    if (!choisie || choisie?.didCancel) return;
    const fichier = choisie?.assets?.[0] || choisie;
    const octets = Number(fichier?.fileSize ?? fichier?.size ?? 0);
    if (octets > PHOTO_OCTETS_MAX) {
      setPhotoRefus(t('complexeGerant.terrain.photoTropLourde', 'Cette photo dépasse 10 Mo.'));
      return;
    }
    setEnvoiPhoto(true);
    try {
      const envoyee = await televerserPhoto(choisie);
      if (envoyee?.id) setPhotos((avant) => [...avant, { id: envoyee.id, url: envoyee.url }]);
    } catch {
      setPhotoRefus(t('complexeGerant.terrain.photoEchec', 'La photo n’est pas partie. Réessaie.'));
    } finally {
      setEnvoiPhoto(false);
    }
  };

  const erreurs = erreursDuTerrain({
    lieu, nom, prix, sport,
  });
  const montrer = (/** @type {'lieu' | 'nom' | 'prix' | 'sport'} */ champ) => (
    Boolean(erreurs[champ]) && (tente || champ === 'prix')
  );

  /**
   * Les avertissements après un enregistrement (planche EG08) : ils n'empêchent rien.
   * @returns {Promise<string[]>} Les phrases.
   */
  const avertissementsApresEnregistrement = async () => {
    /** @type {string[]} */
    const notes = [];
    const enAttente = Number(demandesLues.data?.pages?.[0]?.pagination?.total) || 0;
    if (existant?.bookingMode === 'manuel' && mode !== 'manuel' && enAttente) {
      notes.push(t(
        'complexeReservations.terrain.demandesEnAttente',
        '{{count}} demandes attendent ta réponse : elles restent à trancher dans Demandes.',
        {
          count: enAttente,
          defaultValue_one:
            '{{count}} demande attend ta réponse : elle reste à trancher dans Demandes.',
          defaultValue_other:
            '{{count}} demandes attendent ta réponse : elles restent à trancher dans Demandes.',
          ...SANS_ECHAPPEMENT,
        },
      ));
    }
    if (existant && existant.bookingMode !== 'telephone' && mode === 'telephone') {
      try {
        const apercu = await apercuRetrait.mutateAsync({
          complexeId, terrainId: existant.documentId,
        });
        const aVenir = Number(apercu?.data?.reservationsTouchees) || 0;
        if (aVenir) {
          notes.push(t(
            'complexeReservations.terrain.gardees',
            'Les {{count}} réservations à venir sont gardées.',
            {
              count: aVenir,
              defaultValue_one: 'La réservation à venir est gardée.',
              defaultValue_other: 'Les {{count}} réservations à venir sont gardées.',
              ...SANS_ECHAPPEMENT,
            },
          ));
        }
      } catch {
        // Le compte n'a pas pu être lu : l'avertissement se tait, l'enregistrement est fait.
      }
    }
    return notes;
  };

  const enregistrerLaFiche = async () => {
    setTente(true);
    setEnregistre(false);
    setAvertissements([]);
    if (Object.keys(erreurs).length) return;
    setRefus('');
    try {
      const corps = await enregistrer.mutateAsync({
        complexeId,
        donnees: payloadDuTerrain({
          joueurs,
          lieu: String(lieu),
          mode,
          nom,
          photos,
          prix,
          sport: String(sport),
          telephone,
          texteTelephone,
          unite,
        }),
        terrainId: existant?.documentId,
      });
      if (!existant) {
        navigation.replace(RouteNames.ComplexeCreneaux, {
          complexeId,
          terrainAjoute: corps?.data?.name || nom,
          terrainId: corps?.data?.documentId,
        });
        return;
      }
      setEnregistre(true);
      setAvertissements(await avertissementsApresEnregistrement());
    } catch (erreur) {
      setRefus(messageDeRefus(
        t,
        erreur,
        t('complexeGerant.terrain.echec', 'Les modifications ne sont pas parties. Réessaie.'),
      ));
    }
  };

  const groupe = (/** @type {string} */ legende, /** @type {any} */ contenu) => (
    <View
      style={{
        backgroundColor: withAlpha(Colors.primary700, 0.45),
        borderColor: withAlpha(Colors.primary500, 0.24),
        borderRadius: 16,
        borderWidth: 1,
        gap: 16,
        padding: 16,
      }}
    >
      <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
        {legende.toUpperCase()}
      </Text>
      {contenu}
    </View>
  );
  const erreurSous = (/** @type {string} */ texte) => (
    <Text accessibilityRole="alert" style={[Fonts.p3Bold, Fonts.error300]}>{texte}</Text>
  );
  const choix = (
    /** @type {string} */ valeur,
    /** @type {string} */ titre,
    /** @type {string} */ dit,
    /** @type {boolean} */ coche,
    /** @type {() => void} */ onPress,
  ) => (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ checked: coche }}
      key={valeur}
      onPress={onPress}
      style={{
        backgroundColor: coche ? withAlpha(Colors.primary500, 0.14) : 'transparent',
        borderColor: coche ? Colors.primary500 : withAlpha(Colors.neutral00, 0.18),
        borderRadius: 14,
        borderWidth: 1,
        gap: 4,
        minHeight: 56,
        padding: 12,
      }}
      testID={`complexe-terrain-choix-${valeur}`}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{titre}</Text>
      <Text style={[Fonts.p3, Fonts.neutral200]}>{dit}</Text>
    </TouchableOpacity>
  );
  const boutonJoueurs = (
    /** @type {string} */ libelle,
    /** @type {string} */ signe,
    /** @type {number} */ pas,
  ) => (
    <TouchableOpacity
      accessibilityLabel={libelle}
      accessibilityRole="button"
      onPress={() => changerJoueurs(pas)}
      style={[
        Alignments.alignCenter,
        Alignments.justifyCenter,
        {
          borderColor: Colors.primary500,
          borderRadius: 14,
          borderWidth: 1,
          height: 44,
          width: 44,
        },
      ]}
    >
      <Text style={[Fonts.h4Black, Fonts.primary500]}>{signe}</Text>
    </TouchableOpacity>
  );

  if (terrainId && terrainsLus.isLoading) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Alignments.fill, Alignments.justifyCenter]}
      >
        <Loader />
      </ScreenContainer>
    );
  }
  if (terrainId && !existant) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Alignments.fill, { gap: 12, padding: 24 }]}
      >
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('complexeGerant.refus.terrainIntrouvable', 'Ce terrain est introuvable.')}
        </Text>
        <Button
          onPress={() => terrainsLus.refetch?.()}
          title={t('complexeGerant.accueil.reessayer', 'Réessayer')}
          variant="Secondary"
        />
      </ScreenContainer>
    );
  }

  const lignes = lignesDePrix(t, {
    basePrice: lirePrix(prix), capacity: joueurs, priceUnit: unite,
  });

  const blocTerrain = groupe(
    t('complexeGerant.terrain.leTerrain', 'Le terrain'), (
      <>
        <View style={{ gap: 4 }}>
          <Input
            label={t('complexeGerant.creation.nom', 'Nom')}
            onChangeText={setNom}
            placeholder={t('complexeGerant.terrain.nomExemple', 'Ex. : Terrain 1')}
            value={nom}
          />
          {montrer('nom')
            ? erreurSous(t('complexeGerant.terrain.nomManquant', 'Donne un nom au terrain.'))
            : null}
        </View>
        <View style={{ gap: 8 }}>
          <ChoiceChipGroup
            onSelect={(valeur) => choisirSport(String(valeur))}
            options={optionsSports}
            selectedValue={sport}
            title={t('complexeGerant.terrain.sport', 'Sport')}
          />
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              onPress={() => setFeuilleSports(true)}
              size="sm"
              title={t('complexeGerant.creation.plusDeSports', '+ de sports')}
              variant="Ghost"
            />
          </View>
          {montrer('sport')
            ? erreurSous(t('complexeGerant.terrain.sportManquant', 'Choisis le sport du terrain.'))
            : null}
        </View>
        <View style={{ gap: 4 }}>
          <ChoiceChipGroup
            onSelect={(valeur) => setLieu(String(valeur))}
            options={[
              { label: t('complexeGerant.lieu.interieur', 'Intérieur'), value: 'interieur' },
              { label: t('complexeGerant.lieu.exterieur', 'Extérieur'), value: 'exterieur' },
            ]}
            selectedValue={lieu}
            title={t('complexeGerant.terrain.ou', 'Où')}
          />
          {montrer('lieu')
            ? erreurSous(t('complexeGerant.terrain.lieuManquant', 'Intérieur ou extérieur ?'))
            : null}
        </View>
        <View style={{ gap: 8 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral100]}>
            {t('complexeGerant.terrain.nombreDeJoueurs', 'Nombre de joueurs')}
          </Text>
          <View style={[Alignments.row, Alignments.alignCenter, { gap: 16 }]}>
            {boutonJoueurs(t('complexeGerant.terrain.moinsDeJoueurs', 'Moins de joueurs'), '-', -1)}
            <Text
              style={[Fonts.h3Black, Fonts.neutral00, { minWidth: 32 }, Fonts.textCenter]}
              testID="complexe-terrain-joueurs"
            >
              {joueurs}
            </Text>
            {boutonJoueurs(t('complexeGerant.terrain.plusDeJoueurs', 'Plus de joueurs'), '+', 1)}
          </View>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'complexeGerant.terrain.joueursAide',
              'Il sert aussi à calculer le prix par joueur.',
            )}
          </Text>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral100]}>
            {t('complexeGerant.terrain.photos', 'Photos (jusqu’à 5)')}
          </Text>
          <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
            {photos.map((photo, index) => (
              <View key={photo.id} testID={`complexe-terrain-photo-${photo.id}`}>
                <Image
                  resizeMode="cover"
                  source={{ uri: photo.url }}
                  style={{ borderRadius: 12, height: VIGNETTE, width: VIGNETTE }}
                />
                <TouchableOpacity
                  accessibilityLabel={t(
                    'complexeGerant.terrain.retirerPhoto',
                    'Retirer la photo {{numero}}',
                    { numero: index + 1, ...SANS_ECHAPPEMENT },
                  )}
                  accessibilityRole="button"
                  hitSlop={{
                    bottom: 12, left: 12, right: 12, top: 12,
                  }}
                  onPress={() => setPhotos((avant) => avant.filter((p) => p.id !== photo.id))}
                  style={[
                    Alignments.alignCenter,
                    Alignments.justifyCenter,
                    ApplicationStyle.backgroundColor.primary900,
                    {
                      borderRadius: 12,
                      height: 24,
                      position: 'absolute',
                      right: -6,
                      top: -6,
                      width: 24,
                    },
                  ]}
                >
                  <GlyphIcon color={Colors.neutral00} name="xmark" size={12} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          {photos.length < PHOTOS_MAX ? (
            <View style={{ alignSelf: 'flex-start' }}>
              <Button
                accessibilityLabel={t('complexeGerant.terrain.ajouterPhoto', 'Ajouter une photo')}
                disabled={envoiPhoto}
                icon="camera"
                isLoading={envoiPhoto}
                onPress={ajouterUnePhoto}
                size="sm"
                title={t('complexeGerant.terrain.ajouterPhoto', 'Ajouter une photo')}
                variant="Secondary"
              />
            </View>
          ) : null}
          {photoRefus ? erreurSous(photoRefus) : null}
        </View>
      </>
    ),
  );

  const blocMode = groupe(
    t('complexeGerant.terrain.commentOnReserve', 'Comment on le réserve'), (
      <>
        {choix(
          'automatique',
          t('complexeGerant.mode.automatique', 'Automatique'),
          t('complexeGerant.terrain.automatiqueDit', 'La réservation est confirmée tout de suite.'),
          mode === 'automatique',
          () => choisirMode('automatique'),
        )}
        {choix(
          'manuel',
          t('complexeGerant.mode.manuel', 'Validation manuelle'),
          t('complexeGerant.terrain.manuelDit', 'Tu acceptes ou refuses chaque demande.'),
          mode === 'manuel',
          () => choisirMode('manuel'),
        )}
        {choix(
          'telephone',
          t('complexeGerant.mode.telephone', 'Téléphone seulement'),
          t('complexeGerant.terrain.telephoneDit', 'Les joueurs t’appellent.'),
          mode === 'telephone',
          () => choisirMode('telephone'),
        )}
        {mode === 'telephone' ? (
          <View style={{ gap: 8 }}>
            <Input
              label={t('complexeGerant.terrain.texteAffiche', 'Texte affiché')}
              onChangeText={setTexteTelephone}
              value={texteTelephone}
            />
            <PhoneInput
              label={t('complexeGerant.terrain.numero', 'Numéro')}
              onBlur={() => {}}
              onChange={(/** @type {string} */ valeur) => setTelephone(String(valeur || ''))}
              value={telephone}
            />
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t('complexeGerant.terrain.numeroAide', 'Pré-rempli avec le téléphone du complexe.')}
            </Text>
          </View>
        ) : null}
      </>
    ),
  );

  const blocPrix = groupe(
    t('complexeGerant.terrain.prix', 'Prix'), (
      <>
        {choix(
          'creneau',
          t('complexeGerant.terrain.prixDuCreneau', 'Prix du créneau'),
          t(
            'complexeGerant.terrain.prixDuCreneauDit',
            'Un prix pour le terrain entier, quel que soit le nombre de joueurs.',
          ),
          unite === 'creneau',
          () => setUnite('creneau'),
        )}
        {choix(
          'joueur',
          t('complexeGerant.terrain.prixParJoueur', 'Prix par joueur'),
          t('complexeGerant.terrain.prixParJoueurDit', 'Chaque joueur paie sa part sur place.'),
          unite === 'joueur',
          () => setUnite('joueur'),
        )}
        <View style={{ gap: 4 }}>
          <Input
            keyboardType="decimal-pad"
            label={t('complexeGerant.terrain.prixDeBase', 'Prix de base (facultatif)')}
            onChangeText={setPrix}
            placeholder={unite === 'joueur' ? '6' : '60'}
            value={prix}
          />
          {montrer('prix')
            ? erreurSous(t(
              'complexeGerant.terrain.prixFaux',
              'Le prix : un montant en euros, deux décimales au plus.',
            ))
            : null}
        </View>
        {lignes ? (
          <View
            style={{
              backgroundColor: withAlpha(Colors.neutral00, 0.04),
              borderRadius: 12,
              gap: 2,
              padding: 12,
            }}
            testID="complexe-terrain-apercu"
          >
            <Text style={[Fonts.p3Bold, Fonts.primary200]}>
              {t('complexeGerant.terrain.ceQueVoient', 'Ce que voient les joueurs')}
            </Text>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{lignes.principal}</Text>
            {lignes.secondaire ? (
              <Text style={[Fonts.p3, Fonts.neutral200]}>{lignes.secondaire}</Text>
            ) : null}
          </View>
        ) : null}
        {existant ? (
          <TouchableOpacity
            accessibilityRole="link"
            onPress={() => navigation.navigate(RouteNames.ComplexeCreneaux, {
              complexeId,
              terrainId: existant.documentId,
            })}
            style={{ minHeight: 44 }}
          >
            <Text style={[Fonts.p2Bold, Fonts.primary500]}>
              {t(
                'complexeGerant.terrain.prixSelonLHeure',
                'Des prix selon le jour et l’heure : dans « Créneaux et tarifs »',
              )}
            </Text>
          </TouchableOpacity>
        ) : null}
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'complexeGerant.terrain.surPlace',
            'Affiché « à régler sur place ». L’app n’encaisse rien.',
          )}
        </Text>
      </>
    ),
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Alignments.fill]}
      keyboardAvoiding
    >
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          gap: 16,
          maxWidth: 640,
          paddingBottom: 24,
          paddingTop: 12,
          width: '100%',
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
          {existant
            ? String(existant.name || '')
            : t('complexeGerant.terrain.nouveau', 'Nouveau terrain')}
        </Text>
        {blocTerrain}
        {blocMode}
        {blocPrix}
        {enregistre ? (
          <BandeauComplexe
            texte={t('complexeGerant.terrain.enregistre', 'Modifications enregistrées.')}
            ton="ok"
          />
        ) : null}
        {avertissements.map((texte) => (
          <BandeauComplexe key={texte} texte={texte} ton="info" />
        ))}
        {refus ? (
          <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{refus}</Text>
        ) : null}
        <Button
          disabled={Boolean(enregistrer.isPending)}
          isLoading={Boolean(enregistrer.isPending)}
          onPress={enregistrerLaFiche}
          title={t('complexeGerant.terrain.enregistrer', 'Enregistrer')}
          variant="Primary"
        />
        {existant ? (
          <View style={{ gap: 4 }}>
            <TouchableOpacity
              accessibilityRole="link"
              onPress={() => navigation.navigate(RouteNames.ComplexeEspace, {
                params: { complexeId, terrainId: existant.documentId },
                screen: RouteNames.ComplexePlanning,
              })}
              style={[Alignments.justifyCenter, { minHeight: 44 }]}
            >
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                {t('complexeReservations.installations.voirPlanning', 'Voir le planning')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setARetirer(existant)}
              style={[Alignments.justifyCenter, { minHeight: 44 }]}
            >
              <Text style={[Fonts.p2Bold, Fonts.error300]}>
                {t('complexeReservations.terrain.retirerCeTerrain', 'Retirer ce terrain')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <BottomModal
        close={() => setFeuilleSports(false)}
        isVisible={feuilleSports}
        webPresentation="dialog"
      >
        <View style={{ gap: 12 }}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t('complexeGerant.terrain.choisirSport', 'Choisir le sport')}
          </Text>
          <ChoixDuSport
            onChoisir={(cle) => {
              if (cle) choisirSport(cle);
              setFeuilleSports(false);
            }}
            sansTousLesSports
            sports={liste}
            valeurs={sport ? [sport] : []}
          />
          <Button
            onPress={() => setFeuilleSports(false)}
            title={t('complexeGerant.creation.fermer', 'Fermer')}
            variant="Ghost"
          />
        </View>
      </BottomModal>
      <FeuilleRetrait
        complexeId={complexeId}
        onFermer={() => setARetirer(null)}
        onRetire={() => {
          setARetirer(null);
          navigation.goBack();
        }}
        terrain={aRetirer}
      />
    </ScreenContainer>
  );
}

export default ComplexeTerrain;
