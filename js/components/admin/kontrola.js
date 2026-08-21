// KONTROLA.JS - Kontrola migrace dat mezi "záznamy" (nová appka) a "záznamy_historie" (stará appka)
// v2026-08-08 - NOVÝ SOUBOR
//             - read-only přehled: pro každého pracovníka a den ukáže hodiny z obou zdrojů
//             - červeně zvýrazní dny, kde existuje záznam v OBOU listech zároveň (konflikt)
//             - nic nemaže, nic nepřepisuje - jen čte a zobrazuje pro kontrolu
//             - používá source: 'all' v getallrecords, který už kod.gs podporuje beze změn
// v2026-08-08b - NOVÉ: záložka "Migrace" - doplní chybějící dny z historie do nové appky
//              - výběr období (od-do) nebo celé vše
//              - nejdřív NÁHLED (migratepreview) - jen spočítá, nic neukládá
//              - až po potvrzení SKUTEČNÉ PROVEDENÍ (migratecopy) - kopíruje, NIC NEMAŽE z historie
//              - zobrazuje i zálohy
//              - nic z předchozí verze nesmazáno, pouze přidána druhá záložka a její logika

window.app.component('kontrola-component', {
  props: [],
  emits: ['message'],

  data() {
    return {
      mainTab: 'prehled',

      // PŘEHLED (read-only)
      loading: false,
      rows: [],
      filterOnlyConflicts: true,

      // MIGRACE
      migDateFrom: null,
      migDateTo: null,
      migUseFilter: false,
      migPreviewLoading: false,
      migPreview: null,
      migCopyLoading: false,
      migResult: null,
      migConfirmDialog: false
    }
  },

  computed: {
    filteredRows() {
      return this.filterOnlyConflicts
        ? this.rows.filter(r => r.newHours > 0 && r.histHours > 0)
        : this.rows;
    },
    totalConflicts() {
      return this.rows.filter(r => r.newHours > 0 && r.histHours > 0).length;
    },
    totalOnlyNew() {
      return this.rows.filter(r => r.newHours > 0 && r.histHours === 0).length;
    },
    totalOnlyHist() {
      return this.rows.filter(r => r.histHours > 0 && r.newHours === 0).length;
    },
    migRangeLabel() {
      if (!this.migUseFilter) return 'Celé období (vše chybějící)';
      return (this.migDateFrom || '?') + ' — ' + (this.migDateTo || '?');
    }
  },

  methods: {
    // ── PŘEHLED ──────────────────────────────────────────────
    async loadData() {
      this.loading = true;
      try {
        const res = await apiCall('getallrecords', { source: 'all' });
        if (res.code !== '000' || !res.data) {
          this.$emit('message', 'Chyba načítání dat: ' + (res.error || ''));
          this.loading = false;
          return;
        }
        const map = {};
        res.data.forEach(r => {
          const workerId = String(r[1]);
          const workerName = r[6] || '?';
          const ts = Number(r[4]);
          if (!ts) return;
          const d = new Date(ts);
          const dateKey = String(d.getDate()).padStart(2, '0') + '. ' + String(d.getMonth() + 1).padStart(2, '0') + '. ' + d.getFullYear();
          const key = workerId + '|' + dateKey;
          if (!map[key]) {
            map[key] = {
              workerId, workerName, dateKey,
              dateTs: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
              newHours: 0, histHours: 0, newCount: 0, histCount: 0
            };
          }
          const hours = parseFloat(r[7]) || 0;
          const source = r[18];
          if (source === 'záznamy_historie') {
            map[key].histHours += hours;
            map[key].histCount++;
          } else {
            map[key].newHours += hours;
            map[key].newCount++;
          }
        });
        this.rows = Object.values(map).sort((a, b) =>
          b.dateTs - a.dateTs || a.workerName.localeCompare(b.workerName, 'cs')
        );
      } catch (e) {
        this.$emit('message', 'Chyba při načítání dat');
      }
      this.loading = false;
    },

    // ── MIGRACE ──────────────────────────────────────────────
    dateStrToTs(dateStr) {
      if (!dateStr) return null;
      const parts = dateStr.split('. ');
      return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
    },

    async runPreview() {
      this.migPreviewLoading = true;
      this.migPreview = null;
      this.migResult = null;
      try {
        const params = {};
        if (this.migUseFilter && this.migDateFrom) params.date_from = this.dateStrToTs(this.migDateFrom);
        if (this.migUseFilter && this.migDateTo) params.date_to = this.dateStrToTs(this.migDateTo);
        const res = await apiCall('migratepreview', params);
        if (res.code === '000') {
          this.migPreview = res.data;
        } else {
          this.$emit('message', 'Chyba náhledu: ' + (res.error || ''));
        }
      } catch (e) {
        this.$emit('message', 'Chyba při náhledu migrace');
      }
      this.migPreviewLoading = false;
    },

    openConfirmDialog() {
      if (!this.migPreview) {
        this.$emit('message', 'Nejdřív spusť Náhled');
        return;
      }
      if (this.migPreview.recordsToCopy === 0 && this.migPreview.advancesToCopy === 0) {
        this.$emit('message', 'Není co migrovat — vše je už v nové appce');
        return;
      }
      this.migConfirmDialog = true;
    },

    async runMigration() {
      this.migConfirmDialog = false;
      this.migCopyLoading = true;
      this.migResult = null;
      try {
        const params = {};
        if (this.migUseFilter && this.migDateFrom) params.date_from = this.dateStrToTs(this.migDateFrom);
        if (this.migUseFilter && this.migDateTo) params.date_to = this.dateStrToTs(this.migDateTo);
        const res = await apiCall('migratecopy', params);
        if (res.code === '000') {
          this.migResult = res.data;
          this.$emit('message', '✓ Migrace dokončena');
          this.migPreview = null;
          // znovu načíst přehled, ať se konflikty aktualizují
          await this.loadData();
        } else {
          this.$emit('message', 'Chyba migrace: ' + (res.error || ''));
        }
      } catch (e) {
        this.$emit('message', 'Chyba při provádění migrace');
      }
      this.migCopyLoading = false;
    }
  },

  mounted() {
    this.loadData();
  },

  template: `
    <div class="q-pt-sm">
      <q-tabs v-model="mainTab" dense align="justify" class="text-primary q-mb-md">
        <q-tab name="prehled" icon="visibility" label="Přehled"/>
        <q-tab name="migrace" icon="sync_alt" label="Migrace"/>
      </q-tabs>

      <!-- ═══════════ PŘEHLED (read-only) ═══════════ -->
      <div v-if="mainTab === 'prehled'">
        <div class="q-mb-sm q-pa-xs text-caption text-blue-8" style="background:#e3f2fd;border-radius:4px">
          ℹ Porovnání podle pracovníka a dne mezi listem "záznamy" (nová appka) a "záznamy_historie" (stará appka).
          Data se pouze čtou — nic se nemaže ani nepřepisuje.
        </div>

        <div class="row q-gutter-sm q-mb-sm">
          <div class="q-pa-xs text-caption" style="background:#ffebee;border-radius:4px">🔴 Konflikty: {{ totalConflicts }}</div>
          <div class="q-pa-xs text-caption" style="background:#e8f5e9;border-radius:4px">🟢 Jen nová: {{ totalOnlyNew }}</div>
          <div class="q-pa-xs text-caption" style="background:#fff3e0;border-radius:4px">🟡 Jen historie: {{ totalOnlyHist }}</div>
        </div>

        <div class="row items-center q-mb-sm">
          <q-checkbox v-model="filterOnlyConflicts" label="Zobrazit jen konflikty (oba zdroje zároveň)"/>
          <q-space/>
          <q-btn flat dense icon="refresh" @click="loadData" :loading="loading"/>
        </div>

        <div v-if="loading" class="text-center q-pa-md"><q-spinner color="primary" size="2em"/></div>
        <div v-else-if="filteredRows.length === 0" class="text-center text-grey-7 q-mt-lg">
          {{ filterOnlyConflicts ? '✓ Žádné konflikty' : 'Žádné záznamy k zobrazení' }}
        </div>
        <div v-else>
          <div v-for="row in filteredRows" :key="row.workerId + row.dateKey"
            class="record-card"
            :style="(row.newHours > 0 && row.histHours > 0) ? 'border-left:4px solid #e53935' : ''">
            <div class="row items-center no-wrap">
              <div class="col">
                <div class="text-bold">{{ row.workerName }}</div>
                <div class="text-caption text-grey-7">{{ row.dateKey }}</div>
              </div>
              <div class="q-mr-md text-right" style="min-width:90px">
                <div class="text-caption text-grey-6">Nová appka</div>
                <div :class="row.newHours > 0 ? 'text-bold text-green-8' : 'text-grey-4'">{{ row.newHours.toFixed(2) }} h</div>
              </div>
              <div class="text-right" style="min-width:90px">
                <div class="text-caption text-grey-6">Historie</div>
                <div :class="row.histHours > 0 ? 'text-bold text-orange-8' : 'text-grey-4'">{{ row.histHours.toFixed(2) }} h</div>
              </div>
            </div>
            <div v-if="row.newHours > 0 && row.histHours > 0" class="text-caption text-red-8 q-mt-xs">
              ⚠ Záznam existuje v OBOU listech tento den — zkontroluj v Google Sheetu a případně jeden smaž ručně.
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════ MIGRACE ═══════════ -->
      <div v-if="mainTab === 'migrace'">
        <div class="q-mb-md q-pa-sm text-caption text-green-8" style="background:#e8f5e9;border-radius:4px">
          ✓ Migrace pouze <strong>DOPLNÍ</strong> do nové appky dny, které jsou jen v historii.
          Dny, které jsou v obou listech, se přeskočí (nechá se jen nová appka). 
          <strong>Z historie se nic nemaže.</strong> Migrované záznamy se označí jako "migrace".
        </div>

        <q-checkbox v-model="migUseFilter" label="Omezit na období (jinak migruje vše chybějící)" class="q-mb-sm"/>

        <div v-if="migUseFilter" class="row q-gutter-sm q-mb-md">
          <div class="col">
            <q-input v-model="migDateFrom" label="Od" outlined dense readonly>
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover ref="migFromProxy">
                    <q-date v-model="migDateFrom" mask="DD. MM. YYYY" locale="cs" @update:model-value="$refs.migFromProxy.hide()"/>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>
          <div class="col">
            <q-input v-model="migDateTo" label="Do" outlined dense readonly>
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover ref="migToProxy">
                    <q-date v-model="migDateTo" mask="DD. MM. YYYY" locale="cs" @update:model-value="$refs.migToProxy.hide()"/>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>
        </div>

        <div class="text-caption text-grey-7 q-mb-md">Rozsah: {{ migRangeLabel }}</div>

        <q-btn color="primary" icon="search" label="1. Zobrazit náhled" class="full-width q-mb-sm"
          :loading="migPreviewLoading" @click="runPreview"/>

        <div v-if="migPreview" class="q-mb-md q-pa-md" style="background:#e3f2fd;border-radius:8px">
          <div class="text-subtitle2 text-bold q-mb-sm">Náhled — co by se zkopírovalo:</div>
          <div class="row items-center q-mb-xs">
            <q-icon name="work" class="q-mr-xs" color="blue-8"/>
            <span>Záznamy (směny): <strong>{{ migPreview.recordsToCopy }}</strong> záznamů, <strong>{{ migPreview.recordsDays }}</strong> dní</span>
          </div>
          <div class="row items-center">
            <q-icon name="payment" class="q-mr-xs" color="blue-8"/>
            <span>Zálohy: <strong>{{ migPreview.advancesToCopy }}</strong> záznamů, <strong>{{ migPreview.advancesDays }}</strong> dní</span>
          </div>
          <div v-if="migPreview.recordsToCopy === 0 && migPreview.advancesToCopy === 0" class="text-caption text-green-8 q-mt-sm">
            ✓ Nic k migraci — vše je už v nové appce
          </div>
        </div>

        <q-btn v-if="migPreview && (migPreview.recordsToCopy > 0 || migPreview.advancesToCopy > 0)"
          color="deep-orange" icon="sync_alt" label="2. Provést migraci (jen doplní, nic nesmaže)"
          class="full-width" :loading="migCopyLoading" @click="openConfirmDialog"/>

        <div v-if="migResult" class="q-mt-md q-pa-md" style="background:#e8f5e9;border-radius:8px">
          <div class="text-subtitle2 text-bold text-green-8 q-mb-sm">✓ Migrace dokončena</div>
          <div>Záznamy: zkopírováno {{ migResult.recordsCopied }}, přeskočeno (duplikát) {{ migResult.recordsSkipped }}</div>
          <div>Zálohy: zkopírováno {{ migResult.advancesCopied }}, přeskočeno (duplikát) {{ migResult.advancesSkipped }}</div>
        </div>
      </div>

      <!-- POTVRZOVACÍ DIALOG -->
      <q-dialog v-model="migConfirmDialog">
        <q-card style="width:100%; max-width:400px">
          <q-card-section>
            <div class="text-h6">Potvrdit migraci</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <div class="q-mb-sm">Chystáš se zkopírovat:</div>
            <div>• <strong>{{ migPreview ? migPreview.recordsToCopy : 0 }}</strong> záznamů ({{ migPreview ? migPreview.recordsDays : 0 }} dní)</div>
            <div>• <strong>{{ migPreview ? migPreview.advancesToCopy : 0 }}</strong> záloh ({{ migPreview ? migPreview.advancesDays : 0 }} dní)</div>
            <div class="q-mt-sm text-caption text-grey-7">z historie do nové appky. Historie zůstane beze změny.</div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup/>
            <q-btn label="Provést" color="deep-orange" @click="runMigration"/>
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  `
});
