// 子项目管理器：管理项目的子项目（文献查找和综述撰写）
window.SubprojectManager = {
    // 子项目类型常量
    TYPES: {
        LITERATURE_SEARCH: 'literatureSearch',  // 文献查找（节点1-4）
        REVIEW_WRITING: 'reviewWriting'         // 综述撰写（节点5）
    },

    // 生成子项目ID
    generateSubprojectId() {
        return `subproject_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    // 获取当前子项目
    getCurrentSubproject() {
        const state = window.WorkflowStateManager.state;
        return state.currentSubproject;
    },

    // 设置当前子项目
    setCurrentSubproject(subprojectId) {
        const state = window.WorkflowStateManager.state;
        state.currentSubprojectId = subprojectId;
    },

    // 获取项目的所有子项目（从独立文件加载）
    async getSubprojects(projectName) {
        const [subprojects1, subprojects2] = await Promise.all([
            this.getSubprojectsByType(projectName, this.TYPES.LITERATURE_SEARCH),
            this.getSubprojectsByType(projectName, this.TYPES.REVIEW_WRITING)
        ]);
        return [...subprojects1, ...subprojects2];
    },

    // 获取指定类型的子项目（从独立文件加载）
    async getSubprojectsByType(projectName, type) {
        try {
            if (type === this.TYPES.LITERATURE_SEARCH) {
                const result = await window.electronAPI.loadSubprojects1(projectName);
                return (result && result.success) ? (result.data || []) : [];
            } else if (type === this.TYPES.REVIEW_WRITING) {
                const result = await window.electronAPI.loadSubprojects2(projectName);
                return (result && result.success) ? (result.data || []) : [];
            }
            return [];
        } catch (error) {
            console.error('加载子项目失败:', error);
            return [];
        }
    },

    // 创建新子项目
    async createSubproject(projectName, type, name, description = '') {
        const subproject = {
            id: this.generateSubprojectId(),
            name: name,
            type: type,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            description: description
        };

        // 根据类型初始化节点数据
        if (type === this.TYPES.LITERATURE_SEARCH) {
            subproject.node1 = { status: 'pending' };
            subproject.node2 = { status: 'pending' };
            subproject.node3 = { status: 'pending' };
            subproject.node4 = { status: 'pending' };
            
            // 初始化文献查找子项目的默认配置
            subproject.config = {
                apiProvider: 'deepseek',
                requirement: '',
                literatureSource: 'google-scholar',
                targetCount: 50,
                yearLimit: {
                    recentYears: 5,
                    percentage: 60
                },
                language: 'zh'
            };
        } else if (type === this.TYPES.REVIEW_WRITING) {
            subproject.node5 = { status: 'pending' };
            subproject.sourceSubprojectIds = [];  // 关联的文献查找子项目ID
            subproject.literature = [];  // 从关联的文献查找子项目中整理后的文献列表
        }

        // 添加到对应类型的子项目文件
        const subprojects = await this.getSubprojectsByType(projectName, type);
        subprojects.push(subproject);

        if (type === this.TYPES.LITERATURE_SEARCH) {
            await window.electronAPI.saveSubprojects1(projectName, subprojects);
        } else if (type === this.TYPES.REVIEW_WRITING) {
            await window.electronAPI.saveSubprojects2(projectName, subprojects);
        }

        return subproject;
    },

    // 删除子项目
    async deleteSubproject(projectName, subprojectId) {
        // 先找到子项目以确定类型
        const allSubprojects = await this.getSubprojects(projectName);
        const subproject = allSubprojects.find(sp => sp.id === subprojectId);
        
        if (subproject) {
            const type = subproject.type;
            const subprojects = await this.getSubprojectsByType(projectName, type);
            const filtered = subprojects.filter(sp => sp.id !== subprojectId);
            
            if (type === this.TYPES.LITERATURE_SEARCH) {
                await window.electronAPI.saveSubprojects1(projectName, filtered);
            } else if (type === this.TYPES.REVIEW_WRITING) {
                await window.electronAPI.saveSubprojects2(projectName, filtered);
            }
        }
    },

    // 更新子项目
    async updateSubproject(projectName, subprojectId, updates) {
        // 先找到子项目以确定类型
        const allSubprojects = await this.getSubprojects(projectName);
        const subproject = allSubprojects.find(sp => sp.id === subprojectId);
        
        if (subproject) {
            const type = subproject.type;
            const subprojects = await this.getSubprojectsByType(projectName, type);
            const index = subprojects.findIndex(sp => sp.id === subprojectId);
            
            if (index !== -1) {
                // 深度合并更新，特别是 node5 等嵌套对象
                const existingSubproject = subprojects[index];
                const mergedSubproject = {
                    ...existingSubproject,
                    ...updates,
                    updatedAt: new Date().toISOString()
                };
                
                // 如果更新中包含 node5，需要深度合并（保留原有的 node5 数据）
                if (updates.node5) {
                    mergedSubproject.node5 = {
                        ...(existingSubproject.node5 || {}), // 保留原有的 node5 数据（如 reviewContent、status）
                        ...updates.node5 // 更新新的字段（如 outline、chapterCount 等）
                    };
                }
                
                // 如果更新中包含 literature，直接替换
                if (updates.literature !== undefined) {
                    mergedSubproject.literature = updates.literature;
                }
                
                subprojects[index] = mergedSubproject;
                
                console.log('[updateSubproject] 保存子项目更新:', {
                    subprojectId: subprojectId,
                    type: type,
                    hasNode5: !!mergedSubproject.node5,
                    node5Keys: mergedSubproject.node5 ? Object.keys(mergedSubproject.node5) : [],
                    hasLiterature: !!mergedSubproject.literature,
                    literatureCount: mergedSubproject.literature ? mergedSubproject.literature.length : 0
                });
                
                if (type === this.TYPES.LITERATURE_SEARCH) {
                    await window.electronAPI.saveSubprojects1(projectName, subprojects);
                } else if (type === this.TYPES.REVIEW_WRITING) {
                    await window.electronAPI.saveSubprojects2(projectName, subprojects);
                    console.log('[updateSubproject] 已保存到 subprojects2.json');
                }
                
                return subprojects[index];
            }
        }
        return null;
    },

    // 获取子项目数据
    async getSubprojectData(projectName, subprojectId) {
        const subprojects = await this.getSubprojects(projectName);
        return subprojects.find(sp => sp.id === subprojectId) || null;
    },

    // 检查子项目状态
    checkSubprojectStatus(subproject) {
        if (subproject.type === this.TYPES.LITERATURE_SEARCH) {
            // 检查节点1-4的状态
            const node1Status = subproject.node1?.status || 'pending';
            const node2Status = subproject.node2?.status || 'pending';
            const node3Status = subproject.node3?.status || 'pending';
            const node4Status = subproject.node4?.status || 'pending';

            if (node4Status === 'completed') return 'completed';
            if (node1Status === 'active' || node2Status === 'active' ||
                node3Status === 'active' || node4Status === 'active') return 'active';
            return 'pending';
        } else if (subproject.type === this.TYPES.REVIEW_WRITING) {
            const node5Status = subproject.node5?.status || 'pending';
            return node5Status;
        }
        return 'pending';
    },

    // 更新子项目状态（根据节点状态自动计算）
    async updateSubprojectStatus(projectName, subprojectId) {
        const subproject = await this.getSubprojectData(projectName, subprojectId);
        if (subproject) {
            const newStatus = this.checkSubprojectStatus(subproject);
            if (newStatus !== subproject.status) {
                await this.updateSubproject(projectName, subprojectId, { status: newStatus });
            }
        }
    }
};

