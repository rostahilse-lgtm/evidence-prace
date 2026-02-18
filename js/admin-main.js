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
      dataSource: 'new',
      filterDateFrom: null,
      filterDateTo: null
    }
  },

  computed: {
    sourceLabel() {
      const labels = { new: 'Nové', history: 'Historie', all: 'Vše' };
      return labels[this.dataSource] || 'Nové';
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

    async loadAdminData() {
      this.loading = true;
      const params = { source: this.dataSource };
      
      const [summary, records, advances] = await Promise.all([
        apiCall('getallsummary', params),
        apiCall('getallrecords', params),
        apiCall('getalladvances', params)
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
            <q-chip dense color="white" text-color="red" size="sm" class="q-ml-xs">
              {{ sourceLabel }}
            </q-chip>
          </q-toolbar-title>
          <q-btn-group>
            <q-btn :color="dataSource==='new'?'blue':'grey-7'" :text-color="dataSource==='new'?'white':'grey-4'" 
              label="Nové" size="sm" dense unelevated
              @click="dataSource='new'; loadAdminData()"/>
            <q-btn :color="dataSource==='history'?'green':'grey-7'" :text-color="dataSource==='history'?'white':'grey-4'"
              label="Historie" size="sm" dense unelevated
              @click="dataSource='history'; loadAdminData()"/>
            <q-btn :color="dataSource==='all'?'orange':'grey-7'" :text-color="dataSource==='all'?'white':'grey-4'"
              label="Vše" size="sm" dense unelevated
              @click="dataSource='all'; loadAdminData()"/>
          </q-btn-group>
        </q-toolbar>
        <!-- Datum od/do - ZATÍM BEZ FUNKCE -->
        <div class="row q-px-sm q-pb-xs q-gutter-xs items-center" style="background:rgba(0,0,0,0.15)">
          <q-input v-model="filterDateFrom" label="Od" dense dark borderless readonly
            style="max-width:110px; font-size:0.75rem" bg-color="transparent">
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
            style="max-width:110px; font-size:0.75rem" bg-color="transparent">
            <template v-slot:append>
              <q-icon name="event" class="cursor-pointer" size="xs">
                <q-popup-proxy cover ref="toProxy">
                  <q-date v-model="filterDateTo" mask="DD. MM. YYYY" locale="cs"
                    @update:model-value="$refs.toProxy.hide()"/>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
          <q-btn color="white" text-color="red" label="Načíst" dense size="sm" unelevated disabled>
            <q-tooltip>Zatím nefunguje</q-tooltip>
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
            @reload="loadAdminData"
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
