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
      // ZDROJ DAT
      dataSource: 'new',
      histDateFrom: '',
      histDateTo: ''
    }
  },

  computed: {
    dataSourceLabel() {
      if (this.dataSource === 'new') return 'NOVÉ';
      if (this.dataSource === 'history') return 'HISTORIE';
      return 'VŠE';
    },
    showDateFilter() {
      return this.dataSource === 'history' || this.dataSource === 'all';
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

    setDataSource(source) {
      this.dataSource = source;
      // Pokud přepneme na 'new', načteme rovnou bez datumu
      if (source === 'new') {
        this.loadAdminData();
      }
      // Pro history a all čekáme na klik NAČÍST (nebo rovnou načteme bez filtru)
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

      // Sestavit parametry podle zdroje a datumu
      const params = { source: this.dataSource };
      if (this.showDateFilter && this.histDateFrom) {
        params.date_from = new Date(this.histDateFrom).getTime();
      }
      if (this.showDateFilter && this.histDateTo) {
        params.date_to = new Date(this.histDateTo).getTime();
      }

      const [summary, records, advances] = await Promise.all([
        apiCall('getallsummary', params),
        apiCall('getallrecords', params),
        apiCall('getalladvances', params)
      ]);
      if (summary.data) this.allSummary = summary.data;
      if (records.data) this.allRecords = records.data;
      if (advances.data) this.allAdvances = advances.data;

      const label = this.dataSourceLabel;
      const dateInfo = (this.showDateFilter && this.histDateFrom && this.histDateTo)
        ? ` (${this.histDateFrom} – ${this.histDateTo})`
        : '';
      this.showMessage(`✓ Načteno: ${label}${dateInfo}`);

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
          <q-toolbar-title style="font-size:1rem">
            <q-icon name="admin_panel_settings" class="q-mr-xs"/>
            {{ currentUser.name }}
            <q-badge color="white" text-color="red" class="q-ml-sm" style="font-size:0.7rem">{{ dataSourceLabel }}</q-badge>
          </q-toolbar-title>

          <!-- PŘEPÍNAČ ZDROJE -->
          <q-btn-group flat>
            <q-btn
              dense flat size="sm" label="NOVÉ"
              :color="dataSource==='new' ? 'white' : 'red-9'"
              @click="setDataSource('new')"
            />
            <q-btn
              dense flat size="sm" label="HIST"
              :color="dataSource==='history' ? 'white' : 'red-9'"
              @click="setDataSource('history')"
            />
            <q-btn
              dense flat size="sm" label="VŠE"
              :color="dataSource==='all' ? 'white' : 'red-9'"
              @click="setDataSource('all')"
            />
          </q-btn-group>

          <q-btn flat round dense icon="logout" @click="logout" class="q-ml-sm"/>
        </q-toolbar>

        <!-- ŘÁDEK S DATUMY - jen pro HIST a VŠE -->
        <div v-if="showDateFilter" class="row q-px-sm q-pb-sm q-gutter-xs items-center">
          <q-input
            v-model="histDateFrom"
            type="date"
            dense outlined dark
            label="Od"
            style="max-width:140px; background:rgba(255,255,255,0.15)"
            class="col"
          />
          <q-input
            v-model="histDateTo"
            type="date"
            dense outlined dark
            label="Do"
            style="max-width:140px; background:rgba(255,255,255,0.15)"
            class="col"
          />
          <q-btn
            dense unelevated
            label="NAČÍST"
            color="white"
            text-color="red"
            @click="loadAdminData"
            :loading="loading"
          />
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
            @message="showMessage"
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
