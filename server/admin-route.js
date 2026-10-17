// Yönetim sayfasının adresi; kimlik doğrulama security.middleware tarafından uygulanır.
const ADMIN_PATH = '/ozkan-ofis-7k4m';
function isAdminPage(pathname) { return pathname === ADMIN_PATH || pathname === ADMIN_PATH + '/'; }
module.exports = { ADMIN_PATH, isAdminPage };
