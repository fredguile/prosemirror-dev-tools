import { forEach, map, pipe } from "callbag-basics";

import {
  cloneObjExclKeys,
  cloneObj,
  EXTENSION_SOURCE,
  fromWindowMessages,
  onlyFromExtension,
  onlyOfType,
  randomId
} from "./helpers";

const editorViews = {};

function clonePlugins(editorView) {
  const { state } = editorView;
  return state.plugins.map(plugin => ({
    key: plugin.key,
    state: cloneObjExclKeys(plugin.getState(state), [editorView])
  }));
}

const hook = {
  extensionShowing: false,

  inject(editorView) {
    const editorId = randomId();

    editorViews[editorId] = editorView;

    const {
      composing,
      composingTimeout,
      compositionEndedAt,
      cursorWrapper,
      domChangeCount,
      dragging,
      editable,
      focused,
      lastClick,
      lastKeyCode,
      lastKeyCodeTime,
      lastSelectedViewDesc,
      lastSelectionOrigin,
      lastSelectionTime,
      mounted,
      mouseDown,
      shiftKey
    } = editorView;

    const viewAttrs = {
      composing,
      composingTimeout,
      compositionEndedAt,
      cursorWrapper,
      domChangeCount,
      dragging,
      editable,
      focused,
      lastClick,
      lastKeyCode,
      lastKeyCodeTime,
      lastSelectedViewDesc,
      lastSelectionOrigin,
      lastSelectionTime,
      mounted,
      mouseDown,
      shiftKey
    };

    console.log("init()...");

    window.postMessage(
      {
        source: EXTENSION_SOURCE,
        type: "init",
        payload: {
          schemaSpec: cloneObj(editorView.state.schema.spec),
          state: editorView.state.toJSON(),
          pluginsAsJSON: JSON.stringify(clonePlugins(editorView)),
          viewAttrs
        }
      },
      "*"
    );

    return {
      updateState(state) {
        console.log("updateState()...");
        window.postMessage(
          {
            source: EXTENSION_SOURCE,
            type: "updateState",
            payload: {
              state: state.toJSON()
              // plugins: clonePlugins(editorView)
            }
          },
          "*"
        );
      },
      disconnect() {
        editorViews[editorId] = undefined;
      }
    };
  }

  // on(event: string, fn) {
  //   if (!listeners[event]) {
  //     listeners[event] = [];
  //   }
  //   listeners[event].push(fn);
  //   return () => hook.off(event, fn);
  // },

  // off(event: string, fn) {
  //   if (!listeners[event]) {
  //     return;
  //   }

  //   const ix = listeners[event].indexOf(fn);
  //   if (ix !== -1) {
  //     listeners[event].splice(ix, 1);
  //   }
  //   if (!listeners[event].length) {
  //     listeners[event] = null;
  //   }
  // },

  // emit(event: string, data: any) {
  //   if (listeners[event]) {
  //     listeners[event].map(fn => fn(data));
  //   }
  // }
};

if (!(typeof window.__FABRIC_EDITOR_DEVTOOLS_GLOBAL_HOOK__ === "object")) {
  Object.defineProperty(window, "__FABRIC_EDITOR_DEVTOOLS_GLOBAL_HOOK__", {
    value: hook,
    writable: false
  });
}

// dynamically update extensionShowing flag
forEach(
  showing =>
    (global.__FABRIC_EDITOR_DEVTOOLS_GLOBAL_HOOK__.extensionShowing = showing)
)(
  pipe(
    fromWindowMessages(window),
    onlyFromExtension(),
    onlyOfType("extension-showing"),
    map(message => message.payload)
  )
);
