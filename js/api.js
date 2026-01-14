async function apiCall(action, data = {}) {
  let apiUrl = localStorage.getItem('apiUrl');

  if (!apiUrl) {
    return { success: false, message: 'Nejdřív nastavte URL v Nastavení!' };
  }

  apiUrl = apiUrl.trim().replace(/\/$/, '');

  const params = new URLSearchParams({
    action: action,
    ...data
  });

  const fullUrl = `${apiUrl}?${params.toString()}`;

  console.log('Volám API:', fullUrl);
  console.log('Data v požadavku:', data);

  try {
    const response = await fetch(fullUrl, {
      method: 'GET',
      redirect: 'follow',
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log('HTTP status:', response.status);

    const text = await response.text();
    console.log('RAW odpověď od serveru:', text.substring(0, 500)); // ukáže začátek odpovědi

    let result;
    try {
      result = JSON.parse(text);
      console.log('Parsovaný JSON:', result);
    } catch (parseErr) {
      console.error('Chyba parsování JSON:', parseErr);
      return { success: false, message: 'Server vrátil neplatný JSON: ' + text.substring(0, 100) };
    }

    if (result.code === '000' || result.success === true) {
      return {
        success: true,
        data: result.data || result
      };
    } else {
      return {
        success: false,
        message: result.error || result.message || 'Neznámá chyba z API'
      };
    }
  } catch (error) {
    console.error('Chyba fetch:', error);
    return {
      success: false,
      message: 'Chyba spojení s API: ' + error.message
    };
  }
}
