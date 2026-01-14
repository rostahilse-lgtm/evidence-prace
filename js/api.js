// API volání na Google Apps Script
async function apiCall(action, data = {}) {
  const apiUrl = localStorage.getItem('apiUrl') || DEFAULT_API_URL;
  
  // Vytvoření URL s parametry (pro doGet)
  const params = new URLSearchParams({
    action: action,
    ...data
  });
  
  const url = `${apiUrl}?${params.toString()}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });
    
    const result = await response.json();
    
    // Kontrola odpovědi podle vašeho formátu
    if (result.code === '000') {
      return {
        success: true,
        ...result.data
      };
    } else {
      return {
        success: false,
        message: result.error || 'Neznámá chyba'
      };
    }
  } catch (error) {
    console.error('API call error:', error);
    return {
      success: false,
      message: 'Chyba spojení s API'
    };
  }
}
