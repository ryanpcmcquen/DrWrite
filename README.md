# DrWrite

![DrWrite_logo](./DrWrite_logo.png)

An online editor for your Dropbox files, with support for Markdown, Org Mode, and good ol' plain text.

-   This app is fully client side.
-   This app is as minimal as possible. It should work well on desktop and mobile, but the idea here is not to be the 'next great editor', the idea is to have a way to quickly edit Markdown and Org Mode files without a lot of fuss or distraction.

![IMG_4627](https://user-images.githubusercontent.com/772937/117858525-d2411b80-b242-11eb-9190-a62467d0cd5e.jpg)
![IMG_4628](https://user-images.githubusercontent.com/772937/117858527-d2d9b200-b242-11eb-82ef-7307121cda3e.jpg)


### Dropbox permissions

This app requires the following Dropbox permissions:
![Dropbox permissions](https://user-images.githubusercontent.com/772937/119743722-5ac4dc00-be3f-11eb-9296-c76bedafa488.png)

- `account_info.read`: You can't turn this one off, I don't think I actually need it. You can see in the source code that I don't read anything from it.
- `files.metadata.read`: You can't turn this one off either. I probably need it though since the app lists files.
- `files.content.write`: This one I definitely need. This app writes files.
- `files.content.read`: This one I also need. This app can read files inside of its own folder.

---

Thanks to https://github.com/mickael-kerjean for all the [hard work](https://github.com/mickael-kerjean/nuage/blob/master/client/pages/viewerpage/editor/orgmode.js).
