// KONTROLA.JS - Kontrola migrace dat mezi "záznamy" (nová appka) a "záznamy_historie" (stará appka)
// v2026-08-08 - NOVÝ SOUBOR
// v2026-08-08b - NOVÉ: záložka Migrace - doplní chybějící dny z historie do nové appky
// v2026-09-03 - NOVÉ: záložka "Oprava přiřazení" - obecný nástroj pro libovolného
//             pracovníka. Najde jeho dokončené směny, kde název zakázky nesedí
//             přesně s žádnou existující zakázkou (prázdné/překlep - typicky u
//             lidí co používají jen starou appku). U každé lze vybrat kolegu ze
//             stejného dne (nejpodobnější podle času přednastaven) a "Opsat vše"
//             (zakázka+práce+místo, bez poznámky) - stejný princip jako doplnění
//             Nedokončených v adminu, jen napříč libovolnými (ne jen rozpracovanými)
//             záznamy. Samostatně si načítá workers/contracts/jobs/places, protože
//             main.js komponentu kontrola-component posílá bez props.

window.app.component('kontrola-component', {
  props: [],
  emits: ['message'],

  data() {
    return {
      mainTab: 'prehled',

      // PŘEHLED (read-only)
      loading: false,
      rows: [],
      allRawRecords: [], // v2026-09-03: uchováno i pro záložku Oprava přiřazení
      filterOnlyConflicts: true,

      // MIGRACE
      migDateFrom: null,
      migDateTo: null,
      migUseFilter: false,
      migPreviewLoading: false,
      migPreview: null,
      migCopyLoading: false,
      migResult: null,
      migConfirmDialog: false,

      // v2026-09-03 NOVÉ: OPRAVA PŘIŘAZENÍ
      metaLoading: false,
      workers: [],
      contracts: [],
      jobs: [],
      places: [],
      selectedWorkerId: null,
      fixDialog: false,
      fixingRecord: null,
      fixForm: { contractId: null, jobId: null, placeId: null, timeFrom: '', timeTo: '', note: '', dateEdit: '' },
      fixOriginal: null,
      colleagueOptionsFix: [],
      colleagueRecordsFix: [],
      selectedColleagueIdxFix: null,
      fixSaving: false
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
    },
    // v2026-09-03 NOVÉ
    workerOptions() {
      return this.workers.map(w => ({ label: w[1], value: w[0] }));
    },
    contractOptions() {
      return this.contracts.map(c => ({ label: c[0] + ' - ' + c[1], value: c[0] }));
    },
    jobOptions() {
      return this.jobs.map(j => ({ label: j[1], value: j[0] }));
    },
    placeOptions() {
      return this.places ? this.places.map(p => ({ label: p[1], value: p[0] })) : [];
    },
    // Dokončené záznamy vybraného pracovníka, kde zakázka nesedí přesně
    problemRecordsForWorker() {
      if (!this.selectedWorkerId) return [];
      const worker = this.workers.find(w => String(w[0]) === String(this.selectedWorkerId));
      if (!worker) return [];
      const workerName = worker[1];
      return this.allRawRecords.filter(r => {
        if (r[6] !== workerName) return false;
        if (String(r[15] || '').trim() === 'rozpracováno') return false; // to řeší Nedokončené
        if (!r[4] || !r[5]) return false; // musí mít příchod i odchod
        const contractOk = r[0] && this.contracts.some(c => c[1] === r[0]);
        return !contractOk;
      }).sort((a, b) => Number(b[4]) - Number(a[4]));
    },
    selectedColleagueFix() {
      return this.selectedColleagueIdxFix !== null ? this.colleagueRecordsFix[this.selectedColleagueIdxFix] : null;
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
        this.allRawRecords = res.data; // v2026-09-03: uložit i pro Opravu přiřazení
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
          await this.loadData();
        } else {
          this.$emit('message', 'Chyba migrace: ' + (res.error || ''));
        }
      } catch (e) {
        this.$emit('message', 'Chyba při provádění migrace');
      }
      this.migCopyLoading = false;
    },

    // ── v2026-09-03 NOVÉ: OPRAVA PŘIŘAZENÍ ──────────────────────────────
    async loadMeta() {
      this.metaLoading = true;
      try {
        const [w, c, j, p] = await Promise.all([
          apiCall('get', { type: 'workers' }),
          apiCall('get', { type: 'contracts' }),
          apiCall('get', { type: 'jobs' }),
          apiCall('get', { type: 'places' })
        ]);
        if (w.code === '000' && w.data) this.workers = w.data;
        if (c.code === '000' && c.data) this.contracts = c.data;
        if (j.code === '000' && j.data) this.jobs = j.data;
        if (p.code === '000' && p.data) this.places = p.data;
      } catch (e) {
        this.$emit('message', 'Chyba načítání seznamů pro Opravu přiřazení');
      }
      this.metaLoading = false;
    },

    formatShortDateTime(ts) {
      const d = new Date(Number(ts));
      return String(d.getDate()).padStart(2, '0') + '. ' + String(d.getMonth() + 1).padStart(2, '0') + '. ' + d.getFullYear() +
        ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    },
    formatTimeRangeFix(fr, to) {
      const fmt = (ts) => {
        const d = new Date(Number(ts));
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      };
      return to ? (fmt(fr) + ' - ' + fmt(to)) : fmt(fr);
    },
    timestampToTimeFix(ts) {
      const d = new Date(Number(ts));
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    },
    timestampToDateFix(ts) {
      const d = new Date(Number(ts));
      return String(d.getDate()).padStart(2, '0') + '. ' + String(d.getMonth() + 1).padStart(2, '0') + '. ' + d.getFullYear();
    },
    dateTimeToTimestampFix(dateStr, timeStr) {
      const dp = dateStr.split('. ');
      const tp = timeStr.split(':');
      return new Date(dp[2], dp[1] - 1, dp[0], tp[0], tp[1]).getTime();
    },

    openFixDialog(record) {
      this.fixingRecord = record;
      this.fixOriginal = {
        worker: record[6],
        contract: record[0] || 'Nezadáno / neshoduje se',
        job: record[3] || 'Nezadáno',
        place: record[14] || 'Nezadáno',
        date: this.timestampToDateFix(record[4]),
        timeFrom: this.timestampToTimeFix(record[4]),
        timeTo: this.timestampToTimeFix(record[5])
      };
      const contract = this.contracts.find(c => c[1] === record[0]);
      const job = this.jobs.find(j => j[1] === record[3]);
      const place = this.places ? this.places.find(p => p[1] === record[14]) : null;
      this.fixForm = {
        contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null,
        placeId: place ? place[0] : null,
        dateEdit: this.timestampToDateFix(record[4]),
        timeFrom: this.timestampToTimeFix(record[4]),
        timeTo: this.timestampToTimeFix(record[5]),
        note: record[8] || ''
      };
      this.loadColleaguesForFix(record);
      this.fixDialog = true;
    },

    loadColleaguesForFix(record) {
      const ts = Number(record[4]);
      const d = new Date(ts);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;

      this.colleagueRecordsFix = this.allRawRecords.filter(r => {
        const rts = Number(r[4]);
        if (isNaN(rts) || rts < dayStart || rts >= dayEnd) return false;
        if (r[6] === record[6]) return false; // vynechat stejného pracovníka
        if (String(r[15] || '').trim() === 'rozpracováno') return false;
        if (!r[0] || !this.contracts.some(c => c[1] === r[0])) return false; // jen validní zakázky
        return true;
      }).sort((a, b) => Math.abs(Number(a[4]) - ts) - Math.abs(Number(b[4]) - ts));

      this.colleagueOptionsFix = this.colleagueRecordsFix.map((r, i) => ({
        label: r[6] + ' • ' + this.formatTimeRangeFix(r[4], r[5]) + ' • ' + r[0] + ' - ' + r[3],
        value: i
      }));
      this.selectedColleagueIdxFix = this.colleagueRecordsFix.length > 0 ? 0 : null;
    },

    findContractIdByNameFix(name) {
      const c = this.contracts.find(x => x[1] === name);
      return c ? c[0] : null;
    },
    findJobIdByNameFix(name) {
      const j = this.jobs.find(x => x[1] === name);
      return j ? j[0] : null;
    },
    findPlaceIdByNameFix(name) {
      if (!this.places) return null;
      const p = this.places.find(x => x[1] === name);
      return p ? p[0] : null;
    },

    copyAllFromColleagueFix() {
      if (!this.selectedColleagueFix) return;
      const r = this.selectedColleagueFix;
      if (!confirm('Opravdu opsat zakázku, práci a místo od pracovníka ' + r[6] + '?')) return;
      this.fixForm.contractId = this.findContractIdByNameFix(r[0]);
      this.fixForm.jobId = this.findJobIdByNameFix(r[3]);
      this.fixForm.placeId = this.findPlaceIdByNameFix(r[14]);
    },

    async saveFix() {
      if (!this.fixForm.contractId || !this.fixForm.jobId || !this.fixForm.placeId) {
        this.$emit('message', 'Vyplňte zakázku, práci a místo');
        return;
      }
      this.fixSaving = true;
      try {
        const timeFr = this.dateTimeToTimestampFix(this.fixForm.dateEdit, this.fixForm.timeFrom);
        const timeTo = this.dateTimeToTimestampFix(this.fixForm.dateEdit, this.fixForm.timeTo);
        const worker = this.workers.find(w => w[1] === this.fixingRecord[6]);
        const payload = {
          row_index: this.fixingRecord[17],
          source_sheet: this.fixingRecord[18] || 'záznamy',
          id_contract: this.fixForm.contractId,
          id_worker: worker ? worker[0] : null,
          id_job: this.fixForm.jobId,
          id_place: this.fixForm.placeId,
          time_fr: timeFr,
          time_to: timeTo,
          note: this.fixForm.note
        };
        const res = await apiCall('updaterecord', payload);
        if (res.code === '000') {
          this.$emit('message', '✓ Záznam opraven');
          this.fixDialog = false;
          await this.loadData();
        } else {
          this.$emit('message', 'Chyba: ' + (res.error || ''));
        }
      } catch (e) {
        this.$emit('message', 'Chyba při ukládání opravy');
      }
      this.fixSaving = false;
    }
  },

  mounted() {
    this.loadData();
    this.loadMeta();
  },

  template: `
    <div class="q-pt-sm">
      <q-tabs v-model="mainTab" dense align="justify" class="text-primary q-mb-md">
        <q-tab name="prehled" icon="visibility" label="Přehled"/>
        <q-tab name="migrace" icon="sync_alt" label="Migrace"/>
        <q-tab name="oprava" icon="build_circle" label="Oprava přiřazení"/>
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

      <!-- ═══════════ OPRAVA PŘIŘAZENÍ (v2026-09-03 NOVÉ) ═══════════ -->
      <div v-if="mainTab === 'oprava'">
        <div class="q-mb-md q-pa-sm text-caption text-orange-8" style="background:#fff3e0;border-radius:4px">
          ⚠ Najde dokončené směny vybraného pracovníka, kde název zakázky nesedí přesně
          se žádnou existující zakázkou (typicky u lidí co používají jen starou appku).
          U každé lze vybrat kolegu ze stejného dne a opsat od něj zakázku/práci/místo.
        </div>

        <div v-if="metaLoading" class="text-center q-pa-md"><q-spinner color="primary" size="2em"/></div>

        <q-select v-else v-model="selectedWorkerId" :options="workerOptions" label="Vyber pracovníka"
          emit-value map-options outlined class="q-mb-md"/>

        <div v-if="selectedWorkerId">
          <div v-if="problemRecordsForWorker.length === 0" class="text-center text-grey-7 q-mt-lg">
            ✓ Žádné záznamy s neshodou zakázky
          </div>
          <div v-for="(r, idx) in problemRecordsForWorker" :key="idx" class="record-card">
            <div class="row items-center">
              <div class="col">
                <div class="text-bold">{{ r[0] || 'Zakázka nevyplněna' }}</div>
                <div class="text-caption text-grey-7">{{ formatShortDateTime(r[4]) }} — {{ formatTimeRangeFix(r[4], r[5]) }}</div>
                <div class="text-caption text-grey-7">{{ r[3] || 'Práce nevyplněna' }} • {{ r[14] || 'Místo nevyplněno' }}</div>
              </div>
              <q-btn color="orange" icon="edit" label="Opravit" size="sm" unelevated @click="openFixDialog(r)"/>
            </div>
          </div>
        </div>
      </div>

      <!-- POTVRZOVACÍ DIALOG MIGRACE -->
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

      <!-- DIALOG OPRAVY PŘIŘAZENÍ (v2026-09-03 NOVÉ) -->
      <q-dialog v-model="fixDialog">
        <q-card style="width:95%; max-width:500px">
          <q-card-section>
            <div class="text-h6">Opravit záznam</div>
            <div v-if="fixOriginal" class="text-caption text-grey-7">
              {{ fixOriginal.worker }} — {{ fixOriginal.date }} {{ fixOriginal.timeFrom }}-{{ fixOriginal.timeTo }}
            </div>
          </q-card-section>
          <q-card-section class="q-pt-none" style="max-height:65vh; overflow-y:auto">
            <div class="row q-col-gutter-sm">
              <div class="col-6">
                <div class="text-caption text-grey-7 q-mb-xs">Vzor od kolegy (nejpodobnější první):</div>
                <q-select
                  v-if="colleagueOptionsFix.length > 0"
                  v-model="selectedColleagueIdxFix" :options="colleagueOptionsFix"
                  emit-value map-options outlined dense class="q-mb-sm"/>
                <div v-else class="text-caption text-grey-6 q-mb-sm">Žádný kolega ten den nepracoval.</div>

                <template v-if="selectedColleagueFix">
                  <q-input :model-value="selectedColleagueFix[6]" label="Pracovník" dense readonly filled class="q-mb-xs"/>
                  <div class="row items-center no-wrap q-mb-xs">
                    <q-input :model-value="selectedColleagueFix[0]" label="Zakázka" dense readonly filled class="col"/>
                    <q-btn flat dense round icon="arrow_forward" color="primary" class="q-ml-xs" @click="fixForm.contractId = findContractIdByNameFix(selectedColleagueFix[0])"><q-tooltip>Použít</q-tooltip></q-btn>
                  </div>
                  <div class="row items-center no-wrap q-mb-xs">
                    <q-input :model-value="selectedColleagueFix[3]" label="Práce" dense readonly filled class="col"/>
                    <q-btn flat dense round icon="arrow_forward" color="primary" class="q-ml-xs" @click="fixForm.jobId = findJobIdByNameFix(selectedColleagueFix[3])"><q-tooltip>Použít</q-tooltip></q-btn>
                  </div>
                  <div class="row items-center no-wrap q-mb-sm">
                    <q-input :model-value="selectedColleagueFix[14] || 'Nezadáno'" label="Místo" dense readonly filled class="col"/>
                    <q-btn flat dense round icon="arrow_forward" color="primary" class="q-ml-xs" @click="fixForm.placeId = findPlaceIdByNameFix(selectedColleagueFix[14])"><q-tooltip>Použít</q-tooltip></q-btn>
                  </div>
                  <q-input :model-value="formatTimeRangeFix(selectedColleagueFix[4], selectedColleagueFix[5])" label="Čas kolegy" dense readonly filled class="q-mb-sm"/>
                  <q-btn color="deep-orange" icon="content_copy" label="Opsat vše (bez poznámky)" size="sm" class="full-width" @click="copyAllFromColleagueFix"/>
                </template>
              </div>

              <div class="col-6">
                <div class="text-caption text-grey-7 q-mb-xs">Nové:</div>
                <q-select v-model="fixForm.contractId" :options="contractOptions" label="Zakázka" emit-value map-options dense outlined class="q-mb-xs"/>
                <q-select v-model="fixForm.jobId" :options="jobOptions" label="Práce" emit-value map-options dense outlined class="q-mb-xs"/>
                <q-select v-model="fixForm.placeId" :options="placeOptions" label="Místo" emit-value map-options dense outlined class="q-mb-xs"/>
                <q-input v-model="fixForm.timeFrom" label="Od" dense outlined class="q-mb-xs">
                  <template v-slot:append>
                    <q-icon name="schedule" class="cursor-pointer">
                      <q-popup-proxy cover ref="fixTimeFromProxy">
                        <q-time v-model="fixForm.timeFrom" mask="HH:mm" format24h
                          @update:model-value="val => { if (val && val.length === 5) $refs.fixTimeFromProxy.hide(); }"/>
                      </q-popup-proxy>
                    </q-icon>
                  </template>
                </q-input>
                <q-input v-model="fixForm.timeTo" label="Do" dense outlined class="q-mb-xs">
                  <template v-slot:append>
                    <q-icon name="schedule" class="cursor-pointer">
                      <q-popup-proxy cover ref="fixTimeToProxy">
                        <q-time v-model="fixForm.timeTo" mask="HH:mm" format24h
                          @update:model-value="val => { if (val && val.length === 5) $refs.fixTimeToProxy.hide(); }"/>
                      </q-popup-proxy>
                    </q-icon>
                  </template>
                </q-input>
                <q-input v-model="fixForm.note" label="Poznámka" dense outlined type="textarea" rows="2" class="q-mb-xs"/>
              </div>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup size="sm"/>
            <q-btn label="Uložit opravu" color="primary" :loading="fixSaving" @click="saveFix" size="sm"/>
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  `
});
