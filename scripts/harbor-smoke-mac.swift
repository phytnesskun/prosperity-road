// swift scripts/harbor-smoke-mac.swift dist/fog-harbor.html .qa/harbor-native
// swift scripts/harbor-smoke-mac.swift dist/rice-market.html .qa/rice-native --rice
// swift scripts/harbor-smoke-mac.swift dist/fog-harbor-journeys.html .qa/journeys-native --journeys
// swift scripts/harbor-smoke-mac.swift dist/first-ferry.html .qa/morning-native --morning
import AppKit
import WebKit

struct CheckFailure: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}

@MainActor
final class Playthrough: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    let window: NSWindow
    let web: WKWebView
    let file: URL
    let output: URL
    var loads = 0
    var frames: Task<Void, Never>?
    // WebKit also suspends RAF when an unattended test window is occluded.
    let useTestClock = ProcessInfo.processInfo.environment["HARBOR_TEST_CLOCK"] == "1"
        || (CGSessionCopyCurrentDictionary() as? [String: Any])?["CGSSessionScreenIsLocked"] as? Bool == true
    var violations: [String] = []
    let save = "JSON.parse(localStorage.getItem('prosperity-road.fog-harbor.v1'))"

    init(file: URL, output: URL, rules: WKContentRuleList) {
        self.file = file
        self.output = output
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.userContentController.add(rules)
        // Drive frames only inside this isolated test renderer when requested.
        if useTestClock {
            config.preferences.inactiveSchedulingPolicy = .none
            let frameClock = #"""
            (() => {
              Object.defineProperty(document, 'hidden', {get: () => false});
              Object.defineProperty(document, 'visibilityState', {get: () => 'visible'});
              let queue = new Map(), next = 0;
              window.requestAnimationFrame = f => { queue.set(++next, f); return next; };
              window.cancelAnimationFrame = id => queue.delete(id);
              window.harborForegroundFrame = () => {
                const batch = queue; queue = new Map();
                const stamp = performance.now();
                for (const f of batch.values()) f(stamp);
              };
            })()
            """#
            config.userContentController.addUserScript(WKUserScript(source: frameClock, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        // WebKit blocks remote resource loads, and these observers report attempted requests and JS errors.
        let observer = #"""
        (() => {
          const report = text => window.webkit.messageHandlers.harborCheck.postMessage(String(text).slice(0, 220));
          const inspect = value => {
            const raw = typeof value === 'string' ? value : value?.url || value?.href;
            if (raw && /^(https?:|wss?:|\/\/)/i.test(raw)) report('network: '+raw);
          };
          const originalFetch = window.fetch;
          window.fetch = function(url, ...args) { inspect(url); return originalFetch.call(this, url, ...args); };
          const open = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url, ...args) { inspect(url); return open.call(this, method, url, ...args); };
          for (const key of ['WebSocket','EventSource','Worker']) {
            const Original = window[key];
            if (Original) window[key] = new Proxy(Original, {construct(target, args) {
              inspect(args[0]); return Reflect.construct(target, args);
            }});
          }
          if (navigator.sendBeacon) {
            const beacon = navigator.sendBeacon.bind(navigator);
            navigator.sendBeacon = (url, ...args) => { inspect(url); return beacon(url, ...args); };
          }
          addEventListener('error', e => {
            if (e.message) report('script: '+e.message);
            else if (e.target?.src || e.target?.href) report('failed resource: '+(e.target.src || e.target.href).split(',')[0]);
          }, true);
          addEventListener('unhandledrejection', e => report('rejection: '+e.reason));
          new PerformanceObserver(list => list.getEntries().forEach(entry => inspect(entry.name))).observe({entryTypes:['resource']});
        })();
        """#
        config.userContentController.addUserScript(WKUserScript(source: observer, injectionTime: .atDocumentStart, forMainFrameOnly: false))
        web = WKWebView(frame: .zero, configuration: config)
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1190, height: 790),
                          styleMask: [.titled, .resizable], backing: .buffered, defer: false)
        window.title = "雾港 · 原生离线试玩验证"
        super.init()
        config.userContentController.add(self, name: "harborCheck")
        web.navigationDelegate = self
        window.contentView = web
        window.center()
        window.collectionBehavior = [.moveToActiveSpace, .fullScreenAuxiliary]
        window.makeKeyAndOrderFront(nil)
        window.orderFrontRegardless()
        if useTestClock {
            frames = Task { [weak self] in
                while !Task.isCancelled {
                    try? await Task.sleep(nanoseconds: 30_000_000)
                    guard let self else { return }
                    _ = try? await self.web.evaluateJavaScript("window.harborForegroundFrame?.(); true")
                }
            }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if let text = message.body as? String { violations.append(text) }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loads += 1 }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.request.url?.standardizedFileURL.path == file.standardizedFileURL.path,
           action.request.url?.isFileURL == true { decisionHandler(.allow) }
        else {
            violations.append("Unexpected navigation: " + (action.request.url?.absoluteString ?? "(missing URL)"))
            decisionHandler(.cancel)
        }
    }

    func until(_ description: String, seconds: Double = 10, _ check: () async throws -> Bool) async throws {
        let deadline = Date().addingTimeInterval(seconds)
        while Date() < deadline {
            if !violations.isEmpty { throw CheckFailure(violations.joined(separator: "; ")) }
            if try await check() { return }
            try await Task.sleep(nanoseconds: 75_000_000)
        }
        let status = try? await web.evaluateJavaScript(#"""
        JSON.stringify({phase:document.querySelector('.harbor')?.dataset.phase, hidden:document.hidden, focus:document.hasFocus(), frameCount:window.harborFrameCount,
        actions:[...document.querySelectorAll('button[data-action],[data-bake-take]')].map(x=>x.textContent),
        place:document.querySelector('[data-place][aria-current="location"]')?.dataset.place,
        stored:localStorage.getItem('prosperity-road.fog-harbor.v1')})
        """#)
        throw CheckFailure("Timed out waiting for \(description). Page: \(status ?? "(unavailable)")")
    }
    func check(_ expression: String, _ description: String, seconds: Double = 10) async throws {
        try await until(description, seconds: seconds) { try await self.web.evaluateJavaScript("Boolean(" + expression + ")") as? Bool == true }
    }
    func openPage(reloading: Bool = false, rice: Bool = false) async throws {
        let previous = loads
        if reloading { web.reload() } else { web.loadFileURL(file, allowingReadAccessTo: file) }
        try await until("offline navigation") { self.loads > previous }
        if rice {
            try await check("document.querySelector('.rice-game')", "second chapter store")
            return
        }
        try await check("document.querySelector('h1')?.textContent.includes('雾港的最后一炉') && document.querySelector('#street-canvas')?.width > 0", "title and street")
        try await check("document.documentElement.scrollWidth <= innerWidth+1", "viewport without horizontal overflow")
        try await check(#"""
        (() => {
          const c=document.querySelector('#street-canvas');
          const colors=new Set(new Uint32Array(c.getContext('2d').getImageData(40,50,200,120).data.buffer));
          return colors.size > 20;
        })()
        """#, "painted street with varied canvas pixels")
    }
    func click(_ selector: String, seconds: Double = 10) async throws {
        // Selectors are constant test inputs (no user-provided JavaScript).
        let find = "Array.from(document.querySelectorAll(\"" + selector + "\")).find(el => !el.disabled && el.getClientRects().length)"
        try await check(find, selector, seconds: seconds)
        _ = try await web.evaluateJavaScript(find + ".click(); true")
    }
    func visit(_ place: String) async throws {
        let pin = "button[data-place='" + place + "']"
        try await click(pin)
        try await check("document.querySelector(\"" + pin + "[aria-current='location']\")", "cart arrival at " + place)
    }
    func use(_ action: String) async throws {
        try await click("button[data-action='" + action + "']")
        if action == "bake" || action == "fire" {
            if action == "bake" { try await snapshot("oven") }
            try await click("button[data-bake-take]")
        }
    }
    // Viewport coordinates from the two scene controls, followed by viewport height.
    @discardableResult
    func dragMouse(_ points: [CGFloat]) async throws -> NSView {
        let source = NSPoint(x: points[0], y: points[4] - points[1])
        let target = NSPoint(x: points[2], y: points[4] - points[3])
        guard let hit = web.hitTest(web.convert(source, from: nil)) else { throw CheckFailure("Inventory is outside the window") }
        for step in 0...10 {
            let type: NSEvent.EventType = step == 0 ? .leftMouseDown : (step == 10 ? .leftMouseUp : .leftMouseDragged)
            let t = min(CGFloat(step) / 9, 1)
            let point = NSPoint(x: source.x + (target.x - source.x) * t, y: source.y + (target.y - source.y) * t)
            guard let event = NSEvent.mouseEvent(with: type, location: point, modifierFlags: [],
                 timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil,
                 eventNumber: step + 1, clickCount: 1, pressure: step == 10 ? 0 : 1) else { throw CheckFailure("Could not create mouse input") }
            switch type {
            case .leftMouseDown: hit.mouseDown(with: event)
            case .leftMouseUp: hit.mouseUp(with: event)
            default: hit.mouseDragged(with: event)
            }
            try await Task.sleep(nanoseconds: 40_000_000)
        }
        return hit
    }
    func dragToDock() async throws {
        let geometry = try await web.evaluateJavaScript(#"""
        (() => {
          window.harborFrameCount = 0; requestAnimationFrame(function frame(){ window.harborFrameCount++; if(window.harborFrameCount<900) requestAnimationFrame(frame); });
          window.harborDrag = [];
          window.harborMouse = [];
          for (const type of ['mousedown','pointerdown','pointerup']) addEventListener(type, e => {
            window.harborMouse.push([e.type, e.clientX, e.clientY, e.target.id, e.isTrusted, e.button]);
          }, true);
          const token = document.querySelector('#stock-token');
          for (const type of ['pointerdown','pointermove','pointerup']) token.addEventListener(type, e => {
            if (e.isTrusted && window.harborDrag.at(-1) !== type) window.harborDrag.push(type);
          }, {capture:true});
          const point = el => { const r=el.getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2]; };
          return [...point(token), ...point(document.querySelector("button[data-place='dock']")), innerHeight];
        })()
        """#)
        guard let points = geometry as? [CGFloat], points.count == 5 else { throw CheckFailure("Missing drag geometry") }
        let hit = try await dragMouse(points)
        guard let received = try await web.evaluateJavaScript("window.harborDrag") as? [String],
              received.contains("pointerdown"), received.contains("pointermove"), received.contains("pointerup") else {
            let events = try? await web.evaluateJavaScript("JSON.stringify(window.harborMouse)")
            throw CheckFailure("Native bread drag target \(type(of: hit)); trusted pointer events: \(events ?? "no events")")
        }
        // In case of a failure, record coordinates received by WebKit, not system cursor positions.
        let trace = try await web.evaluateJavaScript(#"JSON.stringify([window.harborMouse,...['#waypoint','#stock-token',"button[data-place='dock']"].map(s=>{const e=document.querySelector(s);return [s,e?.hidden,JSON.stringify(e?.getBoundingClientRect())]})])"#)
        do { try await check(save + ".state.stock === 6 && " + save + ".state.dock === 6", "one half-basket delivered by drag") }
        catch { throw CheckFailure("\(error); pointer trace: \(trace ?? "missing")") }
    }

    func cross(checkCancellation: Bool) async throws {
        if checkCancellation {
            let before = try await web.evaluateJavaScript("JSON.stringify(" + save + ".state)") as? String
            try await use("sail")
            try await click("button[data-cross-cancel]")
            let after = try await web.evaluateJavaScript("JSON.stringify(" + save + ".state)") as? String
            guard let before, before == after else { throw CheckFailure("Cancelling a crossing changed the morning reward") }
        }
        try await use("sail")
        try await click("button[data-cross-assist]")
        if checkCancellation {
            try await Task.sleep(nanoseconds: 1_200_000_000)
            try await snapshot("crossing")
        }
        try await click("button[data-cross-load]", seconds: 43)
        try await check(save + ".state.sailed === true && " + save + ".state.flour >= 1", "loading flour across the river")
    }
    func snapshot(_ name: String) async throws {
        let config = WKSnapshotConfiguration()
        config.afterScreenUpdates = true
        let image = try await web.takeSnapshot(configuration: config)
        guard let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
              let png = rep.representation(using: .png, properties: [:]) else { throw CheckFailure("PNG encoding failed") }
        try png.write(to: output.appendingPathComponent(name + ".png"), options: .atomic)
    }

    func play(route: String) async throws -> [String: Any] {
        try await openPage()
        try await check("document.querySelector('.harbor').dataset.phase === 'opening' && document.querySelector('#stock-count').textContent.includes('13')", "fresh opening")
        let guideVisible = try await web.evaluateJavaScript("""
        (() => { const r=document.querySelector('.guide').getBoundingClientRect();
                 return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight; })()
        """) as? Bool ?? false
        if route == "ship" { try await snapshot("opening") }
        try await visit("street")
        try await use("bell")
        try await use("sell")
        try await check(save + "?.state.stock === 12 && " + save + ".state.phase === 'orders'", "first sale and horn")
        let both = route == "both"
        let ship = route != "workers"
        let first = ship ? "dock" : "oven"
        let delivery = ship ? "deliverDock" : "deliverWorkers"
        if route == "ship" {
            try await dragToDock()
            try await use("investigate")
        } else {
            try await visit(first)
            try await use(delivery)
        }
        if both {
            try await visit("oven")
            try await use("deliverWorkers")
            try await visit("mill")
            try await use("buyFlour")
            let saved = try await web.evaluateJavaScript("localStorage.getItem('prosperity-road.fog-harbor.v1')") as? String
            try await openPage(reloading: true)
            guard let saved, let original = try JSONSerialization.jsonObject(with: Data(saved.utf8)) as? NSDictionary,
                  let restored = try await web.evaluateJavaScript(save) as? NSDictionary,
                  original == restored else { throw CheckFailure("Partial delivery save changed across reload.") }
            try await check(save + ".state.flour === 1 && " + save + ".state.workers === 6 && " + save + ".state.dock === 6", "restored split order and flour")
            try await visit("oven")
            try await use("bake")
            try await check(save + ".state.baked && " + save + ".state.stock === 12", "baked stock")
            try await use("deliverWorkers")
            try await visit("dock")
            try await use("deliverDock")
        } else { try await use(delivery) }
        try await use("close")
        try await check("document.querySelector('.harbor').dataset.phase === 'morning' && " + save + ".state.phase === 'morning'", "visible next morning")
        try await Task.sleep(nanoseconds: 150_000_000)
        try await snapshot("morning-" + route)
        if ship {
            try await visit("dock")
            try await cross(checkCancellation: route == "ship")
        }
        if both || !ship {
            try await visit("oven")
            try await use("fire")
        }
        try await check(save + ".state.sailed === " + String(ship) + " && " + save + ".state.fired === " + String(both || !ship), "earned morning rewards")
        try await check("document.documentElement.scrollWidth <= innerWidth+1", "ending without overflow")
        let remoteCount = try await web.evaluateJavaScript("performance.getEntriesByType('resource').filter(e=>/^https?:|^wss?:/.test(e.name)).length") as? Int
        guard remoteCount == 0 && violations.isEmpty else { throw CheckFailure("Network or script violations: \(violations)") }
        guard let state = try await web.evaluateJavaScript(save + ".state") as? [String: Any] else { throw CheckFailure("Missing final state") }
        return ["route": route, "finalState": state, "observedRemoteRequests": remoteCount ?? -1, "reloadChecked": both,
                "frameSource": useTestClock ? "native test clock" : "WebKit foreground RAF",
                "initialGuideVisible": guideVisible, "dragChecked": route == "ship",
                "crossingChecked": ship, "cancelCrossingChecked": route == "ship"]
    }
    // Send a real mouse click to the control inside this test window.
    func buyWithMouse() async throws {
        let coordinates = try await web.evaluateJavaScript(#"""
          (() => {
            const el = document.querySelector('[data-rice="buy"]');
            el.scrollIntoView({block:'center'});
            el.addEventListener('click', e => {window.riceTrustedPurchase = e.isTrusted}, {once:true});
            const r = el.getBoundingClientRect();
            return [r.x + r.width / 2, innerHeight - r.y - r.height / 2];
          })()
        """#)
        guard let coords = coordinates as? [CGFloat], coords.count == 2 else { throw CheckFailure("Missing buy button") }
        let point = NSPoint(x: coords[0], y: coords[1])
        guard let view = web.hitTest(web.convert(point, from: nil)) else { throw CheckFailure("Buy button outside window") }
        for kind in [NSEvent.EventType.leftMouseDown, .leftMouseUp] {
            guard let event = NSEvent.mouseEvent(with: kind, location: point, modifierFlags: [],
                 timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil,
                 eventNumber: 1, clickCount: 1, pressure: kind == .leftMouseDown ? 1 : 0) else { throw CheckFailure("Mouse input unavailable") }
            if kind == .leftMouseDown { view.mouseDown(with: event) } else { view.mouseUp(with: event) }
        }
        try await check("window.riceTrustedPurchase === true", "trusted mouse purchase")
    }
    func playRice(route: String, driver: String) async throws -> [String: Any] {
        func setup() async throws {
            _ = try await web.evaluateJavaScript(driver)
        }
        func step(_ name: String) async throws {
            FileHandle.standardError.write(Data(("Rice " + route + ": " + name + "\n").utf8))
            do {
                _ = try await web.callAsyncJavaScript("await ricePilot[name](); return true",
                    arguments: ["name": name], in: nil, contentWorld: .page)
            } catch { throw CheckFailure("Rice \(route) / \(name): \(error.localizedDescription) \((error as NSError).userInfo), resource errors: \(violations)") }
            guard violations.isEmpty else { throw CheckFailure(violations.joined(separator: "; ")) }
        }
        try await openPage(rice: true)
        try await setup()
        try await step("intro")
        if route == "four-bags" {
            try await snapshot("west-opening")
            try await step("chooseFour")
            try await buyWithMouse()
            try await step("loaded")
            try await step("east")
            let query = "localStorage.getItem('prosperity-road.rice-market.v1')"
            let before = try await web.evaluateJavaScript("JSON.parse("+query+")") as? NSDictionary
            try await openPage(reloading:true, rice:true)
            try await setup()
            let after = try await web.evaluateJavaScript("JSON.parse("+query+")") as? NSDictionary
            guard let before, after == before else { throw CheckFailure("Cargo, cash or bank changed across reload") }
            try await step("fullMonth")
            try await snapshot("east-new-month")
            try await step("fullReturn")
            try await snapshot("forty-four")
            try await step("finishAndReplay")
        } else {
            try await step("oneBag")
            try await step("sealCounter")
            try await step("keepFirst")
            try await openPage(reloading:true, rice:true)
            try await setup()
            try await step("resumeSeals")
            try await snapshot("three-seals")
            try await step("sealMatch")
            try await step("smallMonth")
            try await step("lockSeal")
        }
        let report = try await web.evaluateJavaScript("ricePilot.summary()") as? [String:Any]
        guard var report, violations.isEmpty else { throw CheckFailure("Missing rice report or resource failure") }
        if route == "one-bag-deal" {
            // Follow the published chapter links instead of injecting old campaign state.
            let original = try await web.evaluateJavaScript("JSON.parse(localStorage.getItem('prosperity-road.rice-market.v1'))") as? NSDictionary
            try await click("[data-rice='journal']")
            try await click("a[href='#harbor']")
            try await check("document.querySelector('.harbor') && document.querySelector('#menu')", "chapter one opens")
            try await click("#menu")
            try await click("a[href='#rice']")
            try await check("document.querySelector('.rice-game')", "return to saved chapter two")
            let restored = try await web.evaluateJavaScript("JSON.parse(localStorage.getItem('prosperity-road.rice-market.v1'))") as? NSDictionary
            guard let original, original == restored else { throw CheckFailure("Visiting chapter one changed the trade save: \(String(describing: original)) -> \(String(describing: restored))") }
        }
        report["chapterSwitchChecked"] = route == "one-bag-deal"
        report["sealProgressReloadChecked"] = route == "one-bag-deal"
        report["route"] = route
        report["trustedMouseAndReload"] = route == "four-bags"
        report["frameSource"] = useTestClock ? "native test clock" : "WebKit foreground RAF"
        return report
    }
    func playJourneys(alternate: Bool) async throws -> [String:Any] {
        func chapter(_ id: String) async throws {
            try await check("document.querySelector('.journey')?.dataset.episode === '" + id + "'", "chapter " + id)
        }
        func actions(_ id: String, _ moves: [String]) async throws {
            for move in moves { try await click("[data-" + id + "='" + move + "']") }
        }
        func ending() async throws -> String {
            try await check("!document.querySelector('#journey-ending').hidden && document.querySelector('#journey-summary').textContent.length", "visible chapter ending")
            return try await web.evaluateJavaScript("document.querySelector('#journey-summary').textContent") as? String ?? ""
        }
        web.loadFileURL(file, allowingReadAccessTo: file)
        try await chapter("mill")
        if !alternate {
            try await snapshot("mill-opening")
            try await click("#journey-book")
            _ = try await web.evaluateJavaScript("""
            const choice = document.querySelector('#journey-language');
            choice.value = 'en'; choice.dispatchEvent(new Event('change'));
            """)
            try await check("document.querySelector('#journey-line').lang === 'en'", "English performance and captions")
            _ = try await web.evaluateJavaScript("document.querySelector('#journey-language').value='zh'; document.querySelector('#journey-language').dispatchEvent(new Event('change')); true")
            try await click("#journey-close")
        }
        try await actions("mill", ["grind"])
        let before = try await web.evaluateJavaScript("localStorage.getItem('prosperity-road.harbor-mill.v1')") as? String
        let previous = loads
        web.reload()
        try await until("reload mid-shift") { self.loads > previous }
        try await chapter("mill")
        let after = try await web.evaluateJavaScript("localStorage.getItem('prosperity-road.harbor-mill.v1')") as? String
        guard before != nil, before == after else { throw CheckFailure("Lost mill in progress") }
        try await actions("mill", ["sail", "grind", "sail", "grind"])
        let street = Array(repeating:"street", count:alternate ? 4 : 6)
        let shipments = Array(repeating:"sift", count:alternate ? 4 : 3) + Array(repeating:"ship", count:alternate ? 4 : 3)
        try await actions("mill", street + shipments + ["close"])
        let mill = try await ending()
        guard mill.contains(alternate ? "启航前的最后一袋" : "整条街的热饼") else { throw CheckFailure(mill) }
        try await click("#journey-next")
        try await chapter("convoy")
        try await actions("convoy", [alternate ? "oil" : "flour","cast-off"])
        if !alternate { try await snapshot("convoy-fork") }
        try await actions("convoy", [alternate ? "outer" : "shoal","unload"])
        let convoy = try await ending()
        try await click("#journey-next")
        try await chapter("quay")
        try await actions("quay", alternate ? ["ferry","ferry","ferry"] : ["skim","ferry","gate","ferry"])
        let quay = try await ending()
        if !alternate { try await snapshot("quay-evening") }
        try await click("#journey-book")
        try await click("a[href='#mill']")
        try await chapter("mill")
        let restored = try await ending()
        guard mill == restored else { throw CheckFailure("Lost completed mill") }
        _ = try await web.evaluateJavaScript("window.finishedMillSave = localStorage.getItem('prosperity-road.harbor-mill.v1'); true")
        try await click("#journey-book")
        try await click("#journey-reset")
        try await click("#journey-restart")
        try await check("document.querySelector('#journey-ending').hidden","reset current chapter")
        if alternate {
            // Another tab finished while this copy stood at the feed gate.
            _ = try await web.evaluateJavaScript("localStorage.setItem('prosperity-road.harbor-mill.v1',window.finishedMillSave); true")
            let lastLoad = loads
            try await actions("mill", ["grind"])
            try await until("restore newer progress before trading") { self.loads > lastLoad }
            try await chapter("mill")
            let newer = try await ending()
            guard newer == mill else { throw CheckFailure("Old mill window overwrote newer progress") }
        }
        try await click("#journey-book")
        try await click("a[href='#quay']")
        try await chapter("quay")
        let retained = try await ending()
        guard retained == quay else { throw CheckFailure("Restarting the mill affected the quay") }
        try await click("#journey-next")
        try await chapter("morning")
        try await check("document.querySelector('#journey-play').dataset.bridgeLamps === '" + (alternate ? "6" : "4") + "'", "last night's bridge lights")
        try await click("#journey-book")
        try await check("document.querySelector('#journey-previous').textContent.includes('桥下游的灯')", "previous chapter in the log")
        try await click("a[href='#rice']")
        try await check("document.querySelector('.rice-game')","return to the rice counter")
        try await click("[data-rice='journal']")
        try await click("a[href='#mill']")
        try await chapter("mill")
        window.setContentSize(NSSize(width:390, height:800))
        try await check("innerWidth <= 400 && document.documentElement.scrollWidth <= innerWidth + 1","narrow viewport without overflow")
        guard violations.isEmpty else { throw CheckFailure(violations.joined(separator:", ")) }
        return ["mill":mill, "convoy":convoy, "quay":quay, "alternate":alternate, "restored":true, "observedRemoteRequests":0]
    }
    func playMorning(alternate: Bool) async throws -> [String:Any] {
        let state = "JSON.parse(localStorage.getItem('prosperity-road.harbor-morning.v1')).state"
        func act(_ name: String) async throws { try await click("[data-morning='" + name + "']") }
        func dragOnQuay(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double) async throws {
            let geometry = try await web.evaluateJavaScript("""
            (() => {
                const canvas = document.querySelector('.morning-scene');
                canvas.scrollIntoView({block:'nearest'});
                const b = canvas.getBoundingClientRect();
                return [b.x+b.width*\(x1), b.y+b.height*\(y1), b.x+b.width*\(x2), b.y+b.height*\(y2),innerHeight];
            })()
            """)
            guard let points = geometry as? [CGFloat], points.count == 5 else { throw CheckFailure("Missing quay bounds") }
            try await dragMouse(points)
        }
        func reloadCheckingSave() async throws {
            let saved = try await web.evaluateJavaScript(state) as? NSDictionary
            let previous = loads
            web.reload()
            try await until("reload the ferry ledger") { self.loads > previous }
            try await check("document.querySelector('.morning-yard')","reopen ferry")
            let after = try await web.evaluateJavaScript(state) as? NSDictionary
            guard let saved, saved == after else { throw CheckFailure("Ferry ledger changed on reload") }
        }
        web.loadFileURL(file, allowingReadAccessTo: file)
        try await check("document.querySelector('.morning-yard')","direct chapter six entry")
        try await check("document.querySelector('#journey-play').dataset.bridgeLamps === undefined","independent start")
        if !alternate { try await snapshot("old-ticket") }
        try await act("uncover")
        if alternate {
            for _ in 0..<3 { try await act("crate") }
        } else {
            try await dragOnQuay(0.278,0.576,0.553,0.777)
            try await check(state + ".cargo.join() === 'passenger'","drag person aboard")
            try await dragOnQuay(0.553,0.777,0.335,0.692)
            try await check(state + ".cargo.length === 0","drag person ashore")
            try await act("passenger")
            try await act("crate")
            try await reloadCheckingSave()
            try await act("near")
            try await act("passenger")
        }
        try await act("east")
        try await act(alternate ? "flex" : "early")
        try await check(state + ".day === 2","return to the quay the following morning")
        try await reloadCheckingSave()
        window.setContentSize(NSSize(width:390, height:800))
        try await check("innerWidth <= 400 && document.documentElement.scrollWidth <= innerWidth + 1","ferry fits phone width")
        if alternate {
            for _ in 0..<3 { try await act("crate") }
        } else {
            try await snapshot("morning-queue-narrow")
            window.setContentSize(NSSize(width:1190,height:790))
            try await check("innerWidth > 1000","wide quay")
            try await snapshot("morning-queue")
            try await act("eggs")
            try await act("passenger")
        }
        try await act("east")
        try await check(state + ".phase === 'done' && !document.querySelector('#journey-ending').hidden","finish second day")
        try await reloadCheckingSave()
        let summary = try await web.evaluateJavaScript("document.querySelector('#journey-summary').textContent") as? String
        let ledger = try await web.evaluateJavaScript(state) as? [String:Any]
        guard let summary, summary.contains(alternate ? "阿芸的午货赶上了船" : "两筐鸡蛋赶上早市"),
              let ledger, let trips = ledger["trips"] as? [[String:Any]], trips.count == (alternate ? 2 : 3) else {
            throw CheckFailure("Incorrect ferry ending or number of sailings: " + (summary ?? "no receipt"))
        }
        try await click("#journey-next")
        try await check("document.querySelector('.rice-game')","last chapter to rice market")
        guard violations.isEmpty else { throw CheckFailure(violations.joined(separator:", ")) }
        return ["route":alternate ? "flex-cargo":"early-passengers", "ledger":ledger, "summary":summary, "observedRemoteRequests":0]
    }
    func finish() {
        frames?.cancel()
        web.configuration.userContentController.removeScriptMessageHandler(forName: "harborCheck")
        window.orderOut(nil)
    }
}

@MainActor
func run() async throws {
    let rice = CommandLine.arguments.count == 4 && CommandLine.arguments[3] == "--rice"
    let journeys = CommandLine.arguments.count == 4 && CommandLine.arguments[3] == "--journeys"
    let morning = CommandLine.arguments.count == 4 && CommandLine.arguments[3] == "--morning"
    guard CommandLine.arguments.count == 3 || rice || journeys || morning else { throw CheckFailure("usage: swift scripts/harbor-smoke-mac.swift path/to/offline.html output-directory [--rice|--journeys|--morning]") }
    let file = URL(fileURLWithPath: CommandLine.arguments[1]).standardizedFileURL
    let output = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true).standardizedFileURL
    guard FileManager.default.isReadableFile(atPath: file.path) else { throw CheckFailure("Missing offline build at " + file.path) }
    try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
    let ruleDirectory = output.appendingPathComponent("webkit-rules", isDirectory: true)
    try FileManager.default.createDirectory(at: ruleDirectory, withIntermediateDirectories: true)
    let store = WKContentRuleListStore(url: ruleDirectory)!
    let rules = #"[{"trigger":{"url-filter":"^https?://"},"action":{"type":"block"}},{"trigger":{"url-filter":"^wss?://"},"action":{"type":"block"}}]"#
    let list = try await store.compileContentRuleList(forIdentifier: "OfflineSmoke", encodedContentRuleList: rules)!
    var report: [[String: Any]] = []
    let driverFile = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("rice-playthrough.js")
    let driver = rice ? try String(contentsOf: driverFile, encoding: .utf8) : ""
    let routes: [String]
    if morning { routes = ["early-passengers", "flex-cargo"] }
    else if journeys { routes = ["street-and-shoal", "ship-and-outer"] }
    else { routes = rice ? ["four-bags", "one-bag-deal"] : ["ship", "workers", "both"] }
    for route in routes {
        let test = Playthrough(file: file, output: output, rules: list)
        defer { test.finish() }
        let result: [String:Any]
        if morning { result = try await test.playMorning(alternate:route == "flex-cargo") }
        else if journeys { result = try await test.playJourneys(alternate:route == "ship-and-outer") }
        else if rice { result = try await test.playRice(route: route, driver: driver) }
        else { result = try await test.play(route: route) }
        report.append(result)
        print("PASS " + route)
    }
    let json = try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys, .prettyPrinted])
    try json.write(to: output.appendingPathComponent("results.json"), options: .atomic)
}
let application = NSApplication.shared
application.setActivationPolicy(.accessory)
Task { @MainActor in
    do { try await run(); exit(0) }
    catch { FileHandle.standardError.write(Data(("FAIL: " + String(describing: error) + "\n").utf8)); exit(1) }
}
application.run()
