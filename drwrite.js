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
        localStorage.setItem("codeVerifier", dbxAuth.codeVerifier);

        hidePageSection(".authed-section");
        showPageSection(".pre-auth-section");
        window.location.href = authUrl;
    };

    const tryAgain = async (err = "") => {
        console.warn("Authentication is failing: ", err);
        await doAuth();
    };

    const storedAccessTokenResponse = JSON.parse(
        localStorage.getItem("dropboxAccessTokenResponse")
    );

    if (storedAccessTokenResponse?.refresh_token) {
        hidePageSection(".pre-auth-section");
        showPageSection(".authed-section");

        dbxAuth = new Dropbox.DropboxAuth({
            clientId: CLIENT_ID,
            accessToken: storedAccessTokenResponse.access_token,
            refreshToken: storedAccessTokenResponse.refresh_token,
        });
        await dbxAuth.checkAndRefreshAccessToken();

        dbx = new Dropbox.Dropbox({
            auth: dbxAuth,
        });
    } else if (hasRedirectedFromAuth()) {
        hidePageSection(".pre-auth-section");
        showPageSection(".authed-section");

        dbxAuth.setCodeVerifier(
            sessionStorage.getItem("codeVerifier") ||
                localStorage.getItem("codeVerifier")
        );

        let accessTokenResponse;

        try {
            accessTokenResponse = await dbxAuth.getAccessTokenFromCode(
                pureUrl,
                getCodeFromUrl()
            );
            localStorage.setItem(
                "dropboxAccessTokenResponse",
                JSON.stringify(accessTokenResponse?.result)
            );
        } catch (err) {
            await tryAgain(err);
        }

        let accessToken;
        if (accessTokenResponse?.result?.access_token) {
            accessToken = accessTokenResponse.result.access_token;
        } else {
            await tryAgain("No access token.");
        }

        dbxAuth.setAccessToken(accessToken);

        dbx = new Dropbox.Dropbox({
            auth: dbxAuth,
        });
    } else {
        hidePageSection(".authed-section");
        showPageSection(".pre-auth-section");
        await doAuth();
    }

    try {
        const response = await dbx.filesListFolder({ path: "" });
        renderItems(response.result.entries);
    } catch (err) {
        await tryAgain(err);
    }

    const createNewFile = document.querySelector(".create-new-file");
    createNewFile.addEventListener("click", async () => {
        const path = window.prompt("What do you want to call this new file?");

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

        // let waitToReformat;
        let waitToSave;
        let changing = false;
        editor.on("change", (cm, change) => {
            // clearTimeout(waitToReformat);
            clearTimeout(waitToSave);
            if (!changing) {
                // waitToReformat = setTimeout(() => {
                //     changing = true;

                //     cm.wrapParagraphsInRange(
                //         change.from,
                //         CodeMirror.changeEnd(change)
                //     );

                //     changing = false;
                // }, 200);

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
