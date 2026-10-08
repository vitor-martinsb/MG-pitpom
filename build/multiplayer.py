"""Build or run PitPom Minigolfe online; supports installed and workspace toolchains."""
import argparse
import http.client
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent

def run(command, cwd=ROOT, env=None):
    print('> ' + ' '.join(map(str, command)), flush=True)
    subprocess.run(list(map(str, command)), cwd=cwd, env=env, check=True)

def node_tools():
    installed = shutil.which('node')
    portable = sorted((ROOT / 'out/toolchain').glob('node-v*-win-x64/node.exe'))
    node = Path(installed) if installed else portable[-1] if portable else None
    if not node:
        raise RuntimeError('Instale Node.js 22 ou superior (node e npm no PATH).')
    npm_cli = node.parent / 'node_modules/npm/bin/npm-cli.js'
    npm = [node, npm_cli] if npm_cli.is_file() else [shutil.which('npm') or 'npm']
    env = os.environ.copy()
    env['PATH'] = str(node.parent) + os.pathsep + env.get('PATH', '')
    return node, npm, env

def emscripten_environment():
    sdk = Path(os.environ.get('EMSDK', ROOT / 'out/toolchain/emsdk-main'))
    toolchain = sdk / 'upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake'
    if not toolchain.is_file():
        raise RuntimeError('Instale/ative o Emscripten SDK e defina EMSDK. Consulte README.md.')
    env = os.environ.copy()
    env['EMSDK'] = str(sdk)
    for key, pattern in [('EMSDK_NODE', 'node/*/node.exe' if os.name == 'nt' else 'node/*/bin/node'), ('EMSDK_PYTHON', 'python/*/python.exe')]:
        found = sorted(sdk.glob(pattern))
        if found and key not in env:
            env[key] = str(found[-1])
    env['PATH'] = str(sdk / 'upstream/emscripten') + os.pathsep + env.get('PATH', '')
    return toolchain, env

def build():
    native_args = ['cmake', '-S', 'server/native', '-B', 'out/server-native']
    if os.name == 'nt' and not (ROOT / 'out/server-native/CMakeCache.txt').is_file() and (ROOT / 'out/toolchain/ziglang/zig.exe').is_file():
        native_args += ['-G', 'Ninja', f'-DCMAKE_TOOLCHAIN_FILE={ROOT / "build/zig-toolchain.cmake"}']
    run(native_args)
    run(['cmake', '--build', 'out/server-native', '--config', 'Release', '--parallel', '2'])
    toolchain, env = emscripten_environment()
    run(['cmake', '-S', '.', '-B', 'out/web', '-G', 'Ninja', f'-DCMAKE_TOOLCHAIN_FILE={toolchain}', '-DCMAKE_BUILD_TYPE=Release', '-DCMAKE_POLICY_VERSION_MINIMUM=3.5', '-DGOLF_SANITIZE_ADDRESS=OFF'], env=env)
    run(['cmake', '--build', 'out/web', '--target', 'golf', '--parallel', '2'], env=env)
    _, npm, env = node_tools()
    run([*npm, 'ci'], ROOT / 'server', env)
    run([*npm, 'run', 'build'], ROOT / 'server', env)

def server_port():
    try:
        port = int(os.environ.get('PORT', '3000'))
        if not 1 <= port <= 65535:
            raise ValueError()
    except ValueError:
        raise RuntimeError('PORT deve ser um número entre 1 e 65535.')
    return port

def server_running(port):
    try:
        with socket.create_connection(('127.0.0.1', port), timeout=1):
            pass
    except OSError:
        occupied = False
    else:
        occupied = True
    if occupied:
        connection = http.client.HTTPConnection('127.0.0.1', port, timeout=2)
        try:
            connection.request('GET', '/')
            response = connection.getresponse()
            page = response.read(4096).decode('utf-8', errors='replace')
            titles = ('<title>PitPom Minigolfe · Multiplayer</title>', '<title>Open Golf · Multiplayer</title>')
            if response.status == 200 and any(title in page for title in titles):
                return True
        except (OSError, http.client.HTTPException):
            pass
        finally:
            connection.close()
        raise RuntimeError(f'A porta {port} está ocupada por outro serviço. Defina PORT com outra porta e execute novamente.')
    return False

def start():
    port = server_port()
    if server_running(port):
        print(f'O multiplayer já está rodando. Abra http://localhost:{port}', flush=True)
        return
    if not (ROOT / 'out/web/golf.html').is_file():
        raise RuntimeError('Compile primeiro: python build/multiplayer.py build')
    node, npm, env = node_tools()
    if not (ROOT / 'server/node_modules/ws').is_dir():
        run([*npm, 'ci'], ROOT / 'server', env)
    run([*npm, 'run', 'build'], ROOT / 'server', env)
    run([node, 'dist/index.js'], ROOT / 'server', env)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['build', 'start', 'test'])
    args = parser.parse_args()
    try:
        if args.command == 'build': build()
        elif args.command == 'start': start()
        else:
            _, npm, env = node_tools()
            run(['ctest', '--test-dir', 'out/server-native', '--output-on-failure'])
            run([*npm, 'test'], ROOT / 'server', env)
    except KeyboardInterrupt:
        pass
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
