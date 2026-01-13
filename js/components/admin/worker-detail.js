
app.component('worker-detail-component', {
  props: ['workerData', 'contracts', 'jobs', 'loading'],
  emits: ['back', 'message', 'reload'],
  
  data() {
    return {
      summaryTab: 'records',
      editDialog: false,
      editingRecord: null,
      editForm: {
        contractId: null,
        jobId: null,
        timeFr: null,
        timeTo: null,
        note: ''
      }
    }
  },
  
  methods: {
    openEditDialog(record, index) {
      this.editingRecord = { data: record, index: index };
      const contract = this.contracts.find(c => c.value === record[0]);
      const job = this.jobs.find(j => j.label === record[3]);
      
      this.editForm = {
        contractId: contract ? contract.value : null,
        jobId: job ? job.value : null,
        timeFr: record[4],
        timeTo: record[5],
        note: record[8]
      };
      this.editDialog = true;
    },
    
    async saveEdit() {
      if (!this.editForm.contractId || !this.editForm.jobId || 
          !this.editForm.timeFr || !this.editForm.timeTo) {
        this.$emit('message', 'Vyplňte všechna pole');
        return;
      }
      
      const res = await apiCall('updaterecord', {
        row_index: this.editingRecord.index,
        id_contract: this.editForm.contractId,
        id_job: this.editForm.jobId,
        time_fr: this.editForm.timeFr,
        time_to: this.editForm.timeTo,
        note: this.editForm.note
      });
      
      if (res.code === '000') {
        this.$emit('message', '✓ Záznam upraven');
        this.editDialog = false;
        this.$emit('reload');
      } else {
        this.$emit('message', 'Chyba: ' + res.error);
      }
    }
  },
  
  template: `
    <div class="q-pt-md">
      <q-btn flat icon="arrow_back" label="Zpět" @click="$emit('back')" class="q-mb-md"/>
      
      <div class="summary-box">
        <div class="text-h6 q-mb-md">{{ workerData.info.name }}</div>
        <div class="summary-item">
          <span class="summary-label">Vyděleno:</span>
          <span class="summary-value">{{ workerData.info.totalEarnings }} Kč</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Vyplaceno:</span>
          <span class="summary-value">{{ workerData.info.totalPaid }} Kč</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Zůstatek:</span>
          <span :class="workerData.info.balance >= 0 ? 'balance-positive' : 'balance-negative'">
            {{ workerData.info.balance }} Kč
          </span>
        </div>
      </div>

      <q-tabs v-model="summaryTab" dense class="q-mt-md">
        <q-tab name="records" label="Záznamy"/>
        <q-tab name="advances" label="Zálohy"/>
      </q-tabs>

      <!-- ZÁZNAMY -->
      <div v-if="summaryTab === 'records'" class="q-mt-md">
        <div v-for="(record, idx) in workerData.records" :key="idx" class="record-card">
          <div class="row items-center">
            <div class="col">
              <div class="text-bold">{{ record[0] }}</div>
              <div class="text-caption text-grey-7">{{ record[3] }}</div>
            </div>
            <div class="text-right">
              <div class="text-bold text-primary">{{ record[7].toFixed(2) }} hod</div>
              <div class="text-caption">{{ record[2] }} Kč/hod</div>
            </div>
            <q-icon 
              name="edit" 
              class="edit-icon q-ml-sm" 
              @click="openEditDialog(record, idx)"
            />
          </div>
          <div class="text-caption text-grey-7 q-mt-sm">
            {{ formatTimeRange(record[4], record[5]) }}
          </div>
          <div v-if="record[8]" class="note-display">💬 {{ record[8] }}</div>
        </div>
      </div>

      <!-- ZÁLOHY -->
      <div v-if="summaryTab === 'advances'" class="q-mt-md">
        <div v-for="(advance, idx) in workerData.advances" :key="idx" class="record-card">
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

      <!-- EDIT DIALOG -->
      <q-dialog v-model="editDialog">
        <q-card style="min-width: 350px">
          <q-card-section>
            <div class="text-h6">Upravit záznam</div>
          </q-card-section>

          <q-card-section class="q-pt-none">
            <q-select 
              v-model="editForm.contractId" 
              :options="contracts" 
              label="Zakázka" 
              emit-value 
              map-options 
              outlined 
              class="q-mb-md"
            />
            <q-select 
              v-model="editForm.jobId" 
              :options="jobs" 
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
                  :model-value="new Date(editForm.timeFr).toISOString().slice(0, 16)" 
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
                  :model-value="new Date(editForm.timeTo).toISOString().slice(0, 16)" 
                  @update:model-value="editForm.timeTo = new Date($event).getTime()"
                />
              </div>
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
              label="Přepsat" 
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
