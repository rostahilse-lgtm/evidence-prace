function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

function formatShortDateTime(timestamp) {
  const d = new Date(timestamp);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatTimeRange(timeFr, timeTo) {
  const d1 = new Date(timeFr);
  const d2 = new Date(timeTo);
  return `${d1.getDate()}.${d1.getMonth() + 1}. ${String(d1.getHours()).padStart(2, '0')}:${String(d1.getMinutes()).padStart(2, '0')} - ${String(d2.getHours()).padStart(2, '0')}:${String(d2.getMinutes()).padStart(2, '0')}`;
}

function getTodayDate() {
  const today = new Date();
  return `${String(today.getDate()).padStart(2, '0')}. ${String(today.getMonth() + 1).padStart(2, '0')}. ${today.getFullYear()}`;
}

function getMonthStart() {
  const today = new Date();
  return `01. ${String(today.getMonth() + 1).padStart(2, '0')}. ${today.getFullYear()}`;
}

function parseDateString(dateStr) {
  const parts = dateStr.split('. ');
  return new Date(parts[2], parts[1] - 1, parts[0]);
}

function formatDateForInput(dateStr) {
  const date = parseDateString(dateStr);
  return date.toISOString().split('T')[0];
}

function formatDateFromInput(inputDate) {
  const date = new Date(inputDate);
  return `${String(date.getDate()).padStart(2, '0')}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${date.getFullYear()}`;
}
