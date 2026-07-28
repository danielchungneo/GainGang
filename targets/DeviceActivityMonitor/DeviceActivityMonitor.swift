import DeviceActivity
import ManagedSettings
import FamilyControls
import Foundation

@available(iOS 15.0, *)
// NOTE: the class name MUST be `DeviceActivityMonitorExtension` — it has to match
// the `NSExtensionPrincipalClass` (`$(PRODUCT_MODULE_NAME).DeviceActivityMonitorExtension`)
// that @bacons/apple-targets writes into the extension's Info.plist. If it doesn't
// match, iOS cannot instantiate the extension and NONE of the callbacks fire.
class DeviceActivityMonitorExtension: DeviceActivityMonitor {
  // CONFIGURE: Replace with your App Group identifier
  private let appGroupIdentifier = "group.com.danielchungneo.gaingang.blocker"
  // Granted earned-time budget in SECONDS (Int); kept in sync with
  // ExpoAppBlockerModule.swift. Presence with value > 0 means an unlock is active.
  private let temporaryUnlockKey = "appBlocker.temporaryUnlock.v1"
  // Consumed seconds, written here as blocked-app usage thresholds fire.
  private let usageConsumedKey = "appBlocker.usageConsumedSeconds.v1"
  // Wall-clock instant the budget was granted (Date) — upper bound for the
  // premature-fire guard (measured usage can't exceed elapsed wall-clock).
  private let unlockGrantedAtKey = "appBlocker.unlockGrantedAt.v1"
  // Usage-step event-name prefix; the suffix is the threshold in seconds.
  private let usageStepEventPrefix = "appBlocker.usageStep."
  private let blockConfigStorageKey = "appBlocker.blockConfiguration.v1"
  private let focusLockDailyActivityName = "appBlocker.focusLockDaily"

  private let store = ManagedSettingsStore()
  private var sharedDefaults: UserDefaults?

  override init() {
    super.init()
    sharedDefaults = UserDefaults(suiteName: appGroupIdentifier)
  }

  /// Fires once per usage step (threshold = N seconds of measured blocked-app use).
  /// Records consumed seconds back to the App Group so the host can show a paused,
  /// pause-when-away countdown; once consumption reaches the budget, re-applies the
  /// shield. This is the primary pause-on-leave relock path.
  override func eventDidReachThreshold(
    _ event: DeviceActivityEvent.Name,
    activity: DeviceActivityName
  ) {
    super.eventDidReachThreshold(event, activity: activity)

    let stepSeconds = parseStepSeconds(from: event.rawValue)
    guard stepSeconds > 0 else {
      // Unknown event — treat as a full relock to stay safe.
      clearUnlockState()
      reapplyBlockConfiguration()
      return
    }

    // Premature-fire guard (iOS-26 bug + clock skew): measured usage can never
    // exceed the wall-clock elapsed since the grant. If a step claims more usage
    // than has physically elapsed (+30s tolerance), it's spurious — ignore it.
    if let grantedAt = sharedDefaults?.object(forKey: unlockGrantedAtKey) as? Date {
      let elapsed = Date().timeIntervalSince(grantedAt)
      if Double(stepSeconds) > elapsed + 30 {
        return
      }
    }

    // Record consumed seconds monotonically (steps can arrive out of order).
    let prev = sharedDefaults?.integer(forKey: usageConsumedKey) ?? 0
    if stepSeconds > prev {
      sharedDefaults?.set(stepSeconds, forKey: usageConsumedKey)
    }

    let budgetSeconds = sharedDefaults?.integer(forKey: temporaryUnlockKey) ?? 0
    if budgetSeconds <= 0 || stepSeconds >= budgetSeconds {
      // Budget fully spent — re-block.
      clearUnlockState()
      reapplyBlockConfiguration()
    }
  }

  /// Fires at the schedule's interval end (23:59:59) — the daily reset. Clears any
  /// unspent budget. For the Focus lock daily activity, also applies tomorrow's
  /// lock state after midnight via intervalDidStart; here we only clear temp unlock
  /// near midnight so earned time does not carry across the day boundary.
  ///
  /// Guards against the spurious callback that `stopMonitoring()` fires during a
  /// re-grant: that fire happens whenever the user earns time, not at the day
  /// boundary, so only honor it in the last couple of minutes before midnight.
  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)

    let comps = Calendar.current.dateComponents([.hour, .minute], from: Date())
    guard comps.hour == 23, (comps.minute ?? 0) >= 58 else {
      return
    }
    clearUnlockState()

    // Temporary-unlock activity: re-apply stored config after budget day ends.
    // Focus lock daily: intervalDidStart on the new day applies schedule-aware locks.
    if activity.rawValue != focusLockDailyActivityName {
      reapplyBlockConfiguration()
    }
  }

  /// Fires at 00:00 for the repeating Focus lock daily schedule. Applies shields
  /// when today has exercises; clears them on rest days — without opening the app.
  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)

    if activity.rawValue == focusLockDailyActivityName {
      clearUnlockState()
      applyFocusLockForCurrentDay()
    }
  }

  /// Extract the threshold seconds from an event name like `appBlocker.usageStep.90`;
  /// 0 if the name is not a usage step.
  private func parseStepSeconds(from rawName: String) -> Int {
    guard rawName.hasPrefix(usageStepEventPrefix) else { return 0 }
    let suffix = rawName.dropFirst(usageStepEventPrefix.count)
    return Int(suffix) ?? 0
  }

  /// Clear all persisted unlock state (budget + consumed counter + grant time).
  private func clearUnlockState() {
    sharedDefaults?.removeObject(forKey: temporaryUnlockKey)
    sharedDefaults?.removeObject(forKey: usageConsumedKey)
    sharedDefaults?.removeObject(forKey: unlockGrantedAtKey)
  }

  /// Lock or unlock based on whether today is in `datesWithExercises`.
  private func applyFocusLockForCurrentDay() {
    let userDefaults = sharedDefaults ?? UserDefaults.standard
    guard var configDict = userDefaults.dictionary(forKey: blockConfigStorageKey) else {
      clearShields()
      return
    }

    let focusLockEnabled = configDict["focusLockEnabled"] as? Bool ?? false
    let dates = configDict["datesWithExercises"] as? [String] ?? []
    let today = Self.todayISOString()

    guard focusLockEnabled else {
      configDict["isActive"] = false
      userDefaults.set(configDict, forKey: blockConfigStorageKey)
      clearShields()
      return
    }

    guard let blockConfig = parseBlockConfig(configDict), !blockConfig.items.isEmpty else {
      clearShields()
      return
    }

    var shouldLock = dates.contains(today)
    if let unlockedDate = configDict["unlockedDate"] as? String, unlockedDate == today {
      // Goals already completed today — don't re-lock until the next calendar day.
      shouldLock = false
    } else {
      // Drop a previous day's unlock stamp so it can't affect later syncs.
      configDict.removeValue(forKey: "unlockedDate")
    }
    configDict["isActive"] = shouldLock
    userDefaults.set(configDict, forKey: blockConfigStorageKey)

    applyBlocks(MonitorBlockConfig(items: blockConfig.items, isActive: shouldLock))
  }

  private static func todayISOString() -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar.current
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone.current
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: Date())
  }

  private func clearShields() {
    store.shield.applications = nil
    store.shield.applicationCategories = nil
    store.shield.webDomains = nil
  }

  private func reapplyBlockConfiguration() {
    let userDefaults = sharedDefaults ?? UserDefaults.standard

    guard let configDict = userDefaults.dictionary(forKey: blockConfigStorageKey) else {
      clearShields()
      return
    }

    guard let blockConfig = parseBlockConfig(configDict) else {
      return
    }

    applyBlocks(blockConfig)
  }

  private func parseBlockConfig(_ dict: [String: Any]) -> MonitorBlockConfig? {
    let rawItems: [[String: Any]]
    if let blockedItems = dict["blockedItems"] as? [[String: Any]] {
      rawItems = blockedItems
    } else if let appSelections = dict["appSelections"] as? [[String: Any]] {
      rawItems = appSelections.map { item in
        var normalized = item
        normalized["type"] = "app"
        return normalized
      }
    } else {
      return nil
    }

    let items: [MonitorBlockedItemInfo] = rawItems.compactMap { selection -> MonitorBlockedItemInfo? in
      guard let tokenString = selection["token"] as? String else {
        return nil
      }

      let itemTypeRaw = (selection["type"] as? String ?? "app").lowercased()
      let itemType: MonitorBlockedItemType
      switch itemTypeRaw {
      case "category":
        itemType = .category
      case "webdomain":
        itemType = .webDomain
      default:
        itemType = .app
      }

      return MonitorBlockedItemInfo(
        type: itemType,
        tokenId: tokenString,
        appToken: itemType == .app ? decodeApplicationToken(from: tokenString) : nil,
        categoryToken: itemType == .category ? decodeCategoryToken(from: tokenString) : nil,
        webDomainToken: itemType == .webDomain ? decodeWebDomainToken(from: tokenString) : nil
      )
    }

    let isActive = dict["isActive"] as? Bool ?? true
    return MonitorBlockConfig(items: items, isActive: isActive)
  }

  private func applyBlocks(_ config: MonitorBlockConfig) {
    guard config.isActive else {
      clearShields()
      return
    }

    let validAppTokens = config.items.compactMap { $0.appToken }
    let validCategoryTokens = config.items.compactMap { $0.categoryToken }
    let validWebDomainTokens = config.items.compactMap { $0.webDomainToken }

    guard !validAppTokens.isEmpty || !validCategoryTokens.isEmpty || !validWebDomainTokens.isEmpty else {
      clearShields()
      return
    }

    if !validAppTokens.isEmpty {
      store.shield.applications = Set(validAppTokens)
    } else {
      store.shield.applications = nil
    }

    if !validCategoryTokens.isEmpty {
      store.shield.applicationCategories = .specific(Set(validCategoryTokens))
    } else {
      store.shield.applicationCategories = nil
    }

    if !validWebDomainTokens.isEmpty {
      store.shield.webDomains = Set(validWebDomainTokens)
    } else {
      store.shield.webDomains = nil
    }
  }

  private func decodeApplicationToken(from encoded: String) -> ApplicationToken? {
    guard let data = Data(base64Encoded: encoded) else {
      return nil
    }

    do {
      return try JSONDecoder().decode(ApplicationToken.self, from: data)
    } catch {
      return nil
    }
  }

  private func decodeCategoryToken(from encoded: String) -> ActivityCategoryToken? {
    guard let data = Data(base64Encoded: encoded) else {
      return nil
    }

    do {
      return try JSONDecoder().decode(ActivityCategoryToken.self, from: data)
    } catch {
      return nil
    }
  }

  private func decodeWebDomainToken(from encoded: String) -> WebDomainToken? {
    guard let data = Data(base64Encoded: encoded) else {
      return nil
    }

    do {
      return try JSONDecoder().decode(WebDomainToken.self, from: data)
    } catch {
      return nil
    }
  }
}

enum MonitorBlockedItemType: String {
  case app
  case category
  case webDomain
}

struct MonitorBlockedItemInfo {
  let type: MonitorBlockedItemType
  let tokenId: String
  let appToken: ApplicationToken?
  let categoryToken: ActivityCategoryToken?
  let webDomainToken: WebDomainToken?
}

struct MonitorBlockConfig {
  let items: [MonitorBlockedItemInfo]
  let isActive: Bool
}
