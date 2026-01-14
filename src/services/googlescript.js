// URL vašeho Google Apps Script
// NAHRAĎTE tuto URL vaší skutečnou URL z nasazení!
const SCRIPT_URL = 'https://script.google.com/macros/s/VASE_URL_ZDE/exec';

/**
 * Odešle data do Google Apps Script
 * @param {Object} data - Data k odeslání
 * @returns {Promise<Object>} - Odpověď ze serveru
 */
export async function posliDataDoGoogleScript(data) {
  try {
    console.log('📤 Odesílám data do Google Script:', data);
    
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(data),
      redirect: 'follow'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP chyba! Status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ Odpověď ze serveru:', result);
    
    return result;
    
  } catch (error) {
    console.error('❌ Chyba při komunikaci:', error);
    throw error;
  }
}

/**
 * Otestuje, zda Google Apps Script API funguje
 * @returns {Promise<Object>} - Testovací odpověď
 */
export async function testujAPI() {
  try {
    console.log('🔍 Testuji Google Script API...');
    
    const response = await fetch(SCRIPT_URL, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP chyba! Status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ API funguje:', result);
    
    return result;
    
  } catch (error) {
    console.error('❌ API nefunguje:', error);
    throw error;
  }
}
