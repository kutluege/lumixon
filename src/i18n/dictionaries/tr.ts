import { plural } from "../format";

/**
 * Turkish: the source language. Text is verbatim from the original components;
 * the shape of this object defines the Dictionary type for every locale.
 */
export const tr = {
  meta: {
    title: "LUMIXON | Uygulamalı Yapay Zekâ ve Derin Teknoloji",
    description:
      "LUMIXON; robotik, otonom sistemler, endüstriyel yapay zekâ, uzaktan algılama, kurumsal zekâ ve üretken görsel hesaplama alanlarında karmaşık gerçek dünya problemlerini mühendislik çözümlerine dönüştüren uygulamalı yapay zekâ ve derin teknoloji şirketidir.",
    keywords: [
      "uygulamalı yapay zekâ",
      "derin teknoloji",
      "robotik yapay zekâ",
      "otonom sistemler",
      "kestirimci bakım",
      "sensör füzyonu",
      "uzaktan algılama",
      "dijital ikiz",
      "doküman zekâsı",
      "ajan tabanlı yapay zekâ",
      "LUMIXON",
    ],
    ogEyebrow: "APPLIED AI & DEEP TECHNOLOGY",
    ogTagline: "Karmaşık gerçek dünya problemleri için mühendislik odaklı yapay zekâ.",
    knowsAbout: [
      "Robotik ve Otonom Sistemler için Yapay Zekâ",
      "Kestirimci Bakım",
      "Sinyal İşleme ve Sensör Füzyonu",
      "Coğrafi Yapay Zekâ ve Uzaktan Algılama",
      "Dijital İkiz ve Simülasyon",
      "Zaman Serisi Tahmini ve Anomali Tespiti",
      "Lojistik ve Tedarik Zinciri Yapay Zekâsı",
      "SLAM: Eş Zamanlı Konumlandırma ve Haritalama",
      "Doküman Zekâsı",
      "Ajan Tabanlı Yapay Zekâ",
      "Yapay Zekâ ile Video Üretimi",
      "3D Render, CGI ve Animasyon",
    ],
  },

  common: {
    skipToContent: "İçeriğe geç",
    opensInNewTab: " (yeni sekmede açılır)",
    location: "İstanbul, Türkiye",
    whatsappGreeting: "Merhaba LUMIXON, teknik bir ihtiyacımızı görüşmek istiyoruz.",
    /** Brand descriptor line (hero eyebrow, footer). "LUMIXON Applied AI" itself is never translated. */
    descriptor: "Uygulamalı Yapay Zekâ & Derin Teknoloji",
  },

  nav: {
    sections: { capabilities: "Yetenekler", approach: "Yaklaşım", contact: "İletişim" },
    mainAria: "Ana menü",
    mobileAria: "Mobil menü",
    dialogAria: "Site menüsü",
    cta: "İletişime geçin",
    menuOpen: "Menüyü aç",
    menuClose: "Menüyü kapat",
    whatsappTerm: "WhatsApp",
    whatsappLink: "Şirkete yazın",
    locationTerm: "Konum",
    languageAria: "Dil seçimi",
  },

  hero: {
    /** Two unbreakable halves so narrow screens wrap between them. */
    eyebrowA: "Uygulamalı Yapay Zekâ &",
    eyebrowB: "Derin Teknoloji",
    headlineA: "Karmaşık gerçek dünya problemlerini",
    headlineB: "akıllı mühendislik çözümlerine dönüştürüyoruz.",
    lede: "Robotik, otonom sistemler, uzaktan algılama ve endüstriyel yapay zekâda; algıdan karara uzanan sistemleri sahada çalışacak biçimde tasarlıyor, geliştiriyor ve devreye alıyoruz.",
    ctaPrimary: "Teknik zorluğunuzu konuşalım",
    ctaSecondary: "Yetenekleri inceleyin",
    scroll: "Kaydır",
  },

  hud: {
    pipeline: ["Algı", "Karar", "Kontrol"],
    /** Direction glyph between pipeline stages (mirrored for RTL). */
    flowArrow: "→",
    sensors: "Sensör füzyonu · LiDAR · EO/IR",
    elevation: "EL",
    task: "Görev",
    taskValue: "Taklit öğrenmesi · Gösterim → Politika",
    position: "Konum",
    north: "K",
    east: "D",
    lidar: "LiDAR",
    lidarValue: "10 Hz · 905 nm",
    session: "Oturum",
  },

  capabilities: {
    label: "Yetenekler",
    title: "Sahada çalışan yapay zekâ.",
    lede: "On iki uzmanlık alanını üç disiplin altında topluyoruz: fiziksel sistemler, kurumsal bilgi ve görsel üretim. Her projede veriyi, modeli ve çalışacağı ortamı birlikte tasarlıyor; prototipte kalmayan, üretimde çalışan sistemler kuruyoruz.",
    tablistAria: "Yetenek alanları",
    fieldCount: plural({ other: "{n} alan" }),
    inspect: "İncele",
    close: "Kapat",
    applicationCount: plural({ other: "{n} uygulama" }),
    methodsAria: "Yöntemler ve teknolojiler",
    systemsHeading: "Geliştirdiğimiz sistemler",
    /** Prefix for photo credits: "{prefix} {author} / {source}". */
    photoCredit: "Foto:",
    /** "Research → field" band under the header: the same robot as a digital twin, then in the field. */
    flank: {
      research: { label: "Araştırma", detail: "Dijital ikiz · Simülasyon · Politika eğitimi" },
      field: { label: "Saha", detail: "SLAM · LiDAR · Sensör füzyonu" },
      bridge: "Simülasyondan sahaya",
      /** Text alternative for the two decorative animations. */
      alt: "Aynı dört ayaklı robot iki aşamada. Araştırma: tel kafes dijital ikizi simülasyon ızgarasında yürüyor, eğitim yörüngeleri çiziliyor. Saha: gerçek robot engebeli arazide yürüyor, LiDAR taraması nokta bulutu haritasını oluşturuyor.",
    },
  },

  categories: {
    fiziksel: {
      title: "Fiziksel ve Endüstriyel Yapay Zekâ",
      shortTitle: "Fiziksel ve Endüstriyel",
      subtitle: "Physical & Industrial AI",
    },
    kurumsal: {
      title: "Kurumsal Zekâ",
      shortTitle: "Kurumsal Zekâ",
      subtitle: "Enterprise Intelligence",
    },
    "uretken-medya": {
      title: "Üretken Medya ve Görsel Oluşturma",
      shortTitle: "Üretken Medya",
      subtitle: "Generative Media & Visual Creation",
    },
  },

  items: {
    "robotik-otonom": {
      title: "Robotik ve Otonom Sistemler için Yapay Zekâ",
      subtitle: "AI for Robotics & Autonomous Systems",
      summary:
        "Algılama, konumlandırma, planlama ve kontrol katmanlarını tek bir otonomi yığınında birleştiriyoruz. Mobil robotlardan manipülatörlere ve insansız araçlara kadar, belirsiz ve değişken ortamlarda güvenle karar veren sistemler geliştiriyoruz. Simülasyonda doğrulanan davranışları kontrollü adımlarla gerçek donanıma aktarıyoruz.",
      applications: [
        "LiDAR ve kamera verisiyle eşzamanlı haritalama ve konumlandırma yapan otonom navigasyon yazılımları",
        "Görüntü tabanlı nesne tanımayla çalışan al-yerleştir ve montaj manipülatörleri",
        "Depo, tesis ve saha içinde engelden kaçınan rota ve hareket planlama modülleri",
        "Simülasyonda eğitilip gerçek donanıma aktarılan pekiştirmeli öğrenme tabanlı kontrol politikaları",
      ],
      methods: ["SLAM", "ROS 2", "Ters kinematik", "Model öngörülü kontrol (MPC)", "Sim-to-real"],
      visualLabel: "Kinematik zincir · ters kinematik",
      imageAlt: "Üretim hattında kalıplanmış bir parçayı taşıyan mavi endüstriyel robot kol ve otomasyon istasyonu",
    },
    "kestirimci-bakim": {
      title: "Kestirimci Bakım ve Endüstriyel Yapay Zekâ",
      subtitle: "Predictive Maintenance & Industrial AI",
      summary:
        "Titreşim, akım, sıcaklık ve proses verisinden ekipmanın sağlık durumunu sürekli olarak çıkarıyoruz. Arızayı oluşmadan önce işaret eden modeller, plansız duruşların önüne geçmeyi ve bakımı takvime göre değil gerçek duruma göre planlamayı mümkün kılar. Sistemleri mevcut SCADA ve MES altyapısıyla entegre çalışacak şekilde kuruyoruz.",
      applications: [
        "Titreşim ve akım verisinden arıza öncesi uyarı üreten durum izleme sistemleri",
        "Rulman, dişli ve motor arızaları için frekans alanında hata sınıflandırma",
        "Ekipman bazında kalan faydalı ömür tahmini ve bakım önceliklendirme",
        "Üretim hattında görüntü işleme tabanlı kalite kontrol ve yüzey hatası tespiti",
      ],
      methods: ["FFT ve zarf analizi", "Kalan faydalı ömür (RUL)", "OPC UA · MQTT", "Uçta çıkarım"],
      visualLabel: "Titreşim spektrumu · rulman hata frekansı",
      imageAlt: "Bir tesiste paslanmaz çelik boru hatları, vanalar ve elektrik motorlu pompalar",
    },
    "sinyal-sensor-fuzyonu": {
      title: "Sinyal İşleme ve Sensör Füzyonu",
      subtitle: "Signal Processing & Sensor Fusion",
      summary:
        "Tek bir sensörün göremediğini birden fazla sensörün ortak kestirimiyle görünür kılıyoruz. IMU, GNSS, radar, LiDAR, akustik ve kamera verisini zaman senkronizasyonu ve belirsizlik modellemesiyle birleştiriyor; gürültüye ve sensör kaybına dayanıklı tek bir durum kestirimi üretiyoruz.",
      applications: [
        "IMU, GNSS ve odometri verisini birleştiren hassas konum ve yönelim kestirimi",
        "Radar ve kamera füzyonuyla hedef tespiti ve çoklu hedef takibi",
        "Akustik ve titreşim sinyallerinde gürültü bastırma ve olay tespiti",
        "Gömülü işlemciler ve FPGA için gerçek zamanlı sinyal işleme hatları",
      ],
      methods: ["Kalman filtresi (EKF/UKF)", "Parçacık filtresi", "Dalgacık dönüşümü", "PTP zaman senkronizasyonu"],
      visualLabel: "Çoklu sensör → tek durum kestirimi",
      imageAlt: "Otonom bir aracın tavanına monte edilmiş, dönerken çekilmiş 64 ışınlı LIDAR sensörü",
    },
    "cografi-uzaktan-algilama": {
      title: "Coğrafi Yapay Zekâ ve Uzaktan Algılama",
      subtitle: "Geospatial AI & Remote Sensing",
      summary:
        "Uydu, hava ve drone görüntülerini ölçülebilir mekânsal bilgiye dönüştürüyoruz. Optik, multispektral ve SAR verisi üzerinde çalışan modellerle değişimi tespit ediyor, varlıkları sınıflandırıyor ve geniş alanları manuel incelemenin yetişemeyeceği sıklıkta izliyoruz.",
      applications: [
        "Uydu ve drone görüntüsünde bina, araç ve altyapı varlıklarının tespiti ve sınıflandırılması",
        "Çok zamanlı görüntü serilerinde değişim tespiti ve alan izleme",
        "Multispektral veriyle bitki sağlığı ve arazi kullanımı analizi",
        "Bulut örtüsünden ve gün ışığından bağımsız SAR tabanlı izleme hatları",
      ],
      methods: ["SAR / multispektral görüntü", "Semantik segmentasyon", "Değişim tespiti", "GeoTIFF · STAC"],
      visualLabel: "Eş yükselti · karo ızgarası · tespit",
      imageAlt: "Avustralya kuzeybatı kıyısının uydudan görüntüsü: sığ turkuaz sular, adalar ve koyu mavi okyanus",
    },
    "dijital-ikiz": {
      title: "Dijital İkiz ve Simülasyon Yapay Zekâsı",
      subtitle: "Digital Twin & Simulation AI",
      summary:
        "Fiziksel varlıkların ve süreçlerin canlı veriyle beslenen sanal karşılıklarını kuruyoruz. Fizik tabanlı modelleri veriden öğrenen vekil modellerle birleştirerek senaryoları sahaya dokunmadan test etmeyi, ekipmanı ve süreci gerçek zamana yakın biçimde optimize etmeyi sağlıyoruz.",
      applications: [
        "Sensör verisiyle senkron çalışan tesis, hat ve ekipman dijital ikizleri",
        "Yüksek maliyetli CFD ve FEM analizlerini hızlandıran vekil modeller",
        "Kapasite, yerleşim ve çizelgeleme kararları için senaryo simülasyonu",
        "Robotik ve algılama modellerinin eğitimi için fiziksel olarak tutarlı sentetik veri",
      ],
      methods: ["Fizik bilgili sinir ağları (PINN)", "Vekil modelleme", "Ayrık olay simülasyonu", "OpenUSD"],
      visualLabel: "Fiziksel varlık ↔ dijital ikiz",
      imageAlt: "Alacakaranlıkta ışıklandırılmış rafineri kuleleri, boru hatları ve depolama tankı",
    },
    "zaman-serisi-anomali": {
      title: "Zaman Serisi Tahmini ve Anomali Tespiti",
      subtitle: "Time-Series Forecasting & Anomaly Detection",
      summary:
        "Talep, enerji tüketimi, üretim ve sensör ölçümleri gibi zamana bağlı verilerde geleceği belirsizlik aralığıyla birlikte tahmin ediyoruz. Beklenen davranıştan sapmaları erken yakalayan anomali modelleri, operasyon ekiplerine yorumlanabilir ve önceliklendirilmiş uyarılar sunar.",
      applications: [
        "Güven aralığıyla birlikte talep, yük ve tüketim tahmini üreten modeller",
        "Çok değişkenli sensör akışlarında gerçek zamanlı anomali tespiti",
        "Operasyonel ve finansal işlem verisinde olağan dışı örüntülerin yakalanması",
        "Mevsimsellik, tatil etkisi ve dışsal değişkenleri modelleyen planlama altyapısı",
      ],
      methods: ["Olasılıksal tahmin", "Temporal Fusion Transformer", "Otokodlayıcı tabanlı anomali", "Değişim noktası tespiti"],
      visualLabel: "Tahmin bandı · anomali işareti",
      imageAlt: "Koyu ekranda, zamanla sönümlenen beyaz bir ses dalga formu ve sinyal işleme parametreleri",
    },
    "lojistik-tedarik": {
      title: "Lojistik ve Tedarik Zinciri için Yapay Zekâ",
      subtitle: "AI for Logistics & Supply Chain",
      summary:
        "Talep tahminini, stok politikasını ve rota planlamayı birbirinden kopuk kararlar olarak değil, tek bir optimizasyon problemi olarak ele alıyoruz. Makine öğrenmesini matematiksel optimizasyonla birleştirerek kısıtları gerçekçi biçimde modelleyen ve değişen koşullara hızla uyum sağlayan planlama sistemleri kuruyoruz.",
      applications: [
        "Zaman pencereli ve kapasite kısıtlı araç rotalama optimizasyonu",
        "Depo ve bölge bazında talep tahminiyle beslenen stok optimizasyonu",
        "Tedarik ağında gecikme ve kesinti risklerinin erken tespiti",
        "Depo içi toplama, yerleşim ve iş gücü planlama modelleri",
      ],
      methods: ["Araç rotalama (VRP)", "Karma tamsayılı programlama", "Graf sinir ağları", "Stokastik optimizasyon"],
      visualLabel: "Rota ağı · kesintiye göre yeniden planlama",
      imageAlt: "Akşam saatlerinde istiflenmiş konteynerler ve rıhtım vinçleriyle yoğun bir konteyner limanı",
    },
    "slam-haritalama": {
      title: "SLAM: Eş Zamanlı Konumlandırma ve Haritalama",
      subtitle: "SLAM — Simultaneous Localization and Mapping",
      summary:
        "GPS sinyalinin ulaşmadığı maden, tünel, depo, kapalı tesis ve afet bölgelerinde drone, insansız kara aracı ve el tipi tarayıcıların ortamın 3D haritasını çıkarırken kendi konumunu da aynı anda kestirmesini sağlıyoruz. LiDAR, kamera ve IMU verisini sıkı bağlı biçimde birleştiriyor; döngü kapatma ve poz grafiği optimizasyonuyla birikmiş sapmayı düzelterek tutarlı, ölçülebilir haritalar üretiyoruz. Çıktıyı dijital ikiz, denetim ve otonom navigasyon için doğrudan kullanılabilir hâle getiriyoruz.",
      applications: [
        "Tünel, maden ve kapalı tesislerde GPS olmadan otonom uçuş ve haritalama yapan drone sistemleri",
        "Depo ve fabrika içinde konumunu sürekli kestiren insansız kara araçları ve mobil robotlar",
        "Yürüyerek taranan alanlardan nokta bulutu ve 3D model üreten el tipi tarayıcı yazılımları",
        "Tarama verisinden dijital ikiz, kat planı ve yapısal denetim raporu üreten işleme hatları",
      ],
      methods: [
        "LiDAR-inertial odometri",
        "Görsel SLAM (ORB-SLAM)",
        "Döngü kapatma",
        "Poz grafiği optimizasyonu",
        "Nokta bulutu kaydı (ICP/NDT)",
        "ROS 2",
      ],
      visualLabel: "LiDAR taraması · poz grafiği · döngü kapatma",
      imageAlt:
        "Mavi gökyüzünde alttan görülen endüstriyel quadcopter dron; gövdesinde üstte silindirik bir sensör, altta yakınlaştırmalı ve termal kamera modülü taşıyor",
    },
    "dokuman-zekasi": {
      title: "Doküman Zekâsı ve Kurumsal Yapay Zekâ",
      subtitle: "Document Intelligence & Enterprise AI",
      summary:
        "Sözleşme, fatura, teknik şartname ve yazışma gibi yapılandırılmamış belgeleri doğrulanabilir, yapılandırılmış veriye dönüştürüyoruz. Kurumsal bilgi tabanları üzerinde çalışan arama ve soru-cevap sistemleri, her yanıtı kaynak belgeye bağlayarak denetlenebilir kılar.",
      applications: [
        "Taranmış ve dijital belgelerden alan, tablo ve imza çıkaran işleme hatları",
        "Kaynak gösteren ve yetki seviyesine duyarlı kurumsal arama ve soru-cevap sistemleri",
        "Sözleşme ve şartnamelerde madde karşılaştırma, risk ve uyumluluk incelemesi",
        "Kurum içinde veya özel bulutta barındırılan, veriyi dışarı çıkarmayan dil modeli dağıtımları",
      ],
      methods: ["RAG", "OCR ve yerleşim analizi", "Hibrit vektör arama", "LoRA ince ayarı"],
      visualLabel: "Yerleşim analizi · alan çıkarımı",
      imageAlt:
        "Loş ışıkta bir masada açık dizüstü bilgisayar; çevresinde teknik çizim paftaları, kumpas, kurşun kalem ve çizimlerin üzerinde duran bir gözlük çerçevesi",
    },
    "ajan-otomasyon": {
      title: "Ajan Tabanlı Yapay Zekâ ve Akıllı Otomasyon",
      subtitle: "Agentic AI & Intelligent Automation",
      summary:
        "Dil modellerini yalnızca metin üreten değil; araç kullanan, plan yapan ve çok adımlı işleri yürüten ajanlara dönüştürüyoruz. Ajanları kurumsal sistemlere tanımlı yetkilerle bağlıyoruz; kritik adımlarda insan onayı, her eylemde kayıt ve geri alınabilirlik tasarımın parçasıdır.",
      applications: [
        "ERP, CRM ve talep yönetim sistemleriyle entegre çalışan çok adımlı süreç ajanları",
        "Gelen talepleri sınıflandıran, yönlendiren ve yanıt taslağı hazırlayan operasyon asistanları",
        "Birden fazla kaynaktan veri toplayıp analiz eden ve rapor hazırlayan araştırma ajanları",
        "İnsan onay noktaları, eylem kaydı ve değerlendirme setleriyle denetlenen otomasyon akışları",
      ],
      methods: ["LLM ajanları", "Araç çağırma", "Model Context Protocol (MCP)", "Değerlendirme (eval) hatları"],
      visualLabel: "Plan → araç çağrısı → doğrulama",
      imageAlt: "Karanlık bir veri merkezinde ağ kablolarıyla dolu sunucu kabinleri",
    },
    "video-uretimi": {
      title: "Yapay Zekâ ile Video Üretimi ve Ticari Prodüksiyon",
      subtitle: "AI Video Generation & Commercial Production",
      summary:
        "Reklam, ürün tanıtımı ve kurumsal iletişim için üretken video modellerini profesyonel post-prodüksiyon disipliniyle birleştiriyoruz. Senaryo ve storyboard aşamasından renk düzenleme ve teslimata kadar her adım kontrol edilebilir; karakter, ürün ve marka tutarlılığı kare kare korunur.",
      applications: [
        "Ürün lansmanı ve kampanyalar için üretken modellerle desteklenen reklam filmleri",
        "Storyboard'dan animatiğe hızlı ön görselleştirme ve konsept geliştirme",
        "Çok dilli seslendirme ve dudak senkronizasyonuyla içerik yerelleştirme",
        "Markaya özgü stil ve karakter tutarlılığı için ince ayarlanmış görüntü modelleri",
      ],
      methods: ["Difüzyon modelleri", "ControlNet koşullandırma", "LoRA stil eğitimi", "ACES renk yönetimi"],
      visualLabel: "Kare şeridi · anahtar kareler",
      imageAlt: "Işık rigleri, kamera vinci ve monitörlerle çalışan film ekibinin bulunduğu büyük bir stüdyo seti",
    },
    "3d-cgi-animasyon": {
      title: "3D Render, CGI ve Animasyon Prodüksiyonu",
      subtitle: "3D Rendering, CGI & Animation Production",
      summary:
        "Ürün görselleştirmeden teknik animasyona kadar fotogerçekçi 3D içerik üretiyoruz. Klasik modelleme ve fiziksel tabanlı render iş akışlarını NeRF ve Gaussian Splatting gibi nöral yeniden yapılandırma yöntemleriyle birleştirerek gerçek nesne ve mekânları dijital ortama yüksek doğrulukla taşıyoruz.",
      applications: [
        "Henüz üretilmemiş ürünler için fotogerçekçi render ve 360° etkileşimli görseller",
        "Makine, süreç ve sistem işleyişini anlatan teknik ve endüstriyel animasyonlar",
        "Fotoğraf ve videodan gerçek mekân ve nesnelerin 3D yeniden yapılandırılması",
        "Web ve gerçek zamanlı motorlar için optimize edilmiş 3D varlık üretimi",
      ],
      methods: ["Fiziksel tabanlı render (PBR)", "NeRF / Gaussian Splatting", "Fotogrametri", "glTF · OpenUSD"],
      visualLabel: "Tel kafes → gölgelendirilmiş yüzey",
      imageAlt: "Çift monitörlü iş istasyonunda 3B modelleme yazılımıyla çalışan bir tasarımcı, arkadan görünüm",
    },
  },

  /** In-graphic labels of the procedural SVG visuals (rendered LTR, mono). */
  visuals: {
    spectrum: { threshold: "ALARM EŞİĞİ", signal: "ivme · zaman", warning: "UYARI", maxFreq: "2 kHz" },
    fusion: {
      lanes: ["IMU · 200 Hz", "GNSS · 10 Hz", "ODOM · 50 Hz"],
      filterSub: "tahmin · güncelle",
      output: "x̂ · durum kestirimi",
    },
    geospatial: { building: "BİNA", vehicle: "ARAÇ", change: "DEĞİŞİM", north: "K", east: "D", scale: "500 m" },
    twin: { physical: "FİZİKSEL VARLIK", twin: "DİJİTAL İKİZ", sync: "senkron", rpmUnit: "dk⁻¹" },
    forecast: { history: "GEÇMİŞ", forecast: "TAHMİN · P10–P90", anomaly: "ANOMALİ" },
    network: { disruption: "KESİNTİ", depot: "DEPO", caption: "zaman pencereli VRP" },
    document: {
      header: "{ çıktı · json",
      fields: ["belge_no", "tarih", "taraflar", "tutar", "imza"],
      page: "s.1",
    },
    agentic: {
      task: "GÖREV ›",
      taskName: "tedarik riski raporu",
      step: "ADIM {n}/{total}",
      columns: ["ORKESTRATÖR", "ARAÇLAR · MCP", "KORUMA"],
      planner: "PLANLAYICI",
      validation: "DOĞRULAMA",
      checks: ["politika", "şema"],
      human: "İNSAN ONAYI",
      humanApproved: "onaylandı ✓",
      humanPending: "bekliyor…",
      humanIdle: "beklemede",
      output: "ÇIKTI",
      reportFile: "rapor.pdf",
      audit: "denetim kaydı ✓",
      retryNote: "↺ yeniden dene · maks 3",
      toolDoc: "DOKÜMAN",
      toolMail: "E-POSTA",
      metrics: ["süre", "token", "araç", "deneme"],
      status: {
        planning: "PLANLAMA",
        toolCall: "ARAÇ ÇAĞRISI",
        result: "SONUÇ",
        failed: "BAŞARISIZ",
        retry: "YENİDEN DENE",
        passed: "GEÇTİ",
        awaiting: "ONAY BEKLİYOR",
        done: "TAMAMLANDI",
        idle: "BEKLEMEDE",
      },
      log: [
        "› plan: 3 adım · rag → sql → doğrula",
        "› çağrı: rag.search(k=8) · sql.query",
        "› sonuç: rag ✓ 96ms · sql ✓ 182ms",
        "› doğrulama: şema ✕ eksik: tedarikçi_id",
        "› yeniden dene 2/3 · plan revize edildi",
        "› çağrı: api.get(/stok) · doc.parse",
        "› sonuç: api ✓ 240ms · doc ✓ 131ms",
        "› doğrulama: geçti · politika ✓ şema ✓",
        "› insan onayı: talep gönderildi",
        "› onaylandı · rapor.pdf yayımlandı",
        "› görev kapandı · sonraki kuyrukta",
      ],
    },
    timeline: { scene: "SAHNE", tracks: ["V1", "SHT", "KF", "EĞR"], caption: "24 fps · ACES" },
    mesh: { wireframe: "TEL KAFES", stats: "80 yüz · 42 köşe" },
    slam: {
      heading: "POZ KESTİRİMİ · LIDAR-IMU",
      keyframe: "KF",
      points: "NOKTA",
      drift: "SAPMA",
      unit: "m",
      status: ["TARAMA · HARİTA GENİŞLİYOR", "DÖNGÜ ADAYI · ICP EŞLEŞMESİ", "POZ GRAFİĞİ OPTİMİZASYONU", "DÖNGÜ KAPATILDI ✓"],
    },
  },

  approach: {
    label: "Yaklaşım",
    title: "Araştırmadan sahaya, mühendislik disipliniyle.",
    lede: "LUMIXON akademik derinliği, ileri yapay zekâ araştırmasını ve sahada çalışan mühendisliği tek bir disiplinde birleştirir. Her proje ölçülebilir bir problem tanımıyla başlar, izlenebilir bir sistemle sürer.",
    principle: "İlke",
    /** Manifesto: [lead (bright)] [body] [accent (ice)]. */
    manifestoLead: "Yapay zekâ bir gösteri değil, bir mühendislik disiplinidir.",
    manifestoBody: "Modeli kurmak işin başlangıcıdır; asıl iş, onu gerçek veride, gerçek koşullarda ve uzun süre",
    manifestoAccent: "güvenilir biçimde çalıştırmaktır.",
    pillars: [
      {
        title: "Akademik derinlik",
        tag: "Academic depth",
        body: "Yöntem seçimini literatüre, matematiksel temele ve deney tasarımına dayandırırız. Bir yaklaşımın neden çalıştığını ve hangi koşullarda bozulduğunu bilmeden onu üretime taşımayız.",
      },
      {
        title: "Araştırma odaklı geliştirme",
        tag: "Research-driven development",
        body: "Her problemi önce bir hipotez olarak ele alır, rakip yaklaşımları aynı veri ve aynı metriklerle karşılaştırırız. Kararlarımızı sezgiye değil, tekrarlanabilir deney sonuçlarına bağlarız.",
      },
      {
        title: "Sahada çalışan mühendislik",
        tag: "Field-grade engineering",
        body: "Gecikme, donanım kısıtları, veri kayması ve bakım maliyeti ilk günden tasarımın parçasıdır. Teslim ettiğimiz sistemler izlenebilir, test edilebilir ve ekiplerin devralabileceği biçimde belgelenir.",
      },
    ],
    closing: "Her iş birliği, birlikte tanımladığımız ölçülebilir bir problemle başlar.",
    cta: "Problemi birlikte tanımlayalım",
  },

  contact: {
    label: "İletişim",
    title: "Şirketle doğrudan iletişime geçin.",
    lede: "Sahada, üretim hattında ya da veri altyapınızda çözülmesi gereken somut bir teknik zorluk varsa bize yazın. Problemi birlikte tanımlayalım ve uygulanabilir bir mühendislik yaklaşımını değerlendirelim.",
    cardAria: "WhatsApp üzerinden yazın (yeni sekmede açılır)",
    channel: "Kurumsal hat",
    headline: "WhatsApp üzerinden yazın",
    note: "Bağlantı, hazır bir karşılama mesajıyla WhatsApp'ı açar; mesajı dilediğiniz gibi düzenleyebilirsiniz.",
    start: "Sohbeti başlat",
    guideHeading: "İlk mesajınızda paylaşabilecekleriniz",
    guide: [
      { title: "Problem tanımı", body: "Çözmek istediğiniz problem ve ortaya çıktığı bağlam." },
      { title: "Veri ve altyapı", body: "Elinizdeki veri kaynakları, sensörler ve sistemler." },
      { title: "Hedeflenen sonuç", body: "Başarıyı tanımlayacak ölçütler, kısıtlar ve zaman planı." },
    ],
  },

  footer: {
    homeAria: "LUMIXON, sayfanın başına dön",
    navAria: "Alt menü",
    sectionsHeading: "Bölümler",
    contactHeading: "İletişim",
    whatsapp: "WhatsApp üzerinden yazın",
    rights: "Tüm hakları saklıdır.",
    backToTop: "Başa dön",
  },
};
