app.component('statistics-component', {
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
        const d = new Date(r[4]);
        return d >= from && d <= to;
      });
    },
    
    contractStats() {
      const stats = {};
      this.filteredRecords.forEach(r => {
        const contractName = r[0];
        if (!stats[contractName]) {
          stats[contractName] = {
            name: contractName,
            totalHours: 0,
            totalWorkers: new Set(),
            visits: 0,
            records: []
          };
        }
        stats[contractName].totalHours += r[7];
        stats[contractName].totalWorkers.add(r[6]);
        stats[contractName].visits += 1;
        stats[contractName].records.push(r);
      });
      
      return Object.values(stats).map(s => ({
        ...s,
        totalWorkers: s.totalWorkers.size
      })).sort((a, b) => b.totalHours - a.totalHours);
    },
    
    workerStats() {
      const stats = {};
      this.filteredRecords.forEach(r => {
        const workerName = r[6];
        if (!stats[workerName]) {
          stats[workerName] = {
            name: workerName,
            totalHours: 0,
            contracts: new Set(),
            days: new Set()
          };
        }
        stats[workerName].totalHours += r[7];
        stats[workerName].contracts.add(r[0]);
        const day = new Date(r[4]).toDateString();
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
        const jobName = r[3];
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
  
  template: '<div><q-card class="q-mb-md"><q-card-section><div class="row q-gutter-sm"><div class="col"><q-input v-model="dateFrom" label="Od" type="date" outlined dense :model-value="formatDateForInput(dateFrom)" @update:model-value="dateFrom=formatDateFromInput($event)"/></div><div class="col"><q-input v-model="dateTo" label="Do" type="date" outlined dense :model-value="formatDateForInput(dateTo)" @update:model-value="dateTo=formatDateFromInput($event)"/></div></div></q-card-section></q-card><q-tabs v-model="statsTab" dense align="justify" class="q-mb-md text-primary"><q-tab name="contracts" label="Zakázky"/><q-tab name="workers" label="Pracovníci"/><q-tab name="jobs" label="Práce"/></q-tabs><div v-if="statsTab===\'contracts\'"><q-card v-for="stat in contractStats" :key="stat.name" class="q-mb-md"><q-card-section><div class="text-h6">{{stat.name}}</div><div class="row q-mt-sm"><div class="col"><div class="text-caption text-grey-7">Celkem hodin</div><div class="text-bold text-primary">{{stat.totalHours.toFixed(2)}} h</div></div><div class="col"><div class="text-caption text-grey-7">Pracovníků</div><div class="text-bold">{{stat.totalWorkers}}</div></div><div class="col"><div class="text-caption text-grey-7">Návštěv</div><div class="text-bold">{{stat.visits}}x</div></div></div></q-card-section></q-card></div><div v-if="statsTab===\'workers\'"><q-card v-for="stat in workerStats" :key="stat.name" class="q-mb-md"><q-card-section><div class="text-h6">{{stat.name}}</div><div class="row q-mt-sm"><div class="col"><div class="text-caption text-grey-7">Celkem hodin</div><div class="text-bold text-primary">{{stat.totalHours.toFixed(2)}} h</div></div><div class="col"><div class="text-caption text-grey-7">Zakázek</div><div class="text-bold">{{stat.contracts}}</div></div><div class="col"><div class="text-caption text-grey-7">Odprac. dnů</div><div class="text-bold">{{stat.days}}</div></div></div></q-card-section></q-card></div><div v-if="statsTab===\'jobs\'"><q-card v-for="stat in jobStats" :key="stat.name" class="q-mb-md"><q-card-section><div class="row items-center"><div class="col"><div class="text-bold">{{stat.name}}</div></div><div class="text-right"><div class="text-bold text-primary">{{stat.totalHours.toFixed(2)}} h</div><div class="text-caption text-grey-7">{{stat.count}}x</div></div></div></q-card-section></q-card></div></div>'
});
