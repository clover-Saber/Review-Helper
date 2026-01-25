# 项目结构文档

## 项目概述

Review Helper 是一个基于 Electron 的 AI 驱动的文献综述智能助手，帮助科研工作者高效完成文献查找、筛选和综述撰写工作。

## 目录结构

```
文献项目/
├── main.js                    # Electron 主进程入口文件
├── package.json               # 项目依赖配置
├── README.md                  # 项目说明文档
├── PROJECT_STRUCTURE.md       # 项目结构文档（本文件）
│
├── pages/                     # 前端页面目录
│   ├── index.html            # 项目列表页面
│   ├── project-detail.html   # 项目详情页面
│   ├── literature-search-workflow.html  # 文献查找工作流页面
│   ├── review-writing-workflow.html    # 综述撰写工作流页面
│   │
│   ├── common.css            # 公共样式文件（导入变量和工具类）
│   ├── index.css             # 主页面样式
│   │
│   ├── css/                  # CSS 样式模块化目录
│   │   ├── variables.css     # CSS 变量定义（颜色、间距、字体等）
│   │   ├── utils.css         # 工具类样式（flex、text、spacing 等）
│   │   │
│   │   ├── components/       # 组件样式
│   │   │   ├── button.css    # 按钮组件样式
│   │   │   ├── card.css      # 卡片组件样式
│   │   │   ├── form.css      # 表单组件样式
│   │   │   ├── modal.css     # 模态框组件样式
│   │   │   ├── node.css      # 工作流节点组件样式
│   │   │   ├── progress.css  # 进度条组件样式
│   │   │   └── toast.css     # Toast 通知组件样式
│   │   │
│   │   ├── layouts/          # 布局样式
│   │   │   ├── container.css # 容器布局样式
│   │   │   ├── footer.css    # 页脚布局样式
│   │   │   └── header.css    # 页眉布局样式
│   │   │
│   │   └── pages/            # 页面特定样式
│   │       ├── index.css                    # 项目列表页面样式
│   │       ├── project-detail.css           # 项目详情页面样式
│   │       ├── literature-search-workflow.css # 文献查找工作流页面样式
│   │       └── review-writing-workflow.css   # 综述撰写工作流页面样式
│   │
│   └── js/                   # JavaScript 模块化目录
│       ├── core/             # 核心模块
│       │   ├── api.js                    # API 调用模块（AI 和文献搜索）
│       │   ├── data-manager.js           # 数据管理模块（保存/加载项目数据）
│       │   ├── electron-api.js           # Electron IPC 通信模块
│       │   └── module-loader.js          # 模块加载器（管理依赖和加载顺序）
│       │
│       ├── utils/            # 工具函数模块
│       │   ├── dom-utils.js      # DOM 操作工具函数
│       │   ├── format-utils.js   # 格式化工具函数（日期、文件大小等）
│       │   └── ui-utils.js       # UI 工具函数（Toast、进度条等）
│       │
│       ├── managers/         # 管理器模块
│       │   ├── requirement-manager.js  # 需求管理器
│       │   └── subproject-manager.js   # 子项目管理器
│       │
│       ├── nodes/            # 工作流节点模块
│       │   ├── node1-keywords.js   # 节点1：关键词分析
│       │   ├── node2-search.js     # 节点2：文献搜索
│       │   ├── node3-complete.js   # 节点3：文献补全
│       │   ├── node4-filter.js     # 节点4：精选文献
│       │   └── node5-review.js     # 节点5：综述撰写
│       │
│       ├── workflows/        # 工作流模块
│       │   ├── workflow-state-manager.js      # 工作流状态管理
│       │   ├── workflow-data-loader.js        # 工作流数据加载
│       │   ├── literature-search-workflow.js  # 文献查找工作流
│       │   ├── review-writing-workflow.js     # 综述撰写工作流
│       │   └── workflow-manager.js             # 工作流管理器
│       │
│       ├── sources/          # 文献来源模块
│       │   ├── google-scholar.js  # Google Scholar 搜索
│       │
│       └── pages/            # 页面级 JavaScript
│           ├── index.js                      # 项目列表页面逻辑
│           ├── project-detail.js             # 项目详情页面逻辑
│           ├── literature-search-workflow.js # 文献查找工作流页面逻辑
│           └── review-writing-workflow.js    # 综述撰写工作流页面逻辑
│
├── projects/                 # 项目数据存储目录
│   └── [项目名称]/          # 每个项目一个目录
│       ├── project.json      # 项目配置文件
│       ├── subprojects1.json # 文献查找子项目数据
│       └── subprojects2.json # 综述撰写子项目数据
│
├── dist/                     # 构建输出目录
├── node_modules/             # Node.js 依赖包
└── tests/                    # 测试文件目录
```

## 模块说明

### 核心模块 (core/)

- **api.js**: 处理所有外部 API 调用，包括 DeepSeek、Google Gemini、SiliconFlow、Poe 等 AI 服务，以及 Google Scholar、烂番薯学术等文献搜索服务。
- **data-manager.js**: 负责项目数据的保存和加载，实现深度合并策略，确保数据一致性。
- **electron-api.js**: 提供统一的 Electron IPC 通信接口，处理主进程和渲染进程之间的通信。
- **module-loader.js**: 管理 JavaScript 模块的加载顺序和依赖关系，支持按需加载。

### 工具模块 (utils/)

- **dom-utils.js**: 提供 DOM 操作相关的工具函数，如元素选择、创建、事件处理、类操作等。
- **format-utils.js**: 提供数据格式化工具函数，如日期格式化、文件大小格式化、文本截断等。
- **ui-utils.js**: 提供 UI 相关的工具函数，如 Toast 通知、进度条更新、元素显示/隐藏等。

### 管理器模块 (managers/)

- **requirement-manager.js**: 管理文献查找和综述撰写的需求配置。
- **subproject-manager.js**: 管理子项目的创建、删除、更新和检索。

### 节点模块 (nodes/)

每个节点模块负责工作流中的一个步骤：

1. **node1-keywords.js**: 使用 AI 从需求中提取搜索关键词。
2. **node2-search.js**: 根据关键词在指定文献库中搜索文献。
3. **node3-complete.js**: 为搜索结果中的文献补充完整摘要信息。
4. **node4-filter.js**: 使用 AI 筛选和手动选择相关文献。
5. **node5-review.js**: 基于精选文献生成文献综述。

### 工作流模块 (workflows/)

- **workflow-state-manager.js**: 管理工作流节点的状态（pending/active/completed）。
- **workflow-data-loader.js**: 负责从项目数据中加载工作流状态和数据。
- **literature-search-workflow.js**: 文献查找工作流的协调逻辑。
- **review-writing-workflow.js**: 综述撰写工作流的协调逻辑。
- **workflow-manager.js**: 统一管理工作流，协调节点和页面功能。

### 页面模块 (pages/)

每个页面模块负责对应 HTML 页面的初始化和事件处理。

## 数据格式

### 项目数据格式 (project.json)

```json
{
  "projectName": "项目名称",
  "status": "initial|active|completed",
  "createdAt": "ISO时间戳",
  "updatedAt": "ISO时间戳",
  "config": {
    "apiKeys": { "deepseek": "...", "gemini": "..." },
    "apiProvider": "deepseek|gemini|siliconflow|poe",
    "geminiModel": "gemini-2.5-flash",
    "googleScholarVerified": true/false
  },
  "requirementData": {
    "requirement": "需求描述",
    "targetCount": 50,
    "outline": "大纲内容",
    "language": "zh|en"
  },
  "node1": {
    "status": "pending|active|completed",
    "keywords": ["关键词1", "关键词2"],
    "keywordsPlan": [
      { "keyword": "关键词1", "count": 10 }
    ]
  },
  "node2": {
    "status": "pending|active|completed",
    "searchResults": {
      "关键词1": [文献数组],
      "关键词2": [文献数组]
    }
  },
  "node3": {
    "status": "pending|active|completed",
    "allLiterature": [文献数组（包含完整摘要）]
  },
  "node4": {
    "status": "pending|active|completed",
    "selectedLiterature": [精选文献数组]
  },
  "node5": {
    "status": "pending|active|completed",
    "reviewContent": "综述内容"
  }
}
```

### 数据存储规则

1. **节点数据统一保存在对应的 `nodeX` 字段中**，不再使用根级别的旧字段。
2. **数据加载时优先从节点数据读取**，保留对旧格式的兼容性（自动迁移）。
3. **保存数据时会自动清理根级别的旧字段**，确保数据格式一致性。

## 工作流程

### 文献查找工作流

```
需求输入 → 节点1（关键词分析）→ 节点2（文献搜索）→ 节点3（文献补全）→ 节点4（精选文献）
```

### 综述撰写工作流

```
需求输入 → 生成大纲 → 节点5（综述撰写）
```

## 样式系统

### CSS 变量 (css/variables.css)

定义了统一的颜色、间距、字体、圆角、阴影等设计令牌，确保整个应用的视觉一致性。

### 组件样式 (css/components/)

每个组件都有独立的样式文件，便于维护和复用。

### 布局样式 (css/layouts/)

定义了页面布局相关的样式，如容器、页眉、页脚等。

### 工具类 (css/utils.css)

提供了常用的工具类，如 flex 布局、文本对齐、间距、显示/隐藏等，用于快速构建 UI。

## 开发规范

1. **模块化**: 每个功能模块独立文件，职责单一。
2. **命名规范**: 使用 kebab-case 命名文件和目录，使用 camelCase 命名变量和函数。
3. **代码组织**: 按功能分类组织代码，核心模块、工具模块、业务模块分离。
4. **样式分离**: HTML、CSS、JavaScript 完全分离，避免内联样式和脚本。
5. **依赖管理**: 使用 module-loader.js 管理模块依赖和加载顺序。

## 重构完成情况

✅ **已完成的重构任务**:
- CSS 变量和组件样式拆分
- JavaScript 模块重组（从 `modules/` 迁移到 `js/`）
- HTML 结构优化（语义化标签、ARIA 属性）
- 内联样式和脚本移除
- 文件引用路径更新
- 功能测试和修复
- 旧文件清理（`pages/modules/` 目录下的所有文件已删除）

⚠️ **注意**: 根目录下的 `css/` 和 `js/` 目录以及 `pages/modules/` 目录为空目录，可以手动删除。这些是重构过程中遗留的空目录，不影响项目运行。

## 注意事项

1. **向后兼容**: 数据加载时保留了对旧格式的兼容性，旧项目数据会自动迁移到新格式。
2. **模块加载**: 目前使用直接 `<script>` 标签加载模块，module-loader.js 已实现但未启用，可作为未来优化使用。
3. **样式系统**: 使用 CSS 变量和工具类，便于主题定制和样式复用。
