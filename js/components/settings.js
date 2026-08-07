// Komponenta pro nastavení
// v2026-02-27 - odstraněn toggle cloud režimu, cloud je vždy zapnutý
// nic jsem nesmazal, pouze odstranil toggle a přidal automatické zapnutí
// v2026-03-10 - NOVÉ: přepínač notifikací obědů v 18:00 (jen pokud canNotifObedy=Y)
//             - nic jsem nesmazal
// v2026-05-07 - NOVÉ: sekce "Rozpracovaná směna" pod Odhlásit
//             - viditelná jen když existuje uložený příchod v localStorage
//             - potvrzovací dialog před smazáním
//             - smaže localStorage + pokud existuje cloudRowIndex, smaže i řádek v sheetu
//             - nic jsem nesmazal

window.app.component('settings-component', {
  emits: ['message', 'logout', 'reload', 'clear-shift'],
  
  data() {
    return {
      apiUrl: localStorage.getItem('apiUrl') || DEFAULT_API_URL,
      dataSource: localStorage.getItem('dataSource') || 'new',
      dateFrom: localStorage.getItem('dataDateFrom') || '',
      dateTo: localStorage.getItem('dataDateTo') || '',
      notifObedy: localStorage.getItem('notifObedy') === 'true',
      canNotifObedy: localStorage.getItem('canNotifObedy') === 'Y',
      notifPermission: typeof Notification !== 'undefined' ? Notification.permission : 'denied',
      // v2026-05-07: dialog smazání směny
      clearShiftDialog: false,
      clearShiftLoading: false
    }
  },
  
  computed: {
    showDateFilter() {
      return this.dataSource === 'history' || this.dataSource === 'all';
    },

    // v2026-05-07: najde aktivní rozpracovanou směnu v localStorage
    activeShiftInfo() {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('shiftState_')) {
          try {
            const state = JSON.parse(localStorage.getItem(key));
            if (state && state.timeStart) {
              return { key: key, state: state };
            }
          } catch(e) {}
        }
      }
      return null;
    },

    // v2026-05-07: formátovaný čas příchodu pro zobrazení v dialogu
    activeShiftTimeFormatted() {
      if (!this.activeShiftInfo) return '';
      const ts = this.activeShiftInfo.state.timeStart;
      const d = new Date(ts);
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
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
    },

    // v2026-05-07: smazání rozpracované směny
    // 1. smaže localStorage
    // 2. pokud existuje cloudRowIndex, smaže i řádek v sheetu
    // 3. emituje clear-shift aby home komponenta resetovala formulář
    async confirmClearShift() {
      this.clearShiftLoading = true;
      try {
        const info = this.activeShiftInfo;
        if (!info) {
          this.$emit('message', 'Žádná rozpracovaná směna nenalezena');
          this.clearShiftDialog = false;
          this.clearShiftLoading = false;
          return;
        }
        const state = info.state;

        // Smaž řádek v sheetu pokud byl příchod uložen přes cloud
        if (state.cloudRowIndex !== null && state.cloudRowIndex !== undefined) {
          try {
            const res = await apiCall('deleterecord', {
              row_index: state.cloudRowIndex,
              source_sheet: 'záznamy'
            });
            if (res.code === '000') {
              this.$emit('message', '✓ Směna smazána (lokálně i z tabulky)');
            } else {
              this.$emit('message', '⚠ Smazáno lokálně, chyba tabulky: ' + (res.error || ''));
            }
          } catch(e) {
            this.$emit('message', '⚠ Smazáno lokálně, tabulka nedostupná');
          }
        } else {
          this.$emit('message', '✓ Lokální stav směny smazán');
        }

        // Smaž localStorage
        localStorage.removeItem(info.key);

        // Informuj home komponentu aby resetovala formulář
        this.$emit('clear-shift');
        this.$emit('reload');

      } catch(e) {
        this.$emit('message', 'Chyba při mazání směny');
      }
      this.clearShiftLoading = false;
      this.clearShiftDialog = false;
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
          <q-btn color="red" unelevated icon="logout" label="Odhlásit se" @click="confirmLogout"/>
        </q-card-actions>
      </q-card>

      <!-- v2026-05-07: ROZPRACOVANÁ SMĚNA - viditelná jen když existuje -->
      <q-card class="q-mb-md" v-if="activeShiftInfo">
        <q-card-section>
          <div class="text-h6">Rozpracovaná směna</div>
          <div class="text-caption text-grey-7 q-mt-xs">
            Příchod: <strong>{{ activeShiftTimeFormatted }}</strong>
            <span v-if="activeShiftInfo.state.cloudRowIndex !== null && activeShiftInfo.state.cloudRowIndex !== undefined">
              · uloženo v tabulce
            </span>
            <span v-else> · pouze lokálně</span>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn color="deep-orange" unelevated icon="delete" label="Smazat směnu" @click="clearShiftDialog = true"/>
        </q-card-actions>
      </q-card>

      <!-- POTVRZOVACÍ DIALOG -->
      <q-dialog v-model="clearShiftDialog">
        <q-card style="width:100%; max-width:380px">
          <q-card-section>
            <div class="text-h6 text-deep-orange">Smazat rozpracovanou směnu?</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <div class="q-mb-sm">Příchod: <strong>{{ activeShiftTimeFormatted }}</strong></div>
            <div v-if="activeShiftInfo && activeShiftInfo.state.cloudRowIndex !== null && activeShiftInfo.state.cloudRowIndex !== undefined"
              class="text-caption text-orange-8 q-mb-sm">
              ⚠ Příchod je uložen v tabulce — smaže se i odtud.
            </div>
            <div v-else class="text-caption text-grey-7 q-mb-sm">
              Směna je uložena jen lokálně.
            </div>
            <div class="text-body2">Tato akce se nedá vrátit. Opravdu smazat?</div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup/>
            <q-btn color="deep-orange" unelevated label="Ano, smazat"
              :loading="clearShiftLoading" @click="confirmClearShift"/>
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- VÝBĚR DAT PRO PŘEHLEDY -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6">Přehledy – zdroj dat</div>
          <div class="text-caption text-grey-7 q-mt-xs">Co se zobrazuje v záložce Přehledy</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-btn-group spread class="q-mb-md">
            <q-btn :color="dataSource==='new' ? 'primary' : 'grey-7'" text-color="white" label="NOVÉ" unelevated @click="setDataSource('new')"/>
            <q-btn :color="dataSource==='history' ? 'primary' : 'grey-7'" text-color="white" label="HIST" unelevated @click="setDataSource('history')"/>
            <q-btn :color="dataSource==='all' ? 'primary' : 'grey-7'" text-color="white" label="VŠE" unelevated @click="setDataSource('all')"/>
          </q-btn-group>
          <div v-if="showDateFilter" class="row q-gutter-sm q-mb-md">
            <div class="col"><q-input v-model="dateFrom" label="Od" type="date" outlined dense/></div>
            <div class="col"><q-input v-model="dateTo" label="Do" type="date" outlined dense/></div>
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
          <q-toggle v-model="notifObedy" label="Upozornění na obědy v 18:00" color="orange" @update:model-value="toggleNotifObedy"/>
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
          <q-input v-model="apiUrl" label="API URL" outlined hint="URL vašeho Google Apps Script API">
            <template v-slot:append><q-icon name="link"/></template>
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
