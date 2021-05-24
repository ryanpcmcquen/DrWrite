document.addEventListener("DOMContentLoaded", async (_event) => {
    "use strict";

    let editor;
    let filePath;
    let dbx;
    let dbxAuth;

    const save = async (path, contents) => {
        return await dbx.filesUpload({
            path: path,
            mode: "overwrite",
            mute: true,
            contents: contents,
        });
    };

    const CLIENT_ID = "w7lnr8lari3bnpm";
    // const preferencesKey = "DrWritePreferences";

    const getCodeFromUrl = () => {
        return utils.parseQueryString(window.location.search).code;
    };

    // If the user was just redirected from authenticating, the urls
    // hash will contain the access token.
    const hasRedirectedFromAuth = () => {
        return Boolean(getCodeFromUrl());
    };

    const modifyPageSectionDisplay = (elementSelector, displayProp) => {
        Array.from(document.querySelectorAll(elementSelector)).forEach(
            (element) => {
                element.style.display = displayProp;
            }
        );
    };

    const showPageSection = (elementSelector) => {
        modifyPageSectionDisplay(elementSelector, "block");
    };

    const hidePageSection = (elementSelector) => {
        modifyPageSectionDisplay(elementSelector, "none");
    };

    const filesContainer = document.querySelector(".files");

    const renderItems = (items, parent = filesContainer, clear = false) => {
        if (clear) {
            parent.innerHTML = "";
        }
        items.forEach((item) => {
            const li = document.createElement("li");
            const button = document.createElement("button");
            button.textContent = item.name;
            li.classList.add(item[".tag"]);
            li.appendChild(button);
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

    const pureUrl = `${window.location.origin}${window.location.pathname}`;
    // For use in:
    // getAuthenticationUrl(
    //     redirectUri,
    //     state,
    //     authType = 'token',
    //     tokenAccessType = null,
    //     scope = null,
    //     includeGrantedScopes = 'none',
    //     usePKCE = false
    // )
    const authOptions = [
        pureUrl,
        undefined,
        "code",
        "offline",
        undefined,
        undefined,
        true,
    ];

    dbxAuth = new Dropbox.DropboxAuth({
        clientId: CLIENT_ID,
    });

    const doAuth = async () => {
        const authUrl = await dbxAuth.getAuthenticationUrl(...authOptions);
        sessionStorage.setItem("codeVerifier", dbxAuth.codeVerifier);

        // localStorage.setItem(
        //     preferencesKey,
        //     JSON.stringify({
        //         codeVerifier: dbxAuth.codeVerifier,
        //         dbxAuth: dbxAuth,
        //     })
        // );

        // window.location.href = authUrl;
        hidePageSection(".authed-section");
        showPageSection(".pre-auth-section");
        const authLink = document.querySelector(".authlink");
        authLink.style.cursor = "pointer";
        authLink.style.textDecoration = "underline";

        authLink.addEventListener("click", () => {
            window.location.href = authUrl;
        });
    };

    const tryAgain = async (err = "") => {
        console.warn("Authentication is failing: ", err);
        // localStorage.setItem(preferencesKey, "{}");
        await doAuth();
    };

    if (hasRedirectedFromAuth()) {
        hidePageSection(".pre-auth-section");
        showPageSection(".authed-section");

        dbxAuth.setCodeVerifier(sessionStorage.getItem("codeVerifier"));

        let accessTokenResponse;
        // let DrWritePreferences = JSON.parse(
        // localStorage.getItem(preferencesKey)
        // );
        // if (DrWritePreferences?.dbxAuth) {
        //     try {
        //         dbx = new Dropbox.Dropbox({
        //             auth: DrWritePreferences.dbxAuth,
        //         });
        //     } catch (ignore) {}
        // } else {
        try {
            accessTokenResponse = await dbxAuth.getAccessTokenFromCode(
                pureUrl,
                getCodeFromUrl()
            );
        } catch (err) {
            await tryAgain(err);
        }
        // }

        let accessToken;
        if (accessTokenResponse?.result?.access_token) {
            accessToken = accessTokenResponse.result.access_token;
            // } else if (DrWritePreferences?.access_token) {
            // accessToken = DrWritePreferences.access_token;
        } else {
            await tryAgain("No access token.");
        }

        dbxAuth.setAccessToken(accessToken);

        dbx = new Dropbox.Dropbox({
            auth: dbxAuth,
        });

        // localStorage.setItem(
        //     preferencesKey,
        //     JSON.stringify({
        //         access_token: accessToken,
        //         codeVerifier: sessionStorage.getItem("codeVerifier"),
        //         dbxAuth: dbxAuth,
        //         refresh_token:
        //             accessTokenResponse?.result?.refresh_token ||
        //             DrWritePreferences?.refresh_token,
        //     })
        // );

        try {
            const response = await dbx.filesListFolder({ path: "" });
            renderItems(response.result.entries);
        } catch (err) {
            await tryAgain(err);
        }

        const createNewFile = document.querySelector(".create-new-file");
        createNewFile.addEventListener("click", async () => {
            const path = window.prompt(
                "What do you want to call this new file?"
            );

            await dbx.filesUpload({
                path: `/${path}`,
                mute: true,
            });

            const response = await dbx.filesListFolder({ path: "" });
            renderItems(response.result.entries, filesContainer, true);
        });

        const toggleFileList = document.querySelector(".toggle-file-list");
        toggleFileList.addEventListener("click", () => {
            filesContainer.classList.toggle("hidden");
        });
    } else {
        hidePageSection(".authed-section");
        showPageSection(".pre-auth-section");
        await doAuth();
    }

    // Load preferences from local storage:
    // const result = localStorage.getItem(preferencesKey);

    // if (result) {
    // const DrWritePreferences = JSON.parse(result);

    // if (DrWritePreferences && dbx) {
    // await dbxAuth.checkAndRefreshAccessToken();
    // }
    // }

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
            if (!changing) {
                waitToReformat = setTimeout(() => {
                    changing = true;

                    cm.wrapParagraphsInRange(
                        change.from,
                        CodeMirror.changeEnd(change)
                    );

                    changing = false;
                }, 200);

                waitToSave = setTimeout(async () => {
                    changing = true;

                    if (filePath) {
                        await save(filePath, editor.getDoc().getValue());
                    }

                    changing = false;
                }, 1000);
            }
        });
    };

    loadEditor();

    const getExtension = (path) => {
        return path.match(/\.(.*)$/);
    };
});
