const app = Vue.createApp({
  data() {
    return {
      isLoggedIn: false,
      currentUser: null,
      isAdmin: false,
      currentView: 'home',
      loading: false,
      message: '',
      showMessageDialog: false,
      
      // Data pro všechny komponenty
      contracts: [],
      jobs: [],
      workers: [],
      records: [],
      advances: [],
      lunches: [],
      summary: { totalEarnings: 0, totalPaid: 0, balance: 0 },
      
      // Admin data (načtou se jen pro adminy)
      allSummary: [],
      allRecords: [],
      allAdvances: []
    }
  },
  
  mounted() {
    const savedId = localStorage.getItem('workerId');
    if (savedId) {
      this.autoLogin(savedId);
    }
  },
  
  methods: {
    async autoLogin(workerId) {
      this.loading = true;
      const res = await apiCall('get', { type: 'workers' });
      if (res.code === '000' && res.data) {
        const worker = res.data.find(w => String(w[0]) === String(workerId));
        if (worker) {
          await this.setCurrentUser(worker);
        } else {
          localStorage.removeItem('workerId');
        }
      }
      this.loading = false;
    },
    
    async setCurrentUser(worker) {
      this.currentUser = { 
        id: worker[0], 
        name: worker[1], 
        active: worker[2] === 'Y', 
        admin: worker[3] === 'Y' 
      };
      this.isAdmin = this.currentUser.admin;
      this.isLoggedIn = true;
      localStorage.setItem('workerId', this.currentUser.id);
      
      await this.loadUserData();
      
      if (this.isAdmin) {
        await this.loadAdminData();
      }
      
      this.showMessage('Přihlášen: ' + this.currentUser.name);
    },
    
    async loadUserData() {
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
      const [summary, records, advances, workers] = await Promise.all([
        apiCall('getallsummary'),
        apiCall('getallrecords'),
        apiCall('getalladvances'),
        apiCall('get', { type: 'workers' })
      ]);
      
      if (summary.data) this.allSummary = summary.data;
      if (records.data) this.allRecords = records.data;
      if (advances.data) this.allAdvances = advances.data;
      if (workers.data) this.workers = workers.data;
      this.loading = false;
    },
    
    logout() {
      this.isLoggedIn = false;
      this.currentUser = null;
      this.isAdmin = false;
      localStorage.removeItem('workerId');
      this.showMessage('Odhlášen');
    },
    
    showMessage(msg) {
      this.message = msg;
      this.showMessageDialog = true;
      setTimeout(() => {
        this.message = '';
        this.showMessageDialog = false;
      }, 4000);
    }
  },
  
  computed: {
    contractOptions() {
      return this.contracts.map(c => ({ label: `${c[0]} - ${c[1]}`, value: c[0] }));
    },
    jobOptions() {
      return this.jobs.map(j => ({ label: j[1], value: j[0] }));
    }
  },

  template: `
    <div v-if="!isLoggedIn">
      <login-component @login="setCurrentUser" @message="showMessage" :loading="loading"></login-component>
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
        <div v-if="currentView === 'home'">
          <home-component 
            :current-user="currentUser"
            :contracts="contractOptions"
            :jobs="jobOptions"
            :loading="loading"
            @message="showMessage"
            @reload="loadUserData">
          </home-component>
        </div>

        <div v-if="currentView === 'summary'">
          <summary-component
            :summary="summary"
            :records="records"
            :advances="advances"
            :lunches="lunches"
            @message="showMessage">
          </summary-component>
        </div>

        <div v-if="currentView === 'admin' && isAdmin">
          <admin-component
            :all-summary="allSummary"
            :all-records="allRecords"
            :all-advances="allAdvances"
            :contracts="contractOptions"
            :jobs="jobOptions"
            :loading="loading"
            @message="showMessage"
            @reload="loadAdminData">
          </admin-component>
        </div>

        <div v-if="currentView === 'settings'">
          <settings-component @message="showMessage"></settings-component>
        </div>
      </q-page-container>

      <q-footer style="background: white; border-top: 1px solid #e0e0e0;">
        <q-tabs v-model="currentView" dense align="justify" active-color="primary" indicator-color="primary">
          <q-tab name="home" icon="work" label="Domů"/>
          <q-tab name="summary" icon="analytics" label="Přehledy"/>
          <q-tab v-if="isAdmin" name="admin" icon="admin_panel_settings" label="Admin"/>
          <q-tab name="settings" icon="settings" label="Nastavení"/>
        </q-tabs>
      </q-footer>

      <q-dialog v-model="showMessageDialog" position="bottom">
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
