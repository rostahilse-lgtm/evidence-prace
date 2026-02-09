// KOMPLETNÍ admin.js - FINÁLNÍ OPRAVENÁ VERZE

window.app.component('admin-component', {
  props: ['allSummary', 'allRecords', 'allAdvances', 'contracts', 'jobs', 'places', 'loading'],
  emits: ['message', 'reload'],
  
  data() {
    return {
      adminTab: 'workers',
      selectedWorkerData: null,
      summaryTab: 'records',
      dayRecords: [],
      workers: [],
      adminDayView: 'today',
      selectedDate: null,
      editDialog: false,
      duplicateDialog: false,
      lunchDialog: false,
      advanceDialog: false,
      editingRecord: null,
      editForm: { 
        contractId: null, 
        jobId: null,
        placeId: null,
        timeFr: null, 
        timeTo: null, 
        note: '',
        kmJednosmer: 0,
        kmCelkem: 0,
        kmRucne: 'N',
        kmManual: false,
        kmRoundTrip: true
      },
      originalRecord: null,
      newLunch: {
        workerId: null,
        date: null,
        time: null
      },
      newAdvance: {
        workerId: null,
        amount: null,
        reason: '',
        date: null
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
    placeOptions() {
      return this.places ? this.places.map(p => ({ label: p[1], value: p[0] })) : [];
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
    }
  },
  
  methods: {
    getTodayDate() {
      const d = new Date();
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}. ${month}. ${year}`;
    },
    
    getCurrentTime() {
      const now = new Date();
      return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    },
    
    formatShortDateTime(ts) {
      const d = new Date(ts);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}. ${month}. ${hours}:${minutes}`;
    },
    
    async loadWorkers() {
      const res = await apiCall('get', { type: 'workers' });
      if (res.code === '000' && res.data) {
        this.workers = res.data;
      }
    },
    
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
    
    async loadDayRecords() {
      const date = this.adminDayView === 'today' ? this.getTodayDate() : this.selectedDate;
      const parts = date.split('. ');
      const targetDate = new Date(parts[2], parts[1] - 1, parts[0]);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      this.dayRecords = this.allRecords.filter(r => {
        const recordDate = new Date(r[4]);
        return recordDate >= targetDate && recordDate < nextDay;
      });
    },
    
    openEditDialog(record, index) {
      this.editingRecord = { data: record, index: index };
      
      // PŮVODNÍ HODNOTY (pro levý sloupec)
      this.originalRecord = {
        worker: record[6],
        contract: record[0],
        job: record[3],
        place: record[14] || 'Nezadáno',
        timeFrom: formatTime(record[4]),
        timeTo: formatTime(record[5]),
        note: record[8] || '',
        km: record[12] || 0
      };
      
      // EDITOVATELNÉ HODNOTY (pro pravý sloupec)
      const worker = this.workers.find(w => w[1] === record[6]);
      const contract = this.contracts.find(c => c[1] === record[0]);
      const job = this.jobs.find(j => j[1] === record[3]);
      const place = this.places ? this.places.find(p => p[1] === record[14]) : null;
      
      const kmJednosmer = record[11] || 0;
      const kmCelkem = record[12] || 0;
      const kmRucne = record[13] || 'N';
      
      this.editForm = {
        workerId: worker ? worker[0] : null,
        contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null,
        placeId: place ? place[0] : null,
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
    
    openDuplicateDialog(record) {
      const worker = this.workers.find(w => w[1] === record[6]);
      const contract = this.contracts.find(c => c[1] === record[0]);
      const job = this.jobs.find(j => j[1] === record[3]);
      const place = this.places ? this.places.find(p => p[1] === record[14]) : null;
      
      this.editForm = {
        workerId: worker ? worker[0] : null,
        contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null,
        placeId: place ? place[0] : null,
        timeFr: record[4],
        timeTo: record[5],
        note: record[8] || '',
        kmJednosmer: parseFloat(record[11]) || 0,
        kmCelkem: parseFloat(record[12]) || 0,
        kmRucne: record[13] || 'N',
        kmManual: record[13] === 'Y',
        kmRoundTrip: true
      };
      
      this.duplicateDialog = true;
    },
    
    openLunchDialog() {
      this.newLunch = {
        workerId: null,
        date: this.adminDayView === 'today' ? this.getTodayDate() : this.selectedDate,
        time: this.getCurrentTime()
      };
      this.lunchDialog = true;
    },
    
    openAdvanceDialog() {
      this.newAdvance = {
        workerId: null,
        amount: null,
        reason: '',
        date: this.adminDayView === 'today' ? this.getTodayDate() : this.selectedDate
      };
      this.advanceDialog = true;
    },
    
    async saveEdit() {
      if (!this.editForm.contractId || !this.editForm.jobId || !this.editForm.placeId || !this.editForm.timeFr || !this.editForm.timeTo) {
        this.$emit('message', 'Vyplňte všechna pole');
        return;
      }
      
      try {
        const payload = {
          id_contract: this.editForm.contractId,
          id_worker: this.editForm.workerId,
          id_job: this.editForm.jobId,
          id_place: this.editForm.placeId,
          time_fr: this.editForm.timeFr,
          time_to: this.editForm.timeTo,
          note: this.editForm.note
        };
        
        if (this.editForm.kmManual && this.editForm.kmJednosmer) {
          payload.km_jednosmer = this.editForm.kmJednosmer;
          payload.km_celkem = this.calculatedKmEdit;
          payload.km_rucne = 'Y';
        }
        
        const res = await apiCall('saverecord', payload);
        
        if (res.code === '000') {
          this.$emit('message', '✓ Záznam upraven');
          this.editDialog = false;
          this.$emit('reload');
          this.loadDayRecords();
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        this.$emit('message', 'Chyba při úpravě');
      }
    },
    
    async saveDuplicate() {
      if (!this.editForm.workerId || !this.editForm.contractId || !this.editForm.jobId || !this.editForm.placeId || !this.editForm.timeFr || !this.editForm.timeTo) {
        this.$emit('message', 'Vyplňte všechna pole');
        return;
      }
      
      try {
        const payload = {
          id_contract: this.editForm.contractId,
          id_worker: this.editForm.workerId,
          id_job: this.editForm.jobId,
          id_place: this.editForm.placeId,
          time_fr: this.editForm.timeFr,
          time_to: this.editForm.timeTo,
          note: this.editForm.note
        };
        
        if (this.editForm.kmManual && this.editForm.kmJednosmer) {
          payload.km_jednosmer = this.editForm.kmJednosmer;
          payload.km_celkem = this.calculatedKmEdit;
          payload.km_rucne = 'Y';
        }
        
        const res = await apiCall('saverecord', payload);
        
        if (res.code === '000') {
          this.$emit('message', '✓ Kopie uložena');
          this.duplicateDialog = false;
          this.$emit('reload');
          this.loadDayRecords();
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        this.$emit('message', 'Chyba při ukládání');
      }
    },
    
    async saveLunch() {
      if (!this.newLunch.workerId) {
        this.$emit('message', 'Vyberte pracovníka');
        return;
      }
      
      const dateParts = this.newLunch.date.split('. ');
      const timeParts = this.newLunch.time.split(':');
      const timestamp = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1]).getTime();
      
      try {
        const worker = this.workers.find(w => w[0] === this.newLunch.workerId);
        const res = await apiCall('savelunch', {
          id_worker: this.newLunch.workerId,
          name_worker: worker[1],
          time: timestamp
        });
        
        if (res.code === '000') {
          this.$emit('message', '✓ Oběd uložen');
          this.lunchDialog = false;
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        this.$emit('message', 'Chyba při ukládání oběda');
      }
    },
    
    async saveAdvance() {
      if (!this.newAdvance.workerId || !this.newAdvance.amount || !this.newAdvance.reason) {
        this.$emit('message', 'Vyplňte všechna pole');
        return;
      }
      
      const dateParts = this.newAdvance.date.split('. ');
      const timestamp = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], 12, 0).getTime();
      
      try {
        const worker = this.workers.find(w => w[0] === this.newAdvance.workerId);
        const res = await apiCall('saveadvance', {
          id_worker: this.newAdvance.workerId,
          name_worker: worker[1],
          time: timestamp,
          payment: this.newAdvance.amount,
          payment_reason: this.newAdvance.reason
        });
        
        if (res.code === '000') {
          this.$emit('message', '✓ Záloha uložena');
          this.advanceDialog = false;
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        this.$emit('message', 'Chyba při ukládání zálohy');
      }
    },
    
    formatTimeRange(fr, to) { return formatTimeRange(fr, to); }
  },
  
  watch: {
    adminDayView() { 
      if (this.adminTab === 'day') this.loadDayRecords(); 
    },
    selectedDate() { 
      if (this.adminTab === 'day') this.loadDayRecords(); 
    },
    'editForm.contractId'() {
      if (!this.editForm.kmManual) {
        this.editForm.kmJednosmer = this.selectedContractKm;
        this.editForm.kmCelkem = this.calculatedKmEdit;
      }
    }
  },
  
  async mounted() {
    this.selectedDate = this.getTodayDate();
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
          <q-tab name="records" label="Směny"/>
          <q-tab name="advances" label="Zálohy"/>
        </q-tabs>

        <!-- SMĚNY -->
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

      <!-- PŘEHLED DNE -->
      <div v-if="adminTab==='day'" class="q-pt-md">
        <div class="row q-gutter-sm q-mb-md">
          <q-btn 
            :color="adminDayView==='today'?'primary':'grey-5'" 
            label="Dnes" 
            @click="adminDayView='today';loadDayRecords()" 
            class="col"
          />
          <q-btn 
            :color="adminDayView==='date'?'primary':'grey-5'" 
            label="Datum" 
            @click="adminDayView='date'" 
            class="col"
          />
        </div>

        <div v-if="adminDayView==='date'" class="q-mb-md">
          <q-input v-model="selectedDate" outlined dense label="Datum" readonly>
            <template v-slot:append>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date v-model="selectedDate" mask="DD. MM. YYYY" locale="cs" @update:model-value="loadDayRecords">
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="Zavřít" color="primary" flat />
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
        </div>

        <div class="text-h6 q-mb-md">
          {{ adminDayView==='today'?getTodayDate():selectedDate }}
        </div>
        
        <div class="row q-gutter-sm q-mb-md">
          <q-btn color="primary" label="Přidat oběd" icon="restaurant" dense @click="openLunchDialog"/>
          <q-btn color="primary" label="Přidat zálohu" icon="payment" dense @click="openAdvanceDialog"/>
        </div>

        <div v-if="dayRecords.length===0" class="text-center text-grey-7 q-mt-lg">
          Žádné záznamy pro tento den
        </div>

        <div v-for="(record,idx) in dayRecords" :key="idx" class="record-card">
          <div class="row items-center">
            <div class="col">
              <div class="text-bold">{{ record[6] }}</div>
              <div class="text-caption text-grey-7">Zakázka: {{ record[0] }} • Práce: {{ record[3] }}</div>
            </div>
            <div class="text-right">
              <div class="text-bold text-primary">{{ record[7].toFixed(2) }} hod</div>
            </div>
            <q-btn flat dense round icon="content_copy" size="sm" class="q-ml-xs" @click="openDuplicateDialog(record)">
              <q-tooltip>Duplikovat</q-tooltip>
            </q-btn>
            <q-btn flat dense round icon="edit" size="sm" class="q-ml-xs" @click="openEditDialog(record,idx)">
              <q-tooltip>Upravit</q-tooltip>
            </q-btn>
          </div>
          <div class="text-caption text-grey-7 q-mt-sm">
            {{ formatTimeRange(record[4],record[5]) }}
          </div>
          <div v-if="record[12] > 0" class="text-caption text-orange q-mt-xs">
            🚗 {{ record[12] }} km
          </div>
          <div v-if="record[8]" class="note-display">💬 {{ record[8] }}</div>
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

      <!-- DIALOG - ÚPRAVA (DVA SLOUPCE) -->
      <q-dialog v-model="editDialog">
        <q-card style="min-width:600px">
          <q-card-section>
            <div class="text-h6">Upravit záznam</div>
          </q-card-section>

          <q-card-section class="q-pt-none">
            <div class="row q-gutter-md">
              <!-- LEVÝ SLOUPEC - PŮVODNÍ HODNOTY (READONLY) -->
              <div class="col">
                <div class="text-subtitle2 q-mb-sm">Původní hodnoty:</div>
                
                <q-input v-model="originalRecord.worker" label="Pracovník" outlined dense readonly class="q-mb-sm"/>
                <q-input v-model="originalRecord.contract" label="Zakázka" outlined dense readonly class="q-mb-sm"/>
                <q-input v-model="originalRecord.job" label="Práce" outlined dense readonly class="q-mb-sm"/>
                <q-input v-model="originalRecord.place" label="Místo" outlined dense readonly class="q-mb-sm"/>
                <q-input v-model="originalRecord.timeFrom" label="Čas od" outlined dense readonly class="q-mb-sm"/>
                <q-input v-model="originalRecord.timeTo" label="Čas do" outlined dense readonly class="q-mb-sm"/>
                <q-input v-model="originalRecord.note" label="Poznámka" outlined dense readonly class="q-mb-sm"/>
                <q-input v-model="originalRecord.km" label="Km" outlined dense readonly/>
              </div>
              
              <!-- PRAVÝ SLOUPEC - EDITOVATELNÉ HODNOTY -->
              <div class="col">
                <div class="text-subtitle2 q-mb-sm">Nové hodnoty:</div>
                
                <q-select v-model="editForm.workerId" :options="workerOptions" label="Pracovník" emit-value map-options outlined dense class="q-mb-sm"/>
                <q-select v-model="editForm.contractId" :options="contractOptions" label="Zakázka" emit-value map-options outlined dense class="q-mb-sm"/>
                <q-select v-model="editForm.jobId" :options="jobOptions" label="Práce" emit-value map-options outlined dense class="q-mb-sm"/>
                <q-select v-model="editForm.placeId" :options="placeOptions" label="Místo práce" emit-value map-options outlined dense class="q-mb-sm"/>
                
                <q-input 
                  v-model="editForm.timeFr" 
                  label="Čas od" 
                  type="datetime-local" 
                  outlined 
                  dense 
                  :model-value="new Date(editForm.timeFr).toISOString().slice(0,16)" 
                  @update:model-value="editForm.timeFr=new Date($event).getTime()"
                  class="q-mb-sm"
                />
                
                <q-input 
                  v-model="editForm.timeTo" 
                  label="Čas do" 
                  type="datetime-local" 
                  outlined 
                  dense 
                  :model-value="new Date(editForm.timeTo).toISOString().slice(0,16)" 
                  @update:model-value="editForm.timeTo=new Date($event).getTime()"
                  class="q-mb-sm"
                />
                
                <q-input v-model="editForm.note" label="Poznámka" outlined dense class="q-mb-sm"/>
                
                <q-checkbox v-model="editForm.kmManual" label="Zadat km" dense class="q-mb-sm"/>
                <q-input v-if="editForm.kmManual" v-model.number="editForm.kmJednosmer" label="Km jednosměr" type="number" outlined dense/>
              </div>
            </div>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup/>
            <q-btn label="Uložit změny" color="primary" @click="saveEdit"/>
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- DIALOG - DUPLIKACE -->
      <q-dialog v-model="duplicateDialog">
        <q-card style="min-width: 400px">
          <q-card-section>
            <div class="text-h6">Duplikovat záznam</div>
          </q-card-section>
          
          <q-card-section class="q-pt-none">
            <q-select v-model="editForm.workerId" :options="workerOptions" label="Pracovník" emit-value map-options outlined dense class="q-mb-sm"/>
            <q-select v-model="editForm.contractId" :options="contractOptions" label="Zakázka" emit-value map-options outlined dense class="q-mb-sm"/>
            <q-select v-model="editForm.jobId" :options="jobOptions" label="Práce" emit-value map-options outlined dense class="q-mb-sm"/>
            <q-select v-model="editForm.placeId" :options="placeOptions" label="Místo práce" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-input 
              v-model="editForm.timeFr" 
              label="Čas od" 
              type="datetime-local" 
              outlined 
              dense 
              :model-value="new Date(editForm.timeFr).toISOString().slice(0,16)" 
              @update:model-value="editForm.timeFr=new Date($event).getTime()"
              class="q-mb-sm"
            />
            
            <q-input 
              v-model="editForm.timeTo" 
              label="Čas do" 
              type="datetime-local" 
              outlined 
              dense 
              :model-value="new Date(editForm.timeTo).toISOString().slice(0,16)" 
              @update:model-value="editForm.timeTo=new Date($event).getTime()"
              class="q-mb-sm"
            />
            
            <q-input v-model="editForm.note" label="Poznámka" outlined dense class="q-mb-sm"/>
            
            <q-checkbox v-model="editForm.kmManual" label="Zadat km" dense class="q-mb-sm"/>
            <q-input v-if="editForm.kmManual" v-model.number="editForm.kmJednosmer" label="Km jednosměr" type="number" outlined dense/>
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup />
            <q-btn label="Uložit kopii" color="primary" @click="saveDuplicate" />
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- DIALOG - OBĚD -->
      <q-dialog v-model="lunchDialog">
        <q-card style="min-width: 350px">
          <q-card-section>
            <div class="text-h6">Přidat oběd</div>
          </q-card-section>
          
          <q-card-section class="q-pt-none">
            <q-select v-model="newLunch.workerId" :options="workerOptions" 
              label="Pracovník *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-input v-model="newLunch.date" label="Datum" outlined dense readonly class="q-mb-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy>
                    <q-date v-model="newLunch.date" mask="DD. MM. YYYY" locale="cs">
                      <div class="row items-center justify-end">
                        <q-btn v-close-popup label="OK" color="primary" flat />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            
            <q-input v-model="newLunch.time" label="Čas (HH:MM)" outlined dense mask="##:##"/>
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup />
            <q-btn label="Uložit" color="primary" @click="saveLunch" />
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- DIALOG - ZÁLOHA -->
      <q-dialog v-model="advanceDialog">
        <q-card style="min-width: 350px">
          <q-card-section>
            <div class="text-h6">Přidat zálohu</div>
          </q-card-section>
          
          <q-card-section class="q-pt-none">
            <q-select v-model="newAdvance.workerId" :options="workerOptions" 
              label="Pracovník *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-input v-model="newAdvance.date" label="Datum" outlined dense readonly class="q-mb-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy>
                    <q-date v-model="newAdvance.date" mask="DD. MM. YYYY" locale="cs">
                      <div class="row items-center justify-end">
                        <q-btn v-close-popup label="OK" color="primary" flat />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            
            <q-input v-model.number="newAdvance.amount" label="Částka (Kč) *" 
              type="number" outlined dense class="q-mb-sm"/>
            
            <q-input v-model="newAdvance.reason" label="Důvod *" outlined dense/>
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup />
            <q-btn label="Uložit" color="primary" @click="saveAdvance" />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  `
});
