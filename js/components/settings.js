// Komponenta pro nastavení
// v2026-05-07 - NOVÉ: sekce Směna - smazání rozpracované směny s potvrzením
//             - viditelná jen když existuje uložený příchod
//             - smaže localStorage + řádek v sheetu (pokud byl příchod uložen přes cloud)
//             - nic jsem nesmazal

window.app.component('settings-component', {
  emits: ['message', 'logout', 'reload', 'clear-shift'],
  
  data() {
    return {
      apiUrl: localStorage.getItem('apiUrl') || DEFAULT_API_URL,
      cloudShift: localStorage.getItem('cloudShift') === 'true',
      dataSource: localStorage.getItem('dataSource') || 'new',
      dateFrom: localStorage.getItem('dataDateFrom') || '',
      dateTo: localStorage.getItem('dataDateTo') || '',
      clearShiftDialog: false,
      clearShiftLoading: false
    }
  },

  computed: {
    showDateFilter() {
      return this.dataSource === 'history' || this.dataSource === 'all';
    },

    // v2026-05-07: načte stav rozpracované směny z localStorage
    // props currentUser není dostupný, takže hledáme přes všechny klíče
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
    
    saveCloudShift() {
      localStorage.setItem('cloudShift', this.cloudShift ? 'true' : 'false');
      this.$emit('message', this.cloudShift ? '✓ Cloud režim zapnut' : '✓ Cloud režim vypnut');
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
    
    confirmLogout() {
      this.$emit('logout');
    },

    // v2026-05-07: smazání rozpracované směny
    // 1. Smaže localStorage
    // 2. Pokud existuje cloudRowIndex, smaže i řádek v sheetu
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

        // Informuj home komponentu aby se resetovala
        this.$emit('clear-shift');
        this.$emit('reload');

      } catch(e) {
        this.$emit('message', 'Chyba při mazání směny');
      }
      this.clearShiftLoading = false;
      this.clearShiftDialog = false;
    }
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

      <!-- v2026-05-07: SMĚNA - smazání rozpracované směny -->
      <q-card class="q-mb-md" v-if="activeShiftInfo">
        <q-card-section>
          <div class="text-h6">Rozpracovaná směna</div>
          <div class="text-caption text-grey-7 q-mt-xs">
            Příchod: {{ activeShiftTimeFormatted }}
            <span v-if="activeShiftInfo.state.cloudRowIndex !== null && activeShiftInfo.state.cloudRowIndex !== undefined">
              · uloženo v tabulce (řádek {{ activeShiftInfo.state.cloudRowIndex }})
            </span>
            <span v-else> · pouze lokálně</span>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            color="deep-orange" unelevated icon="delete"
            label="Smazat směnu"
            @click="clearShiftDialog = true"
          />
        </q-card-actions>
      </q-card>

      <!-- POTVRZOVACÍ DIALOG smazání směny -->
      <q-dialog v-model="clearShiftDialog">
        <q-card style="width:100%; max-width:380px">
          <q-card-section>
            <div class="text-h6 text-deep-orange">Smazat směnu?</div>
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
            <q-btn
              color="deep-orange" unelevated label="Ano, smazat"
              :loading="clearShiftLoading"
              @click="confirmClearShift"
            />
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

      <!-- CLOUD SMĚNA -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6">Cloud příchod/odchod</div>
          <div class="text-caption text-grey-7 q-mt-xs">Ukládá příchod a odchod okamžitě do tabulky</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-toggle
            v-model="cloudShift"
            label="Zapnout cloud režim"
            color="primary"
            @update:model-value="saveCloudShift"
          />
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
            <span class="text-grey-7">Aktualizováno: Únor 2026</span>
          </div>
        </q-card-section>
      </q-card>
    </div>
  `
});
