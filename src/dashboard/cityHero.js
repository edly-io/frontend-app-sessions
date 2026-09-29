import { defineMessages } from '@edx/frontend-platform/i18n';
import islamabadArtwork from './assets/islamabad-skyline.svg';
import karachiArtwork from './assets/karachi-skyline.svg';
import lahoreArtwork from './assets/lahore-skyline.svg';

const messages = defineMessages({
  faisalMosque: {
    id: 'sessions.dashboard.cityHero.faisalMosque',
    defaultMessage: 'Faisal Mosque',
  },
  mazarEQuaid: {
    id: 'sessions.dashboard.cityHero.mazarEQuaid',
    defaultMessage: 'Mazar-e-Quaid',
  },
  minarEPakistan: {
    id: 'sessions.dashboard.cityHero.minarEPakistan',
    defaultMessage: 'Minar-e-Pakistan',
  },
});

const CITY_HERO_CONFIG = {
  islamabad: {
    artwork: islamabadArtwork,
    className: 'dashboard-city-hero--islamabad',
    monumentMessage: messages.faisalMosque,
  },
  karachi: {
    artwork: karachiArtwork,
    className: 'dashboard-city-hero--karachi',
    monumentMessage: messages.mazarEQuaid,
  },
  lahore: {
    artwork: lahoreArtwork,
    className: 'dashboard-city-hero--lahore',
    monumentMessage: messages.minarEPakistan,
  },
};

const DEFAULT_CITY_HERO = {
  artwork: null,
  className: 'dashboard-city-hero--default',
  monumentMessage: null,
};

export const getCityHero = (campusName) => {
  const normalizedName = String(campusName || '').trim().toLowerCase();
  const city = Object.keys(CITY_HERO_CONFIG).find(name => normalizedName.includes(name));

  return city ? CITY_HERO_CONFIG[city] : DEFAULT_CITY_HERO;
};
