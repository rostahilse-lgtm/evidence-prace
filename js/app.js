const app = Vue.createApp({
  data() {
    return {
      isLoggedIn: false,
      loginCode: '',
      loading: false,
      message: '',
      currentUser: null,
      currentTab: 'shift',
      summaryTab: 'finances',
      contracts: [],
      jobs: [],
      records: [],
      advances: [],
      lunches: [],
      summary: { totalEarnings: 0, totalPaid: 0, balance: 0 },
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
          this.currentUser = { id: worker[0], name: worker[1] };
          this.isLoggedIn = true;
          localStorage.setItem('workerId', this.currentUser.id);
          this.loadShiftState();
          await this.loadInitialData();
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
      } else this.showMessage('Chyba: ' + res.error);
      this.loading = false;
    },
    
    showMessage(msg) {
      this.message = msg;
      setTimeout(() => this.message = '', 4000);
    }
  },
  
  computed: {
    contractOptions() {
      return this.contracts.map(c => ({ label: c[0] + ' - ' + c[1], value: c[0] }));
    },
    jobOptions() {
      return this.jobs.map(j => ({ label: j[1], value: j[0] }));
    },
    dateRangeLabel() {
      if (!this.useDateFilter) return 'Od začátku do dneška';
      return this.dateFrom + ' - ' + this.dateTo;
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
    'shiftForm.note'() { this.saveShiftState(); }
  },
  
  template: `
    <div v-if="!isLoggedIn" class="login-container">
      <div class="login-card">
        <h1 style="text-align:center;color:#1976D2;margin-bottom:2rem">Evidence práce 2026</h1>
        <q-input v-model="loginCode" label="Kód pracovníka" type="number" outlined @keyup.enter="login" class="q-mb-md"></q-input>
        <q-btn @click="login" label="Přihlásit" color="primary" :loading="loading" class="full-width q-mt-md" size="lg"></q-btn>
      </div>
    </div>
    <q-layout view="hHh lpR fFf" v-else>
      <q-header style="background:#1976D2;color:white;padding:1rem">
        <div class="row items-center">
          <div class="col">{{currentUser.name}}</div>
          <q-btn flat dense icon="logout" @click="logout"></q-btn>
        </div>
      </q-header>
      <q-page-container>
        <div class="tab-content">
          <q-tabs v-model="currentTab" dense align="justify" class="text-primary">
            <q-tab name="shift" label="Směna"></q-tab>
            <q-tab name="lunch" label="Oběd"></q-tab>
            <q-tab name="advance" label="Záloha"></q-tab>
            <q-tab name="summary" label="Přehledy"></q-tab>
          </q-tabs>
          <div v-if="currentTab==='shift'" class="q-pt-md">
            <q-btn @click="setArrival" color="green" icon="login" label="PŘÍCHOD" class="full-width q-mb-md" style="font-size:1.1rem;padding:1rem" :disabled="shiftForm.timeStart"></q-btn>
            <div v-if="shiftForm.timeStart" class="q-mb-md q-pa-sm" style="background:#e8f5e9;border-radius:4px">
              <div class="text-bold" style="color:#2e7d32">✓ Příchod zaznamenán</div>
              <div>{{formatShortDateTime(shiftForm.timeStart)}}</div>
            </div>
            <q-btn @click="setDeparture" color="orange" icon="logout" label="ODCHOD" class="full-width q-mb-md" style="font-size:1.1rem;padding:1rem" :disabled="!shiftForm.timeStart||shiftForm.timeEnd"></q-btn>
            <div v-if="shiftForm.timeEnd" class="q-mb-md q-pa-sm" style="background:#fff3e0;border-radius:4px">
              <div class="text-bold" style="color:#e65100">✓ Odchod zaznamenán</div>
              <div>{{formatShortDateTime(shiftForm.timeEnd)}}</div>
              <div class="text-bold q-mt-sm" style="color:#1976D2">Odpracováno: {{((shiftForm.timeEnd-shiftForm.timeStart)/3600000).toFixed(2)}} hod</div>
            </div>
            <q-select v-model="shiftForm.contractId" :options="contractOptions" label="Zakázka *" emit-value map-options outlined class="q-mb-md"></q-select>
            <q-select v-model="shiftForm.jobId" :options="jobOptions" label="Práce *" emit-value map-options outlined class="q-mb-md"></q-select>
            <q-input v-model="shiftForm.note" label="Poznámka *" outlined class="q-mb-md" type="textarea" rows="3"></q-input>
            <q-btn @click="saveShift" label="Uložit směnu" color="primary" :loading="loading" class="full-width" size="lg"></q-btn>
          </div>
          <div v-if="currentTab==='lunch'" class="q-pt-md">
            <div class="text-center q-mb-md">
              <q-icon name="restaurant" size="4rem" color="orange"></q-icon>
              <div class="text-h6 q-mt-md">{{getTodayDate()}}</div>
            </div>
            <q-btn @click="saveLunch" label="Uložit oběd" color="orange" :loading="loading" class="full-width" size="lg" icon="restaurant"></q-btn>
          </div>
          <div v-if="currentTab==='advance'" class="q-pt-md">
            <q-input v-model.number="advanceForm.amount" label="Částka (Kč) *" type="number" outlined class="q-mb-md"></q-input>
            <q-input v-model="advanceForm.reason" label="Důvod *" outlined class="q-mb-md" type="textarea" rows="2"></q-input>
            <q-btn @click="saveAdvance" label="Uložit zálohu" color="primary" :loading="loading" class="full-width" size="lg"></q-btn>
          </div>
          <div v-if="currentTab==='summary'" class="q-pt-md">
            <q-tabs v-model="summaryTab" dense align="justify" class="text-primary">
              <q-tab name="finances" label="Finance"></q-tab>
              <q-tab name="records" label="Záznamy"></q-tab>
              <q-tab name="lunches" label="Obědy"></q-tab>
              <q-tab name="advances" label="Zálohy"></q-tab>
            </q-tabs>
            <div style="background:#fff3e0;padding:1rem;border-radius:8px;margin:1rem 0;border-left:4px solid #ff9800">
              <q-checkbox v-model="useDateFilter" label="Filtrovat podle data" class="q-mb-sm"></q-checkbox>
              <div v-if="useDateFilter" class="row q-gutter-sm">
                <div class="col">
                  <q-input v-model="dateFrom" label="Od" type="date" outlined dense :model-value="formatDateForInput(dateFrom)" @update:model-value="dateFrom=formatDateFromInput($event)"></q-input>
                </div>
                <div class="col">
                  <q-input v-model="dateTo" label="Do" type="date" outlined dense :model-value="formatDateForInput(dateTo)" @update:model-value="dateTo=formatDateFromInput($event)"></q-input>
                </div>
              </div>
              <div class="text-caption q-mt-sm" style="color:#666">{{dateRangeLabel}}</div>
            </div>
            <div v-if="summaryTab==='finances'">
              <div class="summary-box">
                <div class="summary-item">
                  <span style="font-weight:500">Vyděleno:</span>
                  <span style="font-weight:700;color:#1976D2">{{summary.totalEarnings}} Kč</span>
                </div>
                <div class="summary-item">
                  <span style="font-weight:500">Vyplaceno:</span>
                  <span style="font-weight:700;color:#1976D2">{{summary.totalPaid}} Kč</span>
                </div>
                <q-separator class="q-my-sm"></q-separator>
                <div class="summary-item">
                  <span style="font-weight:500">Zůstatek:</span>
                  <span :class="summary.balance>=0?'balance-positive':'balance-negative'">{{summary.balance}} Kč</span>
                </div>
              </div>
            </div>
            <div v-if="summaryTab==='records'">
              <div v-if="filteredRecords.length===0" class="text-center q-mt-lg" style="color:#666">Žádné záznamy</div>
              <div v-for="record in filteredRecords" :key="record[4]" class="record-card">
                <div class="row items-center">
                  <div class="col">
                    <div class="text-bold">{{record[0]}}</div>
                    <div class="text-caption" style="color:#666">{{record[3]}}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-bold" style="color:#1976D2">{{record[7].toFixed(2)}} hod</div>
                    <div class="text-caption">{{record[2]}} Kč/hod</div>
                  </div>
                </div>
                <div class="text-caption q-mt-sm" style="color:#666">{{formatTimeRange(record[4],record[5])}}</div>
                <div v-if="record[8]" style="background:#e8f5e9;padding:0.75rem;border-radius:4px;margin-top:0.5rem;border-left:3px solid #4caf50">💬 {{record[8]}}</div>
              </div>
            </div>
            <div v-if="summaryTab==='lunches'">
              <div v-if="filteredLunches.length===0" class="text-center q-mt-lg" style="color:#666">Žádné obědy</div>
              <div v-for="lunch in filteredLunches" :key="lunch[1]" class="record-card">
                <div class="row items-center">
                  <div class="col">
                    <q-icon name="restaurant" color="orange" size="sm"></q-icon>
                    <span class="q-ml-sm text-bold">Oběd</span>
                  </div>
                  <div class="text-right text-bold" style="color:#1976D2">{{lunch[4]}} Kč</div>
                </div>
                <div class="text-caption q-mt-sm" style="color:#666">{{formatShortDateTime(lunch[1])}}</div>
              </div>
            </div>
            <div v-if="summaryTab==='advances'">
              <div v-if="filteredAdvances.length===0" class="text-center q-mt-lg" style="color:#666">Žádné zálohy</div>
              <div v-for="advance in filteredAdvances" :key="advance[1]" class="record-card">
                <div class="row items-center">
                  <div class="col">
                    <div class="text-bold">{{advance[5]}}</div>
                  </div>
                  <div class="text-right text-bold" style="color:#1976D2">{{advance[4]}} Kč</div>
                </div>
                <div class="text-caption q-mt-sm" style="color:#666">{{formatShortDateTime(advance[1])}}</div>
              </div>
            </div>
          </div>
        </div>
      </q-page-container>
      <q-dialog v-model="!!message" position="bottom">
        <q-card style="width:100%;max-width:400px">
          <q-card-section class="row items-center q-pa-md">
            <div class="text-body1">{{message}}</div>
          </q-card-section>
        </q-card>
      </q-dialog>
    </q-layout>
  `
});

app.use(Quasar);
app.mount('#app');
