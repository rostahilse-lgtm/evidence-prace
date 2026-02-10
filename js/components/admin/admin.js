// ADMIN.JS - KONEČNĚ SPRÁVNÁ VERZE!
// MÍSTO opraveno PŘESNĚ podle home.js (tam to funguje!)

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
      selectedDate: null,
      editDialog: false,
      duplicateDialog: false,
      lunchDialog: false,
      advanceDialog: false,
      editingRecord: null,
      editForm: { 
        workerId: null,
        contractId: null, 
        jobId: null,
        placeId: null,
        dateEdit: null,
        timeFrom: null,
        timeTo: null,
        note: '',
        kmJednosmer: 0,
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
    // OPRAVA 1: placeOptions - PŘESNĚ podle home.js!
    placeOptions() {
      return this.places.map(p => ({ label: p[1], value: p[0] }));
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
    
    timestampToDate(ts) {
      const d = new Date(ts);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}. ${month}. ${year}`;
    },
    
    timestampToTime(ts) {
      const d = new Date(ts);
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    },
    
    dateTimeToTimestamp(dateStr, timeStr) {
      const dateParts = dateStr.split('. ');
      const timeParts = timeStr.split(':');
      return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1]).getTime();
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
      if (!this.selectedDate) {
        this.selectedDate = this.getTodayDate();
      }
      
      const parts = this.selectedDate.split('. ');
      const targetDate = new Date(parts[2], parts[1] - 1, parts[0]);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      this.dayRecords = this.allRecords.filter(r => {
        const recordDate = new Date(r[4]);
        return recordDate >= targetDate && recordDate < nextDay;
      });
    },
    
    setToday() {
      this.selectedDate = this.getTodayDate();
      this.loadDayRecords();
    },
    
    // OPRAVA 2: openEditDialog - najít placeId STEJNĚ jako v home.js!
    openEditDialog(record, index) {
      this.editingRecord = { data: record, index: index };
      
      // PŮVODNÍ HODNOTY
      this.originalRecord = {
        worker: record[6],
        contract: record[0],
        job: record[3],
        place: record[14] || 'Nezadáno',
        timeFrom: this.timestampToTime(record[4]),
        timeTo: this.timestampToTime(record[5]),
        date: this.timestampToDate(record[4]),
        note: record[8] || '',
        km: record[12] || 0
      };
      
      // EDITOVATELNÉ - najít IDs
      const worker = this.workers.find(w => w[1] === record[6]);
      const contract = this.contracts.find(c => c[1] === record[0]);
      const job = this.jobs.find(j => j[1] === record[3]);
      const place = this.places.find(p => p[1] === record[14]);  // STEJNĚ JAKO JOB!
      
      this.editForm = {
        workerId: worker ? worker[0] : null,
        contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null,
        placeId: place ? place[0] : null,  // STEJNĚ JAKO JOB!
        dateEdit: this.timestampToDate(record[4]),
        timeFrom: this.timestampToTime(record[4]),
        timeTo: this.timestampToTime(record[5]),
        note: record[8] || '',
        kmJednosmer: parseFloat(record[11]) || 0,
        kmManual: record[13] === 'Y',
        kmRoundTrip: parseFloat(record[12]) === (parseFloat(record[11]) * 2)
      };
      
      this.editDialog = true;
    },
    
    // OPRAVA 3: openDuplicateDialog - stejná logika
    openDuplicateDialog(record) {
      const worker = this.workers.find(w => w[1] === record[6]);
      const contract = this.contracts.find(c => c[1] === record[0]);
      const job = this.jobs.find(j => j[1] === record[3]);
      const place = this.places.find(p => p[1] === record[14]);  // STEJNĚ JAKO JOB!
      
      this.editForm = {
        workerId: worker ? worker[0] : null,
        contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null,
        placeId: place ? place[0] : null,  // STEJNĚ JAKO JOB!
        dateEdit: this.getTodayDate(),
        timeFrom: this.timestampToTime(record[4]),
        timeTo: this.timestampToTime(record[5]),
        note: record[8] || '',
        kmJednosmer: parseFloat(record[11]) || 0,
        kmManual: record[13] === 'Y',
        kmRoundTrip: true
      };
      
      this.duplicateDialog = true;
    },
    
    openLunchDialog() {
      this.newLunch = {
        workerId: null,
        date: this.selectedDate || this.getTodayDate(),
        time: this.getCurrentTime()
      };
      this.lunchDialog = true;
    },
    
    openAdvanceDialog() {
      this.newAdvance = {
        workerId: null,
        amount: null,
        reason: '',
        date: this.selectedDate || this.getTodayDate()
      };
      this.advanceDialog = true;
    },
    
    async saveEdit() {
      if (!this.editForm.workerId || !this.editForm.contractId || !this.editForm.jobId || !this.editForm.placeId || !this.editForm.timeFrom || !this.editForm.timeTo) {
        this.$emit('message', 'Vyplňte všechna pole');
        return;
      }
      
      const timeFr = this.dateTimeToTimestamp(this.editForm.dateEdit, this.editForm.timeFrom);
      const timeTo = this.dateTimeToTimestamp(this.editForm.dateEdit, this.editForm.timeTo);
      
      try {
        const payload = {
          id_contract: this.editForm.contractId,
          id_worker: this.editForm.workerId,
          id_job: this.editForm.jobId,
          id_place: this.editForm.placeId,
          time_fr: timeFr,
          time_to: timeTo,
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
      if (!this.editForm.workerId || !this.editForm.contractId || !this.editForm.jobId || !this.editForm.placeId || !this.editForm.timeFrom || !this.editForm.timeTo) {
        this.$emit('message', 'Vyplňte všechna pole');
        return;
      }
      
      const timeFr = this.dateTimeToTimestamp(this.editForm.dateEdit, this.editForm.timeFrom);
      const timeTo = this.dateTimeToTimestamp(this.editForm.dateEdit, this.editForm.timeTo);
      
      try {
        const payload = {
          id_contract: this.editForm.contractId,
          id_worker: this.editForm.workerId,
          id_job: this.editForm.jobId,
          id_place: this.editForm.placeId,
          time_fr: timeFr,
          time_to: timeTo,
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
      
      const timestamp = this.dateTimeToTimestamp(this.newLunch.date, this.newLunch.time);
      
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
    selectedDate() { 
      if (this.adminTab === 'day') this.loadDayRecords(); 
    },
    'editForm.contractId'() {
      if (!this.editForm.kmManual) {
        this.editForm.kmJednosmer = this.selectedContractKm;
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

      <!-- PRACOVNÍCI - KOMPAKTNÍ -->
      <div v-if="adminTab==='workers'" class="q-pt-md">
        <div v-for="worker in allSummary" :key="worker.id" class="worker-card" @click="selectWorker(worker)">
          <div class="row items-center no-wrap">
            <div style="min-width:100px" class="q-mr-xs">
              <div class="text-bold text-caption">{{ worker.name }}</div>
            </div>
            <div style="min-width:70px" class="text-caption text-grey-7 q-mr-xs">
              {{ worker.totalEarnings }} Kč
            </div>
            <div style="min-width:60px" class="text-right">
              <div class="text-bold text-caption" :class="worker.balance>=0?'balance-positive':'balance-negative'">
                {{ worker.balance }} Kč
              </div>
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
        <div class="row q-gutter-xs q-mb-md items-center">
          <q-btn color="primary" label="Dnes" dense size="sm" @click="setToday"/>
          <div class="col">
            <q-input v-model="selectedDate" outlined dense label="Datum" readonly>
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover @before-hide="loadDayRecords">
                    <q-date v-model="selectedDate" mask="DD. MM. YYYY" locale="cs" />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>
          <q-btn color="primary" icon="restaurant" dense size="sm" @click="openLunchDialog">
            <q-tooltip>Oběd</q-tooltip>
          </q-btn>
          <q-btn color="primary" icon="payment" dense size="sm" @click="openAdvanceDialog">
            <q-tooltip>Záloha</q-tooltip>
          </q-btn>
        </div>

        <div v-if="dayRecords.length===0" class="text-center text-grey-7 q-mt-lg">
          Žádné záznamy
        </div>

        <div v-for="(record,idx) in dayRecords" :key="idx" class="record-card">
          <div class="row items-center">
            <div class="col">
              <div class="text-bold">{{ record[6] }}</div>
              <div class="text-caption text-grey-7">{{ record[0] }} • {{ record[3] }}</div>
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

      <!-- DIALOG - ÚPRAVA (KOMPAKTNÍ PRO MOBIL) -->
      <q-dialog v-model="editDialog">
        <q-card style="width:95%; max-width:500px">
          <q-card-section>
            <div class="text-h6">Upravit</div>
          </q-card-section>

          <q-card-section class="q-pt-none" style="max-height:60vh; overflow-y:auto">
            <div class="row q-col-gutter-sm">
              <div class="col-6">
                <div class="text-caption text-grey-7 q-mb-xs">Původní:</div>
                <q-input v-model="originalRecord.worker" label="Pracovník" dense readonly filled class="q-mb-xs"/>
                <q-input v-model="originalRecord.contract" label="Zakázka" dense readonly filled class="q-mb-xs"/>
                <q-input v-model="originalRecord.job" label="Práce" dense readonly filled class="q-mb-xs"/>
                <q-input v-model="originalRecord.place" label="Místo" dense readonly filled class="q-mb-xs"/>
                <q-input v-model="originalRecord.date" label="Datum" dense readonly filled class="q-mb-xs"/>
                <q-input v-model="originalRecord.timeFrom" label="Od" dense readonly filled class="q-mb-xs"/>
                <q-input v-model="originalRecord.timeTo" label="Do" dense readonly filled class="q-mb-xs"/>
                <q-input v-model="originalRecord.note" label="Poznámka" dense readonly filled type="textarea" rows="2"/>
              </div>
              
              <div class="col-6">
                <div class="text-caption text-grey-7 q-mb-xs">Nové:</div>
                <q-select v-model="editForm.workerId" :options="workerOptions" label="Pracovník" emit-value map-options dense outlined class="q-mb-xs"/>
                <q-select v-model="editForm.contractId" :options="contractOptions" label="Zakázka" emit-value map-options dense outlined class="q-mb-xs"/>
                <q-select v-model="editForm.jobId" :options="jobOptions" label="Práce" emit-value map-options dense outlined class="q-mb-xs"/>
                <q-select v-model="editForm.placeId" :options="placeOptions" label="Místo" emit-value map-options dense outlined class="q-mb-xs"/>
                
                <q-input v-model="editForm.dateEdit" label="Datum" dense outlined readonly class="q-mb-xs">
                  <template v-slot:append>
                    <q-icon name="event" class="cursor-pointer">
                      <q-popup-proxy cover>
                        <q-date v-model="editForm.dateEdit" mask="DD. MM. YYYY" locale="cs" />
                      </q-popup-proxy>
                    </q-icon>
                  </template>
                </q-input>
                
                <q-input v-model="editForm.timeFrom" label="Od" dense outlined class="q-mb-xs">
                  <template v-slot:append>
                    <q-icon name="schedule" class="cursor-pointer">
                      <q-popup-proxy cover>
                        <q-time v-model="editForm.timeFrom" mask="HH:mm" format24h />
                      </q-popup-proxy>
                    </q-icon>
                  </template>
                </q-input>
                
                <q-input v-model="editForm.timeTo" label="Do" dense outlined class="q-mb-xs">
                  <template v-slot:append>
                    <q-icon name="schedule" class="cursor-pointer">
                      <q-popup-proxy cover>
                        <q-time v-model="editForm.timeTo" mask="HH:mm" format24h />
                      </q-popup-proxy>
                    </q-icon>
                  </template>
                </q-input>
                
                <q-input v-model="editForm.note" label="Poznámka" dense outlined type="textarea" rows="2"/>
              </div>
            </div>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup size="sm"/>
            <q-btn label="Uložit" color="primary" @click="saveEdit" size="sm"/>
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- DIALOG - DUPLIKACE -->
      <q-dialog v-model="duplicateDialog">
        <q-card style="width:100%; max-width:400px">
          <q-card-section>
            <div class="text-h6">Duplikovat</div>
          </q-card-section>
          
          <q-card-section class="q-pt-none">
            <q-select v-model="editForm.workerId" :options="workerOptions" label="Pracovník" emit-value map-options outlined dense class="q-mb-sm"/>
            <q-select v-model="editForm.contractId" :options="contractOptions" label="Zakázka" emit-value map-options outlined dense class="q-mb-sm"/>
            <q-select v-model="editForm.jobId" :options="jobOptions" label="Práce" emit-value map-options outlined dense class="q-mb-sm"/>
            <q-select v-model="editForm.placeId" :options="placeOptions" label="Místo" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-input v-model="editForm.dateEdit" label="Datum" outlined dense readonly class="q-mb-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover>
                    <q-date v-model="editForm.dateEdit" mask="DD. MM. YYYY" locale="cs" />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            
            <q-input v-model="editForm.timeFrom" label="Od" outlined dense class="q-mb-sm">
              <template v-slot:append>
                <q-icon name="schedule" class="cursor-pointer">
                  <q-popup-proxy cover>
                    <q-time v-model="editForm.timeFrom" mask="HH:mm" format24h />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            
            <q-input v-model="editForm.timeTo" label="Do" outlined dense class="q-mb-sm">
              <template v-slot:append>
                <q-icon name="schedule" class="cursor-pointer">
                  <q-popup-proxy cover>
                    <q-time v-model="editForm.timeTo" mask="HH:mm" format24h />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            
            <q-input v-model="editForm.note" label="Poznámka" outlined dense/>
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup />
            <q-btn label="Uložit" color="primary" @click="saveDuplicate" />
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- DIALOG - OBĚD -->
      <q-dialog v-model="lunchDialog">
        <q-card style="width:100%; max-width:350px">
          <q-card-section>
            <div class="text-h6">Oběd</div>
          </q-card-section>
          
          <q-card-section class="q-pt-none">
            <q-select v-model="newLunch.workerId" :options="workerOptions" 
              label="Pracovník *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-input v-model="newLunch.date" label="Datum" outlined dense readonly class="q-mb-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover>
                    <q-date v-model="newLunch.date" mask="DD. MM. YYYY" locale="cs" />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            
            <q-input v-model="newLunch.time" label="Čas" outlined dense>
              <template v-slot:append>
                <q-icon name="schedule" class="cursor-pointer">
                  <q-popup-proxy cover>
                    <q-time v-model="newLunch.time" mask="HH:mm" format24h />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup />
            <q-btn label="Uložit" color="primary" @click="saveLunch" />
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- DIALOG - ZÁLOHA -->
      <q-dialog v-model="advanceDialog">
        <q-card style="width:100%; max-width:350px">
          <q-card-section>
            <div class="text-h6">Záloha</div>
          </q-card-section>
          
          <q-card-section class="q-pt-none">
            <q-select v-model="newAdvance.workerId" :options="workerOptions" 
              label="Pracovník *" emit-value map-options outlined dense class="q-mb-sm"/>
            
            <q-input v-model="newAdvance.date" label="Datum" outlined dense readonly class="q-mb-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover>
                    <q-date v-model="newAdvance.date" mask="DD. MM. YYYY" locale="cs" />
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
