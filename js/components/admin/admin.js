// KOMPLETNÍ admin.js - OPRAVENÁ VERZE

window.app.component('admin-component', {
  props: ['allSummary', 'allRecords', 'allAdvances', 'contracts', 'jobs', 'places', 'loading'],
  emits: ['message', 'reload'],
  
  data() {
    return {
      adminTab: 'workers',
      selectedWorkerData: null,
      summaryTab: 'records',
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
    }
  },
  
  methods: {
    async selectWorker(worker) {
      try {
        const res = await apiCall('getworkerdata', { id_worker: worker.id });
        if (res.code === '000' && res.data) {
          this.selectedWorkerData = res.data;
          this.adminTab = 'detail';
        }
      } catch (error) {
        console.error('Load worker data error:', error);
      }
    },
    
    backToWorkers() {
      this.adminTab = 'workers';
      this.selectedWorkerData = null;
    },
    
    openEditDialog(record, idx) {
      this.editingRecord = { record, idx };
      
      const contract = this.contracts.find(c => c[1] === record[0]);
      const job = this.jobs.find(j => j[1] === record[3]);
      
      this.editForm = {
        contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null,
        timeFr: record[4],
        timeTo: record[5],
        note: record[8] || '',
        kmJednosmer: parseFloat(record[11]) || 0,
        kmCelkem: parseFloat(record[12]) || 0,
        kmRucne: record[13] || 'N',
        kmManual: record[13] === 'Y',
        kmRoundTrip: true
      };
      
      this.editDialog = true;
    },
    
    async saveEdit() {
      if (!this.editForm.contractId || !this.editForm.jobId || !this.editForm.timeFr || !this.editForm.timeTo) {
        this.$emit('message', 'Vyplňte všechna pole');
        return;
      }
      
      try {
        const payload = {
          record_index: this.editingRecord.idx,
          id_worker: this.selectedWorkerData.info.id,
          id_contract: this.editForm.contractId,
          id_job: this.editForm.jobId,
          time_fr: this.editForm.timeFr,
          time_to: this.editForm.timeTo,
          note: this.editForm.note
        };
        
        if (this.editForm.kmManual) {
          payload.km_jednosmer = this.editForm.kmJednosmer;
          payload.km_celkem = this.calculatedKmEdit;
          payload.km_rucne = 'Y';
        } else if (this.selectedContractKm > 0) {
          payload.km_jednosmer = this.selectedContractKm;
          payload.km_celkem = this.calculatedKmEdit;
          payload.km_rucne = 'N';
        }
        
        const res = await apiCall('updaterecord', payload);
        
        if (res.code === '000') {
          this.$emit('message', '✓ Záznam upraven');
          this.editDialog = false;
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        console.error('Update record error:', error);
        this.$emit('message', 'Chyba při ukládání');
      }
    },
    
    formatTimeRange(fr, to) {
      return formatTimeRange(fr, to);
    }
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

        <q-tabs v-model="summaryTab" dense align="justify" class="text-primary q-mt-md">
          <q-tab name="records" label="Směny"/>
          <q-tab name="lunches" label="Obědy"/>
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

        <!-- OBĚDY -->
        <div v-if="summaryTab==='lunches'" class="q-mt-md">
          <div v-for="(lunch,idx) in selectedWorkerData.lunches" :key="idx" class="record-card">
            <div class="row items-center">
              <div class="col">
                <div class="text-bold">Oběd</div>
                <div class="text-caption text-grey-7">{{ formatShortDateTime(lunch[1]) }}</div>
              </div>
              <div class="text-right text-bold text-orange">{{ lunch[4] }} Kč</div>
            </div>
          </div>
        </div>

        <!-- ZÁLOHY -->
        <div v-if="summaryTab==='advances'" class="q-mt-md">
          <div v-for="(advance,idx) in selectedWorkerData.advances" :key="idx" class="record-card">
            <div class="row items-center">
              <div class="col">
                <div class="text-bold">{{ advance[5] }}</div>
                <div class="text-caption text-grey-7">{{ formatShortDateTime(advance[1]) }}</div>
              </div>
              <div class="text-right text-bold text-primary">{{ advance[4] }} Kč</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- PŘEHLED DNE -->
      <div v-if="adminTab==='day'" class="q-pt-md">
        <day-overview 
          :all-records="allRecords"
          :contracts="contracts"
          :jobs="jobs"
          :places="places"
          :loading="loading"
          @message="(msg) => $emit('message', msg)"
          @reload="$emit('reload')"
        />
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
            
            <q-input 
              v-model="editForm.note" 
              label="Poznámka" 
              outlined 
              class="q-mb-md"
            />
            
            <div v-if="selectedContractKm > 0 || editForm.kmManual" class="q-mb-md">
              <q-card flat bordered>
                <q-card-section>
                  <div class="text-subtitle2">🚗 Kilometry</div>
                  
                  <div v-if="selectedContractKm > 0" class="text-caption text-grey-7 q-mt-sm">
                    Zakázka má: {{ selectedContractKm }} km jedna cesta
                  </div>
                  
                  <q-checkbox v-model="editForm.kmRoundTrip" label="Tam a zpět (×2)" class="q-mt-sm"/>
                  
                  <div class="text-bold text-primary q-mt-xs">
                    Celkem: {{ calculatedKmEdit }} km
                  </div>
                  
                  <q-checkbox v-model="editForm.kmManual" label="Zadat km ručně" class="q-mt-sm"/>
                  
                  <q-input 
                    v-if="editForm.kmManual" 
                    v-model.number="editForm.kmJednosmer"
                    label="Počet km (jedna cesta)" 
                    type="number" 
                    outlined 
                    dense 
                    class="q-mt-sm"
                  />
                </q-card-section>
              </q-card>
            </div>
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="grey" v-close-popup/>
            <q-btn label="Uložit" color="primary" @click="saveEdit"/>
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  `
});
