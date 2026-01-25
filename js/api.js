async function apiCall(action, params = {}) {
  const apiUrl = localStorage.getItem('apiUrl') || DEFAULT_API_URL;
  
  // Připravit data pro POST request
  const payload = {
    action: action,
    ...params
  };
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    // Přidat success flag pro kompatibilitu
    if (data.code === '000') {
      data.success = true;
    } else {
      data.success = false;
    }
    
    return data;
  } catch (error) {
    return { 
      code: '999', 
      error: 'Chyba připojení: ' + error.message,
      success: false,
      data: null
    };
  }
}
