import AppKit
import WebKit

private let gameName = "雾港的最后一炉"

private final class HarborApp: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var gameURL: URL!

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let page = Bundle.main.url(forResource: "fog-harbor", withExtension: "html") else {
            showFailure("应用内缺少 fog-harbor.html。")
            return
        }
        gameURL = page
        let menu = NSMenu()
        let appMenu = NSMenu(title: gameName)
        appMenu.addItem(withTitle: "退出" + gameName, action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        menu.addItem(withTitle: gameName, action: nil, keyEquivalent: "").submenu = appMenu
        let windowMenu = NSMenu(title: "窗口")
        windowMenu.addItem(withTitle: "最小化", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "关闭窗口", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        menu.addItem(withTitle: "窗口", action: nil, keyEquivalent: "").submenu = windowMenu
        NSApp.mainMenu = menu
        NSApp.windowsMenu = windowMenu

        let visible = NSScreen.main?.visibleFrame.size ?? NSSize(width: 1280, height: 800)
        let size = NSSize(width: min(1280, visible.width - 24), height: min(820, visible.height - 56))
        window = NSWindow(contentRect: NSRect(origin: .zero, size: size),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = gameName
        window.contentMinSize = NSSize(width: min(780, size.width), height: min(520, size.height))
        window.center()
        let configuration = WKWebViewConfiguration()
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.underPageBackgroundColor = NSColor(red: 0.08, green: 0.15, blue: 0.13, alpha: 1)
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        window.makeFirstResponder(webView)

        // The only document and its media are bundled inside the app.
        let rules = #"[{"trigger":{"url-filter":"^https?://"},"action":{"type":"block"}},{"trigger":{"url-filter":"^wss?://"},"action":{"type":"block"}}]"#
        WKContentRuleListStore.default().compileContentRuleList(
            forIdentifier: "FogHarborOffline", encodedContentRuleList: rules
        ) { [weak self] ruleList, _ in
            guard let self else { return }
            guard let ruleList else {
                self.showFailure("无法初始化离线游戏窗口。请关闭后重新打开应用。")
                return
            }
            self.webView.configuration.userContentController.add(ruleList)
            self.webView.loadFileURL(page, allowingReadAccessTo: page)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let requested = action.request.url
        let allowed = requested?.isFileURL == true && requested?.path == gameURL.path
        decisionHandler(allowed ? .allow : .cancel)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.loadFileURL(gameURL, allowingReadAccessTo: gameURL)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    private func showFailure(_ message: String) {
        let alert = NSAlert()
        alert.messageText = gameName
        alert.informativeText = message
        alert.runModal()
        NSApp.terminate(nil)
    }
}

let application = NSApplication.shared
private let delegate = HarborApp()
application.setActivationPolicy(.regular)
application.delegate = delegate
application.run()
