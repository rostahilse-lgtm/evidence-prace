async function apiCall(action, data = {}) {
  const apiUrl = localStorage.getItem('apiUrl') || DEFAULT_API_URL;

  if (!apiUrl) {
    return { success: false, message: 'Nastavte URL v Nastavení!' };
  }

  const params = new URLSearchParams({
    action: action,
    ...data
  });

  const fullUrl = `${apiUrl}?${params.toString()}`;

  // Použij proxy pro obejití CORS
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(fullUrl)}`;

  console.log('Volám přes proxy:', proxyUrl);

  try {
    const proxyResponse = await fetch(proxyUrl);
    const proxyData = await proxyResponse.json();
    const text = proxyData.contents; // obsah z proxy
    console.log('Proxy RAW odpověď:', text.substring(0, 200));

    const result = JSON.parse(text);

    if (result.code === '000' || result.success === true) {
      return {
        success: true,
        data: result.data || result
      };
    } else {
      return {
        success: false,
        message: result.error || 'Neznámá chyba'
      };
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return { success: false, message: 'Chyba přes proxy: ' + error.message };
  }
}
