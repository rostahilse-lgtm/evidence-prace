// js/components/stavebni-denik.js

window.app.component('stavebni-denik-component', {
  props: ['allRecords', 'contracts'],
  emits: ['message'],
  
  data() {
    return {
      selectedContracts: [],
      dateFrom: getMonthStart(),
      dateTo: getTodayDate(),
      absenceFrom: '',
      absenceTo: '',
      myName: '',
      exportOptions: {
        showNames: false,
        showHours: true,
        includeMe: true
      }
    }
  },
  
  computed: {
    // Dostupné zakázky
    availableContracts() {
      const unique = new Set();
      this.allRecords.forEach(r => {
        if (r[3]) unique.add(r[3]); // name_contract
      });
      return Array.from(unique).sort();
    },
    
    // Filtrovaná data podle období a zakázek
    filteredRecords() {
      const from = parseDateString(this.dateFrom);
      const to = parseDateString(this.dateTo);
      to.setHours(23, 59, 59);
      
      return this.allRecords.filter(r => {
        const recordDate = new Date(r[6]); // time_fr
        const inDateRange = recordDate >= from && recordDate <= to;
        
        const inSelectedContracts = this.selectedContracts.length === 0 || 
                                    this.selectedContracts.includes(r[3]);
        
        return inDateRange && inSelectedContracts;
      });
    },
    
    // Denní souhrn
    dailySummary() {
      const summary = {};
      
      // Agregace dat podle dnů
      this.filteredRecords.forEach(r => {
        const date = new Date(r[6]);
        const dateStr = formatDate(date);
        
        if (!summary[dateStr]) {
          summary[dateStr] = {
            datum: dateStr,
            prace: new Set(),
            pracovnici: new Set(),
            celkemHodin: 0,
            timestamp: date.getTime()
          };
        }
        
        summary[dateStr].prace.add(r[5]); // name_job
        summary[dateStr].pracovnici.add(r[1]); // name_worker
        summary[dateStr].celkemHodin += r[7]; // hours
      });
      
      // Přidat "já" pokud jsem nebyl, ale ostatní byli
      if (this.exportOptions.includeMe && this.absenceFrom && this.absenceTo && this.myName) {
        const absFrom = new Date(this.absenceFrom);
        const absTo = new Date(this.absenceTo);
        
        Object.values(summary).forEach(day => {
          const dayDate = new Date(day.timestamp);
          const isInAbsence = dayDate >= absFrom && dayDate <= absTo;
          const iWasThere = Array.from(day.pracovnici).some(p => 
            p.toLowerCase().includes(this.myName.toLowerCase())
          );
          
          // Pokud jsem nebyl v absenci a ostatní tam byli, přidat mě
          if (!isInAbsence && !iWasThere && day.pracovnici.size > 0) {
            const avgHours = day.celkemHodin / day.pracovnici.size;
            day.celkemHodin += avgHours;
            day.pracovnici.add(this.myName);
          }
        });
      }
      
      // Převést na pole a seřadit
      return Object.values(summary)
        .map(s => ({
          datum: s.datum,
          prace: Array.from(s.prace).join(', '),
          pracovnici: Array.from(s.pracovnici),
          celkemHodin: Math.round(s.celkemHodin * 10) / 10,
          timestamp: s.timestamp
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
    },
    
    // Detekce absence (dny kdy ostatní pracovali hodně, ale já ne)
    detectedAbsence() {
      if (!this.myName) return [];
      
      const absenceDays = [];
      
      this.dailySummary.forEach(day => {
        const iWasThere = day.pracovnici.some(p => 
          p.toLowerCase().includes(this.myName.toLowerCase())
        );
        
        // Pokud jsem tam nebyl a bylo tam více lidí
        if (!iWasThere && day.pracovnici.length > 1) {
          absenceDays.push(day.datum);
        }
      });
      
      return absenceDays;
    },
    
    // Statistiky
    stats() {
      return {
        dnu: this.dailySummary.length,
        hodin: this.dailySummary.reduce((s, d) => s + d.celkemHodin, 0).toFixed(1),
        absence: this.detectedAbsence.length
      };
    }
  },
  
  methods: {
    toggleContract(contract) {
      const idx = this.selectedContracts.indexOf(contract);
      if (idx >= 0) {
        this.selectedContracts.splice(idx, 1);
      } else {
        this.selectedContracts.push(contract);
      }
    },
    
    exportToCSV() {
      let headers, rows;
      
      if (this.exportOptions.showNames) {
        headers = ['Datum', 'Pracovníci', 'Práce', 'Celkem hodin'];
        rows = this.dailySummary.map(d => [
          d.datum,
          d.pracovnici.join(', '),
          d.prace,
          d.celkemHodin
        ]);
      } else if (this.exportOptions.showHours) {
        headers = ['Datum', 'Práce', 'Celkem hodin'];
        rows = this.dailySummary.map(d => [
          d.datum,
          d.prace,
          d.celkemHodin
        ]);
      } else {
        headers = ['Datum', 'Práce'];
        rows = this.dailySummary.map(d => [d.datum, d.prace]);
      }
      
      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\\n');
      
      const blob = new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `stavebni_denik_${this.dateFrom}_${this.dateTo}.csv`;
      link.click();
      
      this.$emit('message', '✓ Export dokončen');
    },
    
    formatDateForInput(s) { return formatDateForInput(s); },
    formatDateFromInput(i) { return formatDateFromInput(i); }
  },
  
  template: `
    <div class="q-pa-md">
      <div class="text-h5 q-mb-md">📋 Stavební deník</div>
      
      <!-- FILTRY -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-subtitle2 q-mb-sm">Období</div>
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
        
        <q-separator/>
        
        <q-card-section>
          <div class="text-subtitle2 q-mb-sm">Zakázky</div>
          <div class="row q-gutter-xs">
            <q-chip
              clickable
              :color="selectedContracts.length === 0 ? 'primary' : 'grey-4'"
              :text-color="selectedContracts.length === 0 ? 'white' : 'black'"
              @click="selectedContracts = []"
            >
              Všechny
            </q-chip>
            <q-chip
              v-for="contract in availableContracts"
              :key="contract"
              clickable
              :color="selectedContracts.includes(contract) ? 'primary' : 'grey-4'"
              :text-color="selectedContracts.includes(contract) ? 'white' : 'black'"
              @click="toggleContract(contract)"
            >
              {{ contract }}
            </q-chip>
          </div>
        </q-card-section>
        
        <q-separator/>
        
        <q-card-section>
          <div class="text-subtitle2 q-mb-sm">Moje údaje (volitelné)</div>
          <q-input
            v-model="myName"
            label="Moje jméno"
            outlined
            dense
            hint="Pro detekci absence"
            class="q-mb-md"
          />
          
          <div class="text-caption text-grey-7 q-mb-xs">Moje absence:</div>
          <div class="row q-gutter-sm">
            <div class="col">
              <q-input
                v-model="absenceFrom"
                type="date"
                outlined
                dense
                label="Od"
              />
            </div>
            <div class="col">
              <q-input
                v-model="absenceTo"
                type="date"
                outlined
                dense
                label="Do"
              />
            </div>
          </div>
        </q-card-section>
        
        <q-separator/>
        
        <q-card-section>
          <div class="text-subtitle2 q-mb-sm">Export nastavení</div>
          <q-checkbox
            v-model="exportOptions.includeMe"
            label="Zahrnout 'já' i když jsem nebyl"
            dense
          />
          <q-checkbox
            v-model="exportOptions.showNames"
            label="Zobrazit jména pracovníků"
            dense
          />
          <q-checkbox
            v-model="exportOptions.showHours"
            label="Zobrazit hodiny"
            dense
          />
        </q-card-section>
      </q-card>
      
      <!-- STATISTIKY -->
      <div class="row q-gutter-sm q-mb-md">
        <q-card class="col" style="background: #e3f2fd">
          <q-card-section>
            <div class="text-caption text-grey-7">Dnů</div>
            <div class="text-h4 text-primary">{{ stats.dnu }}</div>
          </q-card-section>
        </q-card>
        
        <q-card class="col" style="background: #e8f5e9">
          <q-card-section>
            <div class="text-caption text-grey-7">Hodin</div>
            <div class="text-h4 text-green">{{ stats.hodin }}h</div>
          </q-card-section>
        </q-card>
        
        <q-card class="col" style="background: #fff3e0">
          <q-card-section>
            <div class="text-caption text-grey-7">Absence</div>
            <div class="text-h4 text-orange">{{ stats.absence }}</div>
          </q-card-section>
        </q-card>
      </div>
      
      <!-- DETEKOVANÁ ABSENCE -->
      <q-banner v-if="detectedAbsence.length > 0" class="bg-orange-2 q-mb-md" dense rounded>
        <template v-slot:avatar>
          <q-icon name="warning" color="orange"/>
        </template>
        <strong>Dny kdy ostatní pracovali, ale "{{ myName }}" ne:</strong>
        <div class="q-mt-xs">{{ detectedAbsence.join(', ') }}</div>
      </q-banner>
      
      <!-- EXPORT -->
      <div class="q-mb-md">
        <q-btn
          @click="exportToCSV"
          color="green"
          icon="download"
          label="Export do CSV"
          unelevated
        />
      </div>
      
      <!-- TABULKA -->
      <q-card>
        <q-table
          :rows="dailySummary"
          :columns="[
            { name: 'datum', label: 'Datum', field: 'datum', align: 'left', sortable: true },
            { name: 'prace', label: 'Práce', field: 'prace', align: 'left' },
            ...(exportOptions.showNames ? [{ name: 'pracovnici', label: 'Pracovníci', field: row => row.pracovnici.join(', '), align: 'left' }] : []),
            { name: 'hodiny', label: 'Hodiny', field: 'celkemHodin', align: 'right', sortable: true }
          ]"
          row-key="datum"
          flat
          :rows-per-page-options="[10, 25, 50, 0]"
        >
          <template v-slot:body-cell-hodiny="props">
            <q-td :props="props">
              <span class="text-bold text-green">{{ props.value }}h</span>
            </q-td>
          </template>
        </q-table>
      </q-card>
    </div>
  `
});
