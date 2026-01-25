// UI工具模块：提供通用的UI功能
window.UIUtils = {
    // 显示Toast提示
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toast-message');
        
        if (!toast || !toastMessage) {
            console.warn('Toast元素未找到');
            return;
        }
        
        // 设置消息内容
        toastMessage.textContent = message;
        
        // 根据类型设置背景色
        if (type === 'success') {
            toast.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        } else if (type === 'error') {
            toast.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        } else if (type === 'info') {
            toast.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        } else {
            toast.style.background = '#333';
        }
        
        // 确保toast可见
        toast.style.display = 'block';
        
        // 添加show类以触发动画
        toast.classList.add('show');
        
        // 3秒后隐藏
        setTimeout(() => {
            toast.classList.remove('show');
            // 动画结束后隐藏元素
            setTimeout(() => {
                toast.style.display = 'none';
            }, 300);
        }, 3000);
    },

    // 更新进度条
    updateProgress(progressId, fillId, textId, percentage, text) {
        const fill = document.getElementById(fillId);
        const textEl = document.getElementById(textId);
        if (fill) fill.style.width = `${percentage}%`;
        if (textEl) textEl.textContent = text;
    },

    // 显示/隐藏元素
    showElement(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'block';
    },

    hideElement(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    },

    // 设置元素值
    setValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    },

    getValue(id) {
        const el = document.getElementById(id);
        return el ? el.value : '';
    }
};

