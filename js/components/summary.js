
app.component('summary-component', {
  props: ['summary', 'records', 'advances', 'lunches'],
  emits: ['message'],
  
  data() {
    return {
      summaryTab: 'finances',
      useDateFilter: false,
      dateFrom: getMonthStart(),
      dateTo: getTodayDate()
    }
  },
  
  computed: {
    dateRangeLabel() {
      if (!this.useDateFilter) return 'Od začátku do dneška';
      return `${this.dateFrom} - ${this.dateTo}`;
    },
    
    filteredRecords() {
      if (!this.useDateFilter) return this.records;
      const from = parseDateString(this.dateFrom);
      const to = parseDateString(this.dateTo);
      to.setHours(23, 59, 59);
      return this.records.filter(r => {
        const recordDate = new Date(r[4]);
        return recordDate >= from && recordDate <= to;
      });
    },
    
    filteredAdvances() {
      if (!this.useDateFilter) return this.advances;
      const from = parseDateString(this.dateFrom);
      const to = parseDateString(this.dateTo);
      to.setHours(23, 59, 59);
      return this.advances.filter(a => {
        const advDate = new Date(a[1]);
        return advDate >= from && advDate <= to;
      });
    },
    
    filteredLunches() {
      if (!this.useDateFilter) return this.lunches;
      const from = parseDateString(this.dateFrom);
      const to = parseDateString(this.dateTo);
      to.setHours(23, 59, 59);
      return this.lunches.filter(l => {
        const lunchDate = new Date(l[1]);
        return lunchDate >= from && lunchDate <= to;
      });
    }
  },
  
  template: `
    <div class="tab-content">
      <q-tabs v-model="summaryTab" dense align="justify" class="text-primary">
        <q-tab name="finances" label="Finance"/>
        <q-tab name="records" label="Záznamy"/>
        <q-tab name="lunches" label="Obědy"/>
        <q-tab name="advances" label="Zálohy"/>
      </q-tabs>

      <!-- FILTR PODLE DATA -->
      <div class="date-filter-box q-mt-md">
        <q-checkbox v-model="useDateFilter" label="Filtrovat podle data" class="q-mb-sm"/>
        <div v-if="useDateFilter" class="row q-gutter-sm">
          <div class="col">
            <q-input 
              v-model="dateFrom" 
              label="Od" 
              type="date" 
              outlined 
              dense 
              :model-value="formatDateForInput(dateFrom)" 
              @update:model-value="dateFrom = formatDateFromInput($event)"
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
              @update:model-value="dateTo = formatDateFromInput($event)"
            />
          </div>
        </div>
        <div class="text-caption text-grey-7 q-mt-sm">{{ dateRangeLabel }}</div>
      </div>

      <!-- FINANCE -->
      <div v-if="summaryTab === 'finances'">
        <div class="summary-box">
          <div class="summary-item">
            <span class="summary-label">Vyděleno:</span>
            <span class="summary-value">{{ summary.totalEarnings }} Kč</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Vyplaceno:</span>
            <span class="summary-value">{{ summary.totalPaid }} Kč</span>
          </div>
          <q-separator class="q-my-sm"/>
          <div class="summary-item">
            <span class="summary-label">Zůstatek:</span>
            <span :class="summary.balance >= 0 ? 'balance-positive' : 'balance-negative'">
              {{ summary.balance }} Kč
            </span>
          </div>
        </div>
      </div>

      <!-- ZÁZNAMY -->
      <div v-if="summaryTab === 'records'">
        <div v-if="filteredRecords.length === 0" class="text-center text-grey-7 q-mt-lg">
          Žádné záznamy
        </div>
        <div v-for="record in filteredRecords" :key="record[4]" class="record-card">
          <div class="row items-center">
            <div class="col">
              <div class="text-bold">{{ record[0] }}</div>
              <div class="text-caption text-grey-7">{{ record[3] }}</div>
            </div>
            <div class="text-right">
              <div class="text-bold text-primary">{{ record[7].toFixed(2) }} hod</div>
              <div class="text-caption">{{ record[2] }} Kč/hod</div>
            </div>
          </div>
          <div class="text-caption text-grey-7 q-mt-sm">
            {{ formatTimeRange(record[4], record[5]) }}
          </div>
          <div v-if="record[8]" class="note-display">💬 {{ record[8] }}</div>
        </div>
      </div>

      <!-- OBĚDY -->
      <div v-if="summaryTab === 'lunches'">
        <div v-if="filteredLunches.length === 0" class="text-center text-grey-7 q-mt-lg">
          Žádné obědy
        </div>
        <div v-for="lunch in filteredLunches" :key="lunch[1]" class="record-card">
          <div class="row items-center">
            <div class="col">
              <q-icon name="restaurant" color="orange" size="sm"/>
              <span class="q-ml-sm text-bold">Oběd</span>
            </div>
            <div class="text-right text-bold text-primary">{{ lunch[4] }} Kč</div>
          </div>
          <div class="text-caption text-grey-7 q-mt-sm">
            {{ formatShortDateTime(lunch[1]) }}
          </div>
        </div>
      </div>

      <!-- ZÁLOHY -->
      <div v-if="summaryTab === 'advances'">
        <div v-if="filteredAdvances.length === 0" class="text-center text-grey-7 q-mt-lg">
          Žádné zálohy
        </div>
        <div v-for="advance in filteredAdvances" :key="advance[1]" class="record-card">
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
    </div>
  `
});
