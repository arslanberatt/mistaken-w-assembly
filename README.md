# Ders Akışı — yerel deneme (Next.js)

Bu deneme, bilgisayardan gelen karşı taraf sesini ve mikrofonunu ayrı ayrı, canlı olarak işler. Karşı taraftaki kişiler `Konuşmacı A`, `Konuşmacı B`, `Konuşmacı C` şeklinde ayrılır; sen ayrı `Ben` olarak görünürsün. Her akışta dolgu sesleri, tekrarlar, yanlış söylenmiş kelimeler ve takılmalar korunmaya çalışılır.

## İlk kurulum
1. Ücretsiz [BlackHole 2ch](https://existential.audio/blackhole/) sürümünü kur.
2. `Audio MIDI Setup` uygulamasını aç. Sol alttaki `+` → `Create Multi-Output Device` seç.
3. Oluşan cihazda kulaklığını/hoparlörünü ve `BlackHole 2ch`yi işaretle. BlackHole için `Drift Correction`ı aç.
4. Mac'in ses çıkışı olarak bu yeni `Multi-Output Device`ı seç.
5. AssemblyAI'da bir API anahtarı oluştur.
6. `run.command` dosyasına çift tıkla. Terminal anahtarını ister; yapıştırıp Enter'a bas.
7. Tarayıcıda `http://localhost:4173` adresini aç. `Cihazları bul`a bas, karşı taraf için `BlackHole 2ch`, senin tarafında mikrofonunu seç. Karşı tarafta beklediğin kişi sayısını seçip `Dersi başlat`a bas.
8. Ders sonunda `Transkripti kopyala` ham Markdown transkripti panoya alır (her satır `**12:30 — Ben:** metin` biçiminde).
8a. Akış kesilirse `Transkript aktar (.md / .txt)` ile Obsidian Markdown transkriptini veya metin dökümünü geri yükleyebilirsin. Konuşmacılar ve saatler korunur; aktarılan ders Sonnet analizi için kullanılabilir.
9. Ders türünde `Mentor / öğretmen` seçersen `Ders koçu agent’ını kopyala` yalnızca senin hatalarını ve ilerlemeni güncelleyen komutu oluşturur. `Arkadaş` seçeneğinde arkadaşının adını yaz; agent onun raporunu `Friends/isim` altında ayrı tutar ve senin `English Progress.md` dosyana karıştırmaz.
10. Mac sürümünde `Claude Sonnet 5` kartı hesap durumunu gösterir. Bağlı değilse `Bağlan` düğmesi Claude giriş sayfasını tarayıcıda açar; Terminal'de ayrıca `claude auth login` çalıştırman gerekmez. Bağlıyken `Çıkış yap` görünür; onay verirsen bilgisayardaki Claude CLI oturumu da kapanır. Şifren uygulamadan geçmez. Claude CLI bilgisayarda kurulu olmalıdır.
11. Ders bittiğinde transkript otomatik olarak `Lessons/` altına kaydedilir. `İçgörüler` görünümünde Obsidian’dan bir tarih seçip o günün tüm derslerini saat ve konuşmacı etiketleriyle inceleyebilirsin.
12. `Sonnet 5 ile dersi analiz et` düğmesi yeni ders veya seçili arşiv gününü analiz eder. Göndermeden önce yalnızca kendi sözlerini ya da tüm konuşmayı seçersin. Seçtiğin konuşma ile `English Progress.md`, `Error Library.md` ve `Vocabulary.md` Anthropic’e gönderilir. Analiz sonucu otomatik olarak `Reports/YYYY-MM/` içine yazılır; English Progress ve Error Library güncellenir.
13. Sonnet raporu en sık hataları sırayla listeler; ham ifadenle düzeltmeyi yan yana gösterir ve çalışma odağı önerir. Kelimeler sekmesinden kendi kelimelerini ekleyebilir, AI önerilerini kelime kasana kaydedebilirsin. Claude CLI gerçek USD maliyet bildirirse uygulama analiz ve toplam maliyeti gösterir; Pro kullanımında CLI $0 veya maliyet bildirmeyebilir. Bu gösterge Anthropic fatura dökümünün yerine geçmez.

Anahtarlar hiçbir dosyaya yazılmaz; yalnızca açık Terminal oturumunda kalır. Uygulama açıkken Terminal penceresini kapatma.

## Teknik not

Uygulama artık Next.js üzerinde çalışıyor (App Router + Route Handler'lar); davranış ve arayüz birebir aynı. `run.command` ilk çalıştırmada `node_modules` yoksa otomatik `npm install` yapar, sonra `npm run dev` ile `http://localhost:4173` adresinde başlatır. Elle çalıştırmak istersen: `npm install` (bir kere), sonra `npm run dev` (geliştirme) veya `npm run build && npm start` (üretim modu).

## Windows

`windows` klasörü tek başına çalışan ayrı uygulamadır; sadece bu klasörü Windows bilgisayara kopyalaman yeterli.

1. Node.js yoksa bir kez kur: `winget install OpenJS.NodeJS.LTS`
2. `baslat.bat` dosyasına çift tıkla — ya da klasörde terminal açıp tek komut: `node ders-akisi.mjs`
3. AssemblyAI anahtarını yapıştırıp Enter'a bas; tarayıcı (Chrome/Edge) kendiliğinden açılır.
4. Karşı taraf için `Sistem sesi (ekran paylaşımıyla)` seç. `Dersi başlat`a basınca açılan pencerede **Tüm ekran** → **Sistem sesini de paylaş** işaretle. BlackHole gerekmez; istersen VB-Cable veya Stereo Mix de seçilebilir.

Kasa yolu varsayılan olarak `%USERPROFILE%\english`; değiştirmek için `set OBSIDIAN_VAULT_PATH=D:\Obsidian\english` sonra `node ders-akisi.mjs`.
`public/index.html` değişirse Windows dosyasını yenilemek için: `node build-windows.mjs`

Claude CLI ile içgörü üretme düğmesi şu an Mac sürümünde kullanılabilir; Windows paketinde pasiftir.

## Sorun giderme

- Karşı taraf boşsa Mac ses çıkışının gerçekten Multi-Output Device olduğundan ve uygulamada `BlackHole 2ch` seçildiğinden emin ol.
- Ses duymuyorsan Multi-Output Device içinde hem fiziksel kulaklık/hoparlörün hem de BlackHole seçili olmalı.
- Mikrofon tarafında karşı tarafın sesi tekrar görünüyorsa kulaklık kullan.
- Hem karşı taraf hem sen konuşurken canlı baloncukta görünür; kısa bir duraklamada mesaj olarak sabitlenir. Konuşmacı A/B/C etiketleri ilk bir iki turda değişebilir, sonra daha stabil olur.

Ses kaydı veya transkript almadan önce öğretmeninden izin al ve kullandığın platformun kurallarını kontrol et.
