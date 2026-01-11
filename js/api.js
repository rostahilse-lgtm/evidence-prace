async function apiCall(action, params = {}) {
  const apiUrl = localStorage.getItem('apiUrl') || DEFAULT_API_URL;
  const url = new URL(apiUrl);
  url.searchParams.append('action', action);
  Object.keys(params).forEach(key => {
    if (params[key] !== null && params[key] !== undefined) {
      url.searchParams.append(key, params[key]);
    }
  });
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    return { code: '999', error: 'Chyba připojení: ' + error.message };
  }
}
