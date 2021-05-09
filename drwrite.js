document.addEventListener("DOMContentLoaded", async (event) => {
    "use strict";

    let editor;
    let workingNote;
    let filePath;
    let dbx;

    const save = async (path, contents) => {
        return await dbx.filesUpload({
            path: path,
            mode: "overwrite",
            mute: true,
            contents: contents,
        });
    };

    const CLIENT_ID = "w7lnr8lari3bnpm";

    const getAccessTokenFromUrl = () => {
        return utils.parseQueryString(window.location.hash).access_token;
    };

    const showPageSection = (elementSelector) => {
        document.querySelector(elementSelector).style.display = "block";
    };

    // If the user was just redirected from authenticating, the urls
    // hash will contain the access token.
    const isAuthenticated = () => {
        return Boolean(getAccessTokenFromUrl());
    };

    const filesContainer = document.querySelector(".files");

    const renderItems = (items, parent = filesContainer) => {
        items.forEach((item) => {
            const li = document.createElement("li");
            li.textContent = item.name;
            li.classList.add(item[".tag"]);
            parent.appendChild(li);

            li.addEventListener("click", async () => {
                if (item[".tag"] === "folder") {
                    // Replace to remove all event listeners:
                    const dolly = li.cloneNode(true);
                    li.parentNode.replaceChild(dolly, li);

                    const newUl = document.createElement("ul");
                    dolly.appendChild(newUl);

                    const response = await dbx.filesListFolder({
                        path: item.path_display,
                    });
                    renderItems(response.result.entries, newUl);
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
                    filePath = item.path_display;
                    filePathNode.textContent = `Editing: ${filePath}`;
                }
            });
        });
    };

    if (isAuthenticated()) {
        showPageSection(".authed-section");

        dbx = new Dropbox.Dropbox({
            accessToken: getAccessTokenFromUrl(),
        });
        console.log(dbx);
        debugger;
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
        renderItems(response.result.entries);
    } else {
        showPageSection(".pre-auth-section");

        dbx = new Dropbox.Dropbox({
            clientId: CLIENT_ID,
            tokenAccessType: "offline",
        });

        const authUrl = await dbx.auth.getAuthenticationUrl(
            `${window.location.origin}${window.location.pathname}`
        );
        document.querySelector(".authlink").href = authUrl;
    }

    // Load preferences from local storage:
    const result = window.localStorage.getItem("DrWritePreferences");
    if (result) {
        const DrWritePreferences = JSON.parse(result);
        console.log(DrWritePreferences);
        if (DrWritePreferences.windowHash) {
            if (dbx) {
                console.log(await dbx.auth.checkAndRefreshAccessToken());
            }
            window.location.hash = DrWritePreferences.windowHash;
        }
    }

    const filePathNode = document.querySelector(".info .file-path");

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
        });
        editor.setSize("100%", "100%");

        let waitToReformat;
        let waitToSave;
        let changing = false;
        editor.on("change", (cm, change) => {
            clearTimeout(waitToReformat);
            clearTimeout(waitToSave);
            waitToReformat = setTimeout(() => {
                changing = true;
                cm.wrapParagraphsInRange(
                    change.from,
                    CodeMirror.changeEnd(change)
                );
                changing = false;
            }, 200);

            waitToSave = setTimeout(async () => {
                if (filePath) {
                    const saveResult = await save(
                        filePath,
                        editor.getDoc().getValue()
                    );
                }
            }, 2000);
        });
    };

    loadEditor();

    const getExtension = (path) => {
        return path.match(/\.(.*)$/);
    };
});
