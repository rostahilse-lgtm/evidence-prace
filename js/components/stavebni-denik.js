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
      },
      importedRecords: [],
      showImportDialog: false
    }
  },
  
  computed: {
    allRecordsWithImported() {
      return [...this.allRecords, ...this.importedRecords];
    },
    
    availableContracts() {
      const unique = new Set();
      this.allRecordsWithImported.forEach(r => {
        if (r[0]) unique.add(r[0]);
      });
      return Array.from(unique).sort();
    },
    
    filteredRecords() {
      const from = parseDateString(this.dateFrom);
      const to = parseDateString(this.dateTo);
      to.setHours(23, 59, 59);
      
      return this.allRecordsWithImported.filter(r => {
        const recordDate = new Date(r[4]);
        const inDateRange = recordDate >= from && recordDate <= to;
        
        const inSelectedContracts = this.selectedContracts.length === 0 || 
                                    this.selectedContracts.includes(r[0]);
        
        return inDateRange && inSelectedContracts;
      });
    },
    
    dailySummary() {
      const summary = {};
      
      this.filteredRecords.forEach(r => {
        const date = new Date(r[4]);
     const dateStr = `${date.getDate()}. ${date.getMonth() + 1}. ${date.getFullYear()}`;
        
        if (!summary[dateStr]) {
          summary[dateStr] = {
            datum: dateStr,
            prace: new Set(),
            pracovnici: new Set(),
            celkemHodin: 0,
            timestamp: date.getTime()
          };
        }
        
        summary[dateStr].prace.add(r[3]);
        summary[dateStr].pracovnici.add(r[6]);
        summary[dateStr].celkemHodin += r[7];
      });
      
      if (this.exportOptions.includeMe && this.absenceFrom && this.absenceTo && this.myName) {
        const absFrom = new Date(this.absenceFrom);
        const absTo = new Date(this.absenceTo);
        
        Object.values(summary).forEach(day => {
          const dayDate = new Date(day.timestamp);
          const isInAbsence = dayDate >= absFrom && dayDate <= absTo;
          const iWasThere = Array.from(day.pracovnici).some(p => 
            p.toLowerCase().includes(this.myName.toLowerCase())
          );
          
          if (!isInAbsence && !iWasThere && day.pracovnici.size > 0) {
            const avgHours = day.celkemHodin / day.pracovnici.size;
            day.celkemHodin += avgHours;
            day.pracovnici.add(this.myName);
          }
        });
      }
      
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
    
    detectedAbsence() {
      if (!this.myName) return [];
      
      const absenceDays = [];
      
      this.dailySummary.forEach(day => {
        const iWasThere = day.pracovnici.some(p => 
          p.toLowerCase().includes(this.myName.toLowerCase())
        );
        
        if (!iWasThere && day.pracovnici.length > 1) {
          absenceDays.push(day.datum);
        }
      });
      
      return absenceDays;
    },
    
    stats() {
      return {
        dnu: this.dailySummary.length,
        hodin: this.dailySummary.reduce((s, d) => s + d.celkemHodin, 0).toFixed(1),
        absence: this.detectedAbsence.length,
        imported: this.importedRecords.length
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
    
    handleFileUpload(event) {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = e.target.result;
            const records = this.parseCSV(text);
            this.importedRecords.push(...records);
            this.$emit('message', `✓ Načteno ${records.length} záznamů z ${file.name}`);
          } catch (error) {
            this.$emit('message', `❌ Chyba při načítání ${file.name}: ${error.message}`);
          }
        };
        reader.readAsText(file, 'UTF-8');
      });
      
      this.showImportDialog = false;
    },
    
    parseCSV(text) {
      const lines = text.split('\n').filter(line => line.trim());
      const records = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        
        if (values.length >= 8) {
          const dateTime = values[9] || values[0];
          const timestamp = this.parseDateTime(dateTime);
          
          records.push([
            values[0] || 'Neznámá zakázka',
            values[1] || '0',
            parseFloat(values[2]) || 0,
            values[3] || 'Neznámá práce',
            timestamp,
            timestamp + (parseFloat(values[7]) * 3600000 || 0),
            values[6] || 'Neznámý pracovník',
            parseFloat(values[7]) || 0,
            values[8] || '',
            dateTime,
            dateTime,
            0,
            0,
            'N'
          ]);
        }
      }
      
      return records;
    },
    
    parseCSVLine(line) {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      return values;
    },
    
    parseDateTime(dateStr) {
      const parts = dateStr.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s+(\d{1,2}):(\d{2})/);
      if (parts) {
        const [, day, month, year, hour, minute] = parts;
        return new Date(year, month - 1, day, hour, minute).getTime();
      }
      return Date.now();
    },
    
    clearImported() {
      if (confirm('Smazat všechna importovaná data?')) {
        this.importedRecords = [];
        this.$emit('message', '✓ Importovaná data smazána');
      }
    },

exportToCSV() {
  let headers, rows;
  
  if (this.exportOptions.showNames) {
    headers = ['Datum', 'Práce', 'Pracovníci', 'Celkem hodin'];
    rows = this.dailySummary.map(d => [
      d.datum,
      d.prace,
      d.pracovnici.join(', '),
      d.celkemHodin.toString().replace('.', ',')
    ]);
  } else if (this.exportOptions.showHours) {
    headers = ['Datum', 'Práce', 'Celkem hodin'];
    rows = this.dailySummary.map(d => [
      d.datum,
      d.prace,
      d.celkemHodin.toString().replace('.', ',')
    ]);
  } else {
    headers = ['Datum', 'Práce'];
    rows = this.dailySummary.map(d => [d.datum, d.prace]);
  }
  
  const csv = [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
  ].join('\r\n');
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `stavebni_denik_${this.dateFrom}_${this.dateTo}.csv`;
  link.click();
  
  this.$emit('message', '✓ Export dokončen');
}
    
    formatDateForInput(s) { return formatDateForInput(s); },
    formatDateFromInput(i) { return formatDateFromInput(i); }
  },
  
  template: `
    <div class="q-pa-md">
      <div class="row items-center q-mb-md">
        <div class="text-h5 col">📋 Stavební deník</div>
        <q-btn color="orange" icon="upload_file" label="Import CSV" @click="showImportDialog = true" unelevated dense/>
      </div>
      
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
        
        <q-card v-if="importedRecords.length > 0" class="col" style="background: #f3e5f5">
          <q-card-section>
            <div class="text-caption text-grey-7">Import</div>
            <div class="text-h4 text-purple">{{ stats.imported }}</div>
          </q-card-section>
        </q-card>
      </div>
      
      <q-banner v-if="importedRecords.length > 0" class="bg-purple-2 q-mb-md" dense rounded>
        <template v-slot:avatar>
          <q-icon name="info" color="purple"/>
        </template>
        <strong>Zobrazena data včetně {{ importedRecords.length }} importovaných záznamů</strong>
        <template v-slot:action>
          <q-btn flat label="Smazat import" @click="clearImported" dense/>
        </template>
      </q-banner>
      
      <q-banner v-if="detectedAbsence.length > 0" class="bg-orange-2 q-mb-md" dense rounded>
        <template v-slot:avatar>
          <q-icon name="warning" color="orange"/>
        </template>
        <strong>Dny kdy ostatní pracovali, ale "{{ myName }}" ne:</strong>
        <div class="q-mt-xs">{{ detectedAbsence.join(', ') }}</div>
      </q-banner>
      
      <div class="q-mb-md">
        <q-btn
          @click="exportToCSV"
          color="green"
          icon="download"
          label="Export do CSV"
          unelevated
        />
      </div>
      
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
      
      <q-dialog v-model="showImportDialog">
        <q-card style="min-width: 350px">
          <q-card-section>
            <div class="text-h6">📂 Import CSV souborů</div>
          </q-card-section>
          
          <q-card-section>
            <p class="text-body2">Vyberte jeden nebo více CSV souborů ze starého systému.</p>
            <p class="text-caption text-grey-7">Očekávané sloupce: zakázka, id_pracovníka, sazba, práce, čas_od, čas_do, jméno, hodiny, poznámka, datum</p>
            
            <input
              type="file"
              accept=".csv"
              multiple
              @change="handleFileUpload"
              style="margin-top: 16px"
            />
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" v-close-popup/>
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  `
});
