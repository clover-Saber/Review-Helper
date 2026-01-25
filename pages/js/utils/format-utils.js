// 格式化工具函数模块：提供数据格式化相关的工具函数

window.FormatUtils = {
    /**
     * 格式化日期
     * @param {Date|string|number} date - 日期对象、日期字符串或时间戳
     * @param {string} format - 格式化模式（'date'|'datetime'|'time'|'custom'）
     * @param {string} locale - 语言环境（默认'zh-CN'）
     * @returns {string} 格式化后的日期字符串
     */
    formatDate(date, format = 'date', locale = 'zh-CN') {
        if (!date) return '未知';
        
        let dateObj;
        if (date instanceof Date) {
            dateObj = date;
        } else if (typeof date === 'string') {
            dateObj = new Date(date);
        } else if (typeof date === 'number') {
            dateObj = new Date(date);
        } else {
            return '未知';
        }
        
        // 检查日期是否有效
        if (isNaN(dateObj.getTime())) {
            return '未知';
        }
        
        switch (format) {
            case 'date':
                return dateObj.toLocaleDateString(locale);
            case 'datetime':
                return dateObj.toLocaleString(locale);
            case 'time':
                return dateObj.toLocaleTimeString(locale);
            case 'iso':
                return dateObj.toISOString();
            case 'custom':
                // 自定义格式：YYYY-MM-DD HH:mm:ss
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                const hours = String(dateObj.getHours()).padStart(2, '0');
                const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                const seconds = String(dateObj.getSeconds()).padStart(2, '0');
                return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            default:
                return dateObj.toLocaleDateString(locale);
        }
    },

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @param {number} decimals - 小数位数（默认2）
     * @returns {string} 格式化后的文件大小
     */
    formatFileSize(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },

    /**
     * 格式化数字（添加千位分隔符）
     * @param {number} number - 数字
     * @param {number} decimals - 小数位数（默认0）
     * @returns {string} 格式化后的数字字符串
     */
    formatNumber(number, decimals = 0) {
        if (isNaN(number)) return '0';
        
        return number.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    /**
     * 截断文本并添加省略号
     * @param {string} text - 原始文本
     * @param {number} maxLength - 最大长度
     * @param {string} suffix - 后缀（默认'...'）
     * @returns {string} 截断后的文本
     */
    truncate(text, maxLength, suffix = '...') {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + suffix;
    },

    /**
     * 格式化百分比
     * @param {number} value - 数值（0-1之间的小数或0-100之间的整数）
     * @param {number} decimals - 小数位数（默认0）
     * @param {boolean} isDecimal - 是否为小数形式（默认false，即0-100）
     * @returns {string} 格式化后的百分比字符串
     */
    formatPercent(value, decimals = 0, isDecimal = false) {
        if (isNaN(value)) return '0%';
        
        const percent = isDecimal ? value * 100 : value;
        return percent.toFixed(decimals) + '%';
    },

    /**
     * 格式化持续时间（毫秒转可读格式）
     * @param {number} milliseconds - 毫秒数
     * @returns {string} 格式化后的持续时间
     */
    formatDuration(milliseconds) {
        if (isNaN(milliseconds)) return '0ms';
        
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}天 ${hours % 24}小时 ${minutes % 60}分钟`;
        } else if (hours > 0) {
            return `${hours}小时 ${minutes % 60}分钟 ${seconds % 60}秒`;
        } else if (minutes > 0) {
            return `${minutes}分钟 ${seconds % 60}秒`;
        } else if (seconds > 0) {
            return `${seconds}秒`;
        } else {
            return `${milliseconds}毫秒`;
        }
    },

    /**
     * 格式化相对时间（如"3分钟前"）
     * @param {Date|string|number} date - 日期对象、日期字符串或时间戳
     * @returns {string} 相对时间字符串
     */
    formatRelativeTime(date) {
        if (!date) return '未知';
        
        let dateObj;
        if (date instanceof Date) {
            dateObj = date;
        } else if (typeof date === 'string') {
            dateObj = new Date(date);
        } else if (typeof date === 'number') {
            dateObj = new Date(date);
        } else {
            return '未知';
        }
        
        if (isNaN(dateObj.getTime())) {
            return '未知';
        }
        
        const now = new Date();
        const diff = now - dateObj;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);
        
        if (years > 0) {
            return `${years}年前`;
        } else if (months > 0) {
            return `${months}个月前`;
        } else if (days > 0) {
            return `${days}天前`;
        } else if (hours > 0) {
            return `${hours}小时前`;
        } else if (minutes > 0) {
            return `${minutes}分钟前`;
        } else if (seconds > 0) {
            return `${seconds}秒前`;
        } else {
            return '刚刚';
        }
    },

    /**
     * 清理和规范化字符串
     * @param {string} str - 原始字符串
     * @param {boolean} trim - 是否去除首尾空格（默认true）
     * @returns {string} 清理后的字符串
     */
    cleanString(str, trim = true) {
        if (!str) return '';
        let cleaned = String(str);
        if (trim) {
            cleaned = cleaned.trim();
        }
        // 移除多余的空白字符
        cleaned = cleaned.replace(/\s+/g, ' ');
        return cleaned;
    },

    /**
     * 首字母大写
     * @param {string} str - 原始字符串
     * @returns {string} 首字母大写的字符串
     */
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },

    /**
     * 驼峰命名转换
     * @param {string} str - 原始字符串（如"hello-world"）
     * @returns {string} 驼峰命名（如"helloWorld"）
     */
    toCamelCase(str) {
        if (!str) return '';
        return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    },

    /**
     * 短横线命名转换
     * @param {string} str - 原始字符串（如"helloWorld"）
     * @returns {string} 短横线命名（如"hello-world"）
     */
    toKebabCase(str) {
        if (!str) return '';
        return str.replace(/([A-Z])/g, '-$1').toLowerCase();
    }
};
