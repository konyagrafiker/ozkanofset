"""Upload only the overview patch; never synchronize or delete remote files."""
import ftplib
import os
from pathlib import Path
import ssl

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
    with ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=60) as ftp:
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
