document.addEventListener("DOMContentLoaded", async (event) => {
    "use strict";

    // Load preferences from local storage:
    const result = window.localStorage.getItem("DrWritePreferences");
    if (result) {
        const DrWritePreferences = JSON.parse(result);
        const defaultTheme = DrWritePreferences
            ? DrWritePreferences.themeFilter
            : "light";
        const currentTheme = document.querySelector(`[value=${defaultTheme}]`);
        if (currentTheme) {
            currentTheme.click();
        }

        if (DrWritePreferences.windowHash) {
            window.location.hash = DrWritePreferences.windowHash;
        }
    }

    let editor;
    let workingNote;
    let ignoreTextChange = false;
    let initialLoad = true;

    const save = () => {};

    const CLIENT_ID = "w7lnr8lari3bnpm";

    const getAccessTokenFromUrl = () => {
        return utils.parseQueryString(window.location.hash).access_token;
    };

    // If the user was just redirected from authenticating, the urls
    // hash will contain the access token.
    const isAuthenticated = () => {
        return Boolean(getAccessTokenFromUrl());
    };

    const filesContainer = document.querySelector(".files");

    const showPageSection = (elementSelector) => {
        document.querySelector(elementSelector).style.display = "block";
    };

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
            // mode: "orgmode",
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

    const getExtension = (path) => {
        return path.match(/\.(.*)$/);
    };

    const renderItems = (items, dbx, parent = filesContainer) => {
        items.forEach((item) => {
            const li = document.createElement("li");
            li.textContent = item.name;
            parent.appendChild(li);

            li.addEventListener("click", async () => {
                if (item[".tag"] === "folder") {
                    // Replace to remove all event listeners:
                    const dolly = li.cloneNode(true);
                    li.parentNode.replaceChild(dolly, li);

                    const newUl = document.createElement("ul");
                    li.appendChild(newUl);

                    const response = await dbx.filesListFolder({
                        path: item.path_display,
                    });
                    renderItems(response.result.entries, dbx, newUl);
                } else if (item[".tag"] === "file") {
                    const response = await dbx.filesDownload({
                        path: item.path_display,
                    });
                    const text = await response.result.fileBlob.text();
                    switch (true) {
                        case getExtension(item.name).includes("md"):
                        case getExtension(item.name).includes("markdown"):
                            editor.setOption("mode", "markdown");
                            break;

                        case getExtension(item.name).includes("org"):
                            editor.setOption("mode", "orgmode");
                            break;

                        default:
                            editor.setOption("mode", null);
                            break;
                    }

                    editor.getDoc().setValue(text);
                }
            });
        });
    };

    if (isAuthenticated()) {
        showPageSection(".authed-section");

        const dbx = new Dropbox.Dropbox({
            accessToken: getAccessTokenFromUrl(),
        });

        window.localStorage.setItem(
            "DrWritePreferences",
            JSON.stringify(
                Object.assign(
                    {},
                    JSON.parse(
                        window.localStorage.getItem("DrWritePreferences")
                    ),
                    {
                        windowHash: window.location.hash,
                    }
                )
            )
        );

        const response = await dbx.filesListFolder({ path: "" });
        renderItems(response.result.entries, dbx);
    } else {
        showPageSection(".pre-auth-section");

        const dbx = new Dropbox.Dropbox({ clientId: CLIENT_ID });
        const authUrl = await dbx.auth.getAuthenticationUrl(
            "http://localhost:8887"
        );
        document.querySelector(".authlink").href = authUrl;
    }

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
});
