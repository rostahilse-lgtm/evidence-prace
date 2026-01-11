const app = Vue.createApp({
  data() {
    return {
      isLoggedIn: false,
      loginCode: '',
      apiUrl: localStorage.getItem('apiUrl') || DEFAULT_API_URL,
      showApiUrl: false,
      loading: false,
      message: '',
      currentUser: null,
      isAdmin: false,
      currentView: 'home',
      currentTab: 'shift',
      summaryTab: 'finances',
      adminTab: 'workers',
      adminDayView: 'today',
      contracts: [],
      jobs: [],
      workers: [],
      records: [],
      advances: [],
      lunches: [],
      summary: { totalEarnings: 0, totalPaid: 0, balance: 0 },
      allSummary: [],
      allRecords: [],
      allAdvances: [],
      dayRecords: [],
      selectedWorkerData: null,
      selectedDate: getTodayDate(),
      editDialog: false,
      editingRecord: null,
      editForm: { contractId: null, jobId: null, timeFr: null, timeTo: null, note: '' },
      useDateFilter: false,
      dateFrom: getMonthStart(),
      dateTo: getTodayDate(),
      shiftForm: { contractId: null, jobId: null, timeStart: null, timeEnd: null, note: '' },
      advanceForm: { amount: null, reason: '' }
    }
  },
  
  mounted() {
    const savedId = localStorage.getItem('workerId');
    if (savedId) {
      this.loginCode = savedId;
      this.login();
    }
  },
  
  methods: {
    async login() {
      if (!this.loginCode) {
        this.showMessage('Zadejte kód pracovníka');
        return;
      }
      this.loading = true;
      const res = await apiCall('get', { type: 'workers' });
      if (res.code === '000' && res.data) {
        const worker = res.data.find(w => String(w[0]) === String(this.loginCode));
        if (worker) {
          this.currentUser = { id: worker[0], name: worker[1], active: worker[2] === 'Y', admin: worker[3] === 'Y' };
          this.isAdmin = this.currentUser.admin;
          this.isLoggedIn = true;
          localStorage.setItem('workerId', this.currentUser.id);
          this.loadShiftState();
          await this.loadInitialData();
          if (this.isAdmin) {
            this.workers = res.data;
            await this.loadAdminData();
          }
          this.showMessage('Přihlášen: ' + this.currentUser.name);
        } else {
          this.showMessage('Neplatný kód pracovníka');
        }
      } else {
        this.showMessage('Chyba: ' + (res.error || 'Nepodařilo se načíst data'));
      }
      this.loading = false;
    },
    
    logout() {
      this.isLoggedIn = false;
      this.currentUser = null;
      this.isAdmin = false;
      this.loginCode = '';
      localStorage.removeItem('workerId');
      this.clearShiftState();
      this.showMessage('Odhlášen');
    },
    
    async loadInitialData() {
      this.loading = true;
      const [c, j, s, r, a] = await Promise.all([
        apiCall('get', { type: 'contracts' }),
        apiCall('get', { type: 'jobs' }),
        apiCall('getsummary', { id_worker: this.currentUser.id }),
        apiCall('getrecords', { id_worker: this.currentUser.id }),
        apiCall('getadvances', { id_worker: this.currentUser.id })
      ]);
      if (c.data) this.contracts = c.data;
      if (j.data) this.jobs = j.data;
      if (s.data) this.summary = s.data;
      if (r.data) this.records = r.data;
      if (a.data) {
        this.advances = a.data.filter(adv => adv[5] !== 'oběd');
        this.lunches = a.data.filter(adv => adv[5] === 'oběd');
      }
      this.loading = false;
    },
    
    async loadAdminData() {
      this.loading = true;
      const [summary, records, advances] = await Promise.all([
        apiCall('getallsummary'),
        apiCall('getallrecords'),
        apiCall('getalladvances')
      ]);
      if (summary.data) this.allSummary = summary.data;
      if (records.data) this.allRecords = records.data;
      if (advances.data) this.allAdvances = advances.data;
      await this.loadDayRecords();
      this.loading = false;
    },
    
    async loadDayRecords() {
      const date = this.adminDayView === 'today' ? getTodayDate() : this.selectedDate;
      const res = await apiCall('getdayrecords', { date: date });
      if (res.data) {
        this.dayRecords = res.data.sort((a, b) => a[4] - b[4]);
      }
    },
    
    selectWorker(worker) {
      this.selectedWorkerData = {
        info: worker,
        records: this.allRecords.filter(r => String(r[1]) === String(worker.id)),
        advances: this.allAdvances.filter(a => String(a[0]) === String(worker.id))
      };
      this.adminTab = 'detail';
    },
    
    backToWorkers() {
      this.selectedWorkerData = null;
      this.adminTab = 'workers';
    },
    
    openEditDialog(record, index) {
      this.editingRecord = { data: record, index: index };
      const contract = this.contracts.find(c => c[1] === record[0]);
      const job = this.jobs.find(j => j[1] === record[3]);
      this.editForm = {
        contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null,
        timeFr: record[4],
        timeTo: record[5],
        note: record[8]
      };
      this.editDialog = true;
    },
    
    async saveEdit() {
      if (!this.editForm.contractId || !this.editForm.jobId || !this.editForm.timeFr || !this.editForm.timeTo) {
        this.showMessage('Vyplňte všechna pole');
        return;
      }
      this.loading = true;
      const res = await apiCall('updaterecord', {
        row_index: this.editingRecord.index,
        id_contract: this.editForm.contractId,
        id_job: this.editForm.jobId,
        time_fr: this.editForm.timeFr,
        time_to: this.editForm.timeTo,
        note: this.editForm.note
      });
      if (res.code === '000') {
        this.showMessage('✓ Záznam upraven');
        this.editDialog = false;
        await this.loadAdminData();
      } else {
        this.showMessage('Chyba: ' + res.error);
      }
      this.loading = false;
    },
    
    saveShiftState() {
      const state = { 
        timeStart: this.shiftForm.timeStart, 
        timeEnd: this.shiftForm.timeEnd, 
        contractId: this.shiftForm.contractId, 
        jobId: this.shiftForm.jobId, 
        note: this.shiftForm.note, 
        date: getTodayDate() 
      };
      localStorage.setItem('shiftState_' + this.currentUser.id, JSON.stringify(state));
    },
    
    loadShiftState() {
      const saved = localStorage.getItem('shiftState_' + this.currentUser.id);
      if (saved) {
        const state = JSON.parse(saved);
        if (state.date === getTodayDate()) {
          this.shiftForm.timeStart = state.timeStart;
          this.shiftForm.timeEnd = state.timeEnd;
          this.shiftForm.contractId = state.contractId;
          this.shiftForm.jobId = state.jobId;
          this.shiftForm.note = state.note;
        } else this.clearShiftState();
      }
    },
    
    clearShiftState() {
      if (this.currentUser) localStorage.removeItem('shiftState_' + this.currentUser.id);
      this.shiftForm = { contractId: null, jobId: null, timeStart: null, timeEnd: null, note: '' };
    },
    
    setArrival() {
      this.shiftForm.timeStart = Date.now();
      this.saveShiftState();
      this.showMessage('Příchod: ' + formatTime(this.shiftForm.timeStart));
    },
    
    setDeparture() {
      if (!this.shiftForm.timeStart) {
        this.showMessage('Nejdříve zaznamenejte příchod');
        return;
      }
      this.shiftForm.timeEnd = Date.now();
      this.saveShiftState();
      this.showMessage('Odchod: ' + formatTime(this.shiftForm.timeEnd));
    },
    
    async saveShift() {
      if (!this.shiftForm.contractId || !this.shiftForm.jobId || !this.shiftForm.timeStart || !this.shiftForm.timeEnd) {
        this.showMessage('Vyplňte všechna pole');
        return;
      }
      if (!this.shiftForm.note || this.shiftForm.note.trim() === '') {
        this.showMessage('Poznámka je povinná');
        return;
      }
      this.loading = true;
      const res = await apiCall('saverecord', {
        id_contract: this.shiftForm.contractId,
        id_worker: this.currentUser.id,
        id_job: this.shiftForm.jobId,
        time_fr: this.shiftForm.timeStart,
        time_to: this.shiftForm.timeEnd,
        note: this.shiftForm.note
      });
      if (res.code === '000') {
        this.showMessage('✓ Směna uložena');
        this.clearShiftState();
        await this.loadInitialData();
        if (this.isAdmin) await this.loadAdminData();
      } else this.showMessage('Chyba: ' + res.error);
      this.loading = false;
    },
    
    async saveLunch() {
      this.loading = true;
      const res = await apiCall('savelunch', { 
        id_worker: this.currentUser.id, 
        name_worker: this.currentUser.name, 
        time: Date.now() 
      });
      if (res.code === '000') {
        this.showMessage('✓ Oběd uložen');
        await this.loadInitialData();
        if (this.isAdmin) await this.loadAdminData();
      } else this.showMessage('Chyba: ' + res.error);
      this.loading = false;
    },
    
    async saveAdvance() {
      if (!this.advanceForm.amount || !this.advanceForm.reason) {
        this.showMessage('Vyplňte částku a důvod');
        return;
      }
      this.loading = true;
      const res = await apiCall('saveadvance', { 
        id_worker: this.currentUser.id, 
        name_worker: this.currentUser.name, 
        time: Date.now(), 
        payment: this.advanceForm.amount, 
        payment_reason: this.advanceForm.reason 
      });
      if (res.code === '000') {
        this.showMessage('✓ Záloha uložena');
        this.advanceForm.amount = null;
        this.advanceForm.reason = '';
        await this.loadInitialData();
        if (this.isAdmin) await this.loadAdminData();
      } else this.showMessage('Chyba: ' + res.error);
      this.loading = false;
    },
    
    showMessage(msg) {
      this.message = msg;
      setTimeout(() => this.message = '', 4000);
    },
    
    saveApiUrl() {
      if (this.apiUrl && this.apiUrl.trim()) {
        localStorage.setItem('apiUrl', this.apiUrl.trim());
        this.showMessage('✓ API URL uloženo');
      }
    },
    
    resetApiUrl() {
      this.apiUrl = DEFAULT_API_URL;
      localStorage.setItem('apiUrl', DEFAULT_API_URL);
      this.showMessage('✓ Obnoveno výchozí URL')

 // === UTILITY FUNKCE PRO ŠABLONU ===
    // Přidejte tyto řádky na konec sekce methods: { ... zde }
    
    formatTime,
    formatShortDateTime,
    formatTimeRange,
    getTodayDate,
    getMonthStart,
    parseDateString,
    formatDateForInput,
    formatDateFromInput 
   },
                          
  computed: {
    contractOptions() {
      return this.contracts.map(c => ({ label: `${c[0]} - ${c[1]}`, value: c[0] }));
    },
    jobOptions() {
      return this.jobs.map(j => ({ label: j[1], value: j[0] }));
    },
    dateRangeLabel() {
      if (!this.useDateFilter) return 'Od začátku do dneška';
      return `${this.dateFrom} - ${this.dateTo}`;
    },
    filteredRecords() {
      if (!this.useDateFilter) return this.records;
      const from = parseDateString(this.dateFrom);
      const to = parseDateString(this.dateTo);
      to.setHours(23, 59, 59);
      return this.records.filter(r => {
        const recordDate = new Date(r[4]);
        return recordDate >= from && recordDate <= to;
      });
    },
    filteredAdvances() {
      if (!this.useDateFilter) return this.advances;
      const from = parseDateString(this.dateFrom);
      const to = parseDateString(this.dateTo);
      to.setHours(23, 59, 59);
      return this.advances.filter(a => {
        const advDate = new Date(a[1]);
        return advDate >= from && advDate <= to;
      });
    },
    filteredLunches() {
      if (!this.useDateFilter) return this.lunches;
      const from = parseDateString(this.dateFrom);
      const to = parseDateString(this.dateTo);
      to.setHours(23, 59, 59);
      return this.lunches.filter(l => {
        const lunchDate = new Date(l[1]);
        return lunchDate >= from && lunchDate <= to;
      });
    }
  },
  
  watch: {
    'shiftForm.contractId'() { this.saveShiftState(); },
    'shiftForm.jobId'() { this.saveShiftState(); },
    'shiftForm.note'() { this.saveShiftState(); },
    'adminDayView'() { if (this.isAdmin) this.loadDayRecords(); },
    'selectedDate'() { if (this.isAdmin) this.loadDayRecords(); }
  },

  template: `
    <div v-if="!isLoggedIn" class="login-container">
      <div class="login-card">
        <h1 style="text-align: center; color: #1976D2; margin-bottom: 2rem;">Evidence práce 2026</h1>
        <q-input v-model="loginCode" label="Kód pracovníka" type="number" outlined @keyup.enter="login" class="q-mb-md"/>
        <q-btn @click="login" label="Přihlásit" color="primary" :loading="loading" class="full-width q-mt-md" size="lg"/>
      </div>
    </div>

    <q-layout view="hHh lpR fFf" v-else>
      <q-header style="background: #1976D2; color: white; padding: 1rem;">
        <div class="row items-center">
          <div class="col">
            {{ currentUser.name }}
            <span v-if="isAdmin" class="admin-badge q-ml-sm">ADMIN</span>
          </div>
          <q-btn flat dense icon="logout" @click="logout"/>
        </div>
      </q-header>

      <q-page-container>
        <div v-if="currentView === 'home'" class="tab-content">
          <q-tabs v-model="currentTab" dense align="justify" class="text-primary">
            <q-tab name="shift" label="Směna"/>
            <q-tab name="lunch" label="Oběd"/>
            <q-tab name="advance" label="Záloha"/>
          </q-tabs>

          <div v-if="currentTab === 'shift'" class="q-pt-md">
            <q-btn @click="setArrival" color="green" icon="login" label="PŘÍCHOD" class="full-width q-mb-md time-btn" :disabled="shiftForm.timeStart"/>
            <div v-if="shiftForm.timeStart" class="q-mb-md q-pa-sm" style="background: #e8f5e9; border-radius: 4px;">
              <div class="text-bold text-green-8">✓ Příchod zaznamenán</div>
              <div>{{ formatShortDateTime(shiftForm.timeStart) }}</div>
            </div>
            <q-btn @click="setDeparture" color="orange" icon="logout" label="ODCHOD" class="full-width q-mb-md time-btn" :disabled="!shiftForm.timeStart || shiftForm.timeEnd"/>
            <div v-if="shiftForm.timeEnd" class="q-mb-md q-pa-sm" style="background: #fff3e0; border-radius: 4px;">
              <div class="text-bold text-orange-8">✓ Odchod zaznamenán</div>
              <div>{{ formatShortDateTime(shiftForm.timeEnd) }}</div>
              <div class="text-primary text-bold q-mt-sm">Odpracováno: {{ ((shiftForm.timeEnd - shiftForm.timeStart) / 3600000).toFixed(2) }} hod</div>
            </div>
            <q-select v-model="shiftForm.contractId" :options="contractOptions" label="Zakázka *" emit-value map-options outlined class="q-mb-md"/>
            <q-select v-model="shiftForm.jobId" :options="jobOptions" label="Práce *" emit-value map-options outlined class="q-mb-md"/>
            <q-input v-model="shiftForm.note" label="Poznámka *" outlined class="q-mb-md" type="textarea" rows="3"/>
            <q-btn @click="saveShift" label="Uložit směnu" color="primary" :loading="loading" class="full-width" size="lg"/>
          </div>

          <div v-if="currentTab === 'lunch'" class="q-pt-md">
            <div class="text-center q-mb-md">
              <q-icon name="restaurant" size="4rem" color="orange"/>
              <div class="text-h6 q-mt-md">{{ getTodayDate() }}</div>
            </div>
            <q-btn @click="saveLunch" label="Uložit oběd" color="orange" :loading="loading" class="full-width" size="lg" icon="restaurant"/>
          </div>

          <div v-if="currentTab === 'advance'" class="q-pt-md">
            <q-input v-model.number="advanceForm.amount" label="Částka (Kč) *" type="number" outlined class="q-mb-md"/>
            <q-input v-model="advanceForm.reason" label="Důvod *" outlined class="q-mb-md" type="textarea" rows="2"/>
            <q-btn @click="saveAdvance" label="Uložit zálohu" color="primary" :loading="loading" class="full-width" size="lg"/>
          </div>
        </div>

        <div v-if="currentView === 'summary'" class="tab-content">
          <q-tabs v-model="summaryTab" dense align="justify" class="text-primary">
            <q-tab name="finances" label="Finance"/>
            <q-tab name="records" label="Záznamy"/>
            <q-tab name="lunches" label="Obědy"/>
            <q-tab name="advances" label="Zálohy"/>
          </q-tabs>

          <div class="date-filter-box q-mt-md">
            <q-checkbox v-model="useDateFilter" label="Filtrovat podle data" class="q-mb-sm"/>
            <div v-if="useDateFilter" class="row q-gutter-sm">
              <div class="col">
                <q-input v-model="dateFrom" label="Od" type="date" outlined dense :model-value="formatDateForInput(dateFrom)" @update:model-value="dateFrom = formatDateFromInput($event)"/>
              </div>
              <div class="col">
                <q-input v-model="dateTo" label="Do" type="date" outlined dense :model-value="formatDateForInput(dateTo)" @update:model-value="dateTo = formatDateFromInput($event)"/>
              </div>
            </div>
            <div class="text-caption text-grey-7 q-mt-sm">{{ dateRangeLabel }}</div>
          </div>

          <div v-if="summaryTab === 'finances'">
            <div class="summary-box">
              <div class="summary-item">
                <span class="summary-label">Vyděleno:</span>
                <span class="summary-value">{{ summary.totalEarnings }} Kč</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Vyplaceno:</span>
                <span class="summary-value">{{ summary.totalPaid }} Kč</span>
              </div>
              <q-separator class="q-my-sm"/>
              <div class="summary-item">
                <span class="summary-label">Zůstatek:</span>
                <span :class="summary.balance >= 0 ? 'balance-positive' : 'balance-negative'">{{ summary.balance }} Kč</span>
              </div>
            </div>
          </div>

          <div v-if="summaryTab === 'records'">
            <div v-if="filteredRecords.length === 0" class="text-center text-grey-7 q-mt-lg">Žádné záznamy</div>
            <div v-for="record in filteredRecords" :key="record[4]" class="record-card">
              <div class="row items-center">
                <div class="col">
                  <div class="text-bold">{{ record[0] }}</div>
                  <div class="text-caption text-grey-7">{{ record[3] }}</div>
                </div>
                <div class="text-right">
                  <div class="text-bold text-primary">{{ record[7].toFixed(2) }} hod</div>
                  <div class="text-caption">{{ record[2] }} Kč/hod</div>
                </div>
              </div>
              <div class="text-caption text-grey-7 q-mt-sm">{{ formatTimeRange(record[4], record[5]) }}</div>
              <div v-if="record[8]" class="note-display">💬 {{ record[8] }}</div>
            </div>
          </div>

          <div v-if="summaryTab === 'lunches'">
            <div v-if="filteredLunches.length === 0" class="text-center text-grey-7 q-mt-lg">Žádné obědy</div>
            <div v-for="lunch in filteredLunches" :key="lunch[1]" class="record-card">
              <div class="row items-center">
                <div class="col">
                  <q-icon name="restaurant" color="orange" size="sm"/>
                  <span class="q-ml-sm text-bold">Oběd</span>
                </div>
                <div class="text-right text-bold text-primary">{{ lunch[4] }} Kč</div>
              </div>
              <div class="text-caption text-grey-7 q-mt-sm">{{ formatShortDateTime(lunch[1]) }}</div>
            </div>
          </div>

          <div v-if="summaryTab === 'advances'">
            <div v-if="filteredAdvances.length === 0" class="text-center text-grey-7 q-mt-lg">Žádné zálohy</div>
            <div v-for="advance in filteredAdvances" :key="advance[1]" class="record-card">
              <div class="row items-center">
                <div class="col">
                  <div class="text-bold">{{ advance[5] }}</div>
                </div>
                <div class="text-right text-bold text-primary">{{ advance[4] }} Kč</div>
              </div>
              <div class="text-caption text-grey-7 q-mt-sm">{{ formatShortDateTime(advance[1]) }}</div>
            </div>
          </div>
        </div>

        <div v-if="currentView === 'admin' && isAdmin" class="tab-content">
          <q-tabs v-model="adminTab" dense align="justify" class="text-primary">
            <q-tab name="workers" label="Pracovníci"/>
            <q-tab name="day" label="Přehled dne"/>
          </q-tabs>

          <div v-if="adminTab === 'workers'" class="q-pt-md">
            <div v-for="worker in allSummary" :key="worker.id" class="worker-card" @click="selectWorker(worker)">
              <div class="row items-center">
                <div class="col">
                  <div class="text-bold">{{ worker.name }}</div>
                  <div class="text-caption text-grey-7">ID: {{ worker.id }}</div>
                </div>
                <div class="text-right">
                  <div class="text-bold" :class="worker.balance >= 0 ? 'balance-positive' : 'balance-negative'">{{ worker.balance }} Kč</div>
                  <div class="text-caption">Vyděleno: {{ worker.totalEarnings }} Kč</div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="adminTab === 'detail' && selectedWorkerData" class="q-pt-md">
            <q-btn flat icon="arrow_back" label="Zpět" @click="backToWorkers" class="q-mb-md"/>
            
            <div class="summary-box">
              <div class="text-h6 q-mb-md">{{ selectedWorkerData.info.name }}</div>
              <div class="summary-item">
                <span class="summary-label">Vyděleno:</span>
                <span class="summary-value">{{ selectedWorkerData.info.totalEarnings }} Kč</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Vyplaceno:</span>
                <span class="summary-value">{{ selectedWorkerData.info.totalPaid }} Kč</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Zůstatek:</span>
                <span :class="selectedWorkerData.info.balance >= 0 ? 'balance-positive' : 'balance-negative'">{{ selectedWorkerData.info.balance }} Kč</span>
              </div>
            </div>

            <q-tabs v-model="summaryTab" dense class="q-mt-md">
              <q-tab name="records" label="Záznamy"/>
              <q-tab name="advances" label="Zálohy"/>
            </q-tabs>

            <div v-if="summaryTab === 'records'" class="q-mt-md">
              <div v-for="(record, idx) in selectedWorkerData.records" :key="idx" class="record-card">
                <div class="row items-center">
                  <div class="col">
                    <div class="text-bold">{{ record[0] }}</div>
                    <div class="text-caption text-grey-7">{{ record[3] }}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-bold text-primary">{{ record[7].toFixed(2) }} hod</div>
                    <div class="text-caption">{{ record[2] }} Kč/hod</div>
                  </div>
                  <q-icon name="edit" class="edit-icon q-ml-sm" @click="openEditDialog(record, idx)"/>
                </div>
                <div class="text-caption text-grey-7 q-mt-sm">{{ formatTimeRange(record[4], record[5]) }}</div>
                <div v-if="record[8]" class="note-display">💬 {{ record[8] }}</div>
              </div>
            </div>

            <div v-if="summaryTab === 'advances'" class="q-mt-md">
              <div v-for="(advance, idx) in selectedWorkerData.advances" :key="idx" class="record-card">
                <div class="row items-center">
                  <div class="col">
                    <div class="text-bold">{{ advance[5] }}</div>
                  </div>
                  <div class="text-right text-bold text-primary">{{ advance[4] }} Kč</div>
                </div>
                <div class="text-caption text-grey-7 q-mt-sm">{{ formatShortDateTime(advance[1]) }}</div>
              </div>
            </div>
          </div>

          <div v-if="adminTab === 'day'" class="q-pt-md">
            <div class="row q-gutter-sm q-mb-md">
              <q-btn :color="adminDayView === 'today' ? 'primary' : 'grey-5'" label="Dnes" @click="adminDayView = 'today'" class="col"/>
              <q-btn :color="adminDayView === 'date' ? 'primary' : 'grey-5'" label="Datum" @click="adminDayView = 'date'" class="col"/>
            </div>

            <div v-if="adminDayView === 'date'" class="q-mb-md">
              <q-input v-model="selectedDate" label="Vyberte datum" type="date" outlined :model-value="formatDateForInput(selectedDate)" @update:model-value="selectedDate = formatDateFromInput($event)"/>
            </div>

            <div class="text-h6 q-mb-md">{{ adminDayView === 'today' ? getTodayDate() : selectedDate }}</div>

            <div v-if="dayRecords.length === 0" class="text-center text-grey-7 q-mt-lg">Žádné záznamy pro tento den</div>
            <div v-for="(record, idx) in dayRecords" :key="idx" class="record-card">
              <div class="row items-center">
                <div class="col">
                  <div class="text-bold">{{ record[6] }}</div>
                  <div class="text-caption">{{ record[0] }} • {{ record[3] }}</div>
                </div>
                <div class="text-right">
                  <div class="text-bold text-primary">{{ record[7].toFixed(2) }} hod</div>
                </div>
                <q-icon name="edit" class="edit-icon q-ml-sm" @click="openEditDialog(record, idx)"/>
              </div>
              <div class="text-caption text-grey-7 q-mt-sm">{{ formatTimeRange(record[4], record[5]) }}</div>
              <div v-if="record[8]" class="note-display">💬 {{ record[8] }}</div>
            </div>
          </div>
        </div>
      </q-page-container>

      <q-footer style="background: white; border-top: 1px solid #e0e0e0;">
        <q-tabs v-model="currentView" dense align="justify" active-color="primary" indicator-color="primary">
          <q-tab name="home" icon="work" label="Domů"/>
          <q-tab name="summary" icon="analytics" label="Přehledy"/>
          <q-tab v-if="isAdmin" name="admin" icon="admin_panel_settings" label="Admin"/>
        </q-tabs>
      </q-footer>

      <q-dialog v-model="editDialog">
        <q-card style="min-width: 350px">
          <q-card-section>
            <div class="text-h6">Upravit záznam</div>
          </q-card-section>

          <q-card-section class="q-pt-none">
            <q-select v-model="editForm.contractId" :options="contractOptions" label="Zakázka" emit-value map-options outlined class="q-mb-md"/>
            <q-select v-model="editForm.jobId" :options="jobOptions" label="Práce" emit-value map-options outlined class="q-mb-md"/>
            
            <div class="row q-gutter-sm q-mb-md">
              <div class="col">
                <q-input v-model="editForm.timeFr" label="Čas od" type="datetime-local" outlined dense :model-value="new Date(editForm.timeFr).toISOString().slice(0, 16)" @update:model-value="editForm.timeFr = new Date($event).getTime()"/>
              </div>
              <div class="col">
                <q-input v-model="editForm.timeTo" label="Čas do" type="datetime-local" outlined dense :model-value="new Date(editForm.timeTo).toISOString().slice(0, 16)" @update:model-value="editForm.timeTo = new Date($event).getTime()"/>
              </div>
            </div>

            <q-input v-model="editForm.note" label="Poznámka" outlined type="textarea" rows="2"/>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="Storno" color="red" v-close-popup/>
            <q-btn flat label="Přepsat" color="green" @click="saveEdit" :loading="loading"/>
          </q-card-actions>
        </q-card>
      </q-dialog>

      <q-dialog v-model="!!message" position="bottom">
        <q-card style="width: 100%; max-width: 400px;">
          <q-card-section class="row items-center q-pa-md">
            <div class="text-body1">{{ message }}</div>
          </q-card-section>
        </q-card>
      </q-dialog>
    </q-layout>
  `
});

app.use(Quasar);
app.mount('#app');




