(function () {
"use strict";

// ==========================================================
// ⚙️ CONFIGURATION
// ==========================================================
const CONFIG = {
    logoUrl:
        "https://blogger.googleusercontent.com/img/a/AVvXsEi6c8mGJ9oSTHO9Ey68PJZ4Ep-FwDJOvwIlzdrdAquMRl7HLwK9o2bxD693-Mb5CspCdoVOoFmX67DB9ESmN2b-WztKETiwcqwZ6tQi4de_Z3R_5ZTgtjpO77KBZ5zqQIDxTaQ3tXmbFuTo2AV-YEVcBagRYE8GkWPzjRv0XJiky6RTeSSA8JwS0yameE4=s1254",

    title: "Ad Blocker Detected!",

    message:
        "It looks like an ad or content blocker is preventing this page from loading properly. " +
        "viletales.com is a free website supported by readers and advertising, which helps us keep our stories available without a subscription. " +
        "If you enjoy our stories, please consider whitelisting or allowing ads on viletales.com " +
        "Once your blocker is disabled for this site, you can refresh and continue reading normally."
};


// ==========================================================
// 🧠 CONFIDENCE WEIGHTS
// ==========================================================
const WEIGHTS = {
    CRITICAL: 70,
    STRONG: 40,
    MEDIUM: 30,
    WEAK: 10
};


// ==========================================================
// 🎯 ENGINE STATE
// ==========================================================
let detectionScore = 0;
let legitAdRendered = false;
let pageLocked = false;

/*
 * Remembers the previous real-ad state.
 *
 * true  = real ad was previously rendered
 * false = real ad is currently not rendered
 */
let lastAdRenderState = false;

const incidentMap = new Map();

const evidenceMap = {
    NETWORK: new Set(),
    DOM_COSMETIC: new Set(),
    BROWSER_ENGINE: new Set()
};

const categoryState = {
    NETWORK: false,
    DOM_COSMETIC: false,
    BROWSER_ENGINE: false
};


// ==========================================================
// ⏱️ TIMING / SAFETY
// ==========================================================
const INITIAL_GRACE = 70;
const INCIDENT_TTL = 70;
const INCIDENT_COOLDOWN = 70;

/*
 * Fast local watchdog.
 *
 * Checks the actual ad/DOM state twice per second.
 */
const LOCAL_WATCH_INTERVAL = 500;

/*
 * Heavy network verification is intentionally slower.
 */
const NETWORK_WATCH_INTERVAL = 3000;

const nowReady = () =>
    performance.now() >= INITIAL_GRACE;


// ==========================================================
// 🌐 BROWSER CLASSIFICATION
// ==========================================================
const ua =
    (navigator.userAgent || "").toLowerCase();

const vendor =
    (navigator.vendor || "").toLowerCase();

const browser = {

    soul:
        ua.includes("soul") ||
        !!window.soul ||
        !!window.__soul_ext__,

    brave:
        !!(
            navigator.brave &&
            typeof navigator.brave.isBrave === "function"
        ),

    opera:
        ua.includes("opera") ||
        ua.includes("opr/"),

    chrome:
        !!window.chrome &&
        vendor.includes("google"),

    edge:
        ua.includes("edg/"),

    firefox:
        ua.includes("firefox"),

    safari:
        /safari/.test(ua) &&
        !/chrome|crios|android/.test(ua)
};


const knownStandardBrowser =
    browser.chrome ||
    browser.edge ||
    browser.firefox ||
    browser.safari;


// ==========================================================
// 🎚️ BALANCED THRESHOLD
// ==========================================================
function getThreshold() {

    /*
     * Standard browsers receive a safety buffer.
     *
     * No browser fingerprint can lock by itself.
     */

    if (knownStandardBrowser) {

        return legitAdRendered
            ? 145
            : 60;
    }

    return legitAdRendered
        ? 155
        : 60;
}


// ==========================================================
// 🧹 STATE DECAY
// ==========================================================
setInterval(() => {

    const now = performance.now();

    incidentMap.forEach((timestamp, id) => {

        if (now - timestamp > INCIDENT_TTL) {
            incidentMap.delete(id);
        }

    });

    /*
     * Slow score decay prevents a temporary
     * network failure from becoming permanent.
     */
    if (detectionScore > 0) {

        detectionScore =
            Math.max(
                0,
                detectionScore - 10
            );
    }

}, 1000);


// ==========================================================
// 🧹 RESET DETECTION STATE
// ==========================================================
function resetDetectionState() {

    detectionScore = 0;

    incidentMap.clear();

    Object.keys(categoryState)
        .forEach(key => {
            categoryState[key] = false;
        });

    Object.keys(evidenceMap)
        .forEach(key => {
            evidenceMap[key].clear();
        });
}


// ==========================================================
// ⭐ POSITIVE LEGITIMATE AD EVIDENCE
// ==========================================================
function checkRealAdRender() {

    const ads =
        document.querySelectorAll(".adsbygoogle");

    let rendered = false;

    ads.forEach(ad => {

        const iframe =
            ad.querySelector("iframe");

        if (!iframe) return;

        const rect =
            iframe.getBoundingClientRect();

        if (
            rect.width > 0 &&
            rect.height > 0
        ) {
            rendered = true;
        }

    });


    // ======================================================
    // 🔄 AD STATE CHANGE
    // ======================================================

    /*
     * ------------------------------------------------------
     * STATE 1:
     * Ad has appeared.
     * ------------------------------------------------------
     */
    if (
        rendered &&
        !lastAdRenderState
    ) {

        lastAdRenderState = true;

        legitAdRendered = true;

        /*
         * Positive evidence clears
         * accumulated suspicion.
         */
        resetDetectionState();

        /*
         * If blocker notice is visible,
         * remove it automatically.
         */
        if (pageLocked) {
            unlockPage();
        }
    }


    /*
     * ------------------------------------------------------
     * STATE 2:
     * Previously rendered ad has disappeared.
     *
     * This does NOT immediately lock the page.
     * It only starts a fresh detection cycle.
     * ------------------------------------------------------
     */
    if (
        !rendered &&
        lastAdRenderState
    ) {

        lastAdRenderState = false;

        legitAdRendered = false;

        /*
         * Start fresh evidence collection.
         */
        resetDetectionState();
    }


    /*
     * Keep the current legitimate state.
     */
    if (rendered) {
        legitAdRendered = true;
    }


    return rendered;
}


// ==========================================================
// 🔓 UNLOCK PAGE
// ==========================================================
function unlockPage() {

    if (!pageLocked) return;


    /*
     * Remove blocker overlay.
     */
    const overlay =
        document.getElementById(
            "ag-lock-overlay"
        );

    if (overlay) {
        overlay.remove();
    }


    /*
     * Remove only our lock style.
     */
    const style =
        document.getElementById(
            "ag-lock-style"
        );

    if (style) {
        style.remove();
    }


    pageLocked = false;
}


// ==========================================================
// 🔒 LOCK PAGE
// ==========================================================
function lockPage() {

    if (pageLocked) return;

    if (legitAdRendered) return;

    pageLocked = true;


    /*
     * IMPORTANT:
     *
     * The original article/content is NOT replaced.
     *
     * The overlay blocks access visually, while the
     * underlying page remains intact so the real ad can
     * continue rendering.
     */


    if (
        document.getElementById(
            "ag-lock-overlay"
        )
    ) {
        return;
    }


    // ------------------------------------------------------
    // 🎨 LOCK SCREEN STYLE
    // ------------------------------------------------------
    const style =
        document.createElement("style");

    style.id =
        "ag-lock-style";

    style.textContent = `

        html,
        body {

            overflow: hidden !important;
            height: 100% !important;

            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
        }


        #ag-lock-overlay {

            position: fixed;
            inset: 0;

            width: 100vw;
            height: 100vh;

            background: #0d1117;
            color: #fff;

            z-index: 2147483647;

            display: flex;
            align-items: center;
            justify-content: center;

            padding: 20px;
            box-sizing: border-box;

            font-family:
                system-ui,
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                Roboto,
                sans-serif;

            text-align: center;
        }


        .ag-card {

            width: 100%;
            max-width: 400px;

            padding: 32px 24px;

            background: #161b22;

            border:
                1px solid #30363d;

            border-radius: 12px;

            box-shadow:
                0 10px 25px
                rgba(0,0,0,.5);

            box-sizing: border-box;
        }


        .ag-logo {

            max-width: 80px;
            max-height: 80px;

            margin-bottom: 16px;

            border-radius: 8px;

            object-fit: contain;
        }


        #ag-lock-overlay h1 {

            margin: 0 0 12px;

            font-size: 22px;

            color: #f0f6fc;

            font-weight: 600;
        }


        #ag-lock-overlay p {

            margin: 0;

            font-size: 14px;

            color: #8b949e;

            line-height: 1.6;
        }
    `;

    document.head.appendChild(style);


    // ------------------------------------------------------
    // 🛑 READER META SIGNAL
    // ------------------------------------------------------
    if (
        !document.querySelector(
            'meta[name="reader"]'
        )
    ) {

        const metaReader =
            document.createElement("meta");

        metaReader.name = "reader";
        metaReader.content = "no-reader-mode";

        document.head.appendChild(metaReader);
    }


    // ------------------------------------------------------
    // 🚫 OVERLAY
    // ------------------------------------------------------
    const overlay =
        document.createElement("div");

    overlay.id =
        "ag-lock-overlay";


    const logo =
        CONFIG.logoUrl
            ? `
                <img
                    src="${CONFIG.logoUrl}"
                    alt="Merayour"
                    class="ag-logo"
                    onerror="this.style.display='none'"
                >
              `
            : "";


    overlay.innerHTML = `

        <div class="ag-card">

            ${logo}

            <h1>
                ${CONFIG.title}
            </h1>

            <p>
                ${CONFIG.message}
            </p>

        </div>
    `;


    (
        document.body ||
        document.documentElement
    ).appendChild(overlay);
}


// ==========================================================
// 🧠 FINAL DECISION ENGINE
// ==========================================================
function evaluate() {

    if (!navigator.onLine) return;

    if (
        document.readyState === "loading"
    ) {
        return;
    }


    // ⭐ Positive evidence always wins.
    if (checkRealAdRender()) {
        return;
    }


    if (!nowReady()) return;


    const categoryCount =
        Object.values(categoryState)
            .filter(Boolean)
            .length;


    const networkEvidence =
        evidenceMap.NETWORK.size;

    const cosmeticEvidence =
        evidenceMap.DOM_COSMETIC.size;

    const browserEvidence =
        evidenceMap.BROWSER_ENGINE.size;


    /*
     * ======================================================
     * BALANCED CORRELATION
     * ======================================================
     *
     * Network alone:
     *     NEVER enough.
     *
     * Browser alone:
     *     NEVER enough.
     *
     * DOM cosmetic alone:
     *     NEVER enough.
     *
     * Network + DOM:
     *     primary high-confidence route.
     *
     * Browser + Network + DOM:
     *     strongest route.
     */


    const networkAndDOM =
        networkEvidence > 0 &&
        cosmeticEvidence > 0;


    const fullCorrelation =
        browserEvidence > 0 &&
        networkEvidence > 0 &&
        cosmeticEvidence > 0;


    /*
     * Require high score + independent evidence.
     */
    if (
        detectionScore >= getThreshold() &&
        categoryCount >= 2 &&
        (
            networkAndDOM ||
            fullCorrelation
        )
    ) {

        lockPage();
    }
}


// ==========================================================
// 🎯 INCIDENT REGISTRATION
// ==========================================================
function registerIncident(
    id,
    confidence,
    category,
    source
) {

    if (!category) return;


    const now =
        performance.now();


    /*
     * Deduplication.
     */
    if (
        incidentMap.has(id) &&
        now -
            incidentMap.get(id)
            < INCIDENT_COOLDOWN
    ) {
        return;
    }


    incidentMap.set(
        id,
        now
    );


    const weight =
        WEIGHTS[confidence] ||
        WEIGHTS.WEAK;


    detectionScore += weight;


    categoryState[category] =
        true;


    evidenceMap[category].add(
        source || id
    );


    /*
     * Network + DOM correlation.
     */
    if (
        evidenceMap.NETWORK.size > 0 &&
        evidenceMap.DOM_COSMETIC.size > 0
    ) {

        detectionScore += 25;
    }


    /*
     * Browser + Network + DOM.
     */
    if (
        evidenceMap.BROWSER_ENGINE.size > 0 &&
        evidenceMap.NETWORK.size > 0 &&
        evidenceMap.DOM_COSMETIC.size > 0
    ) {

        detectionScore += 20;
    }


    /*
     * Never lock synchronously from
     * a single incident.
     */
    setTimeout(
        evaluate,
        300
    );
}


// ==========================================================
// 🌐 NETWORK INCIDENT
// ==========================================================
function networkIncident(source) {

    if (!navigator.onLine) {
        return;
    }


    /*
     * Confirmation delay.
     */
    setTimeout(() => {

        if (!navigator.onLine) {
            return;
        }


        registerIncident(
            "network:" + source,
            "MEDIUM",
            "NETWORK",
            source
        );

    }, 700);
}


// ==========================================================
// 🪤 AD BAIT
// ==========================================================
function createBait() {

    let bait =
        document.getElementById(
            "ag-ad-bait"
        );


    if (bait) {
        return bait;
    }


    bait =
        document.createElement(
            "div"
        );


    bait.id =
        "ag-ad-bait";


    bait.className =
        "adsbygoogle ad-banner ad-unit google-ad";


    bait.style.cssText =
        "width:1px!important;" +
        "height:1px!important;" +
        "position:absolute!important;" +
        "left:-9999px!important;" +
        "top:-9999px!important;" +
        "opacity:0.01!important;";


    (
        document.body ||
        document.documentElement
    ).appendChild(bait);


    return bait;
}


// ==========================================================
// 🎨 COSMETIC DETECTION
// ==========================================================
function checkCosmetic() {

    const bait =
        createBait();


    if (!bait) return;


    const style =
        window.getComputedStyle(
            bait
        );


    const hidden =
        style.display === "none" ||
        style.visibility === "hidden" ||
        bait.offsetHeight === 0;


    if (hidden) {

        const hits =
            parseInt(
                bait.dataset.hits || "0",
                10
            ) + 1;


        bait.dataset.hits =
            String(hits);


        /*
         * Persistent hiding required.
         */
        if (hits >= 2) {

            registerIncident(
                "cosmetic:persistent-bait",
                "STRONG",
                "DOM_COSMETIC",
                "persistent_bait"
            );
        }

    } else {

        bait.dataset.hits = "0";
    }
}


// ==========================================================
// 🧬 BROWSER SIGNALS
// ==========================================================
function checkBrowserSignals() {

    let score = 0;


    /*
     * Soul UA = supporting signal.
     */
    if (browser.soul) {
        score += 30;
    }


    /*
     * Explicit Soul environment trace.
     */
    if (
        window.soul ||
        window.__soul_ext__ ||
        (
            window.external &&
            "Soul" in window.external
        )
    ) {

        score += 40;
    }


    /*
     * Brave API is only supporting evidence.
     */
    if (browser.brave) {
        score += 15;
    }


    /*
     * Browser evidence NEVER locks alone.
     */
    if (score >= 60) {

        registerIncident(
            "browser:strong-trace",
            "STRONG",
            "BROWSER_ENGINE",
            "browser_strong"
        );

    } else if (score >= 30) {

        registerIncident(
            "browser:weak-trace",
            "WEAK",
            "BROWSER_ENGINE",
            "browser_weak"
        );
    }
}


// ==========================================================
// 📦 AD STATE INSPECTION
// ==========================================================
function inspectAdState() {

    const ad =
        document.querySelector(
            "ins.adsbygoogle"
        );


    if (!ad) return;


    const iframe =
        ad.querySelector(
            "iframe"
        );


    if (iframe) {

        const rect =
            iframe.getBoundingClientRect();


        if (
            rect.width > 0 &&
            rect.height > 0
        ) {

            legitAdRendered = true;

            if (!lastAdRenderState) {
                lastAdRenderState = true;
                resetDetectionState();

                if (pageLocked) {
                    unlockPage();
                }
            }

            return;
        }
    }


    /*
     * Unfilled ad is neutral.
     */
    if (
        ad.getAttribute(
            "data-ad-status"
        ) === "unfilled"
    ) {

        return;
    }
}


// ==========================================================
// 🌐 NETWORK PIXEL
// ==========================================================
function runPixelTest() {

    const pixel =
        new Image();


    pixel.onload =
        () => {};


    pixel.onerror =
        () => {

            networkIncident(
                "pixel"
            );
        };


    pixel.src =
        "https://pagead2.googlesyndication.com/pagead/img/0.gif?" +
        Date.now();
}


// ==========================================================
// 🌐 NETWORK FETCH
// ==========================================================
async function runFetchTest() {

    try {

        await fetch(
            "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
            {
                method: "HEAD",
                mode: "no-cors",
                cache: "no-store"
            }
        );

    } catch (error) {

        networkIncident(
            "fetch"
        );
    }
}


// ==========================================================
// 🚨 SCRIPT ERROR INTERCEPTOR
// ==========================================================
window.addEventListener(
    "error",
    function (event) {

        if (
            !event ||
            !event.target
        ) {
            return;
        }


        const src =
            event.target.src ||
            "";


        if (
            /googlesyndication|pagead2/i
                .test(src)
        ) {

            networkIncident(
                "script"
            );
        }

    },
    true
);


// ==========================================================
// ⚡ XHR INTERCEPTOR
// ==========================================================
(function installXHR() {

    const originalOpen =
        XMLHttpRequest.prototype.open;


    XMLHttpRequest.prototype.open =
        function (
            method,
            url
        ) {

            this.addEventListener(
                "error",
                () => {

                    if (
                        typeof url !==
                            "string"
                    ) {
                        return;
                    }


                    if (
                        /pagead2|googlesyndication/i
                            .test(url)
                    ) {

                        networkIncident(
                            "xhr"
                        );
                    }

                }
            );


            return originalOpen.apply(
                this,
                arguments
            );
        };

})();


// ==========================================================
// ⚡ FETCH INTERCEPTOR
// ==========================================================
(function installFetchInterceptor() {

    if (!window.fetch) {
        return;
    }


    const originalFetch =
        window.fetch;


    window.fetch =
        function (...args) {

            const url =
                typeof args[0] ===
                    "string"
                    ? args[0]
                    : args[0]?.url ||
                      "";


            return originalFetch
                .apply(
                    this,
                    args
                )
                .catch(error => {

                    if (
                        /pagead2|googlesyndication/i
                            .test(url)
                    ) {

                        networkIncident(
                            "fetch-interceptor"
                        );
                    }


                    throw error;
                });

        };

})();


// ==========================================================
// 👀 TARGETED DOM OBSERVER
// ==========================================================
(function installDOMObserver() {

    const observer =
        new MutationObserver(
            mutations => {

                mutations.forEach(
                    mutation => {

                        mutation
                            .removedNodes
                            .forEach(
                                node => {

                                    if (
                                        node.nodeType !==
                                            1
                                    ) {
                                        return;
                                    }


                                    const removedAd =
                                        node.classList?.contains(
                                            "adsbygoogle"
                                        ) ||
                                        node.tagName ===
                                            "INS";


                                    if (
                                        removedAd
                                    ) {

                                        registerIncident(
                                            "dom:removed-ad",
                                            "STRONG",
                                            "DOM_COSMETIC",
                                            "ad_removal"
                                        );
                                    }

                                }
                            );
                    }
                );

            }
        );


    observer.observe(
        document.documentElement,
        {
            childList: true,
            subtree: true
        }
    );

})();


// ==========================================================
// 🛡️ FAST LOCAL WATCHDOG
// ==========================================================
function runLocalWatch() {

    if (!navigator.onLine) {
        return;
    }


    /*
     * The watchdog continues running even
     * while the page is locked.
     */
    const rendered =
        checkRealAdRender();


    /*
     * Real ad appeared.
     * Remove the notice immediately.
     */
    if (rendered) {
        return;
    }


    inspectAdState();


    if (legitAdRendered) {
        return;
    }


    /*
     * If locked, do NOT stop monitoring.
     *
     * We simply avoid repeating heavy detection
     * work until a state change or network check
     * supplies new evidence.
     */
    if (pageLocked) {
        return;
    }


    checkBrowserSignals();

    checkCosmetic();

    evaluate();
}


// ==========================================================
// 🌐 NETWORK WATCHDOG
// ==========================================================
async function runNetworkWatch() {

    if (!navigator.onLine) {
        return;
    }


    /*
     * Network verification continues independently
     * of the visual lock state.
     */
    runPixelTest();

    await runFetchTest();

    evaluate();
}


// ==========================================================
// 🔄 MAIN CHECK CYCLE
// ==========================================================
async function runAllChecks() {

    runLocalWatch();
}


// ==========================================================
// 💓 INITIALIZATION
// ==========================================================
function init() {

    setTimeout(() => {

        /*
         * Initial local check.
         */
        runLocalWatch();


        /*
         * 🛡️ FAST WATCHDOG
         *
         * Actual ad state is checked every 500ms.
         */
        setInterval(
            runLocalWatch,
            LOCAL_WATCH_INTERVAL
        );


        /*
         * 🌐 NETWORK WATCHDOG
         *
         * Network checks run every 3 seconds.
         */
        setInterval(
            runNetworkWatch,
            NETWORK_WATCH_INTERVAL
        );

    }, 5);
}


// ==========================================================
// 🚀 START
// ==========================================================
if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        init,
        { once: true }
    );

} else {

    init();
}

})();
