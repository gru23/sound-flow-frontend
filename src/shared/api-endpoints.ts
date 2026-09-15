// export const API_BASE_URL = 'http://10.99.150.137:8080';//'http://localhost:8080';
export const API_BASE_URL = 'http://192.168.100.25:8080';
// export const API_BASE_URL = 'http://192.168.1.71:8080';

const API_AUTH_BASE = `${API_BASE_URL}/auth`;
const API_CLIENT_BASE = `${API_BASE_URL}/clients`;
const API_SEPARATION_BASE = `${API_BASE_URL}/separations`;
const API_AUDIO_BASE = `${API_BASE_URL}/audio`;

export const API_AUTH_ENDPOINTS = {
    login: `${API_AUTH_BASE}/login`,
    registration: `${API_AUTH_BASE}/registration`,
    logout: `${API_AUTH_BASE}/logout`,
    checkSession: `${API_AUTH_BASE}/check`,
    refreshSession: `${API_AUTH_BASE}/refresh`,
    verifyAccount: `${API_AUTH_BASE}/verify`,
    requestResetPassword: `${API_AUTH_BASE}/reset`,
    confirmResetPassword: `${API_AUTH_BASE}/reset-confirm`,
};

export const API_CLIENTS_ENDPOINTS = {
    clientById: (id: number) => `${API_CLIENT_BASE}/${id}`,
    changePassword: `${API_CLIENT_BASE}/change-password`,
    usernameAvailable: `${API_CLIENT_BASE}/username-available`,
    clientsSeparations: (clientId: number) => `${API_CLIENT_BASE}/${clientId}/separations`
};

export const API_SEPARATIONS_ENDPOINTS = {
    separationById: (id: string) => `${API_SEPARATION_BASE}/${id}`,
    separate: `${API_SEPARATION_BASE}/separate`,
    status: (jobId: string) => `${API_SEPARATION_BASE}/status/${jobId}`,
    downloadSeparation: (jobId: string) => `${API_SEPARATION_BASE}/download/${jobId}`,
};

// ovo ne treba?
export const API_AUDIO_ENDPOINTS = {
    separate: `${API_AUDIO_BASE}/separation`,
    status: (jobId: string) => `${API_AUDIO_BASE}/status/${jobId}`,
    downloadSeparation: (jobId: string) => `${API_AUDIO_BASE}/separations/${jobId}`,
};