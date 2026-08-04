/**
 * Dynamic Expo config so development builds can sit alongside TestFlight.
 * Set APP_VARIANT=development on the EAS development profile (see eas.json).
 *
 * Screen Time / Focus lock (iOS): requires APPLE_TEAM_ID and Apple Developer
 * Family Controls + App Groups on the main app and three extension App IDs.
 */
const appJson = require('./app.json');

const IS_DEV = process.env.APP_VARIANT === 'development';
// Team ID is public (shows in provisioning profiles). Hardcoded so EAS/prebuild
// always see it — Expo only injects EXPO_PUBLIC_* from .env into the environment.
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID || '59D9WN47HT';

const bundleIdentifier = IS_DEV
  ? 'com.danielchungneo.gaingang.dev'
  : appJson.expo.ios.bundleIdentifier;

const appGroup = IS_DEV
  ? 'group.com.danielchungneo.gaingang.dev.blocker'
  : 'group.com.danielchungneo.gaingang.blocker';

const extensionEntitlements = {
  'com.apple.developer.family-controls': true,
  'com.apple.security.application-groups': [appGroup],
};

const appBlockerPlugin = [
  'expo-app-blocker',
  {
    ios: {
      appGroup,
      shield: {
        title: 'Finish your gains',
        subtitle: 'Earn screen time with a quick set, or finish today’s goals to unlock {appName}.',
        primaryButtonLabel: 'Earn screen time',
        secondaryButtonLabel: null,
        primaryButtonColor: '#4D8CFF',
        titleColor: '#E8EDF7',
        subtitleColor: '#AEB8D0',
        backgroundColor: '#05070F',
        backgroundBlurStyle: 'systemThickMaterialDark',
        tempUnlockTitle: 'Unlocked',
        tempUnlockSubtitle: 'Your apps are ready. Try again in a moment.',
        tempUnlockButtonLabel: 'OK',
        countSuffix: '',
      },
      notification: {
        title: 'GainGang',
        body: 'Tap to open GainGang and earn screen time.',
        attachIcon: false,
      },
    },
  },
];

/** @type {import('expo/config').ExpoConfig} */
const expo = {
  ...appJson.expo,
  name: IS_DEV ? 'GainGang Dev' : appJson.expo.name,
  scheme: IS_DEV ? 'gaingang-dev' : appJson.expo.scheme,
  ios: {
    ...appJson.expo.ios,
    bundleIdentifier,
    appleTeamId: APPLE_TEAM_ID,
    entitlements: {
      ...(appJson.expo.ios.entitlements ?? {}),
      'com.apple.developer.family-controls': true,
      'com.apple.security.application-groups': [appGroup],
    },
  },
  android: {
    ...appJson.expo.android,
    package: IS_DEV
      ? 'com.danielchungneo.gaingang.dev'
      : (appJson.expo.android.package ?? 'com.danielchungneo.gaingang'),
  },
  plugins: [
    ...(appJson.expo.plugins ?? []),
    [
      'expo-build-properties',
      {
        ios: {
          // Expo SDK 56 minimum; also covers Screen Time extensions (16+)
          deploymentTarget: '16.4',
        },
      },
    ],
    appBlockerPlugin,
  ],
  extra: {
    ...appJson.expo.extra,
    eas: {
      ...(appJson.expo.extra?.eas ?? {}),
      build: {
        experimental: {
          ios: {
            appExtensions: [
              {
                targetName: 'DeviceActivityMonitor',
                bundleIdentifier: `${bundleIdentifier}.DeviceActivityMonitor`,
                entitlements: extensionEntitlements,
              },
              {
                targetName: 'ShieldAction',
                bundleIdentifier: `${bundleIdentifier}.ShieldAction`,
                entitlements: extensionEntitlements,
              },
              {
                targetName: 'ShieldConfiguration',
                bundleIdentifier: `${bundleIdentifier}.ShieldConfiguration`,
                entitlements: extensionEntitlements,
              },
            ],
          },
        },
      },
    },
  },
};

module.exports = { expo };
