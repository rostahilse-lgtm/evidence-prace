// statistics.js
// v2026-02-28 - přepracováno: dva panely (záznamy + souhrn), oprava formatTimeRange
//              - pro kluky: vlastní hodiny, výdělek, dny, hala/stavba
//              - nic jsem nesmazal, pouze přepracoval zobrazení

window.app.component('statistics-component', {
  props: ['allRecords', 'contracts', 'jobs', 'places', 'allAdvances'],
  emits: ['message'],
  
  data() {
    return {
      tab: 'records',
      filters: {
        contracts: [],
        jobs: [],
        workers: [],
        dateFrom: null,
        dateTo: null,
      },
      workers: [],
      filteredRecords: [],
      showResults: false,
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
    contractOptions() {
      return this.contracts.map(c => ({ label: c[0] + ' - ' + c[1], value: c[0] }));
    },
    jobOptions() {
      return this.jobs.map(j => ({ label: j[1], value: j[0] }));
    },
    workerOptions() {
      return this.workers.map(w => ({ label: w[1], value: w[0] }));
    },

    // SOUHRN - počty
    totalHours() {
      return this.filteredRecords.reduce((s, r) => s + (parseFloat(r[7]) || 0), 0);
    },
    totalEarnings() {
      return Math.round(this.filteredRecords.reduce((s, r) => s + (parseFloat(r[2]) || 0) * (parseFloat(r[7]) || 0), 0));
    },
    // Unikátní dny
    uniqueDays() {
      const days = new Set();
      this.filteredRecords.forEach(r => {
        const d = new Date(Number(r[4]));
        days.add(`${d.getDate()}.${d.getMonth()}.${d.getFullYear()}`);
      });
      return days.size;
    },
    // Dny na hale (místo obsahuje "hala")
    halaDays() {
      const days = new Set();
      this.filteredRecords.filter(r => String(r[14] || '').toLowerCase().includes('hala')).forEach(r => {
        const d = new Date(Number(r[4]));
        days.add(`${d.getDate()}.${d.getMonth()}.${d.getFullYear()}`);
      });
      return days.size;
    },
    // Dny na stavbě (místo obsahuje "stavba")
    stavbaDays() {
      const days = new Set();
      this.filteredRecords.filter(r => String(r[14] || '').toLowerCase().includes('stavba')).forEach(r => {
        const d = new Date(Number(r[4]));
        days.add(`${d.getDate()}.${d.getMonth()}.${d.getFullYear()}`);
      });
      return days.size;
    },
    // Počet cest (záznamy kde km > 0)
    tripCount() {
      return this.filteredRecords.filter(r => (parseFloat(r[12]) || 0) > 0).length;
    },
    // Přehled hodin podle zakázky
    byContract() {
      const map = {};
      this.filteredRecords.forEach(r => {
        const key = r[0];
        if (!map[key]) map[key] = { name: r[0], hours: 0, earnings: 0 };
        map[key].hours += parseFloat(r[7]) || 0;
        map[key].earnings += (parseFloat(r[2]) || 0) * (parseFloat(r[7]) || 0);
      });
      return Object.values(map).sort((a, b) => b.hours - a.hours);
    },
    // Přehled hodin podle práce
    byJob() {
      const map = {};
      this.filteredRecords.forEach(r => {
        const key = r[3];
        if (!map[key]) map[key] = { name: r[3], hours: 0 };
        map[key].hours += parseFloat(r[7]) || 0;
      });
      return Object.values(map).sort((a, b) => b.hours - a.hours);
    }
  },
  
  methods: {
    fmt(ts) { return formatTimeRange ? formatTimeRange(ts, null).split(' ')[0] + ' ' + formatTimeRange(ts, null).split(' ')[1] : ''; },
    formatRange(fr, to) {
      if (typeof formatTimeRange === 'function') return formatTimeRange(fr, to);
      const d = new Date(Number(fr));
      const pad = n => String(n).padStart(2, '0');
      return `${pad(d.getDate())}. ${pad(d.getMonth()+1)}. ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },
    formatDateTime(ts) {
      if (typeof formatShortDateTime === 'function') return formatShortDateTime(ts);
      const d = new Date(Number(ts));
      const pad = n => String(n).padStart(2, '0');
      return `${pad(d.getDate())}. ${pad(d.getMonth()+1)}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    async loadWorkers() {
      const res = await apiCall('get', { type: 'workers' });
      if (res.code === '000' && res.data) this.workers = res.data;
    },
    
    applyFilters() {
      let filtered = [...this.allRecords];

      if (this.filters.contracts.length > 0) {
        const names = this.filters.contracts.map(id => {
          const c = this.contracts.find(c => c[0] === id);
          return c ? c[1] : null;
        }).filter(Boolean);
        if (names.length) filtered = filtered.filter(r => names.includes(r[0]));
      }

      if (this.filters.jobs.length > 0) {
        const names = this.filters.jobs.map(id => {
          const j = this.jobs.find(j => j[0] === id);
          return j ? j[1] : null;
        }).filter(Boolean);
        if (names.length) filtered = filtered.filter(r => names.includes(r[3]));
      }

      if (this.filters.workers.length > 0) {
        filtered = filtered.filter(r => this.filters.workers.includes(r[1]));
      }

      if (this.filters.dateFrom) {
        const p = this.filters.dateFrom.split('. ');
        const from = new Date(p[2], p[1]-1, p[0]);
        filtered = filtered.filter(r => new Date(Number(r[4])) >= from);
      }
      if (this.filters.dateTo) {
        const p = this.filters.dateTo.split('. ');
        const to = new Date(p[2], p[1]-1, p[0], 23, 59, 59);
        filtered = filtered.filter(r => new Date(Number(r[4])) <= to);
      }

      this.filteredRecords = filtered;
      this.showResults = true;
      this.tab = 'summary';
      this.$emit('message', `Nalezeno ${filtered.length} záznamů`);
    },
    
    resetFilters() {
      this.filters = { contracts: [], jobs: [], workers: [], dateFrom: null, dateTo: null };
      this.filteredRecords = [];
      this.showResults = false;
    },
    
    exportCSV() {
      if (!this.filteredRecords.length) { this.$emit('message', 'Nejdříve aplikujte filtry'); return; }
      let csv = 'Zakázka;Pracovník;Kč/hod;Práce;Datum;Hodiny;Výdělek;Poznámka;Km;Místo\n';
      this.filteredRecords.forEach(r => {
        const d = new Date(Number(r[4]));
        const datum = `${String(d.getDate()).padStart(2,'0')}. ${String(d.getMonth()+1).padStart(2,'0')}. ${d.getFullYear()}`;
        const hodin = (parseFloat(r[7]) || 0).toFixed(2);
        const vydelek = Math.round((parseFloat(r[2]) || 0) * (parseFloat(r[7]) || 0));
        csv += [r[0], r[6], r[2], r[3], datum, hodin, vydelek, r[8]||'', r[12]||0, r[14]||''].map(c => `"${c}"`).join(';') + '\n';
      });
      csv += '\n"SOUHRN"\n';
      csv += `"Celkem hodin";"${this.totalHours.toFixed(2)}"\n`;
      csv += `"Celkem výdělek";"${this.totalEarnings} Kč"\n`;
      csv += `"Odpracovaných dní";"${this.uniqueDays}"\n`;
      csv += `"Dní na hale";"${this.halaDays}"\n`;
      csv += `"Dní na stavbě";"${this.stavbaDays}"\n`;
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `statistiky_${Date.now()}.csv`; a.click();
      this.$emit('message', '✓ Export dokončen');
    }
  },
  
  async mounted() {
    await this.loadWorkers();
  },
  
  template: `
    <div class="q-pa-sm">
      <!-- FILTRY -->
      <q-card flat bordered class="q-mb-md">
        <q-card-section class="q-pa-sm">
          <div class="text-subtitle2 q-mb-sm">🔍 Filtry</div>

          <q-select v-model="filters.contracts" :options="contractOptions"
            label="Zakázky" emit-value map-options multiple outlined dense use-chips class="q-mb-sm"/>

          <q-select v-model="filters.jobs" :options="jobOptions"
            label="Práce" emit-value map-options multiple outlined dense use-chips class="q-mb-sm"/>

          <q-select v-if="workerOptions.length > 1" v-model="filters.workers" :options="workerOptions"
            label="Pracovníci" emit-value map-options multiple outlined dense use-chips class="q-mb-sm"/>

          <div class="row q-gutter-xs q-mb-sm">
            <div class="col">
              <q-input v-model="filters.dateFrom" label="Od" outlined dense readonly>
                <template v-slot:append>
                  <q-icon name="event" class="cursor-pointer" color="primary">
                    <q-popup-proxy cover ref="fromProxy">
                      <q-date v-model="filters.dateFrom" mask="DD. MM. YYYY" :locale="csLocale"
                        @update:model-value="$refs.fromProxy.hide()"/>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <div class="col">
              <q-input v-model="filters.dateTo" label="Do" outlined dense readonly>
                <template v-slot:append>
                  <q-icon name="event" class="cursor-pointer" color="primary">
                    <q-popup-proxy cover ref="toProxy">
                      <q-date v-model="filters.dateTo" mask="DD. MM. YYYY" :locale="csLocale"
                        @update:model-value="$refs.toProxy.hide()"/>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>

          <div class="row q-gutter-xs">
            <q-btn label="Použít filtry" color="primary" icon="filter_list" @click="applyFilters" class="col" unelevated/>
            <q-btn label="Zrušit" color="grey" outline @click="resetFilters"/>
          </div>
        </q-card-section>
      </q-card>

      <!-- VÝSLEDKY -->
      <div v-if="showResults">
        <q-tabs v-model="tab" dense align="justify" class="text-primary q-mb-md">
          <q-tab name="summary" label="Souhrn"/>
          <q-tab name="records" :label="'Záznamy (' + filteredRecords.length + ')'"/>
        </q-tabs>

        <!-- SOUHRN -->
        <div v-if="tab === 'summary'">
          <!-- Hlavní čísla -->
          <div class="row q-gutter-sm q-mb-md">
            <q-card class="col text-center" flat bordered>
              <q-card-section class="q-pa-sm">
                <div class="text-caption text-grey-7">Celkem hodin</div>
                <div class="text-h5 text-primary">{{ totalHours.toFixed(1) }}h</div>
              </q-card-section>
            </q-card>
            <q-card class="col text-center" flat bordered>
              <q-card-section class="q-pa-sm">
                <div class="text-caption text-grey-7">Výdělek</div>
                <div class="text-h5 text-green">{{ totalEarnings }} Kč</div>
              </q-card-section>
            </q-card>
          </div>

          <div class="row q-gutter-sm q-mb-md">
            <q-card class="col text-center" flat bordered>
              <q-card-section class="q-pa-sm">
                <div class="text-caption text-grey-7">Odprac. dní</div>
                <div class="text-h5">{{ uniqueDays }}</div>
              </q-card-section>
            </q-card>
            <q-card class="col text-center" flat bordered style="background:#e3f2fd">
              <q-card-section class="q-pa-sm">
                <div class="text-caption text-grey-7">Dní hala</div>
                <div class="text-h5 text-blue">{{ halaDays }}</div>
              </q-card-section>
            </q-card>
            <q-card class="col text-center" flat bordered style="background:#e8f5e9">
              <q-card-section class="q-pa-sm">
                <div class="text-caption text-grey-7">Dní stavba</div>
                <div class="text-h5 text-green-8">{{ stavbaDays }}</div>
              </q-card-section>
            </q-card>
          </div>

          <!-- Podle zakázky -->
          <div class="text-subtitle2 q-mb-xs q-mt-md">Podle zakázky</div>
          <q-card flat bordered class="q-mb-md">
            <div v-for="item in byContract" :key="item.name" class="row items-center q-pa-xs q-px-sm" style="border-bottom:1px solid #f0f0f0">
              <div class="col text-caption">{{ item.name }}</div>
              <div class="text-caption text-primary q-mr-md">{{ item.hours.toFixed(1) }}h</div>
              <div class="text-caption text-green">{{ Math.round(item.earnings) }} Kč</div>
            </div>
          </q-card>

          <!-- Podle práce -->
          <div class="text-subtitle2 q-mb-xs">Podle druhu práce</div>
          <q-card flat bordered class="q-mb-md">
            <div v-for="item in byJob" :key="item.name" class="row items-center q-pa-xs q-px-sm" style="border-bottom:1px solid #f0f0f0">
              <div class="col text-caption">{{ item.name }}</div>
              <div class="text-caption text-primary">{{ item.hours.toFixed(1) }}h</div>
            </div>
          </q-card>

          <q-btn label="Exportovat CSV" color="green" icon="download" @click="exportCSV" class="full-width" unelevated/>
        </div>

        <!-- ZÁZNAMY -->
        <div v-if="tab === 'records'">
          <div v-if="filteredRecords.length === 0" class="text-center text-grey-7 q-mt-lg">
            Žádné záznamy
          </div>
          <div v-for="(r, idx) in filteredRecords" :key="idx" class="record-card">
            <div class="row items-center">
              <div class="col">
                <div class="text-bold">{{ r[0] }}</div>
                <div class="text-caption text-grey-7">{{ r[3] }} • {{ r[14] || 'Nezadáno' }}</div>
              </div>
              <div class="text-right">
                <div class="text-bold text-primary">{{ (parseFloat(r[7]) || 0).toFixed(2) }}h</div>
                <div class="text-caption text-green">{{ Math.round((parseFloat(r[2])||0)*(parseFloat(r[7])||0)) }} Kč</div>
              </div>
            </div>
            <div class="text-caption text-grey-7 q-mt-xs">{{ formatRange(r[4], r[5]) }}</div>
            <div v-if="r[12] > 0" class="text-caption text-orange">🚗 {{ r[12] }} km</div>
            <div v-if="r[8]" class="note-display">💬 {{ r[8] }}</div>
          </div>
        </div>
      </div>
    </div>
  `
});
