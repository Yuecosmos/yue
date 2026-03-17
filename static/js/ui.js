// ui.js - 登录/注册切换与基础 UI 工具

// 通用消息提示（与 index.html 中的 #notification 对应）
function showNotification(message, type = 'info') {
    const el = document.getElementById('notification');
    if (!el) {
        // 兜底
        alert(message);
        return;
    }

    el.textContent = message;
    el.className = `notification ${type}`;
    el.style.display = 'block';

    setTimeout(() => {
        el.style.display = 'none';
    }, 3000);
}

// 切换登录/注册表单
function switchAuthTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginTabBtn = document.querySelector('.tab-btn[onclick*="login"]');
    const registerTabBtn = document.querySelector('.tab-btn[onclick*="register"]');

    if (tab === 'login') {
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
        loginTabBtn.classList.add('active');
        registerTabBtn.classList.remove('active');
    } else if (tab === 'register') {
        loginForm.classList.remove('active');
        registerForm.classList.add('active');
        loginTabBtn.classList.remove('active');
        registerTabBtn.classList.add('active');
    }
}

// 处理登录表单提交，调用后端接口
document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        alert('请输入用户名和密码！');
        return;
    }

    try {
        console.log('登录请求:', username);
        const data = await login(username, password);
        if (data) {
            showNotification('登录成功，正在进入应用...', 'success');
            // 切换到主页面
            document.getElementById('authPage').classList.remove('active');
            document.getElementById('mapPage').classList.add('active');
            // 初始化地图
            if (typeof initMap === 'function') {
                initMap();
            }
        }
    } catch (error) {
        console.error('登录失败:', error);
        // 具体错误提示已在 api.js 的 showNotification 中处理
    }
});

// 处理注册表单提交，调用后端接口
document.getElementById('registerForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const password2 = document.getElementById('registerPassword2').value;

    if (password !== password2) {
        alert('两次输入的密码不一致！');
        return;
    }

    if (password.length < 6) {
        alert('密码至少为 6 位！');
        return;
    }

    try {
        console.log('注册请求:', username, email, password);
        await register(username, email, password);
        showNotification('注册成功，请使用该账号登录。', 'success');
        switchAuthTab('login');
    } catch (error) {
        // api.js 中已通过 showNotification 显示错误，这里保持静默或简单提示
        console.error('注册失败:', error);
    }
});

// 用户菜单下拉切换
function toggleUserMenu() {
    const menu = document.getElementById('userMenuDropdown');
    if(menu.style.display === 'none' || menu.style.display === ''){
        menu.style.display = 'block';
    } else {
        menu.style.display = 'none';
    }
}

// 页面点击其他地方关闭用户菜单
document.addEventListener('click', function(e){
    const menu = document.getElementById('userMenuDropdown');
    const button = document.querySelector('.user-menu .btn-icon');
    if(!menu.contains(e.target) && !button.contains(e.target)){
        menu.style.display = 'none';
    }
});

// 退出登录
function logout() {
    authToken = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');

    // 切回登录页面
    document.getElementById('mapPage').classList.remove('active');
    document.getElementById('authPage').classList.add('active');

    showNotification('已退出登录', 'info');
}

// =========================
// 导出 & 分享（弹窗功能）
// =========================

function showExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) modal.style.display = 'flex';
}

function closeExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) modal.style.display = 'none';
}

function showShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) modal.style.display = 'flex';
}

function closeShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) modal.style.display = 'none';
}

function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function toCsvValue(v) {
    const s = (v ?? '').toString().replace(/"/g, '""');
    return `"${s}"`;
}

function normalizeLocationForExport(loc) {
    return {
        id: loc?.id ?? '',
        name: loc?.name ?? '',
        description: loc?.description ?? '',
        visit_date: loc?.visit_date ?? '',
        latitude: loc?.latitude ?? '',
        longitude: loc?.longitude ?? '',
    };
}

// 导出当前地点数据（使用 map.js 里的全局 allLocations）
function exportData(format) {
    try {
        const raw = (typeof allLocations !== 'undefined' && Array.isArray(allLocations)) ? allLocations : [];
        const data = raw.map(normalizeLocationForExport);

        if (format === 'json') {
            // JSON：直接导出地点数组，格式更干净
            downloadFile('travel_map_export.json', JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
            closeExportModal();
            showNotification('已导出 JSON', 'success');
            return;
        }

        if (format === 'csv') {
            const header = ['id', 'name', 'description', 'visit_date', 'latitude', 'longitude'];
            const rows = [header.join(',')];
            data.forEach((loc) => {
                rows.push([
                    toCsvValue(loc.id),
                    toCsvValue(loc.name),
                    toCsvValue(loc.description),
                    toCsvValue(loc.visit_date),
                    toCsvValue(loc.latitude),
                    toCsvValue(loc.longitude),
                ].join(','));
            });
            // CSV：加 UTF-8 BOM，且使用 Windows 换行，便于 Excel 正常打开
            const bom = '\uFEFF';
            downloadFile('travel_map_export.csv', bom + rows.join('\r\n'), 'text/csv;charset=utf-8');
            closeExportModal();
            showNotification('已导出 CSV', 'success');
            return;
        }

        showNotification('未知导出格式', 'error');
    } catch (e) {
        console.error('导出失败:', e);
        showNotification('导出失败', 'error');
    }
}

// 生成分享链接：把数据压到 URL hash（不依赖后端）
function createShare() {
    try {
        const title = (document.getElementById('shareTitle')?.value || '').trim();
        const description = (document.getElementById('shareDescription')?.value || '').trim();
        const isPublic = !!document.getElementById('sharePublic')?.checked;
        const data = (typeof allLocations !== 'undefined' && Array.isArray(allLocations)) ? allLocations : [];

        const sharePayload = {
            v: 1,
            title,
            description,
            public: isPublic,
            created_at: new Date().toISOString(),
            locations: data
        };

        const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(sharePayload)))));
        const link = `${location.origin}${location.pathname}#share=${encoded}`;

        const result = document.getElementById('shareResult');
        const linkEl = document.getElementById('shareLink');
        if (linkEl) linkEl.value = link;
        if (result) result.style.display = 'block';

        showNotification('分享链接已生成', 'success');
    } catch (e) {
        console.error('生成分享链接失败:', e);
        showNotification('生成分享链接失败', 'error');
    }
}

async function copyShareLink() {
    const linkEl = document.getElementById('shareLink');
    const link = linkEl ? linkEl.value : '';
    if (!link) {
        showNotification('没有可复制的链接', 'warning');
        return;
    }
    try {
        await navigator.clipboard.writeText(link);
        showNotification('已复制链接', 'success');
    } catch (e) {
        // 兼容旧浏览器
        if (linkEl) {
            linkEl.select();
            document.execCommand('copy');
            showNotification('已复制链接', 'success');
        }
    }
}