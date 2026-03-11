// Komponenta pro nastavení
// v2026-02-27 - odstraněn toggle cloud režimu, cloud je vždy zapnutý
// nic jsem nesmazal, pouze odstranil toggle a přidal automatické zapnutí
// v2026-03-10 - NOVÉ: přepínač notifikací obědů v 18:00 (jen pokud canNotifObedy=Y)
//             - nic jsem nesmazal

window.app.component('settings-component', {
  emits: ['message', 'logout', 'reload'],
  
  data() {
    return {
      apiUrl: localStorage.getItem('apiUrl') || DEFAULT_API_URL,
      dataSource: localStorage.getItem('dataSource') || 'new',
      dateFrom: localStorage.getItem('dataDateFrom') || '',
      dateTo: localStorage.getItem('dataDateTo') || '',
      notifObedy: localStorage.getItem('notifObedy') === 'true',
      canNotifObedy: localStorage.getItem('canNotifObedy') === 'Y',
      notifPermission: typeof Notification !== 'undefined' ? Notification.permission : 'denied'
    }
  },
  
  computed: {
    showDateFilter() {
      return this.dataSource === 'history' || this.dataSource === 'all';
    }
  },
  
  methods: {
    saveApiUrl() {
      if (this.apiUrl && this.apiUrl.trim()) {
        localStorage.setItem('apiUrl', this.apiUrl.trim());
        this.$emit('message', '✓ API URL uložena. Obnovte stránku.');
      } else {
        this.$emit('message', 'Zadejte platnou URL');
      }
    },
    
    resetApiUrl() {
      this.apiUrl = DEFAULT_API_URL;
      localStorage.setItem('apiUrl', DEFAULT_API_URL);
      this.$emit('message', '✓ API URL obnovena na výchozí');
    },
    
    setDataSource(source) {
      this.dataSource = source;
      localStorage.setItem('dataSource', source);
    },
    
    loadData() {
      localStorage.setItem('dataSource', this.dataSource);
      localStorage.setItem('dataDateFrom', this.dateFrom || '');
      localStorage.setItem('dataDateTo', this.dateTo || '');
      this.$emit('reload');
      this.$emit('message', '✓ Data se načítají...');
    },

    async toggleNotifObedy() {
      if (this.notifObedy) {
        // Zapnout — požádat o povolení
        if (typeof Notification === 'undefined') {
          this.$emit('message', 'Notifikace nejsou podporovány v tomto prohlížeči');
          this.notifObedy = false;
          return;
        }
        const perm = await Notification.requestPermission();
        this.notifPermission = perm;
        if (perm === 'granted') {
          localStorage.setItem('notifObedy', 'true');
          this.$emit('message', '✓ Notifikace povoleny — upozornění každý den v 18:00');
        } else {
          this.notifObedy = false;
          localStorage.setItem('notifObedy', 'false');
          this.$emit('message', 'Notifikace nebyly povoleny — povolte je v nastavení prohlížeče');
        }
      } else {
        localStorage.setItem('notifObedy', 'false');
        this.$emit('message', '✓ Notifikace vypnuty');
      }
    },
    
    confirmLogout() {
      this.$emit('logout');
    }
  },

  mounted() {
    // Cloud režim je vždy zapnutý - nelze vypnout
    localStorage.setItem('cloudShift', 'true');
  },
  
  template: `
    <div class="q-pa-md">

      <!-- ODHLÁŠENÍ -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6">Účet</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            color="red" unelevated icon="logout"
            label="Odhlásit se"
            @click="confirmLogout"
          />
        </q-card-actions>
      </q-card>

      <!-- VÝBĚR DAT PRO PŘEHLEDY -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6">Přehledy – zdroj dat</div>
          <div class="text-caption text-grey-7 q-mt-xs">Co se zobrazuje v záložce Přehledy</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-btn-group spread class="q-mb-md">
            <q-btn
              :color="dataSource==='new' ? 'primary' : 'grey-7'"
              :text-color="dataSource==='new' ? 'white' : 'white'"
              label="NOVÉ" unelevated
              @click="setDataSource('new')"
            />
            <q-btn
              :color="dataSource==='history' ? 'primary' : 'grey-7'"
              :text-color="dataSource==='history' ? 'white' : 'white'"
              label="HIST" unelevated
              @click="setDataSource('history')"
            />
            <q-btn
              :color="dataSource==='all' ? 'primary' : 'grey-7'"
              :text-color="dataSource==='all' ? 'white' : 'white'"
              label="VŠE" unelevated
              @click="setDataSource('all')"
            />
          </q-btn-group>

          <div v-if="showDateFilter" class="row q-gutter-sm q-mb-md">
            <div class="col">
              <q-input v-model="dateFrom" label="Od" type="date" outlined dense/>
            </div>
            <div class="col">
              <q-input v-model="dateTo" label="Do" type="date" outlined dense/>
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn color="primary" unelevated label="Načíst data" icon="refresh" @click="loadData"/>
        </q-card-actions>
      </q-card>

      <!-- NOTIFIKACE OBĚDŮ -->
      <q-card v-if="canNotifObedy" class="q-mb-md">
        <q-card-section>
          <div class="text-h6">Notifikace obědů</div>
          <div class="text-caption text-grey-7 q-mt-xs">
            Upozornění v 18:00 pokud nejsou objednány obědy na zítřek
          </div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-toggle
            v-model="notifObedy"
            label="Upozornění na obědy v 18:00"
            color="orange"
            @update:model-value="toggleNotifObedy"
          />
          <div v-if="notifPermission === 'denied'" class="text-caption text-negative q-mt-xs">
            ⚠ Notifikace jsou zakázány — povolte je v Nastavení telefonu → Aplikace → Chrome → Oznámení
          </div>
          <div v-if="notifPermission === 'granted' && notifObedy" class="text-caption text-positive q-mt-xs">
            ✓ Notifikace jsou aktivní
          </div>
        </q-card-section>
      </q-card>

      <!-- API URL -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6">Nastavení API</div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="apiUrl"
            label="API URL"
            outlined
            hint="URL vašeho Google Apps Script API"
          >
            <template v-slot:append>
              <q-icon name="link" />
            </template>
          </q-input>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Obnovit výchozí" color="grey-7" @click="resetApiUrl"/>
          <q-btn color="primary" label="Uložit" @click="saveApiUrl" unelevated/>
        </q-card-actions>
      </q-card>

      <!-- O APLIKACI -->
      <q-card>
        <q-card-section>
          <div class="text-h6">O aplikaci</div>
          <div class="text-body2 q-mt-sm">
            Evidence práce 2026<br>
            Verze: 2.3<br>
            <span class="text-grey-7">Aktualizováno: Březen 2026</span>
          </div>
        </q-card-section>
      </q-card>
    </div>
  `
});
