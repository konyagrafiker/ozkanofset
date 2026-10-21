"""Upload only the overview patch; never synchronize or delete remote files."""
import ftplib
import hashlib
import hmac
import os
from pathlib import Path
import ssl

# SHA-256 shown by the user's existing FileZilla connection (2026-10-22).
CERTIFICATE_SHA256 = '615ecb860c6a3151d348fa5298f9e79bda6db84bf96defb02b7324d7dea2b80b'

class PinnedFTP_TLS(ftplib.FTP_TLS):
    def __init__(self, **kwargs):
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        # The exact certificate is authenticated below, before credentials or
        # file contents are sent, instead of trusting its self-signed issuer.
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        super().__init__(context=context, **kwargs)

    def verify_certificate(self, connection):
        certificate = connection.getpeercert(binary_form=True)
        if not certificate or not hmac.compare_digest(
            hashlib.sha256(certificate).hexdigest(), CERTIFICATE_SHA256
        ):
            connection.close()
            raise ssl.SSLCertVerificationError('FTPS certificate fingerprint does not match FileZilla. Connection stopped.')

    def auth(self):
        response = super().auth()
        self.verify_certificate(self.sock)
        return response

    def ntransfercmd(self, cmd, rest=None):
        connection, size = super().ntransfercmd(cmd, rest)
        self.verify_certificate(connection)
        return connection, size

FILES = (
    'assets/js/admin-overview-data.js',
    'assets/js/admin-overview.js',
    'admin/public/index.html',
)

def main():
    for key in ('FTP_SERVER', 'FTP_USERNAME', 'FTP_PASSWORD', 'SERVER_DIR'):
        if not os.environ.get(key):
            raise RuntimeError(f'Missing setting: {key}')
    root = os.environ['SERVER_DIR']
    if not root.startswith('/') or root == '/' or any(c in root for c in ('\r', '\n', '..')):
        raise RuntimeError('Use the absolute application directory, not the FTP root.')
    for name in FILES:
        if not Path(name).is_file():
            raise RuntimeError(f'Missing local file: {name}')
    with PinnedFTP_TLS(timeout=60) as ftp:
        ftp.connect(os.environ['FTP_SERVER'], 21)
        ftp.login(os.environ['FTP_USERNAME'], os.environ['FTP_PASSWORD'])
        ftp.prot_p()
        ftp.cwd(root)
        ftp.voidcmd('TYPE I')
        # Check every destination before changing anything. A wrong/empty
        # directory must fail rather than create a second application tree.
        for name in FILES:
            if ftp.size(name) is None:
                raise RuntimeError(f'Missing remote file: {name}')
        print('FTPS connection and all three destination files verified.')
        if os.environ.get('DRY_RUN', 'true').lower() != 'false':
            print('Check complete. No files changed.')
            return
        for name in FILES:
            with open(name, 'rb') as source:
                ftp.storbinary(f'STOR {name}', source)
            print(f'Uploaded: {name}')
        print('Overview patch uploaded. Refresh the admin page with Ctrl+F5.')

if __name__ == '__main__':
    main()
