"""Start PitPom Minigolfe and display a public link until Ctrl+C is pressed."""
import argparse
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

from multiplayer import ROOT, server_port, server_running


def stop(process):
    if process is None or process.poll() is not None:
        return
    if os.name == 'nt':
        # Stop only the process tree launched by this script, including physics.
        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       creationflags=subprocess.CREATE_NO_WINDOW, check=False)
    else:
        process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()


def share(check=False):
    executable = next((p for p in [ROOT / 'cloudflared.exe', ROOT / 'cloudflared-windows-amd64.exe']
                       if p.is_file()), None)
    executable = executable or shutil.which('cloudflared')
    if not executable:
        raise RuntimeError('Coloque cloudflared.exe ou cloudflared-windows-amd64.exe na pasta do projeto.')
    port = server_port()
    running = server_running(port)
    if not (ROOT / 'out/web/golf.html').is_file():
        raise RuntimeError('Compile primeiro: python build/multiplayer.py build')
    if check:
        print(f'Pronto para gerar um link. Servidor local: {"ativo" if running else "será iniciado"}.')
        return

    server = tunnel = None
    log = None
    link_file = ROOT / 'out/multiplayer-link.txt'
    published = False
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    try:
        if not running:
            print('Iniciando o servidor multiplayer...', flush=True)
            log = (ROOT / 'out/multiplayer-server.log').open('w', encoding='utf-8')
            server = subprocess.Popen([sys.executable, str(ROOT / 'build/multiplayer.py'), 'start'],
                                      cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, creationflags=flags)
            deadline = time.monotonic() + 60
            while not server_running(port):
                if server.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError('Não foi possível iniciar o servidor. Consulte out/multiplayer-server.log.')
                time.sleep(.25)
        print('Gerando link público para PitPom Minigolfe...', flush=True)
        print('Mantenha esta janela aberta. Ctrl+C encerra o link.', flush=True)
        tunnel = subprocess.Popen([str(executable), 'tunnel', '--url', f'http://127.0.0.1:{port}'],
                                  cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                  text=True, encoding='utf-8', errors='replace', creationflags=flags)
        for line in tunnel.stdout:
            match = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com\b', line)
            if match and not published:
                url = match.group()
                link_file.write_text(url + '\n', encoding='utf-8')
                published = True
                print(f'\nCOMPARTILHE ESTE LINK: {url}\n', flush=True)
                print(f'Link salvo em: {link_file}', flush=True)
                print('Abra o link, crie uma sala e compartilhe também o código da sala.', flush=True)
            elif ' ERR ' in line or ' WRN ' in line:
                print(line.rstrip(), flush=True)
        if tunnel.wait() != 0 or not published:
            raise RuntimeError('O túnel não conseguiu manter o link público. Verifique sua conexão e tente novamente.')
    except KeyboardInterrupt:
        print('\nEncerrando o link público...', flush=True)
    finally:
        stop(tunnel)
        stop(server)
        if log:
            log.close()
        if published:
            link_file.write_text('Link encerrado. Execute iniciar-online.cmd para gerar outro.\n', encoding='utf-8')
            print('Link encerrado.', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verifica os arquivos sem criar um link público.')
    args = parser.parse_args()
    try:
        share(args.check)
    except (RuntimeError, OSError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
