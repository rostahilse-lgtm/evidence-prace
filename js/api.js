// API volání na Google Apps Script – opravená verze
async function apiCall(action, data = {}) {
  // Získáme URL z localStorage (uživatel ji uloží v nastavení)
  let apiUrl = localStorage.getItem('apiUrl');

  if (!apiUrl) {
    return { success: false, message: 'Nejdřív nastavte URL v Nastavení!' };
  }

  // Zajistíme správný formát URL
  apiUrl = apiUrl.trim().replace(/\/$/, ''); // odstraní koncové lomítko

  const params = new URLSearchParams({
    action: action,
    ...data
  });

  const fullUrl = `${apiUrl}?${params.toString()}`;

  console.log('Volám API:', fullUrl); // diagnostika v konzoli

  try {
    const response = await fetch(fullUrl, {
      method: 'GET',
      redirect: 'follow',
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const text = await response.text();
    console.log('Odpověď:', text.substring(0, 200)); // diagnostika

    const result = JSON.parse(text);

    if (result.code === '000') {
      return {
        success: true,
        data: result.data || null
      };
    } else {
      return {
        success: false,
        message: result.error || 'Neznámá chyba z API'
      };
    }
  } catch (error) {
    console.error('API call error:', error);
    return {
      success: false,
      message: error.message || 'Chyba spojení s API'
    };
  }
}
