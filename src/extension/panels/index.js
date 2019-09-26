/* eslint-disable no-undef */
import * as React from "react";
import * as ReactDom from "react-dom";
import { EditorState } from "prosemirror-state";
import { Provider } from "unstated";
import { forEach, pipe } from "callbag-basics";

import {
  fromChromeRuntimeMessages,
  onlyFromExtension,
  onlyOfType,
  rebuildEditorView
} from "../helpers";

import DevTools from "../../dev-tools-extension";
import EditorStateContainer from "../../state/editor";
import GlobalStateContainer from "../../state/global";

const globalState = new GlobalStateContainer({ opened: true, defaultSize: 1 });
const editorState = new EditorStateContainer({ EditorState });
let schema = null;

globalState.toggleDevTools();

ReactDom.render(
  <Provider inject={[globalState, editorState]}>
    <DevTools />
  </Provider>,
  document.getElementById("root")
);

forEach(message => {
  const { type, payload } = message;

  console.log(`Received message: ${message.type}...`);

  switch (type) {
    case "init": {
      try {
        const { schemaSpec, state, pluginsAsJSON, viewAttrs } = payload;
        const editorView = rebuildEditorView(
          schemaSpec,
          state,
          pluginsAsJSON,
          viewAttrs
        );
        editorState.init(editorView);
      } catch (e) {
        console.error("Could not initialize devtools from Editor!", e);
      }
      break;
    }

    case "update": {
      const { state } = payload;
      const newState = EditorState.fromJSON({ schema }, state); // TODO: plugins
      editorState.pushNewState(newState);
      break;
    }
  }
})(
  pipe(
    fromChromeRuntimeMessages(chrome),
    onlyFromExtension(),
    onlyOfType(["init", "updateState"])
  )
);
