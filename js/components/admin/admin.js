// Hlavní admin komponenta
window.app.component('admin-component', {
  props: ['allSummary', 'allRecords', 'allAdvances', 'contracts', 'jobs', 'loading'],
  emits: ['message', 'reload'],
  
  data() {
    return {
      adminTab: 'workers',
      selectedWorkerData: null
    }
  },
  
  methods: {
    async showWorkerDetail(workerId) {
      try {
        const summaryRes = await apiCall('getSummary', { workerId });
        const recordsRes = await apiCall('getRecords', { workerId });
        const advancesRes = await apiCall('getAdvances', { workerId });
        const lunchesRes = await apiCall('getLunches', { workerId });
        
        this.selectedWorkerData = {
          workerId,
          summary: summaryRes.summary,
          records: recordsRes.records || [],
          advances: advancesRes.advances || [],
          lunches: lunchesRes.lunches || []
        };
        
      } catch (error) {
        console.error('Error loading worker detail:', error);
        this.$emit('message', 'Chyba při načítání detailu pracovníka');
      }
    },
    
    closeWorkerDetail() {
      this.selectedWorkerData = null;
      this.$emit('reload');
    }
  },
  
  template: `
    <div>
      <!-- Detail pracovníka -->
      <worker-detail-component
        v-if="selectedWorkerData"
        :worker-data="selectedWorkerData"
        :contracts="contracts"
        :jobs="jobs"
        :loading="loading"
        @back="closeWorkerDetail"
        @message="$emit('message', $event)"
        @reload="$emit('reload')"
      />
      
      <!-- Hlavní admin view -->
      <div v-else>
        <q-tabs v-model="adminTab" dense align="justify" class="q-mb-md">
          <q-tab name="workers" icon="people" label="Pracovníci" />
          <q-tab name="day" icon="today" label="Přehled dne" />
        </q-tabs>
        
        <!-- Seznam pracovníků -->
        <div v-if="adminTab === 'workers'">
          <q-list bordered separator v-if="allSummary.length">
            <q-item 
              v-for="worker in allSummary" 
              :key="worker.workerId"
              clickable
              @click="showWorkerDetail(worker.workerId)"
            >
              <q-item-section>
                <q-item-label>{{ worker.workerName }}</q-item-label>
                <q-item-label caption>{{ worker.totalHours }} h</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-item-label>{{ worker.balance }} Kč</q-item-label>
                <q-item-label caption>k výplatě</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-icon name="chevron_right" />
              </q-item-section>
            </q-item>
          </q-list>
          <q-card v-else>
            <q-card-section>
              <div class="text-center text-grey">Žádní pracovníci</div>
            </q-card-section>
          </q-card>
        </div>
        
        <!-- Přehled dne -->
        <div v-if="adminTab === 'day'">
          <day-view-component
            :all-records="allRecords"
            :contracts="contracts"
            :jobs="jobs"
            :loading="loading"
            @message="$emit('message', $event)"
            @reload="$emit('reload')"
          />
        </div>
      </div>
    </div>
  `
});
