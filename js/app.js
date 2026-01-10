const app = Vue.createApp({
  data() {
    return {
      isLoggedIn: false,
      loginCode: '',
      loading: false,
      message: '',
      currentUser: null,
      currentTab: 'shift',
      contracts: [],
      jobs: [],
      records: [],
      summary: { totalEarnings: 0, totalPaid: 0, balance: 0 },
      shiftForm: { contractId: null, jobId: null, timeStart: null, timeEnd: null, note: '' }
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
        this.showMessage('Zadejte kód');
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
          await this.loadData();
          this.showMessage('Přihlášen: ' + this.currentUser.name);
        } else {
          this.showMessage('Neplatný kód');
        }
      }
      this.loading = false;
    },
    
    logout() {
      this.isLoggedIn = false;
      this.currentUser = null;
      this.loginCode = '';
      localStorage.removeItem('workerId');
      this.showMessage('Odhlášen');
    },
    
    async loadData() {
      const [c, j, s, r] = await Promise.all([
        apiCall('get', { type: 'contracts' }),
        apiCall('get', { type: 'jobs' }),
        apiCall('getsummary', { id_worker: this.currentUser.id }),
        apiCall('getrecords', { id_worker: this.currentUser.id })
      ]);
      if (c.data) this.contracts = c.data;
      if (j.data) this.jobs = j.data;
      if (s.data) this.summary = s.data;
      if (r.data) this.records = r.data;
    },
    
    setArrival() {
      this.shiftForm.timeStart = Date.now();
      this.showMessage('Příchod zaznamenán');
    },
    
    setDeparture() {
      if (!this.shiftForm.timeStart) {
        this.showMessage('Nejdříve příchod');
        return;
      }
      this.shiftForm.timeEnd = Date.now();
      this.showMessage('Odchod zaznamenán');
    },
    
    async saveShift() {
      if (!this.shiftForm.contractId || !this.shiftForm.jobId || !this.shiftForm.timeStart || !this.shiftForm.timeEnd || !this.shiftForm.note) {
        this.showMessage('Vyplňte všechna pole');
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
        this.shiftForm = { contractId: null, jobId: null, timeStart: null, timeEnd: null, note: '' };
        await this.loadData();
      } else {
        this.showMessage('Chyba');
      }
      this.loading = false;
    },
    
    showMessage(msg) {
      this.message = msg;
      setTimeout(() => this.message = '', 3000);
    }
  },
  
  computed: {
    contractOptions() {
      return this.contracts.map(c => ({ label: c[0] + ' - ' + c[1], value: c[0] }));
    },
    jobOptions() {
      return this.jobs.map(j => ({ label: j[1], value: j[0] }));
    }
  },
  
  template: `
    <div v-if="!isLoggedIn" class="login-container">
      <div class="login-card">
        <h1 style="text-align:center;color:#1976D2;margin-bottom:2rem">Evidence 2026</h1>
        <q-input v-model="loginCode" label="Kód" type="number" outlined @keyup.enter="login"/>
        <q-btn @click="login" label="Přihlásit" color="primary" :loading="loading" class="full-width q-mt-md" size="lg"/>
      </div>
    </div>
    <q-layout view="hHh lpR fFf" v-else>
      <q-header style="background:#1976D2;color:white;padding:1rem">
        <div class="row items-center">
          <div class="col">{{currentUser.name}}</div>
          <q-btn flat dense icon="logout" @click="logout"/>
        </div>
      </q-header>
      <q-page-container>
        <div class="tab-content">
          <q-btn @click="setArrival" color="green" label="PŘÍCHOD" class="full-width q-mb-md" :disabled="shiftForm.timeStart"/>
          <q-btn @click="setDeparture" color="orange" label="ODCHOD" class="full-width q-mb-md" :disabled="!shiftForm.timeStart||shiftForm.timeEnd"/>
          <q-select v-model="shiftForm.contractId" :options="contractOptions" label="Zakázka" emit-value map-options outlined class="q-mb-md"/>
          <q-select v-model="shiftForm.jobId" :options="jobOptions" label="Práce" emit-value map-options outlined class="q-mb-md"/>
          <q-input v-model="shiftForm.note" label="Poznámka" outlined class="q-mb-md" type="textarea"/>
          <q-btn @click="saveShift" label="Uložit" color="primary" :loading="loading" class="full-width"/>
        </div>
      </q-page-container>
      <q-dialog v-model="!!message" position="bottom">
        <q-card><q-card-section>{{message}}</q-card-section></q-card>
      </q-dialog>
    </q-layout>
  `
});

app.use(Quasar);
app.mount('#app');
