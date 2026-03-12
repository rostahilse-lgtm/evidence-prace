// Evidence práce 2026 - main.js
// v2026-02-27 - přesun Admin mezi Přehledy a Nástroje, Nástroje obsahují Statistiky+Deník
//             - přidána funkce přihlásit jako pracovník (impersonace) s tlačítkem Zpět
//             - nic jsem nesmazal, pouze přidal nové funkce
// v2026-03-10 - NOVÉ: canNotifObedy (worker[8]=Y z sloupce I v pracovníci)
// v2026-03-11 - NOVÉ: Nástroje vidí všichni přihlášení, přidána záložka Rozpracované
//             - nic jsem nesmazal
//             - NOVÉ: scheduleObedyCheck — timer v 18:00, zkontroluje objednávky, pošle notifikaci
//             - nic jsem nesmazal

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
      allAdvances: [],
      dataSource: localStorage.getItem('dataSource') || 'new',
      // IMPERSONACE
      impersonating: false,
      realUser: null,
      realIsAdmin: false,
      // NÁSTROJE submenu
      toolsView: 'nedokoncene'
    }
  },

  computed: {
    dataSourceLabel() {
      if (this.dataSource === 'history') return '· HIST';
      if (this.dataSource === 'all') return '· VŠE';
      return '· NOVÉ';
    },
    statsRecords() {
      return this.isAdmin ? this.allRecords : this.records;
    },
    statsAdvances() {
      return this.isAdmin ? this.allAdvances : this.advances;
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
        admin: worker[3] === 'Y',
        canStats: worker[3] === 'Y' || worker[6] === 'Y',
        canDenik: worker[3] === 'Y' || worker[7] === 'Y',
        canNotifObedy: worker[3] === 'Y' || worker[8] === 'Y'
      };
      this.isLoggedIn = true;
      this.isAdmin = this.currentUser.admin;
      localStorage.setItem('workerId', this.currentUser.id);
      localStorage.setItem('canNotifObedy', this.currentUser.canNotifObedy ? 'Y' : 'N');
      await this.loadUserData();
      if (this.isAdmin) await this.loadAdminData();
      this.scheduleObedyCheck();
      this.showMessage('Přihlášen: ' + this.currentUser.name);
    },

    // IMPERSONACE - přihlásit jako pracovník
    async loginAs(worker) {
      this.realUser = this.currentUser;
      this.realIsAdmin = this.isAdmin;
      this.impersonating = true;
      this.currentUser = {
        id: worker[0],
        name: worker[1],
        active: worker[2] === 'Y',
        admin: worker[3] === 'Y',
        canStats: worker[3] === 'Y' || worker[6] === 'Y',
        canDenik: worker[3] === 'Y' || worker[7] === 'Y',
        canNotifObedy: worker[3] === 'Y' || worker[8] === 'Y'
      };
      this.isAdmin = false;
      await this.loadUserData();
      this.currentView = 'home';
      this.showMessage('Zobrazuji jako: ' + this.currentUser.name);
    },

    // IMPERSONACE - návrat zpět
    async returnToAdmin() {
      this.currentUser = this.realUser;
      this.isAdmin = this.realIsAdmin;
      this.impersonating = false;
      this.realUser = null;
      localStorage.setItem('workerId', this.currentUser.id);
      await this.loadUserData();
      await this.loadAdminData();
      this.currentView = 'admin';
      this.showMessage('Zpět jako: ' + this.currentUser.name);
    },

    async loadUserData() {
      this.loading = true;
      const source = localStorage.getItem('dataSource') || 'new';
      this.dataSource = source;
      const [c, j, s, r, a, p] = await Promise.all([
        apiCall('get', { type: 'contracts' }),
        apiCall('get', { type: 'jobs' }),
        apiCall('getsummary', { id_worker: this.currentUser.id, source }),
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
      const source = localStorage.getItem('dataSource') || 'new';
      const [summary, records, advances] = await Promise.all([
        apiCall('getallsummary', { source }),
        apiCall('getallrecords', { source }),
        apiCall('getalladvances', { source })
      ]);
      if (summary.data) this.allSummary = summary.data;
      if (records.data) this.allRecords = records.data;
      if (advances.data) this.allAdvances = advances.data;
      this.loading = false;
    },

    async reloadAll() {
      await this.loadUserData();
      if (this.isAdmin) await this.loadAdminData();
    },

    // NOVÉ v2026-03-10: naplánovat kontrolu objednávek v 18:00
    scheduleObedyCheck() {
      if (localStorage.getItem('notifObedy') !== 'true') return;
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const now = new Date();
      const check = new Date();
      check.setHours(18, 0, 0, 0);
      if (now >= check) return; // už je po 18:00
      const delay = check.getTime() - now.getTime();
      setTimeout(async () => {
        try {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(11, 0, 0, 0);
          const res = await apiCall('getobjednavky', { datum: tomorrow.getTime() });
          if (res.code === '000' && (!res.data || res.data.length === 0)) {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: 'SHOW_NOTIF',
                title: '🍽 Obědy nejsou objednány!',
                body: 'Nezapomeňte objednat obědy na zítřek.'
              });
            }
          }
        } catch(e) { /* noop */ }
      }, delay);
    },

    logout() {
      this.isLoggedIn = false;
      this.currentUser = null;
      this.isAdmin = false;
      this.impersonating = false;
      this.realUser = null;
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
          <q-btn v-if="impersonating" flat dense icon="arrow_back" label="Zpět" @click="returnToAdmin" class="q-mr-sm"/>
          <q-toolbar-title>
            {{ currentUser.name }}
            <span v-if="impersonating" class="text-caption q-ml-sm text-yellow">· NÁHLED</span>
            <span v-else class="text-caption q-ml-sm">{{ dataSourceLabel }}</span>
          </q-toolbar-title>
          <span v-if="isAdmin" class="admin-badge q-ml-sm">ADMIN</span>
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

          <!-- DOMŮ -->
          <home-component
            v-if="isLoggedIn && currentView === 'home' && !loading"
            :current-user="currentUser"
            :is-admin="isAdmin"
            :contracts="contracts"
            :jobs="jobs"
            :places="places"
            :loading="loading"
            @message="showMessage"
            @reload="reloadAll"
          />

          <!-- PŘEHLEDY -->
          <summary-component
            v-if="isLoggedIn && currentView === 'summary' && !loading"
            :summary="summary"
            :records="records"
            :advances="advances"
            :lunches="lunches"
          />

          <!-- ADMIN panel -->
          <admin-component
            v-if="isLoggedIn && isAdmin && currentView === 'admin' && !loading"
            :all-summary="allSummary"
            :all-records="allRecords"
            :all-advances="allAdvances"
            :contracts="contracts"
            :jobs="jobs"
            :places="places"
            :loading="loading"
            @message="showMessage"
            @reload="reloadAll"
            @login-as="loginAs"
          />

          <!-- NÁSTROJE (Statistiky + Deník) -->
          <div v-if="isLoggedIn && currentView === 'tools' && !loading">
            <q-tabs v-model="toolsView" dense align="justify" class="text-primary q-mb-md">
              <q-tab name="nedokoncene" icon="build" label="Rozpracované"/>
              <q-tab v-if="currentUser && currentUser.canStats" name="stats" icon="bar_chart" label="Statistiky"/>
              <q-tab v-if="currentUser && currentUser.canDenik" name="denik" icon="menu_book" label="Deník"/>
            </q-tabs>
            <nedokoncene-component
              v-if="toolsView === 'nedokoncene'"
              :current-user="currentUser"
              :contracts="contracts"
              :jobs="jobs"
              :places="places"
              @message="showMessage"
              @reload="reloadAll"
            />
            <statistics-component
              v-if="toolsView === 'stats' && currentUser && currentUser.canStats"
              :all-records="statsRecords"
              :is-admin="isAdmin"
              :all-advances="statsAdvances"
              :contracts="contracts"
              :jobs="jobs"
              :places="places"
              @message="showMessage"
            />
            <stavebni-denik-component
              v-if="toolsView === 'denik' && currentUser && currentUser.canDenik"
              :all-records="statsRecords"
              :is-admin="isAdmin"
              :contracts="contracts"
              @message="showMessage"
            />
          </div>

          <!-- NASTAVENÍ -->
          <settings-component
            v-if="isLoggedIn && currentView === 'settings' && !loading"
            @message="showMessage"
            @logout="logout"
            @reload="reloadAll"
          />
        </q-page>
      </q-page-container>

      <q-footer v-if="isLoggedIn" class="bg-white text-grey-8">
        <q-tabs v-model="currentView" dense align="justify" active-color="primary">
          <q-tab name="home" icon="home" label="Domů" />
          <q-tab name="summary" icon="assessment" label="Přehledy" />
          <q-tab v-if="isAdmin" name="admin" icon="admin_panel_settings" label="Admin" />
          <q-tab v-if="currentUser" name="tools" icon="widgets" label="Nástroje" />
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
