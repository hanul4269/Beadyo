"""Exercise the preview handler on in-memory HTTP requests; no listener needed."""
from contextlib import redirect_stderr
from io import BytesIO, StringIO
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import local_preview


class PreviewAccessTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name, 'site').resolve()
        self.root.mkdir()
        (self.root / 'index.html').write_text('test homepage')
        outside = self.root.parent / 'outside.txt'
        outside.write_text('private fixture')
        (self.root / '.git').mkdir()
        (self.root / '.git' / 'HEAD').write_text('private fixture')
        (self.root / 'outside-link').symlink_to(outside)
        (self.root / 'subdir').mkdir()
        (self.root / 'subdir' / 'index.html').symlink_to(outside)
        (self.root / 'no-index').mkdir()

    def request(self, path, hosts=('localhost:3000',)):
        payload = 'GET ' + path + ' HTTP/1.0\r\n' + ''.join('Host: ' + host + '\r\n' for host in hosts) + '\r\n'
        response = bytearray()

        class Connection:
            def makefile(self, *args):
                return BytesIO(payload.encode('ascii'))

            def sendall(self, data):
                response.extend(data)

        with patch.object(local_preview, 'ROOT', self.root), redirect_stderr(StringIO()):
            local_preview.Handler(Connection(), ('127.0.0.1', 12345), None, directory=str(self.root))
        return bytes(response)

    def test_only_direct_local_hosts_are_served(self):
        for host in ('localhost:3000', '127.0.0.1:3000'):
            self.assertIn(b'test homepage', self.request('/', (host,)))
        for hosts in ((), ('example.invalid:3000',), ('localhost:3000', 'other.invalid')):
            with self.subTest(hosts=hosts):
                response = self.request('/', hosts)
                self.assertIn(b'403', response.splitlines()[0])
                self.assertNotIn(b'X-Beadyo-Preview', response)

    def test_private_files_directory_listings_and_escaping_links_are_blocked(self):
        for path in ('/.git/HEAD', '/%2egit/HEAD', '/outside-link', '/subdir/', '/subdir/index.html', '/no-index/'):
            with self.subTest(path=path):
                response = self.request(path)
                self.assertIn(b'404', response.splitlines()[0])
                self.assertNotIn(b'private fixture', response)


if __name__ == '__main__':
    unittest.main()
