// KONTROLA.JS - Kontrola migrace dat + hledání chyb
// v2026-08-08 - NOVÝ SOUBOR
// v2026-08-08b - NOVÉ: záložka Migrace
// v2026-09-03 - NOVÉ: záložka "Oprava přiřazení"
// v2026-09-12 - PŘEPRACOVÁNO: detekce podle většinové zakázky kolegů s překryvem času
// v2026-09-13 - NOVÉ: tlačítka Smazat u konfliktů v Přehledu
// v2026-09-15 - NOVÉ: záložka "Chyby" - 3 sekce:
//             1) Duplicitní směny (stejný pracovník+čas, 2-3x, i po migraci)
//             2) Podezřele dlouhé směny (nad nastavenou hranici hodin, default 14h) -
//                oprava jde přes STEJNÝ endpoint 'updaterecord' jako Upravit v Adminu,
//                takže se automaticky zaloguje "co bylo předtím" do sloupce Q
//             3) Duplicitní zálohy (stejný pracovník+den, víc než 1 záloha, obědy vyjmuty)
//             U všeho tlačítko "Potvrdit, není chyba" (zapíše 'potvrzeno', příště
//             se přeskočí). POZNÁMKA: u záloh persistence "potvrzeno" napříč
//             znovunačtením ještě čeká na drobnou úpravu kod.gs (getAllAdvances
//             teď nevrací zpět příznak sloupce G) - zatím funguje v rámci
//             aktuální session (lokálně skryto po potvrzení).

window.app.component('kontrola-component', {
  props: [],
  emits: ['message'],

  data() {
    return {
      mainTab: 'prehled',

      loading: false,
      rows: [],
      allRawRecords: [],
      allRawAdvances: [],
      filterOnlyConflicts: true,

      migDateFrom: null,
      migDateTo: null,
      migUseFilter: false,
      migPreviewLoading: false,
      migPreview: null,
      migCopyLoading: false,
      migResult: null,
      migConfirmDialog: false,

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
      fixSuggestion: null,
      colleagueOptionsFix: [],
      colleagueRecordsFix: [],
      selectedColleagueIdxFix: null,
      fixSaving: false,

      // v2026-09-15 NOVÉ: Chyby
      longShiftThreshold: 14,
      confirmedKeys: {}, // lokální rychlá skrývačka po potvrzení (viz poznámka výše)
      longFixDialog: false,
      longFixRecord: null,
      longFixForm: { workerId: null, contractId: null, jobId: null, placeId: null, dateEdit: '', timeFrom: '', timeTo: '', note: '' },
      longFixOriginal: null,
      longFixSaving: false,
      // v2026-09-16 NOVÉ: bohaté porovnání s kolegou i pro dlouhé směny (jako u Nedokončených)
      colleagueOptionsLongFix: [],
      colleagueRecordsLongFix: [],
      selectedColleagueIdxLongFix: null
    }
  },

  computed: {
    filteredRows() {
      return this.filterOnlyConflicts
        ? this.rows.filter(r => r.newHours > 0 && r.histHours > 0)
        : this.rows;
    },
    totalConflicts() { return this.rows.filter(r => r.newHours > 0 && r.histHours > 0).length; },
    totalOnlyNew() { return this.rows.filter(r => r.newHours > 0 && r.histHours === 0).length; },
    totalOnlyHist() { return this.rows.filter(r => r.histHours > 0 && r.newHours === 0).length; },
    migRangeLabel() {
      if (!this.migUseFilter) return 'Celé období (vše chybějící)';
      return (this.migDateFrom || '?') + ' — ' + (this.migDateTo || '?');
    },
    workerOptions() { return this.workers.map(w => ({ label: w[1], value: w[0] })); },
    contractOptions() { return this.contracts.map(c => ({ label: c[0] + ' - ' + c[1], value: c[0] })); },
    jobOptions() { return this.jobs.map(j => ({ label: j[1], value: j[0] })); },
    placeOptions() { return this.places ? this.places.map(p => ({ label: p[1], value: p[0] })) : []; },

    problemRecordsForWorker() {
      if (!this.selectedWorkerId) return [];
      const worker = this.workers.find(w => String(w[0]) === String(this.selectedWorkerId));
      if (!worker) return [];
      const workerName = worker[1];
      const own = this.allRawRecords.filter(r => {
        if (r[6] !== workerName) return false;
        if (String(r[15] || '').trim() === 'rozpracováno') return false;
        if (!r[4] || !r[5]) return false;
        return true;
      });
      const result = [];
      own.forEach(r => {
        const majority = this.getMajorityContract(r);
        if (majority && majority.name !== r[0]) result.push({ rec: r, majority: majority });
      });
      return result.sort((a, b) => Number(b.rec[4]) - Number(a.rec[4]));
    },
    selectedColleagueFix() {
      return this.selectedColleagueIdxFix !== null ? this.colleagueRecordsFix[this.selectedColleagueIdxFix] : null;
    },

    // ── v2026-09-15 NOVÉ: CHYBY ──────────────────────────────
    duplicateShiftGroups() {
      const map = {};
      this.allRawRecords.forEach(r => {
        if (String(r[15] || '').trim() === 'rozpracováno') return;
        if (String(r[15] || '').trim() === 'potvrzeno') return;
        if (this.confirmedKeys['rec_' + r[17] + '_' + r[18]]) return;
        if (!r[4] || !r[5]) return;
        const key = String(r[1]) + '|' + Number(r[4]) + '|' + Number(r[5]);
        if (!map[key]) map[key] = [];
        map[key].push(r);
      });
      return Object.values(map)
        .filter(group => group.length > 1)
        .sort((a, b) => Number(b[0][4]) - Number(a[0][4]));
    },

    longShiftRecords() {
      return this.allRawRecords.filter(r => {
        if (String(r[15] || '').trim() === 'rozpracováno') return false;
        if (String(r[15] || '').trim() === 'potvrzeno') return false;
        if (this.confirmedKeys['rec_' + r[17] + '_' + r[18]]) return false;
        const hours = parseFloat(r[7]) || 0;
        return hours > this.longShiftThreshold;
      }).sort((a, b) => (parseFloat(b[7]) || 0) - (parseFloat(a[7]) || 0));
    },

    duplicateAdvanceGroups() {
      const map = {};
      this.allRawAdvances.forEach(a => {
        if (a[5] === 'oběd') return;
        if (this.confirmedKeys['adv_' + a[6] + '_' + a[7]]) return;
        const ts = Number(a[1]);
        if (isNaN(ts)) return;
        const d = new Date(ts);
        const dayKey = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
        const key = String(a[0]) + '|' + dayKey;
        if (!map[key]) map[key] = [];
        map[key].push(a);
      });
      return Object.values(map)
        .filter(group => group.length > 1)
        .sort((a, b) => Number(b[0][1]) - Number(a[0][1]));
    }
  },

  methods: {
    async loadData() {
      this.loading = true;
      try {
        const [resR, resA] = await Promise.all([
          apiCall('getallrecords', { source: 'all' }),
          apiCall('getalladvances', { source: 'all' })
        ]);
        if (resR.code !== '000' || !resR.data) {
          this.$emit('message', 'Chyba načítání dat: ' + (resR.error || ''));
          this.loading = false;
          return;
        }
        this.allRawRecords = resR.data;
        if (resA.code === '000' && resA.data) this.allRawAdvances = resA.data;

        const map = {};
        resR.data.forEach(r => {
          const workerId = String(r[1]);
          const workerName = r[6] || '?';
          const ts = Number(r[4]);
          if (!ts) return;
          const d = new Date(ts);
          const dateKey = String(d.getDate()).padStart(2, '0') + '. ' + String(d.getMonth() + 1).padStart(2, '0') + '. ' + d.getFullYear();
          const key = workerId + '|' + dateKey;
          if (!map[key]) {
            map[key] = { workerId, workerName, dateKey, dateTs: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), newHours: 0, histHours: 0, newCount: 0, histCount: 0 };
          }
          const hours = parseFloat(r[7]) || 0;
          const source = r[18];
          if (source === 'záznamy_historie') { map[key].histHours += hours; map[key].histCount++; }
          else { map[key].newHours += hours; map[key].newCount++; }
        });
        this.rows = Object.values(map).sort((a, b) => b.dateTs - a.dateTs || a.workerName.localeCompare(b.workerName, 'cs'));
      } catch (e) {
        this.$emit('message', 'Chyba při načítání dat');
      }
      this.loading = false;
    },

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
        if (res.code === '000') this.migPreview = res.data;
        else this.$emit('message', 'Chyba náhledu: ' + (res.error || ''));
      } catch (e) { this.$emit('message', 'Chyba při náhledu migrace'); }
      this.migPreviewLoading = false;
    },

    openConfirmDialog() {
      if (!this.migPreview) { this.$emit('message', 'Nejdřív spusť Náhled'); return; }
      if (this.migPreview.recordsToCopy === 0 && this.migPreview.advancesToCopy === 0) { this.$emit('message', 'Není co migrovat — vše je už v nové appce'); return; }
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
        } else this.$emit('message', 'Chyba migrace: ' + (res.error || ''));
      } catch (e) { this.$emit('message', 'Chyba při provádění migrace'); }
      this.migCopyLoading = false;
    },

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
      } catch (e) { this.$emit('message', 'Chyba načítání seznamů'); }
      this.metaLoading = false;
    },

    formatShortDateTime(ts) {
      const d = new Date(Number(ts));
      return String(d.getDate()).padStart(2, '0') + '. ' + String(d.getMonth() + 1).padStart(2, '0') + '. ' + d.getFullYear() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    },
    formatTimeRangeFix(fr, to) {
      const fmt = (ts) => { const d = new Date(Number(ts)); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
      return to ? (fmt(fr) + ' - ' + fmt(to)) : fmt(fr);
    },
    timestampToTimeFix(ts) { const d = new Date(Number(ts)); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); },
    timestampToDateFix(ts) { const d = new Date(Number(ts)); return String(d.getDate()).padStart(2, '0') + '. ' + String(d.getMonth() + 1).padStart(2, '0') + '. ' + d.getFullYear(); },
    dateTimeToTimestampFix(dateStr, timeStr) {
      const dp = dateStr.split('. '); const tp = timeStr.split(':');
      return new Date(dp[2], dp[1] - 1, dp[0], tp[0], tp[1]).getTime();
    },

    openFixDialog(problem) {
      const record = problem.rec;
      this.fixingRecord = record;
      this.fixSuggestion = problem.majority;
      this.fixOriginal = {
        worker: record[6], contract: record[0] || 'Nezadáno', job: record[3] || 'Nezadáno',
        place: record[14] || 'Nezadáno', date: this.timestampToDateFix(record[4]),
        timeFrom: this.timestampToTimeFix(record[4]), timeTo: this.timestampToTimeFix(record[5])
      };
      const contract = this.contracts.find(c => c[1] === record[0]);
      const job = this.jobs.find(j => j[1] === record[3]);
      const place = this.places ? this.places.find(p => p[1] === record[14]) : null;
      this.fixForm = {
        contractId: contract ? contract[0] : null, jobId: job ? job[0] : null, placeId: place ? place[0] : null,
        dateEdit: this.timestampToDateFix(record[4]), timeFrom: this.timestampToTimeFix(record[4]),
        timeTo: this.timestampToTimeFix(record[5]), note: record[8] || ''
      };
      this.loadColleaguesForFix(record);
      this.fixDialog = true;
    },

    shiftsOverlap_(aFr, aTo, bFr, bTo) { return Number(aFr) < Number(bTo) && Number(bFr) < Number(aTo); },
    overlapAmount_(aFr, aTo, bFr, bTo) { return Math.max(0, Math.min(Number(aTo), Number(bTo)) - Math.max(Number(aFr), Number(bFr))); },

    getOverlappingColleagues(record) {
      const ts = Number(record[4]); const d = new Date(ts);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      return this.allRawRecords.filter(r => {
        const rts = Number(r[4]);
        if (isNaN(rts) || rts < dayStart || rts >= dayEnd) return false;
        if (r[6] === record[6]) return false;
        if (String(r[15] || '').trim() === 'rozpracováno') return false;
        if (!r[4] || !r[5]) return false;
        if (!r[0] || !this.contracts.some(c => c[1] === r[0])) return false;
        return this.shiftsOverlap_(record[4], record[5], r[4], r[5]);
      });
    },

    getMajorityContract(record) {
      const colleagues = this.getOverlappingColleagues(record);
      if (colleagues.length === 0) return null;
      const counts = {};
      colleagues.forEach(r => { counts[r[0]] = (counts[r[0]] || 0) + 1; });
      let best = null, bestCount = 0;
      Object.keys(counts).forEach(k => { if (counts[k] > bestCount) { best = k; bestCount = counts[k]; } });
      return { name: best, count: bestCount, total: colleagues.length };
    },

    loadColleaguesForFix(record) {
      this.colleagueRecordsFix = this.getOverlappingColleagues(record)
        .sort((a, b) => this.overlapAmount_(record[4], record[5], b[4], b[5]) - this.overlapAmount_(record[4], record[5], a[4], a[5]));
      this.colleagueOptionsFix = this.colleagueRecordsFix.map((r, i) => ({ label: r[6] + ' • ' + this.formatTimeRangeFix(r[4], r[5]) + ' • ' + r[0] + ' - ' + r[3], value: i }));
      this.selectedColleagueIdxFix = this.colleagueRecordsFix.length > 0 ? 0 : null;
    },

    findContractIdByNameFix(name) { const c = this.contracts.find(x => x[1] === name); return c ? c[0] : null; },
    findJobIdByNameFix(name) { const j = this.jobs.find(x => x[1] === name); return j ? j[0] : null; },
    findPlaceIdByNameFix(name) { if (!this.places) return null; const p = this.places.find(x => x[1] === name); return p ? p[0] : null; },

    copyAllFromColleagueFix() {
      if (!this.selectedColleagueFix) return;
      const r = this.selectedColleagueFix;
      if (!confirm('Opravdu opsat zakázku, práci a místo od pracovníka ' + r[6] + '?')) return;
      this.fixForm.contractId = this.findContractIdByNameFix(r[0]);
      this.fixForm.jobId = this.findJobIdByNameFix(r[3]);
      this.fixForm.placeId = this.findPlaceIdByNameFix(r[14]);
    },

    useSuggestedContract() {
      if (!this.fixSuggestion) return;
      this.fixForm.contractId = this.findContractIdByNameFix(this.fixSuggestion.name);
    },

    async saveFix() {
      if (!this.fixForm.contractId || !this.fixForm.jobId || !this.fixForm.placeId) { this.$emit('message', 'Vyplňte zakázku, práci a místo'); return; }
      this.fixSaving = true;
      try {
        const timeFr = this.dateTimeToTimestampFix(this.fixForm.dateEdit, this.fixForm.timeFrom);
        const timeTo = this.dateTimeToTimestampFix(this.fixForm.dateEdit, this.fixForm.timeTo);
        const worker = this.workers.find(w => String(w[0]) === String(this.fixingRecord[1])) || this.workers.find(w => w[1] === this.fixingRecord[6]);
        const payload = {
          row_index: this.fixingRecord[17], source_sheet: this.fixingRecord[18] || 'záznamy',
          id_contract: this.fixForm.contractId, id_worker: worker ? worker[0] : null,
          id_job: this.fixForm.jobId, id_place: this.fixForm.placeId,
          time_fr: timeFr, time_to: timeTo, note: this.fixForm.note
        };
        const res = await apiCall('updaterecord', payload);
        if (res.code === '000') { this.$emit('message', '✓ Záznam opraven'); this.fixDialog = false; await this.loadData(); }
        else this.$emit('message', 'Chyba: ' + (res.error || ''));
      } catch (e) { this.$emit('message', 'Chyba při ukládání opravy'); }
      this.fixSaving = false;
    },

    // ── v2026-09-15 NOVÉ: CHYBY ──────────────────────────────

    async deleteRecordSimple(r) {
      if (!confirm('Opravdu smazat tento záznam? (' + r[6] + ', ' + this.formatTimeRangeFix(r[4], r[5]) + ')')) return;
      try {
        const res = await apiCall('deleterecord', { row_index: r[17], source_sheet: r[18] || 'záznamy' });
        if (res.code === '000') { this.$emit('message', '✓ Smazáno'); await this.loadData(); }
        else this.$emit('message', 'Chyba: ' + (res.error || ''));
      } catch (e) { this.$emit('message', 'Chyba při mazání'); }
    },

    async confirmRecordSimple(r) {
      try {
        const res = await apiCall('confirmrecord', { row_index: r[17], source_sheet: r[18] || 'záznamy' });
        if (res.code === '000') {
          this.confirmedKeys['rec_' + r[17] + '_' + r[18]] = true;
          this.$emit('message', '✓ Potvrzeno, příště se nevypíše');
        } else this.$emit('message', 'Chyba: ' + (res.error || ''));
      } catch (e) { this.$emit('message', 'Chyba při potvrzování'); }
    },

    async confirmGroup(records) {
      for (const r of records) await this.confirmRecordSimple(r);
    },

    async deleteAdvanceSimple(a) {
      if (!confirm('Opravdu smazat tuto zálohu? (' + a[2] + ', ' + a[4] + ' Kč, ' + a[5] + ')')) return;
      try {
        const res = await apiCall('deleterecord', { row_index: a[6], source_sheet: a[7] || 'zálohy' });
        if (res.code === '000') { this.$emit('message', '✓ Smazáno'); await this.loadData(); }
        else this.$emit('message', 'Chyba: ' + (res.error || ''));
      } catch (e) { this.$emit('message', 'Chyba při mazání'); }
    },

    async confirmAdvanceSimple(a) {
      try {
        const res = await apiCall('confirmadvance', { row_index: a[6], source_sheet: a[7] || 'zálohy' });
        if (res.code === '000') {
          this.confirmedKeys['adv_' + a[6] + '_' + a[7]] = true;
          this.$emit('message', '✓ Potvrzeno, příště se nevypíše');
        } else this.$emit('message', 'Chyba: ' + (res.error || ''));
      } catch (e) { this.$emit('message', 'Chyba při potvrzování'); }
    },

    async confirmAdvanceGroup(advances) {
      for (const a of advances) await this.confirmAdvanceSimple(a);
    },

    // Dlouhá směna - kolegové ten samý den (jen pro info, bez ohledu na překryv)
    getSameDayColleagues(record) {
      const ts = Number(record[4]); const d = new Date(ts);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      return this.allRawRecords.filter(r => {
        const rts = Number(r[4]);
        if (isNaN(rts) || rts < dayStart || rts >= dayEnd) return false;
        if (r[6] === record[6]) return false;
        if (String(r[15] || '').trim() === 'rozpracováno') return false;
        if (!r[7]) return false;
        return true;
      });
    },
    sameDayColleaguesLabel(record) {
      const cols = this.getSameDayColleagues(record);
      if (cols.length === 0) return 'Žádní kolegové ten den';
      return cols.map(r => r[6] + ' ' + (parseFloat(r[7]) || 0).toFixed(1) + 'h').join(', ');
    },

    // v2026-09-15 NOVÉ: oprava dlouhé směny - volá STEJNÝ endpoint updaterecord
    // jako Upravit v Adminu, takže se automaticky zaloguje "co bylo předtím" do sloupce Q
    openLongFixDialog(record) {
      this.longFixRecord = record;
      const worker = this.workers.find(w => String(w[0]) === String(record[1])) || this.workers.find(w => w[1] === record[6]);
      const contract = this.contracts.find(c => c[1] === record[0]);
      const job = this.jobs.find(j => j[1] === record[3]);
      const place = this.places ? this.places.find(p => p[1] === record[14]) : null;
      this.longFixOriginal = {
        worker: record[6], contract: record[0] || 'Nezadáno', job: record[3] || 'Nezadáno',
        place: record[14] || 'Nezadáno', timeFrom: this.timestampToTimeFix(record[4]),
        timeTo: this.timestampToTimeFix(record[5]), hours: (parseFloat(record[7]) || 0).toFixed(2)
      };
      this.longFixForm = {
        workerId: worker ? worker[0] : null, contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null, placeId: place ? place[0] : null,
        dateEdit: this.timestampToDateFix(record[4]), timeFrom: this.timestampToTimeFix(record[4]),
        timeTo: this.timestampToTimeFix(record[5]), note: record[8] || ''
      };
      this.longFixDialog = true;
    },

    async saveLongFix() {
      if (!this.longFixForm.workerId || !this.longFixForm.contractId || !this.longFixForm.jobId || !this.longFixForm.placeId) {
        this.$emit('message', 'Vyplňte pracovníka, zakázku, práci a místo'); return;
      }
      this.longFixSaving = true;
      try {
        const timeFr = this.dateTimeToTimestampFix(this.longFixForm.dateEdit, this.longFixForm.timeFrom);
        const timeTo = this.dateTimeToTimestampFix(this.longFixForm.dateEdit, this.longFixForm.timeTo);
        const payload = {
          row_index: this.longFixRecord[17], source_sheet: this.longFixRecord[18] || 'záznamy',
          id_contract: this.longFixForm.contractId, id_worker: this.longFixForm.workerId,
          id_job: this.longFixForm.jobId, id_place: this.longFixForm.placeId,
          time_fr: timeFr, time_to: timeTo, note: this.longFixForm.note
        };
        // v2026-09-15: STEJNÝ endpoint jako Upravit v Adminu - kod.gs automaticky
        // porovná staré/nové hodnoty a zaloguje změny do sloupce Q
        const res = await apiCall('updaterecord', payload);
        if (res.code === '000') { this.$emit('message', '✓ Směna opravena'); this.longFixDialog = false; await this.loadData(); }
        else this.$emit('message', 'Chyba: ' + (res.error || ''));
      } catch (e) { this.$emit('message', 'Chyba při ukládání'); }
      this.longFixSaving = false;
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
        <q-tab name="chyby" icon="error_outline" label="Chyby"/>
      </q-tabs>

      <!-- ═══════════ PŘEHLED ═══════════ -->
      <div v-if="mainTab === 'prehled'">
        <div class="q-mb-sm q-pa-xs text-caption text-blue-8" style="background:#e3f2fd;border-radius:4px">
          ℹ Porovnání podle pracovníka a dne mezi listem "záznamy" a "záznamy_historie". Data se pouze čtou.
        </div>
        <div class="row q-gutter-sm q-mb-sm">
          <div class="q-pa-xs text-caption" style="background:#ffebee;border-radius:4px">🔴 Konflikty: {{ totalConflicts }}</div>
          <div class="q-pa-xs text-caption" style="background:#e8f5e9;border-radius:4px">🟢 Jen nová: {{ totalOnlyNew }}</div>
          <div class="q-pa-xs text-caption" style="background:#fff3e0;border-radius:4px">🟡 Jen historie: {{ totalOnlyHist }}</div>
        </div>
        <div class="row items-center q-mb-sm">
          <q-checkbox v-model="filterOnlyConflicts" label="Zobrazit jen konflikty"/>
          <q-space/>
          <q-btn flat dense icon="refresh" @click="loadData" :loading="loading"/>
        </div>
        <div v-if="loading" class="text-center q-pa-md"><q-spinner color="primary" size="2em"/></div>
        <div v-else-if="filteredRows.length === 0" class="text-center text-grey-7 q-mt-lg">{{ filterOnlyConflicts ? '✓ Žádné konflikty' : 'Žádné záznamy' }}</div>
        <div v-else>
          <div v-for="row in filteredRows" :key="row.workerId + row.dateKey" class="record-card" :style="(row.newHours > 0 && row.histHours > 0) ? 'border-left:4px solid #e53935' : ''">
            <div class="row items-center no-wrap">
              <div class="col"><div class="text-bold">{{ row.workerName }}</div><div class="text-caption text-grey-7">{{ row.dateKey }}</div></div>
              <div class="q-mr-md text-right" style="min-width:90px"><div class="text-caption text-grey-6">Nová appka</div><div :class="row.newHours > 0 ? 'text-bold text-green-8' : 'text-grey-4'">{{ row.newHours.toFixed(2) }} h</div></div>
              <div class="text-right" style="min-width:90px"><div class="text-caption text-grey-6">Historie</div><div :class="row.histHours > 0 ? 'text-bold text-orange-8' : 'text-grey-4'">{{ row.histHours.toFixed(2) }} h</div></div>
            </div>
            <div v-if="row.newHours > 0 && row.histHours > 0" class="text-caption text-red-8 q-mt-xs">⚠ Záznam existuje v OBOU listech tento den.</div>
            <div v-if="row.newHours > 0 && row.histHours > 0" class="row q-gutter-sm q-mt-xs">
              <q-btn flat dense size="sm" color="red" icon="delete" label="Smazat NOVOU" @click="deleteRowSource(row, 'záznamy')"/>
              <q-btn flat dense size="sm" color="red" icon="delete" label="Smazat HISTORII" @click="deleteRowSource(row, 'záznamy_historie')"/>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════ MIGRACE ═══════════ -->
      <div v-if="mainTab === 'migrace'">
        <div class="q-mb-md q-pa-sm text-caption text-green-8" style="background:#e8f5e9;border-radius:4px">
          ✓ Migrace pouze DOPLNÍ chybějící dny z historie. Nic se nemaže.
        </div>
        <q-checkbox v-model="migUseFilter" label="Omezit na období" class="q-mb-sm"/>
        <div v-if="migUseFilter" class="row q-gutter-sm q-mb-md">
          <div class="col"><q-input v-model="migDateFrom" label="Od" outlined dense readonly><template v-slot:append><q-icon name="event" class="cursor-pointer"><q-popup-proxy cover ref="migFromProxy"><q-date v-model="migDateFrom" mask="DD. MM. YYYY" locale="cs" @update:model-value="$refs.migFromProxy.hide()"/></q-popup-proxy></q-icon></template></q-input></div>
          <div class="col"><q-input v-model="migDateTo" label="Do" outlined dense readonly><template v-slot:append><q-icon name="event" class="cursor-pointer"><q-popup-proxy cover ref="migToProxy"><q-date v-model="migDateTo" mask="DD. MM. YYYY" locale="cs" @update:model-value="$refs.migToProxy.hide()"/></q-popup-proxy></q-icon></template></q-input></div>
        </div>
        <div class="text-caption text-grey-7 q-mb-md">Rozsah: {{ migRangeLabel }}</div>
        <q-btn color="primary" icon="search" label="1. Zobrazit náhled" class="full-width q-mb-sm" :loading="migPreviewLoading" @click="runPreview"/>
        <div v-if="migPreview" class="q-mb-md q-pa-md" style="background:#e3f2fd;border-radius:8px">
          <div class="text-subtitle2 text-bold q-mb-sm">Náhled:</div>
          <div>Záznamy: <strong>{{ migPreview.recordsToCopy }}</strong> ({{ migPreview.recordsDays }} dní)</div>
          <div>Zálohy: <strong>{{ migPreview.advancesToCopy }}</strong> ({{ migPreview.advancesDays }} dní)</div>
        </div>
        <q-btn v-if="migPreview && (migPreview.recordsToCopy > 0 || migPreview.advancesToCopy > 0)" color="deep-orange" icon="sync_alt" label="2. Provést migraci" class="full-width" :loading="migCopyLoading" @click="openConfirmDialog"/>
        <div v-if="migResult" class="q-mt-md q-pa-md" style="background:#e8f5e9;border-radius:8px">
          <div class="text-subtitle2 text-bold text-green-8">✓ Hotovo</div>
          <div>Záznamy: {{ migResult.recordsCopied }} zkopírováno, {{ migResult.recordsSkipped }} přeskočeno</div>
          <div>Zálohy: {{ migResult.advancesCopied }} zkopírováno, {{ migResult.advancesSkipped }} přeskočeno</div>
        </div>
      </div>

      <!-- ═══════════ OPRAVA PŘIŘAZENÍ ═══════════ -->
      <div v-if="mainTab === 'oprava'">
        <div class="q-mb-md q-pa-sm text-caption text-orange-8" style="background:#fff3e0;border-radius:4px">
          ⚠ Zakázka pracovníka se liší od většinové zakázky kolegů s překrývajícím se časem ten den.
        </div>
        <div v-if="metaLoading" class="text-center q-pa-md"><q-spinner color="primary" size="2em"/></div>
        <q-select v-else v-model="selectedWorkerId" :options="workerOptions" label="Vyber pracovníka" emit-value map-options outlined class="q-mb-md"/>
        <div v-if="selectedWorkerId">
          <div v-if="problemRecordsForWorker.length === 0" class="text-center text-grey-7 q-mt-lg">✓ Žádné podezřelé záznamy</div>
          <div v-for="(p, idx) in problemRecordsForWorker" :key="idx" class="record-card" style="border-left:4px solid #e53935">
            <div class="row items-center">
              <div class="col">
                <div class="text-bold">{{ p.rec[0] || 'Zakázka nevyplněna' }}</div>
                <div class="text-caption text-grey-7">{{ formatShortDateTime(p.rec[4]) }} — {{ formatTimeRangeFix(p.rec[4], p.rec[5]) }}</div>
                <div class="text-caption text-red-8 q-mt-xs">⚠ Kolegové ({{ p.majority.count }}/{{ p.majority.total }}): <strong>{{ p.majority.name }}</strong></div>
              </div>
              <q-btn color="orange" icon="edit" label="Opravit" size="sm" unelevated @click="openFixDialog(p)"/>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════ CHYBY (v2026-09-15 NOVÉ) ═══════════ -->
      <div v-if="mainTab === 'chyby'">

        <!-- 1) DUPLICITNÍ SMĚNY -->
        <div class="text-subtitle1 text-bold q-mb-sm">🔁 Duplicitní směny</div>
        <div v-if="duplicateShiftGroups.length === 0" class="text-caption text-grey-6 q-mb-md">✓ Žádné duplicity</div>
        <div v-for="(group, gi) in duplicateShiftGroups" :key="'dup'+gi" class="q-mb-md q-pa-sm" style="background:#ffebee;border-radius:8px">
          <div class="text-bold q-mb-xs">{{ group[0][6] }} — {{ formatTimeRangeFix(group[0][4], group[0][5]) }} ({{ group.length }}x)</div>
          <div v-for="(r, ri) in group" :key="ri" class="row items-center no-wrap q-mb-xs" style="background:white;border-radius:4px;padding:4px 8px">
            <div class="col text-caption">{{ r[0] }} • {{ r[3] }} • {{ r[18] }}</div>
            <q-btn flat dense round icon="delete" color="red" size="sm" @click="deleteRecordSimple(r)"><q-tooltip>Smazat</q-tooltip></q-btn>
          </div>
          <q-btn flat dense size="sm" color="grey-7" label="Potvrdit vše, není chyba" @click="confirmGroup(group)"/>
        </div>

        <q-separator class="q-my-md"/>

        <!-- 2) PODEZŘELE DLOUHÉ SMĚNY -->
        <div class="row items-center q-mb-sm">
          <div class="text-subtitle1 text-bold col">⏱ Podezřele dlouhé směny</div>
          <q-input v-model.number="longShiftThreshold" type="number" label="Hranice (h)" dense outlined style="width:110px"/>
        </div>
        <div v-if="longShiftRecords.length === 0" class="text-caption text-grey-6 q-mb-md">✓ Žádné směny nad {{ longShiftThreshold }}h</div>
        <div v-for="(r, ri) in longShiftRecords" :key="'long'+ri" class="record-card" style="border-left:4px solid #e53935">
          <div class="row items-center">
            <div class="col">
              <div class="text-bold">{{ r[6] }} — <span class="text-red-8">{{ (parseFloat(r[7])||0).toFixed(2) }} h</span></div>
              <div class="text-caption text-grey-7">{{ formatShortDateTime(r[4]) }} — {{ formatTimeRangeFix(r[4], r[5]) }}</div>
              <div class="text-caption text-grey-7">{{ r[0] }} • {{ r[3] }}</div>
              <div class="text-caption text-grey-6 q-mt-xs">Kolegové ten den: {{ sameDayColleaguesLabel(r) }}</div>
            </div>
            <div class="column q-gutter-xs">
              <q-btn color="orange" icon="edit" label="Opravit" size="sm" unelevated @click="openLongFixDialog(r)"/>
              <q-btn flat dense size="sm" color="grey-7" label="Potvrdit" @click="confirmRecordSimple(r)"/>
            </div>
          </div>
        </div>

        <q-separator class="q-my-md"/>

        <!-- 3) DUPLICITNÍ ZÁLOHY -->
        <div class="text-subtitle1 text-bold q-mb-sm">💰 Duplicitní zálohy (bez obědů)</div>
        <div v-if="duplicateAdvanceGroups.length === 0" class="text-caption text-grey-6 q-mb-md">✓ Žádné duplicity</div>
        <div v-for="(group, gi) in duplicateAdvanceGroups" :key="'dupadv'+gi" class="q-mb-md q-pa-sm" style="background:#fff3e0;border-radius:8px">
          <div class="text-bold q-mb-xs">{{ group[0][2] }} — {{ formatShortDateTime(group[0][1]) }} ({{ group.length }}x)</div>
          <div v-for="(a, ai) in group" :key="ai" class="row items-center no-wrap q-mb-xs" style="background:white;border-radius:4px;padding:4px 8px">
            <div class="col text-caption">{{ a[4] }} Kč • {{ a[5] }} • {{ a[7] }}</div>
            <q-btn flat dense round icon="delete" color="red" size="sm" @click="deleteAdvanceSimple(a)"><q-tooltip>Smazat</q-tooltip></q-btn>
          </div>
          <q-btn flat dense size="sm" color="grey-7" label="Potvrdit vše, není chyba" @click="confirmAdvanceGroup(group)"/>
        </div>

      </div>

      <!-- DIALOGY -->
      <q-dialog v-model="migConfirmDialog">
        <q-card style="width:100%; max-width:400px">
          <q-card-section><div class="text-h6">Potvrdit migraci</div></q-card-section>
          <q-card-section class="q-pt-none">
            <div>• {{ migPreview ? migPreview.recordsToCopy : 0 }} záznamů</div>
            <div>• {{ migPreview ? migPreview.advancesToCopy : 0 }} záloh</div>
          </q-card-section>
          <q-card-actions align="right"><q-btn flat label="Zrušit" color="grey" v-close-popup/><q-btn label="Provést" color="deep-orange" @click="runMigration"/></q-card-actions>
        </q-card>
      </q-dialog>

      <q-dialog v-model="fixDialog">
        <q-card style="width:95%; max-width:500px">
          <q-card-section>
            <div class="text-h6">Opravit záznam</div>
            <div v-if="fixOriginal" class="text-caption text-grey-7">{{ fixOriginal.worker }} — {{ fixOriginal.date }} {{ fixOriginal.timeFrom }}-{{ fixOriginal.timeTo }}</div>
            <div v-if="fixSuggestion" class="text-caption text-red-8 q-mt-xs">⚠ Většina ({{ fixSuggestion.count }}/{{ fixSuggestion.total }}): <strong>{{ fixSuggestion.name }}</strong> <q-btn flat dense size="sm" color="primary" label="Použít rovnou" @click="useSuggestedContract"/></div>
          </q-card-section>
          <q-card-section class="q-pt-none" style="max-height:65vh; overflow-y:auto">
            <div class="row q-col-gutter-sm">
              <div class="col-6">
                <div class="text-caption text-grey-7 q-mb-xs">Vzor od kolegy:</div>
                <q-select v-if="colleagueOptionsFix.length > 0" v-model="selectedColleagueIdxFix" :options="colleagueOptionsFix" emit-value map-options outlined dense class="q-mb-sm"/>
                <div v-else class="text-caption text-grey-6 q-mb-sm">Žádný kolega.</div>
                <template v-if="selectedColleagueFix">
                  <q-input :model-value="selectedColleagueFix[6]" label="Pracovník" dense readonly filled class="q-mb-xs"/>
                  <div class="row items-center no-wrap q-mb-xs"><q-input :model-value="selectedColleagueFix[0]" label="Zakázka" dense readonly filled class="col"/><q-btn flat dense round icon="arrow_forward" color="primary" class="q-ml-xs" @click="fixForm.contractId = findContractIdByNameFix(selectedColleagueFix[0])"/></div>
                  <div class="row items-center no-wrap q-mb-xs"><q-input :model-value="selectedColleagueFix[3]" label="Práce" dense readonly filled class="col"/><q-btn flat dense round icon="arrow_forward" color="primary" class="q-ml-xs" @click="fixForm.jobId = findJobIdByNameFix(selectedColleagueFix[3])"/></div>
                  <div class="row items-center no-wrap q-mb-sm"><q-input :model-value="selectedColleagueFix[14] || 'Nezadáno'" label="Místo" dense readonly filled class="col"/><q-btn flat dense round icon="arrow_forward" color="primary" class="q-ml-xs" @click="fixForm.placeId = findPlaceIdByNameFix(selectedColleagueFix[14])"/></div>
                  <q-btn color="deep-orange" icon="content_copy" label="Opsat vše" size="sm" class="full-width" @click="copyAllFromColleagueFix"/>
                </template>
              </div>
              <div class="col-6">
                <div class="text-caption text-grey-7 q-mb-xs">Nové:</div>
                <q-select v-model="fixForm.contractId" :options="contractOptions" label="Zakázka" emit-value map-options dense outlined class="q-mb-xs"/>
                <q-select v-model="fixForm.jobId" :options="jobOptions" label="Práce" emit-value map-options dense outlined class="q-mb-xs"/>
                <q-select v-model="fixForm.placeId" :options="placeOptions" label="Místo" emit-value map-options dense outlined class="q-mb-xs"/>
                <q-input v-model="fixForm.timeFrom" label="Od" dense outlined class="q-mb-xs"><template v-slot:append><q-icon name="schedule" class="cursor-pointer"><q-popup-proxy cover ref="fixTimeFromProxy"><q-time v-model="fixForm.timeFrom" mask="HH:mm" format24h @update:model-value="val => { if (val && val.length === 5) $refs.fixTimeFromProxy.hide(); }"/></q-popup-proxy></q-icon></template></q-input>
                <q-input v-model="fixForm.timeTo" label="Do" dense outlined class="q-mb-xs"><template v-slot:append><q-icon name="schedule" class="cursor-pointer"><q-popup-proxy cover ref="fixTimeToProxy"><q-time v-model="fixForm.timeTo" mask="HH:mm" format24h @update:model-value="val => { if (val && val.length === 5) $refs.fixTimeToProxy.hide(); }"/></q-popup-proxy></q-icon></template></q-input>
                <q-input v-model="fixForm.note" label="Poznámka" dense outlined type="textarea" rows="2"/>
              </div>
            </div>
          </q-card-section>
          <q-card-actions align="right"><q-btn flat label="Zrušit" color="grey" v-close-popup size="sm"/><q-btn label="Uložit" color="primary" :loading="fixSaving" @click="saveFix" size="sm"/></q-card-actions>
        </q-card>
      </q-dialog>

      <!-- DIALOG OPRAVY DLOUHÉ SMĚNY -->
      <q-dialog v-model="longFixDialog">
        <q-card style="width:95%; max-width:500px">
          <q-card-section>
            <div class="text-h6">Opravit dlouhou směnu</div>
            <div v-if="longFixOriginal" class="text-caption text-grey-7">{{ longFixOriginal.worker }} — {{ longFixOriginal.hours }} h ({{ longFixOriginal.timeFrom }}-{{ longFixOriginal.timeTo }})</div>
          </q-card-section>
          <q-card-section class="q-pt-none" style="max-height:65vh; overflow-y:auto">
            <q-select v-model="longFixForm.workerId" :options="workerOptions" label="Pracovník" emit-value map-options dense outlined class="q-mb-xs"/>
            <q-select v-model="longFixForm.contractId" :options="contractOptions" label="Zakázka" emit-value map-options dense outlined class="q-mb-xs"/>
            <q-select v-model="longFixForm.jobId" :options="jobOptions" label="Práce" emit-value map-options dense outlined class="q-mb-xs"/>
            <q-select v-model="longFixForm.placeId" :options="placeOptions" label="Místo" emit-value map-options dense outlined class="q-mb-xs"/>
            <q-input v-model="longFixForm.dateEdit" label="Datum" dense outlined readonly class="q-mb-xs"><template v-slot:append><q-icon name="event" class="cursor-pointer"><q-popup-proxy cover ref="longFixDateProxy"><q-date v-model="longFixForm.dateEdit" mask="DD. MM. YYYY" locale="cs" @update:model-value="$refs.longFixDateProxy.hide()"/></q-popup-proxy></q-icon></template></q-input>
            <q-input v-model="longFixForm.timeFrom" label="Od" dense outlined class="q-mb-xs"><template v-slot:append><q-icon name="schedule" class="cursor-pointer"><q-popup-proxy cover ref="longFixTimeFromProxy"><q-time v-model="longFixForm.timeFrom" mask="HH:mm" format24h @update:model-value="val => { if (val && val.length === 5) $refs.longFixTimeFromProxy.hide(); }"/></q-popup-proxy></q-icon></template></q-input>
            <q-input v-model="longFixForm.timeTo" label="Do" dense outlined class="q-mb-xs"><template v-slot:append><q-icon name="schedule" class="cursor-pointer"><q-popup-proxy cover ref="longFixTimeToProxy"><q-time v-model="longFixForm.timeTo" mask="HH:mm" format24h @update:model-value="val => { if (val && val.length === 5) $refs.longFixTimeToProxy.hide(); }"/></q-popup-proxy></q-icon></template></q-input>
            <q-input v-model="longFixForm.note" label="Poznámka" dense outlined type="textarea" rows="2"/>
          </q-card-section>
          <q-card-actions align="right"><q-btn flat label="Zrušit" color="grey" v-close-popup size="sm"/><q-btn label="Uložit opravu" color="primary" :loading="longFixSaving" @click="saveLongFix" size="sm"/></q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  `
});
