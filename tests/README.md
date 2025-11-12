# 测试脚本说明

## Google Scholar 抓取测试

### 使用方法

运行测试脚本：
```bash
npm run test:scholar
```

### 测试配置

可以在 `test-google-scholar.js` 文件顶部修改测试参数：

```javascript
const TEST_KEYWORD = '"A deep learning-based hybrid framework for object detection and recognition in autonomous driving"';  // 测试关键词
const TEST_LIMIT = 1;  // 测试数量
```

### 测试功能

1. 自动打开 Google Scholar 搜索页面
2. 搜索测试关键词
3. 提取搜索结果（标题、作者、年份、期刊、被引次数、摘要、URL）
4. 输出详细信息和统计

### 注意事项

- 如果遇到验证码，请手动完成验证后再继续
- 测试窗口会在提取完成后自动关闭
- 所有输出信息会显示在控制台

## 关键词搜索文献测试

### 使用方法

运行测试脚本：
```bash
npm run test:keyword
```

### 测试配置

可以在 `test-keyword-search.js` 文件顶部修改测试参数：

```javascript
const TEST_KEYWORDS = [
    'machine learning',
    'deep learning',
    'neural network'
];  // 测试关键词列表
const TEST_LIMIT = 5;  // 每个关键词搜索的文献数量
const TEST_MIN_YEAR = null;  // 最小年份限制（null表示不限制）
```

### 测试功能

1. 自动搜索多个关键词
2. 从 Google Scholar 提取文献信息
3. 提取的信息包括：
   - 标题
   - 作者
   - 年份
   - 来源/期刊
   - 被引次数
   - 摘要
   - URL
4. 输出详细的文献信息和统计
5. 自动保存结果到 `tests/test-results.json` 文件

### 输出示例

```
文献 1:
================================================================================
标题: Deep Learning for Image Recognition
作者: John Smith, Jane Doe - IEEE Conference, 2020
年份: 2020
来源: IEEE Conference
被引次数: 150
URL: https://scholar.google.com/...
摘要: This paper presents a novel deep learning approach...
```

### 注意事项

- 如果遇到验证码，测试会停止并提示手动处理
- 测试窗口是隐藏的，不会显示在屏幕上
- 每个关键词搜索之间有3秒延迟，避免请求过快
- 所有输出信息会显示在控制台
- 测试结果会自动保存到 `tests/test-results.json` 文件

