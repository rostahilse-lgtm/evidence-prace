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
      summary: { totalEarnings: 0, totalPaid: 0, balance: 0 },
      records: [],
      advances: [],
      lunches: [],
      allSummary: [],
      allRecords: [],
      allAdvances: [],
      // FILTR ZDROJE DAT
      dataSource: 'new',
      filterDateFrom: null,
      filterDateTo: null,
      filterLoading: false
    }
  },

  computed: {
    sourceLabel() {
      const labels = { new: 'Nové', history: 'Historie', all: 'Vše' };
      let label = labels[this.dataSource] || 'Nové';
      if (this.filterDateFrom || this.filterDateTo) {
        label += ' ' + (this.filterDateFrom || '...') + '→' + (this.filterDateTo || '...');
      }
      return label;
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
      if (worker[3] !== 'Y') {
        this.showMessage('❌ Tato sekce je pouze pro adminy!');
        return;
      }
      this.currentUser = {
        id: worker[0],
        name: worker[1],
        active: worker[2] === 'Y',
        admin: worker[3] === 'Y'
      };
      this.isLoggedIn = true;
      this.isAdmin = true;
      localStorage.setItem('adminWorkerId', this.currentUser.id);
      await this.loadUserData();
      await this.loadAdminData();
      this.showMessage('Přihlášen jako admin: ' + this.currentUser.name);
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

    async loadAdminData(params) {
      this.loading = true;
      const p = params || { source: this.dataSource };
      if (this.filterDateFrom && !params) p.date_from = this.dateStrToTs(this.filterDateFrom);
      if (this.filterDateTo && !params) p.date_to = this.dateStrToTs(this.filterDateTo, true);

      const [summary, records, advances] = await Promise.all([
        apiCall('getallsummary', p),
        apiCall('getallrecords', p),
        apiCall('getalladvances', p)
      ]);
      if (summary.data) this.allSummary = summary.data;
      if (records.data) this.allRecords = records.data;
      if (advances.data) this.allAdvances = advances.data;
      this.loading = false;
    },

    dateStrToTs(dateStr, endOfDay = false) {
      if (!dateStr) return null;
      const p = dateStr.split('. ');
      const d = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
      if (endOfDay) d.setHours(23, 59, 59, 999);
      return d.getTime();
    },

    async applyFilter() {
      this.filterLoading = true;
      const params = { source: this.dataSource };
      if (this.filterDateFrom) params.date_from = this.dateStrToTs(this.filterDateFrom);
      if (this.filterDateTo) params.date_to = this.dateStrToTs(this.filterDateTo, true);
      await this.loadAdminData(params);
      this.filterLoading = false;
    },

    resetFilter() {
      this.dataSource = 'new';
      this.filterDateFrom = null;
      this.filterDateTo = null;
      this.loadAdminData({ source: 'new' });
    },

    logout() {
      this.isLoggedIn = false;
      this.currentUser = null;
      this.isAdmin = false;
      localStorage.removeItem('adminWorkerId');
      this.showMessage('Odhlášen');
    }
  },

  async mounted() {
    const savedId = localStorage.getItem('adminWorkerId');
    if (savedId) {
      this.loading = true;
      const res = await apiCall('get', { type: 'workers' });
      if (res.code === '000' && res.data) {
        const worker = res.data.find(w => String(w[0]) === String(savedId));
        if (worker && worker[3] === 'Y') {
          await this.handleLogin(worker);
        } else {
          localStorage.removeItem('adminWorkerId');
        }
      }
      this.loading = false;
    }
  },

  template: `
    <q-layout view="hHh lpR fFf">
      <q-header v-if="isLoggedIn" class="bg-red text-white">
        <q-toolbar>
          <q-toolbar-title>
            <q-icon name="admin_panel_settings" class="q-mr-sm"/>
            ADMIN Panel - {{ currentUser.name }}
            <q-badge color="white" text-color="red" class="q-ml-sm" style="font-size:0.7rem">
              {{ sourceLabel }}
            </q-badge>
          </q-toolbar-title>
          <!-- Tlačítka výběru zdroje dat -->
          <q-btn-group flat>
            <q-btn :outline="dataSource!=='new'" color="white" label="Nové" size="sm" dense
              @click="dataSource='new'; applyFilter()"/>
            <q-btn :outline="dataSource!=='history'" color="white" label="Hist." size="sm" dense
              @click="dataSource='history'; applyFilter()"/>
            <q-btn :outline="dataSource!=='all'" color="white" label="Vše" size="sm" dense
              @click="dataSource='all'; applyFilter()"/>
          </q-btn-group>
          <q-spinner v-if="filterLoading" color="white" size="sm" class="q-ml-xs"/>
        </q-toolbar>
        <!-- Datum od/do filtr -->
        <div class="row q-px-sm q-pb-xs q-gutter-xs items-center" style="background:rgba(0,0,0,0.15)">
          <q-input v-model="filterDateFrom" label="Od" dense dark borderless readonly
            style="max-width:110px; font-size:0.75rem">
            <template v-slot:append>
              <q-icon name="event" class="cursor-pointer" size="xs">
                <q-popup-proxy cover ref="fromProxy">
                  <q-date v-model="filterDateFrom" mask="DD. MM. YYYY" locale="cs"
                    @update:model-value="$refs.fromProxy.hide()"/>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
          <q-input v-model="filterDateTo" label="Do" dense dark borderless readonly
            style="max-width:110px; font-size:0.75rem">
            <template v-slot:append>
              <q-icon name="event" class="cursor-pointer" size="xs">
                <q-popup-proxy cover ref="toProxy">
                  <q-date v-model="filterDateTo" mask="DD. MM. YYYY" locale="cs"
                    @update:model-value="$refs.toProxy.hide()"/>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
          <q-btn color="white" text-color="red" label="Načíst" dense size="sm" unelevated
            @click="applyFilter()" :loading="filterLoading"/>
          <q-btn v-if="filterDateFrom||filterDateTo" flat color="white" icon="close" dense size="sm"
            @click="resetFilter()">
            <q-tooltip>Reset filtru</q-tooltip>
          </q-btn>
        </div>
      </q-header>

      <q-page-container>
        <q-page padding>
          <div v-if="loading" class="flex flex-center q-pa-xl">
            <q-spinner color="red" size="3em" />
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
            :is-admin="isAdmin"
            :contracts="contracts"
            :jobs="jobs"
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
            v-if="isLoggedIn && currentView === 'admin' && !loading"
            :all-summary="allSummary"
            :all-records="allRecords"
            :all-advances="allAdvances"
            :contracts="contracts"
            :jobs="jobs"
            :loading="loading"
            @message="showMessage"
            @reload="applyFilter"
          />

          <statistics-component
            v-if="isLoggedIn && currentView === 'statistics' && !loading"
            :all-records="allRecords"
            :all-advances="allAdvances"
            :contracts="contracts"
            :jobs="jobs"
            @message="showMessage"
          />

          <stavebni-denik-component
            v-if="isLoggedIn && currentView === 'denik' && !loading"
            :all-records="allRecords"
            :contracts="contracts"
            @message="showMessage"
          />

          <settings-component
            v-if="isLoggedIn && currentView === 'settings' && !loading"
            :current-user="currentUser"
            @message="showMessage"
            @logout="logout"
          />
        </q-page>
      </q-page-container>

      <q-footer v-if="isLoggedIn" class="bg-white text-grey-8">
        <q-tabs v-model="currentView" dense align="justify" active-color="red">
          <q-tab name="home" icon="home" label="Směna" />
          <q-tab name="summary" icon="assessment" label="Přehled" />
          <q-tab name="admin" icon="admin_panel_settings" label="Admin" />
          <q-tab name="statistics" icon="bar_chart" label="Statistiky" />
          <q-tab name="denik" icon="description" label="Deník" />
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
  window.app.mount('#admin-app');
}, 100);
