// summary.js - Evidence práce 2026
// v2026-02-23 - Oprava: record[7].toFixed → parseFloat
// v2026-02-28 - přidán výběr datumu od/do s filtrováním všech záložek
//              - nic jsem nesmazal, pouze přidal nové funkce

window.app.component('summary-component', {
  props: ['summary', 'records', 'advances', 'lunches'],
  
  data() {
    return {
      tab: 'records',
      dateFrom: '',
      dateTo: '',
      csLocale: {
        days: ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'],
        daysShort: ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'],
        months: ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'],
        monthsShort: ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'],
        firstDayOfWeek: 1
      }
    }
  },

  computed: {
    fromTs() {
      if (!this.dateFrom) return null;
      const p = this.dateFrom.split('. ');
      return new Date(p[2], p[1] - 1, p[0], 0, 0, 0).getTime();
    },
    toTs() {
      if (!this.dateTo) return null;
      const p = this.dateTo.split('. ');
      return new Date(p[2], p[1] - 1, p[0], 23, 59, 59).getTime();
    },
    filteredRecords() {
      return this.records.filter(r => {
        const ts = Number(r[4]);
        if (this.fromTs && ts < this.fromTs) return false;
        if (this.toTs && ts > this.toTs) return false;
        return true;
      });
    },
    filteredLunches() {
      return this.lunches.filter(r => {
        const ts = Number(r[1]);
        if (this.fromTs && ts < this.fromTs) return false;
        if (this.toTs && ts > this.toTs) return false;
        return true;
      });
    },
    filteredAdvances() {
      return this.advances.filter(r => {
        const ts = Number(r[1]);
        if (this.fromTs && ts < this.fromTs) return false;
        if (this.toTs && ts > this.toTs) return false;
        return true;
      });
    },
    filteredEarnings() {
      return this.filteredRecords.reduce((sum, r) => sum + Math.round((parseFloat(r[2]) || 0) * (parseFloat(r[7]) || 0)), 0);
    },
    filteredPaid() {
      return this.filteredAdvances.reduce((sum, a) => sum + (parseFloat(a[4]) || 0), 0)
           + this.filteredLunches.reduce((sum, l) => sum + (parseFloat(l[4]) || 0), 0);
    },
    filteredBalance() {
      return this.filteredEarnings - this.filteredPaid;
    },
    isFiltered() {
      return !!this.dateFrom || !!this.dateTo;
    }
  },
  
  methods: {
    formatTimeRange(fr, to) { if (typeof window.formatTimeRange === "function") return window.formatTimeRange(fr, to); const d = new Date(Number(fr)); const pad = n => String(n).padStart(2,"0"); const e = to ? new Date(Number(to)) : null; const dateStr = pad(d.getDate())+". "+pad(d.getMonth()+1)+". "+d.getFullYear()+" "+pad(d.getHours())+":"+pad(d.getMinutes()); return e ? dateStr+" - "+pad(e.getHours())+":"+pad(e.getMinutes()) : dateStr; },
    formatShortDateTime(ts) { return formatShortDateTime(ts); },
    calculateEarnings(record) {
      return Math.round((parseFloat(record[2]) || 0) * (parseFloat(record[7]) || 0));
    },
    clearFilter() {
      this.dateFrom = '';
      this.dateTo = '';
    }
  },
  
  template: `
    <div>
      <!-- FILTR DATUMU -->
      <q-card flat bordered class="q-mb-md">
        <q-card-section class="q-pa-sm">
          <div class="row q-gutter-xs items-center">
            <div class="col">
              <q-input v-model="dateFrom" label="Od" outlined dense readonly>
                <template v-slot:append>
                  <q-icon name="event" class="cursor-pointer" color="primary">
                    <q-popup-proxy cover ref="fromProxy">
                      <q-date v-model="dateFrom" mask="DD. MM. YYYY" :locale="csLocale"
                        @update:model-value="$refs.fromProxy.hide()"/>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <div class="col">
              <q-input v-model="dateTo" label="Do" outlined dense readonly>
                <template v-slot:append>
                  <q-icon name="event" class="cursor-pointer" color="primary">
                    <q-popup-proxy cover ref="toProxy">
                      <q-date v-model="dateTo" mask="DD. MM. YYYY" :locale="csLocale"
                        @update:model-value="$refs.toProxy.hide()"/>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <q-btn v-if="isFiltered" flat dense round icon="clear" color="grey-7" @click="clearFilter">
              <q-tooltip>Zrušit filtr</q-tooltip>
            </q-btn>
          </div>
          <div v-if="isFiltered" class="text-caption text-primary q-mt-xs q-ml-xs">
            Zobrazeno: {{ filteredRecords.length }} směn, {{ filteredLunches.length }} obědů, {{ filteredAdvances.length }} záloh
          </div>
        </q-card-section>
      </q-card>

      <q-tabs v-model="tab" dense align="justify" class="text-primary q-mb-md">
        <q-tab name="records" label="Směny"/>
        <q-tab name="lunches" label="Obědy"/>
        <q-tab name="advances" label="Zálohy"/>
        <q-tab name="summary" label="Souhrn"/>
      </q-tabs>
      
      <!-- SOUHRN -->
      <div v-if="tab==='summary'" class="summary-box">
        <div v-if="isFiltered" class="text-caption text-primary q-mb-sm">Filtrované období</div>
        <div class="summary-item">
          <span class="summary-label">Vyděleno:</span>
          <span class="summary-value">{{ isFiltered ? filteredEarnings : summary.totalEarnings }} Kč</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Vyplaceno:</span>
          <span class="summary-value">{{ isFiltered ? filteredPaid : summary.totalPaid }} Kč</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Zůstatek:</span>
          <span :class="(isFiltered ? filteredBalance : summary.balance) >= 0 ? 'balance-positive' : 'balance-negative'">
            {{ isFiltered ? filteredBalance : summary.balance }} Kč
          </span>
        </div>
      </div>
      
      <!-- SMĚNY -->
      <div v-if="tab==='records'">
        <div v-if="filteredRecords.length===0" class="text-center text-grey-7 q-mt-lg">
          Zatím žádné záznamy
        </div>
        <div v-for="(record,idx) in filteredRecords" :key="idx" class="record-card">
          <div class="row items-center">
            <div class="col">
              <div class="text-bold">{{ record[0] }}</div>
              <div class="text-caption text-grey-7">{{ record[3] }} • {{ record[14] || 'Nezadáno' }}</div>
            </div>
            <div class="text-right">
              <div class="text-bold text-primary">{{ (parseFloat(record[7]) || 0).toFixed(2) }} hod</div>
              <div class="text-caption">Vydělal: {{ calculateEarnings(record) }} Kč</div>
            </div>
          </div>
          <div class="text-caption text-grey-7 q-mt-sm">{{ formatTimeRange(record[4], record[5]) }}</div>
          <div v-if="record[12] > 0" class="text-caption text-orange q-mt-xs">🚗 {{ record[12] }} km</div>
          <div v-if="record[8]" class="note-display">💬 {{ record[8] }}</div>
        </div>
      </div>
      
      <!-- OBĚDY -->
      <div v-if="tab==='lunches'">
        <div v-if="filteredLunches.length===0" class="text-center text-grey-7 q-mt-lg">
          Zatím žádné obědy
        </div>
        <div v-for="(lunch,idx) in filteredLunches" :key="idx" class="record-card">
          <div class="row items-center">
            <div class="col">
              <div class="text-bold">Oběd</div>
              <div class="text-caption text-grey-7">{{ formatShortDateTime(lunch[1]) }}</div>
            </div>
            <div class="text-right text-bold text-orange">{{ lunch[4] }} Kč</div>
          </div>
        </div>
      </div>
      
      <!-- ZÁLOHY -->
      <div v-if="tab==='advances'">
        <div v-if="filteredAdvances.length===0" class="text-center text-grey-7 q-mt-lg">
          Zatím žádné zálohy
        </div>
        <div v-for="(advance,idx) in filteredAdvances" :key="idx" class="record-card">
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
