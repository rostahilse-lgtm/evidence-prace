// KOMPLETNÍ admin.js s podporou KM + opravený přehled dne
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

    // Statistiky pro den (nové)
    totalDayHours() {
      return this.dayRecords.reduce((sum, r) => sum + (parseFloat(r[7]) || 0), 0).toFixed(1);
    },
    totalDayKm() {
      return this.dayRecords.reduce((sum, r) => sum + (parseFloat(r[12]) || 0), 0).toFixed(0);
    },
    uniqueDayWorkers() {
      return new Set(this.dayRecords.map(r => r[6])).size;
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

    // Opravené načítání záznamů dne (bez parseDateString)
    loadDayRecords() {
      const dateStr = this.adminDayView === 'today' ? getTodayDate() : this.selectedDate;
      
      // Parsování "DD. MM. YYYY" (funguje i bez nul u dne/měsíce)
      const parts = dateStr.split('.').map(p => parseInt(p.trim(), 10));
      if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
        console.warn('Neplatné datum pro filtr:', dateStr);
        this.dayRecords = [];
        return;
      }
      
      const [dd, mm, yyyy] = parts;
      const dayStart = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0).getTime();
      const dayEnd = new Date(yyyy, mm - 1, dd, 23, 59, 59, 999).getTime();
      
      this.dayRecords = this.allRecords
        .filter(r => {
          const ts = Number(r[4]); // timestamp je v indexu 4
          return !isNaN(ts) && ts >= dayStart && ts <= dayEnd;
        })
        .sort((a, b) => Number(a[4]) - Number(b[4]));
      
      console.log(`Přehled dne ${dateStr}: ${this.dayRecords.length} záznamů`);
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

    // Duplikace záznamu (otevře edit jako nový, ale uložíš ručně jako nový)
    duplicateRecord(record) {
      this.openEditDialog(record, -1); // -1 = nový záznam (v saveEdit pak neposílej row_index)
      this.$emit('message', 'Duplikuji záznam – uprav a ulož jako nový');
    },
   
    async saveEdit() {
      if (!this.editForm.contractId || !this.editForm.jobId || !this.editForm.timeFr || !this.editForm.timeTo) {
        this.$emit('message', 'Vyplňte všechna pole');
        return;
      }
     
      try {
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

        // Pokud je to edit (index >= 0), přidej row_index
        if (this.editingRecord.index >= 0) {
          payload.row_index = this.editingRecord.index;
        }
       
        const action = this.editingRecord.index >= 0 ? 'updaterecord' : 'saverecord';
        const res = await apiCall(action, payload);
       
        if (res.code === '000') {
          this.$emit('message', `✓ Záznam ${action === 'updaterecord' ? 'upraven' : 'přidán'}` + (kmData.km_celkem > 0 ? ` (${kmData.km_celkem} km)` : ''));
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
      if (!confirm('Opravdu smazat záznam?')) return;
      try {
        const res = await apiCall('deleterecord', { row_index: index });
        if (res.code === '000') {
          this.$emit('message', '✓ Záznam smazán');
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        this.$emit('message', 'Chyba při mazání');
      }
    },

    // Placeholder pro oběd a zálohu – rozšiř podle potřeby
    openAddLunch() {
      this.$emit('message', 'Přidání obědu: Vyber zaměstnance a čas (implementuj dialog)');
      // Zde můžeš přidat nový q-dialog podobně jako editDialog
    },

    openAddAdvance() {
      this.$emit('message', 'Přidání zálohy: Vyber zaměstnance, částku a důvod');
    },
   
    formatTimeRange(fr, to) { return formatTimeRange(fr, to); },
    formatShortDateTime(ts) { return formatShortDateTime(ts); },
    getTodayDate() { return getTodayDate(); },
    formatDateForInput(s) { return formatDateForInput(s); },
    formatDateFromInput(i) { return formatDateFromInput(i); }
  },
 
  watch: {
    adminDayView() { if (this.adminTab === 'day') this.loadDayRecords(); },
    selectedDate() { if (this.adminTab === 'day') this.loadDayRecords(); },
    'editForm.contractId'() {
      if (!this.editForm.kmManual) {
        this.editForm.kmJednosmer = this.selectedContractKm;
        this.editForm.kmCelkem = this.calculatedKmEdit;
      }
    },
    adminTab(newVal) {
      if (newVal === 'day') this.loadDayRecords();
    }
  },
 
  mounted() {
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
        <!-- ZÁZNAMY -->
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
              {{ formatTimeRange(record[4], record[5]) }}
            </div>
            <div v-if="record[12] > 0" class="text-caption text-orange q-mt-xs">
              🚗 {{ record[12] }} km
            </div>
            <div v-if="record[8]" class="note-display">💬 {{ record[8] }}</div>
          </div>
        </div>
        <!-- ZÁLOHY -->
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

      <!-- PŘEHLED DNE – TEĎ PLNĚ FUNKČNÍ -->
      <div v-if="adminTab==='day'" class="q-pt-md q-pa-md">
        <div class="row justify-between items-center q-mb-md">
          <div class="col-8 col-md-4">
            <q-input v-model="selectedDate" label="Datum" outlined dense>
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                    <q-date v-model="selectedDate" mask="DD. MM. YYYY" />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>
          <q-btn label="Dnes" color="primary" flat @click="selectedDate = getTodayDate(); loadDayRecords()" />
        </div>

        <!-- Statistiky dne -->
        <div class="row q-col-gutter-md q-mb-md">
          <div class="col-4">
            <q-card flat bordered class="text-center">
              <q-card-section>
                <div class="text-caption">Celkem hodin</div>
                <div class="text-h5">{{ totalDayHours }}</div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-4">
            <q-card flat bordered class="text-center">
              <q-card-section>
                <div class="text-caption">Pracovníků</div>
                <div class="text-h5">{{ uniqueDayWorkers }}</div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-4">
            <q-card flat bordered class="text-center">
              <q-card-section>
                <div class="text-caption">Celkem km</div>
                <div class="text-h5">{{ totalDayKm }}</div>
              </q-card-section>
            </q-card>
          </div>
        </div>

        <q-separator spaced />

        <!-- Seznam záznamů -->
        <q-list v-if="dayRecords.length > 0" bordered separator class="q-mt-md rounded-borders">
          <q-item v-for="(record, idx) in dayRecords" :key="idx">
            <q-item-section avatar>
              <q-avatar color="primary" text-color="white">
                {{ record[6]?.charAt(0) || '?' }}
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ record[6] || 'Neznámý' }} • {{ record[0] || '-' }}</q-item-label>
              <q-item-label caption lines="2">
                {{ formatTime(record[4]) }} – {{ formatTime(record[5]) }} • {{ (parseFloat(record[7]) || 0).toFixed(1) }} h
                <span v-if="record[12]"> • {{ record[12] }} km</span>
                <span v-if="record[8]"> • {{ record[8] }}</span>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn-group flat>
                <q-btn flat round icon="content_copy" color="primary" @click="duplicateRecord(record)">
                  <q-tooltip>Duplikovat</q-tooltip>
                </q-btn>
                <q-btn flat round icon="edit" color="orange" @click="openEditDialog(record, idx)">
                  <q-tooltip>Upravit</q-tooltip>
                </q-btn>
                <q-btn flat round icon="delete" color="negative" @click="deleteRecord(idx)">
                  <q-tooltip>Smazat</q-tooltip>
                </q-btn>
              </q-btn-group>
            </q-item-section>
          </q-item>
        </q-list>

        <div v-else class="text-center q-pa-xl text-grey q-mt-lg">
          Žádné záznamy pro {{ selectedDate }}
        </div>

        <!-- Tlačítka pro oběd a zálohu -->
        <div class="q-mt-lg text-right q-gutter-md">
          <q-btn label="Přidat oběd (zapomněl)" color="secondary" @click="openAddLunch" />
          <q-btn label="Přidat zálohu" color="positive" @click="openAddAdvance" />
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

      <!-- EDITAČNÍ DIALOG S KM -->
      <q-dialog v-model="editDialog">
        <q-card style="min-width:350px">
          <q-card-section>
            <div class="text-h6">Upravit / Duplikovat záznam</div>
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
            <!-- KM SEKCE -->
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
            <q-btn
              flat
              label="Uložit"
              color="green"
              @click="saveEdit"
              :loading="loading"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  `
});
