import { filter, fromEvent, map, pipe } from "callbag-basics";

// seems to be a transpilation issue from Webpack... dirty fix!
const fixedFromEvent = fromEvent.default;

// constants
export const EXTENSION_SOURCE = "prosemirror-devtools-bridge";

// chrome helpers

// When extension is upgraded or disabled and renabled, the content scripts
// will still be injected, so we have to reconnect them.
// We listen for an onDisconnect event, and then wait for a second before
// trying to connect again. Becuase chrome.runtime.connect fires an onDisconnect
// event if it does not connect, an unsuccessful connection should trigger
// another attempt, 1 second later.
export function reconnectOnUpgrade(chrome) {
  try {
    let port = chrome.runtime.connect({ name: "reconnect-port" });

    port.onDisconnect.addListener(() => {
      port = null;
      // Attempt to reconnect after 1 second
      setTimeout(() => reconnectOnUpgrade(chrome), 1e3); // 1s
    });
  } catch (e) {
    console.warn("could not auto reconnect extension", e);
  }
}

export function injectIntoTab(chrome, tab) {
  try {
    const contentScripts = chrome.app.getDetails().content_scripts[0].js;
    contentScripts.forEach(script =>
      chrome.tabs.executeScript(tab.id, { file: script })
    );
  } catch (e) {
    console.warn("could not inject into tabs", e);
  }
}

export function notifyCurrentTab(chrome, message) {
  try {
    chrome.tabs.query({ active: true }, tabs =>
      chrome.tabs.sendMessage(tabs[0].id, message)
    );
  } catch (e) {
    console.warn("could not notify tabs", e);
  }
}

export function notifyTabs(chrome, message) {
  try {
    chrome.tabs.query({}, tabs =>
      tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, message))
    );
  } catch (e) {
    console.warn("could not notify tabs", e);
  }
}

// more generic helpers
export const randomId = () =>
  Math.random()
    .toString(16)
    .slice(2);

export const cloneObj = obj => JSON.parse(JSON.stringify(obj));

export function cloneObjExclKeys(obj, keys = [], maxDepth = 10, ...rest) {
  const depth = rest.shift() || 0;

  if (typeof obj !== "object" || !obj) {
    return obj;
  }

  return Object.keys(obj).reduce((acc, key) => {
    if (keys.indexOf(obj[key]) !== -1 || depth >= maxDepth) {
      return acc;
    }

    return Object.assign({}, acc, {
      [key]:
        typeof obj[key] === "object" && depth < maxDepth
          ? cloneObjExclKeys(obj[key], keys, maxDepth, depth + 1)
          : obj[key]
    });
  }, {});
}

// callbags sources
export function fromWindowMessages(window) {
  return pipe(
    fixedFromEvent(window, "message"),
    filter(event => event.origin === window.origin),
    map(event => event.data)
  );
}

export function fromChromeRuntimeMessages(chrome) {
  return (start, sink) => {
    if (start !== 0) return;

    const listener = message => sink(1, message);
    const talkback = type => {
      if (type === 2) {
        chrome.runtime.onMessage.removeListener(listener);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    sink(0, talkback);
  };
}

// callbags operators
export function tap(tapFunction) {
  return source => (start, sink) => {
    if (start !== 0) return;
    source(0, (type, data) => {
      if (type === 1 && typeof tapFunction === "function" && !!data) {
        tapFunction(data);
      }
      sink(type, data);
    });
  };
}

export function mute() {
  return source => start => {
    if (start !== 0) return;
    source(0, () => null);
  };
}

export const onlyFromExtension = () =>
  filter(
    message =>
      typeof message === "object" && message.source === EXTENSION_SOURCE
  );

export const onlyOfType = (types = []) =>
  filter(
    message => typeof message === "object" && types.indexOf(message.type) !== -1
  );

// inspired by https://github.com/ds82/callbag-replay-all
//
// But we're replaying only certain messages (based on their type), and there's a "pick"
// parameter to choose whether to replay all of them, or only the last emitted one.
//
// Concretely in our extension we would use this operator with:
//   replaySomeMessages([{type: "init", pick: "all"}, {type: "updateState", pick: "latest"}])
//
// Easy, no?
export function replaySomeMessages(which = []) {
  const types = which.map(config => config.type);
  const picks = which.reduce(
    (acc, config) => Object.assign(acc, { [config.type]: config.pick }),
    {}
  );

  let store = [];
  let sinks = [];

  return source => {
    let talkback;
    let done = false;

    source(0, (type, data) => {
      if (type === 0) {
        talkback = data;
        return;
      }

      if (type === 1) {
        if (typeof data === "object" && types.indexOf(data.type) !== -1) {
          const pick = picks[data.type];

          if (pick === "all") {
            store = [...store, data];
          } else if (pick === "latest") {
            store = [...store.filter(entry => entry.type !== data.type), data];
          }
        }

        sinks.forEach(sink => sink(1, data));
      }

      if (type === 2) {
        done = true;
        sinks.forEach(sink => sink(2));
        sinks = [];
      }
    });

    return (start, sink) => {
      if (start !== 0) return;
      sinks.push(sink);

      sink(0, type => {
        if (type === 0) return;

        if (type === 1) {
          talkback(1);
          return;
        }

        if (type === 2) {
          sinks = sinks.filter(s => s !== sink);
        }
      });

      store.forEach(entry => sink(1, entry));

      if (done) {
        sink(2);
      }
    };
  };
}

// callbags sinks
export function repostWindowMessage(window) {
  let talkback;

  return source =>
    source(0, (type, data) => {
      if (type === 0) {
        talkback = data;
      }

      if (type === 1) {
        window.postMessage(data, "*");
      }

      if (type === 0 || type === 1) {
        talkback(1);
      }
    });
}

export function repostChromeMessage(chrome) {
  const chromeExtensionId = chrome.runtime.id;
  let talkback;

  return source =>
    source(0, (type, data) => {
      if (type === 0) {
        talkback = data;
      }

      if (type === 1 && typeof data === "object") {
        chrome.runtime.sendMessage(chromeExtensionId, data, {}, response => {
          if (!response && !!chrome.runtime.lastError) {
            console.warn(chrome.runtime.lastError.message);
          }
        });
      }

      if (type === 0 || type === 1) {
        talkback(1);
      }
    });
}
