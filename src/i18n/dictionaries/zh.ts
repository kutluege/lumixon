import type { Dictionary } from "../types";

/**
 * Simplified Chinese (zh-CN), translated from the Turkish source (tr.ts).
 * English-only fields in the source (item subtitles, pillar tags,
 * ogEyebrow) stay in English by design.
 */
export const zh: Dictionary = {
  meta: {
    title: "LUMIXON | 应用人工智能与深科技",
    description:
      "LUMIXON 是一家应用人工智能与深科技公司，在机器人与自主系统、医疗数字病理和水下声呐（SONAR）探测领域，将复杂的现实世界问题转化为工程化解决方案。",
    keywords: [
      "应用人工智能",
      "深科技",
      "机器人人工智能",
      "自主系统",
      "SLAM",
      "医疗人工智能",
      "数字病理",
      "声呐",
      "蛙人探测",
      "水下异常检测",
      "LUMIXON",
    ],
    ogEyebrow: "APPLIED AI & DEEP TECHNOLOGY",
    ogTagline: "面向复杂现实问题、以工程为导向的人工智能。",
    knowsAbout: [
      "面向机器人与自主系统的人工智能",
      "医疗人工智能：数字病理",
      "SONAR：水下探测与异常识别",
    ],
  },

  common: {
    skipToContent: "跳至正文",
    opensInNewTab: "（在新标签页中打开）",
    location: "土耳其伊斯坦布尔",
    whatsappGreeting: "LUMIXON 您好，我们有一项技术需求，希望与贵司进一步沟通。",
    descriptor: "应用人工智能与深科技",
  },

  nav: {
    sections: { capabilities: "核心能力", approach: "方法论", contact: "联系我们" },
    mainAria: "主导航",
    mobileAria: "移动端导航",
    dialogAria: "网站菜单",
    cta: "联系我们",
    menuOpen: "打开菜单",
    menuClose: "关闭菜单",
    whatsappTerm: "WhatsApp",
    whatsappLink: "向我们发送消息",
    locationTerm: "所在地",
    languageAria: "语言选择",
  },

  hero: {
    eyebrowA: "应用人工智能与",
    eyebrowB: "深科技",
    headlineA: "将复杂的现实世界问题",
    headlineB: "转化为智能工程解决方案。",
    lede: "在机器人与自主系统、数字病理和水下声学领域，我们设计、开发并部署贯通感知到决策的系统，使其能够在现场实际运行。",
    ctaPrimary: "探讨您的技术挑战",
    ctaSecondary: "了解我们的能力",
    scroll: "向下滚动",
  },

  hud: {
    pipeline: ["感知", "决策", "控制"],
    flowArrow: "→",
    sensors: "传感器融合 · LiDAR · EO/IR",
    elevation: "EL",
    task: "任务",
    taskValue: "模仿学习 · 示教 → 策略",
    position: "位置",
    north: "N",
    east: "E",
    lidar: "LiDAR",
    lidarValue: "10 Hz · 905 nm",
    session: "会话",
  },

  capabilities: {
    label: "核心能力",
    title: "在现场落地运行的人工智能。",
    lede: "我们深耕三个领域：机器人与自主系统、医疗数字病理和水下声呐（SONAR）探测。在每个项目中，我们统筹设计数据、模型及其运行环境，构建真正在生产环境中运行、而非止步于原型阶段的系统。",
    systemsHeading: "我们构建的系统",
    methodsAria: "方法与技术",
    photoCredit: "图片：",
    twinInset: "数字孪生 · 仿真",
  },

  items: {
    "robotik-otonom": {
      title: "机器人与自主系统 AI",
      subtitle: "AI for Robotics & Autonomous Systems",
      summary:
        "我们将感知、定位、规划与控制各层整合为统一的自主系统软件栈。从四足机器人到无人机，从机械臂到无人地面车辆，我们开发能够在不确定、多变环境中安全决策的系统。借助无人机与地面机器人协同构建同一张地图的多机器人 SLAM，我们在 GPS 信号无法覆盖的区域同样实现定位与建图。我们将经仿真验证的行为分步骤、受控地迁移至真实硬件。",
      applications: [
        "基于 LiDAR 与相机数据实现同步定位与建图的自主导航软件",
        "将无人机空中扫描与地面机器人地面扫描的数据融合到同一张地图中的多机器人 SLAM 系统",
        "依托视觉目标识别的抓取放置与装配机械臂",
        "面向仓库、厂区及作业现场、具备避障能力的路径与运动规划模块",
        "在仿真中训练并迁移至真实硬件的强化学习控制策略",
      ],
      methods: ["SLAM", "多机器人 SLAM", "ROS 2", "逆运动学", "模型预测控制（MPC）", "Sim-to-Real"],
      imageAlt: "生产线自动化工位上，一台蓝色工业机械臂正在搬运成型零件",
      scene: {
        label: "无人机与地面机器人",
        detail: "多机器人 SLAM · LiDAR · 传感器融合",
        alt: "一台四足机器人在崎岖地面上行走，一架无人机在其上方飞行；两者的 LiDAR 扫描共同构建周围环境的点云地图。角落的小窗口中，同一台机器人的线框数字孪生在仿真网格上行走。",
      },
    },
    "saglik-dijital-patoloji": {
      title: "医疗 AI：数字病理",
      subtitle: "AI in Healthcare — Digital Pathology",
      summary:
        "我们开发在十亿像素尺度上处理全切片图像的模型。我们分割组织区域，检测并分类细胞，并将可疑区域按优先级呈现给病理医生。这些系统的设计目的不是作出诊断，而是为病理医生的决策提供支持，并确保每一项输出都可在图像上核验。",
      applications: [
        "在全切片图像中划分肿瘤与组织区域的分割模型",
        "实现细胞核检测、细胞分类与核分裂象计数的定量分析工具",
        "对免疫组化染色中的生物标志物评分进行标准化的软件",
        "以热力图标记可疑区域并对病例进行优先级排序的决策支持流程",
      ],
      methods: ["全切片成像（WSI）", "多示例学习（MIL）", "染色归一化", "视觉 Transformer（ViT）", "DICOM · OpenSlide"],
      imageAlt: "染成粉色和紫色的组织切片显微图像，单个细胞核清晰可见",
      scene: {
        label: "全切片分析",
        detail: "分割 · 细胞检测 · 热力图",
        alt: "扫描头在组织切片玻片上移动；细胞核被检测并标记，可疑区域以热力图突出显示。",
      },
    },
    sonar: {
      title: "SONAR：水下探测与异常识别",
      subtitle: "SONAR — Underwater Detection & Anomaly Recognition",
      summary:
        "我们将主动与被动声呐数据转化为使水下运动可见的感知系统。我们从混响、多径和环境噪声中分辨出潜水员、无人潜航器和异常物体，将检测结果关联成航迹并加以分类。我们构建实时运行的处理流水线，用于对港口、沿岸设施和水下基础设施进行不间断监测。",
      applications: [
        "面向港口与沿岸设施的蛙人探测与跟踪系统",
        "侧扫声呐与多波束声呐图像中的目标与异常检测",
        "被动声学数据中船舶、航行器与海洋生物声学特征的分类",
        "管道、线缆及海底结构的变化与损伤监测",
      ],
      methods: ["波束形成", "匹配滤波", "CFAR 检测", "基于声谱图的深度学习", "多目标跟踪"],
      imageAlt: "从下方仰视蓝色海水中的水肺潜水员剪影，右侧是深色礁石和上升的气泡",
      scene: {
        label: "蛙人探测",
        detail: "主动声呐 · 异常检测 · 航迹跟踪",
        alt: "海底的声呐头扫描水体；一名靠近的潜水员以回波形式被捕获，被标记为异常并纳入航迹跟踪。",
      },
    },
  },

  approach: {
    label: "方法论",
    title: "从研究到现场，以工程纪律贯穿始终。",
    lede: "LUMIXON 将学术深度、前沿人工智能研究与面向现场的工程实践融为一体。每个项目都始于可量化的问题定义，并以可追溯的系统持续推进。",
    principle: "原则",
    manifestoLead: "人工智能不是一场展示，而是一门工程学科。",
    manifestoBody: "构建模型只是起点；真正的工作，是让它在真实数据、真实条件下长期",
    manifestoAccent: "可靠地运行。",
    pillars: [
      {
        title: "学术深度",
        tag: "Academic depth",
        body: "我们的方法选择以文献、数学基础和实验设计为依据。在弄清一种方法为何有效、在何种条件下会失效之前，我们不会将其投入生产。",
      },
      {
        title: "研究驱动的开发",
        tag: "Research-driven development",
        body: "我们首先将每个问题视为一个假设，在相同数据、相同指标下比较相互竞争的方案。我们的决策依据可复现的实验结果，而非直觉。",
      },
      {
        title: "面向现场的工程",
        tag: "Field-grade engineering",
        body: "延迟、硬件约束、数据漂移和维护成本，从第一天起就是设计的一部分。我们交付的系统可监控、可测试，并配有便于团队接手的文档。",
      },
    ],
    closing: "每一次合作，都始于我们共同界定的可量化问题。",
    cta: "共同界定问题",
  },

  contact: {
    label: "联系我们",
    title: "直接与 LUMIXON 沟通。",
    lede: "如果您在现场、生产线或数据基础设施中有具体的技术难题需要解决，欢迎与我们联系。让我们共同界定问题，并评估切实可行的工程方案。",
    cardAria: "通过 WhatsApp 发送消息（在新标签页中打开）",
    channel: "企业专线",
    headline: "通过 WhatsApp 联系我们",
    note: "该链接将打开 WhatsApp 并预填一条问候消息，您可以根据需要自由编辑。",
    start: "开始对话",
    guideHeading: "首条消息中可以提供的信息",
    guide: [
      { title: "问题定义", body: "您希望解决的问题及其产生的背景。" },
      { title: "数据与基础设施", body: "您现有的数据源、传感器和系统。" },
      { title: "预期成果", body: "衡量成功的标准、约束条件和时间计划。" },
    ],
  },

  footer: {
    homeAria: "LUMIXON，返回页面顶部",
    navAria: "页脚导航",
    sectionsHeading: "栏目",
    contactHeading: "联系方式",
    whatsapp: "通过 WhatsApp 联系我们",
    rights: "保留所有权利。",
    backToTop: "返回顶部",
  },
};
