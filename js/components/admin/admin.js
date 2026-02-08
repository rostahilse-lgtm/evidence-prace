
// KOMPLETNÍ admin.js – finální verze s opravami všech chyb

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
      workers: [],
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
      return this.workers.map(w => ({ label: w[1], value: w[0] }));
    }
  },

  methods: {
    selectWorker(worker) {
      this.selectedWorkerData = {
        info: worker,
        records: this.allRecords.filter(r => String(r[1]) === String(worker.id)),
        advances: this.allAdvances.filter(a => String(a[0]) === String(worker.id))
      };
      this.adminTab = 'detail';
    },

    backToWorkers() {
      this.selectedWorkerData = null;
      this.adminTab = 'workers';
    },

    // Helper pro formátování času – pokud formatTime nefunguje
    formatTime(ts) {
      if (!ts) return '--:--';
      const d = new Date(Number(ts));
      return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
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
      
      console.log(`Filtruji: ${dateStr} (start ${dayStart}, end ${dayEnd})`);
      
      this.dayRecords = this.allRecords
        .filter(r => {
          const ts = Number(r[4]);
          if (isNaN(ts)) return false;
          return ts >= dayStart && ts <= dayEnd;
        })
        .sort((a, b) => Number(a[4]) - Number(b[4]));
      
      console.log(`Načteno ${this.dayRecords.length} záznamů`);
    },

    openEditDialog(record, index) {
      this.editingRecord = { data: record, index };
      const contract = this.contracts.find(c => c[1] === record[3]);
      const job = this.jobs.find(j => j[1] === record[5]);
      
      const kmJednosmer = record[10] || 0;
      const kmCelkem = record[11] || 0;
      const kmRucne = record[12] || 'N';
      
      this.editForm = {
        contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null,
        workerId: record[1] || null, // id pracovníka z r[1]
        timeFr: record[4],
        timeTo: record[5],
        note: record[8] || '',
        kmJednosmer: kmJednosmer,
        kmCelkem: kmCelkem,
        kmRucne: kmRucne,
        kmManual: kmRucne === 'Y',
        kmRoundTrip: kmCelkem === (kmJednosmer * 2)
      };
      this.editDialog = true;
    },

    duplicateRecord(record) {
      this.openEditDialog(record, -1); // -1 = nový záznam
      this.$emit('message', 'Duplikuji záznam – uprav a ulož jako nový');
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
        this.$emit('message', 'Chyba mazání');
      }
    },

    async loadWorkers() {
      const res = await apiCall('getworkers');
      if (res.code === '000' && res.data) {
        this.workers = res.data;
        console.log('Načteno', this.workers.length, 'pracovníků');
      } else {
        console.warn('Chyba načtení pracovníků:', res);
      }
    },

    openLunchDialog() {
      this.lunchDialog = true;
    },

    async saveLunch() {
      if (!this.newLunch.workerId) {
        this.$emit('message', 'Vyber pracovníka');
        return;
      }
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
        this.$emit('message', 'Chyba oběda');
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
        this.$emit('message', 'Chyba zálohy');
      }
    }
  },

  watch: {
    adminTab(newVal) {
      if (newVal === 'day') this.loadDayRecords();
    },
    selectedDate() {
      if (this.adminTab === 'day') this.loadDayRecords();
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

      <!-- PRACOVNÍCI -->
      <div v-if="adminTab==='workers'" class="q-pt-md">
        <div v-for="worker in allSummary" :key="worker.id" class="worker-card" @click="selectWorker(worker)">
          <div class="row items-center">
            <div class="col">
              <div class="text-bold">{{ worker.name }}</div>
              <div class="text-caption text-grey-7">ID: {{ worker.id }}</div>
            </div>
            <div class="text-right">
              <div class="text-bold" :class="worker.balance>=0?'balance-positive':'balance-negative'">
                {{ worker.balance }} Kč
              </div>
              <div class="text-caption">Vyděleno: {{ worker.totalEarnings }} Kč</div>
            </div>
          </div>
        </div>
      </div>

      <!-- DETAIL PRACOVNÍKA -->
      <div v-if="adminTab==='detail'&&selectedWorkerData" class="q-pt-md">
        <q-btn flat icon="arrow_back" label="Zpět" @click="backToWorkers" class="q-mb-md"/>
        <div class="summary-box">
          <div class="text-h6 q-mb-md">{{ selectedWorkerData.info.name }}</div>
          <div class="summary-item">
            <span class="summary-label">Vyděleno:</span>
            <span class="summary-value">{{ selectedWorkerData.info.totalEarnings }} Kč</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Vyplaceno:</span>
            <span class="summary-value">{{ selectedWorkerData.info.totalPaid }} Kč</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Zůstatek:</span>
            <span :class="selectedWorkerData.info.balance>=0?'balance-positive':'balance-negative'">
              {{ selectedWorkerData.info.balance }} Kč
            </span>
          </div>
        </div>
        <q-tabs v-model="summaryTab" dense class="q-mt-md">
          <q-tab name="records" label="Záznamy"/>
          <q-tab name="advances" label="Zálohy"/>
        </q-tabs>
        <div v-if="summaryTab==='records'" class="q-mt-md">
          <div v-for="(record,idx) in selectedWorkerData.records" :key="idx" class="record-card">
            <div class="row items-center">
              <div class="col">
                <div class="text-bold">{{ record[0] }}</div>
                <div class="text-caption text-grey-7">{{ record[3] }} • {{ record[14] || 'Nezadáno' }}</div>
              </div>
              <div class="text-right">
                <div class="text-bold text-primary">{{ record[7].toFixed(2) }} hod</div>
                <div class="text-caption">{{ record[2] }} Kč/hod</div>
              </div>
              <q-icon name="edit" class="edit-icon q-ml-sm" @click="openEditDialog(record,idx)"/>
            </div>
            <div class="text-caption text-grey-7 q-mt-sm">
              {{ formatTime(record[4]) }} – {{ formatTime(record[5]) }}
            </div>
            <div v-if="record[12] > 0" class="text-caption text-orange q-mt-xs">
              🚗 {{ record[12] }} km
            </div>
            <div v-if="record[8]" class="note-display">💬 {{ record[8] }}</div>
          </div>
        </div>
        <div v-if="summaryTab==='advances'" class="q-mt-md">
          <div v-for="(advance,idx) in selectedWorkerData.advances" :key="idx" class="record-card">
            <div class="row items-center">
              <div class="col">
                <div class="text-bold">{{ advance[5] }}</div>
              </div>
              <div class="text-right text-bold text-primary">{{ advance[4] }} Kč</div>
            </div>
            <div class="text-caption text-grey-7 q-mt-sm">
              {{ formatShortDateTime(advance[1]) }}
            </div>
          </div>
        </div>
      </div>

      <!-- PŘEHLED DNE -->
      <div v-if="adminTab==='day'" class="q-pt-md">
        <div class="row justify-between items-center q-mb-md">
          <q-input v-model="selectedDate" label="Datum" outlined dense style="max-width: 220px;">
            <template v-slot:append>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
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

        <q-separator spaced class="q-mt-md" />

        <q-list v-if="dayRecords.length" separator>
          <q-item v-for="(record,idx) in dayRecords" :key="idx">
            <q-item-section avatar>
              <q-avatar color="primary">{{ record[6]?.charAt(0) || '?' }}</q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ record[6] }} • Zakázka: {{ record[0] }} • Práce: {{ record[3] }}</q-item-label>
              <q-item-label caption>
                Od: {{ formatTime(record[4]) }} Do: {{ formatTime(record[5]) }} • {{ (parseFloat(record[7]) || 0).toFixed(1) }} h
                <span v-if="record[12] > 0"> • {{ record[12] }} km</span>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn-group flat>
                <q-btn icon="content_copy" @click="duplicateRecord(record)" dense flat color="primary">
                  <q-tooltip>Duplikovat</q-tooltip>
                </q-btn>
                <q-btn icon="edit" @click="openEditDialog(record, idx)" dense flat color="orange">
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

        <div class="q-mt-lg text-right q-gutter-md">
          <q-btn label="Přidat oběd (zapomněl)" color="secondary" @click="openLunchDialog" />
          <q-btn label="Přidat zálohu" color="positive" @click="openAdvanceDialog" />
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
        <q-card style="min-width: 400px">
          <q-card-section>
            <div class="text-h6">Upravit / Duplikovat záznam</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <q-select v-model="editForm.workerId" :options="workerOptions" label="Pracovník" outlined class="q-mb-md" />
            <q-select v-model="editForm.contractId" :options="contractOptions" label="Zakázka" emit-value map-options outlined class="q-mb-md" />
            <q-select v-model="editForm.jobId" :options="jobOptions" label="Práce" emit-value map-options outlined class="q-mb-md" />
            <div class="row q-gutter-sm q-mb-md">
              <div class="col">
                <q-input v-model="editForm.timeFr" label="Čas od" type="datetime-local" outlined dense
                  :model-value="new Date(editForm.timeFr).toISOString().slice(0,16)"
                  @update:model-value="editForm.timeFr = new Date($event).getTime()"
                />
              </div>
              <div class="col">
                <q-input v-model="editForm.timeTo" label="Čas do" type="datetime-local" outlined dense
                  :model-value="new Date(editForm.timeTo).toISOString().slice(0,16)"
                  @update:model-value="editForm.timeTo = new Date($event).getTime()"
                />
              </div>
            </div>
            <div v-if="selectedContractKm > 0 || editForm.kmManual" class="q-mb-md">
              <q-separator class="q-mb-sm"/>
              <div class="text-subtitle2">🚗 Kilometry</div>
              <div class="text-caption text-grey-7 q-mt-xs">Zakázka: {{ selectedContractKm }} km jedna cesta</div>
              <q-checkbox v-model="editForm.kmRoundTrip" label="Tam a zpět (×2)" dense class="q-mt-sm"/>
              <div class="text-bold text-primary q-mt-xs">Celkem: {{ calculatedKmEdit }} km</div>
              <q-checkbox v-model="editForm.kmManual" label="Ručně" dense class="q-mt-sm"/>
              <q-input v-if="editForm.kmManual" v-model.number="editForm.kmJednosmer" label="Km (jedna cesta)" type="number" outlined dense class="q-mt-sm"/>
            </div>
            <q-input v-model="editForm.note" label="Poznámka" outlined type="textarea" rows="2"/>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Storno" color="red" v-close-popup/>
            <q-btn flat label="Uložit" color="green" @click="saveEdit" :loading="loading"/>
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- OBĚD DIALOG -->
      <q-dialog v-model="lunchDialog">
        <q-card style="width: 400px">
          <q-card-section>
            <div class="text-h6">Přidat oběd (zapomněl)</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <q-select v-model="newLunch.workerId" :options="workerOptions" label="Pracovník" outlined filled />
            <q-input v-model="newLunch.date" label="Datum" outlined class="q-mt-sm">
              <template v-slot:append>
                <q-icon name="event">
                  <q-popup-proxy>
                    <q-date v-model="newLunch.date" mask="DD. MM. YYYY" locale="cs" />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            <q-input v-model="newLunch.time" label="Čas (HH:MM)" mask="time" outlined class="q-mt-sm" />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Storno" color="red" v-close-popup />
            <q-btn flat label="Uložit" color="green" @click="saveLunch" />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- ZÁLOHA DIALOG -->
      <q-dialog v-model="advanceDialog">
        <q-card style="width: 400px">
          <q-card-section>
            <div class="text-h6">Přidat zálohu</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <q-select v-model="newAdvance.workerId" :options="workerOptions" label="Pracovník" outlined filled />
            <q-input v-model="newAdvance.date" label="Datum" outlined class="q-mt-sm">
              <template v-slot:append>
                <q-icon name="event">
                  <q-popup-proxy>
                    <q-date v-model="newAdvance.date" mask="DD. MM. YYYY" locale="cs" />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            <q-input v-model.number="newAdvance.amount" label="Částka (Kč)" type="number" outlined class="q-mt-sm" />
            <q-input v-model="newAdvance.reason" label="Důvod" outlined class="q-mt-sm" />
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
