window.app.component('summary-component', {
  props: ['summary', 'records', 'advances', 'lunches'],
  
  data() {
    return {
      tab: 'records'
    }
  },
  
  methods: {
    formatTimeRange(fr, to) {
      return formatTimeRange(fr, to);
    },
    formatShortDateTime(ts) {
      return formatShortDateTime(ts);
    },
    calculateEarnings(record) {
      const rate = parseFloat(record[2]) || 0;
      const hours = parseFloat(record[7]) || 0;
      return Math.round(rate * hours);
    }
  },
  
  template: `
    <div>
      <q-tabs v-model="tab" dense align="justify" class="text-primary q-mb-md">
        <q-tab name="records" label="Směny"/>
        <q-tab name="lunches" label="Obědy"/>
        <q-tab name="advances" label="Zálohy"/>
        <q-tab name="summary" label="Souhrn"/>
      </q-tabs>
      
      <div v-if="tab==='summary'" class="summary-box">
        <div class="summary-item">
          <span class="summary-label">Vyděleno:</span>
          <span class="summary-value">{{ summary.totalEarnings }} Kč</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Vyplaceno:</span>
          <span class="summary-value">{{ summary.totalPaid }} Kč</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Zůstatek:</span>
          <span :class="summary.balance>=0?'balance-positive':'balance-negative'">
            {{ summary.balance }} Kč
          </span>
        </div>
      </div>
      
      <div v-if="tab==='records'">
        <div v-if="records.length===0" class="text-center text-grey-7 q-mt-lg">
          Zatím žádné záznamy
        </div>
        <div v-for="(record,idx) in records" :key="idx" class="record-card">
          <div class="row items-center">
            <div class="col">
              <div class="text-bold">{{ record[0] }}</div>
              <div class="text-caption text-grey-7">{{ record[3] }} • {{ record[14] || 'Nezadáno' }}</div>
            </div>
            <div class="text-right">
              <div class="text-bold text-primary">{{ record[7].toFixed(2) }} hod</div>
              <div class="text-caption">Vydělal: {{ calculateEarnings(record) }} Kč</div>
            </div>
          </div>
          <div class="text-caption text-grey-7 q-mt-sm">
            {{ formatTimeRange(record[4], record[5]) }}
          </div>
          <div v-if="record[12] > 0" class="text-caption text-orange q-mt-xs">
            🚗 {{ record[12] }} km
          </div>
          <div v-if="record[8]" class="note-display">💬 {{ record[8] }}</div>
        </div>
      </div>
      
      <div v-if="tab==='lunches'">
        <div v-if="lunches.length===0" class="text-center text-grey-7 q-mt-lg">
          Zatím žádné obědy
        </div>
        <div v-for="(lunch,idx) in lunches" :key="idx" class="record-card">
          <div class="row items-center">
            <div class="col">
              <div class="text-bold">Oběd</div>
              <div class="text-caption text-grey-7">{{ formatShortDateTime(lunch[1]) }}</div>
            </div>
            <div class="text-right text-bold text-orange">{{ lunch[4] }} Kč</div>
          </div>
        </div>
      </div>
      
      <div v-if="tab==='advances'">
        <div v-if="advances.length===0" class="text-center text-grey-7 q-mt-lg">
          Zatím žádné zálohy
        </div>
        <div v-for="(advance,idx) in advances" :key="idx" class="record-card">
          <div class="row items-center">
            <div class="col">
              <div class="text-bold">{{ advance[5] }}</div>
              <div class="text-caption text-grey-7">{{ formatShortDateTime(advance[1]) }}</div>
            </div>
            <div class="text-right text-bold text-primary">{{ advance[4] }} Kč</div>
          </div>
        </div>
      </div>
    </div>
  `
});
