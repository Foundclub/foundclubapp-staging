import { Appearance } from 'react-native';

const createAssetSource = (relativePath) => ({
  uri: new URL(relativePath, import.meta.url).href,
});

export const images = {
  bg1: createAssetSource('../assets/pictures/bg-1.png'),
  bg2: createAssetSource('../assets/pictures/bg-2.png'),
  bg3: createAssetSource('../assets/pictures/bg-3.png'),
  bg4: createAssetSource('../assets/pictures/bg-4.png'),
  bg5: createAssetSource('../assets/pictures/bg-5.png'),
  eventCardOther: createAssetSource('../assets/background-card-event/card-autre.png'),
  eventCardDetection: createAssetSource('../assets/background-card-event/card-detection.png'),
  eventCardTraining: createAssetSource('../assets/background-card-event/card-entrainement.png'),
  eventCardMatch: createAssetSource('../assets/background-card-event/card-match.png'),
  eventCardReservation: createAssetSource('../assets/background-card-event/card-reservation.png'),
  logo: createAssetSource('../assets/pictures/logo.png'),
  roundAvatar: createAssetSource('../assets/pictures/avatar-round.png'),
  arrowLeft: createAssetSource('../assets/icons/arrowLeft.png'),
  arrowRight: createAssetSource('../assets/icons/arrowRight.png'),
  bell: createAssetSource('../assets/icons/bell.png'),
  calendar: createAssetSource('../assets/icons/calendar.png'),
  camera: createAssetSource('../assets/icons/camera.png'),
  check: createAssetSource('../assets/icons/check.png'),
  chevronDown: createAssetSource('../assets/icons/chevron-down.png'),
  clock: createAssetSource('../assets/icons/clock.png'),
  close: createAssetSource('../assets/icons/close.png'),
  edit: createAssetSource('../assets/icons/edit.png'),
  envelope: createAssetSource('../assets/icons/envelope.png'),
  euroCircle: createAssetSource('../assets/icons/euro-circle.png'),
  filter: createAssetSource('../assets/icons/filter.png'),
  flag: createAssetSource('../assets/icons/flag.png'),
  home: createAssetSource('../assets/icons/home.png'),
  phone: createAssetSource('../assets/icons/phone.png'),
  pin: createAssetSource('../assets/icons/pin.png'),
  plus: createAssetSource('../assets/icons/plus.png'),
  redTrash: createAssetSource('../assets/icons/redtrash.png'),
  running: createAssetSource('../assets/icons/running.png'),
  search: createAssetSource('../assets/icons/search.png'),
  send: createAssetSource('../assets/icons/send.png'),
  share: createAssetSource('../assets/icons/share.png'),
  share2: createAssetSource('../assets/icons/share2.png'),
  shield: createAssetSource('../assets/icons/shield.png'),
  stadium: createAssetSource('../assets/icons/stadium.png'),
  strokeShield: createAssetSource('../assets/icons/stroke-shield.png'),
  trash: createAssetSource('../assets/icons/trash.png'),
  trashAlt: createAssetSource('../assets/icons/trash-alt.png'),
  users: createAssetSource('../assets/icons/users.png'),
  division01: createAssetSource('../assets/league/divisions/Div-1.png'),
  division02: createAssetSource('../assets/league/divisions/Div-2.png'),
  division03: createAssetSource('../assets/league/divisions/Div-3.png'),
  division04: createAssetSource('../assets/league/divisions/Div-4.png'),
  division05: createAssetSource('../assets/league/divisions/Div-5.png'),
  division06: createAssetSource('../assets/league/divisions/Div-5.png'),
  division07: createAssetSource('../assets/league/divisions/Div-5.png'),
  division08: createAssetSource('../assets/league/divisions/Div-5.png'),
  division09: createAssetSource('../assets/league/divisions/Div-5.png'),
  division10: createAssetSource('../assets/league/divisions/Div-5.png'),
  chart: createAssetSource('../assets/icons/filter.png'),
  trophy: createAssetSource('../assets/icons/flag.png'),
  whistle: createAssetSource('../assets/icons/stadium.png'),
  // D75 — meme table que `images.js`, cote web. Le site compile physiquement les
  // sources de `app` : une clef declaree ici seulement d'un cote casse l'autre EN
  // SILENCE, et aucune porte de `app` ne le voit.
  homeIllustrations: {
    bell: createAssetSource('../assets/background-card-home/bell.png'),
    calendar: createAssetSource('../assets/background-card-home/calendar.png'),
    chart: createAssetSource('../assets/background-card-home/chart.png'),
    clock: createAssetSource('../assets/background-card-home/clock.png'),
    close: createAssetSource('../assets/background-card-home/close.png'),
    edit: createAssetSource('../assets/background-card-home/edit.png'),
    euroCircle: createAssetSource('../assets/background-card-home/euroCircle.png'),
    flag: createAssetSource('../assets/background-card-home/flag.png'),
    running: createAssetSource('../assets/background-card-home/running.png'),
    shield: createAssetSource('../assets/background-card-home/shield.png'),
    stadium: createAssetSource('../assets/background-card-home/stadium.png'),
    trophy: createAssetSource('../assets/background-card-home/trophy.png'),
    users: createAssetSource('../assets/background-card-home/users.png'),
  },
};

const getThemeImages = (theme = null) => {
  const scheme = theme || Appearance.getColorScheme();
  const initialAcc = {};

  return Object.entries(images).reduce((acc, [key, value]) => {
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
};

export default getThemeImages;
