import "../resources/icons/icon-16.png";
import "../resources/icons/icon-128.png";

import { EXTENSION_SOURCE, notifyCurrentTab } from "../helpers";

declare var chrome;

chrome.devtools.panels.create(
  "ProseMirror",
  "icon-128.png",
  "panels.html",
  panel => {
    panel.onShown.addListener(() =>
      notifyCurrentTab(chrome, {
        source: EXTENSION_SOURCE,
        type: "extension-showing",
        payload: true
      })
    );
    panel.onHidden.addListener(() =>
      notifyCurrentTab(chrome, {
        source: EXTENSION_SOURCE,
        type: "extension-showing",
        payload: false
      })
    );
  }
);
