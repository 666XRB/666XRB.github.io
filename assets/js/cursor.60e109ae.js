/**
 * CrystalCursor - 水晶月光风格的自定义光标效果
 * 
 * 这个类创建了一个高度自定义的光标效果，具有以下特点：
 * 1. 月亮主题的光标主体，带有发光和脉动光环效果
 * 2. 拖尾粒子效果，跟随光标移动形成流星般的轨迹
 * 3. 点击时产生水晶爆炸和冲击波动画
 * 4. 悬停在元素上时产生涟漪效果
 * 5. 根据不同的交互元素自动改变光标样式（链接、文本输入、可拖动元素等）
 * 6. 平滑的动画和过渡效果
 * 7. 移动设备检测并禁用效果
 */

class CrystalCursor {
    constructor() {
        // 检测是否为触摸设备，如果是则不做任何处理
        if (window.matchMedia("(hover: none)").matches) {
            return;
        }

        // 初始化各种状态和属性
        this.pos = { curr: null, prev: null }; // 存储当前和之前的光标位置
        this.trailParticles = []; // 存储拖尾粒子
        this.clickParticles = []; // 存储点击粒子
        this.trailLength = 20; // 拖尾粒子的数量
        this.lastEmitTime = 0; // 上次发射粒子的时间
        this.angle = 0; // 光标移动角度
        this.currentPointer = 'normal'; // 当前指针类型
        // 线性插值函数，用于平滑移动
        this.lerp = (a, b, n) => (1 - n) * a + n * b;
        
        // 创建光标DOM元素
        this.cursor = document.createElement("div");
        this.cursor.id = "moonlight-cursor";
        this.cursor.className = "hidden"; // 初始隐藏
        // 光标内部结构：月亮圆盘、月牙、发光效果和三个光环
        this.cursor.innerHTML = `
            <div class="moon-disc"></div>
            <div class="moon-crescent"></div>
            <div class="moon-glow"></div>
            <div class="moon-rings">
                <div class="ring ring-1"></div>
                <div class="ring ring-2"></div>
                <div class="ring ring-3"></div>
            </div>
        `;
        document.body.append(this.cursor);
        
        // 创建拖尾粒子
        for (let i = 0; i < this.trailLength; i++) {
            const particle = document.createElement("div");
            particle.className = "crystal-trail";
            particle.style.setProperty('--i', i);
            document.body.appendChild(particle);
            // 每个粒子有自己的位置、大小、延迟等属性
            this.trailParticles.push({
                el: particle,
                pos: { x: 0, y: 0 },
                size: 1 + Math.random() * 1.5,
                delay: i * 0.02,
                life: 0,
                speed: 0.5 + Math.random() * 0.5,
                angle: 0
            });
        }
        
        // 初始化事件监听器
        this.initEventListeners();
        // 开始渲染动画
        this.raf = requestAnimationFrame(() => this.render());
    }

    // 初始化所有事件监听器
    initEventListeners() {
        // 绑定各种事件处理方法
        this.mouseMoveHandler = e => this.handleMouseMove(e);
        this.mouseEnterHandler = () => this.cursor.classList.remove("hidden");
        this.mouseLeaveHandler = () => this.cursor.classList.add("hidden");
        this.mouseDownHandler = e => this.handleMouseDown(e);
        this.mouseUpHandler = () => this.cursor.classList.remove("active");
        
        // 添加基本鼠标事件监听
        document.addEventListener('mousemove', this.mouseMoveHandler);
        document.addEventListener('mouseenter', this.mouseEnterHandler);
        document.addEventListener('mouseleave', this.mouseLeaveHandler);
        document.addEventListener('mousedown', this.mouseDownHandler);
        document.addEventListener('mouseup', this.mouseUpHandler);
        
        // 为可悬停元素添加事件监听
        this.hoverElements = document.querySelectorAll('a, button, [data-hover]');
        this.hoverElements.forEach(el => {
            el.addEventListener('mouseenter', this.handleHoverEnter.bind(this));
            el.addEventListener('mouseleave', this.handleHoverLeave.bind(this));
        });

        // 为文本输入元素添加事件监听
        this.textElements = document.querySelectorAll('input, textarea, [contenteditable]');
        this.textElements.forEach(el => {
            el.addEventListener('mouseenter', () => this.setPointer('text'));
            el.addEventListener('mouseleave', () => this.setPointer('normal'));
        });

        // 为禁用元素添加事件监听
        this.disabledElements = document.querySelectorAll('[disabled]');
        this.disabledElements.forEach(el => {
            el.addEventListener('mouseenter', () => this.setPointer('unavailable'));
            el.addEventListener('mouseleave', () => this.setPointer('normal'));
        });

        // 为可拖动元素添加事件监听
        this.draggableElements = document.querySelectorAll('[draggable="true"]');
        this.draggableElements.forEach(el => {
            el.addEventListener('mouseenter', () => this.setPointer('move'));
            el.addEventListener('mouseleave', () => this.setPointer('normal'));
        });
    }

    // 处理鼠标移动事件
    handleMouseMove(e) {
        const now = Date.now();
        // 限制粒子发射频率
        if (now - this.lastEmitTime > 16) {
            // 如果是第一次移动，初始化位置
            if (this.pos.curr === null) {
                this.move(e.clientX - 6, e.clientY - 6);
            }
            // 更新当前位置
            this.pos.curr = { x: e.clientX, y: e.clientY };
            this.cursor.classList.remove("hidden");
            
            // 计算移动角度
            if (this.pos.prev) {
                const dx = this.pos.curr.x - this.pos.prev.x;
                const dy = this.pos.curr.y - this.pos.prev.y;
                this.angle = Math.atan2(dy, dx);
            }
            
            // 激活拖尾粒子
            this.activateTrailParticle();
            this.lastEmitTime = now;
        }
    }

    // 处理鼠标按下事件
    handleMouseDown(e) {
        this.cursor.classList.add("active");
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        // 创建点击效果
        this.createCrystalBurst(e.clientX + scrollX, e.clientY + scrollY);
        this.createShockwave(e.clientX + scrollX, e.clientY + scrollY);
    }

    // 处理悬停进入事件
    handleHoverEnter(e) {
        this.setPointer('link');
        this.cursor.classList.add('hover');
        const rect = e.target.getBoundingClientRect();
        // 创建涟漪效果
        this.createRippleEffect(rect);
    }

    // 处理悬停离开事件
    handleHoverLeave() {
        this.setPointer('normal');
        this.cursor.classList.remove('hover');
    }

    // 设置指针样式
    setPointer(type) {
        this.currentPointer = type;
        // 定义不同类型的光标样式映射
        const cursorMap = {
            normal: 'url(/img/normal.cur), default',
            link: 'url(/img/link.cur), pointer',
            text: 'url(/img/text.cur), text',
            move: 'url(/img/move.cur), move',
            help: 'url(/img/help.cur), help',
            unavailable: 'url(/img/unavailable.cur), not-allowed',
            busy: 'url(/img/busy.ani), wait',
            working: 'url(/img/working.ani), progress',
            precision: 'url(/img/precision.cur), crosshair'
        };

        document.body.style.cursor = cursorMap[type] || cursorMap.normal;
    }

    // 移动光标到指定位置
    move(left, top) {
        this.cursor.style.left = `${left}px`;
        this.cursor.style.top = `${top}px`;
    }

    // 激活拖尾粒子
    activateTrailParticle() {
        // 找到一个可用的粒子
        const particle = this.trailParticles.find(p => p.life <= 0);
        if (particle && this.pos.prev) {
            // 初始化粒子属性
            particle.life = 1;
            particle.pos.x = this.pos.prev.x;
            particle.pos.y = this.pos.prev.y;
            particle.size = 1 + Math.random() * 2;
            particle.el.style.width = `${particle.size}px`;
            particle.el.style.height = `${particle.size * 1.5}px`;
            particle.el.style.opacity = '0.8';
            particle.el.style.borderRadius = '50%';
            
            // 设置粒子角度
            if (this.angle) {
                particle.angle = this.angle;
                particle.el.style.transform = `translate(-50%, -50%) rotate(${particle.angle + Math.PI/2}rad)`;
            }
            
            // 设置粒子颜色和发光效果
            const hue = 270 + Math.random() * 30 - 15;
            particle.el.style.background = `linear-gradient(to bottom, 
                hsla(${hue}, 100%, 70%, 0.9), 
                hsla(${hue + 20}, 100%, 50%, 0.5))`;
            particle.el.style.boxShadow = `0 0 5px hsla(${hue}, 100%, 70%, 0.8)`;
        }
    }

    // 创建水晶爆炸效果
    createCrystalBurst(x, y) {
        const colors = ['#8a2be2', '#9932cc', '#ba55d3', '#da70d6', '#d8bfd8'];
        const count = 50; // 爆炸粒子数量
        
        for (let i = 0; i < count; i++) {
            const crystal = document.createElement('div');
            crystal.className = 'crystal-burst';
            crystal.style.left = `${x}px`;
            crystal.style.top = `${y}px`;
            crystal.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            document.body.appendChild(crystal);
            
            // 设置粒子动画属性
            const angle = Math.random() * Math.PI * 2;
            const velocity = 0.5 + Math.random() * 2;
            const lifetime = 800 + Math.random() * 400;
            const size = 2 + Math.random() * 12;
            const rotation = Math.random() * 360;
            
            crystal.style.width = `${size}px`;
            crystal.style.height = `${size}px`;
            crystal.style.transform = `rotate(${rotation}deg)`;
            crystal.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
            
            // 粒子动画函数
            const animate = (startTime) => {
                const now = Date.now();
                const progress = (now - startTime) / lifetime;
                
                if (progress >= 1) {
                    crystal.remove();
                    return;
                }
                
                // 计算粒子当前位置和状态
                const distance = velocity * progress * 50;
                const currentX = x + Math.cos(angle) * distance;
                const currentY = y + Math.sin(angle) * distance;
                const opacity = 1 - progress;
                const scale = 0.5 + progress * 0.5;
                
                // 更新粒子样式
                crystal.style.transform = `translate(${currentX - x}px, ${currentY - y}px) rotate(${rotation + progress * 360}deg) scale(${scale})`;
                crystal.style.opacity = opacity;
                
                requestAnimationFrame(() => animate(startTime));
            };
            
            requestAnimationFrame(() => animate(Date.now()));
        }
    }

    // 创建冲击波效果
    createShockwave(x, y) {
        const wave = document.createElement('div');
        wave.className = 'shockwave';
        wave.style.left = `${x}px`;
        wave.style.top = `${y}px`;
        document.body.appendChild(wave);
        
        const startTime = Date.now();
        const duration = 600;
        
        // 冲击波动画函数
        const animate = () => {
            const now = Date.now();
            const progress = (now - startTime) / duration;
            
            if (progress >= 1) {
                wave.remove();
                return;
            }
            
            // 计算冲击波大小和透明度
            const size = progress * 50;
            const opacity = 1 - progress;
            
            wave.style.width = `${size}px`;
            wave.style.height = `${size}px`;
            wave.style.opacity = opacity;
            wave.style.borderWidth = `${1 - progress * 1}px`;
            
            requestAnimationFrame(animate);
        };
        
        requestAnimationFrame(animate);
    }

    // 创建悬停时的涟漪效果
    createRippleEffect(rect) {
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        const ripple = document.createElement('div');
        ripple.className = 'ripple-effect';
        ripple.style.left = `${rect.left + rect.width/2 + scrollX}px`;
        ripple.style.top = `${rect.top + rect.height/2 + scrollY}px`;
        document.body.appendChild(ripple);
        
        // 1秒后移除涟漪元素
        setTimeout(() => {
            ripple.remove();
        }, 1000);
    }

    // 主渲染函数
    render() {
        if (this.pos.prev && this.pos.curr) {
            // 使用线性插值平滑移动光标
            this.pos.prev.x = this.lerp(this.pos.prev.x, this.pos.curr.x, 0.2);
            this.pos.prev.y = this.lerp(this.pos.prev.y, this.pos.curr.y, 0.2);
            this.move(this.pos.prev.x - 6, this.pos.prev.y - 6);
            
            // 更新拖尾粒子
            this.trailParticles.forEach((p) => {
                if (p.life > 0) {
                    p.life -= p.speed * 0.02;
                    
                    // 根据角度移动粒子
                    const distance = (1 - p.life) * 15;
                    p.pos.x += Math.cos(p.angle) * distance * 0.1;
                    p.pos.y += Math.sin(p.angle) * distance * 0.1;
                    
                    // 更新粒子位置和透明度
                    p.el.style.left = `${p.pos.x}px`;
                    p.el.style.top = `${p.pos.y}px`;
                    p.el.style.opacity = p.life * 0.8;
                    
                    // 粒子拖尾长度变化
                    const tailLength = 3 + (1 - p.life) * 2.5;
                    p.el.style.height = `${p.size * tailLength}px`;
                    
                    if (p.life <= 0) {
                        p.el.style.opacity = '0';
                    }
                }
            });
            
            // 月亮发光强度变化
            const glowIntensity = Math.abs(Math.sin(Date.now() * 0.003)) * 0.3 + 0.7;
            this.cursor.querySelector('.moon-glow').style.opacity = glowIntensity;
            
            // 光环脉动效果
            const pulse = Math.abs(Math.sin(Date.now() * 0.002)) * 0.2 + 0.8;
            this.cursor.querySelector('.ring-1').style.transform = `translate(-50%, -50%) scale(${pulse})`;
            this.cursor.querySelector('.ring-2').style.transform = `translate(-50%, -50%) scale(${pulse * 1.1})`;
            this.cursor.querySelector('.ring-3').style.transform = `translate(-50%, -50%) scale(${pulse * 1.2})`;
        } else {
            this.pos.prev = this.pos.curr;
        }
        
        // 继续渲染循环
        this.raf = requestAnimationFrame(() => this.render());
    }

    // 销毁方法，清理所有资源和事件监听
    destroy() {
        cancelAnimationFrame(this.raf);
        
        // 移除所有事件监听
        document.removeEventListener('mousemove', this.mouseMoveHandler);
        document.removeEventListener('mouseenter', this.mouseEnterHandler);
        document.removeEventListener('mouseleave', this.mouseLeaveHandler);
        document.removeEventListener('mousedown', this.mouseDownHandler);
        document.removeEventListener('mouseup', this.mouseUpHandler);
        
        this.hoverElements.forEach(el => {
            el.removeEventListener('mouseenter', this.handleHoverEnter);
            el.removeEventListener('mouseleave', this.handleHoverLeave);
        });
        
        this.textElements.forEach(el => {
            el.removeEventListener('mouseenter', () => this.setPointer('text'));
            el.removeEventListener('mouseleave', () => this.setPointer('normal'));
        });
        
        this.disabledElements.forEach(el => {
            el.removeEventListener('mouseenter', () => this.setPointer('unavailable'));
            el.removeEventListener('mouseleave', () => this.setPointer('normal'));
        });
        
        this.draggableElements.forEach(el => {
            el.removeEventListener('mouseenter', () => this.setPointer('move'));
            el.removeEventListener('mouseleave', () => this.setPointer('normal'));
        });
        
        // 移除所有DOM元素
        this.cursor.remove();
        this.trailParticles.forEach(p => p.el.remove());
        document.body.style.cursor = '';
    }
}

// 立即执行函数，创建并管理光标实例
(() => {
    const CRYSTAL_CURSOR = new CrystalCursor();
    // 页面卸载前清理资源
    window.addEventListener('beforeunload', () => {
        CRYSTAL_CURSOR.destroy();
    });
})();
