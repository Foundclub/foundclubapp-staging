/* eslint-disable global-require */
import { Appearance } from 'react-native';

export const images = {
  // pictures
  bg1: require('../assets/pictures/bg-1.png'),
  bg2: require('../assets/pictures/bg-2.png'),
  bg3: require('../assets/pictures/bg-3.png'),
  bg4: require('../assets/pictures/bg-4.png'),
  bg5: require('../assets/pictures/bg-5.png'),
  eventCardDetection: require('../assets/background-card-event/card-detection.png'),
  eventCardMatch: require('../assets/background-card-event/card-match.png'),
  eventCardOther: require('../assets/background-card-event/card-autre.png'),
  eventCardReservation: require('../assets/background-card-event/card-reservation.png'),
  eventCardStage: require('../assets/background-card-event/card-stage.png'),
  eventCardTournament: require('../assets/background-card-event/card-tournoi.png'),
  eventCardTraining: require('../assets/background-card-event/card-entrainement.png'),
  logo: require('../assets/pictures/logo.png'),
  roundAvatar: require('../assets/pictures/avatar-round.png'),
  // icon
  arrowLeft: require('../assets/icons/arrowLeft.png'),
  arrowRight: require('../assets/icons/arrowRight.png'),
  bell: require('../assets/icons/bell.png'),
  calendar: require('../assets/icons/calendar.png'),
  camera: require('../assets/icons/camera.png'),
  check: require('../assets/icons/check.png'),
  chevronDown: require('../assets/icons/chevron-down.png'),
  clock: require('../assets/icons/clock.png'),
  close: require('../assets/icons/close.png'),
  edit: require('../assets/icons/edit.png'),
  envelope: require('../assets/icons/envelope.png'),
  euroCircle: require('../assets/icons/euro-circle.png'),
  filter: require('../assets/icons/filter.png'),
  flag: require('../assets/icons/flag.png'),
  home: require('../assets/icons/home.png'),
  phone: require('../assets/icons/phone.png'),
  pin: require('../assets/icons/pin.png'),
  plus: require('../assets/icons/plus.png'),
  redTrash: require('../assets/icons/redtrash.png'),
  running: require('../assets/icons/running.png'),
  search: require('../assets/icons/search.png'),
  send: require('../assets/icons/send.png'),
  share: require('../assets/icons/share.png'),
  share2: require('../assets/icons/share2.png'),
  shield: require('../assets/icons/shield.png'),
  stadium: require('../assets/icons/stadium.png'),
  strokeShield: require('../assets/icons/stroke-shield.png'),
  trash: require('../assets/icons/trash.png'),
  trashAlt: require('../assets/icons/trash-alt.png'),
  users: require('../assets/icons/users.png'),
  // League Division Badges (provisional static pack)
  division01: require('../assets/league/divisions/Div-1.png'),
  division02: require('../assets/league/divisions/Div-2.png'),
  division03: require('../assets/league/divisions/Div-3.png'),
  division04: require('../assets/league/divisions/Div-4.png'),
  division05: require('../assets/league/divisions/Div-5.png'),
  // Legacy aliases to avoid runtime crashes if an old screen asks for division06..10.
  division06: require('../assets/league/divisions/Div-5.png'),
  division07: require('../assets/league/divisions/Div-5.png'),
  division08: require('../assets/league/divisions/Div-5.png'),
  division09: require('../assets/league/divisions/Div-5.png'),
  division10: require('../assets/league/divisions/Div-5.png'),
  // League Icons (Mapped to existing until assets are added)
  chart: require('../assets/icons/filter.png'), // Temp mapping
  trophy: require('../assets/icons/flag.png'), // Temp mapping
  whistle: require('../assets/icons/stadium.png'), // Temp mapping
  // D75 — illustrations de fond des cartes d'accueil, une par famille d'icone.
  // Dossier SEPARE de `icons/` et non renommable : 10 des 13 noms y existent deja
  // (bell, calendar, clock, close, edit, flag, running, shield, stadium, users)
  // avec un tout autre role — glyphe 96 px teinte a 18 pt contre trait 512 px a 138 pt.
  // Livrees a PLEINE intensite : c'est HomeActionCard qui applique l'opacite,
  // ce qui la garde reglable sans relivrer d'image.
  homeIllustrations: {
    bell: require('../assets/background-card-home/bell.png'),
    calendar: require('../assets/background-card-home/calendar.png'),
    chart: require('../assets/background-card-home/chart.png'),
    clock: require('../assets/background-card-home/clock.png'),
    close: require('../assets/background-card-home/close.png'),
    edit: require('../assets/background-card-home/edit.png'),
    euroCircle: require('../assets/background-card-home/euroCircle.png'),
    flag: require('../assets/background-card-home/flag.png'),
    running: require('../assets/background-card-home/running.png'),
    shield: require('../assets/background-card-home/shield.png'),
    stadium: require('../assets/background-card-home/stadium.png'),
    trophy: require('../assets/background-card-home/trophy.png'),
    users: require('../assets/background-card-home/users.png'),
  },
};

const cachedThemeImages = new Map();

/**
 * Get the images for the current theme
 * @param {import('./types').ColorScheme} [theme] - The theme
 * @returns {import('./types').Images} - The images
 */
const getThemeImages = (theme = null) => {
  const scheme = theme || Appearance.getColorScheme();
  const cacheKey = scheme || 'default';
  if (cachedThemeImages.has(cacheKey)) {
    return cachedThemeImages.get(cacheKey);
  }
  /**
   * @type {import('./types').Images}
   */
  // @ts-expect-error because we can't use typescript as type to define the accumulator
  const initialAcc = {};
  const resolvedImages = Object.entries(images).reduce((acc, [key, value]) => {
    if (scheme && typeof value === 'object' && 'dark' in value && 'light' in value) {
      return {
        ...acc,
        [key]: value[scheme],
      };
    }
    return {
      ...acc,
      [key]: value,
    };
  }, initialAcc);

  cachedThemeImages.set(cacheKey, resolvedImages);
  return resolvedImages;
};

export default getThemeImages;
