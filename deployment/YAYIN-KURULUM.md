# Özkan Ofset — yayın ve güncelleme

## Paketin durumu

Bu paket Node.js uygulamasıdır. PHP hosting klasörüne yalnızca dosyaları kopyalamak uygulamayı başlatmaz. Hosting sağlayıcısının Node.js uygulama kökünü, başlangıç dosyasını ve alan adı yönlendirmesini tanımlaması gerekir. GitHub bağlantısı henüz oluşturulmadı; birlikte kurulacak.

## İlk kurulum

1. ZIP dosyasını kendi bilgisayarınızda açın. Hosting üzerinde uygulama için **public_html/www/httpdocs dışında**, özel bir klasör kullanın. Bu klasöre paketin `site/` içeriğini FTP ile aktarın. Hostingin yayın kökünü tüm proje klasörü yapmayın. `database`, `deployment/seed`, `server` ve `.env` HTTP üzerinden erişilmemelidir. HTTPS sertifikasını etkinleştirin.
2. Hostingte **Node.js 22 veya üzeri** seçin. Uygulama başlangıç dosyası `app.js`, çalıştırma komutu `npm start`. Haricî npm bağımlılığı yoktur. Hostingin atadığı `PORT` ve `HOST` değerlerini kullanın; `.env` içine sabit port yazmak zorunda değilsiniz.
3. `.env.example` dosyasını sunucuda `.env` adıyla kopyalayıp doldurun. `ADMIN_PASSWORD` için parola yöneticisiyle üretilmiş en az 20 karakterlik benzersiz parola kullanın. Yerel bilgisayardaki yönetici şifresi bu pakette yoktur. `.env` ve veritabanı klasörü yalnızca uygulama hesabınca okunup yazılabilmelidir.
4. `SITE_URL` gerçek HTTPS adresiniz olmalıdır. `ALLOWED_HOSTS` yalnızca sizin alan adlarınızı içerir. `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` ve `TURNSTILE_HOSTNAME` değerlerini alan adınıza tanımlı Cloudflare Turnstile ayarlarıyla doldurun. Bu bilgiler eksikse uygulama canlı modda başlamaz.
5. Hosting sağlayıcısından Node.js'e bağlanan reverse proxy'nin **gerçek IP adreslerini** ve HTTPS başlığının nasıl iletildiğini öğrenin. Yalnızca bu adresleri `TRUSTED_PROXY_IPS` içine ekleyin. Proxy, kullanıcıdan gelen `X-Forwarded-Proto` başlığını temizleyip kendisi yazmalı, `X-Forwarded-For` sonuna gerçek istemci IP'sini eklemelidir. Varsayılan yalnızca loopback adresleridir; farklı proxy varsa hosting tarafından ayarlanmalıdır. Proxy katmanında da giriş/istek limiti kullanın.
6. İsteğe bağlı müşteri dosyası yüklemesi için sunucuda ClamAV gibi bir tarayıcı yapılandırıp `ANTIVIRUS_SCANNER` yolunu doldurun. Tarayıcı yapılandırılmadan dosya ekli talepler reddedilir; dosyasız talep gönderilebilir. iEntegre canlı bağlantısını yönetim panelinden yeniden tanımlayın; gizli yerel ayarlar paketlenmez. Promosyon stok kontrolü bu bağlantıya ihtiyaç duyar.
7. Panel/terminal erişimi olan hosting yetkilisi `npm run check:production` komutunu çalıştırmalı, ardından uygulamayı başlatmalıdır. Başlangıçta yalnızca eksik veritabanı dosyaları oluşturulur; var olan kayıtların üzerine yazılmaz. **Tek Node.js süreç/worker** ve kalıcı yerel disk kullanın. JSON depolaması çoklu worker/çoklu sunucu için hazırlanmış değildir.

FTP erişimi tek başına Node.js uygulaması tanımlama, yeniden başlatma, HTTPS/proxy ve ortam ayarlarını yapmaya yetmeyebilir. Bu işlemleri hosting desteği yapmalıdır. Dosyalar yüklendi diye site yayınlandı sayılmaz.

## Yayın kontrolü

- Ana sayfa, bir davetiye, bir promosyon, iletişim ve yasal sayfalar HTTPS ile açılmalı.
- Gizli yönetim adresi `server/admin-route.js` dosyasında tanımlıdır. Girişsiz yönetim API'si veri döndürmemeli; hatalı girişler sınırlandırılmalı. Doğru kullanıcıyla giriş ve personel yetkileri denenmeli. HTTP üzerinden kimlik doğrulama kabul edilmemeli.
- `/database/admin-password.txt`, `/database/quotes.json`, `/deployment/seed/settings.json`, `/.env`, `/server/server.js` gibi özel yollar içerik döndürmemeli. Apache klasör koruma örneği `deployment/private.htaccess` dosyasındadır; Nginx veya farklı sunucuda karşılığı hosting tarafından tanımlanmalıdır.
- Turnstile ile dosyasız teklif ve sipariş, tasarımın kargo adımına aktarılması ve yönetim panelinde kaydın görünmesi gerçek alan adında kontrol edilmeli. Gerçek sipariş öncesinde açıkça işaretlenmiş deneme verisi kullanın.
- Ürün görselleri, yazı tipleri ve logolar yüklenmeli; WhatsApp bağlantısı `903324471229` olmalı.
- Veritabanı ve müşteri dosyaları için yayın alanı dışına düzenli yedek alın. İlk canlı kayıt sonrası yedekten geri yükleme kontrolü yapın.

## Güncellemeler

Canlı veriler `database/` içindedir. Sonraki sürümlerde **bu klasörü, `.env` dosyasını veya sunucuda yüklenmiş görselleri silmeyin/değiştirmeyin**. Uygulama başlangıcındaki seed kopyalaması yalnızca dosya yoksa çalışır. Yeni seed dosyaları mevcut fiyat/ayarları otomatik değiştirmez; fiyat ve site ayarlarını yönetim panelinden yönetin.

Yerelde `python deployment/build-release.py` çalıştırıldığında ilk kurulum paketi ve dosya manifestosu üretilir. Önceki paket varsa ayrıca yalnızca değişen dosyaları içeren güncelleme ZIP'i oluşur. Uygulama dosyalarının bir kısmı yüklenmişken sunucuyu çalıştırmayın: hostingin bakım/yeniden başlatma mekanizmasını kullanın veya yeni bir sürüm klasörünü tamamen yükletip hosting desteğine uygulama kökünü değiştirtin. Eski sürümü geri dönüş için saklayın; müşteri verisini geri dönüş sırasında eski sürümle değiştirmeyin.

## GitHub

Bağlantıyı kullanıcıyla birlikte oluşturacağız. **Özel depo** tercih edin. `.gitignore` yerel verileri, parolaları, API ayarlarını, yedekleri ve yayın ZIP'lerini hariç tutar. Görsel arşivi yaklaşık 2,5 GB olduğundan GitHub ilk yüklemesinde medya için FTP/ayrı varlık depolaması veya Git LFS düzeni birlikte belirlenmelidir. Bu paketi hazırlamak GitHub'a gönderim veya otomatik yayın anlamına gelmez.

## Güvenlik sınırı

Parola kontrolü ve personel yetkileri, başarısız giriş limiti, güvenilir proxy doğrulaması, HTTPS zorunluluğu, tarayıcı kaynak kontrolleri ve özel dosyaların paket dışında kalması kontrol edildi. Bu çalışma tam kapsamlı sızma testi veya mutlak güvenlik garantisi değildir. MFA/iki aşamalı giriş henüz yoktur. Üretim HTTPS/proxy, barındırma hesabı ve FTP erişim güvenliği hosting üzerinde ayrıca doğrulanmalıdır.

Başvuru: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
