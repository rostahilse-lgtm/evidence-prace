app.component('admin-component', {
  props: ['allSummary', 'allRecords', 'allAdvances', 'contracts', 'jobs', 'loading'],
  emits: ['message', 'reload'],
  
  data() {
    return {
      adminTab: 'workers',
      selectedWorkerData: null,
      dayRecords: [],
      adminDayView: 'today',
      selectedDate: getTodayDate()
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
    },
    
    async loadDayRecords() {
      const date = this.adminDayView === 'today' ? getTodayDate() : this.selectedDate;
      const res = await apiCall('getdayrecords', { date: date });
      if (res.data) {
        this.dayRecords = res.data.sort((a, b) => a[4] - b[4]);
      }
    },
    
    formatTimeRange(fr, to) {
      return formatTimeRange(fr, to);
    },
    
    formatShortDateTime(ts) {
      return formatShortDateTime(ts);
    }
  },
  
  watch: {
    adminDayView() { this.loadDayRecords(); },
    selectedDate() { this.loadDayRecords(); }
  },
  
  mounted() {
    if (this.adminTab === 'day') {
      this.loadDayRecords();
    }
  },
  
  template: '<div><q-tabs v-model="adminTab" dense align="justify" class="text-primary"><q-tab name="workers" label="Pracovníci"/><q-tab name="day" label="Přehled dne"/></q-tabs><div v-if="adminTab===\'workers\'" class="q-pt-md"><div v-for="worker in allSummary" :key="worker.id" class="worker-card" @click="selectWorker(worker)"><div class="row items-center"><div class="col"><div class="text-bold">{{worker.name}}</div><div class="text-caption text-grey-7">ID: {{worker.id}}</div></div><div class="text-right"><div class="text-bold" :class="worker.balance>=0?\'balance-positive\':\'balance-negative\'">{{worker.balance}} Kč</div><div class="text-caption">Vyděleno: {{worker.totalEarnings}} Kč</div></div></div></div></div><div v-if="adminTab===\'detail\'&&selectedWorkerData" class="q-pt-md"><q-btn flat icon="arrow_back" label="Zpět" @click="backToWorkers" class="q-mb-md"/><div class="summary-box"><div class="text-h6 q-mb-md">{{selectedWorkerData.info.name}}</div><div class="summary-item"><span class="summary-label">Vyděleno:</span><span class="summary-value">{{selectedWorkerData.info.totalEarnings}} Kč</span></div><div class="summary-item"><span class="summary-label">Vyplaceno:</span><span class="summary-value">{{selectedWorkerData.info.totalPaid}} Kč</span></div><div class="summary-item"><span class="summary-label">Zůstatek:</span><span :class="selectedWorkerData.info.balance>=0?\'balance-positive\':\'balance-negative\'">{{selectedWorkerData.info.balance}} Kč</span></div></div><q-tabs v-model="summaryTab" dense class="q-mt-md"><q-tab name="records" label="Záznamy"/><q-tab name="advances" label="Zálohy"/></q-tabs><div v-if="summaryTab===\'records\'" class="q-mt-md"><div v-for="(record,idx) in selectedWorkerData.records" :key="idx" class="record-card"><div class="row items-center"><div class="col"><div class="text-bold">{{record[0]}}</div><div class="text-caption text-grey-7">{{record[3]}}</div></div><div class="text-right"><div class="text-bold text-primary">{{record[7].toFixed(2)}} hod</div><div class="text-caption">{{record[2]}} Kč/hod</div></div></div><div class="text-caption text-grey-7 q-mt-sm">{{formatTimeRange(record[4],record[5])}}</div><div v-if="record[8]" class="note-display">💬 {{record[8]}}</div></div></div><div v-if="summaryTab===\'advances\'" class="q-mt-md"><div v-for="(advance,idx) in selectedWorkerData.advances" :key="idx" class="record-card"><div class="row items-center"><div class="col"><div class="text-bold">{{advance[5]}}</div></div><div class="text-right text-bold text-primary">{{advance[4]}} Kč</div></div><div class="text-caption text-grey-7 q-mt-sm">{{formatShortDateTime(advance[1])}}</div></div></div></div><div v-if="adminTab===\'day\'" class="q-pt-md"><div class="row q-gutter-sm q-mb-md"><q-btn :color="adminDayView===\'today\'?\'primary\':\'grey-5\'" label="Dnes" @click="adminDayView=\'today\'" class="col"/><q-btn :color="adminDayView===\'date\'?\'primary\':\'grey-5\'" label="Datum" @click="adminDayView=\'date\'" class="col"/></div><div v-if="adminDayView===\'date\'" class="q-mb-md"><q-input v-model="selectedDate" label="Vyberte datum" type="date" outlined :model-value="formatDateForInput(selectedDate)" @update:model-value="selectedDate=formatDateFromInput($event)"/></div><div class="text-h6 q-mb-md">{{adminDayView===\'today\'?getTodayDate():selectedDate}}</div><div v-if="dayRecords.length===0" class="text-center text-grey-7 q-mt-lg">Žádné záznamy pro tento den</div><div v-for="(record,idx) in dayRecords" :key="idx" class="record-card"><div class="row items-center"><div class="col"><div class="text-bold">{{record[6]}}</div><div class="text-caption">{{record[0]}} • {{record[3]}}</div></div><div class="text-right"><div class="text-bold text-primary">{{record[7].toFixed(2)}} hod</div></div></div><div class="text-caption text-grey-7 q-mt-sm">{{formatTimeRange(record[4],record[5])}}</div><div v-if="record[8]" class="note-display">💬 {{record[8]}}</div></div></div></div>'
});
