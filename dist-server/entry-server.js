var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { createRootRouteWithContext, Link, Outlet, createFileRoute, useNavigate, createRouter, RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import ReactDOMServer from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as c from "react";
import c__default, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback, forwardRef, createElement, useLayoutEffect, memo, useReducer } from "react";
import { hc as hc$1 } from "hono/client";
import * as Tt from "react-dom";
import Tt__default, { unstable_batchedUpdates, createPortal } from "react-dom";
import { Home, LayoutGrid, User, LogOut } from "lucide-react";
let isRefreshing = false;
let refreshSubscribers = [];
const onRefreshed = () => {
  refreshSubscribers.forEach(({ resolve }) => {
    resolve();
  });
  refreshSubscribers = [];
};
const onRefreshFailed = (error) => {
  refreshSubscribers.forEach(({ reject }) => {
    reject(error);
  });
  refreshSubscribers = [];
};
const addRefreshSubscriber = (subscriber) => {
  refreshSubscribers.push(subscriber);
};
const redirectToLoginIfNeeded = () => {
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
};
const customFetch = async (input, init) => {
  const newInit = {
    ...init,
    credentials: "include",
    headers: {
      ...init == null ? void 0 : init.headers
    }
  };
  let response = await fetch(input, newInit);
  const urlString = input.toString();
  const isRefreshEndpoint = urlString.includes("/auth/refresh");
  const isLoginEndpoint = urlString.includes("/auth/login");
  const isRegisterEndpoint = urlString.includes("/auth/register");
  const isLogoutEndpoint = urlString.includes("/auth/logout");
  const isMeEndpoint = urlString.includes("/auth/me");
  if (response.status === 401 && !isRefreshEndpoint && !isLoginEndpoint && !isRegisterEndpoint && !isLogoutEndpoint && !isMeEndpoint) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include"
        });
        if (refreshRes.ok) {
          onRefreshed();
          response = await fetch(input, newInit);
        } else {
          const error = new Error("Failed to refresh session");
          onRefreshFailed(error);
          redirectToLoginIfNeeded();
        }
      } catch (error) {
        onRefreshFailed(error instanceof Error ? error : new Error("Failed to refresh session"));
        redirectToLoginIfNeeded();
      } finally {
        isRefreshing = false;
      }
    } else {
      return new Promise((resolve, reject) => {
        addRefreshSubscriber({
          resolve: () => {
            resolve(fetch(input, newInit));
          },
          reject
        });
      });
    }
  }
  return response;
};
const client = hc$1("/api", {
  fetch: customFetch
});
const AuthContext = createContext(void 0);
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const initAuth = async () => {
      try {
        const res = await client.auth.me.$get({});
        if (res.ok) {
          const data = await res.json();
          setUser({ id: data.userId, email: data.email });
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);
  const login = (user2) => {
    setUser(user2);
  };
  const logout = async () => {
    try {
      await client.auth.logout.$post({});
    } catch {
    }
    setUser(null);
  };
  return /* @__PURE__ */ jsx(AuthContext.Provider, { value: { user, isLoading, login, logout }, children });
}
function useAuth() {
  const context = useContext(AuthContext);
  if (context === void 0) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
const warn = (i18n, code, msg, rest) => {
  var _a2, _b2, _c2, _d2;
  const args = [msg, {
    code,
    ...rest || {}
  }];
  if ((_b2 = (_a2 = i18n == null ? void 0 : i18n.services) == null ? void 0 : _a2.logger) == null ? void 0 : _b2.forward) {
    return i18n.services.logger.forward(args, "warn", "react-i18next::", true);
  }
  if (isString(args[0])) args[0] = `react-i18next:: ${args[0]}`;
  if ((_d2 = (_c2 = i18n == null ? void 0 : i18n.services) == null ? void 0 : _c2.logger) == null ? void 0 : _d2.warn) {
    i18n.services.logger.warn(...args);
  } else if (console == null ? void 0 : console.warn) {
    console.warn(...args);
  }
};
const alreadyWarned = {};
const warnOnce = (i18n, code, msg, rest) => {
  if (isString(msg) && alreadyWarned[msg]) return;
  if (isString(msg)) alreadyWarned[msg] = /* @__PURE__ */ new Date();
  warn(i18n, code, msg, rest);
};
const loadedClb = (i18n, cb) => () => {
  if (i18n.isInitialized) {
    cb();
  } else {
    const initialized = () => {
      setTimeout(() => {
        i18n.off("initialized", initialized);
      }, 0);
      cb();
    };
    i18n.on("initialized", initialized);
  }
};
const loadNamespaces = (i18n, ns2, cb) => {
  i18n.loadNamespaces(ns2, loadedClb(i18n, cb));
};
const loadLanguages = (i18n, lng, ns2, cb) => {
  if (isString(ns2)) ns2 = [ns2];
  if (i18n.options.preload && i18n.options.preload.indexOf(lng) > -1) return loadNamespaces(i18n, ns2, cb);
  ns2.forEach((n) => {
    if (i18n.options.ns.indexOf(n) < 0) i18n.options.ns.push(n);
  });
  i18n.loadLanguages(lng, loadedClb(i18n, cb));
};
const hasLoadedNamespace = (ns2, i18n, options = {}) => {
  if (!i18n.languages || !i18n.languages.length) {
    warnOnce(i18n, "NO_LANGUAGES", "i18n.languages were undefined or empty", {
      languages: i18n.languages
    });
    return true;
  }
  return i18n.hasLoadedNamespace(ns2, {
    lng: options.lng,
    precheck: (i18nInstance2, loadNotPending) => {
      if (options.bindI18n && options.bindI18n.indexOf("languageChanging") > -1 && i18nInstance2.services.backendConnector.backend && i18nInstance2.isLanguageChangingTo && !loadNotPending(i18nInstance2.isLanguageChangingTo, ns2)) return false;
    }
  });
};
const isString = (obj) => typeof obj === "string";
const isObject = (obj) => typeof obj === "object" && obj !== null;
const matchHtmlEntity = /&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34|nbsp|#160|copy|#169|reg|#174|hellip|#8230|#x2F|#47);/g;
const htmlEntities = {
  "&amp;": "&",
  "&#38;": "&",
  "&lt;": "<",
  "&#60;": "<",
  "&gt;": ">",
  "&#62;": ">",
  "&apos;": "'",
  "&#39;": "'",
  "&quot;": '"',
  "&#34;": '"',
  "&nbsp;": " ",
  "&#160;": " ",
  "&copy;": "©",
  "&#169;": "©",
  "&reg;": "®",
  "&#174;": "®",
  "&hellip;": "…",
  "&#8230;": "…",
  "&#x2F;": "/",
  "&#47;": "/"
};
const unescapeHtmlEntity = (m) => htmlEntities[m];
const unescape = (text) => text.replace(matchHtmlEntity, unescapeHtmlEntity);
let defaultOptions = {
  bindI18n: "languageChanged",
  bindI18nStore: "",
  transEmptyNodeValue: "",
  transSupportBasicHtmlNodes: true,
  transWrapTextNodes: "",
  transKeepBasicHtmlNodesFor: ["br", "strong", "i", "p"],
  useSuspense: true,
  unescape,
  transDefaultProps: void 0
};
const getDefaults = () => defaultOptions;
let i18nInstance;
const getI18n = () => i18nInstance;
const I18nContext = createContext();
class ReportNamespaces {
  constructor() {
    this.usedNamespaces = {};
  }
  addUsedNamespaces(namespaces) {
    namespaces.forEach((ns2) => {
      if (!this.usedNamespaces[ns2]) this.usedNamespaces[ns2] = true;
    });
  }
  getUsedNamespaces() {
    return Object.keys(this.usedNamespaces);
  }
}
var shim = { exports: {} };
var useSyncExternalStoreShim_production = {};
/**
 * @license React
 * use-sync-external-store-shim.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var hasRequiredUseSyncExternalStoreShim_production;
function requireUseSyncExternalStoreShim_production() {
  if (hasRequiredUseSyncExternalStoreShim_production) return useSyncExternalStoreShim_production;
  hasRequiredUseSyncExternalStoreShim_production = 1;
  var React = c__default;
  function is2(x, y) {
    return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
  }
  var objectIs = "function" === typeof Object.is ? Object.is : is2, useState2 = React.useState, useEffect2 = React.useEffect, useLayoutEffect2 = React.useLayoutEffect, useDebugValue = React.useDebugValue;
  function useSyncExternalStore$2(subscribe, getSnapshot) {
    var value = getSnapshot(), _useState = useState2({ inst: { value, getSnapshot } }), inst = _useState[0].inst, forceUpdate = _useState[1];
    useLayoutEffect2(
      function() {
        inst.value = value;
        inst.getSnapshot = getSnapshot;
        checkIfSnapshotChanged(inst) && forceUpdate({ inst });
      },
      [subscribe, value, getSnapshot]
    );
    useEffect2(
      function() {
        checkIfSnapshotChanged(inst) && forceUpdate({ inst });
        return subscribe(function() {
          checkIfSnapshotChanged(inst) && forceUpdate({ inst });
        });
      },
      [subscribe]
    );
    useDebugValue(value);
    return value;
  }
  function checkIfSnapshotChanged(inst) {
    var latestGetSnapshot = inst.getSnapshot;
    inst = inst.value;
    try {
      var nextValue = latestGetSnapshot();
      return !objectIs(inst, nextValue);
    } catch (error) {
      return true;
    }
  }
  function useSyncExternalStore$1(subscribe, getSnapshot) {
    return getSnapshot();
  }
  var shim2 = "undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement ? useSyncExternalStore$1 : useSyncExternalStore$2;
  useSyncExternalStoreShim_production.useSyncExternalStore = void 0 !== React.useSyncExternalStore ? React.useSyncExternalStore : shim2;
  return useSyncExternalStoreShim_production;
}
var useSyncExternalStoreShim_development = {};
/**
 * @license React
 * use-sync-external-store-shim.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var hasRequiredUseSyncExternalStoreShim_development;
function requireUseSyncExternalStoreShim_development() {
  if (hasRequiredUseSyncExternalStoreShim_development) return useSyncExternalStoreShim_development;
  hasRequiredUseSyncExternalStoreShim_development = 1;
  "production" !== process.env.NODE_ENV && (function() {
    function is2(x, y) {
      return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
    }
    function useSyncExternalStore$2(subscribe, getSnapshot) {
      didWarnOld18Alpha || void 0 === React.startTransition || (didWarnOld18Alpha = true, console.error(
        "You are using an outdated, pre-release alpha of React 18 that does not support useSyncExternalStore. The use-sync-external-store shim will not work correctly. Upgrade to a newer pre-release."
      ));
      var value = getSnapshot();
      if (!didWarnUncachedGetSnapshot) {
        var cachedValue = getSnapshot();
        objectIs(value, cachedValue) || (console.error(
          "The result of getSnapshot should be cached to avoid an infinite loop"
        ), didWarnUncachedGetSnapshot = true);
      }
      cachedValue = useState2({
        inst: { value, getSnapshot }
      });
      var inst = cachedValue[0].inst, forceUpdate = cachedValue[1];
      useLayoutEffect2(
        function() {
          inst.value = value;
          inst.getSnapshot = getSnapshot;
          checkIfSnapshotChanged(inst) && forceUpdate({ inst });
        },
        [subscribe, value, getSnapshot]
      );
      useEffect2(
        function() {
          checkIfSnapshotChanged(inst) && forceUpdate({ inst });
          return subscribe(function() {
            checkIfSnapshotChanged(inst) && forceUpdate({ inst });
          });
        },
        [subscribe]
      );
      useDebugValue(value);
      return value;
    }
    function checkIfSnapshotChanged(inst) {
      var latestGetSnapshot = inst.getSnapshot;
      inst = inst.value;
      try {
        var nextValue = latestGetSnapshot();
        return !objectIs(inst, nextValue);
      } catch (error) {
        return true;
      }
    }
    function useSyncExternalStore$1(subscribe, getSnapshot) {
      return getSnapshot();
    }
    "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
    var React = c__default, objectIs = "function" === typeof Object.is ? Object.is : is2, useState2 = React.useState, useEffect2 = React.useEffect, useLayoutEffect2 = React.useLayoutEffect, useDebugValue = React.useDebugValue, didWarnOld18Alpha = false, didWarnUncachedGetSnapshot = false, shim2 = "undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement ? useSyncExternalStore$1 : useSyncExternalStore$2;
    useSyncExternalStoreShim_development.useSyncExternalStore = void 0 !== React.useSyncExternalStore ? React.useSyncExternalStore : shim2;
    "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
  })();
  return useSyncExternalStoreShim_development;
}
var hasRequiredShim;
function requireShim() {
  if (hasRequiredShim) return shim.exports;
  hasRequiredShim = 1;
  if (process.env.NODE_ENV === "production") {
    shim.exports = requireUseSyncExternalStoreShim_production();
  } else {
    shim.exports = requireUseSyncExternalStoreShim_development();
  }
  return shim.exports;
}
var shimExports = requireShim();
const notReadyT = (k, optsOrDefaultValue) => {
  if (isString(optsOrDefaultValue)) return optsOrDefaultValue;
  if (isObject(optsOrDefaultValue) && isString(optsOrDefaultValue.defaultValue)) return optsOrDefaultValue.defaultValue;
  if (typeof k === "function") return "";
  if (Array.isArray(k)) {
    const last = k[k.length - 1];
    return typeof last === "function" ? "" : last;
  }
  return k;
};
const notReadySnapshot = {
  t: notReadyT,
  ready: false
};
const dummySubscribe = () => () => {
};
const useTranslation = (ns2, props = {}) => {
  var _a2, _b2, _c2;
  const {
    i18n: i18nFromProps
  } = props;
  const {
    i18n: i18nFromContext,
    defaultNS: defaultNSFromContext
  } = useContext(I18nContext) || {};
  const i18n = i18nFromProps || i18nFromContext || getI18n();
  if (i18n && !i18n.reportNamespaces) i18n.reportNamespaces = new ReportNamespaces();
  if (!i18n) {
    warnOnce(i18n, "NO_I18NEXT_INSTANCE", "useTranslation: You will need to pass in an i18next instance by using initReactI18next");
  }
  const i18nOptions = useMemo(() => {
    var _a3;
    return {
      ...getDefaults(),
      ...(_a3 = i18n == null ? void 0 : i18n.options) == null ? void 0 : _a3.react,
      ...props
    };
  }, [i18n, props]);
  const {
    useSuspense,
    keyPrefix
  } = i18nOptions;
  const nsOrContext = defaultNSFromContext || ((_a2 = i18n == null ? void 0 : i18n.options) == null ? void 0 : _a2.defaultNS);
  const unstableNamespaces = isString(nsOrContext) ? [nsOrContext] : nsOrContext || ["translation"];
  const namespaces = useMemo(() => unstableNamespaces, unstableNamespaces);
  (_c2 = (_b2 = i18n == null ? void 0 : i18n.reportNamespaces) == null ? void 0 : _b2.addUsedNamespaces) == null ? void 0 : _c2.call(_b2, namespaces);
  const revisionRef = useRef(0);
  const subscribe = useCallback((callback) => {
    if (!i18n) return dummySubscribe;
    const {
      bindI18n,
      bindI18nStore
    } = i18nOptions;
    const wrappedCallback = () => {
      revisionRef.current += 1;
      callback();
    };
    if (bindI18n) i18n.on(bindI18n, wrappedCallback);
    if (bindI18nStore) i18n.store.on(bindI18nStore, wrappedCallback);
    return () => {
      if (bindI18n) bindI18n.split(" ").forEach((e) => i18n.off(e, wrappedCallback));
      if (bindI18nStore) bindI18nStore.split(" ").forEach((e) => i18n.store.off(e, wrappedCallback));
    };
  }, [i18n, i18nOptions]);
  const snapshotRef = useRef();
  const getSnapshot = useCallback(() => {
    if (!i18n) {
      return notReadySnapshot;
    }
    const calculatedReady = !!(i18n.isInitialized || i18n.initializedStoreOnce) && namespaces.every((n) => hasLoadedNamespace(n, i18n, i18nOptions));
    const currentLng = props.lng || i18n.language;
    const currentRevision = revisionRef.current;
    const lastSnapshot = snapshotRef.current;
    if (lastSnapshot && lastSnapshot.ready === calculatedReady && lastSnapshot.lng === currentLng && lastSnapshot.keyPrefix === keyPrefix && lastSnapshot.revision === currentRevision) {
      return lastSnapshot;
    }
    const calculatedT = i18n.getFixedT(currentLng, i18nOptions.nsMode === "fallback" ? namespaces : namespaces[0], keyPrefix);
    const newSnapshot = {
      t: calculatedT,
      ready: calculatedReady,
      lng: currentLng,
      keyPrefix,
      revision: currentRevision
    };
    snapshotRef.current = newSnapshot;
    return newSnapshot;
  }, [i18n, namespaces, keyPrefix, i18nOptions, props.lng]);
  const [loadCount, setLoadCount] = useState(0);
  const {
    t: t2,
    ready
  } = shimExports.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (i18n && !ready && !useSuspense) {
      const onLoaded = () => setLoadCount((c2) => c2 + 1);
      if (props.lng) {
        loadLanguages(i18n, props.lng, namespaces, onLoaded);
      } else {
        loadNamespaces(i18n, namespaces, onLoaded);
      }
    }
  }, [i18n, props.lng, namespaces, ready, useSuspense, loadCount]);
  const finalI18n = i18n || {};
  const wrapperRef = useRef(null);
  const wrapperLangRef = useRef();
  const createI18nWrapper = (original) => {
    const descriptors = Object.getOwnPropertyDescriptors(original);
    if (descriptors.__original) delete descriptors.__original;
    const wrapper = Object.create(Object.getPrototypeOf(original), descriptors);
    if (!Object.prototype.hasOwnProperty.call(wrapper, "__original")) {
      try {
        Object.defineProperty(wrapper, "__original", {
          value: original,
          writable: false,
          enumerable: false,
          configurable: false
        });
      } catch (_) {
      }
    }
    return wrapper;
  };
  const ret = useMemo(() => {
    const original = finalI18n;
    const lang = original == null ? void 0 : original.language;
    let i18nWrapper = original;
    if (original) {
      if (wrapperRef.current && wrapperRef.current.__original === original) {
        if (wrapperLangRef.current !== lang) {
          i18nWrapper = createI18nWrapper(original);
          wrapperRef.current = i18nWrapper;
          wrapperLangRef.current = lang;
        } else {
          i18nWrapper = wrapperRef.current;
        }
      } else {
        i18nWrapper = createI18nWrapper(original);
        wrapperRef.current = i18nWrapper;
        wrapperLangRef.current = lang;
      }
    }
    const effectiveT = !ready && !useSuspense ? (...args) => {
      warnOnce(i18n, "USE_T_BEFORE_READY", "useTranslation: t was called before ready. When using useSuspense: false, make sure to check the ready flag before using t.");
      return t2(...args);
    } : t2;
    const arr = [effectiveT, i18nWrapper, ready];
    arr.t = effectiveT;
    arr.i18n = i18nWrapper;
    arr.ready = ready;
    return arr;
  }, [t2, finalI18n, ready, finalI18n.resolvedLanguage, finalI18n.language, finalI18n.languages]);
  if (i18n && useSuspense && !ready) {
    throw new Promise((resolve) => {
      const onLoaded = () => resolve();
      if (props.lng) {
        loadLanguages(i18n, props.lng, namespaces, onLoaded);
      } else {
        loadNamespaces(i18n, namespaces, onLoaded);
      }
    });
  }
  return ret;
};
function qg(e) {
  if (typeof document > "u") return;
  let n = document.head || document.getElementsByTagName("head")[0], r = document.createElement("style");
  r.type = "text/css", n.appendChild(r), r.styleSheet ? r.styleSheet.cssText = e : r.appendChild(document.createTextNode(e));
}
Array(12).fill(0);
let Zi = 1;
class sh {
  constructor() {
    this.subscribe = (n) => (this.subscribers.push(n), () => {
      const r = this.subscribers.indexOf(n);
      this.subscribers.splice(r, 1);
    }), this.publish = (n) => {
      this.subscribers.forEach((r) => r(n));
    }, this.addToast = (n) => {
      this.publish(n), this.toasts = [
        ...this.toasts,
        n
      ];
    }, this.create = (n) => {
      var r;
      const { message: o, ...s } = n, i = typeof (n == null ? void 0 : n.id) == "number" || ((r = n.id) == null ? void 0 : r.length) > 0 ? n.id : Zi++, a = this.toasts.find((f) => f.id === i), l = n.dismissible === void 0 ? true : n.dismissible;
      return this.dismissedToasts.has(i) && this.dismissedToasts.delete(i), a ? this.toasts = this.toasts.map((f) => f.id === i ? (this.publish({
        ...f,
        ...n,
        id: i,
        title: o
      }), {
        ...f,
        ...n,
        id: i,
        dismissible: l,
        title: o
      }) : f) : this.addToast({
        title: o,
        ...s,
        dismissible: l,
        id: i
      }), i;
    }, this.dismiss = (n) => (n ? (this.dismissedToasts.add(n), requestAnimationFrame(() => this.subscribers.forEach((r) => r({
      id: n,
      dismiss: true
    })))) : this.toasts.forEach((r) => {
      this.subscribers.forEach((o) => o({
        id: r.id,
        dismiss: true
      }));
    }), n), this.message = (n, r) => this.create({
      ...r,
      message: n
    }), this.error = (n, r) => this.create({
      ...r,
      message: n,
      type: "error"
    }), this.success = (n, r) => this.create({
      ...r,
      type: "success",
      message: n
    }), this.info = (n, r) => this.create({
      ...r,
      type: "info",
      message: n
    }), this.warning = (n, r) => this.create({
      ...r,
      type: "warning",
      message: n
    }), this.loading = (n, r) => this.create({
      ...r,
      type: "loading",
      message: n
    }), this.promise = (n, r) => {
      if (!r)
        return;
      let o;
      r.loading !== void 0 && (o = this.create({
        ...r,
        promise: n,
        type: "loading",
        message: r.loading,
        description: typeof r.description != "function" ? r.description : void 0
      }));
      const s = Promise.resolve(n instanceof Function ? n() : n);
      let i = o !== void 0, a;
      const l = s.then(async (u) => {
        if (a = [
          "resolve",
          u
        ], c__default.isValidElement(u))
          i = false, this.create({
            id: o,
            type: "default",
            message: u
          });
        else if (ah(u) && !u.ok) {
          i = false;
          const d = typeof r.error == "function" ? await r.error(`HTTP error! status: ${u.status}`) : r.error, g = typeof r.description == "function" ? await r.description(`HTTP error! status: ${u.status}`) : r.description, b = typeof d == "object" && !c__default.isValidElement(d) ? d : {
            message: d
          };
          this.create({
            id: o,
            type: "error",
            description: g,
            ...b
          });
        } else if (u instanceof Error) {
          i = false;
          const d = typeof r.error == "function" ? await r.error(u) : r.error, g = typeof r.description == "function" ? await r.description(u) : r.description, b = typeof d == "object" && !c__default.isValidElement(d) ? d : {
            message: d
          };
          this.create({
            id: o,
            type: "error",
            description: g,
            ...b
          });
        } else if (r.success !== void 0) {
          i = false;
          const d = typeof r.success == "function" ? await r.success(u) : r.success, g = typeof r.description == "function" ? await r.description(u) : r.description, b = typeof d == "object" && !c__default.isValidElement(d) ? d : {
            message: d
          };
          this.create({
            id: o,
            type: "success",
            description: g,
            ...b
          });
        }
      }).catch(async (u) => {
        if (a = [
          "reject",
          u
        ], r.error !== void 0) {
          i = false;
          const p = typeof r.error == "function" ? await r.error(u) : r.error, d = typeof r.description == "function" ? await r.description(u) : r.description, m = typeof p == "object" && !c__default.isValidElement(p) ? p : {
            message: p
          };
          this.create({
            id: o,
            type: "error",
            description: d,
            ...m
          });
        }
      }).finally(() => {
        i && (this.dismiss(o), o = void 0), r.finally == null || r.finally.call(r);
      }), f = () => new Promise((u, p) => l.then(() => a[0] === "reject" ? p(a[1]) : u(a[1])).catch(p));
      return typeof o != "string" && typeof o != "number" ? {
        unwrap: f
      } : Object.assign(o, {
        unwrap: f
      });
    }, this.custom = (n, r) => {
      const o = (r == null ? void 0 : r.id) || Zi++;
      return this.create({
        jsx: n(o),
        id: o,
        ...r
      }), o;
    }, this.getActiveToasts = () => this.toasts.filter((n) => !this.dismissedToasts.has(n.id)), this.subscribers = [], this.toasts = [], this.dismissedToasts = /* @__PURE__ */ new Set();
  }
}
const Ot = new sh(), ih = (e, n) => {
  const r = (n == null ? void 0 : n.id) || Zi++;
  return Ot.addToast({
    title: e,
    ...n,
    id: r
  }), r;
}, ah = (e) => e && typeof e == "object" && "ok" in e && typeof e.ok == "boolean" && "status" in e && typeof e.status == "number", lh = ih, ch = () => Ot.toasts, uh = () => Ot.getActiveToasts();
Object.assign(lh, {
  success: Ot.success,
  info: Ot.info,
  warning: Ot.warning,
  error: Ot.error,
  custom: Ot.custom,
  message: Ot.message,
  promise: Ot.promise,
  dismiss: Ot.dismiss,
  loading: Ot.loading
}, {
  getHistory: ch,
  getToasts: uh
});
qg("[data-sonner-toaster][dir=ltr],html[dir=ltr]{--toast-icon-margin-start:-3px;--toast-icon-margin-end:4px;--toast-svg-margin-start:-1px;--toast-svg-margin-end:0px;--toast-button-margin-start:auto;--toast-button-margin-end:0;--toast-close-button-start:0;--toast-close-button-end:unset;--toast-close-button-transform:translate(-35%, -35%)}[data-sonner-toaster][dir=rtl],html[dir=rtl]{--toast-icon-margin-start:4px;--toast-icon-margin-end:-3px;--toast-svg-margin-start:0px;--toast-svg-margin-end:-1px;--toast-button-margin-start:0;--toast-button-margin-end:auto;--toast-close-button-start:unset;--toast-close-button-end:0;--toast-close-button-transform:translate(35%, -35%)}[data-sonner-toaster]{position:fixed;width:var(--width);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji;--gray1:hsl(0, 0%, 99%);--gray2:hsl(0, 0%, 97.3%);--gray3:hsl(0, 0%, 95.1%);--gray4:hsl(0, 0%, 93%);--gray5:hsl(0, 0%, 90.9%);--gray6:hsl(0, 0%, 88.7%);--gray7:hsl(0, 0%, 85.8%);--gray8:hsl(0, 0%, 78%);--gray9:hsl(0, 0%, 56.1%);--gray10:hsl(0, 0%, 52.3%);--gray11:hsl(0, 0%, 43.5%);--gray12:hsl(0, 0%, 9%);--border-radius:8px;box-sizing:border-box;padding:0;margin:0;list-style:none;outline:0;z-index:999999999;transition:transform .4s ease}@media (hover:none) and (pointer:coarse){[data-sonner-toaster][data-lifted=true]{transform:none}}[data-sonner-toaster][data-x-position=right]{right:var(--offset-right)}[data-sonner-toaster][data-x-position=left]{left:var(--offset-left)}[data-sonner-toaster][data-x-position=center]{left:50%;transform:translateX(-50%)}[data-sonner-toaster][data-y-position=top]{top:var(--offset-top)}[data-sonner-toaster][data-y-position=bottom]{bottom:var(--offset-bottom)}[data-sonner-toast]{--y:translateY(100%);--lift-amount:calc(var(--lift) * var(--gap));z-index:var(--z-index);position:absolute;opacity:0;transform:var(--y);touch-action:none;transition:transform .4s,opacity .4s,height .4s,box-shadow .2s;box-sizing:border-box;outline:0;overflow-wrap:anywhere}[data-sonner-toast][data-styled=true]{padding:16px;background:var(--normal-bg);border:1px solid var(--normal-border);color:var(--normal-text);border-radius:var(--border-radius);box-shadow:0 4px 12px rgba(0,0,0,.1);width:var(--width);font-size:13px;display:flex;align-items:center;gap:6px}[data-sonner-toast]:focus-visible{box-shadow:0 4px 12px rgba(0,0,0,.1),0 0 0 2px rgba(0,0,0,.2)}[data-sonner-toast][data-y-position=top]{top:0;--y:translateY(-100%);--lift:1;--lift-amount:calc(1 * var(--gap))}[data-sonner-toast][data-y-position=bottom]{bottom:0;--y:translateY(100%);--lift:-1;--lift-amount:calc(var(--lift) * var(--gap))}[data-sonner-toast][data-styled=true] [data-description]{font-weight:400;line-height:1.4;color:#3f3f3f}[data-rich-colors=true][data-sonner-toast][data-styled=true] [data-description]{color:inherit}[data-sonner-toaster][data-sonner-theme=dark] [data-description]{color:#e8e8e8}[data-sonner-toast][data-styled=true] [data-title]{font-weight:500;line-height:1.5;color:inherit}[data-sonner-toast][data-styled=true] [data-icon]{display:flex;height:16px;width:16px;position:relative;justify-content:flex-start;align-items:center;flex-shrink:0;margin-left:var(--toast-icon-margin-start);margin-right:var(--toast-icon-margin-end)}[data-sonner-toast][data-promise=true] [data-icon]>svg{opacity:0;transform:scale(.8);transform-origin:center;animation:sonner-fade-in .3s ease forwards}[data-sonner-toast][data-styled=true] [data-icon]>*{flex-shrink:0}[data-sonner-toast][data-styled=true] [data-icon] svg{margin-left:var(--toast-svg-margin-start);margin-right:var(--toast-svg-margin-end)}[data-sonner-toast][data-styled=true] [data-content]{display:flex;flex-direction:column;gap:2px}[data-sonner-toast][data-styled=true] [data-button]{border-radius:4px;padding-left:8px;padding-right:8px;height:24px;font-size:12px;color:var(--normal-bg);background:var(--normal-text);margin-left:var(--toast-button-margin-start);margin-right:var(--toast-button-margin-end);border:none;font-weight:500;cursor:pointer;outline:0;display:flex;align-items:center;flex-shrink:0;transition:opacity .4s,box-shadow .2s}[data-sonner-toast][data-styled=true] [data-button]:focus-visible{box-shadow:0 0 0 2px rgba(0,0,0,.4)}[data-sonner-toast][data-styled=true] [data-button]:first-of-type{margin-left:var(--toast-button-margin-start);margin-right:var(--toast-button-margin-end)}[data-sonner-toast][data-styled=true] [data-cancel]{color:var(--normal-text);background:rgba(0,0,0,.08)}[data-sonner-toaster][data-sonner-theme=dark] [data-sonner-toast][data-styled=true] [data-cancel]{background:rgba(255,255,255,.3)}[data-sonner-toast][data-styled=true] [data-close-button]{position:absolute;left:var(--toast-close-button-start);right:var(--toast-close-button-end);top:0;height:20px;width:20px;display:flex;justify-content:center;align-items:center;padding:0;color:var(--gray12);background:var(--normal-bg);border:1px solid var(--gray4);transform:var(--toast-close-button-transform);border-radius:50%;cursor:pointer;z-index:1;transition:opacity .1s,background .2s,border-color .2s}[data-sonner-toast][data-styled=true] [data-close-button]:focus-visible{box-shadow:0 4px 12px rgba(0,0,0,.1),0 0 0 2px rgba(0,0,0,.2)}[data-sonner-toast][data-styled=true] [data-disabled=true]{cursor:not-allowed}[data-sonner-toast][data-styled=true]:hover [data-close-button]:hover{background:var(--gray2);border-color:var(--gray5)}[data-sonner-toast][data-swiping=true]::before{content:'';position:absolute;left:-100%;right:-100%;height:100%;z-index:-1}[data-sonner-toast][data-y-position=top][data-swiping=true]::before{bottom:50%;transform:scaleY(3) translateY(50%)}[data-sonner-toast][data-y-position=bottom][data-swiping=true]::before{top:50%;transform:scaleY(3) translateY(-50%)}[data-sonner-toast][data-swiping=false][data-removed=true]::before{content:'';position:absolute;inset:0;transform:scaleY(2)}[data-sonner-toast][data-expanded=true]::after{content:'';position:absolute;left:0;height:calc(var(--gap) + 1px);bottom:100%;width:100%}[data-sonner-toast][data-mounted=true]{--y:translateY(0);opacity:1}[data-sonner-toast][data-expanded=false][data-front=false]{--scale:var(--toasts-before) * 0.05 + 1;--y:translateY(calc(var(--lift-amount) * var(--toasts-before))) scale(calc(-1 * var(--scale)));height:var(--front-toast-height)}[data-sonner-toast]>*{transition:opacity .4s}[data-sonner-toast][data-x-position=right]{right:0}[data-sonner-toast][data-x-position=left]{left:0}[data-sonner-toast][data-expanded=false][data-front=false][data-styled=true]>*{opacity:0}[data-sonner-toast][data-visible=false]{opacity:0;pointer-events:none}[data-sonner-toast][data-mounted=true][data-expanded=true]{--y:translateY(calc(var(--lift) * var(--offset)));height:var(--initial-height)}[data-sonner-toast][data-removed=true][data-front=true][data-swipe-out=false]{--y:translateY(calc(var(--lift) * -100%));opacity:0}[data-sonner-toast][data-removed=true][data-front=false][data-swipe-out=false][data-expanded=true]{--y:translateY(calc(var(--lift) * var(--offset) + var(--lift) * -100%));opacity:0}[data-sonner-toast][data-removed=true][data-front=false][data-swipe-out=false][data-expanded=false]{--y:translateY(40%);opacity:0;transition:transform .5s,opacity .2s}[data-sonner-toast][data-removed=true][data-front=false]::before{height:calc(var(--initial-height) + 20%)}[data-sonner-toast][data-swiping=true]{transform:var(--y) translateY(var(--swipe-amount-y,0)) translateX(var(--swipe-amount-x,0));transition:none}[data-sonner-toast][data-swiped=true]{user-select:none}[data-sonner-toast][data-swipe-out=true][data-y-position=bottom],[data-sonner-toast][data-swipe-out=true][data-y-position=top]{animation-duration:.2s;animation-timing-function:ease-out;animation-fill-mode:forwards}[data-sonner-toast][data-swipe-out=true][data-swipe-direction=left]{animation-name:swipe-out-left}[data-sonner-toast][data-swipe-out=true][data-swipe-direction=right]{animation-name:swipe-out-right}[data-sonner-toast][data-swipe-out=true][data-swipe-direction=up]{animation-name:swipe-out-up}[data-sonner-toast][data-swipe-out=true][data-swipe-direction=down]{animation-name:swipe-out-down}@keyframes swipe-out-left{from{transform:var(--y) translateX(var(--swipe-amount-x));opacity:1}to{transform:var(--y) translateX(calc(var(--swipe-amount-x) - 100%));opacity:0}}@keyframes swipe-out-right{from{transform:var(--y) translateX(var(--swipe-amount-x));opacity:1}to{transform:var(--y) translateX(calc(var(--swipe-amount-x) + 100%));opacity:0}}@keyframes swipe-out-up{from{transform:var(--y) translateY(var(--swipe-amount-y));opacity:1}to{transform:var(--y) translateY(calc(var(--swipe-amount-y) - 100%));opacity:0}}@keyframes swipe-out-down{from{transform:var(--y) translateY(var(--swipe-amount-y));opacity:1}to{transform:var(--y) translateY(calc(var(--swipe-amount-y) + 100%));opacity:0}}@media (max-width:600px){[data-sonner-toaster]{position:fixed;right:var(--mobile-offset-right);left:var(--mobile-offset-left);width:100%}[data-sonner-toaster][dir=rtl]{left:calc(var(--mobile-offset-left) * -1)}[data-sonner-toaster] [data-sonner-toast]{left:0;right:0;width:calc(100% - var(--mobile-offset-left) * 2)}[data-sonner-toaster][data-x-position=left]{left:var(--mobile-offset-left)}[data-sonner-toaster][data-y-position=bottom]{bottom:var(--mobile-offset-bottom)}[data-sonner-toaster][data-y-position=top]{top:var(--mobile-offset-top)}[data-sonner-toaster][data-x-position=center]{left:var(--mobile-offset-left);right:var(--mobile-offset-right);transform:none}}[data-sonner-toaster][data-sonner-theme=light]{--normal-bg:#fff;--normal-border:var(--gray4);--normal-text:var(--gray12);--success-bg:hsl(143, 85%, 96%);--success-border:hsl(145, 92%, 87%);--success-text:hsl(140, 100%, 27%);--info-bg:hsl(208, 100%, 97%);--info-border:hsl(221, 91%, 93%);--info-text:hsl(210, 92%, 45%);--warning-bg:hsl(49, 100%, 97%);--warning-border:hsl(49, 91%, 84%);--warning-text:hsl(31, 92%, 45%);--error-bg:hsl(359, 100%, 97%);--error-border:hsl(359, 100%, 94%);--error-text:hsl(360, 100%, 45%)}[data-sonner-toaster][data-sonner-theme=light] [data-sonner-toast][data-invert=true]{--normal-bg:#000;--normal-border:hsl(0, 0%, 20%);--normal-text:var(--gray1)}[data-sonner-toaster][data-sonner-theme=dark] [data-sonner-toast][data-invert=true]{--normal-bg:#fff;--normal-border:var(--gray3);--normal-text:var(--gray12)}[data-sonner-toaster][data-sonner-theme=dark]{--normal-bg:#000;--normal-bg-hover:hsl(0, 0%, 12%);--normal-border:hsl(0, 0%, 20%);--normal-border-hover:hsl(0, 0%, 25%);--normal-text:var(--gray1);--success-bg:hsl(150, 100%, 6%);--success-border:hsl(147, 100%, 12%);--success-text:hsl(150, 86%, 65%);--info-bg:hsl(215, 100%, 6%);--info-border:hsl(223, 43%, 17%);--info-text:hsl(216, 87%, 65%);--warning-bg:hsl(64, 100%, 6%);--warning-border:hsl(60, 100%, 9%);--warning-text:hsl(46, 87%, 65%);--error-bg:hsl(358, 76%, 10%);--error-border:hsl(357, 89%, 16%);--error-text:hsl(358, 100%, 81%)}[data-sonner-toaster][data-sonner-theme=dark] [data-sonner-toast] [data-close-button]{background:var(--normal-bg);border-color:var(--normal-border);color:var(--normal-text)}[data-sonner-toaster][data-sonner-theme=dark] [data-sonner-toast] [data-close-button]:hover{background:var(--normal-bg-hover);border-color:var(--normal-border-hover)}[data-rich-colors=true][data-sonner-toast][data-type=success]{background:var(--success-bg);border-color:var(--success-border);color:var(--success-text)}[data-rich-colors=true][data-sonner-toast][data-type=success] [data-close-button]{background:var(--success-bg);border-color:var(--success-border);color:var(--success-text)}[data-rich-colors=true][data-sonner-toast][data-type=info]{background:var(--info-bg);border-color:var(--info-border);color:var(--info-text)}[data-rich-colors=true][data-sonner-toast][data-type=info] [data-close-button]{background:var(--info-bg);border-color:var(--info-border);color:var(--info-text)}[data-rich-colors=true][data-sonner-toast][data-type=warning]{background:var(--warning-bg);border-color:var(--warning-border);color:var(--warning-text)}[data-rich-colors=true][data-sonner-toast][data-type=warning] [data-close-button]{background:var(--warning-bg);border-color:var(--warning-border);color:var(--warning-text)}[data-rich-colors=true][data-sonner-toast][data-type=error]{background:var(--error-bg);border-color:var(--error-border);color:var(--error-text)}[data-rich-colors=true][data-sonner-toast][data-type=error] [data-close-button]{background:var(--error-bg);border-color:var(--error-border);color:var(--error-text)}.sonner-loading-wrapper{--size:16px;height:var(--size);width:var(--size);position:absolute;inset:0;z-index:10}.sonner-loading-wrapper[data-visible=false]{transform-origin:center;animation:sonner-fade-out .2s ease forwards}.sonner-spinner{position:relative;top:50%;left:50%;height:var(--size);width:var(--size)}.sonner-loading-bar{animation:sonner-spin 1.2s linear infinite;background:var(--gray11);border-radius:6px;height:8%;left:-10%;position:absolute;top:-3.9%;width:24%}.sonner-loading-bar:first-child{animation-delay:-1.2s;transform:rotate(.0001deg) translate(146%)}.sonner-loading-bar:nth-child(2){animation-delay:-1.1s;transform:rotate(30deg) translate(146%)}.sonner-loading-bar:nth-child(3){animation-delay:-1s;transform:rotate(60deg) translate(146%)}.sonner-loading-bar:nth-child(4){animation-delay:-.9s;transform:rotate(90deg) translate(146%)}.sonner-loading-bar:nth-child(5){animation-delay:-.8s;transform:rotate(120deg) translate(146%)}.sonner-loading-bar:nth-child(6){animation-delay:-.7s;transform:rotate(150deg) translate(146%)}.sonner-loading-bar:nth-child(7){animation-delay:-.6s;transform:rotate(180deg) translate(146%)}.sonner-loading-bar:nth-child(8){animation-delay:-.5s;transform:rotate(210deg) translate(146%)}.sonner-loading-bar:nth-child(9){animation-delay:-.4s;transform:rotate(240deg) translate(146%)}.sonner-loading-bar:nth-child(10){animation-delay:-.3s;transform:rotate(270deg) translate(146%)}.sonner-loading-bar:nth-child(11){animation-delay:-.2s;transform:rotate(300deg) translate(146%)}.sonner-loading-bar:nth-child(12){animation-delay:-.1s;transform:rotate(330deg) translate(146%)}@keyframes sonner-fade-in{0%{opacity:0;transform:scale(.8)}100%{opacity:1;transform:scale(1)}}@keyframes sonner-fade-out{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.8)}}@keyframes sonner-spin{0%{opacity:1}100%{opacity:.15}}@media (prefers-reduced-motion){.sonner-loading-bar,[data-sonner-toast],[data-sonner-toast]>*{transition:none!important;animation:none!important}}.sonner-loader{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);transform-origin:center;transition:opacity .2s,transform .2s}.sonner-loader[data-visible=false]{opacity:0;transform:scale(.8) translate(-50%,-50%)}");
function Td(e) {
  var n, r, o = "";
  if (typeof e == "string" || typeof e == "number") o += e;
  else if (typeof e == "object") if (Array.isArray(e)) {
    var s = e.length;
    for (n = 0; n < s; n++) e[n] && (r = Td(e[n])) && (o && (o += " "), o += r);
  } else for (r in e) e[r] && (o && (o += " "), o += r);
  return o;
}
function kd() {
  for (var e, n, r = 0, o = "", s = arguments.length; r < s; r++) (e = arguments[r]) && (n = Td(e)) && (o && (o += " "), o += n);
  return o;
}
const Tc = (e) => typeof e == "boolean" ? `${e}` : e === 0 ? "0" : e, kc = kd, wr = (e, n) => (r) => {
  var o;
  if ((n == null ? void 0 : n.variants) == null) return kc(e, r == null ? void 0 : r.class, r == null ? void 0 : r.className);
  const { variants: s, defaultVariants: i } = n, a = Object.keys(s).map((u) => {
    const p = r == null ? void 0 : r[u], d = i == null ? void 0 : i[u];
    if (p === null) return null;
    const g = Tc(p) || Tc(d);
    return s[u][g];
  }), l = r && Object.entries(r).reduce((u, p) => {
    let [d, g] = p;
    return g === void 0 || (u[d] = g), u;
  }, {}), f = n == null || (o = n.compoundVariants) === null || o === void 0 ? void 0 : o.reduce((u, p) => {
    let { class: d, className: g, ...m } = p;
    return Object.entries(m).every((b) => {
      let [h, v] = b;
      return Array.isArray(v) ? v.includes({
        ...i,
        ...l
      }[h]) : {
        ...i,
        ...l
      }[h] === v;
    }) ? [
      ...u,
      d,
      g
    ] : u;
  }, []);
  return kc(e, a, f, r == null ? void 0 : r.class, r == null ? void 0 : r.className);
};
const wh = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), Eh = (e) => e.replace(
  /^([A-Z])|[\s-_]+(\w)/g,
  (n, r, o) => o ? o.toUpperCase() : r.toLowerCase()
), Oc = (e) => {
  const n = Eh(e);
  return n.charAt(0).toUpperCase() + n.slice(1);
}, Od = (...e) => e.filter((n, r, o) => !!n && n.trim() !== "" && o.indexOf(n) === r).join(" ").trim(), Ch = (e) => {
  for (const n in e)
    if (n.startsWith("aria-") || n === "role" || n === "title")
      return true;
};
var Sh = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};
const Rh = forwardRef(
  ({
    color: e = "currentColor",
    size: n = 24,
    strokeWidth: r = 2,
    absoluteStrokeWidth: o,
    className: s = "",
    children: i,
    iconNode: a,
    ...l
  }, f) => createElement(
    "svg",
    {
      ref: f,
      ...Sh,
      width: n,
      height: n,
      stroke: e,
      strokeWidth: o ? Number(r) * 24 / Number(n) : r,
      className: Od("lucide", s),
      ...!i && !Ch(l) && { "aria-hidden": "true" },
      ...l
    },
    [
      ...a.map(([u, p]) => createElement(u, p)),
      ...Array.isArray(i) ? i : [i]
    ]
  )
);
const it = (e, n) => {
  const r = forwardRef(
    ({ className: o, ...s }, i) => createElement(Rh, {
      ref: i,
      iconNode: n,
      className: Od(
        `lucide-${wh(Oc(e))}`,
        `lucide-${e}`,
        o
      ),
      ...s
    })
  );
  return r.displayName = Oc(e), r;
};
const Nh = [
  ["path", { d: "m12 19-7-7 7-7", key: "1l729n" }],
  ["path", { d: "M19 12H5", key: "x3x0zl" }]
], Id = it("arrow-left", Nh);
const Th = [
  ["path", { d: "M5 12h14", key: "1ays0h" }],
  ["path", { d: "m12 5 7 7-7 7", key: "xquz4c" }]
], kh = it("arrow-right", Th);
const Oh = [
  ["rect", { width: "16", height: "20", x: "4", y: "2", rx: "2", key: "1nb95v" }],
  ["line", { x1: "8", x2: "16", y1: "6", y2: "6", key: "x4nwl0" }],
  ["line", { x1: "16", x2: "16", y1: "14", y2: "18", key: "wjye3r" }],
  ["path", { d: "M16 10h.01", key: "1m94wz" }],
  ["path", { d: "M12 10h.01", key: "1nrarc" }],
  ["path", { d: "M8 10h.01", key: "19clt8" }],
  ["path", { d: "M12 14h.01", key: "1etili" }],
  ["path", { d: "M8 14h.01", key: "6423bh" }],
  ["path", { d: "M12 18h.01", key: "mhygvu" }],
  ["path", { d: "M8 18h.01", key: "lrp35t" }]
];
it("calculator", Oh);
const Ph = [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]], ps = it("check", Ph);
const Mh = [["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]], La = it("chevron-down", Mh);
const Dh = [["path", { d: "m15 18-6-6 6-6", key: "1wnfg3" }]], Qi = it("chevron-left", Dh);
const Ah = [["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }]], ea = it("chevron-right", Ah);
const Lh = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["line", { x1: "12", x2: "12", y1: "8", y2: "12", key: "1pkeuh" }],
  ["line", { x1: "12", x2: "12.01", y1: "16", y2: "16", key: "4dfq90" }]
], Pd = it("circle-alert", Lh);
const Fh = [
  ["path", { d: "M21.801 10A10 10 0 1 1 17 3.335", key: "yps3ct" }],
  ["path", { d: "m9 11 3 3L22 4", key: "1pflzl" }]
], _h = it("circle-check-big", Fh);
const Vh = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }]
], Bh = it("circle-check", Vh);
const $h = [["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]], zh = it("circle", $h);
const Hh = [
  ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2", key: "17jyea" }],
  ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2", key: "zix9uf" }]
];
it("copy", Hh);
const Wh = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["path", { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20", key: "13o1zl" }],
  ["path", { d: "M2 12h20", key: "9i4pu4" }]
], jh = it("globe", Wh);
const Kh = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["path", { d: "M12 16v-4", key: "1dtifu" }],
  ["path", { d: "M12 8h.01", key: "e9boi3" }]
], Gh = it("info", Kh);
const Yh = [["path", { d: "M21 12a9 9 0 1 1-6.219-8.56", key: "13zald" }]], qh = it("loader-circle", Yh);
const Xh = [
  [
    "path",
    {
      d: "M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719",
      key: "1sd12s"
    }
  ]
], Jh = it("message-circle", Xh);
const Zh = [["path", { d: "M5 12h14", key: "1ays0h" }]];
it("minus", Zh);
const eb = [
  [
    "path",
    {
      d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
      key: "1a8usu"
    }
  ],
  ["path", { d: "m15 5 4 4", key: "1mk7zo" }]
];
it("pencil", eb);
const nb = [
  ["path", { d: "M5 12h14", key: "1ays0h" }],
  ["path", { d: "M12 5v14", key: "s699le" }]
];
it("plus", nb);
const rb = [
  ["path", { d: "M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", key: "14sxne" }],
  ["path", { d: "M3 3v5h5", key: "1xhq8a" }],
  ["path", { d: "M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16", key: "1hlbsb" }],
  ["path", { d: "M16 16h5v5", key: "ccwih5" }]
];
it("refresh-ccw", rb);
const sb = [
  [
    "path",
    {
      d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
      key: "1c8476"
    }
  ],
  ["path", { d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7", key: "1ydtos" }],
  ["path", { d: "M7 3v4a1 1 0 0 0 1 1h7", key: "t51u73" }]
];
it("save", sb);
const ab = [
  ["path", { d: "m21 21-4.34-4.34", key: "14j7rj" }],
  ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }]
], Dd = it("search", ab);
const lb = [
  ["path", { d: "M10 11v6", key: "nco0om" }],
  ["path", { d: "M14 11v6", key: "outv1u" }],
  ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", key: "miytrc" }],
  ["path", { d: "M3 6h18", key: "d0wm0j" }],
  ["path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", key: "e791ji" }]
];
it("trash-2", lb);
const ub = [
  [
    "path",
    {
      d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
      key: "wmoenq"
    }
  ],
  ["path", { d: "M12 9v4", key: "juzpu7" }],
  ["path", { d: "M12 17h.01", key: "p32p05" }]
], db = it("triangle-alert", ub);
const fb = [
  ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
  ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
], Er = it("x", fb), pb = (e, n) => {
  const r = new Array(e.length + n.length);
  for (let o = 0; o < e.length; o++)
    r[o] = e[o];
  for (let o = 0; o < n.length; o++)
    r[e.length + o] = n[o];
  return r;
}, mb = (e, n) => ({
  classGroupId: e,
  validator: n
}), Ad = (e = /* @__PURE__ */ new Map(), n = null, r) => ({
  nextPart: e,
  validators: n,
  classGroupId: r
}), ms = "-", Ic = [], gb = "arbitrary..", hb = (e) => {
  const n = vb(e), {
    conflictingClassGroups: r,
    conflictingClassGroupModifiers: o
  } = e;
  return {
    getClassGroupId: (a) => {
      if (a.startsWith("[") && a.endsWith("]"))
        return bb(a);
      const l = a.split(ms), f = l[0] === "" && l.length > 1 ? 1 : 0;
      return Ld(l, f, n);
    },
    getConflictingClassGroupIds: (a, l) => {
      if (l) {
        const f = o[a], u = r[a];
        return f ? u ? pb(u, f) : f : u || Ic;
      }
      return r[a] || Ic;
    }
  };
}, Ld = (e, n, r) => {
  if (e.length - n === 0)
    return r.classGroupId;
  const s = e[n], i = r.nextPart.get(s);
  if (i) {
    const u = Ld(e, n + 1, i);
    if (u) return u;
  }
  const a = r.validators;
  if (a === null)
    return;
  const l = n === 0 ? e.join(ms) : e.slice(n).join(ms), f = a.length;
  for (let u = 0; u < f; u++) {
    const p = a[u];
    if (p.validator(l))
      return p.classGroupId;
  }
}, bb = (e) => e.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const n = e.slice(1, -1), r = n.indexOf(":"), o = n.slice(0, r);
  return o ? gb + o : void 0;
})(), vb = (e) => {
  const {
    theme: n,
    classGroups: r
  } = e;
  return yb(r, n);
}, yb = (e, n) => {
  const r = Ad();
  for (const o in e) {
    const s = e[o];
    Fa(s, r, o, n);
  }
  return r;
}, Fa = (e, n, r, o) => {
  const s = e.length;
  for (let i = 0; i < s; i++) {
    const a = e[i];
    xb(a, n, r, o);
  }
}, xb = (e, n, r, o) => {
  if (typeof e == "string") {
    wb(e, n, r);
    return;
  }
  if (typeof e == "function") {
    Eb(e, n, r, o);
    return;
  }
  Cb(e, n, r, o);
}, wb = (e, n, r) => {
  const o = e === "" ? n : Fd(n, e);
  o.classGroupId = r;
}, Eb = (e, n, r, o) => {
  if (Sb(e)) {
    Fa(e(o), n, r, o);
    return;
  }
  n.validators === null && (n.validators = []), n.validators.push(mb(r, e));
}, Cb = (e, n, r, o) => {
  const s = Object.entries(e), i = s.length;
  for (let a = 0; a < i; a++) {
    const [l, f] = s[a];
    Fa(f, Fd(n, l), r, o);
  }
}, Fd = (e, n) => {
  let r = e;
  const o = n.split(ms), s = o.length;
  for (let i = 0; i < s; i++) {
    const a = o[i];
    let l = r.nextPart.get(a);
    l || (l = Ad(), r.nextPart.set(a, l)), r = l;
  }
  return r;
}, Sb = (e) => "isThemeGetter" in e && e.isThemeGetter === true, Rb = (e) => {
  if (e < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let n = 0, r = /* @__PURE__ */ Object.create(null), o = /* @__PURE__ */ Object.create(null);
  const s = (i, a) => {
    r[i] = a, n++, n > e && (n = 0, o = r, r = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(i) {
      let a = r[i];
      if (a !== void 0)
        return a;
      if ((a = o[i]) !== void 0)
        return s(i, a), a;
    },
    set(i, a) {
      i in r ? r[i] = a : s(i, a);
    }
  };
}, ta = "!", Pc = ":", Nb = [], Mc = (e, n, r, o, s) => ({
  modifiers: e,
  hasImportantModifier: n,
  baseClassName: r,
  maybePostfixModifierPosition: o,
  isExternal: s
}), Tb = (e) => {
  const {
    prefix: n,
    experimentalParseClassName: r
  } = e;
  let o = (s) => {
    const i = [];
    let a = 0, l = 0, f = 0, u;
    const p = s.length;
    for (let h = 0; h < p; h++) {
      const v = s[h];
      if (a === 0 && l === 0) {
        if (v === Pc) {
          i.push(s.slice(f, h)), f = h + 1;
          continue;
        }
        if (v === "/") {
          u = h;
          continue;
        }
      }
      v === "[" ? a++ : v === "]" ? a-- : v === "(" ? l++ : v === ")" && l--;
    }
    const d = i.length === 0 ? s : s.slice(f);
    let g = d, m = false;
    d.endsWith(ta) ? (g = d.slice(0, -1), m = true) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      d.startsWith(ta) && (g = d.slice(1), m = true)
    );
    const b = u && u > f ? u - f : void 0;
    return Mc(i, m, g, b);
  };
  if (n) {
    const s = n + Pc, i = o;
    o = (a) => a.startsWith(s) ? i(a.slice(s.length)) : Mc(Nb, false, a, void 0, true);
  }
  if (r) {
    const s = o;
    o = (i) => r({
      className: i,
      parseClassName: s
    });
  }
  return o;
}, kb = (e) => {
  const n = /* @__PURE__ */ new Map();
  return e.orderSensitiveModifiers.forEach((r, o) => {
    n.set(r, 1e6 + o);
  }), (r) => {
    const o = [];
    let s = [];
    for (let i = 0; i < r.length; i++) {
      const a = r[i], l = a[0] === "[", f = n.has(a);
      l || f ? (s.length > 0 && (s.sort(), o.push(...s), s = []), o.push(a)) : s.push(a);
    }
    return s.length > 0 && (s.sort(), o.push(...s)), o;
  };
}, Ob = (e) => ({
  cache: Rb(e.cacheSize),
  parseClassName: Tb(e),
  sortModifiers: kb(e),
  ...hb(e)
}), Ib = /\s+/, Pb = (e, n) => {
  const {
    parseClassName: r,
    getClassGroupId: o,
    getConflictingClassGroupIds: s,
    sortModifiers: i
  } = n, a = [], l = e.trim().split(Ib);
  let f = "";
  for (let u = l.length - 1; u >= 0; u -= 1) {
    const p = l[u], {
      isExternal: d,
      modifiers: g,
      hasImportantModifier: m,
      baseClassName: b,
      maybePostfixModifierPosition: h
    } = r(p);
    if (d) {
      f = p + (f.length > 0 ? " " + f : f);
      continue;
    }
    let v = !!h, y = o(v ? b.substring(0, h) : b);
    if (!y) {
      if (!v) {
        f = p + (f.length > 0 ? " " + f : f);
        continue;
      }
      if (y = o(b), !y) {
        f = p + (f.length > 0 ? " " + f : f);
        continue;
      }
      v = false;
    }
    const x = g.length === 0 ? "" : g.length === 1 ? g[0] : i(g).join(":"), R = m ? x + ta : x, S = R + y;
    if (a.indexOf(S) > -1)
      continue;
    a.push(S);
    const E = s(y, v);
    for (let C = 0; C < E.length; ++C) {
      const T = E[C];
      a.push(R + T);
    }
    f = p + (f.length > 0 ? " " + f : f);
  }
  return f;
}, Mb = (...e) => {
  let n = 0, r, o, s = "";
  for (; n < e.length; )
    (r = e[n++]) && (o = _d(r)) && (s && (s += " "), s += o);
  return s;
}, _d = (e) => {
  if (typeof e == "string")
    return e;
  let n, r = "";
  for (let o = 0; o < e.length; o++)
    e[o] && (n = _d(e[o])) && (r && (r += " "), r += n);
  return r;
}, Db = (e, ...n) => {
  let r, o, s, i;
  const a = (f) => {
    const u = n.reduce((p, d) => d(p), e());
    return r = Ob(u), o = r.cache.get, s = r.cache.set, i = l, l(f);
  }, l = (f) => {
    const u = o(f);
    if (u)
      return u;
    const p = Pb(f, r);
    return s(f, p), p;
  };
  return i = a, (...f) => i(Mb(...f));
}, Ab = [], bt = (e) => {
  const n = (r) => r[e] || Ab;
  return n.isThemeGetter = true, n;
}, Vd = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Bd = /^\((?:(\w[\w-]*):)?(.+)\)$/i, Lb = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, Fb = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, _b = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, Vb = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/, Bb = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, $b = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, vn = (e) => Lb.test(e), Ae = (e) => !!e && !Number.isNaN(Number(e)), yn = (e) => !!e && Number.isInteger(Number(e)), hi = (e) => e.endsWith("%") && Ae(e.slice(0, -1)), an = (e) => Fb.test(e), $d = () => true, zb = (e) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  _b.test(e) && !Vb.test(e)
), _a = () => false, Hb = (e) => Bb.test(e), Ub = (e) => $b.test(e), Wb = (e) => !be(e) && !ve(e), jb = (e) => Pn(e, Ud, _a), be = (e) => Vd.test(e), zn = (e) => Pn(e, Wd, zb), Dc = (e) => Pn(e, Qb, Ae), Kb = (e) => Pn(e, Kd, $d), Gb = (e) => Pn(e, jd, _a), Ac = (e) => Pn(e, zd, _a), Yb = (e) => Pn(e, Hd, Ub), Po = (e) => Pn(e, Gd, Hb), ve = (e) => Bd.test(e), Or = (e) => Qn(e, Wd), qb = (e) => Qn(e, jd), Lc = (e) => Qn(e, zd), Xb = (e) => Qn(e, Ud), Jb = (e) => Qn(e, Hd), Mo = (e) => Qn(e, Gd, true), Zb = (e) => Qn(e, Kd, true), Pn = (e, n, r) => {
  const o = Vd.exec(e);
  return o ? o[1] ? n(o[1]) : r(o[2]) : false;
}, Qn = (e, n, r = false) => {
  const o = Bd.exec(e);
  return o ? o[1] ? n(o[1]) : r : false;
}, zd = (e) => e === "position" || e === "percentage", Hd = (e) => e === "image" || e === "url", Ud = (e) => e === "length" || e === "size" || e === "bg-size", Wd = (e) => e === "length", Qb = (e) => e === "number", jd = (e) => e === "family-name", Kd = (e) => e === "number" || e === "weight", Gd = (e) => e === "shadow", ev = () => {
  const e = bt("color"), n = bt("font"), r = bt("text"), o = bt("font-weight"), s = bt("tracking"), i = bt("leading"), a = bt("breakpoint"), l = bt("container"), f = bt("spacing"), u = bt("radius"), p = bt("shadow"), d = bt("inset-shadow"), g = bt("text-shadow"), m = bt("drop-shadow"), b = bt("blur"), h = bt("perspective"), v = bt("aspect"), y = bt("ease"), x = bt("animate"), R = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], S = () => [
    "center",
    "top",
    "bottom",
    "left",
    "right",
    "top-left",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "left-top",
    "top-right",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "right-top",
    "bottom-right",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "right-bottom",
    "bottom-left",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "left-bottom"
  ], E = () => [...S(), ve, be], C = () => ["auto", "hidden", "clip", "visible", "scroll"], T = () => ["auto", "contain", "none"], N = () => [ve, be, f], I = () => [vn, "full", "auto", ...N()], L = () => [yn, "none", "subgrid", ve, be], A = () => ["auto", {
    span: ["full", yn, ve, be]
  }, yn, ve, be], P = () => [yn, "auto", ve, be], O = () => ["auto", "min", "max", "fr", ve, be], M = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], D = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], _ = () => ["auto", ...N()], k = () => [vn, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...N()], $ = () => [vn, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...N()], F = () => [vn, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...N()], z = () => [e, ve, be], Q = () => [...S(), Lc, Ac, {
    position: [ve, be]
  }], B = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], G = () => ["auto", "cover", "contain", Xb, jb, {
    size: [ve, be]
  }], j = () => [hi, Or, zn], W = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    u,
    ve,
    be
  ], H = () => ["", Ae, Or, zn], te = () => ["solid", "dashed", "dotted", "double"], J = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], oe = () => [Ae, hi, Lc, Ac], ae = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    b,
    ve,
    be
  ], ue = () => ["none", Ae, ve, be], fe = () => ["none", Ae, ve, be], le = () => [Ae, ve, be], se = () => [vn, "full", ...N()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [an],
      breakpoint: [an],
      color: [$d],
      container: [an],
      "drop-shadow": [an],
      ease: ["in", "out", "in-out"],
      font: [Wb],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [an],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [an],
      shadow: [an],
      spacing: ["px", Ae],
      text: [an],
      "text-shadow": [an],
      tracking: ["tighter", "tight", "normal", "wide", "wider", "widest"]
    },
    classGroups: {
      // --------------
      // --- Layout ---
      // --------------
      /**
       * Aspect Ratio
       * @see https://tailwindcss.com/docs/aspect-ratio
       */
      aspect: [{
        aspect: ["auto", "square", vn, be, ve, v]
      }],
      /**
       * Container
       * @see https://tailwindcss.com/docs/container
       * @deprecated since Tailwind CSS v4.0.0
       */
      container: ["container"],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [Ae, be, ve, l]
      }],
      /**
       * Break After
       * @see https://tailwindcss.com/docs/break-after
       */
      "break-after": [{
        "break-after": R()
      }],
      /**
       * Break Before
       * @see https://tailwindcss.com/docs/break-before
       */
      "break-before": [{
        "break-before": R()
      }],
      /**
       * Break Inside
       * @see https://tailwindcss.com/docs/break-inside
       */
      "break-inside": [{
        "break-inside": ["auto", "avoid", "avoid-page", "avoid-column"]
      }],
      /**
       * Box Decoration Break
       * @see https://tailwindcss.com/docs/box-decoration-break
       */
      "box-decoration": [{
        "box-decoration": ["slice", "clone"]
      }],
      /**
       * Box Sizing
       * @see https://tailwindcss.com/docs/box-sizing
       */
      box: [{
        box: ["border", "content"]
      }],
      /**
       * Display
       * @see https://tailwindcss.com/docs/display
       */
      display: ["block", "inline-block", "inline", "flex", "inline-flex", "table", "inline-table", "table-caption", "table-cell", "table-column", "table-column-group", "table-footer-group", "table-header-group", "table-row-group", "table-row", "flow-root", "grid", "inline-grid", "contents", "list-item", "hidden"],
      /**
       * Screen Reader Only
       * @see https://tailwindcss.com/docs/display#screen-reader-only
       */
      sr: ["sr-only", "not-sr-only"],
      /**
       * Floats
       * @see https://tailwindcss.com/docs/float
       */
      float: [{
        float: ["right", "left", "none", "start", "end"]
      }],
      /**
       * Clear
       * @see https://tailwindcss.com/docs/clear
       */
      clear: [{
        clear: ["left", "right", "both", "none", "start", "end"]
      }],
      /**
       * Isolation
       * @see https://tailwindcss.com/docs/isolation
       */
      isolation: ["isolate", "isolation-auto"],
      /**
       * Object Fit
       * @see https://tailwindcss.com/docs/object-fit
       */
      "object-fit": [{
        object: ["contain", "cover", "fill", "none", "scale-down"]
      }],
      /**
       * Object Position
       * @see https://tailwindcss.com/docs/object-position
       */
      "object-position": [{
        object: E()
      }],
      /**
       * Overflow
       * @see https://tailwindcss.com/docs/overflow
       */
      overflow: [{
        overflow: C()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": C()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": C()
      }],
      /**
       * Overscroll Behavior
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      overscroll: [{
        overscroll: T()
      }],
      /**
       * Overscroll Behavior X
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-x": [{
        "overscroll-x": T()
      }],
      /**
       * Overscroll Behavior Y
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-y": [{
        "overscroll-y": T()
      }],
      /**
       * Position
       * @see https://tailwindcss.com/docs/position
       */
      position: ["static", "fixed", "absolute", "relative", "sticky"],
      /**
       * Inset
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      inset: [{
        inset: I()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": I()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": I()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": I(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: I()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": I(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: I()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": I()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": I()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: I()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: I()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: I()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: I()
      }],
      /**
       * Visibility
       * @see https://tailwindcss.com/docs/visibility
       */
      visibility: ["visible", "invisible", "collapse"],
      /**
       * Z-Index
       * @see https://tailwindcss.com/docs/z-index
       */
      z: [{
        z: [yn, "auto", ve, be]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [vn, "full", "auto", l, ...N()]
      }],
      /**
       * Flex Direction
       * @see https://tailwindcss.com/docs/flex-direction
       */
      "flex-direction": [{
        flex: ["row", "row-reverse", "col", "col-reverse"]
      }],
      /**
       * Flex Wrap
       * @see https://tailwindcss.com/docs/flex-wrap
       */
      "flex-wrap": [{
        flex: ["nowrap", "wrap", "wrap-reverse"]
      }],
      /**
       * Flex
       * @see https://tailwindcss.com/docs/flex
       */
      flex: [{
        flex: [Ae, vn, "auto", "initial", "none", be]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", Ae, ve, be]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", Ae, ve, be]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [yn, "first", "last", "none", ve, be]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": L()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: A()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": P()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": P()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": L()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: A()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": P()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": P()
      }],
      /**
       * Grid Auto Flow
       * @see https://tailwindcss.com/docs/grid-auto-flow
       */
      "grid-flow": [{
        "grid-flow": ["row", "col", "dense", "row-dense", "col-dense"]
      }],
      /**
       * Grid Auto Columns
       * @see https://tailwindcss.com/docs/grid-auto-columns
       */
      "auto-cols": [{
        "auto-cols": O()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": O()
      }],
      /**
       * Gap
       * @see https://tailwindcss.com/docs/gap
       */
      gap: [{
        gap: N()
      }],
      /**
       * Gap X
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-x": [{
        "gap-x": N()
      }],
      /**
       * Gap Y
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-y": [{
        "gap-y": N()
      }],
      /**
       * Justify Content
       * @see https://tailwindcss.com/docs/justify-content
       */
      "justify-content": [{
        justify: [...M(), "normal"]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": [...D(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...D()]
      }],
      /**
       * Align Content
       * @see https://tailwindcss.com/docs/align-content
       */
      "align-content": [{
        content: ["normal", ...M()]
      }],
      /**
       * Align Items
       * @see https://tailwindcss.com/docs/align-items
       */
      "align-items": [{
        items: [...D(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...D(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Place Content
       * @see https://tailwindcss.com/docs/place-content
       */
      "place-content": [{
        "place-content": M()
      }],
      /**
       * Place Items
       * @see https://tailwindcss.com/docs/place-items
       */
      "place-items": [{
        "place-items": [...D(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...D()]
      }],
      // Spacing
      /**
       * Padding
       * @see https://tailwindcss.com/docs/padding
       */
      p: [{
        p: N()
      }],
      /**
       * Padding Inline
       * @see https://tailwindcss.com/docs/padding
       */
      px: [{
        px: N()
      }],
      /**
       * Padding Block
       * @see https://tailwindcss.com/docs/padding
       */
      py: [{
        py: N()
      }],
      /**
       * Padding Inline Start
       * @see https://tailwindcss.com/docs/padding
       */
      ps: [{
        ps: N()
      }],
      /**
       * Padding Inline End
       * @see https://tailwindcss.com/docs/padding
       */
      pe: [{
        pe: N()
      }],
      /**
       * Padding Block Start
       * @see https://tailwindcss.com/docs/padding
       */
      pbs: [{
        pbs: N()
      }],
      /**
       * Padding Block End
       * @see https://tailwindcss.com/docs/padding
       */
      pbe: [{
        pbe: N()
      }],
      /**
       * Padding Top
       * @see https://tailwindcss.com/docs/padding
       */
      pt: [{
        pt: N()
      }],
      /**
       * Padding Right
       * @see https://tailwindcss.com/docs/padding
       */
      pr: [{
        pr: N()
      }],
      /**
       * Padding Bottom
       * @see https://tailwindcss.com/docs/padding
       */
      pb: [{
        pb: N()
      }],
      /**
       * Padding Left
       * @see https://tailwindcss.com/docs/padding
       */
      pl: [{
        pl: N()
      }],
      /**
       * Margin
       * @see https://tailwindcss.com/docs/margin
       */
      m: [{
        m: _()
      }],
      /**
       * Margin Inline
       * @see https://tailwindcss.com/docs/margin
       */
      mx: [{
        mx: _()
      }],
      /**
       * Margin Block
       * @see https://tailwindcss.com/docs/margin
       */
      my: [{
        my: _()
      }],
      /**
       * Margin Inline Start
       * @see https://tailwindcss.com/docs/margin
       */
      ms: [{
        ms: _()
      }],
      /**
       * Margin Inline End
       * @see https://tailwindcss.com/docs/margin
       */
      me: [{
        me: _()
      }],
      /**
       * Margin Block Start
       * @see https://tailwindcss.com/docs/margin
       */
      mbs: [{
        mbs: _()
      }],
      /**
       * Margin Block End
       * @see https://tailwindcss.com/docs/margin
       */
      mbe: [{
        mbe: _()
      }],
      /**
       * Margin Top
       * @see https://tailwindcss.com/docs/margin
       */
      mt: [{
        mt: _()
      }],
      /**
       * Margin Right
       * @see https://tailwindcss.com/docs/margin
       */
      mr: [{
        mr: _()
      }],
      /**
       * Margin Bottom
       * @see https://tailwindcss.com/docs/margin
       */
      mb: [{
        mb: _()
      }],
      /**
       * Margin Left
       * @see https://tailwindcss.com/docs/margin
       */
      ml: [{
        ml: _()
      }],
      /**
       * Space Between X
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-x": [{
        "space-x": N()
      }],
      /**
       * Space Between X Reverse
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-x-reverse": ["space-x-reverse"],
      /**
       * Space Between Y
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-y": [{
        "space-y": N()
      }],
      /**
       * Space Between Y Reverse
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-y-reverse": ["space-y-reverse"],
      // --------------
      // --- Sizing ---
      // --------------
      /**
       * Size
       * @see https://tailwindcss.com/docs/width#setting-both-width-and-height
       */
      size: [{
        size: k()
      }],
      /**
       * Inline Size
       * @see https://tailwindcss.com/docs/width
       */
      "inline-size": [{
        inline: ["auto", ...$()]
      }],
      /**
       * Min-Inline Size
       * @see https://tailwindcss.com/docs/min-width
       */
      "min-inline-size": [{
        "min-inline": ["auto", ...$()]
      }],
      /**
       * Max-Inline Size
       * @see https://tailwindcss.com/docs/max-width
       */
      "max-inline-size": [{
        "max-inline": ["none", ...$()]
      }],
      /**
       * Block Size
       * @see https://tailwindcss.com/docs/height
       */
      "block-size": [{
        block: ["auto", ...F()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-block-size": [{
        "min-block": ["auto", ...F()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-block-size": [{
        "max-block": ["none", ...F()]
      }],
      /**
       * Width
       * @see https://tailwindcss.com/docs/width
       */
      w: [{
        w: [l, "screen", ...k()]
      }],
      /**
       * Min-Width
       * @see https://tailwindcss.com/docs/min-width
       */
      "min-w": [{
        "min-w": [
          l,
          "screen",
          /** Deprecated. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          "none",
          ...k()
        ]
      }],
      /**
       * Max-Width
       * @see https://tailwindcss.com/docs/max-width
       */
      "max-w": [{
        "max-w": [
          l,
          "screen",
          "none",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          "prose",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          {
            screen: [a]
          },
          ...k()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...k()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...k()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", ...k()]
      }],
      // ------------------
      // --- Typography ---
      // ------------------
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", r, Or, zn]
      }],
      /**
       * Font Smoothing
       * @see https://tailwindcss.com/docs/font-smoothing
       */
      "font-smoothing": ["antialiased", "subpixel-antialiased"],
      /**
       * Font Style
       * @see https://tailwindcss.com/docs/font-style
       */
      "font-style": ["italic", "not-italic"],
      /**
       * Font Weight
       * @see https://tailwindcss.com/docs/font-weight
       */
      "font-weight": [{
        font: [o, Zb, Kb]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", hi, be]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [qb, Gb, n]
      }],
      /**
       * Font Feature Settings
       * @see https://tailwindcss.com/docs/font-feature-settings
       */
      "font-features": [{
        "font-features": [be]
      }],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-normal": ["normal-nums"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-ordinal": ["ordinal"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-slashed-zero": ["slashed-zero"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-figure": ["lining-nums", "oldstyle-nums"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-spacing": ["proportional-nums", "tabular-nums"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
      /**
       * Letter Spacing
       * @see https://tailwindcss.com/docs/letter-spacing
       */
      tracking: [{
        tracking: [s, ve, be]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [Ae, "none", ve, Dc]
      }],
      /**
       * Line Height
       * @see https://tailwindcss.com/docs/line-height
       */
      leading: [{
        leading: [
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          i,
          ...N()
        ]
      }],
      /**
       * List Style Image
       * @see https://tailwindcss.com/docs/list-style-image
       */
      "list-image": [{
        "list-image": ["none", ve, be]
      }],
      /**
       * List Style Position
       * @see https://tailwindcss.com/docs/list-style-position
       */
      "list-style-position": [{
        list: ["inside", "outside"]
      }],
      /**
       * List Style Type
       * @see https://tailwindcss.com/docs/list-style-type
       */
      "list-style-type": [{
        list: ["disc", "decimal", "none", ve, be]
      }],
      /**
       * Text Alignment
       * @see https://tailwindcss.com/docs/text-align
       */
      "text-alignment": [{
        text: ["left", "center", "right", "justify", "start", "end"]
      }],
      /**
       * Placeholder Color
       * @deprecated since Tailwind CSS v3.0.0
       * @see https://v3.tailwindcss.com/docs/placeholder-color
       */
      "placeholder-color": [{
        placeholder: z()
      }],
      /**
       * Text Color
       * @see https://tailwindcss.com/docs/text-color
       */
      "text-color": [{
        text: z()
      }],
      /**
       * Text Decoration
       * @see https://tailwindcss.com/docs/text-decoration
       */
      "text-decoration": ["underline", "overline", "line-through", "no-underline"],
      /**
       * Text Decoration Style
       * @see https://tailwindcss.com/docs/text-decoration-style
       */
      "text-decoration-style": [{
        decoration: [...te(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [Ae, "from-font", "auto", ve, zn]
      }],
      /**
       * Text Decoration Color
       * @see https://tailwindcss.com/docs/text-decoration-color
       */
      "text-decoration-color": [{
        decoration: z()
      }],
      /**
       * Text Underline Offset
       * @see https://tailwindcss.com/docs/text-underline-offset
       */
      "underline-offset": [{
        "underline-offset": [Ae, "auto", ve, be]
      }],
      /**
       * Text Transform
       * @see https://tailwindcss.com/docs/text-transform
       */
      "text-transform": ["uppercase", "lowercase", "capitalize", "normal-case"],
      /**
       * Text Overflow
       * @see https://tailwindcss.com/docs/text-overflow
       */
      "text-overflow": ["truncate", "text-ellipsis", "text-clip"],
      /**
       * Text Wrap
       * @see https://tailwindcss.com/docs/text-wrap
       */
      "text-wrap": [{
        text: ["wrap", "nowrap", "balance", "pretty"]
      }],
      /**
       * Text Indent
       * @see https://tailwindcss.com/docs/text-indent
       */
      indent: [{
        indent: N()
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", ve, be]
      }],
      /**
       * Whitespace
       * @see https://tailwindcss.com/docs/whitespace
       */
      whitespace: [{
        whitespace: ["normal", "nowrap", "pre", "pre-line", "pre-wrap", "break-spaces"]
      }],
      /**
       * Word Break
       * @see https://tailwindcss.com/docs/word-break
       */
      break: [{
        break: ["normal", "words", "all", "keep"]
      }],
      /**
       * Overflow Wrap
       * @see https://tailwindcss.com/docs/overflow-wrap
       */
      wrap: [{
        wrap: ["break-word", "anywhere", "normal"]
      }],
      /**
       * Hyphens
       * @see https://tailwindcss.com/docs/hyphens
       */
      hyphens: [{
        hyphens: ["none", "manual", "auto"]
      }],
      /**
       * Content
       * @see https://tailwindcss.com/docs/content
       */
      content: [{
        content: ["none", ve, be]
      }],
      // -------------------
      // --- Backgrounds ---
      // -------------------
      /**
       * Background Attachment
       * @see https://tailwindcss.com/docs/background-attachment
       */
      "bg-attachment": [{
        bg: ["fixed", "local", "scroll"]
      }],
      /**
       * Background Clip
       * @see https://tailwindcss.com/docs/background-clip
       */
      "bg-clip": [{
        "bg-clip": ["border", "padding", "content", "text"]
      }],
      /**
       * Background Origin
       * @see https://tailwindcss.com/docs/background-origin
       */
      "bg-origin": [{
        "bg-origin": ["border", "padding", "content"]
      }],
      /**
       * Background Position
       * @see https://tailwindcss.com/docs/background-position
       */
      "bg-position": [{
        bg: Q()
      }],
      /**
       * Background Repeat
       * @see https://tailwindcss.com/docs/background-repeat
       */
      "bg-repeat": [{
        bg: B()
      }],
      /**
       * Background Size
       * @see https://tailwindcss.com/docs/background-size
       */
      "bg-size": [{
        bg: G()
      }],
      /**
       * Background Image
       * @see https://tailwindcss.com/docs/background-image
       */
      "bg-image": [{
        bg: ["none", {
          linear: [{
            to: ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
          }, yn, ve, be],
          radial: ["", ve, be],
          conic: [yn, ve, be]
        }, Jb, Yb]
      }],
      /**
       * Background Color
       * @see https://tailwindcss.com/docs/background-color
       */
      "bg-color": [{
        bg: z()
      }],
      /**
       * Gradient Color Stops From Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from-pos": [{
        from: j()
      }],
      /**
       * Gradient Color Stops Via Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via-pos": [{
        via: j()
      }],
      /**
       * Gradient Color Stops To Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to-pos": [{
        to: j()
      }],
      /**
       * Gradient Color Stops From
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from": [{
        from: z()
      }],
      /**
       * Gradient Color Stops Via
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via": [{
        via: z()
      }],
      /**
       * Gradient Color Stops To
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to": [{
        to: z()
      }],
      // ---------------
      // --- Borders ---
      // ---------------
      /**
       * Border Radius
       * @see https://tailwindcss.com/docs/border-radius
       */
      rounded: [{
        rounded: W()
      }],
      /**
       * Border Radius Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-s": [{
        "rounded-s": W()
      }],
      /**
       * Border Radius End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-e": [{
        "rounded-e": W()
      }],
      /**
       * Border Radius Top
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-t": [{
        "rounded-t": W()
      }],
      /**
       * Border Radius Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-r": [{
        "rounded-r": W()
      }],
      /**
       * Border Radius Bottom
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-b": [{
        "rounded-b": W()
      }],
      /**
       * Border Radius Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-l": [{
        "rounded-l": W()
      }],
      /**
       * Border Radius Start Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ss": [{
        "rounded-ss": W()
      }],
      /**
       * Border Radius Start End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-se": [{
        "rounded-se": W()
      }],
      /**
       * Border Radius End End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ee": [{
        "rounded-ee": W()
      }],
      /**
       * Border Radius End Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-es": [{
        "rounded-es": W()
      }],
      /**
       * Border Radius Top Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tl": [{
        "rounded-tl": W()
      }],
      /**
       * Border Radius Top Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tr": [{
        "rounded-tr": W()
      }],
      /**
       * Border Radius Bottom Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-br": [{
        "rounded-br": W()
      }],
      /**
       * Border Radius Bottom Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-bl": [{
        "rounded-bl": W()
      }],
      /**
       * Border Width
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w": [{
        border: H()
      }],
      /**
       * Border Width Inline
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-x": [{
        "border-x": H()
      }],
      /**
       * Border Width Block
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-y": [{
        "border-y": H()
      }],
      /**
       * Border Width Inline Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-s": [{
        "border-s": H()
      }],
      /**
       * Border Width Inline End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-e": [{
        "border-e": H()
      }],
      /**
       * Border Width Block Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-bs": [{
        "border-bs": H()
      }],
      /**
       * Border Width Block End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-be": [{
        "border-be": H()
      }],
      /**
       * Border Width Top
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-t": [{
        "border-t": H()
      }],
      /**
       * Border Width Right
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-r": [{
        "border-r": H()
      }],
      /**
       * Border Width Bottom
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-b": [{
        "border-b": H()
      }],
      /**
       * Border Width Left
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-l": [{
        "border-l": H()
      }],
      /**
       * Divide Width X
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x": [{
        "divide-x": H()
      }],
      /**
       * Divide Width X Reverse
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x-reverse": ["divide-x-reverse"],
      /**
       * Divide Width Y
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-y": [{
        "divide-y": H()
      }],
      /**
       * Divide Width Y Reverse
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-y-reverse": ["divide-y-reverse"],
      /**
       * Border Style
       * @see https://tailwindcss.com/docs/border-style
       */
      "border-style": [{
        border: [...te(), "hidden", "none"]
      }],
      /**
       * Divide Style
       * @see https://tailwindcss.com/docs/border-style#setting-the-divider-style
       */
      "divide-style": [{
        divide: [...te(), "hidden", "none"]
      }],
      /**
       * Border Color
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color": [{
        border: z()
      }],
      /**
       * Border Color Inline
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-x": [{
        "border-x": z()
      }],
      /**
       * Border Color Block
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-y": [{
        "border-y": z()
      }],
      /**
       * Border Color Inline Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-s": [{
        "border-s": z()
      }],
      /**
       * Border Color Inline End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-e": [{
        "border-e": z()
      }],
      /**
       * Border Color Block Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-bs": [{
        "border-bs": z()
      }],
      /**
       * Border Color Block End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-be": [{
        "border-be": z()
      }],
      /**
       * Border Color Top
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-t": [{
        "border-t": z()
      }],
      /**
       * Border Color Right
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-r": [{
        "border-r": z()
      }],
      /**
       * Border Color Bottom
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-b": [{
        "border-b": z()
      }],
      /**
       * Border Color Left
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-l": [{
        "border-l": z()
      }],
      /**
       * Divide Color
       * @see https://tailwindcss.com/docs/divide-color
       */
      "divide-color": [{
        divide: z()
      }],
      /**
       * Outline Style
       * @see https://tailwindcss.com/docs/outline-style
       */
      "outline-style": [{
        outline: [...te(), "none", "hidden"]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [Ae, ve, be]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", Ae, Or, zn]
      }],
      /**
       * Outline Color
       * @see https://tailwindcss.com/docs/outline-color
       */
      "outline-color": [{
        outline: z()
      }],
      // ---------------
      // --- Effects ---
      // ---------------
      /**
       * Box Shadow
       * @see https://tailwindcss.com/docs/box-shadow
       */
      shadow: [{
        shadow: [
          // Deprecated since Tailwind CSS v4.0.0
          "",
          "none",
          p,
          Mo,
          Po
        ]
      }],
      /**
       * Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-shadow-color
       */
      "shadow-color": [{
        shadow: z()
      }],
      /**
       * Inset Box Shadow
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-shadow
       */
      "inset-shadow": [{
        "inset-shadow": ["none", d, Mo, Po]
      }],
      /**
       * Inset Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-shadow-color
       */
      "inset-shadow-color": [{
        "inset-shadow": z()
      }],
      /**
       * Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-a-ring
       */
      "ring-w": [{
        ring: H()
      }],
      /**
       * Ring Width Inset
       * @see https://v3.tailwindcss.com/docs/ring-width#inset-rings
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-w-inset": ["ring-inset"],
      /**
       * Ring Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-ring-color
       */
      "ring-color": [{
        ring: z()
      }],
      /**
       * Ring Offset Width
       * @see https://v3.tailwindcss.com/docs/ring-offset-width
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-w": [{
        "ring-offset": [Ae, zn]
      }],
      /**
       * Ring Offset Color
       * @see https://v3.tailwindcss.com/docs/ring-offset-color
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-color": [{
        "ring-offset": z()
      }],
      /**
       * Inset Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-ring
       */
      "inset-ring-w": [{
        "inset-ring": H()
      }],
      /**
       * Inset Ring Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-ring-color
       */
      "inset-ring-color": [{
        "inset-ring": z()
      }],
      /**
       * Text Shadow
       * @see https://tailwindcss.com/docs/text-shadow
       */
      "text-shadow": [{
        "text-shadow": ["none", g, Mo, Po]
      }],
      /**
       * Text Shadow Color
       * @see https://tailwindcss.com/docs/text-shadow#setting-the-shadow-color
       */
      "text-shadow-color": [{
        "text-shadow": z()
      }],
      /**
       * Opacity
       * @see https://tailwindcss.com/docs/opacity
       */
      opacity: [{
        opacity: [Ae, ve, be]
      }],
      /**
       * Mix Blend Mode
       * @see https://tailwindcss.com/docs/mix-blend-mode
       */
      "mix-blend": [{
        "mix-blend": [...J(), "plus-darker", "plus-lighter"]
      }],
      /**
       * Background Blend Mode
       * @see https://tailwindcss.com/docs/background-blend-mode
       */
      "bg-blend": [{
        "bg-blend": J()
      }],
      /**
       * Mask Clip
       * @see https://tailwindcss.com/docs/mask-clip
       */
      "mask-clip": [{
        "mask-clip": ["border", "padding", "content", "fill", "stroke", "view"]
      }, "mask-no-clip"],
      /**
       * Mask Composite
       * @see https://tailwindcss.com/docs/mask-composite
       */
      "mask-composite": [{
        mask: ["add", "subtract", "intersect", "exclude"]
      }],
      /**
       * Mask Image
       * @see https://tailwindcss.com/docs/mask-image
       */
      "mask-image-linear-pos": [{
        "mask-linear": [Ae]
      }],
      "mask-image-linear-from-pos": [{
        "mask-linear-from": oe()
      }],
      "mask-image-linear-to-pos": [{
        "mask-linear-to": oe()
      }],
      "mask-image-linear-from-color": [{
        "mask-linear-from": z()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": z()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": oe()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": oe()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": z()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": z()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": oe()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": oe()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": z()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": z()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": oe()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": oe()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": z()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": z()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": oe()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": oe()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": z()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": z()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": oe()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": oe()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": z()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": z()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": oe()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": oe()
      }],
      "mask-image-y-from-color": [{
        "mask-y-from": z()
      }],
      "mask-image-y-to-color": [{
        "mask-y-to": z()
      }],
      "mask-image-radial": [{
        "mask-radial": [ve, be]
      }],
      "mask-image-radial-from-pos": [{
        "mask-radial-from": oe()
      }],
      "mask-image-radial-to-pos": [{
        "mask-radial-to": oe()
      }],
      "mask-image-radial-from-color": [{
        "mask-radial-from": z()
      }],
      "mask-image-radial-to-color": [{
        "mask-radial-to": z()
      }],
      "mask-image-radial-shape": [{
        "mask-radial": ["circle", "ellipse"]
      }],
      "mask-image-radial-size": [{
        "mask-radial": [{
          closest: ["side", "corner"],
          farthest: ["side", "corner"]
        }]
      }],
      "mask-image-radial-pos": [{
        "mask-radial-at": S()
      }],
      "mask-image-conic-pos": [{
        "mask-conic": [Ae]
      }],
      "mask-image-conic-from-pos": [{
        "mask-conic-from": oe()
      }],
      "mask-image-conic-to-pos": [{
        "mask-conic-to": oe()
      }],
      "mask-image-conic-from-color": [{
        "mask-conic-from": z()
      }],
      "mask-image-conic-to-color": [{
        "mask-conic-to": z()
      }],
      /**
       * Mask Mode
       * @see https://tailwindcss.com/docs/mask-mode
       */
      "mask-mode": [{
        mask: ["alpha", "luminance", "match"]
      }],
      /**
       * Mask Origin
       * @see https://tailwindcss.com/docs/mask-origin
       */
      "mask-origin": [{
        "mask-origin": ["border", "padding", "content", "fill", "stroke", "view"]
      }],
      /**
       * Mask Position
       * @see https://tailwindcss.com/docs/mask-position
       */
      "mask-position": [{
        mask: Q()
      }],
      /**
       * Mask Repeat
       * @see https://tailwindcss.com/docs/mask-repeat
       */
      "mask-repeat": [{
        mask: B()
      }],
      /**
       * Mask Size
       * @see https://tailwindcss.com/docs/mask-size
       */
      "mask-size": [{
        mask: G()
      }],
      /**
       * Mask Type
       * @see https://tailwindcss.com/docs/mask-type
       */
      "mask-type": [{
        "mask-type": ["alpha", "luminance"]
      }],
      /**
       * Mask Image
       * @see https://tailwindcss.com/docs/mask-image
       */
      "mask-image": [{
        mask: ["none", ve, be]
      }],
      // ---------------
      // --- Filters ---
      // ---------------
      /**
       * Filter
       * @see https://tailwindcss.com/docs/filter
       */
      filter: [{
        filter: [
          // Deprecated since Tailwind CSS v3.0.0
          "",
          "none",
          ve,
          be
        ]
      }],
      /**
       * Blur
       * @see https://tailwindcss.com/docs/blur
       */
      blur: [{
        blur: ae()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [Ae, ve, be]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [Ae, ve, be]
      }],
      /**
       * Drop Shadow
       * @see https://tailwindcss.com/docs/drop-shadow
       */
      "drop-shadow": [{
        "drop-shadow": [
          // Deprecated since Tailwind CSS v4.0.0
          "",
          "none",
          m,
          Mo,
          Po
        ]
      }],
      /**
       * Drop Shadow Color
       * @see https://tailwindcss.com/docs/filter-drop-shadow#setting-the-shadow-color
       */
      "drop-shadow-color": [{
        "drop-shadow": z()
      }],
      /**
       * Grayscale
       * @see https://tailwindcss.com/docs/grayscale
       */
      grayscale: [{
        grayscale: ["", Ae, ve, be]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [Ae, ve, be]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", Ae, ve, be]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [Ae, ve, be]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", Ae, ve, be]
      }],
      /**
       * Backdrop Filter
       * @see https://tailwindcss.com/docs/backdrop-filter
       */
      "backdrop-filter": [{
        "backdrop-filter": [
          // Deprecated since Tailwind CSS v3.0.0
          "",
          "none",
          ve,
          be
        ]
      }],
      /**
       * Backdrop Blur
       * @see https://tailwindcss.com/docs/backdrop-blur
       */
      "backdrop-blur": [{
        "backdrop-blur": ae()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [Ae, ve, be]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [Ae, ve, be]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", Ae, ve, be]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [Ae, ve, be]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", Ae, ve, be]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [Ae, ve, be]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [Ae, ve, be]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", Ae, ve, be]
      }],
      // --------------
      // --- Tables ---
      // --------------
      /**
       * Border Collapse
       * @see https://tailwindcss.com/docs/border-collapse
       */
      "border-collapse": [{
        border: ["collapse", "separate"]
      }],
      /**
       * Border Spacing
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing": [{
        "border-spacing": N()
      }],
      /**
       * Border Spacing X
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-x": [{
        "border-spacing-x": N()
      }],
      /**
       * Border Spacing Y
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-y": [{
        "border-spacing-y": N()
      }],
      /**
       * Table Layout
       * @see https://tailwindcss.com/docs/table-layout
       */
      "table-layout": [{
        table: ["auto", "fixed"]
      }],
      /**
       * Caption Side
       * @see https://tailwindcss.com/docs/caption-side
       */
      caption: [{
        caption: ["top", "bottom"]
      }],
      // ---------------------------------
      // --- Transitions and Animation ---
      // ---------------------------------
      /**
       * Transition Property
       * @see https://tailwindcss.com/docs/transition-property
       */
      transition: [{
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", ve, be]
      }],
      /**
       * Transition Behavior
       * @see https://tailwindcss.com/docs/transition-behavior
       */
      "transition-behavior": [{
        transition: ["normal", "discrete"]
      }],
      /**
       * Transition Duration
       * @see https://tailwindcss.com/docs/transition-duration
       */
      duration: [{
        duration: [Ae, "initial", ve, be]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", y, ve, be]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [Ae, ve, be]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", x, ve, be]
      }],
      // ------------------
      // --- Transforms ---
      // ------------------
      /**
       * Backface Visibility
       * @see https://tailwindcss.com/docs/backface-visibility
       */
      backface: [{
        backface: ["hidden", "visible"]
      }],
      /**
       * Perspective
       * @see https://tailwindcss.com/docs/perspective
       */
      perspective: [{
        perspective: [h, ve, be]
      }],
      /**
       * Perspective Origin
       * @see https://tailwindcss.com/docs/perspective-origin
       */
      "perspective-origin": [{
        "perspective-origin": E()
      }],
      /**
       * Rotate
       * @see https://tailwindcss.com/docs/rotate
       */
      rotate: [{
        rotate: ue()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": ue()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": ue()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": ue()
      }],
      /**
       * Scale
       * @see https://tailwindcss.com/docs/scale
       */
      scale: [{
        scale: fe()
      }],
      /**
       * Scale X
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-x": [{
        "scale-x": fe()
      }],
      /**
       * Scale Y
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-y": [{
        "scale-y": fe()
      }],
      /**
       * Scale Z
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-z": [{
        "scale-z": fe()
      }],
      /**
       * Scale 3D
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-3d": ["scale-3d"],
      /**
       * Skew
       * @see https://tailwindcss.com/docs/skew
       */
      skew: [{
        skew: le()
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": le()
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": le()
      }],
      /**
       * Transform
       * @see https://tailwindcss.com/docs/transform
       */
      transform: [{
        transform: [ve, be, "", "none", "gpu", "cpu"]
      }],
      /**
       * Transform Origin
       * @see https://tailwindcss.com/docs/transform-origin
       */
      "transform-origin": [{
        origin: E()
      }],
      /**
       * Transform Style
       * @see https://tailwindcss.com/docs/transform-style
       */
      "transform-style": [{
        transform: ["3d", "flat"]
      }],
      /**
       * Translate
       * @see https://tailwindcss.com/docs/translate
       */
      translate: [{
        translate: se()
      }],
      /**
       * Translate X
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-x": [{
        "translate-x": se()
      }],
      /**
       * Translate Y
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-y": [{
        "translate-y": se()
      }],
      /**
       * Translate Z
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-z": [{
        "translate-z": se()
      }],
      /**
       * Translate None
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-none": ["translate-none"],
      // ---------------------
      // --- Interactivity ---
      // ---------------------
      /**
       * Accent Color
       * @see https://tailwindcss.com/docs/accent-color
       */
      accent: [{
        accent: z()
      }],
      /**
       * Appearance
       * @see https://tailwindcss.com/docs/appearance
       */
      appearance: [{
        appearance: ["none", "auto"]
      }],
      /**
       * Caret Color
       * @see https://tailwindcss.com/docs/just-in-time-mode#caret-color-utilities
       */
      "caret-color": [{
        caret: z()
      }],
      /**
       * Color Scheme
       * @see https://tailwindcss.com/docs/color-scheme
       */
      "color-scheme": [{
        scheme: ["normal", "dark", "light", "light-dark", "only-dark", "only-light"]
      }],
      /**
       * Cursor
       * @see https://tailwindcss.com/docs/cursor
       */
      cursor: [{
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", ve, be]
      }],
      /**
       * Field Sizing
       * @see https://tailwindcss.com/docs/field-sizing
       */
      "field-sizing": [{
        "field-sizing": ["fixed", "content"]
      }],
      /**
       * Pointer Events
       * @see https://tailwindcss.com/docs/pointer-events
       */
      "pointer-events": [{
        "pointer-events": ["auto", "none"]
      }],
      /**
       * Resize
       * @see https://tailwindcss.com/docs/resize
       */
      resize: [{
        resize: ["none", "", "y", "x"]
      }],
      /**
       * Scroll Behavior
       * @see https://tailwindcss.com/docs/scroll-behavior
       */
      "scroll-behavior": [{
        scroll: ["auto", "smooth"]
      }],
      /**
       * Scroll Margin
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-m": [{
        "scroll-m": N()
      }],
      /**
       * Scroll Margin Inline
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mx": [{
        "scroll-mx": N()
      }],
      /**
       * Scroll Margin Block
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-my": [{
        "scroll-my": N()
      }],
      /**
       * Scroll Margin Inline Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ms": [{
        "scroll-ms": N()
      }],
      /**
       * Scroll Margin Inline End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-me": [{
        "scroll-me": N()
      }],
      /**
       * Scroll Margin Block Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbs": [{
        "scroll-mbs": N()
      }],
      /**
       * Scroll Margin Block End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mbe": [{
        "scroll-mbe": N()
      }],
      /**
       * Scroll Margin Top
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mt": [{
        "scroll-mt": N()
      }],
      /**
       * Scroll Margin Right
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mr": [{
        "scroll-mr": N()
      }],
      /**
       * Scroll Margin Bottom
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mb": [{
        "scroll-mb": N()
      }],
      /**
       * Scroll Margin Left
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ml": [{
        "scroll-ml": N()
      }],
      /**
       * Scroll Padding
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-p": [{
        "scroll-p": N()
      }],
      /**
       * Scroll Padding Inline
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-px": [{
        "scroll-px": N()
      }],
      /**
       * Scroll Padding Block
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-py": [{
        "scroll-py": N()
      }],
      /**
       * Scroll Padding Inline Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-ps": [{
        "scroll-ps": N()
      }],
      /**
       * Scroll Padding Inline End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pe": [{
        "scroll-pe": N()
      }],
      /**
       * Scroll Padding Block Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbs": [{
        "scroll-pbs": N()
      }],
      /**
       * Scroll Padding Block End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pbe": [{
        "scroll-pbe": N()
      }],
      /**
       * Scroll Padding Top
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pt": [{
        "scroll-pt": N()
      }],
      /**
       * Scroll Padding Right
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pr": [{
        "scroll-pr": N()
      }],
      /**
       * Scroll Padding Bottom
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pb": [{
        "scroll-pb": N()
      }],
      /**
       * Scroll Padding Left
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pl": [{
        "scroll-pl": N()
      }],
      /**
       * Scroll Snap Align
       * @see https://tailwindcss.com/docs/scroll-snap-align
       */
      "snap-align": [{
        snap: ["start", "end", "center", "align-none"]
      }],
      /**
       * Scroll Snap Stop
       * @see https://tailwindcss.com/docs/scroll-snap-stop
       */
      "snap-stop": [{
        snap: ["normal", "always"]
      }],
      /**
       * Scroll Snap Type
       * @see https://tailwindcss.com/docs/scroll-snap-type
       */
      "snap-type": [{
        snap: ["none", "x", "y", "both"]
      }],
      /**
       * Scroll Snap Type Strictness
       * @see https://tailwindcss.com/docs/scroll-snap-type
       */
      "snap-strictness": [{
        snap: ["mandatory", "proximity"]
      }],
      /**
       * Touch Action
       * @see https://tailwindcss.com/docs/touch-action
       */
      touch: [{
        touch: ["auto", "none", "manipulation"]
      }],
      /**
       * Touch Action X
       * @see https://tailwindcss.com/docs/touch-action
       */
      "touch-x": [{
        "touch-pan": ["x", "left", "right"]
      }],
      /**
       * Touch Action Y
       * @see https://tailwindcss.com/docs/touch-action
       */
      "touch-y": [{
        "touch-pan": ["y", "up", "down"]
      }],
      /**
       * Touch Action Pinch Zoom
       * @see https://tailwindcss.com/docs/touch-action
       */
      "touch-pz": ["touch-pinch-zoom"],
      /**
       * User Select
       * @see https://tailwindcss.com/docs/user-select
       */
      select: [{
        select: ["none", "text", "all", "auto"]
      }],
      /**
       * Will Change
       * @see https://tailwindcss.com/docs/will-change
       */
      "will-change": [{
        "will-change": ["auto", "scroll", "contents", "transform", ve, be]
      }],
      // -----------
      // --- SVG ---
      // -----------
      /**
       * Fill
       * @see https://tailwindcss.com/docs/fill
       */
      fill: [{
        fill: ["none", ...z()]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [Ae, Or, zn, Dc]
      }],
      /**
       * Stroke
       * @see https://tailwindcss.com/docs/stroke
       */
      stroke: [{
        stroke: ["none", ...z()]
      }],
      // ---------------------
      // --- Accessibility ---
      // ---------------------
      /**
       * Forced Color Adjust
       * @see https://tailwindcss.com/docs/forced-color-adjust
       */
      "forced-color-adjust": [{
        "forced-color-adjust": ["auto", "none"]
      }]
    },
    conflictingClassGroups: {
      overflow: ["overflow-x", "overflow-y"],
      overscroll: ["overscroll-x", "overscroll-y"],
      inset: ["inset-x", "inset-y", "inset-bs", "inset-be", "start", "end", "top", "right", "bottom", "left"],
      "inset-x": ["right", "left"],
      "inset-y": ["top", "bottom"],
      flex: ["basis", "grow", "shrink"],
      gap: ["gap-x", "gap-y"],
      p: ["px", "py", "ps", "pe", "pbs", "pbe", "pt", "pr", "pb", "pl"],
      px: ["pr", "pl"],
      py: ["pt", "pb"],
      m: ["mx", "my", "ms", "me", "mbs", "mbe", "mt", "mr", "mb", "ml"],
      mx: ["mr", "ml"],
      my: ["mt", "mb"],
      size: ["w", "h"],
      "font-size": ["leading"],
      "fvn-normal": ["fvn-ordinal", "fvn-slashed-zero", "fvn-figure", "fvn-spacing", "fvn-fraction"],
      "fvn-ordinal": ["fvn-normal"],
      "fvn-slashed-zero": ["fvn-normal"],
      "fvn-figure": ["fvn-normal"],
      "fvn-spacing": ["fvn-normal"],
      "fvn-fraction": ["fvn-normal"],
      "line-clamp": ["display", "overflow"],
      rounded: ["rounded-s", "rounded-e", "rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-ss", "rounded-se", "rounded-ee", "rounded-es", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"],
      "rounded-s": ["rounded-ss", "rounded-es"],
      "rounded-e": ["rounded-se", "rounded-ee"],
      "rounded-t": ["rounded-tl", "rounded-tr"],
      "rounded-r": ["rounded-tr", "rounded-br"],
      "rounded-b": ["rounded-br", "rounded-bl"],
      "rounded-l": ["rounded-tl", "rounded-bl"],
      "border-spacing": ["border-spacing-x", "border-spacing-y"],
      "border-w": ["border-w-x", "border-w-y", "border-w-s", "border-w-e", "border-w-bs", "border-w-be", "border-w-t", "border-w-r", "border-w-b", "border-w-l"],
      "border-w-x": ["border-w-r", "border-w-l"],
      "border-w-y": ["border-w-t", "border-w-b"],
      "border-color": ["border-color-x", "border-color-y", "border-color-s", "border-color-e", "border-color-bs", "border-color-be", "border-color-t", "border-color-r", "border-color-b", "border-color-l"],
      "border-color-x": ["border-color-r", "border-color-l"],
      "border-color-y": ["border-color-t", "border-color-b"],
      translate: ["translate-x", "translate-y", "translate-none"],
      "translate-none": ["translate", "translate-x", "translate-y", "translate-z"],
      "scroll-m": ["scroll-mx", "scroll-my", "scroll-ms", "scroll-me", "scroll-mbs", "scroll-mbe", "scroll-mt", "scroll-mr", "scroll-mb", "scroll-ml"],
      "scroll-mx": ["scroll-mr", "scroll-ml"],
      "scroll-my": ["scroll-mt", "scroll-mb"],
      "scroll-p": ["scroll-px", "scroll-py", "scroll-ps", "scroll-pe", "scroll-pbs", "scroll-pbe", "scroll-pt", "scroll-pr", "scroll-pb", "scroll-pl"],
      "scroll-px": ["scroll-pr", "scroll-pl"],
      "scroll-py": ["scroll-pt", "scroll-pb"],
      touch: ["touch-x", "touch-y", "touch-pz"],
      "touch-x": ["touch"],
      "touch-y": ["touch"],
      "touch-pz": ["touch"]
    },
    conflictingClassGroupModifiers: {
      "font-size": ["leading"]
    },
    orderSensitiveModifiers: ["*", "**", "after", "backdrop", "before", "details-content", "file", "first-letter", "first-line", "marker", "placeholder", "selection"]
  };
}, tv = /* @__PURE__ */ Db(ev);
function X(...e) {
  return tv(kd(e));
}
const nv = wr(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 min-w-0 overflow-hidden",
  {
    variants: {
      variant: {
        // Standard Variants
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-transparent text-foreground dark:text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 underline hover:text-primary/80 !h-auto !py-0",
        // Semantic / Feedback Variants
        success: "bg-success text-success-foreground shadow-sm hover:bg-success/90",
        warning: "bg-warning text-warning-foreground shadow-sm hover:bg-warning/90",
        info: "bg-info text-info-text shadow-sm hover:bg-info/90",
        // Outline Variations
        "outline-success": "border border-success text-success dark:text-success hover:bg-success/10",
        "outline-warning": "border border-warning text-warning dark:text-warning hover:bg-warning/10",
        "outline-destructive": "border border-destructive text-destructive dark:text-destructive hover:bg-destructive/10",
        // Special Shapes
        fab: "rounded-full h-14 w-14 p-0 shadow-lg hover:shadow-xl bg-primary text-primary-foreground hover:bg-primary/90",
        "circle-help": "bg-muted text-muted-foreground shadow-sm hover:bg-muted/90 rounded-full",
        "circle-alert": "bg-warning text-warning-foreground shadow-sm hover:bg-warning/90 rounded-full",
        // Option Buttons
        option: "border border-input bg-background text-foreground shadow-none hover:bg-accent/30 hover:text-foreground",
        "option-active": "border-2 border-primary bg-primary/10 text-foreground shadow-none hover:bg-primary/20"
      },
      size: {
        default: "h-ui px-ui-button py-ui-button text-ui min-h-ui-touch",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-ui w-[var(--ui-component-height)] min-h-ui-touch min-w-[var(--ui-touch-target-min)]",
        circle: "h-8 w-8 rounded-full p-0"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
), Et = c.forwardRef(
  ({
    className: e,
    variant: n = "default",
    size: r,
    children: o,
    loading: s = false,
    success: i = false,
    error: a = false,
    icon: l,
    asChild: f = false,
    render: u,
    disabled: p,
    maxLabelLength: d = 14,
    ...g
  }, m) => {
    var _a2;
    const b = i ? "success" : a ? "destructive" : n, h = () => {
      if (s) return /* @__PURE__ */ jsx(qh, { className: "h-4 w-4 animate-spin" });
      if (i) return /* @__PURE__ */ jsx(ps, { className: "h-4 w-4" });
      if (a) return /* @__PURE__ */ jsx(Er, { className: "h-4 w-4" });
      const x = typeof o == "string" && o.length > d ? `${o.slice(0, Math.max(0, d - 1))}…` : o, S = typeof o == "string" ? /* @__PURE__ */ jsx(
        "span",
        {
          className: "min-w-0 flex-1 whitespace-nowrap",
          title: typeof o == "string" && typeof x == "string" && x !== o ? o : void 0,
          children: x
        }
      ) : o;
      return /* @__PURE__ */ jsxs("span", { className: "flex min-w-0 items-center", children: [
        l && /* @__PURE__ */ jsx(l, { className: X("mr-2 h-4 w-4", !o && "mr-0") }),
        S
      ] });
    }, v = X(
      nv({ variant: b, size: r }),
      e
    ), y = {
      ...g,
      className: v,
      ref: m,
      disabled: p || s || i || a,
      children: h()
    };
    return u ? typeof u == "function" ? u(y) : c.cloneElement(
      u,
      {
        ...y,
        className: X(v, (_a2 = u.props) == null ? void 0 : _a2.className)
      }
    ) : f && c.isValidElement(o) ? c.cloneElement(o, {
      ...o.props,
      ...g,
      className: X(v, o.props.className),
      ref: m
    }) : /* @__PURE__ */ jsx("button", { type: "button", ...y, children: y.children });
  }
);
Et.displayName = "Button";
const Fc = 768;
function rv() {
  const [e, n] = c.useState(() => typeof window < "u" && window.matchMedia ? window.matchMedia(`(max-width: ${Fc - 1}px)`).matches : false);
  return c.useEffect(() => {
    if (typeof window > "u" || !window.matchMedia) return;
    const r = window.matchMedia(`(max-width: ${Fc - 1}px)`), o = (s) => {
      n(s.matches);
    };
    return r.addEventListener ? r.addEventListener("change", o) : r.addListener(o), n(r.matches), () => {
      r.removeEventListener ? r.removeEventListener("change", o) : r.removeListener(o);
    };
  }, []), e;
}
const Cr = c__default.forwardRef(
  ({
    variant: e = "default",
    mobileVariant: n,
    label: r,
    icon: o,
    mobileIcon: s,
    iconOnly: i = false,
    alwaysFull: a = false,
    isFab: l = false,
    className: f,
    children: u,
    size: p,
    ...d
  }, g) => {
    const m = rv(), b = m && n ? n : e, h = m && s ? s : o, v = i || m && !a;
    return m && l ? /* @__PURE__ */ jsx(
      Et,
      {
        ref: g,
        variant: "fab",
        size: "icon",
        className: X("fixed bottom-6 right-6 z-modal", f),
        icon: h,
        "aria-label": r,
        ...d
      }
    ) : /* @__PURE__ */ jsx(
      Et,
      {
        ref: g,
        variant: b,
        size: v ? "icon" : p || "default",
        className: f,
        icon: h,
        "aria-label": v ? r : void 0,
        ...d,
        children: v ? void 0 : r ?? u
      }
    );
  }
);
Cr.displayName = "ActionButton";
const qr = ({
  text: e,
  width: n,
  className: r = "",
  style: o = {},
  as: s = "div"
}) => {
  const i = useRef(null), a = useRef(null), [l, f] = useState(1), [u, p] = useState(false);
  useLayoutEffect(() => {
    const m = i.current, b = a.current;
    if (!m || !b) return;
    const h = () => {
      f(1), p(false);
      let v = 0;
      if (typeof n == "number" ? v = n : typeof n == "string" && n.endsWith("px") ? v = Number.parseFloat(n) : v = m.clientWidth, v <= 0) return;
      const x = b.scrollWidth / v;
      x <= 1 ? (f(1), p(false)) : x <= 1.3 ? (f(1 / x), p(false)) : (f(1), p(true));
    };
    if (h(), !n) {
      const v = new ResizeObserver(() => {
        h();
      });
      return v.observe(m), () => v.disconnect();
    }
  }, [e, n]);
  const d = {
    ...o,
    width: n,
    whiteSpace: "nowrap",
    overflow: u ? "hidden" : "visible",
    textOverflow: u ? "ellipsis" : "clip",
    display: "block"
    // Ensure block/inline-block for width to apply
  }, g = {
    display: "inline-block",
    transform: l < 1 ? `scale(${l})` : "none",
    transformOrigin: "left center",
    width: l < 1 ? `${1 / l * 100}%` : "auto"
    // Compensate width when scaled
  };
  return /* @__PURE__ */ jsx(
    s,
    {
      ref: i,
      className: `adaptive-text-container ${r}`,
      style: d,
      title: u ? e : void 0,
      children: /* @__PURE__ */ jsx("span", { ref: a, style: g, children: e })
    }
  );
}, uv = {
  xs: "h-4 w-4 border-2",
  sm: "h-6 w-6 border-2",
  md: "h-8 w-8 border-[3px]",
  lg: "h-12 w-12 border-[3px]",
  xl: "h-16 w-16 border-4"
}, dv = {
  primary: "border-theme-object-primary border-t-transparent",
  secondary: "border-theme-text-secondary border-t-transparent",
  accent: "border-theme-accent border-t-transparent"
}, Kn = c.memo(
  ({ size: e = "md", variant: n = "primary", className: r, ...o }) => {
    const s = (i, a) => a ?? i;
    return /* @__PURE__ */ jsxs(
      "output",
      {
        "aria-live": "polite",
        "aria-label": "Loading",
        className: X("inline-block", r),
        ...o,
        children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              className: X(
                "animate-spin rounded-full",
                uv[e],
                dv[n]
              )
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "sr-only", children: s("loading") })
        ]
      }
    );
  }
);
Kn.displayName = "Spinner";
const Yd = c.memo(
  ({
    className: e,
    showSpinner: n = false,
    spinnerSize: r = "md",
    spinnerVariant: o = "primary",
    ...s
  }) => /* @__PURE__ */ jsx(
    "div",
    {
      className: X(
        "animate-pulse rounded-md bg-card opacity-50",
        n && "relative flex items-center justify-center",
        e
      ),
      ...s,
      children: n && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: /* @__PURE__ */ jsx(Kn, { size: r, variant: o }) })
    }
  )
);
Yd.displayName = "Skeleton";
const fv = {
  xs: "h-7 w-7 text-xs",
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-20 w-20 text-xl"
}, pv = c.memo(
  c.forwardRef(
    ({ src: e, alt: n, fallback: r, size: o = "md", className: s, ...i }, a) => {
      const [l, f] = c.useState(false), u = () => !r && !n ? "?" : typeof r == "string" ? r.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2) : n ? n.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2) : "?";
      return /* @__PURE__ */ jsx(
        "div",
        {
          ref: a,
          className: X(
            "relative flex shrink-0 overflow-hidden rounded-full",
            fv[o],
            s
          ),
          ...i,
          children: e && !l ? /* @__PURE__ */ jsx(
            "img",
            {
              src: e,
              alt: n || "Avatar",
              className: "h-full w-full object-cover",
              onError: () => f(true)
            }
          ) : /* @__PURE__ */ jsx("div", { className: "flex h-full w-full items-center justify-center bg-muted text-muted-foreground", children: c.isValidElement(r) ? r : u() })
        }
      );
    }
  )
);
pv.displayName = "Avatar";
const mv = wr(
  "inline-flex items-center rounded-full border px-[var(--ui-badge-padding-x)] py-[var(--ui-badge-padding-y)] text-ui font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent text-accent-foreground hover:bg-accent/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground border-border",
        success: "border-transparent bg-success text-success-foreground hover:bg-success/80",
        warning: "border-transparent bg-warning text-warning-foreground hover:bg-warning/80",
        // Additional variants for patient list - light backgrounds with dark text
        sky: "border-transparent bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-100 hover:bg-sky-300 dark:hover:bg-sky-800",
        pink: "border-transparent bg-pink-200 text-pink-800 dark:bg-pink-900 dark:text-pink-100 hover:bg-pink-300 dark:hover:bg-pink-800",
        gray: "border-transparent bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200 hover:bg-stone-300 dark:hover:bg-stone-700",
        green: "border-transparent bg-teal-200 text-gray-900 dark:bg-teal-900 dark:text-teal-100 hover:bg-teal-300 dark:hover:bg-teal-800",
        yellow: "border-transparent bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-100 hover:bg-amber-300 dark:hover:bg-amber-800",
        red: "border-transparent bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-100 hover:bg-rose-300 dark:hover:bg-rose-800"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
), tk = c.memo(
  ({ className: e, variant: n, label: r, pill: o, children: s, ...i }) => /* @__PURE__ */ jsx("div", { className: X(mv({ variant: n }), e), ...i, children: r ?? s })
);
function Xr({
  controlled: e,
  default: n,
  name: r,
  state: o = "value"
}) {
  const {
    current: s
  } = c.useRef(e !== void 0), [i, a] = c.useState(n), l = s ? e : i;
  if (process.env.NODE_ENV !== "production") {
    c.useEffect(() => {
      s !== (e !== void 0) && console.error([`Base UI: A component is changing the ${s ? "" : "un"}controlled ${o} state of ${r} to be ${s ? "un" : ""}controlled.`, "Elements should not switch from uncontrolled to controlled (or vice versa).", `Decide between using a controlled or uncontrolled ${r} element for the lifetime of the component.`, "The nature of the state is determined during the first render. It's considered controlled if the value is not `undefined`.", "More info: https://fb.me/react-controlled-components"].join(`
`));
    }, [o, r, e]);
    const {
      current: u
    } = c.useRef(n);
    c.useEffect(() => {
      !s && JSON.stringify(u) !== JSON.stringify(n) && console.error([`Base UI: A component is changing the default ${o} state of an uncontrolled ${r} after being initialized. To suppress this warning opt to use a controlled ${r}.`].join(`
`));
    }, [JSON.stringify(n)]);
  }
  const f = c.useCallback((u) => {
    s || a(u);
  }, []);
  return [l, f];
}
const _c = {};
function xt(e, n) {
  const r = c.useRef(_c);
  return r.current === _c && (r.current = e(n)), r;
}
const bi = c[`useInsertionEffect${Math.random().toFixed(1)}`.slice(0, -3)], gv = (
  // React 17 doesn't have useInsertionEffect.
  bi && // Preact replaces useInsertionEffect with useLayoutEffect and fires too late.
  bi !== c.useLayoutEffect ? bi : (e) => e()
);
function de(e) {
  const n = xt(hv).current;
  return n.next = e, gv(n.effect), n.trampoline;
}
function hv() {
  const e = {
    next: void 0,
    callback: bv,
    trampoline: (...n) => {
      var _a2;
      return (_a2 = e.callback) == null ? void 0 : _a2.call(e, ...n);
    },
    effect: () => {
      e.callback = e.next;
    }
  };
  return e;
}
function bv() {
  if (process.env.NODE_ENV !== "production")
    throw (
      /* minify-error-disabled */
      new Error("Base UI: Cannot call an event handler while rendering.")
    );
}
const vv = () => {
}, ce = typeof document < "u" ? c.useLayoutEffect : vv;
let na;
process.env.NODE_ENV !== "production" && (na = /* @__PURE__ */ new Set());
function Va(...e) {
  if (process.env.NODE_ENV !== "production") {
    const n = e.join(" ");
    na.has(n) || (na.add(n), console.warn(`Base UI: ${n}`));
  }
}
const Ba = /* @__PURE__ */ c.createContext({
  register: () => {
  },
  unregister: () => {
  },
  subscribeMapChange: () => () => {
  },
  elementsRef: {
    current: []
  },
  nextIndexRef: {
    current: 0
  }
});
process.env.NODE_ENV !== "production" && (Ba.displayName = "CompositeListContext");
function yv() {
  return c.useContext(Ba);
}
function Ms(e) {
  const {
    children: n,
    elementsRef: r,
    labelsRef: o,
    onMapChange: s
  } = e, i = de(s), a = c.useRef(0), l = xt(wv).current, f = xt(xv).current, [u, p] = c.useState(0), d = c.useRef(u), g = de((y, x) => {
    f.set(y, x ?? null), d.current += 1, p(d.current);
  }), m = de((y) => {
    f.delete(y), d.current += 1, p(d.current);
  }), b = c.useMemo(() => {
    const y = /* @__PURE__ */ new Map();
    return Array.from(f.keys()).filter((R) => R.isConnected).sort(Ev).forEach((R, S) => {
      const E = f.get(R) ?? {};
      y.set(R, {
        ...E,
        index: S
      });
    }), y;
  }, [f, u]);
  ce(() => {
    if (typeof MutationObserver != "function" || b.size === 0)
      return;
    const y = new MutationObserver((x) => {
      const R = /* @__PURE__ */ new Set(), S = (E) => R.has(E) ? R.delete(E) : R.add(E);
      x.forEach((E) => {
        E.removedNodes.forEach(S), E.addedNodes.forEach(S);
      }), R.size === 0 && (d.current += 1, p(d.current));
    });
    return b.forEach((x, R) => {
      R.parentElement && y.observe(R.parentElement, {
        childList: true
      });
    }), () => {
      y.disconnect();
    };
  }, [b]), ce(() => {
    d.current === u && (r.current.length !== b.size && (r.current.length = b.size), o && o.current.length !== b.size && (o.current.length = b.size), a.current = b.size), i(b);
  }, [i, b, r, o, u]), ce(() => () => {
    r.current = [];
  }, [r]), ce(() => () => {
    o && (o.current = []);
  }, [o]);
  const h = de((y) => (l.add(y), () => {
    l.delete(y);
  }));
  ce(() => {
    l.forEach((y) => y(b));
  }, [l, b]);
  const v = c.useMemo(() => ({
    register: g,
    unregister: m,
    subscribeMapChange: h,
    elementsRef: r,
    labelsRef: o,
    nextIndexRef: a
  }), [g, m, h, r, o, a]);
  return /* @__PURE__ */ jsx(Ba.Provider, {
    value: v,
    children: n
  });
}
function xv() {
  return /* @__PURE__ */ new Map();
}
function wv() {
  return /* @__PURE__ */ new Set();
}
function Ev(e, n) {
  const r = e.compareDocumentPosition(n);
  return r & Node.DOCUMENT_POSITION_FOLLOWING || r & Node.DOCUMENT_POSITION_CONTAINED_BY ? -1 : r & Node.DOCUMENT_POSITION_PRECEDING || r & Node.DOCUMENT_POSITION_CONTAINS ? 1 : 0;
}
const qd = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (qd.displayName = "DirectionContext");
function Ds() {
  var _a2;
  return ((_a2 = c.useContext(qd)) == null ? void 0 : _a2.direction) ?? "ltr";
}
function Cv(e, n) {
  return function(o, ...s) {
    const i = new URL(e);
    return i.searchParams.set("code", o.toString()), s.forEach((a) => i.searchParams.append("args[]", a)), `${n} error #${o}; visit ${i} for the full message.`;
  };
}
const Ze = Cv("https://base-ui.com/production-error", "Base UI");
function Wt(e, n, r, o) {
  const s = xt(Xd).current;
  return Rv(s, e, n, r, o) && Jd(s, [e, n, r, o]), s.callback;
}
function Sv(e) {
  const n = xt(Xd).current;
  return Nv(n, e) && Jd(n, e), n.callback;
}
function Xd() {
  return {
    callback: null,
    cleanup: null,
    refs: []
  };
}
function Rv(e, n, r, o, s) {
  return e.refs[0] !== n || e.refs[1] !== r || e.refs[2] !== o || e.refs[3] !== s;
}
function Nv(e, n) {
  return e.refs.length !== n.length || e.refs.some((r, o) => r !== n[o]);
}
function Jd(e, n) {
  if (e.refs = n, n.every((r) => r == null)) {
    e.callback = null;
    return;
  }
  e.callback = (r) => {
    if (e.cleanup && (e.cleanup(), e.cleanup = null), r != null) {
      const o = Array(n.length).fill(null);
      for (let s = 0; s < n.length; s += 1) {
        const i = n[s];
        if (i != null)
          switch (typeof i) {
            case "function": {
              const a = i(r);
              typeof a == "function" && (o[s] = a);
              break;
            }
            case "object": {
              i.current = r;
              break;
            }
          }
      }
      e.cleanup = () => {
        for (let s = 0; s < n.length; s += 1) {
          const i = n[s];
          if (i != null)
            switch (typeof i) {
              case "function": {
                const a = o[s];
                typeof a == "function" ? a() : i(null);
                break;
              }
              case "object": {
                i.current = null;
                break;
              }
            }
        }
      };
    }
  };
}
const Tv = parseInt(c.version, 10);
function $a(e) {
  return Tv >= e;
}
function Vc(e) {
  if (!/* @__PURE__ */ c.isValidElement(e))
    return null;
  const n = e, r = n.props;
  return ($a(19) ? r == null ? void 0 : r.ref : n.ref) ?? null;
}
function ra(e, n) {
  if (e && !n)
    return e;
  if (!e && n)
    return n;
  if (e || n)
    return {
      ...e,
      ...n
    };
}
function kv(e, n) {
  const r = {};
  for (const o in e) {
    const s = e[o];
    if (n == null ? void 0 : n.hasOwnProperty(o)) {
      const i = n[o](s);
      i != null && Object.assign(r, i);
      continue;
    }
    s === true ? r[`data-${o.toLowerCase()}`] = "" : s && (r[`data-${o.toLowerCase()}`] = s.toString());
  }
  return r;
}
function Ov(e, n) {
  return typeof e == "function" ? e(n) : e;
}
function Iv(e, n) {
  return typeof e == "function" ? e(n) : e;
}
const _r = {};
function Tn(e, n, r, o, s) {
  let i = {
    ...oa(e, _r)
  };
  return n && (i = Dr(i, n)), r && (i = Dr(i, r)), o && (i = Dr(i, o)), s && (i = Dr(i, s)), i;
}
function Pv(e) {
  if (e.length === 0)
    return _r;
  if (e.length === 1)
    return oa(e[0], _r);
  let n = {
    ...oa(e[0], _r)
  };
  for (let r = 1; r < e.length; r += 1)
    n = Dr(n, e[r]);
  return n;
}
function Dr(e, n) {
  return Zd(n) ? n(e) : Mv(e, n);
}
function Mv(e, n) {
  if (!n)
    return e;
  for (const r in n) {
    const o = n[r];
    switch (r) {
      case "style": {
        e[r] = ra(e.style, o);
        break;
      }
      case "className": {
        e[r] = Qd(e.className, o);
        break;
      }
      default:
        Dv(r, o) ? e[r] = Av(e[r], o) : e[r] = o;
    }
  }
  return e;
}
function Dv(e, n) {
  const r = e.charCodeAt(0), o = e.charCodeAt(1), s = e.charCodeAt(2);
  return r === 111 && o === 110 && s >= 65 && s <= 90 && (typeof n == "function" || typeof n > "u");
}
function Zd(e) {
  return typeof e == "function";
}
function oa(e, n) {
  return Zd(e) ? e(n) : e ?? _r;
}
function Av(e, n) {
  return n ? e ? (r) => {
    if (Lv(r)) {
      const s = r;
      sa(s);
      const i = n(s);
      return s.baseUIHandlerPrevented || (e == null ? void 0 : e(s)), i;
    }
    const o = n(r);
    return e == null ? void 0 : e(r), o;
  } : n : e;
}
function sa(e) {
  return e.preventBaseUIHandler = () => {
    e.baseUIHandlerPrevented = true;
  }, e;
}
function Qd(e, n) {
  return n ? e ? n + " " + e : n : e;
}
function Lv(e) {
  return e != null && typeof e == "object" && "nativeEvent" in e;
}
function It() {
}
const kn = Object.freeze([]), ct = Object.freeze({}), Fv = 500, ef = 500, _v = {
  style: {
    transition: "none"
  }
}, za = "data-base-ui-click-trigger", tf = {
  fallbackAxisSide: "none"
}, Ha = {
  fallbackAxisSide: "end"
}, Vv = {
  clipPath: "inset(50%)",
  position: "fixed",
  top: 0,
  left: 0
};
function Pe(e, n, r = {}) {
  const o = n.render, s = Bv(n, r);
  if (r.enabled === false)
    return null;
  const i = r.state ?? ct;
  return zv(e, o, s, i);
}
function Bv(e, n = {}) {
  const {
    className: r,
    style: o,
    render: s
  } = e, {
    state: i = ct,
    ref: a,
    props: l,
    stateAttributesMapping: f,
    enabled: u = true
  } = n, p = u ? Ov(r, i) : void 0, d = u ? Iv(o, i) : void 0, g = u ? kv(i, f) : ct, m = u ? ra(g, Array.isArray(l) ? Pv(l) : l) ?? ct : ct;
  return typeof document < "u" && (u ? Array.isArray(a) ? m.ref = Sv([m.ref, Vc(s), ...a]) : m.ref = Wt(m.ref, Vc(s), a) : Wt(null, null)), u ? (p !== void 0 && (m.className = Qd(m.className, p)), d !== void 0 && (m.style = ra(m.style, d)), m) : ct;
}
const $v = /* @__PURE__ */ Symbol.for("react.lazy");
function zv(e, n, r, o) {
  if (n) {
    if (typeof n == "function")
      return process.env.NODE_ENV !== "production" && Hv(n), n(r, o);
    const s = Tn(r, n.props);
    s.ref = r.ref;
    let i = n;
    if ((i == null ? void 0 : i.$$typeof) === $v && (i = c.Children.toArray(n)[0]), process.env.NODE_ENV !== "production" && !/* @__PURE__ */ c.isValidElement(i))
      throw new Error(["Base UI: The `render` prop was provided an invalid React element as `React.isValidElement(render)` is `false`.", "A valid React element must be provided to the `render` prop because it is cloned with props to replace the default element.", "https://base-ui.com/r/invalid-render-prop"].join(`
`));
    return /* @__PURE__ */ c.cloneElement(i, s);
  }
  if (e && typeof e == "string")
    return Uv(e, r);
  throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: Render element or function are not defined." : Ze(8));
}
function Hv(e) {
  const n = e.name;
  if (n.length === 0)
    return;
  const r = n.charCodeAt(0);
  r < 65 || r > 90 || Va(`The \`render\` prop received a function named \`${n}\` that starts with an uppercase letter.`, "This usually means a React component was passed directly as `render={Component}`.", "Base UI calls `render` as a plain function, which can break the Rules of Hooks during reconciliation.", "If this is an intentional render callback, rename it to start with a lowercase letter.", "Use `render={<Component />}` or `render={(props) => <Component {...props} />}` instead.", "https://base-ui.com/r/invalid-render-prop");
}
function Uv(e, n) {
  return e === "button" ? /* @__PURE__ */ createElement("button", {
    type: "button",
    ...n,
    key: n.key
  }) : e === "img" ? /* @__PURE__ */ createElement("img", {
    alt: "",
    ...n,
    key: n.key
  }) : /* @__PURE__ */ c.createElement(e, n);
}
const mn = "none", Jt = "trigger-press", vt = "trigger-hover", ur = "trigger-focus", As = "outside-press", Vr = "item-press", Wv = "close-press", Zt = "focus-out", ao = "escape-key", os = "list-navigation", nf = "cancel-open", Ar = "sibling-open", jv = "disabled", Ls = "imperative-action", Kv = "window-resize";
function we(e, n, r, o) {
  let s = false, i = false;
  const a = o ?? ct;
  return {
    reason: e,
    event: n ?? new Event("base-ui"),
    cancel() {
      s = true;
    },
    allowPropagation() {
      i = true;
    },
    get isCanceled() {
      return s;
    },
    get isPropagationAllowed() {
      return i;
    },
    trigger: r,
    ...a
  };
}
const ia = {
  ...c
};
let Bc = 0;
function Gv(e, n = "mui") {
  const [r, o] = c.useState(e), s = e || r;
  return c.useEffect(() => {
    r == null && (Bc += 1, o(`${n}-${Bc}`));
  }, [r, n]), s;
}
const $c = ia.useId;
function er(e, n) {
  if ($c !== void 0) {
    const r = $c();
    return e ?? (n ? `${n}-${r}` : r);
  }
  return Gv(e, n);
}
function Mt(e) {
  return er(e, "base-ui");
}
const Yv = [];
function lo(e) {
  c.useEffect(e, Yv);
}
const Do = null;
let zc = globalThis.requestAnimationFrame;
class qv {
  constructor() {
    /* This implementation uses an array as a backing data-structure for frame callbacks.
     * It allows `O(1)` callback cancelling by inserting a `null` in the array, though it
     * never calls the native `cancelAnimationFrame` if there are no frames left. This can
     * be much more efficient if there is a call pattern that alterns as
     * "request-cancel-request-cancel-…".
     * But in the case of "request-request-…-cancel-cancel-…", it leaves the final animation
     * frame to run anyway. We turn that frame into a `O(1)` no-op via `callbacksCount`. */
    __publicField(this, "callbacks", []);
    __publicField(this, "callbacksCount", 0);
    __publicField(this, "nextId", 1);
    __publicField(this, "startId", 1);
    __publicField(this, "isScheduled", false);
    __publicField(this, "tick", (n) => {
      var _a2;
      this.isScheduled = false;
      const r = this.callbacks, o = this.callbacksCount;
      if (this.callbacks = [], this.callbacksCount = 0, this.startId = this.nextId, o > 0)
        for (let s = 0; s < r.length; s += 1)
          (_a2 = r[s]) == null ? void 0 : _a2.call(r, n);
    });
  }
  request(n) {
    const r = this.nextId;
    this.nextId += 1, this.callbacks.push(n), this.callbacksCount += 1;
    const o = process.env.NODE_ENV !== "production" && zc !== requestAnimationFrame && (zc = requestAnimationFrame, true);
    return (!this.isScheduled || o) && (requestAnimationFrame(this.tick), this.isScheduled = true), r;
  }
  cancel(n) {
    const r = n - this.startId;
    r < 0 || r >= this.callbacks.length || (this.callbacks[r] = null, this.callbacksCount -= 1);
  }
}
const Ao = new qv();
class dt {
  constructor() {
    __publicField(this, "currentId", Do);
    __publicField(this, "cancel", () => {
      this.currentId !== Do && (Ao.cancel(this.currentId), this.currentId = Do);
    });
    __publicField(this, "disposeEffect", () => this.cancel);
  }
  static create() {
    return new dt();
  }
  static request(n) {
    return Ao.request(n);
  }
  static cancel(n) {
    return Ao.cancel(n);
  }
  /**
   * Executes `fn` after `delay`, clearing any previously scheduled call.
   */
  request(n) {
    this.cancel(), this.currentId = Ao.request(() => {
      this.currentId = Do, n();
    });
  }
}
function co() {
  const e = xt(dt.create).current;
  return lo(e.disposeEffect), e;
}
function cn(e) {
  return e == null ? e : "current" in e ? e.current : e;
}
let gn = /* @__PURE__ */ (function(e) {
  return e.startingStyle = "data-starting-style", e.endingStyle = "data-ending-style", e;
})({});
const Xv = {
  [gn.startingStyle]: ""
}, Jv = {
  [gn.endingStyle]: ""
}, en = {
  transitionStatus(e) {
    return e === "starting" ? Xv : e === "ending" ? Jv : null;
  }
};
function Fs(e, n = false, r = true) {
  const o = co();
  return de((s, i = null) => {
    o.cancel();
    function a() {
      Tt.flushSync(s);
    }
    const l = cn(e);
    if (l == null)
      return;
    const f = l;
    if (typeof f.getAnimations != "function" || globalThis.BASE_UI_ANIMATIONS_DISABLED)
      s();
    else {
      let u = function() {
        const d = gn.startingStyle;
        if (!f.hasAttribute(d)) {
          o.request(p);
          return;
        }
        const g = new MutationObserver(() => {
          f.hasAttribute(d) || (g.disconnect(), p());
        });
        g.observe(f, {
          attributes: true,
          attributeFilter: [d]
        }), i == null ? void 0 : i.addEventListener("abort", () => g.disconnect(), {
          once: true
        });
      }, p = function() {
        Promise.all(f.getAnimations().map((d) => d.finished)).then(() => {
          (i == null ? void 0 : i.aborted) || a();
        }).catch(() => {
          const d = f.getAnimations();
          if (r) {
            if (i == null ? void 0 : i.aborted)
              return;
            a();
          } else d.length > 0 && d.some((g) => g.pending || g.playState !== "finished") && p();
        });
      };
      if (n) {
        u();
        return;
      }
      o.request(p);
    }
  });
}
function uo(e, n = false, r = false) {
  const [o, s] = c.useState(e && n ? "idle" : void 0), [i, a] = c.useState(e);
  return e && !i && (a(true), s("starting")), !e && i && o !== "ending" && !r && s("ending"), !e && !i && o === "ending" && s(void 0), ce(() => {
    if (!e && i && o !== "ending" && r) {
      const l = dt.request(() => {
        s("ending");
      });
      return () => {
        dt.cancel(l);
      };
    }
  }, [e, i, o, r]), ce(() => {
    if (!e || n)
      return;
    const l = dt.request(() => {
      s(void 0);
    });
    return () => {
      dt.cancel(l);
    };
  }, [n, e]), ce(() => {
    if (!e || !n)
      return;
    e && i && o !== "idle" && s("starting");
    const l = dt.request(() => {
      s("idle");
    });
    return () => {
      dt.cancel(l);
    };
  }, [n, e, i, s, o]), c.useMemo(() => ({
    mounted: i,
    setMounted: a,
    transitionStatus: o
  }), [i, o]);
}
function Zv(e) {
  const {
    open: n,
    defaultOpen: r,
    onOpenChange: o,
    disabled: s
  } = e, i = n !== void 0, [a, l] = Xr({
    controlled: n,
    default: r,
    name: "Collapsible",
    state: "open"
  }), {
    mounted: f,
    setMounted: u,
    transitionStatus: p
  } = uo(a, true, true), [d, g] = c.useState(a), [{
    height: m,
    width: b
  }, h] = c.useState({
    height: void 0,
    width: void 0
  }), v = Mt(), [y, x] = c.useState(), R = y ?? v, [S, E] = c.useState(false), [C, T] = c.useState(false), N = c.useRef(null), I = c.useRef(null), L = c.useRef(null), A = c.useRef(null), P = Fs(A, false), O = de((M) => {
    const D = !a, _ = we(Jt, M.nativeEvent);
    if (o(D, _), _.isCanceled)
      return;
    const k = A.current;
    I.current === "css-animation" && k != null && k.style.removeProperty("animation-name"), !S && !C && (I.current != null && I.current !== "css-animation" && !f && D && u(true), I.current === "css-animation" && (!d && D && g(true), !f && D && u(true))), l(D), I.current === "none" && f && !D && u(false);
  });
  return ce(() => {
    i && I.current === "none" && !C && !a && u(false);
  }, [i, C, a, n, u]), c.useMemo(() => ({
    abortControllerRef: N,
    animationTypeRef: I,
    disabled: s,
    handleTrigger: O,
    height: m,
    mounted: f,
    open: a,
    panelId: R,
    panelRef: A,
    runOnceAnimationsFinish: P,
    setDimensions: h,
    setHiddenUntilFound: E,
    setKeepMounted: T,
    setMounted: u,
    setOpen: l,
    setPanelIdState: x,
    setVisible: g,
    transitionDimensionRef: L,
    transitionStatus: p,
    visible: d,
    width: b
  }), [N, I, s, O, m, f, a, R, A, P, h, E, T, u, l, g, L, p, d, b]);
}
const Ua = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Ua.displayName = "CollapsibleRootContext");
function rf() {
  const e = c.useContext(Ua);
  if (e === void 0)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: CollapsibleRootContext is missing. Collapsible parts must be placed within <Collapsible.Root>." : Ze(15));
  return e;
}
let of = /* @__PURE__ */ (function(e) {
  return e[e.None = 0] = "None", e[e.GuessFromOrder = 1] = "GuessFromOrder", e;
})({});
function _s(e = {}) {
  const {
    label: n,
    metadata: r,
    textRef: o,
    indexGuessBehavior: s,
    index: i
  } = e, {
    register: a,
    unregister: l,
    subscribeMapChange: f,
    elementsRef: u,
    labelsRef: p,
    nextIndexRef: d
  } = yv(), g = c.useRef(-1), [m, b] = c.useState(i ?? (s === of.GuessFromOrder ? () => {
    if (g.current === -1) {
      const y = d.current;
      d.current += 1, g.current = y;
    }
    return g.current;
  } : -1)), h = c.useRef(null), v = c.useCallback((y) => {
    var _a2;
    if (h.current = y, m !== -1 && y !== null && (u.current[m] = y, p)) {
      const x = n !== void 0;
      p.current[m] = x ? n : ((_a2 = o == null ? void 0 : o.current) == null ? void 0 : _a2.textContent) ?? y.textContent;
    }
  }, [m, u, p, n, o]);
  return ce(() => {
    if (i != null)
      return;
    const y = h.current;
    if (y)
      return a(y, r), () => {
        l(y);
      };
  }, [i, a, l, r]), ce(() => {
    if (i == null)
      return f((y) => {
        var _a2;
        const x = h.current ? (_a2 = y.get(h.current)) == null ? void 0 : _a2.index : null;
        x != null && b(x);
      });
  }, [i, f, b]), c.useMemo(() => ({
    ref: v,
    index: m
  }), [m, v]);
}
let Br = (function(e) {
  return e.open = "data-open", e.closed = "data-closed", e[e.startingStyle = gn.startingStyle] = "startingStyle", e[e.endingStyle = gn.endingStyle] = "endingStyle", e;
})({}), Qv = /* @__PURE__ */ (function(e) {
  return e.panelOpen = "data-panel-open", e;
})({});
const ey = {
  [Br.open]: ""
}, ty = {
  [Br.closed]: ""
}, ny = {
  open(e) {
    return e ? {
      [Qv.panelOpen]: ""
    } : null;
  }
}, ry = {
  open(e) {
    return e ? ey : ty;
  }
};
function oy(e) {
  return e == null || e.hasAttribute("disabled") || e.getAttribute("aria-disabled") === "true";
}
function Vs() {
  return typeof window < "u";
}
function Mn(e) {
  return Wa(e) ? (e.nodeName || "").toLowerCase() : "#document";
}
function pt(e) {
  var n;
  return (e == null || (n = e.ownerDocument) == null ? void 0 : n.defaultView) || window;
}
function tn(e) {
  var n;
  return (n = (Wa(e) ? e.ownerDocument : e.document) || window.document) == null ? void 0 : n.documentElement;
}
function Wa(e) {
  return Vs() ? e instanceof Node || e instanceof pt(e).Node : false;
}
function Ke(e) {
  return Vs() ? e instanceof Element || e instanceof pt(e).Element : false;
}
function st(e) {
  return Vs() ? e instanceof HTMLElement || e instanceof pt(e).HTMLElement : false;
}
function Jr(e) {
  return !Vs() || typeof ShadowRoot > "u" ? false : e instanceof ShadowRoot || e instanceof pt(e).ShadowRoot;
}
function Dn(e) {
  const {
    overflow: n,
    overflowX: r,
    overflowY: o,
    display: s
  } = Vt(e);
  return /auto|scroll|overlay|hidden|clip/.test(n + o + r) && s !== "inline" && s !== "contents";
}
function sy(e) {
  return /^(table|td|th)$/.test(Mn(e));
}
function Bs(e) {
  try {
    if (e.matches(":popover-open"))
      return true;
  } catch {
  }
  try {
    return e.matches(":modal");
  } catch {
    return false;
  }
}
const iy = /transform|translate|scale|rotate|perspective|filter/, ay = /paint|layout|strict|content/, Hn = (e) => !!e && e !== "none";
let vi;
function ja(e) {
  const n = Ke(e) ? Vt(e) : e;
  return Hn(n.transform) || Hn(n.translate) || Hn(n.scale) || Hn(n.rotate) || Hn(n.perspective) || !$s() && (Hn(n.backdropFilter) || Hn(n.filter)) || iy.test(n.willChange || "") || ay.test(n.contain || "");
}
function ly(e) {
  let n = Qt(e);
  for (; st(n) && !qt(n); ) {
    if (ja(n))
      return n;
    if (Bs(n))
      return null;
    n = Qt(n);
  }
  return null;
}
function $s() {
  return vi == null && (vi = typeof CSS < "u" && CSS.supports && CSS.supports("-webkit-backdrop-filter", "none")), vi;
}
function qt(e) {
  return /^(html|body|#document)$/.test(Mn(e));
}
function Vt(e) {
  return pt(e).getComputedStyle(e);
}
function zs(e) {
  return Ke(e) ? {
    scrollLeft: e.scrollLeft,
    scrollTop: e.scrollTop
  } : {
    scrollLeft: e.scrollX,
    scrollTop: e.scrollY
  };
}
function Qt(e) {
  if (Mn(e) === "html")
    return e;
  const n = (
    // Step into the shadow DOM of the parent of a slotted node.
    e.assignedSlot || // DOM Element detected.
    e.parentNode || // ShadowRoot detected.
    Jr(e) && e.host || // Fallback.
    tn(e)
  );
  return Jr(n) ? n.host : n;
}
function sf(e) {
  const n = Qt(e);
  return qt(n) ? e.ownerDocument ? e.ownerDocument.body : e.body : st(n) && Dn(n) ? n : sf(n);
}
function Zr(e, n, r) {
  var o;
  n === void 0 && (n = []), r === void 0 && (r = true);
  const s = sf(e), i = s === ((o = e.ownerDocument) == null ? void 0 : o.body), a = pt(s);
  if (i) {
    const l = aa(a);
    return n.concat(a, a.visualViewport || [], Dn(s) ? s : [], l && r ? Zr(l) : []);
  } else
    return n.concat(s, Zr(s, [], r));
}
function aa(e) {
  return e.parent && Object.getPrototypeOf(e.parent) ? e.frameElement : null;
}
let la;
process.env.NODE_ENV !== "production" && (la = /* @__PURE__ */ new Set());
function Hc(...e) {
  if (process.env.NODE_ENV !== "production") {
    const n = e.join(" ");
    la.has(n) || (la.add(n), console.error(`Base UI: ${n}`));
  }
}
const Ka = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Ka.displayName = "CompositeRootContext");
function Ga(e = false) {
  const n = c.useContext(Ka);
  if (n === void 0 && !e)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: CompositeRootContext is missing. Composite parts must be placed within <Composite.Root>." : Ze(16));
  return n;
}
function cy(e) {
  const {
    focusableWhenDisabled: n,
    disabled: r,
    composite: o = false,
    tabIndex: s = 0,
    isNativeButton: i
  } = e, a = o && n !== false, l = o && n === false;
  return {
    props: c.useMemo(() => {
      const u = {
        // allow Tabbing away from focusableWhenDisabled elements
        onKeyDown(p) {
          r && n && p.key !== "Tab" && p.preventDefault();
        }
      };
      return o || (u.tabIndex = s, !i && r && (u.tabIndex = n ? s : -1)), (i && (n || a) || !i && r) && (u["aria-disabled"] = r), i && (!n || l) && (u.disabled = r), u;
    }, [o, r, n, a, l, i, s])
  };
}
function nn(e = {}) {
  const {
    disabled: n = false,
    focusableWhenDisabled: r,
    tabIndex: o = 0,
    native: s = true,
    composite: i
  } = e, a = c.useRef(null), l = Ga(true), f = i ?? l !== void 0, {
    props: u
  } = cy({
    focusableWhenDisabled: r,
    disabled: n,
    composite: f,
    tabIndex: o,
    isNativeButton: s
  });
  process.env.NODE_ENV !== "production" && c.useEffect(() => {
    var _a2, _b2;
    if (!a.current)
      return;
    const m = Lo(a.current);
    if (s) {
      if (!m) {
        const b = ((_a2 = ia.captureOwnerStack) == null ? void 0 : _a2.call(ia)) || "";
        Hc(`A component that acts as a button expected a native <button> because the \`nativeButton\` prop is true. Rendering a non-<button> removes native button semantics, which can impact forms and accessibility. Use a real <button> in the \`render\` prop, or set \`nativeButton\` to \`false\`.${b}`);
      }
    } else if (m) {
      const b = ((_b2 = ia.captureOwnerStack) == null ? void 0 : _b2.call(ia)) || "";
      Hc(`A component that acts as a button expected a non-<button> because the \`nativeButton\` prop is false. Rendering a <button> keeps native behavior while Base UI applies non-native attributes and handlers, which can add unintended extra attributes (such as \`role\` or \`aria-disabled\`). Use a non-<button> in the \`render\` prop, or set \`nativeButton\` to \`true\`.${b}`);
    }
  }, [s]);
  const p = c.useCallback(() => {
    const m = a.current;
    Lo(m) && f && n && u.disabled === void 0 && m.disabled && (m.disabled = false);
  }, [n, u.disabled, f]);
  ce(p, [p]);
  const d = c.useCallback((m = {}) => {
    const {
      onClick: b,
      onMouseDown: h,
      onKeyUp: v,
      onKeyDown: y,
      onPointerDown: x,
      ...R
    } = m;
    return Tn({
      type: s ? "button" : void 0,
      onClick(E) {
        if (n) {
          E.preventDefault();
          return;
        }
        b == null ? void 0 : b(E);
      },
      onMouseDown(E) {
        n || (h == null ? void 0 : h(E));
      },
      onKeyDown(E) {
        if (n || (sa(E), y == null ? void 0 : y(E), E.baseUIHandlerPrevented))
          return;
        const C = E.target === E.currentTarget, T = E.currentTarget, N = Lo(T), I = !s && uy(T), L = C && (s ? N : !I), A = E.key === "Enter", P = E.key === " ", O = T.getAttribute("role"), M = (O == null ? void 0 : O.startsWith("menuitem")) || O === "option" || O === "gridcell";
        if (C && f && P) {
          if (E.defaultPrevented && M)
            return;
          E.preventDefault(), I || s && N ? (T.click(), E.preventBaseUIHandler()) : L && (b == null ? void 0 : b(E), E.preventBaseUIHandler());
          return;
        }
        L && (!s && (P || A) && E.preventDefault(), !s && A && (b == null ? void 0 : b(E)));
      },
      onKeyUp(E) {
        if (!n) {
          if (sa(E), v == null ? void 0 : v(E), E.target === E.currentTarget && s && f && Lo(E.currentTarget) && E.key === " ") {
            E.preventDefault();
            return;
          }
          E.baseUIHandlerPrevented || E.target === E.currentTarget && !s && !f && E.key === " " && (b == null ? void 0 : b(E));
        }
      },
      onPointerDown(E) {
        if (n) {
          E.preventDefault();
          return;
        }
        x == null ? void 0 : x(E);
      }
    }, s ? void 0 : {
      role: "button"
    }, u, R);
  }, [n, u, f, s]), g = de((m) => {
    a.current = m, p();
  });
  return {
    getButtonProps: d,
    buttonRef: g
  };
}
function Lo(e) {
  return st(e) && e.tagName === "BUTTON";
}
function uy(e) {
  return !!((e == null ? void 0 : e.tagName) === "A" && (e == null ? void 0 : e.href));
}
const Sr = typeof navigator < "u", yi = dy(), af = py(), lf = fy(), Ya = typeof CSS > "u" || !CSS.supports ? false : CSS.supports("-webkit-backdrop-filter:none"), cf = (
  // iPads can claim to be MacIntel
  yi.platform === "MacIntel" && yi.maxTouchPoints > 1 ? true : /iP(hone|ad|od)|iOS/.test(yi.platform)
), uf = Sr && /apple/i.test(navigator.vendor), ca = Sr && /android/i.test(af) || /android/i.test(lf), df = Sr && af.toLowerCase().startsWith("mac") && !navigator.maxTouchPoints, ff = lf.includes("jsdom/");
function dy() {
  if (!Sr)
    return {
      platform: "",
      maxTouchPoints: -1
    };
  const e = navigator.userAgentData;
  return (e == null ? void 0 : e.platform) ? {
    platform: e.platform,
    maxTouchPoints: navigator.maxTouchPoints
  } : {
    platform: navigator.platform ?? "",
    maxTouchPoints: navigator.maxTouchPoints ?? -1
  };
}
function fy() {
  if (!Sr)
    return "";
  const e = navigator.userAgentData;
  return e && Array.isArray(e.brands) ? e.brands.map(({
    brand: n,
    version: r
  }) => `${n}/${r}`).join(" ") : navigator.userAgent;
}
function py() {
  if (!Sr)
    return "";
  const e = navigator.userAgentData;
  return (e == null ? void 0 : e.platform) ? e.platform : navigator.platform ?? "";
}
const ua = "data-base-ui-focusable", pf = "active", mf = "selected", gf = "input:not([type='hidden']):not([disabled]),[contenteditable]:not([contenteditable='false']),textarea:not([disabled])", Cn = "ArrowLeft", Sn = "ArrowRight", qa = "ArrowUp", fo = "ArrowDown";
function Ft(e) {
  var _a2;
  let n = e.activeElement;
  for (; ((_a2 = n == null ? void 0 : n.shadowRoot) == null ? void 0 : _a2.activeElement) != null; )
    n = n.shadowRoot.activeElement;
  return n;
}
function Se(e, n) {
  var _a2;
  if (!e || !n)
    return false;
  const r = (_a2 = n.getRootNode) == null ? void 0 : _a2.call(n);
  if (e.contains(n))
    return true;
  if (r && Jr(r)) {
    let o = n;
    for (; o; ) {
      if (e === o)
        return true;
      o = o.parentNode || o.host;
    }
  }
  return false;
}
function gs(e, n) {
  if (!Ke(e))
    return false;
  const r = e;
  if (n.hasElement(r))
    return !r.hasAttribute("data-trigger-disabled");
  for (const [, o] of n.entries())
    if (Se(o, r))
      return !o.hasAttribute("data-trigger-disabled");
  return false;
}
function Nt(e) {
  return "composedPath" in e ? e.composedPath()[0] : e.target;
}
function Ut(e, n) {
  if (n == null)
    return false;
  if ("composedPath" in e)
    return e.composedPath().includes(n);
  const r = e;
  return r.target != null && n.contains(r.target);
}
function my(e) {
  return e.matches("html,body");
}
function Hs(e) {
  return st(e) && e.matches(gf);
}
function da(e) {
  return e ? e.getAttribute("role") === "combobox" && Hs(e) : false;
}
function gy(e) {
  if (!e || ff)
    return true;
  try {
    return e.matches(":focus-visible");
  } catch {
    return true;
  }
}
function Qr(e) {
  return e ? e.hasAttribute(ua) ? e : e.querySelector(`[${ua}]`) || e : null;
}
function dn(e, n, r = true) {
  return e.filter((s) => {
    var _a2;
    return s.parentId === n && (!r || ((_a2 = s.context) == null ? void 0 : _a2.open));
  }).flatMap((s) => [s, ...dn(e, s.id, r)]);
}
function Uc(e, n) {
  var _a2;
  let r = [], o = (_a2 = e.find((s) => s.id === n)) == null ? void 0 : _a2.parentId;
  for (; o; ) {
    const s = e.find((i) => i.id === o);
    o = s == null ? void 0 : s.parentId, s && (r = r.concat(s));
  }
  return r;
}
function Lt(e) {
  e.preventDefault(), e.stopPropagation();
}
function hy(e) {
  return "nativeEvent" in e;
}
function hf(e) {
  return e.pointerType === "" && e.isTrusted ? true : ca && e.pointerType ? e.type === "click" && e.buttons === 1 : e.detail === 0 && !e.pointerType;
}
function bf(e) {
  return ff ? false : !ca && e.width === 0 && e.height === 0 || ca && e.width === 1 && e.height === 1 && e.pressure === 0 && e.detail === 0 && e.pointerType === "mouse" || // iOS VoiceOver returns 0.333• for width/height.
  e.width < 1 && e.height < 1 && e.pressure === 0 && e.detail === 0 && e.pointerType === "touch";
}
function hr(e, n) {
  const r = ["mouse", "pen"];
  return n || r.push("", void 0), r.includes(e);
}
function vf(e) {
  const n = e.type;
  return n === "click" || n === "mousedown" || n === "keydown" || n === "keyup";
}
const by = ["top", "right", "bottom", "left"], br = Math.min, _t = Math.max, hs = Math.round, Un = Math.floor, Xt = (e) => ({
  x: e,
  y: e
}), vy = {
  left: "right",
  right: "left",
  bottom: "top",
  top: "bottom"
};
function fa(e, n, r) {
  return _t(e, br(n, r));
}
function hn(e, n) {
  return typeof e == "function" ? e(n) : e;
}
function Pt(e) {
  return e.split("-")[0];
}
function An(e) {
  return e.split("-")[1];
}
function Xa(e) {
  return e === "x" ? "y" : "x";
}
function Ja(e) {
  return e === "y" ? "height" : "width";
}
function zt(e) {
  const n = e[0];
  return n === "t" || n === "b" ? "y" : "x";
}
function Za(e) {
  return Xa(zt(e));
}
function yy(e, n, r) {
  r === void 0 && (r = false);
  const o = An(e), s = Za(e), i = Ja(s);
  let a = s === "x" ? o === (r ? "end" : "start") ? "right" : "left" : o === "start" ? "bottom" : "top";
  return n.reference[i] > n.floating[i] && (a = bs(a)), [a, bs(a)];
}
function xy(e) {
  const n = bs(e);
  return [pa(e), n, pa(n)];
}
function pa(e) {
  return e.includes("start") ? e.replace("start", "end") : e.replace("end", "start");
}
const Wc = ["left", "right"], jc = ["right", "left"], wy = ["top", "bottom"], Ey = ["bottom", "top"];
function Cy(e, n, r) {
  switch (e) {
    case "top":
    case "bottom":
      return r ? n ? jc : Wc : n ? Wc : jc;
    case "left":
    case "right":
      return n ? wy : Ey;
    default:
      return [];
  }
}
function Sy(e, n, r, o) {
  const s = An(e);
  let i = Cy(Pt(e), r === "start", o);
  return s && (i = i.map((a) => a + "-" + s), n && (i = i.concat(i.map(pa)))), i;
}
function bs(e) {
  const n = Pt(e);
  return vy[n] + e.slice(n.length);
}
function Ry(e) {
  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    ...e
  };
}
function yf(e) {
  return typeof e != "number" ? Ry(e) : {
    top: e,
    right: e,
    bottom: e,
    left: e
  };
}
function eo(e) {
  const {
    x: n,
    y: r,
    width: o,
    height: s
  } = e;
  return {
    width: o,
    height: s,
    top: r,
    left: n,
    right: n + o,
    bottom: r + s,
    x: n,
    y: r
  };
}
function Fo(e, n, r) {
  return Math.floor(e / n) !== r;
}
function to(e, n) {
  return n < 0 || n >= e.current.length;
}
function ss(e, n) {
  return St(e, {
    disabledIndices: n
  });
}
function ma(e, n) {
  return St(e, {
    decrement: true,
    startingIndex: e.current.length,
    disabledIndices: n
  });
}
function St(e, {
  startingIndex: n = -1,
  decrement: r = false,
  disabledIndices: o,
  amount: s = 1
} = {}) {
  let i = n;
  do
    i += r ? -s : s;
  while (i >= 0 && i <= e.current.length - 1 && fn(e, i, o));
  return i;
}
function xf(e, {
  event: n,
  orientation: r,
  loopFocus: o,
  rtl: s,
  cols: i,
  disabledIndices: a,
  minIndex: l,
  maxIndex: f,
  prevIndex: u,
  stopEvent: p = false
}) {
  let d = u, g;
  if (n.key === qa ? g = "up" : n.key === fo && (g = "down"), g) {
    const m = [], b = [];
    let h = false, v = 0;
    {
      let N = null, I = -1;
      e.current.forEach((L, A) => {
        if (L == null)
          return;
        v += 1;
        const P = L.closest('[role="row"]');
        P && (h = true), (P !== N || I === -1) && (N = P, I += 1, m[I] = []), m[I].push(A), b[A] = I;
      });
    }
    let y = false, x = 0;
    if (h)
      for (const N of m) {
        const I = N.length;
        I > x && (x = I), I !== i && (y = true);
      }
    const R = y && v < e.current.length, S = x || i, E = (N) => {
      if (!y || u === -1)
        return;
      const I = b[u];
      if (I == null)
        return;
      const L = m[I].indexOf(u), A = N === "up" ? -1 : 1;
      for (let P = I + A, O = 0; O < m.length; O += 1, P += A) {
        if (P < 0 || P >= m.length) {
          if (!o || R)
            return;
          P = P < 0 ? m.length - 1 : 0;
        }
        const M = m[P];
        for (let D = Math.min(L, M.length - 1); D >= 0; D -= 1) {
          const _ = M[D];
          if (!fn(e, _, a))
            return _;
        }
      }
    }, C = (N) => {
      if (!R || u === -1)
        return;
      const I = u % S, L = N === "up" ? -S : S, A = f - f % S, P = Un(f / S) + 1;
      for (let O = u - I + L, M = 0; M < P; M += 1, O += L) {
        if (O < 0 || O > f) {
          if (!o)
            return;
          O = O < 0 ? A : 0;
        }
        const D = Math.min(O + S - 1, f);
        for (let _ = Math.min(O + I, D); _ >= O; _ -= 1)
          if (!fn(e, _, a))
            return _;
      }
    };
    p && Lt(n);
    const T = E(g) ?? C(g);
    if (T !== void 0)
      d = T;
    else if (u === -1)
      d = g === "up" ? f : l;
    else if (d = St(e, {
      startingIndex: u,
      amount: S,
      decrement: g === "up",
      disabledIndices: a
    }), o) {
      if (g === "up" && (u - S < l || d < 0)) {
        const N = u % S, I = f % S, L = f - (I - N);
        I === N ? d = f : d = I > N ? L : L - S;
      }
      g === "down" && u + S > f && (d = St(e, {
        startingIndex: u % S - S,
        amount: S,
        disabledIndices: a
      }));
    }
    to(e, d) && (d = u);
  }
  if (r === "both") {
    const m = Un(u / i);
    n.key === (s ? Cn : Sn) && (p && Lt(n), u % i !== i - 1 ? (d = St(e, {
      startingIndex: u,
      disabledIndices: a
    }), o && Fo(d, i, m) && (d = St(e, {
      startingIndex: u - u % i - 1,
      disabledIndices: a
    }))) : o && (d = St(e, {
      startingIndex: u - u % i - 1,
      disabledIndices: a
    })), Fo(d, i, m) && (d = u)), n.key === (s ? Sn : Cn) && (p && Lt(n), u % i !== 0 ? (d = St(e, {
      startingIndex: u,
      decrement: true,
      disabledIndices: a
    }), o && Fo(d, i, m) && (d = St(e, {
      startingIndex: u + (i - u % i),
      decrement: true,
      disabledIndices: a
    }))) : o && (d = St(e, {
      startingIndex: u + (i - u % i),
      decrement: true,
      disabledIndices: a
    })), Fo(d, i, m) && (d = u));
    const b = Un(f / i) === m;
    to(e, d) && (o && b ? d = n.key === (s ? Sn : Cn) ? f : St(e, {
      startingIndex: u - u % i - 1,
      disabledIndices: a
    }) : d = u);
  }
  return d;
}
function wf(e, n, r) {
  const o = [];
  let s = 0;
  return e.forEach(({
    width: i,
    height: a
  }, l) => {
    if (i > n && process.env.NODE_ENV !== "production")
      throw new Error(`[Floating UI]: Invalid grid - item width at index ${l} is greater than grid columns`);
    let f = false;
    for (r && (s = 0); !f; ) {
      const u = [];
      for (let p = 0; p < i; p += 1)
        for (let d = 0; d < a; d += 1)
          u.push(s + p + d * n);
      s % n + i <= n && u.every((p) => o[p] == null) ? (u.forEach((p) => {
        o[p] = l;
      }), f = true) : s += 1;
    }
  }), [...o];
}
function Ef(e, n, r, o, s) {
  if (e === -1)
    return -1;
  const i = r.indexOf(e), a = n[e];
  switch (s) {
    case "tl":
      return i;
    case "tr":
      return a ? i + a.width - 1 : i;
    case "bl":
      return a ? i + (a.height - 1) * o : i;
    case "br":
      return r.lastIndexOf(e);
    default:
      return -1;
  }
}
function Cf(e, n) {
  return n.flatMap((r, o) => e.includes(r) ? [o] : []);
}
function fn(e, n, r) {
  if (typeof r == "function" ? r(n) : (r == null ? void 0 : r.includes(n)) ?? false)
    return true;
  const s = e.current[n];
  return s ? Qa(s) ? !r && (s.hasAttribute("disabled") || s.getAttribute("aria-disabled") === "true") : true : false;
}
function Qa(e) {
  return Vt(e).display !== "none";
}
var Ny = ["input:not([inert]):not([inert] *)", "select:not([inert]):not([inert] *)", "textarea:not([inert]):not([inert] *)", "a[href]:not([inert]):not([inert] *)", "button:not([inert]):not([inert] *)", "[tabindex]:not(slot):not([inert]):not([inert] *)", "audio[controls]:not([inert]):not([inert] *)", "video[controls]:not([inert]):not([inert] *)", '[contenteditable]:not([contenteditable="false"]):not([inert]):not([inert] *)', "details>summary:first-of-type:not([inert]):not([inert] *)", "details:not([inert]):not([inert] *)"], vs = /* @__PURE__ */ Ny.join(","), Sf = typeof Element > "u", vr = Sf ? function() {
} : Element.prototype.matches || Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector, ys = !Sf && Element.prototype.getRootNode ? function(e) {
  var n;
  return e == null || (n = e.getRootNode) === null || n === void 0 ? void 0 : n.call(e);
} : function(e) {
  return e == null ? void 0 : e.ownerDocument;
}, xs = function(n, r) {
  var o;
  r === void 0 && (r = true);
  var s = n == null || (o = n.getAttribute) === null || o === void 0 ? void 0 : o.call(n, "inert"), i = s === "" || s === "true", a = i || r && n && // closest does not exist on shadow roots, so we fall back to a manual
  // lookup upward, in case it is not defined.
  (typeof n.closest == "function" ? n.closest("[inert]") : xs(n.parentNode));
  return a;
}, Ty = function(n) {
  var r, o = n == null || (r = n.getAttribute) === null || r === void 0 ? void 0 : r.call(n, "contenteditable");
  return o === "" || o === "true";
}, Rf = function(n, r, o) {
  if (xs(n))
    return [];
  var s = Array.prototype.slice.apply(n.querySelectorAll(vs));
  return r && vr.call(n, vs) && s.unshift(n), s = s.filter(o), s;
}, ws = function(n, r, o) {
  for (var s = [], i = Array.from(n); i.length; ) {
    var a = i.shift();
    if (!xs(a, false))
      if (a.tagName === "SLOT") {
        var l = a.assignedElements(), f = l.length ? l : a.children, u = ws(f, true, o);
        o.flatten ? s.push.apply(s, u) : s.push({
          scopeParent: a,
          candidates: u
        });
      } else {
        var p = vr.call(a, vs);
        p && o.filter(a) && (r || !n.includes(a)) && s.push(a);
        var d = a.shadowRoot || // check for an undisclosed shadow
        typeof o.getShadowRoot == "function" && o.getShadowRoot(a), g = !xs(d, false) && (!o.shadowRootFilter || o.shadowRootFilter(a));
        if (d && g) {
          var m = ws(d === true ? a.children : d.children, true, o);
          o.flatten ? s.push.apply(s, m) : s.push({
            scopeParent: a,
            candidates: m
          });
        } else
          i.unshift.apply(i, a.children);
      }
  }
  return s;
}, Nf = function(n) {
  return !isNaN(parseInt(n.getAttribute("tabindex"), 10));
}, Tf = function(n) {
  if (!n)
    throw new Error("No node provided");
  return n.tabIndex < 0 && (/^(AUDIO|VIDEO|DETAILS)$/.test(n.tagName) || Ty(n)) && !Nf(n) ? 0 : n.tabIndex;
}, ky = function(n, r) {
  var o = Tf(n);
  return o < 0 && r && !Nf(n) ? 0 : o;
}, Oy = function(n, r) {
  return n.tabIndex === r.tabIndex ? n.documentOrder - r.documentOrder : n.tabIndex - r.tabIndex;
}, kf = function(n) {
  return n.tagName === "INPUT";
}, Iy = function(n) {
  return kf(n) && n.type === "hidden";
}, Py = function(n) {
  var r = n.tagName === "DETAILS" && Array.prototype.slice.apply(n.children).some(function(o) {
    return o.tagName === "SUMMARY";
  });
  return r;
}, My = function(n, r) {
  for (var o = 0; o < n.length; o++)
    if (n[o].checked && n[o].form === r)
      return n[o];
}, Dy = function(n) {
  if (!n.name)
    return true;
  var r = n.form || ys(n), o = function(l) {
    return r.querySelectorAll('input[type="radio"][name="' + l + '"]');
  }, s;
  if (typeof window < "u" && typeof window.CSS < "u" && typeof window.CSS.escape == "function")
    s = o(window.CSS.escape(n.name));
  else
    try {
      s = o(n.name);
    } catch (a) {
      return console.error("Looks like you have a radio button with a name attribute containing invalid CSS selector characters and need the CSS.escape polyfill: %s", a.message), false;
    }
  var i = My(s, n.form);
  return !i || i === n;
}, Ay = function(n) {
  return kf(n) && n.type === "radio";
}, Ly = function(n) {
  return Ay(n) && !Dy(n);
}, Fy = function(n) {
  var r, o = n && ys(n), s = (r = o) === null || r === void 0 ? void 0 : r.host, i = false;
  if (o && o !== n) {
    var a, l, f;
    for (i = !!((a = s) !== null && a !== void 0 && (l = a.ownerDocument) !== null && l !== void 0 && l.contains(s) || n != null && (f = n.ownerDocument) !== null && f !== void 0 && f.contains(n)); !i && s; ) {
      var u, p, d;
      o = ys(s), s = (u = o) === null || u === void 0 ? void 0 : u.host, i = !!((p = s) !== null && p !== void 0 && (d = p.ownerDocument) !== null && d !== void 0 && d.contains(s));
    }
  }
  return i;
}, Kc = function(n) {
  var r = n.getBoundingClientRect(), o = r.width, s = r.height;
  return o === 0 && s === 0;
}, _y = function(n, r) {
  var o = r.displayCheck, s = r.getShadowRoot;
  if (o === "full-native" && "checkVisibility" in n) {
    var i = n.checkVisibility({
      // Checking opacity might be desirable for some use cases, but natively,
      // opacity zero elements _are_ focusable and tabbable.
      checkOpacity: false,
      opacityProperty: false,
      contentVisibilityAuto: true,
      visibilityProperty: true,
      // This is an alias for `visibilityProperty`. Contemporary browsers
      // support both. However, this alias has wider browser support (Chrome
      // >= 105 and Firefox >= 106, vs. Chrome >= 121 and Firefox >= 122), so
      // we include it anyway.
      checkVisibilityCSS: true
    });
    return !i;
  }
  if (getComputedStyle(n).visibility === "hidden")
    return true;
  var a = vr.call(n, "details>summary:first-of-type"), l = a ? n.parentElement : n;
  if (vr.call(l, "details:not([open]) *"))
    return true;
  if (!o || o === "full" || // full-native can run this branch when it falls through in case
  // Element#checkVisibility is unsupported
  o === "full-native" || o === "legacy-full") {
    if (typeof s == "function") {
      for (var f = n; n; ) {
        var u = n.parentElement, p = ys(n);
        if (u && !u.shadowRoot && s(u) === true)
          return Kc(n);
        n.assignedSlot ? n = n.assignedSlot : !u && p !== n.ownerDocument ? n = p.host : n = u;
      }
      n = f;
    }
    if (Fy(n))
      return !n.getClientRects().length;
    if (o !== "legacy-full")
      return true;
  } else if (o === "non-zero-area")
    return Kc(n);
  return false;
}, Vy = function(n) {
  if (/^(INPUT|BUTTON|SELECT|TEXTAREA)$/.test(n.tagName))
    for (var r = n.parentElement; r; ) {
      if (r.tagName === "FIELDSET" && r.disabled) {
        for (var o = 0; o < r.children.length; o++) {
          var s = r.children.item(o);
          if (s.tagName === "LEGEND")
            return vr.call(r, "fieldset[disabled] *") ? true : !s.contains(n);
        }
        return true;
      }
      r = r.parentElement;
    }
  return false;
}, ga = function(n, r) {
  return !(r.disabled || Iy(r) || _y(r, n) || // For a details element with a summary, the summary element gets the focus
  Py(r) || Vy(r));
}, ha = function(n, r) {
  return !(Ly(r) || Tf(r) < 0 || !ga(n, r));
}, By = function(n) {
  var r = parseInt(n.getAttribute("tabindex"), 10);
  return !!(isNaN(r) || r >= 0);
}, Of = function(n) {
  var r = [], o = [];
  return n.forEach(function(s, i) {
    var a = !!s.scopeParent, l = a ? s.scopeParent : s, f = ky(l, a), u = a ? Of(s.candidates) : l;
    f === 0 ? a ? r.push.apply(r, u) : r.push(l) : o.push({
      documentOrder: i,
      tabIndex: f,
      item: s,
      isScope: a,
      content: u
    });
  }), o.sort(Oy).reduce(function(s, i) {
    return i.isScope ? s.push.apply(s, i.content) : s.push(i.content), s;
  }, []).concat(r);
}, po = function(n, r) {
  r = r || {};
  var o;
  return r.getShadowRoot ? o = ws([n], r.includeContainer, {
    filter: ha.bind(null, r),
    flatten: false,
    getShadowRoot: r.getShadowRoot,
    shadowRootFilter: By
  }) : o = Rf(n, r.includeContainer, ha.bind(null, r)), Of(o);
}, $y = function(n, r) {
  r = r || {};
  var o;
  return r.getShadowRoot ? o = ws([n], r.includeContainer, {
    filter: ga.bind(null, r),
    flatten: true,
    getShadowRoot: r.getShadowRoot
  }) : o = Rf(n, r.includeContainer, ga.bind(null, r)), o;
}, If = function(n, r) {
  if (r = r || {}, !n)
    throw new Error("No node provided");
  return vr.call(n, vs) === false ? false : ha(r, n);
};
function He(e) {
  return (e == null ? void 0 : e.ownerDocument) || document;
}
const Rr = () => ({
  getShadowRoot: true,
  displayCheck: (
    // JSDOM does not support the `tabbable` library. To solve this we can
    // check if `ResizeObserver` is a real function (not polyfilled), which
    // determines if the current environment is JSDOM-like.
    typeof ResizeObserver == "function" && ResizeObserver.toString().includes("[native code]") ? "full" : "none"
  )
});
function Pf(e, n) {
  const r = po(e, Rr()), o = r.length;
  if (o === 0)
    return;
  const s = Ft(He(e)), i = r.indexOf(s), a = i === -1 ? n === 1 ? 0 : o - 1 : i + n;
  return r[a];
}
function Us(e) {
  return Pf(He(e).body, 1) || e;
}
function Mf(e) {
  return Pf(He(e).body, -1) || e;
}
function Df(e, n) {
  if (!e)
    return null;
  const r = po(He(e).body, Rr()), o = r.length;
  if (o === 0)
    return null;
  const s = r.indexOf(e);
  if (s === -1)
    return null;
  const i = (s + n + o) % o;
  return r[i];
}
function Af(e) {
  return Df(e, 1);
}
function Lf(e) {
  return Df(e, -1);
}
function Gn(e, n) {
  const r = n || e.currentTarget, o = e.relatedTarget;
  return !o || !Se(r, o);
}
function zy(e) {
  po(e, Rr()).forEach((r) => {
    r.dataset.tabindex = r.getAttribute("tabindex") || "", r.setAttribute("tabindex", "-1");
  });
}
function Gc(e) {
  e.querySelectorAll("[data-tabindex]").forEach((r) => {
    const o = r.dataset.tabindex;
    delete r.dataset.tabindex, o ? r.setAttribute("tabindex", o) : r.removeAttribute("tabindex");
  });
}
const dr = "ArrowUp", Wn = "ArrowDown", no = "ArrowLeft", fr = "ArrowRight", mo = "Home", go = "End", Ff = /* @__PURE__ */ new Set([no, fr]), Hy = /* @__PURE__ */ new Set([no, fr, mo, go]), _f = /* @__PURE__ */ new Set([dr, Wn]), Uy = /* @__PURE__ */ new Set([dr, Wn, mo, go]), Vf = /* @__PURE__ */ new Set([...Ff, ..._f]), Wy = /* @__PURE__ */ new Set([...Vf, mo, go]), Ws = /* @__PURE__ */ new Set([dr, Wn, no, fr, mo, go]), jy = "Shift", Ky = "Control", Gy = "Alt", Yy = "Meta", qy = /* @__PURE__ */ new Set([jy, Ky, Gy, Yy]);
function Xy(e) {
  return st(e) && e.tagName === "INPUT";
}
function Yc(e) {
  return !!(Xy(e) && e.selectionStart != null || st(e) && e.tagName === "TEXTAREA");
}
function qc(e, n, r, o) {
  if (!e || !n || !n.scrollTo)
    return;
  let s = e.scrollLeft, i = e.scrollTop;
  const a = e.clientWidth < e.scrollWidth, l = e.clientHeight < e.scrollHeight;
  if (a && o !== "vertical") {
    const f = Xc(e, n, "left"), u = _o(e), p = _o(n);
    r === "ltr" && (f + n.offsetWidth + p.scrollMarginRight > e.scrollLeft + e.clientWidth - u.scrollPaddingRight ? s = f + n.offsetWidth + p.scrollMarginRight - e.clientWidth + u.scrollPaddingRight : f - p.scrollMarginLeft < e.scrollLeft + u.scrollPaddingLeft && (s = f - p.scrollMarginLeft - u.scrollPaddingLeft)), r === "rtl" && (f - p.scrollMarginRight < e.scrollLeft + u.scrollPaddingLeft ? s = f - p.scrollMarginLeft - u.scrollPaddingLeft : f + n.offsetWidth + p.scrollMarginRight > e.scrollLeft + e.clientWidth - u.scrollPaddingRight && (s = f + n.offsetWidth + p.scrollMarginRight - e.clientWidth + u.scrollPaddingRight));
  }
  if (l && o !== "horizontal") {
    const f = Xc(e, n, "top"), u = _o(e), p = _o(n);
    f - p.scrollMarginTop < e.scrollTop + u.scrollPaddingTop ? i = f - p.scrollMarginTop - u.scrollPaddingTop : f + n.offsetHeight + p.scrollMarginBottom > e.scrollTop + e.clientHeight - u.scrollPaddingBottom && (i = f + n.offsetHeight + p.scrollMarginBottom - e.clientHeight + u.scrollPaddingBottom);
  }
  e.scrollTo({
    left: s,
    top: i,
    behavior: "auto"
  });
}
function Xc(e, n, r) {
  const o = r === "left" ? "offsetLeft" : "offsetTop";
  let s = 0;
  for (; n.offsetParent && (s += n[o], n.offsetParent !== e); )
    n = n.offsetParent;
  return s;
}
function _o(e) {
  const n = getComputedStyle(e);
  return {
    scrollMarginTop: parseFloat(n.scrollMarginTop) || 0,
    scrollMarginRight: parseFloat(n.scrollMarginRight) || 0,
    scrollMarginBottom: parseFloat(n.scrollMarginBottom) || 0,
    scrollMarginLeft: parseFloat(n.scrollMarginLeft) || 0,
    scrollPaddingTop: parseFloat(n.scrollPaddingTop) || 0,
    scrollPaddingRight: parseFloat(n.scrollPaddingRight) || 0,
    scrollPaddingBottom: parseFloat(n.scrollPaddingBottom) || 0,
    scrollPaddingLeft: parseFloat(n.scrollPaddingLeft) || 0
  };
}
let Jy = /* @__PURE__ */ (function(e) {
  return e.disabled = "data-disabled", e.orientation = "data-orientation", e;
})({});
function Zy(e) {
  const {
    abortControllerRef: n,
    animationTypeRef: r,
    externalRef: o,
    height: s,
    hiddenUntilFound: i,
    keepMounted: a,
    id: l,
    mounted: f,
    onOpenChange: u,
    open: p,
    panelRef: d,
    runOnceAnimationsFinish: g,
    setDimensions: m,
    setMounted: b,
    setOpen: h,
    setVisible: v,
    transitionDimensionRef: y,
    visible: x,
    width: R
  } = e, S = c.useRef(false), E = c.useRef(null), C = c.useRef(p), T = c.useRef(p), N = co(), I = c.useMemo(() => r.current === "css-animation" ? !x : !p && !f, [p, f, x, r]), L = de((P) => {
    if (!P)
      return;
    if (r.current == null || y.current == null) {
      const D = getComputedStyle(P), _ = D.animationName !== "none" && D.animationName !== "", k = D.transitionDuration !== "0s" && D.transitionDuration !== "";
      _ && k ? process.env.NODE_ENV !== "production" && Va("CSS transitions and CSS animations both detected on Collapsible or Accordion panel.", "Only one of either animation type should be used.") : D.animationName === "none" && D.transitionDuration !== "0s" ? r.current = "css-transition" : D.animationName !== "none" && D.transitionDuration === "0s" ? r.current = "css-animation" : r.current = "none", P.getAttribute(Jy.orientation) === "horizontal" || D.transitionProperty.indexOf("width") > -1 ? y.current = "width" : y.current = "height";
    }
    if (r.current !== "css-transition")
      return;
    (s === void 0 || R === void 0) && (m({
      height: P.scrollHeight,
      width: P.scrollWidth
    }), T.current && P.style.setProperty("transition-duration", "0s"));
    let O = -1, M = -1;
    return O = dt.request(() => {
      T.current = false, M = dt.request(() => {
        setTimeout(() => {
          P.style.removeProperty("transition-duration");
        });
      });
    }), () => {
      dt.cancel(O), dt.cancel(M);
    };
  }), A = Wt(o, d, L);
  return ce(() => {
    if (r.current !== "css-transition")
      return;
    const P = d.current;
    if (!P)
      return;
    let O = -1;
    if (n.current != null && (n.current.abort(), n.current = null), p) {
      const M = {
        "justify-content": P.style.justifyContent,
        "align-items": P.style.alignItems,
        "align-content": P.style.alignContent,
        "justify-items": P.style.justifyItems
      };
      Object.keys(M).forEach((D) => {
        P.style.setProperty(D, "initial", "important");
      }), !T.current && !a && P.setAttribute(Br.startingStyle, ""), m({
        height: P.scrollHeight,
        width: P.scrollWidth
      }), O = dt.request(() => {
        Object.entries(M).forEach(([D, _]) => {
          _ === "" ? P.style.removeProperty(D) : P.style.setProperty(D, _);
        });
      });
    } else {
      if (P.scrollHeight === 0 && P.scrollWidth === 0)
        return;
      m({
        height: P.scrollHeight,
        width: P.scrollWidth
      });
      const M = new AbortController();
      n.current = M;
      const D = M.signal;
      let _ = null;
      const k = Br.endingStyle;
      return _ = new MutationObserver(($) => {
        $.some((z) => z.type === "attributes" && z.attributeName === k) && (_ == null ? void 0 : _.disconnect(), _ = null, g(() => {
          m({
            height: 0,
            width: 0
          }), P.style.removeProperty("content-visibility"), b(false), n.current === M && (n.current = null);
        }, D));
      }), _.observe(P, {
        attributes: true,
        attributeFilter: [k]
      }), () => {
        _ == null ? void 0 : _.disconnect(), N.cancel(), n.current === M && (M.abort(), n.current = null);
      };
    }
    return () => {
      dt.cancel(O);
    };
  }, [n, r, N, i, a, f, p, d, g, m, b]), ce(() => {
    if (r.current !== "css-animation")
      return;
    const P = d.current;
    P && (E.current = P.style.animationName || E.current, P.style.setProperty("animation-name", "none"), m({
      height: P.scrollHeight,
      width: P.scrollWidth
    }), !C.current && !S.current && P.style.removeProperty("animation-name"), p ? (n.current != null && (n.current.abort(), n.current = null), b(true), v(true)) : (n.current = new AbortController(), g(() => {
      b(false), v(false), n.current = null;
    }, n.current.signal)));
  }, [n, r, p, d, g, m, b, v, x]), lo(() => {
    const P = dt.request(() => {
      C.current = false;
    });
    return () => dt.cancel(P);
  }), ce(() => {
    if (!i)
      return;
    const P = d.current;
    if (!P)
      return;
    let O = -1, M = -1;
    return p && S.current && (P.style.transitionDuration = "0s", m({
      height: P.scrollHeight,
      width: P.scrollWidth
    }), O = dt.request(() => {
      S.current = false, M = dt.request(() => {
        setTimeout(() => {
          P.style.removeProperty("transition-duration");
        });
      });
    })), () => {
      dt.cancel(O), dt.cancel(M);
    };
  }, [i, p, d, m]), ce(() => {
    const P = d.current;
    P && i && I && (P.setAttribute("hidden", "until-found"), r.current === "css-transition" && P.setAttribute(Br.startingStyle, ""));
  }, [i, I, r, d]), c.useEffect(function() {
    const O = d.current;
    if (!O)
      return;
    function M(D) {
      S.current = true, h(true), u(true, we(mn, D));
    }
    return O.addEventListener("beforematch", M), () => {
      O.removeEventListener("beforematch", M);
    };
  }, [u, d, h]), c.useMemo(() => ({
    props: {
      hidden: I,
      id: l,
      ref: A
    }
  }), [I, l, A]);
}
function rn(e) {
  const {
    enabled: n = true,
    open: r,
    ref: o,
    onComplete: s
  } = e, i = de(s), a = Fs(o, r, false);
  c.useEffect(() => {
    if (!n)
      return;
    const l = new AbortController();
    return a(i, l.signal), () => {
      l.abort();
    };
  }, [n, r, i, a]);
}
const Ir = 0;
class Ht {
  constructor() {
    __publicField(this, "currentId", Ir);
    __publicField(this, "clear", () => {
      this.currentId !== Ir && (clearTimeout(this.currentId), this.currentId = Ir);
    });
    __publicField(this, "disposeEffect", () => this.clear);
  }
  static create() {
    return new Ht();
  }
  /**
   * Executes `fn` after `delay`, clearing any previously scheduled call.
   */
  start(n, r) {
    this.clear(), this.currentId = setTimeout(() => {
      this.currentId = Ir, r();
    }, n);
  }
  isStarted() {
    return this.currentId !== Ir;
  }
}
function ht() {
  const e = xt(Ht.create).current;
  return lo(e.disposeEffect), e;
}
let Jc = {}, Zc = {}, Qc = "";
function Qy(e) {
  if (typeof document > "u")
    return false;
  const n = He(e);
  return pt(n).innerWidth - n.documentElement.clientWidth > 0;
}
function ex(e) {
  if (!(typeof CSS < "u" && CSS.supports && CSS.supports("scrollbar-gutter", "stable")) || typeof document > "u")
    return false;
  const r = He(e), o = r.documentElement, s = r.body, i = Dn(o) ? o : s, a = i.style.overflowY, l = o.style.scrollbarGutter;
  o.style.scrollbarGutter = "stable", i.style.overflowY = "scroll";
  const f = i.offsetWidth;
  i.style.overflowY = "hidden";
  const u = i.offsetWidth;
  return i.style.overflowY = a, o.style.scrollbarGutter = l, f === u;
}
function tx(e) {
  const n = He(e), r = n.documentElement, o = n.body, s = Dn(r) ? r : o, i = {
    overflowY: s.style.overflowY,
    overflowX: s.style.overflowX
  };
  return Object.assign(s.style, {
    overflowY: "hidden",
    overflowX: "hidden"
  }), () => {
    Object.assign(s.style, i);
  };
}
function nx(e) {
  var _a2;
  const n = He(e), r = n.documentElement, o = n.body, s = pt(r);
  let i = 0, a = 0, l = false;
  const f = dt.create();
  if (Ya && (((_a2 = s.visualViewport) == null ? void 0 : _a2.scale) ?? 1) !== 1)
    return () => {
    };
  function u() {
    const g = s.getComputedStyle(r), m = s.getComputedStyle(o), v = (g.scrollbarGutter || "").includes("both-edges") ? "stable both-edges" : "stable";
    i = r.scrollTop, a = r.scrollLeft, Jc = {
      scrollbarGutter: r.style.scrollbarGutter,
      overflowY: r.style.overflowY,
      overflowX: r.style.overflowX
    }, Qc = r.style.scrollBehavior, Zc = {
      position: o.style.position,
      height: o.style.height,
      width: o.style.width,
      boxSizing: o.style.boxSizing,
      overflowY: o.style.overflowY,
      overflowX: o.style.overflowX,
      scrollBehavior: o.style.scrollBehavior
    };
    const y = r.scrollHeight > r.clientHeight, x = r.scrollWidth > r.clientWidth, R = g.overflowY === "scroll" || m.overflowY === "scroll", S = g.overflowX === "scroll" || m.overflowX === "scroll", E = Math.max(0, s.innerWidth - o.clientWidth), C = Math.max(0, s.innerHeight - o.clientHeight), T = parseFloat(m.marginTop) + parseFloat(m.marginBottom), N = parseFloat(m.marginLeft) + parseFloat(m.marginRight), I = Dn(r) ? r : o;
    if (l = ex(e), l) {
      r.style.scrollbarGutter = v, I.style.overflowY = "hidden", I.style.overflowX = "hidden";
      return;
    }
    Object.assign(r.style, {
      scrollbarGutter: v,
      overflowY: "hidden",
      overflowX: "hidden"
    }), (y || R) && (r.style.overflowY = "scroll"), (x || S) && (r.style.overflowX = "scroll"), Object.assign(o.style, {
      position: "relative",
      height: T || C ? `calc(100dvh - ${T + C}px)` : "100dvh",
      width: N || E ? `calc(100vw - ${N + E}px)` : "100vw",
      boxSizing: "border-box",
      overflow: "hidden",
      scrollBehavior: "unset"
    }), o.scrollTop = i, o.scrollLeft = a, r.setAttribute("data-base-ui-scroll-locked", ""), r.style.scrollBehavior = "unset";
  }
  function p() {
    Object.assign(r.style, Jc), Object.assign(o.style, Zc), l || (r.scrollTop = i, r.scrollLeft = a, r.removeAttribute("data-base-ui-scroll-locked"), r.style.scrollBehavior = Qc);
  }
  function d() {
    p(), f.request(u);
  }
  return u(), s.addEventListener("resize", d), () => {
    f.cancel(), p(), typeof s.removeEventListener == "function" && s.removeEventListener("resize", d);
  };
}
class rx {
  constructor() {
    __publicField(this, "lockCount", 0);
    __publicField(this, "restore", null);
    __publicField(this, "timeoutLock", Ht.create());
    __publicField(this, "timeoutUnlock", Ht.create());
    __publicField(this, "release", () => {
      this.lockCount -= 1, this.lockCount === 0 && this.restore && this.timeoutUnlock.start(0, this.unlock);
    });
    __publicField(this, "unlock", () => {
      var _a2;
      this.lockCount === 0 && this.restore && ((_a2 = this.restore) == null ? void 0 : _a2.call(this), this.restore = null);
    });
  }
  acquire(n) {
    return this.lockCount += 1, this.lockCount === 1 && this.restore === null && this.timeoutLock.start(0, () => this.lock(n)), this.release;
  }
  lock(n) {
    if (this.lockCount === 0 || this.restore !== null)
      return;
    const o = He(n).documentElement, s = pt(o).getComputedStyle(o).overflowY;
    if (s === "hidden" || s === "clip") {
      this.restore = It;
      return;
    }
    const i = cf || !Qy(n);
    this.restore = i ? tx(n) : nx(n);
  }
}
const ox = new rx();
function js(e = true, n = null) {
  ce(() => {
    if (e)
      return ox.acquire(n);
  }, [e, n]);
}
function sx(e, n) {
  return n != null && !hr(n) ? 0 : typeof e == "function" ? e() : e;
}
function $r(e, n, r) {
  const o = sx(e, r);
  return typeof o == "number" ? o : o == null ? void 0 : o[n];
}
function eu(e) {
  return typeof e == "function" ? e() : e;
}
function Bf(e, n) {
  return n || e === "click" || e === "mousedown";
}
const el = /* @__PURE__ */ c.createContext({
  hasProvider: false,
  timeoutMs: 0,
  delayRef: {
    current: 0
  },
  initialDelayRef: {
    current: 0
  },
  timeout: new Ht(),
  currentIdRef: {
    current: null
  },
  currentContextRef: {
    current: null
  }
});
process.env.NODE_ENV !== "production" && (el.displayName = "FloatingDelayGroupContext");
function ix(e) {
  const {
    children: n,
    delay: r,
    timeoutMs: o = 0
  } = e, s = c.useRef(r), i = c.useRef(r), a = c.useRef(null), l = c.useRef(null), f = ht();
  return /* @__PURE__ */ jsx(el.Provider, {
    value: c.useMemo(() => ({
      hasProvider: true,
      delayRef: s,
      initialDelayRef: i,
      currentIdRef: a,
      timeoutMs: o,
      currentContextRef: l,
      timeout: f
    }), [o, f]),
    children: n
  });
}
function ax(e, n = {
  open: false
}) {
  const r = "rootStore" in e ? e.rootStore : e, o = r.useState("floatingId"), {
    open: s
  } = n, i = c.useContext(el), {
    currentIdRef: a,
    delayRef: l,
    timeoutMs: f,
    initialDelayRef: u,
    currentContextRef: p,
    hasProvider: d,
    timeout: g
  } = i, [m, b] = c.useState(false);
  return ce(() => {
    function h() {
      var _a2;
      b(false), (_a2 = p.current) == null ? void 0 : _a2.setIsInstantPhase(false), a.current = null, p.current = null, l.current = u.current;
    }
    if (a.current && !s && a.current === o) {
      if (b(false), f) {
        const v = o;
        return g.start(f, () => {
          r.select("open") || a.current && a.current !== v || h();
        }), () => {
          g.clear();
        };
      }
      h();
    }
  }, [s, o, a, l, f, u, p, g, r]), ce(() => {
    if (!s)
      return;
    const h = p.current, v = a.current;
    g.clear(), p.current = {
      onOpenChange: r.setOpen,
      setIsInstantPhase: b
    }, a.current = o, l.current = {
      open: 0,
      close: $r(u.current, "close")
    }, v !== null && v !== o ? (b(true), h == null ? void 0 : h.setIsInstantPhase(true), h == null ? void 0 : h.onOpenChange(false, we(mn))) : (b(false), h == null ? void 0 : h.setIsInstantPhase(false));
  }, [s, o, r, a, l, f, u, p, g]), ce(() => () => {
    p.current = null;
  }, [p]), c.useMemo(() => ({
    hasProvider: d,
    delayRef: l,
    isInstantPhase: m
  }), [d, l, m]);
}
function yt(e) {
  const n = xt(lx, e).current;
  return n.next = e, ce(n.effect), n;
}
function lx(e) {
  const n = {
    current: e,
    next: e,
    effect: () => {
      n.current = n.next;
    }
  };
  return n;
}
const $f = {
  clipPath: "inset(50%)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  border: 0,
  padding: 0,
  width: 1,
  height: 1,
  margin: -1
}, Ks = {
  ...$f,
  position: "fixed",
  top: 0,
  left: 0
}, zf = {
  ...$f,
  position: "absolute"
}, bn = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const [o, s] = c.useState();
  return ce(() => {
    uf && s("button");
  }, []), /* @__PURE__ */ jsx("span", {
    ...n,
    ref: r,
    style: Ks,
    "aria-hidden": o ? void 0 : true,
    ...{
      tabIndex: 0,
      // Role is only for VoiceOver
      role: o
    },
    "data-base-ui-focus-guard": ""
  });
});
process.env.NODE_ENV !== "production" && (bn.displayName = "FocusGuard");
function ro(e) {
  return `data-base-ui-${e}`;
}
let tu = 0;
function zr(e, n = {}) {
  const {
    preventScroll: r = false,
    cancelPrevious: o = true,
    sync: s = false
  } = n;
  o && cancelAnimationFrame(tu);
  const i = () => e == null ? void 0 : e.focus({
    preventScroll: r
  });
  s ? i() : tu = requestAnimationFrame(i);
}
const xi = {
  inert: /* @__PURE__ */ new WeakMap(),
  "aria-hidden": /* @__PURE__ */ new WeakMap()
}, nu = "data-base-ui-inert", ba = {
  inert: /* @__PURE__ */ new WeakSet(),
  "aria-hidden": /* @__PURE__ */ new WeakSet()
};
let Pr = /* @__PURE__ */ new WeakMap(), wi = 0;
function cx(e) {
  return ba[e];
}
function Hf(e) {
  return e ? Jr(e) ? e.host : Hf(e.parentNode) : null;
}
const Ei = (e, n) => n.map((r) => {
  if (e.contains(r))
    return r;
  const o = Hf(r);
  return e.contains(o) ? o : null;
}).filter((r) => r != null), ru = (e) => {
  const n = /* @__PURE__ */ new Set();
  return e.forEach((r) => {
    let o = r;
    for (; o && !n.has(o); )
      n.add(o), o = o.parentNode;
  }), n;
}, ou = (e, n, r) => {
  const o = [], s = (i) => {
    !i || r.has(i) || Array.from(i.children).forEach((a) => {
      Mn(a) !== "script" && (n.has(a) ? s(a) : o.push(a));
    });
  };
  return s(e), o;
};
function ux(e, n, r, o, {
  mark: s = true,
  markerIgnoreElements: i = []
}) {
  const a = o ? "inert" : r ? "aria-hidden" : null;
  let l = null, f = null;
  const u = Ei(n, e), p = s ? Ei(n, i) : [], d = new Set(p), g = s ? ou(n, ru(u), new Set(u)).filter((h) => !d.has(h)) : [], m = [], b = [];
  if (a) {
    const h = xi[a], v = cx(a);
    f = v, l = h;
    const y = Ei(n, Array.from(n.querySelectorAll("[aria-live]"))), x = u.concat(y);
    ou(n, ru(x), new Set(x)).forEach((S) => {
      const E = S.getAttribute(a), C = E !== null && E !== "false", T = (h.get(S) || 0) + 1;
      h.set(S, T), m.push(S), T === 1 && C && v.add(S), C || S.setAttribute(a, a === "inert" ? "" : "true");
    });
  }
  return s && g.forEach((h) => {
    const v = (Pr.get(h) || 0) + 1;
    Pr.set(h, v), b.push(h), v === 1 && h.setAttribute(nu, "");
  }), wi += 1, () => {
    l && m.forEach((h) => {
      const y = (l.get(h) || 0) - 1;
      l.set(h, y), y || (!(f == null ? void 0 : f.has(h)) && a && h.removeAttribute(a), f == null ? void 0 : f.delete(h));
    }), s && b.forEach((h) => {
      const v = (Pr.get(h) || 0) - 1;
      Pr.set(h, v), v || h.removeAttribute(nu);
    }), wi -= 1, wi || (xi.inert = /* @__PURE__ */ new WeakMap(), xi["aria-hidden"] = /* @__PURE__ */ new WeakMap(), ba.inert = /* @__PURE__ */ new WeakSet(), ba["aria-hidden"] = /* @__PURE__ */ new WeakSet(), Pr = /* @__PURE__ */ new WeakMap());
  };
}
function su(e, n = {}) {
  const {
    ariaHidden: r = false,
    inert: o = false,
    mark: s = true,
    markerIgnoreElements: i = []
  } = n, a = He(e[0]).body;
  return ux(e, a, r, o, {
    mark: s,
    markerIgnoreElements: i
  });
}
const tl = /* @__PURE__ */ c.createContext(null);
process.env.NODE_ENV !== "production" && (tl.displayName = "PortalContext");
const Uf = () => c.useContext(tl), dx = ro("portal");
function Wf(e = {}) {
  var _a2;
  const {
    ref: n,
    container: r,
    componentProps: o = ct,
    elementProps: s
  } = e, i = er(), l = (_a2 = Uf()) == null ? void 0 : _a2.portalNode, [f, u] = c.useState(null), [p, d] = c.useState(null), g = de((v) => {
    v !== null && d(v);
  }), m = c.useRef(null);
  ce(() => {
    if (r === null) {
      m.current && (m.current = null, d(null), u(null));
      return;
    }
    if (i == null)
      return;
    const v = (r && (Wa(r) ? r : r.current)) ?? l ?? document.body;
    if (v == null) {
      m.current && (m.current = null, d(null), u(null));
      return;
    }
    m.current !== v && (m.current = v, d(null), u(v));
  }, [r, l, i]);
  const b = Pe("div", o, {
    ref: [n, g],
    props: [{
      id: i,
      [dx]: ""
    }, s]
  });
  return {
    portalNode: p,
    portalSubtree: f && b ? /* @__PURE__ */ Tt.createPortal(b, f) : null
  };
}
const ho = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    children: o,
    container: s,
    className: i,
    render: a,
    renderGuards: l,
    ...f
  } = n, {
    portalNode: u,
    portalSubtree: p
  } = Wf({
    container: s,
    ref: r,
    componentProps: n,
    elementProps: f
  }), d = c.useRef(null), g = c.useRef(null), m = c.useRef(null), b = c.useRef(null), [h, v] = c.useState(null), y = h == null ? void 0 : h.modal, x = h == null ? void 0 : h.open, R = typeof l == "boolean" ? l : !!h && !h.modal && h.open && !!u;
  c.useEffect(() => {
    if (!u || y)
      return;
    function E(C) {
      u && C.relatedTarget && Gn(C) && (C.type === "focusin" ? Gc : zy)(u);
    }
    return u.addEventListener("focusin", E, true), u.addEventListener("focusout", E, true), () => {
      u.removeEventListener("focusin", E, true), u.removeEventListener("focusout", E, true);
    };
  }, [u, y]), c.useEffect(() => {
    !u || x || Gc(u);
  }, [x, u]);
  const S = c.useMemo(() => ({
    beforeOutsideRef: d,
    afterOutsideRef: g,
    beforeInsideRef: m,
    afterInsideRef: b,
    portalNode: u,
    setFocusManagerState: v
  }), [u]);
  return /* @__PURE__ */ jsxs(c.Fragment, {
    children: [p, /* @__PURE__ */ jsxs(tl.Provider, {
      value: S,
      children: [R && u && /* @__PURE__ */ jsx(bn, {
        "data-type": "outside",
        ref: d,
        onFocus: (E) => {
          var _a2, _b2;
          if (Gn(E, u))
            (_a2 = m.current) == null ? void 0 : _a2.focus();
          else {
            const C = h ? h.domReference : null;
            (_b2 = Mf(C)) == null ? void 0 : _b2.focus();
          }
        }
      }), R && u && /* @__PURE__ */ jsx("span", {
        "aria-owns": u.id,
        style: Vv
      }), u && /* @__PURE__ */ Tt.createPortal(o, u), R && u && /* @__PURE__ */ jsx(bn, {
        "data-type": "outside",
        ref: g,
        onFocus: (E) => {
          var _a2, _b2;
          if (Gn(E, u))
            (_a2 = b.current) == null ? void 0 : _a2.focus();
          else {
            const C = h ? h.domReference : null;
            (_b2 = Us(C)) == null ? void 0 : _b2.focus(), (h == null ? void 0 : h.closeOnFocusOut) && (h == null ? void 0 : h.onOpenChange(false, we(Zt, E.nativeEvent)));
          }
        }
      })]
    })]
  });
});
process.env.NODE_ENV !== "production" && (ho.displayName = "FloatingPortal");
function jf() {
  const e = /* @__PURE__ */ new Map();
  return {
    emit(n, r) {
      var _a2;
      (_a2 = e.get(n)) == null ? void 0 : _a2.forEach((o) => o(r));
    },
    on(n, r) {
      e.has(n) || e.set(n, /* @__PURE__ */ new Set()), e.get(n).add(r);
    },
    off(n, r) {
      var _a2;
      (_a2 = e.get(n)) == null ? void 0 : _a2.delete(r);
    }
  };
}
class nl {
  constructor() {
    __publicField(this, "nodesRef", {
      current: []
    });
    __publicField(this, "events", jf());
  }
  addNode(n) {
    this.nodesRef.current.push(n);
  }
  removeNode(n) {
    const r = this.nodesRef.current.findIndex((o) => o === n);
    r !== -1 && this.nodesRef.current.splice(r, 1);
  }
}
const rl = /* @__PURE__ */ c.createContext(null);
process.env.NODE_ENV !== "production" && (rl.displayName = "FloatingNodeContext");
const ol = /* @__PURE__ */ c.createContext(null);
process.env.NODE_ENV !== "production" && (ol.displayName = "FloatingTreeContext");
const on = () => {
  var _a2;
  return ((_a2 = c.useContext(rl)) == null ? void 0 : _a2.id) || null;
}, Ln = (e) => {
  const n = c.useContext(ol);
  return e ?? n;
};
function sl(e) {
  const n = er(), r = Ln(e), o = on();
  return ce(() => {
    if (!n)
      return;
    const s = {
      id: n,
      parentId: o
    };
    return r == null ? void 0 : r.addNode(s), () => {
      r == null ? void 0 : r.removeNode(s);
    };
  }, [r, n, o]), n;
}
function Kf(e) {
  const {
    children: n,
    id: r
  } = e, o = on();
  return /* @__PURE__ */ jsx(rl.Provider, {
    value: c.useMemo(() => ({
      id: r,
      parentId: o
    }), [r, o]),
    children: n
  });
}
function Gf(e) {
  const {
    children: n,
    externalTree: r
  } = e, o = xt(() => r ?? new nl()).current;
  return /* @__PURE__ */ jsx(ol.Provider, {
    value: o,
    children: n
  });
}
function fx(e, n) {
  const r = pt(e.target);
  return e instanceof r.KeyboardEvent ? "keyboard" : e instanceof r.FocusEvent ? n || "keyboard" : "pointerType" in e ? e.pointerType || "keyboard" : "touches" in e ? "touch" : e instanceof r.MouseEvent ? n || (e.detail === 0 ? "keyboard" : "mouse") : "";
}
const iu = 20;
let En = [];
function il() {
  En = En.filter((e) => {
    var _a2;
    return (_a2 = e.deref()) == null ? void 0 : _a2.isConnected;
  });
}
function px(e) {
  il(), e && Mn(e) !== "body" && (En.push(new WeakRef(e)), En.length > iu && (En = En.slice(-iu)));
}
function Ci() {
  var _a2;
  return il(), (_a2 = En[En.length - 1]) == null ? void 0 : _a2.deref();
}
function mx(e) {
  if (!e)
    return null;
  const n = Rr();
  return If(e, n) ? e : po(e, n)[0] || e;
}
function gx(e) {
  return !e || !e.isConnected ? false : typeof e.checkVisibility == "function" ? e.checkVisibility() : Qa(e);
}
function au(e, n) {
  var _a2;
  if (!n.current.includes("floating") && !((_a2 = e.getAttribute("role")) == null ? void 0 : _a2.includes("dialog")))
    return;
  const r = Rr(), s = $y(e, r).filter((a) => {
    const l = a.getAttribute("data-tabindex") || "";
    return If(a, r) || a.hasAttribute("data-tabindex") && !l.startsWith("-");
  }), i = e.getAttribute("tabindex");
  n.current.includes("floating") || s.length === 0 ? i !== "0" && e.setAttribute("tabindex", "0") : (i !== "-1" || e.hasAttribute("data-tabindex") && e.getAttribute("data-tabindex") !== "-1") && (e.setAttribute("tabindex", "-1"), e.setAttribute("data-tabindex", "-1"));
}
function Gs(e) {
  const {
    context: n,
    children: r,
    disabled: o = false,
    initialFocus: s = true,
    returnFocus: i = true,
    restoreFocus: a = false,
    modal: l = true,
    closeOnFocusOut: f = true,
    openInteractionType: u = "",
    nextFocusableElement: p,
    previousFocusableElement: d,
    beforeContentFocusGuardRef: g,
    externalTree: m,
    getInsideElements: b
  } = e, h = "rootStore" in n ? n.rootStore : n, v = h.useState("open"), y = h.useState("domReferenceElement"), x = h.useState("floatingElement"), {
    events: R,
    dataRef: S
  } = h.context, E = de(() => {
    var _a2;
    return (_a2 = S.current.floatingContext) == null ? void 0 : _a2.nodeId;
  }), C = s === false, T = da(y) && C, N = c.useRef(["content"]), I = yt(s), L = yt(i), A = yt(u), P = Ln(m), O = Uf(), M = c.useRef(false), D = c.useRef(false), _ = c.useRef(false), k = c.useRef(-1), $ = c.useRef(""), F = c.useRef(""), z = c.useRef(null), Q = c.useRef(null), B = Wt(z, g, O == null ? void 0 : O.beforeInsideRef), G = Wt(Q, O == null ? void 0 : O.afterInsideRef), j = ht(), W = ht(), H = co(), te = O != null, J = Qr(x), oe = de((le = J) => le ? po(le, Rr()) : []), ae = de(() => (b == null ? void 0 : b().filter((le) => le != null)) ?? []), ue = de((le) => {
    const se = oe(le);
    return N.current.map(() => se).filter(Boolean).flat();
  });
  c.useEffect(() => {
    if (o || !l)
      return;
    function le(me) {
      me.key === "Tab" && Se(J, Ft(He(J))) && oe().length === 0 && !T && Lt(me);
    }
    const se = He(J);
    return se.addEventListener("keydown", le), () => {
      se.removeEventListener("keydown", le);
    };
  }, [o, y, J, l, N, T, oe, ue]), c.useEffect(() => {
    if (o || !v)
      return;
    const le = He(J);
    function se() {
      _.current = false;
    }
    function me(ne) {
      const re = Nt(ne), q = ae(), U = Se(x, re) || Se(y, re) || Se(O == null ? void 0 : O.portalNode, re) || q.some((V) => V === re || Se(V, re));
      _.current = !U, F.current = ne.pointerType || "keyboard", (re == null ? void 0 : re.closest(`[${za}]`)) && (D.current = true);
    }
    function ye() {
      F.current = "keyboard";
    }
    return le.addEventListener("pointerdown", me, true), le.addEventListener("pointerup", se, true), le.addEventListener("pointercancel", se, true), le.addEventListener("keydown", ye, true), () => {
      le.removeEventListener("pointerdown", me, true), le.removeEventListener("pointerup", se, true), le.removeEventListener("pointercancel", se, true), le.removeEventListener("keydown", ye, true);
    };
  }, [o, x, y, J, v, O, ae]), c.useEffect(() => {
    if (o || !f)
      return;
    const le = He(J);
    function se() {
      D.current = true, W.start(0, () => {
        D.current = false;
      });
    }
    function me(U) {
      const V = Nt(U), ee = oe().indexOf(V);
      ee !== -1 && (k.current = ee);
    }
    function ye(U) {
      const V = U.relatedTarget, Y = U.currentTarget, ee = Nt(U);
      queueMicrotask(() => {
        const he = E(), Me = h.context.triggerElements, Ue = ae(), Le = (V == null ? void 0 : V.hasAttribute(ro("focus-guard"))) && [z.current, Q.current, O == null ? void 0 : O.beforeInsideRef.current, O == null ? void 0 : O.afterInsideRef.current, O == null ? void 0 : O.beforeOutsideRef.current, O == null ? void 0 : O.afterOutsideRef.current, cn(d), cn(p)].includes(V), _e = !(Se(y, V) || Se(x, V) || Se(V, x) || Se(O == null ? void 0 : O.portalNode, V) || Ue.some((xe) => xe === V || Se(xe, V)) || V != null && Me.hasElement(V) || Me.hasMatchingElement((xe) => Se(xe, V)) || Le || P && (dn(P.nodesRef.current, he).find((xe) => {
          var _a2, _b2;
          return Se((_a2 = xe.context) == null ? void 0 : _a2.elements.floating, V) || Se((_b2 = xe.context) == null ? void 0 : _b2.elements.domReference, V);
        }) || Uc(P.nodesRef.current, he).find((xe) => {
          var _a2, _b2, _c2;
          return [(_a2 = xe.context) == null ? void 0 : _a2.elements.floating, Qr((_b2 = xe.context) == null ? void 0 : _b2.elements.floating)].includes(V) || ((_c2 = xe.context) == null ? void 0 : _c2.elements.domReference) === V;
        })));
        if (Y === y && J && au(J, N), a && Y !== y && !gx(ee) && Ft(le) === le.body) {
          if (st(J) && (J.focus(), a === "popup")) {
            H.request(() => {
              J.focus();
            });
            return;
          }
          const xe = k.current, Ee = oe(), Re = Ee[xe] || Ee[Ee.length - 1] || J;
          st(Re) && Re.focus();
        }
        if (S.current.insideReactTree) {
          S.current.insideReactTree = false;
          return;
        }
        (T || !l) && V && _e && !D.current && // Fix React 18 Strict Mode returnFocus due to double rendering.
        // For an "untrapped" typeable combobox (input role=combobox with
        // initialFocus=false), re-opening the popup and tabbing out should still close it even
        // when the previously focused element (e.g. the next tabbable outside the popup) is
        // focused again. Otherwise, the popup remains open on the second Tab sequence:
        // click input -> Tab (closes) -> click input -> Tab.
        // Allow closing when `isUntrappedTypeableCombobox` regardless of the previously focused element.
        (T || V !== Ci()) && (M.current = true, h.setOpen(false, we(Zt, U)));
      });
    }
    function ne() {
      _.current || (S.current.insideReactTree = true, j.start(0, () => {
        S.current.insideReactTree = false;
      }));
    }
    const re = st(y) ? y : null, q = [];
    if (!(!x && !re))
      return re && (re.addEventListener("focusout", ye), re.addEventListener("pointerdown", se), q.push(() => {
        re.removeEventListener("focusout", ye), re.removeEventListener("pointerdown", se);
      })), x && (x.addEventListener("focusin", me), x.addEventListener("focusout", ye), O && (x.addEventListener("focusout", ne, true), q.push(() => {
        x.removeEventListener("focusout", ne, true);
      })), q.push(() => {
        x.removeEventListener("focusin", me), x.removeEventListener("focusout", ye);
      })), () => {
        q.forEach((U) => {
          U();
        });
      };
  }, [o, y, x, J, l, P, O, h, f, a, oe, T, E, N, S, j, W, H, p, d, ae]), c.useEffect(() => {
    var _a2, _b2, _c2;
    if (o || !x || !v)
      return;
    const le = Array.from(((_a2 = O == null ? void 0 : O.portalNode) == null ? void 0 : _a2.querySelectorAll(`[${ro("portal")}]`)) || []), me = (_c2 = (_b2 = (P ? Uc(P.nodesRef.current, E()) : []).find((V) => {
      var _a3;
      return da(((_a3 = V.context) == null ? void 0 : _a3.elements.domReference) || null);
    })) == null ? void 0 : _b2.context) == null ? void 0 : _c2.elements.domReference, ne = [...[x, ...le, z.current, Q.current, O == null ? void 0 : O.beforeOutsideRef.current, O == null ? void 0 : O.afterOutsideRef.current, ...ae()], me, cn(d), cn(p), T ? y : null].filter((V) => V != null), re = su(ne, {
      ariaHidden: l || T,
      mark: false
    }), q = [x, ...le].filter((V) => V != null), U = su(q);
    return () => {
      U(), re();
    };
  }, [v, o, y, x, l, N, O, T, P, E, p, d, ae]), ce(() => {
    if (!v || o || !st(J))
      return;
    const le = He(J), se = Ft(le);
    queueMicrotask(() => {
      const me = ue(J), ye = I.current, ne = typeof ye == "function" ? ye(A.current || "") : ye;
      if (ne === void 0 || ne === false)
        return;
      let re;
      ne === true || ne === null ? re = me[0] || J : re = cn(ne), re = re || me[0] || J, !Se(J, se) && zr(re, {
        preventScroll: re === J
      });
    });
  }, [o, v, J, C, ue, I, A]), ce(() => {
    if (o || !J)
      return;
    const le = He(J), se = Ft(le);
    px(se);
    function me(ne) {
      if (ne.open || ($.current = fx(ne.nativeEvent, F.current)), ne.reason === vt && ne.nativeEvent.type === "mouseleave" && (M.current = true), ne.reason === As)
        if (ne.nested)
          M.current = false;
        else if (hf(ne.nativeEvent) || bf(ne.nativeEvent))
          M.current = false;
        else {
          let re = false;
          document.createElement("div").focus({
            get preventScroll() {
              return re = true, false;
            }
          }), re ? M.current = false : M.current = true;
        }
    }
    R.on("openchange", me);
    function ye() {
      const ne = L.current;
      let re = typeof ne == "function" ? ne($.current) : ne;
      if (re === void 0 || re === false)
        return null;
      if (re === null && (re = true), typeof re == "boolean") {
        const U = y || Ci();
        return U && U.isConnected ? U : null;
      }
      const q = y || Ci();
      return cn(re) || q || null;
    }
    return () => {
      R.off("openchange", me);
      const ne = Ft(le), re = ae(), q = Se(x, ne) || re.some((V) => V === ne || Se(V, ne)) || P && dn(P.nodesRef.current, E(), false).some((V) => {
        var _a2;
        return Se((_a2 = V.context) == null ? void 0 : _a2.elements.floating, ne);
      }), U = ye();
      queueMicrotask(() => {
        const V = mx(U), Y = typeof L.current != "boolean";
        L.current && !M.current && st(V) && // If the focus moved somewhere else after mount, avoid returning focus
        // since it likely entered a different element which should be
        // respected: https://github.com/floating-ui/floating-ui/issues/2607
        (!(!Y && V !== ne && ne !== le.body) || q) && V.focus({
          preventScroll: true
        }), M.current = false;
      });
    };
  }, [o, x, J, L, S, R, P, y, E, ae]), ce(() => {
    if (!Ya || v || !x)
      return;
    const le = Ft(He(x));
    !st(le) || !Hs(le) || Se(x, le) && le.blur();
  }, [v, x]), ce(() => {
    if (!(o || !O))
      return O.setFocusManagerState({
        modal: l,
        closeOnFocusOut: f,
        open: v,
        onOpenChange: h.setOpen,
        domReference: y
      }), () => {
        O.setFocusManagerState(null);
      };
  }, [o, O, l, v, h, f, y]), ce(() => {
    if (!(o || !J))
      return au(J, N), () => {
        queueMicrotask(il);
      };
  }, [o, J, N]);
  const fe = !o && (l ? !T : true) && (te || l);
  return /* @__PURE__ */ jsxs(c.Fragment, {
    children: [fe && /* @__PURE__ */ jsx(bn, {
      "data-type": "inside",
      ref: B,
      onFocus: (le) => {
        var _a2, _b2;
        if (l) {
          const se = ue();
          zr(se[se.length - 1]);
        } else (O == null ? void 0 : O.portalNode) && (M.current = false, Gn(le, O.portalNode) ? (_a2 = Us(y)) == null ? void 0 : _a2.focus() : (_b2 = cn(d ?? O.beforeOutsideRef)) == null ? void 0 : _b2.focus());
      }
    }), r, fe && /* @__PURE__ */ jsx(bn, {
      "data-type": "inside",
      ref: G,
      onFocus: (le) => {
        var _a2, _b2;
        l ? zr(ue()[0]) : (O == null ? void 0 : O.portalNode) && (f && (M.current = true), Gn(le, O.portalNode) ? (_a2 = Mf(y)) == null ? void 0 : _a2.focus() : (_b2 = cn(p ?? O.afterOutsideRef)) == null ? void 0 : _b2.focus());
      }
    })]
  });
}
function Ys(e, n = {}) {
  const r = "rootStore" in e ? e.rootStore : e, o = r.context.dataRef, {
    enabled: s = true,
    event: i = "click",
    toggle: a = true,
    ignoreMouse: l = false,
    stickIfOpen: f = true,
    touchOpenDelay: u = 0,
    reason: p = Jt
  } = n, d = c.useRef(void 0), g = co(), m = ht(), b = c.useMemo(() => ({
    onPointerDown(h) {
      d.current = h.pointerType;
    },
    onMouseDown(h) {
      const v = d.current, y = h.nativeEvent, x = r.select("open");
      if (h.button !== 0 || i === "click" || hr(v, true) && l)
        return;
      const R = o.current.openEvent, S = R == null ? void 0 : R.type, E = r.select("domReferenceElement") !== h.currentTarget, C = x && E || !(x && a && (!(R && f) || S === "click" || S === "mousedown"));
      if (Hs(y.target)) {
        const N = we(p, y, y.target);
        C && v === "touch" && u > 0 ? m.start(u, () => {
          r.setOpen(true, N);
        }) : r.setOpen(C, N);
        return;
      }
      const T = h.currentTarget;
      g.request(() => {
        const N = we(p, y, T);
        C && v === "touch" && u > 0 ? m.start(u, () => {
          r.setOpen(true, N);
        }) : r.setOpen(C, N);
      });
    },
    onClick(h) {
      if (i === "mousedown-only")
        return;
      const v = d.current;
      if (i === "mousedown" && v) {
        d.current = void 0;
        return;
      }
      if (hr(v, true) && l)
        return;
      const y = r.select("open"), x = o.current.openEvent, R = r.select("domReferenceElement") !== h.currentTarget, S = y && R || !(y && a && (!(x && f) || vf(x))), E = we(p, h.nativeEvent, h.currentTarget);
      S && v === "touch" && u > 0 ? m.start(u, () => {
        r.setOpen(true, E);
      }) : r.setOpen(S, E);
    },
    onKeyDown() {
      d.current = void 0;
    }
  }), [o, i, l, r, f, a, g, m, u, p]);
  return c.useMemo(() => s ? {
    reference: b
  } : ct, [s, b]);
}
function hx(e, n) {
  let r = null, o = null, s = false;
  return {
    contextElement: e || void 0,
    getBoundingClientRect() {
      var _a2;
      const i = (e == null ? void 0 : e.getBoundingClientRect()) || {
        width: 0,
        height: 0,
        x: 0,
        y: 0
      }, a = n.axis === "x" || n.axis === "both", l = n.axis === "y" || n.axis === "both", f = ["mouseenter", "mousemove"].includes(((_a2 = n.dataRef.current.openEvent) == null ? void 0 : _a2.type) || "") && n.pointerType !== "touch";
      let u = i.width, p = i.height, d = i.x, g = i.y;
      return r == null && n.x && a && (r = i.x - n.x), o == null && n.y && l && (o = i.y - n.y), d -= r || 0, g -= o || 0, u = 0, p = 0, !s || f ? (u = n.axis === "y" ? i.width : 0, p = n.axis === "x" ? i.height : 0, d = a && n.x != null ? n.x : d, g = l && n.y != null ? n.y : g) : s && !f && (p = n.axis === "x" ? i.height : p, u = n.axis === "y" ? i.width : u), s = true, {
        width: u,
        height: p,
        x: d,
        y: g,
        top: g,
        right: d + u,
        bottom: g + p,
        left: d
      };
    }
  };
}
function lu(e) {
  return e != null && e.clientX != null;
}
function bx(e, n = {}) {
  const r = "rootStore" in e ? e.rootStore : e, o = r.useState("open"), s = r.useState("floatingElement"), i = r.useState("domReferenceElement"), a = r.context.dataRef, {
    enabled: l = true,
    axis: f = "both"
  } = n, u = c.useRef(false), p = c.useRef(null), [d, g] = c.useState(), [m, b] = c.useState([]), h = de((S, E, C) => {
    u.current || a.current.openEvent && !lu(a.current.openEvent) || r.set("positionReference", hx(C ?? i, {
      x: S,
      y: E,
      axis: f,
      dataRef: a,
      pointerType: d
    }));
  }), v = de((S) => {
    o ? p.current || b([]) : h(S.clientX, S.clientY, S.currentTarget);
  }), y = hr(d) ? s : o, x = c.useCallback(() => {
    if (!y || !l)
      return;
    const S = pt(s);
    function E(C) {
      const T = Nt(C);
      Se(s, T) ? (S.removeEventListener("mousemove", E), p.current = null) : h(C.clientX, C.clientY);
    }
    if (!a.current.openEvent || lu(a.current.openEvent)) {
      S.addEventListener("mousemove", E);
      const C = () => {
        S.removeEventListener("mousemove", E), p.current = null;
      };
      return p.current = C, C;
    }
    r.set("positionReference", i);
  }, [y, l, s, a, i, r, h]);
  c.useEffect(() => x(), [x, m]), c.useEffect(() => {
    l && !s && (u.current = false);
  }, [l, s]), c.useEffect(() => {
    !l && o && (u.current = true);
  }, [l, o]);
  const R = c.useMemo(() => {
    function S(E) {
      g(E.pointerType);
    }
    return {
      onPointerDown: S,
      onPointerEnter: S,
      onMouseMove: v,
      onMouseEnter: v
    };
  }, [v]);
  return c.useMemo(() => l ? {
    reference: R,
    trigger: R
  } : {}, [l, R]);
}
const vx = {
  intentional: "onClick",
  sloppy: "onPointerDown"
};
function yx() {
  return false;
}
function xx(e) {
  return {
    escapeKey: typeof e == "boolean" ? e : (e == null ? void 0 : e.escapeKey) ?? false,
    outsidePress: typeof e == "boolean" ? e : (e == null ? void 0 : e.outsidePress) ?? true
  };
}
function bo(e, n = {}) {
  const r = "rootStore" in e ? e.rootStore : e, o = r.useState("open"), s = r.useState("floatingElement"), {
    dataRef: i
  } = r.context, {
    enabled: a = true,
    escapeKey: l = true,
    outsidePress: f = true,
    outsidePressEvent: u = "sloppy",
    referencePress: p = yx,
    referencePressEvent: d = "sloppy",
    bubbles: g,
    externalTree: m
  } = n, b = Ln(m), h = de(typeof f == "function" ? f : () => false), v = typeof f == "function" ? h : f, y = v !== false, x = de(() => u), R = c.useRef(false), S = c.useRef(false), E = c.useRef(false), {
    escapeKey: C,
    outsidePress: T
  } = xx(g), N = c.useRef(null), I = ht(), L = ht(), A = de(() => {
    L.clear(), i.current.insideReactTree = false;
  }), P = c.useRef(false), O = c.useRef(""), M = de(p), D = de((Q) => {
    var _a2;
    if (!o || !a || !l || Q.key !== "Escape" || P.current)
      return;
    const B = (_a2 = i.current.floatingContext) == null ? void 0 : _a2.nodeId, G = b ? dn(b.nodesRef.current, B) : [];
    if (!C && G.length > 0) {
      let H = true;
      if (G.forEach((te) => {
        var _a3;
        ((_a3 = te.context) == null ? void 0 : _a3.open) && !te.context.dataRef.current.__escapeKeyBubbles && (H = false);
      }), !H)
        return;
    }
    const j = hy(Q) ? Q.nativeEvent : Q, W = we(ao, j);
    r.setOpen(false, W), !C && !W.isPropagationAllowed && Q.stopPropagation();
  }), _ = de(() => {
    i.current.insideReactTree = true, L.start(0, A);
  });
  c.useEffect(() => {
    if (!o || !a)
      return;
    i.current.__escapeKeyBubbles = C, i.current.__outsidePressBubbles = T;
    const Q = new Ht(), B = new Ht();
    function G() {
      Q.clear(), P.current = true;
    }
    function j() {
      Q.start(
        // 0ms or 1ms don't work in Safari. 5ms appears to consistently work.
        // Only apply to WebKit for the test to remain 0ms.
        $s() ? 5 : 0,
        () => {
          P.current = false;
        }
      );
    }
    function W() {
      E.current = true, B.start(0, () => {
        E.current = false;
      });
    }
    function H() {
      R.current = false, S.current = false;
    }
    function te() {
      const V = O.current, Y = V === "pen" || !V ? "mouse" : V, ee = x(), he = typeof ee == "function" ? ee() : ee;
      return typeof he == "string" ? he : he[Y];
    }
    function J(V) {
      const Y = te();
      return Y === "intentional" && V.type !== "click" || Y === "sloppy" && V.type === "click";
    }
    function oe(V) {
      var _a2;
      const Y = (_a2 = i.current.floatingContext) == null ? void 0 : _a2.nodeId, ee = b && dn(b.nodesRef.current, Y).some((he) => {
        var _a3;
        return Ut(V, (_a3 = he.context) == null ? void 0 : _a3.elements.floating);
      });
      return Ut(V, r.select("floatingElement")) || Ut(V, r.select("domReferenceElement")) || ee;
    }
    function ae(V) {
      var _a2;
      if (J(V)) {
        A();
        return;
      }
      if (i.current.insideReactTree) {
        A();
        return;
      }
      const Y = Nt(V), ee = `[${ro("inert")}]`;
      let he = Array.from(He(r.select("floatingElement")).querySelectorAll(ee));
      const Me = Ke(Y) ? Y.getRootNode() : null;
      Jr(Me) && (he = he.concat(Array.from(Me.querySelectorAll(ee))));
      const Ue = r.context.triggerElements;
      if (Y && (Ue.hasElement(Y) || Ue.hasMatchingElement((Ee) => Se(Ee, Y))))
        return;
      let Le = Ke(Y) ? Y : null;
      for (; Le && !qt(Le); ) {
        const Ee = Qt(Le);
        if (qt(Ee) || !Ke(Ee))
          break;
        Le = Ee;
      }
      if (he.length && Ke(Y) && !my(Y) && // Clicked on a direct ancestor (e.g. FloatingOverlay).
      !Se(Y, r.select("floatingElement")) && // If the target root element contains none of the markers, then the
      // element was injected after the floating element rendered.
      he.every((Ee) => !Se(Le, Ee)))
        return;
      if (st(Y) && !("touches" in V)) {
        const Ee = qt(Y), Re = Vt(Y), We = /auto|scroll/, Ce = Ee || We.test(Re.overflowX), Ie = Ee || We.test(Re.overflowY), je = Ce && Y.clientWidth > 0 && Y.scrollWidth > Y.clientWidth, lt = Ie && Y.clientHeight > 0 && Y.scrollHeight > Y.clientHeight, Ne = Re.direction === "rtl", Ye = lt && (Ne ? V.offsetX <= Y.offsetWidth - Y.clientWidth : V.offsetX > Y.clientWidth), qe = je && V.offsetY > Y.clientHeight;
        if (Ye || qe)
          return;
      }
      if (oe(V))
        return;
      if (te() === "intentional" && E.current) {
        B.clear(), E.current = false;
        return;
      }
      if (typeof v == "function" && !v(V))
        return;
      const _e = (_a2 = i.current.floatingContext) == null ? void 0 : _a2.nodeId, xe = b ? dn(b.nodesRef.current, _e) : [];
      if (xe.length > 0) {
        let Ee = true;
        if (xe.forEach((Re) => {
          var _a3;
          ((_a3 = Re.context) == null ? void 0 : _a3.open) && !Re.context.dataRef.current.__outsidePressBubbles && (Ee = false);
        }), !Ee)
          return;
      }
      r.setOpen(false, we(As, V)), A();
    }
    function ue(V) {
      te() !== "sloppy" || V.pointerType === "touch" || !r.select("open") || !a || Ut(V, r.select("floatingElement")) || Ut(V, r.select("domReferenceElement")) || ae(V);
    }
    function fe(V) {
      if (te() !== "sloppy" || !r.select("open") || !a || Ut(V, r.select("floatingElement")) || Ut(V, r.select("domReferenceElement")))
        return;
      const Y = V.touches[0];
      Y && (N.current = {
        startTime: Date.now(),
        startX: Y.clientX,
        startY: Y.clientY,
        dismissOnTouchEnd: false,
        dismissOnMouseDown: true
      }, I.start(1e3, () => {
        N.current && (N.current.dismissOnTouchEnd = false, N.current.dismissOnMouseDown = false);
      }));
    }
    function le(V) {
      O.current = "touch";
      const Y = Nt(V);
      function ee() {
        fe(V), Y == null ? void 0 : Y.removeEventListener(V.type, ee);
      }
      Y == null ? void 0 : Y.addEventListener(V.type, ee);
    }
    function se(V) {
      if (I.clear(), V.type === "pointerdown" && (O.current = V.pointerType), V.type === "mousedown" && N.current && !N.current.dismissOnMouseDown)
        return;
      const Y = Nt(V);
      function ee() {
        V.type === "pointerdown" ? ue(V) : ae(V), Y == null ? void 0 : Y.removeEventListener(V.type, ee);
      }
      Y == null ? void 0 : Y.addEventListener(V.type, ee);
    }
    function me(V) {
      if (!R.current)
        return;
      const Y = S.current;
      if (H(), te() === "intentional") {
        if (V.type === "pointercancel") {
          Y && W();
          return;
        }
        if (!oe(V)) {
          if (Y) {
            W();
            return;
          }
          typeof v == "function" && !v(V) || (B.clear(), E.current = true, A());
        }
      }
    }
    function ye(V) {
      if (te() !== "sloppy" || !N.current || Ut(V, r.select("floatingElement")) || Ut(V, r.select("domReferenceElement")))
        return;
      const Y = V.touches[0];
      if (!Y)
        return;
      const ee = Math.abs(Y.clientX - N.current.startX), he = Math.abs(Y.clientY - N.current.startY), Me = Math.sqrt(ee * ee + he * he);
      Me > 5 && (N.current.dismissOnTouchEnd = true), Me > 10 && (ae(V), I.clear(), N.current = null);
    }
    function ne(V) {
      const Y = Nt(V);
      function ee() {
        ye(V), Y == null ? void 0 : Y.removeEventListener(V.type, ee);
      }
      Y == null ? void 0 : Y.addEventListener(V.type, ee);
    }
    function re(V) {
      te() !== "sloppy" || !N.current || Ut(V, r.select("floatingElement")) || Ut(V, r.select("domReferenceElement")) || (N.current.dismissOnTouchEnd && ae(V), I.clear(), N.current = null);
    }
    function q(V) {
      const Y = Nt(V);
      function ee() {
        re(V), Y == null ? void 0 : Y.removeEventListener(V.type, ee);
      }
      Y == null ? void 0 : Y.addEventListener(V.type, ee);
    }
    const U = He(s);
    return l && (U.addEventListener("keydown", D), U.addEventListener("compositionstart", G), U.addEventListener("compositionend", j)), y && (U.addEventListener("click", se, true), U.addEventListener("pointerdown", se, true), U.addEventListener("pointerup", me, true), U.addEventListener("pointercancel", me, true), U.addEventListener("mousedown", se, true), U.addEventListener("mouseup", me, true), U.addEventListener("touchstart", le, true), U.addEventListener("touchmove", ne, true), U.addEventListener("touchend", q, true)), () => {
      l && (U.removeEventListener("keydown", D), U.removeEventListener("compositionstart", G), U.removeEventListener("compositionend", j)), y && (U.removeEventListener("click", se, true), U.removeEventListener("pointerdown", se, true), U.removeEventListener("pointerup", me, true), U.removeEventListener("pointercancel", me, true), U.removeEventListener("mousedown", se, true), U.removeEventListener("mouseup", me, true), U.removeEventListener("touchstart", le, true), U.removeEventListener("touchmove", ne, true), U.removeEventListener("touchend", q, true)), Q.clear(), B.clear(), H(), E.current = false;
    };
  }, [i, s, l, y, v, o, a, C, T, D, A, x, b, r, I]), c.useEffect(A, [v, A]);
  const k = c.useMemo(() => ({
    onKeyDown: D,
    [vx[d]]: (Q) => {
      M() && r.setOpen(false, we(Jt, Q.nativeEvent));
    },
    ...d !== "intentional" && {
      onClick(Q) {
        M() && r.setOpen(false, we(Jt, Q.nativeEvent));
      }
    }
  }), [D, r, d, M]), $ = de((Q) => {
    if (!o || !a || Q.button !== 0)
      return;
    const B = Nt(Q.nativeEvent);
    Se(r.select("floatingElement"), B) && (R.current || (R.current = true, S.current = false));
  }), F = de((Q) => {
    !o || !a || (Q.defaultPrevented || Q.nativeEvent.defaultPrevented) && R.current && (S.current = true);
  }), z = c.useMemo(() => ({
    onKeyDown: D,
    // `onMouseDown` may be blocked if `event.preventDefault()` is called in
    // `onPointerDown`, such as with <NumberField.ScrubArea>.
    // See https://github.com/mui/base-ui/pull/3379
    onPointerDown: F,
    onMouseDown: F,
    onClickCapture: _,
    onMouseDownCapture(Q) {
      _(), $(Q);
    },
    onPointerDownCapture(Q) {
      _(), $(Q);
    },
    onMouseUpCapture: _,
    onTouchEndCapture: _,
    onTouchMoveCapture: _
  }), [D, _, $, F]);
  return c.useMemo(() => a ? {
    reference: k,
    floating: z,
    trigger: k
  } : {}, [a, k, z]);
}
function cu(e, n, r) {
  let {
    reference: o,
    floating: s
  } = e;
  const i = zt(n), a = Za(n), l = Ja(a), f = Pt(n), u = i === "y", p = o.x + o.width / 2 - s.width / 2, d = o.y + o.height / 2 - s.height / 2, g = o[l] / 2 - s[l] / 2;
  let m;
  switch (f) {
    case "top":
      m = {
        x: p,
        y: o.y - s.height
      };
      break;
    case "bottom":
      m = {
        x: p,
        y: o.y + o.height
      };
      break;
    case "right":
      m = {
        x: o.x + o.width,
        y: d
      };
      break;
    case "left":
      m = {
        x: o.x - s.width,
        y: d
      };
      break;
    default:
      m = {
        x: o.x,
        y: o.y
      };
  }
  switch (An(n)) {
    case "start":
      m[a] -= g * (r && u ? -1 : 1);
      break;
    case "end":
      m[a] += g * (r && u ? -1 : 1);
      break;
  }
  return m;
}
async function wx(e, n) {
  var r;
  n === void 0 && (n = {});
  const {
    x: o,
    y: s,
    platform: i,
    rects: a,
    elements: l,
    strategy: f
  } = e, {
    boundary: u = "clippingAncestors",
    rootBoundary: p = "viewport",
    elementContext: d = "floating",
    altBoundary: g = false,
    padding: m = 0
  } = hn(n, e), b = yf(m), v = l[g ? d === "floating" ? "reference" : "floating" : d], y = eo(await i.getClippingRect({
    element: (r = await (i.isElement == null ? void 0 : i.isElement(v))) == null || r ? v : v.contextElement || await (i.getDocumentElement == null ? void 0 : i.getDocumentElement(l.floating)),
    boundary: u,
    rootBoundary: p,
    strategy: f
  })), x = d === "floating" ? {
    x: o,
    y: s,
    width: a.floating.width,
    height: a.floating.height
  } : a.reference, R = await (i.getOffsetParent == null ? void 0 : i.getOffsetParent(l.floating)), S = await (i.isElement == null ? void 0 : i.isElement(R)) ? await (i.getScale == null ? void 0 : i.getScale(R)) || {
    x: 1,
    y: 1
  } : {
    x: 1,
    y: 1
  }, E = eo(i.convertOffsetParentRelativeRectToViewportRelativeRect ? await i.convertOffsetParentRelativeRectToViewportRelativeRect({
    elements: l,
    rect: x,
    offsetParent: R,
    strategy: f
  }) : x);
  return {
    top: (y.top - E.top + b.top) / S.y,
    bottom: (E.bottom - y.bottom + b.bottom) / S.y,
    left: (y.left - E.left + b.left) / S.x,
    right: (E.right - y.right + b.right) / S.x
  };
}
const Ex = 50, Cx = async (e, n, r) => {
  const {
    placement: o = "bottom",
    strategy: s = "absolute",
    middleware: i = [],
    platform: a
  } = r, l = a.detectOverflow ? a : {
    ...a,
    detectOverflow: wx
  }, f = await (a.isRTL == null ? void 0 : a.isRTL(n));
  let u = await a.getElementRects({
    reference: e,
    floating: n,
    strategy: s
  }), {
    x: p,
    y: d
  } = cu(u, o, f), g = o, m = 0;
  const b = {};
  for (let h = 0; h < i.length; h++) {
    const v = i[h];
    if (!v)
      continue;
    const {
      name: y,
      fn: x
    } = v, {
      x: R,
      y: S,
      data: E,
      reset: C
    } = await x({
      x: p,
      y: d,
      initialPlacement: o,
      placement: g,
      strategy: s,
      middlewareData: b,
      rects: u,
      platform: l,
      elements: {
        reference: e,
        floating: n
      }
    });
    p = R ?? p, d = S ?? d, b[y] = {
      ...b[y],
      ...E
    }, C && m < Ex && (m++, typeof C == "object" && (C.placement && (g = C.placement), C.rects && (u = C.rects === true ? await a.getElementRects({
      reference: e,
      floating: n,
      strategy: s
    }) : C.rects), {
      x: p,
      y: d
    } = cu(u, g, f)), h = -1);
  }
  return {
    x: p,
    y: d,
    placement: g,
    strategy: s,
    middlewareData: b
  };
}, Sx = function(e) {
  return e === void 0 && (e = {}), {
    name: "flip",
    options: e,
    async fn(n) {
      var r, o;
      const {
        placement: s,
        middlewareData: i,
        rects: a,
        initialPlacement: l,
        platform: f,
        elements: u
      } = n, {
        mainAxis: p = true,
        crossAxis: d = true,
        fallbackPlacements: g,
        fallbackStrategy: m = "bestFit",
        fallbackAxisSideDirection: b = "none",
        flipAlignment: h = true,
        ...v
      } = hn(e, n);
      if ((r = i.arrow) != null && r.alignmentOffset)
        return {};
      const y = Pt(s), x = zt(l), R = Pt(l) === l, S = await (f.isRTL == null ? void 0 : f.isRTL(u.floating)), E = g || (R || !h ? [bs(l)] : xy(l)), C = b !== "none";
      !g && C && E.push(...Sy(l, h, b, S));
      const T = [l, ...E], N = await f.detectOverflow(n, v), I = [];
      let L = ((o = i.flip) == null ? void 0 : o.overflows) || [];
      if (p && I.push(N[y]), d) {
        const M = yy(s, a, S);
        I.push(N[M[0]], N[M[1]]);
      }
      if (L = [...L, {
        placement: s,
        overflows: I
      }], !I.every((M) => M <= 0)) {
        var A, P;
        const M = (((A = i.flip) == null ? void 0 : A.index) || 0) + 1, D = T[M];
        if (D && (!(d === "alignment" ? x !== zt(D) : false) || // We leave the current main axis only if every placement on that axis
        // overflows the main axis.
        L.every(($) => zt($.placement) === x ? $.overflows[0] > 0 : true)))
          return {
            data: {
              index: M,
              overflows: L
            },
            reset: {
              placement: D
            }
          };
        let _ = (P = L.filter((k) => k.overflows[0] <= 0).sort((k, $) => k.overflows[1] - $.overflows[1])[0]) == null ? void 0 : P.placement;
        if (!_)
          switch (m) {
            case "bestFit": {
              var O;
              const k = (O = L.filter(($) => {
                if (C) {
                  const F = zt($.placement);
                  return F === x || // Create a bias to the `y` side axis due to horizontal
                  // reading directions favoring greater width.
                  F === "y";
                }
                return true;
              }).map(($) => [$.placement, $.overflows.filter((F) => F > 0).reduce((F, z) => F + z, 0)]).sort(($, F) => $[1] - F[1])[0]) == null ? void 0 : O[0];
              k && (_ = k);
              break;
            }
            case "initialPlacement":
              _ = l;
              break;
          }
        if (s !== _)
          return {
            reset: {
              placement: _
            }
          };
      }
      return {};
    }
  };
};
function uu(e, n) {
  return {
    top: e.top - n.height,
    right: e.right - n.width,
    bottom: e.bottom - n.height,
    left: e.left - n.width
  };
}
function du(e) {
  return by.some((n) => e[n] >= 0);
}
const Rx = function(e) {
  return e === void 0 && (e = {}), {
    name: "hide",
    options: e,
    async fn(n) {
      const {
        rects: r,
        platform: o
      } = n, {
        strategy: s = "referenceHidden",
        ...i
      } = hn(e, n);
      switch (s) {
        case "referenceHidden": {
          const a = await o.detectOverflow(n, {
            ...i,
            elementContext: "reference"
          }), l = uu(a, r.reference);
          return {
            data: {
              referenceHiddenOffsets: l,
              referenceHidden: du(l)
            }
          };
        }
        case "escaped": {
          const a = await o.detectOverflow(n, {
            ...i,
            altBoundary: true
          }), l = uu(a, r.floating);
          return {
            data: {
              escapedOffsets: l,
              escaped: du(l)
            }
          };
        }
        default:
          return {};
      }
    }
  };
}, Yf = /* @__PURE__ */ new Set(["left", "top"]);
async function Nx(e, n) {
  const {
    placement: r,
    platform: o,
    elements: s
  } = e, i = await (o.isRTL == null ? void 0 : o.isRTL(s.floating)), a = Pt(r), l = An(r), f = zt(r) === "y", u = Yf.has(a) ? -1 : 1, p = i && f ? -1 : 1, d = hn(n, e);
  let {
    mainAxis: g,
    crossAxis: m,
    alignmentAxis: b
  } = typeof d == "number" ? {
    mainAxis: d,
    crossAxis: 0,
    alignmentAxis: null
  } : {
    mainAxis: d.mainAxis || 0,
    crossAxis: d.crossAxis || 0,
    alignmentAxis: d.alignmentAxis
  };
  return l && typeof b == "number" && (m = l === "end" ? b * -1 : b), f ? {
    x: m * p,
    y: g * u
  } : {
    x: g * u,
    y: m * p
  };
}
const Tx = function(e) {
  return e === void 0 && (e = 0), {
    name: "offset",
    options: e,
    async fn(n) {
      var r, o;
      const {
        x: s,
        y: i,
        placement: a,
        middlewareData: l
      } = n, f = await Nx(n, e);
      return a === ((r = l.offset) == null ? void 0 : r.placement) && (o = l.arrow) != null && o.alignmentOffset ? {} : {
        x: s + f.x,
        y: i + f.y,
        data: {
          ...f,
          placement: a
        }
      };
    }
  };
}, kx = function(e) {
  return e === void 0 && (e = {}), {
    name: "shift",
    options: e,
    async fn(n) {
      const {
        x: r,
        y: o,
        placement: s,
        platform: i
      } = n, {
        mainAxis: a = true,
        crossAxis: l = false,
        limiter: f = {
          fn: (y) => {
            let {
              x,
              y: R
            } = y;
            return {
              x,
              y: R
            };
          }
        },
        ...u
      } = hn(e, n), p = {
        x: r,
        y: o
      }, d = await i.detectOverflow(n, u), g = zt(Pt(s)), m = Xa(g);
      let b = p[m], h = p[g];
      if (a) {
        const y = m === "y" ? "top" : "left", x = m === "y" ? "bottom" : "right", R = b + d[y], S = b - d[x];
        b = fa(R, b, S);
      }
      if (l) {
        const y = g === "y" ? "top" : "left", x = g === "y" ? "bottom" : "right", R = h + d[y], S = h - d[x];
        h = fa(R, h, S);
      }
      const v = f.fn({
        ...n,
        [m]: b,
        [g]: h
      });
      return {
        ...v,
        data: {
          x: v.x - r,
          y: v.y - o,
          enabled: {
            [m]: a,
            [g]: l
          }
        }
      };
    }
  };
}, Ox = function(e) {
  return e === void 0 && (e = {}), {
    options: e,
    fn(n) {
      const {
        x: r,
        y: o,
        placement: s,
        rects: i,
        middlewareData: a
      } = n, {
        offset: l = 0,
        mainAxis: f = true,
        crossAxis: u = true
      } = hn(e, n), p = {
        x: r,
        y: o
      }, d = zt(s), g = Xa(d);
      let m = p[g], b = p[d];
      const h = hn(l, n), v = typeof h == "number" ? {
        mainAxis: h,
        crossAxis: 0
      } : {
        mainAxis: 0,
        crossAxis: 0,
        ...h
      };
      if (f) {
        const R = g === "y" ? "height" : "width", S = i.reference[g] - i.floating[R] + v.mainAxis, E = i.reference[g] + i.reference[R] - v.mainAxis;
        m < S ? m = S : m > E && (m = E);
      }
      if (u) {
        var y, x;
        const R = g === "y" ? "width" : "height", S = Yf.has(Pt(s)), E = i.reference[d] - i.floating[R] + (S && ((y = a.offset) == null ? void 0 : y[d]) || 0) + (S ? 0 : v.crossAxis), C = i.reference[d] + i.reference[R] + (S ? 0 : ((x = a.offset) == null ? void 0 : x[d]) || 0) - (S ? v.crossAxis : 0);
        b < E ? b = E : b > C && (b = C);
      }
      return {
        [g]: m,
        [d]: b
      };
    }
  };
}, Ix = function(e) {
  return e === void 0 && (e = {}), {
    name: "size",
    options: e,
    async fn(n) {
      var r, o;
      const {
        placement: s,
        rects: i,
        platform: a,
        elements: l
      } = n, {
        apply: f = () => {
        },
        ...u
      } = hn(e, n), p = await a.detectOverflow(n, u), d = Pt(s), g = An(s), m = zt(s) === "y", {
        width: b,
        height: h
      } = i.floating;
      let v, y;
      d === "top" || d === "bottom" ? (v = d, y = g === (await (a.isRTL == null ? void 0 : a.isRTL(l.floating)) ? "start" : "end") ? "left" : "right") : (y = d, v = g === "end" ? "top" : "bottom");
      const x = h - p.top - p.bottom, R = b - p.left - p.right, S = br(h - p[v], x), E = br(b - p[y], R), C = !n.middlewareData.shift;
      let T = S, N = E;
      if ((r = n.middlewareData.shift) != null && r.enabled.x && (N = R), (o = n.middlewareData.shift) != null && o.enabled.y && (T = x), C && !g) {
        const L = _t(p.left, 0), A = _t(p.right, 0), P = _t(p.top, 0), O = _t(p.bottom, 0);
        m ? N = b - 2 * (L !== 0 || A !== 0 ? L + A : _t(p.left, p.right)) : T = h - 2 * (P !== 0 || O !== 0 ? P + O : _t(p.top, p.bottom));
      }
      await f({
        ...n,
        availableWidth: N,
        availableHeight: T
      });
      const I = await a.getDimensions(l.floating);
      return b !== I.width || h !== I.height ? {
        reset: {
          rects: true
        }
      } : {};
    }
  };
};
function qf(e) {
  const n = Vt(e);
  let r = parseFloat(n.width) || 0, o = parseFloat(n.height) || 0;
  const s = st(e), i = s ? e.offsetWidth : r, a = s ? e.offsetHeight : o, l = hs(r) !== i || hs(o) !== a;
  return l && (r = i, o = a), {
    width: r,
    height: o,
    $: l
  };
}
function al(e) {
  return Ke(e) ? e : e.contextElement;
}
function pr(e) {
  const n = al(e);
  if (!st(n))
    return Xt(1);
  const r = n.getBoundingClientRect(), {
    width: o,
    height: s,
    $: i
  } = qf(n);
  let a = (i ? hs(r.width) : r.width) / o, l = (i ? hs(r.height) : r.height) / s;
  return (!a || !Number.isFinite(a)) && (a = 1), (!l || !Number.isFinite(l)) && (l = 1), {
    x: a,
    y: l
  };
}
const Px = /* @__PURE__ */ Xt(0);
function Xf(e) {
  const n = pt(e);
  return !$s() || !n.visualViewport ? Px : {
    x: n.visualViewport.offsetLeft,
    y: n.visualViewport.offsetTop
  };
}
function Mx(e, n, r) {
  return n === void 0 && (n = false), !r || n && r !== pt(e) ? false : n;
}
function Yn(e, n, r, o) {
  n === void 0 && (n = false), r === void 0 && (r = false);
  const s = e.getBoundingClientRect(), i = al(e);
  let a = Xt(1);
  n && (o ? Ke(o) && (a = pr(o)) : a = pr(e));
  const l = Mx(i, r, o) ? Xf(i) : Xt(0);
  let f = (s.left + l.x) / a.x, u = (s.top + l.y) / a.y, p = s.width / a.x, d = s.height / a.y;
  if (i) {
    const g = pt(i), m = o && Ke(o) ? pt(o) : o;
    let b = g, h = aa(b);
    for (; h && o && m !== b; ) {
      const v = pr(h), y = h.getBoundingClientRect(), x = Vt(h), R = y.left + (h.clientLeft + parseFloat(x.paddingLeft)) * v.x, S = y.top + (h.clientTop + parseFloat(x.paddingTop)) * v.y;
      f *= v.x, u *= v.y, p *= v.x, d *= v.y, f += R, u += S, b = pt(h), h = aa(b);
    }
  }
  return eo({
    width: p,
    height: d,
    x: f,
    y: u
  });
}
function qs(e, n) {
  const r = zs(e).scrollLeft;
  return n ? n.left + r : Yn(tn(e)).left + r;
}
function Jf(e, n) {
  const r = e.getBoundingClientRect(), o = r.left + n.scrollLeft - qs(e, r), s = r.top + n.scrollTop;
  return {
    x: o,
    y: s
  };
}
function Dx(e) {
  let {
    elements: n,
    rect: r,
    offsetParent: o,
    strategy: s
  } = e;
  const i = s === "fixed", a = tn(o), l = n ? Bs(n.floating) : false;
  if (o === a || l && i)
    return r;
  let f = {
    scrollLeft: 0,
    scrollTop: 0
  }, u = Xt(1);
  const p = Xt(0), d = st(o);
  if ((d || !d && !i) && ((Mn(o) !== "body" || Dn(a)) && (f = zs(o)), d)) {
    const m = Yn(o);
    u = pr(o), p.x = m.x + o.clientLeft, p.y = m.y + o.clientTop;
  }
  const g = a && !d && !i ? Jf(a, f) : Xt(0);
  return {
    width: r.width * u.x,
    height: r.height * u.y,
    x: r.x * u.x - f.scrollLeft * u.x + p.x + g.x,
    y: r.y * u.y - f.scrollTop * u.y + p.y + g.y
  };
}
function Ax(e) {
  return Array.from(e.getClientRects());
}
function Lx(e) {
  const n = tn(e), r = zs(e), o = e.ownerDocument.body, s = _t(n.scrollWidth, n.clientWidth, o.scrollWidth, o.clientWidth), i = _t(n.scrollHeight, n.clientHeight, o.scrollHeight, o.clientHeight);
  let a = -r.scrollLeft + qs(e);
  const l = -r.scrollTop;
  return Vt(o).direction === "rtl" && (a += _t(n.clientWidth, o.clientWidth) - s), {
    width: s,
    height: i,
    x: a,
    y: l
  };
}
const fu = 25;
function Fx(e, n) {
  const r = pt(e), o = tn(e), s = r.visualViewport;
  let i = o.clientWidth, a = o.clientHeight, l = 0, f = 0;
  if (s) {
    i = s.width, a = s.height;
    const p = $s();
    (!p || p && n === "fixed") && (l = s.offsetLeft, f = s.offsetTop);
  }
  const u = qs(o);
  if (u <= 0) {
    const p = o.ownerDocument, d = p.body, g = getComputedStyle(d), m = p.compatMode === "CSS1Compat" && parseFloat(g.marginLeft) + parseFloat(g.marginRight) || 0, b = Math.abs(o.clientWidth - d.clientWidth - m);
    b <= fu && (i -= b);
  } else u <= fu && (i += u);
  return {
    width: i,
    height: a,
    x: l,
    y: f
  };
}
function _x(e, n) {
  const r = Yn(e, true, n === "fixed"), o = r.top + e.clientTop, s = r.left + e.clientLeft, i = st(e) ? pr(e) : Xt(1), a = e.clientWidth * i.x, l = e.clientHeight * i.y, f = s * i.x, u = o * i.y;
  return {
    width: a,
    height: l,
    x: f,
    y: u
  };
}
function pu(e, n, r) {
  let o;
  if (n === "viewport")
    o = Fx(e, r);
  else if (n === "document")
    o = Lx(tn(e));
  else if (Ke(n))
    o = _x(n, r);
  else {
    const s = Xf(e);
    o = {
      x: n.x - s.x,
      y: n.y - s.y,
      width: n.width,
      height: n.height
    };
  }
  return eo(o);
}
function Zf(e, n) {
  const r = Qt(e);
  return r === n || !Ke(r) || qt(r) ? false : Vt(r).position === "fixed" || Zf(r, n);
}
function Vx(e, n) {
  const r = n.get(e);
  if (r)
    return r;
  let o = Zr(e, [], false).filter((l) => Ke(l) && Mn(l) !== "body"), s = null;
  const i = Vt(e).position === "fixed";
  let a = i ? Qt(e) : e;
  for (; Ke(a) && !qt(a); ) {
    const l = Vt(a), f = ja(a);
    !f && l.position === "fixed" && (s = null), (i ? !f && !s : !f && l.position === "static" && !!s && (s.position === "absolute" || s.position === "fixed") || Dn(a) && !f && Zf(e, a)) ? o = o.filter((p) => p !== a) : s = l, a = Qt(a);
  }
  return n.set(e, o), o;
}
function Bx(e) {
  let {
    element: n,
    boundary: r,
    rootBoundary: o,
    strategy: s
  } = e;
  const a = [...r === "clippingAncestors" ? Bs(n) ? [] : Vx(n, this._c) : [].concat(r), o], l = pu(n, a[0], s);
  let f = l.top, u = l.right, p = l.bottom, d = l.left;
  for (let g = 1; g < a.length; g++) {
    const m = pu(n, a[g], s);
    f = _t(m.top, f), u = br(m.right, u), p = br(m.bottom, p), d = _t(m.left, d);
  }
  return {
    width: u - d,
    height: p - f,
    x: d,
    y: f
  };
}
function $x(e) {
  const {
    width: n,
    height: r
  } = qf(e);
  return {
    width: n,
    height: r
  };
}
function zx(e, n, r) {
  const o = st(n), s = tn(n), i = r === "fixed", a = Yn(e, true, i, n);
  let l = {
    scrollLeft: 0,
    scrollTop: 0
  };
  const f = Xt(0);
  function u() {
    f.x = qs(s);
  }
  if (o || !o && !i)
    if ((Mn(n) !== "body" || Dn(s)) && (l = zs(n)), o) {
      const m = Yn(n, true, i, n);
      f.x = m.x + n.clientLeft, f.y = m.y + n.clientTop;
    } else s && u();
  i && !o && s && u();
  const p = s && !o && !i ? Jf(s, l) : Xt(0), d = a.left + l.scrollLeft - f.x - p.x, g = a.top + l.scrollTop - f.y - p.y;
  return {
    x: d,
    y: g,
    width: a.width,
    height: a.height
  };
}
function Si(e) {
  return Vt(e).position === "static";
}
function mu(e, n) {
  if (!st(e) || Vt(e).position === "fixed")
    return null;
  if (n)
    return n(e);
  let r = e.offsetParent;
  return tn(e) === r && (r = r.ownerDocument.body), r;
}
function Qf(e, n) {
  const r = pt(e);
  if (Bs(e))
    return r;
  if (!st(e)) {
    let s = Qt(e);
    for (; s && !qt(s); ) {
      if (Ke(s) && !Si(s))
        return s;
      s = Qt(s);
    }
    return r;
  }
  let o = mu(e, n);
  for (; o && sy(o) && Si(o); )
    o = mu(o, n);
  return o && qt(o) && Si(o) && !ja(o) ? r : o || ly(e) || r;
}
const Hx = async function(e) {
  const n = this.getOffsetParent || Qf, r = this.getDimensions, o = await r(e.floating);
  return {
    reference: zx(e.reference, await n(e.floating), e.strategy),
    floating: {
      x: 0,
      y: 0,
      width: o.width,
      height: o.height
    }
  };
};
function Ux(e) {
  return Vt(e).direction === "rtl";
}
const ep = {
  convertOffsetParentRelativeRectToViewportRelativeRect: Dx,
  getDocumentElement: tn,
  getClippingRect: Bx,
  getOffsetParent: Qf,
  getElementRects: Hx,
  getClientRects: Ax,
  getDimensions: $x,
  getScale: pr,
  isElement: Ke,
  isRTL: Ux
};
function tp(e, n) {
  return e.x === n.x && e.y === n.y && e.width === n.width && e.height === n.height;
}
function Wx(e, n) {
  let r = null, o;
  const s = tn(e);
  function i() {
    var l;
    clearTimeout(o), (l = r) == null || l.disconnect(), r = null;
  }
  function a(l, f) {
    l === void 0 && (l = false), f === void 0 && (f = 1), i();
    const u = e.getBoundingClientRect(), {
      left: p,
      top: d,
      width: g,
      height: m
    } = u;
    if (l || n(), !g || !m)
      return;
    const b = Un(d), h = Un(s.clientWidth - (p + g)), v = Un(s.clientHeight - (d + m)), y = Un(p), R = {
      rootMargin: -b + "px " + -h + "px " + -v + "px " + -y + "px",
      threshold: _t(0, br(1, f)) || 1
    };
    let S = true;
    function E(C) {
      const T = C[0].intersectionRatio;
      if (T !== f) {
        if (!S)
          return a();
        T ? a(false, T) : o = setTimeout(() => {
          a(false, 1e-7);
        }, 1e3);
      }
      T === 1 && !tp(u, e.getBoundingClientRect()) && a(), S = false;
    }
    try {
      r = new IntersectionObserver(E, {
        ...R,
        // Handle <iframe>s
        root: s.ownerDocument
      });
    } catch {
      r = new IntersectionObserver(E, R);
    }
    r.observe(e);
  }
  return a(true), i;
}
function gu(e, n, r, o) {
  o === void 0 && (o = {});
  const {
    ancestorScroll: s = true,
    ancestorResize: i = true,
    elementResize: a = typeof ResizeObserver == "function",
    layoutShift: l = typeof IntersectionObserver == "function",
    animationFrame: f = false
  } = o, u = al(e), p = s || i ? [...u ? Zr(u) : [], ...n ? Zr(n) : []] : [];
  p.forEach((y) => {
    s && y.addEventListener("scroll", r, {
      passive: true
    }), i && y.addEventListener("resize", r);
  });
  const d = u && l ? Wx(u, r) : null;
  let g = -1, m = null;
  a && (m = new ResizeObserver((y) => {
    let [x] = y;
    x && x.target === u && m && n && (m.unobserve(n), cancelAnimationFrame(g), g = requestAnimationFrame(() => {
      var R;
      (R = m) == null || R.observe(n);
    })), r();
  }), u && !f && m.observe(u), n && m.observe(n));
  let b, h = f ? Yn(e) : null;
  f && v();
  function v() {
    const y = Yn(e);
    h && !tp(h, y) && r(), h = y, b = requestAnimationFrame(v);
  }
  return r(), () => {
    var y;
    p.forEach((x) => {
      s && x.removeEventListener("scroll", r), i && x.removeEventListener("resize", r);
    }), d == null ? void 0 : d(), (y = m) == null || y.disconnect(), m = null, f && cancelAnimationFrame(b);
  };
}
const jx = Tx, Kx = kx, Gx = Sx, Yx = Ix, qx = Rx, Xx = Ox, Jx = (e, n, r) => {
  const o = /* @__PURE__ */ new Map(), s = {
    platform: ep,
    ...r
  }, i = {
    ...s.platform,
    _c: o
  };
  return Cx(e, n, {
    ...s,
    platform: i
  });
};
var Zx = typeof document < "u", Qx = function() {
}, is = Zx ? useLayoutEffect : Qx;
function Es(e, n) {
  if (e === n)
    return true;
  if (typeof e != typeof n)
    return false;
  if (typeof e == "function" && e.toString() === n.toString())
    return true;
  let r, o, s;
  if (e && n && typeof e == "object") {
    if (Array.isArray(e)) {
      if (r = e.length, r !== n.length) return false;
      for (o = r; o-- !== 0; )
        if (!Es(e[o], n[o]))
          return false;
      return true;
    }
    if (s = Object.keys(e), r = s.length, r !== Object.keys(n).length)
      return false;
    for (o = r; o-- !== 0; )
      if (!{}.hasOwnProperty.call(n, s[o]))
        return false;
    for (o = r; o-- !== 0; ) {
      const i = s[o];
      if (!(i === "_owner" && e.$$typeof) && !Es(e[i], n[i]))
        return false;
    }
    return true;
  }
  return e !== e && n !== n;
}
function np(e) {
  return typeof window > "u" ? 1 : (e.ownerDocument.defaultView || window).devicePixelRatio || 1;
}
function hu(e, n) {
  const r = np(e);
  return Math.round(n * r) / r;
}
function Ri(e) {
  const n = c.useRef(e);
  return is(() => {
    n.current = e;
  }), n;
}
function ew(e) {
  e === void 0 && (e = {});
  const {
    placement: n = "bottom",
    strategy: r = "absolute",
    middleware: o = [],
    platform: s,
    elements: {
      reference: i,
      floating: a
    } = {},
    transform: l = true,
    whileElementsMounted: f,
    open: u
  } = e, [p, d] = c.useState({
    x: 0,
    y: 0,
    strategy: r,
    placement: n,
    middlewareData: {},
    isPositioned: false
  }), [g, m] = c.useState(o);
  Es(g, o) || m(o);
  const [b, h] = c.useState(null), [v, y] = c.useState(null), x = c.useCallback(($) => {
    $ !== C.current && (C.current = $, h($));
  }, []), R = c.useCallback(($) => {
    $ !== T.current && (T.current = $, y($));
  }, []), S = i || b, E = a || v, C = c.useRef(null), T = c.useRef(null), N = c.useRef(p), I = f != null, L = Ri(f), A = Ri(s), P = Ri(u), O = c.useCallback(() => {
    if (!C.current || !T.current)
      return;
    const $ = {
      placement: n,
      strategy: r,
      middleware: g
    };
    A.current && ($.platform = A.current), Jx(C.current, T.current, $).then((F) => {
      const z = {
        ...F,
        // The floating element's position may be recomputed while it's closed
        // but still mounted (such as when transitioning out). To ensure
        // `isPositioned` will be `false` initially on the next open, avoid
        // setting it to `true` when `open === false` (must be specified).
        isPositioned: P.current !== false
      };
      M.current && !Es(N.current, z) && (N.current = z, Tt.flushSync(() => {
        d(z);
      }));
    });
  }, [g, n, r, A, P]);
  is(() => {
    u === false && N.current.isPositioned && (N.current.isPositioned = false, d(($) => ({
      ...$,
      isPositioned: false
    })));
  }, [u]);
  const M = c.useRef(false);
  is(() => (M.current = true, () => {
    M.current = false;
  }), []), is(() => {
    if (S && (C.current = S), E && (T.current = E), S && E) {
      if (L.current)
        return L.current(S, E, O);
      O();
    }
  }, [S, E, O, L, I]);
  const D = c.useMemo(() => ({
    reference: C,
    floating: T,
    setReference: x,
    setFloating: R
  }), [x, R]), _ = c.useMemo(() => ({
    reference: S,
    floating: E
  }), [S, E]), k = c.useMemo(() => {
    const $ = {
      position: r,
      left: 0,
      top: 0
    };
    if (!_.floating)
      return $;
    const F = hu(_.floating, p.x), z = hu(_.floating, p.y);
    return l ? {
      ...$,
      transform: "translate(" + F + "px, " + z + "px)",
      ...np(_.floating) >= 1.5 && {
        willChange: "transform"
      }
    } : {
      position: r,
      left: F,
      top: z
    };
  }, [r, l, _.floating, p.x, p.y]);
  return c.useMemo(() => ({
    ...p,
    update: O,
    refs: D,
    elements: _,
    floatingStyles: k
  }), [p, O, D, _, k]);
}
const tw = (e, n) => {
  const r = jx(e);
  return {
    name: r.name,
    fn: r.fn,
    options: [e, n]
  };
}, nw = (e, n) => {
  const r = Kx(e);
  return {
    name: r.name,
    fn: r.fn,
    options: [e, n]
  };
}, rw = (e, n) => ({
  fn: Xx(e).fn,
  options: [e, n]
}), ow = (e, n) => {
  const r = Gx(e);
  return {
    name: r.name,
    fn: r.fn,
    options: [e, n]
  };
}, sw = (e, n) => {
  const r = Yx(e);
  return {
    name: r.name,
    fn: r.fn,
    options: [e, n]
  };
}, iw = (e, n) => {
  const r = qx(e);
  return {
    name: r.name,
    fn: r.fn,
    options: [e, n]
  };
};
var aw = (e, n, r) => {
  if (n.length === 1 && n[0] === r) {
    let o = false;
    try {
      const s = {};
      e(s) === s && (o = true);
    } catch {
    }
    if (o) {
      let s;
      try {
        throw new Error();
      } catch (i) {
        ({ stack: s } = i);
      }
      console.warn(
        `The result function returned its own inputs without modification. e.g
\`createSelector([state => state.todos], todos => todos)\`
This could lead to inefficient memoization and unnecessary re-renders.
Ensure transformation logic is in the result function, and extraction logic is in the input selectors.`,
        { stack: s }
      );
    }
  }
}, lw = (e, n, r) => {
  const { memoize: o, memoizeOptions: s } = n, { inputSelectorResults: i, inputSelectorResultsCopy: a } = e, l = o(() => ({}), ...s);
  if (!(l.apply(null, i) === l.apply(null, a))) {
    let u;
    try {
      throw new Error();
    } catch (p) {
      ({ stack: u } = p);
    }
    console.warn(
      `An input selector returned a different result when passed same arguments.
This means your output selector will likely run more frequently than intended.
Avoid returning a new reference inside your input selector, e.g.
\`createSelector([state => state.todos.map(todo => todo.id)], todoIds => todoIds.length)\``,
      {
        arguments: r,
        firstInputs: i,
        secondInputs: a,
        stack: u
      }
    );
  }
}, cw = {
  inputStabilityCheck: "once",
  identityFunctionCheck: "once"
}, Cs = /* @__PURE__ */ Symbol("NOT_FOUND");
function uw(e, n = `expected a function, instead received ${typeof e}`) {
  if (typeof e != "function")
    throw new TypeError(n);
}
function dw(e, n = `expected an object, instead received ${typeof e}`) {
  if (typeof e != "object")
    throw new TypeError(n);
}
function fw(e, n = "expected all items to be functions, instead received the following types: ") {
  if (!e.every((r) => typeof r == "function")) {
    const r = e.map(
      (o) => typeof o == "function" ? `function ${o.name || "unnamed"}()` : typeof o
    ).join(", ");
    throw new TypeError(`${n}[${r}]`);
  }
}
var bu = (e) => Array.isArray(e) ? e : [e];
function pw(e) {
  const n = Array.isArray(e[0]) ? e[0] : e;
  return fw(
    n,
    "createSelector expects all input-selectors to be functions, but received the following types: "
  ), n;
}
function vu(e, n) {
  const r = [], { length: o } = e;
  for (let s = 0; s < o; s++)
    r.push(e[s].apply(null, n));
  return r;
}
var mw = (e, n) => {
  const { identityFunctionCheck: r, inputStabilityCheck: o } = {
    ...cw,
    ...n
  };
  return {
    identityFunctionCheck: {
      shouldRun: r === "always" || r === "once" && e,
      run: aw
    },
    inputStabilityCheck: {
      shouldRun: o === "always" || o === "once" && e,
      run: lw
    }
  };
};
function gw(e) {
  let n;
  return {
    get(r) {
      return n && e(n.key, r) ? n.value : Cs;
    },
    put(r, o) {
      n = { key: r, value: o };
    },
    getEntries() {
      return n ? [n] : [];
    },
    clear() {
      n = void 0;
    }
  };
}
function hw(e, n) {
  let r = [];
  function o(l) {
    const f = r.findIndex((u) => n(l, u.key));
    if (f > -1) {
      const u = r[f];
      return f > 0 && (r.splice(f, 1), r.unshift(u)), u.value;
    }
    return Cs;
  }
  function s(l, f) {
    o(l) === Cs && (r.unshift({ key: l, value: f }), r.length > e && r.pop());
  }
  function i() {
    return r;
  }
  function a() {
    r = [];
  }
  return { get: o, put: s, getEntries: i, clear: a };
}
var bw = (e, n) => e === n;
function vw(e) {
  return function(r, o) {
    if (r === null || o === null || r.length !== o.length)
      return false;
    const { length: s } = r;
    for (let i = 0; i < s; i++)
      if (!e(r[i], o[i]))
        return false;
    return true;
  };
}
function yw(e, n) {
  const r = typeof n == "object" ? n : { equalityCheck: n }, {
    equalityCheck: o = bw,
    maxSize: s = 1,
    resultEqualityCheck: i
  } = r, a = vw(o);
  let l = 0;
  const f = s <= 1 ? gw(a) : hw(s, a);
  function u() {
    let p = f.get(arguments);
    if (p === Cs) {
      if (p = e.apply(null, arguments), l++, i) {
        const g = f.getEntries().find(
          (m) => i(m.value, p)
        );
        g && (p = g.value, l !== 0 && l--);
      }
      f.put(arguments, p);
    }
    return p;
  }
  return u.clearCache = () => {
    f.clear(), u.resetResultsCount();
  }, u.resultsCount = () => l, u.resetResultsCount = () => {
    l = 0;
  }, u;
}
var xw = class {
  constructor(e) {
    this.value = e;
  }
  deref() {
    return this.value;
  }
}, ww = typeof WeakRef < "u" ? WeakRef : xw, Ew = 0, yu = 1;
function Vo() {
  return {
    s: Ew,
    v: void 0,
    o: null,
    p: null
  };
}
function rp(e, n = {}) {
  let r = Vo();
  const { resultEqualityCheck: o } = n;
  let s, i = 0;
  function a() {
    var _a2;
    let l = r;
    const { length: f } = arguments;
    for (let d = 0, g = f; d < g; d++) {
      const m = arguments[d];
      if (typeof m == "function" || typeof m == "object" && m !== null) {
        let b = l.o;
        b === null && (l.o = b = /* @__PURE__ */ new WeakMap());
        const h = b.get(m);
        h === void 0 ? (l = Vo(), b.set(m, l)) : l = h;
      } else {
        let b = l.p;
        b === null && (l.p = b = /* @__PURE__ */ new Map());
        const h = b.get(m);
        h === void 0 ? (l = Vo(), b.set(m, l)) : l = h;
      }
    }
    const u = l;
    let p;
    if (l.s === yu)
      p = l.v;
    else if (p = e.apply(null, arguments), i++, o) {
      const d = ((_a2 = s == null ? void 0 : s.deref) == null ? void 0 : _a2.call(s)) ?? s;
      d != null && o(d, p) && (p = d, i !== 0 && i--), s = typeof p == "object" && p !== null || typeof p == "function" ? new ww(p) : p;
    }
    return u.s = yu, u.v = p, p;
  }
  return a.clearCache = () => {
    r = Vo(), a.resetResultsCount();
  }, a.resultsCount = () => i, a.resetResultsCount = () => {
    i = 0;
  }, a;
}
function op(e, ...n) {
  const r = typeof e == "function" ? {
    memoize: e,
    memoizeOptions: n
  } : e, o = (...s) => {
    let i = 0, a = 0, l, f = {}, u = s.pop();
    typeof u == "object" && (f = u, u = s.pop()), uw(
      u,
      `createSelector expects an output function after the inputs, but received: [${typeof u}]`
    );
    const p = {
      ...r,
      ...f
    }, {
      memoize: d,
      memoizeOptions: g = [],
      argsMemoize: m = rp,
      argsMemoizeOptions: b = [],
      devModeChecks: h = {}
    } = p, v = bu(g), y = bu(b), x = pw(s), R = d(function() {
      return i++, u.apply(
        null,
        arguments
      );
    }, ...v);
    let S = true;
    const E = m(function() {
      a++;
      const T = vu(
        x,
        arguments
      );
      if (l = R.apply(null, T), process.env.NODE_ENV !== "production") {
        const { identityFunctionCheck: N, inputStabilityCheck: I } = mw(S, h);
        if (N.shouldRun && N.run(
          u,
          T,
          l
        ), I.shouldRun) {
          const L = vu(
            x,
            arguments
          );
          I.run(
            { inputSelectorResults: T, inputSelectorResultsCopy: L },
            { memoize: d, memoizeOptions: v },
            arguments
          );
        }
        S && (S = false);
      }
      return l;
    }, ...y);
    return Object.assign(E, {
      resultFunc: u,
      memoizedResultFunc: R,
      dependencies: x,
      dependencyRecomputations: () => a,
      resetDependencyRecomputations: () => {
        a = 0;
      },
      lastResult: () => l,
      recomputations: () => i,
      resetRecomputations: () => {
        i = 0;
      },
      memoize: d,
      argsMemoize: m
    });
  };
  return Object.assign(o, {
    withTypes: () => o
  }), o;
}
var Cw = /* @__PURE__ */ op(rp), Sw = Object.assign(
  (e, n = Cw) => {
    dw(
      e,
      `createStructuredSelector expects first argument to be an object where each property is a selector, instead received a ${typeof e}`
    );
    const r = Object.keys(e), o = r.map(
      (i) => e[i]
    );
    return n(
      o,
      (...i) => i.reduce((a, l, f) => (a[r[f]] = l, a), {})
    );
  },
  { withTypes: () => Sw }
);
op({
  memoize: yw,
  memoizeOptions: {
    maxSize: 1,
    equalityCheck: Object.is
  }
});
const ie = (e, n, r, o, s, i, ...a) => {
  if (a.length > 0)
    throw new Error(process.env.NODE_ENV !== "production" ? "Unsupported number of selectors" : Ze(1));
  let l;
  if (e)
    l = e;
  else
    throw (
      /* minify-error-disabled */
      new Error("Missing arguments")
    );
  return l;
};
var Bo = { exports: {} }, Ni = {};
var xu;
function Rw() {
  if (xu) return Ni;
  xu = 1;
  var e = c__default;
  function n(d, g) {
    return d === g && (d !== 0 || 1 / d === 1 / g) || d !== d && g !== g;
  }
  var r = typeof Object.is == "function" ? Object.is : n, o = e.useState, s = e.useEffect, i = e.useLayoutEffect, a = e.useDebugValue;
  function l(d, g) {
    var m = g(), b = o({ inst: { value: m, getSnapshot: g } }), h = b[0].inst, v = b[1];
    return i(
      function() {
        h.value = m, h.getSnapshot = g, f(h) && v({ inst: h });
      },
      [d, m, g]
    ), s(
      function() {
        return f(h) && v({ inst: h }), d(function() {
          f(h) && v({ inst: h });
        });
      },
      [d]
    ), a(m), m;
  }
  function f(d) {
    var g = d.getSnapshot;
    d = d.value;
    try {
      var m = g();
      return !r(d, m);
    } catch {
      return true;
    }
  }
  function u(d, g) {
    return g();
  }
  var p = typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u" ? u : l;
  return Ni.useSyncExternalStore = e.useSyncExternalStore !== void 0 ? e.useSyncExternalStore : p, Ni;
}
var Ti = {};
var wu;
function Nw() {
  return wu || (wu = 1, process.env.NODE_ENV !== "production" && (function() {
    function e(m, b) {
      return m === b && (m !== 0 || 1 / m === 1 / b) || m !== m && b !== b;
    }
    function n(m, b) {
      p || s.startTransition === void 0 || (p = true, console.error(
        "You are using an outdated, pre-release alpha of React 18 that does not support useSyncExternalStore. The use-sync-external-store shim will not work correctly. Upgrade to a newer pre-release."
      ));
      var h = b();
      if (!d) {
        var v = b();
        i(h, v) || (console.error(
          "The result of getSnapshot should be cached to avoid an infinite loop"
        ), d = true);
      }
      v = a({
        inst: { value: h, getSnapshot: b }
      });
      var y = v[0].inst, x = v[1];
      return f(
        function() {
          y.value = h, y.getSnapshot = b, r(y) && x({ inst: y });
        },
        [m, h, b]
      ), l(
        function() {
          return r(y) && x({ inst: y }), m(function() {
            r(y) && x({ inst: y });
          });
        },
        [m]
      ), u(h), h;
    }
    function r(m) {
      var b = m.getSnapshot;
      m = m.value;
      try {
        var h = b();
        return !i(m, h);
      } catch {
        return true;
      }
    }
    function o(m, b) {
      return b();
    }
    typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
    var s = c__default, i = typeof Object.is == "function" ? Object.is : e, a = s.useState, l = s.useEffect, f = s.useLayoutEffect, u = s.useDebugValue, p = false, d = false, g = typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u" ? o : n;
    Ti.useSyncExternalStore = s.useSyncExternalStore !== void 0 ? s.useSyncExternalStore : g, typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
  })()), Ti;
}
var Eu;
function ll() {
  return Eu || (Eu = 1, process.env.NODE_ENV === "production" ? Bo.exports = Rw() : Bo.exports = Nw()), Bo.exports;
}
var sp = ll(), $o = { exports: {} }, ki = {};
var Cu;
function Tw() {
  if (Cu) return ki;
  Cu = 1;
  var e = c__default, n = ll();
  function r(u, p) {
    return u === p && (u !== 0 || 1 / u === 1 / p) || u !== u && p !== p;
  }
  var o = typeof Object.is == "function" ? Object.is : r, s = n.useSyncExternalStore, i = e.useRef, a = e.useEffect, l = e.useMemo, f = e.useDebugValue;
  return ki.useSyncExternalStoreWithSelector = function(u, p, d, g, m) {
    var b = i(null);
    if (b.current === null) {
      var h = { hasValue: false, value: null };
      b.current = h;
    } else h = b.current;
    b = l(
      function() {
        function y(C) {
          if (!x) {
            if (x = true, R = C, C = g(C), m !== void 0 && h.hasValue) {
              var T = h.value;
              if (m(T, C))
                return S = T;
            }
            return S = C;
          }
          if (T = S, o(R, C)) return T;
          var N = g(C);
          return m !== void 0 && m(T, N) ? (R = C, T) : (R = C, S = N);
        }
        var x = false, R, S, E = d === void 0 ? null : d;
        return [
          function() {
            return y(p());
          },
          E === null ? void 0 : function() {
            return y(E());
          }
        ];
      },
      [p, d, g, m]
    );
    var v = s(u, b[0], b[1]);
    return a(
      function() {
        h.hasValue = true, h.value = v;
      },
      [v]
    ), f(v), v;
  }, ki;
}
var Oi = {};
var Su;
function kw() {
  return Su || (Su = 1, process.env.NODE_ENV !== "production" && (function() {
    function e(u, p) {
      return u === p && (u !== 0 || 1 / u === 1 / p) || u !== u && p !== p;
    }
    typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
    var n = c__default, r = ll(), o = typeof Object.is == "function" ? Object.is : e, s = r.useSyncExternalStore, i = n.useRef, a = n.useEffect, l = n.useMemo, f = n.useDebugValue;
    Oi.useSyncExternalStoreWithSelector = function(u, p, d, g, m) {
      var b = i(null);
      if (b.current === null) {
        var h = { hasValue: false, value: null };
        b.current = h;
      } else h = b.current;
      b = l(
        function() {
          function y(C) {
            if (!x) {
              if (x = true, R = C, C = g(C), m !== void 0 && h.hasValue) {
                var T = h.value;
                if (m(T, C))
                  return S = T;
              }
              return S = C;
            }
            if (T = S, o(R, C))
              return T;
            var N = g(C);
            return m !== void 0 && m(T, N) ? (R = C, T) : (R = C, S = N);
          }
          var x = false, R, S, E = d === void 0 ? null : d;
          return [
            function() {
              return y(p());
            },
            E === null ? void 0 : function() {
              return y(E());
            }
          ];
        },
        [p, d, g, m]
      );
      var v = s(u, b[0], b[1]);
      return a(
        function() {
          h.hasValue = true, h.value = v;
        },
        [v]
      ), f(v), v;
    }, typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop == "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
  })()), Oi;
}
var Ru;
function Ow() {
  return Ru || (Ru = 1, process.env.NODE_ENV === "production" ? $o.exports = Tw() : $o.exports = kw()), $o.exports;
}
var Iw = Ow();
const va = [];
let ya;
function Pw() {
  return ya;
}
function Mw(e) {
  va.push(e);
}
function cl(e) {
  const n = (r, o) => {
    const s = xt(Dw).current;
    let i;
    try {
      ya = s;
      for (const a of va)
        a.before(s);
      i = e(r, o);
      for (const a of va)
        a.after(s);
      s.didInitialize = true;
    } finally {
      ya = void 0;
    }
    return i;
  };
  return n.displayName = e.displayName || e.name, n;
}
function ip(e) {
  return /* @__PURE__ */ c.forwardRef(cl(e));
}
function Dw() {
  return {
    didInitialize: false
  };
}
const Aw = $a(19), Lw = Aw ? _w : Vw;
function ke(e, n, r, o, s) {
  return Lw(e, n, r, o, s);
}
function Fw(e, n, r, o, s) {
  const i = c.useCallback(() => n(e.getSnapshot(), r, o, s), [e, n, r, o, s]);
  return sp.useSyncExternalStore(e.subscribe, i, i);
}
Mw({
  before(e) {
    e.syncIndex = 0, e.didInitialize || (e.syncTick = 1, e.syncHooks = [], e.didChangeStore = true, e.getSnapshot = () => {
      let n = false;
      for (let r = 0; r < e.syncHooks.length; r += 1) {
        const o = e.syncHooks[r], s = o.selector(o.store.state, o.a1, o.a2, o.a3);
        (o.didChange || !Object.is(o.value, s)) && (n = true, o.value = s, o.didChange = false);
      }
      return n && (e.syncTick += 1), e.syncTick;
    });
  },
  after(e) {
    e.syncHooks.length > 0 && (e.didChangeStore && (e.didChangeStore = false, e.subscribe = (n) => {
      const r = /* @__PURE__ */ new Set();
      for (const s of e.syncHooks)
        r.add(s.store);
      const o = [];
      for (const s of r)
        o.push(s.subscribe(n));
      return () => {
        for (const s of o)
          s();
      };
    }), sp.useSyncExternalStore(e.subscribe, e.getSnapshot, e.getSnapshot));
  }
});
function _w(e, n, r, o, s) {
  const i = Pw();
  if (!i)
    return Fw(e, n, r, o, s);
  const a = i.syncIndex;
  i.syncIndex += 1;
  let l;
  return i.didInitialize ? (l = i.syncHooks[a], (l.store !== e || l.selector !== n || !Object.is(l.a1, r) || !Object.is(l.a2, o) || !Object.is(l.a3, s)) && (l.store !== e && (i.didChangeStore = true), l.store = e, l.selector = n, l.a1 = r, l.a2 = o, l.a3 = s, l.didChange = true)) : (l = {
    store: e,
    selector: n,
    a1: r,
    a2: o,
    a3: s,
    value: n(e.getSnapshot(), r, o, s),
    didChange: false
  }, i.syncHooks.push(l)), l.value;
}
function Vw(e, n, r, o, s) {
  return Iw.useSyncExternalStoreWithSelector(e.subscribe, e.getSnapshot, e.getSnapshot, (i) => n(i, r, o, s));
}
class ap {
  /**
   * The current state of the store.
   * This property is updated immediately when the state changes as a result of calling {@link setState}, {@link update}, or {@link set}.
   * To subscribe to state changes, use the {@link useState} method. The value returned by {@link useState} is updated after the component renders (similarly to React's useState).
   * The values can be used directly (to avoid subscribing to the store) in effects or event handlers.
   *
   * Do not modify properties in state directly. Instead, use the provided methods to ensure proper state management and listener notification.
   */
  // Internal state to handle recursive `setState()` calls
  constructor(n) {
    /**
     * Registers a listener that will be called whenever the store's state changes.
     *
     * @param fn The listener function to be called on state changes.
     * @returns A function to unsubscribe the listener.
     */
    __publicField(this, "subscribe", (n) => (this.listeners.add(n), () => {
      this.listeners.delete(n);
    }));
    /**
     * Returns the current state of the store.
     */
    __publicField(this, "getSnapshot", () => this.state);
    this.state = n, this.listeners = /* @__PURE__ */ new Set(), this.updateTick = 0;
  }
  /**
   * Updates the entire store's state and notifies all registered listeners.
   *
   * @param newState The new state to set for the store.
   */
  setState(n) {
    if (this.state === n)
      return;
    this.state = n, this.updateTick += 1;
    const r = this.updateTick;
    for (const o of this.listeners) {
      if (r !== this.updateTick)
        return;
      o(n);
    }
  }
  /**
   * Merges the provided changes into the current state and notifies listeners if there are changes.
   *
   * @param changes An object containing the changes to apply to the current state.
   */
  update(n) {
    for (const r in n)
      if (!Object.is(this.state[r], n[r])) {
        this.setState({
          ...this.state,
          ...n
        });
        return;
      }
  }
  /**
   * Sets a specific key in the store's state to a new value and notifies listeners if the value has changed.
   *
   * @param key The key in the store's state to update.
   * @param value The new value to set for the specified key.
   */
  set(n, r) {
    Object.is(this.state[n], r) || this.setState({
      ...this.state,
      [n]: r
    });
  }
  /**
   * Gives the state a new reference and updates all registered listeners.
   */
  notifyAll() {
    const n = {
      ...this.state
    };
    this.setState(n);
  }
  use(n, r, o, s) {
    return ke(this, n, r, o, s);
  }
}
class vo extends ap {
  /**
   * Creates a new ReactStore instance.
   *
   * @param state Initial state of the store.
   * @param context Non-reactive context values.
   * @param selectors Optional selectors for use with `useState`.
   */
  constructor(n, r = {}, o) {
    super(n), this.context = r, this.selectors = o;
  }
  /**
   * Non-reactive values such as refs, callbacks, etc.
   */
  /**
   * Synchronizes a single external value into the store.
   *
   * Note that the while the value in `state` is updated immediately, the value returned
   * by `useState` is updated before the next render (similarly to React's `useState`).
   */
  useSyncedValue(n, r) {
    c.useDebugValue(n), ce(() => {
      this.state[n] !== r && this.set(n, r);
    }, [n, r]);
  }
  /**
   * Synchronizes a single external value into the store and
   * cleans it up (sets to `undefined`) on unmount.
   *
   * Note that the while the value in `state` is updated immediately, the value returned
   * by `useState` is updated before the next render (similarly to React's `useState`).
   */
  useSyncedValueWithCleanup(n, r) {
    const o = this;
    ce(() => (o.state[n] !== r && o.set(n, r), () => {
      o.set(n, void 0);
    }), [o, n, r]);
  }
  /**
   * Synchronizes multiple external values into the store.
   *
   * Note that the while the values in `state` are updated immediately, the values returned
   * by `useState` are updated before the next render (similarly to React's `useState`).
   */
  useSyncedValues(n) {
    const r = this;
    if (process.env.NODE_ENV !== "production") {
      c.useDebugValue(n, (a) => Object.keys(a));
      const s = c.useRef(Object.keys(n)).current, i = Object.keys(n);
      (s.length !== i.length || s.some((a, l) => a !== i[l])) && console.error("ReactStore.useSyncedValues expects the same prop keys on every render. Keys should be stable.");
    }
    const o = Object.values(n);
    ce(() => {
      r.update(n);
    }, [r, ...o]);
  }
  /**
   * Registers a controllable prop pair (`controlled`, `defaultValue`) for a specific key. If `controlled`
   * is non-undefined, the store's state at `key` is updated to match `controlled`.
   */
  useControlledProp(n, r) {
    c.useDebugValue(n);
    const o = r !== void 0;
    if (ce(() => {
      o && !Object.is(this.state[n], r) && super.setState({
        ...this.state,
        [n]: r
      });
    }, [n, r, o]), process.env.NODE_ENV !== "production") {
      const s = this.controlledValues ?? (this.controlledValues = /* @__PURE__ */ new Map());
      s.has(n) || s.set(n, o);
      const i = s.get(n);
      i !== void 0 && i !== o && console.error(`A component is changing the ${o ? "" : "un"}controlled state of ${n.toString()} to be ${o ? "un" : ""}controlled. Elements should not switch from uncontrolled to controlled (or vice versa).`);
    }
  }
  /** Gets the current value from the store using a selector with the provided key.
   *
   * @param key Key of the selector to use.
   */
  select(n, r, o, s) {
    const i = this.selectors[n];
    return i(this.state, r, o, s);
  }
  /**
   * Returns a value from the store's state using a selector function.
   * Used to subscribe to specific parts of the state.
   * This methods causes a rerender whenever the selected state changes.
   *
   * @param key Key of the selector to use.
   */
  useState(n, r, o, s) {
    return c.useDebugValue(n), ke(this, this.selectors[n], r, o, s);
  }
  /**
   * Wraps a function with `useStableCallback` to ensure it has a stable reference
   * and assigns it to the context.
   *
   * @param key Key of the event callback. Must be a function in the context.
   * @param fn Function to assign.
   */
  useContextCallback(n, r) {
    c.useDebugValue(n);
    const o = de(r ?? It);
    this.context[n] = o;
  }
  /**
   * Returns a stable setter function for a specific key in the store's state.
   * It's commonly used to pass as a ref callback to React elements.
   *
   * @param key Key of the state to set.
   */
  useStateSetter(n) {
    const r = c.useRef(void 0);
    return r.current === void 0 && (r.current = (o) => {
      this.set(n, o);
    }), r.current;
  }
  /**
   * Observes changes derived from the store's selectors and calls the listener when the selected value changes.
   *
   * @param key Key of the selector to observe.
   * @param listener Listener function called when the selector result changes.
   */
  observe(n, r) {
    let o;
    typeof n == "function" ? o = n : o = this.selectors[n];
    let s = o(this.state);
    return r(s, s, this), this.subscribe((i) => {
      const a = o(i);
      if (!Object.is(s, a)) {
        const l = s;
        s = a, r(a, l, this);
      }
    });
  }
}
const Bw = {
  open: ie((e) => e.open),
  domReferenceElement: ie((e) => e.domReferenceElement),
  referenceElement: ie((e) => e.positionReference ?? e.referenceElement),
  floatingElement: ie((e) => e.floatingElement),
  floatingId: ie((e) => e.floatingId)
};
class ul extends vo {
  constructor(n) {
    const {
      nested: r,
      noEmit: o,
      onOpenChange: s,
      triggerElements: i,
      ...a
    } = n;
    super({
      ...a,
      positionReference: a.referenceElement,
      domReferenceElement: a.referenceElement
    }, {
      onOpenChange: s,
      dataRef: {
        current: {}
      },
      events: jf(),
      nested: r,
      noEmit: o,
      triggerElements: i
    }, Bw);
    /**
     * Emits the `openchange` event through the internal event emitter and calls the `onOpenChange` handler with the provided arguments.
     *
     * @param newOpen The new open state.
     * @param eventDetails Details about the event that triggered the open state change.
     */
    __publicField(this, "setOpen", (n, r) => {
      var _a2, _b2;
      if ((!n || !this.state.open || // Prevent a pending hover-open from overwriting a click-open event, while allowing
      // click events to upgrade a hover-open.
      vf(r.event)) && (this.context.dataRef.current.openEvent = n ? r.event : void 0), !this.context.noEmit) {
        const o = {
          open: n,
          reason: r.reason,
          nativeEvent: r.event,
          nested: this.context.nested,
          triggerElement: r.trigger
        };
        this.context.events.emit("openchange", o);
      }
      (_b2 = (_a2 = this.context).onOpenChange) == null ? void 0 : _b2.call(_a2, n, r);
    });
  }
}
function $w(e, n) {
  const r = c.useRef(null), o = c.useRef(null);
  return c.useCallback((s) => {
    if (e !== void 0) {
      if (r.current !== null) {
        const i = r.current, a = o.current, l = n.context.triggerElements.getById(i);
        a && l === a && n.context.triggerElements.delete(i), r.current = null, o.current = null;
      }
      s !== null && (r.current = e, o.current = s, n.context.triggerElements.add(e, s));
    }
  }, [n, e]);
}
function Xs(e, n, r, o) {
  const s = r.useState("isMountedByTrigger", e), i = $w(e, r), a = de((l) => {
    if (i(l), !l || !r.select("open"))
      return;
    const f = r.select("activeTriggerId");
    if (f === e) {
      r.update({
        activeTriggerElement: l,
        ...o
      });
      return;
    }
    f == null && r.update({
      activeTriggerId: e,
      activeTriggerElement: l,
      ...o
    });
  });
  return ce(() => {
    s && r.update({
      activeTriggerElement: n.current,
      ...o
    });
  }, [s, r, n, ...Object.values(o)]), {
    registerTrigger: a,
    isMountedByThisTrigger: s
  };
}
function Js(e) {
  const n = e.useState("open");
  ce(() => {
    if (n && !e.select("activeTriggerId") && e.context.triggerElements.size === 1) {
      const r = e.context.triggerElements.entries().next();
      if (!r.done) {
        const [o, s] = r.value;
        e.update({
          activeTriggerId: o,
          activeTriggerElement: s
        });
      }
    }
  }, [n, e]);
}
function Zs(e, n, r) {
  const {
    mounted: o,
    setMounted: s,
    transitionStatus: i
  } = uo(e);
  n.useSyncedValues({
    mounted: o,
    transitionStatus: i
  });
  const a = de(() => {
    var _a2, _b2;
    s(false), n.update({
      activeTriggerId: null,
      activeTriggerElement: null,
      mounted: false
    }), r == null ? void 0 : r(), (_b2 = (_a2 = n.context).onOpenChangeComplete) == null ? void 0 : _b2.call(_a2, false);
  }), l = n.useState("preventUnmountingOnClose");
  return rn({
    enabled: !l,
    open: e,
    ref: n.context.popupRef,
    onComplete() {
      e || a();
    }
  }), {
    forceUnmount: a,
    transitionStatus: i
  };
}
class Nr {
  constructor() {
    this.elementsSet = /* @__PURE__ */ new Set(), this.idMap = /* @__PURE__ */ new Map();
  }
  /**
   * Adds a trigger element with the given ID.
   *
   * Note: The provided element is assumed to not be registered under multiple IDs.
   */
  add(n, r) {
    const o = this.idMap.get(n);
    if (o !== r && (o !== void 0 && this.elementsSet.delete(o), this.elementsSet.add(r), this.idMap.set(n, r), process.env.NODE_ENV !== "production" && this.elementsSet.size !== this.idMap.size))
      throw new Error("Base UI: A trigger element cannot be registered under multiple IDs in PopupTriggerMap.");
  }
  /**
   * Removes the trigger element with the given ID.
   */
  delete(n) {
    const r = this.idMap.get(n);
    r && (this.elementsSet.delete(r), this.idMap.delete(n));
  }
  /**
   * Whether the given element is registered as a trigger.
   */
  hasElement(n) {
    return this.elementsSet.has(n);
  }
  /**
   * Whether there is a registered trigger element matching the given predicate.
   */
  hasMatchingElement(n) {
    for (const r of this.elementsSet)
      if (n(r))
        return true;
    return false;
  }
  /**
   * Returns the trigger element associated with the given ID, or undefined if no such element exists.
   */
  getById(n) {
    return this.idMap.get(n);
  }
  /**
   * Returns an iterable of all registered trigger entries, where each entry is a tuple of [id, element].
   */
  entries() {
    return this.idMap.entries();
  }
  /**
   * Returns an iterable of all registered trigger elements.
   */
  elements() {
    return this.elementsSet.values();
  }
  /**
   * Returns the number of registered trigger elements.
   */
  get size() {
    return this.idMap.size;
  }
}
function zw() {
  return new ul({
    open: false,
    floatingElement: null,
    referenceElement: null,
    triggerElements: new Nr(),
    floatingId: "",
    nested: false,
    noEmit: false,
    onOpenChange: void 0
  });
}
function Qs() {
  return {
    open: false,
    openProp: void 0,
    mounted: false,
    transitionStatus: "idle",
    floatingRootContext: zw(),
    preventUnmountingOnClose: false,
    payload: void 0,
    activeTriggerId: null,
    activeTriggerElement: null,
    triggerIdProp: void 0,
    popupElement: null,
    positionerElement: null,
    activeTriggerProps: ct,
    inactiveTriggerProps: ct,
    popupProps: ct
  };
}
const zo = ie((e) => e.triggerIdProp ?? e.activeTriggerId), ei = {
  open: ie((e) => e.openProp ?? e.open),
  mounted: ie((e) => e.mounted),
  transitionStatus: ie((e) => e.transitionStatus),
  floatingRootContext: ie((e) => e.floatingRootContext),
  preventUnmountingOnClose: ie((e) => e.preventUnmountingOnClose),
  payload: ie((e) => e.payload),
  activeTriggerId: zo,
  activeTriggerElement: ie((e) => e.mounted ? e.activeTriggerElement : null),
  /**
   * Whether the trigger with the given ID was used to open the popup.
   */
  isTriggerActive: ie((e, n) => n !== void 0 && zo(e) === n),
  /**
   * Whether the popup is open and was activated by a trigger with the given ID.
   */
  isOpenedByTrigger: ie((e, n) => n !== void 0 && zo(e) === n && e.open),
  /**
   * Whether the popup is mounted and was activated by a trigger with the given ID.
   */
  isMountedByTrigger: ie((e, n) => n !== void 0 && zo(e) === n && e.mounted),
  triggerProps: ie((e, n) => n ? e.activeTriggerProps : e.inactiveTriggerProps),
  popupProps: ie((e) => e.popupProps),
  popupElement: ie((e) => e.popupElement),
  positionerElement: ie((e) => e.positionerElement)
};
function lp(e) {
  const {
    open: n = false,
    onOpenChange: r,
    elements: o = {}
  } = e, s = er(), i = on() != null;
  if (process.env.NODE_ENV !== "production") {
    const l = o.reference;
    l && !Ke(l) && console.error("Cannot pass a virtual element to the `elements.reference` option,", "as it must be a real DOM element. Use `context.setPositionReference()`", "instead.");
  }
  const a = xt(() => new ul({
    open: n,
    onOpenChange: r,
    referenceElement: o.reference ?? null,
    floatingElement: o.floating ?? null,
    triggerElements: new Nr(),
    floatingId: s,
    nested: i,
    noEmit: false
  })).current;
  return ce(() => {
    const l = {
      open: n,
      floatingId: s
    };
    o.reference !== void 0 && (l.referenceElement = o.reference, l.domReferenceElement = Ke(o.reference) ? o.reference : null), o.floating !== void 0 && (l.floatingElement = o.floating), a.update(l);
  }, [n, s, o.reference, o.floating, a]), a.context.onOpenChange = r, a.context.nested = i, a.context.noEmit = false, a;
}
function Hw(e = {}) {
  const {
    nodeId: n,
    externalTree: r
  } = e, o = lp(e), s = e.rootContext || o, i = {
    reference: s.useState("referenceElement"),
    floating: s.useState("floatingElement"),
    domReference: s.useState("domReferenceElement")
  }, [a, l] = c.useState(null), f = c.useRef(null), u = Ln(r);
  ce(() => {
    i.domReference && (f.current = i.domReference);
  }, [i.domReference]);
  const p = ew({
    ...e,
    elements: {
      ...i,
      ...a && {
        reference: a
      }
    }
  }), d = c.useCallback((T) => {
    const N = Ke(T) ? {
      getBoundingClientRect: () => T.getBoundingClientRect(),
      getClientRects: () => T.getClientRects(),
      contextElement: T
    } : T;
    l(N), p.refs.setReference(N);
  }, [p.refs]), [g, m] = c.useState(null), [b, h] = c.useState(null);
  s.useSyncedValue("referenceElement", g), s.useSyncedValue("domReferenceElement", Ke(g) ? g : null), s.useSyncedValue("floatingElement", b);
  const v = c.useCallback((T) => {
    (Ke(T) || T === null) && (f.current = T, m(T)), (Ke(p.refs.reference.current) || p.refs.reference.current === null || // Don't allow setting virtual elements using the old technique back to
    // `null` to support `positionReference` + an unstable `reference`
    // callback ref.
    T !== null && !Ke(T)) && p.refs.setReference(T);
  }, [p.refs, m]), y = c.useCallback((T) => {
    h(T), p.refs.setFloating(T);
  }, [p.refs]), x = c.useMemo(() => ({
    ...p.refs,
    setReference: v,
    setFloating: y,
    setPositionReference: d,
    domReference: f
  }), [p.refs, v, y, d]), R = c.useMemo(() => ({
    ...p.elements,
    domReference: i.domReference
  }), [p.elements, i.domReference]), S = s.useState("open"), E = s.useState("floatingId"), C = c.useMemo(() => ({
    ...p,
    dataRef: s.context.dataRef,
    open: S,
    onOpenChange: s.setOpen,
    events: s.context.events,
    floatingId: E,
    refs: x,
    elements: R,
    nodeId: n,
    rootStore: s
  }), [p, x, R, n, s, S, E]);
  return ce(() => {
    s.context.dataRef.current.floatingContext = C;
    const T = u == null ? void 0 : u.nodesRef.current.find((N) => N.id === n);
    T && (T.context = C);
  }), c.useMemo(() => ({
    ...p,
    context: C,
    refs: x,
    elements: R,
    rootStore: s
  }), [p, x, R, C, s]);
}
function ti(e) {
  const {
    popupStore: n,
    noEmit: r = false,
    treatPopupAsFloatingElement: o = false,
    onOpenChange: s
  } = e, i = er(), a = on() != null, l = n.useState("open"), f = n.useState("activeTriggerElement"), u = n.useState(o ? "popupElement" : "positionerElement"), p = n.context.triggerElements, d = xt(() => new ul({
    open: l,
    referenceElement: f,
    floatingElement: u,
    triggerElements: p,
    onOpenChange: s,
    floatingId: i,
    nested: a,
    noEmit: r
  })).current;
  return ce(() => {
    const g = {
      open: l,
      floatingId: i,
      referenceElement: f,
      floatingElement: u
    };
    Ke(f) && (g.domReferenceElement = f), d.state.positionReference === d.state.referenceElement && (g.positionReference = f), d.update(g);
  }, [l, i, f, u, d]), d.context.onOpenChange = s, d.context.nested = a, d.context.noEmit = r, d;
}
const Ii = df && uf;
function cp(e, n = {}) {
  const r = "rootStore" in e ? e.rootStore : e, {
    events: o,
    dataRef: s
  } = r.context, {
    enabled: i = true,
    delay: a
  } = n, l = c.useRef(false), f = c.useRef(null), u = ht(), p = c.useRef(true);
  c.useEffect(() => {
    const g = r.select("domReferenceElement");
    if (!i)
      return;
    const m = pt(g);
    function b() {
      const y = r.select("domReferenceElement");
      !r.select("open") && st(y) && y === Ft(He(y)) && (l.current = true);
    }
    function h() {
      p.current = true;
    }
    function v() {
      p.current = false;
    }
    return m.addEventListener("blur", b), Ii && (m.addEventListener("keydown", h, true), m.addEventListener("pointerdown", v, true)), () => {
      m.removeEventListener("blur", b), Ii && (m.removeEventListener("keydown", h, true), m.removeEventListener("pointerdown", v, true));
    };
  }, [r, i]), c.useEffect(() => {
    if (!i)
      return;
    function g(m) {
      if (m.reason === Jt || m.reason === ao) {
        const b = r.select("domReferenceElement");
        Ke(b) && (f.current = b, l.current = true);
      }
    }
    return o.on("openchange", g), () => {
      o.off("openchange", g);
    };
  }, [o, i, r]);
  const d = c.useMemo(() => ({
    onMouseLeave() {
      l.current = false, f.current = null;
    },
    onFocus(g) {
      const m = g.currentTarget;
      if (l.current) {
        if (f.current === m)
          return;
        l.current = false, f.current = null;
      }
      const b = Nt(g.nativeEvent);
      if (Ke(b)) {
        if (Ii && !g.relatedTarget) {
          if (!p.current && !Hs(b))
            return;
        } else if (!gy(b))
          return;
      }
      const h = gs(g.relatedTarget, r.context.triggerElements), {
        nativeEvent: v,
        currentTarget: y
      } = g, x = typeof a == "function" ? a() : a;
      if (r.select("open") && h || x === 0 || x === void 0) {
        r.setOpen(true, we(ur, v, y));
        return;
      }
      u.start(x, () => {
        l.current || r.setOpen(true, we(ur, v, y));
      });
    },
    onBlur(g) {
      l.current = false, f.current = null;
      const m = g.relatedTarget, b = g.nativeEvent, h = Ke(m) && m.hasAttribute(ro("focus-guard")) && m.getAttribute("data-type") === "outside";
      u.start(0, () => {
        var _a2;
        const v = r.select("domReferenceElement"), y = Ft(v ? v.ownerDocument : document);
        !m && y === v || Se((_a2 = s.current.floatingContext) == null ? void 0 : _a2.refs.floating.current, y) || Se(v, y) || h || gs(m ?? y, r.context.triggerElements) || r.setOpen(false, we(ur, b));
      });
    }
  }), [s, r, u, a]);
  return c.useMemo(() => i ? {
    reference: d,
    trigger: d
  } : {}, [i, d]);
}
const Uw = `button,a,[role="button"],select,[tabindex]:not([tabindex="-1"]),${gf}`;
function Ww(e) {
  return e ? !!e.closest(Uw) : false;
}
class dl {
  constructor() {
    __publicField(this, "dispose", () => {
      this.openChangeTimeout.clear(), this.restTimeout.clear();
    });
    __publicField(this, "disposeEffect", () => this.dispose);
    this.pointerType = void 0, this.interactedInside = false, this.handler = void 0, this.blockMouseMove = true, this.performedPointerEventsMutation = false, this.pointerEventsScopeElement = null, this.pointerEventsReferenceElement = null, this.pointerEventsFloatingElement = null, this.restTimeoutPending = false, this.openChangeTimeout = new Ht(), this.restTimeout = new Ht(), this.handleCloseOptions = void 0;
  }
  static create() {
    return new dl();
  }
}
function fl(e) {
  var _a2, _b2, _c2;
  e.performedPointerEventsMutation && ((_a2 = e.pointerEventsScopeElement) == null ? void 0 : _a2.style.removeProperty("pointer-events"), (_b2 = e.pointerEventsReferenceElement) == null ? void 0 : _b2.style.removeProperty("pointer-events"), (_c2 = e.pointerEventsFloatingElement) == null ? void 0 : _c2.style.removeProperty("pointer-events"), e.performedPointerEventsMutation = false, e.pointerEventsScopeElement = null, e.pointerEventsReferenceElement = null, e.pointerEventsFloatingElement = null);
}
function jw(e, n) {
  const {
    scopeElement: r,
    referenceElement: o,
    floatingElement: s
  } = n;
  fl(e), e.performedPointerEventsMutation = true, e.pointerEventsScopeElement = r, e.pointerEventsReferenceElement = o, e.pointerEventsFloatingElement = s, r.style.pointerEvents = "none", o.style.pointerEvents = "auto", s.style.pointerEvents = "auto";
}
function up(e) {
  const n = xt(dl.create).current, r = e.context.dataRef.current;
  return r.hoverInteractionState || (r.hoverInteractionState = n), lo(r.hoverInteractionState.disposeEffect), r.hoverInteractionState;
}
function pl(e, n = {}) {
  const r = "rootStore" in e ? e.rootStore : e, o = r.useState("open"), s = r.useState("floatingElement"), i = r.useState("domReferenceElement"), {
    dataRef: a
  } = r.context, {
    enabled: l = true,
    closeDelay: f = 0
  } = n, u = up(r), p = Ln(), d = on(), g = de(() => {
    var _a2;
    return Bf((_a2 = a.current.openEvent) == null ? void 0 : _a2.type, u.interactedInside);
  }), m = de(() => {
    var _a2;
    const R = (_a2 = a.current.openEvent) == null ? void 0 : _a2.type;
    return (R == null ? void 0 : R.includes("mouse")) && R !== "mousedown";
  }), b = de((R) => gs(R, r.context.triggerElements)), h = c.useCallback((R) => {
    const S = $r(f, "close", u.pointerType), E = () => {
      r.setOpen(false, we(vt, R)), p == null ? void 0 : p.events.emit("floating.closed", R);
    };
    S ? u.openChangeTimeout.start(S, E) : (u.openChangeTimeout.clear(), E());
  }, [f, r, u, p]), v = de(() => {
    fl(u);
  }), y = de((R) => {
    const S = Nt(R);
    if (!Ww(S)) {
      u.interactedInside = false;
      return;
    }
    u.interactedInside = (S == null ? void 0 : S.closest("[aria-haspopup]")) != null;
  });
  ce(() => {
    o || (u.pointerType = void 0, u.restTimeoutPending = false, u.interactedInside = false, v());
  }, [o, u, v]), c.useEffect(() => v, [v]), ce(() => {
    var _a2, _b2, _c2, _d2, _e;
    if (l && o && ((_a2 = u.handleCloseOptions) == null ? void 0 : _a2.blockPointerEvents) && m() && Ke(i) && s) {
      const R = i, S = s, E = He(s), C = (_c2 = (_b2 = p == null ? void 0 : p.nodesRef.current.find((N) => N.id === d)) == null ? void 0 : _b2.context) == null ? void 0 : _c2.elements.floating;
      C && (C.style.pointerEvents = "");
      const T = ((_e = (_d2 = u.handleCloseOptions) == null ? void 0 : _d2.getScope) == null ? void 0 : _e.call(_d2)) ?? u.pointerEventsScopeElement ?? C ?? R.closest("[data-rootownerid]") ?? E.body;
      return jw(u, {
        scopeElement: T,
        referenceElement: R,
        floatingElement: S
      }), () => {
        v();
      };
    }
  }, [l, o, i, s, u, m, p, d, v]);
  const x = ht();
  c.useEffect(() => {
    if (!l)
      return;
    function R() {
      u.openChangeTimeout.clear(), x.clear(), p == null ? void 0 : p.events.off("floating.closed", E), v();
    }
    function S(T) {
      if (p && d && dn(p.nodesRef.current, d).length > 0) {
        p.events.on("floating.closed", E);
        return;
      }
      if (!b(T.relatedTarget)) {
        if (u.handler) {
          u.handler(T);
          return;
        }
        v(), g() || h(T);
      }
    }
    function E(T) {
      !p || !d || dn(p.nodesRef.current, d).length > 0 || x.start(0, () => {
        p.events.off("floating.closed", E), r.setOpen(false, we(vt, T)), p.events.emit("floating.closed", T);
      });
    }
    const C = s;
    return C && (C.addEventListener("mouseenter", R), C.addEventListener("mouseleave", S), C.addEventListener("pointerdown", y, true)), () => {
      C && (C.removeEventListener("mouseenter", R), C.removeEventListener("mouseleave", S), C.removeEventListener("pointerdown", y, true)), p == null ? void 0 : p.events.off("floating.closed", E);
    };
  }, [l, s, r, a, g, b, h, v, y, u, p, d, x]);
}
const Kw = {
  current: null
};
function ml(e, n = {}) {
  var _a2;
  const r = "rootStore" in e ? e.rootStore : e, {
    dataRef: o,
    events: s
  } = r.context, {
    enabled: i = true,
    delay: a = 0,
    handleClose: l = null,
    mouseOnly: f = false,
    restMs: u = 0,
    move: p = true,
    triggerElementRef: d = Kw,
    externalTree: g,
    isActiveTrigger: m = true,
    getHandleCloseContext: b
  } = n, h = Ln(g), v = up(r), y = yt(l), x = yt(a), R = yt(u), S = yt(i);
  m && (v.handleCloseOptions = (_a2 = y.current) == null ? void 0 : _a2.__options);
  const E = de(() => {
    var _a3;
    return Bf((_a3 = o.current.openEvent) == null ? void 0 : _a3.type, v.interactedInside);
  }), C = de((A) => gs(A, r.context.triggerElements)), T = de((A, P, O) => {
    const M = r.context.triggerElements;
    if (M.hasElement(P))
      return !A || !Se(A, P);
    if (!Ke(O))
      return false;
    const D = O;
    return M.hasMatchingElement((_) => Se(_, D)) && (!A || !Se(A, D));
  }), N = c.useCallback((A, P = true) => {
    const O = $r(x.current, "close", v.pointerType);
    O ? v.openChangeTimeout.start(O, () => {
      r.setOpen(false, we(vt, A)), h == null ? void 0 : h.events.emit("floating.closed", A);
    }) : P && (v.openChangeTimeout.clear(), r.setOpen(false, we(vt, A)), h == null ? void 0 : h.events.emit("floating.closed", A));
  }, [x, r, v, h]), I = de(() => {
    if (!v.handler)
      return;
    He(r.select("domReferenceElement")).removeEventListener("mousemove", v.handler), v.handler = void 0;
  });
  c.useEffect(() => I, [I]);
  const L = de(() => {
    fl(v);
  });
  return c.useEffect(() => {
    if (!i)
      return;
    function A(P) {
      P.open || (I(), v.openChangeTimeout.clear(), v.restTimeout.clear(), v.blockMouseMove = true, v.restTimeoutPending = false);
    }
    return s.on("openchange", A), () => {
      s.off("openchange", A);
    };
  }, [i, s, v, I]), c.useEffect(() => {
    if (!i)
      return;
    const A = d.current ?? (m ? r.select("domReferenceElement") : null);
    if (!Ke(A))
      return;
    function P(M) {
      if (v.openChangeTimeout.clear(), v.blockMouseMove = false, f && !hr(v.pointerType) || eu(R.current) > 0 && !$r(x.current, "open"))
        return;
      const _ = $r(x.current, "open", v.pointerType), k = M.currentTarget ?? null, $ = r.select("domReferenceElement"), F = k == null ? false : T($, k, M.target), z = r.select("open"), Q = !z || F;
      F && z ? r.setOpen(true, we(vt, M, k)) : _ ? v.openChangeTimeout.start(_, () => {
        Q && r.setOpen(true, we(vt, M, k));
      }) : Q && r.setOpen(true, we(vt, M, k));
    }
    function O(M) {
      if (E()) {
        L();
        return;
      }
      I();
      const D = r.select("domReferenceElement"), _ = He(D);
      v.restTimeout.clear(), v.restTimeoutPending = false;
      const k = o.current.floatingContext ?? (b == null ? void 0 : b());
      if (C(M.relatedTarget))
        return;
      if (y.current && k) {
        r.select("open") || v.openChangeTimeout.clear();
        const z = d.current;
        v.handler = y.current({
          ...k,
          tree: h,
          x: M.clientX,
          y: M.clientY,
          onClose() {
            L(), I(), S.current && !E() && z === r.select("domReferenceElement") && N(M, true);
          }
        }), _.addEventListener("mousemove", v.handler), v.handler(M);
        return;
      }
      (v.pointerType !== "touch" || !Se(r.select("floatingElement"), M.relatedTarget)) && N(M);
    }
    return p && A.addEventListener("mousemove", P, {
      once: true
    }), A.addEventListener("mouseenter", P), A.addEventListener("mouseleave", O), () => {
      p && A.removeEventListener("mousemove", P), A.removeEventListener("mouseenter", P), A.removeEventListener("mouseleave", O);
    };
  }, [I, L, o, x, N, r, i, y, v, m, T, E, C, f, p, R, d, h, S, b]), c.useMemo(() => {
    if (!i)
      return;
    function A(P) {
      v.pointerType = P.pointerType;
    }
    return {
      onPointerDown: A,
      onPointerEnter: A,
      onMouseMove(P) {
        const {
          nativeEvent: O
        } = P, M = P.currentTarget, D = r.select("domReferenceElement"), _ = r.select("open"), k = T(D, M, P.target);
        if (f && !hr(v.pointerType))
          return;
        const $ = eu(R.current);
        if (_ && !k || $ === 0 || !k && v.restTimeoutPending && P.movementX ** 2 + P.movementY ** 2 < 2)
          return;
        v.restTimeout.clear();
        function F() {
          if (v.restTimeoutPending = false, E())
            return;
          const z = r.select("open");
          !v.blockMouseMove && (!z || k) && r.setOpen(true, we(vt, O, M));
        }
        v.pointerType === "touch" ? Tt.flushSync(() => {
          F();
        }) : k && _ ? F() : (v.restTimeoutPending = true, v.restTimeout.start($, F));
      }
    };
  }, [i, v, E, T, f, r, R]);
}
function Fn(e = []) {
  const n = e.map((u) => u == null ? void 0 : u.reference), r = e.map((u) => u == null ? void 0 : u.floating), o = e.map((u) => u == null ? void 0 : u.item), s = e.map((u) => u == null ? void 0 : u.trigger), i = c.useCallback(
    (u) => Ho(u, e, "reference"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    n
  ), a = c.useCallback(
    (u) => Ho(u, e, "floating"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    r
  ), l = c.useCallback(
    (u) => Ho(u, e, "item"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    o
  ), f = c.useCallback(
    (u) => Ho(u, e, "trigger"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    s
  );
  return c.useMemo(() => ({
    getReferenceProps: i,
    getFloatingProps: a,
    getItemProps: l,
    getTriggerProps: f
  }), [i, a, l, f]);
}
function Ho(e, n, r) {
  var _a2;
  const o = /* @__PURE__ */ new Map(), s = r === "item", i = {};
  r === "floating" && (i.tabIndex = -1, i[ua] = "");
  for (const a in e)
    s && e && (a === pf || a === mf) || (i[a] = e[a]);
  for (let a = 0; a < n.length; a += 1) {
    let l;
    const f = (_a2 = n[a]) == null ? void 0 : _a2[r];
    typeof f == "function" ? l = e ? f(e) : null : l = f, l && Nu(i, l, s, o);
  }
  return Nu(i, e, s, o), i;
}
function Nu(e, n, r, o) {
  var _a2;
  for (const s in n) {
    const i = n[s];
    r && (s === pf || s === mf) || (s.startsWith("on") ? (o.has(s) || o.set(s, []), typeof i == "function" && ((_a2 = o.get(s)) == null ? void 0 : _a2.push(i), e[s] = (...a) => {
      var _a3;
      return (_a3 = o.get(s)) == null ? void 0 : _a3.map((l) => l(...a)).find((l) => l !== void 0);
    })) : e[s] = i);
  }
}
const Gw = "Escape";
function ni(e, n, r) {
  switch (e) {
    case "vertical":
      return n;
    case "horizontal":
      return r;
    default:
      return n || r;
  }
}
function Uo(e, n) {
  return ni(n, e === qa || e === fo, e === Cn || e === Sn);
}
function Pi(e, n, r) {
  return ni(n, e === fo, r ? e === Cn : e === Sn) || e === "Enter" || e === " " || e === "";
}
function Yw(e, n, r) {
  return ni(n, r ? e === Cn : e === Sn, e === fo);
}
function qw(e, n, r, o) {
  const s = r ? e === Sn : e === Cn, i = e === qa;
  return n === "both" || n === "horizontal" && o && o > 1 ? e === Gw : ni(n, s, i);
}
function dp(e, n) {
  const r = "rootStore" in e ? e.rootStore : e, o = r.useState("open"), s = r.useState("floatingElement"), i = r.useState("domReferenceElement"), a = r.context.dataRef, {
    listRef: l,
    activeIndex: f,
    onNavigate: u = () => {
    },
    enabled: p = true,
    selectedIndex: d = null,
    allowEscape: g = false,
    loopFocus: m = false,
    nested: b = false,
    rtl: h = false,
    virtual: v = false,
    focusItemOnOpen: y = "auto",
    focusItemOnHover: x = true,
    openOnArrowKeyDown: R = true,
    disabledIndices: S = void 0,
    orientation: E = "vertical",
    parentOrientation: C,
    cols: T = 1,
    id: N,
    resetOnPointerLeave: I = true,
    externalTree: L
  } = n;
  process.env.NODE_ENV !== "production" && (g && (m || console.warn("`useListNavigation` looping must be enabled to allow escaping."), v || console.warn("`useListNavigation` must be virtual to allow escaping.")), E === "vertical" && T > 1 && console.warn("In grid list navigation mode (`cols` > 1), the `orientation` should", 'be either "horizontal" or "both".'));
  const A = Qr(s), P = yt(A), O = on(), M = Ln(L);
  ce(() => {
    a.current.orientation = E;
  }, [a, E]);
  const D = da(i), _ = c.useRef(y), k = c.useRef(d ?? -1), $ = c.useRef(null), F = c.useRef(true), z = de((q) => {
    u(k.current === -1 ? null : k.current, q);
  }), Q = c.useRef(z), B = c.useRef(!!s), G = c.useRef(o), j = c.useRef(false), W = c.useRef(false), H = yt(S), te = yt(o), J = yt(d), oe = yt(I), ae = de(() => {
    function q(ee) {
      v ? M == null ? void 0 : M.events.emit("virtualfocus", ee) : zr(ee, {
        sync: j.current,
        preventScroll: true
      });
    }
    const U = l.current[k.current], V = W.current;
    U && q(U), (j.current ? (ee) => ee() : requestAnimationFrame)(() => {
      var _a2;
      const ee = l.current[k.current] || U;
      if (!ee)
        return;
      U || q(ee), // eslint-disable-next-line @typescript-eslint/no-use-before-define
      fe && (V || !F.current) && ((_a2 = ee.scrollIntoView) == null ? void 0 : _a2.call(ee, {
        block: "nearest",
        inline: "nearest"
      }));
    });
  });
  ce(() => {
    p && (o && s ? (k.current = d ?? -1, _.current && d != null && (W.current = true, z())) : B.current && (k.current = -1, Q.current()));
  }, [p, o, s, d, z]), ce(() => {
    if (p) {
      if (!o) {
        j.current = false;
        return;
      }
      if (s)
        if (f == null) {
          if (j.current = false, J.current != null)
            return;
          if (B.current && (k.current = -1, ae()), (!G.current || !B.current) && _.current && ($.current != null || _.current === true && $.current == null)) {
            let q = 0;
            const U = () => {
              l.current[0] == null ? (q < 2 && (q ? requestAnimationFrame : queueMicrotask)(U), q += 1) : (k.current = $.current == null || Pi($.current, E, h) || b ? ss(l) : ma(l), $.current = null, z());
            };
            U();
          }
        } else to(l, f) || (k.current = f, ae(), W.current = false);
    }
  }, [p, o, s, f, J, b, l, E, h, z, ae, H]), ce(() => {
    var _a2, _b2;
    if (!p || s || !M || v || !B.current)
      return;
    const q = M.nodesRef.current, U = (_b2 = (_a2 = q.find((ee) => ee.id === O)) == null ? void 0 : _a2.context) == null ? void 0 : _b2.elements.floating, V = Ft(He(s)), Y = q.some((ee) => ee.context && Se(ee.context.elements.floating, V));
    U && !Y && F.current && U.focus({
      preventScroll: true
    });
  }, [p, s, M, O, v]), ce(() => {
    Q.current = z, G.current = o, B.current = !!s;
  }), ce(() => {
    o || ($.current = null, _.current = y);
  }, [o, y]);
  const ue = f != null, fe = c.useMemo(() => {
    function q(V) {
      if (!te.current)
        return;
      const Y = l.current.indexOf(V.currentTarget);
      Y !== -1 && k.current !== Y && (k.current = Y, z(V));
    }
    return {
      onFocus(V) {
        j.current = true, q(V);
      },
      onClick: ({
        currentTarget: V
      }) => V.focus({
        preventScroll: true
      }),
      // Safari
      onMouseMove(V) {
        j.current = true, W.current = false, x && q(V);
      },
      onPointerLeave(V) {
        if (!te.current || !F.current || V.pointerType === "touch")
          return;
        j.current = true;
        const Y = V.relatedTarget;
        if (!(!x || l.current.includes(Y)) && oe.current && (zr(null, {
          sync: true
        }), k.current = -1, z(V), !v)) {
          const ee = P.current, he = Ft(He(ee));
          ee && Se(ee, he) && ee.focus({
            preventScroll: true
          });
        }
      }
    };
  }, [te, P, x, l, z, oe, v]), le = c.useCallback(() => {
    var _a2, _b2, _c2;
    return C ?? ((_c2 = (_b2 = (_a2 = M == null ? void 0 : M.nodesRef.current.find((q) => q.id === O)) == null ? void 0 : _a2.context) == null ? void 0 : _b2.dataRef) == null ? void 0 : _c2.current.orientation);
  }, [O, M, C]), se = de((q) => {
    if (F.current = false, j.current = true, q.which === 229 || !te.current && q.currentTarget === P.current)
      return;
    if (b && qw(q.key, E, h, T)) {
      Uo(q.key, le()) || Lt(q), r.setOpen(false, we(os, q.nativeEvent)), st(i) && (v ? M == null ? void 0 : M.events.emit("virtualfocus", i) : i.focus());
      return;
    }
    const U = k.current, V = ss(l, S), Y = ma(l, S);
    if (D || (q.key === "Home" && (Lt(q), k.current = V, z(q)), q.key === "End" && (Lt(q), k.current = Y, z(q))), T > 1) {
      const ee = Array.from({
        length: l.current.length
      }, () => ({
        width: 1,
        height: 1
      })), he = wf(ee, T, false), Me = he.findIndex((_e) => _e != null && !fn(l, _e, S)), Ue = he.reduce((_e, xe, Ee) => xe != null && !fn(l, xe, S) ? Ee : _e, -1), Le = he[xf({
        current: he.map((_e) => _e != null ? l.current[_e] : null)
      }, {
        event: q,
        orientation: E,
        loopFocus: m,
        rtl: h,
        cols: T,
        // treat undefined (empty grid spaces) as disabled indices so we
        // don't end up in them
        disabledIndices: Cf([...(typeof S != "function" ? S : null) || l.current.map((_e, xe) => fn(l, xe, S) ? xe : void 0), void 0], he),
        minIndex: Me,
        maxIndex: Ue,
        prevIndex: Ef(
          k.current > Y ? V : k.current,
          ee,
          he,
          T,
          // use a corner matching the edge closest to the direction
          // we're moving in so we don't end up in the same item. Prefer
          // top/left over bottom/right.
          // eslint-disable-next-line no-nested-ternary
          q.key === fo ? "bl" : q.key === (h ? Cn : Sn) ? "tr" : "tl"
        ),
        stopEvent: true
      })];
      if (Le != null && (k.current = Le, z(q)), E === "both")
        return;
    }
    if (Uo(q.key, E)) {
      if (Lt(q), o && !v && Ft(q.currentTarget.ownerDocument) === q.currentTarget) {
        k.current = Pi(q.key, E, h) ? V : Y, z(q);
        return;
      }
      Pi(q.key, E, h) ? m ? U >= Y ? g && U !== l.current.length ? k.current = -1 : (j.current = false, k.current = V) : k.current = St(l, {
        startingIndex: U,
        disabledIndices: S
      }) : k.current = Math.min(Y, St(l, {
        startingIndex: U,
        disabledIndices: S
      })) : m ? U <= V ? g && U !== -1 ? k.current = l.current.length : (j.current = false, k.current = Y) : k.current = St(l, {
        startingIndex: U,
        decrement: true,
        disabledIndices: S
      }) : k.current = Math.max(V, St(l, {
        startingIndex: U,
        decrement: true,
        disabledIndices: S
      })), to(l, k.current) && (k.current = -1), z(q);
    }
  }), me = c.useMemo(() => v && o && ue && {
    "aria-activedescendant": `${N}-${f}`
  }, [v, o, ue, N, f]), ye = c.useMemo(() => ({
    "aria-orientation": E === "both" ? void 0 : E,
    ...D ? {} : me,
    onKeyDown(q) {
      if (q.key === "Tab" && q.shiftKey && o && !v) {
        const U = Nt(q.nativeEvent);
        if (U && !Se(P.current, U))
          return;
        Lt(q), r.setOpen(false, we(Zt, q.nativeEvent)), st(i) && i.focus();
        return;
      }
      se(q);
    },
    onPointerMove() {
      F.current = true;
    }
  }), [me, se, P, E, D, r, o, v, i]), ne = c.useMemo(() => {
    function q(V) {
      y === "auto" && hf(V.nativeEvent) && (_.current = !v);
    }
    function U(V) {
      _.current = y, y === "auto" && bf(V.nativeEvent) && (_.current = true);
    }
    return {
      onKeyDown(V) {
        const Y = r.select("open");
        F.current = false;
        const ee = V.key.startsWith("Arrow"), he = Yw(V.key, le(), h), Me = Uo(V.key, E), Ue = (b ? he : Me) || V.key === "Enter" || V.key.trim() === "";
        if (v && Y)
          return se(V);
        if (!(!Y && !R && ee)) {
          if (Ue) {
            const Le = Uo(V.key, le());
            $.current = b && Le ? null : V.key;
          }
          if (b) {
            he && (Lt(V), Y ? (k.current = ss(l, H.current), z(V)) : r.setOpen(true, we(os, V.nativeEvent, V.currentTarget)));
            return;
          }
          Me && (J.current != null && (k.current = J.current), Lt(V), !Y && R ? r.setOpen(true, we(os, V.nativeEvent, V.currentTarget)) : se(V), Y && z(V));
        }
      },
      onFocus(V) {
        r.select("open") && !v && (k.current = -1, z(V));
      },
      onPointerDown: U,
      onPointerEnter: U,
      onMouseDown: q,
      onClick: q
    };
  }, [se, H, y, l, b, z, r, R, E, le, h, J, v]), re = c.useMemo(() => ({
    ...me,
    ...ne
  }), [me, ne]);
  return c.useMemo(() => p ? {
    reference: re,
    floating: ye,
    item: fe,
    trigger: ne
  } : {}, [p, re, ye, ne, fe]);
}
const Xw = /* @__PURE__ */ new Map([["select", "listbox"], ["combobox", "listbox"], ["label", false]]);
function gl(e, n = {}) {
  const r = "rootStore" in e ? e.rootStore : e, o = r.useState("open"), s = r.useState("floatingId"), i = r.useState("domReferenceElement"), a = r.useState("floatingElement"), {
    role: l = "dialog"
  } = n, f = er(), u = (i == null ? void 0 : i.id) || f, p = c.useMemo(() => {
    var _a2;
    return ((_a2 = Qr(a)) == null ? void 0 : _a2.id) || s;
  }, [a, s]), d = Xw.get(l) ?? l, m = on() != null, b = c.useMemo(() => d === "tooltip" || l === "label" ? ct : {
    "aria-haspopup": d === "alertdialog" ? "dialog" : d,
    "aria-expanded": "false",
    ...d === "listbox" && {
      role: "combobox"
    },
    ...d === "menu" && m && {
      role: "menuitem"
    },
    ...l === "select" && {
      "aria-autocomplete": "none"
    },
    ...l === "combobox" && {
      "aria-autocomplete": "list"
    }
  }, [d, m, l]), h = c.useMemo(() => d === "tooltip" || l === "label" ? {
    [`aria-${l === "label" ? "labelledby" : "describedby"}`]: o ? p : void 0
  } : {
    ...b,
    "aria-expanded": o ? "true" : "false",
    "aria-controls": o ? p : void 0,
    ...d === "menu" && {
      id: u
    }
  }, [d, p, o, u, l, b]), v = c.useMemo(() => {
    const x = {
      id: p,
      ...d && {
        role: d
      }
    };
    return d === "tooltip" || l === "label" ? x : {
      ...x,
      ...d === "menu" && {
        "aria-labelledby": u
      }
    };
  }, [d, p, u, l]), y = c.useCallback(({
    active: x,
    selected: R
  }) => {
    const S = {
      role: "option",
      ...x && {
        id: `${p}-fui-option`
      }
    };
    switch (l) {
      case "select":
      case "combobox":
        return {
          ...S,
          "aria-selected": R
        };
    }
    return {};
  }, [p, l]);
  return c.useMemo(() => ({
    reference: h,
    floating: v,
    item: y,
    trigger: b
  }), [h, v, b, y]);
}
function fp(e, n) {
  const r = "rootStore" in e ? e.rootStore : e, o = r.context.dataRef, s = r.useState("open"), {
    listRef: i,
    elementsRef: a,
    activeIndex: l,
    onMatch: f,
    onTypingChange: u,
    enabled: p = true,
    resetMs: d = 750,
    selectedIndex: g = null
  } = n, m = ht(), b = c.useRef(""), h = c.useRef(g ?? l ?? -1), v = c.useRef(null);
  ce(() => {
    !s && g !== null || (m.clear(), v.current = null, b.current !== "" && (b.current = ""));
  }, [s, g, m]), ce(() => {
    s && b.current === "" && (h.current = g ?? l ?? -1);
  }, [s, g, l]);
  const y = de((C) => {
    C ? o.current.typing || (o.current.typing = C, u == null ? void 0 : u(C)) : o.current.typing && (o.current.typing = C, u == null ? void 0 : u(C));
  }), x = de((C) => {
    function T(D) {
      const _ = a == null ? void 0 : a.current[D];
      return !_ || Qa(_);
    }
    function N(D, _, k = 0) {
      var _a2;
      if (D.length === 0)
        return -1;
      const $ = (k % D.length + D.length) % D.length, F = _.toLocaleLowerCase();
      for (let z = 0; z < D.length; z += 1) {
        const Q = ($ + z) % D.length;
        if (!(!((_a2 = D[Q]) == null ? void 0 : _a2.toLocaleLowerCase().startsWith(F)) || !T(Q)))
          return Q;
      }
      return -1;
    }
    const I = i.current;
    if (b.current.length > 0 && C.key === " " && (Lt(C), y(true)), b.current.length > 0 && b.current[0] !== " " && N(I, b.current) === -1 && C.key !== " " && y(false), I == null || // Character key.
    C.key.length !== 1 || // Modifier key.
    C.ctrlKey || C.metaKey || C.altKey)
      return;
    s && C.key !== " " && (Lt(C), y(true));
    const L = b.current === "";
    L && (h.current = g ?? l ?? -1), I.every((D) => {
      var _a2, _b2;
      return D ? ((_a2 = D[0]) == null ? void 0 : _a2.toLocaleLowerCase()) !== ((_b2 = D[1]) == null ? void 0 : _b2.toLocaleLowerCase()) : true;
    }) && b.current === C.key && (b.current = "", h.current = v.current), b.current += C.key, m.start(d, () => {
      b.current = "", h.current = v.current, y(false);
    });
    const O = ((L ? g ?? l ?? -1 : h.current) ?? 0) + 1, M = N(I, b.current, O);
    M !== -1 ? (f == null ? void 0 : f(M), v.current = M) : C.key !== " " && (b.current = "", y(false));
  }), R = de((C) => {
    const T = C.relatedTarget, N = r.select("domReferenceElement"), I = r.select("floatingElement"), L = Se(N, T), A = Se(I, T);
    L || A || (m.clear(), b.current = "", h.current = v.current, y(false));
  }), S = c.useMemo(() => ({
    onKeyDown: x,
    onBlur: R
  }), [x, R]), E = c.useMemo(() => ({
    onKeyDown: x,
    onBlur: R
  }), [x, R]);
  return c.useMemo(() => p ? {
    reference: S,
    floating: E
  } : {}, [p, S, E]);
}
const Tu = 0.1, Jw = Tu * Tu, tt = 0.5;
function Wo(e, n, r, o, s, i) {
  return o >= n != i >= n && e <= (s - r) * (n - o) / (i - o) + r;
}
function jo(e, n, r, o, s, i, a, l, f, u) {
  let p = false;
  return Wo(e, n, r, o, s, i) && (p = !p), Wo(e, n, s, i, a, l) && (p = !p), Wo(e, n, a, l, f, u) && (p = !p), Wo(e, n, f, u, r, o) && (p = !p), p;
}
function Zw(e, n, r) {
  return e >= r.x && e <= r.x + r.width && n >= r.y && n <= r.y + r.height;
}
function Ko(e, n, r, o, s, i) {
  const a = Math.min(r, s), l = Math.max(r, s), f = Math.min(o, i), u = Math.max(o, i);
  return e >= a && e <= l && n >= f && n <= u;
}
function hl(e = {}) {
  const {
    blockPointerEvents: n = false
  } = e, r = new Ht(), o = ({
    x: s,
    y: i,
    placement: a,
    elements: l,
    onClose: f,
    nodeId: u,
    tree: p
  }) => {
    const d = a == null ? void 0 : a.split("-")[0];
    let g = false, m = null, b = null, h = typeof performance < "u" ? performance.now() : 0;
    function v(x, R) {
      const S = performance.now(), E = S - h;
      if (m === null || b === null || E === 0)
        return m = x, b = R, h = S, false;
      const C = x - m, T = R - b, N = C * C + T * T, I = E * E * Jw;
      return m = x, b = R, h = S, N < I;
    }
    function y() {
      r.clear(), f();
    }
    return function(R) {
      r.clear();
      const S = l.domReference, E = l.floating;
      if (!S || !E || d == null || s == null || i == null)
        return;
      const {
        clientX: C,
        clientY: T
      } = R, N = Nt(R), I = R.type === "mouseleave", L = Se(E, N), A = Se(S, N);
      if (L && (g = true, !I))
        return;
      if (A && (g = false, !I)) {
        g = true;
        return;
      }
      if (I && Ke(R.relatedTarget) && Se(E, R.relatedTarget))
        return;
      function P() {
        return !!(p && dn(p.nodesRef.current, u).length > 0);
      }
      function O() {
        P() || y();
      }
      if (P())
        return;
      const M = S.getBoundingClientRect(), D = E.getBoundingClientRect(), _ = s > D.right - D.width / 2, k = i > D.bottom - D.height / 2, $ = D.width > M.width, F = D.height > M.height, z = ($ ? M : D).left, Q = ($ ? M : D).right, B = (F ? M : D).top, G = (F ? M : D).bottom;
      if (d === "top" && i >= M.bottom - 1 || d === "bottom" && i <= M.top + 1 || d === "left" && s >= M.right - 1 || d === "right" && s <= M.left + 1) {
        O();
        return;
      }
      let j = false;
      switch (d) {
        case "top":
          j = Ko(C, T, z, M.top + 1, Q, D.bottom - 1);
          break;
        case "bottom":
          j = Ko(C, T, z, D.top + 1, Q, M.bottom - 1);
          break;
        case "left":
          j = Ko(C, T, D.right - 1, G, M.left + 1, B);
          break;
        case "right":
          j = Ko(C, T, M.right - 1, G, D.left + 1, B);
          break;
      }
      if (j)
        return;
      if (g && !Zw(C, T, M)) {
        O();
        return;
      }
      if (!I && v(C, T)) {
        O();
        return;
      }
      let W = false;
      switch (d) {
        case "top": {
          const H = $ ? tt / 2 : tt * 4, te = $ || _ ? s + H : s - H, J = $ ? s - H : _ ? s + H : s - H, oe = i + tt + 1, ae = _ || $ ? D.bottom - tt : D.top, ue = _ ? $ ? D.bottom - tt : D.top : D.bottom - tt;
          W = jo(C, T, te, oe, J, oe, D.left, ae, D.right, ue);
          break;
        }
        case "bottom": {
          const H = $ ? tt / 2 : tt * 4, te = $ || _ ? s + H : s - H, J = $ ? s - H : _ ? s + H : s - H, oe = i - tt, ae = _ || $ ? D.top + tt : D.bottom, ue = _ ? $ ? D.top + tt : D.bottom : D.top + tt;
          W = jo(C, T, te, oe, J, oe, D.left, ae, D.right, ue);
          break;
        }
        case "left": {
          const H = F ? tt / 2 : tt * 4, te = F || k ? i + H : i - H, J = F ? i - H : k ? i + H : i - H, oe = s + tt + 1, ae = k || F ? D.right - tt : D.left, ue = k ? F ? D.right - tt : D.left : D.right - tt;
          W = jo(C, T, ae, D.top, ue, D.bottom, oe, te, oe, J);
          break;
        }
        case "right": {
          const H = F ? tt / 2 : tt * 4, te = F || k ? i + H : i - H, J = F ? i - H : k ? i + H : i - H, oe = s - tt, ae = k || F ? D.left + tt : D.right, ue = k ? F ? D.left + tt : D.right : D.left + tt;
          W = jo(C, T, oe, te, oe, J, ae, D.top, ue, D.bottom);
          break;
        }
      }
      W ? g || r.start(40, O) : O();
    };
  };
  return o.__options = {
    blockPointerEvents: n
  }, o;
}
function Qw(e) {
  const n = c.useRef(""), r = c.useCallback((s) => {
    s.defaultPrevented || (n.current = s.pointerType, e(s, s.pointerType));
  }, [e]);
  return {
    onClick: c.useCallback((s) => {
      if (s.detail === 0) {
        e(s, "keyboard");
        return;
      }
      "pointerType" in s ? e(s, s.pointerType) : e(s, n.current), n.current = "";
    }, [e]),
    onPointerDown: r
  };
}
function bl(e, n) {
  const r = c.useRef(e), o = de(n);
  ce(() => {
    r.current !== e && o(r.current);
  }, [e, o]), ce(() => {
    r.current = e;
  }, [e]);
}
function ri(e) {
  const [n, r] = c.useState(null), o = de((a, l) => {
    e || r(l || // On iOS Safari, the hitslop around touch targets means tapping outside an element's
    // bounds does not fire `pointerdown` but does fire `mousedown`. The `interactionType`
    // will be "" in that case.
    (cf ? "touch" : ""));
  });
  bl(e, (a) => {
    a && !e && r(null);
  });
  const {
    onClick: s,
    onPointerDown: i
  } = Qw(o);
  return c.useMemo(() => ({
    openMethod: n,
    triggerProps: {
      onClick: s,
      onPointerDown: i
    }
  }), [n, s, i]);
}
function e0(e) {
  const {
    store: n,
    parentContext: r,
    actionsRef: o
  } = e, s = n.useState("open"), i = n.useState("disablePointerDismissal"), a = n.useState("modal"), l = n.useState("popupElement"), {
    openMethod: f,
    triggerProps: u
  } = ri(s);
  Js(n);
  const {
    forceUnmount: p
  } = Zs(s, n), d = de((I) => {
    const L = we(I);
    return L.preventUnmountOnClose = () => {
      n.set("preventUnmountingOnClose", true);
    }, L;
  }), g = c.useCallback(() => {
    n.setOpen(false, d(Ls));
  }, [n, d]);
  c.useImperativeHandle(o, () => ({
    unmount: p,
    close: g
  }), [p, g]);
  const m = ti({
    popupStore: n,
    onOpenChange: n.setOpen,
    treatPopupAsFloatingElement: true,
    noEmit: true
  }), [b, h] = c.useState(0), v = b === 0, y = gl(m), x = bo(m, {
    outsidePressEvent() {
      return n.context.internalBackdropRef.current || n.context.backdropRef.current ? "intentional" : {
        mouse: a === "trap-focus" ? "sloppy" : "intentional",
        touch: "sloppy"
      };
    },
    outsidePress(I) {
      if (!n.context.outsidePressEnabledRef.current || "button" in I && I.button !== 0 || "touches" in I && I.touches.length !== 1)
        return false;
      const L = Nt(I);
      if (v && !i) {
        const A = L;
        return a && (n.context.internalBackdropRef.current || n.context.backdropRef.current) ? n.context.internalBackdropRef.current === A || n.context.backdropRef.current === A || Se(A, l) && !(A == null ? void 0 : A.hasAttribute("data-base-ui-portal")) : true;
      }
      return false;
    },
    escapeKey: v
  });
  js(s && a === true, l);
  const {
    getReferenceProps: R,
    getFloatingProps: S,
    getTriggerProps: E
  } = Fn([y, x]);
  n.useContextCallback("onNestedDialogOpen", (I) => {
    h(I + 1);
  }), n.useContextCallback("onNestedDialogClose", () => {
    h(0);
  }), c.useEffect(() => ((r == null ? void 0 : r.onNestedDialogOpen) && s && r.onNestedDialogOpen(b), (r == null ? void 0 : r.onNestedDialogClose) && !s && r.onNestedDialogClose(), () => {
    (r == null ? void 0 : r.onNestedDialogClose) && s && r.onNestedDialogClose();
  }), [s, r, b]);
  const C = c.useMemo(() => R(u), [R, u]), T = c.useMemo(() => E(u), [E, u]), N = c.useMemo(() => S(), [S]);
  n.useSyncedValues({
    openMethod: f,
    activeTriggerProps: C,
    inactiveTriggerProps: T,
    popupProps: N,
    floatingRootContext: m,
    nestedOpenDialogCount: b
  });
}
const vl = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (vl.displayName = "DialogRootContext");
function _n(e) {
  const n = c.useContext(vl);
  if (e === false && n === void 0)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: DialogRootContext is missing. Dialog parts must be placed within <Dialog.Root>." : Ze(27));
  return n;
}
const t0 = {
  ...ei,
  modal: ie((e) => e.modal),
  nested: ie((e) => e.nested),
  nestedOpenDialogCount: ie((e) => e.nestedOpenDialogCount),
  disablePointerDismissal: ie((e) => e.disablePointerDismissal),
  openMethod: ie((e) => e.openMethod),
  descriptionElementId: ie((e) => e.descriptionElementId),
  titleElementId: ie((e) => e.titleElementId),
  viewportElement: ie((e) => e.viewportElement),
  role: ie((e) => e.role)
};
class n0 extends vo {
  constructor(n) {
    super(r0(n), {
      popupRef: /* @__PURE__ */ c.createRef(),
      backdropRef: /* @__PURE__ */ c.createRef(),
      internalBackdropRef: /* @__PURE__ */ c.createRef(),
      outsidePressEnabledRef: {
        current: true
      },
      triggerElements: new Nr(),
      onOpenChange: void 0,
      onOpenChangeComplete: void 0
    }, t0);
    __publicField(this, "setOpen", (n, r) => {
      var _a2, _b2, _c2, _d2;
      if (r.preventUnmountOnClose = () => {
        this.set("preventUnmountingOnClose", true);
      }, !n && r.trigger == null && this.state.activeTriggerId != null && (r.trigger = this.state.activeTriggerElement ?? void 0), (_b2 = (_a2 = this.context).onOpenChange) == null ? void 0 : _b2.call(_a2, n, r), r.isCanceled)
        return;
      const o = {
        open: n,
        nativeEvent: r.event,
        reason: r.reason,
        nested: this.state.nested
      };
      (_c2 = this.state.floatingRootContext.context.events) == null ? void 0 : _c2.emit("openchange", o);
      const s = {
        open: n
      }, i = ((_d2 = r.trigger) == null ? void 0 : _d2.id) ?? null;
      (i || n) && (s.activeTriggerId = i, s.activeTriggerElement = r.trigger ?? null), this.update(s);
    });
  }
}
function r0(e = {}) {
  return {
    ...Qs(),
    modal: true,
    disablePointerDismissal: false,
    popupElement: null,
    viewportElement: null,
    descriptionElementId: void 0,
    titleElementId: void 0,
    openMethod: null,
    nested: false,
    nestedOpenDialogCount: 0,
    role: "dialog",
    ...e
  };
}
let jn = (function(e) {
  return e.open = "data-open", e.closed = "data-closed", e[e.startingStyle = gn.startingStyle] = "startingStyle", e[e.endingStyle = gn.endingStyle] = "endingStyle", e.anchorHidden = "data-anchor-hidden", e.side = "data-side", e.align = "data-align", e;
})({}), Ss = /* @__PURE__ */ (function(e) {
  return e.popupOpen = "data-popup-open", e.pressed = "data-pressed", e;
})({});
const o0 = {
  [Ss.popupOpen]: ""
}, s0 = {
  [Ss.popupOpen]: "",
  [Ss.pressed]: ""
}, i0 = {
  [jn.open]: ""
}, a0 = {
  [jn.closed]: ""
}, l0 = {
  [jn.anchorHidden]: ""
}, oi = {
  open(e) {
    return e ? o0 : null;
  }
}, Rs = {
  open(e) {
    return e ? s0 : null;
  }
}, sn = {
  open(e) {
    return e ? i0 : a0;
  },
  anchorHidden(e) {
    return e ? l0 : null;
  }
}, c0 = {
  ...sn,
  ...en
}, yl = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    render: o,
    className: s,
    forceRender: i = false,
    ...a
  } = n, {
    store: l
  } = _n(), f = l.useState("open"), u = l.useState("nested"), p = l.useState("mounted"), d = l.useState("transitionStatus");
  return Pe("div", n, {
    state: {
      open: f,
      transitionStatus: d
    },
    ref: [l.context.backdropRef, r],
    stateAttributesMapping: c0,
    props: [{
      role: "presentation",
      hidden: !p,
      style: {
        userSelect: "none",
        WebkitUserSelect: "none"
      }
    }, a],
    enabled: i || !u
  });
});
process.env.NODE_ENV !== "production" && (yl.displayName = "DialogBackdrop");
const xl = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    render: o,
    className: s,
    disabled: i = false,
    nativeButton: a = true,
    ...l
  } = n, {
    store: f
  } = _n(), u = f.useState("open");
  function p(b) {
    u && f.setOpen(false, we(Wv, b.nativeEvent));
  }
  const {
    getButtonProps: d,
    buttonRef: g
  } = nn({
    disabled: i,
    native: a
  });
  return Pe("button", n, {
    state: {
      disabled: i
    },
    ref: [r, g],
    props: [{
      onClick: p
    }, l, d]
  });
});
process.env.NODE_ENV !== "production" && (xl.displayName = "DialogClose");
const Hr = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    render: o,
    className: s,
    id: i,
    ...a
  } = n, {
    store: l
  } = _n(), f = Mt(i);
  return l.useSyncedValueWithCleanup("descriptionElementId", f), Pe("p", n, {
    ref: r,
    props: [{
      id: f
    }, a]
  });
});
process.env.NODE_ENV !== "production" && (Hr.displayName = "DialogDescription");
let u0 = /* @__PURE__ */ (function(e) {
  return e.nestedDialogs = "--nested-dialogs", e;
})({}), d0 = (function(e) {
  return e[e.open = jn.open] = "open", e[e.closed = jn.closed] = "closed", e[e.startingStyle = jn.startingStyle] = "startingStyle", e[e.endingStyle = jn.endingStyle] = "endingStyle", e.nested = "data-nested", e.nestedDialogOpen = "data-nested-dialog-open", e;
})({});
const wl = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (wl.displayName = "DialogPortalContext");
function f0() {
  const e = c.useContext(wl);
  if (e === void 0)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: <Dialog.Portal> is missing." : Ze(26));
  return e;
}
const p0 = {
  ...sn,
  ...en,
  nestedDialogOpen(e) {
    return e ? {
      [d0.nestedDialogOpen]: ""
    } : null;
  }
}, El = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    className: o,
    finalFocus: s,
    initialFocus: i,
    render: a,
    ...l
  } = n, {
    store: f
  } = _n(), u = f.useState("descriptionElementId"), p = f.useState("disablePointerDismissal"), d = f.useState("floatingRootContext"), g = f.useState("popupProps"), m = f.useState("modal"), b = f.useState("mounted"), h = f.useState("nested"), v = f.useState("nestedOpenDialogCount"), y = f.useState("open"), x = f.useState("openMethod"), R = f.useState("titleElementId"), S = f.useState("transitionStatus"), E = f.useState("role");
  f0(), rn({
    open: y,
    ref: f.context.popupRef,
    onComplete() {
      var _a2, _b2;
      y && ((_b2 = (_a2 = f.context).onOpenChangeComplete) == null ? void 0 : _b2.call(_a2, true));
    }
  });
  function C(A) {
    return A === "touch" ? f.context.popupRef.current : true;
  }
  const T = i === void 0 ? C : i, N = v > 0, L = Pe("div", n, {
    state: {
      open: y,
      nested: h,
      transitionStatus: S,
      nestedDialogOpen: N
    },
    props: [g, {
      "aria-labelledby": R ?? void 0,
      "aria-describedby": u ?? void 0,
      role: E,
      tabIndex: -1,
      hidden: !b,
      onKeyDown(A) {
        Ws.has(A.key) && A.stopPropagation();
      },
      style: {
        [u0.nestedDialogs]: v
      }
    }, l],
    ref: [r, f.context.popupRef, f.useStateSetter("popupElement")],
    stateAttributesMapping: p0
  });
  return /* @__PURE__ */ jsx(Gs, {
    context: d,
    openInteractionType: x,
    disabled: !b,
    closeOnFocusOut: !p,
    initialFocus: T,
    returnFocus: s,
    modal: m !== false,
    restoreFocus: "popup",
    children: L
  });
});
process.env.NODE_ENV !== "production" && (El.displayName = "DialogPopup");
function yo(e) {
  return $a(19) ? e : e ? "true" : void 0;
}
const xo = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    cutout: o,
    ...s
  } = n;
  let i;
  if (o) {
    const a = o == null ? void 0 : o.getBoundingClientRect();
    i = `polygon(
      0% 0%,
      100% 0%,
      100% 100%,
      0% 100%,
      0% 0%,
      ${a.left}px ${a.top}px,
      ${a.left}px ${a.bottom}px,
      ${a.right}px ${a.bottom}px,
      ${a.right}px ${a.top}px,
      ${a.left}px ${a.top}px
    )`;
  }
  return /* @__PURE__ */ jsx("div", {
    ref: r,
    role: "presentation",
    "data-base-ui-inert": "",
    ...s,
    style: {
      position: "fixed",
      inset: 0,
      userSelect: "none",
      WebkitUserSelect: "none",
      clipPath: i
    }
  });
});
process.env.NODE_ENV !== "production" && (xo.displayName = "InternalBackdrop");
const Cl = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    keepMounted: o = false,
    ...s
  } = n, {
    store: i
  } = _n(), a = i.useState("mounted"), l = i.useState("modal"), f = i.useState("open");
  return a || o ? /* @__PURE__ */ jsx(wl.Provider, {
    value: o,
    children: /* @__PURE__ */ jsxs(ho, {
      ref: r,
      ...s,
      children: [a && l === true && /* @__PURE__ */ jsx(xo, {
        ref: i.context.internalBackdropRef,
        inert: yo(!f)
      }), n.children]
    })
  }) : null;
});
process.env.NODE_ENV !== "production" && (Cl.displayName = "DialogPortal");
const Sl = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    render: o,
    className: s,
    id: i,
    ...a
  } = n, {
    store: l
  } = _n(), f = Mt(i);
  return l.useSyncedValueWithCleanup("titleElementId", f), Pe("h2", n, {
    ref: r,
    props: [{
      id: f
    }, a]
  });
});
process.env.NODE_ENV !== "production" && (Sl.displayName = "DialogTitle");
const xa = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    render: o,
    className: s,
    disabled: i = false,
    nativeButton: a = true,
    id: l,
    payload: f,
    handle: u,
    ...p
  } = n, d = _n(true), g = (u == null ? void 0 : u.store) ?? (d == null ? void 0 : d.store);
  if (!g)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: <Dialog.Trigger> must be used within <Dialog.Root> or provided with a handle." : Ze(79));
  const m = Mt(l), b = g.useState("floatingRootContext"), h = g.useState("isOpenedByTrigger", m), v = c.useRef(null), {
    registerTrigger: y,
    isMountedByThisTrigger: x
  } = Xs(m, v, g, {
    payload: f
  }), {
    getButtonProps: R,
    buttonRef: S
  } = nn({
    disabled: i,
    native: a
  }), E = Ys(b, {
    enabled: b != null
  }), C = Fn([E]), T = {
    disabled: i,
    open: h
  }, N = g.useState("triggerProps", x);
  return Pe("button", n, {
    state: T,
    ref: [S, r, y, v],
    props: [C.getReferenceProps(), N, {
      [za]: "",
      id: m
    }, p, R],
    stateAttributesMapping: oi
  });
});
process.env.NODE_ENV !== "production" && (xa.displayName = "DialogTrigger");
function wo(e) {
  const n = c.useRef(true);
  n.current && (n.current = false, e());
}
const m0 = (e, n) => Object.is(e, n);
function yr(e, n, r) {
  return e == null || n == null ? Object.is(e, n) : r(e, n);
}
function g0(e, n, r) {
  return !e || e.length === 0 ? false : e.some((o) => o === void 0 ? false : yr(n, o, r));
}
function Ur(e, n, r) {
  return !e || e.length === 0 ? -1 : e.findIndex((o) => o === void 0 ? false : yr(o, n, r));
}
function h0(e, n, r) {
  return e.filter((o) => !yr(n, o, r));
}
function wa(e) {
  if (e == null)
    return "";
  if (typeof e == "string")
    return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
function pp(e) {
  return e != null && e.length > 0 && typeof e[0] == "object" && e[0] != null && "items" in e[0];
}
function b0(e) {
  if (!Array.isArray(e))
    return e != null && "null" in e;
  const n = e;
  if (pp(n)) {
    for (const r of n)
      for (const o of r.items)
        if (o && o.value == null && o.label != null)
          return true;
    return false;
  }
  for (const r of n)
    if (r && r.value == null && r.label != null)
      return true;
  return false;
}
function v0(e, n) {
  if (n && e != null)
    return n(e) ?? "";
  if (e && typeof e == "object") {
    if ("label" in e && e.label != null)
      return String(e.label);
    if ("value" in e)
      return String(e.value);
  }
  return wa(e);
}
function ar(e, n) {
  return n && e != null ? n(e) ?? "" : e && typeof e == "object" && "value" in e && "label" in e ? wa(e.value) : wa(e);
}
function mp(e, n, r) {
  function o() {
    return v0(e, r);
  }
  if (r && e != null)
    return r(e);
  if (e && typeof e == "object" && "label" in e && e.label != null)
    return e.label;
  if (n && !Array.isArray(n))
    return n[e] ?? o();
  if (Array.isArray(n)) {
    const s = n, i = pp(s) ? s.flatMap((a) => a.items) : s;
    if (e == null || typeof e != "object") {
      const a = i.find((l) => l.value === e);
      return a && a.label != null ? a.label : o();
    }
    if ("value" in e) {
      const a = i.find((l) => l && l.value === e.value);
      if (a && a.label != null)
        return a.label;
    }
  }
  return o();
}
function y0(e, n, r) {
  return e.reduce((o, s, i) => (i > 0 && o.push(", "), o.push(/* @__PURE__ */ jsx(c.Fragment, {
    children: mp(s, n, r)
  }, i)), o), []);
}
let ku = /* @__PURE__ */ (function(e) {
  return e.disabled = "data-disabled", e.valid = "data-valid", e.invalid = "data-invalid", e.touched = "data-touched", e.dirty = "data-dirty", e.filled = "data-filled", e.focused = "data-focused", e;
})({});
const x0 = {
  badInput: false,
  customError: false,
  patternMismatch: false,
  rangeOverflow: false,
  rangeUnderflow: false,
  stepMismatch: false,
  tooLong: false,
  tooShort: false,
  typeMismatch: false,
  valid: null,
  valueMissing: false
}, Lr = {
  valid: null,
  touched: false,
  dirty: false,
  filled: false,
  focused: false
}, w0 = {
  disabled: false,
  ...Lr
}, gp = {
  valid(e) {
    return e === null ? null : e ? {
      [ku.valid]: ""
    } : {
      [ku.invalid]: ""
    };
  }
}, hp = /* @__PURE__ */ c.createContext({
  invalid: void 0,
  name: void 0,
  validityData: {
    state: x0,
    errors: [],
    error: "",
    value: "",
    initialValue: null
  },
  setValidityData: It,
  disabled: void 0,
  touched: Lr.touched,
  setTouched: It,
  dirty: Lr.dirty,
  setDirty: It,
  filled: Lr.filled,
  setFilled: It,
  focused: Lr.focused,
  setFocused: It,
  validate: () => null,
  validationMode: "onSubmit",
  validationDebounceTime: 0,
  shouldValidateOnChange: () => false,
  state: w0,
  markedDirtyRef: {
    current: false
  },
  validation: {
    getValidationProps: (e = ct) => e,
    getInputValidationProps: (e = ct) => e,
    inputRef: {
      current: null
    },
    commit: async () => {
    }
  }
});
process.env.NODE_ENV !== "production" && (hp.displayName = "FieldRootContext");
function Eo(e = true) {
  const n = c.useContext(hp);
  if (n.setValidityData === It && !e)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: FieldRootContext is missing. Field parts must be placed within <Field.Root>." : Ze(28));
  return n;
}
function E0(e, n) {
  return {
    ...e,
    state: {
      ...e.state,
      valid: !n && e.state.valid
    }
  };
}
const bp = /* @__PURE__ */ c.createContext({
  formRef: {
    current: {
      fields: /* @__PURE__ */ new Map()
    }
  },
  errors: {},
  clearErrors: It,
  validationMode: "onSubmit",
  submitAttemptedRef: {
    current: false
  }
});
process.env.NODE_ENV !== "production" && (bp.displayName = "FormContext");
function Rl() {
  return c.useContext(bp);
}
function vp(e) {
  const {
    enabled: n = true,
    value: r,
    id: o,
    name: s,
    controlRef: i,
    commit: a
  } = e, {
    formRef: l
  } = Rl(), {
    invalid: f,
    markedDirtyRef: u,
    validityData: p,
    setValidityData: d
  } = Eo(), g = de(e.getValue);
  ce(() => {
    if (!n)
      return;
    let m = r;
    m === void 0 && (m = g()), p.initialValue === null && m !== null && d((b) => ({
      ...b,
      initialValue: m
    }));
  }, [n, d, r, p.initialValue, g]), ce(() => {
    !n || !o || l.current.fields.set(o, {
      getValue: g,
      name: s,
      controlRef: i,
      validityData: E0(p, f),
      validate(m = true) {
        let b = r;
        b === void 0 && (b = g()), u.current = true, m ? Tt.flushSync(() => a(b)) : a(b);
      }
    });
  }, [a, i, n, l, g, o, f, u, s, p, r]), ce(() => {
    const m = l.current.fields;
    return () => {
      o && m.delete(o);
    };
  }, [l, o]);
}
const yp = /* @__PURE__ */ c.createContext({
  controlId: void 0,
  registerControlId: It,
  labelId: void 0,
  setLabelId: It,
  messageIds: [],
  setMessageIds: It,
  getDescriptionProps: (e) => e
});
process.env.NODE_ENV !== "production" && (yp.displayName = "LabelableContext");
function Nl() {
  return c.useContext(yp);
}
function Tl(e = {}) {
  const {
    id: n,
    implicit: r = false,
    controlRef: o
  } = e, {
    controlId: s,
    registerControlId: i
  } = Nl(), a = Mt(n), l = r ? s : void 0, f = xt(() => /* @__PURE__ */ Symbol("labelable-control")), u = c.useRef(false), p = c.useRef(n != null), d = de(() => {
    !u.current || i === It || (u.current = false, i(f.current, void 0));
  });
  return ce(() => {
    if (i === It)
      return;
    let g;
    if (r) {
      const m = o == null ? void 0 : o.current;
      Ke(m) && m.closest("label") != null ? g = n ?? null : g = l ?? a;
    } else if (n != null)
      p.current = true, g = n;
    else if (p.current)
      g = a;
    else {
      d();
      return;
    }
    if (g === void 0) {
      d();
      return;
    }
    u.current = true, i(f.current, g);
  }, [n, o, l, i, r, a, f, d]), c.useEffect(() => d, [d]), s ?? a;
}
function xp(e) {
  const n = e.getBoundingClientRect();
  if (process.env.NODE_ENV !== "production")
    return n;
  const r = window.getComputedStyle(e, "::before"), o = window.getComputedStyle(e, "::after");
  if (!(r.content !== "none" || o.content !== "none"))
    return n;
  const i = parseFloat(r.width) || 0, a = parseFloat(r.height) || 0, l = parseFloat(o.width) || 0, f = parseFloat(o.height) || 0, u = Math.max(n.width, i, l), p = Math.max(n.height, a, f), d = u - n.width, g = p - n.height;
  return {
    left: n.left - d / 2,
    right: n.right + d / 2,
    top: n.top - g / 2,
    bottom: n.bottom + g / 2
  };
}
function C0(e, n) {
  return e ?? n;
}
const S0 = (e) => ({
  name: "arrow",
  options: e,
  async fn(n) {
    var _a2, _b2;
    const {
      x: r,
      y: o,
      placement: s,
      rects: i,
      platform: a,
      elements: l,
      middlewareData: f
    } = n, {
      element: u,
      padding: p = 0,
      offsetParent: d = "real"
    } = hn(e, n) || {};
    if (u == null)
      return {};
    const g = yf(p), m = {
      x: r,
      y: o
    }, b = Za(s), h = Ja(b), v = await a.getDimensions(u), y = b === "y", x = y ? "top" : "left", R = y ? "bottom" : "right", S = y ? "clientHeight" : "clientWidth", E = i.reference[h] + i.reference[b] - m[b] - i.floating[h], C = m[b] - i.reference[b], T = d === "real" ? await ((_a2 = a.getOffsetParent) == null ? void 0 : _a2.call(a, u)) : l.floating;
    let N = l.floating[S] || i.floating[h];
    (!N || !await ((_b2 = a.isElement) == null ? void 0 : _b2.call(a, T))) && (N = l.floating[S] || i.floating[h]);
    const I = E / 2 - C / 2, L = N / 2 - v[h] / 2 - 1, A = Math.min(g[x], L), P = Math.min(g[R], L), O = A, M = N - v[h] - P, D = N / 2 - v[h] / 2 + I, _ = fa(O, D, M), k = !f.arrow && An(s) != null && D !== _ && i.reference[h] / 2 - (D < O ? A : P) - v[h] / 2 < 0, $ = k ? D < O ? D - O : D - M : 0;
    return {
      [b]: m[b] + $,
      data: {
        [b]: _,
        centerOffset: D - _ - $,
        ...k && {
          alignmentOffset: $
        }
      },
      reset: k
    };
  }
}), R0 = (e, n) => ({
  ...S0(e),
  options: [e, n]
}), N0 = {
  name: "hide",
  async fn(e) {
    var _a2;
    const {
      width: n,
      height: r,
      x: o,
      y: s
    } = e.rects.reference, i = n === 0 && r === 0 && o === 0 && s === 0;
    return {
      data: {
        referenceHidden: ((_a2 = (await iw().fn(e)).data) == null ? void 0 : _a2.referenceHidden) || i
      }
    };
  }
}, as = {
  sideX: "left",
  sideY: "top"
}, kl = {
  name: "adaptiveOrigin",
  async fn(e) {
    var _a2, _b2;
    const {
      x: n,
      y: r,
      rects: {
        floating: o
      },
      elements: {
        floating: s
      },
      platform: i,
      strategy: a,
      placement: l
    } = e, f = pt(s), u = f.getComputedStyle(s);
    if (!(u.transitionDuration !== "0s" && u.transitionDuration !== ""))
      return {
        x: n,
        y: r,
        data: as
      };
    const d = await ((_a2 = i.getOffsetParent) == null ? void 0 : _a2.call(i, s));
    let g = {
      width: 0,
      height: 0
    };
    if (a === "fixed" && (f == null ? void 0 : f.visualViewport))
      g = {
        width: f.visualViewport.width,
        height: f.visualViewport.height
      };
    else if (d === f) {
      const x = He(s);
      g = {
        width: x.documentElement.clientWidth,
        height: x.documentElement.clientHeight
      };
    } else await ((_b2 = i.isElement) == null ? void 0 : _b2.call(i, d)) && (g = await i.getDimensions(d));
    const m = Pt(l);
    let b = n, h = r;
    m === "left" && (b = g.width - (n + o.width)), m === "top" && (h = g.height - (r + o.height));
    const v = m === "left" ? "right" : as.sideX, y = m === "top" ? "bottom" : as.sideY;
    return {
      x: b,
      y: h,
      data: {
        sideX: v,
        sideY: y
      }
    };
  }
};
function wp(e, n, r) {
  const o = e === "inline-start" || e === "inline-end";
  return {
    top: "top",
    right: o ? r ? "inline-start" : "inline-end" : "right",
    bottom: "bottom",
    left: o ? r ? "inline-end" : "inline-start" : "left"
  }[n];
}
function Ou(e, n, r) {
  const {
    rects: o,
    placement: s
  } = e;
  return {
    side: wp(n, Pt(s), r),
    align: An(s) || "center",
    anchor: {
      width: o.reference.width,
      height: o.reference.height
    },
    positioner: {
      width: o.floating.width,
      height: o.floating.height
    }
  };
}
function si(e) {
  var _a2, _b2;
  const {
    // Public parameters
    anchor: n,
    positionMethod: r = "absolute",
    side: o = "bottom",
    sideOffset: s = 0,
    align: i = "center",
    alignOffset: a = 0,
    collisionBoundary: l,
    collisionPadding: f = 5,
    sticky: u = false,
    arrowPadding: p = 5,
    disableAnchorTracking: d = false,
    // Private parameters
    keepMounted: g = false,
    floatingRootContext: m,
    mounted: b,
    collisionAvoidance: h,
    shiftCrossAxis: v = false,
    nodeId: y,
    adaptiveOrigin: x,
    lazyFlip: R = false,
    externalTree: S
  } = e, [E, C] = c.useState(null);
  !b && E !== null && C(null);
  const T = h.side || "flip", N = h.align || "flip", I = h.fallbackAxisSide || "end", L = typeof n == "function" ? n : void 0, A = de(L), P = L ? A : n, O = yt(n), D = Ds() === "rtl", _ = E || {
    top: "top",
    right: "right",
    bottom: "bottom",
    left: "left",
    "inline-end": D ? "left" : "right",
    "inline-start": D ? "right" : "left"
  }[o], k = i === "center" ? _ : `${_}-${i}`;
  let $ = f;
  const F = 1, z = o === "bottom" ? F : 0, Q = o === "top" ? F : 0, B = o === "right" ? F : 0, G = o === "left" ? F : 0;
  typeof $ == "number" ? $ = {
    top: $ + z,
    right: $ + G,
    bottom: $ + Q,
    left: $ + B
  } : $ && ($ = {
    top: ($.top || 0) + z,
    right: ($.right || 0) + G,
    bottom: ($.bottom || 0) + Q,
    left: ($.left || 0) + B
  });
  const j = {
    boundary: l === "clipping-ancestors" ? "clippingAncestors" : l,
    padding: $
  }, W = c.useRef(null), H = yt(s), te = yt(a), ae = [tw((Ne) => {
    const Ye = Ou(Ne, o, D), qe = typeof H.current == "function" ? H.current(Ye) : H.current, rt = typeof te.current == "function" ? te.current(Ye) : te.current;
    return {
      mainAxis: qe,
      crossAxis: rt,
      alignmentAxis: rt
    };
  }, [typeof s != "function" ? s : 0, typeof a != "function" ? a : 0, D, o])], ue = N === "none" && T !== "shift", fe = !ue && (u || v || T === "shift"), le = T === "none" ? null : ow({
    ...j,
    // Ensure the popup flips if it's been limited by its --available-height and it resizes.
    // Since the size() padding is smaller than the flip() padding, flip() will take precedence.
    padding: {
      top: $.top + F,
      right: $.right + F,
      bottom: $.bottom + F,
      left: $.left + F
    },
    mainAxis: !v && T === "flip",
    crossAxis: N === "flip" ? "alignment" : false,
    fallbackAxisSideDirection: I
  }), se = ue ? null : nw((Ne) => {
    const Ye = He(Ne.elements.floating).documentElement;
    return {
      ...j,
      // Use the Layout Viewport to avoid shifting around when pinch-zooming
      // for context menus.
      rootBoundary: v ? {
        x: 0,
        y: 0,
        width: Ye.clientWidth,
        height: Ye.clientHeight
      } : void 0,
      mainAxis: N !== "none",
      crossAxis: fe,
      limiter: u || v ? void 0 : rw((qe) => {
        if (!W.current)
          return {};
        const {
          width: rt,
          height: Qe
        } = W.current.getBoundingClientRect(), De = zt(Pt(qe.placement)), Ge = De === "y" ? rt : Qe, pe = De === "y" ? $.left + $.right : $.top + $.bottom;
        return {
          offset: Ge / 2 + pe / 2
        };
      })
    };
  }, [j, u, v, $, N]);
  T === "shift" || N === "shift" || i === "center" ? ae.push(se, le) : ae.push(le, se), ae.push(sw({
    ...j,
    apply({
      elements: {
        floating: Ne
      },
      availableWidth: Ye,
      availableHeight: qe,
      rects: rt
    }) {
      const Qe = Ne.style;
      Qe.setProperty("--available-width", `${Ye}px`), Qe.setProperty("--available-height", `${qe}px`);
      const De = window.devicePixelRatio || 1, {
        x: Ge,
        y: pe,
        width: Be,
        height: Ve
      } = rt.reference, $e = (Math.round((Ge + Be) * De) - Math.round(Ge * De)) / De, ot = (Math.round((pe + Ve) * De) - Math.round(pe * De)) / De;
      Qe.setProperty("--anchor-width", `${$e}px`), Qe.setProperty("--anchor-height", `${ot}px`);
    }
  }), R0(() => ({
    // `transform-origin` calculations rely on an element existing. If the arrow hasn't been set,
    // we'll create a fake element.
    element: W.current || document.createElement("div"),
    padding: p,
    offsetParent: "floating"
  }), [p]), {
    name: "transformOrigin",
    fn(Ne) {
      var _a3, _b3, _c2;
      const {
        elements: Ye,
        middlewareData: qe,
        placement: rt,
        rects: Qe,
        y: De
      } = Ne, Ge = Pt(rt), pe = zt(Ge), Be = W.current, Ve = ((_a3 = qe.arrow) == null ? void 0 : _a3.x) || 0, $e = ((_b3 = qe.arrow) == null ? void 0 : _b3.y) || 0, ot = (Be == null ? void 0 : Be.clientWidth) || 0, Xe = (Be == null ? void 0 : Be.clientHeight) || 0, ge = Ve + ot / 2, Oe = $e + Xe / 2, Fe = Math.abs(((_c2 = qe.shift) == null ? void 0 : _c2.y) || 0), ze = Qe.reference.height / 2, et = typeof s == "function" ? s(Ou(Ne, o, D)) : s, at = Fe > et, Bt = {
        top: `${ge}px calc(100% + ${et}px)`,
        bottom: `${ge}px ${-et}px`,
        left: `calc(100% + ${et}px) ${Oe}px`,
        right: `${-et}px ${Oe}px`
      }[Ge], $n = `${ge}px ${Qe.reference.y + ze - De}px`;
      return Ye.floating.style.setProperty("--transform-origin", fe && pe === "y" && at ? $n : Bt), {};
    }
  }, N0, x), ce(() => {
    !b && m && m.update({
      referenceElement: null,
      floatingElement: null,
      domReferenceElement: null
    });
  }, [b, m]);
  const me = c.useMemo(() => ({
    elementResize: !d && typeof ResizeObserver < "u",
    layoutShift: !d && typeof IntersectionObserver < "u"
  }), [d]), {
    refs: ye,
    elements: ne,
    x: re,
    y: q,
    middlewareData: U,
    update: V,
    placement: Y,
    context: ee,
    isPositioned: he,
    floatingStyles: Me
  } = Hw({
    rootContext: m,
    placement: k,
    middleware: ae,
    strategy: r,
    whileElementsMounted: g ? void 0 : (...Ne) => gu(...Ne, me),
    nodeId: y,
    externalTree: S
  }), {
    sideX: Ue,
    sideY: Le
  } = U.adaptiveOrigin || as, _e = he ? r : "fixed", xe = c.useMemo(() => {
    const Ne = x ? {
      position: _e,
      [Ue]: re,
      [Le]: q
    } : {
      position: _e,
      ...Me
    };
    return he || (Ne.opacity = 0), Ne;
  }, [x, _e, Ue, re, Le, q, Me, he]), Ee = c.useRef(null);
  ce(() => {
    if (!b)
      return;
    const Ne = O.current, Ye = typeof Ne == "function" ? Ne() : Ne, rt = (Iu(Ye) ? Ye.current : Ye) || null || null;
    rt !== Ee.current && (ye.setPositionReference(rt), Ee.current = rt);
  }, [b, ye, P, O]), c.useEffect(() => {
    if (!b)
      return;
    const Ne = O.current;
    typeof Ne != "function" && Iu(Ne) && Ne.current !== Ee.current && (ye.setPositionReference(Ne.current), Ee.current = Ne.current);
  }, [b, ye, P, O]), c.useEffect(() => {
    if (g && b && ne.domReference && ne.floating)
      return gu(ne.domReference, ne.floating, V, me);
  }, [g, b, ne, V, me]);
  const Re = Pt(Y), We = wp(o, Re, D), Ce = An(Y) || "center", Ie = !!((_a2 = U.hide) == null ? void 0 : _a2.referenceHidden);
  ce(() => {
    R && b && he && C(Re);
  }, [R, b, he, Re]);
  const je = c.useMemo(() => {
    var _a3, _b3;
    return {
      position: "absolute",
      top: (_a3 = U.arrow) == null ? void 0 : _a3.y,
      left: (_b3 = U.arrow) == null ? void 0 : _b3.x
    };
  }, [U.arrow]), lt = ((_b2 = U.arrow) == null ? void 0 : _b2.centerOffset) !== 0;
  return c.useMemo(() => ({
    positionerStyles: xe,
    arrowStyles: je,
    arrowRef: W,
    arrowUncentered: lt,
    side: We,
    align: Ce,
    physicalSide: Re,
    anchorHidden: Ie,
    refs: ye,
    context: ee,
    isPositioned: he,
    update: V
  }), [xe, je, W, lt, We, Ce, Re, Ie, ye, ee, he, V]);
}
function Iu(e) {
  return e != null && "current" in e;
}
function Vn(e) {
  return e === "starting" ? _v : ct;
}
const Ep = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    className: o,
    render: s,
    orientation: i = "horizontal",
    ...a
  } = n;
  return Pe("div", n, {
    state: {
      orientation: i
    },
    ref: r,
    props: [{
      role: "separator",
      "aria-orientation": i
    }, a]
  });
});
process.env.NODE_ENV !== "production" && (Ep.displayName = "Separator");
function T0(e, n, r, o = true, s) {
  const [i, a] = c.useState(), l = Mt(s ? `${s}-label` : void 0), f = e ?? n ?? i;
  return ce(() => {
    const u = e || n || !o ? void 0 : k0(r.current, l);
    i !== u && a(u);
  }), f;
}
function k0(e, n) {
  const r = O0(e);
  if (r)
    return !r.id && n && (r.id = n), r.id || void 0;
}
function O0(e) {
  if (!e)
    return;
  const n = e.parentElement;
  if (n && n.tagName === "LABEL")
    return n;
  const r = e.id;
  if (r) {
    const s = e.nextElementSibling;
    if (s && s.htmlFor === r)
      return s;
  }
  const o = e.labels;
  return o && o[0];
}
const Cp = {
  ...ry,
  ...en
}, Sp = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    render: o,
    className: s,
    defaultOpen: i = false,
    disabled: a = false,
    onOpenChange: l,
    open: f,
    ...u
  } = n, p = de(l), d = Zv({
    open: f,
    defaultOpen: i,
    onOpenChange: p,
    disabled: a
  }), g = c.useMemo(() => ({
    open: d.open,
    disabled: d.disabled,
    transitionStatus: d.transitionStatus
  }), [d.open, d.disabled, d.transitionStatus]), m = c.useMemo(() => ({
    ...d,
    onOpenChange: p,
    state: g
  }), [d, p, g]), b = Pe("div", n, {
    state: g,
    ref: r,
    props: u,
    stateAttributesMapping: Cp
  });
  return /* @__PURE__ */ jsx(Ua.Provider, {
    value: m,
    children: b
  });
});
process.env.NODE_ENV !== "production" && (Sp.displayName = "CollapsibleRoot");
const I0 = {
  ...ny,
  ...en
}, Rp = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    panelId: o,
    open: s,
    handleTrigger: i,
    state: a,
    disabled: l
  } = rf(), {
    className: f,
    disabled: u = l,
    id: p,
    render: d,
    nativeButton: g = true,
    ...m
  } = n, {
    getButtonProps: b,
    buttonRef: h
  } = nn({
    disabled: u,
    focusableWhenDisabled: true,
    native: g
  }), v = c.useMemo(() => ({
    "aria-controls": s ? o : void 0,
    "aria-expanded": s,
    onClick: i
  }), [o, s, i]);
  return Pe("button", n, {
    state: a,
    ref: [r, h],
    props: [v, m, b],
    stateAttributesMapping: I0
  });
});
process.env.NODE_ENV !== "production" && (Rp.displayName = "CollapsibleTrigger");
let Pu = /* @__PURE__ */ (function(e) {
  return e.collapsiblePanelHeight = "--collapsible-panel-height", e.collapsiblePanelWidth = "--collapsible-panel-width", e;
})({});
const Np = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    className: o,
    hiddenUntilFound: s,
    keepMounted: i,
    render: a,
    id: l,
    ...f
  } = n;
  process.env.NODE_ENV !== "production" && ce(() => {
    s && i === false && Va("The `keepMounted={false}` prop on a Collapsible will be ignored when using `hiddenUntilFound` since it requires the Panel to remain mounted even when closed.");
  }, [s, i]);
  const {
    abortControllerRef: u,
    animationTypeRef: p,
    height: d,
    mounted: g,
    onOpenChange: m,
    open: b,
    panelId: h,
    panelRef: v,
    runOnceAnimationsFinish: y,
    setDimensions: x,
    setHiddenUntilFound: R,
    setKeepMounted: S,
    setMounted: E,
    setPanelIdState: C,
    setOpen: T,
    setVisible: N,
    state: I,
    transitionDimensionRef: L,
    visible: A,
    width: P,
    transitionStatus: O
  } = rf(), M = s ?? false, D = i ?? false;
  ce(() => {
    if (l)
      return C(l), () => {
        C(void 0);
      };
  }, [l, C]), ce(() => {
    R(M);
  }, [R, M]), ce(() => {
    S(D);
  }, [S, D]);
  const {
    props: _
  } = Zy({
    abortControllerRef: u,
    animationTypeRef: p,
    externalRef: r,
    height: d,
    hiddenUntilFound: M,
    id: h,
    keepMounted: D,
    mounted: g,
    onOpenChange: m,
    open: b,
    panelRef: v,
    runOnceAnimationsFinish: y,
    setDimensions: x,
    setMounted: E,
    setOpen: T,
    setVisible: N,
    transitionDimensionRef: L,
    visible: A,
    width: P
  });
  rn({
    open: b && O === "idle",
    ref: v,
    onComplete() {
      b && x({
        height: void 0,
        width: void 0
      });
    }
  });
  const k = c.useMemo(() => ({
    ...I,
    transitionStatus: O
  }), [I, O]), $ = Pe("div", n, {
    state: k,
    ref: [r, v],
    props: [_, {
      style: {
        [Pu.collapsiblePanelHeight]: d === void 0 ? "auto" : `${d}px`,
        [Pu.collapsiblePanelWidth]: P === void 0 ? "auto" : `${P}px`
      }
    }, f],
    stateAttributesMapping: Cp
  });
  return D || M || !D && g ? $ : null;
});
process.env.NODE_ENV !== "production" && (Np.displayName = "CollapsiblePanel");
const Tp = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Tp.displayName = "ContextMenuRootContext");
function ii(e = true) {
  const n = c.useContext(Tp);
  if (n === void 0 && !e)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: ContextMenuRootContext is missing. ContextMenu parts must be placed within <ContextMenu.Root>." : Ze(25));
  return n;
}
const Ol = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Ol.displayName = "MenuPositionerContext");
function kp(e) {
  const n = c.useContext(Ol);
  if (n === void 0 && !e)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: MenuPositionerContext is missing. MenuPositioner parts must be placed within <Menu.Positioner>." : Ze(33));
  return n;
}
const Il = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Il.displayName = "MenuRootContext");
function tr(e) {
  const n = c.useContext(Il);
  if (n === void 0 && !e)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: MenuRootContext is missing. Menu parts must be placed within <Menu.Root>." : Ze(36));
  return n;
}
function P0(e) {
  const {
    closeOnClick: n,
    highlighted: r,
    id: o,
    nodeId: s,
    store: i,
    typingRef: a,
    itemRef: l,
    itemMetadata: f
  } = e, {
    events: u
  } = i.useState("floatingTreeRoot"), p = ii(true), d = p !== void 0;
  return c.useMemo(() => ({
    id: o,
    role: "menuitem",
    tabIndex: r ? 0 : -1,
    onKeyDown(g) {
      g.key === " " && (a == null ? void 0 : a.current) && g.preventDefault();
    },
    onMouseMove(g) {
      s && u.emit("itemhover", {
        nodeId: s,
        target: g.currentTarget
      });
    },
    onClick(g) {
      n && u.emit("close", {
        domEvent: g,
        reason: Vr
      });
    },
    onMouseUp(g) {
      if (p) {
        const m = p.initialCursorPointRef.current;
        if (p.initialCursorPointRef.current = null, d && m && Math.abs(g.clientX - m.x) <= 1 && Math.abs(g.clientY - m.y) <= 1 || d && !df && g.button === 2)
          return;
      }
      l.current && i.context.allowMouseUpTriggerRef.current && (!d || g.button === 2) && (!f || f.type === "regular-item") && l.current.click();
    }
  }), [n, r, o, u, s, i, a, l, p, d, f]);
}
const M0 = {
  type: "regular-item"
};
function D0(e) {
  const {
    closeOnClick: n,
    disabled: r = false,
    highlighted: o,
    id: s,
    store: i,
    typingRef: a = i.context.typingRef,
    nativeButton: l,
    itemMetadata: f,
    nodeId: u
  } = e, p = c.useRef(null), {
    getButtonProps: d,
    buttonRef: g
  } = nn({
    disabled: r,
    focusableWhenDisabled: true,
    native: l,
    composite: true
  }), m = P0({
    closeOnClick: n,
    highlighted: o,
    id: s,
    nodeId: u,
    store: i,
    typingRef: a,
    itemRef: p,
    itemMetadata: f
  }), b = c.useCallback((v) => Tn(m, {
    onMouseEnter() {
      f.type === "submenu-trigger" && f.setActive();
    }
  }, v, d), [m, d, f]), h = Wt(p, g);
  return c.useMemo(() => ({
    getItemProps: b,
    itemRef: h
  }), [b, h]);
}
const Op = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    render: o,
    className: s,
    id: i,
    label: a,
    nativeButton: l = false,
    disabled: f = false,
    closeOnClick: u = true,
    ...p
  } = n, d = _s({
    label: a
  }), g = kp(true), m = Mt(i), {
    store: b
  } = tr(), h = b.useState("isActive", d.index), v = b.useState("itemProps"), {
    getItemProps: y,
    itemRef: x
  } = D0({
    closeOnClick: u,
    disabled: f,
    highlighted: h,
    id: m,
    store: b,
    nativeButton: l,
    nodeId: g == null ? void 0 : g.nodeId,
    itemMetadata: M0
  });
  return Pe("div", n, {
    state: {
      disabled: f,
      highlighted: h
    },
    props: [v, p, y],
    ref: [x, r, d.ref]
  });
});
process.env.NODE_ENV !== "production" && (Op.displayName = "MenuItem");
const Ip = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Ip.displayName = "ToolbarRootContext");
function Pl(e) {
  return c.useContext(Ip);
}
const A0 = {
  ...sn,
  ...en
}, Pp = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    render: o,
    className: s,
    finalFocus: i,
    ...a
  } = n, {
    store: l
  } = tr(), {
    side: f,
    align: u
  } = kp(), p = Pl() != null, d = l.useState("open"), g = l.useState("transitionStatus"), m = l.useState("popupProps"), b = l.useState("mounted"), h = l.useState("instantType"), v = l.useState("activeTriggerElement"), y = l.useState("parent"), x = l.useState("lastOpenChangeReason"), R = l.useState("rootId"), S = l.useState("floatingRootContext"), E = l.useState("floatingTreeRoot"), C = l.useState("closeDelay"), T = l.useState("activeTriggerElement"), N = y.type === "context-menu";
  rn({
    open: d,
    ref: l.context.popupRef,
    onComplete() {
      var _a2, _b2;
      d && ((_b2 = (_a2 = l.context).onOpenChangeComplete) == null ? void 0 : _b2.call(_a2, true));
    }
  }), c.useEffect(() => {
    function D(_) {
      l.setOpen(false, we(_.reason, _.domEvent));
    }
    return E.events.on("close", D), () => {
      E.events.off("close", D);
    };
  }, [E.events, l]);
  const I = l.useState("hoverEnabled"), L = l.useState("disabled");
  pl(S, {
    enabled: I && !L && !N && y.type !== "menubar",
    closeDelay: C
  });
  const A = {
    transitionStatus: g,
    side: f,
    align: u,
    open: d,
    nested: y.type === "menu",
    instant: h
  }, P = c.useCallback((D) => {
    l.set("popupElement", D);
  }, [l]), O = Pe("div", n, {
    state: A,
    ref: [r, l.context.popupRef, P],
    stateAttributesMapping: A0,
    props: [m, {
      onKeyDown(D) {
        p && Ws.has(D.key) && D.stopPropagation();
      }
    }, Vn(g), a, {
      "data-rootownerid": R
    }]
  });
  let M = y.type === void 0 || N;
  return (v || y.type === "menubar" && x !== As) && (M = true), /* @__PURE__ */ jsx(Gs, {
    context: S,
    modal: N,
    disabled: !b,
    returnFocus: i === void 0 ? M : i,
    initialFocus: y.type !== "menu",
    restoreFocus: true,
    externalTree: y.type !== "menubar" ? E : void 0,
    previousFocusableElement: T,
    nextFocusableElement: y.type === void 0 ? l.context.triggerFocusTargetRef : void 0,
    beforeContentFocusGuardRef: y.type === void 0 ? l.context.beforeContentFocusGuardRef : void 0,
    children: O
  });
});
process.env.NODE_ENV !== "production" && (Pp.displayName = "MenuPopup");
const Ml = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Ml.displayName = "MenuPortalContext");
function L0() {
  const e = c.useContext(Ml);
  if (e === void 0)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: <Menu.Portal> is missing." : Ze(32));
  return e;
}
const Mp = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    keepMounted: o = false,
    ...s
  } = n, {
    store: i
  } = tr();
  return i.useState("mounted") || o ? /* @__PURE__ */ jsx(Ml.Provider, {
    value: o,
    children: /* @__PURE__ */ jsx(ho, {
      ref: r,
      ...s
    })
  }) : null;
});
process.env.NODE_ENV !== "production" && (Mp.displayName = "MenuPortal");
const Dp = /* @__PURE__ */ c.forwardRef(function(n, r) {
  var _a2;
  const {
    anchor: o,
    positionMethod: s = "absolute",
    className: i,
    render: a,
    side: l,
    align: f,
    sideOffset: u = 0,
    alignOffset: p = 0,
    collisionBoundary: d = "clipping-ancestors",
    collisionPadding: g = 5,
    arrowPadding: m = 5,
    sticky: b = false,
    disableAnchorTracking: h = false,
    collisionAvoidance: v = tf,
    ...y
  } = n, {
    store: x
  } = tr(), R = L0(), S = ii(true), E = x.useState("parent"), C = x.useState("floatingRootContext"), T = x.useState("floatingTreeRoot"), N = x.useState("mounted"), I = x.useState("open"), L = x.useState("modal"), A = x.useState("activeTriggerElement"), P = x.useState("transitionStatus"), O = x.useState("positionerElement"), M = x.useState("instantType"), D = x.useState("hasViewport"), _ = x.useState("lastOpenChangeReason"), k = x.useState("floatingNodeId"), $ = x.useState("floatingParentNodeId"), F = C.useState("domReferenceElement"), z = c.useRef(null), Q = Fs(O, false, false);
  let B = o, G = u, j = p, W = f, H = v;
  E.type === "context-menu" && (B = o ?? ((_a2 = E.context) == null ? void 0 : _a2.anchor), W = W ?? "start", !l && W !== "center" && (j = n.alignOffset ?? 2, G = n.sideOffset ?? -5));
  let te = l, J = W;
  E.type === "menu" ? (te = te ?? "inline-end", J = J ?? "start", H = n.collisionAvoidance ?? Ha) : E.type === "menubar" && (te = te ?? "bottom", J = J ?? "start");
  const oe = E.type === "context-menu", ae = si({
    anchor: B,
    floatingRootContext: C,
    positionMethod: S ? "fixed" : s,
    mounted: N,
    side: te,
    sideOffset: G,
    align: J,
    alignOffset: j,
    arrowPadding: oe ? 0 : m,
    collisionBoundary: d,
    collisionPadding: g,
    sticky: b,
    nodeId: k,
    keepMounted: R,
    disableAnchorTracking: h,
    collisionAvoidance: H,
    shiftCrossAxis: oe && !("side" in H && H.side === "flip"),
    externalTree: T,
    adaptiveOrigin: D ? kl : void 0
  }), ue = c.useMemo(() => {
    const re = {};
    return I || (re.pointerEvents = "none"), {
      role: "presentation",
      hidden: !N,
      style: {
        ...ae.positionerStyles,
        ...re
      }
    };
  }, [I, N, ae.positionerStyles]);
  c.useEffect(() => {
    function re(q) {
      q.open && (q.parentNodeId === k && x.set("hoverEnabled", false), q.nodeId !== k && q.parentNodeId === x.select("floatingParentNodeId") && x.setOpen(false, we(Ar)));
    }
    return T.events.on("menuopenchange", re), () => {
      T.events.off("menuopenchange", re);
    };
  }, [x, T.events, k]), c.useEffect(() => {
    if (x.select("floatingParentNodeId") == null)
      return;
    function re(q) {
      if (q.open || q.nodeId !== x.select("floatingParentNodeId"))
        return;
      const U = q.reason ?? Ar;
      x.setOpen(false, we(U));
    }
    return T.events.on("menuopenchange", re), () => {
      T.events.off("menuopenchange", re);
    };
  }, [T.events, x]);
  const fe = ht();
  c.useEffect(() => {
    I || fe.clear();
  }, [I, fe]), c.useEffect(() => {
    function re(q) {
      if (!(!I || q.nodeId !== x.select("floatingParentNodeId")))
        if (q.target && A && A !== q.target) {
          const U = x.select("closeDelay");
          U > 0 ? fe.isStarted() || fe.start(U, () => {
            x.setOpen(false, we(Ar));
          }) : x.setOpen(false, we(Ar));
        } else
          fe.clear();
    }
    return T.events.on("itemhover", re), () => {
      T.events.off("itemhover", re);
    };
  }, [T.events, I, A, x, fe]), c.useEffect(() => {
    const re = {
      open: I,
      nodeId: k,
      parentNodeId: $,
      reason: x.select("lastOpenChangeReason")
    };
    T.events.emit("menuopenchange", re);
  }, [T.events, I, x, k, $]), ce(() => {
    const re = F, q = z.current;
    if (re && (z.current = re), q && re && re !== q) {
      x.set("instantType", void 0);
      const U = new AbortController();
      return Q(() => {
        x.set("instantType", "trigger-change");
      }, U.signal), () => {
        U.abort();
      };
    }
  }, [F, Q, x]);
  const le = {
    open: I,
    side: ae.side,
    align: ae.align,
    anchorHidden: ae.anchorHidden,
    nested: E.type === "menu",
    instant: M
  }, se = c.useMemo(() => ({
    side: ae.side,
    align: ae.align,
    arrowRef: ae.arrowRef,
    arrowUncentered: ae.arrowUncentered,
    arrowStyles: ae.arrowStyles,
    nodeId: ae.context.nodeId
  }), [ae.side, ae.align, ae.arrowRef, ae.arrowUncentered, ae.arrowStyles, ae.context.nodeId]), me = Pe("div", n, {
    state: le,
    stateAttributesMapping: sn,
    ref: [r, x.useStateSetter("positionerElement")],
    props: [ue, Vn(P), y]
  }), ye = N && E.type !== "menu" && (E.type !== "menubar" && L && _ !== vt || E.type === "menubar" && E.context.modal);
  let ne = null;
  return E.type === "menubar" ? ne = E.context.contentElement : E.type === void 0 && (ne = A), /* @__PURE__ */ jsxs(Ol.Provider, {
    value: se,
    children: [ye && /* @__PURE__ */ jsx(xo, {
      ref: E.type === "context-menu" || E.type === "nested-context-menu" ? E.context.internalBackdropRef : null,
      inert: yo(!I),
      cutout: ne
    }), /* @__PURE__ */ jsx(Kf, {
      id: k,
      children: /* @__PURE__ */ jsx(Ms, {
        elementsRef: x.context.itemDomElements,
        labelsRef: x.context.itemLabels,
        children: me
      })
    })]
  });
});
process.env.NODE_ENV !== "production" && (Dp.displayName = "MenuPositioner");
const Ap = /* @__PURE__ */ c.createContext(null);
process.env.NODE_ENV !== "production" && (Ap.displayName = "MenubarContext");
function Lp(e) {
  return c.useContext(Ap);
}
const F0 = {
  ...ei,
  disabled: ie((e) => e.parent.type === "menubar" && e.parent.context.disabled || e.disabled),
  modal: ie((e) => (e.parent.type === void 0 || e.parent.type === "context-menu") && (e.modal ?? true)),
  allowMouseEnter: ie((e) => e.allowMouseEnter),
  stickIfOpen: ie((e) => e.stickIfOpen),
  parent: ie((e) => e.parent),
  rootId: ie((e) => e.parent.type === "menu" ? e.parent.store.select("rootId") : e.parent.type !== void 0 ? e.parent.context.rootId : e.rootId),
  activeIndex: ie((e) => e.activeIndex),
  isActive: ie((e, n) => e.activeIndex === n),
  hoverEnabled: ie((e) => e.hoverEnabled),
  instantType: ie((e) => e.instantType),
  lastOpenChangeReason: ie((e) => e.openChangeReason),
  floatingTreeRoot: ie((e) => e.parent.type === "menu" ? e.parent.store.select("floatingTreeRoot") : e.floatingTreeRoot),
  floatingNodeId: ie((e) => e.floatingNodeId),
  floatingParentNodeId: ie((e) => e.floatingParentNodeId),
  itemProps: ie((e) => e.itemProps),
  closeDelay: ie((e) => e.closeDelay),
  hasViewport: ie((e) => e.hasViewport),
  keyboardEventRelay: ie((e) => {
    if (e.keyboardEventRelay)
      return e.keyboardEventRelay;
    if (e.parent.type === "menu")
      return e.parent.store.select("keyboardEventRelay");
  })
};
class Dl extends vo {
  constructor(n) {
    super({
      ..._0(),
      ...n
    }, {
      positionerRef: /* @__PURE__ */ c.createRef(),
      popupRef: /* @__PURE__ */ c.createRef(),
      typingRef: {
        current: false
      },
      itemDomElements: {
        current: []
      },
      itemLabels: {
        current: []
      },
      allowMouseUpTriggerRef: {
        current: false
      },
      triggerFocusTargetRef: /* @__PURE__ */ c.createRef(),
      beforeContentFocusGuardRef: /* @__PURE__ */ c.createRef(),
      onOpenChangeComplete: void 0,
      triggerElements: new Nr()
    }, F0);
    __publicField(this, "unsubscribeParentListener", null);
    this.unsubscribeParentListener = this.observe("parent", (r) => {
      var _a2;
      if ((_a2 = this.unsubscribeParentListener) == null ? void 0 : _a2.call(this), r.type === "menu") {
        let o = r.store.select("rootId"), s = r.store.select("floatingTreeRoot"), i = r.store.select("keyboardEventRelay");
        this.unsubscribeParentListener = r.store.subscribe(() => {
          const a = r.store.select("rootId"), l = r.store.select("floatingTreeRoot"), f = r.store.select("keyboardEventRelay");
          o === a && s === l && i === f || (o = a, s = l, i = f, this.notifyAll());
        }), this.context.allowMouseUpTriggerRef = r.store.context.allowMouseUpTriggerRef;
        return;
      }
      r.type !== void 0 && (this.context.allowMouseUpTriggerRef = r.context.allowMouseUpTriggerRef), this.unsubscribeParentListener = null;
    });
  }
  setOpen(n, r) {
    this.state.floatingRootContext.context.events.emit("setOpen", {
      open: n,
      eventDetails: r
    });
  }
  static useStore(n, r) {
    const o = xt(() => new Dl(r)).current;
    return n ?? o;
  }
}
function _0() {
  return {
    ...Qs(),
    disabled: false,
    modal: true,
    allowMouseEnter: false,
    stickIfOpen: true,
    parent: {
      type: void 0
    },
    rootId: void 0,
    activeIndex: null,
    hoverEnabled: true,
    instantType: void 0,
    openChangeReason: null,
    floatingTreeRoot: new nl(),
    floatingNodeId: void 0,
    floatingParentNodeId: null,
    itemProps: ct,
    keyboardEventRelay: void 0,
    closeDelay: 0,
    hasViewport: false
  };
}
const Fp = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Fp.displayName = "MenuSubmenuRootContext");
function V0() {
  return c.useContext(Fp);
}
const _p = cl(function(n) {
  const {
    children: r,
    open: o,
    onOpenChange: s,
    onOpenChangeComplete: i,
    defaultOpen: a = false,
    disabled: l = false,
    modal: f,
    loopFocus: u = true,
    orientation: p = "vertical",
    actionsRef: d,
    closeParentOnEsc: g = false,
    handle: m,
    triggerId: b,
    defaultTriggerId: h = null,
    highlightItemOnHover: v = true
  } = n, y = ii(true), x = tr(true), R = Lp(true), S = V0(), E = c.useMemo(() => S && x ? {
    type: "menu",
    store: x.store
  } : R ? {
    type: "menubar",
    context: R
  } : y && !x ? {
    type: "context-menu",
    context: y
  } : {
    type: void 0
  }, [y, x, R, S]), C = Dl.useStore(m == null ? void 0 : m.store, {
    open: a,
    openProp: o,
    activeTriggerId: h,
    triggerIdProp: b,
    parent: E
  });
  wo(() => {
    o === void 0 && C.state.open === false && a === true && C.update({
      open: true,
      activeTriggerId: h
    });
  }), C.useControlledProp("openProp", o), C.useControlledProp("triggerIdProp", b), C.useContextCallback("onOpenChangeComplete", i);
  const T = C.useState("floatingTreeRoot"), N = sl(T), I = on();
  ce(() => {
    y && !x ? C.update({
      parent: {
        type: "context-menu",
        context: y
      },
      floatingNodeId: N,
      floatingParentNodeId: I
    }) : x && C.update({
      floatingNodeId: N,
      floatingParentNodeId: I
    });
  }, [y, x, N, I, C]);
  const L = C.useState("open"), A = C.useState("activeTriggerElement"), P = C.useState("positionerElement"), O = C.useState("hoverEnabled"), M = C.useState("modal"), D = C.useState("disabled"), _ = C.useState("lastOpenChangeReason"), k = C.useState("parent"), $ = C.useState("activeIndex"), F = C.useState("payload"), z = C.useState("floatingParentNodeId"), Q = c.useRef(null), B = z != null;
  let G;
  process.env.NODE_ENV !== "production" && k.type !== void 0 && f !== void 0 && console.warn("Base UI: The `modal` prop is not supported on nested menus. It will be ignored."), C.useSyncedValues({
    disabled: l,
    modal: k.type === void 0 ? f : void 0,
    rootId: er()
  });
  const {
    openMethod: j,
    triggerProps: W
  } = ri(L);
  Js(C);
  const {
    forceUnmount: H
  } = Zs(L, C, () => {
    C.update({
      allowMouseEnter: false,
      stickIfOpen: true
    });
  }), te = c.useRef(k.type !== "context-menu"), J = ht();
  c.useEffect(() => {
    if (L || (Q.current = null), k.type === "context-menu") {
      if (!L) {
        J.clear(), te.current = false;
        return;
      }
      J.start(500, () => {
        te.current = true;
      });
    }
  }, [J, L, k.type]), js(L && M && _ !== vt && j !== "touch", P), ce(() => {
    !L && !O && C.set("hoverEnabled", true);
  }, [L, O, C]);
  const oe = c.useRef(true), ae = ht(), ue = de((Ce, Ie) => {
    var _a2;
    const je = Ie.reason;
    if (L === Ce && Ie.trigger === A && _ === je || (Ie.preventUnmountOnClose = () => {
      C.set("preventUnmountingOnClose", true);
    }, !Ce && Ie.trigger == null && (Ie.trigger = A ?? void 0), s == null ? void 0 : s(Ce, Ie), Ie.isCanceled))
      return;
    const lt = {
      open: Ce,
      nativeEvent: Ie.event,
      reason: Ie.reason,
      nested: B
    };
    G == null ? void 0 : G.emit("openchange", lt);
    const Ne = Ie.event;
    if (Ce === false && (Ne == null ? void 0 : Ne.type) === "click" && Ne.pointerType === "touch" && !oe.current)
      return;
    if (!Ce && $ !== null) {
      const De = C.context.itemDomElements.current[$];
      queueMicrotask(() => {
        De == null ? void 0 : De.setAttribute("tabindex", "-1");
      });
    }
    Ce && je === ur ? (oe.current = false, ae.start(300, () => {
      oe.current = true;
    })) : (oe.current = true, ae.clear());
    const Ye = (je === Jt || je === Vr) && Ne.detail === 0 && (Ne == null ? void 0 : Ne.isTrusted), qe = !Ce && (je === ao || je == null), rt = {
      open: Ce,
      openChangeReason: je
    };
    Q.current = Ie.event ?? null;
    const Qe = ((_a2 = Ie.trigger) == null ? void 0 : _a2.id) ?? null;
    (Qe || Ce) && (rt.activeTriggerId = Qe, rt.activeTriggerElement = Ie.trigger ?? null), C.update(rt), k.type === "menubar" && (je === ur || je === Zt || je === vt || je === os || je === Ar) ? C.set("instantType", "group") : Ye || qe ? C.set("instantType", Ye ? "click" : "dismiss") : C.set("instantType", void 0);
  }), fe = c.useCallback((Ce) => {
    const Ie = we(Ce);
    return Ie.preventUnmountOnClose = () => {
      C.set("preventUnmountingOnClose", true);
    }, Ie;
  }, [C]), le = c.useCallback(() => {
    C.setOpen(false, fe(Ls));
  }, [C, fe]);
  c.useImperativeHandle(d, () => ({
    unmount: H,
    close: le
  }), [H, le]);
  let se;
  k.type === "context-menu" && (se = k.context), c.useImperativeHandle(se == null ? void 0 : se.positionerRef, () => P, [P]), c.useImperativeHandle(se == null ? void 0 : se.actionsRef, () => ({
    setOpen: ue
  }), [ue]);
  const me = ti({
    popupStore: C,
    onOpenChange: ue
  });
  G = me.context.events, c.useEffect(() => {
    const Ce = ({
      open: Ie,
      eventDetails: je
    }) => ue(Ie, je);
    return G.on("setOpen", Ce), () => {
      G == null ? void 0 : G.off("setOpen", Ce);
    };
  }, [G, ue]);
  const ye = bo(me, {
    enabled: !D,
    bubbles: {
      escapeKey: g && k.type === "menu"
    },
    outsidePress() {
      var _a2;
      return k.type !== "context-menu" || ((_a2 = Q.current) == null ? void 0 : _a2.type) === "contextmenu" ? true : te.current;
    },
    externalTree: B ? T : void 0
  }), ne = gl(me, {
    role: "menu"
  }), re = Ds(), q = c.useCallback((Ce) => {
    C.select("activeIndex") !== Ce && C.set("activeIndex", Ce);
  }, [C]), U = dp(me, {
    enabled: !D,
    listRef: C.context.itemDomElements,
    activeIndex: $,
    nested: k.type !== void 0,
    loopFocus: u,
    orientation: p,
    parentOrientation: k.type === "menubar" ? k.context.orientation : void 0,
    rtl: re === "rtl",
    disabledIndices: kn,
    onNavigate: q,
    openOnArrowKeyDown: k.type !== "context-menu",
    externalTree: B ? T : void 0,
    focusItemOnHover: v
  }), V = c.useCallback((Ce) => {
    C.context.typingRef.current = Ce;
  }, [C]), Y = fp(me, {
    listRef: C.context.itemLabels,
    elementsRef: C.context.itemDomElements,
    activeIndex: $,
    resetMs: Fv,
    onMatch: (Ce) => {
      L && Ce !== $ && C.set("activeIndex", Ce);
    },
    onTypingChange: V
  }), {
    getReferenceProps: ee,
    getFloatingProps: he,
    getItemProps: Me,
    getTriggerProps: Ue
  } = Fn([ye, ne, U, Y]), Le = c.useMemo(() => {
    const Ce = Tn(ee(), {
      onMouseMove() {
        C.set("allowMouseEnter", true);
      }
    }, W);
    return delete Ce.role, Ce;
  }, [ee, C, W]), _e = c.useMemo(() => {
    const Ce = Ue();
    if (!Ce)
      return Ce;
    const Ie = Tn(Ce, W);
    return delete Ie.role, delete Ie["aria-controls"], Ie;
  }, [Ue, W]), xe = c.useMemo(() => he({
    onMouseMove() {
      C.set("allowMouseEnter", true), k.type === "menu" && C.set("hoverEnabled", false);
    },
    onClick() {
      C.select("hoverEnabled") && C.set("hoverEnabled", false);
    },
    onKeyDown(Ce) {
      const Ie = C.select("keyboardEventRelay");
      Ie && !Ce.isPropagationStopped() && Ie(Ce);
    }
  }), [he, k.type, C]), Ee = c.useMemo(() => Me(), [Me]);
  C.useSyncedValues({
    floatingRootContext: me,
    activeTriggerProps: Le,
    inactiveTriggerProps: _e,
    popupProps: xe,
    itemProps: Ee
  });
  const Re = c.useMemo(() => ({
    store: C,
    parent: E
  }), [C, E]), We = /* @__PURE__ */ jsx(Il.Provider, {
    value: Re,
    children: typeof r == "function" ? r({
      payload: F
    }) : r
  });
  return k.type === void 0 || k.type === "context-menu" ? /* @__PURE__ */ jsx(Gf, {
    externalTree: T,
    children: We
  }) : We;
});
process.env.NODE_ENV !== "production" && (_p.displayName = "MenuRoot");
function Vp(e = {}) {
  const {
    highlightItemOnHover: n,
    highlightedIndex: r,
    onHighlightedIndexChange: o
  } = Ga(), {
    ref: s,
    index: i
  } = _s(e), a = r === i, l = c.useRef(null), f = Wt(s, l);
  return {
    compositeProps: c.useMemo(() => ({
      tabIndex: a ? 0 : -1,
      onFocus() {
        o(i);
      },
      onMouseMove() {
        const p = l.current;
        if (!n || !p)
          return;
        const d = p.hasAttribute("disabled") || p.ariaDisabled === "true";
        !a && !d && p.focus();
      }
    }), [a, o, i, n]),
    compositeRef: f,
    index: i
  };
}
function B0(e) {
  const {
    render: n,
    className: r,
    state: o = ct,
    props: s = kn,
    refs: i = kn,
    metadata: a,
    stateAttributesMapping: l,
    tag: f = "div",
    ...u
  } = e, {
    compositeProps: p,
    compositeRef: d
  } = Vp({
    metadata: a
  });
  return Pe(f, e, {
    state: o,
    ref: [...i, d],
    props: [p, ...s, u],
    stateAttributesMapping: l
  });
}
function Bp(e) {
  if (st(e) && e.hasAttribute("data-rootownerid"))
    return e.getAttribute("data-rootownerid") ?? void 0;
  if (!qt(e))
    return Bp(Qt(e));
}
function $0(e) {
  const {
    enabled: n = true,
    mouseDownAction: r,
    open: o
  } = e, s = c.useRef(false);
  return c.useMemo(() => n ? {
    onMouseDown: (i) => {
      (r === "open" && !o || r === "close" && o) && (s.current = true, He(i.currentTarget).addEventListener("click", () => {
        s.current = false;
      }, {
        once: true
      }));
    },
    onClick: (i) => {
      s.current && (s.current = false, i.preventBaseUIHandler());
    }
  } : ct, [n, r, o]);
}
const Go = 2, $p = ip(function(n, r) {
  const {
    render: o,
    className: s,
    disabled: i = false,
    nativeButton: a = true,
    id: l,
    openOnHover: f,
    delay: u = 100,
    closeDelay: p = 0,
    handle: d,
    payload: g,
    ...m
  } = n, b = tr(true), h = (d == null ? void 0 : d.store) ?? (b == null ? void 0 : b.store);
  if (!h)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: <Menu.Trigger> must be either used within a <Menu.Root> component or provided with a handle." : Ze(85));
  const v = Mt(l), y = h.useState("isTriggerActive", v), x = h.useState("floatingRootContext"), R = h.useState("isOpenedByTrigger", v), S = c.useRef(null), E = H0(), C = Ga(true), T = Ln(), N = c.useMemo(() => T ?? new nl(), [T]), I = sl(N), L = on(), {
    registerTrigger: A,
    isMountedByThisTrigger: P
  } = Xs(v, S, h, {
    payload: g,
    closeDelay: p,
    parent: E,
    floatingTreeRoot: N,
    floatingNodeId: I,
    floatingParentNodeId: L,
    keyboardEventRelay: C == null ? void 0 : C.relayKeyboardEvent
  }), O = E.type === "menubar", M = h.useState("disabled"), D = i || M || O && E.context.disabled, {
    getButtonProps: _,
    buttonRef: k
  } = nn({
    disabled: D,
    native: a
  });
  c.useEffect(() => {
    !R && E.type === void 0 && (h.context.allowMouseUpTriggerRef.current = false);
  }, [h, R, E.type]);
  const $ = c.useRef(null), F = ht(), z = de((ne) => {
    if (!$.current)
      return;
    F.clear(), h.context.allowMouseUpTriggerRef.current = false;
    const re = ne.target;
    if (Se($.current, re) || Se(h.select("positionerElement"), re) || re === $.current || re != null && Bp(re) === h.select("rootId"))
      return;
    const q = xp($.current);
    ne.clientX >= q.left - Go && ne.clientX <= q.right + Go && ne.clientY >= q.top - Go && ne.clientY <= q.bottom + Go || N.events.emit("close", {
      domEvent: ne,
      reason: nf
    });
  });
  c.useEffect(() => {
    R && h.select("lastOpenChangeReason") === vt && He($.current).addEventListener("mouseup", z, {
      once: true
    });
  }, [R, z, h]);
  const Q = O && E.context.hasSubmenuOpen, G = ml(x, {
    enabled: (f ?? Q) && !D && E.type !== "context-menu" && (!O || Q && !P),
    handleClose: hl({
      blockPointerEvents: !O
    }),
    mouseOnly: true,
    move: false,
    restMs: E.type === void 0 ? u : void 0,
    delay: {
      close: p
    },
    triggerElementRef: S,
    externalTree: N,
    isActiveTrigger: y
  }), j = z0(R, h.select("lastOpenChangeReason")), W = Ys(x, {
    enabled: !D && E.type !== "context-menu",
    event: R && O ? "click" : "mousedown",
    toggle: true,
    ignoreMouse: false,
    stickIfOpen: E.type === void 0 ? j : false
  }), H = cp(x, {
    enabled: !D && Q
  }), te = $0({
    open: R,
    enabled: O,
    mouseDownAction: "open"
  }), J = Fn([W, H]), oe = {
    disabled: D,
    open: R
  }, ae = h.useState("triggerProps", P), ue = [$, r, k, A, S], fe = [J.getReferenceProps(), G ?? ct, ae, {
    "aria-haspopup": "menu",
    id: v,
    onMouseDown: (ne) => {
      if (h.select("open"))
        return;
      F.start(200, () => {
        h.context.allowMouseUpTriggerRef.current = true;
      }), He(ne.currentTarget).addEventListener("mouseup", z, {
        once: true
      });
    }
  }, O ? {
    role: "menuitem"
  } : {}, te, m, _], le = c.useRef(null), se = de((ne) => {
    var _a2;
    Tt.flushSync(() => {
      h.setOpen(false, we(Zt, ne.nativeEvent, ne.currentTarget));
    }), (_a2 = Lf(le.current)) == null ? void 0 : _a2.focus();
  }), me = de((ne) => {
    var _a2;
    const re = h.select("positionerElement");
    if (re && Gn(ne, re))
      (_a2 = h.context.beforeContentFocusGuardRef.current) == null ? void 0 : _a2.focus();
    else {
      Tt.flushSync(() => {
        h.setOpen(false, we(Zt, ne.nativeEvent, ne.currentTarget));
      });
      let q = Af(h.context.triggerFocusTargetRef.current || S.current);
      for (; q !== null && Se(re, q); ) {
        const U = q;
        if (q = Us(q), q === U)
          break;
      }
      q == null ? void 0 : q.focus();
    }
  }), ye = Pe("button", n, {
    enabled: !O,
    stateAttributesMapping: Rs,
    state: oe,
    ref: ue,
    props: fe
  });
  return O ? /* @__PURE__ */ jsx(B0, {
    tag: "button",
    render: o,
    className: s,
    state: oe,
    refs: ue,
    props: fe,
    stateAttributesMapping: Rs
  }) : R ? /* @__PURE__ */ jsxs(c.Fragment, {
    children: [/* @__PURE__ */ jsx(bn, {
      ref: le,
      onFocus: se
    }, `${v}-pre-focus-guard`), /* @__PURE__ */ jsx(c.Fragment, {
      children: ye
    }, v), /* @__PURE__ */ jsx(bn, {
      ref: h.context.triggerFocusTargetRef,
      onFocus: me
    }, `${v}-post-focus-guard`)]
  }) : /* @__PURE__ */ jsx(c.Fragment, {
    children: ye
  }, v);
});
process.env.NODE_ENV !== "production" && ($p.displayName = "MenuTrigger");
function z0(e, n) {
  const r = ht(), [o, s] = c.useState(false);
  return ce(() => {
    e && n === "trigger-hover" ? (s(true), r.start(ef, () => {
      s(false);
    })) : e || (r.clear(), s(false));
  }, [e, n, r]), o;
}
function H0() {
  const e = ii(true), n = tr(true), r = Lp();
  return c.useMemo(() => r ? {
    type: "menubar",
    context: r
  } : e && !n ? {
    type: "context-menu",
    context: e
  } : {
    type: void 0
  }, [e, n, r]);
}
const zp = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (zp.displayName = "CSPContext");
const U0 = {
  disableStyleElements: false
};
function W0() {
  return c.useContext(zp) ?? U0;
}
function Hp(e) {
  const {
    children: n,
    open: r,
    defaultOpen: o = false,
    onOpenChange: s,
    onOpenChangeComplete: i,
    disablePointerDismissal: a = false,
    modal: l = true,
    actionsRef: f,
    handle: u,
    triggerId: p,
    defaultTriggerId: d = null
  } = e, g = _n(true), m = !!g, b = xt(() => (u == null ? void 0 : u.store) ?? new n0({
    open: o,
    openProp: r,
    activeTriggerId: d,
    triggerIdProp: p,
    modal: l,
    disablePointerDismissal: a,
    nested: m
  })).current;
  wo(() => {
    r === void 0 && b.state.open === false && o === true && b.update({
      open: true,
      activeTriggerId: d
    });
  }), b.useControlledProp("openProp", r), b.useControlledProp("triggerIdProp", p), b.useSyncedValues({
    disablePointerDismissal: a,
    nested: m,
    modal: l
  }), b.useContextCallback("onOpenChange", s), b.useContextCallback("onOpenChangeComplete", i);
  const h = b.useState("payload");
  e0({
    store: b,
    actionsRef: f,
    parentContext: g == null ? void 0 : g.store.context
  });
  const v = c.useMemo(() => ({
    store: b
  }), [b]);
  return /* @__PURE__ */ jsx(vl.Provider, {
    value: v,
    children: typeof n == "function" ? n({
      payload: h
    }) : n
  });
}
function Mi(e, n = Number.MIN_SAFE_INTEGER, r = Number.MAX_SAFE_INTEGER) {
  return Math.max(n, Math.min(e, r));
}
const Up = "data-composite-item-active", j0 = [];
function K0(e) {
  const {
    itemSizes: n,
    cols: r = 1,
    loopFocus: o = true,
    dense: s = false,
    orientation: i = "both",
    direction: a,
    highlightedIndex: l,
    onHighlightedIndexChange: f,
    rootRef: u,
    enableHomeAndEndKeys: p = false,
    stopEventPropagation: d = false,
    disabledIndices: g,
    modifierKeys: m = j0
  } = e, [b, h] = c.useState(0), v = r > 1, y = c.useRef(null), x = Wt(y, u), R = c.useRef([]), S = c.useRef(false), E = l ?? b, C = de((I, L = false) => {
    if ((f ?? h)(I), L) {
      const A = R.current[I];
      qc(y.current, A, a, i);
    }
  }), T = de((I) => {
    if (I.size === 0 || S.current)
      return;
    S.current = true;
    const L = Array.from(I.keys()), A = L.find((O) => O == null ? void 0 : O.hasAttribute(Up)) ?? null, P = A ? L.indexOf(A) : -1;
    P !== -1 && C(P), qc(y.current, A, a, i);
  }), N = c.useMemo(() => ({
    "aria-orientation": i === "both" ? void 0 : i,
    ref: x,
    onFocus(I) {
      !y.current || !Yc(I.target) || I.target.setSelectionRange(0, I.target.value.length ?? 0);
    },
    onKeyDown(I) {
      const L = p ? Wy : Vf;
      if (!L.has(I.key) || G0(I, m) || !y.current)
        return;
      const P = a === "rtl", O = P ? no : fr, M = {
        horizontal: O,
        vertical: Wn,
        both: O
      }[i], D = P ? fr : no, _ = {
        horizontal: D,
        vertical: dr,
        both: D
      }[i];
      if (Yc(I.target) && !oy(I.target)) {
        const G = I.target.selectionStart, j = I.target.selectionEnd, W = I.target.value ?? "";
        if (G == null || I.shiftKey || G !== j || I.key !== _ && G < W.length || I.key !== M && G > 0)
          return;
      }
      let k = E;
      const $ = ss(R, g), F = ma(R, g);
      if (v) {
        const G = n || Array.from({
          length: R.current.length
        }, () => ({
          width: 1,
          height: 1
        })), j = wf(G, r, s), W = j.findIndex((te) => te != null && !fn(R, te, g)), H = j.reduce((te, J, oe) => J != null && !fn(R, J, g) ? oe : te, -1);
        k = j[xf({
          current: j.map((te) => te ? R.current[te] : null)
        }, {
          event: I,
          orientation: i,
          loopFocus: o,
          cols: r,
          // treat undefined (empty grid spaces) as disabled indices so we
          // don't end up in them
          disabledIndices: Cf([...g || R.current.map((te, J) => fn(R, J) ? J : void 0), void 0], j),
          minIndex: W,
          maxIndex: H,
          prevIndex: Ef(
            E > F ? $ : E,
            G,
            j,
            r,
            // use a corner matching the edge closest to the direction we're
            // moving in so we don't end up in the same item. Prefer
            // top/left over bottom/right.
            // eslint-disable-next-line no-nested-ternary
            I.key === Wn ? "bl" : I.key === fr ? "tr" : "tl"
          ),
          rtl: P
        })];
      }
      const z = {
        horizontal: [O],
        vertical: [Wn],
        both: [O, Wn]
      }[i], Q = {
        horizontal: [D],
        vertical: [dr],
        both: [D, dr]
      }[i], B = v ? L : {
        horizontal: p ? Hy : Ff,
        vertical: p ? Uy : _f,
        both: L
      }[i];
      p && (I.key === mo ? k = $ : I.key === go && (k = F)), k === E && (z.includes(I.key) || Q.includes(I.key)) && (o && k === F && z.includes(I.key) ? k = $ : o && k === $ && Q.includes(I.key) ? k = F : k = St(R, {
        startingIndex: k,
        decrement: Q.includes(I.key),
        disabledIndices: g
      })), k !== E && !to(R, k) && (d && I.stopPropagation(), B.has(I.key) && I.preventDefault(), C(k, true), queueMicrotask(() => {
        var _a2;
        (_a2 = R.current[k]) == null ? void 0 : _a2.focus();
      }));
    }
  }), [r, s, a, g, R, p, E, v, n, o, x, m, C, i, d]);
  return c.useMemo(() => ({
    props: N,
    highlightedIndex: E,
    onHighlightedIndexChange: C,
    elementsRef: R,
    disabledIndices: g,
    onMapChange: T,
    relayKeyboardEvent: N.onKeyDown
  }), [N, E, C, R, g, T]);
}
function G0(e, n) {
  for (const r of qy.values())
    if (!n.includes(r) && e.getModifierState(r))
      return true;
  return false;
}
function Y0(e) {
  const {
    render: n,
    className: r,
    refs: o = kn,
    props: s = kn,
    state: i = ct,
    stateAttributesMapping: a,
    highlightedIndex: l,
    onHighlightedIndexChange: f,
    orientation: u,
    dense: p,
    itemSizes: d,
    loopFocus: g,
    cols: m,
    enableHomeAndEndKeys: b,
    onMapChange: h,
    stopEventPropagation: v = true,
    rootRef: y,
    disabledIndices: x,
    modifierKeys: R,
    highlightItemOnHover: S = false,
    tag: E = "div",
    ...C
  } = e, T = Ds(), {
    props: N,
    highlightedIndex: I,
    onHighlightedIndexChange: L,
    elementsRef: A,
    onMapChange: P,
    relayKeyboardEvent: O
  } = K0({
    itemSizes: d,
    cols: m,
    loopFocus: g,
    dense: p,
    orientation: u,
    highlightedIndex: l,
    onHighlightedIndexChange: f,
    rootRef: y,
    stopEventPropagation: v,
    enableHomeAndEndKeys: b,
    direction: T,
    disabledIndices: x,
    modifierKeys: R
  }), M = Pe(E, e, {
    state: i,
    ref: o,
    props: [N, ...s, C],
    stateAttributesMapping: a
  }), D = c.useMemo(() => ({
    highlightedIndex: I,
    onHighlightedIndexChange: L,
    highlightItemOnHover: S,
    relayKeyboardEvent: O
  }), [I, L, S, O]);
  return /* @__PURE__ */ jsx(Ka.Provider, {
    value: D,
    children: /* @__PURE__ */ jsx(Ms, {
      elementsRef: A,
      onMapChange: (_) => {
        h == null ? void 0 : h(_), P(_);
      },
      children: M
    })
  });
}
const Mu = /* @__PURE__ */ new Map();
function q0(e, n) {
  const r = JSON.stringify({
    locale: e,
    options: n
  }), o = Mu.get(r);
  if (o)
    return o;
  const s = new Intl.NumberFormat(e, n);
  return Mu.set(r, s), s;
}
function Du(e, n, r) {
  return e == null ? "" : q0(n, r).format(e);
}
function X0(e, n, r) {
  return e == null ? "" : r ? Du(e, n, r) : Du(e / 100, n, {
    style: "percent"
  });
}
function J0(e, n, r) {
  return (e - n) * 100 / (r - n);
}
const Al = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Al.displayName = "PopoverRootContext");
function Co(e) {
  const n = c.useContext(Al);
  if (n === void 0 && !e)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: PopoverRootContext is missing. Popover parts must be placed within <Popover.Root>." : Ze(47));
  return n;
}
({
  disabled: ie((e) => e.disabled),
  instantType: ie((e) => e.instantType),
  openMethod: ie((e) => e.openMethod),
  openChangeReason: ie((e) => e.openChangeReason),
  modal: ie((e) => e.modal),
  stickIfOpen: ie((e) => e.stickIfOpen),
  titleElementId: ie((e) => e.titleElementId),
  descriptionElementId: ie((e) => e.descriptionElementId),
  openOnHover: ie((e) => e.openOnHover),
  closeDelay: ie((e) => e.closeDelay),
  hasViewport: ie((e) => e.hasViewport)
});
const tE = 300, Wp = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    render: o,
    className: s,
    disabled: i = false,
    nativeButton: a = true,
    handle: l,
    payload: f,
    openOnHover: u = false,
    delay: p = tE,
    closeDelay: d = 0,
    id: g,
    ...m
  } = n, b = Co(true), h = (l == null ? void 0 : l.store) ?? (b == null ? void 0 : b.store);
  if (!h)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: <Popover.Trigger> must be either used within a <Popover.Root> component or provided with a handle." : Ze(74));
  const v = Mt(g), y = h.useState("isTriggerActive", v), x = h.useState("floatingRootContext"), R = h.useState("isOpenedByTrigger", v), S = c.useRef(null), {
    registerTrigger: E,
    isMountedByThisTrigger: C
  } = Xs(v, S, h, {
    payload: f,
    disabled: i,
    openOnHover: u,
    closeDelay: d
  }), T = h.useState("openChangeReason"), N = h.useState("stickIfOpen"), I = h.useState("openMethod"), L = ml(x, {
    enabled: x != null && u && (I !== "touch" || T !== Jt),
    mouseOnly: true,
    move: false,
    handleClose: hl(),
    restMs: p,
    delay: {
      close: d
    },
    triggerElementRef: S,
    isActiveTrigger: y
  }), A = Ys(x, {
    enabled: x != null,
    stickIfOpen: N
  }), P = Fn([A]), O = h.useState("triggerProps", C), M = {
    disabled: i,
    open: R
  }, {
    getButtonProps: D,
    buttonRef: _
  } = nn({
    disabled: i,
    native: a
  }), k = c.useMemo(() => ({
    open(B) {
      return B && T === Jt ? Rs.open(B) : oi.open(B);
    }
  }), [T]), $ = Pe("button", n, {
    state: M,
    ref: [_, r, E, S],
    props: [P.getReferenceProps(), L, O, {
      [za]: "",
      id: v
    }, m, D],
    stateAttributesMapping: k
  }), F = c.useRef(null), z = de((B) => {
    var _a2;
    Tt.flushSync(() => {
      h.setOpen(false, we(Zt, B.nativeEvent, B.currentTarget));
    }), (_a2 = Lf(F.current)) == null ? void 0 : _a2.focus();
  }), Q = de((B) => {
    var _a2;
    const G = h.select("positionerElement");
    if (G && Gn(B, G))
      (_a2 = h.context.beforeContentFocusGuardRef.current) == null ? void 0 : _a2.focus();
    else {
      Tt.flushSync(() => {
        h.setOpen(false, we(Zt, B.nativeEvent, B.currentTarget));
      });
      let j = Af(h.context.triggerFocusTargetRef.current || S.current);
      for (; j !== null && Se(G, j); ) {
        const W = j;
        if (j = Us(j), j === W)
          break;
      }
      j == null ? void 0 : j.focus();
    }
  });
  return y ? /* @__PURE__ */ jsxs(c.Fragment, {
    children: [/* @__PURE__ */ jsx(bn, {
      ref: F,
      onFocus: z
    }), /* @__PURE__ */ jsx(c.Fragment, {
      children: $
    }, v), /* @__PURE__ */ jsx(bn, {
      ref: h.context.triggerFocusTargetRef,
      onFocus: Q
    })]
  }) : /* @__PURE__ */ jsx(c.Fragment, {
    children: $
  }, v);
});
process.env.NODE_ENV !== "production" && (Wp.displayName = "PopoverTrigger");
const Fl = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Fl.displayName = "PopoverPortalContext");
function nE() {
  const e = c.useContext(Fl);
  if (e === void 0)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: <Popover.Portal> is missing." : Ze(45));
  return e;
}
const jp = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    keepMounted: o = false,
    ...s
  } = n, {
    store: i
  } = Co();
  return i.useState("mounted") || o ? /* @__PURE__ */ jsx(Fl.Provider, {
    value: o,
    children: /* @__PURE__ */ jsx(ho, {
      ref: r,
      ...s
    })
  }) : null;
});
process.env.NODE_ENV !== "production" && (jp.displayName = "PopoverPortal");
const _l = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (_l.displayName = "PopoverPositionerContext");
function rE() {
  const e = c.useContext(_l);
  if (!e)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: PopoverPositionerContext is missing. PopoverPositioner parts must be placed within <Popover.Positioner>." : Ze(46));
  return e;
}
const Kp = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    render: o,
    className: s,
    anchor: i,
    positionMethod: a = "absolute",
    side: l = "bottom",
    align: f = "center",
    sideOffset: u = 0,
    alignOffset: p = 0,
    collisionBoundary: d = "clipping-ancestors",
    collisionPadding: g = 5,
    arrowPadding: m = 5,
    sticky: b = false,
    disableAnchorTracking: h = false,
    collisionAvoidance: v = Ha,
    ...y
  } = n, {
    store: x
  } = Co(), R = nE(), S = sl(), E = x.useState("floatingRootContext"), C = x.useState("mounted"), T = x.useState("open"), N = x.useState("openChangeReason"), I = x.useState("activeTriggerElement"), L = x.useState("modal"), A = x.useState("positionerElement"), P = x.useState("instantType"), O = x.useState("transitionStatus"), M = x.useState("hasViewport"), D = c.useRef(null), _ = Fs(A, false, false), k = si({
    anchor: i,
    floatingRootContext: E,
    positionMethod: a,
    mounted: C,
    side: l,
    sideOffset: u,
    align: f,
    alignOffset: p,
    arrowPadding: m,
    collisionBoundary: d,
    collisionPadding: g,
    sticky: b,
    disableAnchorTracking: h,
    keepMounted: R,
    nodeId: S,
    collisionAvoidance: v,
    adaptiveOrigin: M ? kl : void 0
  }), $ = c.useMemo(() => {
    const j = {};
    return T || (j.pointerEvents = "none"), {
      role: "presentation",
      hidden: !C,
      style: {
        ...k.positionerStyles,
        ...j
      }
    };
  }, [T, C, k.positionerStyles]), F = c.useMemo(() => ({
    props: $,
    ...k
  }), [$, k]), z = E.useState("domReferenceElement");
  ce(() => {
    const j = z, W = D.current;
    if (j && (D.current = j), W && j && j !== W) {
      x.set("instantType", void 0);
      const H = new AbortController();
      return _(() => {
        x.set("instantType", "trigger-change");
      }, H.signal), () => {
        H.abort();
      };
    }
  }, [z, _, x]);
  const Q = {
    open: T,
    side: F.side,
    align: F.align,
    anchorHidden: F.anchorHidden,
    instant: P
  }, B = c.useCallback((j) => {
    x.set("positionerElement", j);
  }, [x]), G = Pe("div", n, {
    state: Q,
    props: [F.props, Vn(O), y],
    ref: [r, B],
    stateAttributesMapping: sn
  });
  return /* @__PURE__ */ jsxs(_l.Provider, {
    value: F,
    children: [C && L === true && N !== vt && /* @__PURE__ */ jsx(xo, {
      ref: x.context.internalBackdropRef,
      inert: yo(!T),
      cutout: I
    }), /* @__PURE__ */ jsx(Kf, {
      id: S,
      children: G
    })]
  });
});
process.env.NODE_ENV !== "production" && (Kp.displayName = "PopoverPositioner");
const Gp = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Gp.displayName = "ClosePartContext");
function oE() {
  const [e, n] = c.useState(0), r = de(() => (n((s) => s + 1), () => {
    n((s) => Math.max(0, s - 1));
  }));
  return {
    context: c.useMemo(() => ({
      register: r
    }), [r]),
    hasClosePart: e > 0
  };
}
function sE(e) {
  const {
    value: n,
    children: r
  } = e;
  return /* @__PURE__ */ jsx(Gp.Provider, {
    value: n,
    children: r
  });
}
const iE = {
  ...sn,
  ...en
}, Yp = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    className: o,
    render: s,
    initialFocus: i,
    finalFocus: a,
    ...l
  } = n, {
    store: f
  } = Co(), u = rE(), p = Pl() != null, {
    context: d,
    hasClosePart: g
  } = oE(), m = f.useState("open"), b = f.useState("openMethod"), h = f.useState("instantType"), v = f.useState("transitionStatus"), y = f.useState("popupProps"), x = f.useState("titleElementId"), R = f.useState("descriptionElementId"), S = f.useState("modal"), E = f.useState("mounted"), C = f.useState("openChangeReason"), T = f.useState("activeTriggerElement"), N = f.useState("floatingRootContext");
  rn({
    open: m,
    ref: f.context.popupRef,
    onComplete() {
      var _a2, _b2;
      m && ((_b2 = (_a2 = f.context).onOpenChangeComplete) == null ? void 0 : _b2.call(_a2, true));
    }
  });
  const I = f.useState("disabled"), L = f.useState("openOnHover"), A = f.useState("closeDelay");
  pl(N, {
    enabled: L && !I,
    closeDelay: A
  });
  function P($) {
    return $ === "touch" ? f.context.popupRef.current : true;
  }
  const O = i === void 0 ? P : i, M = {
    open: m,
    side: u.side,
    align: u.align,
    instant: h,
    transitionStatus: v
  }, D = S !== false && g, _ = c.useCallback(($) => {
    f.set("popupElement", $);
  }, [f]), k = Pe("div", n, {
    state: M,
    ref: [r, f.context.popupRef, _],
    props: [y, {
      "aria-labelledby": x,
      "aria-describedby": R,
      onKeyDown($) {
        p && Ws.has($.key) && $.stopPropagation();
      }
    }, Vn(v), l],
    stateAttributesMapping: iE
  });
  return /* @__PURE__ */ jsx(Gs, {
    context: N,
    openInteractionType: b,
    modal: D,
    disabled: !E || C === vt,
    initialFocus: O,
    returnFocus: a,
    restoreFocus: "popup",
    previousFocusableElement: st(T) ? T : void 0,
    nextFocusableElement: f.context.triggerFocusTargetRef,
    beforeContentFocusGuardRef: f.context.beforeContentFocusGuardRef,
    children: /* @__PURE__ */ jsx(sE, {
      value: d,
      children: k
    })
  });
});
process.env.NODE_ENV !== "production" && (Yp.displayName = "PopoverPopup");
const qp = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    children: o,
    container: s,
    className: i,
    render: a,
    ...l
  } = n, {
    portalNode: f,
    portalSubtree: u
  } = Wf({
    container: s,
    ref: r,
    componentProps: n,
    elementProps: l
  });
  return !u && !f ? null : /* @__PURE__ */ jsxs(c.Fragment, {
    children: [u, f && /* @__PURE__ */ Tt.createPortal(o, f)]
  });
});
process.env.NODE_ENV !== "production" && (qp.displayName = "FloatingPortalLite");
const Vl = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Vl.displayName = "ProgressRootContext");
function Xp() {
  const e = c.useContext(Vl);
  if (e === void 0)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: ProgressRootContext is missing. Progress parts must be placed within <Progress.Root>." : Ze(51));
  return e;
}
let Di = /* @__PURE__ */ (function(e) {
  return e.complete = "data-complete", e.indeterminate = "data-indeterminate", e.progressing = "data-progressing", e;
})({});
const Bl = {
  status(e) {
    return e === "progressing" ? {
      [Di.progressing]: ""
    } : e === "complete" ? {
      [Di.complete]: ""
    } : e === "indeterminate" ? {
      [Di.indeterminate]: ""
    } : null;
  }
};
function aE(e, n) {
  return n == null ? "indeterminate progress" : e || `${n}%`;
}
const Jp = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    format: o,
    getAriaValueText: s = aE,
    locale: i,
    max: a = 100,
    min: l = 0,
    value: f,
    render: u,
    className: p,
    children: d,
    ...g
  } = n, [m, b] = c.useState(), h = yt(o);
  let v = "indeterminate";
  Number.isFinite(f) && (v = f === a ? "complete" : "progressing");
  const y = X0(f, i, h.current), x = c.useMemo(() => ({
    status: v
  }), [v]), R = {
    "aria-labelledby": m,
    "aria-valuemax": a,
    "aria-valuemin": l,
    "aria-valuenow": f ?? void 0,
    "aria-valuetext": s(y, f),
    role: "progressbar",
    children: /* @__PURE__ */ jsxs(c.Fragment, {
      children: [d, /* @__PURE__ */ jsx("span", {
        role: "presentation",
        style: Ks,
        children: "x"
      })]
    })
  }, S = c.useMemo(() => ({
    formattedValue: y,
    max: a,
    min: l,
    setLabelId: b,
    state: x,
    status: v,
    value: f
  }), [y, a, l, b, x, v, f]), E = Pe("div", n, {
    state: x,
    ref: r,
    props: [R, g],
    stateAttributesMapping: Bl
  });
  return /* @__PURE__ */ jsx(Vl.Provider, {
    value: S,
    children: E
  });
});
process.env.NODE_ENV !== "production" && (Jp.displayName = "ProgressRoot");
const Zp = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    render: o,
    className: s,
    ...i
  } = n, {
    state: a
  } = Xp();
  return Pe("div", n, {
    state: a,
    ref: r,
    props: i,
    stateAttributesMapping: Bl
  });
});
process.env.NODE_ENV !== "production" && (Zp.displayName = "ProgressTrack");
const Qp = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    render: o,
    className: s,
    ...i
  } = n, {
    max: a,
    min: l,
    value: f,
    state: u
  } = Xp(), p = Number.isFinite(f) && f !== null ? J0(f, l, a) : null, d = c.useCallback(() => p == null ? {} : {
    insetInlineStart: 0,
    height: "inherit",
    width: `${p}%`
  }, [p]);
  return Pe("div", n, {
    state: u,
    ref: r,
    props: [{
      style: d()
    }, i],
    stateAttributesMapping: Bl
  });
});
process.env.NODE_ENV !== "production" && (Qp.displayName = "ProgressIndicator");
const Yo = "base-ui-disable-scrollbar", Ea = {
  className: Yo,
  getElement(e) {
    return /* @__PURE__ */ jsx("style", {
      nonce: e,
      href: Yo,
      precedence: "base-ui:low",
      children: `.${Yo}{scrollbar-width:none}.${Yo}::-webkit-scrollbar{display:none}`
    });
  }
};
process.env.NODE_ENV !== "production" && (Ea.getElement.displayName = "styleDisableScrollbar.getElement");
const $l = /* @__PURE__ */ c.createContext(null);
process.env.NODE_ENV !== "production" && ($l.displayName = "SelectRootContext");
const zl = /* @__PURE__ */ c.createContext(null);
process.env.NODE_ENV !== "production" && (zl.displayName = "SelectFloatingContext");
function Bn() {
  const e = c.useContext($l);
  if (e === null)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: SelectRootContext is missing. Select parts must be placed within <Select.Root>." : Ze(60));
  return e;
}
function em() {
  const e = c.useContext(zl);
  if (e === null)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: SelectFloatingContext is missing. Select parts must be placed within <Select.Root>." : Ze(61));
  return e;
}
const Te = {
  id: ie((e) => e.id),
  labelId: ie((e) => e.labelId),
  modal: ie((e) => e.modal),
  multiple: ie((e) => e.multiple),
  items: ie((e) => e.items),
  itemToStringLabel: ie((e) => e.itemToStringLabel),
  itemToStringValue: ie((e) => e.itemToStringValue),
  isItemEqualToValue: ie((e) => e.isItemEqualToValue),
  value: ie((e) => e.value),
  hasSelectedValue: ie((e) => {
    const {
      value: n,
      multiple: r,
      itemToStringValue: o
    } = e;
    return n == null ? false : r && Array.isArray(n) ? n.length > 0 : ar(n, o) !== "";
  }),
  hasNullItemLabel: ie((e, n) => n ? b0(e.items) : false),
  open: ie((e) => e.open),
  mounted: ie((e) => e.mounted),
  forceMount: ie((e) => e.forceMount),
  transitionStatus: ie((e) => e.transitionStatus),
  openMethod: ie((e) => e.openMethod),
  activeIndex: ie((e) => e.activeIndex),
  selectedIndex: ie((e) => e.selectedIndex),
  isActive: ie((e, n) => e.activeIndex === n),
  isSelected: ie((e, n, r) => {
    const o = e.isItemEqualToValue, s = e.value;
    return e.multiple ? Array.isArray(s) && s.some((i) => yr(r, i, o)) : e.selectedIndex === n && e.selectedIndex !== null ? true : yr(r, s, o);
  }),
  isSelectedByFocus: ie((e, n) => e.selectedIndex === n),
  popupProps: ie((e) => e.popupProps),
  triggerProps: ie((e) => e.triggerProps),
  triggerElement: ie((e) => e.triggerElement),
  positionerElement: ie((e) => e.positionerElement),
  listElement: ie((e) => e.listElement),
  scrollUpArrowVisible: ie((e) => e.scrollUpArrowVisible),
  scrollDownArrowVisible: ie((e) => e.scrollDownArrowVisible),
  hasScrollArrows: ie((e) => e.hasScrollArrows)
};
function lE(e) {
  const {
    id: n,
    value: r,
    defaultValue: o = null,
    onValueChange: s,
    open: i,
    defaultOpen: a = false,
    onOpenChange: l,
    name: f,
    autoComplete: u,
    disabled: p = false,
    readOnly: d = false,
    required: g = false,
    modal: m = true,
    actionsRef: b,
    inputRef: h,
    onOpenChangeComplete: v,
    items: y,
    multiple: x = false,
    itemToStringLabel: R,
    itemToStringValue: S,
    isItemEqualToValue: E = m0,
    highlightItemOnHover: C = true,
    children: T
  } = e, {
    clearErrors: N
  } = Rl(), {
    setDirty: I,
    setTouched: L,
    setFocused: A,
    shouldValidateOnChange: P,
    validityData: O,
    setFilled: M,
    name: D,
    disabled: _,
    validation: k,
    validationMode: $
  } = Eo(), F = Tl({
    id: n
  }), z = _ || p, Q = D ?? f, [B, G] = Xr({
    controlled: r,
    default: x ? o ?? kn : o,
    name: "Select",
    state: "value"
  }), [j, W] = Xr({
    controlled: i,
    default: a,
    name: "Select",
    state: "open"
  }), H = c.useRef([]), te = c.useRef([]), J = c.useRef(null), oe = c.useRef(null), ae = c.useRef(0), ue = c.useRef(null), fe = c.useRef([]), le = c.useRef(false), se = c.useRef(false), me = c.useRef(null), ye = c.useRef({
    allowSelectedMouseUp: false,
    allowUnselectedMouseUp: false
  }), ne = c.useRef(false), {
    mounted: re,
    setMounted: q,
    transitionStatus: U
  } = uo(j), {
    openMethod: V,
    triggerProps: Y
  } = ri(j), ee = xt(() => new ap({
    id: F,
    labelId: void 0,
    modal: m,
    multiple: x,
    itemToStringLabel: R,
    itemToStringValue: S,
    isItemEqualToValue: E,
    value: B,
    open: j,
    mounted: re,
    transitionStatus: U,
    items: y,
    forceMount: false,
    openMethod: null,
    activeIndex: null,
    selectedIndex: null,
    popupProps: {},
    triggerProps: {},
    triggerElement: null,
    positionerElement: null,
    listElement: null,
    scrollUpArrowVisible: false,
    scrollDownArrowVisible: false,
    hasScrollArrows: false
  })).current, he = ke(ee, Te.activeIndex), Me = ke(ee, Te.selectedIndex), Ue = ke(ee, Te.triggerElement), Le = ke(ee, Te.positionerElement), _e = c.useMemo(() => x && Array.isArray(B) && B.length === 0 ? "" : ar(B, S), [x, B, S]), xe = c.useMemo(() => x && Array.isArray(B) ? B.map((ge) => ar(ge, S)) : ar(B, S), [x, B, S]), Ee = yt(ee.state.triggerElement);
  vp({
    id: F,
    commit: k.commit,
    value: B,
    controlRef: Ee,
    name: Q,
    getValue: () => xe
  });
  const Re = c.useRef(B);
  ce(() => {
    B !== Re.current && ee.set("forceMount", true);
  }, [ee, B]), ce(() => {
    M(x ? Array.isArray(B) && B.length > 0 : B != null);
  }, [x, B, M]), ce(function() {
    if (j)
      return;
    const Oe = fe.current;
    if (x) {
      const ze = Array.isArray(B) ? B : [];
      if (ze.length === 0) {
        ee.set("selectedIndex", null);
        return;
      }
      const et = ze[ze.length - 1], at = Ur(Oe, et, E);
      ee.set("selectedIndex", at === -1 ? null : at);
      return;
    }
    const Fe = Ur(Oe, B, E);
    ee.set("selectedIndex", Fe === -1 ? null : Fe);
  }, [x, j, B, fe, E, ee]), bl(B, () => {
    N(Q), I(B !== O.initialValue), P() ? k.commit(B) : k.commit(B, true);
  });
  const We = de((ge, Oe) => {
    if (l == null ? void 0 : l(ge, Oe), !Oe.isCanceled && (W(ge), !ge && (Oe.reason === Zt || Oe.reason === As) && (L(true), A(false), $ === "onBlur" && k.commit(B)), !ge && ee.state.activeIndex !== null)) {
      const Fe = H.current[ee.state.activeIndex];
      queueMicrotask(() => {
        Fe == null ? void 0 : Fe.setAttribute("tabindex", "-1");
      });
    }
  }), Ce = de(() => {
    q(false), ee.set("activeIndex", null), v == null ? void 0 : v(false);
  });
  rn({
    enabled: !b,
    open: j,
    ref: J,
    onComplete() {
      j || Ce();
    }
  }), c.useImperativeHandle(b, () => ({
    unmount: Ce
  }), [Ce]);
  const Ie = de((ge, Oe) => {
    s == null ? void 0 : s(ge, Oe), !Oe.isCanceled && G(ge);
  }), je = de(() => {
    const ge = ee.state.listElement || J.current;
    if (!ge)
      return;
    const Oe = ge.scrollTop, Fe = ge.scrollTop + ge.clientHeight, ze = Oe > 1, et = Fe < ge.scrollHeight - 1;
    ee.state.scrollUpArrowVisible !== ze && ee.set("scrollUpArrowVisible", ze), ee.state.scrollDownArrowVisible !== et && ee.set("scrollDownArrowVisible", et);
  }), lt = lp({
    open: j,
    onOpenChange: We,
    elements: {
      reference: Ue,
      floating: Le
    }
  }), Ne = Ys(lt, {
    enabled: !d && !z,
    event: "mousedown"
  }), Ye = bo(lt, {
    bubbles: false
  }), qe = dp(lt, {
    enabled: !d && !z,
    listRef: H,
    activeIndex: he,
    selectedIndex: Me,
    disabledIndices: kn,
    onNavigate(ge) {
      ge === null && !j || ee.set("activeIndex", ge);
    },
    // Implement our own listeners since `onPointerLeave` on each option fires while scrolling with
    // the `alignItemWithTrigger=true`, causing a performance issue on Chrome.
    focusItemOnHover: false
  }), rt = fp(lt, {
    enabled: !d && !z && (j || !x),
    listRef: te,
    activeIndex: he,
    selectedIndex: Me,
    onMatch(ge) {
      j ? ee.set("activeIndex", ge) : Ie(fe.current[ge], we("none"));
    },
    onTypingChange(ge) {
      le.current = ge;
    }
  }), {
    getReferenceProps: Qe,
    getFloatingProps: De,
    getItemProps: Ge
  } = Fn([Ne, Ye, qe, rt]), pe = c.useMemo(() => Tn(Qe(), Y, F ? {
    id: F
  } : ct), [Qe, Y, F]);
  wo(() => {
    ee.update({
      popupProps: De(),
      triggerProps: pe
    });
  }), ce(() => {
    ee.update({
      id: F,
      modal: m,
      multiple: x,
      value: B,
      open: j,
      mounted: re,
      transitionStatus: U,
      popupProps: De(),
      triggerProps: pe,
      items: y,
      itemToStringLabel: R,
      itemToStringValue: S,
      isItemEqualToValue: E,
      openMethod: V
    });
  }, [ee, F, m, x, B, j, re, U, De, pe, y, R, S, E, V]);
  const Be = c.useMemo(() => ({
    store: ee,
    name: Q,
    required: g,
    disabled: z,
    readOnly: d,
    multiple: x,
    itemToStringLabel: R,
    itemToStringValue: S,
    highlightItemOnHover: C,
    setValue: Ie,
    setOpen: We,
    listRef: H,
    popupRef: J,
    scrollHandlerRef: oe,
    handleScrollArrowVisibility: je,
    scrollArrowsMountedCountRef: ae,
    getItemProps: Ge,
    events: lt.context.events,
    valueRef: ue,
    valuesRef: fe,
    labelsRef: te,
    typingRef: le,
    selectionRef: ye,
    selectedItemTextRef: me,
    validation: k,
    onOpenChangeComplete: v,
    keyboardActiveRef: se,
    alignItemWithTriggerActiveRef: ne,
    initialValueRef: Re
  }), [ee, Q, g, z, d, x, R, S, C, Ie, We, Ge, lt.context.events, k, v, je]), Ve = Wt(h, k.inputRef), $e = x && Array.isArray(B) && B.length > 0, ot = x ? void 0 : Q, Xe = c.useMemo(() => !x || !Array.isArray(B) || !Q ? null : B.map((ge) => {
    const Oe = ar(ge, S);
    return /* @__PURE__ */ jsx("input", {
      type: "hidden",
      name: Q,
      value: Oe
    }, Oe);
  }), [x, B, Q, S]);
  return /* @__PURE__ */ jsx($l.Provider, {
    value: Be,
    children: /* @__PURE__ */ jsxs(zl.Provider, {
      value: lt,
      children: [T, /* @__PURE__ */ jsx("input", {
        ...k.getInputValidationProps({
          onFocus() {
            var _a2;
            (_a2 = ee.state.triggerElement) == null ? void 0 : _a2.focus({
              // Supported in Chrome from 144 (January 2026)
              // @ts-expect-error - focusVisible is not yet in the lib.dom.d.ts
              focusVisible: true
            });
          },
          // Handle browser autofill.
          onChange(ge) {
            if (ge.nativeEvent.defaultPrevented)
              return;
            const Oe = ge.target.value, Fe = we(mn, ge.nativeEvent);
            function ze() {
              if (x)
                return;
              const et = fe.current.find((at) => ar(at, S).toLowerCase() === Oe.toLowerCase());
              et != null && (I(et !== O.initialValue), Ie(et, Fe), P() && k.commit(et));
            }
            ee.set("forceMount", true), queueMicrotask(ze);
          }
        }),
        id: F && ot == null ? `${F}-hidden-input` : void 0,
        name: ot,
        autoComplete: u,
        value: _e,
        disabled: z,
        required: g && !$e,
        readOnly: d,
        ref: Ve,
        style: Q ? zf : Ks,
        tabIndex: -1,
        "aria-hidden": true
      }), Xe]
    })
  });
}
const qo = 2, cE = 400, Lu = 200, uE = {
  ...Rs,
  ...gp,
  value: () => null
}, tm = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    render: o,
    className: s,
    id: i,
    disabled: a = false,
    nativeButton: l = true,
    ...f
  } = n, {
    setTouched: u,
    setFocused: p,
    validationMode: d,
    state: g,
    disabled: m
  } = Eo(), {
    labelId: b
  } = Nl(), {
    store: h,
    setOpen: v,
    selectionRef: y,
    validation: x,
    readOnly: R,
    required: S,
    alignItemWithTriggerActiveRef: E,
    disabled: C,
    keyboardActiveRef: T
  } = Bn(), N = m || C || a, I = ke(h, Te.open), L = ke(h, Te.value), A = ke(h, Te.triggerProps), P = ke(h, Te.positionerElement), O = ke(h, Te.listElement), M = ke(h, Te.id), D = ke(h, Te.labelId), _ = ke(h, Te.hasSelectedValue), k = !_ && I, $ = ke(h, Te.hasNullItemLabel, k), F = i ?? M, z = C0(b, D);
  Tl({
    id: F
  });
  const Q = yt(P), B = c.useRef(null), {
    getButtonProps: G,
    buttonRef: j
  } = nn({
    disabled: N,
    native: l
  }), W = de((se) => {
    h.set("triggerElement", se);
  }), H = Wt(r, B, j, W), te = ht(), J = ht(), oe = ht(), ae = ht();
  c.useEffect(() => {
    if (I)
      return !(_ || $) ? oe.start(cE, () => {
        y.current.allowUnselectedMouseUp = true, y.current.allowSelectedMouseUp = true;
      }) : ae.start(Lu, () => {
        y.current.allowUnselectedMouseUp = true, oe.start(Lu, () => {
          y.current.allowSelectedMouseUp = true;
        });
      }), () => {
        oe.clear(), ae.clear();
      };
    y.current = {
      allowSelectedMouseUp: false,
      allowUnselectedMouseUp: false
    }, J.clear();
  }, [I, _, $, y, J, oe, ae]);
  const ue = c.useMemo(() => {
    var _a2;
    return (O == null ? void 0 : O.id) ?? ((_a2 = Qr(P)) == null ? void 0 : _a2.id);
  }, [O, P]), fe = Tn(A, {
    id: F,
    role: "combobox",
    "aria-expanded": I ? "true" : "false",
    "aria-haspopup": "listbox",
    "aria-controls": I ? ue : void 0,
    "aria-labelledby": z,
    "aria-readonly": R || void 0,
    "aria-required": S || void 0,
    tabIndex: N ? -1 : 0,
    ref: H,
    onFocus(se) {
      p(true), I && E.current && v(false, we(mn, se.nativeEvent)), te.start(0, () => {
        h.set("forceMount", true);
      });
    },
    onBlur(se) {
      Se(P, se.relatedTarget) || (u(true), p(false), d === "onBlur" && x.commit(L));
    },
    onPointerMove() {
      T.current = false;
    },
    onKeyDown() {
      T.current = true;
    },
    onMouseDown(se) {
      if (I)
        return;
      const me = He(se.currentTarget);
      function ye(ne) {
        if (!B.current)
          return;
        const re = ne.target;
        if (Se(B.current, re) || Se(Q.current, re) || re === B.current)
          return;
        const q = xp(B.current);
        ne.clientX >= q.left - qo && ne.clientX <= q.right + qo && ne.clientY >= q.top - qo && ne.clientY <= q.bottom + qo || v(false, we(nf, ne));
      }
      J.start(0, () => {
        me.addEventListener("mouseup", ye, {
          once: true
        });
      });
    }
  }, x.getValidationProps, f, G);
  fe.role = "combobox";
  const le = {
    ...g,
    open: I,
    disabled: N,
    value: L,
    readOnly: R,
    placeholder: !_
  };
  return Pe("button", n, {
    ref: [r, B],
    state: le,
    stateAttributesMapping: uE,
    props: fe
  });
});
process.env.NODE_ENV !== "production" && (tm.displayName = "SelectTrigger");
const dE = {
  value: () => null
}, nm = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    className: o,
    render: s,
    children: i,
    placeholder: a,
    ...l
  } = n, {
    store: f,
    valueRef: u
  } = Bn(), p = ke(f, Te.value), d = ke(f, Te.items), g = ke(f, Te.itemToStringLabel), m = ke(f, Te.hasSelectedValue), b = !m && a != null && i == null, h = ke(f, Te.hasNullItemLabel, b), v = {
    value: p,
    placeholder: !m
  };
  let y = null;
  return typeof i == "function" ? y = i(p) : i != null ? y = i : !m && a != null && !h ? y = a : Array.isArray(p) ? y = y0(p, d, g) : y = mp(p, d, g), Pe("span", n, {
    state: v,
    ref: [r, u],
    props: [{
      children: y
    }, l],
    stateAttributesMapping: dE
  });
});
process.env.NODE_ENV !== "production" && (nm.displayName = "SelectValue");
const rm = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    className: o,
    render: s,
    ...i
  } = n, {
    store: a
  } = Bn(), f = {
    open: ke(a, Te.open)
  };
  return Pe("span", n, {
    state: f,
    ref: r,
    props: [{
      "aria-hidden": true,
      children: "▼"
    }, i],
    stateAttributesMapping: oi
  });
});
process.env.NODE_ENV !== "production" && (rm.displayName = "SelectIcon");
const om = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (om.displayName = "SelectPortalContext");
const sm = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    store: o
  } = Bn(), s = ke(o, Te.mounted), i = ke(o, Te.forceMount);
  return s || i ? /* @__PURE__ */ jsx(om.Provider, {
    value: true,
    children: /* @__PURE__ */ jsx(ho, {
      ref: r,
      ...n
    })
  }) : null;
});
process.env.NODE_ENV !== "production" && (sm.displayName = "SelectPortal");
const Hl = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Hl.displayName = "SelectPositionerContext");
function fE() {
  const e = c.useContext(Hl);
  if (!e)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: SelectPositionerContext is missing. SelectPositioner parts must be placed within <Select.Positioner>." : Ze(59));
  return e;
}
function Ns(e, n) {
  e && Object.assign(e.style, n);
}
const pE = {
  position: "relative",
  maxHeight: "100%",
  overflowX: "hidden",
  overflowY: "auto"
}, mE = {
  position: "fixed"
}, im = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    anchor: o,
    positionMethod: s = "absolute",
    className: i,
    render: a,
    side: l = "bottom",
    align: f = "center",
    sideOffset: u = 0,
    alignOffset: p = 0,
    collisionBoundary: d = "clipping-ancestors",
    collisionPadding: g,
    arrowPadding: m = 5,
    sticky: b = false,
    disableAnchorTracking: h,
    alignItemWithTrigger: v = true,
    collisionAvoidance: y = tf,
    ...x
  } = n, {
    store: R,
    listRef: S,
    labelsRef: E,
    alignItemWithTriggerActiveRef: C,
    selectedItemTextRef: T,
    valuesRef: N,
    initialValueRef: I,
    popupRef: L,
    setValue: A
  } = Bn(), P = em(), O = ke(R, Te.open), M = ke(R, Te.mounted), D = ke(R, Te.modal), _ = ke(R, Te.value), k = ke(R, Te.openMethod), $ = ke(R, Te.positionerElement), F = ke(R, Te.triggerElement), z = ke(R, Te.isItemEqualToValue), Q = ke(R, Te.transitionStatus), B = c.useRef(null), G = c.useRef(null), [j, W] = c.useState(v), H = M && j && k !== "touch";
  !M && j !== v && W(v), ce(() => {
    M || (Te.scrollUpArrowVisible(R.state) && R.set("scrollUpArrowVisible", false), Te.scrollDownArrowVisible(R.state) && R.set("scrollDownArrowVisible", false));
  }, [R, M]), c.useImperativeHandle(C, () => H), js((H || D) && O && k !== "touch", F);
  const te = si({
    anchor: o,
    floatingRootContext: P,
    positionMethod: s,
    mounted: M,
    side: l,
    sideOffset: u,
    align: f,
    alignOffset: p,
    arrowPadding: m,
    collisionBoundary: d,
    collisionPadding: g,
    sticky: b,
    disableAnchorTracking: h ?? H,
    collisionAvoidance: y,
    keepMounted: true
  }), J = H ? "none" : te.side, oe = H ? mE : te.positionerStyles, ae = c.useMemo(() => {
    const ne = {};
    return O || (ne.pointerEvents = "none"), {
      role: "presentation",
      hidden: !M,
      style: {
        ...oe,
        ...ne
      }
    };
  }, [O, M, oe]), ue = {
    open: O,
    side: J,
    align: te.align,
    anchorHidden: te.anchorHidden
  }, fe = de((ne) => {
    R.set("positionerElement", ne);
  }), le = Pe("div", n, {
    ref: [r, fe],
    state: ue,
    stateAttributesMapping: sn,
    props: [ae, Vn(Q), x]
  }), se = c.useRef(0), me = de((ne) => {
    if (ne.size === 0 && se.current === 0 || N.current.length === 0)
      return;
    const re = se.current;
    if (se.current = ne.size, ne.size === re)
      return;
    const q = we(mn);
    if (re !== 0 && !R.state.multiple && _ !== null && Ur(N.current, _, z) === -1) {
      const V = I.current, ee = V != null && Ur(N.current, V, z) !== -1 ? V : null;
      A(ee, q), ee === null && (R.set("selectedIndex", null), T.current = null);
    }
    if (re !== 0 && R.state.multiple && Array.isArray(_)) {
      const U = (Y) => Ur(N.current, Y, z) !== -1, V = _.filter((Y) => U(Y));
      (V.length !== _.length || V.some((Y) => !g0(_, Y, z))) && (A(V, q), V.length === 0 && (R.set("selectedIndex", null), T.current = null));
    }
    if (O && H) {
      R.update({
        scrollUpArrowVisible: false,
        scrollDownArrowVisible: false
      });
      const U = {
        height: ""
      };
      Ns($, U), Ns(L.current, U);
    }
  }), ye = c.useMemo(() => ({
    ...te,
    side: J,
    alignItemWithTriggerActive: H,
    setControlledAlignItemWithTrigger: W,
    scrollUpArrowRef: B,
    scrollDownArrowRef: G
  }), [te, J, H, W]);
  return /* @__PURE__ */ jsx(Ms, {
    elementsRef: S,
    labelsRef: E,
    onMapChange: me,
    children: /* @__PURE__ */ jsxs(Hl.Provider, {
      value: ye,
      children: [M && D && /* @__PURE__ */ jsx(xo, {
        inert: yo(!O),
        cutout: F
      }), le]
    })
  });
});
process.env.NODE_ENV !== "production" && (im.displayName = "SelectPositioner");
function am(e) {
  const n = e.currentTarget.getBoundingClientRect();
  return n.top + 1 <= e.clientY && e.clientY <= n.bottom - 1 && n.left + 1 <= e.clientX && e.clientX <= n.right - 1;
}
const ln = 1, gE = {
  ...sn,
  ...en
}, lm = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    render: o,
    className: s,
    finalFocus: i,
    ...a
  } = n, {
    store: l,
    popupRef: f,
    onOpenChangeComplete: u,
    setOpen: p,
    valueRef: d,
    selectedItemTextRef: g,
    keyboardActiveRef: m,
    multiple: b,
    handleScrollArrowVisibility: h,
    scrollHandlerRef: v,
    highlightItemOnHover: y
  } = Bn(), {
    side: x,
    align: R,
    alignItemWithTriggerActive: S,
    setControlledAlignItemWithTrigger: E,
    scrollDownArrowRef: C,
    scrollUpArrowRef: T
  } = fE(), N = Pl() != null, I = em(), {
    nonce: L,
    disableStyleElements: A
  } = W0(), P = ht(), O = ke(l, Te.id), M = ke(l, Te.open), D = ke(l, Te.mounted), _ = ke(l, Te.popupProps), k = ke(l, Te.transitionStatus), $ = ke(l, Te.triggerElement), F = ke(l, Te.positionerElement), z = ke(l, Te.listElement), Q = c.useRef(0), B = c.useRef(false), G = c.useRef(0), j = c.useRef(false), W = c.useRef({}), H = co(), te = de((ue) => {
    if (!F || !f.current || !j.current)
      return;
    if (B.current || !S) {
      h();
      return;
    }
    const fe = F.style.top === "0px", le = F.style.bottom === "0px", se = F.getBoundingClientRect().height, me = He(F), ye = getComputedStyle(F), ne = parseFloat(ye.marginTop), re = parseFloat(ye.marginBottom), q = Fu(getComputedStyle(f.current)), U = Math.min(me.documentElement.clientHeight - ne - re, q), V = ue.scrollTop, Y = Xo(ue);
    let ee = 0, he = null, Me = false, Ue = false;
    const Le = (xe) => {
      F.style.height = `${xe}px`;
    }, _e = (xe, Ee) => {
      const Re = Mi(xe, 0, U - se);
      Re > 0 && Le(se + Re), ue.scrollTop = Ee, U - (se + Re) <= ln && (B.current = true), h();
    };
    if (fe) {
      const xe = Y - V, Ee = se + xe, Re = Math.min(Ee, U);
      if (ee = Re, xe <= ln) {
        _e(xe, Y);
        return;
      }
      U - Re > ln ? Ue = true : Me = true;
    } else if (le) {
      const xe = V, Ee = se + xe, Re = Math.min(Ee, U), We = Ee - U;
      if (ee = Re, xe <= ln) {
        _e(xe, 0);
        return;
      }
      U - Re > ln ? he = 0 : (Me = true, V < Y && (he = V - (xe - We)));
    }
    if (ee = Math.ceil(ee), ee !== 0 && Le(ee), Ue || he != null) {
      const xe = Xo(ue), Ee = Ue ? xe : Mi(he, 0, xe);
      Math.abs(ue.scrollTop - Ee) > ln && (ue.scrollTop = Ee);
    }
    (Me || ee >= U - ln) && (B.current = true), h();
  });
  c.useImperativeHandle(v, () => te, [te]), rn({
    open: M,
    ref: f,
    onComplete() {
      M && (u == null ? void 0 : u(true));
    }
  });
  const J = {
    open: M,
    transitionStatus: k,
    side: x,
    align: R
  };
  ce(() => {
    !F || !f.current || Object.keys(W.current).length || (W.current = {
      top: F.style.top || "0",
      left: F.style.left || "0",
      right: F.style.right,
      height: F.style.height,
      bottom: F.style.bottom,
      minHeight: F.style.minHeight,
      maxHeight: F.style.maxHeight,
      marginTop: F.style.marginTop,
      marginBottom: F.style.marginBottom
    });
  }, [f, F]), ce(() => {
    M || S || (j.current = false, B.current = false, Q.current = 0, G.current = 0, Ns(F, W.current));
  }, [M, S, F, f]), ce(() => {
    const ue = f.current;
    if (!(!M || !$ || !F || !ue || l.state.transitionStatus === "ending")) {
      if (!S) {
        j.current = true, H.request(h), ue.style.removeProperty("--transform-origin");
        return;
      }
      queueMicrotask(() => {
        var _a2;
        const fe = bE(ue);
        ue.style.removeProperty("--transform-origin");
        try {
          const le = getComputedStyle(F), se = getComputedStyle(ue), me = He($), ye = pt(F), ne = hE($), re = Jo($.getBoundingClientRect(), ne), q = Jo(F.getBoundingClientRect(), ne), U = re.left, V = re.height, Y = z || ue, ee = Y.scrollHeight, he = parseFloat(se.borderBottomWidth), Me = parseFloat(le.marginTop) || 10, Ue = parseFloat(le.marginBottom) || 10, Le = parseFloat(le.minHeight) || 100, _e = Fu(se), xe = 5, Ee = 5, Re = 20, We = me.documentElement.clientHeight - Me - Ue, Ce = me.documentElement.clientWidth, Ie = We - re.bottom + V, je = g.current, lt = d.current;
          let Ne, Ye = 0, qe = 0;
          if (je && lt) {
            const Oe = Jo(lt.getBoundingClientRect(), ne);
            Ne = Jo(je.getBoundingClientRect(), ne);
            const Fe = Oe.left - U, ze = Ne.left - q.left, et = Oe.top - re.top + Oe.height / 2, at = Ne.top - q.top + Ne.height / 2;
            Ye = Fe - ze, qe = at - et;
          }
          const rt = Ie + qe + Ue + he;
          let Qe = Math.min(We, rt);
          const De = We - Me - Ue, Ge = rt - Qe, pe = Math.max(xe, U + Ye), Be = Ce - Ee, Ve = Math.max(0, pe + q.width - Be);
          F.style.left = `${pe - Ve}px`, F.style.height = `${Qe}px`, F.style.maxHeight = "auto", F.style.marginTop = `${Me}px`, F.style.marginBottom = `${Ue}px`, ue.style.height = "100%";
          const $e = Xo(Y), ot = Ge >= $e - ln;
          ot && (Qe = Math.min(We, q.height) - (Ge - $e));
          const Xe = re.top < Re || re.bottom > We - Re || Math.ceil(Qe) + ln < Math.min(ee, Le), ge = (((_a2 = ye.visualViewport) == null ? void 0 : _a2.scale) ?? 1) !== 1 && Ya;
          if (Xe || ge) {
            j.current = true, Ns(F, W.current), Tt.flushSync(() => E(false));
            return;
          }
          if (ot) {
            const Oe = Math.max(0, We - rt);
            F.style.top = q.height >= De ? "0" : `${Oe}px`, F.style.height = `${Qe}px`, Y.scrollTop = Xo(Y), Q.current = Math.max(Le, Qe);
          } else
            F.style.bottom = "0", Q.current = Math.max(Le, Qe), Y.scrollTop = Ge;
          if (Ne) {
            const Oe = q.top, Fe = q.height, ze = Ne.top + Ne.height / 2, et = Fe > 0 ? (ze - Oe) / Fe * 100 : 50, at = Mi(et, 0, 100);
            ue.style.setProperty("--transform-origin", `50% ${at}%`);
          }
          (Q.current === We || Qe >= _e) && (B.current = true), h(), setTimeout(() => {
            j.current = true;
          });
        } finally {
          fe();
        }
      });
    }
  }, [l, M, F, $, d, g, f, h, S, E, H, C, T, z]), c.useEffect(() => {
    if (!S || !F || !M)
      return;
    const ue = pt(F);
    function fe(le) {
      p(false, we(Kv, le));
    }
    return ue.addEventListener("resize", fe), () => {
      ue.removeEventListener("resize", fe);
    };
  }, [p, S, F, M]);
  const oe = {
    ...z ? {
      role: "presentation",
      "aria-orientation": void 0
    } : {
      role: "listbox",
      "aria-multiselectable": b || void 0,
      id: `${O}-list`
    },
    onKeyDown(ue) {
      m.current = true, N && Ws.has(ue.key) && ue.stopPropagation();
    },
    onMouseMove() {
      m.current = false;
    },
    onPointerLeave(ue) {
      if (!y || am(ue) || ue.pointerType === "touch")
        return;
      const fe = ue.currentTarget;
      P.start(0, () => {
        l.set("activeIndex", null), fe.focus({
          preventScroll: true
        });
      });
    },
    onScroll(ue) {
      z || te(ue.currentTarget);
    },
    ...S && {
      style: z ? {
        height: "100%"
      } : pE
    }
  }, ae = Pe("div", n, {
    ref: [r, f],
    state: J,
    stateAttributesMapping: gE,
    props: [_, oe, Vn(k), {
      className: !z && S ? Ea.className : void 0
    }, a]
  });
  return /* @__PURE__ */ jsxs(c.Fragment, {
    children: [!A && Ea.getElement(L), /* @__PURE__ */ jsx(Gs, {
      context: I,
      modal: false,
      disabled: !D,
      returnFocus: i,
      restoreFocus: true,
      children: ae
    })]
  });
});
process.env.NODE_ENV !== "production" && (lm.displayName = "SelectPopup");
function Fu(e) {
  const n = e.maxHeight || "";
  return n.endsWith("px") && parseFloat(n) || 1 / 0;
}
function Xo(e) {
  return Math.max(0, e.scrollHeight - e.clientHeight);
}
function hE(e) {
  return ep.getScale(e);
}
function Jo(e, n) {
  return eo({
    x: e.x / n.x,
    y: e.y / n.y,
    width: e.width / n.x,
    height: e.height / n.y
  });
}
const _u = [["transform", "none"], ["scale", "1"], ["translate", "0 0"]];
function bE(e) {
  const {
    style: n
  } = e, r = {};
  for (const [o, s] of _u)
    r[o] = n.getPropertyValue(o), n.setProperty(o, s, "important");
  return () => {
    for (const [o] of _u) {
      const s = r[o];
      s ? n.setProperty(o, s) : n.removeProperty(o);
    }
  };
}
const Ul = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Ul.displayName = "SelectItemContext");
function Wl() {
  const e = c.useContext(Ul);
  if (!e)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: SelectItemContext is missing. SelectItem parts must be placed within <Select.Item>." : Ze(57));
  return e;
}
const cm = /* @__PURE__ */ c.memo(/* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    render: o,
    className: s,
    value: i = null,
    label: a,
    disabled: l = false,
    nativeButton: f = false,
    ...u
  } = n, p = c.useRef(null), d = _s({
    label: a,
    textRef: p,
    indexGuessBehavior: of.GuessFromOrder
  }), {
    store: g,
    getItemProps: m,
    setOpen: b,
    setValue: h,
    selectionRef: v,
    typingRef: y,
    valuesRef: x,
    keyboardActiveRef: R,
    multiple: S,
    highlightItemOnHover: E
  } = Bn(), C = ht(), T = ke(g, Te.isActive, d.index), N = ke(g, Te.isSelected, d.index, i), I = ke(g, Te.isSelectedByFocus, d.index), L = ke(g, Te.isItemEqualToValue), A = d.index, P = A !== -1, O = c.useRef(null), M = yt(A);
  ce(() => {
    if (!P)
      return;
    const H = x.current;
    return H[A] = i, () => {
      delete H[A];
    };
  }, [P, A, i, x]), ce(() => {
    if (!P)
      return;
    const H = g.state.value;
    let te = H;
    S && Array.isArray(H) && H.length > 0 && (te = H[H.length - 1]), te !== void 0 && yr(i, te, L) && g.set("selectedIndex", A);
  }, [P, A, S, L, g, i]);
  const D = {
    disabled: l,
    selected: N,
    highlighted: T
  }, _ = m({
    active: T,
    selected: N
  });
  _.onFocus = void 0, _.id = void 0;
  const k = c.useRef(null), $ = c.useRef("mouse"), F = c.useRef(false), {
    getButtonProps: z,
    buttonRef: Q
  } = nn({
    disabled: l,
    focusableWhenDisabled: true,
    native: f,
    composite: true
  });
  function B(H) {
    const te = g.state.value;
    if (S) {
      const J = Array.isArray(te) ? te : [], oe = N ? h0(J, i, L) : [...J, i];
      h(oe, we(Vr, H));
    } else
      h(i, we(Vr, H)), b(false, we(Vr, H));
  }
  const G = {
    role: "option",
    "aria-selected": N,
    tabIndex: T ? 0 : -1,
    onFocus() {
      g.set("activeIndex", A);
    },
    onMouseEnter() {
      !R.current && g.state.selectedIndex === null && E && g.set("activeIndex", A);
    },
    onMouseMove() {
      E && g.set("activeIndex", A);
    },
    onMouseLeave(H) {
      !E || R.current || am(H) || C.start(0, () => {
        g.state.activeIndex === A && g.set("activeIndex", null);
      });
    },
    onTouchStart() {
      v.current = {
        allowSelectedMouseUp: false,
        allowUnselectedMouseUp: false
      };
    },
    onKeyDown(H) {
      k.current = H.key, g.set("activeIndex", A), H.key === " " && y.current && H.preventDefault();
    },
    onClick(H) {
      F.current = false, !(H.type === "keydown" && k.current === null) && (l || H.type === "keydown" && k.current === " " && y.current || $.current !== "touch" && !T || (k.current = null, B(H.nativeEvent)));
    },
    onPointerEnter(H) {
      $.current = H.pointerType;
    },
    onPointerDown(H) {
      $.current = H.pointerType, F.current = true;
    },
    onMouseUp() {
      var _a2;
      if (l)
        return;
      if (F.current) {
        F.current = false;
        return;
      }
      const H = !v.current.allowSelectedMouseUp && N, te = !v.current.allowUnselectedMouseUp && !N;
      H || te || $.current !== "touch" && !T || ((_a2 = O.current) == null ? void 0 : _a2.click());
    }
  }, j = Pe("div", n, {
    ref: [Q, r, d.ref, O],
    state: D,
    props: [_, G, u, z]
  }), W = c.useMemo(() => ({
    selected: N,
    indexRef: M,
    textRef: p,
    selectedByFocus: I,
    hasRegistered: P
  }), [N, M, p, I, P]);
  return /* @__PURE__ */ jsx(Ul.Provider, {
    value: W,
    children: j
  });
}));
process.env.NODE_ENV !== "production" && (cm.displayName = "SelectItem");
const um = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const o = n.keepMounted ?? false, {
    selected: s
  } = Wl();
  return o || s ? /* @__PURE__ */ jsx(dm, {
    ...n,
    ref: r
  }) : null;
});
process.env.NODE_ENV !== "production" && (um.displayName = "SelectItemIndicator");
const dm = /* @__PURE__ */ c.memo(/* @__PURE__ */ c.forwardRef((e, n) => {
  const {
    render: r,
    className: o,
    keepMounted: s,
    ...i
  } = e, {
    selected: a
  } = Wl(), l = c.useRef(null), {
    transitionStatus: f,
    setMounted: u
  } = uo(a), d = Pe("span", e, {
    ref: [n, l],
    state: {
      selected: a,
      transitionStatus: f
    },
    props: [{
      "aria-hidden": true,
      children: "✔️"
    }, i],
    stateAttributesMapping: en
  });
  return rn({
    open: a,
    ref: l,
    onComplete() {
      a || u(false);
    }
  }), d;
}));
process.env.NODE_ENV !== "production" && (dm.displayName = "Inner");
const fm = /* @__PURE__ */ c.memo(/* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    indexRef: o,
    textRef: s,
    selectedByFocus: i,
    hasRegistered: a
  } = Wl(), {
    selectedItemTextRef: l
  } = Bn(), {
    className: f,
    render: u,
    ...p
  } = n, d = c.useCallback((m) => {
    if (!m || !a)
      return;
    const b = l.current === null || !l.current.isConnected;
    (i || b && o.current === 0) && (l.current = m);
  }, [l, o, i, a]);
  return Pe("div", n, {
    ref: [d, r, s],
    props: p
  });
}));
process.env.NODE_ENV !== "production" && (fm.displayName = "SelectItemText");
const jl = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (jl.displayName = "SelectGroupContext");
function vE() {
  const e = c.useContext(jl);
  if (e === void 0)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: SelectGroupContext is missing. SelectGroup parts must be placed within <Select.Group>." : Ze(56));
  return e;
}
const pm = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    className: o,
    render: s,
    ...i
  } = n, [a, l] = c.useState(), f = c.useMemo(() => ({
    labelId: a,
    setLabelId: l
  }), [a, l]), u = Pe("div", n, {
    ref: r,
    props: [{
      role: "group",
      "aria-labelledby": a
    }, i]
  });
  return /* @__PURE__ */ jsx(jl.Provider, {
    value: f,
    children: u
  });
});
process.env.NODE_ENV !== "production" && (pm.displayName = "SelectGroup");
const mm = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    className: o,
    render: s,
    id: i,
    ...a
  } = n, {
    setLabelId: l
  } = vE(), f = Mt(i);
  return ce(() => {
    l(f);
  }, [f, l]), Pe("div", n, {
    ref: r,
    props: [{
      id: f
    }, a]
  });
});
process.env.NODE_ENV !== "production" && (mm.displayName = "SelectGroupLabel");
const Kl = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Kl.displayName = "SwitchRootContext");
function yE() {
  const e = c.useContext(Kl);
  if (e === void 0)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: SwitchRootContext is missing. Switch parts must be placed within <Switch.Root>." : Ze(63));
  return e;
}
let Vu = /* @__PURE__ */ (function(e) {
  return e.checked = "data-checked", e.unchecked = "data-unchecked", e.disabled = "data-disabled", e.readonly = "data-readonly", e.required = "data-required", e.valid = "data-valid", e.invalid = "data-invalid", e.touched = "data-touched", e.dirty = "data-dirty", e.filled = "data-filled", e.focused = "data-focused", e;
})({});
const gm = {
  ...gp,
  checked(e) {
    return e ? {
      [Vu.checked]: ""
    } : {
      [Vu.unchecked]: ""
    };
  }
}, hm = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    checked: o,
    className: s,
    defaultChecked: i,
    "aria-labelledby": a,
    id: l,
    inputRef: f,
    name: u,
    nativeButton: p = false,
    onCheckedChange: d,
    readOnly: g = false,
    required: m = false,
    disabled: b = false,
    render: h,
    uncheckedValue: v,
    value: y,
    ...x
  } = n, {
    clearErrors: R
  } = Rl(), {
    state: S,
    setTouched: E,
    setDirty: C,
    validityData: T,
    setFilled: N,
    setFocused: I,
    shouldValidateOnChange: L,
    validationMode: A,
    disabled: P,
    name: O,
    validation: M
  } = Eo(), {
    labelId: D
  } = Nl(), _ = P || b, k = O ?? u, $ = de(d), F = c.useRef(null), z = Wt(F, f, M.inputRef), Q = c.useRef(null), B = Mt(), G = Tl({
    id: l,
    implicit: false,
    controlRef: Q
  }), j = p ? void 0 : G, [W, H] = Xr({
    controlled: o,
    default: !!i,
    name: "Switch",
    state: "checked"
  });
  vp({
    id: B,
    commit: M.commit,
    value: W,
    controlRef: Q,
    name: k,
    getValue: () => W
  }), ce(() => {
    F.current && N(F.current.checked);
  }, [F, N]), bl(W, () => {
    R(k), C(W !== T.initialValue), N(W), L() ? M.commit(W) : M.commit(W, true);
  });
  const {
    getButtonProps: te,
    buttonRef: J
  } = nn({
    disabled: _,
    native: p
  }), oe = T0(a, D, F, !p, j), ae = {
    id: p ? G : B,
    role: "switch",
    "aria-checked": W,
    "aria-readonly": g || void 0,
    "aria-required": m || void 0,
    "aria-labelledby": oe,
    onFocus() {
      _ || I(true);
    },
    onBlur() {
      const se = F.current;
      !se || _ || (E(true), I(false), A === "onBlur" && M.commit(se.checked));
    },
    onClick(se) {
      var _a2;
      g || _ || (se.preventDefault(), (_a2 = F.current) == null ? void 0 : _a2.dispatchEvent(new PointerEvent("click", {
        bubbles: true,
        shiftKey: se.shiftKey,
        ctrlKey: se.ctrlKey,
        altKey: se.altKey,
        metaKey: se.metaKey
      })));
    }
  }, ue = c.useMemo(() => Tn(
    {
      checked: W,
      disabled: _,
      id: j,
      name: k,
      required: m,
      style: k ? zf : Ks,
      tabIndex: -1,
      type: "checkbox",
      "aria-hidden": true,
      ref: z,
      onChange(se) {
        if (se.nativeEvent.defaultPrevented)
          return;
        const me = se.target.checked, ye = we(mn, se.nativeEvent);
        $ == null ? void 0 : $(me, ye), !ye.isCanceled && H(me);
      },
      onFocus() {
        var _a2;
        (_a2 = Q.current) == null ? void 0 : _a2.focus();
      }
    },
    M.getInputValidationProps,
    // React <19 sets an empty value if `undefined` is passed explicitly
    // To avoid this, we only set the value if it's defined
    y !== void 0 ? {
      value: y
    } : ct
  ), [W, _, z, j, k, $, m, H, M, y]), fe = c.useMemo(() => ({
    ...S,
    checked: W,
    disabled: _,
    readOnly: g,
    required: m
  }), [S, W, _, g, m]), le = Pe("span", n, {
    state: fe,
    ref: [r, Q, J],
    props: [ae, M.getValidationProps, x, te],
    stateAttributesMapping: gm
  });
  return /* @__PURE__ */ jsxs(Kl.Provider, {
    value: fe,
    children: [le, !W && k && v !== void 0 && /* @__PURE__ */ jsx("input", {
      type: "hidden",
      name: k,
      value: v
    }), /* @__PURE__ */ jsx("input", {
      ...ue
    })]
  });
});
process.env.NODE_ENV !== "production" && (hm.displayName = "SwitchRoot");
const bm = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    render: o,
    className: s,
    ...i
  } = n, {
    state: a
  } = Eo(), l = yE(), f = {
    ...a,
    ...l
  };
  return Pe("span", n, {
    state: f,
    ref: r,
    stateAttributesMapping: gm,
    props: i
  });
});
process.env.NODE_ENV !== "production" && (bm.displayName = "SwitchThumb");
const Gl = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Gl.displayName = "TabsRootContext");
function Yl() {
  const e = c.useContext(Gl);
  if (e === void 0)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: TabsRootContext is missing. Tabs parts must be placed within <Tabs.Root>." : Ze(64));
  return e;
}
let xE = /* @__PURE__ */ (function(e) {
  return e.activationDirection = "data-activation-direction", e.orientation = "data-orientation", e;
})({});
const ql = {
  tabActivationDirection: (e) => ({
    [xE.activationDirection]: e
  })
}, vm = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    className: o,
    defaultValue: s = 0,
    onValueChange: i,
    orientation: a = "horizontal",
    render: l,
    value: f,
    ...u
  } = n, p = Ds(), d = Object.hasOwn(n, "defaultValue"), g = c.useRef([]), [m, b] = c.useState(() => /* @__PURE__ */ new Map()), [h, v] = Xr({
    controlled: f,
    default: s,
    name: "Tabs",
    state: "value"
  }), y = f !== void 0, [x, R] = c.useState(() => /* @__PURE__ */ new Map()), [S, E] = c.useState("none"), C = de((k, $) => {
    i == null ? void 0 : i(k, $), !$.isCanceled && (v(k), E($.activationDirection));
  }), T = de((k, $) => {
    b((F) => {
      if (F.get(k) === $)
        return F;
      const z = new Map(F);
      return z.set(k, $), z;
    });
  }), N = de((k, $) => {
    b((F) => {
      if (!F.has(k) || F.get(k) !== $)
        return F;
      const z = new Map(F);
      return z.delete(k), z;
    });
  }), I = c.useCallback((k) => m.get(k), [m]), L = c.useCallback((k) => {
    for (const $ of x.values())
      if (k === ($ == null ? void 0 : $.value))
        return $ == null ? void 0 : $.id;
  }, [x]), A = c.useCallback((k) => {
    if (k === void 0)
      return null;
    for (const [$, F] of x.entries())
      if (F != null && k === (F.value ?? F.index))
        return $;
    return null;
  }, [x]), P = c.useMemo(() => ({
    direction: p,
    getTabElementBySelectedValue: A,
    getTabIdByPanelValue: L,
    getTabPanelIdByValue: I,
    onValueChange: C,
    orientation: a,
    registerMountedTabPanel: T,
    setTabMap: R,
    unregisterMountedTabPanel: N,
    tabActivationDirection: S,
    value: h
  }), [p, A, L, I, C, a, T, R, N, S, h]), O = c.useMemo(() => {
    for (const k of x.values())
      if (k != null && k.value === h)
        return k;
  }, [x, h]), M = c.useMemo(() => {
    for (const k of x.values())
      if (k != null && !k.disabled)
        return k.value;
  }, [x]);
  ce(() => {
    if (y || x.size === 0)
      return;
    const k = O == null ? void 0 : O.disabled, $ = O == null && h !== null;
    if (d && k && h === s || !k && !$)
      return;
    const z = M ?? null;
    h !== z && (v(z), E("none"));
  }, [s, M, d, y, O, E, v, x, h]);
  const _ = Pe("div", n, {
    state: {
      orientation: a,
      tabActivationDirection: S
    },
    ref: r,
    props: u,
    stateAttributesMapping: ql
  });
  return /* @__PURE__ */ jsx(Gl.Provider, {
    value: P,
    children: /* @__PURE__ */ jsx(Ms, {
      elementsRef: g,
      children: _
    })
  });
});
process.env.NODE_ENV !== "production" && (vm.displayName = "TabsRoot");
const Xl = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Xl.displayName = "TabsListContext");
function wE() {
  const e = c.useContext(Xl);
  if (e === void 0)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: TabsListContext is missing. TabsList parts must be placed within <Tabs.List>." : Ze(65));
  return e;
}
const ym = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    className: o,
    disabled: s = false,
    render: i,
    value: a,
    id: l,
    nativeButton: f = true,
    ...u
  } = n, {
    value: p,
    getTabPanelIdByValue: d,
    orientation: g
  } = Yl(), {
    activateOnFocus: m,
    highlightedTabIndex: b,
    onTabActivation: h,
    registerTabResizeObserverElement: v,
    setHighlightedTabIndex: y,
    tabsListElement: x
  } = wE(), R = Mt(l), S = c.useMemo(() => ({
    disabled: s,
    id: R,
    value: a
  }), [s, R, a]), {
    compositeProps: E,
    compositeRef: C,
    index: T
    // hook is used instead of the CompositeItem component
    // because the index is needed for Tab internals
  } = Vp({
    metadata: S
  }), N = a === p, I = c.useRef(false), L = c.useRef(null);
  c.useEffect(() => {
    const Q = L.current;
    if (Q)
      return v(Q);
  }, [v]), ce(() => {
    if (I.current) {
      I.current = false;
      return;
    }
    if (!(N && T > -1 && b !== T))
      return;
    const Q = x;
    if (Q != null) {
      const B = Ft(He(Q));
      if (B && Se(Q, B))
        return;
    }
    s || y(T);
  }, [N, T, b, y, s, x]);
  const {
    getButtonProps: A,
    buttonRef: P
  } = nn({
    disabled: s,
    native: f,
    focusableWhenDisabled: true
  }), O = d(a), M = c.useRef(false), D = c.useRef(false);
  function _(Q) {
    N || s || h(a, we(mn, Q.nativeEvent, void 0, {
      activationDirection: "none"
    }));
  }
  function k(Q) {
    N || (T > -1 && !s && y(T), !s && m && (!M.current || // keyboard or touch focus
    M.current && D.current) && h(a, we(mn, Q.nativeEvent, void 0, {
      activationDirection: "none"
    })));
  }
  function $(Q) {
    if (N || s)
      return;
    M.current = true;
    function B() {
      M.current = false, D.current = false;
    }
    (!Q.button || Q.button === 0) && (D.current = true, He(Q.currentTarget).addEventListener("pointerup", B, {
      once: true
    }));
  }
  return Pe("button", n, {
    state: {
      disabled: s,
      active: N,
      orientation: g
    },
    ref: [r, P, C, L],
    props: [E, {
      role: "tab",
      "aria-controls": O,
      "aria-selected": N,
      id: R,
      onClick: _,
      onFocus: k,
      onPointerDown: $,
      [Up]: N ? "" : void 0,
      onKeyDownCapture() {
        I.current = true;
      }
    }, u, A]
  });
});
process.env.NODE_ENV !== "production" && (ym.displayName = "TabsTab");
let EE = (function(e) {
  return e.index = "data-index", e.activationDirection = "data-activation-direction", e.orientation = "data-orientation", e.hidden = "data-hidden", e[e.startingStyle = gn.startingStyle] = "startingStyle", e[e.endingStyle = gn.endingStyle] = "endingStyle", e;
})({});
const CE = {
  ...ql,
  ...en
}, xm = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    className: o,
    value: s,
    render: i,
    keepMounted: a = false,
    ...l
  } = n, {
    value: f,
    getTabIdByPanelValue: u,
    orientation: p,
    tabActivationDirection: d,
    registerMountedTabPanel: g,
    unregisterMountedTabPanel: m
  } = Yl(), b = Mt(), h = c.useMemo(() => ({
    id: b,
    value: s
  }), [b, s]), {
    ref: v,
    index: y
  } = _s({
    metadata: h
  }), x = s === f, {
    mounted: R,
    transitionStatus: S,
    setMounted: E
  } = uo(x), C = !R, T = u(s), N = {
    hidden: C,
    orientation: p,
    tabActivationDirection: d,
    transitionStatus: S
  }, I = c.useRef(null), L = Pe("div", n, {
    state: N,
    ref: [r, v, I],
    props: [{
      "aria-labelledby": T,
      hidden: C,
      id: b,
      role: "tabpanel",
      tabIndex: x ? 0 : -1,
      inert: yo(!x),
      [EE.index]: y
    }, l],
    stateAttributesMapping: CE
  });
  return rn({
    open: x,
    ref: I,
    onComplete() {
      x || E(false);
    }
  }), ce(() => {
    if (!(C && !a) && b != null)
      return g(s, b), () => {
        m(s, b);
      };
  }, [C, a, s, b, g, m]), a || R ? L : null;
});
process.env.NODE_ENV !== "production" && (xm.displayName = "TabsPanel");
const wm = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    activateOnFocus: o = false,
    className: s,
    loopFocus: i = true,
    render: a,
    ...l
  } = n, {
    getTabElementBySelectedValue: f,
    onValueChange: u,
    orientation: p,
    value: d,
    setTabMap: g,
    tabActivationDirection: m
  } = Yl(), [b, h] = c.useState(0), [v, y] = c.useState(null), x = c.useRef(/* @__PURE__ */ new Set()), R = c.useRef(/* @__PURE__ */ new Set()), S = c.useRef(null), E = de(() => {
    x.current.forEach((O) => {
      O();
    });
  });
  c.useEffect(() => {
    if (typeof ResizeObserver > "u")
      return;
    const O = new ResizeObserver(() => {
      x.current.size && E();
    });
    return S.current = O, v && O.observe(v), R.current.forEach((M) => {
      O.observe(M);
    }), () => {
      O.disconnect(), S.current = null;
    };
  }, [v, E]);
  const C = de((O) => (x.current.add(O), () => {
    x.current.delete(O);
  })), T = de((O) => {
    var _a2;
    return R.current.add(O), (_a2 = S.current) == null ? void 0 : _a2.observe(O), () => {
      var _a3;
      R.current.delete(O), (_a3 = S.current) == null ? void 0 : _a3.unobserve(O);
    };
  }), N = SE(
    d,
    // the old value
    p,
    v,
    f
  ), I = de((O, M) => {
    if (O !== d) {
      const D = N(O);
      M.activationDirection = D, u(O, M);
    }
  }), L = {
    orientation: p,
    tabActivationDirection: m
  }, A = {
    "aria-orientation": p === "vertical" ? "vertical" : void 0,
    role: "tablist"
  }, P = c.useMemo(() => ({
    activateOnFocus: o,
    highlightedTabIndex: b,
    registerIndicatorUpdateListener: C,
    registerTabResizeObserverElement: T,
    onTabActivation: I,
    setHighlightedTabIndex: h,
    tabsListElement: v
  }), [o, b, C, T, I, h, v]);
  return /* @__PURE__ */ jsx(Xl.Provider, {
    value: P,
    children: /* @__PURE__ */ jsx(Y0, {
      render: a,
      className: s,
      state: L,
      refs: [r, y],
      props: [A, l],
      stateAttributesMapping: ql,
      highlightedIndex: b,
      enableHomeAndEndKeys: true,
      loopFocus: i,
      orientation: p,
      onHighlightedIndexChange: h,
      onMapChange: g,
      disabledIndices: kn
    })
  });
});
process.env.NODE_ENV !== "production" && (wm.displayName = "TabsList");
function Bu(e, n) {
  const {
    left: r,
    top: o
  } = e.getBoundingClientRect(), {
    left: s,
    top: i
  } = n.getBoundingClientRect(), a = r - s, l = o - i;
  return {
    left: a,
    top: l
  };
}
function SE(e, n, r, o) {
  const [s, i] = c.useState(null);
  return ce(() => {
    if (e == null || r == null) {
      i(null);
      return;
    }
    const a = o(e);
    if (a == null) {
      i(null);
      return;
    }
    const {
      left: l,
      top: f
    } = Bu(a, r);
    i(n === "horizontal" ? l : f);
  }, [n, o, r, e]), c.useCallback((a) => {
    if (a === e)
      return "none";
    if (a == null)
      return i(null), "none";
    if (a != null && r != null) {
      const l = o(a);
      if (l != null) {
        const {
          left: f,
          top: u
        } = Bu(l, r);
        if (s == null)
          return i(n === "horizontal" ? f : u), "none";
        if (n === "horizontal") {
          if (f < s)
            return i(f), "left";
          if (f > s)
            return i(f), "right";
        } else {
          if (u < s)
            return i(u), "up";
          if (u > s)
            return i(u), "down";
        }
      }
    }
    return "none";
  }, [o, n, s, r, e]);
}
const Jl = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Jl.displayName = "TooltipRootContext");
function ai(e) {
  const n = c.useContext(Jl);
  if (n === void 0 && !e)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: TooltipRootContext is missing. Tooltip parts must be placed within <Tooltip.Root>." : Ze(72));
  return n;
}
const RE = {
  ...ei,
  disabled: ie((e) => e.disabled),
  instantType: ie((e) => e.instantType),
  isInstantPhase: ie((e) => e.isInstantPhase),
  trackCursorAxis: ie((e) => e.trackCursorAxis),
  disableHoverablePopup: ie((e) => e.disableHoverablePopup),
  lastOpenChangeReason: ie((e) => e.openChangeReason),
  closeOnClick: ie((e) => e.closeOnClick),
  closeDelay: ie((e) => e.closeDelay),
  hasViewport: ie((e) => e.hasViewport)
};
class Zl extends vo {
  constructor(n) {
    super({
      ...NE(),
      ...n
    }, {
      popupRef: /* @__PURE__ */ c.createRef(),
      onOpenChange: void 0,
      onOpenChangeComplete: void 0,
      triggerElements: new Nr()
    }, RE);
    __publicField(this, "setOpen", (n, r) => {
      var _a2, _b2;
      const o = r.reason, s = o === vt, i = n && o === ur, a = !n && (o === Jt || o === ao);
      if (r.preventUnmountOnClose = () => {
        this.set("preventUnmountingOnClose", true);
      }, (_b2 = (_a2 = this.context).onOpenChange) == null ? void 0 : _b2.call(_a2, n, r), r.isCanceled)
        return;
      const l = () => {
        var _a3;
        const f = {
          open: n,
          openChangeReason: o
        };
        i ? f.instantType = "focus" : a ? f.instantType = "dismiss" : o === vt && (f.instantType = void 0);
        const u = ((_a3 = r.trigger) == null ? void 0 : _a3.id) ?? null;
        (u || n) && (f.activeTriggerId = u, f.activeTriggerElement = r.trigger ?? null), this.update(f);
      };
      s ? Tt.flushSync(l) : l();
    });
  }
  static useStore(n, r) {
    const o = xt(() => new Zl(r)).current, s = n ?? o, i = ti({
      popupStore: s,
      onOpenChange: s.setOpen
    });
    return s.state.floatingRootContext = i, s;
  }
}
function NE() {
  return {
    ...Qs(),
    disabled: false,
    instantType: void 0,
    isInstantPhase: false,
    trackCursorAxis: "none",
    disableHoverablePopup: false,
    openChangeReason: null,
    closeOnClick: true,
    closeDelay: 0,
    hasViewport: false
  };
}
const Em = cl(function(n) {
  const {
    disabled: r = false,
    defaultOpen: o = false,
    open: s,
    disableHoverablePopup: i = false,
    trackCursorAxis: a = "none",
    actionsRef: l,
    onOpenChange: f,
    onOpenChangeComplete: u,
    handle: p,
    triggerId: d,
    defaultTriggerId: g = null,
    children: m
  } = n, b = Zl.useStore(p == null ? void 0 : p.store, {
    open: o,
    openProp: s,
    activeTriggerId: g,
    triggerIdProp: d
  });
  wo(() => {
    s === void 0 && b.state.open === false && o === true && b.update({
      open: true,
      activeTriggerId: g
    });
  }), b.useControlledProp("openProp", s), b.useControlledProp("triggerIdProp", d), b.useContextCallback("onOpenChange", f), b.useContextCallback("onOpenChangeComplete", u);
  const h = b.useState("open"), v = !r && h, y = b.useState("activeTriggerId"), x = b.useState("payload");
  b.useSyncedValues({
    trackCursorAxis: a,
    disableHoverablePopup: i
  }), ce(() => {
    h && r && b.setOpen(false, we(jv));
  }, [h, r, b]), b.useSyncedValue("disabled", r), Js(b);
  const {
    forceUnmount: R,
    transitionStatus: S
  } = Zs(v, b), E = b.useState("isInstantPhase"), C = b.useState("instantType"), T = b.useState("lastOpenChangeReason"), N = c.useRef(null);
  ce(() => {
    S === "ending" && T === mn || S !== "ending" && E ? (C !== "delay" && (N.current = C), b.set("instantType", "delay")) : N.current !== null && (b.set("instantType", N.current), N.current = null);
  }, [S, E, T, C, b]), ce(() => {
    v && y == null && b.set("payload", void 0);
  }, [b, y, v]);
  const I = c.useCallback(() => {
    b.setOpen(false, TE(b, Ls));
  }, [b]);
  c.useImperativeHandle(l, () => ({
    unmount: R,
    close: I
  }), [R, I]);
  const L = b.useState("floatingRootContext"), A = bo(L, {
    enabled: !r,
    referencePress: () => b.select("closeOnClick")
  }), P = bx(L, {
    enabled: !r && a !== "none",
    axis: a === "none" ? void 0 : a
  }), {
    getReferenceProps: O,
    getFloatingProps: M,
    getTriggerProps: D
  } = Fn([A, P]), _ = c.useMemo(() => O(), [O]), k = c.useMemo(() => D(), [D]), $ = c.useMemo(() => M(), [M]);
  return b.useSyncedValues({
    activeTriggerProps: _,
    inactiveTriggerProps: k,
    popupProps: $
  }), /* @__PURE__ */ jsx(Jl.Provider, {
    value: b,
    children: typeof m == "function" ? m({
      payload: x
    }) : m
  });
});
process.env.NODE_ENV !== "production" && (Em.displayName = "TooltipRoot");
function TE(e, n) {
  const r = we(n);
  return r.preventUnmountOnClose = () => {
    e.set("preventUnmountingOnClose", true);
  }, r;
}
const Ql = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (Ql.displayName = "TooltipProviderContext");
function kE() {
  return c.useContext(Ql);
}
let OE = (function(e) {
  return e[e.popupOpen = Ss.popupOpen] = "popupOpen", e.triggerDisabled = "data-trigger-disabled", e;
})({});
const IE = 600, Cm = ip(function(n, r) {
  const {
    className: o,
    render: s,
    handle: i,
    payload: a,
    disabled: l,
    delay: f,
    closeOnClick: u = true,
    closeDelay: p,
    id: d,
    ...g
  } = n, m = ai(true), b = (i == null ? void 0 : i.store) ?? m;
  if (!b)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: <Tooltip.Trigger> must be either used within a <Tooltip.Root> component or provided with a handle." : Ze(82));
  const h = Mt(d), v = b.useState("isTriggerActive", h), y = b.useState("isOpenedByTrigger", h), x = b.useState("floatingRootContext"), R = c.useRef(null), S = f ?? IE, E = p ?? 0, {
    registerTrigger: C,
    isMountedByThisTrigger: T
  } = Xs(h, R, b, {
    payload: a,
    closeOnClick: u,
    closeDelay: E
  }), N = kE(), {
    delayRef: I,
    isInstantPhase: L,
    hasProvider: A
  } = ax(x, {
    open: y
  });
  b.useSyncedValue("isInstantPhase", L);
  const P = b.useState("disabled"), O = l ?? P, M = b.useState("trackCursorAxis"), D = b.useState("disableHoverablePopup"), _ = ml(x, {
    enabled: !O,
    mouseOnly: true,
    move: false,
    handleClose: !D && M !== "both" ? hl() : null,
    restMs() {
      const Q = N == null ? void 0 : N.delay, B = typeof I.current == "object" ? I.current.open : void 0;
      let G = S;
      return A && (B !== 0 ? G = f ?? Q ?? S : G = 0), G;
    },
    delay() {
      const Q = typeof I.current == "object" ? I.current.close : void 0;
      let B = E;
      return p == null && A && (B = Q), {
        close: B
      };
    },
    triggerElementRef: R,
    isActiveTrigger: v
  }), k = cp(x, {
    enabled: !O
  }).reference, $ = {
    open: y
  }, F = b.useState("triggerProps", T);
  return Pe("button", n, {
    state: $,
    ref: [r, C, R],
    props: [_, k, F, {
      onPointerDown() {
        b.set("closeOnClick", u);
      },
      id: h,
      [OE.triggerDisabled]: O ? "" : void 0
    }, g],
    stateAttributesMapping: oi
  });
});
process.env.NODE_ENV !== "production" && (Cm.displayName = "TooltipTrigger");
const ec = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (ec.displayName = "TooltipPortalContext");
function PE() {
  const e = c.useContext(ec);
  if (e === void 0)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: <Tooltip.Portal> is missing." : Ze(70));
  return e;
}
const Sm = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    keepMounted: o = false,
    ...s
  } = n;
  return ai().useState("mounted") || o ? /* @__PURE__ */ jsx(ec.Provider, {
    value: o,
    children: /* @__PURE__ */ jsx(qp, {
      ref: r,
      ...s
    })
  }) : null;
});
process.env.NODE_ENV !== "production" && (Sm.displayName = "TooltipPortal");
const tc = /* @__PURE__ */ c.createContext(void 0);
process.env.NODE_ENV !== "production" && (tc.displayName = "TooltipPositionerContext");
function ME() {
  const e = c.useContext(tc);
  if (e === void 0)
    throw new Error(process.env.NODE_ENV !== "production" ? "Base UI: TooltipPositionerContext is missing. TooltipPositioner parts must be placed within <Tooltip.Positioner>." : Ze(71));
  return e;
}
const Rm = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    render: o,
    className: s,
    anchor: i,
    positionMethod: a = "absolute",
    side: l = "top",
    align: f = "center",
    sideOffset: u = 0,
    alignOffset: p = 0,
    collisionBoundary: d = "clipping-ancestors",
    collisionPadding: g = 5,
    arrowPadding: m = 5,
    sticky: b = false,
    disableAnchorTracking: h = false,
    collisionAvoidance: v = Ha,
    ...y
  } = n, x = ai(), R = PE(), S = x.useState("open"), E = x.useState("mounted"), C = x.useState("trackCursorAxis"), T = x.useState("disableHoverablePopup"), N = x.useState("floatingRootContext"), I = x.useState("instantType"), L = x.useState("transitionStatus"), A = x.useState("hasViewport"), P = si({
    anchor: i,
    positionMethod: a,
    floatingRootContext: N,
    mounted: E,
    side: l,
    sideOffset: u,
    align: f,
    alignOffset: p,
    collisionBoundary: d,
    collisionPadding: g,
    sticky: b,
    arrowPadding: m,
    disableAnchorTracking: h,
    keepMounted: R,
    collisionAvoidance: v,
    adaptiveOrigin: A ? kl : void 0
  }), O = c.useMemo(() => {
    const k = {};
    return (!S || C === "both" || T) && (k.pointerEvents = "none"), {
      role: "presentation",
      hidden: !E,
      style: {
        ...P.positionerStyles,
        ...k
      }
    };
  }, [S, C, T, E, P.positionerStyles]), M = c.useMemo(() => ({
    open: S,
    side: P.side,
    align: P.align,
    anchorHidden: P.anchorHidden,
    instant: C !== "none" ? "tracking-cursor" : I
  }), [S, P.side, P.align, P.anchorHidden, C, I]), D = c.useMemo(() => ({
    ...M,
    arrowRef: P.arrowRef,
    arrowStyles: P.arrowStyles,
    arrowUncentered: P.arrowUncentered
  }), [M, P.arrowRef, P.arrowStyles, P.arrowUncentered]), _ = Pe("div", n, {
    state: M,
    props: [O, Vn(L), y],
    ref: [r, x.useStateSetter("positionerElement")],
    stateAttributesMapping: sn
  });
  return /* @__PURE__ */ jsx(tc.Provider, {
    value: D,
    children: _
  });
});
process.env.NODE_ENV !== "production" && (Rm.displayName = "TooltipPositioner");
const DE = {
  ...sn,
  ...en
}, Nm = /* @__PURE__ */ c.forwardRef(function(n, r) {
  const {
    className: o,
    render: s,
    ...i
  } = n, a = ai(), {
    side: l,
    align: f
  } = ME(), u = a.useState("open"), p = a.useState("instantType"), d = a.useState("transitionStatus"), g = a.useState("popupProps"), m = a.useState("floatingRootContext");
  rn({
    open: u,
    ref: a.context.popupRef,
    onComplete() {
      var _a2, _b2;
      u && ((_b2 = (_a2 = a.context).onOpenChangeComplete) == null ? void 0 : _b2.call(_a2, true));
    }
  });
  const b = a.useState("disabled"), h = a.useState("closeDelay");
  return pl(m, {
    enabled: !b,
    closeDelay: h
  }), Pe("div", n, {
    state: {
      open: u,
      side: l,
      align: f,
      instant: p,
      transitionStatus: d
    },
    ref: [r, a.context.popupRef, a.useStateSetter("popupElement")],
    props: [g, Vn(d), i],
    stateAttributesMapping: DE
  });
});
process.env.NODE_ENV !== "production" && (Nm.displayName = "TooltipPopup");
const Tm = function(n) {
  const {
    delay: r,
    closeDelay: o,
    timeout: s = 400
  } = n, i = c.useMemo(() => ({
    delay: r,
    closeDelay: o
  }), [r, o]), a = c.useMemo(() => ({
    open: r,
    close: o
  }), [r, o]);
  return /* @__PURE__ */ jsx(Ql.Provider, {
    value: i,
    children: /* @__PURE__ */ jsx(ix, {
      delay: a,
      timeoutMs: s,
      children: n.children
    })
  });
};
process.env.NODE_ENV !== "production" && (Tm.displayName = "TooltipProvider");
const li = typeof window < "u" && typeof window.document < "u" && typeof window.document.createElement < "u";
function Tr(e) {
  const n = Object.prototype.toString.call(e);
  return n === "[object Window]" || // In Electron context the Window object serializes to [object global]
  n === "[object global]";
}
function nc(e) {
  return "nodeType" in e;
}
function Dt(e) {
  var n, r;
  return e ? Tr(e) ? e : nc(e) && (n = (r = e.ownerDocument) == null ? void 0 : r.defaultView) != null ? n : window : window;
}
function rc(e) {
  const {
    Document: n
  } = Dt(e);
  return e instanceof n;
}
function So(e) {
  return Tr(e) ? false : e instanceof Dt(e).HTMLElement;
}
function km(e) {
  return e instanceof Dt(e).SVGElement;
}
function kr(e) {
  return e ? Tr(e) ? e.document : nc(e) ? rc(e) ? e : So(e) || km(e) ? e.ownerDocument : document : document : document;
}
const On = li ? useLayoutEffect : useEffect;
function oc(e) {
  const n = useRef(e);
  return On(() => {
    n.current = e;
  }), useCallback(function() {
    for (var r = arguments.length, o = new Array(r), s = 0; s < r; s++)
      o[s] = arguments[s];
    return n.current == null ? void 0 : n.current(...o);
  }, []);
}
function AE() {
  const e = useRef(null), n = useCallback((o, s) => {
    e.current = setInterval(o, s);
  }, []), r = useCallback(() => {
    e.current !== null && (clearInterval(e.current), e.current = null);
  }, []);
  return [n, r];
}
function sc(e, n) {
  n === void 0 && (n = [e]);
  const r = useRef(e);
  return On(() => {
    r.current !== e && (r.current = e);
  }, n), r;
}
function Ro(e, n) {
  const r = useRef();
  return useMemo(
    () => {
      const o = e(r.current);
      return r.current = o, o;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...n]
  );
}
function Ca(e) {
  const n = oc(e), r = useRef(null), o = useCallback(
    (s) => {
      s !== r.current && (n == null ? void 0 : n(s, r.current)), r.current = s;
    },
    //eslint-disable-next-line
    []
  );
  return [r, o];
}
function Sa(e) {
  const n = useRef();
  return useEffect(() => {
    n.current = e;
  }, [e]), n.current;
}
let Ai = {};
function ic(e, n) {
  return useMemo(() => {
    if (n)
      return n;
    const r = Ai[e] == null ? 0 : Ai[e] + 1;
    return Ai[e] = r, e + "-" + r;
  }, [e, n]);
}
function Om(e) {
  return function(n) {
    for (var r = arguments.length, o = new Array(r > 1 ? r - 1 : 0), s = 1; s < r; s++)
      o[s - 1] = arguments[s];
    return o.reduce((i, a) => {
      const l = Object.entries(a);
      for (const [f, u] of l) {
        const p = i[f];
        p != null && (i[f] = p + e * u);
      }
      return i;
    }, {
      ...n
    });
  };
}
const mr = /* @__PURE__ */ Om(1), Ts = /* @__PURE__ */ Om(-1);
function LE(e) {
  return "clientX" in e && "clientY" in e;
}
function Im(e) {
  if (!e)
    return false;
  const {
    KeyboardEvent: n
  } = Dt(e.target);
  return n && e instanceof n;
}
function FE(e) {
  if (!e)
    return false;
  const {
    TouchEvent: n
  } = Dt(e.target);
  return n && e instanceof n;
}
function Ra(e) {
  if (FE(e)) {
    if (e.touches && e.touches.length) {
      const {
        clientX: n,
        clientY: r
      } = e.touches[0];
      return {
        x: n,
        y: r
      };
    } else if (e.changedTouches && e.changedTouches.length) {
      const {
        clientX: n,
        clientY: r
      } = e.changedTouches[0];
      return {
        x: n,
        y: r
      };
    }
  }
  return LE(e) ? {
    x: e.clientX,
    y: e.clientY
  } : null;
}
const $u = "a,frame,iframe,input:not([type=hidden]):not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled),*[tabindex]";
function _E(e) {
  return e.matches($u) ? e : e.querySelector($u);
}
const VE = {
  display: "none"
};
function BE(e) {
  let {
    id: n,
    value: r
  } = e;
  return c__default.createElement("div", {
    id: n,
    style: VE
  }, r);
}
function $E(e) {
  let {
    id: n,
    announcement: r,
    ariaLiveType: o = "assertive"
  } = e;
  const s = {
    position: "fixed",
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    margin: -1,
    border: 0,
    padding: 0,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    clipPath: "inset(100%)",
    whiteSpace: "nowrap"
  };
  return c__default.createElement("div", {
    id: n,
    style: s,
    role: "status",
    "aria-live": o,
    "aria-atomic": true
  }, r);
}
function zE() {
  const [e, n] = useState("");
  return {
    announce: useCallback((o) => {
      o != null && n(o);
    }, []),
    announcement: e
  };
}
const Pm = /* @__PURE__ */ createContext(null);
function HE(e) {
  const n = useContext(Pm);
  useEffect(() => {
    if (!n)
      throw new Error("useDndMonitor must be used within a children of <DndContext>");
    return n(e);
  }, [e, n]);
}
function UE() {
  const [e] = useState(() => /* @__PURE__ */ new Set()), n = useCallback((o) => (e.add(o), () => e.delete(o)), [e]);
  return [useCallback((o) => {
    let {
      type: s,
      event: i
    } = o;
    e.forEach((a) => {
      var l;
      return (l = a[s]) == null ? void 0 : l.call(a, i);
    });
  }, [e]), n];
}
const WE = {
  draggable: `
    To pick up a draggable item, press the space bar.
    While dragging, use the arrow keys to move the item.
    Press space again to drop the item in its new position, or press escape to cancel.
  `
}, jE = {
  onDragStart(e) {
    let {
      active: n
    } = e;
    return "Picked up draggable item " + n.id + ".";
  },
  onDragOver(e) {
    let {
      active: n,
      over: r
    } = e;
    return r ? "Draggable item " + n.id + " was moved over droppable area " + r.id + "." : "Draggable item " + n.id + " is no longer over a droppable area.";
  },
  onDragEnd(e) {
    let {
      active: n,
      over: r
    } = e;
    return r ? "Draggable item " + n.id + " was dropped over droppable area " + r.id : "Draggable item " + n.id + " was dropped.";
  },
  onDragCancel(e) {
    let {
      active: n
    } = e;
    return "Dragging was cancelled. Draggable item " + n.id + " was dropped.";
  }
};
function KE(e) {
  let {
    announcements: n = jE,
    container: r,
    hiddenTextDescribedById: o,
    screenReaderInstructions: s = WE
  } = e;
  const {
    announce: i,
    announcement: a
  } = zE(), l = ic("DndLiveRegion"), [f, u] = useState(false);
  if (useEffect(() => {
    u(true);
  }, []), HE(useMemo(() => ({
    onDragStart(d) {
      let {
        active: g
      } = d;
      i(n.onDragStart({
        active: g
      }));
    },
    onDragMove(d) {
      let {
        active: g,
        over: m
      } = d;
      n.onDragMove && i(n.onDragMove({
        active: g,
        over: m
      }));
    },
    onDragOver(d) {
      let {
        active: g,
        over: m
      } = d;
      i(n.onDragOver({
        active: g,
        over: m
      }));
    },
    onDragEnd(d) {
      let {
        active: g,
        over: m
      } = d;
      i(n.onDragEnd({
        active: g,
        over: m
      }));
    },
    onDragCancel(d) {
      let {
        active: g,
        over: m
      } = d;
      i(n.onDragCancel({
        active: g,
        over: m
      }));
    }
  }), [i, n])), !f)
    return null;
  const p = c__default.createElement(c__default.Fragment, null, c__default.createElement(BE, {
    id: o,
    value: s.draggable
  }), c__default.createElement($E, {
    id: l,
    announcement: a
  }));
  return r ? createPortal(p, r) : p;
}
var Rt;
(function(e) {
  e.DragStart = "dragStart", e.DragMove = "dragMove", e.DragEnd = "dragEnd", e.DragCancel = "dragCancel", e.DragOver = "dragOver", e.RegisterDroppable = "registerDroppable", e.SetDroppableDisabled = "setDroppableDisabled", e.UnregisterDroppable = "unregisterDroppable";
})(Rt || (Rt = {}));
function ks() {
}
function GE(e, n) {
  return useMemo(
    () => ({
      sensor: e,
      options: n ?? {}
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [e, n]
  );
}
function YE() {
  for (var e = arguments.length, n = new Array(e), r = 0; r < e; r++)
    n[r] = arguments[r];
  return useMemo(
    () => [...n].filter((o) => o != null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...n]
  );
}
const jt = /* @__PURE__ */ Object.freeze({
  x: 0,
  y: 0
});
function qE(e, n) {
  let {
    data: {
      value: r
    }
  } = e, {
    data: {
      value: o
    }
  } = n;
  return o - r;
}
function XE(e, n) {
  if (!e || e.length === 0)
    return null;
  const [r] = e;
  return r[n];
}
function JE(e, n) {
  const r = Math.max(n.top, e.top), o = Math.max(n.left, e.left), s = Math.min(n.left + n.width, e.left + e.width), i = Math.min(n.top + n.height, e.top + e.height), a = s - o, l = i - r;
  if (o < s && r < i) {
    const f = n.width * n.height, u = e.width * e.height, p = a * l, d = p / (f + u - p);
    return Number(d.toFixed(4));
  }
  return 0;
}
const ZE = (e) => {
  let {
    collisionRect: n,
    droppableRects: r,
    droppableContainers: o
  } = e;
  const s = [];
  for (const i of o) {
    const {
      id: a
    } = i, l = r.get(a);
    if (l) {
      const f = JE(l, n);
      f > 0 && s.push({
        id: a,
        data: {
          droppableContainer: i,
          value: f
        }
      });
    }
  }
  return s.sort(qE);
};
function QE(e, n, r) {
  return {
    ...e,
    scaleX: n && r ? n.width / r.width : 1,
    scaleY: n && r ? n.height / r.height : 1
  };
}
function Mm(e, n) {
  return e && n ? {
    x: e.left - n.left,
    y: e.top - n.top
  } : jt;
}
function eC(e) {
  return function(r) {
    for (var o = arguments.length, s = new Array(o > 1 ? o - 1 : 0), i = 1; i < o; i++)
      s[i - 1] = arguments[i];
    return s.reduce((a, l) => ({
      ...a,
      top: a.top + e * l.y,
      bottom: a.bottom + e * l.y,
      left: a.left + e * l.x,
      right: a.right + e * l.x
    }), {
      ...r
    });
  };
}
const tC = /* @__PURE__ */ eC(1);
function nC(e) {
  if (e.startsWith("matrix3d(")) {
    const n = e.slice(9, -1).split(/, /);
    return {
      x: +n[12],
      y: +n[13],
      scaleX: +n[0],
      scaleY: +n[5]
    };
  } else if (e.startsWith("matrix(")) {
    const n = e.slice(7, -1).split(/, /);
    return {
      x: +n[4],
      y: +n[5],
      scaleX: +n[0],
      scaleY: +n[3]
    };
  }
  return null;
}
function rC(e, n, r) {
  const o = nC(n);
  if (!o)
    return e;
  const {
    scaleX: s,
    scaleY: i,
    x: a,
    y: l
  } = o, f = e.left - a - (1 - s) * parseFloat(r), u = e.top - l - (1 - i) * parseFloat(r.slice(r.indexOf(" ") + 1)), p = s ? e.width / s : e.width, d = i ? e.height / i : e.height;
  return {
    width: p,
    height: d,
    top: u,
    right: f + p,
    bottom: u + d,
    left: f
  };
}
const oC = {
  ignoreTransform: false
};
function No(e, n) {
  n === void 0 && (n = oC);
  let r = e.getBoundingClientRect();
  if (n.ignoreTransform) {
    const {
      transform: u,
      transformOrigin: p
    } = Dt(e).getComputedStyle(e);
    u && (r = rC(r, u, p));
  }
  const {
    top: o,
    left: s,
    width: i,
    height: a,
    bottom: l,
    right: f
  } = r;
  return {
    top: o,
    left: s,
    width: i,
    height: a,
    bottom: l,
    right: f
  };
}
function zu(e) {
  return No(e, {
    ignoreTransform: true
  });
}
function sC(e) {
  const n = e.innerWidth, r = e.innerHeight;
  return {
    top: 0,
    left: 0,
    right: n,
    bottom: r,
    width: n,
    height: r
  };
}
function iC(e, n) {
  return n === void 0 && (n = Dt(e).getComputedStyle(e)), n.position === "fixed";
}
function aC(e, n) {
  n === void 0 && (n = Dt(e).getComputedStyle(e));
  const r = /(auto|scroll|overlay)/;
  return ["overflow", "overflowX", "overflowY"].some((s) => {
    const i = n[s];
    return typeof i == "string" ? r.test(i) : false;
  });
}
function ac(e, n) {
  const r = [];
  function o(s) {
    if (n != null && r.length >= n || !s)
      return r;
    if (rc(s) && s.scrollingElement != null && !r.includes(s.scrollingElement))
      return r.push(s.scrollingElement), r;
    if (!So(s) || km(s) || r.includes(s))
      return r;
    const i = Dt(e).getComputedStyle(s);
    return s !== e && aC(s, i) && r.push(s), iC(s, i) ? r : o(s.parentNode);
  }
  return e ? o(e) : r;
}
function Dm(e) {
  const [n] = ac(e, 1);
  return n ?? null;
}
function Li(e) {
  return !li || !e ? null : Tr(e) ? e : nc(e) ? rc(e) || e === kr(e).scrollingElement ? window : So(e) ? e : null : null;
}
function Am(e) {
  return Tr(e) ? e.scrollX : e.scrollLeft;
}
function Lm(e) {
  return Tr(e) ? e.scrollY : e.scrollTop;
}
function Na(e) {
  return {
    x: Am(e),
    y: Lm(e)
  };
}
var wt;
(function(e) {
  e[e.Forward = 1] = "Forward", e[e.Backward = -1] = "Backward";
})(wt || (wt = {}));
function Fm(e) {
  return !li || !e ? false : e === document.scrollingElement;
}
function _m(e) {
  const n = {
    x: 0,
    y: 0
  }, r = Fm(e) ? {
    height: window.innerHeight,
    width: window.innerWidth
  } : {
    height: e.clientHeight,
    width: e.clientWidth
  }, o = {
    x: e.scrollWidth - r.width,
    y: e.scrollHeight - r.height
  }, s = e.scrollTop <= n.y, i = e.scrollLeft <= n.x, a = e.scrollTop >= o.y, l = e.scrollLeft >= o.x;
  return {
    isTop: s,
    isLeft: i,
    isBottom: a,
    isRight: l,
    maxScroll: o,
    minScroll: n
  };
}
const lC = {
  x: 0.2,
  y: 0.2
};
function cC(e, n, r, o, s) {
  let {
    top: i,
    left: a,
    right: l,
    bottom: f
  } = r;
  o === void 0 && (o = 10), s === void 0 && (s = lC);
  const {
    isTop: u,
    isBottom: p,
    isLeft: d,
    isRight: g
  } = _m(e), m = {
    x: 0,
    y: 0
  }, b = {
    x: 0,
    y: 0
  }, h = {
    height: n.height * s.y,
    width: n.width * s.x
  };
  return !u && i <= n.top + h.height ? (m.y = wt.Backward, b.y = o * Math.abs((n.top + h.height - i) / h.height)) : !p && f >= n.bottom - h.height && (m.y = wt.Forward, b.y = o * Math.abs((n.bottom - h.height - f) / h.height)), !g && l >= n.right - h.width ? (m.x = wt.Forward, b.x = o * Math.abs((n.right - h.width - l) / h.width)) : !d && a <= n.left + h.width && (m.x = wt.Backward, b.x = o * Math.abs((n.left + h.width - a) / h.width)), {
    direction: m,
    speed: b
  };
}
function uC(e) {
  if (e === document.scrollingElement) {
    const {
      innerWidth: i,
      innerHeight: a
    } = window;
    return {
      top: 0,
      left: 0,
      right: i,
      bottom: a,
      width: i,
      height: a
    };
  }
  const {
    top: n,
    left: r,
    right: o,
    bottom: s
  } = e.getBoundingClientRect();
  return {
    top: n,
    left: r,
    right: o,
    bottom: s,
    width: e.clientWidth,
    height: e.clientHeight
  };
}
function Vm(e) {
  return e.reduce((n, r) => mr(n, Na(r)), jt);
}
function dC(e) {
  return e.reduce((n, r) => n + Am(r), 0);
}
function fC(e) {
  return e.reduce((n, r) => n + Lm(r), 0);
}
function pC(e, n) {
  if (n === void 0 && (n = No), !e)
    return;
  const {
    top: r,
    left: o,
    bottom: s,
    right: i
  } = n(e);
  Dm(e) && (s <= 0 || i <= 0 || r >= window.innerHeight || o >= window.innerWidth) && e.scrollIntoView({
    block: "center",
    inline: "center"
  });
}
const mC = [["x", ["left", "right"], dC], ["y", ["top", "bottom"], fC]];
class lc {
  constructor(n, r) {
    this.rect = void 0, this.width = void 0, this.height = void 0, this.top = void 0, this.bottom = void 0, this.right = void 0, this.left = void 0;
    const o = ac(r), s = Vm(o);
    this.rect = {
      ...n
    }, this.width = n.width, this.height = n.height;
    for (const [i, a, l] of mC)
      for (const f of a)
        Object.defineProperty(this, f, {
          get: () => {
            const u = l(o), p = s[i] - u;
            return this.rect[f] + p;
          },
          enumerable: true
        });
    Object.defineProperty(this, "rect", {
      enumerable: false
    });
  }
}
class Wr {
  constructor(n) {
    this.target = void 0, this.listeners = [], this.removeAll = () => {
      this.listeners.forEach((r) => {
        var o;
        return (o = this.target) == null ? void 0 : o.removeEventListener(...r);
      });
    }, this.target = n;
  }
  add(n, r, o) {
    var s;
    (s = this.target) == null || s.addEventListener(n, r, o), this.listeners.push([n, r, o]);
  }
}
function gC(e) {
  const {
    EventTarget: n
  } = Dt(e);
  return e instanceof n ? e : kr(e);
}
function Fi(e, n) {
  const r = Math.abs(e.x), o = Math.abs(e.y);
  return typeof n == "number" ? Math.sqrt(r ** 2 + o ** 2) > n : "x" in n && "y" in n ? r > n.x && o > n.y : "x" in n ? r > n.x : "y" in n ? o > n.y : false;
}
var $t;
(function(e) {
  e.Click = "click", e.DragStart = "dragstart", e.Keydown = "keydown", e.ContextMenu = "contextmenu", e.Resize = "resize", e.SelectionChange = "selectionchange", e.VisibilityChange = "visibilitychange";
})($t || ($t = {}));
function Hu(e) {
  e.preventDefault();
}
function hC(e) {
  e.stopPropagation();
}
var nt;
(function(e) {
  e.Space = "Space", e.Down = "ArrowDown", e.Right = "ArrowRight", e.Left = "ArrowLeft", e.Up = "ArrowUp", e.Esc = "Escape", e.Enter = "Enter", e.Tab = "Tab";
})(nt || (nt = {}));
const Bm = {
  start: [nt.Space, nt.Enter],
  cancel: [nt.Esc],
  end: [nt.Space, nt.Enter, nt.Tab]
}, bC = (e, n) => {
  let {
    currentCoordinates: r
  } = n;
  switch (e.code) {
    case nt.Right:
      return {
        ...r,
        x: r.x + 25
      };
    case nt.Left:
      return {
        ...r,
        x: r.x - 25
      };
    case nt.Down:
      return {
        ...r,
        y: r.y + 25
      };
    case nt.Up:
      return {
        ...r,
        y: r.y - 25
      };
  }
};
class $m {
  constructor(n) {
    this.props = void 0, this.autoScrollEnabled = false, this.referenceCoordinates = void 0, this.listeners = void 0, this.windowListeners = void 0, this.props = n;
    const {
      event: {
        target: r
      }
    } = n;
    this.props = n, this.listeners = new Wr(kr(r)), this.windowListeners = new Wr(Dt(r)), this.handleKeyDown = this.handleKeyDown.bind(this), this.handleCancel = this.handleCancel.bind(this), this.attach();
  }
  attach() {
    this.handleStart(), this.windowListeners.add($t.Resize, this.handleCancel), this.windowListeners.add($t.VisibilityChange, this.handleCancel), setTimeout(() => this.listeners.add($t.Keydown, this.handleKeyDown));
  }
  handleStart() {
    const {
      activeNode: n,
      onStart: r
    } = this.props, o = n.node.current;
    o && pC(o), r(jt);
  }
  handleKeyDown(n) {
    if (Im(n)) {
      const {
        active: r,
        context: o,
        options: s
      } = this.props, {
        keyboardCodes: i = Bm,
        coordinateGetter: a = bC,
        scrollBehavior: l = "smooth"
      } = s, {
        code: f
      } = n;
      if (i.end.includes(f)) {
        this.handleEnd(n);
        return;
      }
      if (i.cancel.includes(f)) {
        this.handleCancel(n);
        return;
      }
      const {
        collisionRect: u
      } = o.current, p = u ? {
        x: u.left,
        y: u.top
      } : jt;
      this.referenceCoordinates || (this.referenceCoordinates = p);
      const d = a(n, {
        active: r,
        context: o.current,
        currentCoordinates: p
      });
      if (d) {
        const g = Ts(d, p), m = {
          x: 0,
          y: 0
        }, {
          scrollableAncestors: b
        } = o.current;
        for (const h of b) {
          const v = n.code, {
            isTop: y,
            isRight: x,
            isLeft: R,
            isBottom: S,
            maxScroll: E,
            minScroll: C
          } = _m(h), T = uC(h), N = {
            x: Math.min(v === nt.Right ? T.right - T.width / 2 : T.right, Math.max(v === nt.Right ? T.left : T.left + T.width / 2, d.x)),
            y: Math.min(v === nt.Down ? T.bottom - T.height / 2 : T.bottom, Math.max(v === nt.Down ? T.top : T.top + T.height / 2, d.y))
          }, I = v === nt.Right && !x || v === nt.Left && !R, L = v === nt.Down && !S || v === nt.Up && !y;
          if (I && N.x !== d.x) {
            const A = h.scrollLeft + g.x, P = v === nt.Right && A <= E.x || v === nt.Left && A >= C.x;
            if (P && !g.y) {
              h.scrollTo({
                left: A,
                behavior: l
              });
              return;
            }
            P ? m.x = h.scrollLeft - A : m.x = v === nt.Right ? h.scrollLeft - E.x : h.scrollLeft - C.x, m.x && h.scrollBy({
              left: -m.x,
              behavior: l
            });
            break;
          } else if (L && N.y !== d.y) {
            const A = h.scrollTop + g.y, P = v === nt.Down && A <= E.y || v === nt.Up && A >= C.y;
            if (P && !g.x) {
              h.scrollTo({
                top: A,
                behavior: l
              });
              return;
            }
            P ? m.y = h.scrollTop - A : m.y = v === nt.Down ? h.scrollTop - E.y : h.scrollTop - C.y, m.y && h.scrollBy({
              top: -m.y,
              behavior: l
            });
            break;
          }
        }
        this.handleMove(n, mr(Ts(d, this.referenceCoordinates), m));
      }
    }
  }
  handleMove(n, r) {
    const {
      onMove: o
    } = this.props;
    n.preventDefault(), o(r);
  }
  handleEnd(n) {
    const {
      onEnd: r
    } = this.props;
    n.preventDefault(), this.detach(), r();
  }
  handleCancel(n) {
    const {
      onCancel: r
    } = this.props;
    n.preventDefault(), this.detach(), r();
  }
  detach() {
    this.listeners.removeAll(), this.windowListeners.removeAll();
  }
}
$m.activators = [{
  eventName: "onKeyDown",
  handler: (e, n, r) => {
    let {
      keyboardCodes: o = Bm,
      onActivation: s
    } = n, {
      active: i
    } = r;
    const {
      code: a
    } = e.nativeEvent;
    if (o.start.includes(a)) {
      const l = i.activatorNode.current;
      return l && e.target !== l ? false : (e.preventDefault(), s == null ? void 0 : s({
        event: e.nativeEvent
      }), true);
    }
    return false;
  }
}];
function Uu(e) {
  return !!(e && "distance" in e);
}
function Wu(e) {
  return !!(e && "delay" in e);
}
class cc {
  constructor(n, r, o) {
    var s;
    o === void 0 && (o = gC(n.event.target)), this.props = void 0, this.events = void 0, this.autoScrollEnabled = true, this.document = void 0, this.activated = false, this.initialCoordinates = void 0, this.timeoutId = null, this.listeners = void 0, this.documentListeners = void 0, this.windowListeners = void 0, this.props = n, this.events = r;
    const {
      event: i
    } = n, {
      target: a
    } = i;
    this.props = n, this.events = r, this.document = kr(a), this.documentListeners = new Wr(this.document), this.listeners = new Wr(o), this.windowListeners = new Wr(Dt(a)), this.initialCoordinates = (s = Ra(i)) != null ? s : jt, this.handleStart = this.handleStart.bind(this), this.handleMove = this.handleMove.bind(this), this.handleEnd = this.handleEnd.bind(this), this.handleCancel = this.handleCancel.bind(this), this.handleKeydown = this.handleKeydown.bind(this), this.removeTextSelection = this.removeTextSelection.bind(this), this.attach();
  }
  attach() {
    const {
      events: n,
      props: {
        options: {
          activationConstraint: r,
          bypassActivationConstraint: o
        }
      }
    } = this;
    if (this.listeners.add(n.move.name, this.handleMove, {
      passive: false
    }), this.listeners.add(n.end.name, this.handleEnd), n.cancel && this.listeners.add(n.cancel.name, this.handleCancel), this.windowListeners.add($t.Resize, this.handleCancel), this.windowListeners.add($t.DragStart, Hu), this.windowListeners.add($t.VisibilityChange, this.handleCancel), this.windowListeners.add($t.ContextMenu, Hu), this.documentListeners.add($t.Keydown, this.handleKeydown), r) {
      if (o != null && o({
        event: this.props.event,
        activeNode: this.props.activeNode,
        options: this.props.options
      }))
        return this.handleStart();
      if (Wu(r)) {
        this.timeoutId = setTimeout(this.handleStart, r.delay), this.handlePending(r);
        return;
      }
      if (Uu(r)) {
        this.handlePending(r);
        return;
      }
    }
    this.handleStart();
  }
  detach() {
    this.listeners.removeAll(), this.windowListeners.removeAll(), setTimeout(this.documentListeners.removeAll, 50), this.timeoutId !== null && (clearTimeout(this.timeoutId), this.timeoutId = null);
  }
  handlePending(n, r) {
    const {
      active: o,
      onPending: s
    } = this.props;
    s(o, n, this.initialCoordinates, r);
  }
  handleStart() {
    const {
      initialCoordinates: n
    } = this, {
      onStart: r
    } = this.props;
    n && (this.activated = true, this.documentListeners.add($t.Click, hC, {
      capture: true
    }), this.removeTextSelection(), this.documentListeners.add($t.SelectionChange, this.removeTextSelection), r(n));
  }
  handleMove(n) {
    var r;
    const {
      activated: o,
      initialCoordinates: s,
      props: i
    } = this, {
      onMove: a,
      options: {
        activationConstraint: l
      }
    } = i;
    if (!s)
      return;
    const f = (r = Ra(n)) != null ? r : jt, u = Ts(s, f);
    if (!o && l) {
      if (Uu(l)) {
        if (l.tolerance != null && Fi(u, l.tolerance))
          return this.handleCancel();
        if (Fi(u, l.distance))
          return this.handleStart();
      }
      if (Wu(l) && Fi(u, l.tolerance))
        return this.handleCancel();
      this.handlePending(l, u);
      return;
    }
    n.cancelable && n.preventDefault(), a(f);
  }
  handleEnd() {
    const {
      onAbort: n,
      onEnd: r
    } = this.props;
    this.detach(), this.activated || n(this.props.active), r();
  }
  handleCancel() {
    const {
      onAbort: n,
      onCancel: r
    } = this.props;
    this.detach(), this.activated || n(this.props.active), r();
  }
  handleKeydown(n) {
    n.code === nt.Esc && this.handleCancel();
  }
  removeTextSelection() {
    var n;
    (n = this.document.getSelection()) == null || n.removeAllRanges();
  }
}
const vC = {
  cancel: {
    name: "pointercancel"
  },
  move: {
    name: "pointermove"
  },
  end: {
    name: "pointerup"
  }
};
class uc extends cc {
  constructor(n) {
    const {
      event: r
    } = n, o = kr(r.target);
    super(n, vC, o);
  }
}
uc.activators = [{
  eventName: "onPointerDown",
  handler: (e, n) => {
    let {
      nativeEvent: r
    } = e, {
      onActivation: o
    } = n;
    return !r.isPrimary || r.button !== 0 ? false : (o == null ? void 0 : o({
      event: r
    }), true);
  }
}];
const yC = {
  move: {
    name: "mousemove"
  },
  end: {
    name: "mouseup"
  }
};
var Ta;
(function(e) {
  e[e.RightClick = 2] = "RightClick";
})(Ta || (Ta = {}));
class xC extends cc {
  constructor(n) {
    super(n, yC, kr(n.event.target));
  }
}
xC.activators = [{
  eventName: "onMouseDown",
  handler: (e, n) => {
    let {
      nativeEvent: r
    } = e, {
      onActivation: o
    } = n;
    return r.button === Ta.RightClick ? false : (o == null ? void 0 : o({
      event: r
    }), true);
  }
}];
const _i = {
  cancel: {
    name: "touchcancel"
  },
  move: {
    name: "touchmove"
  },
  end: {
    name: "touchend"
  }
};
class wC extends cc {
  constructor(n) {
    super(n, _i);
  }
  static setup() {
    return window.addEventListener(_i.move.name, n, {
      capture: false,
      passive: false
    }), function() {
      window.removeEventListener(_i.move.name, n);
    };
    function n() {
    }
  }
}
wC.activators = [{
  eventName: "onTouchStart",
  handler: (e, n) => {
    let {
      nativeEvent: r
    } = e, {
      onActivation: o
    } = n;
    const {
      touches: s
    } = r;
    return s.length > 1 ? false : (o == null ? void 0 : o({
      event: r
    }), true);
  }
}];
var jr;
(function(e) {
  e[e.Pointer = 0] = "Pointer", e[e.DraggableRect = 1] = "DraggableRect";
})(jr || (jr = {}));
var Os;
(function(e) {
  e[e.TreeOrder = 0] = "TreeOrder", e[e.ReversedTreeOrder = 1] = "ReversedTreeOrder";
})(Os || (Os = {}));
function EC(e) {
  let {
    acceleration: n,
    activator: r = jr.Pointer,
    canScroll: o,
    draggingRect: s,
    enabled: i,
    interval: a = 5,
    order: l = Os.TreeOrder,
    pointerCoordinates: f,
    scrollableAncestors: u,
    scrollableAncestorRects: p,
    delta: d,
    threshold: g
  } = e;
  const m = SC({
    delta: d,
    disabled: !i
  }), [b, h] = AE(), v = useRef({
    x: 0,
    y: 0
  }), y = useRef({
    x: 0,
    y: 0
  }), x = useMemo(() => {
    switch (r) {
      case jr.Pointer:
        return f ? {
          top: f.y,
          bottom: f.y,
          left: f.x,
          right: f.x
        } : null;
      case jr.DraggableRect:
        return s;
    }
  }, [r, s, f]), R = useRef(null), S = useCallback(() => {
    const C = R.current;
    if (!C)
      return;
    const T = v.current.x * y.current.x, N = v.current.y * y.current.y;
    C.scrollBy(T, N);
  }, []), E = useMemo(() => l === Os.TreeOrder ? [...u].reverse() : u, [l, u]);
  useEffect(
    () => {
      if (!i || !u.length || !x) {
        h();
        return;
      }
      for (const C of E) {
        if ((o == null ? void 0 : o(C)) === false)
          continue;
        const T = u.indexOf(C), N = p[T];
        if (!N)
          continue;
        const {
          direction: I,
          speed: L
        } = cC(C, N, x, n, g);
        for (const A of ["x", "y"])
          m[A][I[A]] || (L[A] = 0, I[A] = 0);
        if (L.x > 0 || L.y > 0) {
          h(), R.current = C, b(S, a), v.current = L, y.current = I;
          return;
        }
      }
      v.current = {
        x: 0,
        y: 0
      }, y.current = {
        x: 0,
        y: 0
      }, h();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      n,
      S,
      o,
      h,
      i,
      a,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(x),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(m),
      b,
      u,
      E,
      p,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(g)
    ]
  );
}
const CC = {
  x: {
    [wt.Backward]: false,
    [wt.Forward]: false
  },
  y: {
    [wt.Backward]: false,
    [wt.Forward]: false
  }
};
function SC(e) {
  let {
    delta: n,
    disabled: r
  } = e;
  const o = Sa(n);
  return Ro((s) => {
    if (r || !o || !s)
      return CC;
    const i = {
      x: Math.sign(n.x - o.x),
      y: Math.sign(n.y - o.y)
    };
    return {
      x: {
        [wt.Backward]: s.x[wt.Backward] || i.x === -1,
        [wt.Forward]: s.x[wt.Forward] || i.x === 1
      },
      y: {
        [wt.Backward]: s.y[wt.Backward] || i.y === -1,
        [wt.Forward]: s.y[wt.Forward] || i.y === 1
      }
    };
  }, [r, n, o]);
}
function RC(e, n) {
  const r = n != null ? e.get(n) : void 0, o = r ? r.node.current : null;
  return Ro((s) => {
    var i;
    return n == null ? null : (i = o ?? s) != null ? i : null;
  }, [o, n]);
}
function NC(e, n) {
  return useMemo(() => e.reduce((r, o) => {
    const {
      sensor: s
    } = o, i = s.activators.map((a) => ({
      eventName: a.eventName,
      handler: n(a.handler, o)
    }));
    return [...r, ...i];
  }, []), [e, n]);
}
var oo;
(function(e) {
  e[e.Always = 0] = "Always", e[e.BeforeDragging = 1] = "BeforeDragging", e[e.WhileDragging = 2] = "WhileDragging";
})(oo || (oo = {}));
var ka;
(function(e) {
  e.Optimized = "optimized";
})(ka || (ka = {}));
const ju = /* @__PURE__ */ new Map();
function TC(e, n) {
  let {
    dragging: r,
    dependencies: o,
    config: s
  } = n;
  const [i, a] = useState(null), {
    frequency: l,
    measure: f,
    strategy: u
  } = s, p = useRef(e), d = v(), g = sc(d), m = useCallback(function(y) {
    y === void 0 && (y = []), !g.current && a((x) => x === null ? y : x.concat(y.filter((R) => !x.includes(R))));
  }, [g]), b = useRef(null), h = Ro((y) => {
    if (d && !r)
      return ju;
    if (!y || y === ju || p.current !== e || i != null) {
      const x = /* @__PURE__ */ new Map();
      for (let R of e) {
        if (!R)
          continue;
        if (i && i.length > 0 && !i.includes(R.id) && R.rect.current) {
          x.set(R.id, R.rect.current);
          continue;
        }
        const S = R.node.current, E = S ? new lc(f(S), S) : null;
        R.rect.current = E, E && x.set(R.id, E);
      }
      return x;
    }
    return y;
  }, [e, i, r, d, f]);
  return useEffect(() => {
    p.current = e;
  }, [e]), useEffect(
    () => {
      d || m();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r, d]
  ), useEffect(
    () => {
      i && i.length > 0 && a(null);
    },
    //eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(i)]
  ), useEffect(
    () => {
      d || typeof l != "number" || b.current !== null || (b.current = setTimeout(() => {
        m(), b.current = null;
      }, l));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [l, d, m, ...o]
  ), {
    droppableRects: h,
    measureDroppableContainers: m,
    measuringScheduled: i != null
  };
  function v() {
    switch (u) {
      case oo.Always:
        return false;
      case oo.BeforeDragging:
        return r;
      default:
        return !r;
    }
  }
}
function zm(e, n) {
  return Ro((r) => e ? r || (typeof n == "function" ? n(e) : e) : null, [n, e]);
}
function kC(e, n) {
  return zm(e, n);
}
function OC(e) {
  let {
    callback: n,
    disabled: r
  } = e;
  const o = oc(n), s = useMemo(() => {
    if (r || typeof window > "u" || typeof window.MutationObserver > "u")
      return;
    const {
      MutationObserver: i
    } = window;
    return new i(o);
  }, [o, r]);
  return useEffect(() => () => s == null ? void 0 : s.disconnect(), [s]), s;
}
function dc(e) {
  let {
    callback: n,
    disabled: r
  } = e;
  const o = oc(n), s = useMemo(
    () => {
      if (r || typeof window > "u" || typeof window.ResizeObserver > "u")
        return;
      const {
        ResizeObserver: i
      } = window;
      return new i(o);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r]
  );
  return useEffect(() => () => s == null ? void 0 : s.disconnect(), [s]), s;
}
function IC(e) {
  return new lc(No(e), e);
}
function Ku(e, n, r) {
  n === void 0 && (n = IC);
  const [o, s] = useState(null);
  function i() {
    s((f) => {
      if (!e)
        return null;
      if (e.isConnected === false) {
        var u;
        return (u = f ?? r) != null ? u : null;
      }
      const p = n(e);
      return JSON.stringify(f) === JSON.stringify(p) ? f : p;
    });
  }
  const a = OC({
    callback(f) {
      if (e)
        for (const u of f) {
          const {
            type: p,
            target: d
          } = u;
          if (p === "childList" && d instanceof HTMLElement && d.contains(e)) {
            i();
            break;
          }
        }
    }
  }), l = dc({
    callback: i
  });
  return On(() => {
    i(), e ? (l == null ? void 0 : l.observe(e), a == null ? void 0 : a.observe(document.body, {
      childList: true,
      subtree: true
    })) : (l == null ? void 0 : l.disconnect(), a == null ? void 0 : a.disconnect());
  }, [e]), o;
}
function PC(e) {
  const n = zm(e);
  return Mm(e, n);
}
const Gu = [];
function MC(e) {
  const n = useRef(e), r = Ro((o) => e ? o && o !== Gu && e && n.current && e.parentNode === n.current.parentNode ? o : ac(e) : Gu, [e]);
  return useEffect(() => {
    n.current = e;
  }, [e]), r;
}
function DC(e) {
  const [n, r] = useState(null), o = useRef(e), s = useCallback((i) => {
    const a = Li(i.target);
    a && r((l) => l ? (l.set(a, Na(a)), new Map(l)) : null);
  }, []);
  return useEffect(() => {
    const i = o.current;
    if (e !== i) {
      a(i);
      const l = e.map((f) => {
        const u = Li(f);
        return u ? (u.addEventListener("scroll", s, {
          passive: true
        }), [u, Na(u)]) : null;
      }).filter((f) => f != null);
      r(l.length ? new Map(l) : null), o.current = e;
    }
    return () => {
      a(e), a(i);
    };
    function a(l) {
      l.forEach((f) => {
        const u = Li(f);
        u == null ? void 0 : u.removeEventListener("scroll", s);
      });
    }
  }, [s, e]), useMemo(() => e.length ? n ? Array.from(n.values()).reduce((i, a) => mr(i, a), jt) : Vm(e) : jt, [e, n]);
}
function Yu(e, n) {
  n === void 0 && (n = []);
  const r = useRef(null);
  return useEffect(
    () => {
      r.current = null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    n
  ), useEffect(() => {
    const o = e !== jt;
    o && !r.current && (r.current = e), !o && r.current && (r.current = null);
  }, [e]), r.current ? Ts(e, r.current) : jt;
}
function AC(e) {
  useEffect(
    () => {
      if (!li)
        return;
      const n = e.map((r) => {
        let {
          sensor: o
        } = r;
        return o.setup == null ? void 0 : o.setup();
      });
      return () => {
        for (const r of n)
          r == null ? void 0 : r();
      };
    },
    // TO-DO: Sensors length could theoretically change which would not be a valid dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
    e.map((n) => {
      let {
        sensor: r
      } = n;
      return r;
    })
  );
}
function LC(e, n) {
  return useMemo(() => e.reduce((r, o) => {
    let {
      eventName: s,
      handler: i
    } = o;
    return r[s] = (a) => {
      i(a, n);
    }, r;
  }, {}), [e, n]);
}
function Hm(e) {
  return useMemo(() => e ? sC(e) : null, [e]);
}
const qu = [];
function FC(e, n) {
  n === void 0 && (n = No);
  const [r] = e, o = Hm(r ? Dt(r) : null), [s, i] = useState(qu);
  function a() {
    i(() => e.length ? e.map((f) => Fm(f) ? o : new lc(n(f), f)) : qu);
  }
  const l = dc({
    callback: a
  });
  return On(() => {
    l == null ? void 0 : l.disconnect(), a(), e.forEach((f) => l == null ? void 0 : l.observe(f));
  }, [e]), s;
}
function _C(e) {
  if (!e)
    return null;
  if (e.children.length > 1)
    return e;
  const n = e.children[0];
  return So(n) ? n : e;
}
function VC(e) {
  let {
    measure: n
  } = e;
  const [r, o] = useState(null), s = useCallback((u) => {
    for (const {
      target: p
    } of u)
      if (So(p)) {
        o((d) => {
          const g = n(p);
          return d ? {
            ...d,
            width: g.width,
            height: g.height
          } : g;
        });
        break;
      }
  }, [n]), i = dc({
    callback: s
  }), a = useCallback((u) => {
    const p = _C(u);
    i == null ? void 0 : i.disconnect(), p && (i == null ? void 0 : i.observe(p)), o(p ? n(p) : null);
  }, [n, i]), [l, f] = Ca(a);
  return useMemo(() => ({
    nodeRef: l,
    rect: r,
    setRef: f
  }), [r, l, f]);
}
const BC = [{
  sensor: uc,
  options: {}
}, {
  sensor: $m,
  options: {}
}], $C = {
  current: {}
}, ls = {
  draggable: {
    measure: zu
  },
  droppable: {
    measure: zu,
    strategy: oo.WhileDragging,
    frequency: ka.Optimized
  },
  dragOverlay: {
    measure: No
  }
};
class Kr extends Map {
  get(n) {
    var r;
    return n != null && (r = super.get(n)) != null ? r : void 0;
  }
  toArray() {
    return Array.from(this.values());
  }
  getEnabled() {
    return this.toArray().filter((n) => {
      let {
        disabled: r
      } = n;
      return !r;
    });
  }
  getNodeFor(n) {
    var r, o;
    return (r = (o = this.get(n)) == null ? void 0 : o.node.current) != null ? r : void 0;
  }
}
const zC = {
  activatorEvent: null,
  active: null,
  activeNode: null,
  activeNodeRect: null,
  collisions: null,
  containerNodeRect: null,
  draggableNodes: /* @__PURE__ */ new Map(),
  droppableRects: /* @__PURE__ */ new Map(),
  droppableContainers: /* @__PURE__ */ new Kr(),
  over: null,
  dragOverlay: {
    nodeRef: {
      current: null
    },
    rect: null,
    setRef: ks
  },
  scrollableAncestors: [],
  scrollableAncestorRects: [],
  measuringConfiguration: ls,
  measureDroppableContainers: ks,
  windowRect: null,
  measuringScheduled: false
}, HC = {
  activatorEvent: null,
  activators: [],
  active: null,
  activeNodeRect: null,
  ariaDescribedById: {
    draggable: ""
  },
  dispatch: ks,
  draggableNodes: /* @__PURE__ */ new Map(),
  over: null,
  measureDroppableContainers: ks
}, fc = /* @__PURE__ */ createContext(HC), UC = /* @__PURE__ */ createContext(zC);
function WC() {
  return {
    draggable: {
      active: null,
      initialCoordinates: {
        x: 0,
        y: 0
      },
      nodes: /* @__PURE__ */ new Map(),
      translate: {
        x: 0,
        y: 0
      }
    },
    droppable: {
      containers: new Kr()
    }
  };
}
function jC(e, n) {
  switch (n.type) {
    case Rt.DragStart:
      return {
        ...e,
        draggable: {
          ...e.draggable,
          initialCoordinates: n.initialCoordinates,
          active: n.active
        }
      };
    case Rt.DragMove:
      return e.draggable.active == null ? e : {
        ...e,
        draggable: {
          ...e.draggable,
          translate: {
            x: n.coordinates.x - e.draggable.initialCoordinates.x,
            y: n.coordinates.y - e.draggable.initialCoordinates.y
          }
        }
      };
    case Rt.DragEnd:
    case Rt.DragCancel:
      return {
        ...e,
        draggable: {
          ...e.draggable,
          active: null,
          initialCoordinates: {
            x: 0,
            y: 0
          },
          translate: {
            x: 0,
            y: 0
          }
        }
      };
    case Rt.RegisterDroppable: {
      const {
        element: r
      } = n, {
        id: o
      } = r, s = new Kr(e.droppable.containers);
      return s.set(o, r), {
        ...e,
        droppable: {
          ...e.droppable,
          containers: s
        }
      };
    }
    case Rt.SetDroppableDisabled: {
      const {
        id: r,
        key: o,
        disabled: s
      } = n, i = e.droppable.containers.get(r);
      if (!i || o !== i.key)
        return e;
      const a = new Kr(e.droppable.containers);
      return a.set(r, {
        ...i,
        disabled: s
      }), {
        ...e,
        droppable: {
          ...e.droppable,
          containers: a
        }
      };
    }
    case Rt.UnregisterDroppable: {
      const {
        id: r,
        key: o
      } = n, s = e.droppable.containers.get(r);
      if (!s || o !== s.key)
        return e;
      const i = new Kr(e.droppable.containers);
      return i.delete(r), {
        ...e,
        droppable: {
          ...e.droppable,
          containers: i
        }
      };
    }
    default:
      return e;
  }
}
function KC(e) {
  let {
    disabled: n
  } = e;
  const {
    active: r,
    activatorEvent: o,
    draggableNodes: s
  } = useContext(fc), i = Sa(o), a = Sa(r == null ? void 0 : r.id);
  return useEffect(() => {
    if (!n && !o && i && a != null) {
      if (!Im(i) || document.activeElement === i.target)
        return;
      const l = s.get(a);
      if (!l)
        return;
      const {
        activatorNode: f,
        node: u
      } = l;
      if (!f.current && !u.current)
        return;
      requestAnimationFrame(() => {
        for (const p of [f.current, u.current]) {
          if (!p)
            continue;
          const d = _E(p);
          if (d) {
            d.focus();
            break;
          }
        }
      });
    }
  }, [o, n, s, a, i]), null;
}
function GC(e, n) {
  let {
    transform: r,
    ...o
  } = n;
  return e != null && e.length ? e.reduce((s, i) => i({
    transform: s,
    ...o
  }), r) : r;
}
function YC(e) {
  return useMemo(
    () => ({
      draggable: {
        ...ls.draggable,
        ...e == null ? void 0 : e.draggable
      },
      droppable: {
        ...ls.droppable,
        ...e == null ? void 0 : e.droppable
      },
      dragOverlay: {
        ...ls.dragOverlay,
        ...e == null ? void 0 : e.dragOverlay
      }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [e == null ? void 0 : e.draggable, e == null ? void 0 : e.droppable, e == null ? void 0 : e.dragOverlay]
  );
}
function qC(e) {
  let {
    activeNode: n,
    measure: r,
    initialRect: o,
    config: s = true
  } = e;
  const i = useRef(false), {
    x: a,
    y: l
  } = typeof s == "boolean" ? {
    x: s,
    y: s
  } : s;
  On(() => {
    if (!a && !l || !n) {
      i.current = false;
      return;
    }
    if (i.current || !o)
      return;
    const u = n == null ? void 0 : n.node.current;
    if (!u || u.isConnected === false)
      return;
    const p = r(u), d = Mm(p, o);
    if (a || (d.x = 0), l || (d.y = 0), i.current = true, Math.abs(d.x) > 0 || Math.abs(d.y) > 0) {
      const g = Dm(u);
      g && g.scrollBy({
        top: d.y,
        left: d.x
      });
    }
  }, [n, a, l, o, r]);
}
const Um = /* @__PURE__ */ createContext({
  ...jt,
  scaleX: 1,
  scaleY: 1
});
var wn;
(function(e) {
  e[e.Uninitialized = 0] = "Uninitialized", e[e.Initializing = 1] = "Initializing", e[e.Initialized = 2] = "Initialized";
})(wn || (wn = {}));
const XC = /* @__PURE__ */ memo(function(n) {
  var r, o, s, i;
  let {
    id: a,
    accessibility: l,
    autoScroll: f = true,
    children: u,
    sensors: p = BC,
    collisionDetection: d = ZE,
    measuring: g,
    modifiers: m,
    ...b
  } = n;
  const h = useReducer(jC, void 0, WC), [v, y] = h, [x, R] = UE(), [S, E] = useState(wn.Uninitialized), C = S === wn.Initialized, {
    draggable: {
      active: T,
      nodes: N,
      translate: I
    },
    droppable: {
      containers: L
    }
  } = v, A = T != null ? N.get(T) : null, P = useRef({
    initial: null,
    translated: null
  }), O = useMemo(() => {
    var De;
    return T != null ? {
      id: T,
      // It's possible for the active node to unmount while dragging
      data: (De = A == null ? void 0 : A.data) != null ? De : $C,
      rect: P
    } : null;
  }, [T, A]), M = useRef(null), [D, _] = useState(null), [k, $] = useState(null), F = sc(b, Object.values(b)), z = ic("DndDescribedBy", a), Q = useMemo(() => L.getEnabled(), [L]), B = YC(g), {
    droppableRects: G,
    measureDroppableContainers: j,
    measuringScheduled: W
  } = TC(Q, {
    dragging: C,
    dependencies: [I.x, I.y],
    config: B.droppable
  }), H = RC(N, T), te = useMemo(() => k ? Ra(k) : null, [k]), J = Qe(), oe = kC(H, B.draggable.measure);
  qC({
    activeNode: T != null ? N.get(T) : null,
    config: J.layoutShiftCompensation,
    initialRect: oe,
    measure: B.draggable.measure
  });
  const ae = Ku(H, B.draggable.measure, oe), ue = Ku(H ? H.parentElement : null), fe = useRef({
    activatorEvent: null,
    active: null,
    activeNode: H,
    collisionRect: null,
    collisions: null,
    droppableRects: G,
    draggableNodes: N,
    draggingNode: null,
    draggingNodeRect: null,
    droppableContainers: L,
    over: null,
    scrollableAncestors: [],
    scrollAdjustedTranslate: null
  }), le = L.getNodeFor((r = fe.current.over) == null ? void 0 : r.id), se = VC({
    measure: B.dragOverlay.measure
  }), me = (o = se.nodeRef.current) != null ? o : H, ye = C ? (s = se.rect) != null ? s : ae : null, ne = !!(se.nodeRef.current && se.rect), re = PC(ne ? null : ae), q = Hm(me ? Dt(me) : null), U = MC(C ? le ?? H : null), V = FC(U), Y = GC(m, {
    transform: {
      x: I.x - re.x,
      y: I.y - re.y,
      scaleX: 1,
      scaleY: 1
    },
    activatorEvent: k,
    active: O,
    activeNodeRect: ae,
    containerNodeRect: ue,
    draggingNodeRect: ye,
    over: fe.current.over,
    overlayNodeRect: se.rect,
    scrollableAncestors: U,
    scrollableAncestorRects: V,
    windowRect: q
  }), ee = te ? mr(te, I) : null, he = DC(U), Me = Yu(he), Ue = Yu(he, [ae]), Le = mr(Y, Me), _e = ye ? tC(ye, Y) : null, xe = O && _e ? d({
    active: O,
    collisionRect: _e,
    droppableRects: G,
    droppableContainers: Q,
    pointerCoordinates: ee
  }) : null, Ee = XE(xe, "id"), [Re, We] = useState(null), Ce = ne ? Y : mr(Y, Ue), Ie = QE(Ce, (i = Re == null ? void 0 : Re.rect) != null ? i : null, ae), je = useRef(null), lt = useCallback(
    (De, Ge) => {
      let {
        sensor: pe,
        options: Be
      } = Ge;
      if (M.current == null)
        return;
      const Ve = N.get(M.current);
      if (!Ve)
        return;
      const $e = De.nativeEvent, ot = new pe({
        active: M.current,
        activeNode: Ve,
        event: $e,
        options: Be,
        // Sensors need to be instantiated with refs for arguments that change over time
        // otherwise they are frozen in time with the stale arguments
        context: fe,
        onAbort(ge) {
          if (!N.get(ge))
            return;
          const {
            onDragAbort: Fe
          } = F.current, ze = {
            id: ge
          };
          Fe == null ? void 0 : Fe(ze), x({
            type: "onDragAbort",
            event: ze
          });
        },
        onPending(ge, Oe, Fe, ze) {
          if (!N.get(ge))
            return;
          const {
            onDragPending: at
          } = F.current, Bt = {
            id: ge,
            constraint: Oe,
            initialCoordinates: Fe,
            offset: ze
          };
          at == null ? void 0 : at(Bt), x({
            type: "onDragPending",
            event: Bt
          });
        },
        onStart(ge) {
          const Oe = M.current;
          if (Oe == null)
            return;
          const Fe = N.get(Oe);
          if (!Fe)
            return;
          const {
            onDragStart: ze
          } = F.current, et = {
            activatorEvent: $e,
            active: {
              id: Oe,
              data: Fe.data,
              rect: P
            }
          };
          unstable_batchedUpdates(() => {
            ze == null ? void 0 : ze(et), E(wn.Initializing), y({
              type: Rt.DragStart,
              initialCoordinates: ge,
              active: Oe
            }), x({
              type: "onDragStart",
              event: et
            }), _(je.current), $($e);
          });
        },
        onMove(ge) {
          y({
            type: Rt.DragMove,
            coordinates: ge
          });
        },
        onEnd: Xe(Rt.DragEnd),
        onCancel: Xe(Rt.DragCancel)
      });
      je.current = ot;
      function Xe(ge) {
        return async function() {
          const {
            active: Fe,
            collisions: ze,
            over: et,
            scrollAdjustedTranslate: at
          } = fe.current;
          let Bt = null;
          if (Fe && at) {
            const {
              cancelDrop: $n
            } = F.current;
            Bt = {
              activatorEvent: $e,
              active: Fe,
              collisions: ze,
              delta: at,
              over: et
            }, ge === Rt.DragEnd && typeof $n == "function" && await Promise.resolve($n(Bt)) && (ge = Rt.DragCancel);
          }
          M.current = null, unstable_batchedUpdates(() => {
            y({
              type: ge
            }), E(wn.Uninitialized), We(null), _(null), $(null), je.current = null;
            const $n = ge === Rt.DragEnd ? "onDragEnd" : "onDragCancel";
            if (Bt) {
              const gi = F.current[$n];
              gi == null ? void 0 : gi(Bt), x({
                type: $n,
                event: Bt
              });
            }
          });
        };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [N]
  ), Ne = useCallback((De, Ge) => (pe, Be) => {
    const Ve = pe.nativeEvent, $e = N.get(Be);
    if (
      // Another sensor is already instantiating
      M.current !== null || // No active draggable
      !$e || // Event has already been captured
      Ve.dndKit || Ve.defaultPrevented
    )
      return;
    const ot = {
      active: $e
    };
    De(pe, Ge.options, ot) === true && (Ve.dndKit = {
      capturedBy: Ge.sensor
    }, M.current = Be, lt(pe, Ge));
  }, [N, lt]), Ye = NC(p, Ne);
  AC(p), On(() => {
    ae && S === wn.Initializing && E(wn.Initialized);
  }, [ae, S]), useEffect(
    () => {
      const {
        onDragMove: De
      } = F.current, {
        active: Ge,
        activatorEvent: pe,
        collisions: Be,
        over: Ve
      } = fe.current;
      if (!Ge || !pe)
        return;
      const $e = {
        active: Ge,
        activatorEvent: pe,
        collisions: Be,
        delta: {
          x: Le.x,
          y: Le.y
        },
        over: Ve
      };
      unstable_batchedUpdates(() => {
        De == null ? void 0 : De($e), x({
          type: "onDragMove",
          event: $e
        });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Le.x, Le.y]
  ), useEffect(
    () => {
      const {
        active: De,
        activatorEvent: Ge,
        collisions: pe,
        droppableContainers: Be,
        scrollAdjustedTranslate: Ve
      } = fe.current;
      if (!De || M.current == null || !Ge || !Ve)
        return;
      const {
        onDragOver: $e
      } = F.current, ot = Be.get(Ee), Xe = ot && ot.rect.current ? {
        id: ot.id,
        rect: ot.rect.current,
        data: ot.data,
        disabled: ot.disabled
      } : null, ge = {
        active: De,
        activatorEvent: Ge,
        collisions: pe,
        delta: {
          x: Ve.x,
          y: Ve.y
        },
        over: Xe
      };
      unstable_batchedUpdates(() => {
        We(Xe), $e == null ? void 0 : $e(ge), x({
          type: "onDragOver",
          event: ge
        });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Ee]
  ), On(() => {
    fe.current = {
      activatorEvent: k,
      active: O,
      activeNode: H,
      collisionRect: _e,
      collisions: xe,
      droppableRects: G,
      draggableNodes: N,
      draggingNode: me,
      draggingNodeRect: ye,
      droppableContainers: L,
      over: Re,
      scrollableAncestors: U,
      scrollAdjustedTranslate: Le
    }, P.current = {
      initial: ye,
      translated: _e
    };
  }, [O, H, xe, _e, N, me, ye, G, L, Re, U, Le]), EC({
    ...J,
    delta: I,
    draggingRect: _e,
    pointerCoordinates: ee,
    scrollableAncestors: U,
    scrollableAncestorRects: V
  });
  const qe = useMemo(() => ({
    active: O,
    activeNode: H,
    activeNodeRect: ae,
    activatorEvent: k,
    collisions: xe,
    containerNodeRect: ue,
    dragOverlay: se,
    draggableNodes: N,
    droppableContainers: L,
    droppableRects: G,
    over: Re,
    measureDroppableContainers: j,
    scrollableAncestors: U,
    scrollableAncestorRects: V,
    measuringConfiguration: B,
    measuringScheduled: W,
    windowRect: q
  }), [O, H, ae, k, xe, ue, se, N, L, G, Re, j, U, V, B, W, q]), rt = useMemo(() => ({
    activatorEvent: k,
    activators: Ye,
    active: O,
    activeNodeRect: ae,
    ariaDescribedById: {
      draggable: z
    },
    dispatch: y,
    draggableNodes: N,
    over: Re,
    measureDroppableContainers: j
  }), [k, Ye, O, ae, y, z, N, Re, j]);
  return c__default.createElement(Pm.Provider, {
    value: R
  }, c__default.createElement(fc.Provider, {
    value: rt
  }, c__default.createElement(UC.Provider, {
    value: qe
  }, c__default.createElement(Um.Provider, {
    value: Ie
  }, u)), c__default.createElement(KC, {
    disabled: (l == null ? void 0 : l.restoreFocus) === false
  })), c__default.createElement(KE, {
    ...l,
    hiddenTextDescribedById: z
  }));
  function Qe() {
    const De = (D == null ? void 0 : D.autoScrollEnabled) === false, Ge = typeof f == "object" ? f.enabled === false : f === false, pe = C && !De && !Ge;
    return typeof f == "object" ? {
      ...f,
      enabled: pe
    } : {
      enabled: pe
    };
  }
}), JC = /* @__PURE__ */ createContext(null), Xu = "button", ZC = "Draggable";
function QC(e) {
  let {
    id: n,
    data: r,
    disabled: o = false,
    attributes: s
  } = e;
  const i = ic(ZC), {
    activators: a,
    activatorEvent: l,
    active: f,
    activeNodeRect: u,
    ariaDescribedById: p,
    draggableNodes: d,
    over: g
  } = useContext(fc), {
    role: m = Xu,
    roleDescription: b = "draggable",
    tabIndex: h = 0
  } = s ?? {}, v = (f == null ? void 0 : f.id) === n, y = useContext(v ? Um : JC), [x, R] = Ca(), [S, E] = Ca(), C = LC(a, n), T = sc(r);
  On(
    () => (d.set(n, {
      id: n,
      key: i,
      node: x,
      activatorNode: S,
      data: T
    }), () => {
      const I = d.get(n);
      I && I.key === i && d.delete(n);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, n]
  );
  const N = useMemo(() => ({
    role: m,
    tabIndex: h,
    "aria-disabled": o,
    "aria-pressed": v && m === Xu ? true : void 0,
    "aria-roledescription": b,
    "aria-describedby": p.draggable
  }), [o, m, h, v, b, p.draggable]);
  return {
    active: f,
    activatorEvent: l,
    activeNodeRect: u,
    attributes: N,
    isDragging: v,
    listeners: o ? void 0 : C,
    node: x,
    over: g,
    setNodeRef: R,
    setActivatorNodeRef: E,
    transform: y
  };
}
function eS(e, n, r) {
  const o = {
    ...e
  };
  return n.top + e.y <= r.top ? o.y = r.top - n.top : n.bottom + e.y >= r.top + r.height && (o.y = r.top + r.height - n.bottom), n.left + e.x <= r.left ? o.x = r.left - n.left : n.right + e.x >= r.left + r.width && (o.x = r.left + r.width - n.right), o;
}
const tS = (e) => {
  let {
    transform: n,
    draggingNodeRect: r,
    windowRect: o
  } = e;
  return !r || !o ? n : eS(n, r, o);
}, nS = (e) => {
  var _a2, _b2, _c2, _d2;
  if (typeof e.type == "string")
    return e.type === "button";
  if (typeof e.type == "function") {
    const n = e.type, r = n.displayName ?? n.name ?? "";
    return /button/i.test(r);
  }
  if (typeof e.type == "object" && e.type !== null) {
    const n = e.type, r = n.displayName ?? ((_a2 = n.render) == null ? void 0 : _a2.displayName) ?? ((_b2 = n.render) == null ? void 0 : _b2.name) ?? ((_c2 = n.type) == null ? void 0 : _c2.displayName) ?? ((_d2 = n.type) == null ? void 0 : _d2.name) ?? "";
    return /button/i.test(r);
  }
  return false;
}, rS = c.forwardRef(
  ({
    children: e,
    draggable: n,
    className: r,
    style: o,
    descriptionId: s,
    ...i
  }, a) => {
    const [l, f] = c.useState({ x: 0, y: 0 }), { attributes: u, listeners: p, setNodeRef: d, transform: g, isDragging: m } = QC({
      id: "modal-drag",
      disabled: !n
    }), b = YE(
      GE(uc, {
        activationConstraint: {
          distance: 5
        }
      })
    ), h = (R) => {
      R.delta && f((S) => ({
        x: S.x + R.delta.x,
        y: S.y + R.delta.y
      }));
    }, v = {
      x: l.x + ((g == null ? void 0 : g.x) ?? 0),
      y: l.y + ((g == null ? void 0 : g.y) ?? 0)
    }, y = {
      transform: `translate(calc(-50% + ${v.x}px), calc(-50% + ${v.y}px))`,
      cursor: m ? "grabbing" : void 0,
      ...o
    };
    return /* @__PURE__ */ jsx(
      XC,
      {
        sensors: b,
        onDragEnd: h,
        modifiers: [tS],
        children: /* @__PURE__ */ jsx(
          El,
          {
            ref: (R) => {
              d(R), typeof a == "function" ? a(R) : a && (a.current = R);
            },
            "aria-describedby": s,
            "data-gxp-top-layer": "true",
            className: X(
              "fixed z-modal flex flex-col gap-0 bg-background",
              !n && "duration-200",
              !n && "data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0",
              !n && "bottom-0 left-0 right-0 w-full h-[90vh] rounded-t-xl border-t border-border",
              !n && "data-[closed]:slide-out-to-bottom data-[open]:slide-in-from-bottom",
              n && "left-[50%] top-[50%] h-auto max-h-[90vh] w-[90vw] max-w-lg rounded-[var(--radius,0.5rem)] border border-border",
              !n && "sm:left-[50%] sm:top-[50%] sm:bottom-auto sm:right-auto sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-[var(--radius,0.5rem)] sm:border sm:border-border",
              !n && "sm:data-[closed]:zoom-out-95 sm:data-[open]:zoom-in-95",
              !n && "sm:data-[closed]:slide-out-to-left-1/2 sm:data-[closed]:slide-out-to-top-[48%]",
              !n && "sm:data-[open]:slide-in-from-left-1/2 sm:data-[open]:slide-in-from-top-[48%]",
              r
            ),
            style: y,
            ...i,
            children: c.Children.map(e, (R) => c.isValidElement(R) && R.props["data-drag-handle"] ? c.cloneElement(R, {
              ...u,
              ...p
            }) : R)
          }
        )
      }
    );
  }
), To = c.memo(
  c.forwardRef(
    ({
      children: e,
      trigger: n,
      title: r,
      description: o,
      footer: s,
      footerClassName: i,
      className: a,
      contentClassName: l,
      open: f,
      onOpenChange: u,
      onClose: p,
      defaultOpen: d,
      draggable: g = true,
      ...m
    }, b) => {
      const [h, v] = c.useState(
        d || false
      ), y = f !== void 0, x = y ? f : h, R = (T, N) => {
        y || v(T), u == null ? void 0 : u(T, N), !T && p && p();
      }, S = c.useId(), E = o || S, C = /* @__PURE__ */ jsx(
        "div",
        {
          "data-testid": "modal-header",
          ...g ? { role: "button", "aria-label": "Drag modal", tabIndex: 0 } : {},
          "data-drag-handle": g ? "true" : void 0,
          className: X(
            "relative flex flex-col space-y-1.5 border-b border-border bg-card/50 flex-shrink-0",
            g && "cursor-move",
            m.noPadding ? "p-1" : "p-[var(--ui-component-padding-y)]"
          ),
          children: /* @__PURE__ */ jsxs("div", { className: "relative z-10 w-full", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
              /* @__PURE__ */ jsx(
                Sl,
                {
                  className: X(
                    "text-lg font-semibold leading-none tracking-tight text-foreground",
                    !r && "sr-only"
                  ),
                  children: r || "Dialog"
                }
              ),
              /* @__PURE__ */ jsxs(xl, { className: "rounded-full p-1 opacity-70 ring-offset-background transition-all hover:opacity-100 hover:bg-accent focus:outline-none disabled:pointer-events-none cursor-pointer", children: [
                /* @__PURE__ */ jsx(Er, { className: "h-5 w-5 text-foreground" }),
                /* @__PURE__ */ jsx("span", { className: "sr-only", children: "Close" })
              ] })
            ] }),
            o ? /* @__PURE__ */ jsx(
              Hr,
              {
                id: E,
                className: "text-sm text-muted-foreground mt-1.5",
                children: o
              }
            ) : /* @__PURE__ */ jsx(Hr, { id: E, className: "sr-only", children: "Dialog Content" })
          ] })
        }
      );
      return /* @__PURE__ */ jsxs(Hp, { open: x, onOpenChange: R, ...m, children: [
        n && (c.isValidElement(n) ? /* @__PURE__ */ jsx(
          xa,
          {
            render: n,
            nativeButton: nS(n)
          }
        ) : /* @__PURE__ */ jsx(xa, { children: n })),
        /* @__PURE__ */ jsxs(Cl, { children: [
          /* @__PURE__ */ jsx(yl, { className: "fixed inset-0 z-backdrop bg-black/50 backdrop-blur-sm data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0" }),
          /* @__PURE__ */ jsxs(
            rS,
            {
              ref: b,
              draggable: g,
              className: a,
              descriptionId: E,
              children: [
                !m.noHeader && C,
                m.noHeader && /* @__PURE__ */ jsx(Hr, { id: E, className: "sr-only", children: "Dialog Content" }),
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: X(
                      "flex-1 overflow-y-auto",
                      m.noPadding ? "p-0" : "p-[var(--ui-modal-padding)]",
                      l
                    ),
                    children: e
                  }
                ),
                s && /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: X(
                      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 bg-background flex-shrink-0",
                      "p-[var(--ui-component-padding-y)]",
                      i
                    ),
                    children: s
                  }
                )
              ]
            }
          )
        ] })
      ] });
    }
  )
);
To.displayName = "Modal";
const Wm = wr("rounded-lg border shadow-sm", {
  variants: {
    variant: {
      default: "bg-card text-card-foreground border-border",
      destructive: "border-destructive/50 bg-destructive/10 text-destructive-foreground border-2",
      warning: "border-warning/50 bg-warning/10 text-warning-foreground border-2"
    }
  },
  defaultVariants: {
    variant: "default"
  }
}), sS = c.memo(
  c.forwardRef(
    ({ className: e, variant: n, ...r }, o) => /* @__PURE__ */ jsx(
      "div",
      {
        ref: o,
        className: X(Wm({ variant: n }), e),
        ...r
      }
    )
  )
);
sS.displayName = "Card";
const iS = c.memo(
  c.forwardRef(
    ({ className: e, ...n }, r) => /* @__PURE__ */ jsx(
      "div",
      {
        ref: r,
        className: X(
          "flex flex-col space-y-1.5 p-[var(--ui-card-padding)]",
          e
        ),
        ...n
      }
    )
  )
);
iS.displayName = "CardHeader";
const aS = c.memo(
  c.forwardRef(
    ({ className: e, ...n }, r) => /* @__PURE__ */ jsx(
      "div",
      {
        ref: r,
        className: X(
          "text-2xl font-semibold leading-none tracking-tight text-foreground",
          e
        ),
        ...n
      }
    )
  )
);
aS.displayName = "CardTitle";
const lS = c.memo(
  c.forwardRef(
    ({ className: e, ...n }, r) => /* @__PURE__ */ jsx(
      "div",
      {
        ref: r,
        className: X("text-sm text-muted-foreground", e),
        ...n
      }
    )
  )
);
lS.displayName = "CardDescription";
const cS = c.memo(
  c.forwardRef(
    ({ className: e, ...n }, r) => /* @__PURE__ */ jsx(
      "div",
      {
        ref: r,
        className: X("p-[var(--ui-card-padding)] pt-0", e),
        ...n
      }
    )
  )
);
cS.displayName = "CardContent";
const uS = c.memo(
  c.forwardRef(
    ({ className: e, ...n }, r) => /* @__PURE__ */ jsx(
      "div",
      {
        ref: r,
        className: X(
          "flex items-center p-[var(--ui-card-padding)] pt-0",
          e
        ),
        ...n
      }
    )
  )
);
uS.displayName = "CardFooter";
c.memo(
  ({
    isOpen: e,
    onOpen: n,
    onClose: r,
    title: o = "chatbot",
    buttonLabel: s = "Chatbot",
    children: i,
    className: a,
    panelClassName: l,
    bodyClassName: f,
    buttonClassName: u,
    footer: p,
    footerClassName: d,
    bodyRef: g
  }) => /* @__PURE__ */ jsxs(
    "div",
    {
      className: X(
        "fixed bottom-4 right-4 z-modal flex flex-col items-end gap-3",
        a
      ),
      children: [
        e && /* @__PURE__ */ jsxs(
          "div",
          {
            className: X(
              "flex w-[320px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-border/70 bg-background shadow-[0_18px_40px_rgba(15,23,42,0.22)]",
              l
            ),
            children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-3", children: [
                /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold text-foreground", children: o }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: r,
                    className: "rounded-full border border-border/70 bg-background/80 p-1 text-muted-foreground transition hover:text-foreground",
                    "aria-label": "チャットを閉じる",
                    children: /* @__PURE__ */ jsx(Er, { className: "h-4 w-4" })
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs(
                "div",
                {
                  ref: g,
                  className: X("flex-1 overflow-y-auto px-4 py-3", f),
                  children: [
                    i,
                    p && /* @__PURE__ */ jsx(
                      "div",
                      {
                        className: X(
                          "mt-4 -mx-4 border-t border-border/60 bg-background/50 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/50",
                          d
                        ),
                        children: p
                      }
                    )
                  ]
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: e ? r : n,
            className: X(
              "inline-flex items-center gap-2 rounded-full border border-border/70 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_12px_28px_rgba(15,23,42,0.25)] transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              u
            ),
            "aria-expanded": e,
            "aria-label": "チャットを開閉",
            children: [
              /* @__PURE__ */ jsx(Jh, { className: "h-4 w-4" }),
              s
            ]
          }
        )
      ]
    }
  )
);
const dS = c.memo(
  c.forwardRef(
    ({
      id: e,
      checked: n,
      onChange: r,
      label: o,
      className: s,
      disabled: i = false,
      variant: a = "default"
    }, l) => {
      const f = (u) => {
        r(u.target.checked);
      };
      return a === "card" ? /* @__PURE__ */ jsxs(
        "label",
        {
          className: X(
            Wm({ variant: "default" }),
            "w-full flex items-center gap-3 p-[var(--ui-component-padding-x)] transition-all min-h-[var(--ui-component-height)] cursor-pointer",
            n ? "border-theme-success/50" : "hover:bg-muted",
            i && "opacity-50 cursor-not-allowed",
            s
          ),
          children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                ref: l,
                id: e,
                type: "checkbox",
                checked: n,
                onChange: f,
                disabled: i,
                className: "sr-only"
              }
            ),
            /* @__PURE__ */ jsx(
              "div",
              {
                className: X(
                  "text-[length:calc(var(--ui-checkbox-size)*1.5)] flex-shrink-0 transition-colors",
                  n ? "text-success" : "text-theme-border"
                ),
                children: n ? /* @__PURE__ */ jsx(_h, { size: "1em" }) : /* @__PURE__ */ jsx(zh, { size: "1em" })
              }
            ),
            /* @__PURE__ */ jsx(
              "span",
              {
                className: X(
                  "text-ui font-medium",
                  n ? "text-foreground" : "text-muted-foreground"
                ),
                children: o
              }
            )
          ]
        }
      ) : /* @__PURE__ */ jsxs(
        "label",
        {
          className: X(
            "flex items-center gap-2 min-h-[44px] cursor-pointer hover:bg-accent rounded px-2",
            i && "opacity-50 cursor-not-allowed",
            s
          ),
          children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                ref: l,
                id: e,
                type: "checkbox",
                checked: n,
                onChange: f,
                disabled: i,
                className: "w-[var(--ui-checkbox-size)] h-[var(--ui-checkbox-size)] rounded border-2 border-border text-accent-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed"
              }
            ),
            /* @__PURE__ */ jsx("span", { className: "text-ui select-none text-foreground", children: o })
          ]
        }
      );
    }
  )
);
dS.displayName = "Checkbox";
const fS = c.forwardRef(({ className: e, children: n, ...r }, o) => /* @__PURE__ */ jsx(
  Np,
  {
    ref: o,
    keepMounted: true,
    className: X(
      "overflow-hidden data-[closed]:animate-accordion-up data-[open]:animate-accordion-down [&[hidden]]:block",
      e
    ),
    ...r,
    children: n
  }
));
fS.displayName = "CollapsibleContent";
var Ju = 1, pS = 0.9, mS = 0.8, gS = 0.17, Vi = 0.1, Bi = 0.999, hS = 0.9999, bS = 0.99, vS = /[\\\/_+.#"@\[\(\{&]/, yS = /[\\\/_+.#"@\[\(\{&]/g, xS = /[\s-]/, jm = /[\s-]/g;
function Oa(e, n, r, o, s, i, a) {
  if (i === n.length) return s === e.length ? Ju : bS;
  var l = `${s},${i}`;
  if (a[l] !== void 0) return a[l];
  for (var f = o.charAt(i), u = r.indexOf(f, s), p = 0, d, g, m, b; u >= 0; ) d = Oa(e, n, r, o, u + 1, i + 1, a), d > p && (u === s ? d *= Ju : vS.test(e.charAt(u - 1)) ? (d *= mS, m = e.slice(s, u - 1).match(yS), m && s > 0 && (d *= Math.pow(Bi, m.length))) : xS.test(e.charAt(u - 1)) ? (d *= pS, b = e.slice(s, u - 1).match(jm), b && s > 0 && (d *= Math.pow(Bi, b.length))) : (d *= gS, s > 0 && (d *= Math.pow(Bi, u - s))), e.charAt(u) !== n.charAt(i) && (d *= hS)), (d < Vi && r.charAt(u - 1) === o.charAt(i + 1) || o.charAt(i + 1) === o.charAt(i) && r.charAt(u - 1) !== o.charAt(i)) && (g = Oa(e, n, r, o, u + 1, i + 2, a), g * Vi > d && (d = g * Vi)), d > p && (p = d), u = r.indexOf(f, u + 1);
  return a[l] = p, p;
}
function Zu(e) {
  return e.toLowerCase().replace(jm, " ");
}
function wS(e, n, r) {
  return e = r && r.length > 0 ? `${e + " " + r.join(" ")}` : e, Oa(e, n, Zu(e), Zu(n), 0, 0, {});
}
function Rn(e, n, { checkForDefaultPrevented: r = true } = {}) {
  return function(s) {
    if (e == null ? void 0 : e(s), r === false || !s.defaultPrevented)
      return n == null ? void 0 : n(s);
  };
}
function Qu(e, n) {
  if (typeof e == "function")
    return e(n);
  e != null && (e.current = n);
}
function qn(...e) {
  return (n) => {
    let r = false;
    const o = e.map((s) => {
      const i = Qu(s, n);
      return !r && typeof i == "function" && (r = true), i;
    });
    if (r)
      return () => {
        for (let s = 0; s < o.length; s++) {
          const i = o[s];
          typeof i == "function" ? i() : Qu(e[s], null);
        }
      };
  };
}
function nr(...e) {
  return c.useCallback(qn(...e), e);
}
function ES(e, n) {
  const r = c.createContext(n), o = (i) => {
    const { children: a, ...l } = i, f = c.useMemo(() => l, Object.values(l));
    return /* @__PURE__ */ jsx(r.Provider, { value: f, children: a });
  };
  o.displayName = e + "Provider";
  function s(i) {
    const a = c.useContext(r);
    if (a) return a;
    if (n !== void 0) return n;
    throw new Error(`\`${i}\` must be used within \`${e}\``);
  }
  return [o, s];
}
function CS(e, n = []) {
  let r = [];
  function o(i, a) {
    const l = c.createContext(a), f = r.length;
    r = [...r, a];
    const u = (d) => {
      var _a2;
      const { scope: g, children: m, ...b } = d, h = ((_a2 = g == null ? void 0 : g[e]) == null ? void 0 : _a2[f]) || l, v = c.useMemo(() => b, Object.values(b));
      return /* @__PURE__ */ jsx(h.Provider, { value: v, children: m });
    };
    u.displayName = i + "Provider";
    function p(d, g) {
      var _a2;
      const m = ((_a2 = g == null ? void 0 : g[e]) == null ? void 0 : _a2[f]) || l, b = c.useContext(m);
      if (b) return b;
      if (a !== void 0) return a;
      throw new Error(`\`${d}\` must be used within \`${i}\``);
    }
    return [u, p];
  }
  const s = () => {
    const i = r.map((a) => c.createContext(a));
    return function(l) {
      const f = (l == null ? void 0 : l[e]) || i;
      return c.useMemo(
        () => ({ [`__scope${e}`]: { ...l, [e]: f } }),
        [l, f]
      );
    };
  };
  return s.scopeName = e, [o, SS(s, ...n)];
}
function SS(...e) {
  const n = e[0];
  if (e.length === 1) return n;
  const r = () => {
    const o = e.map((s) => ({
      useScope: s(),
      scopeName: s.scopeName
    }));
    return function(i) {
      const a = o.reduce((l, { useScope: f, scopeName: u }) => {
        const d = f(i)[`__scope${u}`];
        return { ...l, ...d };
      }, {});
      return c.useMemo(() => ({ [`__scope${n.scopeName}`]: a }), [a]);
    };
  };
  return r.scopeName = n.scopeName, r;
}
var so = (globalThis == null ? void 0 : globalThis.document) ? c.useLayoutEffect : () => {
}, RS = c[" useId ".trim().toString()] || (() => {
}), NS = 0;
function pn(e) {
  const [n, r] = c.useState(RS());
  return so(() => {
    r((o) => o ?? String(NS++));
  }, [e]), n ? `radix-${n}` : "";
}
var TS = c[" useInsertionEffect ".trim().toString()] || so;
function kS({
  prop: e,
  defaultProp: n,
  onChange: r = () => {
  },
  caller: o
}) {
  const [s, i, a] = OS({
    defaultProp: n,
    onChange: r
  }), l = e !== void 0, f = l ? e : s;
  {
    const p = c.useRef(e !== void 0);
    c.useEffect(() => {
      const d = p.current;
      d !== l && console.warn(
        `${o} is changing from ${d ? "controlled" : "uncontrolled"} to ${l ? "controlled" : "uncontrolled"}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`
      ), p.current = l;
    }, [l, o]);
  }
  const u = c.useCallback(
    (p) => {
      var _a2;
      if (l) {
        const d = IS(p) ? p(e) : p;
        d !== e && ((_a2 = a.current) == null ? void 0 : _a2.call(a, d));
      } else
        i(p);
    },
    [l, e, i, a]
  );
  return [f, u];
}
function OS({
  defaultProp: e,
  onChange: n
}) {
  const [r, o] = c.useState(e), s = c.useRef(r), i = c.useRef(n);
  return TS(() => {
    i.current = n;
  }, [n]), c.useEffect(() => {
    var _a2;
    s.current !== r && ((_a2 = i.current) == null ? void 0 : _a2.call(i, r), s.current = r);
  }, [r, s]), [r, o, i];
}
function IS(e) {
  return typeof e == "function";
}
// @__NO_SIDE_EFFECTS__
function Km(e) {
  const n = /* @__PURE__ */ PS(e), r = c.forwardRef((o, s) => {
    const { children: i, ...a } = o, l = c.Children.toArray(i), f = l.find(DS);
    if (f) {
      const u = f.props.children, p = l.map((d) => d === f ? c.Children.count(u) > 1 ? c.Children.only(null) : c.isValidElement(u) ? u.props.children : null : d);
      return /* @__PURE__ */ jsx(n, { ...a, ref: s, children: c.isValidElement(u) ? c.cloneElement(u, void 0, p) : null });
    }
    return /* @__PURE__ */ jsx(n, { ...a, ref: s, children: i });
  });
  return r.displayName = `${e}.Slot`, r;
}
// @__NO_SIDE_EFFECTS__
function PS(e) {
  const n = c.forwardRef((r, o) => {
    const { children: s, ...i } = r;
    if (c.isValidElement(s)) {
      const a = LS(s), l = AS(i, s.props);
      return s.type !== c.Fragment && (l.ref = o ? qn(o, a) : a), c.cloneElement(s, l);
    }
    return c.Children.count(s) > 1 ? c.Children.only(null) : null;
  });
  return n.displayName = `${e}.SlotClone`, n;
}
var MS = /* @__PURE__ */ Symbol("radix.slottable");
function DS(e) {
  return c.isValidElement(e) && typeof e.type == "function" && "__radixId" in e.type && e.type.__radixId === MS;
}
function AS(e, n) {
  const r = { ...n };
  for (const o in n) {
    const s = e[o], i = n[o];
    /^on[A-Z]/.test(o) ? s && i ? r[o] = (...l) => {
      const f = i(...l);
      return s(...l), f;
    } : s && (r[o] = s) : o === "style" ? r[o] = { ...s, ...i } : o === "className" && (r[o] = [s, i].filter(Boolean).join(" "));
  }
  return { ...e, ...r };
}
function LS(e) {
  var _a2, _b2;
  let n = (_a2 = Object.getOwnPropertyDescriptor(e.props, "ref")) == null ? void 0 : _a2.get, r = n && "isReactWarning" in n && n.isReactWarning;
  return r ? e.ref : (n = (_b2 = Object.getOwnPropertyDescriptor(e, "ref")) == null ? void 0 : _b2.get, r = n && "isReactWarning" in n && n.isReactWarning, r ? e.props.ref : e.props.ref || e.ref);
}
var FS = [
  "a",
  "button",
  "div",
  "form",
  "h2",
  "h3",
  "img",
  "input",
  "label",
  "li",
  "nav",
  "ol",
  "p",
  "select",
  "span",
  "svg",
  "ul"
], Ct = FS.reduce((e, n) => {
  const r = /* @__PURE__ */ Km(`Primitive.${n}`), o = c.forwardRef((s, i) => {
    const { asChild: a, ...l } = s, f = a ? r : n;
    return typeof window < "u" && (window[/* @__PURE__ */ Symbol.for("radix-ui")] = true), /* @__PURE__ */ jsx(f, { ...l, ref: i });
  });
  return o.displayName = `Primitive.${n}`, { ...e, [n]: o };
}, {});
function _S(e, n) {
  e && Tt.flushSync(() => e.dispatchEvent(n));
}
function io(e) {
  const n = c.useRef(e);
  return c.useEffect(() => {
    n.current = e;
  }), c.useMemo(() => (...r) => {
    var _a2;
    return (_a2 = n.current) == null ? void 0 : _a2.call(n, ...r);
  }, []);
}
function VS(e, n = globalThis == null ? void 0 : globalThis.document) {
  const r = io(e);
  c.useEffect(() => {
    const o = (s) => {
      s.key === "Escape" && r(s);
    };
    return n.addEventListener("keydown", o, { capture: true }), () => n.removeEventListener("keydown", o, { capture: true });
  }, [r, n]);
}
var BS = "DismissableLayer", Ia = "dismissableLayer.update", $S = "dismissableLayer.pointerDownOutside", zS = "dismissableLayer.focusOutside", ed, Gm = c.createContext({
  layers: /* @__PURE__ */ new Set(),
  layersWithOutsidePointerEventsDisabled: /* @__PURE__ */ new Set(),
  branches: /* @__PURE__ */ new Set()
}), Ym = c.forwardRef(
  (e, n) => {
    const {
      disableOutsidePointerEvents: r = false,
      onEscapeKeyDown: o,
      onPointerDownOutside: s,
      onFocusOutside: i,
      onInteractOutside: a,
      onDismiss: l,
      ...f
    } = e, u = c.useContext(Gm), [p, d] = c.useState(null), g = (p == null ? void 0 : p.ownerDocument) ?? (globalThis == null ? void 0 : globalThis.document), [, m] = c.useState({}), b = nr(n, (T) => d(T)), h = Array.from(u.layers), [v] = [...u.layersWithOutsidePointerEventsDisabled].slice(-1), y = h.indexOf(v), x = p ? h.indexOf(p) : -1, R = u.layersWithOutsidePointerEventsDisabled.size > 0, S = x >= y, E = WS((T) => {
      const N = T.target, I = [...u.branches].some((L) => L.contains(N));
      !S || I || (s == null ? void 0 : s(T), a == null ? void 0 : a(T), T.defaultPrevented || (l == null ? void 0 : l()));
    }, g), C = jS((T) => {
      const N = T.target;
      [...u.branches].some((L) => L.contains(N)) || (i == null ? void 0 : i(T), a == null ? void 0 : a(T), T.defaultPrevented || (l == null ? void 0 : l()));
    }, g);
    return VS((T) => {
      x === u.layers.size - 1 && (o == null ? void 0 : o(T), !T.defaultPrevented && l && (T.preventDefault(), l()));
    }, g), c.useEffect(() => {
      if (p)
        return r && (u.layersWithOutsidePointerEventsDisabled.size === 0 && (ed = g.body.style.pointerEvents, g.body.style.pointerEvents = "none"), u.layersWithOutsidePointerEventsDisabled.add(p)), u.layers.add(p), td(), () => {
          r && u.layersWithOutsidePointerEventsDisabled.size === 1 && (g.body.style.pointerEvents = ed);
        };
    }, [p, g, r, u]), c.useEffect(() => () => {
      p && (u.layers.delete(p), u.layersWithOutsidePointerEventsDisabled.delete(p), td());
    }, [p, u]), c.useEffect(() => {
      const T = () => m({});
      return document.addEventListener(Ia, T), () => document.removeEventListener(Ia, T);
    }, []), /* @__PURE__ */ jsx(
      Ct.div,
      {
        ...f,
        ref: b,
        style: {
          pointerEvents: R ? S ? "auto" : "none" : void 0,
          ...e.style
        },
        onFocusCapture: Rn(e.onFocusCapture, C.onFocusCapture),
        onBlurCapture: Rn(e.onBlurCapture, C.onBlurCapture),
        onPointerDownCapture: Rn(
          e.onPointerDownCapture,
          E.onPointerDownCapture
        )
      }
    );
  }
);
Ym.displayName = BS;
var HS = "DismissableLayerBranch", US = c.forwardRef((e, n) => {
  const r = c.useContext(Gm), o = c.useRef(null), s = nr(n, o);
  return c.useEffect(() => {
    const i = o.current;
    if (i)
      return r.branches.add(i), () => {
        r.branches.delete(i);
      };
  }, [r.branches]), /* @__PURE__ */ jsx(Ct.div, { ...e, ref: s });
});
US.displayName = HS;
function WS(e, n = globalThis == null ? void 0 : globalThis.document) {
  const r = io(e), o = c.useRef(false), s = c.useRef(() => {
  });
  return c.useEffect(() => {
    const i = (l) => {
      if (l.target && !o.current) {
        let f = function() {
          qm(
            $S,
            r,
            u,
            { discrete: true }
          );
        };
        const u = { originalEvent: l };
        l.pointerType === "touch" ? (n.removeEventListener("click", s.current), s.current = f, n.addEventListener("click", s.current, { once: true })) : f();
      } else
        n.removeEventListener("click", s.current);
      o.current = false;
    }, a = window.setTimeout(() => {
      n.addEventListener("pointerdown", i);
    }, 0);
    return () => {
      window.clearTimeout(a), n.removeEventListener("pointerdown", i), n.removeEventListener("click", s.current);
    };
  }, [n, r]), {
    // ensures we check React component tree (not just DOM tree)
    onPointerDownCapture: () => o.current = true
  };
}
function jS(e, n = globalThis == null ? void 0 : globalThis.document) {
  const r = io(e), o = c.useRef(false);
  return c.useEffect(() => {
    const s = (i) => {
      i.target && !o.current && qm(zS, r, { originalEvent: i }, {
        discrete: false
      });
    };
    return n.addEventListener("focusin", s), () => n.removeEventListener("focusin", s);
  }, [n, r]), {
    onFocusCapture: () => o.current = true,
    onBlurCapture: () => o.current = false
  };
}
function td() {
  const e = new CustomEvent(Ia);
  document.dispatchEvent(e);
}
function qm(e, n, r, { discrete: o }) {
  const s = r.originalEvent.target, i = new CustomEvent(e, { bubbles: false, cancelable: true, detail: r });
  n && s.addEventListener(e, n, { once: true }), o ? _S(s, i) : s.dispatchEvent(i);
}
var $i = "focusScope.autoFocusOnMount", zi = "focusScope.autoFocusOnUnmount", nd = { bubbles: false, cancelable: true }, KS = "FocusScope", Xm = c.forwardRef((e, n) => {
  const {
    loop: r = false,
    trapped: o = false,
    onMountAutoFocus: s,
    onUnmountAutoFocus: i,
    ...a
  } = e, [l, f] = c.useState(null), u = io(s), p = io(i), d = c.useRef(null), g = nr(n, (h) => f(h)), m = c.useRef({
    paused: false,
    pause() {
      this.paused = true;
    },
    resume() {
      this.paused = false;
    }
  }).current;
  c.useEffect(() => {
    if (o) {
      let h = function(R) {
        if (m.paused || !l) return;
        const S = R.target;
        l.contains(S) ? d.current = S : xn(d.current, { select: true });
      }, v = function(R) {
        if (m.paused || !l) return;
        const S = R.relatedTarget;
        S !== null && (l.contains(S) || xn(d.current, { select: true }));
      }, y = function(R) {
        if (document.activeElement === document.body)
          for (const E of R)
            E.removedNodes.length > 0 && xn(l);
      };
      document.addEventListener("focusin", h), document.addEventListener("focusout", v);
      const x = new MutationObserver(y);
      return l && x.observe(l, { childList: true, subtree: true }), () => {
        document.removeEventListener("focusin", h), document.removeEventListener("focusout", v), x.disconnect();
      };
    }
  }, [o, l, m.paused]), c.useEffect(() => {
    if (l) {
      od.add(m);
      const h = document.activeElement;
      if (!l.contains(h)) {
        const y = new CustomEvent($i, nd);
        l.addEventListener($i, u), l.dispatchEvent(y), y.defaultPrevented || (GS(ZS(Jm(l)), { select: true }), document.activeElement === h && xn(l));
      }
      return () => {
        l.removeEventListener($i, u), setTimeout(() => {
          const y = new CustomEvent(zi, nd);
          l.addEventListener(zi, p), l.dispatchEvent(y), y.defaultPrevented || xn(h ?? document.body, { select: true }), l.removeEventListener(zi, p), od.remove(m);
        }, 0);
      };
    }
  }, [l, u, p, m]);
  const b = c.useCallback(
    (h) => {
      if (!r && !o || m.paused) return;
      const v = h.key === "Tab" && !h.altKey && !h.ctrlKey && !h.metaKey, y = document.activeElement;
      if (v && y) {
        const x = h.currentTarget, [R, S] = YS(x);
        R && S ? !h.shiftKey && y === S ? (h.preventDefault(), r && xn(R, { select: true })) : h.shiftKey && y === R && (h.preventDefault(), r && xn(S, { select: true })) : y === x && h.preventDefault();
      }
    },
    [r, o, m.paused]
  );
  return /* @__PURE__ */ jsx(Ct.div, { tabIndex: -1, ...a, ref: g, onKeyDown: b });
});
Xm.displayName = KS;
function GS(e, { select: n = false } = {}) {
  const r = document.activeElement;
  for (const o of e)
    if (xn(o, { select: n }), document.activeElement !== r) return;
}
function YS(e) {
  const n = Jm(e), r = rd(n, e), o = rd(n.reverse(), e);
  return [r, o];
}
function Jm(e) {
  const n = [], r = document.createTreeWalker(e, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (o) => {
      const s = o.tagName === "INPUT" && o.type === "hidden";
      return o.disabled || o.hidden || s ? NodeFilter.FILTER_SKIP : o.tabIndex >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });
  for (; r.nextNode(); ) n.push(r.currentNode);
  return n;
}
function rd(e, n) {
  for (const r of e)
    if (!qS(r, { upTo: n })) return r;
}
function qS(e, { upTo: n }) {
  if (getComputedStyle(e).visibility === "hidden") return true;
  for (; e; ) {
    if (n !== void 0 && e === n) return false;
    if (getComputedStyle(e).display === "none") return true;
    e = e.parentElement;
  }
  return false;
}
function XS(e) {
  return e instanceof HTMLInputElement && "select" in e;
}
function xn(e, { select: n = false } = {}) {
  if (e && e.focus) {
    const r = document.activeElement;
    e.focus({ preventScroll: true }), e !== r && XS(e) && n && e.select();
  }
}
var od = JS();
function JS() {
  let e = [];
  return {
    add(n) {
      const r = e[0];
      n !== r && (r == null ? void 0 : r.pause()), e = sd(e, n), e.unshift(n);
    },
    remove(n) {
      var _a2;
      e = sd(e, n), (_a2 = e[0]) == null ? void 0 : _a2.resume();
    }
  };
}
function sd(e, n) {
  const r = [...e], o = r.indexOf(n);
  return o !== -1 && r.splice(o, 1), r;
}
function ZS(e) {
  return e.filter((n) => n.tagName !== "A");
}
var QS = "Portal", Zm = c.forwardRef((e, n) => {
  var _a2;
  const { container: r, ...o } = e, [s, i] = c.useState(false);
  so(() => i(true), []);
  const a = r || s && ((_a2 = globalThis == null ? void 0 : globalThis.document) == null ? void 0 : _a2.body);
  return a ? Tt__default.createPortal(/* @__PURE__ */ jsx(Ct.div, { ...o, ref: n }), a) : null;
});
Zm.displayName = QS;
function eR(e, n) {
  return c.useReducer((r, o) => n[r][o] ?? r, e);
}
var ci = (e) => {
  const { present: n, children: r } = e, o = tR(n), s = typeof r == "function" ? r({ present: o.isPresent }) : c.Children.only(r), i = nr(o.ref, nR(s));
  return typeof r == "function" || o.isPresent ? c.cloneElement(s, { ref: i }) : null;
};
ci.displayName = "Presence";
function tR(e) {
  const [n, r] = c.useState(), o = c.useRef(null), s = c.useRef(e), i = c.useRef("none"), a = e ? "mounted" : "unmounted", [l, f] = eR(a, {
    mounted: {
      UNMOUNT: "unmounted",
      ANIMATION_OUT: "unmountSuspended"
    },
    unmountSuspended: {
      MOUNT: "mounted",
      ANIMATION_END: "unmounted"
    },
    unmounted: {
      MOUNT: "mounted"
    }
  });
  return c.useEffect(() => {
    const u = Zo(o.current);
    i.current = l === "mounted" ? u : "none";
  }, [l]), so(() => {
    const u = o.current, p = s.current;
    if (p !== e) {
      const g = i.current, m = Zo(u);
      e ? f("MOUNT") : m === "none" || (u == null ? void 0 : u.display) === "none" ? f("UNMOUNT") : f(p && g !== m ? "ANIMATION_OUT" : "UNMOUNT"), s.current = e;
    }
  }, [e, f]), so(() => {
    if (n) {
      let u;
      const p = n.ownerDocument.defaultView ?? window, d = (m) => {
        const h = Zo(o.current).includes(CSS.escape(m.animationName));
        if (m.target === n && h && (f("ANIMATION_END"), !s.current)) {
          const v = n.style.animationFillMode;
          n.style.animationFillMode = "forwards", u = p.setTimeout(() => {
            n.style.animationFillMode === "forwards" && (n.style.animationFillMode = v);
          });
        }
      }, g = (m) => {
        m.target === n && (i.current = Zo(o.current));
      };
      return n.addEventListener("animationstart", g), n.addEventListener("animationcancel", d), n.addEventListener("animationend", d), () => {
        p.clearTimeout(u), n.removeEventListener("animationstart", g), n.removeEventListener("animationcancel", d), n.removeEventListener("animationend", d);
      };
    } else
      f("ANIMATION_END");
  }, [n, f]), {
    isPresent: ["mounted", "unmountSuspended"].includes(l),
    ref: c.useCallback((u) => {
      o.current = u ? getComputedStyle(u) : null, r(u);
    }, [])
  };
}
function Zo(e) {
  return (e == null ? void 0 : e.animationName) || "none";
}
function nR(e) {
  var _a2, _b2;
  let n = (_a2 = Object.getOwnPropertyDescriptor(e.props, "ref")) == null ? void 0 : _a2.get, r = n && "isReactWarning" in n && n.isReactWarning;
  return r ? e.ref : (n = (_b2 = Object.getOwnPropertyDescriptor(e, "ref")) == null ? void 0 : _b2.get, r = n && "isReactWarning" in n && n.isReactWarning, r ? e.props.ref : e.props.ref || e.ref);
}
var Hi = 0;
function rR() {
  c.useEffect(() => {
    const e = document.querySelectorAll("[data-radix-focus-guard]");
    return document.body.insertAdjacentElement("afterbegin", e[0] ?? id()), document.body.insertAdjacentElement("beforeend", e[1] ?? id()), Hi++, () => {
      Hi === 1 && document.querySelectorAll("[data-radix-focus-guard]").forEach((n) => n.remove()), Hi--;
    };
  }, []);
}
function id() {
  const e = document.createElement("span");
  return e.setAttribute("data-radix-focus-guard", ""), e.tabIndex = 0, e.style.outline = "none", e.style.opacity = "0", e.style.position = "fixed", e.style.pointerEvents = "none", e;
}
var Yt = function() {
  return Yt = Object.assign || function(n) {
    for (var r, o = 1, s = arguments.length; o < s; o++) {
      r = arguments[o];
      for (var i in r) Object.prototype.hasOwnProperty.call(r, i) && (n[i] = r[i]);
    }
    return n;
  }, Yt.apply(this, arguments);
};
function Qm(e, n) {
  var r = {};
  for (var o in e) Object.prototype.hasOwnProperty.call(e, o) && n.indexOf(o) < 0 && (r[o] = e[o]);
  if (e != null && typeof Object.getOwnPropertySymbols == "function")
    for (var s = 0, o = Object.getOwnPropertySymbols(e); s < o.length; s++)
      n.indexOf(o[s]) < 0 && Object.prototype.propertyIsEnumerable.call(e, o[s]) && (r[o[s]] = e[o[s]]);
  return r;
}
function oR(e, n, r) {
  for (var o = 0, s = n.length, i; o < s; o++)
    (i || !(o in n)) && (i || (i = Array.prototype.slice.call(n, 0, o)), i[o] = n[o]);
  return e.concat(i || Array.prototype.slice.call(n));
}
var cs = "right-scroll-bar-position", us = "width-before-scroll-bar", sR = "with-scroll-bars-hidden", iR = "--removed-body-scroll-bar-size";
function Ui(e, n) {
  return typeof e == "function" ? e(n) : e && (e.current = n), e;
}
function aR(e, n) {
  var r = useState(function() {
    return {
      // value
      value: e,
      // last callback
      callback: n,
      // "memoized" public interface
      facade: {
        get current() {
          return r.value;
        },
        set current(o) {
          var s = r.value;
          s !== o && (r.value = o, r.callback(o, s));
        }
      }
    };
  })[0];
  return r.callback = n, r.facade;
}
var lR = typeof window < "u" ? c.useLayoutEffect : c.useEffect, ad = /* @__PURE__ */ new WeakMap();
function cR(e, n) {
  var r = aR(null, function(o) {
    return e.forEach(function(s) {
      return Ui(s, o);
    });
  });
  return lR(function() {
    var o = ad.get(r);
    if (o) {
      var s = new Set(o), i = new Set(e), a = r.current;
      s.forEach(function(l) {
        i.has(l) || Ui(l, null);
      }), i.forEach(function(l) {
        s.has(l) || Ui(l, a);
      });
    }
    ad.set(r, e);
  }, [e]), r;
}
function uR(e) {
  return e;
}
function dR(e, n) {
  n === void 0 && (n = uR);
  var r = [], o = false, s = {
    read: function() {
      if (o)
        throw new Error("Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.");
      return r.length ? r[r.length - 1] : e;
    },
    useMedium: function(i) {
      var a = n(i, o);
      return r.push(a), function() {
        r = r.filter(function(l) {
          return l !== a;
        });
      };
    },
    assignSyncMedium: function(i) {
      for (o = true; r.length; ) {
        var a = r;
        r = [], a.forEach(i);
      }
      r = {
        push: function(l) {
          return i(l);
        },
        filter: function() {
          return r;
        }
      };
    },
    assignMedium: function(i) {
      o = true;
      var a = [];
      if (r.length) {
        var l = r;
        r = [], l.forEach(i), a = r;
      }
      var f = function() {
        var p = a;
        a = [], p.forEach(i);
      }, u = function() {
        return Promise.resolve().then(f);
      };
      u(), r = {
        push: function(p) {
          a.push(p), u();
        },
        filter: function(p) {
          return a = a.filter(p), r;
        }
      };
    }
  };
  return s;
}
function fR(e) {
  e === void 0 && (e = {});
  var n = dR(null);
  return n.options = Yt({ async: true, ssr: false }, e), n;
}
var eg = function(e) {
  var n = e.sideCar, r = Qm(e, ["sideCar"]);
  if (!n)
    throw new Error("Sidecar: please provide `sideCar` property to import the right car");
  var o = n.read();
  if (!o)
    throw new Error("Sidecar medium not found");
  return c.createElement(o, Yt({}, r));
};
eg.isSideCarExport = true;
function pR(e, n) {
  return e.useMedium(n), eg;
}
var tg = fR(), Wi = function() {
}, ui = c.forwardRef(function(e, n) {
  var r = c.useRef(null), o = c.useState({
    onScrollCapture: Wi,
    onWheelCapture: Wi,
    onTouchMoveCapture: Wi
  }), s = o[0], i = o[1], a = e.forwardProps, l = e.children, f = e.className, u = e.removeScrollBar, p = e.enabled, d = e.shards, g = e.sideCar, m = e.noRelative, b = e.noIsolation, h = e.inert, v = e.allowPinchZoom, y = e.as, x = y === void 0 ? "div" : y, R = e.gapMode, S = Qm(e, ["forwardProps", "children", "className", "removeScrollBar", "enabled", "shards", "sideCar", "noRelative", "noIsolation", "inert", "allowPinchZoom", "as", "gapMode"]), E = g, C = cR([r, n]), T = Yt(Yt({}, S), s);
  return c.createElement(
    c.Fragment,
    null,
    p && c.createElement(E, { sideCar: tg, removeScrollBar: u, shards: d, noRelative: m, noIsolation: b, inert: h, setCallbacks: i, allowPinchZoom: !!v, lockRef: r, gapMode: R }),
    a ? c.cloneElement(c.Children.only(l), Yt(Yt({}, T), { ref: C })) : c.createElement(x, Yt({}, T, { className: f, ref: C }), l)
  );
});
ui.defaultProps = {
  enabled: true,
  removeScrollBar: true,
  inert: false
};
ui.classNames = {
  fullWidth: us,
  zeroRight: cs
};
var mR = function() {
  if (typeof __webpack_nonce__ < "u")
    return __webpack_nonce__;
};
function gR() {
  if (!document)
    return null;
  var e = document.createElement("style");
  e.type = "text/css";
  var n = mR();
  return n && e.setAttribute("nonce", n), e;
}
function hR(e, n) {
  e.styleSheet ? e.styleSheet.cssText = n : e.appendChild(document.createTextNode(n));
}
function bR(e) {
  var n = document.head || document.getElementsByTagName("head")[0];
  n.appendChild(e);
}
var vR = function() {
  var e = 0, n = null;
  return {
    add: function(r) {
      e == 0 && (n = gR()) && (hR(n, r), bR(n)), e++;
    },
    remove: function() {
      e--, !e && n && (n.parentNode && n.parentNode.removeChild(n), n = null);
    }
  };
}, yR = function() {
  var e = vR();
  return function(n, r) {
    c.useEffect(function() {
      return e.add(n), function() {
        e.remove();
      };
    }, [n && r]);
  };
}, ng = function() {
  var e = yR(), n = function(r) {
    var o = r.styles, s = r.dynamic;
    return e(o, s), null;
  };
  return n;
}, xR = {
  left: 0,
  top: 0,
  right: 0,
  gap: 0
}, ji = function(e) {
  return parseInt(e || "", 10) || 0;
}, wR = function(e) {
  var n = window.getComputedStyle(document.body), r = n[e === "padding" ? "paddingLeft" : "marginLeft"], o = n[e === "padding" ? "paddingTop" : "marginTop"], s = n[e === "padding" ? "paddingRight" : "marginRight"];
  return [ji(r), ji(o), ji(s)];
}, ER = function(e) {
  if (e === void 0 && (e = "margin"), typeof window > "u")
    return xR;
  var n = wR(e), r = document.documentElement.clientWidth, o = window.innerWidth;
  return {
    left: n[0],
    top: n[1],
    right: n[2],
    gap: Math.max(0, o - r + n[2] - n[0])
  };
}, CR = ng(), gr = "data-scroll-locked", SR = function(e, n, r, o) {
  var s = e.left, i = e.top, a = e.right, l = e.gap;
  return r === void 0 && (r = "margin"), `
  .`.concat(sR, ` {
   overflow: hidden `).concat(o, `;
   padding-right: `).concat(l, "px ").concat(o, `;
  }
  body[`).concat(gr, `] {
    overflow: hidden `).concat(o, `;
    overscroll-behavior: contain;
    `).concat([
    n && "position: relative ".concat(o, ";"),
    r === "margin" && `
    padding-left: `.concat(s, `px;
    padding-top: `).concat(i, `px;
    padding-right: `).concat(a, `px;
    margin-left:0;
    margin-top:0;
    margin-right: `).concat(l, "px ").concat(o, `;
    `),
    r === "padding" && "padding-right: ".concat(l, "px ").concat(o, ";")
  ].filter(Boolean).join(""), `
  }
  
  .`).concat(cs, ` {
    right: `).concat(l, "px ").concat(o, `;
  }
  
  .`).concat(us, ` {
    margin-right: `).concat(l, "px ").concat(o, `;
  }
  
  .`).concat(cs, " .").concat(cs, ` {
    right: 0 `).concat(o, `;
  }
  
  .`).concat(us, " .").concat(us, ` {
    margin-right: 0 `).concat(o, `;
  }
  
  body[`).concat(gr, `] {
    `).concat(iR, ": ").concat(l, `px;
  }
`);
}, ld = function() {
  var e = parseInt(document.body.getAttribute(gr) || "0", 10);
  return isFinite(e) ? e : 0;
}, RR = function() {
  c.useEffect(function() {
    return document.body.setAttribute(gr, (ld() + 1).toString()), function() {
      var e = ld() - 1;
      e <= 0 ? document.body.removeAttribute(gr) : document.body.setAttribute(gr, e.toString());
    };
  }, []);
}, NR = function(e) {
  var n = e.noRelative, r = e.noImportant, o = e.gapMode, s = o === void 0 ? "margin" : o;
  RR();
  var i = c.useMemo(function() {
    return ER(s);
  }, [s]);
  return c.createElement(CR, { styles: SR(i, !n, s, r ? "" : "!important") });
}, Pa = false;
if (typeof window < "u")
  try {
    var Qo = Object.defineProperty({}, "passive", {
      get: function() {
        return Pa = true, true;
      }
    });
    window.addEventListener("test", Qo, Qo), window.removeEventListener("test", Qo, Qo);
  } catch {
    Pa = false;
  }
var rr = Pa ? { passive: false } : false, TR = function(e) {
  return e.tagName === "TEXTAREA";
}, rg = function(e, n) {
  if (!(e instanceof Element))
    return false;
  var r = window.getComputedStyle(e);
  return (
    // not-not-scrollable
    r[n] !== "hidden" && // contains scroll inside self
    !(r.overflowY === r.overflowX && !TR(e) && r[n] === "visible")
  );
}, kR = function(e) {
  return rg(e, "overflowY");
}, OR = function(e) {
  return rg(e, "overflowX");
}, cd = function(e, n) {
  var r = n.ownerDocument, o = n;
  do {
    typeof ShadowRoot < "u" && o instanceof ShadowRoot && (o = o.host);
    var s = og(e, o);
    if (s) {
      var i = sg(e, o), a = i[1], l = i[2];
      if (a > l)
        return true;
    }
    o = o.parentNode;
  } while (o && o !== r.body);
  return false;
}, IR = function(e) {
  var n = e.scrollTop, r = e.scrollHeight, o = e.clientHeight;
  return [
    n,
    r,
    o
  ];
}, PR = function(e) {
  var n = e.scrollLeft, r = e.scrollWidth, o = e.clientWidth;
  return [
    n,
    r,
    o
  ];
}, og = function(e, n) {
  return e === "v" ? kR(n) : OR(n);
}, sg = function(e, n) {
  return e === "v" ? IR(n) : PR(n);
}, MR = function(e, n) {
  return e === "h" && n === "rtl" ? -1 : 1;
}, DR = function(e, n, r, o, s) {
  var i = MR(e, window.getComputedStyle(n).direction), a = i * o, l = r.target, f = n.contains(l), u = false, p = a > 0, d = 0, g = 0;
  do {
    if (!l)
      break;
    var m = sg(e, l), b = m[0], h = m[1], v = m[2], y = h - v - i * b;
    (b || y) && og(e, l) && (d += y, g += b);
    var x = l.parentNode;
    l = x && x.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? x.host : x;
  } while (
    // portaled content
    !f && l !== document.body || // self content
    f && (n.contains(l) || n === l)
  );
  return (p && Math.abs(d) < 1 || !p && Math.abs(g) < 1) && (u = true), u;
}, es = function(e) {
  return "changedTouches" in e ? [e.changedTouches[0].clientX, e.changedTouches[0].clientY] : [0, 0];
}, ud = function(e) {
  return [e.deltaX, e.deltaY];
}, dd = function(e) {
  return e && "current" in e ? e.current : e;
}, AR = function(e, n) {
  return e[0] === n[0] && e[1] === n[1];
}, LR = function(e) {
  return `
  .block-interactivity-`.concat(e, ` {pointer-events: none;}
  .allow-interactivity-`).concat(e, ` {pointer-events: all;}
`);
}, FR = 0, or = [];
function _R(e) {
  var n = c.useRef([]), r = c.useRef([0, 0]), o = c.useRef(), s = c.useState(FR++)[0], i = c.useState(ng)[0], a = c.useRef(e);
  c.useEffect(function() {
    a.current = e;
  }, [e]), c.useEffect(function() {
    if (e.inert) {
      document.body.classList.add("block-interactivity-".concat(s));
      var h = oR([e.lockRef.current], (e.shards || []).map(dd)).filter(Boolean);
      return h.forEach(function(v) {
        return v.classList.add("allow-interactivity-".concat(s));
      }), function() {
        document.body.classList.remove("block-interactivity-".concat(s)), h.forEach(function(v) {
          return v.classList.remove("allow-interactivity-".concat(s));
        });
      };
    }
  }, [e.inert, e.lockRef.current, e.shards]);
  var l = c.useCallback(function(h, v) {
    if ("touches" in h && h.touches.length === 2 || h.type === "wheel" && h.ctrlKey)
      return !a.current.allowPinchZoom;
    var y = es(h), x = r.current, R = "deltaX" in h ? h.deltaX : x[0] - y[0], S = "deltaY" in h ? h.deltaY : x[1] - y[1], E, C = h.target, T = Math.abs(R) > Math.abs(S) ? "h" : "v";
    if ("touches" in h && T === "h" && C.type === "range")
      return false;
    var N = window.getSelection(), I = N && N.anchorNode, L = I ? I === C || I.contains(C) : false;
    if (L)
      return false;
    var A = cd(T, C);
    if (!A)
      return true;
    if (A ? E = T : (E = T === "v" ? "h" : "v", A = cd(T, C)), !A)
      return false;
    if (!o.current && "changedTouches" in h && (R || S) && (o.current = E), !E)
      return true;
    var P = o.current || E;
    return DR(P, v, h, P === "h" ? R : S);
  }, []), f = c.useCallback(function(h) {
    var v = h;
    if (!(!or.length || or[or.length - 1] !== i)) {
      var y = "deltaY" in v ? ud(v) : es(v), x = n.current.filter(function(E) {
        return E.name === v.type && (E.target === v.target || v.target === E.shadowParent) && AR(E.delta, y);
      })[0];
      if (x && x.should) {
        v.cancelable && v.preventDefault();
        return;
      }
      if (!x) {
        var R = (a.current.shards || []).map(dd).filter(Boolean).filter(function(E) {
          return E.contains(v.target);
        }), S = R.length > 0 ? l(v, R[0]) : !a.current.noIsolation;
        S && v.cancelable && v.preventDefault();
      }
    }
  }, []), u = c.useCallback(function(h, v, y, x) {
    var R = { name: h, delta: v, target: y, should: x, shadowParent: VR(y) };
    n.current.push(R), setTimeout(function() {
      n.current = n.current.filter(function(S) {
        return S !== R;
      });
    }, 1);
  }, []), p = c.useCallback(function(h) {
    r.current = es(h), o.current = void 0;
  }, []), d = c.useCallback(function(h) {
    u(h.type, ud(h), h.target, l(h, e.lockRef.current));
  }, []), g = c.useCallback(function(h) {
    u(h.type, es(h), h.target, l(h, e.lockRef.current));
  }, []);
  c.useEffect(function() {
    return or.push(i), e.setCallbacks({
      onScrollCapture: d,
      onWheelCapture: d,
      onTouchMoveCapture: g
    }), document.addEventListener("wheel", f, rr), document.addEventListener("touchmove", f, rr), document.addEventListener("touchstart", p, rr), function() {
      or = or.filter(function(h) {
        return h !== i;
      }), document.removeEventListener("wheel", f, rr), document.removeEventListener("touchmove", f, rr), document.removeEventListener("touchstart", p, rr);
    };
  }, []);
  var m = e.removeScrollBar, b = e.inert;
  return c.createElement(
    c.Fragment,
    null,
    b ? c.createElement(i, { styles: LR(s) }) : null,
    m ? c.createElement(NR, { noRelative: e.noRelative, gapMode: e.gapMode }) : null
  );
}
function VR(e) {
  for (var n = null; e !== null; )
    e instanceof ShadowRoot && (n = e.host, e = e.host), e = e.parentNode;
  return n;
}
const BR = pR(tg, _R);
var ig = c.forwardRef(function(e, n) {
  return c.createElement(ui, Yt({}, e, { ref: n, sideCar: BR }));
});
ig.classNames = ui.classNames;
var $R = function(e) {
  if (typeof document > "u")
    return null;
  var n = Array.isArray(e) ? e[0] : e;
  return n.ownerDocument.body;
}, sr = /* @__PURE__ */ new WeakMap(), ts = /* @__PURE__ */ new WeakMap(), ns = {}, Ki = 0, ag = function(e) {
  return e && (e.host || ag(e.parentNode));
}, zR = function(e, n) {
  return n.map(function(r) {
    if (e.contains(r))
      return r;
    var o = ag(r);
    return o && e.contains(o) ? o : (console.error("aria-hidden", r, "in not contained inside", e, ". Doing nothing"), null);
  }).filter(function(r) {
    return !!r;
  });
}, HR = function(e, n, r, o) {
  var s = zR(n, Array.isArray(e) ? e : [e]);
  ns[r] || (ns[r] = /* @__PURE__ */ new WeakMap());
  var i = ns[r], a = [], l = /* @__PURE__ */ new Set(), f = new Set(s), u = function(d) {
    !d || l.has(d) || (l.add(d), u(d.parentNode));
  };
  s.forEach(u);
  var p = function(d) {
    !d || f.has(d) || Array.prototype.forEach.call(d.children, function(g) {
      if (l.has(g))
        p(g);
      else
        try {
          var m = g.getAttribute(o), b = m !== null && m !== "false", h = (sr.get(g) || 0) + 1, v = (i.get(g) || 0) + 1;
          sr.set(g, h), i.set(g, v), a.push(g), h === 1 && b && ts.set(g, true), v === 1 && g.setAttribute(r, "true"), b || g.setAttribute(o, "true");
        } catch (y) {
          console.error("aria-hidden: cannot operate on ", g, y);
        }
    });
  };
  return p(n), l.clear(), Ki++, function() {
    a.forEach(function(d) {
      var g = sr.get(d) - 1, m = i.get(d) - 1;
      sr.set(d, g), i.set(d, m), g || (ts.has(d) || d.removeAttribute(o), ts.delete(d)), m || d.removeAttribute(r);
    }), Ki--, Ki || (sr = /* @__PURE__ */ new WeakMap(), sr = /* @__PURE__ */ new WeakMap(), ts = /* @__PURE__ */ new WeakMap(), ns = {});
  };
}, UR = function(e, n, r) {
  r === void 0 && (r = "data-aria-hidden");
  var o = Array.from(Array.isArray(e) ? e : [e]), s = $R(e);
  return s ? (o.push.apply(o, Array.from(s.querySelectorAll("[aria-live], script"))), HR(o, s, r, "aria-hidden")) : function() {
    return null;
  };
}, di = "Dialog", [lg] = CS(di), [WR, Kt] = lg(di), cg = (e) => {
  const {
    __scopeDialog: n,
    children: r,
    open: o,
    defaultOpen: s,
    onOpenChange: i,
    modal: a = true
  } = e, l = c.useRef(null), f = c.useRef(null), [u, p] = kS({
    prop: o,
    defaultProp: s ?? false,
    onChange: i,
    caller: di
  });
  return /* @__PURE__ */ jsx(
    WR,
    {
      scope: n,
      triggerRef: l,
      contentRef: f,
      contentId: pn(),
      titleId: pn(),
      descriptionId: pn(),
      open: u,
      onOpenChange: p,
      onOpenToggle: c.useCallback(() => p((d) => !d), [p]),
      modal: a,
      children: r
    }
  );
};
cg.displayName = di;
var ug = "DialogTrigger", jR = c.forwardRef(
  (e, n) => {
    const { __scopeDialog: r, ...o } = e, s = Kt(ug, r), i = nr(n, s.triggerRef);
    return /* @__PURE__ */ jsx(
      Ct.button,
      {
        type: "button",
        "aria-haspopup": "dialog",
        "aria-expanded": s.open,
        "aria-controls": s.contentId,
        "data-state": gc(s.open),
        ...o,
        ref: i,
        onClick: Rn(e.onClick, s.onOpenToggle)
      }
    );
  }
);
jR.displayName = ug;
var pc = "DialogPortal", [KR, dg] = lg(pc, {
  forceMount: void 0
}), fg = (e) => {
  const { __scopeDialog: n, forceMount: r, children: o, container: s } = e, i = Kt(pc, n);
  return /* @__PURE__ */ jsx(KR, { scope: n, forceMount: r, children: c.Children.map(o, (a) => /* @__PURE__ */ jsx(ci, { present: r || i.open, children: /* @__PURE__ */ jsx(Zm, { asChild: true, container: s, children: a }) })) });
};
fg.displayName = pc;
var Is = "DialogOverlay", pg = c.forwardRef(
  (e, n) => {
    const r = dg(Is, e.__scopeDialog), { forceMount: o = r.forceMount, ...s } = e, i = Kt(Is, e.__scopeDialog);
    return i.modal ? /* @__PURE__ */ jsx(ci, { present: o || i.open, children: /* @__PURE__ */ jsx(YR, { ...s, ref: n }) }) : null;
  }
);
pg.displayName = Is;
var GR = /* @__PURE__ */ Km("DialogOverlay.RemoveScroll"), YR = c.forwardRef(
  (e, n) => {
    const { __scopeDialog: r, ...o } = e, s = Kt(Is, r);
    return (
      // Make sure `Content` is scrollable even when it doesn't live inside `RemoveScroll`
      // ie. when `Overlay` and `Content` are siblings
      /* @__PURE__ */ jsx(ig, { as: GR, allowPinchZoom: true, shards: [s.contentRef], children: /* @__PURE__ */ jsx(
        Ct.div,
        {
          "data-state": gc(s.open),
          ...o,
          ref: n,
          style: { pointerEvents: "auto", ...o.style }
        }
      ) })
    );
  }
), Xn = "DialogContent", mg = c.forwardRef(
  (e, n) => {
    const r = dg(Xn, e.__scopeDialog), { forceMount: o = r.forceMount, ...s } = e, i = Kt(Xn, e.__scopeDialog);
    return /* @__PURE__ */ jsx(ci, { present: o || i.open, children: i.modal ? /* @__PURE__ */ jsx(qR, { ...s, ref: n }) : /* @__PURE__ */ jsx(XR, { ...s, ref: n }) });
  }
);
mg.displayName = Xn;
var qR = c.forwardRef(
  (e, n) => {
    const r = Kt(Xn, e.__scopeDialog), o = c.useRef(null), s = nr(n, r.contentRef, o);
    return c.useEffect(() => {
      const i = o.current;
      if (i) return UR(i);
    }, []), /* @__PURE__ */ jsx(
      gg,
      {
        ...e,
        ref: s,
        trapFocus: r.open,
        disableOutsidePointerEvents: true,
        onCloseAutoFocus: Rn(e.onCloseAutoFocus, (i) => {
          var _a2;
          i.preventDefault(), (_a2 = r.triggerRef.current) == null ? void 0 : _a2.focus();
        }),
        onPointerDownOutside: Rn(e.onPointerDownOutside, (i) => {
          const a = i.detail.originalEvent, l = a.button === 0 && a.ctrlKey === true;
          (a.button === 2 || l) && i.preventDefault();
        }),
        onFocusOutside: Rn(
          e.onFocusOutside,
          (i) => i.preventDefault()
        )
      }
    );
  }
), XR = c.forwardRef(
  (e, n) => {
    const r = Kt(Xn, e.__scopeDialog), o = c.useRef(false), s = c.useRef(false);
    return /* @__PURE__ */ jsx(
      gg,
      {
        ...e,
        ref: n,
        trapFocus: false,
        disableOutsidePointerEvents: false,
        onCloseAutoFocus: (i) => {
          var _a2, _b2;
          (_a2 = e.onCloseAutoFocus) == null ? void 0 : _a2.call(e, i), i.defaultPrevented || (o.current || ((_b2 = r.triggerRef.current) == null ? void 0 : _b2.focus()), i.preventDefault()), o.current = false, s.current = false;
        },
        onInteractOutside: (i) => {
          var _a2, _b2;
          (_a2 = e.onInteractOutside) == null ? void 0 : _a2.call(e, i), i.defaultPrevented || (o.current = true, i.detail.originalEvent.type === "pointerdown" && (s.current = true));
          const a = i.target;
          ((_b2 = r.triggerRef.current) == null ? void 0 : _b2.contains(a)) && i.preventDefault(), i.detail.originalEvent.type === "focusin" && s.current && i.preventDefault();
        }
      }
    );
  }
), gg = c.forwardRef(
  (e, n) => {
    const { __scopeDialog: r, trapFocus: o, onOpenAutoFocus: s, onCloseAutoFocus: i, ...a } = e, l = Kt(Xn, r), f = c.useRef(null), u = nr(n, f);
    return rR(), /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        Xm,
        {
          asChild: true,
          loop: true,
          trapped: o,
          onMountAutoFocus: s,
          onUnmountAutoFocus: i,
          children: /* @__PURE__ */ jsx(
            Ym,
            {
              role: "dialog",
              id: l.contentId,
              "aria-describedby": l.descriptionId,
              "aria-labelledby": l.titleId,
              "data-state": gc(l.open),
              ...a,
              ref: u,
              onDismiss: () => l.onOpenChange(false)
            }
          )
        }
      ),
      /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(eN, { titleId: l.titleId }),
        /* @__PURE__ */ jsx(nN, { contentRef: f, descriptionId: l.descriptionId })
      ] })
    ] });
  }
), mc = "DialogTitle", JR = c.forwardRef(
  (e, n) => {
    const { __scopeDialog: r, ...o } = e, s = Kt(mc, r);
    return /* @__PURE__ */ jsx(Ct.h2, { id: s.titleId, ...o, ref: n });
  }
);
JR.displayName = mc;
var hg = "DialogDescription", ZR = c.forwardRef(
  (e, n) => {
    const { __scopeDialog: r, ...o } = e, s = Kt(hg, r);
    return /* @__PURE__ */ jsx(Ct.p, { id: s.descriptionId, ...o, ref: n });
  }
);
ZR.displayName = hg;
var bg = "DialogClose", QR = c.forwardRef(
  (e, n) => {
    const { __scopeDialog: r, ...o } = e, s = Kt(bg, r);
    return /* @__PURE__ */ jsx(
      Ct.button,
      {
        type: "button",
        ...o,
        ref: n,
        onClick: Rn(e.onClick, () => s.onOpenChange(false))
      }
    );
  }
);
QR.displayName = bg;
function gc(e) {
  return e ? "open" : "closed";
}
var vg = "DialogTitleWarning", [ik, yg] = ES(vg, {
  contentName: Xn,
  titleName: mc,
  docsSlug: "dialog"
}), eN = ({ titleId: e }) => {
  const n = yg(vg), r = `\`${n.contentName}\` requires a \`${n.titleName}\` for the component to be accessible for screen reader users.

If you want to hide the \`${n.titleName}\`, you can wrap it with our VisuallyHidden component.

For more information, see https://radix-ui.com/primitives/docs/components/${n.docsSlug}`;
  return c.useEffect(() => {
    e && (document.getElementById(e) || console.error(r));
  }, [r, e]), null;
}, tN = "DialogDescriptionWarning", nN = ({ contentRef: e, descriptionId: n }) => {
  const o = `Warning: Missing \`Description\` or \`aria-describedby={undefined}\` for {${yg(tN).contentName}}.`;
  return c.useEffect(() => {
    var _a2;
    const s = (_a2 = e.current) == null ? void 0 : _a2.getAttribute("aria-describedby");
    n && s && (document.getElementById(n) || console.warn(o));
  }, [o, e, n]), null;
}, rN = cg, oN = fg, sN = pg, iN = mg, Mr = '[cmdk-group=""]', Gi = '[cmdk-group-items=""]', aN = '[cmdk-group-heading=""]', xg = '[cmdk-item=""]', fd = `${xg}:not([aria-disabled="true"])`, Ma = "cmdk-item-select", lr = "data-value", lN = (e, n, r) => wS(e, n, r), wg = c.createContext(void 0), ko = () => c.useContext(wg), Eg = c.createContext(void 0), hc = () => c.useContext(Eg), Cg = c.createContext(void 0), Sg = c.forwardRef((e, n) => {
  let r = cr(() => {
    var B, G;
    return { search: "", value: (G = (B = e.value) != null ? B : e.defaultValue) != null ? G : "", selectedItemId: void 0, filtered: { count: 0, items: /* @__PURE__ */ new Map(), groups: /* @__PURE__ */ new Set() } };
  }), o = cr(() => /* @__PURE__ */ new Set()), s = cr(() => /* @__PURE__ */ new Map()), i = cr(() => /* @__PURE__ */ new Map()), a = cr(() => /* @__PURE__ */ new Set()), l = Rg(e), { label: f, children: u, value: p, onValueChange: d, filter: g, shouldFilter: m, loop: b, disablePointerSelection: h = false, vimBindings: v = true, ...y } = e, x = pn(), R = pn(), S = pn(), E = c.useRef(null), C = yN();
  Jn(() => {
    if (p !== void 0) {
      let B = p.trim();
      r.current.value = B, T.emit();
    }
  }, [p]), Jn(() => {
    C(6, O);
  }, []);
  let T = c.useMemo(() => ({ subscribe: (B) => (a.current.add(B), () => a.current.delete(B)), snapshot: () => r.current, setState: (B, G, j) => {
    var W, H, te, J;
    if (!Object.is(r.current[B], G)) {
      if (r.current[B] = G, B === "search") P(), L(), C(1, A);
      else if (B === "value") {
        if (document.activeElement.hasAttribute("cmdk-input") || document.activeElement.hasAttribute("cmdk-root")) {
          let oe = document.getElementById(S);
          oe ? oe.focus() : (W = document.getElementById(x)) == null || W.focus();
        }
        if (C(7, () => {
          var oe;
          r.current.selectedItemId = (oe = M()) == null ? void 0 : oe.id, T.emit();
        }), j || C(5, O), ((H = l.current) == null ? void 0 : H.value) !== void 0) {
          let oe = G ?? "";
          (J = (te = l.current).onValueChange) == null || J.call(te, oe);
          return;
        }
      }
      T.emit();
    }
  }, emit: () => {
    a.current.forEach((B) => B());
  } }), []), N = c.useMemo(() => ({ value: (B, G, j) => {
    var W;
    G !== ((W = i.current.get(B)) == null ? void 0 : W.value) && (i.current.set(B, { value: G, keywords: j }), r.current.filtered.items.set(B, I(G, j)), C(2, () => {
      L(), T.emit();
    }));
  }, item: (B, G) => (o.current.add(B), G && (s.current.has(G) ? s.current.get(G).add(B) : s.current.set(G, /* @__PURE__ */ new Set([B]))), C(3, () => {
    P(), L(), r.current.value || A(), T.emit();
  }), () => {
    i.current.delete(B), o.current.delete(B), r.current.filtered.items.delete(B);
    let j = M();
    C(4, () => {
      P(), (j == null ? void 0 : j.getAttribute("id")) === B && A(), T.emit();
    });
  }), group: (B) => (s.current.has(B) || s.current.set(B, /* @__PURE__ */ new Set()), () => {
    i.current.delete(B), s.current.delete(B);
  }), filter: () => l.current.shouldFilter, label: f || e["aria-label"], getDisablePointerSelection: () => l.current.disablePointerSelection, listId: x, inputId: S, labelId: R, listInnerRef: E }), []);
  function I(B, G) {
    var j, W;
    let H = (W = (j = l.current) == null ? void 0 : j.filter) != null ? W : lN;
    return B ? H(B, r.current.search, G) : 0;
  }
  function L() {
    if (!r.current.search || l.current.shouldFilter === false) return;
    let B = r.current.filtered.items, G = [];
    r.current.filtered.groups.forEach((W) => {
      let H = s.current.get(W), te = 0;
      H.forEach((J) => {
        let oe = B.get(J);
        te = Math.max(oe, te);
      }), G.push([W, te]);
    });
    let j = E.current;
    D().sort((W, H) => {
      var te, J;
      let oe = W.getAttribute("id"), ae = H.getAttribute("id");
      return ((te = B.get(ae)) != null ? te : 0) - ((J = B.get(oe)) != null ? J : 0);
    }).forEach((W) => {
      let H = W.closest(Gi);
      H ? H.appendChild(W.parentElement === H ? W : W.closest(`${Gi} > *`)) : j.appendChild(W.parentElement === j ? W : W.closest(`${Gi} > *`));
    }), G.sort((W, H) => H[1] - W[1]).forEach((W) => {
      var H;
      let te = (H = E.current) == null ? void 0 : H.querySelector(`${Mr}[${lr}="${encodeURIComponent(W[0])}"]`);
      te == null ? void 0 : te.parentElement.appendChild(te);
    });
  }
  function A() {
    let B = D().find((j) => j.getAttribute("aria-disabled") !== "true"), G = B == null ? void 0 : B.getAttribute(lr);
    T.setState("value", G || void 0);
  }
  function P() {
    var B, G, j, W;
    if (!r.current.search || l.current.shouldFilter === false) {
      r.current.filtered.count = o.current.size;
      return;
    }
    r.current.filtered.groups = /* @__PURE__ */ new Set();
    let H = 0;
    for (let te of o.current) {
      let J = (G = (B = i.current.get(te)) == null ? void 0 : B.value) != null ? G : "", oe = (W = (j = i.current.get(te)) == null ? void 0 : j.keywords) != null ? W : [], ae = I(J, oe);
      r.current.filtered.items.set(te, ae), ae > 0 && H++;
    }
    for (let [te, J] of s.current) for (let oe of J) if (r.current.filtered.items.get(oe) > 0) {
      r.current.filtered.groups.add(te);
      break;
    }
    r.current.filtered.count = H;
  }
  function O() {
    var B, G, j;
    let W = M();
    W && (((B = W.parentElement) == null ? void 0 : B.firstChild) === W && ((j = (G = W.closest(Mr)) == null ? void 0 : G.querySelector(aN)) == null || j.scrollIntoView({ block: "nearest" })), W.scrollIntoView({ block: "nearest" }));
  }
  function M() {
    var B;
    return (B = E.current) == null ? void 0 : B.querySelector(`${xg}[aria-selected="true"]`);
  }
  function D() {
    var B;
    return Array.from(((B = E.current) == null ? void 0 : B.querySelectorAll(fd)) || []);
  }
  function _(B) {
    let G = D()[B];
    G && T.setState("value", G.getAttribute(lr));
  }
  function k(B) {
    var G;
    let j = M(), W = D(), H = W.findIndex((J) => J === j), te = W[H + B];
    (G = l.current) != null && G.loop && (te = H + B < 0 ? W[W.length - 1] : H + B === W.length ? W[0] : W[H + B]), te && T.setState("value", te.getAttribute(lr));
  }
  function $(B) {
    let G = M(), j = G == null ? void 0 : G.closest(Mr), W;
    for (; j && !W; ) j = B > 0 ? bN(j, Mr) : vN(j, Mr), W = j == null ? void 0 : j.querySelector(fd);
    W ? T.setState("value", W.getAttribute(lr)) : k(B);
  }
  let F = () => _(D().length - 1), z = (B) => {
    B.preventDefault(), B.metaKey ? F() : B.altKey ? $(1) : k(1);
  }, Q = (B) => {
    B.preventDefault(), B.metaKey ? _(0) : B.altKey ? $(-1) : k(-1);
  };
  return c.createElement(Ct.div, { ref: n, tabIndex: -1, ...y, "cmdk-root": "", onKeyDown: (B) => {
    var G;
    (G = y.onKeyDown) == null || G.call(y, B);
    let j = B.nativeEvent.isComposing || B.keyCode === 229;
    if (!(B.defaultPrevented || j)) switch (B.key) {
      case "n":
      case "j": {
        v && B.ctrlKey && z(B);
        break;
      }
      case "ArrowDown": {
        z(B);
        break;
      }
      case "p":
      case "k": {
        v && B.ctrlKey && Q(B);
        break;
      }
      case "ArrowUp": {
        Q(B);
        break;
      }
      case "Home": {
        B.preventDefault(), _(0);
        break;
      }
      case "End": {
        B.preventDefault(), F();
        break;
      }
      case "Enter": {
        B.preventDefault();
        let W = M();
        if (W) {
          let H = new Event(Ma);
          W.dispatchEvent(H);
        }
      }
    }
  } }, c.createElement("label", { "cmdk-label": "", htmlFor: N.inputId, id: N.labelId, style: wN }, f), fi(e, (B) => c.createElement(Eg.Provider, { value: T }, c.createElement(wg.Provider, { value: N }, B))));
}), cN = c.forwardRef((e, n) => {
  var r, o;
  let s = pn(), i = c.useRef(null), a = c.useContext(Cg), l = ko(), f = Rg(e), u = (o = (r = f.current) == null ? void 0 : r.forceMount) != null ? o : a == null ? void 0 : a.forceMount;
  Jn(() => {
    if (!u) return l.item(s, a == null ? void 0 : a.id);
  }, [u]);
  let p = Ng(s, i, [e.value, e.children, i], e.keywords), d = hc(), g = In((C) => C.value && C.value === p.current), m = In((C) => u || l.filter() === false ? true : C.search ? C.filtered.items.get(s) > 0 : true);
  c.useEffect(() => {
    let C = i.current;
    if (!(!C || e.disabled)) return C.addEventListener(Ma, b), () => C.removeEventListener(Ma, b);
  }, [m, e.onSelect, e.disabled]);
  function b() {
    var C, T;
    h(), (T = (C = f.current).onSelect) == null || T.call(C, p.current);
  }
  function h() {
    d.setState("value", p.current, true);
  }
  if (!m) return null;
  let { disabled: v, value: y, onSelect: x, forceMount: R, keywords: S, ...E } = e;
  return c.createElement(Ct.div, { ref: qn(i, n), ...E, id: s, "cmdk-item": "", role: "option", "aria-disabled": !!v, "aria-selected": !!g, "data-disabled": !!v, "data-selected": !!g, onPointerMove: v || l.getDisablePointerSelection() ? void 0 : h, onClick: v ? void 0 : b }, e.children);
}), uN = c.forwardRef((e, n) => {
  let { heading: r, children: o, forceMount: s, ...i } = e, a = pn(), l = c.useRef(null), f = c.useRef(null), u = pn(), p = ko(), d = In((m) => s || p.filter() === false ? true : m.search ? m.filtered.groups.has(a) : true);
  Jn(() => p.group(a), []), Ng(a, l, [e.value, e.heading, f]);
  let g = c.useMemo(() => ({ id: a, forceMount: s }), [s]);
  return c.createElement(Ct.div, { ref: qn(l, n), ...i, "cmdk-group": "", role: "presentation", hidden: d ? void 0 : true }, r && c.createElement("div", { ref: f, "cmdk-group-heading": "", "aria-hidden": true, id: u }, r), fi(e, (m) => c.createElement("div", { "cmdk-group-items": "", role: "group", "aria-labelledby": r ? u : void 0 }, c.createElement(Cg.Provider, { value: g }, m))));
}), dN = c.forwardRef((e, n) => {
  let { alwaysRender: r, ...o } = e, s = c.useRef(null), i = In((a) => !a.search);
  return !r && !i ? null : c.createElement(Ct.div, { ref: qn(s, n), ...o, "cmdk-separator": "", role: "separator" });
}), fN = c.forwardRef((e, n) => {
  let { onValueChange: r, ...o } = e, s = e.value != null, i = hc(), a = In((u) => u.search), l = In((u) => u.selectedItemId), f = ko();
  return c.useEffect(() => {
    e.value != null && i.setState("search", e.value);
  }, [e.value]), c.createElement(Ct.input, { ref: n, ...o, "cmdk-input": "", autoComplete: "off", autoCorrect: "off", spellCheck: false, "aria-autocomplete": "list", role: "combobox", "aria-expanded": true, "aria-controls": f.listId, "aria-labelledby": f.labelId, "aria-activedescendant": l, id: f.inputId, type: "text", value: s ? e.value : a, onChange: (u) => {
    s || i.setState("search", u.target.value), r == null ? void 0 : r(u.target.value);
  } });
}), pN = c.forwardRef((e, n) => {
  let { children: r, label: o = "Suggestions", ...s } = e, i = c.useRef(null), a = c.useRef(null), l = In((u) => u.selectedItemId), f = ko();
  return c.useEffect(() => {
    if (a.current && i.current) {
      let u = a.current, p = i.current, d, g = new ResizeObserver(() => {
        d = requestAnimationFrame(() => {
          let m = u.offsetHeight;
          p.style.setProperty("--cmdk-list-height", m.toFixed(1) + "px");
        });
      });
      return g.observe(u), () => {
        cancelAnimationFrame(d), g.unobserve(u);
      };
    }
  }, []), c.createElement(Ct.div, { ref: qn(i, n), ...s, "cmdk-list": "", role: "listbox", tabIndex: -1, "aria-activedescendant": l, "aria-label": o, id: f.listId }, fi(e, (u) => c.createElement("div", { ref: qn(a, f.listInnerRef), "cmdk-list-sizer": "" }, u)));
}), mN = c.forwardRef((e, n) => {
  let { open: r, onOpenChange: o, overlayClassName: s, contentClassName: i, container: a, ...l } = e;
  return c.createElement(rN, { open: r, onOpenChange: o }, c.createElement(oN, { container: a }, c.createElement(sN, { "cmdk-overlay": "", className: s }), c.createElement(iN, { "aria-label": e.label, "cmdk-dialog": "", className: i }, c.createElement(Sg, { ref: n, ...l }))));
}), gN = c.forwardRef((e, n) => In((r) => r.filtered.count === 0) ? c.createElement(Ct.div, { ref: n, ...e, "cmdk-empty": "", role: "presentation" }) : null), hN = c.forwardRef((e, n) => {
  let { progress: r, children: o, label: s = "Loading...", ...i } = e;
  return c.createElement(Ct.div, { ref: n, ...i, "cmdk-loading": "", role: "progressbar", "aria-valuenow": r, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": s }, fi(e, (a) => c.createElement("div", { "aria-hidden": true }, a)));
}), At = Object.assign(Sg, { List: pN, Item: cN, Input: fN, Group: uN, Separator: dN, Dialog: mN, Empty: gN, Loading: hN });
function bN(e, n) {
  let r = e.nextElementSibling;
  for (; r; ) {
    if (r.matches(n)) return r;
    r = r.nextElementSibling;
  }
}
function vN(e, n) {
  let r = e.previousElementSibling;
  for (; r; ) {
    if (r.matches(n)) return r;
    r = r.previousElementSibling;
  }
}
function Rg(e) {
  let n = c.useRef(e);
  return Jn(() => {
    n.current = e;
  }), n;
}
var Jn = typeof window > "u" ? c.useEffect : c.useLayoutEffect;
function cr(e) {
  let n = c.useRef();
  return n.current === void 0 && (n.current = e()), n;
}
function In(e) {
  let n = hc(), r = () => e(n.snapshot());
  return c.useSyncExternalStore(n.subscribe, r, r);
}
function Ng(e, n, r, o = []) {
  let s = c.useRef(), i = ko();
  return Jn(() => {
    var a;
    let l = (() => {
      var u;
      for (let p of r) {
        if (typeof p == "string") return p.trim();
        if (typeof p == "object" && "current" in p) return p.current ? (u = p.current.textContent) == null ? void 0 : u.trim() : s.current;
      }
    })(), f = o.map((u) => u.trim());
    i.value(e, l, f), (a = n.current) == null || a.setAttribute(lr, l), s.current = l;
  }), s;
}
var yN = () => {
  let [e, n] = c.useState(), r = cr(() => /* @__PURE__ */ new Map());
  return Jn(() => {
    r.current.forEach((o) => o()), r.current = /* @__PURE__ */ new Map();
  }, [e]), (o, s) => {
    r.current.set(o, s), n({});
  };
};
function xN(e) {
  let n = e.type;
  return typeof n == "function" ? n(e.props) : "render" in n ? n.render(e.props) : e;
}
function fi({ asChild: e, children: n }, r) {
  return e && c.isValidElement(n) ? c.cloneElement(xN(n), { ref: n.ref }, r(n.props.children)) : r(n);
}
var wN = { position: "absolute", width: "1px", height: "1px", padding: "0", margin: "-1px", overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", borderWidth: "0" };
const pi = c.createContext({
  isOpen: false,
  setIsOpen: () => {
  },
  isDropdown: false
}), EN = c.forwardRef(({ className: e, isDropdown: n = false, ...r }, o) => {
  const [s, i] = c.useState(false);
  return /* @__PURE__ */ jsx(pi.Provider, { value: { isOpen: s, setIsOpen: i, isDropdown: n }, children: /* @__PURE__ */ jsx(
    At,
    {
      ref: o,
      onFocus: () => n && i(true),
      onBlur: (a) => {
        n && !a.currentTarget.contains(a.relatedTarget) && i(false);
      },
      className: X(
        "flex w-full flex-col overflow-hidden rounded-[var(--radius,0.5rem)] bg-popover text-popover-foreground",
        !n && "h-full",
        n && "relative overflow-visible",
        e
      ),
      ...r
    }
  ) });
});
EN.displayName = At.displayName;
const CN = c.forwardRef(({ className: e, ...n }, r) => {
  const { isDropdown: o, setIsOpen: s } = c.useContext(pi);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: X(
        "flex items-center border-b px-3 h-ui",
        o && "border-none"
      ),
      "cmr-input-wrapper": "",
      children: [
        /* @__PURE__ */ jsx(Dd, { className: "mr-2 h-4 w-4 shrink-0 opacity-50" }),
        /* @__PURE__ */ jsx(
          At.Input,
          {
            ref: r,
            onFocus: () => o && s(true),
            className: X(
              "flex w-full rounded-md bg-transparent py-3 text-ui outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
              e
            ),
            ...n
          }
        )
      ]
    }
  );
});
CN.displayName = At.Input.displayName;
const SN = c.forwardRef(({ className: e, ...n }, r) => {
  const { isOpen: o, isDropdown: s } = c.useContext(pi);
  return s && !o ? null : /* @__PURE__ */ jsx(
    At.List,
    {
      ref: r,
      className: X(
        "max-h-[300px] overflow-y-auto overflow-x-hidden",
        s && "absolute top-full left-0 z-portal w-full mt-1 rounded-md border bg-popover shadow-md animate-in fade-in-0 zoom-in-95",
        e
      ),
      ...n
    }
  );
});
SN.displayName = At.List.displayName;
const RN = c.forwardRef((e, n) => /* @__PURE__ */ jsx(
  At.Empty,
  {
    ref: n,
    className: "py-6 text-center text-sm",
    ...e
  }
));
RN.displayName = At.Empty.displayName;
const NN = c.forwardRef(({ className: e, ...n }, r) => /* @__PURE__ */ jsx(
  At.Group,
  {
    ref: r,
    className: X(
      "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
      e
    ),
    ...n
  }
));
NN.displayName = At.Group.displayName;
const TN = c.forwardRef(({ className: e, ...n }, r) => /* @__PURE__ */ jsx(
  At.Separator,
  {
    ref: r,
    className: X("-mx-1 h-px bg-border", e),
    ...n
  }
));
TN.displayName = At.Separator.displayName;
const kN = c.forwardRef(({ className: e, onSelect: n, ...r }, o) => {
  const { setIsOpen: s, isDropdown: i } = c.useContext(pi);
  return /* @__PURE__ */ jsx(
    At.Item,
    {
      ref: o,
      onSelect: (a) => {
        n == null ? void 0 : n(a), i && s(false);
      },
      className: X(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-ui outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 h-ui gap-2",
        e
      ),
      ...r
    }
  );
});
kN.displayName = At.Item.displayName;
c__default.memo(
  ({ date: e, format: n = "full", className: r, locale: o }) => {
    const s = o || "en", i = s === "ja" ? "ja-JP" : "en-GB";
    return /* @__PURE__ */ jsx("span", { className: r, children: (() => {
      switch (n) {
        case "weekday":
          return e.toLocaleDateString(i, { weekday: "long" });
        case "weekdayShort":
          return e.toLocaleDateString(i, { weekday: "short" });
        case "yearMonth":
          return s === "ja" ? `${e.getFullYear()}年${e.getMonth() + 1}月` : e.toLocaleDateString(i, {
            year: "numeric",
            month: "long"
          });
        case "monthDay":
          return s === "ja" ? `${e.getMonth() + 1}月${e.getDate()}日` : e.toLocaleDateString(i, {
            day: "numeric",
            month: "long"
          });
        case "monthDayShort": {
          if (s === "ja") {
            const u = e.toLocaleDateString(i, {
              weekday: "short"
            });
            return `${e.getMonth() + 1}/${e.getDate()} (${u})`;
          }
          const l = e.toLocaleDateString(i, {
            month: "short"
          }), f = e.toLocaleDateString(i, {
            weekday: "short"
          });
          return `${e.getDate()} ${l} (${f})`;
        }
        case "compact": {
          if (s === "ja") {
            const f = e.toLocaleDateString(i, {
              weekday: "short"
            });
            return `${e.getMonth() + 1}/${e.getDate()}
(${f})`;
          }
          const l = e.toLocaleDateString(i, {
            weekday: "short"
          });
          return `${e.getDate()}
${l}`;
        }
        case "date":
          return s === "ja" ? e.toLocaleDateString(i, {
            year: "numeric",
            month: "long",
            day: "numeric"
          }) : e.toLocaleDateString(i, {
            day: "numeric",
            month: "long",
            year: "numeric"
          });
        default:
          if (s === "ja") {
            const l = e.toLocaleDateString(i, {
              year: "numeric",
              month: "long",
              day: "numeric"
            }), f = e.toLocaleDateString(i, {
              weekday: "long"
            });
            return `${l}（${f}）`;
          }
          return e.toLocaleDateString(i, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
          });
      }
    })() });
  }
);
createContext(
  void 0
);
const MN = wr(
  "fixed z-modal gap-[var(--ui-gap-base)] bg-background p-[var(--ui-modal-padding)] shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom: "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right: "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm"
      }
    },
    defaultVariants: {
      side: "right"
    }
  }
);
c.memo(
  ({
    isOpen: e,
    onClose: n,
    children: r,
    position: o = "right",
    noPadding: s = false,
    title: i,
    description: a,
    className: l,
    width: f
  }) => /* @__PURE__ */ jsx(Hp, { open: e, onOpenChange: (u) => !u && n(), children: /* @__PURE__ */ jsxs(Cl, { children: [
    /* @__PURE__ */ jsx(
      yl,
      {
        className: X(
          "fixed inset-0 z-backdrop bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        )
      }
    ),
    /* @__PURE__ */ jsxs(
      El,
      {
        className: X(
          MN({ side: o }),
          s && "p-0",
          l
        ),
        style: f ? { width: f, maxWidth: "100vw" } : void 0,
        children: [
          /* @__PURE__ */ jsxs(
            "div",
            {
              className: X(
                "flex flex-col space-y-2 text-center sm:text-left",
                s ? "px-6 pt-6 mb-4" : "mb-4"
              ),
              children: [
                /* @__PURE__ */ jsx(
                  Sl,
                  {
                    className: X(
                      "text-lg font-semibold text-foreground",
                      !i && "sr-only"
                    ),
                    children: i || "Drawer"
                  }
                ),
                a && /* @__PURE__ */ jsx(Hr, { className: "text-sm text-muted-foreground", children: a })
              ]
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-y-auto -mx-[var(--ui-modal-padding)] px-[var(--ui-modal-padding)]", children: r }),
          /* @__PURE__ */ jsxs(xl, { className: "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary", children: [
            /* @__PURE__ */ jsx(Er, { className: "h-4 w-4" }),
            /* @__PURE__ */ jsx("span", { className: "sr-only", children: "Close" })
          ] })
        ]
      }
    )
  ] }) })
);
const kg = c.memo(
  c.forwardRef(
    ({ className: e, children: n, ...r }, o) => /* @__PURE__ */ jsx(
      "div",
      {
        ref: o,
        className: X("relative overflow-auto", e),
        ...r,
        children: n
      }
    )
  )
);
kg.displayName = "ScrollArea";
const DN = c.memo(
  ({
    trigger: e,
    items: n,
    align: r = "start",
    side: o = "bottom",
    offset: s = 8,
    maxHeight: i,
    visibleItemCount: a = 5,
    className: l = ""
  }) => {
    const f = r === "left" ? "start" : r === "right" ? "end" : r, u = c.useMemo(() => {
      if (i) return i;
      if (a)
        return `calc(var(--ui-list-row-height, 2.5rem) * ${a} + var(--ui-component-padding-y, 0.5rem) * 2)`;
    }, [i, a]);
    return /* @__PURE__ */ jsxs(_p, { children: [
      /* @__PURE__ */ jsx($p, { render: e, className: l }),
      /* @__PURE__ */ jsx(Mp, { children: /* @__PURE__ */ jsx(Dp, { sideOffset: s, align: f, side: o, children: /* @__PURE__ */ jsx(
        Pp,
        {
          "data-gxp-portal": "true",
          "data-gxp-top-layer": "true",
          className: "z-portal min-w-[160px] overflow-hidden rounded-[var(--radius,0.5rem)] border border-border bg-background shadow-lg outline-none data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95",
          children: /* @__PURE__ */ jsx(
            kg,
            {
              className: "py-[var(--ui-component-padding-y)]",
              style: { maxHeight: u },
              children: n.map((p) => /* @__PURE__ */ jsxs(
                Op,
                {
                  onClick: () => {
                    p.onClick();
                  },
                  className: "flex w-full cursor-default select-none items-center gap-ui px-ui text-left text-ui text-foreground hover:bg-accent focus:bg-accent focus:outline-none min-h-[var(--ui-list-row-height)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                  children: [
                    p.icon && /* @__PURE__ */ jsx("span", { className: "text-muted-foreground", children: p.icon }),
                    /* @__PURE__ */ jsx("span", { children: p.label })
                  ]
                },
                p.label
              ))
            }
          )
        }
      ) }) })
    ] });
  }
);
DN.displayName = "DropdownMenu";
const Og = wr(
  [
    "inline-flex w-full items-center justify-between gap-2 whitespace-nowrap",
    "rounded-md",
    "border border-input",
    "bg-background text-foreground",
    "transition-[border-color,box-shadow,background-color,color] duration-150 ease-in-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50"
  ].join(" "),
  {
    variants: {
      variant: {
        default: "",
        outline: "bg-transparent",
        ghost: "bg-transparent border-transparent shadow-none"
      },
      size: {
        sm: "min-h-8 rounded-md px-3 py-1 text-xs",
        md: "h-ui px-ui text-ui min-h-ui-touch",
        lg: "h-12 px-5 py-3 text-lg"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "md"
    }
  }
), Ig = wr(
  [
    "relative flex w-full select-none items-center",
    "outline-none",
    "transition-colors duration-150",
    "focus:bg-accent focus:text-accent-foreground",
    "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
  ].join(" "),
  {
    variants: {
      indicator: {
        none: "",
        check: ""
      },
      size: {
        sm: "min-h-8 py-1 text-xs",
        md: "min-h-[2.25rem] py-1.5 text-ui",
        lg: "min-h-12 py-3 text-lg"
      },
      padding: {
        plain: "px-3",
        withIndicator: "pl-3 pr-8"
      }
    },
    defaultVariants: {
      size: "md",
      indicator: "none",
      padding: "withIndicator"
    }
  }
), AN = c.forwardRef(
  ({
    value: e,
    onChange: n,
    options: r,
    className: o,
    placeholder: s,
    disabled: i = false,
    variant: a = "default",
    size: l = "md"
  }, f) => {
    const [u, p] = c.useState(false), d = c.useRef(null);
    c.useEffect(() => {
      const m = (b) => {
        d.current && !d.current.contains(b.target) && p(false);
      };
      return document.addEventListener("mousedown", m), () => document.removeEventListener("mousedown", m);
    }, []);
    const g = (m) => {
      n(String(m)), p(false);
    };
    return /* @__PURE__ */ jsxs("div", { className: X("relative", o), ref: d, children: [
      /* @__PURE__ */ jsxs(
        "div",
        {
          className: X(
            Og({ variant: a, size: l }),
            "cursor-text",
            "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
            i && "pointer-events-none"
          ),
          "aria-disabled": i,
          children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                ref: f,
                type: "text",
                value: e,
                onChange: (m) => n(m.target.value),
                placeholder: s,
                disabled: i,
                className: X(
                  "w-full bg-transparent border-none text-foreground text-left appearance-none focus:outline-none p-0 m-0",
                  "placeholder:text-muted-foreground"
                ),
                onFocus: () => p(true)
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => p((m) => !m),
                className: X(
                  "inline-flex items-center justify-center rounded",
                  "text-muted-foreground hover:bg-accent focus:outline-none"
                ),
                tabIndex: -1,
                "aria-label": "Toggle options",
                children: /* @__PURE__ */ jsx(
                  La,
                  {
                    className: X(l === "lg" ? "h-5 w-5" : "h-4 w-4")
                  }
                )
              }
            )
          ]
        }
      ),
      u && /* @__PURE__ */ jsx("div", { className: "absolute z-portal w-full mt-1 max-h-60 overflow-y-auto bg-background border border-border rounded-md shadow-lg scrollbar-thin", children: r.map((m) => /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => g(m),
          className: X(
            Ig({
              size: l,
              indicator: "none",
              padding: "plain"
            }),
            "w-full text-left text-foreground hover:bg-accent hover:text-accent-foreground"
          ),
          children: m
        },
        m
      )) })
    ] });
  }
);
AN.displayName = "EditableSelect";
const vc = c__default.createContext(null);
vc.displayName = "HookFormControlContext";
typeof window < "u" ? c__default.useLayoutEffect : c__default.useEffect;
const xc = c__default.createContext(null);
xc.displayName = "HookFormContext";
const YN = () => c__default.useContext(xc), Fg = c.createContext(
  void 0
);
function mi() {
  const e = c.useContext(Fg), n = c.useContext(_g), { getFieldState: r, formState: o } = YN();
  if (!e)
    throw new Error("useFormField should be used within <FormField>");
  const s = r(e.name, o), i = n.id;
  return {
    id: i,
    name: e.name,
    formItemId: `${i}-form-item`,
    formDescriptionId: `${i}-form-item-description`,
    formMessageId: `${i}-form-item-message`,
    ...s
  };
}
const _g = c.createContext(
  {}
);
const XN = c.forwardRef(({ className: e, ...n }, r) => {
  const o = c.useId();
  return /* @__PURE__ */ jsx(_g.Provider, { value: { id: o }, children: /* @__PURE__ */ jsx("div", { ref: r, className: X("space-y-2", e), ...n }) });
}), JN = c.memo(XN);
JN.displayName = "FormItem";
const ZN = c.forwardRef(({ className: e, ...n }, r) => {
  const { formItemId: o } = mi();
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Form label usage
    /* @__PURE__ */ jsx(
      "label",
      {
        ref: r,
        className: X(
          "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          e
        ),
        htmlFor: o,
        ...n
      }
    )
  );
}), QN = c.memo(ZN);
QN.displayName = "FormLabel";
const eT = c.forwardRef(({ children: e, ...n }, r) => {
  const { error: o, formItemId: s, formDescriptionId: i, formMessageId: a } = mi();
  return c.isValidElement(e) ? c.cloneElement(e, {
    ...e.props,
    ...n,
    id: s,
    "aria-describedby": o ? `${i} ${a}` : i,
    "aria-invalid": !!o,
    "aria-errormessage": a,
    className: X(
      e.props.className,
      n.className
    ),
    ref: r
  }) : /* @__PURE__ */ jsx(
    "div",
    {
      ref: r,
      id: s,
      "aria-describedby": o ? `${i} ${a}` : i,
      "aria-invalid": !!o,
      "aria-errormessage": a,
      ...n,
      children: e
    }
  );
}), tT = c.memo(eT);
tT.displayName = "FormControl";
const nT = c.forwardRef(({ className: e, ...n }, r) => {
  const { formDescriptionId: o } = mi();
  return /* @__PURE__ */ jsx(
    "p",
    {
      ref: r,
      id: o,
      className: X("text-sm text-muted-foreground", e),
      ...n
    }
  );
}), rT = c.memo(nT);
rT.displayName = "FormDescription";
const oT = c.forwardRef(({ className: e, children: n, ...r }, o) => {
  const { error: s, formMessageId: i } = mi(), a = s ? String(s == null ? void 0 : s.message) : n;
  return a ? /* @__PURE__ */ jsx(
    "p",
    {
      ref: o,
      id: i,
      className: X(
        "text-sm font-medium text-destructive-foreground",
        e
      ),
      ...r,
      children: a
    }
  ) : null;
}), sT = c.memo(oT);
sT.displayName = "FormMessage";
const iT = {
  dark: { tone: "dark" },
  tokyonight: { tone: "dark" },
  eclipse: { tone: "light" },
  macosclassic: { tone: "light" },
  fire: { tone: "dark" },
  classicterminal: { tone: "dark" },
  sakurabloom: { tone: "light" },
  leafmint: { tone: "light" },
  lattecream: { tone: "light" },
  sunshineOrange: { tone: "light" },
  light: { tone: "light" }
}, aT = {
  grid: "var(--color-chart-4)",
  axis: "var(--color-chart-3)",
  averageBand: "var(--color-chart-1)",
  averageBandStroke: "var(--color-chart-1)",
  valueFill: "var(--color-chart-2)",
  valueStroke: "var(--color-chart-2)",
  valuePoint: "var(--color-chart-2)",
  valuePointOutline: "var(--color-background)",
  label: "var(--color-foreground)"
}, lT = -Math.PI / 2, cT = Math.PI * 2, uT = (e, n, r) => Math.min(Math.max(e, n), r), Xi = (e, n, r) => r <= n ? 0 : uT((e - n) / (r - n), 0, 1), Ed = (e, n, r) => ({
  x: e + Math.cos(n) * r,
  y: e + Math.sin(n) * r
}), ir = (e) => {
  if (e.length === 0) return "";
  const n = e[0];
  if (!n) return "";
  const r = e.slice(1);
  return `M ${n.x.toFixed(2)} ${n.y.toFixed(2)} ${r.map((o) => `L ${o.x.toFixed(2)} ${o.y.toFixed(2)}`).join(" ")} Z`;
}, dT = (e) => Number.isInteger(e) ? `${e}` : e.toFixed(1).replace(/\.0$/, ""), Cd = () => {
  var _a2;
  if (typeof document > "u") return "light";
  const e = document.documentElement.getAttribute("data-theme") ?? "light";
  return ((_a2 = iT[e]) == null ? void 0 : _a2.tone) ?? "light";
}, Vg = c.forwardRef(
  ({
    data: e,
    variant: n = "auto",
    size: r = 360,
    padding: o = 56,
    gridLevels: s = 4,
    labelDistance: i = 24,
    animationEnabled: a,
    animate: l = true,
    animationDurationMs: f = 900,
    showValueLabels: u = false,
    showAverageRangeLabels: p = false,
    numberFormatter: d,
    enableExpandModal: g = false,
    expandedSize: m,
    expandedTitle: b = "Expanded health radar chart",
    showGrid: h = true,
    showAxes: v = true,
    showAverageGuides: y = true,
    pointRadius: x = 4,
    colors: R,
    className: S,
    "aria-label": E = "Health radar chart",
    onClick: C,
    onKeyDown: T,
    style: N,
    ...I
  }, L) => {
    const [A, P] = c.useState(false), [O, M] = c.useState(Cd);
    if (c.useEffect(() => {
      if (typeof document > "u") return;
      const U = document.documentElement, V = new MutationObserver((Y) => {
        for (const ee of Y)
          if (ee.type === "attributes" && ee.attributeName === "data-theme") {
            M(Cd());
            break;
          }
      });
      return V.observe(U, {
        attributes: true,
        attributeFilter: ["data-theme"]
      }), () => V.disconnect();
    }, []), e.length === 0) return null;
    const D = n === "auto" ? e.length : n, _ = e.slice(0, D);
    if (_.length < 3) return null;
    const k = { ...aT, ...R }, $ = r / 2, F = Math.max(r / 2 - o, 0), z = _.length, Q = Math.max(1, s), B = a ?? l, G = m ?? Math.min(Math.max(r + 180, 520), 920), W = O === "light" ? {
      grid: 0.7,
      axis: 0.8,
      averageFill: 0.34,
      averageStroke: 0.9,
      valueFill: 0.28,
      label: 0.95
    } : {
      grid: 0.35,
      axis: 0.55,
      averageFill: 0.22,
      averageStroke: 0.7,
      valueFill: 0.2,
      label: 0.8
    }, H = (U) => lT + cT * U / z, te = (U, V) => {
      const Y = H(U);
      return Ed($, Y, F * V);
    }, J = (U, V) => {
      const Y = U.x - $, ee = U.y - $, he = Math.hypot(Y, ee) || 1;
      return {
        x: U.x + Y / he * V,
        y: U.y + ee / he * V
      };
    }, oe = (U, V, Y) => d ? d(U, V, Y) : dT(U), ae = _.map(
      (U, V) => te(V, Xi(U.value, U.min, U.max))
    ), ue = _.map(
      (U, V) => te(V, Xi(U.averageOuter, U.min, U.max))
    ), fe = _.map(
      (U, V) => te(V, Xi(U.averageInner, U.min, U.max))
    ), le = ir(ae), se = `${ir(ue)} ${ir(
      [...fe].reverse()
    )}`.trim(), me = _.map((U, V) => te(V, 1)), ye = Array.from(
      { length: Q },
      (U, V) => ir(
        _.map(
          (Y, ee) => te(ee, (V + 1) / Q)
        )
      )
    ), ne = g ? { cursor: "zoom-in", ...N } : N, re = (U) => {
      C == null ? void 0 : C(U), !U.defaultPrevented && g && P(true);
    }, q = (U) => {
      T == null ? void 0 : T(U), !(U.defaultPrevented || !g) && (U.key === "Enter" || U.key === " ") && (U.preventDefault(), P(true));
    };
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs(
        "svg",
        {
          ref: L,
          "data-testid": "health-radar-chart",
          role: "img",
          "aria-label": E,
          viewBox: `0 0 ${r} ${r}`,
          width: r,
          height: r,
          className: X("h-auto w-full", S),
          tabIndex: g ? 0 : void 0,
          onClick: re,
          onKeyDown: q,
          style: ne,
          ...I,
          children: [
            h && /* @__PURE__ */ jsx("g", { "data-testid": "health-radar-grid", children: ye.map((U, V) => /* @__PURE__ */ jsx(
              "path",
              {
                d: U,
                fill: "none",
                stroke: k.grid,
                strokeOpacity: W.grid,
                strokeWidth: 1
              },
              `grid-${V + 1}`
            )) }),
            v && /* @__PURE__ */ jsx("g", { "data-testid": "health-radar-axes", children: me.map((U, V) => {
              var _a2;
              return /* @__PURE__ */ jsx(
                "line",
                {
                  x1: $,
                  y1: $,
                  x2: U.x,
                  y2: U.y,
                  stroke: k.axis,
                  strokeOpacity: W.axis,
                  strokeWidth: 1
                },
                `axis-${((_a2 = _[V]) == null ? void 0 : _a2.key) ?? V}`
              );
            }) }),
            /* @__PURE__ */ jsxs("g", { "data-testid": "health-radar-average-group", children: [
              /* @__PURE__ */ jsx(
                "path",
                {
                  "data-testid": "health-radar-average-band",
                  d: se,
                  fill: k.averageBand,
                  fillOpacity: W.averageFill,
                  fillRule: "evenodd"
                }
              ),
              y && /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsx(
                  "path",
                  {
                    d: ir(ue),
                    fill: "none",
                    stroke: k.averageBandStroke,
                    strokeOpacity: W.averageStroke,
                    strokeWidth: 1.5,
                    strokeLinejoin: "round"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "path",
                  {
                    d: ir(fe),
                    fill: "none",
                    stroke: k.averageBandStroke,
                    strokeOpacity: W.averageStroke,
                    strokeWidth: 1.5,
                    strokeLinejoin: "round"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs("g", { "data-testid": "health-radar-value-group", children: [
              /* @__PURE__ */ jsx(
                "path",
                {
                  d: le,
                  fill: k.valueFill,
                  fillOpacity: W.valueFill,
                  stroke: "none"
                }
              ),
              /* @__PURE__ */ jsx(
                "path",
                {
                  "data-testid": "health-radar-value-path",
                  d: le,
                  fill: "none",
                  stroke: k.valueStroke,
                  strokeWidth: 2.5,
                  strokeLinejoin: "round",
                  strokeLinecap: "round",
                  pathLength: 1,
                  strokeDasharray: 1,
                  strokeDashoffset: B ? 1 : 0,
                  children: B && /* @__PURE__ */ jsx(
                    "animate",
                    {
                      "data-testid": "health-radar-value-animation",
                      attributeName: "stroke-dashoffset",
                      from: "1",
                      to: "0",
                      dur: `${f}ms`,
                      fill: "freeze"
                    }
                  )
                }
              ),
              ae.map((U, V) => {
                var _a2, _b2;
                return /* @__PURE__ */ jsx(
                  "circle",
                  {
                    "data-testid": `health-radar-point-${((_a2 = _[V]) == null ? void 0 : _a2.key) ?? V}`,
                    cx: U.x,
                    cy: U.y,
                    r: x,
                    fill: k.valuePoint,
                    stroke: k.valuePointOutline,
                    strokeWidth: 2
                  },
                  `point-${((_b2 = _[V]) == null ? void 0 : _b2.key) ?? V}`
                );
              }),
              u && _.map((U, V) => {
                const Y = ae[V];
                if (!Y) return null;
                const ee = J(Y, 14);
                return /* @__PURE__ */ jsx(
                  "text",
                  {
                    "data-testid": `health-radar-value-label-${U.key}`,
                    x: ee.x,
                    y: ee.y,
                    textAnchor: "middle",
                    dominantBaseline: "middle",
                    fill: k.valueStroke,
                    fontSize: 11,
                    fontWeight: 600,
                    children: oe(U.value, "value", U)
                  },
                  `value-label-${U.key}`
                );
              }),
              p && _.map((U, V) => {
                const Y = ue[V], ee = fe[V];
                if (!Y || !ee) return null;
                const he = J(Y, 8), Me = J(ee, -8);
                return /* @__PURE__ */ jsxs("g", { children: [
                  /* @__PURE__ */ jsx(
                    "text",
                    {
                      "data-testid": `health-radar-average-outer-label-${U.key}`,
                      x: he.x,
                      y: he.y,
                      textAnchor: "middle",
                      dominantBaseline: "middle",
                      fill: k.averageBandStroke,
                      fontSize: 10,
                      children: oe(U.averageOuter, "averageOuter", U)
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "text",
                    {
                      "data-testid": `health-radar-average-inner-label-${U.key}`,
                      x: Me.x,
                      y: Me.y,
                      textAnchor: "middle",
                      dominantBaseline: "middle",
                      fill: k.averageBandStroke,
                      fontSize: 10,
                      children: oe(U.averageInner, "averageInner", U)
                    }
                  )
                ] }, `average-label-${U.key}`);
              })
            ] }),
            /* @__PURE__ */ jsx("g", { "data-testid": "health-radar-label-group", children: _.map((U, V) => {
              const Y = H(V), ee = U.labelOffset ?? {}, he = Ed(
                $,
                Y,
                F + i + (ee.radial ?? 0)
              ), Me = he.x + (ee.x ?? 0), Ue = he.y + (ee.y ?? 0), Le = Math.cos(Y), _e = Le > 0.3 ? "start" : Le < -0.3 ? "end" : "middle";
              return /* @__PURE__ */ jsx(
                "text",
                {
                  "data-testid": `health-radar-label-${U.key}`,
                  x: Me,
                  y: Ue,
                  textAnchor: _e,
                  dominantBaseline: "middle",
                  fill: k.label,
                  fillOpacity: W.label,
                  fontSize: 13,
                  children: U.label
                },
                `label-${U.key}`
              );
            }) })
          ]
        }
      ),
      g && A && /* @__PURE__ */ jsxs(
        "div",
        {
          "data-testid": "health-radar-modal",
          className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4",
          children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                "aria-label": "Close expanded chart overlay",
                className: "absolute inset-0",
                onClick: () => P(false)
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "relative w-full max-w-[95vw] rounded-lg bg-background p-4 text-foreground shadow-xl", children: [
              /* @__PURE__ */ jsxs("div", { className: "mb-3 flex items-center justify-between gap-4", children: [
                /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold", children: b }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    "aria-label": "Close expanded chart",
                    className: "rounded border border-border px-3 py-1 text-sm",
                    onClick: () => P(false),
                    children: "Close"
                  }
                )
              ] }),
              /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[95vw]", children: /* @__PURE__ */ jsx(
                Vg,
                {
                  data: e,
                  variant: n,
                  size: G,
                  padding: o,
                  gridLevels: s,
                  labelDistance: i,
                  animationEnabled: a,
                  animate: l,
                  animationDurationMs: f,
                  showValueLabels: u,
                  showAverageRangeLabels: p,
                  numberFormatter: d,
                  showGrid: h,
                  showAxes: v,
                  showAverageGuides: y,
                  pointRadius: x,
                  colors: R,
                  enableExpandModal: false,
                  "aria-label": `${E} expanded`
                }
              ) })
            ] })
          ]
        }
      )
    ] });
  }
);
Vg.displayName = "HealthRadarChart";
const Bg = Tm, $g = Cm, zg = Em, wc = c.memo(
  c.forwardRef(
    ({
      className: e,
      sideOffset: n = 4,
      side: r = "bottom",
      align: o = "center",
      ...s
    }, i) => /* @__PURE__ */ jsx(Sm, { children: /* @__PURE__ */ jsx(Rm, { sideOffset: n, side: r, align: o, children: /* @__PURE__ */ jsx(
      Nm,
      {
        ref: i,
        "data-gxp-top-layer": "true",
        className: X(
          "z-tooltip overflow-hidden rounded-[var(--radius-sm,2px)] border border-white bg-black text-white px-3 py-1.5 text-xs shadow-md animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          e
        ),
        ...s
      }
    ) }) })
  )
);
wc.displayName = "TooltipContent";
c__default.memo(
  ({ src: e, alt: n, open: r, onOpenChange: o, maxWidthPx: s = 900 }) => {
    const i = useRef(null);
    return useEffect(() => {
      const a = (l) => {
        l.key === "Escape" && r && (log.debug("Escape pressed, closing viewer"), o(false));
      };
      return window.addEventListener("keydown", a), () => window.removeEventListener("keydown", a);
    }, [r, o]), useEffect(() => {
      r && (e || log.warn("ImageViewer opened without src"));
    }, [r, e]), /* @__PURE__ */ jsx(
      To,
      {
        open: r,
        onOpenChange: o,
        noHeader: true,
        noPadding: true,
        contentClassName: "bg-black/90 border border-black/40 shadow-xl focus:outline-none flex items-center justify-center max-h-[90vh]",
        className: "p-2 md:p-4 bg-transparent border-none shadow-none",
        children: /* @__PURE__ */ jsx("div", { className: "w-full h-full flex items-center justify-center", children: e ? /* @__PURE__ */ jsx(
          "img",
          {
            ref: i,
            src: e,
            alt: n || t("image"),
            className: X(
              "rounded-md object-contain shadow-lg",
              "max-h-[80vh] w-auto",
              "transition-opacity duration-200"
            ),
            style: { maxWidth: `${s}px` }
          }
        ) : /* @__PURE__ */ jsx("div", { className: "text-muted-foreground text-sm", children: t("image") }) })
      }
    );
  }
);
const Ps = c.forwardRef(
  ({ className: e, type: n, ...r }, o) => /* @__PURE__ */ jsx(
    "input",
    {
      type: n,
      className: X(
        "flex h-ui w-full rounded-md border border-input bg-background px-3 text-foreground text-ui ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-ui-touch",
        e
      ),
      ref: o,
      ...r
    }
  )
);
Ps.displayName = "Input";
const un = 4, bT = (e) => e ? e.replace(/[^0-9]/g, "").slice(0, un) : "", vT = (e) => {
  const n = e.padEnd(un, "_");
  return `${n.slice(0, 2)}:${n.slice(2, 4)}`;
}, yT = (e) => {
  if (e.length !== un) return false;
  const n = Number.parseInt(e.slice(0, 2), 10), r = Number.parseInt(e.slice(2, 4), 10);
  return n >= 0 && n <= 23 && r >= 0 && r <= 59;
}, xT = (e) => `${e.slice(0, 2)}:${e.slice(2, 4)}`, wT = c__default.memo(
  ({
    open: e,
    title: n,
    onClose: r,
    displayContent: o,
    errorMessage: s,
    onNumberClick: i,
    onBackspace: a,
    onClear: l,
    onConfirm: f,
    additionalButton: u
  }) => /* @__PURE__ */ jsx(
    To,
    {
      open: e,
      onOpenChange: (p) => !p && r(),
      title: n,
      onClose: r,
      children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4", children: [
        /* @__PURE__ */ jsx("div", { className: "bg-card border-2 border-theme-text-primary rounded-lg p-[var(--ui-modal-padding)] min-h-[60px] flex items-center justify-center text-lg font-semibold text-foreground", children: o }),
        s && /* @__PURE__ */ jsx("div", { className: "text-destructive-foreground text-sm text-center p-2 bg-red-50 dark:bg-red-950 rounded-md border-l-[3px] border-theme-danger", children: s }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-3 gap-2", children: [
          [1, 2, 3, 4, 5, 6, 7, 8, 9].map((p) => /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => i(p.toString()),
              className: "min-h-[var(--ui-keypad-button-height)] text-lg font-semibold bg-background text-foreground border-2 border-theme-text-primary rounded-lg cursor-pointer transition-all active:scale-95 active:brightness-90 hover:brightness-110",
              children: p
            },
            p
          )),
          u || /* @__PURE__ */ jsx("div", { className: "min-h-[var(--ui-keypad-button-height)] bg-card rounded-lg" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => i("0"),
              className: "min-h-[var(--ui-keypad-button-height)] text-lg font-semibold bg-background text-foreground border-2 border-theme-text-primary rounded-lg cursor-pointer transition-all active:scale-95 active:brightness-90 hover:brightness-110",
              children: "0"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: a,
              className: "min-h-[var(--ui-keypad-button-height)] text-base font-semibold bg-background text-foreground border-2 border-theme-text-primary rounded-lg cursor-pointer transition-all active:scale-95 active:brightness-90 hover:brightness-110",
              children: "⌫"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-2 mt-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: l,
              className: "min-h-[var(--ui-keypad-button-height)] text-base font-semibold bg-background text-foreground border-2 border-theme-text-primary rounded-lg cursor-pointer transition-all active:scale-95 active:bg-destructive active:text-white active:border-theme-danger hover:bg-destructive hover:text-white hover:border-theme-danger",
              children: "C"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: f,
              className: "min-h-[var(--ui-keypad-button-height)] text-base font-semibold bg-background text-foreground border-2 border-theme-text-primary rounded-lg cursor-pointer transition-all active:scale-95 active:brightness-90 hover:brightness-110",
              children: "OK"
            }
          )
        ] })
      ] })
    }
  )
), ET = {
  number: {
    title: "数値を入力",
    placeholder: "",
    maxLength: 10
  },
  phone: {
    title: "電話番号を入力",
    placeholder: "090-0000-0000",
    maxLength: 13
  },
  time: {
    title: "時刻を入力",
    placeholder: "__:__",
    maxLength: un
  }
}, fs = c__default.memo(
  ({
    open: e,
    onClose: n,
    onSubmit: r,
    variant: o = "number",
    initialValue: s = "",
    title: i,
    placeholder: a,
    maxLength: l,
    allowDecimal: f = false
  }) => {
    const u = useMemo(
      () => o === "time" ? bT(s) : s,
      [o, s]
    ), [p, d] = useState(u), [g, m] = useState(""), b = useMemo(() => ET[o], [o]), h = i ?? b.title, v = a ?? b.placeholder, y = o === "time" ? un : l ?? b.maxLength, x = o === "number" && f, R = o === "phone", S = o === "time";
    useEffect(() => {
      e && (d(u), m(""));
    }, [e, u]);
    const E = useCallback(
      (O) => {
        if (S) {
          d((M) => M.length >= un ? (m(`最大${un}文字まで入力できます`), M) : (m(""), M.length === 0 && Number.parseInt(O, 10) >= 3 ? `0${O}` : (M + O).slice(0, un)));
          return;
        }
        d((M) => M.length >= y ? (m(`最大${y}文字まで入力できます`), M) : (m(""), `${M}${O}`));
      },
      [y, S]
    ), C = useCallback(() => {
      R && d((O) => O.length >= y ? (m(`最大${y}文字まで入力できます`), O) : O.endsWith("-") ? (m("ハイフンを連続して入力することはできません"), O) : (m(""), `${O}-`));
    }, [R, y]), T = useCallback(() => {
      x && d((O) => O.includes(".") ? (m("小数点は1つまでです"), O) : (m(""), `${O}.`));
    }, [x]), N = useCallback(() => {
      d((O) => O.slice(0, -1)), m("");
    }, []), I = useCallback(() => {
      d(""), m("");
    }, []), L = useCallback(() => {
      if (S) {
        d((O) => yT(O) ? (r(xT(O)), O) : (m("有効な時刻を 4 桁で入力してください（例: 0930）"), O));
        return;
      }
      d((O) => O === "" ? (m("値を入力してください"), O) : x && O.endsWith(".") ? (m("小数点で終わることはできません"), O) : R && O.endsWith("-") ? (m("ハイフンで終わることはできません"), O) : (r(O), O));
    }, [x, R, S, r]);
    useEffect(() => {
      if (!e) return;
      const O = (M) => {
        M.key >= "0" && M.key <= "9" || M.code >= "Numpad0" && M.code <= "Numpad9" ? (M.preventDefault(), E(M.key)) : R && (M.key === "-" || M.code === "NumpadSubtract" || M.key === "Minus") ? (M.preventDefault(), C()) : x && (M.key === "." || M.code === "NumpadDecimal") ? (M.preventDefault(), T()) : M.key === "Backspace" ? (M.preventDefault(), N()) : M.key === "Enter" ? (M.preventDefault(), L()) : M.key === "Escape" && (M.preventDefault(), n());
      };
      return window.addEventListener("keydown", O), () => window.removeEventListener("keydown", O);
    }, [
      e,
      R,
      x,
      n,
      E,
      C,
      T,
      N,
      L
    ]);
    const A = S ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center gap-2 w-full", children: [
      /* @__PURE__ */ jsx(
        "span",
        {
          style: {
            fontSize: "24px",
            fontFamily: "monospace",
            color: "hsl(var(--foreground))",
            letterSpacing: "2px",
            fontWeight: 600
          },
          children: vT(p)
        }
      ),
      /* @__PURE__ */ jsxs(
        "span",
        {
          style: { fontSize: "12px", color: "var(--theme-text-secondary)" },
          children: [
            "入力: ",
            p.padEnd(un, "・")
          ]
        }
      )
    ] }) : /* @__PURE__ */ jsx(
      "span",
      {
        style: {
          fontSize: "24px",
          fontFamily: "monospace",
          color: "hsl(var(--foreground))",
          fontWeight: 600
        },
        children: p || /* @__PURE__ */ jsx("span", { style: { color: "var(--theme-text-secondary)" }, children: v })
      }
    ), P = useMemo(() => {
      if (R || x)
        return /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: R ? C : T,
            className: "min-h-[var(--ui-keypad-button-height)] text-lg font-semibold bg-background text-foreground border-2 border-theme-text-primary rounded-lg cursor-pointer transition-all active:scale-95 active:brightness-90 hover:brightness-110",
            children: R ? "-" : "."
          }
        );
    }, [R, x, C, T]);
    return /* @__PURE__ */ jsx(
      wT,
      {
        open: e,
        title: h,
        onClose: n,
        displayContent: A,
        errorMessage: g,
        onNumberClick: E,
        onBackspace: N,
        onClear: I,
        onConfirm: L,
        additionalButton: P
      }
    );
  }
);
fs.displayName = "KeypadModal";
const CT = c.memo(
  c.forwardRef(({ className: e, ...n }, r) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: Generic label component
    /* @__PURE__ */ jsx(
      "label",
      {
        ref: r,
        className: X(
          "text-ui font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70 peer-disabled:text-theme-disabled-text",
          e
        ),
        ...n
      }
    )
  ))
);
CT.displayName = "Label";
const ST = lE, Ck = nm, Hg = c.memo(
  c.forwardRef(
    ({ className: e, children: n, disabled: r, style: o, variant: s, size: i, ...a }, l) => /* @__PURE__ */ jsxs(
      tm,
      {
        ref: l,
        disabled: r,
        style: o,
        className: X(Og({ variant: s, size: i }), e),
        ...a,
        children: [
          n,
          /* @__PURE__ */ jsx(rm, { children: /* @__PURE__ */ jsx(La, { className: "h-4 w-4 opacity-50 transition-transform data-[state=open]:rotate-180" }) })
        ]
      }
    )
  )
);
Hg.displayName = "SelectTrigger";
const Ug = c.memo(
  c.forwardRef(
    ({
      className: e,
      children: n,
      alignItemWithTrigger: r = false,
      scrollable: o = true,
      sideOffset: s = 4,
      side: i = "bottom",
      align: a = "start",
      ...l
    }, f) => /* @__PURE__ */ jsx(sm, { children: /* @__PURE__ */ jsx(
      im,
      {
        side: i,
        align: a,
        sideOffset: r ? 0 : s,
        className: "z-portal",
        children: /* @__PURE__ */ jsx(
          lm,
          {
            ref: f,
            "data-gxp-portal": "true",
            "data-gxp-top-layer": "true",
            className: X(
              "relative box-border overflow-hidden rounded-md border border-input bg-background text-foreground shadow-md outline-none",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "data-[state=open]:slide-in-from-top-0",
              "w-[var(--anchor-width)] min-w-[var(--anchor-width)] max-w-[var(--anchor-width)]",
              e
            ),
            ...l,
            children: /* @__PURE__ */ jsx(
              "div",
              {
                className: X(
                  "w-full py-1",
                  o && "max-h-[var(--radix-select-content-available-height,16rem)] overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable] scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
                ),
                children: n
              }
            )
          }
        )
      }
    ) })
  )
);
Ug.displayName = "SelectContent";
const RT = c.forwardRef(({ className: e, ...n }, r) => /* @__PURE__ */ jsx(
  mm,
  {
    ref: r,
    className: X(
      "px-3 py-2 text-xs font-semibold text-muted-foreground/80",
      e
    ),
    ...n
  }
));
RT.displayName = "SelectLabel";
const Wg = c.memo(
  c.forwardRef(({ className: e, children: n, size: r, ...o }, s) => /* @__PURE__ */ jsxs(
    cm,
    {
      ref: s,
      className: X(
        Ig({ size: r }),
        "relative flex w-full cursor-default select-none items-center px-3 py-2 text-sm outline-none transition-colors",
        e
      ),
      ...o,
      children: [
        /* @__PURE__ */ jsx(fm, { className: "flex-1 truncate", children: n }),
        /* @__PURE__ */ jsx("span", { className: "flex h-4 w-4 items-center justify-center shrink-0 ml-2", children: /* @__PURE__ */ jsx(um, { children: /* @__PURE__ */ jsx(ps, { className: "h-4 w-4 text-primary", strokeWidth: 2.5 }) }) })
      ]
    }
  ))
);
Wg.displayName = "SelectItem";
const NT = c.forwardRef(({ className: e, ...n }, r) => /* @__PURE__ */ jsx(
  "div",
  {
    ref: r,
    className: X("-mx-1 my-1 h-px bg-muted", e),
    ...n
  }
));
NT.displayName = "SelectSeparator";
const TT = [
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" }
];
c__default.memo(
  ({
    className: e = "",
    buttonClassName: n = "",
    id: r,
    align: o = "right",
    value: s,
    onValueChange: i,
    languages: a = TT
  }) => {
    var _a2;
    const { i18n: l } = useTranslation(), f = (d) => {
      if (!d) return;
      i ? i(d) : l.changeLanguage(d);
      const g = globalThis.log;
      g && typeof g.info == "function" && g.info("Language changed", { language: d });
    }, u = s ?? l.language ?? "ja", p = (_a2 = a.find(
      (d) => d.value === u
    )) == null ? void 0 : _a2.label;
    return /* @__PURE__ */ jsx("div", { className: X("relative", e), id: r, children: /* @__PURE__ */ jsxs(ST, { value: u, onValueChange: f, children: [
      /* @__PURE__ */ jsx(
        Hg,
        {
          className: X("w-auto min-w-[100px]", n),
          children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(jh, { className: "w-[var(--ui-icon-size)] h-[var(--ui-icon-size)]" }),
            /* @__PURE__ */ jsx("span", { children: p })
          ] })
        }
      ),
      /* @__PURE__ */ jsx(Ug, { align: o === "left" ? "start" : "end", children: a.map((d) => /* @__PURE__ */ jsx(Wg, { value: d.value, children: d.label }, d.value)) })
    ] }) });
  }
);
const IT = (e, n, r) => Math.min(Math.max(e, n), r);
c__default.memo(
  ({
    steps: e,
    activeStep: n,
    onStepChange: r,
    renderStepContent: o,
    orientation: s = "horizontal",
    variant: i = "split",
    compactOnMobile: a = true,
    inlineContentOnVerticalMobile: l = true,
    className: f
  }) => {
    const u = IT(n, 0, Math.max(e.length - 1, 0)), p = (h) => h < u ? "completed" : h === u ? "current" : "upcoming", d = (h, v) => X("h-[var(--ui-step-circle-size)] w-[var(--ui-step-circle-size)] rounded-full border-2 flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-colors", h === "completed" ? "bg-success border-success text-primary-foreground" : h === "current" ? "bg-primary border-primary text-primary-foreground" : "bg-background border-border text-muted-foreground", r ? "cursor-pointer hover:brightness-110" : "", v ? "opacity-50 cursor-not-allowed hover:brightness-100" : ""), g = (h, v, y) => r ? /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: () => {
          y || r(h);
        },
        disabled: y,
        "aria-current": h === u ? "step" : void 0,
        children: v
      }
    ) : /* @__PURE__ */ jsx("div", { className: X(y ? "pointer-events-none" : ""), children: v });
    if (e.length === 0)
      return null;
    if (s === "vertical") {
      const h = e[u], v = i === "accordion";
      return /* @__PURE__ */ jsx("nav", { "aria-label": "Progress", className: X("w-full", f), children: /* @__PURE__ */ jsxs(
        "div",
        {
          className: X(
            "grid gap-3",
            v ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-[192px_1fr]"
          ),
          children: [
            /* @__PURE__ */ jsx("ol", { className: "flex flex-col", children: e.map((y, x) => {
              const R = p(x), S = x === e.length - 1, E = x === u;
              return /* @__PURE__ */ jsxs("li", { className: "flex flex-col", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center", children: [
                    g(
                      x,
                      /* @__PURE__ */ jsx("div", { className: d(R, y.disabled), children: R === "completed" ? /* @__PURE__ */ jsx(ps, { className: "h-4 w-4" }) : x + 1 }),
                      y.disabled
                    ),
                    !S && /* @__PURE__ */ jsx(
                      "div",
                      {
                        className: X(
                          "w-0.5 flex-1 mt-2",
                          R === "completed" ? "bg-success" : "bg-border"
                        ),
                        style: {
                          minHeight: v && E ? 32 : 16
                        }
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "min-w-0 pb-3 flex-1", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                      /* @__PURE__ */ jsx(
                        "div",
                        {
                          className: X(
                            "text-sm font-semibold",
                            y.disabled ? "text-muted-foreground/50" : R === "current" ? "text-foreground" : "text-muted-foreground"
                          ),
                          children: y.title
                        }
                      ),
                      R === "current" && /* @__PURE__ */ jsx("span", { className: "text-xs px-2 py-0.5 rounded bg-card text-muted-foreground", children: "Current" })
                    ] }),
                    y.description && /* @__PURE__ */ jsx("div", { className: "text-xs text-muted-foreground mt-0.5", children: y.description })
                  ] })
                ] }),
                (l || v) && E && o && /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: X(
                      "w-full pb-8 pl-9",
                      // Indent content in accordion
                      !v && "sm:hidden"
                    ),
                    children: /* @__PURE__ */ jsx("div", { className: "w-full", children: o(y, x) })
                  }
                )
              ] }, y.id);
            }) }),
            !v && o && h && /* @__PURE__ */ jsx("div", { className: "hidden sm:block", children: /* @__PURE__ */ jsx("div", { className: "rounded-lg border border-border bg-background p-1", children: o(h, u) }) })
          ]
        }
      ) });
    }
    const m = e[u], b = m == null ? void 0 : m.title;
    return /* @__PURE__ */ jsx("nav", { "aria-label": "Progress", className: X("w-full", f), children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3", children: [
      a && /* @__PURE__ */ jsxs(
        "div",
        {
          className: "text-sm text-muted-foreground sm:hidden",
          "aria-live": "polite",
          children: [
            u + 1,
            " / ",
            e.length,
            b ? ` - ${b}` : ""
          ]
        }
      ),
      /* @__PURE__ */ jsx(
        "ol",
        {
          className: X(
            "flex items-center gap-2 overflow-x-auto pb-1",
            a && "sm:overflow-visible"
          ),
          children: e.map((h, v) => {
            const y = p(v), x = v === e.length - 1, R = v === u;
            return /* @__PURE__ */ jsxs(c__default.Fragment, { children: [
              /* @__PURE__ */ jsxs(
                "li",
                {
                  className: X(
                    "flex flex-col items-center flex-shrink-0",
                    a ? "min-w-[40px] sm:min-w-[120px]" : "min-w-[120px]"
                  ),
                  children: [
                    g(
                      v,
                      /* @__PURE__ */ jsx("div", { className: d(y, h.disabled), children: y === "completed" ? /* @__PURE__ */ jsx(ps, { className: "h-4 w-4" }) : v + 1 }),
                      h.disabled
                    ),
                    /* @__PURE__ */ jsxs(
                      "div",
                      {
                        className: X(
                          "mt-2 text-center min-w-0",
                          a ? R ? "sm:block" : "hidden sm:block" : "block"
                        ),
                        children: [
                          /* @__PURE__ */ jsx(
                            "div",
                            {
                              className: X(
                                "text-xs font-semibold truncate",
                                h.disabled ? "text-muted-foreground/50" : y === "current" ? "text-foreground" : y === "completed" ? "text-muted-foreground" : "text-muted-foreground/50"
                              ),
                              title: h.title,
                              children: h.title
                            }
                          ),
                          h.description && /* @__PURE__ */ jsx(
                            "div",
                            {
                              className: "hidden sm:block text-xs text-muted-foreground truncate",
                              title: h.description,
                              children: h.description
                            }
                          )
                        ]
                      }
                    )
                  ]
                }
              ),
              !x && /* @__PURE__ */ jsx(
                "div",
                {
                  className: X(
                    "h-0.5 flex-shrink-0",
                    y === "completed" ? "bg-success" : "bg-border",
                    a ? "w-8 min-w-8 sm:w-16" : "w-16 min-w-16"
                  ),
                  "aria-hidden": "true"
                }
              )
            ] }, h.id);
          })
        }
      ),
      o && m && /* @__PURE__ */ jsx("div", { className: "rounded-lg border border-border bg-background p-1", children: o(m, u) })
    ] }) });
  }
);
const PT = {
  info: "border-l-info",
  success: "border-l-success",
  warning: "border-l-warning",
  error: "border-l-destructive"
}, MT = {
  info: Gh,
  success: Bh,
  warning: db,
  error: Pd
}, DT = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  error: "text-destructive"
}, AT = c.memo(
  ({
    type: e,
    title: n,
    message: r,
    linkLabel: o,
    onClickLink: s,
    onClose: i,
    showCloseButton: a = true,
    className: l,
    ...f
  }) => {
    const u = (m, b) => b ?? m, p = PT[e], d = typeof s == "function", g = MT[e];
    return /* @__PURE__ */ jsxs(
      "div",
      {
        className: X(
          "relative w-full max-w-sm bg-background shadow-md rounded-lg border border-border border-l-4",
          "pr-[calc(var(--ui-component-padding-x)+5px)] pl-1 py-[calc(var(--ui-component-padding-y)+5px)]",
          p,
          d ? "hover:shadow-lg" : void 0,
          l
        ),
        role: "alert",
        "aria-live": "polite",
        "aria-atomic": "true",
        ...f,
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-[var(--ui-gap-base)]", children: [
            /* @__PURE__ */ jsx(
              "div",
              {
                className: X("shrink-0", DT[e]),
                "aria-hidden": "true",
                children: /* @__PURE__ */ jsx(g, { className: "h-4 w-4" })
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "flex-1 min-w-0", children: d ? /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: "w-full text-left",
                onClick: s,
                "aria-label": o ? `${n}. ${o}` : n,
                children: /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                  /* @__PURE__ */ jsx("h4", { className: "text-sm font-bold text-foreground truncate leading-tight", children: n }),
                  /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground break-words leading-tight", children: r }),
                  /* @__PURE__ */ jsxs("div", { className: "text-xs text-accent-foreground flex items-center gap-1 leading-tight", children: [
                    /* @__PURE__ */ jsx(kh, { className: "h-3 w-3" }),
                    /* @__PURE__ */ jsx("span", { children: o || u("details", "詳細を見る") })
                  ] })
                ] })
              }
            ) : /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsx("h4", { className: "text-sm font-bold text-foreground truncate leading-tight", children: n }),
              /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground break-words leading-tight", children: r })
            ] }) })
          ] }),
          a && /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: (m) => {
                m.stopPropagation(), i == null ? void 0 : i();
              },
              className: "absolute top-[5px] right-[5px] flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors p-1",
              "aria-label": u("close", "Close"),
              children: /* @__PURE__ */ jsx(Er, { className: "h-3 w-3" })
            }
          )
        ]
      }
    );
  }
);
AT.displayName = "NotificationToast";
const Ec = "-", LT = () => {
  if (typeof document > "u") return;
  const e = document.documentElement.getAttribute(
    "data-number-format-locale"
  );
  return (e == null ? void 0 : e.trim()) ? e : void 0;
}, Cc = (e) => {
  if (e) return e;
  const n = LT();
  return n || (typeof Intl < "u" && Intl.NumberFormat ? new Intl.NumberFormat().resolvedOptions().locale : "en-US");
}, Sc = (e, n, r, o) => {
  try {
    return new Intl.NumberFormat(n, r).format(e);
  } catch {
    try {
      return new Intl.NumberFormat("en-US", r).format(e);
    } catch {
      return o ?? String(e);
    }
  }
}, FT = ({
  value: e,
  className: n,
  locale: r,
  options: o,
  fallback: s = Ec,
  valueScale: i = "ratio"
}) => {
  if (e == null || !Number.isFinite(e))
    return /* @__PURE__ */ jsx("span", { className: n, children: s });
  const a = Cc(r), l = i === "percent" ? e / 100 : e, u = {
    maximumFractionDigits: (o == null ? void 0 : o.maximumFractionDigits) ?? (o == null ? void 0 : o.minimumFractionDigits) ?? 1,
    ...o,
    style: "percent"
  }, p = Sc(
    l,
    a,
    u,
    s
  );
  return /* @__PURE__ */ jsx("span", { className: n, children: p });
};
c__default.memo(
  ({
    currentPage: e,
    totalPages: n,
    onPrevPage: r,
    onNextPage: o,
    prevLabel: s = "Previous page",
    nextLabel: i = "Next page",
    prevContent: a = /* @__PURE__ */ jsx(Qi, { className: "h-4 w-4" }),
    nextContent: l = /* @__PURE__ */ jsx(ea, { className: "h-4 w-4" }),
    pageInfoFormatter: f,
    className: u
  }) => {
    if (n <= 1)
      return null;
    const p = e <= 1, d = e >= n, g = (f == null ? void 0 : f(e, n)) ?? `${e} / ${n}`, m = () => {
      p || r();
    }, b = () => {
      d || o();
    };
    return /* @__PURE__ */ jsxs("div", { className: X("flex flex-wrap items-center gap-2", u), children: [
      /* @__PURE__ */ jsx(
        Et,
        {
          type: "button",
          variant: "outline",
          size: "icon",
          onClick: m,
          disabled: p,
          "aria-label": s,
          children: a
        }
      ),
      /* @__PURE__ */ jsx(
        "span",
        {
          className: "text-ui text-foreground font-medium whitespace-nowrap",
          "aria-live": "polite",
          children: g
        }
      ),
      /* @__PURE__ */ jsx(
        Et,
        {
          type: "button",
          variant: "outline",
          size: "icon",
          onClick: b,
          disabled: d,
          "aria-label": i,
          children: l
        }
      )
    ] });
  }
);
const _T = c.forwardRef(
  ({ className: e, align: n = "center", sideOffset: r = 4, side: o = "bottom", ...s }, i) => /* @__PURE__ */ jsx(jp, { children: /* @__PURE__ */ jsx(Kp, { sideOffset: r, align: n, side: o, children: /* @__PURE__ */ jsx(
    Yp,
    {
      ref: i,
      "data-gxp-portal": "true",
      "data-gxp-top-layer": "true",
      className: X(
        "z-portal rounded-[var(--radius,0.5rem)] border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        e
      ),
      ...s
    }
  ) }) })
);
_T.displayName = "PopoverContent";
const VT = c.forwardRef(
  ({
    className: e,
    value: n,
    label: r,
    subLabel: o,
    height: s = "h-[var(--ui-progress-height)]",
    color: i,
    striped: a = true,
    animated: l = true,
    status: f = "normal",
    ...u
  }, p) => {
    const d = Math.min(Math.max(n || 0, 0), 100), g = (v, y, x) => `rgb(${v.map((S, E) => {
      const C = y[E] || 0;
      return Math.round(S + (C - S) * x);
    }).join(",")})`, m = () => {
      if (i) return { className: i };
      if (f === "paused") return { className: "bg-yellow-500" };
      if (f === "error") return { className: "bg-red-800" };
      const v = [4, 120, 87], y = [37, 99, 235], x = [34, 211, 238];
      let R = "";
      return d <= 50 ? R = g(v, y, d / 50) : R = g(
        y,
        x,
        (d - 50) / 50
      ), { style: { backgroundColor: R } };
    }, { className: b, style: h } = m();
    return /* @__PURE__ */ jsxs("div", { className: "w-full", children: [
      (r || o) && /* @__PURE__ */ jsxs("div", { className: "flex justify-between mb-1 text-sm", children: [
        /* @__PURE__ */ jsx("div", { className: "font-medium text-foreground", children: r }),
        /* @__PURE__ */ jsx("div", { className: "text-muted-foreground", children: o })
      ] }),
      /* @__PURE__ */ jsx(
        Jp,
        {
          ref: p,
          className: X(
            "relative w-full overflow-hidden rounded-full bg-card",
            s,
            e
          ),
          value: n,
          ...u,
          children: /* @__PURE__ */ jsx(Zp, { className: "h-full w-full", children: /* @__PURE__ */ jsx(
            Qp,
            {
              className: X(
                "h-full transition-all duration-500 ease-out flex items-center justify-end pr-2",
                b,
                a && "bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem]",
                l && "animate-progress-stripes"
              ),
              style: {
                width: `${d}%`,
                ...h
              },
              children: s !== "h-1" && s !== "h-2" && /* @__PURE__ */ jsx(
                FT,
                {
                  value: d,
                  valueScale: "percent",
                  options: { maximumFractionDigits: 0 },
                  className: "text-[10px] font-bold text-white drop-shadow-md opacity-80 pe-1"
                }
              )
            }
          ) })
        }
      )
    ] });
  }
);
VT.displayName = "ProgressBar";
const BT = c.memo(
  ({
    label: e,
    value: n,
    onChange: r,
    min: o = 0,
    max: s = 10,
    minLabel: i,
    maxLabel: a,
    className: l,
    disabled: f = false
  }) => {
    const u = c.useMemo(() => {
      const p = [];
      for (let d = o; d <= s; d++)
        p.push(d);
      return p;
    }, [o, s]);
    return /* @__PURE__ */ jsxs("div", { className: X("flex flex-col gap-2", l), children: [
      e && /* @__PURE__ */ jsx("span", { className: "text-sm font-medium text-muted-foreground", children: e }),
      /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-theme-border scrollbar-track-transparent", children: u.map((p) => /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => !f && r(p),
          disabled: f,
          type: "button",
          className: X(
            "w-[var(--ui-component-height)] h-[var(--ui-component-height)] rounded-full flex-shrink-0 flex items-center justify-center font-bold transition-all border",
            n === p ? "bg-primary text-primary-foreground border-theme-object-primary shadow-md scale-110" : "bg-card text-muted-foreground border-border hover:bg-muted",
            f && "opacity-50 cursor-not-allowed hover:bg-card hover:scale-100"
          ),
          children: p
        },
        p
      )) }),
      (i || a) && /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-xs text-muted-foreground px-1 select-none", children: [
        /* @__PURE__ */ jsx("span", { children: i }),
        /* @__PURE__ */ jsx("span", { children: a })
      ] })
    ] });
  }
);
BT.displayName = "ScaleInput";
const $T = c.forwardRef(
  ({
    options: e,
    value: n,
    onChange: r,
    placeholder: o,
    className: s,
    id: i,
    name: a,
    disabled: l = false,
    required: f = false,
    noResultsText: u = "No results"
  }, p) => {
    const d = c.useRef(null), g = c.useId(), m = c.useMemo(() => {
      var _a2;
      return ((_a2 = e.find((L) => L.value === n)) == null ? void 0 : _a2.label) ?? "";
    }, [e, n]), [b, h] = c.useState(m), [v, y] = c.useState(false), [x, R] = c.useState(-1), S = c.useRef(n), E = c.useRef(null);
    c.useEffect(() => {
      n !== S.current && (S.current = n, E.current = null, v || h(m));
    }, [v, m, n]), c.useEffect(() => {
      if (!v) {
        if (E.current) return;
        h(m);
      }
    }, [v, m]);
    const C = c.useMemo(() => {
      const L = b.trim().toLowerCase();
      return L ? e.filter((A) => {
        const P = A.label.toLowerCase(), O = A.value.toLowerCase();
        return P.includes(L) || O.includes(L);
      }) : e;
    }, [e, b]);
    c.useEffect(() => {
      v && R(C.length ? 0 : -1);
    }, [v, C.length]), c.useEffect(() => {
      if (!v) return;
      const L = (A) => {
        const P = A.target;
        P && d.current && !d.current.contains(P) && y(false);
      };
      return document.addEventListener("mousedown", L), () => document.removeEventListener("mousedown", L);
    }, [v]);
    const T = c.useCallback(
      (L) => {
        E.current = L.value, r == null ? void 0 : r(L.value), h(L.label), y(false);
      },
      [r]
    ), N = () => {
      setTimeout(() => {
        d.current && (d.current.contains(document.activeElement) || y(false));
      }, 0);
    }, I = (L) => {
      if (!l) {
        if (L.key === "ArrowDown") {
          L.preventDefault(), y(true), R((A) => Math.min(A + 1, C.length - 1));
          return;
        }
        if (L.key === "ArrowUp") {
          L.preventDefault(), y(true), R((A) => Math.max(A - 1, 0));
          return;
        }
        if (L.key === "Enter") {
          if (!v) return;
          L.preventDefault();
          const A = C[x];
          A && T(A);
          return;
        }
        if (L.key === "Escape") {
          if (!v) return;
          L.preventDefault(), y(false);
          return;
        }
      }
    };
    return /* @__PURE__ */ jsxs("div", { className: "relative", ref: d, children: [
      /* @__PURE__ */ jsx(
        Ps,
        {
          ref: p,
          id: i,
          name: a,
          disabled: l,
          required: f,
          value: b,
          placeholder: o,
          autoComplete: "off",
          "aria-label": o,
          role: "combobox",
          "aria-expanded": v,
          "aria-controls": g,
          "aria-autocomplete": "list",
          className: X(s),
          onFocus: () => !l && y(true),
          onBlur: N,
          onKeyDown: I,
          onChange: (L) => {
            h(L.target.value), l || y(true);
          }
        }
      ),
      v && /* @__PURE__ */ jsx(
        "div",
        {
          id: g,
          role: "listbox",
          className: X(
            "absolute z-portal mt-1 w-full overflow-auto rounded-md border border-border bg-background shadow-lg",
            "max-h-60"
          ),
          children: C.length === 0 ? /* @__PURE__ */ jsx("div", { className: "px-3 py-2 text-sm text-muted-foreground", children: u }) : C.map((L, A) => /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              role: "option",
              "aria-selected": A === x,
              className: X(
                "w-full px-3 py-2 text-left text-sm text-foreground",
                "hover:bg-accent hover:text-accent-foreground focus:outline-none",
                A === x && "bg-accent text-accent-foreground"
              ),
              onMouseDown: (P) => P.preventDefault(),
              onMouseEnter: () => R(A),
              onClick: () => T(L),
              children: L.label
            },
            L.value
          ))
        }
      )
    ] });
  }
);
$T.displayName = "SearchableSelect";
const zT = c.forwardRef(({ className: e, orientation: n = "horizontal", ...r }, o) => /* @__PURE__ */ jsx(
  Ep,
  {
    ref: o,
    orientation: n,
    className: X(
      "shrink-0 bg-border",
      n === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
      e
    ),
    ...r
  }
));
zT.displayName = "Separator";
const HT = c__default.memo(
  c__default.forwardRef(
    ({ onSearch: e, className: n, ...r }, o) => /* @__PURE__ */ jsxs("div", { className: "relative w-full", children: [
      /* @__PURE__ */ jsx(Dd, { className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }),
      /* @__PURE__ */ jsx(
        "input",
        {
          ref: o,
          type: "text",
          className: X(
            "flex h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            n
          ),
          placeholder: "Search...",
          onChange: (s) => e == null ? void 0 : e(s.target.value),
          ...r
        }
      )
    ] })
  )
);
HT.displayName = "SimpleSearchInput";
const UT = c.forwardRef(({ className: e, ...n }, r) => /* @__PURE__ */ jsx(
  hm,
  {
    className: X(
      "peer inline-flex h-[var(--ui-switch-height)] w-[var(--ui-switch-width)] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary bg-input",
      e
    ),
    ...n,
    ref: r,
    children: /* @__PURE__ */ jsx(
      bm,
      {
        className: X(
          "pointer-events-none block h-[var(--ui-switch-thumb-size)] w-[var(--ui-switch-thumb-size)] rounded-full bg-background shadow-lg ring-0 transition-transform data-[checked]:translate-x-[var(--ui-switch-thumb-translate)] translate-x-0"
        )
      }
    )
  }
));
UT.displayName = "Switch";
const Lk = vm, WT = c.forwardRef(
  ({ className: e, children: n, onBack: r, backButtonLabel: o, ...s }, i) => /* @__PURE__ */ jsxs(
    wm,
    {
      ref: i,
      className: X(
        "inline-flex items-center justify-start rounded-[var(--radius,0.5rem)] bg-muted text-muted-foreground",
        "w-full p-1 h-auto",
        e
      ),
      ...s,
      children: [
        r && /* @__PURE__ */ jsxs(
          Et,
          {
            variant: "ghost",
            size: "sm",
            className: "mr-1 h-7 px-2 text-muted-foreground hover:text-foreground shrink-0",
            onClick: r,
            children: [
              /* @__PURE__ */ jsx(Id, { className: "mr-1 h-4 w-4" }),
              o || "戻る"
            ]
          }
        ),
        n
      ]
    }
  )
);
WT.displayName = "TabsList";
const jT = c.forwardRef(
  ({ className: e, children: n, icon: r, ...o }, s) => /* @__PURE__ */ jsxs(
    ym,
    {
      ref: s,
      className: X(
        "inline-flex items-center justify-center whitespace-nowrap rounded-[calc(var(--radius,0.5rem)-4px)] px-ui py-ui text-ui font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        "aria-selected:bg-background aria-selected:text-foreground aria-selected:shadow-sm",
        "flex-1 md:flex-none",
        e
      ),
      ...o,
      children: [
        r && /* @__PURE__ */ jsx(r, { className: "h-4 w-4 flex-shrink-0" }),
        typeof n == "string" ? /* @__PURE__ */ jsx(
          qr,
          {
            text: n.length > 10 ? `${n.slice(0, 10)}...` : n,
            className: "flex-1 min-w-0 overflow-hidden",
            as: "span"
          }
        ) : n
      ]
    }
  )
);
jT.displayName = "TabsTrigger";
const KT = c.forwardRef(({ className: e, ...n }, r) => /* @__PURE__ */ jsx(
  xm,
  {
    ref: r,
    className: X(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      e
    ),
    ...n
  }
));
KT.displayName = "TabsContent";
const GT = c.forwardRef(
  ({ className: e, ...n }, r) => /* @__PURE__ */ jsx(
    "textarea",
    {
      className: X(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-ui py-ui text-ui text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        e
      ),
      ref: r,
      ...n
    }
  )
);
GT.displayName = "Textarea";
c__default.memo(
  ({
    type: e = "text",
    value: n = "",
    onChange: r,
    modalTitle: o,
    className: s,
    disabled: i,
    readOnly: a,
    ...l
  }) => {
    const [f, u] = useState(false), p = () => {
      !i && !a && u(true);
    }, d = () => {
      u(false);
    }, g = (m) => {
      r == null ? void 0 : r(m), u(false);
    };
    return e === "text" ? /* @__PURE__ */ jsx(
      Ps,
      {
        type: "text",
        value: n,
        onChange: (m) => r == null ? void 0 : r(m.target.value),
        className: s,
        disabled: i,
        readOnly: a,
        ...l
      }
    ) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        Ps,
        {
          type: "text",
          value: n,
          readOnly: true,
          onClick: p,
          className: `${s} cursor-pointer`,
          disabled: i,
          ...l
        }
      ),
      e === "numeric" && /* @__PURE__ */ jsx(
        fs,
        {
          open: f,
          onClose: d,
          onSubmit: g,
          initialValue: n,
          title: o,
          placeholder: l.placeholder
        }
      ),
      e === "time" && /* @__PURE__ */ jsx(
        fs,
        {
          open: f,
          onClose: d,
          onSubmit: g,
          initialValue: n,
          title: o,
          variant: "time"
        }
      ),
      e === "phone" && /* @__PURE__ */ jsx(
        fs,
        {
          open: f,
          onClose: d,
          onSubmit: g,
          initialValue: n,
          title: o,
          placeholder: l.placeholder,
          variant: "phone"
        }
      )
    ] });
  }
);
c__default.memo(
  ({ options: e, value: n, onChange: r, className: o }) => /* @__PURE__ */ jsx(Bg, { children: /* @__PURE__ */ jsx(
    "div",
    {
      className: X(
        "inline-flex rounded-lg border border-border bg-background p-1",
        o
      ),
      children: e.map((s) => {
        const i = s.icon, a = n === s.value;
        return /* @__PURE__ */ jsxs(zg, { children: [
          /* @__PURE__ */ jsx(
            $g,
            {
              onClick: () => r(s.value),
              className: X(
                "flex items-center justify-center p-2 rounded transition-colors",
                a ? "bg-accent text-white" : "text-muted-foreground hover:bg-card hover:text-foreground"
              ),
              "aria-label": s.tooltip,
              children: /* @__PURE__ */ jsx(i, { className: "text-lg" })
            }
          ),
          /* @__PURE__ */ jsx(wc, { children: /* @__PURE__ */ jsx("p", { children: s.tooltip }) })
        ] }, s.value);
      })
    }
  ) })
);
const Route$4 = createRootRouteWithContext()({
  component: () => {
    const { auth } = Route$4.useRouteContext();
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-background", children: [
      /* @__PURE__ */ jsxs("nav", { className: "flex items-center gap-6 border-b border-border px-6 py-3 bg-card/50 backdrop-blur-md sticky top-0 z-50", children: [
        /* @__PURE__ */ jsxs(Link, { to: "/", className: "flex items-center gap-2 hover:opacity-80 transition-opacity", children: [
          /* @__PURE__ */ jsx("div", { className: "bg-primary p-1.5 rounded-lg", children: /* @__PURE__ */ jsx(Home, { className: "h-5 w-5 text-primary-foreground" }) }),
          /* @__PURE__ */ jsx("span", { className: "font-bold text-xl tracking-tight", children: "Hono Standard" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2", children: /* @__PURE__ */ jsx(Et, { variant: "ghost", asChild: true, size: "sm", children: /* @__PURE__ */ jsxs(Link, { to: "/showcase", className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx(LayoutGrid, { className: "h-4 w-4" }),
          "Showcase"
        ] }) }) }),
        /* @__PURE__ */ jsx("div", { className: "flex-1" }),
        /* @__PURE__ */ jsx("div", { className: "flex items-center gap-4", children: auth.user ? /* @__PURE__ */ jsx(
          DN,
          {
            align: "end",
            trigger: /* @__PURE__ */ jsx("div", { className: "cursor-pointer", children: /* @__PURE__ */ jsx(
              pv,
              {
                src: `https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.user.email}`,
                fallback: auth.user.email[0].toUpperCase(),
                size: "md",
                className: "border border-border hover:border-primary/50 transition-colors"
              }
            ) }),
            items: [
              {
                label: "Profile",
                icon: /* @__PURE__ */ jsx(User, { className: "h-4 w-4" }),
                onClick: () => console.log("Profile clicked")
              },
              {
                label: "Logout",
                icon: /* @__PURE__ */ jsx(LogOut, { className: "h-4 w-4" }),
                onClick: () => auth.logout()
              }
            ]
          }
        ) : /* @__PURE__ */ jsx(Et, { asChild: true, size: "sm", children: /* @__PURE__ */ jsx(Link, { to: "/login", children: "Login" }) }) })
      ] }),
      /* @__PURE__ */ jsx("main", { children: /* @__PURE__ */ jsx(Outlet, {}) })
    ] });
  }
});
const Route$3 = createFileRoute("/showcase")({
  component: ShowcasePage
});
function ShowcasePage() {
  const [progress, setProgress] = useState(33);
  return /* @__PURE__ */ jsxs("div", { className: "container mx-auto py-10 space-y-12 pb-24 px-4", children: [
    /* @__PURE__ */ jsxs("section", { className: "space-y-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col space-y-2", children: [
        /* @__PURE__ */ jsx("h1", { className: "text-4xl font-bold tracking-tight", children: "Component Showcase" }),
        /* @__PURE__ */ jsx("p", { className: "text-muted-foreground text-lg", children: "Demonstrating the components from our new design system built with Tailwind v4." })
      ] }),
      /* @__PURE__ */ jsx(zT, {})
    ] }),
    /* @__PURE__ */ jsxs("section", { className: "space-y-4", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-2xl font-semibold tracking-tight", children: "Buttons & Badges" }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-4 items-center", children: [
        /* @__PURE__ */ jsx(Et, { variant: "default", children: "Default" }),
        /* @__PURE__ */ jsx(Et, { variant: "secondary", children: "Secondary" }),
        /* @__PURE__ */ jsx(Et, { variant: "destructive", children: "Destructive" }),
        /* @__PURE__ */ jsx(Et, { variant: "outline", children: "Outline" }),
        /* @__PURE__ */ jsx(Et, { variant: "ghost", children: "Ghost" }),
        /* @__PURE__ */ jsx(Et, { variant: "link", children: "Link" }),
        /* @__PURE__ */ jsx(Et, { disabled: true, children: "Disabled" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-4 items-center", children: [
        /* @__PURE__ */ jsx(tk, { children: "Default" }),
        /* @__PURE__ */ jsx(tk, { variant: "secondary", children: "Secondary" }),
        /* @__PURE__ */ jsx(tk, { variant: "outline", children: "Outline" }),
        /* @__PURE__ */ jsx(tk, { variant: "destructive", children: "Destructive" }),
        /* @__PURE__ */ jsx(tk, { className: "bg-emerald-500 text-white hover:bg-emerald-600 border-none", children: "Success" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("section", { className: "space-y-4", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-2xl font-semibold tracking-tight", children: "Cards" }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: [
        /* @__PURE__ */ jsxs(sS, { children: [
          /* @__PURE__ */ jsxs(iS, { children: [
            /* @__PURE__ */ jsx(aS, { children: "Project Update" }),
            /* @__PURE__ */ jsx(lS, { children: "Latest milestones achieved this week." })
          ] }),
          /* @__PURE__ */ jsx(cS, { children: /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "We've successfully integrated the new design system and upgraded to Tailwind v4. The build process is now faster and more reliable." }) }),
          /* @__PURE__ */ jsxs(uS, { className: "flex justify-between", children: [
            /* @__PURE__ */ jsx(Et, { variant: "outline", children: "Cancel" }),
            /* @__PURE__ */ jsx(Et, { children: "Deploy" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs(sS, { className: "bg-primary/5 border-primary/20 shadow-lg shadow-primary/5", children: [
          /* @__PURE__ */ jsx(iS, { children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsx(aS, { children: "Statistics" }),
            /* @__PURE__ */ jsx(tk, { variant: "outline", className: "text-xs", children: "Live" })
          ] }) }),
          /* @__PURE__ */ jsxs(cS, { className: "space-y-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm", children: [
                /* @__PURE__ */ jsx("span", { children: "Usage" }),
                /* @__PURE__ */ jsxs("span", { className: "font-mono", children: [
                  progress,
                  "%"
                ] })
              ] }),
              /* @__PURE__ */ jsx(VT, { value: progress })
            ] }),
            /* @__PURE__ */ jsx(
              Et,
              {
                onClick: () => setProgress((prev) => (prev + 10) % 110),
                variant: "secondary",
                className: "w-full",
                children: "Simulate Progress"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs(sS, { children: [
          /* @__PURE__ */ jsxs(iS, { className: "flex-row items-center gap-4 space-y-0", children: [
            /* @__PURE__ */ jsx(pv, { src: "https://github.com/shadcn.png", alt: "Shadcn", fallback: "SC", size: "md" }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx(aS, { className: "text-lg", children: "Author Profile" }),
              /* @__PURE__ */ jsx(lS, { children: "@shadcn • Verified" })
            ] })
          ] }),
          /* @__PURE__ */ jsx(cS, { children: /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Passionate about UI/UX and open source. Contributor to various React-based design systems." }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("section", { className: "space-y-4", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-2xl font-semibold tracking-tight", children: "Form Elements" }),
      /* @__PURE__ */ jsx(sS, { children: /* @__PURE__ */ jsxs(cS, { className: "pt-6 grid grid-cols-1 md:grid-cols-2 gap-8", children: [
        /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsx(CT, { htmlFor: "email", children: "Email Address" }),
            /* @__PURE__ */ jsx(Ps, { id: "email", placeholder: "name@example.com" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsx(CT, { htmlFor: "framework", children: "Framework" }),
            /* @__PURE__ */ jsxs(ST, { defaultValue: "next", children: [
              /* @__PURE__ */ jsx(Hg, { id: "framework", className: "w-full", children: /* @__PURE__ */ jsx(Ck, { placeholder: "Select a framework" }) }),
              /* @__PURE__ */ jsxs(Ug, { children: [
                /* @__PURE__ */ jsx(Wg, { value: "next", children: "Next.js" }),
                /* @__PURE__ */ jsx(Wg, { value: "svelte", children: "SvelteKit" }),
                /* @__PURE__ */ jsx(Wg, { value: "astro", children: "Astro" }),
                /* @__PURE__ */ jsx(Wg, { value: "remix", children: "Remix" })
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-2", children: [
            /* @__PURE__ */ jsx(UT, { id: "airplane-mode" }),
            /* @__PURE__ */ jsx(CT, { htmlFor: "airplane-mode", className: "cursor-pointer", children: "Airplane Mode" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-2", children: [
            /* @__PURE__ */ jsx(UT, { id: "notifications", defaultChecked: true }),
            /* @__PURE__ */ jsx(CT, { htmlFor: "notifications", className: "cursor-pointer", children: "Enable Notifications" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-2", children: [
            /* @__PURE__ */ jsx(UT, { id: "marketing" }),
            /* @__PURE__ */ jsx(CT, { htmlFor: "marketing", className: "cursor-pointer", children: "Marketing Emails" })
          ] })
        ] })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs("section", { className: "space-y-4", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-2xl font-semibold tracking-tight", children: "Navigation & Tabs" }),
      /* @__PURE__ */ jsxs(Lk, { defaultValue: "account", className: "w-full max-w-[600px]", children: [
        /* @__PURE__ */ jsxs(WT, { className: "grid w-full grid-cols-3", children: [
          /* @__PURE__ */ jsx(jT, { value: "account", children: "Account" }),
          /* @__PURE__ */ jsx(jT, { value: "password", children: "Password" }),
          /* @__PURE__ */ jsx(jT, { value: "settings", children: "Settings" })
        ] }),
        /* @__PURE__ */ jsx(KT, { value: "account", children: /* @__PURE__ */ jsxs(sS, { children: [
          /* @__PURE__ */ jsxs(iS, { children: [
            /* @__PURE__ */ jsx(aS, { children: "Account Information" }),
            /* @__PURE__ */ jsx(lS, { children: "Update your profile details here." })
          ] }),
          /* @__PURE__ */ jsxs(cS, { className: "space-y-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsx(CT, { children: "Name" }),
              /* @__PURE__ */ jsx(Ps, { defaultValue: "John Doe" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsx(CT, { children: "Username" }),
              /* @__PURE__ */ jsx(Ps, { defaultValue: "@johndoe" })
            ] })
          ] }),
          /* @__PURE__ */ jsx(uS, { children: /* @__PURE__ */ jsx(Et, { children: "Save changes" }) })
        ] }) }),
        /* @__PURE__ */ jsx(KT, { value: "password", children: /* @__PURE__ */ jsxs(sS, { children: [
          /* @__PURE__ */ jsxs(iS, { children: [
            /* @__PURE__ */ jsx(aS, { children: "Password Security" }),
            /* @__PURE__ */ jsx(lS, { children: "Change your password periodically to stay safe." })
          ] }),
          /* @__PURE__ */ jsxs(cS, { className: "space-y-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsx(CT, { children: "Current Password" }),
              /* @__PURE__ */ jsx(Ps, { type: "password" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsx(CT, { children: "New Password" }),
              /* @__PURE__ */ jsx(Ps, { type: "password" })
            ] })
          ] }),
          /* @__PURE__ */ jsx(uS, { children: /* @__PURE__ */ jsx(Et, { children: "Update Password" }) })
        ] }) }),
        /* @__PURE__ */ jsx(KT, { value: "settings", children: /* @__PURE__ */ jsxs(sS, { children: [
          /* @__PURE__ */ jsxs(iS, { children: [
            /* @__PURE__ */ jsx(aS, { children: "Global Settings" }),
            /* @__PURE__ */ jsx(lS, { children: "Manage your workspace preferences." })
          ] }),
          /* @__PURE__ */ jsxs(cS, { className: "space-y-6", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
              /* @__PURE__ */ jsx(CT, { children: "Dark Mode" }),
              /* @__PURE__ */ jsx(UT, { defaultChecked: true })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
              /* @__PURE__ */ jsx(CT, { children: "Public Profile" }),
              /* @__PURE__ */ jsx(UT, {})
            ] })
          ] })
        ] }) })
      ] })
    ] })
  ] });
}
const Route$2 = createFileRoute("/login")({
  component: Login
});
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [authMethods, setAuthMethods] = useState({
    local: true,
    oauth: {
      enabled: false,
      providers: {
        google: false,
        github: false
      }
    }
  });
  const { login, user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (user) {
      navigate({ to: "/" });
    }
  }, [user, navigate]);
  useEffect(() => {
    let active = true;
    const loadAuthMethods = async () => {
      try {
        const res = await client.auth.methods.$get({});
        if (!res.ok || !active) return;
        const data = await res.json();
        setAuthMethods(data);
      } catch {
      }
    };
    loadAuthMethods();
    return () => {
      active = false;
    };
  }, []);
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await client.auth.login.$post({ json: { email, password } });
      if (!res.ok) {
        throw new Error("Login failed");
      }
      const data = await res.json();
      login(data.user);
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-md", children: [
    /* @__PURE__ */ jsx("h1", { children: "Login" }),
    error && /* @__PURE__ */ jsx("p", { className: "text-red-500", children: error }),
    authMethods.local ? /* @__PURE__ */ jsxs("form", { onSubmit: handleLogin, className: "flex flex-col gap-4", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "email",
          placeholder: "Email",
          value: email,
          onChange: (e) => setEmail(e.target.value),
          required: true,
          className: "rounded border border-border bg-background px-2 py-2"
        }
      ),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "password",
          placeholder: "Password",
          value: password,
          onChange: (e) => setPassword(e.target.value),
          required: true,
          className: "rounded border border-border bg-background px-2 py-2"
        }
      ),
      /* @__PURE__ */ jsx("button", { type: "submit", className: "rounded border border-border px-3 py-2", children: "Login" })
    ] }) : null,
    authMethods.local && authMethods.oauth.enabled ? /* @__PURE__ */ jsx("hr", { className: "my-8 border-border" }) : null,
    authMethods.oauth.enabled ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4", children: [
      authMethods.oauth.providers.google ? /* @__PURE__ */ jsx("a", { href: "/api/auth/oauth/google", children: /* @__PURE__ */ jsx("button", { type: "button", className: "w-full rounded border border-border px-3 py-2", children: "Login with Google" }) }) : null,
      authMethods.oauth.providers.github ? /* @__PURE__ */ jsx("a", { href: "/api/auth/oauth/github", children: /* @__PURE__ */ jsx("button", { type: "button", className: "w-full rounded border border-border px-3 py-2", children: "Login with GitHub" }) }) : null
    ] }) : null
  ] });
}
const Route$1 = createFileRoute("/")({
  component: Index
});
function Index() {
  return /* @__PURE__ */ jsxs("div", { className: "p-8", children: [
    /* @__PURE__ */ jsx("h1", { children: "Welcome to Hono Standard" }),
    /* @__PURE__ */ jsx("p", { className: "mb-4", children: "A simple Monolithic API + Frontend template." }),
    /* @__PURE__ */ jsx(Et, { children: "Design System Button" })
  ] });
}
const Route = createFileRoute("/oauth/callback")({
  component: OAuthCallback
});
function OAuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  useEffect(() => {
    async function finalizeOAuthLogin() {
      try {
        const res = await client.auth.me.$get({});
        if (!res.ok) {
          navigate({ to: "/login" });
          return;
        }
        const data = await res.json();
        login({ id: data.userId, email: data.email });
        navigate({ to: "/" });
      } catch (err) {
        console.error("Error during OAuth callback:", err);
        navigate({ to: "/login" });
      }
    }
    finalizeOAuthLogin();
  }, [login, navigate]);
  return /* @__PURE__ */ jsx("div", { children: "Logging in via OAuth..." });
}
const ShowcaseRoute = Route$3.update({
  id: "/showcase",
  path: "/showcase",
  getParentRoute: () => Route$4
});
const LoginRoute = Route$2.update({
  id: "/login",
  path: "/login",
  getParentRoute: () => Route$4
});
const IndexRoute = Route$1.update({
  id: "/",
  path: "/",
  getParentRoute: () => Route$4
});
const OauthCallbackRoute = Route.update({
  id: "/oauth/callback",
  path: "/oauth/callback",
  getParentRoute: () => Route$4
});
const rootRouteChildren = {
  IndexRoute,
  LoginRoute,
  ShowcaseRoute,
  OauthCallbackRoute
};
const routeTree = Route$4._addFileChildren(rootRouteChildren)._addFileTypes();
function createAppRouter(history) {
  const queryClient = new QueryClient();
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    history,
    context: {
      queryClient,
      auth: void 0
      // set by provider
    }
  });
}
const defaultRouter = typeof window !== "undefined" ? createAppRouter() : null;
function InnerApp({ router }) {
  const auth = useAuth();
  return /* @__PURE__ */ jsx(RouterProvider, { router, context: { auth } });
}
function App({ router } = {}) {
  const activeRouter = router || defaultRouter;
  if (!activeRouter) {
    throw new Error("Router instance must be provided on the server");
  }
  const queryClient = activeRouter.options.context.queryClient;
  return /* @__PURE__ */ jsx(QueryClientProvider, { client: queryClient, children: /* @__PURE__ */ jsx(AuthProvider, { children: /* @__PURE__ */ jsx(InnerApp, { router: activeRouter }) }) });
}
async function render(url) {
  const memoryHistory = createMemoryHistory({
    initialEntries: [url]
  });
  const router = createAppRouter(memoryHistory);
  await router.load();
  const html = ReactDOMServer.renderToString(/* @__PURE__ */ jsx(App, { router }));
  return { html };
}
export {
  render
};
