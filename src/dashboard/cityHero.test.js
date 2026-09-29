import { getCityHero } from './cityHero';

it.each([
  ['Lahore Campus', 'dashboard-city-hero--lahore', 'Minar-e-Pakistan'],
  ['FBR KARACHI academy', 'dashboard-city-hero--karachi', 'Mazar-e-Quaid'],
  ['Islamabad', 'dashboard-city-hero--islamabad', 'Faisal Mosque'],
])('maps %s to its city welcome artwork', (campus, className, monument) => {
  const cityHero = getCityHero(campus);

  expect(cityHero.className).toBe(className);
  expect(cityHero.monumentMessage.defaultMessage).toBe(monument);
});

it.each([undefined, null, '', 'Peshawar'])('uses the neutral welcome background for %s', (campus) => {
  expect(getCityHero(campus)).toEqual({
    artwork: null,
    className: 'dashboard-city-hero--default',
    monumentMessage: null,
  });
});
