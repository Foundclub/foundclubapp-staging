import { lazy } from 'react';

const DateSlider = lazy(() => import('@/components/molecules/dateSlider/DateSlider'));
const EventCardNew = lazy(() => import('@/components/molecules/eventCard/EventCardNew'));
const MissionDock = lazy(() => import('@/components/molecules/guidance/MissionDock'));
const LeagueHeaderSwitch = lazy(() => import('@/components/molecules/header/LeagueHeaderSwitch'));
const NotificationBadge = lazy(() => import('@/components/molecules/notificationBadge/NotificationBadge'));
const ProfileButton = lazy(() => import('@/components/molecules/profileButton/ProfileButton'));
const FeaturedEvents = lazy(() => import('@/components/organisms/featuredEvents/FeaturedEvents'));
const JoinEventModal = lazy(() => import('@/components/organisms/joinEventModal/JoinEventModal'));

export {
  DateSlider,
  EventCardNew,
  FeaturedEvents,
  JoinEventModal,
  LeagueHeaderSwitch,
  MissionDock,
  NotificationBadge,
  ProfileButton,
};
