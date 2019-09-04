import { filter, pipe } from "callbag-basics";

import {
  fromChromeRuntimeMessages,
  fromWindowMessages,
  onlyFromExtension,
  onlyOfType,
  reconnectOnUpgrade,
  replaySomeMessages,
  repostChromeMessage,
  repostWindowMessage,
  tap
} from "./helpers";

declare var chrome;

// inject content script
const script = document.createElement("script");
script.setAttribute("type", "text/javascript");
script.setAttribute(
  "src",
  chrome.extension.getURL("proseMirrorDevToolsHook.js")
);
document.documentElement.appendChild(script);

let extensionShowing = false;

// propagate init/update messages from hook to extensioon
repostChromeMessage(chrome)(
  pipe(
    fromWindowMessages(window),
    onlyFromExtension(),
    onlyOfType(["init", "updateState"]),
    filter(() => extensionShowing),
    replaySomeMessages([
      { type: "init", pick: "all" },
      { type: "updateState", pick: "latest" }
    ])
  )
);

// propagate extension-showing messages from extension to hook
repostWindowMessage(window)(
  pipe(
    fromChromeRuntimeMessages(chrome),
    onlyOfType(["extension-showing"]),
    tap(message => {
      const { payload: showing } = message;
      console.log(`Extension ${showing ? "showing" : "hiding"}...`);
      extensionShowing = showing;
    })
  )
);

// reconnect content script on extension upgrade
reconnectOnUpgrade(chrome);
