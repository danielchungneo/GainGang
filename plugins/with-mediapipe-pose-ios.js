const fs = require('fs');
const path = require('path');

const {
  IOSConfig,
  withDangerousMod,
  withPodfile,
  withXcodeProject,
} = require('expo/config-plugins');

const MEDIAPIPE_POD = "pod 'MediaPipeTasksVision', '~> 0.10.14'";
const MARKER = 'GAINGANG_MEDIAPIPE_POSE_IOS';

function ensurePodDependency(contents) {
  if (contents.includes('MediaPipeTasksVision')) return contents;
  if (contents.includes('use_expo_modules!')) {
    return contents.replace(/use_expo_modules!/, `${MEDIAPIPE_POD}\n\nuse_expo_modules!`);
  }
  return `${MEDIAPIPE_POD}\n\n${contents}`;
}

function ensurePostInstall(contents, projectName) {
  if (contents.includes(MARKER)) return contents;

  const snippet = `
    # ${MARKER}
    xcf_vision = '\${PODS_ROOT}/MediaPipeTasksVision/frameworks/MediaPipeTasksVision.xcframework'
    xcf_common = '\${PODS_ROOT}/MediaPipeTasksCommon/frameworks/MediaPipeTasksCommon.xcframework'
    pods_target = 'Pods-${projectName}'
    Dir.glob(File.join(installer.sandbox.root, 'Target Support Files', pods_target, '*.xcconfig')).each do |xcconfig_path|
      xcconfig_contents = File.read(xcconfig_path)
      xcconfig_contents = xcconfig_contents.gsub('-l"MediaPipeTasksCommon"', '-framework "MediaPipeTasksCommon"')
      xcconfig_contents = xcconfig_contents.gsub('-l"MediaPipeTasksVision"', '-framework "MediaPipeTasksVision"')
      unless xcconfig_contents.include?('MediaPipeTasksVision.xcframework/ios-arm64')
        xcconfig_contents += "\\nFRAMEWORK_SEARCH_PATHS = $(inherited) \\"#{xcf_vision}/ios-arm64\\" \\"#{xcf_common}/ios-arm64\\""
      end
      File.write(xcconfig_path, xcconfig_contents)
    end
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
        build_config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
      end
    end
    Dir.glob(File.join(installer.sandbox.root, 'Target Support Files', '**', '*.xcconfig')).each do |xcconfig_path|
      patched_contents = File.read(xcconfig_path)
      patched = patched_contents.gsub(/CLANG_CXX_LANGUAGE_STANDARD = (?:"?(?:gnu\\+\\+14|gnu\\+\\+17|c\\+\\+14|c\\+\\+17)"?)/, 'CLANG_CXX_LANGUAGE_STANDARD = c++20')
      File.write(xcconfig_path, patched) if patched != patched_contents
    end
`;

  const reactNativePostInstallPattern =
    /(react_native_post_install\([\s\S]*?\)\s*\n)/;

  if (reactNativePostInstallPattern.test(contents)) {
    return contents.replace(reactNativePostInstallPattern, `$1${snippet}`);
  }

  if (contents.includes('post_install do |installer|')) {
    return contents.replace('post_install do |installer|', `post_install do |installer|${snippet}`);
  }

  return `${contents}\n\npost_install do |installer|${snippet}\nend\n`;
}

function appendBridgingHeaderImports(headerPath) {
  if (!fs.existsSync(headerPath)) return;

  const imports = [
    '#import <VisionCamera/FrameProcessorPlugin.h>',
    '#import <VisionCamera/FrameProcessorPluginRegistry.h>',
    '#import <VisionCamera/Frame.h>',
    '#import <VisionCamera/VisionCameraProxyHolder.h>',
  ];

  let contents = fs.readFileSync(headerPath, 'utf8');
  for (const imp of imports) {
    if (!contents.includes(imp)) {
      contents += `\n${imp}`;
    }
  }
  fs.writeFileSync(headerPath, contents);
}

function withMediaPipePoseIos(config) {
  config = withPodfile(config, (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
    let contents = config.modResults.contents;
    contents = ensurePodDependency(contents);
    contents = ensurePostInstall(contents, projectName);
    config.modResults.contents = contents;
    return config;
  });

  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
      const appDir = path.join(projectRoot, 'ios', projectName);
      const pluginSrc = path.join(
        projectRoot,
        'node_modules',
        'react-native-mediapipe-pose-plugin',
        'ios',
      );
      const modelSrc = path.join(projectRoot, 'assets', 'pose_landmarker_full.task');

      fs.mkdirSync(appDir, { recursive: true });

      fs.copyFileSync(
        path.join(pluginSrc, 'PoseLandmarkerPlugin.swift'),
        path.join(appDir, 'PoseLandmarkerPlugin.swift'),
      );

      const objcSource = fs
        .readFileSync(path.join(pluginSrc, 'PoseLandmarkerPlugin.m'), 'utf8')
        .replace('AIPEER-Swift.h', `${projectName}-Swift.h`);
      fs.writeFileSync(path.join(appDir, 'PoseLandmarkerPlugin.m'), objcSource);

      if (fs.existsSync(modelSrc)) {
        fs.copyFileSync(modelSrc, path.join(appDir, 'pose_landmarker_full.task'));
      } else {
        console.warn(
          `[with-mediapipe-pose-ios] Missing ${modelSrc}. Download pose_landmarker_full.task into assets/.`,
        );
      }

      appendBridgingHeaderImports(path.join(appDir, `${projectName}-Bridging-Header.h`));

      return config;
    },
  ]);

  config = withXcodeProject(config, (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
    const project = config.modResults;

    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath: `${projectName}/PoseLandmarkerPlugin.swift`,
      groupName: projectName,
      project,
    });
    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath: `${projectName}/PoseLandmarkerPlugin.m`,
      groupName: projectName,
      project,
    });

    if (fs.existsSync(path.join(projectRoot, 'assets', 'pose_landmarker_full.task'))) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: `${projectName}/pose_landmarker_full.task`,
        groupName: projectName,
        project,
        isBuildFile: true,
      });
    }

    return config;
  });

  return config;
}

module.exports = withMediaPipePoseIos;
