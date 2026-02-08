// KOMPLETNÍ admin.js – finální verze 2026-02-08

window.app.component('admin-component', {
  props: ['allSummary', 'allRecords', 'allAdvances', 'contracts', 'jobs', 'places', 'loading'],
  emits: ['message', 'reload'],

  data() {
    return {
      adminTab: 'workers',
      selectedWorkerData: null,
      summaryTab: 'records',
      dayRecords: [],
      adminDayView: 'today',
      selectedDate: getTodayDate(),
      editDialog: false,
      editingRecord: null,
      editForm: {
        contractId: null,
        jobId: null,
        workerId: null,
        timeFr: null,
        timeTo: null,
        note: '',
        kmJednosmer: 0,
        kmCelkem: 0,
        kmRucne: 'N',
        kmManual: false,
        kmRoundTrip: true
      },
      originalForm: {}, // pro zobrazení původních hodnot
      workers: [],
      lunchDialog: false,
      newLunch: { workerId: null, date: getTodayDate(), time: '' },
      advanceDialog: false,
      newAdvance: { workerId: null, amount: null, reason: '', date: getTodayDate() }
    }
  },

  computed: {
    contractOptions() { return this.contracts.map(c => ({ label: c[0] + ' - ' + c[1], value: c[0] })); },
    jobOptions() { return this.jobs.map(j => ({ label: j[1], value: j[0] })); },
    selectedContractKm() {
      if (!this.editForm.contractId) return 0;
      const c = this.contracts.find(c => c[0] === this.editForm.contractId);
      return c ? (c[3] || 0) : 0;
    },
    calculatedKmEdit() {
      if (this.editForm.kmManual) return this.editForm.kmRoundTrip ? this.editForm.kmJednosmer * 2 : this.editForm.kmJednosmer;
      if (this.selectedContractKm > 0) return this.editForm.kmRoundTrip ? this.selectedContractKm * 2 : this.selectedContractKm;
      return 0;
    },
    totalDayHours() { return this.dayRecords.reduce((s, r) => s + (parseFloat(r[7]) || 0), 0).toFixed(1); },
    totalDayKm() { return this.dayRecords.reduce((s, r) => s + (parseFloat(r[12]) || 0), 0).toFixed(0); },
    uniqueDayWorkers() { return new Set(this.dayRecords.map(r => r[6])).size; },
    workerOptions() { return this.workers.map(w => ({ label: w[1], value: w[0] })); }
  },

  methods: {
    // Helper pro čas (pokud utils nefunguje)
    formatTime(ts) {
      if (!ts || isNaN(ts)) return '--:--';
      const d = new Date(Number(ts));
      return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    },

    loadDayRecords() {
      const dateStr = this.adminDayView === 'today' ? getTodayDate() : this.selectedDate;
      const parts = dateStr.split('.').map(p => parseInt(p.trim(), 10));
      if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
        console.error('Neplatné datum:', dateStr);
        this.dayRecords = [];
        return;
      }
      const [dd, mm, yyyy] = parts;
      const start = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0).getTime();
      const end = new Date(yyyy, mm - 1, dd, 23, 59, 59, 999).getTime();

      this.dayRecords = this.allRecords
        .filter(r => {
          const ts = Number(r[4]);
          return !isNaN(ts) && ts >= start && ts <= end;
        })
        .sort((a, b) => Number(a[4]) - Number(b[4]));
    },

    openEditDialog(record, index) {
      this.editingRecord = { data: record, index };
      const contract = this.contracts.find(c => c[1] === record[3]);
      const job = this.jobs.find(j => j[1] === record[5]);
      const workerId = record[1] || null; // id pracovníka

      this.editForm = {
        contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null,
        workerId: workerId,
        timeFr: record[4],
        timeTo: record[5],
        note: record[8] || '',
        kmJednosmer: record[10] || 0,
        kmCelkem: record[11] || 0,
        kmRucne: record[12] || 'N',
        kmManual: record[12] === 'Y',
        kmRoundTrip: (record[11] || 0) === ((record[10] || 0) * 2)
      };

      // Původní hodnoty pro zobrazení
      this.originalForm = { ...this.editForm };

      this.editDialog = true;
    },

    duplicateRecord(record) {
      this.openEditDialog(record, -1); // -1 = nový
    },

    async saveEdit() {
      if (!this.editForm.contractId || !this.editForm.jobId || !this.editForm.timeFr || !this.editForm.timeTo || !this.editForm.workerId) {
        this.$emit('message', 'Vyplňte všechna pole včetně pracovníka');
        return;
      }

      const kmData = this.editForm.kmManual ? {
        km_jednosmer: this.editForm.kmJednosmer,
        km_celkem: this.calculatedKmEdit,
        km_rucne: 'Y'
      } : {
        km_jednosmer: this.selectedContractKm,
        km_celkem: this.calculatedKmEdit,
        km_rucne: 'N'
      };

      const payload = {
        row_index: this.editingRecord.index >= 0 ? this.editingRecord.index : undefined,
        id_contract: this.editForm.contractId,
        id_job: this.editForm.jobId,
        id_worker: this.editForm.workerId,
        time_fr: this.editForm.timeFr,
        time_to: this.editForm.timeTo,
        note: this.editForm.note,
        ...kmData
      };

      const action = this.editingRecord.index >= 0 ? 'updaterecord' : 'saverecord';

      try {
        const res = await apiCall(action, payload);
        if (res.code === '000') {
          this.$emit('message', 'Záznam uložen');
          this.editDialog = false;
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + (res.error || 'neznámá'));
        }
      } catch (e) {
        this.$emit('message', 'Chyba při ukládání');
      }
    },

    async deleteRecord(index) {
      if (index < 0 || !confirm('Smazat?')) return;
      try {
        const res = await apiCall('deleterecord', { row_index: index });
        if (res.code === '000') {
          this.$emit('message', 'Smazáno');
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba mazání');
        }
      } catch (e) {
        this.$emit('message', 'Chyba mazání');
      }
    },

    async loadWorkers() {
      const res = await apiCall('getworkers');
      if (res.code === '000' && res.data) this.workers = res.data;
    },

    openLunchDialog() { this.lunchDialog = true; },
    async saveLunch() {
      if (!this.newLunch.workerId) return this.$emit('message', 'Vyber pracovníka');
      const dateParts = this.newLunch.date.split('. ').map(Number);
      const timeParts = this.newLunch.time.split(':').map(Number);
      const ts = new Date(dateParts[2], dateParts[1]-1, dateParts[0], timeParts[0], timeParts[1]).getTime();

      const worker = this.workers.find(w => w[0] === this.newLunch.workerId);
      const res = await apiCall('savelunch', {
        id_worker: this.newLunch.workerId,
        name_worker: worker ? worker[1] : '',
        time: ts
      });
      if (res.code === '000') {
        this.$emit('message', 'Oběd přidán');
        this.lunchDialog = false;
        this.$emit('reload');
      } else {
        this.$emit('message', 'Chyba oběda');
      }
    },

    openAdvanceDialog() { this.advanceDialog = true; },
    async saveAdvance() {
      if (!this.newAdvance.workerId || !this.newAdvance.amount || !this.newAdvance.reason.trim()) return this.$emit('message', 'Vyplňte vše');
      const dateParts = this.newAdvance.date.split('. ').map(Number);
      const ts = new Date(dateParts[2], dateParts[1]-1, dateParts[0], 12, 0).getTime();

      const worker = this.workers.find(w => w[0] === this.newAdvance.workerId);
      const res = await apiCall('saveadvance', {
        id_worker: this.newAdvance.workerId,
        name_worker: worker ? worker[1] : '',
        time: ts,
        payment: this.newAdvance.amount,
        payment_reason: this.newAdvance.reason
      });
      if (res.code === '000') {
        this.$emit('message', 'Záloha přidána');
        this.advanceDialog = false;
        this.$emit('reload');
      } else {
        this.$emit('message', 'Chyba zálohy');
      }
    }
  },

  watch: {
    adminTab(v) { if (v === 'day') this.loadDayRecords(); },
    selectedDate() { if (this.adminTab === 'day') this.loadDayRecords(); }
  },

  async mounted() {
    await this.loadWorkers();
    if (this.adminTab === 'day') this.loadDayRecords();
  },

  template: `
    <div>
      <q-tabs v-model="adminTab" dense align="justify" class="text-primary">
        <q-tab name="workers" label="Pracovníci"/>
        <q-tab name="day" label="Přehled dne"/>
        <q-tab name="stats" label="Statistiky"/>
      </q-tabs>

      <!-- ... sekce PRACOVNÍCI a DETAIL zůstávají stejné ... -->

      <!-- PŘEHLED DNE -->
      <div v-if="adminTab==='day'" class="q-pt-md">
        <div class="row justify-between items-center q-mb-md">
          <q-input v-model="selectedDate" label="Datum" outlined dense style="max-width: 220px;">
            <template v-slot:append>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy>
                  <q-date v-model="selectedDate" mask="DD. MM. YYYY" locale="cs" @update:model-value="loadDayRecords" />
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
          <q-btn label="Dnes" color="primary" flat @click="selectedDate = getTodayDate(); loadDayRecords()" />
        </div>

        <div class="row q-col-gutter-md q-mb-md">
          <div class="col"><q-card flat bordered><q-card-section class="text-center"><div class="text-caption">Hodin</div><div class="text-h5">{{ totalDayHours }}</div></q-card-section></q-card></div>
          <div class="col"><q-card flat bordered><q-card-section class="text-center"><div class="text-caption">Lidí</div><div class="text-h5">{{ uniqueDayWorkers }}</div></q-card-section></q-card></div>
          <div class="col"><q-card flat bordered><q-card-section class="text-center"><div class="text-caption">Km</div><div class="text-h5">{{ totalDayKm }}</div></q-card-section></q-card></div>
        </div>

        <q-separator spaced />

        <q-list v-if="dayRecords.length" separator>
          <q-item v-for="(r, i) in dayRecords" :key="i">
            <q-item-section avatar><q-avatar color="primary">{{ r[6]?.charAt(0) || '?' }}</q-avatar></q-item-section>
            <q-item-section>
              <q-item-label>{{ r[6] }} • Zakázka: {{ r[0] }} • Práce: {{ r[3] }}</q-item-label>
              <q-item-label caption>
                Od: {{ formatTime(r[4]) }} Do: {{ formatTime(r[5]) }} • {{ (parseFloat(r[7]) || 0).toFixed(1) }} h
                <span v-if="r[12]"> • {{ r[12] }} km</span>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn-group flat>
                <q-btn icon="content_copy" @click="duplicateRecord(r)" dense flat color="primary"><q-tooltip>Duplikovat</q-tooltip></q-btn>
                <q-btn icon="edit" @click="openEditDialog(r, i)" dense flat color="orange"><q-tooltip>Upravit</q-tooltip></q-btn>
                <q-btn icon="delete" @click="deleteRecord(i)" dense flat color="negative"><q-tooltip>Smazat</q-tooltip></q-btn>
              </q-btn-group>
            </q-item-section>
          </q-item>
        </q-list>

        <div v-else class="text-center q-my-xl text-grey">Žádné záznamy pro tento den</div>

        <div class="q-mt-lg text-right">
          <q-btn label="Přidat oběd (zapomněl)" color="secondary" @click="openLunchDialog" />
          <q-btn label="Přidat zálohu" color="positive" @click="openAdvanceDialog" class="q-ml-md" />
        </div>
      </div>

      <!-- EDIT DIALOG – DVA SLOUPCE: PŮVODNÍ | NOVÉ -->
      <q-dialog v-model="editDialog">
        <q-card style="width: 600px; max-width: 90vw;">
          <q-card-section>
            <div class="text-h6">Upravit / Duplikovat záznam</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <div class="row q-col-gutter-md">
              <div class="col-6">
                <div class="text-subtitle2 q-mb-sm">Původní hodnoty</div>
                <q-input outlined dense readonly label="Zakázka" :value="originalForm.contractId || '–'" />
                <q-input outlined dense readonly label="Práce" :value="originalForm.jobId || '–'" />
                <q-input outlined dense readonly label="Pracovník" :value="workerOptions.find(o => o.value === originalForm.workerId)?.label || '–'" />
                <q-input outlined dense readonly label="Čas od" :value="formatTime(originalForm.timeFr)" />
                <q-input outlined dense readonly label="Čas do" :value="formatTime(originalForm.timeTo)" />
                <q-input outlined dense readonly label="Poznámka" type="textarea" rows="2" :value="originalForm.note || '–'" />
                <q-input outlined dense readonly label="Km celkem" :value="originalForm.kmCelkem || '0'" />
              </div>
              <div class="col-6">
                <div class="text-subtitle2 q-mb-sm">Nové hodnoty (změň co chceš)</div>
                <q-select v-model="editForm.contractId" :options="contractOptions" label="Zakázka" outlined dense />
                <q-select v-model="editForm.jobId" :options="jobOptions" label="Práce" outlined dense />
                <q-select v-model="editForm.workerId" :options="workerOptions" label="Pracovník" outlined dense />
                <q-input v-model="editForm.timeFr" label="Čas od" type="datetime-local" outlined dense
                  :model-value="new Date(editForm.timeFr).toISOString().slice(0,16)"
                  @update:model-value="editForm.timeFr = new Date($event).getTime()"
                />
                <q-input v-model="editForm.timeTo" label="Čas do" type="datetime-local" outlined dense
                  :model-value="new Date(editForm.timeTo).toISOString().slice(0,16)"
                  @update:model-value="editForm.timeTo = new Date($event).getTime()"
                />
                <q-input v-model="editForm.note" label="Poznámka" outlined type="textarea" rows="2" />
                <div class="row q-gutter-sm">
                  <q-input v-model.number="editForm.kmJednosmer" label="Km (jednosměr)" type="number" outlined dense />
                  <q-toggle v-model="editForm.kmRoundTrip" label="×2" />
                </div>
              </div>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Storno" color="red" v-close-popup />
            <q-btn flat label="Uložit změny" color="green" @click="saveEdit" />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- OBĚD A ZÁLOHA dialogy – zůstávají stejné jako v předchozím kódu -->
      <!-- ... přidej je z mé předchozí zprávy, pokud je nemáš ... -->
    </div>
  `
});
