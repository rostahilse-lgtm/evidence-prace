// Formátování času
function formatTime(timestamp) {
  const d = new Date(timestamp);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Formátování data a času
function formatDateTime(timestamp) {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}. ${month}. ${year} ${hours}:${minutes}`;
}

// Krátké formátování data a času
function formatShortDateTime(timestamp) {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}. ${month}. ${hours}:${minutes}`;
}

// Formátování časového rozsahu (od - do)
function formatTimeRange(from, to) {
  return `${formatTime(from)} - ${formatTime(to)}`;
}

// Získání dnešního data
function getTodayDate() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}. ${month}. ${year}`;
}

// Formátování data pro input type="date"
function formatDateForInput(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('. ');
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// Formátování data z input type="date"
function formatDateFromInput(inputDate) {
  if (!inputDate) return '';
  const parts = inputDate.split('-');
  return `${parts[2]}. ${parts[1]}. ${parts[0]}`;
}
