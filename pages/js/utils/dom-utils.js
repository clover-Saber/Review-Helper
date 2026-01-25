// DOM工具函数模块：提供DOM操作相关的工具函数

window.DomUtils = {
    /**
     * HTML转义：将文本中的HTML特殊字符转义，防止XSS攻击
     * @param {string} text - 需要转义的文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * 获取元素
     * @param {string} selector - CSS选择器或元素ID
     * @returns {HTMLElement|null} 找到的元素，未找到返回null
     */
    $(selector) {
        if (selector.startsWith('#')) {
            return document.getElementById(selector.slice(1));
        }
        return document.querySelector(selector);
    },

    /**
     * 获取所有匹配的元素
     * @param {string} selector - CSS选择器
     * @returns {NodeList} 匹配的元素列表
     */
    $$(selector) {
        return document.querySelectorAll(selector);
    },

    /**
     * 创建元素
     * @param {string} tag - HTML标签名
     * @param {Object} attributes - 属性对象
     * @param {string|HTMLElement} content - 内容（文本或元素）
     * @returns {HTMLElement} 创建的元素
     */
    createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);
        
        // 设置属性
        Object.keys(attributes).forEach(key => {
            if (key === 'className') {
                element.className = attributes[key];
            } else if (key === 'style' && typeof attributes[key] === 'object') {
                Object.assign(element.style, attributes[key]);
            } else {
                element.setAttribute(key, attributes[key]);
            }
        });
        
        // 设置内容
        if (typeof content === 'string') {
            element.textContent = content;
        } else if (content instanceof HTMLElement) {
            element.appendChild(content);
        }
        
        return element;
    },

    /**
     * 添加事件监听器（支持事件委托）
     * @param {string|HTMLElement} target - 目标元素或选择器
     * @param {string} event - 事件类型
     * @param {string|Function} handler - 事件处理函数或委托选择器
     * @param {Function} delegateHandler - 委托处理函数（当handler为选择器时使用）
     */
    on(target, event, handler, delegateHandler = null) {
        const element = typeof target === 'string' ? this.$(target) : target;
        if (!element) return;

        if (delegateHandler) {
            // 事件委托
            element.addEventListener(event, (e) => {
                const delegateTarget = e.target.closest(handler);
                if (delegateTarget) {
                    delegateHandler.call(delegateTarget, e);
                }
            });
        } else {
            // 普通事件监听
            element.addEventListener(event, handler);
        }
    },

    /**
     * 移除事件监听器
     * @param {string|HTMLElement} target - 目标元素或选择器
     * @param {string} event - 事件类型
     * @param {Function} handler - 事件处理函数
     */
    off(target, event, handler) {
        const element = typeof target === 'string' ? this.$(target) : target;
        if (element) {
            element.removeEventListener(event, handler);
        }
    },

    /**
     * 显示元素
     * @param {string|HTMLElement} element - 元素ID或元素对象
     * @param {string} display - 显示方式（默认'block'）
     */
    show(element, display = 'block') {
        const el = typeof element === 'string' ? this.$(element) : element;
        if (el) {
            el.style.display = display;
        }
    },

    /**
     * 隐藏元素
     * @param {string|HTMLElement} element - 元素ID或元素对象
     */
    hide(element) {
        const el = typeof element === 'string' ? this.$(element) : element;
        if (el) {
            el.style.display = 'none';
        }
    },

    /**
     * 切换元素显示/隐藏
     * @param {string|HTMLElement} element - 元素ID或元素对象
     * @param {string} display - 显示方式（默认'block'）
     */
    toggle(element, display = 'block') {
        const el = typeof element === 'string' ? this.$(element) : element;
        if (el) {
            el.style.display = el.style.display === 'none' ? display : 'none';
        }
    },

    /**
     * 添加CSS类
     * @param {string|HTMLElement} element - 元素ID或元素对象
     * @param {string} className - CSS类名
     */
    addClass(element, className) {
        const el = typeof element === 'string' ? this.$(element) : element;
        if (el) {
            el.classList.add(className);
        }
    },

    /**
     * 移除CSS类
     * @param {string|HTMLElement} element - 元素ID或元素对象
     * @param {string} className - CSS类名
     */
    removeClass(element, className) {
        const el = typeof element === 'string' ? this.$(element) : element;
        if (el) {
            el.classList.remove(className);
        }
    },

    /**
     * 切换CSS类
     * @param {string|HTMLElement} element - 元素ID或元素对象
     * @param {string} className - CSS类名
     */
    toggleClass(element, className) {
        const el = typeof element === 'string' ? this.$(element) : element;
        if (el) {
            el.classList.toggle(className);
        }
    },

    /**
     * 设置元素文本内容
     * @param {string|HTMLElement} element - 元素ID或元素对象
     * @param {string} text - 文本内容
     */
    setText(element, text) {
        const el = typeof element === 'string' ? this.$(element) : element;
        if (el) {
            el.textContent = text;
        }
    },

    /**
     * 设置元素HTML内容
     * @param {string|HTMLElement} element - 元素ID或元素对象
     * @param {string} html - HTML内容
     */
    setHTML(element, html) {
        const el = typeof element === 'string' ? this.$(element) : element;
        if (el) {
            el.innerHTML = html;
        }
    },

    /**
     * 获取元素文本内容
     * @param {string|HTMLElement} element - 元素ID或元素对象
     * @returns {string} 文本内容
     */
    getText(element) {
        const el = typeof element === 'string' ? this.$(element) : element;
        return el ? el.textContent : '';
    },

    /**
     * 设置元素属性
     * @param {string|HTMLElement} element - 元素ID或元素对象
     * @param {string} name - 属性名
     * @param {string} value - 属性值
     */
    setAttr(element, name, value) {
        const el = typeof element === 'string' ? this.$(element) : element;
        if (el) {
            el.setAttribute(name, value);
        }
    },

    /**
     * 获取元素属性
     * @param {string|HTMLElement} element - 元素ID或元素对象
     * @param {string} name - 属性名
     * @returns {string|null} 属性值
     */
    getAttr(element, name) {
        const el = typeof element === 'string' ? this.$(element) : element;
        return el ? el.getAttribute(name) : null;
    }
};
