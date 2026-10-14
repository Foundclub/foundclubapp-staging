import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Modal, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';

import { useCreateLieu, useGetPlacesFromCoordinates } from '@/services/places/placesQueries';

import { getErrorStatus, getServerErrorCode } from '@/utils/errors/displayError';

import useRetraitDuClavierAndroid from '@/hooks/useRetraitDuClavierAndroid';
import mapsPlatform from '@/platform/maps';

// ADRESSE-CARTE (07/10, décision d'Adel « adresse introuvable : ok pour ta solution ») —
// « Adresse introuvable ? Placez-la sur la carte ». Une carte, une épingle FIXE au centre (on
// déplace la carte, pas l'épingle), un nom de lieu, et « Placer ici ». Le lieu part au serveur
// (POST /lieux), rejoint la base de lieux, et revient comme une adresse de la liste.
//
// ♿ On valide SANS glisser : la carte s'ouvre déjà centrée sur la 1re proposition de ce qui a été
// tapé, zoomée à la rue ; « Placer ici » suffit. Les boutons + et - de la carte zooment aussi.
// 📍 La position de l'appareil ne sert que si elle est DÉJÀ accordée : rien n'est jamais demandé.

const FRANCE = Object.freeze({ lat: 46.6, lng: 2.4, zoom: 5 });
const ZOOM_DE_LA_RUE = 16;
// En deçà, l'épingle couvre un quartier entier : un lieu posé là serait faux pour tout le monde.
const ZOOM_MIN_POUR_PLACER = 15;
const NOM_MIN = 3;
const NOM_MAX = 80;

const arrondi = (/** @type {number} */ valeur) => Math.round(valeur * 1e5) / 1e5;

/**
 * Le refus du serveur, dit en français. Une panne n'est pas un refus : elle a sa phrase.
 * @param {(cle: string, repli: string) => string} t - Traduction.
 * @param {unknown} erreur - L'erreur de la requête.
 * @returns {string} La phrase à afficher.
 */
const messageDuRefus = (t, erreur) => {
  switch (getServerErrorCode(erreur)) {
    case 'LIEU_INVALID_PAYLOAD':
      return t(
        'autocompleteAddressInput.lieu.erreurs.point',
        'Ce point ne peut pas être enregistré. Déplacez la carte et réessayez.',
      );
    case 'LIEU_LIMIT_REACHED':
      return t(
        'autocompleteAddressInput.lieu.erreurs.plafond',
        'Vous avez posé beaucoup de lieux : réessayez demain.',
      );
    case 'LIEU_NAME_REQUIRED':
      return t(
        'autocompleteAddressInput.lieu.erreurs.nom',
        'Donnez un nom au lieu (3 caractères au moins).',
      );
    case 'LIEU_PERSONAL_DATA':
      return t(
        'autocompleteAddressInput.lieu.erreurs.donneePersonnelle',
        'Un lieu est visible par tous : pas de courriel, de téléphone ni de lien.',
      );
    default:
      break;
  }
  const statut = getErrorStatus(erreur);
  if (statut === 429) {
    return t(
      'autocompleteAddressInput.lieu.erreurs.debit',
      'Trop de lieux posés d’un coup : réessayez dans quelques minutes.',
    );
  }
  if (statut === 401 || statut === 403) {
    return t(
      'autocompleteAddressInput.lieu.erreurs.connexion',
      'Connectez-vous pour poser un lieu.',
    );
  }
  return t(
    'autocompleteAddressInput.lieu.erreurs.panne',
    'Le lieu n’a pas pu être enregistré. Réessayez.',
  );
};

/**
 * La carte ouverte. Tous les états vivent ici : chaque ouverture repart d'une page blanche.
 * @param {object} props
 * @param {{ lat: number, lng: number } | null} props.premierResultat - La 1re proposition
 *   de la liste.
 * @param {() => void} props.onFermer - Referme sans rien changer.
 * @param {(place: import('@/services/places/types').Place) => void} props.onLieuPose - Le
 *   lieu posé.
 * @returns {import('react').ReactElement}
 */
function LieuSurCarteOuvert({ onFermer, onLieuPose, premierResultat }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // 🤖 ANDROIDBAR-4 — fenêtre translucide : sur Android 15 et 16, rien ne la remonte au-dessus
  // du clavier, qui recouvrait « Nom du lieu » et « Placer ici ». La carte rétrécit, le panneau
  // remonte ; il garde déjà la barre système (`insets.bottom + 16`) : pas comptée deux fois.
  // 📱 CLAVIER-MODALES — sur iPhone non plus, rien ne la remonte : même retrait.
  const { retrait: retraitDuClavier } = useRetraitDuClavierAndroid(insets.bottom, { iPhone: true });
  const departTape = premierResultat
    ? { lat: premierResultat.lat, lng: premierResultat.lng, zoom: ZOOM_DE_LA_RUE }
    : null;
  const [cadrage, setCadrage] = useState(departTape || FRANCE);
  const [centre, setCentre] = useState(departTape || FRANCE);
  const [nom, setNom] = useState('');
  const [erreur, setErreur] = useState('');
  const [hauteurCarte, setHauteurCarte] = useState(0);
  const creerLieu = useCreateLieu();

  // Rien de tapé ne se trouve : la position, SEULEMENT si elle est déjà accordée.
  useEffect(() => {
    if (departTape) return undefined;
    let actif = true;
    // Par `platform/maps` : le module de position natif ne se charge qu'ici, carte ouverte.
    Promise.resolve(mapsPlatform.readCurrentLocationIfGranted?.()).then((position) => {
      if (!actif || !position) return;
      const point = { lat: position.lat, lng: position.lng, zoom: ZOOM_DE_LA_RUE };
      setCadrage(point);
      setCentre(point);
    });
    return () => {
      actif = false;
    };
    // Le départ se décide UNE fois, à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomSuffisant = Number(centre.zoom) >= ZOOM_MIN_POUR_PLACER;
  const nomPropre = nom.replace(/\s+/g, ' ').trim();
  const nomSuffisant = nomPropre.length >= NOM_MIN;
  const { data: adresse } = useGetPlacesFromCoordinates({
    lat: arrondi(centre.lat),
    lon: arrondi(centre.lng),
    options: { enabled: zoomSuffisant, retry: false, staleTime: 10 * 60 * 1000 },
  });
  const proprietes = /** @type {any} */ (adresse)?.properties || null;

  let indication = '';
  if (!zoomSuffisant) {
    indication = t(
      'autocompleteAddressInput.lieu.zoomer',
      'Zoomez jusqu’à la rue pour placer le lieu précisément.',
    );
  } else if (!nomSuffisant) {
    indication = t(
      'autocompleteAddressInput.lieu.erreurs.nom',
      'Donnez un nom au lieu (3 caractères au moins).',
    );
  }

  const placer = async () => {
    if (!zoomSuffisant || !nomSuffisant || creerLieu.isPending) return;
    setErreur('');
    try {
      const { place } = await creerLieu.mutateAsync({
        addressLine: proprietes?.name || proprietes?.street || undefined,
        city: proprietes?.city || undefined,
        lat: centre.lat,
        lng: centre.lng,
        name: nomPropre,
        postcode: proprietes?.postcode || undefined,
      });
      onLieuPose(place);
    } catch (refus) {
      setErreur(messageDuRefus(t, refus));
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onFermer} statusBarTranslucent visible>
      <View
        style={[
          Alignments.fill,
          { backgroundColor: Colors.primary900, paddingBottom: retraitDuClavier },
        ]}
      >
        <View
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Spaces.paddingHorizontal[16],
            Spaces.paddingBottom[12],
            { paddingTop: insets.top + 16 },
          ]}
        >
          <Text accessibilityRole="header" style={[Fonts.h3Bold, Fonts.neutral00, Alignments.fill]}>
            {t('autocompleteAddressInput.lieu.titre', 'Placer le lieu sur la carte')}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onFermer}
            style={[Spaces.padding[8]]}
          >
            <Text style={[Fonts.p2Bold, Fonts.primary500]}>
              {t('autocompleteAddressInput.lieu.annuler', 'Annuler')}
            </Text>
          </TouchableOpacity>
        </View>
        <Text
          style={[
            Fonts.p3,
            Fonts.neutral300,
            Spaces.paddingHorizontal[16],
            Spaces.paddingBottom[12],
          ]}
        >
          {t(
            'autocompleteAddressInput.lieu.aide',
            'Déplacez la carte pour mettre l’épingle sur le lieu, puis donnez-lui un nom.',
          )}
        </Text>

        <View
          onLayout={(evenement) => setHauteurCarte(evenement.nativeEvent.layout.height)}
          style={[Alignments.fill, Alignments.relative]}
        >
          {mapsPlatform.renderPinMap({
            height: hauteurCarte || 360,
            onRegionChangeComplete: (/** @type {any} */ region) => setCentre({
              lat: Number(region?.lat),
              lng: Number(region?.lng),
              zoom: Number(region?.zoom),
            }),
            regionHint: cadrage,
          })}
          {/* L'épingle ne bouge pas : sa pointe est le centre de la carte. */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[
              Alignments.absolute,
              Alignments.fullSize,
              Alignments.alignCenter,
              Alignments.justifyCenter,
            ]}
          >
            <Image
              source={Images.pin}
              style={[
                ApplicationStyle.icon48,
                ApplicationStyle.tintColor.primary500,
                { marginBottom: 48 },
              ]}
            />
          </View>
        </View>

        <View style={[Spaces.padding[16], Spaces.gap[12], { paddingBottom: insets.bottom + 16 }]}>
          {zoomSuffisant && proprietes?.label ? (
            <Text numberOfLines={2} style={[Fonts.p3, Fonts.neutral300]}>
              {t(
                'autocompleteAddressInput.lieu.presDe',
                'Près de : {{adresse}}',
                { adresse: proprietes.label },
              )}
            </Text>
          ) : null}
          <Input
            autoCapitalize="sentences"
            label={t('autocompleteAddressInput.lieu.nom', 'Nom du lieu')}
            maxLength={NOM_MAX}
            onChangeText={(texte) => {
              setNom(texte);
              setErreur('');
            }}
            placeholder={t('autocompleteAddressInput.lieu.nomExemple', 'Ex. Stade de Luminy')}
            value={nom}
          />
          {indication ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>{indication}</Text>
          ) : null}
          {erreur ? (
            <Text accessibilityLiveRegion="polite" style={[Fonts.p2, Fonts.error500]}>
              {erreur}
            </Text>
          ) : null}
          <Button
            accessibilityHint={t(
              'autocompleteAddressInput.lieu.placerAide',
              'Pose le lieu sous l’épingle, au centre de la carte.',
            )}
            disabled={!zoomSuffisant || !nomSuffisant}
            isLoading={creerLieu.isPending}
            onPress={placer}
            title={t('autocompleteAddressInput.lieu.placer', 'Placer ici')}
            variant="Primary"
          />
        </View>
      </View>
    </Modal>
  );
}

/**
 * La carte « Placez-la sur la carte ». Fermée, elle ne rend rien et ne charge rien.
 * @param {object} props
 * @param {boolean} props.visible - Ouverte ou non.
 * @param {{ lat: number, lng: number } | null} [props.premierResultat] - La 1re
 *   proposition de la liste.
 * @param {() => void} props.onFermer - Referme sans rien changer.
 * @param {(place: import('@/services/places/types').Place) => void} props.onLieuPose - Le
 *   lieu posé.
 * @returns {import('react').ReactElement | null}
 */
function LieuSurCarte({
  onFermer, onLieuPose, premierResultat = null, visible,
}) {
  if (!visible) return null;
  return (
    <LieuSurCarteOuvert
      onFermer={onFermer}
      onLieuPose={onLieuPose}
      premierResultat={premierResultat}
    />
  );
}

export default LieuSurCarte;
