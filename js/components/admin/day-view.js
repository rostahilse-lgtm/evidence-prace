// Komponenta pro přehled dne
window.app.component('day-view-component', {
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
        date: '',
        startTime: '',
        endTime: '',
        contractId: null,
        jobId: null
      }
    }
  },
  
  computed: {
    displayDate() {
      if (this.adminDayView === 'today') {
        return getTodayDate();
      } else if (this.adminDayView === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
      } else {
        return this.selectedDate;
      }
    },
    
    filteredRecords() {
      return this.allRecords.filter(r => r.date === this.displayDate);
    }
  },
  
  methods: {
    openEditDialog(record) {
      this.editingRecord = record;
      this.editForm = {
        date: record.date,
        startTime: record.startTime,
        endTime: record.endTime,
        contractId: record.contractId,
        jobId: record.jobId
      };
      this.editDialog = true;
    },
    
    async saveEdit() {
      if (!this.editingRecord) return;
      
      try {
        const response = await apiCall('updateRecord', {
          recordId: this.editingRecord.id,
          ...this.editForm
        });
        
        if (response.success) {
          this.$emit('message', 'Záznam upraven');
          this.$emit('reload');
          this.editDialog = false;
        } else {
          this.$emit('message', response.message || 'Chyba při úpravě záznamu');
        }
      } catch (error) {
        console.error('Update record error:', error);
        this.$emit('message', 'Chyba při úpravě záznamu');
      }
    },
    
    async deleteRecord(recordId) {
      if (!confirm('Opravdu smazat tento záznam?')) return;
      
      try {
        const response = await apiCall('deleteRecord', { recordId });
        
        if (response.success) {
          this.$emit('message', 'Záznam smazán');
          this.$emit('reload');
        } else {
          this.$emit('message', response.message || 'Chyba při mazání záznamu');
        }
      } catch (error) {
        console.error('Delete record error:', error);
        this.$emit('message', 'Chyba při mazání záznamu');
      }
    }
  },
  
  template: `
    <div>
      <!-- Výběr dne -->
      <q-card class="q-mb-md">
        <q-card-section>
          <q-btn-toggle
            v-model="adminDayView"
            spread
            toggle-color="primary"
            :options="[
              {label: 'Dnes', value: 'today'},
              {label: 'Včera', value: 'yesterday'},
              {label: 'Vlastní datum', value: 'custom'}
            ]"
          />
          
          <q-input
            v-if="adminDayView === 'custom'"
            v-model="selectedDate"
            type="date"
            label="Vyberte datum"
            outlined
            class="q-mt-md"
          />
        </q-card-section>
      </q-card>
      
      <!-- Seznam záznamů -->
      <q-card>
        <q-card-section>
          <div class="text-h6">{{ displayDate }}</div>
        </q-card-section>
        
        <q-list bordered separator v-if="filteredRecords.length">
          <q-item v-for="record in filteredRecords" :key="record.id">
            <q-item-section>
              <q-item-label>{{ record.workerName }}</q-item-label>
              <q-item-label caption>{{ record.contractName }} - {{ record.jobName }}</q-item-label>
              <q-item-label caption>{{ formatTime(record.startTime) }} - {{ formatTime(record.endTime) }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label>{{ record.hours }} h</q-item-label>
              <q-item-label caption>{{ record.earnings }} Kč</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn flat round icon="edit" @click="openEditDialog(record)" />
              <q-btn flat round icon="delete" color="negative" @click="deleteRecord(record.id)" />
            </q-item-section>
          </q-item>
        </q-list>
        
        <q-card-section v-else>
          <div class="text-center text-grey">Žádné záznamy pro tento den</div>
        </q-card-section>
      </q-card>
      
      <!-- Edit Dialog -->
      <q-dialog v-model="editDialog">
        <q-card style="min-width: 350px">
          <q-card-section>
            <div class="text-h6">Upravit záznam</div>
          </q-card-section>
          
          <q-card-section>
            <q-input
              v-model="editForm.date"
              type="date"
              label="Datum"
              outlined
              class="q-mb-md"
            />
            
            <q-input
              v-model="editForm.startTime"
              type="time"
              label="Začátek"
              outlined
              class="q-mb-md"
            />
            
            <q-input
              v-model="editForm.endTime"
              type="time"
              label="Konec"
              outlined
              class="q-mb-md"
            />
            
            <q-select
              v-model="editForm.contractId"
              :options="contracts"
              option-value="id"
              option-label="name"
              emit-value
              map-options
              label="Smlouva"
              outlined
              class="q-mb-md"
            />
            
            <q-select
              v-model="editForm.jobId"
              :options="jobs"
              option-value="id"
              option-label="name"
              emit-value
              map-options
              label="Práce"
              outlined
            />
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" v-close-popup />
            <q-btn color="primary" label="Uložit" @click="saveEdit" />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  `
});
