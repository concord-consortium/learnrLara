import iframePhone from "iframe-phone"
import md5 from "md5";
import ResizeObserver from "resize-observer-polyfill";

import pkg from "./package.json"

// loaded here so that we can update the tutorial css and js remotely so that we don't have to republish the activities
// NOTE: the order of the files is important - don't change it
import "./tutorial/tutorial.css";
import "./tutorial/tutorial-format.css";
import "./tutorial/rstudio-theme.css";
import "./tutorial/tutorial.js";
import "./tutorial/tutorial-autocompletion.js";
import "./tutorial/tutorial-diagnostics";
import "./tutorial/tutorial-format.js";

declare const ace: any;

interface SubmitTutorialEvent {
  type: "submit";
  label: string;
  editor: any;
}
interface CheckTutorialEvent {
  type: "check";
  label: string;
  editor: any;
}
interface RunTutorialEvent {
  type: "run";
  label: string;
  editor: any;
}
interface HelpTutorialEvent {
  type: "help";
  label: string;
}
interface StartOverTutorialEvent {
  type: "start-over";
  label: string;
}
interface HintTutorialEvent {
  type: "hint";
  label: string;
  index: number;
  show: boolean;
}
interface SolutionTutorialEvent {
  type: "solution";
  label: string;
  show: boolean;
}
interface CopyTutorialEvent {
  type: "copy";
  label: string;
  text: string;
}
interface PasteTutorialEvent {
  type: "paste";
  label: string;
  text: string;
}
interface OutputTutorialEvent {
  type: "output";
  label: string;
  html: string;
}
interface AlertTutorialEvent {
  type: "alert";
  label: string;
  text: string;
}
type TutorialEvent = SubmitTutorialEvent | CheckTutorialEvent | RunTutorialEvent | HelpTutorialEvent |
                     StartOverTutorialEvent | HintTutorialEvent | SolutionTutorialEvent | CopyTutorialEvent |
                     PasteTutorialEvent | OutputTutorialEvent | AlertTutorialEvent;

interface Tutorial {
  $forEachExercise: (callback: (el: any) => void) => void;
  $exerciseEditor: (label: string) => any;
  $addEventListener: (listener: (tutorial: Tutorial, event: TutorialEvent) => void) => void;
  $haveSubmitted: (label: string, haveSubmitted: boolean) => void;
  $disableSolutionIfNotSubmitted: (disableSolutionIfNotSubmitted: boolean) => void;
  $showExerciseProgress: (label: string, button: string, show: boolean) => void;
  $runCode: () => void;
  serverInitialized: boolean;
  serverInitializedCallback: () => void;
  laraMode: LaraMode;
}

interface ExcerciseMap {
  [key: string]: ExcerciseAnswer;
}
interface ExcerciseAnswer {
  current: string;
  submitted: string;
}

interface SubmittedMap {
  [key: string]: string;
}

interface TutorialState {
  version: 1,
  exercises: ExcerciseMap,
  lara_options: {
    reporting_url: string
  }
}

type LaraMode = "authoring" | "runtime" | "report";

interface InitInteractiveData {
  mode: LaraMode,
  interactiveState: string | null;
}

interface AceEditor {
  getSession: () => {
    getValue: () => string;
  },
  setValue: (value: string, cursorPos: number) => void;
  tutorial: {
    initial_lara_value: string;
  }
}

type TutorialMode = "explore" | "exercise" | "assessment";
interface InitOptions {
  mode: TutorialMode;
  tutorial: Tutorial;
}

let exploreMode = false;
let phone: any = null;

const submittedValues: SubmittedMap = {};

export const init = (options: InitOptions) => {
  const {mode, tutorial} = options;

  console.info(`Initializing lara-plugin version ${pkg.version} in "${options.mode}" mode.`);

  exploreMode = mode === "explore";
  phone = iframePhone.getIFrameEndpoint();

  if (!exploreMode) {
    // show custom alerts
    tutorial.$disableSolutionIfNotSubmitted(true);

    // set the initial submission state, it will be reset in setState()
    forEachExercise(tutorial, (label, editor) => {
      tutorial.$haveSubmitted(label, false);
    });

    var reportMode = false;
    phone.addListener("initInteractive", (data: InitInteractiveData) => {
      if (data.interactiveState) {
        try {
          tutorial.laraMode = data.mode;
          reportMode = data.mode === "report";

          const isString = typeof data.interactiveState === "string";
          const state: TutorialState = isString ? JSON.parse(data.interactiveState) : data.interactiveState as any;
          if ((state.version === 1) && state.exercises) {
            setState(tutorial, state);
          }
          if (reportMode) {
            if (tutorial.serverInitialized) {
              tutorial.$runCode();
            }
            else {
              tutorial.serverInitializedCallback = function () {
                tutorial.$runCode();
              };
            }
          }
        }
        catch (e) {
          alert("Unable to parse initial interactive state!");
          console.error(e); // TODO: print stack trace
        }
      }
    });
    phone.addListener("getInteractiveState", () => {
      if (!reportMode) {
        phone.post("interactiveState", getState(tutorial));
      }
    });

    tutorial.$addEventListener(tutorialEventListener);
  }

  phone.initialize();
  // wait until editors have drawn to set aspect ratio
  setTimeout(function () {
    setHeight();
  }, 1);

  listenForSizeChanges();
}

const forEachExercise = (tutorial: Tutorial, callback: (label: string, editor: AceEditor | null) => void) => {
  tutorial.$forEachExercise(($el) => {
    const label = $el.attr("data-label");
    const editorContainer = tutorial.$exerciseEditor(label);
    const editor = editorContainer.length > 0 ? ace.edit(editorContainer.attr("id")) : null;
    callback(label, editor);
  });
}

const getState = (tutorial: Tutorial) => {
  const state: TutorialState = {
    version: 1,
    exercises: {},
    lara_options: {
      reporting_url: window.location.href
    }
  };
  forEachExercise(tutorial, (label, editor) => {
    state.exercises[label] = {
      current: editor ? editor.getSession().getValue() : "",
      submitted: submittedValues[label] || ""
    };
  });
  return state;
};

const setState = (tutorial: Tutorial, state: TutorialState) => {
  forEachExercise(tutorial, (label, editor) => {
    if (state.exercises[label]) {
      if (state.exercises[label].current && editor) {
        var current = state.exercises[label].current;
        editor.setValue(current, -1);
        editor.tutorial.initial_lara_value = current;
      }
      if (state.exercises[label].submitted) {
        submittedValues[label] = state.exercises[label].submitted;
      }
    }
    tutorial.$haveSubmitted(label, state.exercises[label] && !!state.exercises[label].submitted);
  });
};

const setHeight = () => {
  const { height } = document.body.getBoundingClientRect();
  phone.post("height", height);
};

const listenForSizeChanges = () => {
  const ro = new ResizeObserver((entries, observer) => {
    setHeight();
  });
  ro.observe(document.body);
};

const tutorialEventListener = (tutorial: Tutorial, event: TutorialEvent) => {

  // add per event plugin logic
  switch (event.type) {
    case "submit":
      const submitted = event.editor.getSession().getValue();
      submittedValues[event.label] = submitted;
      tutorial.$haveSubmitted(event.label, true);
      phone.post("interactiveState", getState(tutorial));
      tutorial.$showExerciseProgress(event.label, "submit", false);
      break;
  }

  // log events
  if (!exploreMode) {
    let log = true;
    let eventName = event.type as string;
    const logData: any = {
      label: event.label
    };
    switch (event.type) {
      case "submit":
      case "check":
      case "run":
        logData.code = event.editor.getSession().getValue();
        logData.hash = md5(logData.code);
        break;

      case "hint":
        logData.index = event.index;
        logData.show = event.show;
        break;

      case "solution":
        logData.show = event.show;
        break;

      case "copy":
      case "paste":
        logData.text = event.text;
        break;

      case "alert":
        logData.text = event.text;
        break;

      case "output":
        // we only log errors for now, not all output
        const el = document.createElement("div");
        el.innerHTML = event.html;
        const output = el.firstChild as any;
        if (output && output.className && (output.className.indexOf("alert") !== -1)) {
          eventName = "error";
          logData.message = output.innerHTML;
        }
        else {
          log = false;
        }
        break;
    }
    if (log) {
      phone.post("log", {action: eventName, data: logData});
      console.log("Logged", eventName, "event", logData);
    }
  }
}
