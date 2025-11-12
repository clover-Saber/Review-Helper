# 项目逻辑梳理总结

## 一、JSON数据格式标准

### 标准格式结构
```json
{
  "projectName": "项目名称",
  "status": "initial|active|completed",
  "createdAt": "ISO时间戳",
  "updatedAt": "ISO时间戳",
  "config": {
    "apiKeys": { "deepseek": "...", "gemini": "..." },
    "apiProvider": "deepseek|gemini",
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
1. **节点1（关键词分析）**：
   - `keywords`: 字符串数组，保存在 `node1.keywords`
   - `keywordsPlan`: 对象数组，保存在 `node1.keywordsPlan`
   - ❌ 不应保存在根级别或 `requirementData.keywordsPlan`

2. **节点2（文献搜索）**：
   - `searchResults`: 按关键词组织的搜索结果，保存在 `node2.searchResults`
   - ❌ 不应保存 `allLiterature`（那是节点3的数据）
   - ❌ 不应使用 `finalResults`（旧字段）

3. **节点3（文献补全）**：
   - `allLiterature`: 包含完整摘要的文献数组，保存在 `node3.allLiterature`
   - ❌ 不应使用 `finalResults`（旧字段）

4. **节点4（文献筛选）**：
   - `selectedLiterature`: 精选文献数组，保存在 `node4.selectedLiterature`
   - ❌ 不应使用 `organizedData`（旧字段）

5. **节点5（综述撰写）**：
   - `reviewContent`: 综述内容，保存在 `node5.reviewContent`
   - ❌ 不应使用 `review`（旧字段）

## 二、已修复的问题

### 1. 数据保存格式统一
- ✅ 所有节点数据统一使用 `saveNodeData(nodeNum, nodeData)` 方法
- ✅ 移除了所有使用 `finalResults`、`organizedData` 等旧字段的保存调用
- ✅ 修复了 `node1-keywords.js` 中直接保存到根级别的问题
- ✅ 修复了 `node2-search.js` 中删除文献时使用旧格式的问题

### 2. 数据加载逻辑优化
- ✅ 优先从节点数据读取（`node1`, `node2`, `node3`, `node4`, `node5`）
- ✅ 保留兼容旧格式的读取逻辑（自动迁移到新格式）
- ✅ 修复了节点2状态判断逻辑（基于 `searchResults` 而不是 `allLiterature`）

### 3. 数据清理逻辑完善
- ✅ `data-manager.js` 中增强了清理逻辑，确保根级别旧字段被删除
- ✅ 添加了额外的清理检查，确保所有节点存在时根级别干净

### 4. 代码冗余清理
- ✅ 统一了保存方法调用
- ✅ 简化了兼容旧格式的代码注释

## 三、工作流程结构

### 节点执行顺序
1. **节点1**：关键词分析 → 生成 `keywords` 和 `keywordsPlan`
2. **节点2**：文献搜索 → 生成 `searchResults`（按关键词组织）
3. **节点3**：文献补全 → 从 `searchResults` 生成 `allLiterature`（包含完整摘要）
4. **节点4**：文献筛选 → 从 `allLiterature` 筛选生成 `selectedLiterature`
5. **节点5**：综述撰写 → 基于 `selectedLiterature` 生成 `reviewContent`

### 数据流转
```
节点1: requirementData → keywords, keywordsPlan
  ↓
节点2: keywords → searchResults (按关键词分组)
  ↓
节点3: searchResults → allLiterature (合并+补全摘要)
  ↓
节点4: allLiterature → selectedLiterature (筛选)
  ↓
节点5: selectedLiterature → reviewContent (生成综述)
```

## 四、注意事项

1. **节点2和节点3的区别**：
   - 节点2：范围搜索，使用关键词搜索，返回多篇文献，保存在 `node2.searchResults`
   - 节点3：单篇精确搜索，使用标题精确搜索，补全每篇文献的摘要，保存在 `node3.allLiterature`

2. **数据迁移**：
   - 旧数据会自动迁移到新格式
   - 迁移后旧字段会被清理，不会保存到JSON中

3. **状态管理**：
   - 每个节点都有独立的 `status` 字段
   - 状态保存在对应的 `nodeX.status` 中

## 五、待优化项

1. 可以考虑进一步简化兼容旧格式的代码（如果确定不再需要支持旧数据）
2. 可以考虑添加数据格式验证，确保保存的数据符合标准格式
3. 可以考虑添加数据迁移工具，批量迁移旧项目数据

