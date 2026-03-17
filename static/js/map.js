// ==============================
// 地图相关全局变量
// ==============================
let myChart = null;
let allLocations = [];
let currentLocationId = null;
let tempLocationStack = [];
let editingLocationId = null;

let currentMapCode = '100000';        // 行政区代码
let currentMapName = 'china';         // ECharts 地图注册名
let currentGeoJson = null;            // 当前 GeoJSON 数据
let currentLevel = 'country';         // 'country' | 'province' | 'city'

// 自动保存（防抖）
let autosaveTimer = null;
let autosaveInFlight = false;

// ==============================
// 1. 初始化与地图加载
// ==============================

async function initMap() {
    const el = document.getElementById('mapContainer');
    if (!el) return;
    myChart = echarts.init(el);

    // 初始加载全国地图
    await loadAndRegisterMap('100000', 'china');
    // 加载用户数据
    await loadLocationsFromServer();

    renderMap();
}

/**
 * 根据 adcode 加载并注册地图，同时识别当前层级
 */
async function loadAndRegisterMap(adcode, mapName) {
    // 阿里云 DataV 高德地图边界数据接口
    const url = `https://geo.datav.aliyun.com/areas_v3/bound/geojson?code=${adcode}_full`;
    try {
        const resp = await fetch(url);
        const geoJson = await resp.json();
        echarts.registerMap(mapName, geoJson);

        currentMapCode = String(adcode);
        currentMapName = mapName;
        currentGeoJson = geoJson;

        // --- 层级判定逻辑 ---
        const codeStr = String(adcode);
        if (codeStr === '100000') {
            currentLevel = 'country';
        } else if (codeStr.endsWith('0000')) {
            // 省份代码通常以 0000 结尾（如 330000 浙江）
            currentLevel = 'province';
        } else {
            // 市级或直辖市下的区
            currentLevel = 'city';
        }
    } catch (e) {
        console.error('加载地图数据失败:', e);
    }
}

// 从当前地图数据中根据名字查 adcode
function getAdcodeByRegionName(regionName) {
    if (!currentGeoJson || !currentGeoJson.features) return null;
    const f = currentGeoJson.features.find(
        (fe) => fe.properties && String(fe.properties.name) === String(regionName)
    );
    return f && f.properties && f.properties.adcode ? String(f.properties.adcode) : null;
}

// ==============================
// 2. 核心渲染与交互逻辑
// ==============================

function renderMap() {
    if (!myChart) return;

    const scatterData = allLocations.map(loc => ({
        name: loc.name,
        value: [loc.longitude, loc.latitude, loc.id]
    }));

    const option = {
        title: {
            text: '我的旅行足迹',
            subtext: '单击区域进入下一级 | 仅在市级地图可添加标记',
            left: 'center',
            top: 20
        },
        tooltip: {
            trigger: 'item',
            formatter: (params) => params.componentSubType === 'scatter' ? params.name : params.name
        },
        geo: {
            map: currentMapName,
            roam: true,
            zoom: 1.2,
            label: { show: false },
            itemStyle: {
                areaColor: '#f3f3f3',
                borderColor: '#999'
            },
            emphasis: {
                itemStyle: { areaColor: '#ffeb3b' }
            }
        },
        series: [
            {
                name: '足迹',
                type: 'scatter',
                coordinateSystem: 'geo',
                data: scatterData,
                symbolSize: 12,
                itemStyle: { color: '#f44336' }
            }
        ]
    };

    myChart.setOption(option, true);

    // 渲染右侧地点列表
    renderLocationsList();

    // 清除旧事件
    myChart.off('click');

    // --- 单击事件统一处理 ---
    myChart.on('click', async function (params) {

        // A. 如果点击的是已有的红点（标记）
        if (params.componentSubType === 'scatter') {
            const locId = params.data.value[2];
            openLocationDetail(locId);
            return;
        }

        // B. 如果点击的是地图区域
        if (params.componentType === 'geo') {
            const targetName = params.name;
            const targetAdcode = getAdcodeByRegionName(targetName);

            // 1. 尝试下钻：如果点击的区域有 code 且不是当前区域
            if (targetAdcode && targetAdcode !== currentMapCode && currentLevel !== 'city') {
                await loadAndRegisterMap(targetAdcode, `map_${targetAdcode}`);
                renderMap();
                return;
            }

            // 2. 尝试添加标记：只有在 'city' 层级才允许
            if (currentLevel === 'city') {
                const lngLat = myChart.convertFromPixel({ geoIndex: 0 }, [params.event.offsetX, params.event.offsetY]);
                if (lngLat) {
                    addNewMarker(lngLat[0], lngLat[1]);
                }
            } else {
                console.log("当前层级不是市级，请先点击进入具体城市再添加标记。");
            }
        }
    });
}

function renderLocationsList() {
    const container = document.getElementById('locationsList');
    if (!container) return;

    if (!allLocations.length) {
        container.innerHTML = '<div style="padding:12px;color:#7F8C8D;">暂无地点，请在地图上添加标记。</div>';
        return;
    }

    // 最近创建的在前（如果没有 created_at，就保持现有顺序）
    const list = [...allLocations];

    container.innerHTML = '';
    list.forEach((loc) => {
        const item = document.createElement('div');
        item.className = 'location-item' + (loc.id === currentLocationId ? ' active' : '');
        item.onclick = () => {
            currentLocationId = loc.id;
            // 地图定位到该点
            focusLocationOnMap(loc);
            // 打开详情
            openLocationDetail(loc.id);
            // 刷新高亮
            renderLocationsList();
        };

        const title = document.createElement('h3');
        title.textContent = loc.name || '未命名地点';

        const desc = document.createElement('p');
        const subtitleParts = [];
        if (loc.visit_date) subtitleParts.push(loc.visit_date);
        if (loc.latitude != null && loc.longitude != null) subtitleParts.push(`${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}`);
        desc.textContent = subtitleParts.join(' · ') || (loc.description || '');

        item.appendChild(title);
        item.appendChild(desc);
        container.appendChild(item);
    });
}

function focusLocationOnMap(loc) {
    if (!myChart || !loc) return;
    const lng = loc.longitude;
    const lat = loc.latitude;
    if (lng == null || lat == null) return;

    // 适度放大并居中
    myChart.setOption({
        geo: {
            center: [lng, lat],
            zoom: Math.max(3, (myChart.getOption()?.geo?.[0]?.zoom ?? 1.2))
        }
    });
}

// 添加新标记的逻辑
function addNewMarker(lng, lat) {
    let name = window.prompt('请输入景点名称：', '新地点');
    if (!name) return;

    const id = `temp-${Date.now()}`;
    const newLoc = {
        id: id,
        name: name.trim(),
        longitude: lng,
        latitude: lat,
        description: '',
        images: []
    };
    allLocations.push(newLoc);
    tempLocationStack.push(id);
    renderMap();
    openLocationDetail(id);
}

// ==============================
// 3. 后端交互与弹窗（保持原有逻辑）
// ==============================

async function loadLocationsFromServer() {
    if (typeof getLocations !== 'function') return;
    try {
        const resp = await getLocations();
        const list = (resp && resp.locations) || [];
        allLocations = list.map(loc => ({
            id: loc.id,
            name: loc.name,
            description: loc.description || '',
            visit_date: loc.visit_date || '',
            latitude: loc.latitude,
            longitude: loc.longitude,
            images: (loc.images || []).map(img => ({
                id: img.id,
                url: `/uploads/${img.filename}`
            }))
        }));
        renderLocationsList();
    } catch (e) {
        console.error('加载地点失败:', e);
    }
}

function openLocationDetail(id) {
    editingLocationId = id;
    const loc = allLocations.find(l => l.id === id);
    if (!loc) return;

    // 更新 DOM 元素（假设你页面已有这些 ID 的元素）
    const modal = document.getElementById('locationModal');
    if (modal) {
        const titleEl = document.getElementById('modalTitle');
        const nameEl = document.getElementById('locationName');
        const dateEl = document.getElementById('visitDate');
        const latEl = document.getElementById('latitude');
        const lngEl = document.getElementById('longitude');
        const descEl = document.getElementById('description');
        const deleteBtn = document.getElementById('deleteBtn');

        if (titleEl) titleEl.textContent = `地点详情：${loc.name || ''}`;
        if (nameEl) nameEl.value = loc.name || '';
        if (dateEl) dateEl.value = loc.visit_date || '';
        if (latEl) latEl.value = loc.latitude != null ? loc.latitude : '';
        if (lngEl) lngEl.value = loc.longitude != null ? loc.longitude : '';
        if (descEl) descEl.value = loc.description || '';
        // 显示“删除”按钮（标记点可删除）
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
        modal.style.display = 'flex';
    }
}

function scheduleAutosave() {
    if (!editingLocationId) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
        autosaveCurrentLocation().catch((e) => console.error('自动保存失败:', e));
    }, 400);
}

async function autosaveCurrentLocation() {
    if (!editingLocationId) return;
    if (autosaveInFlight) return;

    const loc = allLocations.find(l => l.id === editingLocationId);
    if (!loc) return;

    const payload = {
        name: (document.getElementById('locationName')?.value || loc.name || '').trim(),
        description: document.getElementById('description')?.value || '',
        visit_date: document.getElementById('visitDate')?.value || '',
        latitude: parseFloat(document.getElementById('latitude')?.value) || loc.latitude,
        longitude: parseFloat(document.getElementById('longitude')?.value) || loc.longitude,
    };

    // 更新本地
    loc.name = payload.name || loc.name;
    loc.description = payload.description;
    loc.visit_date = payload.visit_date;

    autosaveInFlight = true;
    try {
        if (String(editingLocationId).startsWith('temp-')) {
            if (typeof createLocation === 'function') {
                const resp = await createLocation(payload);
                if (resp && resp.location && resp.location.id) {
                    const newId = resp.location.id;
                    loc.id = newId;
                    editingLocationId = newId;
                }
            }
        } else {
            if (typeof updateLocation === 'function') {
                await updateLocation(editingLocationId, payload);
            }
        }
        renderMap();
    } finally {
        autosaveInFlight = false;
    }
}

// 关闭地点详情弹窗
function closeLocationModal() {
    const modal = document.getElementById('locationModal');
    if (modal) modal.style.display = 'none';
    editingLocationId = null;
}

// 删除当前标记（后端已有则同步删除）
async function deleteCurrentLocation() {
    if (!editingLocationId) return;
    const ok = window.confirm('确定要删除这个地点标记吗？');
    if (!ok) return;

    const id = editingLocationId;
    closeLocationModal();
    allLocations = allLocations.filter(l => l.id !== id);
    tempLocationStack = tempLocationStack.filter(x => x !== id);
    if (currentLocationId === id) currentLocationId = null;
    renderMap();
    renderLocationsList();

    if (!String(id).startsWith('temp-') && typeof deleteLocation === 'function') {
        try { await deleteLocation(id); } catch (e) { console.error('删除失败:', e); }
    }
}

// 兼容 index.html 里按钮的函数名：返回上一级
async function backToCountry() {
    return backToPrevLevel();
}

// 绑定地点表单事件：关键是阻止默认提交，避免页面刷新跳回登录页
(function bindLocationForm() {
    const form = document.getElementById('locationForm');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault(); // <<< 防止页面刷新/跳转
        // 手动“保存”仅用于强制提交一次并关闭弹窗
        await autosaveCurrentLocation();
        closeLocationModal();
        if (typeof showNotification === 'function') {
            showNotification('已保存', 'success');
        }
    });

    // 输入即自动保存
    const nameEl = document.getElementById('locationName');
    const descEl = document.getElementById('description');
    const dateEl = document.getElementById('visitDate');
    if (nameEl) nameEl.addEventListener('input', scheduleAutosave);
    if (descEl) descEl.addEventListener('input', scheduleAutosave);
    if (dateEl) dateEl.addEventListener('change', scheduleAutosave);
})();

// 返回上一级
async function backToPrevLevel() {
    if (currentLevel === 'city') {
        // 回到省
        const provinceCode = `${currentMapCode.slice(0, 2)}0000`;
        await loadAndRegisterMap(provinceCode, `map_${provinceCode}`);
    } else if (currentLevel === 'province') {
        // 回到全国
        await loadAndRegisterMap('100000', 'china');
    }
    renderMap();
}