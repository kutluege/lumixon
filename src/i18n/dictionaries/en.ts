import type { Dictionary } from "../types";

export const en: Dictionary = {
  meta: {
    title: "LUMIXON | Applied AI & Deep Technology",
    description:
      "LUMIXON is an applied AI and deep-technology company that turns complex real-world problems into engineered solutions across robotics and autonomous systems, digital pathology in healthcare, and underwater SONAR detection.",
    keywords: [
      "applied AI",
      "deep technology",
      "AI for robotics",
      "autonomous systems",
      "SLAM",
      "AI in healthcare",
      "digital pathology",
      "sonar",
      "diver detection",
      "underwater anomaly detection",
      "LUMIXON",
    ],
    ogEyebrow: "APPLIED AI & DEEP TECHNOLOGY",
    ogTagline: "Engineering-driven AI for complex real-world problems.",
    knowsAbout: [
      "AI for Robotics and Autonomous Systems",
      "AI in Healthcare: Digital Pathology",
      "SONAR: Underwater Detection and Anomaly Recognition",
    ],
  },

  common: {
    skipToContent: "Skip to content",
    opensInNewTab: " (opens in a new tab)",
    location: "Istanbul, Türkiye",
    whatsappGreeting: "Hello LUMIXON, we would like to discuss a technical requirement.",
    descriptor: "Applied AI & Deep Technology",
  },

  nav: {
    sections: { capabilities: "Capabilities", approach: "Approach", contact: "Contact" },
    mainAria: "Main navigation",
    mobileAria: "Mobile navigation",
    dialogAria: "Site menu",
    cta: "Get in touch",
    menuOpen: "Open menu",
    menuClose: "Close menu",
    whatsappTerm: "WhatsApp",
    whatsappLink: "Message the team",
    locationTerm: "Location",
    languageAria: "Language",
  },

  hero: {
    eyebrowA: "Applied AI &",
    eyebrowB: "Deep Technology",
    headlineA: "We turn complex real-world problems",
    headlineB: "into intelligent engineering solutions.",
    lede: "Across robotics and autonomous systems, digital pathology and underwater acoustics, we design, build and deploy systems that span perception to decision, engineered to perform in the field.",
    ctaPrimary: "Let’s discuss your challenge",
    ctaSecondary: "Explore capabilities",
    scroll: "Scroll",
  },

  hud: {
    pipeline: ["Perception", "Decision", "Control"],
    flowArrow: "→",
    sensors: "Sensor fusion · LiDAR · EO/IR",
    elevation: "EL",
    task: "Task",
    taskValue: "Imitation learning · Demonstration → Policy",
    position: "Position",
    north: "N",
    east: "E",
    lidar: "LiDAR",
    lidarValue: "10 Hz · 905 nm",
    session: "Session",
  },

  capabilities: {
    label: "Capabilities",
    title: "AI that works in the field.",
    lede: "We go deep in three areas: robotics and autonomous systems, digital pathology in healthcare, and underwater SONAR detection. On every project we design the data, the model and its operating environment together, building systems that run in production rather than stall at the prototype stage.",
    systemsHeading: "Systems we build",
    methodsAria: "Methods and technologies",
    photoCredit: "Photo:",
    twinInset: "Digital twin · Simulation",
  },

  items: {
    "robotik-otonom": {
      title: "AI for Robotics & Autonomous Systems",
      subtitle: "AI for Robotics & Autonomous Systems",
      summary:
        "We unify perception, localization, planning and control in a single autonomy stack. From quadruped robots to drones and from manipulators to uncrewed ground vehicles, we build systems that make safe decisions in uncertain, changing environments. With multi-robot SLAM, in which a drone and a ground robot build the same map together, we provide localization and mapping even in areas GPS does not reach. Behaviors validated in simulation are transferred to real hardware in controlled steps.",
      applications: [
        "Autonomous navigation software that performs simultaneous localization and mapping from LiDAR and camera data",
        "Multi-robot SLAM systems that fuse what a drone scans from the air and a ground robot scans from the ground into a single map",
        "Pick-and-place and assembly manipulators driven by vision-based object recognition",
        "Route and motion planning modules with obstacle avoidance for warehouses, plants and field sites",
        "Reinforcement-learning control policies trained in simulation and transferred to real hardware",
      ],
      methods: ["SLAM", "Multi-robot SLAM", "ROS 2", "Inverse kinematics", "Model predictive control (MPC)", "Sim-to-real"],
      imageAlt: "Blue industrial robot arm moving a molded part at an automation station on a production line",
      scene: {
        label: "Drone and ground robot",
        detail: "Multi-robot SLAM · LiDAR · Sensor fusion",
        alt: "A four-legged robot walks over uneven terrain while a drone flies above it; together, their LiDAR sweeps build a point-cloud map of the surroundings. In a small inset in the corner, the same robot’s wireframe digital twin walks a simulation grid.",
      },
    },
    "saglik-dijital-patoloji": {
      title: "AI in Healthcare: Digital Pathology",
      subtitle: "AI in Healthcare: Digital Pathology",
      summary:
        "We build models that process whole-slide images at gigapixel scale. We delineate tissue regions, detect and classify cells, and bring suspicious areas to the pathologist in order of priority. We design these systems not to make the diagnosis but to support the pathologist’s decision, with every output verifiable on the image.",
      applications: [
        "Segmentation models that delineate tumor and tissue regions in whole-slide images",
        "Quantitative analysis tools for nucleus detection, cell classification and mitosis counting",
        "Software that standardizes biomarker scoring on immunohistochemistry stains",
        "Decision-support workflows that mark suspicious regions with a heatmap and prioritize cases",
      ],
      methods: [
        "Whole-slide imaging (WSI)",
        "Multiple-instance learning (MIL)",
        "Stain normalization",
        "Vision transformers (ViT)",
        "DICOM · OpenSlide",
      ],
      imageAlt: "Microscope image of a tissue section stained in pink and purple, with individual cell nuclei clearly visible",
      scene: {
        label: "Whole-slide analysis",
        detail: "Segmentation · Cell detection · Heatmap",
        alt: "A scanning head moves across a tissue-section slide; cell nuclei are detected and marked, and a suspicious region is highlighted with a heatmap.",
      },
    },
    sonar: {
      title: "SONAR: Underwater Detection & Anomaly Recognition",
      subtitle: "SONAR: Underwater Detection & Anomaly Recognition",
      summary:
        "We turn active and passive sonar data into sensing systems that make movement underwater visible. We pick out divers, uncrewed underwater vehicles and unusual objects from reverberation, multipath and ambient noise, then turn detections into tracks and classify them. We build processing pipelines that run in real time for the uninterrupted monitoring of ports, coastal facilities and underwater infrastructure.",
      applications: [
        "Diver detection and tracking systems for ports and coastal facilities",
        "Object and anomaly detection in side-scan and multibeam sonar imagery",
        "Classification of vessel, vehicle and marine-life signatures in passive acoustic data",
        "Change and damage monitoring for pipelines, cables and seabed structures",
      ],
      methods: [
        "Beamforming",
        "Matched filter",
        "CFAR detection",
        "Spectrogram-based deep learning",
        "Multi-target tracking",
      ],
      imageAlt: "Silhouette of a scuba diver seen from below in blue water, with a dark rock mass on the right and rising air bubbles",
      scene: {
        label: "Diver detection",
        detail: "Active sonar · Anomaly detection · Tracking",
        alt: "A sonar head on the seabed scans the water column; an approaching diver is picked up as an echo, flagged as an anomaly and then tracked.",
      },
    },
  },

  approach: {
    label: "Approach",
    title: "From research to the field, with engineering discipline.",
    lede: "LUMIXON brings academic depth, advanced AI research and field-proven engineering together in a single discipline. Every project starts with a measurable problem definition and continues as a traceable system.",
    principle: "Principle",
    manifestoLead: "AI is not a showcase; it is an engineering discipline.",
    manifestoBody: "Building the model is only the beginning. The real work is making it",
    manifestoAccent: "run reliably on real data, under real conditions, over the long term.",
    pillars: [
      {
        title: "Academic depth",
        tag: "Academic depth",
        body: "We ground our choice of methods in the literature, in mathematical foundations and in experimental design. We never take an approach into production without knowing why it works and under which conditions it breaks down.",
      },
      {
        title: "Research-driven development",
        tag: "Research-driven development",
        body: "We treat every problem first as a hypothesis and compare competing approaches on the same data with the same metrics. Our decisions rest on reproducible experimental results, not on intuition.",
      },
      {
        title: "Field-grade engineering",
        tag: "Field-grade engineering",
        body: "Latency, hardware constraints, data drift and maintenance cost are part of the design from day one. The systems we deliver are observable, testable and documented so that your teams can take them over.",
      },
    ],
    closing: "Every collaboration starts with a measurable problem we define together.",
    cta: "Let’s define the problem together",
  },

  contact: {
    label: "Contact",
    title: "Talk to the company directly.",
    lede: "If you have a concrete technical challenge to solve in the field, on the production line or in your data infrastructure, write to us. Let’s define the problem together and assess a workable engineering approach.",
    cardAria: "Message us on WhatsApp (opens in a new tab)",
    channel: "Corporate line",
    headline: "Message us on WhatsApp",
    note: "The link opens WhatsApp with a ready-made greeting; you can edit the message however you like.",
    start: "Start the chat",
    guideHeading: "What to share in your first message",
    guide: [
      { title: "Problem definition", body: "The problem you want to solve and the context in which it arises." },
      { title: "Data and infrastructure", body: "The data sources, sensors and systems you have in place." },
      { title: "Target outcome", body: "The criteria that define success, your constraints and your timeline." },
    ],
  },

  footer: {
    homeAria: "LUMIXON, back to the top of the page",
    navAria: "Footer navigation",
    sectionsHeading: "Sections",
    contactHeading: "Contact",
    whatsapp: "Message us on WhatsApp",
    rights: "All rights reserved.",
    backToTop: "Back to top",
  },
};
