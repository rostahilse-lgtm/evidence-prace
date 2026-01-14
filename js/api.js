async function apiCall(action, data = {}) {
  let apiUrl = localStorage.getItem('apiUrl');

  if (!apiUrl) {
    return { success: false, message: 'Nastavte URL v Nastavení!' };
  }

  apiUrl = apiUrl.trim().replace(/\/$/, '');

  const params = new URLSearchParams({
    action: action,
    ...data
  });

  const targetUrl = `${apiUrl}?${params.toString()}`;

  // Proxy pro obejití CORS
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

  console.log('Volám přes proxy:', proxyUrl);

  try {
    const proxyResponse = await fetch(proxyUrl);
    const proxyData = await proxyResponse.json();

    if (!proxyData.contents) {
      throw new Error('Proxy vrátil prázdný obsah');
    }

    const text = proxyData.contents;
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
