// js/components/admin/admin.js - KOMPLETNÍ VERZE SE VŠEMI FUNKCEMI

window.app.component('admin-component', {
  props: ['allSummary', 'allRecords', 'allAdvances', 'contracts', 'jobs', 'loading'],
  emits: ['message', 'reload'],
  
  data() {
    return {
      adminTab: 'workers',
      selectedWorkerData: null,
      summaryTab: 'records',
      
      // Přehled dne
      selectedDate: getTodayDate(),
      adminDayView: 'today',
      workers: [],
      
      // Dialogy pro přehled dne
      showAddShiftDialog: false,
      showAddLunchDialog: false,
      showAddAdvanceDialog: false,
      showDuplicateDialog: false,
      
      // Formuláře
      newShift: {
        workerId: null,
        contractId: null,
        jobId: null,
        timeStart: null,
        timeEnd: null,
        note: '',
        kmManual: false,
        kmValue: null,
        kmRoundTrip: true,
        customDate: null,
        customTimeStart: '',
        customTimeEnd: ''
      },
      duplicateShift: null,
      newLunch: {
        workerId: null
      },
      newAdvance: {
        workerId: null,
        amount: null,
        reason: ''
      },
      
      // Editace
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
    workerOptions() {
      return this.workers.map(w => ({ label: w[1], value: w[0] }));
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
    newShiftContractKm() {
      if (!this.newShift.contractId) return 0;
      const contract = this.contracts.find(c => c[0] === this.newShift.contractId);
      return contract ? (contract[3] || 0) : 0;
    },
    calculatedKmNewShift() {
      if (this.newShift.kmManual && this.newShift.kmValue) {
        return this.newShift.kmRoundTrip ? this.newShift.kmValue * 2 : this.newShift.kmValue;
      }
      if (this.newShiftContractKm > 0) {
        return this.newShift.kmRoundTrip ? this.newShiftContractKm * 2 : this.newShiftContractKm;
      }
      return 0;
    },
    
    // PŘEHLED DNE
    dayRecords() {
      if (!this.selectedDate || !this.allRecords) return [];
      const targetDate = parseDateString(this.selectedDate);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      return this.allRecords.filter(r => {
        const recordDate = new Date(r[6]); // time_fr
        return recordDate >= targetDate && recordDate < nextDay;
      }).sort((a, b) => a[6] - b[6]);
    },
    
    dayStats() {
      return {
        totalHours: this.dayRecords.reduce((s, r) => s + (r[7] || 0), 0).toFixed(2),
        totalKm: this.dayRecords.reduce((s, r) => s + (r[11] || 0), 0),
        uniqueWorkers: new Set(this.dayRecords.map(r => r[1])).size
      };
    }
  },
  
  methods: {
    // WORKER DETAIL
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
    
    // NAČTENÍ PRACOVNÍKŮ
    async loadWorkers() {
      const res = await apiCall('get', { type: 'workers' });
      if (res.code === '000' && res.data) {
        this.workers = res.data;
      }
    },
    
    // PŘEHLED DNE
    setDateToday() {
      this.selectedDate = getTodayDate();
      this.adminDayView = 'today';
    },
    
    // PŘIDÁNÍ NOVÉ SMĚNY
    openAddShiftDialog() {
      this.newShift = {
        workerId: null,
        contractId: null,
        jobId: null,
        timeStart: null,
        timeEnd: null,
        note: '',
        kmManual: false,
        kmValue: null,
        kmRoundTrip: true,
        customDate: this.selectedDate,
        customTimeStart: '',
        customTimeEnd: ''
      };
      this.showAddShiftDialog = true;
    },
    
    // DUPLIKACE SMĚNY
    openDuplicateDialog(record) {
      const worker = this.workers.find(w => w[1] === record[1]);
      const contract = this.contracts.find(c => c[1] === record[3]);
      const job = this.jobs.find(j => j[1] === record[5]);
      
      this.newShift = {
        workerId: worker ? worker[0] : null,
        contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null,
        timeStart: null,
        timeEnd: null,
        note: record[8] || '',
        kmManual: record[12] === 'Y',
        kmValue: parseFloat(record[10]) || null,
        kmRoundTrip: true,
        customDate: this.selectedDate,
        customTimeStart: '',
        customTimeEnd: ''
      };
      
      this.showDuplicateDialog = true;
    },
    
    setCurrentTime(field) {
      if (field === 'start') {
        this.newShift.timeStart = Date.now();
        this.newShift.customDate = null;
        this.newShift.customTimeStart = '';
      } else {
        this.newShift.timeEnd = Date.now();
        this.newShift.customTimeEnd = '';
      }
    },
    
    applyCustomDateTime() {
      if (!this.newShift.customDate || !this.newShift.customTimeStart) return;
      
      const dateParts = this.newShift.customDate.split('. ');
      const timeParts = this.newShift.customTimeStart.split(':');
      const date = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1]);
      this.newShift.timeStart = date.getTime();
      
      if (this.newShift.customTimeEnd) {
        const timeEndParts = this.newShift.customTimeEnd.split(':');
        const dateEnd = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeEndParts[0], timeEndParts[1]);
        this.newShift.timeEnd = dateEnd.getTime();
      }
    },
    
    async saveNewShift() {
      if (this.newShift.customDate && this.newShift.customTimeStart) {
        this.applyCustomDateTime();
      }
      
      if (!this.newShift.workerId || !this.newShift.contractId || !this.newShift.jobId || 
          !this.newShift.timeStart || !this.newShift.timeEnd) {
        this.$emit('message', 'Vyplňte všechna povinná pole');
        return;
      }
      if (!this.newShift.note || this.newShift.note.trim() === '') {
        this.$emit('message', 'Poznámka je povinná');
        return;
      }
      
      try {
        const payload = {
          id_contract: this.newShift.contractId,
          id_worker: this.newShift.workerId,
          id_job: this.newShift.jobId,
          time_fr: this.newShift.timeStart,
          time_to: this.newShift.timeEnd,
          note: this.newShift.note
        };
        
        if (this.calculatedKmNewShift > 0) {
          payload.km_jednosmer = this.newShift.kmManual ? (this.newShift.kmValue || 0) : this.newShiftContractKm;
          payload.km_celkem = this.calculatedKmNewShift;
          payload.km_rucne = this.newShift.kmManual ? 'Y' : 'N';
        }
        
        const res = await apiCall('saverecord', payload);
        
        if (res.code === '000') {
          const kmText = this.calculatedKmNewShift > 0 ? ` (${this.calculatedKmNewShift} km)` : '';
          this.$emit('message', `✓ Směna uložena${kmText}`);
          this.showAddShiftDialog = false;
          this.showDuplicateDialog = false;
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        console.error('Save shift error:', error);
        this.$emit('message', 'Chyba při ukládání směny');
      }
    },
    
    // PŘIDÁNÍ OBĚDA
    openAddLunchDialog() {
      this.newLunch = { workerId: null };
      this.showAddLunchDialog = true;
    },
    
    async saveNewLunch() {
      if (!this.newLunch.workerId) {
        this.$emit('message', 'Vyberte pracovníka');
        return;
      }
      
      try {
        const worker = this.workers.find(w => w[0] === this.newLunch.workerId);
        const res = await apiCall('savelunch', {
          id_worker: this.newLunch.workerId,
          name_worker: worker[1],
          time: Date.now()
        });
        
        if (res.code === '000') {
          this.$emit('message', '✓ Oběd uložen');
          this.showAddLunchDialog = false;
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        console.error('Save lunch error:', error);
        this.$emit('message', 'Chyba při ukládání oběda');
      }
    },
    
    // PŘIDÁNÍ ZÁLOHY
    openAddAdvanceDialog() {
      this.newAdvance = { workerId: null, amount: null, reason: '' };
      this.showAddAdvanceDialog = true;
    },
    
    async saveNewAdvance() {
      if (!this.newAdvance.workerId || !this.newAdvance.amount || !this.newAdvance.reason) {
        this.$emit('message', 'Vyplňte všechna pole');
        return;
      }
      
      try {
        const worker = this.workers.find(w => w[0] === this.newAdvance.workerId);
        const res = await apiCall('saveadvance', {
          id_worker: this.newAdvance.workerId,
          name_worker: worker[1],
          time: Date.now(),
          payment: this.newAdvance.amount,
          payment_reason: this.newAdvance.reason
        });
        
        if (res.code === '000') {
          this.$emit('message', '✓ Záloha uložena');
          this.showAddAdvanceDialog = false;
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        console.error('Save advance error:', error);
        this.$emit('message', 'Chyba při ukládání zálohy');
      }
    },
    
    // EDITACE
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
        timeFr: record[6],
        timeTo: record[7],
        note: record[8],
        kmJednosmer: kmJednosmer,
        kmCelkem: kmCelkem,
        kmRucne: kmRucne,
        kmManual: kmRucne === 'Y',
        kmRoundTrip: kmCelkem === (kmJednosmer * 2)
      };
      this.editDialog = true;
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
        
        const res = await apiCall('updaterecord', {
          row_index: this.editingRecord.index,
          id_contract: this.editForm.contractId,
          id_job: this.editForm.jobId,
          time_fr: this.editForm.timeFr,
          time_to: this.editForm.timeTo,
          note: this.editForm.note,
          ...kmData
        });
        
        if (res.code === '000') {
          this.$emit('message', '✓ Záznam upraven' + (kmData.km_celkem > 0 ? ` (${kmData.km_celkem} km)` : ''));
          this.editDialog = false;
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        this.$emit('message', 'Chyba při úpravě');
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
    
    formatTimeRange(fr, to) { return formatTimeRange(fr, to); },
    formatShortDateTime(ts) { return formatShortDateTime(ts); },
    getTodayDate() { return getTodayDate(); },
    formatDateForInput(s) { return formatDateForInput(s); },
    formatDateFromInput(i) { return formatDateFromInput(i); }
  },
  
  watch: {
    'editForm.contractId'() {
      if (!this.editForm.kmManual) {
        this.editForm.kmJednosmer = this.selectedContractKm;
        this.editForm.kmCelkem = this.calculatedKmEdit;
      }
    }
  },
  
  async mounted() {
    await this.loadWorkers();
  },
  
  template: `
    <div>
      <q-tabs v-model="adminTab" dense align="justify" class="text-primary">
        <q-tab name="workers" label="Pracovníci"/>
        <q-tab name="day" label="Přehled dne"/>
      </q-tabs>

      <!-- ========== PRACOVNÍCI ========== -->
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

      <!-- ========== DETAIL PRACOVNÍKA ========== -->
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
                <div class="text-bold">{{ record[3] }}</div>
                <div class="text-caption text-grey-7">{{ record[5] }}</div>
              </div>
              <div class="text-right">
                <div class="text-bold text-primary">{{ record[7].toFixed(2) }} hod</div>
                <div class="text-caption">{{ record[2] }} Kč/hod</div>
              </div>
              <q-icon name="edit" class="edit-icon q-ml-sm" @click="openEditDialog(record,idx)"/>
            </div>
            <div class="text-caption text-grey-7 q-mt-sm">
              {{ formatTimeRange(record[6],record[7]) }}
            </div>
            <div v-if="record[11] > 0" class="text-caption text-orange q-mt-xs">
              🚗 {{ record[11] }} km
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

      <!-- ========== PŘEHLED DNE ========== -->
      <div v-if="adminTab==='day'" class="q-pt-md">
        <div class="row q-mb-md items-center">
          <div class="col">
            <div class="row q-gutter-sm">
              <q-btn 
                :color="adminDayView==='today'?'primary':'grey-5'" 
                label="Dnes" 
                @click="setDateToday()" 
                unelevated
                size="sm"
              />
              <q-btn 
                :color="adminDayView==='date'?'primary':'grey-5'" 
                label="Datum" 
                @click="adminDayView='date'" 
                unelevated
                size="sm"
              />
            </div>
          </div>
          <div class="col-auto">
            <q-btn-dropdown color="primary" label="Přidat" icon="add" unelevated>
              <q-list>
                <q-item clickable v-close-popup @click="openAddShiftDialog">
                  <q-item-section avatar>
                    <q-icon name="work" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>Nová směna</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="openAddLunchDialog">
                  <q-item-section avatar>
                    <q-icon name="restaurant" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>Nový oběd</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="openAddAdvanceDialog">
                  <q-item-section avatar>
                    <q-icon name="payment" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>Nová záloha</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-btn-dropdown>
          </div>
        </div>

        <div v-if="adminDayView==='date'" class="q-mb-md">
          <q-input 
            v-model="selectedDate" 
            label="Vyberte datum" 
            outlined
            readonly
          >
            <template v-slot:append>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date 
                    v-model="selectedDate" 
                    mask="DD. MM. YYYY"
                    @update:model-value="adminDayView='date'"
                  >
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="OK" color="primary" flat />
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
        </div>

        <div class="row q-gutter-sm q-mb-md">
          <q-card class="col" flat bordered>
            <q-card-section class="text-center">
              <div class="text-caption text-grey-7">Celkem hodin</div>
              <div class="text-h5 text-primary">{{ dayStats.totalHours }}</div>
            </q-card-section>
          </q-card>
          
          <q-card class="col" flat bordered>
            <q-card-section class="text-center">
              <div class="text-caption text-grey-7">Pracovníků</div>
              <div class="text-h5 text-green">{{ dayStats.uniqueWorkers }}</div>
            </q-card-section>
          </q-card>
          
          <q-card class="col" flat bordered>
            <q-card-section class="text-center">
              <div class="text-caption text-grey-7">Celkem km</div>
              <div class="text-h5 text-orange">{{ dayStats.totalKm }}</div>
            </q-card-section>
          </q-card>
        </div>

        <div class="text-h6 q-mb-md">
          📅 {{ selectedDate }}
        </div>

        <div v-if="dayRecords.length===0" class="text-center text-grey-7 q-mt-lg q-pa-xl">
          <q-icon name="inbox" size="4rem" color="grey-4"/>
          <div class="q-mt-md">Žádné záznamy pro tento den</div>
        </div>

        <div v-for="(record,idx) in dayRecords" :key="idx" class="record-card">
          <div class="row items-center">
            <div class="col">
              <div class="text-bold">{{ record[1] }}</div>
              <div class="text-caption">{{ record[3] }} • {{ record[5] }}</div>
            </div>
            <div class="text-right">
              <div class="text-bold text-primary">{{ record[7].toFixed(2) }} hod</div>
            </div>
            <q-btn flat dense round icon="content_copy" size="sm" class="q-ml-xs" @click="openDuplicateDialog(record)">
              <q-tooltip>Duplikovat směnu</q-tooltip>
            </q-btn>
            <q-icon name="edit" class="edit-icon q-ml-xs" @click="openEditDialog(record,idx)"/>
          </div>
          <div class="text-caption text-grey-7 q-mt-sm">
            {{ formatTimeRange(record[6],record[7]) }}
          </div>
          <div v-if="record[11] > 0" class="text-caption text-orange q-mt-xs">
            🚗 {{ record[11] }} km
          </div>
          <div v-if="record[8]" class="note-display">💬 {{ record[8] }}</div>
        </div>
      </div>

      <!-- ========== DIALOG - NOVÁ SMĚNA ========== -->
      <q-dialog v-model="showAddShiftDialog">
        <q-card style="min-width: 400px; max-width: 500px">
          <q-card-section>
            <div class="text-h6">➕ Nová směna</div>
          </q-card-section>
          
          <q-card-section class="q-pt-none" style="max-height: 60vh; overflow-y: auto">
            <q-select v-model="newShift.workerId" :options="workerOptions" 
              label="Pracovník *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-select v-model="newShift.contractId" :options="contractOptions" 
              label="Zakázka *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-select v-model="newShift.jobId" :options="jobOptions" 
              label="Práce *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <div class="text-subtitle2 q-mb-sm">⏰ Čas</div>
            
            <q-input v-model="newShift.customDate" label="Datum" outlined dense readonly class="q-mb-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy>
                    <q-date v-model="newShift.customDate" mask="DD. MM. YYYY">
                      <div class="row items-center justify-end">
                        <q-btn v-close-popup label="OK" color="primary" flat />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            
            <div class="row q-gutter-sm q-mb-sm">
              <div class="col">
                <q-input v-model="newShift.customTimeStart" label="Čas od (HH:MM)" 
                  outlined dense placeholder="08:00" mask="##:##"/>
              </div>
              <div class="col">
                <q-input v-model="newShift.customTimeEnd" label="Čas do (HH:MM)" 
                  outlined dense placeholder="16:00" mask="##:##"/>
              </div>
            </div>
            
            <div class="text-center q-mb-sm">
              <q-btn dense flat label="Nebo nastavit aktuální čas" size="sm" 
                @click="setCurrentTime('start'); setCurrentTime('end')"/>
            </div>
            
            <q-input v-model="newShift.note" label="Poznámka *" outlined dense 
              type="textarea" rows="2" class="q-mb-sm"/>
            
            <q-separator class="q-my-sm"/>
            
            <q-checkbox v-model="newShift.kmManual" label="🚗 Přidat km" dense class="q-mb-sm"/>
            
            <div v-if="newShift.kmManual || newShiftContractKm > 0">
              <div v-if="!newShift.kmManual" class="text-caption text-grey-7 q-mb-xs">
                Zakázka má: {{ newShiftContractKm }} km jedna cesta
              </div>
              
              <q-input v-if="newShift.kmManual" v-model.number="newShift.kmValue" 
                label="Km jednosměr" type="number" outlined dense class="q-mb-sm"/>
              
              <q-checkbox v-model="newShift.kmRoundTrip" label="Tam a zpět (×2)" dense class="q-mb-xs"/>
              
              <div class="text-bold text-primary">
                Celkem: {{ calculatedKmNewShift }} km ({{ calculatedKmNewShift * 4 }} Kč)
              </div>
            </div>
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup />
            <q-btn label="Uložit" color="primary" @click="saveNewShift" :loading="loading" />
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- ========== DIALOG - DUPLIKOVAT SMĚNU ========== -->
      <q-dialog v-model="showDuplicateDialog">
        <q-card style="min-width: 400px; max-width: 500px">
          <q-card-section>
            <div class="text-h6">📋 Duplikovat směnu</div>
          </q-card-section>
          
          <q-card-section class="q-pt-none" style="max-height: 60vh; overflow-y: auto">
            <q-select v-model="newShift.workerId" :options="workerOptions" 
              label="Pracovník *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-select v-model="newShift.contractId" :options="contractOptions" 
              label="Zakázka *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-select v-model="newShift.jobId" :options="jobOptions" 
              label="Práce *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <div class="text-subtitle2 q-mb-sm">⏰ Čas</div>
            
            <q-input v-model="newShift.customDate" label="Datum" outlined dense readonly class="q-mb-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy>
                    <q-date v-model="newShift.customDate" mask="DD. MM. YYYY">
                      <div class="row items-center justify-end">
                        <q-btn v-close-popup label="OK" color="primary" flat />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            
            <div class="row q-gutter-sm q-mb-sm">
              <div class="col">
                <q-input v-model="newShift.customTimeStart" label="Čas od (HH:MM)" 
                  outlined dense placeholder="08:00" mask="##:##"/>
              </div>
              <div class="col">
                <q-input v-model="newShift.customTimeEnd" label="Čas do (HH:MM)" 
                  outlined dense placeholder="16:00" mask="##:##"/>
              </div>
            </div>
            
            <q-input v-model="newShift.note" label="Poznámka *" outlined dense 
              type="textarea" rows="2" class="q-mb-sm"/>
            
            <q-separator class="q-my-sm"/>
            
            <q-checkbox v-model="newShift.kmManual" label="🚗 Přidat km" dense class="q-mb-sm"/>
            
            <div v-if="newShift.kmManual || newShiftContractKm > 0">
              <div v-if="!newShift.kmManual" class="text-caption text-grey-7 q-mb-xs">
                Zakázka má: {{ newShiftContractKm }} km jedna cesta
              </div>
              
              <q-input v-if="newShift.kmManual" v-model.number="newShift.kmValue" 
                label="Km jednosměr" type="number" outlined dense class="q-mb-sm"/>
              
              <q-checkbox v-model="newShift.kmRoundTrip" label="Tam a zpět (×2)" dense class="q-mb-xs"/>
              
              <div class="text-bold text-primary">
                Celkem: {{ calculatedKmNewShift }} km
              </div>
            </div>
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup />
            <q-btn label="Uložit kopii" color="primary" @click="saveNewShift" :loading="loading" />
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- ========== DIALOG - NOVÝ OBĚD ========== -->
      <q-dialog v-model="showAddLunchDialog">
        <q-card style="min-width: 350px">
          <q-card-section>
            <div class="text-h6">🍴 Nový oběd</div>
          </q-card-section>
          
          <q-card-section class="q-pt-none">
            <q-select v-model="newLunch.workerId" :options="workerOptions" 
              label="Pracovník *" emit-value map-options outlined dense/>
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup />
            <q-btn label="Uložit" color="primary" @click="saveNewLunch" :loading="loading" />
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- ========== DIALOG - NOVÁ ZÁLOHA ========== -->
      <q-dialog v-model="showAddAdvanceDialog">
        <q-card style="min-width: 350px">
          <q-card-section>
            <div class="text-h6">💰 Nová záloha</div>
          </q-card-section>
          
          <q-card-section class="q-pt-none">
            <q-select v-model="newAdvance.workerId" :options="workerOptions" 
              label="Pracovník *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-input v-model.number="newAdvance.amount" label="Částka (Kč) *" 
              type="number" outlined dense class="q-mb-sm"/>
            
            <q-input v-model="newAdvance.reason" label="Důvod *" 
              outlined dense type="textarea" rows="2"/>
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup />
            <q-btn label="Uložit" color="primary" @click="saveNewAdvance" :loading="loading" />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- ========== EDITAČNÍ DIALOG ========== -->
      <q-dialog v-model="editDialog">
        <q-card style="min-width:350px">
          <q-card-section>
            <div class="text-h6">✏️ Upravit záznam</div>
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
                  @update:model-value="editForm.timeFr=new Date($event).getTime()"
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
                  @update:model-value="editForm.timeTo=new Date($event).getTime()"
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
