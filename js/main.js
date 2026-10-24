// Evidence práce 2026 - main.js
// v2026-10-23 - NOVÉ: automatické tiché obnovení dat při otevření Přehledů a Adminu
//             (Admin ukazoval staré zálohy a šichty, protože se data načetla jen při přihlášení).
// v2026-10-22 - NOVÉ: verze webu se bere z /version.json (commit + čas nasazení z Vercelu) → mění se
//             automaticky při každém nasazení; bez něj zůstane appVersion.
// v2026-10-15 - NOVÉ: v modrém pruhu vedle ADMIN se adminovi ukazuje verze (web = main.js,
//             server = kod.gs zjištěné z API), ať je vidět, co je nasazené.
// v2026-10-13 - NOVÉ: reloadAllSilent - po uložení v Adminu a v Rozpracovaných se data
//             obnoví BEZ zničení obrazovky (zůstane zvolené menu, datum, záložka,
//             vybraný pracovník). Dřív reloadAll zobrazil loading a komponenty se
//             znovu vytvořily od začátku. Home a Nastavení zůstávají na reloadAll.
// v2026-02-27 - přesun Admin mezi Přehledy a Nástroje, Nástroje obsahují Statistiky+Deník
//             - přidána funkce přihlásit jako pracovník (impersonace) s tlačítkem Zpět
//             - nic jsem nesmazal, pouze přidal nové funkce
// v2026-03-10 - NOVÉ: canNotifObedy (worker[8]=Y z sloupce I v pracovníci)
// v2026-03-11 - NOVÉ: Nástroje vidí všichni přihlášení, přidána záložka Rozpracované
//             - nic jsem nesmazal
//             - NOVÉ: scheduleObedyCheck — timer v 18:00, zkontroluje objednávky, pošle notifikaci
//             - nic jsem nesmazal
// v2026-05-07 - NOVÉ: handleClearShift — propojení settings → home přes clear-shift event
//             - přidán ref="homeComponent" na home-component
//             - přidán @clear-shift na home-component a settings-component
//             - nic jsem nesmazal

window.app = Vue.createApp({
  data() {
    return {
      isLoggedIn: false,
      currentUser: null,
      isAdmin: false,
      currentView: 'home',
      loading: false,
      refreshing: false, // v2026-10-13: tiché obnovení dat (komponenty se neodmontují)
      // v2026-10-15 NOVÉ: verze zobrazená adminovi v modrém pruhu vedle ADMIN.
      // appVersion = verze tohoto souboru (main.js) - PŘI KAŽDÉ ÚPRAVĚ main.js PŘEPSAT na dnešní datum.
      // serverVersion = verze kod.gs, zjistí se z API (viz loadServerVersion).
      appVersion: 'v2026-10-23',
      buildVersion: '',
      lastRefresh: Date.now(),
      serverVersion: '',
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

    // v2026-10-13: parametr silent = bez this.loading (komponenty se nezničí a nezmizí zvolená záložka/datum)
    async loadUserData(silent = false) {
      if (!silent) this.loading = true;
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
      this.lastRefresh = Date.now();
      if (!silent) this.loading = false;
    },

    async loadAdminData(silent = false) {
      if (!silent) this.loading = true;
      const source = localStorage.getItem('dataSource') || 'new';
      const [summary, records, advances] = await Promise.all([
        apiCall('getallsummary', { source }),
        apiCall('getallrecords', { source }),
        apiCall('getalladvances', { source })
      ]);
      if (summary.data) this.allSummary = summary.data;
      if (records.data) this.allRecords = records.data;
      if (advances.data) this.allAdvances = advances.data;
      // v2026-10-15: verzi serveru stačí zjistit jednou, nečeká se na ni (neblokuje načtení)
      if (!this.buildVersion) this.loadBuildVersion();
      if (!this.serverVersion || this.serverVersion === '?') this.loadServerVersion();
      if (!silent) this.loading = false;
    },

    // v2026-10-15 NOVÉ: zjistí verzi kod.gs (výchozí odpověď API obsahuje 'version').
    // Když se nepodaří, ukáže se '?'. Slouží k ověření, že je nasazená nová verze serveru.
    // v2026-10-22 NOVÉ: číslo nasazení webu (commit + čas) z /version.json, které vytvoří Vercel při každém nasazení.
    async loadBuildVersion() {
      try {
        const r = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
        const j = await r.json();
        if (j && j.commit) this.buildVersion = j.commit + ' ' + (j.date || '');
      } catch (e) { /* bez version.json se ukáže appVersion */ }
    },

    async loadServerVersion() {
      const res = await apiCall('version', {});
      this.serverVersion = (res && res.data && res.data.version) ? res.data.version : '?';
    },

    // v2026-10-23 NOVÉ: data se obnoví sama (dřív se načetla jen při přihlášení, takže Admin
    // ukazoval staré šichty a zálohy). Obnoví se jen při otevření Přehledů a Adminu,
    // ne častěji než jednou za 10 s.
    softRefresh() {
      if (!this.isLoggedIn || this.loading || this.refreshing) return;
      if (Date.now() - this.lastRefresh < 10000) return;
      this.reloadAllSilent();
    },

    async reloadAll() {
      await this.loadUserData();
      if (this.isAdmin) await this.loadAdminData();
    },

    // v2026-10-13 NOVÉ: reload BEZ zničení obrazovky. reloadAll nastavuje loading=true
    // a komponenty mají v-if="!loading", takže po každém uložení admin/nástroje zmizely
    // a po návratu byly zase na výchozí záložce a dnešním datu (zvolené menu, datum,
    // vybraný pracovník... se ztratily). Tady zůstanou komponenty vykreslené, jen se
    // vymění data (komponenty na změnu dat reagují samy). Po dobu obnovy (obvykle
    // 1-2 s) je přes obrazovku průhledná vrstva - zabrání kliknutí na ještě
    // neobnovená data (po smazání řádku se mění čísla řádků, takže druhý rychlý
    // klik na staré hodnoty by mohl zasáhnout jiný záznam).
    async reloadAllSilent() {
      if (this.refreshing) return;
      this.refreshing = true;
      try {
        await this.loadUserData(true);
        if (this.isAdmin) await this.loadAdminData(true);
      } catch (e) {
        this.showMessage('Chyba při obnovení dat - zkuste to znovu');
      } finally {
        this.refreshing = false;
      }
    },

    // NOVÉ v2026-03-10: naplánovat kontrolu objednávek v 18:00
    scheduleObedyCheck() {
      if (localStorage.getItem('notifObedy') !== 'true') return;
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const now = new Date();
      const check = new Date();
      check.setHours(18, 0, 0, 0);
      if (now >= check) return;
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

    // v2026-05-07: clear-shift handler
    // settings emituje clear-shift → zavoláme clearShiftState na home komponentě
    handleClearShift() {
      const homeRef = this.$refs.homeComponent;
      if (homeRef && homeRef.clearShiftState) {
        homeRef.clearShiftState();
      }
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

  watch: {
    // v2026-10-23: data se tiše obnoví jen při otevření Přehledů a Adminu
    currentView(v) { if (v === 'summary' || v === 'admin') this.softRefresh(); }
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
          <!-- v2026-10-15: verze appky (web) a serveru (kod.gs), jen pro admina -->
          <span v-if="isAdmin" class="q-ml-sm" style="font-size:9px;line-height:1.25;opacity:0.85;text-align:right;white-space:nowrap">web {{ buildVersion || appVersion }}<br>server {{ serverVersion || '…' }}</span>
          <span v-if="isAdmin" class="admin-badge q-ml-sm">ADMIN</span>
        </q-toolbar>
      </q-header>

      <q-page-container>
        <q-page padding>
          <div v-if="loading" class="flex flex-center q-pa-xl">
            <q-spinner color="primary" size="3em" />
          </div>
          <!-- v2026-10-13: tiché obnovení dat - nic se neodmontuje, jen krátce blokuje klikání -->
          <div v-if="refreshing" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:7000;background:rgba(255,255,255,0.35);display:flex;align-items:center;justify-content:center">
            <q-spinner color="primary" size="2.5em" />
          </div>

          <login-component
            v-if="!isLoggedIn && !loading"
            :loading="loading"
            @login="handleLogin"
            @message="showMessage"
          />

          <!-- DOMŮ - v2026-05-07: přidán ref a @clear-shift -->
          <home-component
            ref="homeComponent"
            v-if="isLoggedIn && currentView === 'home' && !loading"
            :current-user="currentUser"
            :is-admin="isAdmin"
            :contracts="contracts"
            :jobs="jobs"
            :places="places"
            :loading="loading"
            @message="showMessage"
            @reload="reloadAll"
            @clear-shift="handleClearShift"
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
            @reload="reloadAllSilent"
            @login-as="loginAs"
          />

          <!-- NÁSTROJE -->
          <div v-if="isLoggedIn && currentView === 'tools' && !loading">
            <q-tabs v-model="toolsView" dense align="justify" class="text-primary q-mb-md">
              <q-tab name="nedokoncene" icon="build" label="Rozpracované"/>
              <q-tab v-if="currentUser && currentUser.canStats" name="stats" icon="bar_chart" label="Statistiky"/>
              <q-tab v-if="currentUser && currentUser.canDenik" name="denik" icon="menu_book" label="Deník"/>
              <q-tab v-if="isAdmin" name="kontrola" icon="compare_arrows" label="Kontrola dat"/>             
            </q-tabs>
            <nedokoncene-component
              v-if="toolsView === 'nedokoncene'"
              :current-user="currentUser"
              :contracts="contracts"
              :jobs="jobs"
              :places="places"
              @message="showMessage"
              @reload="reloadAllSilent"
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
            <kontrola-component
              v-if="toolsView === 'kontrola' && isAdmin"
              @message="showMessage"
            />
          </div>

          <!-- NASTAVENÍ - v2026-05-07: přidán @clear-shift -->
          <settings-component
            v-if="isLoggedIn && currentView === 'settings' && !loading"
            @message="showMessage"
            @logout="logout"
            @reload="reloadAll"
            @clear-shift="handleClearShift"
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
