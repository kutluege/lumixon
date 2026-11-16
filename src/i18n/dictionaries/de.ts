import type { Dictionary } from "../types";

export const de: Dictionary = {
  meta: {
    title: "LUMIXON | Angewandte KI & Deep Tech",
    description:
      "LUMIXON ist ein Unternehmen für angewandte KI und Deep Tech, das komplexe reale Problemstellungen in Robotik und autonomen Systemen, digitaler Pathologie im Gesundheitswesen und Unterwasserdetektion mit SONAR in ingenieurtechnische Lösungen überführt.",
    keywords: [
      "angewandte KI",
      "Deep Tech",
      "KI für Robotik",
      "autonome Systeme",
      "SLAM",
      "KI im Gesundheitswesen",
      "digitale Pathologie",
      "Sonar",
      "Taucherdetektion",
      "Anomalieerkennung unter Wasser",
      "LUMIXON",
    ],
    ogEyebrow: "APPLIED AI & DEEP TECHNOLOGY",
    ogTagline: "Ingenieurgetriebene KI für komplexe reale Problemstellungen.",
    knowsAbout: [
      "KI für Robotik und autonome Systeme",
      "KI im Gesundheitswesen: Digitale Pathologie",
      "SONAR: Unterwasserdetektion und Anomalieerkennung",
    ],
  },

  common: {
    skipToContent: "Zum Inhalt springen",
    opensInNewTab: " (öffnet in neuem Tab)",
    location: "Istanbul, Türkei",
    whatsappGreeting: "Guten Tag LUMIXON, wir würden gern ein technisches Anliegen mit Ihnen besprechen.",
    descriptor: "Angewandte KI & Deep Tech",
  },

  nav: {
    sections: { capabilities: "Kompetenzen", approach: "Ansatz", contact: "Kontakt" },
    mainAria: "Hauptnavigation",
    mobileAria: "Mobile Navigation",
    dialogAria: "Seitenmenü",
    cta: "Kontakt aufnehmen",
    menuOpen: "Menü öffnen",
    menuClose: "Menü schließen",
    whatsappTerm: "WhatsApp",
    whatsappLink: "Schreiben Sie uns",
    locationTerm: "Standort",
    languageAria: "Sprache",
  },

  hero: {
    eyebrowA: "Angewandte KI &",
    eyebrowB: "Deep Tech",
    headlineA: "Wir verwandeln komplexe reale Probleme",
    headlineB: "in intelligente Engineering-Lösungen.",
    lede: "In Robotik und autonomen Systemen, digitaler Pathologie und Unterwasserakustik konzipieren, entwickeln und implementieren wir Systeme von der Wahrnehmung bis zur Entscheidung – ausgelegt für den Einsatz im Feld.",
    ctaPrimary: "Herausforderung besprechen",
    ctaSecondary: "Kompetenzen entdecken",
    scroll: "Scrollen",
  },

  hud: {
    pipeline: ["Wahrnehmung", "Entscheidung", "Steuerung"],
    flowArrow: "→",
    sensors: "Sensorfusion · LiDAR · EO/IR",
    elevation: "EL",
    task: "Aufgabe",
    taskValue: "Imitationslernen · Demonstration → Policy",
    position: "Position",
    north: "N",
    east: "O",
    lidar: "LiDAR",
    lidarValue: "10 Hz · 905 nm",
    session: "Sitzung",
  },

  capabilities: {
    label: "Kompetenzen",
    title: "KI, die im Feld funktioniert.",
    lede: "Wir gehen in drei Gebieten in die Tiefe: Robotik und autonome Systeme, digitale Pathologie im Gesundheitswesen und Unterwasserdetektion mit SONAR. In jedem Projekt gestalten wir Daten, Modell und Einsatzumgebung gemeinsam – und bauen Systeme, die nicht im Prototyp stecken bleiben, sondern im Produktivbetrieb laufen.",
    systemsHeading: "Systeme, die wir entwickeln",
    methodsAria: "Methoden und Technologien",
    photoCredit: "Foto:",
    twinInset: "Digitaler Zwilling · Simulation",
  },

  items: {
    "robotik-otonom": {
      title: "KI für Robotik und autonome Systeme",
      subtitle: "AI for Robotics & Autonomous Systems",
      summary:
        "Wir vereinen Wahrnehmung, Lokalisierung, Planung und Regelung in einem durchgängigen Autonomie-Stack. Von vierbeinigen Robotern bis zu Drohnen, von Manipulatoren bis zu unbemannten Bodenfahrzeugen entwickeln wir Systeme, die in unsicheren und veränderlichen Umgebungen sicher entscheiden. Mit Multi-Roboter-SLAM, bei dem Drohne und Bodenroboter gemeinsam dieselbe Karte aufbauen, ermöglichen wir Lokalisierung und Kartierung auch dort, wo kein GPS-Empfang besteht. In der Simulation validiertes Verhalten übertragen wir schrittweise und kontrolliert auf reale Hardware.",
      applications: [
        "Software für autonome Navigation mit simultaner Lokalisierung und Kartierung auf Basis von LiDAR- und Kameradaten",
        "Multi-Roboter-SLAM-Systeme, die die von einer Drohne aus der Luft und von einem Bodenroboter am Boden erfassten Daten in einer einzigen Karte zusammenführen",
        "Pick-and-Place- und Montagemanipulatoren mit bildbasierter Objekterkennung",
        "Module für Routen- und Bewegungsplanung mit Hindernisvermeidung in Lagern, Werken und im Gelände",
        "In der Simulation trainierte und auf reale Hardware übertragene Regelungsstrategien auf Basis von Reinforcement Learning",
      ],
      methods: ["SLAM", "Multi-Roboter-SLAM", "ROS 2", "Inverse Kinematik", "Modellprädiktive Regelung (MPC)", "Sim-to-Real"],
      imageAlt: "Blauer Industrieroboterarm, der an einer Automatisierungsstation in einer Fertigungslinie ein Formteil bewegt",
      scene: {
        label: "Drohne und Bodenroboter",
        detail: "Multi-Roboter-SLAM · LiDAR · Sensorfusion",
        alt: "Ein vierbeiniger Roboter läuft über unebenes Gelände, während über ihm eine Drohne fliegt; die LiDAR-Scans beider bauen gemeinsam eine Punktwolkenkarte der Umgebung auf. In einem kleinen Fenster in der Ecke läuft der digitale Zwilling desselben Roboters als Drahtgittermodell über ein Simulationsraster.",
      },
    },
    "saglik-dijital-patoloji": {
      title: "KI im Gesundheitswesen: Digitale Pathologie",
      subtitle: "AI in Healthcare — Digital Pathology",
      summary:
        "Wir entwickeln Modelle, die Whole-Slide-Images im Gigapixel-Maßstab verarbeiten. Wir grenzen Gewebebereiche ab, erkennen und klassifizieren Zellen und legen der Pathologin oder dem Pathologen verdächtige Areale priorisiert vor. Wir legen die Systeme nicht darauf aus, eine Diagnose zu stellen, sondern darauf, die Entscheidung der Pathologin oder des Pathologen zu unterstützen – und so, dass sich jedes Ergebnis am Bild überprüfen lässt.",
      applications: [
        "Segmentierungsmodelle, die Tumor- und Gewebebereiche in Whole-Slide-Images abgrenzen",
        "Werkzeuge für die quantitative Analyse mit Zellkernerkennung, Zellklassifikation und Mitosezählung",
        "Software, die das Biomarker-Scoring bei immunhistochemischen Färbungen standardisiert",
        "Workflows zur Entscheidungsunterstützung, die verdächtige Bereiche per Heatmap markieren und Fälle priorisieren",
      ],
      methods: [
        "Whole-Slide-Imaging (WSI)",
        "Multiple-Instance-Learning (MIL)",
        "Färbungsnormalisierung (Stain Normalization)",
        "Vision Transformer (ViT)",
        "DICOM · OpenSlide",
      ],
      imageAlt: "Mikroskopaufnahme eines rosa und violett gefärbten Gewebeschnitts, in dem einzelne Zellkerne deutlich zu erkennen sind",
      scene: {
        label: "Whole-Slide-Analyse",
        detail: "Segmentierung · Zellerkennung · Heatmap",
        alt: "Ein Scankopf fährt über einen Objektträger mit einem Gewebeschnitt; Zellkerne werden erkannt und markiert, ein verdächtiger Bereich wird per Heatmap hervorgehoben.",
      },
    },
    sonar: {
      // Soft hyphens: the compounds may break on narrow phones.
      title: "SONAR: Unterwasser­detektion und Anomalie­erkennung",
      subtitle: "SONAR — Underwater Detection & Anomaly Recognition",
      summary:
        "Wir überführen aktive und passive Sonardaten in Erfassungssysteme, die Bewegung unter Wasser sichtbar machen. Aus Nachhall, Mehrwegeausbreitung und Umgebungsrauschen heben wir Taucher, unbemannte Unterwasserfahrzeuge und ungewöhnliche Objekte heraus, führen Detektionen zu Tracks zusammen und klassifizieren sie. Für die lückenlose Überwachung von Häfen, Küstenanlagen und Unterwasserinfrastruktur bauen wir Verarbeitungspipelines, die in Echtzeit arbeiten.",
      applications: [
        "Systeme zur Taucherdetektion und -verfolgung für Häfen und Küstenanlagen",
        "Objekt- und Anomalieerkennung in Bildern von Seitensicht- und Multibeam-Sonaren",
        "Klassifikation der Signaturen von Schiffen, Fahrzeugen und Meerestieren in passiven Akustikdaten",
        "Überwachung von Veränderungen und Schäden an Pipelines, Kabeln und Bauwerken am Meeresboden",
      ],
      methods: [
        "Strahlformung (Beamforming)",
        "Optimalfilter (Matched Filter)",
        "CFAR-Detektion",
        "Spektrogrammbasiertes Deep Learning",
        "Mehrzielverfolgung",
      ],
      imageAlt: "Silhouette eines Gerätetauchers, von unten im blauen Wasser gesehen; rechts eine dunkle Felsmasse und aufsteigende Luftblasen",
      scene: {
        label: "Taucherdetektion",
        detail: "Aktivsonar · Anomalieerkennung · Zielverfolgung",
        alt: "Ein Sonarkopf am Meeresboden tastet die Wassersäule ab; ein sich nähernder Taucher wird als Echo erfasst, als Anomalie markiert und in die Zielverfolgung übernommen.",
      },
    },
  },

  approach: {
    label: "Ansatz",
    /* \u00AD = soft hyphen: invisible unless the compound has to break in a narrow column. */
    title: "Von der Forschung ins Feld – mit ingenieur\u00ADtechnischer Disziplin.",
    lede: "LUMIXON vereint akademische Tiefe, fortgeschrittene KI-Forschung und praxiserprobtes Engineering in einer Disziplin. Jedes Projekt beginnt mit einer messbaren Problemdefinition und mündet in ein nachvollziehbares System.",
    principle: "Grundsatz",
    manifestoLead: "KI ist keine Vorführung, sondern eine Ingenieurdisziplin.",
    manifestoBody:
      "Ein Modell zu bauen ist erst der Anfang; die eigentliche Arbeit besteht darin, es auf echten Daten, unter realen Bedingungen und über lange Zeit",
    manifestoAccent: "zuverlässig zu betreiben.",
    pillars: [
      {
        title: "Akademische Tiefe",
        tag: "Academic depth",
        body: "Unsere Methodenwahl stützen wir auf Fachliteratur, mathematische Grundlagen und Versuchsplanung. Wir bringen keinen Ansatz in die Produktion, ohne zu wissen, warum er funktioniert und unter welchen Bedingungen er versagt.",
      },
      {
        title: "Forschungs\u00ADgetriebene Entwicklung",
        tag: "Research-driven development",
        body: "Jedes Problem betrachten wir zunächst als Hypothese und vergleichen konkurrierende Ansätze auf denselben Daten mit denselben Metriken. Unsere Entscheidungen beruhen nicht auf Intuition, sondern auf reproduzierbaren Versuchsergebnissen.",
      },
      {
        title: "Feldtaugliches Engineering",
        tag: "Field-grade engineering",
        body: "Latenz, Hardwarebeschränkungen, Data Drift und Wartungskosten sind vom ersten Tag an Teil des Designs. Die Systeme, die wir liefern, sind überwachbar, testbar und so dokumentiert, dass Ihre Teams sie übernehmen können.",
      },
    ],
    closing: "Jede Zusammenarbeit beginnt mit einem messbaren Problem, das wir gemeinsam definieren.",
    cta: "Problem gemeinsam definieren",
  },

  contact: {
    label: "Kontakt",
    title: "Sprechen Sie direkt mit uns.",
    lede: "Wenn Sie im Feld, in der Fertigung oder in Ihrer Dateninfrastruktur eine konkrete technische Herausforderung lösen möchten, schreiben Sie uns. Lassen Sie uns das Problem gemeinsam definieren und einen umsetzbaren technischen Lösungsansatz bewerten.",
    cardAria: "Über WhatsApp schreiben (öffnet in neuem Tab)",
    channel: "Unternehmenskanal",
    headline: "Schreiben Sie uns über WhatsApp",
    note: "Der Link öffnet WhatsApp mit einer vorbereiteten Begrüßung; Sie können die Nachricht beliebig anpassen.",
    start: "Chat starten",
    guideHeading: "Was Sie in Ihrer ersten Nachricht teilen können",
    guide: [
      { title: "Problemstellung", body: "Das Problem, das Sie lösen möchten, und der Kontext, in dem es auftritt." },
      { title: "Daten und Infrastruktur", body: "Ihre verfügbaren Datenquellen, Sensoren und Systeme." },
      { title: "Angestrebtes Ergebnis", body: "Erfolgskriterien, Rahmenbedingungen und Zeitplan." },
    ],
  },

  footer: {
    homeAria: "LUMIXON, zurück zum Seitenanfang",
    navAria: "Fußzeilennavigation",
    sectionsHeading: "Bereiche",
    contactHeading: "Kontakt",
    whatsapp: "Über WhatsApp schreiben",
    rights: "Alle Rechte vorbehalten.",
    backToTop: "Nach oben",
  },
};
