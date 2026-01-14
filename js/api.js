// API volání na Google Apps Script – opravená verze
async function apiCall(action, data = {}) {
  // Získáme URL z localStorage (uživatel si ji uloží v nastavení)
  let apiUrl = localStorage.getItem('apiUrl');

  // Pokud není uložená → fallback na default (ale lepší donutit uživatele zadat ji)
  if (!apiUrl) {
    alert('Nastavte URL Apps Scriptu v nastavení!');
    return { success: false, message: 'Chybí URL API' };
  }

  // Zajistíme, že URL končí /exec a nemá duplicitní ?
  apiUrl = apiUrl.trim().replace(/\/$/, ''); // odstraní koncové lomítko pokud je

  const params = new URLSearchParams({
    action: action,
    ...data
  });

  const fullUrl = `${apiUrl}?${params.toString()}`;

  console.log('Volám API:', fullUrl); // diagnostika – uvidíš v konzoli

  try {
    const response = await fetch(fullUrl, {
      method: 'GET',
      redirect: 'follow',
      mode: 'cors', // nutné pro CORS
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const text = await response.text();
    console.log('Odpověď od serveru:', text.substring(0, 200)); // diagnostika

    const result = JSON.parse(text);

    // Kontrola podle tvého formátu (code '000' = success)
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
