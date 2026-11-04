"""Start or reuse this project's localhost:3000 preview."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial
import subprocess
import sys
import tempfile
import time
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
URL = "http://localhost:3000"
IDENTITY = str(ROOT)

class Handler(SimpleHTTPRequestHandler):
    def local_host(self):
        hosts = self.headers.get_all("Host", []) if hasattr(self, "headers") else []
        return len(hosts) == 1 and hosts[0].lower() in {
            "localhost:3000", "127.0.0.1:3000", "localhost", "127.0.0.1",
        }

    def send_head(self):
        if not self.local_host():
            self.send_error(403)
            return None
        path = Path(self.translate_path(self.path))
        try:
            # SimpleHTTPRequestHandler follows symlinks, including directory indexes.
            candidates = [path]
            if path.is_dir():
                candidates.extend((path / "index.html", path / "index.htm"))
            for candidate in candidates:
                relative = candidate.resolve().relative_to(ROOT)
                if any(part.startswith(".") for part in relative.parts):
                    raise ValueError
        except (ValueError, OSError, RuntimeError):
            self.send_error(404)
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(404)
        return None

    def end_headers(self):
        if self.local_host():
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
    with tempfile.NamedTemporaryFile(prefix="beadyo-preview-", suffix=".log", delete=False) as log:
        log_path = log.name
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
