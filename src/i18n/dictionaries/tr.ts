
/**
 * Turkish: the source language. Text is verbatim from the original components;
 * the shape of this object defines the Dictionary type for every locale.
 */
export const tr = {
  meta: {
    title: "LUMIXON | Uygulamalı Yapay Zekâ ve Derin Teknoloji",
    description:
      "LUMIXON; robotik ve otonom sistemler, sağlıkta dijital patoloji ve su altı SONAR algılama alanlarında karmaşık gerçek dünya problemlerini mühendislik çözümlerine dönüştüren uygulamalı yapay zekâ ve derin teknoloji şirketidir.",
    keywords: [
      "uygulamalı yapay zekâ",
      "derin teknoloji",
      "robotik yapay zekâ",
      "otonom sistemler",
      "SLAM",
      "sağlıkta yapay zekâ",
      "dijital patoloji",
      "sonar",
      "dalgıç tespiti",
      "su altı anomali tespiti",
      "LUMIXON",
    ],
    ogEyebrow: "APPLIED AI & DEEP TECHNOLOGY",
    ogTagline: "Karmaşık gerçek dünya problemleri için mühendislik odaklı yapay zekâ.",
    knowsAbout: [
      "Robotik ve Otonom Sistemler için Yapay Zekâ",
      "Sağlıkta Yapay Zekâ: Dijital Patoloji",
      "SONAR: Su Altı Tespit ve Anomali Algılama",
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
    lede: "Robotik ve otonom sistemlerde, dijital patolojide ve su altı akustiğinde; algıdan karara uzanan sistemleri sahada çalışacak biçimde tasarlıyor, geliştiriyor ve devreye alıyoruz.",
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
    lede: "Üç alanda derinleşiyoruz: robotik ve otonom sistemler, sağlıkta dijital patoloji ve su altı SONAR algılama. Her projede veriyi, modeli ve çalışacağı ortamı birlikte tasarlıyor; prototipte kalmayan, üretimde çalışan sistemler kuruyoruz.",
    systemsHeading: "Geliştirdiğimiz sistemler",
    methodsAria: "Yöntemler ve teknolojiler",
    /** Prefix for photo credits: "{prefix} {author} / {source}". */
    photoCredit: "Foto:",
    /** Caption of the small wireframe inset inside the robotics animation (the robot's digital twin). */
    twinInset: "Dijital ikiz · Simülasyon",
  },

  /**
   * The three capability rows, in page order. `scene` captions the large
   * animation beside each row: `label` + `detail` are visible HUD lines,
   * `alt` is the text alternative of the (decorative) canvas.
   */
  items: {
    "robotik-otonom": {
      title: "Robotik ve Otonom Sistemler için Yapay Zekâ",
      subtitle: "AI for Robotics & Autonomous Systems",
      summary:
        "Algılama, konumlandırma, planlama ve kontrol katmanlarını tek bir otonomi yığınında birleştiriyoruz. Dört ayaklı robotlardan drone'lara, manipülatörlerden insansız kara araçlarına kadar, belirsiz ve değişken ortamlarda güvenle karar veren sistemler geliştiriyoruz. Drone ile yer robotunun aynı haritayı birlikte çıkardığı çok robotlu SLAM ile GPS'in ulaşmadığı alanlarda da konumlandırma ve haritalama sağlıyoruz. Simülasyonda doğrulanan davranışları kontrollü adımlarla gerçek donanıma aktarıyoruz.",
      applications: [
        "LiDAR ve kamera verisiyle eşzamanlı haritalama ve konumlandırma yapan otonom navigasyon yazılımları",
        "Drone ve yer robotunun havadan ve yerden taradığı veriyi tek bir haritada birleştiren çok robotlu SLAM sistemleri",
        "Görüntü tabanlı nesne tanımayla çalışan al-yerleştir ve montaj manipülatörleri",
        "Depo, tesis ve saha içinde engelden kaçınan rota ve hareket planlama modülleri",
        "Simülasyonda eğitilip gerçek donanıma aktarılan pekiştirmeli öğrenme tabanlı kontrol politikaları",
      ],
      methods: ["SLAM", "Çok robotlu SLAM", "ROS 2", "Ters kinematik", "Model öngörülü kontrol (MPC)", "Sim-to-real"],
      imageAlt: "Üretim hattında kalıplanmış bir parçayı taşıyan mavi endüstriyel robot kol ve otomasyon istasyonu",
      scene: {
        label: "Drone ve yer robotu",
        detail: "Çok robotlu SLAM · LiDAR · Sensör füzyonu",
        alt: "Dört ayaklı bir robot engebeli arazide yürürken üzerinde bir drone uçuyor; ikisinin LiDAR taramaları çevrenin nokta bulutu haritasını birlikte oluşturuyor. Köşedeki küçük pencerede aynı robotun tel kafes dijital ikizi simülasyon ızgarasında yürüyor.",
      },
    },
    "saglik-dijital-patoloji": {
      title: "Sağlıkta Yapay Zekâ: Dijital Patoloji",
      subtitle: "AI in Healthcare — Digital Pathology",
      summary:
        "Tüm slayt görüntülerini gigapiksel ölçeğinde işleyen modeller geliştiriyoruz. Doku bölgelerini ayırıyor, hücreleri tespit edip sınıflandırıyor ve şüpheli alanları patoloğun önüne önceliklendirilmiş biçimde getiriyoruz. Sistemleri tanı koymak için değil, patoloğun kararını destekleyecek ve her çıktısı görüntü üzerinde doğrulanabilecek biçimde tasarlıyoruz.",
      applications: [
        "Tüm slayt görüntülerinde tümör ve doku bölgelerini ayıran segmentasyon modelleri",
        "Çekirdek tespiti, hücre sınıflandırma ve mitoz sayımı yapan nicel analiz araçları",
        "İmmünohistokimya boyamalarında biyobelirteç skorlamasını standartlaştıran yazılımlar",
        "Şüpheli bölgeleri ısı haritasıyla işaretleyip vakaları önceliklendiren karar destek akışları",
      ],
      methods: ["Tüm slayt görüntüleme (WSI)", "Çoklu örnek öğrenme (MIL)", "Boya normalizasyonu", "Görü dönüştürücüleri (ViT)", "DICOM · OpenSlide"],
      imageAlt: "Pembe ve mor tonlarında boyanmış, hücre çekirdekleri tek tek seçilen bir doku kesitinin mikroskop görüntüsü",
      scene: {
        label: "Tüm slayt analizi",
        detail: "Segmentasyon · Hücre tespiti · Isı haritası",
        alt: "Bir doku kesiti lamı üzerinde tarama başlığı ilerliyor; hücre çekirdekleri tespit edilip işaretleniyor, şüpheli bölge ısı haritasıyla vurgulanıyor.",
      },
    },
    sonar: {
      title: "SONAR: Su Altı Tespit ve Anomali Algılama",
      subtitle: "SONAR — Underwater Detection & Anomaly Recognition",
      summary:
        "Aktif ve pasif sonar verisini, su altındaki hareketi görünür kılan algılama sistemlerine dönüştürüyoruz. Yankı, çoklu yol ve ortam gürültüsü arasından dalgıçları, insansız su altı araçlarını ve olağan dışı nesneleri ayırıyor; tespitleri ize dönüştürüp sınıflandırıyoruz. Liman, kıyı tesisi ve su altı altyapısının kesintisiz izlenmesi için gerçek zamanlı çalışan işleme hatları kuruyoruz.",
      applications: [
        "Liman ve kıyı tesisleri için dalgıç tespit ve takip sistemleri",
        "Yan taramalı ve çok ışınlı sonar görüntülerinde nesne ve anomali tespiti",
        "Pasif akustik verisinde gemi, araç ve deniz canlısı imzalarının sınıflandırılması",
        "Boru hattı, kablo ve deniz tabanı yapılarında değişim ve hasar izleme",
      ],
      methods: ["Hüzmeleme (beamforming)", "Eşlenmiş filtre", "CFAR tespiti", "Spektrogram tabanlı derin öğrenme", "Çoklu hedef takibi"],
      imageAlt: "Mavi suda aşağıdan görülen bir tüplü dalgıcın silueti; sağda koyu bir kaya kütlesi ve yükselen hava kabarcıkları",
      scene: {
        label: "Dalgıç tespiti",
        detail: "Aktif sonar · Anomali tespiti · İz takibi",
        alt: "Deniz tabanındaki bir sonar başlığı su sütununu tarıyor; yaklaşan bir dalgıç yankı olarak yakalanıyor, anomali olarak işaretlenip iz takibine alınıyor.",
      },
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
