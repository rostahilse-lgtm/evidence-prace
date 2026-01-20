app.component('admin-component', {
  props: ['allSummary', 'allRecords', 'allAdvances', 'contracts', 'jobs', 'loading'],
  emits: ['message', 'reload'],
  
  data() {
    return {
      adminTab: 'workers',
      selectedWorkerData: null,
      summaryTab: 'records',
      dayRecords: [],
      adminDayView: 'today',
      selectedDate: getTodayDate(),
      editDialog: false,
      editingRecord: null,
      editForm: { contractId: null, jobId: null, timeFr: null, timeTo: null, note: '' }
    }
  },
  
  computed: {
    contractOptions() {
      return this.contracts.map(c => ({ label: c[0] + ' - ' + c[1], value: c[0] }));
    },
    jobOptions() {
      return this.jobs.map(j => ({ label: j[1], value: j[0] }));
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
      if (res.data) this.dayRecords = res.data.sort((a, b) => a[4] - b[4]);
    },
    
    openEditDialog(record, index) {
      this.editingRecord = { data: record, index: index };
      const contract = this.contracts.find(c => c[1] === record[0]);
      const job = this.jobs.find(j => j[1] === record[3]);
      this.editForm = {
        contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null,
        timeFr: record[4],
        timeTo: record[5],
        note: record[8]
      };
      this.editDialog = true;
    },
    
    async saveEdit() {
      if (!this.editForm.contractId || !this.editForm.jobId || !this.editForm.timeFr || !this.editForm.timeTo) {
        this.$emit('message', 'Vyplňte všechna pole');
        return;
      }
      try {
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
      } catch (error) {
        this.$emit('message', 'Chyba při úpravě');
      }
    },
    
    async deleteRecord(index) {
      if (!confirm('Opravdu smazat záznam?')) return;
      try {
        const res = await apiCall('deleterecord', { row_index: index });
        if (res.code === '000') {
          this.$emit('message', '✓ Záznam smazán');
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + res.error);
        }
      } catch (error) {
        this.$emit('message', 'Chyba při mazání');
      }
    },
    
    formatTimeRange(fr, to) { return formatTimeRange(fr, to); },
    formatShortDateTime(ts) { return formatShortDateTime(ts); },
    getTodayDate() { return getTodayDate(); },
    formatDateForInput(s) { return formatDateForInput(s); },
    formatDateFromInput(i) { return formatDateFromInput(i); }
  },
  
  watch: {
    adminDayView() { if (this.adminTab === 'day') this.loadDayRecords(); },
    selectedDate() { if (this.adminTab === 'day') this.loadDayRecords(); }
  },
  
  mounted() {
    if (this.adminTab === 'day') this.loadDayRecords();
  },
  
  template: '<div><q-tabs v-model="adminTab" dense align="justify" class="text-primary"><q-tab name="workers" label="Pracovníci"/><q-tab name="day" label="Přehled dne"/></q-tabs><div v-if="adminTab===\'workers\'" class="q-pt-md"><div v-for="worker in allSummary" :key="worker.id" class="worker-card" @click="selectWorker(worker)"><div class="row items-center"><div class="col"><div class="text-bold">{{worker.name}}</div><div class="text-caption text-grey-7">ID: {{worker.id}}</div></div><div class="text-right"><div class="text-bold" :class="worker.balance>=0?\'balance-positive\':\'balance-negative\'">{{worker.balance}} Kč</div><div class="text-caption">Vyděleno: {{worker.totalEarnings}} Kč</div></div></div></div></div><div v-if="adminTab===\'detail\'&&selectedWorkerData" class="q-pt-md"><q-btn flat icon="arrow_back" label="Zpět" @click="backToWorkers" class="q-mb-md"/><div class="summary-box"><div class="text-h6 q-mb-md">{{selectedWorkerData.info.name}}</div><div class="summary-item"><span class="summary-label">Vyděleno:</span><span class="summary-value">{{selectedWorkerData.info.totalEarnings}} Kč</span></div><div class="summary-item"><span class="summary-label">Vyplaceno:</span><span class="summary-value">{{selectedWorkerData.info.totalPaid}} Kč</span></div><div class="summary-item"><span class="summary-label">Zůstatek:</span><span :class="selectedWorkerData.info.balance>=0?\'balance-positive\':\'balance-negative\'">{{selectedWorkerData.info.balance}} Kč</span></div></div><q-tabs v-model="summaryTab" dense class="q-mt-md"><q-tab name="records" label="Záznamy"/><q-tab name="advances" label="Zálohy"/></q-tabs><div v-if="summaryTab===\'records\'" class="q-mt-md"><div v-for="(record,idx) in selectedWorkerData.records" :key="idx" class="record-card"><div class="row items-center"><div class="col"><div class="text-bold">{{record[0]}}</div><div class="text-caption text-grey-7">{{record[3]}}</div></div><div class="text-right"><div class="text-bold text-primary">{{record[7].toFixed(2)}} hod</div><div class="text-caption">{{record[2]}} Kč/hod</div></div><q-icon name="edit" class="edit-icon q-ml-sm" @click="openEditDialog(record,idx)"/></div><div class="text-caption text-grey-7 q-mt-sm">{{formatTimeRange(record[4],record[5])}}</div><div v-if="record[8]" class="note-display">💬 {{record[8]}}</div></div></div><div v-if="summaryTab===\'advances\'" class="q-mt-md"><div v-for="(advance,idx) in selectedWorkerData.advances" :key="idx" class="record-card"><div class="row items-center"><div class="col"><div class="text-bold">{{advance[5]}}</div></div><div class="text-right text-bold text-primary">{{advance[4]}} Kč</div></div><div class="text-caption text-grey-7 q-mt-sm">{{formatShortDateTime(advance[1])}}</div></div></div></div><div v-if="adminTab===\'day\'" class="q-pt-md"><div class="row q-gutter-sm q-mb-md"><q-btn :color="adminDayView===\'today\'?\'primary\':\'grey-5\'" label="Dnes" @click="adminDayView=\'today\';loadDayRecords()" class="col"/><q-btn :color="adminDayView===\'date\'?\'primary\':\'grey-5\'" label="Datum" @click="adminDayView=\'date\'" class="col"/></div><div v-if="adminDayView===\'date\'" class="q-mb-md"><q-input v-model="selectedDate" label="Vyberte datum" type="date" outlined :model-value="formatDateForInput(selectedDate)" @update:model-value="selectedDate=formatDateFromInput($event)"/></div><div class="text-h6 q-mb-md">{{adminDayView===\'today\'?getTodayDate():selectedDate}}</div><div v-if="dayRecords.length===0" class="text-center text-grey-7 q-mt-lg">Žádné záznamy pro tento den</div><div v-for="(record,idx) in dayRecords" :key="idx" class="record-card"><div class="row items-center"><div class="col"><div class="text-bold">{{record[6]}}</div><div class="text-caption">{{record[0]}} • {{record[3]}}</div></div><div class="text-right"><div class="text-bold text-primary">{{record[7].toFixed(2)}} hod</div></div><q-icon name="edit" class="edit-icon q-ml-sm" @click="openEditDialog(record,idx)"/></div><div class="text-caption text-grey-7 q-mt-sm">{{formatTimeRange(record[4],record[5])}}</div><div v-if="record[8]" class="note-display">💬 {{record[8]}}</div></div></div><q-dialog v-model="editDialog"><q-card style="min-width:350px"><q-card-section><div class="text-h6">Upravit záznam</div></q-card-section><q-card-section class="q-pt-none"><q-select v-model="editForm.contractId" :options="contractOptions" label="Zakázka" emit-value map-options outlined class="q-mb-md"/><q-select v-model="editForm.jobId" :options="jobOptions" label="Práce" emit-value map-options outlined class="q-mb-md"/><div class="row q-gutter-sm q-mb-md"><div class="col"><q-input v-model="editForm.timeFr" label="Čas od" type="datetime-local" outlined dense :model-value="new Date(editForm.timeFr).toISOString().slice(0,16)" @update:model-value="editForm.timeFr=new Date($event).getTime()"/></div><div class="col"><q-input v-model="editForm.timeTo" label="Čas do" type="datetime-local" outlined dense :model-value="new Date(editForm.timeTo).toISOString().slice(0,16)" @update:model-value="editForm.timeTo=new Date($event).getTime()"/></div></div><q-input v-model="editForm.note" label="Poznámka" outlined type="textarea" rows="2"/></q-card-section><q-card-actions align="right"><q-btn flat label="Storno" color="red" v-close-popup/><q-btn flat label="Přepsat" color="green" @click="saveEdit" :loading="loading"/></q-card-actions></q-card></q-dialog></div>'
});
