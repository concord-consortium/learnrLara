import iframePhone from "iframe-phone"

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
type TutorialEvent = SubmitTutorialEvent;

interface Tutorial {
  $forEachExercise: (callback: (el: any) => void) => void;
  $exerciseEditor: (label: string) => any;
  $addEventListener: (listener: (tutorial: Tutorial, event: TutorialEvent) => void) => void;
  $haveSubmitted: (label: string, haveSubmitted: boolean) => void;
  $showAlerts: (show: boolean) => void;
  $showExerciseProgress: (label: string, button: string, show: boolean);
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
  exercises: ExcerciseMap
}

interface InitInteractiveData {
  interactiveState: string | null;
}

interface AceEditor {
  getSession: () => {
    getValue: () => string;
  },
  setValue: (value: string, cursorPos: number) => void;
}

type TutorialMode = "explore" | "exercise" | "assessment";
interface InitOptions {
  mode: TutorialMode;
  tutorial: Tutorial;
}

const submittedValues: SubmittedMap = {};
let postGetStateFunctions: Array<() => void> = [];

export const init = (options: InitOptions) => {
  const {mode, tutorial} = options;
  const exploreMode = mode === "explore";

  const phone = iframePhone.getIFrameEndpoint();

  if (!exploreMode) {
    // show custom alerts
    tutorial.$showAlerts(true);

    // set the initial submission state, it will be reset in setState()
    forEachExercise(tutorial, (label, editor) => {
      tutorial.$haveSubmitted(label, false);
    });

    phone.addListener("initInteractive", (data: InitInteractiveData) => {
      if (data.interactiveState) {
        try {
          const state: TutorialState = JSON.parse(data.interactiveState);
          if ((state.version === 1) && state.exercises) {
            setState(tutorial, state);
          }
        }
        catch (e) {}
      }
    });
    phone.addListener("getInteractiveState", () => {
      phone.post("interactiveState", JSON.stringify(getState(tutorial)));
    });

    tutorial.$addEventListener(tutorialEventListener);
  }

  phone.initialize();
  phone.post("supportedFeatures", {
    apiVersion: 1,
    features: {
      interactiveState: !exploreMode,
      // aspectRatio: TODO
    }
  });
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
    exercises: {}
  };
  forEachExercise(tutorial, (label, editor) => {
    state.exercises[label] = {
      current: editor ? editor.getSession().getValue() : "",
      submitted: submittedValues[label] || ""
    };
  });
  postGetStateFunctions.forEach((fn) => fn());
  postGetStateFunctions = [];
  return state;
};

const setState = (tutorial: Tutorial, state: TutorialState) => {
  forEachExercise(tutorial, (label, editor) => {
    if (state.exercises[label]) {
      if (state.exercises[label].current && editor) {
        editor.setValue(state.exercises[label].current, -1);
      }
      if (state.exercises[label].submitted) {
        submittedValues[label] = state.exercises[label].submitted;
      }
    }
    tutorial.$haveSubmitted(label, state.exercises[label] && !!state.exercises[label].submitted);
  });
};

const tutorialEventListener = (tutorial: Tutorial, event: TutorialEvent) => {
  switch (event.type) {
    case "submit":
      const submitted = event.editor.getSession().getValue();
      submittedValues[event.label] = submitted;
      tutorial.$haveSubmitted(event.label, true);
      postGetStateFunctions.push(() => {
        alert("Your answer has been submitted.");
        tutorial.$showExerciseProgress(event.label, "submit", false);
      })
      break;
  }
}
