// statistics.js
// v2026-03-04d - NOVÉ: vyhledávání v selectech Zakázky a Práce (use-input)
//              - nic jsem nesmazal
// v2026-09-01 - OPRAVA: 'isAdmin' chybělo v props, proto se filtry "Místa práce"
//             a "Pracovníci" nikdy nezobrazily (ani adminovi) - v-if="isAdmin"
//             vždy vyhodnotil undefined. Doplněno do props.
//             NOVÉ: Statistiky si teď načítají vlastní data se source:'all'
//             (nová appka + historie dohromady), nezávisle na globálním přepínači
//             Nastavení → nová/historie/vše. Díky tomu admin při kontrole vidí
//             vždy kompletní čísla. Props allRecords/allAdvances se už nepoužívají
//             pro výpočty (nahrazeno vlastním načtením ownRecords/ownAdvances),
//             ale ponechány v props kvůli zpětné kompatibilitě s main.js.
//             - nic jiného se neměnilo

window.app.component('statistics-component', {
  props: ['allRecords', 'contracts', 'jobs', 'places', 'allAdvances', 'isAdmin'],
  emits: ['message'],
  
  data() {
    return {
      filters: {
        contracts: [],
        jobs: [],
        places: [],
        workers: [],
        dateFrom: null,
        dateTo: null,
        withKm: null
      },
      workers: [],
      filteredRecords: [],
      customCharge: null,
      showResults: false,
      // v2026-09-01: vlastní data, vždy source:'all'
      ownRecords: [],
      ownAdvances: [],
      dataLoading: false
    }
  },
  
  computed: {
    contractOptions() {
      return [
        { label: '--- Všechny zakázky ---', value: null },
        ...this.contracts.map(c => ({ label: c[0] + ' - ' + c[1], value: c[0] }))
      ];
    },
    
    jobOptions() {
      return [
        { label: '--- Všechny práce ---', value: null },
        ...this.jobs.map(j => ({ label: j[1], value: j[0] }))
      ];
    },
    
    placeOptions() {
      return [
        { label: '--- Všechna místa ---', value: null },
        ...(this.places ? this.places.map(p => ({ label: p[1], value: p[0] })) : [])
      ];
    },
    
    workerOptions() {
      return [
        { label: '--- Všichni pracovníci ---', value: null },
        ...this.workers.map(w => ({ label: w[1], value: w[0] }))
      ];
    },
    
    totalHours() {
      return this.filteredRecords.reduce((sum, r) => sum + (parseFloat(r[7]) || 0), 0).toFixed(2);
    },
    
    totalTrips() {
      return this.filteredRecords.filter(r => (parseFloat(r[12]) || 0) > 0).length;
    },
    
    uniqueWorkers() {
      const workers = new Set(this.filteredRecords.map(r => r[1]));
      return workers.size;
    },
    
    totalKm() {
      return this.filteredRecords.reduce((sum, r) => sum + (parseFloat(r[12]) || 0), 0);
    },
    
    totalCost() {
      return Math.round(this.filteredRecords.reduce((sum, r) => {
        const rate = parseFloat(r[2]) || 0;
        const hours = parseFloat(r[7]) || 0;
        return sum + (rate * hours);
      }, 0));
    },
    
    totalPaid() {
      // v2026-09-01: čte z ownAdvances (vždy 'all'), ne z allAdvances prop
      if (!this.ownAdvances) return 0;
      
      const workerIds = new Set(this.filteredRecords.map(r => String(r[1])));
      
      let dateFrom = null;
      let dateTo = null;
      
      if (this.filters.dateFrom) {
        const parts = this.filters.dateFrom.split('. ');
        dateFrom = new Date(parts[2], parts[1] - 1, parts[0]);
      }
      if (this.filters.dateTo) {
        const parts = this.filters.dateTo.split('. ');
        dateTo = new Date(parts[2], parts[1] - 1, parts[0], 23, 59, 59);
      }
      
      return Math.round(this.ownAdvances.reduce((sum, adv) => {
        if (!workerIds.has(String(adv[0]))) return sum;
        
        if (dateFrom || dateTo) {
          const advDate = new Date(adv[1]);
          if (dateFrom && advDate < dateFrom) return sum;
          if (dateTo && advDate > dateTo) return sum;
        }
        
        return sum + (parseFloat(adv[4]) || 0);
      }, 0));
    },
    
    profit() {
      if (!this.customCharge) return 0;
      return this.customCharge - this.totalCost;
    },
    
    profitMargin() {
      if (!this.customCharge || this.customCharge === 0) return 0;
      return ((this.profit / this.customCharge) * 100).toFixed(1);
    }
  },
  
  methods: {
    // v2026-09-01 NOVÉ: vlastní načtení dat, vždy source:'all'
    async loadAllData() {
      this.dataLoading = true;
      try {
        const [r, a] = await Promise.all([
          apiCall('getallrecords', { source: 'all' }),
          apiCall('getalladvances', { source: 'all' })
        ]);
        if (r.code === '000' && r.data) this.ownRecords = r.data;
        if (a.code === '000' && a.data) this.ownAdvances = a.data;
      } catch (e) {
        this.$emit('message', 'Chyba při načítání dat pro statistiky');
      }
      this.dataLoading = false;
    },

    filterContracts(val, update) {
      update(() => {
        const needle = val.toLowerCase();
        this.contractOptionsFiltered = val === ''
          ? this.contractOptions
          : this.contractOptions.filter(o => o.label.toLowerCase().includes(needle));
      });
    },
    filterJobs(val, update) {
      update(() => {
        const needle = val.toLowerCase();
        this.jobOptionsFiltered = val === ''
          ? this.jobOptions
          : this.jobOptions.filter(o => o.label.toLowerCase().includes(needle));
      });
    },
    filterPlaces(val, update) {
      update(() => {
        const needle = val.toLowerCase();
        this.placeOptionsFiltered = val === ''
          ? this.placeOptions
          : this.placeOptions.filter(o => o.label.toLowerCase().includes(needle));
      });
    },
    filterWorkers(val, update) {
      update(() => {
        const needle = val.toLowerCase();
        this.workerOptionsFiltered = val === ''
          ? this.workerOptions
          : this.workerOptions.filter(o => o.label.toLowerCase().includes(needle));
      });
    },
    async loadWorkers() {
      const res = await apiCall('get', { type: 'workers' });
      if (res.code === '000' && res.data) {
        this.workers = res.data;
      }
    },
    
    applyFilters() {
      // v2026-09-01: filtruje z ownRecords (vždy 'all'), ne z allRecords prop
      let filtered = [...this.ownRecords];
      
      // Filtr zakázek
      if (this.filters.contracts.length > 0) {
        const contractNames = this.filters.contracts
          .filter(id => id !== null)
          .map(id => {
            const contract = this.contracts.find(c => c[0] === id);
            return contract ? contract[1] : null;
          })
          .filter(Boolean);
        
        if (contractNames.length > 0) {
          filtered = filtered.filter(r => contractNames.includes(r[0]));
        }
      }
      
      // Filtr prací
      if (this.filters.jobs.length > 0) {
        const jobNames = this.filters.jobs
          .filter(id => id !== null)
          .map(id => {
            const job = this.jobs.find(j => j[0] === id);
            return job ? job[1] : null;
          })
          .filter(Boolean);
        
        if (jobNames.length > 0) {
          filtered = filtered.filter(r => jobNames.includes(r[3]));
        }
      }
      
      // Filtr míst
      if (this.filters.places.length > 0) {
        const placeNames = this.filters.places
          .filter(id => id !== null)
          .map(id => {
            const place = this.places.find(p => p[0] === id);
            return place ? place[1] : null;
          })
          .filter(Boolean);
        
        if (placeNames.length > 0) {
          filtered = filtered.filter(r => placeNames.includes(r[14]));
        }
      }
      
      // Filtr pracovníků
      if (this.filters.workers.length > 0) {
        const workerIds = this.filters.workers.filter(id => id !== null);
        if (workerIds.length > 0) {
          filtered = filtered.filter(r => workerIds.includes(r[1]));
        }
      }
      
      // Filtr data OD
      if (this.filters.dateFrom) {
        const parts = this.filters.dateFrom.split('. ');
        const dateFrom = new Date(parts[2], parts[1] - 1, parts[0]);
        filtered = filtered.filter(r => new Date(r[4]) >= dateFrom);
      }
      
      // Filtr data DO
      if (this.filters.dateTo) {
        const parts = this.filters.dateTo.split('. ');
        const dateTo = new Date(parts[2], parts[1] - 1, parts[0], 23, 59, 59);
        filtered = filtered.filter(r => new Date(r[4]) <= dateTo);
      }
      
      // Filtr KM
      if (this.filters.withKm === true) {
        filtered = filtered.filter(r => (parseFloat(r[12]) || 0) > 0);
      } else if (this.filters.withKm === false) {
        filtered = filtered.filter(r => (parseFloat(r[12]) || 0) === 0);
      }
      
      this.filteredRecords = filtered;
      this.showResults = true;
      this.$emit('message', `Nalezeno ${filtered.length} záznamů`);
    },
    
    resetFilters() {
      this.filters = {
        contracts: [],
        jobs: [],
        places: [],
        workers: [],
        dateFrom: null,
        dateTo: null,
        withKm: null
      };
      this.filteredRecords = [];
      this.customCharge = null;
      this.showResults = false;
    },
    
    exportToExcel() {
      if (this.filteredRecords.length === 0) {
        this.$emit('message', 'Nejdříve aplikujte filtry');
        return;
      }
      
      let csv = 'Zakázka;Pracovník;Kč/hod;Práce;Datum od;Datum do;Hodiny;Poznámka;Km;Místo práce\n';
      
      this.filteredRecords.forEach(r => {
        const row = [
          r[0],
          r[6],
          r[2],
          r[3],
          formatShortDateTime(r[4]),
          formatShortDateTime(r[5]),
          r[7].toFixed(2),
          r[8] || '',
          r[12] || 0,
          r[14] || ''
        ];
        csv += row.map(cell => `"${cell}"`).join(';') + '\n';
      });
      
      // Přidat souhrn
      csv += '\n';
      csv += 'SOUHRN\n';
      csv += `Celkem hodin;${this.totalHours}\n`;
      csv += `Celkem cest;${this.totalTrips}\n`;
      csv += `Celkem dělníků;${this.uniqueWorkers}\n`;
      csv += `Celkem km;${this.totalKm}\n`;
      csv += `Celkem náklady;${this.totalCost} Kč\n`;
      csv += `Celkem vyplaceno;${this.totalPaid} Kč\n`;
      if (this.customCharge) {
        csv += `Má se účtovat;${this.customCharge} Kč\n`;
        csv += `Rozdíl (zisk);${this.profit} Kč\n`;
        csv += `Marže;${this.profitMargin} %\n`;
      }
      
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `statistiky_${new Date().getTime()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.$emit('message', '✓ Export dokončen');
    }
  },
  
  async mounted() {
    await this.loadWorkers();
    await this.loadAllData();
  },
  
  template: `
    <div class="q-pa-md">
      <div class="text-h6 q-mb-md">📊 Statistiky a filtry</div>
      <div class="q-mb-md q-pa-xs text-caption text-blue-8" style="background:#e3f2fd;border-radius:4px">
        ℹ Statistiky vždy počítají ze všech dat (nová appka + historie), bez ohledu na nastavení zdroje dat v Nastavení.
      </div>
      
      <div v-if="dataLoading" class="text-center q-pa-md">
        <q-spinner color="primary" size="2em"/>
        <div class="q-mt-sm text-grey-7">Načítám data...</div>
      </div>
      
      <!-- FILTRY -->
      <q-card v-if="!dataLoading" class="q-mb-md">
        <q-card-section>
          <div class="text-subtitle2 q-mb-sm">Filtry</div>
          
          <q-select
            v-model="filters.contracts" :options="contractOptionsFiltered" label="Zakázky"
            emit-value map-options multiple outlined dense class="q-mb-sm"
            use-input input-debounce="0"
            @filter="filterContracts" @focus="filterContracts('', v => contractOptionsFiltered = contractOptions)"/>
          
          <q-select
            v-model="filters.jobs" :options="jobOptionsFiltered" label="Práce"
            emit-value map-options multiple outlined dense class="q-mb-sm"
            use-input input-debounce="0"
            @filter="filterJobs" @focus="filterJobs('', v => jobOptionsFiltered = jobOptions)"/>
          
          <q-select
            v-if="isAdmin" v-model="filters.places" :options="placeOptionsFiltered" label="Místa práce"
            emit-value map-options multiple outlined dense class="q-mb-sm"
            use-input input-debounce="0"
            @filter="filterPlaces" @focus="filterPlaces('', v => placeOptionsFiltered = placeOptions)"/>
          
          <q-select
            v-if="isAdmin" v-model="filters.workers" :options="workerOptionsFiltered" label="Pracovníci"
            emit-value map-options multiple outlined dense class="q-mb-sm"
            use-input input-debounce="0"
            @filter="filterWorkers" @focus="filterWorkers('', v => workerOptionsFiltered = workerOptions)"/>
          
          <div class="row q-gutter-sm q-mb-sm">
            <div class="col">
              <q-input 
                v-model="filters.dateFrom" 
                label="Datum od" 
                outlined 
                dense 
                readonly
              >
                <template v-slot:append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date v-model="filters.dateFrom" mask="DD. MM. YYYY">
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup label="OK" color="primary" flat />
                        </div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <div class="col">
              <q-input 
                v-model="filters.dateTo" 
                label="Datum do" 
                outlined 
                dense 
                readonly
              >
                <template v-slot:append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date v-model="filters.dateTo" mask="DD. MM. YYYY">
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup label="OK" color="primary" flat />
                        </div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          
          <q-select 
            v-model="filters.withKm" 
            :options="[
              { label: '--- Všechny záznamy ---', value: null },
              { label: 'Pouze s cestami (km > 0)', value: true },
              { label: 'Pouze bez cest (km = 0)', value: false }
            ]" 
            label="Kilometry" 
            emit-value 
            map-options 
            outlined 
            dense 
            class="q-mb-sm"
          />
          
          <div class="row q-gutter-sm">
            <q-btn 
              label="Použít filtry" 
              color="primary" 
              icon="filter_list" 
              @click="applyFilters" 
              class="col"
            />
            <q-btn 
              label="Zrušit" 
              color="grey" 
              outline 
              @click="resetFilters" 
              class="col"
            />
          </div>
        </q-card-section>
      </q-card>
      
      <!-- VÝSLEDKY -->
      <div v-if="showResults">
        <!-- STATISTIKY -->
        <q-card class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle2 q-mb-md">Souhrnné statistiky</div>
            
            <div class="row q-gutter-sm q-mb-md">
              <div class="col stat-card">
                <div class="stat-label">Celkem hodin</div>
                <div class="stat-value">{{ totalHours }}</div>
              </div>
              <div class="col stat-card">
                <div class="stat-label">Celkem cest</div>
                <div class="stat-value">{{ totalTrips }}</div>
              </div>
              <div class="col stat-card">
                <div class="stat-label">Celkem dělníků</div>
                <div class="stat-value">{{ uniqueWorkers }}</div>
              </div>
              <div class="col stat-card">
                <div class="stat-label">Celkem km</div>
                <div class="stat-value">{{ totalKm }}</div>
              </div>
            </div>
            
            <div class="row q-gutter-sm q-mb-md">
              <div class="col stat-card bg-orange-1">
                <div class="stat-label">Celkem náklady</div>
                <div class="stat-value text-orange">{{ totalCost }} Kč</div>
              </div>
              <div class="col stat-card bg-blue-1">
                <div class="stat-label">Celkem vyplaceno</div>
                <div class="stat-value text-blue">{{ totalPaid }} Kč</div>
              </div>
            </div>
            
            <q-separator class="q-my-md" />
            
            <div class="text-subtitle2 q-mb-sm">Kalkulace zisku</div>
            
            <q-input 
              v-model.number="customCharge" 
              label="Má se účtovat (Kč)" 
              type="number" 
              outlined 
              dense 
              class="q-mb-sm"
            />
            
            <div v-if="customCharge" class="row q-gutter-sm">
              <div class="col stat-card" :class="profit >= 0 ? 'bg-green-1' : 'bg-red-1'">
                <div class="stat-label">Rozdíl (zisk)</div>
                <div class="stat-value" :class="profit >= 0 ? 'text-green' : 'text-red'">
                  {{ profit }} Kč
                </div>
              </div>
              <div class="col stat-card bg-grey-2">
                <div class="stat-label">Marže</div>
                <div class="stat-value">{{ profitMargin }} %</div>
              </div>
            </div>
          </q-card-section>
        </q-card>
        
        <!-- TLAČÍTKO EXPORT -->
        <q-btn 
          label="Exportovat do Excel (CSV)" 
          color="green" 
          icon="download" 
          @click="exportToExcel" 
          class="full-width q-mb-md"
        />
        
        <!-- SEZNAM ZÁZNAMŮ -->
        <div class="text-subtitle2 q-mb-sm">
          Záznamy ({{ filteredRecords.length }})
        </div>
        
        <div v-if="filteredRecords.length === 0" class="text-center text-grey-7 q-mt-lg">
          Žádné záznamy nevyhovují filtrům
        </div>
        
        <div v-for="(record, idx) in filteredRecords" :key="idx" class="record-card">
          <div class="row items-center">
            <div class="col">
              <div class="text-bold">{{ record[6] }}</div>
              <div class="text-caption text-grey-7">
                {{ record[0] }} • {{ record[3] }} • {{ record[14] || 'Nezadáno' }}
              </div>
            </div>
            <div class="text-right">
              <div class="text-bold text-primary">{{ record[7].toFixed(2) }} hod</div>
              <div class="text-caption">{{ record[2] }} Kč/hod = {{ Math.round(record[2] * record[7]) }} Kč</div>
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
    </div>
  `
});
