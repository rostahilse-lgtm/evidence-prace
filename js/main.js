// Evidence práce 2026 - main.js
// v2026-02-22 - source parametr obnoven v getrecords/getadvances, logout odstraněn z headeru
// v2026-02-21a - Oprava: odebran source (chybně) → oprava Přehledů
// v2026-02-21  - Oprava destructuringu, places přidány, zdroj dat za jménem

window.app = Vue.createApp({
  data() {
    return {
      isLoggedIn: false,
      currentUser: null,
      isAdmin: false,
      currentView: 'home',
      loading: false,
      message: '',
      showMessageDialog: false,
      contracts: [],
      jobs: [],
      places: [],
      summary: { totalEarnings: 0, totalPaid: 0, balance: 0 },
      records: [],
      advances: [],
      lunches: [],
      allSummary: [],
      allRecords: [],
      allAdvances: []
    }
  },

  computed: {
    dataSourceLabel() {
      const s = localStorage.getItem('dataSource') || 'new';
      if (s === 'history') return '· HIST';
      if (s === 'all') return '· VŠE';
   return ''; 
    }
  },

  methods: {
    showMessage(msg) {
      this.message = msg;
      this.showMessageDialog = true;
      setTimeout(() => {
        this.message = '';
        this.showMessageDialog = false;
      }, 4000);
    },

    async handleLogin(worker) {
      this.currentUser = {
        id: worker[0],
        name: worker[1],
        active: worker[2] === 'Y',
        admin: worker[3] === 'Y'
      };
      this.isLoggedIn = true;
      this.isAdmin = this.currentUser.admin;
      localStorage.setItem('workerId', this.currentUser.id);
      await this.loadUserData();
      if (this.isAdmin) await this.loadAdminData();
      this.showMessage('Přihlášen: ' + this.currentUser.name);
    },

    async loadUserData() {
      this.loading = true;
      const source = localStorage.getItem('dataSource') || 'new';

      const [c, j, s, r, a, p] = await Promise.all([
        apiCall('get', { type: 'contracts' }),
        apiCall('get', { type: 'jobs' }),
        apiCall('getsummary', { id_worker: this.currentUser.id }),
        apiCall('getrecords', { id_worker: this.currentUser.id, source }),
        apiCall('getadvances', { id_worker: this.currentUser.id, source }),
        apiCall('get', { type: 'places' })
      ]);
      if (c.data) this.contracts = c.data;
      if (j.data) this.jobs = j.data;
      if (s.data) this.summary = s.data;
      if (r.data) this.records = r.data;
      if (a.data) {
        this.advances = a.data.filter(adv => adv[5] !== 'oběd');
        this.lunches = a.data.filter(adv => adv[5] === 'oběd');
      }
      if (p.data) this.places = p.data;
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
      this.loading = false;
    },

    logout() {
      this.isLoggedIn = false;
      this.currentUser = null;
      this.isAdmin = false;
      localStorage.removeItem('workerId');
      this.showMessage('Odhlášen');
    }
  },

  async mounted() {
    const savedId = localStorage.getItem('workerId');
    if (savedId) {
      this.loading = true;
      const res = await apiCall('get', { type: 'workers' });
      if (res.code === '000' && res.data) {
        const worker = res.data.find(w => String(w[0]) === String(savedId));
        if (worker) await this.handleLogin(worker);
        else localStorage.removeItem('workerId');
      }
      this.loading = false;
    }
  },

  template: `
    <q-layout view="hHh lpR fFf">
      <q-header v-if="isLoggedIn" class="bg-primary text-white">
        <q-toolbar>
          <q-toolbar-title>
            {{ currentUser.name }}
            <span class="text-caption q-ml-sm">{{ dataSourceLabel }}</span>
          </q-toolbar-title>
          <span v-if="isAdmin" class="admin-badge q-ml-sm">ADMIN</span>
          <q-btn v-if="isAdmin" flat dense label="PANEL" icon-right="open_in_new"
            size="sm" class="q-ml-sm" tag="a" href="admin.html" target="_blank" />
        </q-toolbar>
      </q-header>

      <q-page-container>
        <q-page padding>
          <div v-if="loading" class="flex flex-center q-pa-xl">
            <q-spinner color="primary" size="3em" />
          </div>

          <login-component
            v-if="!isLoggedIn && !loading"
            :loading="loading"
            @login="handleLogin"
            @message="showMessage"
          />

          <home-component
            v-if="isLoggedIn && currentView === 'home' && !loading"
            :current-user="currentUser"
            :contracts="contracts"
            :jobs="jobs"
            :places="places"
            :loading="loading"
            @message="showMessage"
            @reload="loadUserData"
          />

          <summary-component
            v-if="isLoggedIn && currentView === 'summary' && !loading"
            :summary="summary"
            :records="records"
            :advances="advances"
            :lunches="lunches"
          />

          <admin-component
            v-if="isLoggedIn && isAdmin && currentView === 'admin' && !loading"
            :all-summary="allSummary"
            :all-records="allRecords"
            :all-advances="allAdvances"
            :contracts="contracts"
            :jobs="jobs"
            :loading="loading"
            @message="showMessage"
            @reload="loadAdminData"
          />

          <settings-component
            v-if="isLoggedIn && currentView === 'settings' && !loading"
            @message="showMessage"
            @logout="logout"
            @reload="loadUserData"
          />
        </q-page>
      </q-page-container>

      <q-footer v-if="isLoggedIn" class="bg-white text-grey-8">
        <q-tabs v-model="currentView" dense align="justify" active-color="primary">
          <q-tab name="home" icon="home" label="Domů" />
          <q-tab name="summary" icon="assessment" label="Přehledy" />
          <q-tab v-if="isAdmin" name="admin" icon="admin_panel_settings" label="Admin" />
          <q-tab name="settings" icon="settings" label="Nastavení" />
        </q-tabs>
      </q-footer>

      <q-dialog v-model="showMessageDialog" position="bottom">
        <q-card style="width: 350px">
          <q-card-section>{{ message }}</q-card-section>
        </q-card>
      </q-dialog>
    </q-layout>
  `
});

setTimeout(() => {
  window.app.use(Quasar);
  window.app.mount('#app');
}, 100);


