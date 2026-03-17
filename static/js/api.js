// API 基础配置
const API_BASE_URL = 'http://localhost:5000/api';
let authToken = localStorage.getItem('authToken');

// 设置请求头
function getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
}

// 通用请求函数
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = getHeaders();

    try {
        const response = await fetch(url, {
            headers: { ...headers, ...options.headers },
            ...options
        });

        if (response.status === 401) {
            // 不要在请求失败时强制跳回首页；只提示并抛错
            throw new Error('登录已过期或未登录，请重新登录');
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '请求失败');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        showNotification(error.message, 'error');
        throw error;
    }
}

// === 认证接口 ===
async function login(username, password) {
    const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });

    if (data && data.access_token) {
        authToken = data.access_token;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        return data;
    }
    return null;
}

async function register(username, email, password) {
    return await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password })
    });
}

async function getProfile() {
    return await apiRequest('/auth/profile');
}

// === 地点接口 ===
async function getLocations() {
    return await apiRequest('/locations');
}

async function getLocation(locationId) {
    return await apiRequest(`/locations/${locationId}`);
}

async function createLocation(data) {
    return await apiRequest('/locations', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function updateLocation(locationId, data) {
    return await apiRequest(`/locations/${locationId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

async function deleteLocation(locationId) {
    return await apiRequest(`/locations/${locationId}`, {
        method: 'DELETE'
    });
}

// === 图片接口 ===
async function uploadImage(locationId, file) {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${API_BASE_URL}/images/upload/${locationId}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData
        });

        if (response.status === 401) {
            throw new Error('登录已过期或未登录，请重新登录');
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '上传失败');
        }

        return data;
    } catch (error) {
        console.error('Upload Error:', error);
        showNotification(error.message, 'error');
        throw error;
    }
}

async function getImages(locationId) {
    return await apiRequest(`/images/${locationId}`);
}

async function deleteImage(imageId) {
    return await apiRequest(`/images/${imageId}`, {
        method: 'DELETE'
    });
}

// === 分享接口 ===
async function createShare(data) {
    return await apiRequest('/sharing/create', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function getShares() {
    return await apiRequest('/sharing/list');
}

async function deleteShare(shareId) {
    return await apiRequest(`/sharing/${shareId}`, {
        method: 'DELETE'
    });
}