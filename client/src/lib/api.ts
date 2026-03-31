const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api' : `http://${window.location.hostname}:3001/api`);

const getHeaders = () => {
  const token = sessionStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

const handleResponse = async (res: Response) => {
  if (res.status === 401 || res.status === 403) {
    if (window.location.pathname !== '/login') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('auth-storage');
      window.location.href = '/login';
    }
  }
  
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || 'Network response was not ok');
  }

  // Handle 204 No Content
  if (res.status === 204) return null;

  try {
    return await res.json();
  } catch (e) {
    return res.status;
  }
};

export const api = {
  get: async (endpoint: string) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },
  post: async (endpoint: string, data: any) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  put: async (endpoint: string, data: any) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  patch: async (endpoint: string, data: any) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  delete: async (endpoint: string) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },
  download: async (endpoint: string, filename: string) => {
    // Cannot use standard getHeaders because Content-Type isn't json for the response (it handles request though, but omiting is safest for blobs)
    const token = sessionStorage.getItem('token');
    const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      headers: headers
    });

    if (res.status === 401 || res.status === 403) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('auth-storage');
      window.location.href = '/login';
      return;
    }

    if (!res.ok) {
        throw new Error('Dosya indirilemedi');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
};
