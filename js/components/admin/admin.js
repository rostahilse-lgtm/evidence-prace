// ADMIN.JS
// v2026-02-24 - Oprava: loadDayRecords vrácen na lokální filtrování z allRecords
// v2026-02-25b - přidána záložka Nástroje s opravou sazeb v historii
// v2026-02-27 - odstraněna záložka Statistiky (přesunuta do Nástroje v main)
//             - seznam pracovníků: přidáno ID, zálohy, tlačítko přihlásit jako
//             - nic jsem nesmazal, pouze přidal nové funkce
// v2026-04-06 - OPRAVA: saveEdit volá updaterecord místo saverecord
//             - přidán row_index z editingRecord.data[17]
//             - díky tomu se opravený záznam přepíše na stejném řádku (ne na konec)
//             - do sloupce P se zapíše 'opraveno', do Q co bylo před změnou
// v2026-04-06c - NOVÉ: dialog úpravy nyní zobrazuje a umožňuje editovat KM
//              - vlevo původní KM celkem (readonly), vpravo km jednosměr + checkbox tam a zpět
//              - OPRAVA: při uložení se KM vždy posílají (zachovají hodnotu pokud nezměněny)
//              - OPRAVA: výběr času - po dokončení (HH:MM) se popup automaticky zavře

window.app.component('admin-component', {
  props: ['allSummary', 'allRecords', 'allAdvances', 'contracts', 'jobs', 'places', 'loading'],
  emits: ['message', 'reload', 'login-as'],
  
  data() {
    return {
      adminTab: 'workers',
      toolsLoading: false,
      toolsResult: null,
      selectedWorkerData: null,
      summaryTab: 'records',
      dayRecords: [],
      workers: [],
      selectedDate: null,
      editDialog: false,
      duplicateDialog: false,
      lunchDialog: false,
      advanceDialog: false,
      editingRecord: null,
      editForm: { 
        workerId: null,
        contractId: null, 
        jobId: null,
        placeId: null,
        dateEdit: null,
        timeFrom: null,
        timeTo: null,
        note: '',
        kmJednosmer: 0,
        kmManual: false,
        kmRoundTrip: true
      },
      originalRecord: null,
      localSummary: null,
      localRecords: null,
      localAdvances: null,
      filterLoading: false,
      newLunch: { workerId: null, date: null, time: null },
      newAdvance: { workerId: null, amount: null, reason: '', date: null }
    }
  },
  
  computed: {
    activeSummary() { return this.localSummary !== null ? this.localSummary : this.allSummary; },
    sortedSummary() {
      const s = [...this.activeSummary];
      return s.sort((a, b) => {
        const aActive = a.active !== false;
        const bActive = b.active !== false;
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return (a.name || '').localeCompare(b.name || '', 'cs');
      });
    },
    recentAdvancesByWorker() {
      const all = [...this.activeAdvances]
        .filter(a => a[5] !== 'oběd')
        .sort((a, b) => Number(b[1]) - Number(a[1]));
      const map = {};
      for (const adv of all) {
        const id = String(adv[0]);
        const name = adv[2] || '?';
        if (!map[id]) map[id] = { id, name, advances: [] };
        if (map[id].advances.length < 3) {
          map[id].advances.push(adv);
        }
      }
      return Object.values(map).sort((a, b) =>
        Number(b.advances[0][1]) - Number(a.advances[0][1])
      );
    },
    activeRecords() { return this.localRecords !== null ? this.localRecords : this.allRecords; },
    activeAdvances() { return this.localAdvances !== null ? this.localAdvances : this.allAdvances; },
    contractOptions() { return this.contracts.map(c => ({ label: c[0] + ' - ' + c[1], value: c[0] })); },
    jobOptions() { return this.jobs.map(j => ({ label: j[1], value: j[0] })); },
    placeOptions() { return this.places ? this.places.map(p => ({ label: p[1], value: p[0] })) : []; },
    workerOptions() { return this.workers.map(w => ({ label: w[1], value: w[0] })); },
    todayShifts() {
      const today = new Date(); today.setHours(0,0,0,0);
      const todayTs = today.getTime(); const tomorrowTs = todayTs + 86400000;
      const map = {};
      this.allRecords.forEach(r => {
        const ts = Number(r[4]);
        if (ts >= todayTs && ts < tomorrowTs) {
          const id = String(r[1]); const status = String(r[15] || "").trim();
          if (!map[id] || status === "rozpracováno") {
            map[id] = { timeFrom: ts, timeTo: r[5] ? Number(r[5]) : null, status: status };
          }
        }
      });
      return map;
    },
    selectedContractKm() {
      if (!this.editForm.contractId) return 0;
      const contract = this.contracts.find(c => c[0] === this.editForm.contractId);
      return contract ? (contract[3] || 0) : 0;
    },
    calculatedKmEdit() {
      if (this.editForm.kmManual) return this.editForm.kmRoundTrip ? this.editForm.kmJednosmer * 2 : this.editForm.kmJednosmer;
      if (this.selectedContractKm > 0) return this.editForm.kmRoundTrip ? this.selectedContractKm * 2 : this.selectedContractKm;
      return 0;
    }
  },
  
  methods: {
    getTodayDate() {
      const d = new Date();
      return `${String(d.getDate()).padStart(2, '0')}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${d.getFullYear()}`;
    },
    getCurrentTime() {
      const now = new Date();
      return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    },
    formatShortDateTime(ts) {
      const d = new Date(Number(ts));
      return `${String(d.getDate()).padStart(2, '0')}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    },
    timestampToDate(ts) {
      const d = new Date(Number(ts));
      return `${String(d.getDate()).padStart(2, '0')}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${d.getFullYear()}`;
    },
    timestampToTime(ts) {
      const d = new Date(Number(ts));
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    },
    dateTimeToTimestamp(dateStr, timeStr) {
      const dateParts = dateStr.split('. ');
      const timeParts = timeStr.split(':');
      return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1]).getTime();
    },
    
    async loadWorkers() {
      const res = await apiCall('get', { type: 'workers' });
      if (res.code === '000' && res.data) this.workers = res.data;
    },

    loginAs(worker) {
      const fullWorker = this.workers.find(w => String(w[0]) === String(worker.id));
      if (fullWorker) {
        this.$emit('login-as', fullWorker);
      } else {
        this.$emit('message', 'Pracovník nenalezen');
      }
    },
    
    selectWorker(worker) {
      this.selectedWorkerData = {
        info: worker,
        records: this.activeRecords.filter(r => String(r[1]) === String(worker.id)),
        advances: this.activeAdvances.filter(a => String(a[0]) === String(worker.id))
      };
      this.adminTab = 'detail';
    },
    
    backToWorkers() {
      this.selectedWorkerData = null;
      this.adminTab = 'workers';
    },
    
    loadDayRecords() {
      if (!this.selectedDate) this.selectedDate = this.getTodayDate();
      const cleaned = this.selectedDate.trim().replace(/\s+/g, ' ');
      const parts = cleaned.split('.').map(p => parseInt(p.trim(), 10));
      if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) { this.dayRecords = []; return; }
      const [dd, mm, yyyy] = parts;
      const startOfDay = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0).getTime();
      const endOfDay = new Date(yyyy, mm - 1, dd, 23, 59, 59, 999).getTime();
      this.dayRecords = this.allRecords
        .filter(r => { const ts = Number(r[4]); return !isNaN(ts) && ts >= startOfDay && ts <= endOfDay; })
        .sort((a, b) => Number(a[4]) - Number(b[4]));
    },
    
    setToday() { this.selectedDate = this.getTodayDate(); this.loadDayRecords(); },
    
    openEditDialog(record, index) {
      this.editingRecord = { data: record, index: index };
      this.originalRecord = {
        worker: record[6], contract: record[0], job: record[3],
        place: record[14] || 'Nezadáno', timeFrom: this.timestampToTime(record[4]),
        timeTo: this.timestampToTime(record[5]), date: this.timestampToDate(record[4]),
        note: record[8] || '',
        km: record[12] || 0
      };
      const worker = this.workers.find(w => w[1] === record[6]);
      const contract = this.contracts.find(c => c[1] === record[0]);
      const job = this.jobs.find(j => j[1] === record[3]);
      const place = this.places ? this.places.find(p => p[1] === record[14]) : null;
      // v2026-04-06c: načteme původní KM, kmRoundTrip odvozeno z poměru km_celkem / km_jednosmer
      const kmJednosmer = parseFloat(record[11]) || 0;
      const kmCelkem = parseFloat(record[12]) || 0;
      this.editForm = {
        workerId: worker ? worker[0] : null, contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null, placeId: place ? place[0] : null,
        dateEdit: this.timestampToDate(record[4]), timeFrom: this.timestampToTime(record[4]),
        timeTo: this.timestampToTime(record[5]), note: record[8] || '',
        kmJednosmer: kmJednosmer,
        kmManual: true,
        kmRoundTrip: kmJednosmer > 0 ? (kmCelkem === kmJednosmer * 2) : true
      };
      this.editDialog = true;
    },
    
    openDuplicateDialog(record) {
      const worker = this.workers.find(w => w[1] === record[6]);
      const contract = this.contracts.find(c => c[1] === record[0]);
      const job = this.jobs.find(j => j[1] === record[3]);
      const place = this.places ? this.places.find(p => p[1] === record[14]) : null;
      this.editForm = {
        workerId: worker ? worker[0] : null, contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null, placeId: place ? place[0] : null,
        dateEdit: this.selectedDate || this.getTodayDate(), timeFrom: this.timestampToTime(record[4]),
        timeTo: this.timestampToTime(record[5]), note: record[8] || '',
        kmJednosmer: parseFloat(record[11]) || 0, kmManual: record[13] === 'Y', kmRoundTrip: true
      };
      this.duplicateDialog = true;
    },
    
    openLunchDialog() {
      this.newLunch = { workerId: null, date: this.selectedDate || this.getTodayDate(), time: this.getCurrentTime() };
      this.lunchDialog = true;
    },
    
    openAdvanceDialog() {
      this.newAdvance = { workerId: null, amount: null, reason: '', date: this.selectedDate || this.getTodayDate() };
      this.advanceDialog = true;
    },
    
    // v2026-04-06c: KM se vždy posílají - hodnota z formuláře (zachovají se pokud nezměněny)
    async saveEdit() {
      if (!this.editForm.workerId || !this.editForm.contractId || !this.editForm.jobId || !this.editForm.placeId || !this.editForm.timeFrom || !this.editForm.timeTo) {
        this.$emit('message', 'Vyplňte všechna pole'); return;
      }
      const timeFr = this.dateTimeToTimestamp(this.editForm.dateEdit, this.editForm.timeFrom);
      const timeTo = this.dateTimeToTimestamp(this.editForm.dateEdit, this.editForm.timeTo);
      try {
        const kmJednosmer = parseFloat(this.editForm.kmJednosmer) || 0;
        const kmCelkem = this.editForm.kmRoundTrip ? kmJednosmer * 2 : kmJednosmer;
        const payload = {
          row_index: this.editingRecord.data[17],
          id_contract: this.editForm.contractId, id_worker: this.editForm.workerId,
          id_job: this.editForm.jobId, id_place: this.editForm.placeId,
          time_fr: timeFr, time_to: timeTo, note: this.editForm.note,
          km_jednosmer: kmJednosmer,
          km_celkem: kmCelkem,
          km_rucne: kmJednosmer > 0 ? 'Y' : 'N'
        };
        const res = await apiCall('updaterecord', payload);
        if (res.code === '000') { this.$emit('message', '✓ Záznam upraven'); this.editDialog = false; this.$emit('reload'); this.loadDayRecords(); }
        else this.$emit('message', 'Chyba: ' + res.error);
      } catch (error) { this.$emit('message', 'Chyba při úpravě'); }
    },
    
    async saveDuplicate() {
      if (!this.editForm.workerId || !this.editForm.contractId || !this.editForm.jobId || !this.editForm.placeId || !this.editForm.timeFrom || !this.editForm.timeTo) {
        this.$emit('message', 'Vyplňte všechna pole'); return;
      }
      const timeFr = this.dateTimeToTimestamp(this.editForm.dateEdit, this.editForm.timeFrom);
      const timeTo = this.dateTimeToTimestamp(this.editForm.dateEdit, this.editForm.timeTo);
      try {
        const payload = { id_contract: this.editForm.contractId, id_worker: this.editForm.workerId, id_job: this.editForm.jobId, id_place: this.editForm.placeId, time_fr: timeFr, time_to: timeTo, note: this.editForm.note };
        if (this.editForm.kmManual && this.editForm.kmJednosmer) { payload.km_jednosmer = this.editForm.kmJednosmer; payload.km_celkem = this.calculatedKmEdit; payload.km_rucne = 'Y'; }
        const res = await apiCall('saverecord', payload);
        if (res.code === '000') { this.$emit('message', '✓ Kopie uložena'); this.duplicateDialog = false; this.$emit('reload'); this.loadDayRecords(); }
        else this.$emit('message', 'Chyba: ' + res.error);
      } catch (error) { this.$emit('message', 'Chyba při ukládání'); }
    },
    
    async saveLunch() {
      if (!this.newLunch.workerId) { this.$emit('message', 'Vyberte pracovníka'); return; }
      const timestamp = this.dateTimeToTimestamp(this.newLunch.date, this.newLunch.time);
      try {
        const worker = this.workers.find(w => w[0] === this.newLunch.workerId);
        const res = await apiCall('savelunch', { id_worker: this.newLunch.workerId, name_worker: worker[1], time: timestamp });
        if (res.code === '000') { this.$emit('message', '✓ Oběd uložen'); this.lunchDialog = false; this.$emit('reload'); }
        else this.$emit('message', 'Chyba: ' + res.error);
      } catch (error) { this.$emit('message', 'Chyba při ukládání oběda'); }
    },
    
    async saveAdvance() {
      if (!this.newAdvance.workerId || !this.newAdvance.amount || !this.newAdvance.reason) { this.$emit('message', 'Vyplňte všechna pole'); return; }
      const dateParts = this.newAdvance.date.split('. ');
      const timestamp = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], 12, 0).getTime();
      try {
        const worker = this.workers.find(w => w[0] === this.newAdvance.workerId);
        const res = await apiCall('saveadvance', { id_worker: this.newAdvance.workerId, name_worker: worker[1], time: timestamp, payment: this.newAdvance.amount, payment_reason: this.newAdvance.reason });
        if (res.code === '000') { this.$emit('message', '✓ Záloha uložena'); this.advanceDialog = false; this.$emit('reload'); }
        else this.$emit('message', 'Chyba: ' + res.error);
      } catch (error) { this.$emit('message', 'Chyba při ukládání zálohy'); }
    },

    async opravSazbyHistorie() {
      if (!confirm('Přepíše sazby (sloupec C) v záznamy_historie podle sazebníku. Pokračovat?')) return;
      this.toolsLoading = true;
      this.toolsResult = null;
      try {
        const res = await apiCall('opravsazbyhistorie', {});
        if (res.code === '000') { this.toolsResult = { ok: true, msg: res.data.message }; this.$emit('message', '✓ ' + res.data.message); }
        else { this.toolsResult = { ok: false, msg: res.error }; this.$emit('message', 'Chyba: ' + res.error); }
      } catch (e) { this.toolsResult = { ok: false, msg: 'Chyba spojení' }; }
      this.toolsLoading = false;
    },
    
    formatTimeRange(fr, to) { return formatTimeRange(fr, to); }
  },
  
  watch: {
    selectedDate() { if (this.adminTab === 'day') this.loadDayRecords(); },
    allRecords() { if (this.adminTab === 'day') this.loadDayRecords(); },
    'editForm.contractId'() { if (!this.editForm.kmManual) this.editForm.kmJednosmer = this.selectedContractKm; }
  },
  
  async mounted() {
    this.selectedDate = this.getTodayDate();
    await this.loadWorkers();
    if (this.adminTab === 'day') this.loadDayRecords();
  },
  
  template: `
    <div>
      <q-tabs v-model="adminTab" dense align="justify" class="text-primary">
        <q-tab name="workers" label="Pracovníci"/>
        <q-tab name="day" label="Přehled dne"/>
        <q-tab name="zalohy" label="Zálohy"/>
        <q-tab name="tools" label="Nástroje"/>
      </q-tabs>

      <!-- PRACOVNÍCI -->
      <div v-if="adminTab==='workers'" class="q-pt-md">
        <div v-for="worker in sortedSummary" :key="worker.id" class="worker-card">
          <div class="row items-center no-wrap">
            <div class="col" @click="selectWorker(worker)" style="cursor:pointer">
              <div class="text-bold text-caption" :class="worker.active === false ? 'text-grey-5' : ''">{{ worker.name }}<span v-if="worker.active === false" class="text-caption text-grey-5 q-ml-xs">(neaktivní)</span></div>
              <div class="text-caption text-grey-5" style="font-size:0.7rem">ID: {{ worker.id }}</div>
              <div v-if="todayShifts[String(worker.id)]" class="q-mt-xs">
                <span v-if="todayShifts[String(worker.id)].status === 'rozpracováno'" class="text-caption text-green-7">
                  ▶ {{ new Date(todayShifts[String(worker.id)].timeFrom).toLocaleTimeString('cs-CZ', {hour:'2-digit',minute:'2-digit'}) }} – pracuje
                </span>
                <span v-else class="text-caption text-grey-6">
                  {{ new Date(todayShifts[String(worker.id)].timeFrom).toLocaleTimeString('cs-CZ', {hour:'2-digit',minute:'2-digit'}) }}
                  – {{ todayShifts[String(worker.id)].timeTo ? new Date(todayShifts[String(worker.id)].timeTo).toLocaleTimeString('cs-CZ', {hour:'2-digit',minute:'2-digit'}) : '?' }}
                </span>
              </div>
            </div>
            <div class="text-caption text-grey-7 q-mr-xs" style="min-width:60px;text-align:right">
              <div>{{ worker.totalEarnings }} Kč</div>
              <div class="text-grey-5">{{ worker.totalPaid }} Kč</div>
            </div>
            <div style="min-width:60px;text-align:right" class="q-mr-xs" @click="selectWorker(worker)" style="cursor:pointer">
              <div class="text-bold text-caption" :class="worker.balance>=0?'balance-positive':'balance-negative'">
                {{ worker.balance }} Kč
              </div>
            </div>
            <q-btn flat dense round icon="person" size="sm" color="blue-7" @click.stop="loginAs(worker)">
              <q-tooltip>Přihlásit jako {{ worker.name }}</q-tooltip>
            </q-btn>
          </div>
        </div>
      </div>

      <!-- DETAIL PRACOVNÍKA -->
      <div v-if="adminTab==='detail'&&selectedWorkerData" class="q-pt-md">
        <q-btn flat icon="arrow_back" label="Zpět" @click="backToWorkers" class="q-mb-md"/>
        
        <div class="summary-box">
          <div class="text-h6 q-mb-xs">{{ selectedWorkerData.info.name }}</div>
          <div class="text-caption text-grey-6 q-mb-md">ID: {{ selectedWorkerData.info.id }}</div>
          <div class="summary-item">
            <span class="summary-label">Vyděleno:</span>
            <span class="summary-value">{{ selectedWorkerData.info.totalEarnings }} Kč</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Zálohy:</span>
            <span class="summary-value">{{ selectedWorkerData.info.totalPaid }} Kč</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Zůstatek:</span>
            <span :class="selectedWorkerData.info.balance>=0?'balance-positive':'balance-negative'">
              {{ selectedWorkerData.info.balance }} Kč
            </span>
          </div>
        </div>

        <q-tabs v-model="summaryTab" dense class="q-mt-md">
          <q-tab name="records" label="Záznamy"/>
          <q-tab name="advances" label="Zálohy"/>
        </q-tabs>

        <div v-if="summaryTab==='records'" class="q-mt-md">
          <div v-for="(record,idx) in selectedWorkerData.records" :key="idx" class="record-card">
            <div class="row items-center">
              <div class="col">
                <div class="text-bold">{{ record[0] }}</div>
                <div class="text-caption text-grey-7">{{ record[3] }} • {{ record[14] || 'Nezadáno' }}</div>
              </div>
              <div class="text-right">
                <div class="text-bold text-primary">{{ (parseFloat(record[7]) || 0).toFixed(2) }} hod</div>
                <div class="text-caption">{{ record[2] }} Kč/hod</div>
              </div>
            </div>
            <div class="text-caption text-grey-7 q-mt-sm">{{ formatTimeRange(record[4], record[5]) }}</div>
            <div v-if="record[12] > 0" class="text-caption text-orange q-mt-xs">🚗 {{ record[12] }} km</div>
            <div v-if="record[8]" class="note-display">💬 {{ record[8] }}</div>
          </div>
        </div>

        <div v-if="summaryTab==='advances'" class="q-mt-md">
          <div v-for="(advance,idx) in selectedWorkerData.advances" :key="idx" class="record-card">
            <div class="row items-center">
              <div class="col"><div class="text-bold">{{ advance[5] }}</div></div>
              <div class="text-right text-bold text-primary">{{ advance[4] }} Kč</div>
            </div>
            <div class="text-caption text-grey-7 q-mt-sm">{{ formatShortDateTime(advance[1]) }}</div>
          </div>
        </div>
      </div>

      <!-- PŘEHLED DNE -->
      <div v-if="adminTab==='day'" class="q-pt-md">
        <div class="row q-gutter-xs q-mb-md items-center">
          <q-btn color="primary" label="Dnes" dense size="sm" @click="setToday"/>
          <div class="col">
            <q-input v-model="selectedDate" outlined dense label="Datum" readonly>
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover ref="dayDateProxy">
                    <q-date v-model="selectedDate" mask="DD. MM. YYYY" locale="cs"
                      @update:model-value="$refs.dayDateProxy.hide(); loadDayRecords()" />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>
          <q-btn color="primary" icon="restaurant" dense size="sm" @click="openLunchDialog"><q-tooltip>Oběd</q-tooltip></q-btn>
          <q-btn color="primary" icon="payment" dense size="sm" @click="openAdvanceDialog"><q-tooltip>Záloha</q-tooltip></q-btn>
        </div>

        <div v-if="dayRecords.length===0" class="text-center text-grey-7 q-mt-lg">Žádné záznamy pro {{ selectedDate }}</div>

        <div v-for="(record,idx) in dayRecords" :key="idx" class="record-card" style="padding:8px 12px">
          <div class="row items-center no-wrap" style="font-size:0.85rem">
            <div style="min-width:80px" class="q-mr-xs">
              <div class="text-bold" style="font-size:0.9rem">{{ record[6] }}</div>
            </div>
            <div style="min-width:55px" class="text-grey-8 q-mr-xs">{{ record[0] }}</div>
            <div style="min-width:55px" class="text-grey-7 q-mr-xs">{{ record[3] }}</div>
            <div style="min-width:65px" class="text-grey-7 q-mr-xs">{{ timestampToTime(record[4]) }}-{{ timestampToTime(record[5]) }}</div>
            <div style="min-width:45px" class="text-grey-7 q-mr-xs">{{ record[14] || '-' }}</div>
            <div class="text-bold text-primary" style="min-width:42px">{{ (parseFloat(record[7]) || 0).toFixed(2) }}h</div>
          </div>
          <div class="row items-center q-mt-xs" style="min-height:28px">
            <div class="col text-caption text-grey-7">
              <span v-if="record[8]">💬 {{ record[8] }}</span>
              <span v-if="record[12] > 0" class="text-orange q-ml-xs">🚗 {{ record[12] }} km</span>
            </div>
            <div class="row" style="gap:5px; padding-right:5px; flex-shrink:0">
              <q-btn flat dense round color="blue-7" icon="content_copy" size="sm" @click="openDuplicateDialog(record)"><q-tooltip>Kopírovat</q-tooltip></q-btn>
              <q-btn flat dense round color="orange-8" icon="edit" size="sm" @click="openEditDialog(record,idx)"><q-tooltip>Upravit</q-tooltip></q-btn>
            </div>
          </div>
        </div>
      </div>

      <!-- ZÁLOHY -->
      <div v-if="adminTab==='zalohy'" class="q-pt-md">
        <div v-if="recentAdvancesByWorker.length === 0" class="text-center text-grey-7 q-mt-lg">Žádné zálohy</div>
        <div v-for="row in recentAdvancesByWorker" :key="row.id" class="row items-start no-wrap q-mb-xs" style="border-bottom:1px solid #f0f0f0; padding:6px 4px">
          <div style="min-width:90px; max-width:90px; padding-top:2px">
            <div class="text-bold" style="font-size:0.82rem; line-height:1.2">{{ row.name }}</div>
          </div>
          <div class="row col q-gutter-xs">
            <div v-for="(adv, i) in row.advances" :key="i"
              style="min-width:85px; background:#f5f5f5; border-radius:4px; padding:3px 6px">
              <div class="text-bold text-primary" style="font-size:0.85rem">{{ adv[4] }} Kč</div>
              <div class="text-caption text-grey-7" style="font-size:0.72rem">{{ formatShortDateTime(adv[1]) }}</div>
              <div class="text-caption text-grey-8" style="font-size:0.72rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:80px">{{ adv[5] }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- NÁSTROJE -->
      <div v-if="adminTab==='tools'" class="q-pt-md">
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle1 text-bold q-mb-xs">🔧 Oprava sazeb v historii</div>
            <div class="text-body2 text-grey-7 q-mb-md">
              Projde všechny záznamy v listu <strong>záznamy_historie</strong> a přepíše sazbu (sloupec C)
              podle sazebníku platného pro datum záznamu.
            </div>
            <q-btn color="deep-orange" icon="build" label="Opravit sazby v historii" :loading="toolsLoading" @click="opravSazbyHistorie"/>
            <div v-if="toolsResult" class="q-mt-md q-pa-sm" :style="toolsResult.ok ? 'background:#e8f5e9;border-radius:4px' : 'background:#ffebee;border-radius:4px'">
              <span :class="toolsResult.ok ? 'text-green-8' : 'text-red-8'">{{ toolsResult.ok ? '✓' : '✗' }} {{ toolsResult.msg }}</span>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- DIALOG - ÚPRAVA -->
      <q-dialog v-model="editDialog">
        <q-card style="width:95%; max-width:500px">
          <q-card-section><div class="text-h6">Upravit záznam</div></q-card-section>
          <q-card-section class="q-pt-none" style="max-height:65vh; overflow-y:auto">
            <div class="row q-col-gutter-sm">

              <!-- LEVÝ SLOUPEC - původní hodnoty -->
              <div class="col-6">
                <div class="text-caption text-grey-7 q-mb-xs">Původní:</div>
                <q-input v-model="originalRecord.worker" label="Pracovník" dense readonly filled class="q-mb-xs"/>
                <q-input v-model="originalRecord.contract" label="Zakázka" dense readonly filled class="q-mb-xs"/>
                <q-input v-model="originalRecord.job" label="Práce" dense readonly filled class="q-mb-xs"/>
                <q-input v-model="originalRecord.place" label="Místo" dense readonly filled class="q-mb-xs"/>
                <q-input v-model="originalRecord.date" label="Datum" dense readonly filled class="q-mb-xs"/>
                <q-input v-model="originalRecord.timeFrom" label="Od" dense readonly filled class="q-mb-xs"/>
                <q-input v-model="originalRecord.timeTo" label="Do" dense readonly filled class="q-mb-xs"/>
                <q-input v-model="originalRecord.note" label="Poznámka" dense readonly filled type="textarea" rows="2" class="q-mb-xs"/>
                <!-- v2026-04-06c: původní KM celkem -->
                <q-input :model-value="String(originalRecord.km) + ' km'" label="Km celkem" dense readonly filled/>
              </div>

              <!-- PRAVÝ SLOUPEC - nové hodnoty -->
              <div class="col-6">
                <div class="text-caption text-grey-7 q-mb-xs">Nové:</div>
                <q-select v-model="editForm.workerId" :options="workerOptions" label="Pracovník" emit-value map-options dense outlined class="q-mb-xs"/>
                <q-select v-model="editForm.contractId" :options="contractOptions" label="Zakázka" emit-value map-options dense outlined class="q-mb-xs"/>
                <q-select v-model="editForm.jobId" :options="jobOptions" label="Práce" emit-value map-options dense outlined class="q-mb-xs"/>
                <q-select v-model="editForm.placeId" :options="placeOptions" label="Místo" emit-value map-options dense outlined class="q-mb-xs"/>
                <q-input v-model="editForm.dateEdit" label="Datum" dense outlined readonly class="q-mb-xs">
                  <template v-slot:append><q-icon name="event" class="cursor-pointer"><q-popup-proxy cover ref="editDateProxy"><q-date v-model="editForm.dateEdit" mask="DD. MM. YYYY" locale="cs" @update:model-value="$refs.editDateProxy.hide()"/></q-popup-proxy></q-icon></template>
                </q-input>

                <!-- v2026-04-06c: čas - popup se zavře po dokončení výběru (val.length===5 znamená HH:MM) -->
                <q-input v-model="editForm.timeFrom" label="Od" dense outlined class="q-mb-xs">
                  <template v-slot:append>
                    <q-icon name="schedule" class="cursor-pointer">
                      <q-popup-proxy cover ref="editTimeFromProxy">
                        <q-time v-model="editForm.timeFrom" mask="HH:mm" format24h
                          @update:model-value="val => { if (val && val.length === 5) $refs.editTimeFromProxy.hide(); }"
                        />
                      </q-popup-proxy>
                    </q-icon>
                  </template>
                </q-input>

                <q-input v-model="editForm.timeTo" label="Do" dense outlined class="q-mb-xs">
                  <template v-slot:append>
                    <q-icon name="schedule" class="cursor-pointer">
                      <q-popup-proxy cover ref="editTimeToProxy">
                        <q-time v-model="editForm.timeTo" mask="HH:mm" format24h
                          @update:model-value="val => { if (val && val.length === 5) $refs.editTimeToProxy.hide(); }"
                        />
                      </q-popup-proxy>
                    </q-icon>
                  </template>
                </q-input>

                <q-input v-model="editForm.note" label="Poznámka" dense outlined type="textarea" rows="2" class="q-mb-xs"/>

                <!-- v2026-04-06c: KM pole - vždy zobrazeno, předvyplněno původní hodnotou -->
                <q-input v-model.number="editForm.kmJednosmer" label="Km jednosměr" type="number" dense outlined class="q-mb-xs"/>
                <q-checkbox v-model="editForm.kmRoundTrip" label="Tam a zpět (×2)" dense class="q-mb-xs"/>
                <div class="text-caption text-primary q-mb-xs">
                  Celkem: {{ editForm.kmRoundTrip ? (editForm.kmJednosmer || 0) * 2 : (editForm.kmJednosmer || 0) }} km
                </div>
              </div>

            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup size="sm"/>
            <q-btn label="Uložit" color="primary" @click="saveEdit" size="sm"/>
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- DIALOG - DUPLIKACE -->
      <q-dialog v-model="duplicateDialog">
        <q-card style="width:100%; max-width:400px">
          <q-card-section><div class="text-h6">Duplikovat</div></q-card-section>
          <q-card-section class="q-pt-none">
            <q-select v-model="editForm.workerId" :options="workerOptions" label="Pracovník" emit-value map-options outlined dense class="q-mb-sm"/>
            <q-select v-model="editForm.contractId" :options="contractOptions" label="Zakázka" emit-value map-options outlined dense class="q-mb-sm"/>
            <q-select v-model="editForm.jobId" :options="jobOptions" label="Práce" emit-value map-options outlined dense class="q-mb-sm"/>
            <q-select v-model="editForm.placeId" :options="placeOptions" label="Místo" emit-value map-options outlined dense class="q-mb-sm"/>
            <q-input v-model="editForm.dateEdit" label="Datum" outlined dense readonly class="q-mb-sm">
              <template v-slot:append><q-icon name="event" class="cursor-pointer"><q-popup-proxy cover ref="dupDateProxy"><q-date v-model="editForm.dateEdit" mask="DD. MM. YYYY" locale="cs" @update:model-value="$refs.dupDateProxy.hide()"/></q-popup-proxy></q-icon></template>
            </q-input>
            <q-input v-model="editForm.timeFrom" label="Od" outlined dense class="q-mb-sm">
              <template v-slot:append><q-icon name="schedule" class="cursor-pointer"><q-popup-proxy cover ref="dupTimeFromProxy"><q-time v-model="editForm.timeFrom" mask="HH:mm" format24h @update:model-value="val => { if(val && val.length===5) $refs.dupTimeFromProxy.hide() }"/></q-popup-proxy></q-icon></template>
            </q-input>
            <q-input v-model="editForm.timeTo" label="Do" outlined dense class="q-mb-sm">
              <template v-slot:append><q-icon name="schedule" class="cursor-pointer"><q-popup-proxy cover ref="dupTimeToProxy"><q-time v-model="editForm.timeTo" mask="HH:mm" format24h @update:model-value="val => { if(val && val.length===5) $refs.dupTimeToProxy.hide() }"/></q-popup-proxy></q-icon></template>
            </q-input>
            <q-input v-model="editForm.note" label="Poznámka" outlined dense/>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup/>
            <q-btn label="Uložit" color="primary" @click="saveDuplicate"/>
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- DIALOG - OBĚD -->
      <q-dialog v-model="lunchDialog">
        <q-card style="width:100%; max-width:350px">
          <q-card-section><div class="text-h6">Oběd</div></q-card-section>
          <q-card-section class="q-pt-none">
            <q-select v-model="newLunch.workerId" :options="workerOptions" label="Pracovník *" emit-value map-options outlined dense class="q-mb-sm"/>
            <q-input v-model="newLunch.date" label="Datum" outlined dense readonly class="q-mb-sm">
              <template v-slot:append><q-icon name="event" class="cursor-pointer"><q-popup-proxy cover ref="lunchDateProxy"><q-date v-model="newLunch.date" mask="DD. MM. YYYY" locale="cs" @update:model-value="$refs.lunchDateProxy.hide()"/></q-popup-proxy></q-icon></template>
            </q-input>
            <q-input v-model="newLunch.time" label="Čas" outlined dense>
              <template v-slot:append><q-icon name="schedule" class="cursor-pointer"><q-popup-proxy cover ref="lunchTimeProxy"><q-time v-model="newLunch.time" mask="HH:mm" format24h @update:model-value="val => { if(val && val.length===5) $refs.lunchTimeProxy.hide() }"/></q-popup-proxy></q-icon></template>
            </q-input>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup/>
            <q-btn label="Uložit" color="primary" @click="saveLunch"/>
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- DIALOG - ZÁLOHA -->
      <q-dialog v-model="advanceDialog">
        <q-card style="width:100%; max-width:350px">
          <q-card-section><div class="text-h6">Záloha</div></q-card-section>
          <q-card-section class="q-pt-none">
            <q-select v-model="newAdvance.workerId" :options="workerOptions" label="Pracovník *" emit-value map-options outlined dense class="q-mb-sm"/>
            <q-input v-model="newAdvance.date" label="Datum" outlined dense readonly class="q-mb-sm">
              <template v-slot:append><q-icon name="event" class="cursor-pointer"><q-popup-proxy cover ref="advanceDateProxy"><q-date v-model="newAdvance.date" mask="DD. MM. YYYY" locale="cs" @update:model-value="$refs.advanceDateProxy.hide()"/></q-popup-proxy></q-icon></template>
            </q-input>
            <q-input v-model.number="newAdvance.amount" label="Částka (Kč) *" type="number" outlined dense class="q-mb-sm"/>
            <q-input v-model="newAdvance.reason" label="Důvod *" outlined dense/>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup/>
            <q-btn label="Uložit" color="primary" @click="saveAdvance"/>
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  `
});
