"""Start or reuse this project's localhost:3000 preview."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial
import subprocess
import sys
import time
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
URL = "http://localhost:3000"
IDENTITY = str(ROOT)

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("X-Beadyo-Preview", IDENTITY)
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def probe():
    try:
        with urllib.request.urlopen(URL, timeout=1) as response:
            return response.headers.get("X-Beadyo-Preview") == IDENTITY
    except urllib.error.HTTPError:
        return False
    except (urllib.error.URLError, TimeoutError, OSError):
        return None


def main():
    if "--serve" in sys.argv:
        with ThreadingHTTPServer(("127.0.0.1", 3000), partial(Handler, directory=str(ROOT))) as server:
            server.serve_forever()
        return
    status = probe()
    if status is True:
        print(URL + " (기존 프로젝트 서버 재사용)")
        return
    if status is False:
        raise SystemExit("3000번 포트를 다른 서버가 사용 중입니다. 자동 종료하거나 다른 포트로 바꾸지 않습니다.")
    log_path = Path("/tmp/beadyo-preview-3000.log")
    with log_path.open("ab") as log:
        process = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), "--serve"],
                                   cwd=ROOT, stdout=log, stderr=log, stdin=subprocess.DEVNULL,
                                   start_new_session=True)
    for _ in range(30):
        status = probe()
        if status is True:
            print(URL + " (자동 시작)")
            return
        if status is False or process.poll() is not None:
            break
        time.sleep(0.1)
    raise SystemExit("3000번 서버를 시작하지 못했습니다. 로그: " + str(log_path))

if __name__ == "__main__":
    main()
