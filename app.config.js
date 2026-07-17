/**
 * Dynamic Expo config so development builds can sit alongside TestFlight.
 * Set APP_VARIANT=development on the EAS development profile (see eas.json).
 */
const appJson = require('./app.json');

const IS_DEV = process.env.APP_VARIANT === 'development';

/** @type {import('expo/config').ExpoConfig} */
const expo = {
  ...appJson.expo,
  name: IS_DEV ? 'GainGang Dev' : appJson.expo.name,
  scheme: IS_DEV ? 'gaingang-dev' : appJson.expo.scheme,
  ios: {
    ...appJson.expo.ios,
    bundleIdentifier: IS_DEV
      ? 'com.danielchungneo.gaingang.dev'
      : appJson.expo.ios.bundleIdentifier,
  },
  android: {
    ...appJson.expo.android,
    package: IS_DEV
      ? 'com.danielchungneo.gaingang.dev'
      : (appJson.expo.android.package ?? 'com.danielchungneo.gaingang'),
  },
};

module.exports = { expo };
