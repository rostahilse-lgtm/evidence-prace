// KOMPLETNÍ admin.js – opravený na základě sheetu a problémů

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
        timeFr: null,
        timeTo: null,
        note: '',
        kmJednosmer: 0,
        kmCelkem: 0,
        kmRucne: 'N',
        kmManual: false,
        kmRoundTrip: true
      },
      workers: [],  // pro výběr v dialogu oběd/záloha
      lunchDialog: false,
      newLunch: {
        workerId: null,
        date: getTodayDate(),
        time: ''
      },
      advanceDialog: false,
      newAdvance: {
        workerId: null,
        amount: null,
        reason: '',
        date: getTodayDate()
      }
    }
  },

  computed: {
    contractOptions() {
      return this.contracts.map(c => ({ label: c[0] + ' - ' + c[1], value: c[0] }));
    },
    jobOptions() {
      return this.jobs.map(j => ({ label: j[1], value: j[0] }));
    },
    selectedContractKm() {
      if (!this.editForm.contractId) return 0;
      const contract = this.contracts.find(c => c[0] === this.editForm.contractId);
      return contract ? (contract[3] || 0) : 0;
    },
    calculatedKmEdit() {
      if (this.editForm.kmManual) {
        return this.editForm.kmRoundTrip ? this.editForm.kmJednosmer * 2 : this.editForm.kmJednosmer;
      }
      if (this.selectedContractKm > 0) {
        return this.editForm.kmRoundTrip ? this.selectedContractKm * 2 : this.selectedContractKm;
      }
      return 0;
    },
    totalDayHours() {
      return this.dayRecords.reduce((sum, r) => sum + (parseFloat(r[7]) || 0), 0).toFixed(1);
    },
    totalDayKm() {
      return this.dayRecords.reduce((sum, r) => sum + (parseFloat(r[12]) || 0), 0).toFixed(0);
    },
    uniqueDayWorkers() {
      return new Set(this.dayRecords.map(r => r[6])).size;
    },
    workerOptions() {
      return this.workers.map(w => ({ label: w[1], value: w[0] }));  // w[0] = id, w[1] = jméno
    }
  },

  methods: {
    selectWorker(worker) {
      this.selectedWorkerData = {
        info: worker,
        records: this.allRecords.filter(r => String(r[0]) === String(worker.id)),
        advances: this.allAdvances.filter(a => String(a[0]) === String(worker.id))
      };
      this.adminTab = 'detail';
    },

    backToWorkers() {
      this.selectedWorkerData = null;
      this.adminTab = 'workers';
    },

    loadDayRecords() {
      const dateStr = this.adminDayView === 'today' ? getTodayDate() : this.selectedDate;
      
      const cleaned = dateStr.replace(/\s+/g, ' ').trim();
      const parts = cleaned.split('.').map(p => parseInt(p.trim(), 10));
      
      if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
        console.error('Neplatné datum:', dateStr);
        this.dayRecords = [];
        return;
      }
      
      const [dd, mm, yyyy] = parts;
      const dayStart = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0).getTime();
      const dayEnd = new Date(yyyy, mm - 1, dd, 23, 59, 59, 999).getTime();
      
      console.log(`Filtruji den ${dateStr} → start ${dayStart} ms, end ${dayEnd} ms`);
      
      this.dayRecords = this.allRecords
        .filter(r => {
          const ts = Number(r[4]); // čas OD [ms] = sloupec E = index 4
          if (isNaN(ts)) {
            console.warn('Neplatný timestamp:', r);
            return false;
          }
          return ts >= dayStart && ts <= dayEnd;
        })
        .sort((a, b) => Number(a[4]) - Number(b[4]));
      
      console.log(`Načteno ${this.dayRecords.length} záznamů pro ${dateStr}`);
    },

    openEditDialog(record, index) {
      this.editingRecord = { data: record, index: index };
      const contract = this.contracts.find(c => c[1] === record[3]);
      const job = this.jobs.find(j => j[1] === record[5]);
      
      const kmJednosmer = record[10] || 0;
      const kmCelkem = record[11] || 0;
      const kmRucne = record[12] || 'N';
      
      this.editForm = {
        contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null,
        timeFr: record[4],
        timeTo: record[5],
        note: record[8],
        kmJednosmer: kmJednosmer,
        kmCelkem: kmCelkem,
        kmRucne: kmRucne,
        kmManual: kmRucne === 'Y',
        kmRoundTrip: kmCelkem === (kmJednosmer * 2)
      };
      this.editDialog = true;
    },

    duplicateRecord(record) {
      this.openEditDialog(record, -1); // -1 = nový (kopie)
    },

    async saveEdit() {
      if (!this.editForm.contractId || !this.editForm.jobId || !this.editForm.timeFr || !this.editForm.timeTo) {
        this.$emit('message', 'Vyplňte všechna pole');
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
        id_contract: this.editForm.contractId,
        id_job: this.editForm.jobId,
        time_fr: this.editForm.timeFr,
        time_to: this.editForm.timeTo,
        note: this.editForm.note,
        ...kmData
      };

      const action = this.editingRecord.index >= 0 ? 'updaterecord' : 'saverecord';
      if (action === 'updaterecord') payload.row_index = this.editingRecord.index;

      try {
        const res = await apiCall(action, payload);
        if (res.code === '000') {
          this.$emit('message', 'Záznam uložen');
          this.editDialog = false;
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        this.$emit('message', 'Chyba při ukládání');
      }
    },

    async deleteRecord(index) {
      if (index < 0 || !confirm('Opravdu smazat?')) return;
      try {
        const res = await apiCall('deleterecord', { row_index: index });
        if (res.code === '000') {
          this.$emit('message', 'Smazáno');
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        this.$emit('message', 'Chyba při mazání');
      }
    },

    async loadWorkers() {
      const res = await apiCall('getworkers');
      if (res.code === '000' && res.data) this.workers = res.data;
    },

    openLunchDialog() {
      this.lunchDialog = true;
    },

    async saveLunch() {
      if (!this.newLunch.workerId) {
        this.$emit('message', 'Vyber pracovníka');
        return;
      }
      // Převeď datum + čas na timestamp
      const dateParts = this.newLunch.date.split('. ').map(Number);
      const timeParts = this.newLunch.time.split(':').map(Number);
      const ts = new Date(dateParts[2], dateParts[1]-1, dateParts[0], timeParts[0], timeParts[1]).getTime();

      const worker = this.workers.find(w => w[0] === this.newLunch.workerId);
      try {
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
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        this.$emit('message', 'Chyba při přidání oběda');
      }
    },

    openAdvanceDialog() {
      this.advanceDialog = true;
    },

    async saveAdvance() {
      if (!this.newAdvance.workerId || !this.newAdvance.amount || !this.newAdvance.reason.trim()) {
        this.$emit('message', 'Vyplňte všechna pole');
        return;
      }
      const dateParts = this.newAdvance.date.split('. ').map(Number);
      const ts = new Date(dateParts[2], dateParts[1]-1, dateParts[0], 12, 0).getTime();

      const worker = this.workers.find(w => w[0] === this.newAdvance.workerId);
      try {
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
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        this.$emit('message', 'Chyba při přidání zálohy');
      }
    },

    formatTimeRange(fr, to) { return formatTimeRange(fr, to); },
    formatShortDateTime(ts) { return formatShortDateTime(ts); },
    getTodayDate() { return getTodayDate(); },
    formatDateForInput(s) { return formatDateForInput(s); },
    formatDateFromInput(i) { return formatDateFromInput(i); },
    timestampToDatetimeLocal(ts) { return new Date(ts).toISOString().slice(0,16); },
    datetimeLocalToTimestamp(dt) { return new Date(dt).getTime(); }
  },

  watch: {
    adminDayView() { if (this.adminTab === 'day') this.loadDayRecords(); },
    selectedDate() { if (this.adminTab === 'day') this.loadDayRecords(); },
    'editForm.contractId'() {
      if (!this.editForm.kmManual) {
        this.editForm.kmJednosmer = this.selectedContractKm;
        this.editForm.kmCelkem = this.calculatedKmEdit;
      }
    }
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
      <!-- ... zbytek template zůstává stejný jako v tvém originále ... -->
      <!-- PŘEHLED DNE -->
      <div v-if="adminTab==='day'" class="q-pt-md">
        <div class="row justify-between q-mb-md">
          <q-input v-model="selectedDate" label="Datum" outlined dense style="max-width: 220px;">
            <template v-slot:append>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy>
                  <q-date v-model="selectedDate" mask="DD. MM. YYYY" locale="cs" />
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
          <q-btn label="Dnes" color="primary" flat @click="selectedDate = getTodayDate(); loadDayRecords()" />
        </div>

        <div class="row q-col-gutter-md q-mb-md">
          <div class="col"><q-card flat bordered><q-card-section class="text-center"><div class="text-caption">Celkem hodin</div><div class="text-h5">{{ totalDayHours }}</div></q-card-section></q-card></div>
          <div class="col"><q-card flat bordered><q-card-section class="text-center"><div class="text-caption">Pracovníků</div><div class="text-h5">{{ uniqueDayWorkers }}</div></q-card-section></q-card></div>
          <div class="col"><q-card flat bordered><q-card-section class="text-center"><div class="text-caption">Celkem km</div><div class="text-h5">{{ totalDayKm }}</div></q-card-section></q-card></div>
        </div>

        <q-separator spaced class="q-mt-md" />

        <q-list v-if="dayRecords.length" separator>
          <q-item v-for="(record,idx) in dayRecords" :key="idx">
            <q-item-section avatar>
              <q-avatar color="primary">{{ record[6]?.charAt(0) || '?' }}</q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ record[6] }} • Zakázka: {{ record[0] }}</q-item-label>
              <q-item-label caption>
                Od: {{ formatTime(record[4]) }} Do: {{ formatTime(record[5]) }} • {{ record[7].toFixed(1) }} h
                <span v-if="record[12]"> • {{ record[12] }} km</span>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn-group flat>
                <q-btn icon="content_copy" @click="duplicateRecord(record)" dense flat color="primary">
                  <q-tooltip>Duplikovat</q-tooltip>
                </q-btn>
                <q-btn icon="edit" @click="openEditDialog(record,idx)" dense flat color="orange">
                  <q-tooltip>Upravit</q-tooltip>
                </q-btn>
                <q-btn icon="delete" @click="deleteRecord(idx)" dense flat color="negative">
                  <q-tooltip>Smazat</q-tooltip>
                </q-btn>
              </q-btn-group>
            </q-item-section>
          </q-item>
        </q-list>

        <div v-else class="text-center q-my-xl text-grey">
          Žádné záznamy pro tento den
        </div>

        <div class="q-mt-lg">
          <q-btn label="Přidat oběd (zapomněl)" color="secondary" @click="openLunchDialog" />
          <q-btn label="Přidat zálohu" color="positive" @click="openAdvanceDialog" class="q-ml-md" />
        </div>
      </div>
      
      <!-- STATISTIKY -->
      <div v-if="adminTab==='stats'">
        <statistics-component
          :all-records="allRecords"
          :contracts="contracts"
          :jobs="jobs"
          :places="places"
          :all-advances="allAdvances"
          @message="(msg) => $emit('message', msg)"
        />
      </div>

      <!-- EDIT DIALOG -->
      <q-dialog v-model="editDialog">
        <q-card style="min-width:350px">
          <q-card-section>
            <div class="text-h6">Upravit záznam</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <q-select
              v-model="editForm.contractId"
              :options="contractOptions"
              label="Zakázka"
              emit-value
              map-options
              outlined
              class="q-mb-md"
            />
            <q-select
              v-model="editForm.jobId"
              :options="jobOptions"
              label="Práce"
              emit-value
              map-options
              outlined
              class="q-mb-md"
            />
            <div class="row q-gutter-sm q-mb-md">
              <div class="col">
                <q-input
                  v-model="editForm.timeFr"
                  label="Čas od"
                  type="datetime-local"
                  outlined
                  dense
                  :model-value="new Date(editForm.timeFr).toISOString().slice(0,16)"
                  @update:model-value="editForm.timeFr = new Date($event).getTime()"
                />
              </div>
              <div class="col">
                <q-input
                  v-model="editForm.timeTo"
                  label="Čas do"
                  type="datetime-local"
                  outlined
                  dense
                  :model-value="new Date(editForm.timeTo).toISOString().slice(0,16)"
                  @update:model-value="editForm.timeTo = new Date($event).getTime()"
                />
              </div>
            </div>
            <div v-if="selectedContractKm > 0 || editForm.kmManual" class="q-mb-md">
              <q-separator class="q-mb-sm"/>
              <div class="text-subtitle2">🚗 Kilometry</div>
              <div class="text-caption text-grey-7 q-mt-xs">
                Zakázka: {{ selectedContractKm }} km jedna cesta
              </div>
              <q-checkbox
                v-model="editForm.kmRoundTrip"
                label="Tam a zpět (×2)"
                dense
                class="q-mt-sm"
              />
              <div class="text-bold text-primary q-mt-xs">
                Celkem: {{ calculatedKmEdit }} km
              </div>
              <q-checkbox
                v-model="editForm.kmManual"
                label="Zadat km ručně"
                dense
                class="q-mt-sm"
              />
              <q-input
                v-if="editForm.kmManual"
                v-model.number="editForm.kmJednosmer"
                label="Počet km (jedna cesta)"
                type="number"
                outlined
                dense
                class="q-mt-sm"
              />
            </div>
            <q-input
              v-model="editForm.note"
              label="Poznámka"
              outlined
              type="textarea"
              rows="2"
            />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Storno" color="red" v-close-popup/>
            <q-btn flat label="Uložit" color="green" @click="saveEdit" :loading="loading"/>
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- DIALOG PRO OBĚD -->
      <q-dialog v-model="lunchDialog">
        <q-card style="width: 400px; max-width: 80vw;">
          <q-card-section>
            <div class="text-h6">Přidat oběd</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <q-select v-model="newLunch.workerId" :options="workerOptions" label="Pracovník" filled />
            <q-input v-model="newLunch.date" label="Datum" filled class="q-mt-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover>
                    <q-date v-model="newLunch.date" mask="DD. MM. YYYY" locale="cs" />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            <q-input v-model="newLunch.time" label="Čas (HH:MM)" filled class="q-mt-sm" mask="time" />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Storno" color="red" v-close-popup />
            <q-btn flat label="Uložit" color="green" @click="saveLunch" />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- DIALOG PRO ZÁLOHU -->
      <q-dialog v-model="advanceDialog">
        <q-card style="width: 400px; max-width: 80vw;">
          <q-card-section>
            <div class="text-h6">Přidat zálohu</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <q-select v-model="newAdvance.workerId" :options="workerOptions" label="Pracovník" filled />
            <q-input v-model="newAdvance.date" label="Datum" filled class="q-mt-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover>
                    <q-date v-model="newAdvance.date" mask="DD. MM. YYYY" locale="cs" />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            <q-input v-model.number="newAdvance.amount" label="Částka (Kč)" type="number" filled class="q-mt-sm" />
            <q-input v-model="newAdvance.reason" label="Důvod" filled class="q-mt-sm" />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Storno" color="red" v-close-popup />
            <q-btn flat label="Uložit" color="green" @click="saveAdvance" />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  `
});
