# PitPom Minigolfe
A cross-platform minigolf game written in C. 

The garden redesign adds painted grass and cedar, organic trees, flowers,
mushrooms, soft warm light and a storybook interface while retaining the original
physics and multiplayer. See [visual changes, validation and performance](docs/visual-redesign.md).

## Publish multiplayer

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/vitor-martinsb/MG-pitpom/tree/staging)

Create a Render account with your GitHub login, connect this repository and use
the button above. It deploys the **staging** branch as a **Free** Docker web
service, with the browser game, WebSocket server and native C physics together.
The public HTTPS URL is assigned by Render after deployment. The button opens
the deployment setup; it is not a playable game link until the service is live.
After activation, copy the service URL to the repository's **About → Website**.
See [deployment instructions](docs/render-deployment.md).

Updates to `staging` deploy after the GitHub validation workflow passes.
The free service sleeps after 15 minutes without traffic and takes about one
minute to wake up. Rooms and chat are kept in memory and end on server restarts.

## Languages

Open **Settings → Language** to select **English**, **Português (Brasil)** or
**Español**. English is the default on first access. Your choice is saved in
the browser and applies immediately to multiplayer and the solo game's menus,
tutorials and results. Each player can choose a different language. Chat messages
and player names are displayed exactly as entered.

## Platforms
- HTML: https://mgerdes.github.io/minigolf.html (Works best in Chrome)
- iOS: https://apps.apple.com/us/app/open-golf/id1615224465
- Android: https://play.google.com/store/apps/details?id=me.mgerdes.open_golf
- Windows
- Linux

## Info
![Image](https://i.imgur.com/TBlXedl.gif)
- Used the [Sokol](https://github.com/floooh/sokol) libraries to create a cross platform application with 3D graphics and audio.
- Wrote the Physics code to handle collision detection and collision response for the golf ball.
- Used [ImGui](https://github.com/ocornut/imgui) to create in games tools for fast iteration. Also created an in game-editor that can be used to modify the terrain of a hole and then quickly play to get fast feedback. The game-editor can also run scripts to generate the points and faces of more interesting models.
![Image](https://i.imgur.com/fCoKT2e.gif)
- Used the library [Lightmapper](https://github.com/ands/lightmapper) to generate lightmaps for the terrain and also [xatlas](https://github.com/jpcy/xatlas) to generate lightmap UVs. These lightmaps are then baked into the files for the courses. It can also interpolate between multiple samples to create lightmaps for some moving objects.
![Image](https://i.imgur.com/ADw5kCw.gif)
![Image](https://i.imgur.com/tUJyHRk.gif)

## Multiplayer

The Web client supports rooms of up to 50 players, simultaneous shots, individual
colors/nicknames, authoritative C physics, timed holes, scoring and reconnect.
The desktop game retains its offline flow and five-player debug fixtures.
See [execution instructions and architecture](docs/multiplayer-architecture.md).

With this workspace's builds already generated:

```sh
python build/multiplayer.py start
```

Open **http://localhost:3000**. One player creates a room; the others enter
its five-character code. The host starts the match. Each browser tab controls
one ball; **Tab** opens the scoreboard. On Windows, `build/run-multiplayer.cmd`
starts the same server. Remote browsers require HTTPS because the Web client
uses shared memory; the architecture notes describe hosting requirements.

To share a temporary public link on Windows, put `cloudflared.exe` or
`cloudflared-windows-amd64.exe` in the project root and open `iniciar-online.cmd`.
It starts the local server if needed, prints the link and saves it in
`out/multiplayer-link.txt`. Keep the window open; Ctrl+C stops the tunnel and
any server started by that window. An existing local server stays running.

On a phone, open the public HTTPS link in the browser. Touch the ball, drag to
aim and release to shoot; drag away from the ball to rotate the camera. Tap
**Placar** for scores. The interface adjusts to portrait, landscape and the
on-screen keyboard. `npm run test:mobile` in `server` validates touch controls
with two mobile browser contexts; physical iOS/Android devices still need
manual verification.

The aiming preview uses five arrows at every shot strength. Tap **Chat** to
send messages to the players in your room, in the lobby or during the match.
The last 50 messages remain available when you reconnect. Messages accept
up to 240 characters, with a one-second interval between sends.

The browser plays an original, mellow lo-fi instrumental at 62 BPM after your
first click or touch. Open **Settings** to adjust the volume or mute it; your
preference is saved on that browser. Audio pauses while the tab is hidden.
`npm run test:social-music` in `server` checks chat between mobile and desktop,
reconnection, five arrows at different strengths and the audio controls.

To rebuild, install Python 3, CMake, Ninja, a C/C++ compiler, Node.js 22+ and an
activated Emscripten SDK (`EMSDK`), then run:

```sh
python build/multiplayer.py build
python build/multiplayer.py test
```

The script also recognizes the portable toolchains in `out/toolchain`.

## Building

Lifecycle, projection and label tests are independent of the renderer:
`cmake -S tests -B out/player-tests`, build that target, then
`ctest --test-dir out/player-tests --output-on-failure`.

### Windows
- To compile run `build\build-win64.bat`

- To start the game run `out\win64\golf.exe`

- This also creates `out\win64\golf.sln` which can be opened in Visual Studio to compile / run everything

### Linux
- To compile run `./build/build-linux.sh`

- To start the game run `out/linux/golf`

## OSX
- To compile run `./build/build-osx.sh`

- To start the game run `out/osx/golf`

## 3rd Party Libraries
- [cembed](https://github.com/rxi/cembed)
- [cimgui](https://github.com/cimgui/cimgui)
- [fast_obj](https://github.com/thisistherk/fast_obj)
- [glfw](https://github.com/glfw/glfw)
- [glslcc](https://github.com/septag/glslcc)
- [imgui](https://github.com/ocornut/imgui)
- [Kenney Art Assets](https://kenney.nl/assets)
- [lightmapper](https://github.com/ands/lightmapper)
- [mattiasgustavsson/libs](https://github.com/mattiasgustavsson/libs)
- [miniz](https://github.com/richgel999/miniz)
- [parson](https://github.com/kgabis/parson)
- [sokol](https://github.com/floooh/sokol)
- [stb](https://github.com/nothings/stb)
- [xatlas](https://github.com/jpcy/xatlas)

As mascotes interativas, o Modo Impacto, a apresentação dos mapas, o minimapa e a bandeira animada estão documentados em [Novas mecânicas](docs/new-mechanics.md).
