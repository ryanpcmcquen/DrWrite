document.addEventListener("DOMContentLoaded", (event) => {
    "use strict";

    let editor;
    let workingNote;
    let ignoreTextChange = false;
    let initialLoad = true;

    const save = () => {};

    const loadFromDropbox = document.querySelector(".load-from-dropbox");

    loadFromDropbox.addEventListener("click", async () => {
        const folderList = await fetch(
            "https://api.dropboxapi.com/2/files/list_folder",
            {
                headers: {
                    Authorization: "",
                    "Content-Type": "application/json",
                },
                body: '{"path":"/Apps/DrWrite"}',
                method: "POST",
                mode: "cors",
            }
        );

        console.log(folderList);
    });

    const loadEditor = () => {
        editor = CodeMirror.fromTextArea(document.querySelector(".drwrite"), {
            autofocus: true,
            foldGutter: {
                minFoldSize: 1,
            },
            foldOptions: {
                widget: " ...",
            },
            gutters: ["CodeMirror-foldgutter"],
            indentUnit: 4,
            lineNumbers: false,
            lineWrapping: true,
            // TODO:
            // Detect file from extension.
            mode: "orgmode",
        });
        editor.setSize("100%", "100%");

        let wait;
        let changing = false;
        editor.on("change", (cm, change) => {
            if (ignoreTextChange) {
                return;
            }
            clearTimeout(wait);
            wait = setTimeout(() => {
                changing = true;
                cm.wrapParagraphsInRange(
                    change.from,
                    CodeMirror.changeEnd(change)
                );
                changing = false;
            }, 200);
            save();
        });
    };

    loadEditor();

    // Change themes:
    const themeFilters = {
        light: "",
        dark: "invert(1) hue-rotate(180deg)",
    };
    const themeChooser = document.querySelector(".theme-chooser");
    themeChooser.addEventListener("click", (event) => {
        if (/INPUT/.test(event.target.tagName)) {
            editor.getWrapperElement().style.filter =
                themeFilters[event.target.value];

            window.localStorage.setItem(
                "DrWritePreferences",
                JSON.stringify({
                    themeFilter: event.target.value,
                })
            );
        }
    });

    // Load saved theme filters from local storage:
    const result = window.localStorage.getItem("DrWritePreferences");
    if (result) {
        const DrWritePreferences = JSON.parse(result);
        const defaultTheme = DrWritePreferences
            ? DrWritePreferences.themeFilter
            : "light";
        document.querySelector(`[value=${defaultTheme}]`).click();
    }
});
