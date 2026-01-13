
app.component('day-view-component', {
  props: ['allRecords', 'contracts', 'jobs', 'loading'],
  emits: ['message', 'reload'],
  
  data() {
    return {
      adminDayView: 'today',
      selectedDate: getTodayDate(),
      dayRecords: [],
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
  
  mounted() {
    this.loadDayRecords();
  },
  
  watch: {
    adminDayView() {
      this.loadDayRecords();
    },
    selectedDate() {
      this.loadDayRecords();
    }
  },
  
  methods: {
    async loadDayRecords() {
      const date = this.adminDayView === 'today' ? getTodayDate() : this.selectedDate;
      const res = await apiCall('getdayrecords', { date });
      if (res.data) {
        this.dayRecords = res.data.sort((a, b) => a[4] - b[4]);
      }
    },
    
    openEditDialog(record, index) {
      this.editingRecord = { data: record, index: index };
      const contract = this.contracts.find(c => c.label.includes(record[0]));
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
        await this.loadDayRecords();
        this.$emit('reload');
      } else {
        this.$emit('message', 'Chyba: ' + res.error);
      }
    }
  },
  
  template: `
    <div class="q-pt-md">
      <div class="row q-gutter-sm q-mb-md">
        <q-btn 
          :color="adminDayView === 'today' ? 'primary' : 'grey-5'" 
          label="Dnes" 
          @click="adminDayView = 'today'" 
          class="col"
        />
        <q-btn 
          :color="adminDayView === 'date' ? 'primary' : 'grey-5'" 
          label="Datum" 
          @click="adminDayView = 'date'" 
          class="col"
        />
      </div>

      <div v-if="adminDayView === 'date'" class="q-mb-md">
        <q-input 
          v-model="selectedDate" 
          label="Vyberte datum" 
          type="date" 
          outlined 
          :model-value="formatDateForInput(selectedDate)" 
          @update:model-value="selectedDate = formatDateFromInput($event)"
        />
      </div>

      <div class="text-h6 q-mb-md">
        {{ adminDayView === 'today' ? getTodayDate() : selectedDate }}
      </div>

      <div v-if="dayRecords.length === 0" class="text-center text-grey-7 q-mt-lg">
        Žádné záznamy pro tento den
      </div>
      
      <div v-for="(record, idx) in dayRecords" :key="idx" class="record-card">
        <div class="row items-center">
          <div class="col">
            <div class="text-bold">{{ record[6] }}</div>
            <div class="text-caption">{{ record[0] }} • {{ record[3] }}</div>
          </div>
          <div class="text-right">
            <div class="text-bold text-primary">{{ record[7].toFixed(2) }} hod</div>
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
