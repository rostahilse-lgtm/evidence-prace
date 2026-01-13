
app.component('admin-component', {
  props: ['allSummary', 'allRecords', 'allAdvances', 'contracts', 'jobs', 'loading'],
  emits: ['message', 'reload'],
  
  data() {
    return {
      adminTab: 'workers',
      selectedWorkerData: null
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
    }
  },
  
  template: `
    <div class="tab-content">
      <q-tabs v-model="adminTab" dense align="justify" class="text-primary">
        <q-tab name="workers" label="Pracovníci"/>
        <q-tab name="day" label="Přehled dne"/>
      </q-tabs>

      <!-- SEZNAM PRACOVNÍKŮ -->
      <div v-if="adminTab === 'workers'" class="q-pt-md">
        <div 
          v-for="worker in allSummary" 
          :key="worker.id" 
          class="worker-card" 
          @click="selectWorker(worker)"
        >
          <div class="row items-center">
            <div class="col">
              <div class="text-bold">{{ worker.name }}</div>
              <div class="text-caption text-grey-7">ID: {{ worker.id }}</div>
            </div>
            <div class="text-right">
              <div 
                class="text-bold" 
                :class="worker.balance >= 0 ? 'balance-positive' : 'balance-negative'"
              >
                {{ worker.balance }} Kč
              </div>
              <div class="text-caption">Vyděleno: {{ worker.totalEarnings }} Kč</div>
            </div>
          </div>
        </div>
      </div>

      <!-- DETAIL PRACOVNÍKA -->
      <div v-if="adminTab === 'detail' && selectedWorkerData">
        <worker-detail-component
          :worker-data="selectedWorkerData"
          :contracts="contracts"
          :jobs="jobs"
          :loading="loading"
          @back="backToWorkers"
          @message="$emit('message', $event)"
          @reload="$emit('reload')">
        </worker-detail-component>
      </div>

      <!-- PŘEHLED DNE -->
      <div v-if="adminTab === 'day'">
        <day-view-component
          :all-records="allRecords"
          :contracts="contracts"
          :jobs="jobs"
          :loading="loading"
          @message="$emit('message', $event)"
          @reload="$emit('reload')">
        </day-view-component>
      </div>
    </div>
  `
});
