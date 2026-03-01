// statistics.js
// v2026-03-01b - pro non-adminy zjednodušený souhrn (jen hodiny + výdělek, bez nákladů/záloh)
//              - oprava exportu Win1250, hodiny s čárkou
//              - zachovány všechny filtry + kalkulace zisku (jen pro admin)

window.app.component('statistics-component', {
  props: ['allRecords', 'contracts', 'jobs', 'places', 'allAdvances', 'isAdmin'],
  emits: ['message'],
  
  data() {
    return {
      tab: 'summary',
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
      return [{ label: '--- Všechny zakázky ---', value: null }, ...this.contracts.map(c => ({ label: c[0]+' - '+c[1], value: c[0] }))];
    },
    jobOptions() {
      return [{ label: '--- Všechny práce ---', value: null }, ...this.jobs.map(j => ({ label: j[1], value: j[0] }))];
    },
    placeOptions() {
      return [{ label: '--- Všechna místa ---', value: null }, ...(this.places ? this.places.map(p => ({ label: p[1], value: p[0] })) : [])];
    },
    workerOptions() {
      return [{ label: '--- Všichni pracovníci ---', value: null }, ...this.workers.map(w => ({ label: w[1], value: w[0] }))];
    },

    totalHours() { return this.filteredRecords.reduce((s,r) => s+(parseFloat(r[7])||0), 0).toFixed(2); },
    totalTrips() { return this.filteredRecords.filter(r => (parseFloat(r[12])||0) > 0).length; },
    uniqueWorkerCount() { return new Set(this.filteredRecords.map(r => r[1])).size; },
    totalKm() { return this.filteredRecords.reduce((s,r) => s+(parseFloat(r[12])||0), 0); },

    // MZDOVÉ NÁKLADY (jen admin)
    totalCost() {
      return Math.round(this.filteredRecords.reduce((s,r) => s+(parseFloat(r[2])||0)*(parseFloat(r[7])||0), 0));
    },
    // VÝDĚLEK PŘIHLÁŠENÉHO (pro non-admin = vlastní záznamy)
    totalEarnings() {
      return Math.round(this.filteredRecords.reduce((s,r) => s+(parseFloat(r[2])||0)*(parseFloat(r[7])||0), 0));
    },
    // ZÁLOHY (jen admin, a jen v rozsahu filtru)
    totalPaid() {
      if (!this.allAdvances || !this.isAdmin) return 0;
      const workerIds = new Set(this.filteredRecords.map(r => String(r[1])));
      let dateFrom = null, dateTo = null;
      if (this.filters.dateFrom) { const p=this.filters.dateFrom.split('. '); dateFrom=new Date(p[2],p[1]-1,p[0]); }
      if (this.filters.dateTo) { const p=this.filters.dateTo.split('. '); dateTo=new Date(p[2],p[1]-1,p[0],23,59,59); }
      return Math.round(this.allAdvances.reduce((sum, adv) => {
        if (!workerIds.has(String(adv[0]))) return sum;
        const advDate = new Date(Number(adv[1]));
        if (dateFrom && advDate < dateFrom) return sum;
        if (dateTo && advDate > dateTo) return sum;
        return sum + (parseFloat(adv[4])||0);
      }, 0));
    },
    profit() { return this.customCharge ? this.customCharge - this.totalCost : 0; },
    profitMargin() { return (!this.customCharge || this.customCharge===0) ? 0 : ((this.profit/this.customCharge)*100).toFixed(1); },

    uniqueDays() {
      const days = new Set();
      this.filteredRecords.forEach(r => { const d=new Date(Number(r[4])); days.add(`${d.getDate()}.${d.getMonth()}.${d.getFullYear()}`); });
      return days.size;
    },
    halaDays() {
      const days = new Set();
      this.filteredRecords.filter(r => String(r[14]||'').toLowerCase().includes('hala')).forEach(r => {
        const d=new Date(Number(r[4])); days.add(`${d.getDate()}.${d.getMonth()}.${d.getFullYear()}`);
      });
      return days.size;
    },
    stavbaDays() {
      const days = new Set();
      this.filteredRecords.filter(r => String(r[14]||'').toLowerCase().includes('stavba')).forEach(r => {
        const d=new Date(Number(r[4])); days.add(`${d.getDate()}.${d.getMonth()}.${d.getFullYear()}`);
      });
      return days.size;
    },
    byContract() {
      const map = {};
      this.filteredRecords.forEach(r => {
        if (!map[r[0]]) map[r[0]] = { name: r[0], hours: 0, earnings: 0 };
        map[r[0]].hours += parseFloat(r[7])||0;
        map[r[0]].earnings += (parseFloat(r[2])||0)*(parseFloat(r[7])||0);
      });
      return Object.values(map).sort((a,b) => b.hours-a.hours);
    },
    byJob() {
      const map = {};
      this.filteredRecords.forEach(r => {
        if (!map[r[3]]) map[r[3]] = { name: r[3], hours: 0 };
        map[r[3]].hours += parseFloat(r[7])||0;
      });
      return Object.values(map).sort((a,b) => b.hours-a.hours);
    }
  },

  methods: {
    fmtDate(ts) {
      const d=new Date(Number(ts)), pad=n=>String(n).padStart(2,'0');
      return `${pad(d.getDate())}. ${pad(d.getMonth()+1)}. ${d.getFullYear()}`;
    },
    fmtRange(fr, to) {
      if (typeof formatTimeRange === 'function') return formatTimeRange(fr, to);
      const d=new Date(Number(fr)), pad=n=>String(n).padStart(2,'0');
      const s=`${pad(d.getDate())}. ${pad(d.getMonth()+1)}. ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      if (!to) return s;
      const e=new Date(Number(to));
      return `${s} - ${pad(e.getHours())}:${pad(e.getMinutes())}`;
    },
    async loadWorkers() {
      const res = await apiCall('get', { type: 'workers' });
      if (res.code === '000' && res.data) this.workers = res.data;
    },
    showAll() {
      this.filteredRecords = [...this.allRecords];
      this.showResults = true; this.tab = 'summary';
      this.$emit('message', `Zobrazeno všech ${this.allRecords.length} záznamů`);
    },
    applyFilters() {
      let f = [...this.allRecords];
      if (this.filters.contracts.length > 0) {
        const names = this.filters.contracts.filter(id=>id!==null).map(id => { const c=this.contracts.find(c=>c[0]===id); return c?c[1]:null; }).filter(Boolean);
        if (names.length) f = f.filter(r => names.includes(r[0]));
      }
      if (this.filters.jobs.length > 0) {
        const names = this.filters.jobs.filter(id=>id!==null).map(id => { const j=this.jobs.find(j=>j[0]===id); return j?j[1]:null; }).filter(Boolean);
        if (names.length) f = f.filter(r => names.includes(r[3]));
      }
      if (this.filters.places.length > 0) {
        const names = this.filters.places.filter(id=>id!==null).map(id => { const p=this.places?this.places.find(p=>p[0]===id):null; return p?p[1]:null; }).filter(Boolean);
        if (names.length) f = f.filter(r => names.includes(r[14]));
      }
      if (this.filters.workers.length > 0) {
        const ids = this.filters.workers.filter(id=>id!==null);
        if (ids.length) f = f.filter(r => ids.includes(r[1]));
      }
      if (this.filters.dateFrom) { const p=this.filters.dateFrom.split('. '); const from=new Date(p[2],p[1]-1,p[0]); f=f.filter(r=>new Date(Number(r[4]))>=from); }
      if (this.filters.dateTo) { const p=this.filters.dateTo.split('. '); const to=new Date(p[2],p[1]-1,p[0],23,59,59); f=f.filter(r=>new Date(Number(r[4]))<=to); }
      if (this.filters.withKm === true) f = f.filter(r => (parseFloat(r[12])||0) > 0);
      else if (this.filters.withKm === false) f = f.filter(r => (parseFloat(r[12])||0) === 0);
      this.filteredRecords = f; this.showResults = true; this.tab = 'summary';
      this.$emit('message', `Nalezeno ${f.length} záznamů`);
    },
    resetFilters() {
      this.filters = { contracts:[], jobs:[], places:[], workers:[], dateFrom:null, dateTo:null, withKm:null };
      this.filteredRecords = []; this.customCharge = null; this.showResults = false;
    },
    exportToExcel() {
      if (!this.filteredRecords.length) { this.$emit('message', 'Nejdříve aplikujte filtry'); return; }
      const win1250map = {
        'Á':0xC1,'á':0xE1,'Č':0xC8,'č':0xE8,'Ď':0xCF,'ď':0xEF,
        'É':0xC9,'é':0xE9,'Ě':0xCC,'ě':0xEC,'Í':0xCD,'í':0xED,
        'Ň':0xD2,'ň':0xF2,'Ó':0xD3,'ó':0xF3,'Ř':0xD8,'ř':0xF8,
        'Š':0xD0,'š':0xF0,'Ť':0xD4,'ť':0xF4,'Ú':0xDA,'ú':0xFA,
        'Ů':0xD9,'ů':0xF9,'Ý':0xDD,'ý':0xFD,'Ž':0xDE,'ž':0xFE
      };
      let csv = 'Zakázka;Pracovník;Kč/hod;Práce;Datum;Hodiny;Výdělek;Poznámka;Km;Místo práce\r\n';
      this.filteredRecords.forEach(r => {
        const hodiny = (parseFloat(r[7])||0).toFixed(2).replace('.',',');
        const vydelek = Math.round((parseFloat(r[2])||0)*(parseFloat(r[7])||0));
        csv += [r[0],r[6],r[2],r[3],this.fmtDate(r[4]),hodiny,vydelek,r[8]||'',r[12]||0,r[14]||''].map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')+'\r\n';
      });
      csv += '\r\n"SOUHRN"\r\n';
      csv += `"Celkem hodin";"${this.totalHours.replace('.',',')}"\r\n`;
      csv += `"Odpracovaných dní";"${this.uniqueDays}"\r\n`;
      csv += `"Dní hala";"${this.halaDays}"\r\n`;
      csv += `"Dní stavba";"${this.stavbaDays}"\r\n`;
      csv += `"Celkem cest";"${this.totalTrips}"\r\n`;
      csv += `"Celkem km";"${this.totalKm}"\r\n`;
      if (this.isAdmin) {
        csv += `"Celkem dělníků";"${this.uniqueWorkerCount}"\r\n`;
        csv += `"Mzdové náklady";"${this.totalCost} Kč"\r\n`;
        csv += `"Zálohy vyplaceny";"${this.totalPaid} Kč"\r\n`;
        if (this.customCharge) {
          csv += `"Má se účtovat";"${this.customCharge} Kč"\r\n`;
          csv += `"Zisk";"${this.profit} Kč"\r\n`;
          csv += `"Marže";"${this.profitMargin} %"\r\n`;
        }
      } else {
        csv += `"Celkem výdělek";"${this.totalEarnings} Kč"\r\n`;
      }
      const bytes = new Uint8Array(csv.length);
      for (let i=0; i<csv.length; i++) { const ch=csv[i]; bytes[i]=win1250map[ch]!==undefined?win1250map[ch]:csv.charCodeAt(i); }
      const blob = new Blob([bytes], { type:'text/csv;charset=windows-1250;' });
      const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`statistiky_${Date.now()}.csv`; a.style.visibility='hidden';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      this.$emit('message', '✓ Export dokončen');
    }
  },

  async mounted() { await this.loadWorkers(); },

  template: `
    <div class="q-pa-md">
      <div class="text-h6 q-mb-md">📊 Statistiky a filtry</div>
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-subtitle2 q-mb-sm">Filtry</div>
          <q-select v-model="filters.contracts" :options="contractOptions" label="Zakázky" emit-value map-options multiple outlined dense class="q-mb-sm"/>
          <q-select v-model="filters.jobs" :options="jobOptions" label="Práce" emit-value map-options multiple outlined dense class="q-mb-sm"/>
          <q-select v-if="isAdmin" v-model="filters.places" :options="placeOptions" label="Místa práce" emit-value map-options multiple outlined dense class="q-mb-sm"/>
          <q-select v-if="isAdmin" v-model="filters.workers" :options="workerOptions" label="Pracovníci" emit-value map-options multiple outlined dense class="q-mb-sm"/>
          <div class="row q-gutter-sm q-mb-sm">
            <div class="col">
              <q-input v-model="filters.dateFrom" label="Datum od" outlined dense readonly>
                <template v-slot:append><q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover ref="fromProxy"><q-date v-model="filters.dateFrom" mask="DD. MM. YYYY" :locale="csLocale" @update:model-value="$refs.fromProxy.hide()"/></q-popup-proxy>
                </q-icon></template>
              </q-input>
            </div>
            <div class="col">
              <q-input v-model="filters.dateTo" label="Datum do" outlined dense readonly>
                <template v-slot:append><q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover ref="toProxy"><q-date v-model="filters.dateTo" mask="DD. MM. YYYY" :locale="csLocale" @update:model-value="$refs.toProxy.hide()"/></q-popup-proxy>
                </q-icon></template>
              </q-input>
            </div>
          </div>
          <q-select v-if="isAdmin" v-model="filters.withKm" :options="[{label:'--- Všechny záznamy ---',value:null},{label:'Pouze s cestami (km > 0)',value:true},{label:'Pouze bez cest (km = 0)',value:false}]" label="Kilometry" emit-value map-options outlined dense class="q-mb-sm"/>
          <div class="row q-gutter-sm">
            <q-btn label="Použít filtry" color="primary" icon="filter_list" @click="applyFilters" class="col"/>
            <q-btn label="Zobrazit vše" color="teal" outline icon="list" @click="showAll" class="col"/>
            <q-btn label="Zrušit" color="grey" outline @click="resetFilters"/>
          </div>
        </q-card-section>
      </q-card>

      <div v-if="showResults">
        <q-tabs v-model="tab" dense align="justify" class="text-primary q-mb-md">
          <q-tab name="summary" label="Souhrn"/>
          <q-tab name="records" :label="'Záznamy (' + filteredRecords.length + ')'"/>
        </q-tabs>

        <!-- SOUHRN -->
        <div v-if="tab === 'summary'">
          <!-- Řádek 1: hodiny + výdělek/náklady -->
          <div class="row q-gutter-sm q-mb-sm">
            <q-card class="col text-center" flat bordered>
              <q-card-section class="q-pa-sm">
                <div class="text-caption text-grey-7">Celkem hodin</div>
                <div class="text-h5 text-primary">{{ totalHours }}h</div>
              </q-card-section>
            </q-card>
            <q-card class="col text-center" flat bordered>
              <q-card-section class="q-pa-sm">
                <div class="text-caption text-grey-7">{{ isAdmin ? 'Mzdové náklady' : 'Výdělek' }}</div>
                <div class="text-h5 text-green">{{ isAdmin ? totalCost : totalEarnings }} Kč</div>
              </q-card-section>
            </q-card>
          </div>

          <!-- Řádek 2: dny (jen admin) -->
          <div v-if="isAdmin" class="row q-gutter-sm q-mb-sm">
            <q-card class="col text-center" flat bordered>
              <q-card-section class="q-pa-sm">
                <div class="text-caption text-grey-7">Dní celkem</div>
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
            <q-card class="col text-center" flat bordered style="background:#fff3e0">
              <q-card-section class="q-pa-sm">
                <div class="text-caption text-grey-7">Cesty</div>
                <div class="text-h5 text-orange">{{ totalTrips }}</div>
              </q-card-section>
            </q-card>
          </div>

          <!-- Admin: zálohy + kalkulace zisku -->
          <div v-if="isAdmin">
            <div class="row q-gutter-sm q-mb-md">
              <q-card class="col text-center" flat bordered>
                <q-card-section class="q-pa-sm">
                  <div class="text-caption text-grey-7">Celkem dělníků</div>
                  <div class="text-h5">{{ uniqueWorkerCount }}</div>
                </q-card-section>
              </q-card>
              <q-card class="col text-center" flat bordered style="background:#e3f2fd">
                <q-card-section class="q-pa-sm">
                  <div class="text-caption text-grey-7">Zálohy vyplaceny</div>
                  <div class="text-h5 text-blue">{{ totalPaid }} Kč</div>
                </q-card-section>
              </q-card>
              <q-card class="col text-center" flat bordered>
                <q-card-section class="q-pa-sm">
                  <div class="text-caption text-grey-7">Celkem km</div>
                  <div class="text-h5">{{ totalKm }}</div>
                </q-card-section>
              </q-card>
            </div>
            <q-separator class="q-my-md"/>
            <div class="text-subtitle2 q-mb-sm">Kalkulace zisku</div>
            <q-input v-model.number="customCharge" label="Má se účtovat (Kč)" type="number" outlined dense class="q-mb-sm"/>
            <div v-if="customCharge" class="row q-gutter-sm q-mb-md">
              <div class="col stat-card" :class="profit>=0?'bg-green-1':'bg-red-1'">
                <div class="stat-label">Rozdíl (zisk)</div>
                <div class="stat-value" :class="profit>=0?'text-green':'text-red'">{{ profit }} Kč</div>
              </div>
              <div class="col stat-card bg-grey-2">
                <div class="stat-label">Marže</div>
                <div class="stat-value">{{ profitMargin }} %</div>
              </div>
            </div>
          </div>

          <!-- Podle zakázky -->
          <div class="text-subtitle2 q-mb-xs">Podle zakázky</div>
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

          <q-btn label="Exportovat do Excel (CSV)" color="green" icon="download" @click="exportToExcel" class="full-width q-mb-md"/>
        </div>

        <!-- ZÁZNAMY -->
        <div v-if="tab === 'records'">
          <q-btn label="Exportovat do Excel (CSV)" color="green" icon="download" @click="exportToExcel" class="full-width q-mb-md"/>
          <div v-if="!filteredRecords.length" class="text-center text-grey-7 q-mt-lg">Žádné záznamy nevyhovují filtrům</div>
          <div v-for="(record, idx) in filteredRecords" :key="idx" class="record-card">
            <div class="row items-center">
              <div class="col">
                <div class="text-bold">{{ record[6] }}</div>
                <div class="text-caption text-grey-7">{{ record[0] }} • {{ record[3] }} • {{ record[14] || 'Nezadáno' }}</div>
              </div>
              <div class="text-right">
                <div class="text-bold text-primary">{{ (parseFloat(record[7])||0).toFixed(2) }} hod</div>
                <div class="text-caption text-green">{{ Math.round((parseFloat(record[2])||0)*(parseFloat(record[7])||0)) }} Kč</div>
              </div>
            </div>
            <div class="text-caption text-grey-7 q-mt-sm">{{ fmtRange(record[4], record[5]) }}</div>
            <div v-if="record[12] > 0" class="text-caption text-orange q-mt-xs">🚗 {{ record[12] }} km</div>
            <div v-if="record[8]" class="note-display">💬 {{ record[8] }}</div>
          </div>
        </div>
      </div>
    </div>
  `
});
