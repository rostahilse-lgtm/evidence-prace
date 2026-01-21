// AKTUALIZACE statistics.js - přidat KM statistiky

window.app.component('statistics-component', {
  props: ['allRecords', 'allAdvances', 'contracts', 'jobs'],
  
  data() {
    return {
      statsTab: 'contracts',
      selectedPeriod: 'month',
      dateFrom: getMonthStart(),
      dateTo: getTodayDate()
    }
  },
  
  computed: {
    filteredRecords() {
      const from = parseDateString(this.dateFrom);
      const to = parseDateString(this.dateTo);
      to.setHours(23, 59, 59);
      return this.allRecords.filter(r => {
        const d = new Date(r[6]); // time_fr
        return d >= from && d <= to;
      });
    },
    
    contractStats() {
      const stats = {};
      const tripDays = {}; // Pro počítání unikátních cest
      
      this.filteredRecords.forEach(r => {
        const contractName = r[3]; // name_contract
        const contractId = r[2]; // id_contract
        const dateKey = new Date(r[6]).toDateString(); // den
        const kmCelkem = r[11] || 0; // sloupec K - km_celkem
        
        if (!stats[contractName]) {
          stats[contractName] = {
            name: contractName,
            totalHours: 0,
            totalWorkers: new Set(),
            visits: 0,
            records: [],
            totalKm: 0,
            tripCount: 0
          };
          tripDays[contractName] = new Set();
        }
        
        stats[contractName].totalHours += r[7]; // hours
        stats[contractName].totalWorkers.add(r[1]); // name_worker
        stats[contractName].visits += 1;
        stats[contractName].records.push(r);
        
        // Počítat km jen jednou za den (první záznam s km)
        if (kmCelkem > 0 && !tripDays[contractName].has(dateKey)) {
          stats[contractName].totalKm += kmCelkem;
          stats[contractName].tripCount += 1;
          tripDays[contractName].add(dateKey);
        }
      });
      
      return Object.values(stats).map(s => ({
        ...s,
        totalWorkers: s.totalWorkers.size,
        cestovne: s.totalKm * 4 // 4 Kč/km
      })).sort((a, b) => b.totalHours - a.totalHours);
    },
    
    workerStats() {
      const stats = {};
      this.filteredRecords.forEach(r => {
        const workerName = r[1];
        if (!stats[workerName]) {
          stats[workerName] = {
            name: workerName,
            totalHours: 0,
            contracts: new Set(),
            days: new Set()
          };
        }
        stats[workerName].totalHours += r[7];
        stats[workerName].contracts.add(r[3]);
        const day = new Date(r[6]).toDateString();
        stats[workerName].days.add(day);
      });
      
      return Object.values(stats).map(s => ({
        ...s,
        contracts: s.contracts.size,
        days: s.days.size
      })).sort((a, b) => b.totalHours - a.totalHours);
    },
    
    jobStats() {
      const stats = {};
      this.filteredRecords.forEach(r => {
        const jobName = r[5]; // name_job
        if (!stats[jobName]) {
          stats[jobName] = { name: jobName, totalHours: 0, count: 0 };
        }
        stats[jobName].totalHours += r[7];
        stats[jobName].count += 1;
      });
      
      return Object.values(stats).sort((a, b) => b.totalHours - a.totalHours);
    }
  },
  
  methods: {
    formatDateForInput(s) { return formatDateForInput(s); },
    formatDateFromInput(i) { return formatDateFromInput(i); }
  },
  
  template: `
    <div>
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="row q-gutter-sm">
            <div class="col">
              <q-input 
                v-model="dateFrom" 
                label="Od" 
                type="date" 
                outlined 
                dense 
                :model-value="formatDateForInput(dateFrom)" 
                @update:model-value="dateFrom=formatDateFromInput($event)"
              />
            </div>
            <div class="col">
              <q-input 
                v-model="dateTo" 
                label="Do" 
                type="date" 
                outlined 
                dense 
                :model-value="formatDateForInput(dateTo)" 
                @update:model-value="dateTo=formatDateFromInput($event)"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <q-tabs 
        v-model="statsTab" 
        dense 
        align="justify" 
        class="q-mb-md text-primary"
      >
        <q-tab name="contracts" label="Zakázky"/>
        <q-tab name="workers" label="Pracovníci"/>
        <q-tab name="jobs" label="Práce"/>
      </q-tabs>

      <!-- ZAKÁZKY s KM -->
      <div v-if="statsTab==='contracts'">
        <q-card v-for="stat in contractStats" :key="stat.name" class="q-mb-md">
          <q-card-section>
            <div class="text-h6">{{ stat.name }}</div>
            <q-separator class="q-my-sm"/>
            
            <div class="row q-mt-sm">
              <div class="col-6">
                <div class="text-caption text-grey-7">Celkem hodin</div>
                <div class="text-bold text-primary">{{ stat.totalHours.toFixed(2) }} h</div>
              </div>
              <div class="col-3">
                <div class="text-caption text-grey-7">Pracovníků</div>
                <div class="text-bold">{{ stat.totalWorkers }}</div>
              </div>
              <div class="col-3">
                <div class="text-caption text-grey-7">Návštěv</div>
                <div class="text-bold">{{ stat.visits }}x</div>
              </div>
            </div>
            
            <!-- KM STATISTIKY -->
            <div v-if="stat.totalKm > 0" class="q-mt-md">
              <q-separator class="q-mb-sm"/>
              <div class="text-subtitle2">🚗 Kilometry</div>
              <div class="row q-mt-xs">
                <div class="col-4">
                  <div class="text-caption text-grey-7">Cest</div>
                  <div class="text-bold">{{ stat.tripCount }}x</div>
                </div>
                <div class="col-4">
                  <div class="text-caption text-grey-7">Celkem km</div>
                  <div class="text-bold text-orange">{{ stat.totalKm }} km</div>
                </div>
                <div class="col-4">
                  <div class="text-caption text-grey-7">Cestovné</div>
                  <div class="text-bold text-green">{{ stat.cestovne }} Kč</div>
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- PRACOVNÍCI -->
      <div v-if="statsTab==='workers'">
        <q-card v-for="stat in workerStats" :key="stat.name" class="q-mb-md">
          <q-card-section>
            <div class="text-h6">{{ stat.name }}</div>
            <div class="row q-mt-sm">
              <div class="col">
                <div class="text-caption text-grey-7">Celkem hodin</div>
                <div class="text-bold text-primary">{{ stat.totalHours.toFixed(2) }} h</div>
              </div>
              <div class="col">
                <div class="text-caption text-grey-7">Zakázek</div>
                <div class="text-bold">{{ stat.contracts }}</div>
              </div>
              <div class="col">
                <div class="text-caption text-grey-7">Odprac. dnů</div>
                <div class="text-bold">{{ stat.days }}</div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- PRÁCE -->
      <div v-if="statsTab==='jobs'">
        <q-card v-for="stat in jobStats" :key="stat.name" class="q-mb-md">
          <q-card-section>
            <div class="row items-center">
              <div class="col">
                <div class="text-bold">{{ stat.name }}</div>
              </div>
              <div class="text-right">
                <div class="text-bold text-primary">{{ stat.totalHours.toFixed(2) }} h</div>
                <div class="text-caption text-grey-7">{{ stat.count }}x</div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  `
});
