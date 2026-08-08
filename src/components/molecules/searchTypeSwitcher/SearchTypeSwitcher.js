import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 * @typedef {'events' | 'clubs' | 'reservations' | 'recruitment' | 'amicaux'} SearchType
 */

// Le marche qui n'est pas ouvert. Il reste dans le dock — le retirer casserait
// la case « Reservations » de l'Accueil, qui navigue encore vers ce marche —
// mais l'appui n'active plus la categorie : il explique.
const UNAVAILABLE_TYPE = 'reservations';

// Cible tactile et hauteur de pastille : 46 pt, hors rampe Spaces (44 puis 52,
// rien entre les deux). Ecrit ici en clair, une seule fois.
const DOCK_ITEM_SIZE = 46;

/**
 * Dock des marches (« BAR-D » du pack Rechercher).
 *
 * Le marche actif s'etire en pilule pleine (icone + nom) ; les autres sont des
 * pastilles d'icone. Les icones sont celles que l'Accueil utilise deja pour les
 * memes cases : les deux surfaces disent la meme chose avec le meme dessin.
 * ponytail: le pack demande un TROPHEE pour les matchs amicaux ; l'app n'en a
 * pas et `Images.trophy` n'est qu'un alias de `flag.png`. On garde `flag`,
 * comme la case d'Accueil — ajouter un dessin est un lot d'illustration.
 * @param {{
 *  activeType: SearchType;
 *  onTypeChange: (type: SearchType) => void;
 * }} props
 * @returns {import('react').ReactElement}
 */
function SearchTypeSwitcher({ activeType, onTypeChange }) {
  const isWeb = Platform.OS === 'web';
  const {
    Alignments,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const [showUnavailableSheet, setShowUnavailableSheet] = useState(false);

  const options = useMemo(
    () => [
      {
        icon: Images.calendar,
        key: 'events',
        label: t('homeHub.cards.search.events.title', 'Événement'),
      },
      {
        icon: Images.shield,
        key: 'clubs',
        label: t('homeHub.cards.search.clubs.title', 'Club'),
      },
      {
        icon: Images.stadium,
        key: 'reservations',
        label: t('homeHub.cards.search.reservations.title', 'Réservations'),
      },
      {
        icon: Images.users,
        key: 'recruitment',
        label: t('searchTypeSwitcher.recruitment', 'Recrutement'),
      },
      {
        icon: Images.flag,
        key: 'amicaux',
        label: t('searchTypeSwitcher.amicaux', 'Matchs amicaux'),
      },
    ],
    [Images, t],
  );

  const inactiveSurface = withAlpha(Colors.neutral00, 0.05);
  const inactiveBorder = withAlpha(Colors.neutral00, 0.14);

  return (
    <View style={[Spaces.marginBottom[24]]}>
      {/*
        Le pack dessine une ligne sans defilement. On garde le ScrollView : sur
        un ecran etroit, « Matchs amicaux » deploye ne tient pas a cote de
        quatre pastilles, et la regle du pack est « libelles jamais tronques ».
        Sur un ecran normal rien ne defile — le dessin est celui du pack.
      */}
      <ScrollView
        accessibilityRole="tablist"
        contentContainerStyle={[
          Alignments.row,
          Alignments.alignCenter,
          Spaces.gap[8],
          {
            flexGrow: 1,
            paddingRight: 4,
          },
        ]}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {options.map((option) => {
          const isActive = option.key === activeType;
          const isUnavailable = option.key === UNAVAILABLE_TYPE;

          return (
            <TouchableOpacity
              accessibilityLabel={option.label}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              activeOpacity={0.8}
              key={option.key}
              onPress={() => {
                if (isUnavailable) {
                  setShowUnavailableSheet(true);
                  return;
                }
                onTypeChange(/** @type {SearchType} */ (option.key));
              }}
              style={{
                alignItems: 'center',
                backgroundColor: isActive ? Colors.primary500 : inactiveSurface,
                borderColor: isActive ? Colors.primary500 : inactiveBorder,
                borderRadius: 999,
                borderWidth: 1,
                flexDirection: 'row',
                gap: 8,
                height: DOCK_ITEM_SIZE,
                justifyContent: 'center',
                minWidth: DOCK_ITEM_SIZE,
                opacity: isUnavailable ? 0.55 : 1,
                paddingHorizontal: isActive ? 14 : 0,
              }}
            >
              <Image
                source={option.icon}
                style={{
                  height: 16,
                  resizeMode: 'contain',
                  tintColor: isActive ? Colors.primary900 : Colors.neutral300,
                  width: 16,
                }}
              />
              {isActive ? (
                <Text
                  numberOfLines={1}
                  style={[
                    Fonts.p4Bold,
                    Fonts.primary900,
                    {
                      includeFontPadding: !isWeb ? false : undefined,
                      lineHeight: isWeb ? 17 : 16,
                      textAlignVertical: 'center',
                    },
                  ]}
                >
                  {option.label}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <BottomModal
        close={() => setShowUnavailableSheet(false)}
        isVisible={showUnavailableSheet}
        scrollable={false}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[16]]}>
          <Text style={[Fonts.h4, Fonts.neutral00]}>
            Bientôt disponible !
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            La réservation de créneaux (foot à 5, padel…) arrive dans une
            prochaine version.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.8}
            onPress={() => setShowUnavailableSheet(false)}
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              {
                backgroundColor: Colors.primary500,
                borderRadius: 999,
                minHeight: 52,
              },
            ]}
          >
            <Text style={[Fonts.p1Bold, Fonts.primary900]}>
              Compris
            </Text>
          </TouchableOpacity>
        </View>
      </BottomModal>
    </View>
  );
}

export default SearchTypeSwitcher;
