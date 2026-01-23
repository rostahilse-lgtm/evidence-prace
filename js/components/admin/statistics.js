window.app.component('statistics-component', {
  props: ['allRecords', 'allAdvances', 'contracts', 'jobs'],
  emits: ['message'],
  
  data() {
    return {
      statsTab: 'contracts',
      dateFrom: getMonthStart(),
      dateTo: getTodayDate(),
      exportDialog: false
    }
  },
  
  computed: {
    filteredRecords() {
      const from = parseDateString(this.dateFrom);
      const to = parseDateString(this.dateTo);
      to.setHours(23, 59, 59);
      return this.allRecords.filter(r => {
        const d = new Date(r[6]);
        return d >= from && d <= to;
      });
    },
    
    contractStats() {
      const stats = {};
      const tripDays = {};
      
      this.filteredRecords.forEach(r => {
        const contractName = r[3];
        const dateKey = new Date(r[6]).toDateString();
        const kmCelkem = r[12] || 0;
        
        if (!stats[contractName]) {
          stats[contractName] = {
            name: contractName,
            totalHours: 0,
            totalWorkers: new Set(),
            visits: 0,
            totalKm: 0,
            tripCount: 0
          };
          tripDays[contractName] = new Set();
        }
        
        stats[contractName].totalHours += r[7];
        stats[contractName].totalWorkers.add(r[1]);
        stats[contractName].visits += 1;
        
        if (kmCelkem > 0 && !tripDays[contractName].has(dateKey)) {
          stats[contractName].totalKm += kmCelkem;
          stats[contractName].tripCount += 1;
          tripDays[contractName].add(dateKey);
        }
      });
      
      return Object.values(stats).map(s => ({
        ...s,
        totalWorkers: s.totalWorkers.size,
        cestovne: s.totalKm * 4
      })).sort((a, b) => b.totalHours - a.totalHours);
    },
    
    workerStats() {
      const stats = {};
      this.filteredRecords.forEach(r => {
        const workerName = r[1];
        if (!stats[workerName]) {
          stats[workerName] = {
            name: workerName,
            totalHours: 0,
            contracts: new Set(),
            days: new Set()
          };
        }
        stats[workerName].totalHours += r[7];
        stats[workerName].contracts.add(r[3]);
        const day = new Date(r[6]).toDateString();
        stats[workerName].days.add(day);
      });
      
      return Object.values(stats).map(s => ({
        ...s,
        contracts: s.contracts.size,
        days: s.days.size
      })).sort((a, b) => b.totalHours - a.totalHours);
    },
    
    jobStats() {
      const stats = {};
      this.filteredRecords.forEach(r => {
        const jobName = r[5];
        if (!stats[jobName]) {
          stats[jobName] = { name: jobName, totalHours: 0, count: 0 };
        }
        stats[jobName].totalHours += r[7];
        stats[jobName].count += 1;
      });
      
      return Object.values(stats).sort((a, b) => b.totalHours - a.totalHours);
    },
    
    exportData() {
      return {
        period: `${this.dateFrom} - ${this.dateTo}`,
        contracts: this.contractStats,
        workers: this.workerStats,
        jobs: this.jobStats,
        totalHours: this.contractStats.reduce((s, c) => s + c.totalHours, 0),
        totalKm: this.contractStats.reduce((s, c) => s + c.totalKm, 0),
        totalCestovne: this.contractStats.reduce((s, c) => s + c.cestovne, 0)
      };
    }
  },
  
  methods: {
    formatDateForInput(s) { return formatDateForInput(s); },
    formatDateFromInput(i) { return formatDateFromInput(i); },
    
    openExportDialog() {
      this.exportDialog = true;
    },
    
    exportToPDF() {
      const content = `
        <html>
        <head>
          <meta charset="utf-8">
          <title>Statistiky ${this.exportData.period}</title>
          <style>
            body { font-family: Arial; padding: 20px; }
            h1 { color: #1976d2; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #1976d2; color: white; }
            .summary { background: #f5f5f5; padding: 15px; margin: 20px 0; }
            .total { font-weight: bold; font-size: 18px; color: #1976d2; }
          </style>
        </head>
        <body>
          <h1>📊 Statistiky práce</h1>
          <p><strong>Období:</strong> ${this.exportData.period}</p>
          
          <div class="summary">
            <h2>Souhrn</h2>
            <p>Celkem hodin: <span class="total">${this.exportData.totalHours.toFixed(2)} h</span></p>
            <p>Celkem km: <span class="total">${this.exportData.totalKm} km</span></p>
            <p>Cestovné: <span class="total">${this.exportData.totalCestovne} Kč</span></p>
          </div>
          
          <h2>📋 Zakázky</h2>
          <table>
            <thead>
              <tr>
                <th>Zakázka</th>
                <th>Hodiny</th>
                <th>Pracovníků</th>
                <th>Návštěv</th>
                <th>Cest</th>
                <th>KM</th>
                <th>Cestovné</th>
              </tr>
            </thead>
            <tbody>
              ${this.exportData.contracts.map(c => `
                <tr>
                  <td>${c.name}</td>
                  <td>${c.totalHours.toFixed(2)} h</td>
                  <td>${c.totalWorkers}</td>
                  <td>${c.visits}x</td>
                  <td>${c.tripCount}x</td>
                  <td>${c.totalKm} km</td>
                  <td>${c.cestovne} Kč</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <h2>👷 Pracovníci</h2>
          <table>
            <thead>
              <tr>
                <th>Jméno</th>
                <th>Hodiny</th>
                <th>Zakázek</th>
                <th>Dnů</th>
              </tr>
            </thead>
            <tbody>
              ${this.exportData.workers.map(w => `
                <tr>
                  <td>${w.name}</td>
                  <td>${w.totalHours.toFixed(2)} h</td>
                  <td>${w.contracts}</td>
                  <td>${w.days}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <p style="margin-top: 40px; color: #999; font-size: 12px;">
            Vygenerováno: ${new Date().toLocaleString('cs-CZ')}<br>
            Evidence práce 2026
          </p>
        </body>
        </html>
      `;
      
      const printWindow = window.open('', '_blank');
      printWindow.document.write(content);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
      this.exportDialog = false;
      this.$emit('message', '✓ PDF připraveno k tisku');
    },
    
    exportToCSV() {
      let csv = 'Zakázka,Hodiny,Pracovníků,Návštěv,Cest,KM,Cestovné\n';
      this.exportData.contracts.forEach(c => {
        csv += `"${c.name}",${c.totalHours.toFixed(2)},${c.totalWorkers},${c.visits},${c.tripCount},${c.totalKm},${c.cestovne}\n`;
      });
      
      csv += '\n\nPracovník,Hodiny,Zakázek,Dnů\n';
      this.exportData.workers.forEach(w => {
        csv += `"${w.name}",${w.totalHours.toFixed(2)},${w.contracts},${w.days}\n`;
      });
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `statistiky_${this.dateFrom}_${this.dateTo}.csv`;
      link.click();
      
      this.exportDialog = false;
      this.$emit('message', '✓ CSV staženo');
    }
  },
  
  template: `
    <div class="q-pa-md">
      <div class="row items-center q-mb-md">
        <div class="text-h5 col">📊 Statistiky</div>
        <q-btn color="primary" icon="download" label="Export" @click="openExportDialog" unelevated/>
      </div>
      
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="row q-gutter-sm">
            <div class="col">
              <q-input v-model="dateFrom" label="Od" type="date" outlined dense 
                :model-value="formatDateForInput(dateFrom)" 
                @update:model-value="dateFrom=formatDateFromInput($event)"/>
            </div>
            <div class="col">
              <q-input v-model="dateTo" label="Do" type="date" outlined dense 
                :model-value="formatDateForInput(dateTo)" 
                @update:model-value="dateTo=formatDateFromInput($event)"/>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <q-tabs v-model="statsTab" dense align="justify" class="q-mb-md text-primary">
        <q-tab name="contracts" label="Zakázky"/>
        <q-tab name="workers" label="Pracovníci"/>
        <q-tab name="jobs" label="Práce"/>
      </q-tabs>

      <div v-if="statsTab==='contracts'">
        <q-card v-for="stat in contractStats" :key="stat.name" class="q-mb-md">
          <q-card-section>
            <div class="text-h6">{{ stat.name }}</div>
            <q-separator class="q-my-sm"/>
            
            <div class="row q-mt-sm">
              <div class="col-6">
                <div class="text-caption text-grey-7">Celkem hodin</div>
                <div class="text-bold text-primary">{{ stat.totalHours.toFixed(2) }} h</div>
              </div>
              <div class="col-3">
                <div class="text-caption text-grey-7">Pracovníků</div>
                <div class="text-bold">{{ stat.totalWorkers }}</div>
              </div>
              <div class="col-3">
                <div class="text-caption text-grey-7">Návštěv</div>
                <div class="text-bold">{{ stat.visits }}x</div>
              </div>
            </div>
            
            <div v-if="stat.totalKm > 0" class="q-mt-md">
              <q-separator class="q-mb-sm"/>
              <div class="text-subtitle2">🚗 Kilometry</div>
              <div class="row q-mt-xs">
                <div class="col-4">
                  <div class="text-caption text-grey-7">Cest</div>
                  <div class="text-bold">{{ stat.tripCount }}x</div>
                </div>
                <div class="col-4">
                  <div class="text-caption text-grey-7">Celkem km</div>
                  <div class="text-bold text-orange">{{ stat.totalKm }} km</div>
                </div>
                <div class="col-4">
                  <div class="text-caption text-grey-7">Cestovné</div>
                  <div class="text-bold text-green">{{ stat.cestovne }} Kč</div>
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div v-if="statsTab==='workers'">
        <q-card v-for="stat in workerStats" :key="stat.name" class="q-mb-md">
          <q-card-section>
            <div class="text-h6">{{ stat.name }}</div>
            <div class="row q-mt-sm">
              <div class="col">
                <div class="text-caption text-grey-7">Celkem hodin</div>
                <div class="text-bold text-primary">{{ stat.totalHours.toFixed(2) }} h</div>
              </div>
              <div class="col">
                <div class="text-caption text-grey-7">Zakázek</div>
                <div class="text-bold">{{ stat.contracts }}</div>
              </div>
              <div class="col">
                <div class="text-caption text-grey-7">Odprac. dnů</div>
                <div class="text-bold">{{ stat.days }}</div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div v-if="statsTab==='jobs'">
        <q-card v-for="stat in jobStats" :key="stat.name" class="q-mb-md">
          <q-card-section>
            <div class="row items-center">
              <div class="col">
                <div class="text-bold">{{ stat.name }}</div>
              </div>
              <div class="text-right">
                <div class="text-bold text-primary">{{ stat.totalHours.toFixed(2) }} h</div>
                <div class="text-caption text-grey-7">{{ stat.count }}x</div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
      
      <q-dialog v-model="exportDialog">
        <q-card style="min-width: 300px">
          <q-card-section>
            <div class="text-h6">📥 Export statistik</div>
          </q-card-section>
          
          <q-card-section>
            <p class="text-body2">Období: {{ exportData.period }}</p>
          </q-card-section>
          
          <q-card-actions vertical>
            <q-btn color="primary" icon="picture_as_pdf" label="Export do PDF" 
              @click="exportToPDF" unelevated class="full-width q-mb-sm"/>
            <q-btn color="green" icon="table_chart" label="Export do CSV" 
              @click="exportToCSV" unelevated class="full-width q-mb-sm"/>
            <q-btn flat label="Zrušit" v-close-popup class="full-width"/>
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  `
});
