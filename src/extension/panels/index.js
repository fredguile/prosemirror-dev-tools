import * as React from "react";
import * as ReactDom from "react-dom";
import { Schema } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { Provider } from "unstated";
import { forEach, pipe } from "callbag-basics";
import * as OrderedMap from "orderedmap";

import {
  fromChromeRuntimeMessages,
  onlyFromExtension,
  onlyOfType
} from "../helpers";

import DevTools from "../../dev-tools-extension";
import EditorStateContainer from "../../state/editor";
import GlobalStateContainer from "../../state/global";

declare var chrome;

const globalState = new GlobalStateContainer({ opened: true, defaultSize: 1 });
let editorState;
let schema = null;

globalState.toggleDevTools();

const initHandler = message => {
  const { schemaSpec, state, pluginsAsJSON, viewAttrs } = message.payload;

  let nodesMap = OrderedMap.from({});
  let marksMap = OrderedMap.from({});

  while (schemaSpec.marks.content.length) {
    const key = schemaSpec.marks.content.shift();
    const value = schemaSpec.marks.content.shift();
    marksMap = marksMap.addToEnd(key, value);
  }

  while (schemaSpec.nodes.content.length) {
    const key = schemaSpec.nodes.content.shift();
    const value = schemaSpec.nodes.content.shift();
    // HACK don't touch this.
    if (key === "layoutSection") {
      delete value.content;
    }
    nodesMap = nodesMap.addToEnd(key, value);
  }

  schema = new Schema({
    nodes: nodesMap,
    marks: marksMap
  });

  const editorState = EditorState.fromJSON(
    { schema, plugins: JSON.parse(pluginsAsJSON) },
    state
  );

  for (let i = 0; i < editorState.plugins.length; ++i) {
    editorState.plugins[i].getState = () => editorState.plugins[i].state;
  }

  const editorView = {
    state: editorState,
    _props: {
      dispatchTransaction: () => {}
    }
  };

  Object.assign(editorView, viewAttrs);

  return editorView;
};

const updateHandler = message => {
  const { state, pluginsAsJSON } = message.payload;
  return EditorState.fromJSON({ schema, plugins: parse(pluginsAsJSON) }, state);
};

forEach(message => {
  const { type, payload } = message;

  switch (type) {
    case "init": {
      try {
        const editorView = initHandler(message);
        editorState = new EditorStateContainer(editorView, { EditorState });
        ReactDom.render(
          <Provider inject={[globalState, editorState]}>
            <DevTools />
          </Provider>,
          document.getElementById("root")
        );
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
