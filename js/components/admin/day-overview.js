window.app.component('day-overview', {
  props: ['allRecords', 'contracts', 'jobs', 'places', 'loading'],
  emits: ['message', 'reload'],
  
  data() {
    return {
      selectedDate: getTodayDate(),
      workers: [],
      
      // Dialogy
      showAddShiftDialog: false,
      showEditShiftDialog: false,
      showAddLunchDialog: false,
      showAddAdvanceDialog: false,
      
      // Formuláře
      newShift: this.getEmptyShift(),
      editShift: this.getEmptyShift(),
      editingRecord: null,
      
      newLunch: {
        workerId: null,
        date: getTodayDate(),
        time: this.getCurrentTime()
      },
      
      newAdvance: {
        workerId: null,
        amount: null,
        reason: '',
        date: getTodayDate()
      }
    }
  },
  
  computed: {
    dayRecords() {
      if (!this.selectedDate || !this.allRecords?.length) return [];
      
      // Robustní parsování data (funguje i pro "7. 2. 2026")
      const cleaned = this.selectedDate.trim().replace(/\s+/g, ' ');
      const parts = cleaned.split('.').map(p => parseInt(p.trim(), 10));
      if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return [];
      
      const [dd, mm, yyyy] = parts;
      const startOfDay = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0).getTime();
      const endOfDay = new Date(yyyy, mm - 1, dd, 23, 59, 59, 999).getTime();
      
      return this.allRecords
        .filter(r => {
          const ts = Number(r[4]);
          return !isNaN(ts) && ts >= startOfDay && ts <= endOfDay;
        })
        .sort((a, b) => Number(a[4]) - Number(b[4]));
    },
    
    workerOptions() {
      return this.workers.map(w => ({ label: w[1], value: w[0] }));
    },
    
    contractOptions() {
      return this.contracts.map(c => ({ label: c[0] + ' - ' + c[1], value: c[0] }));
    },
    
    jobOptions() {
      return this.jobs.map(j => ({ label: j[1], value: j[0] }));
    },
    
    placeOptions() {
      return this.places ? this.places.map(p => ({ label: p[1], value: p[0] })) : [];
    },
    
    totalHours() {
      return this.dayRecords.reduce((sum, r) => sum + (parseFloat(r[7]) || 0), 0).toFixed(2);
    },
    
    totalKm() {
      return this.dayRecords.reduce((sum, r) => sum + (parseFloat(r[12]) || 0), 0);
    },
    
    uniqueWorkers() {
      const workers = new Set(this.dayRecords.map(r => r[6]));
      return workers.size;
    }
  },
  
  methods: {
    getEmptyShift() {
      return {
        workerId: null,
        contractId: null,
        jobId: null,
        placeId: null,
        date: getTodayDate(),
        timeStart: '',
        timeEnd: '',
        note: '',
        kmManual: false,
        kmValue: null,
        kmRoundTrip: true
      };
    },
    
    getCurrentTime() {
      const now = new Date();
      return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    },
    
    async loadWorkers() {
      const res = await apiCall('get', { type: 'workers' });
      if (res.code === '000' && res.data) {
        this.workers = res.data;
      }
    },
    
    openAddShiftDialog() {
      this.newShift = this.getEmptyShift();
      this.showAddShiftDialog = true;
    },
    
    openEditDialog(record) {
      const worker = this.workers.find(w => w[1] === record[6]);
      const contract = this.contracts.find(c => c[1] === record[0]);
      const job = this.jobs.find(j => j[1] === record[3]);
      const place = this.places?.find(p => p[1] === record[14]) || null;
      
      const recordDate = new Date(Number(record[4]));
      const dateStr = `${recordDate.getDate().toString().padStart(2, '0')}. ${ (recordDate.getMonth() + 1).toString().padStart(2, '0') }. ${recordDate.getFullYear()}`;
      
      this.editShift = {
        workerId: worker ? worker[0] : null,
        contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null,
        placeId: place ? place[0] : null,
        date: dateStr,
        timeStart: formatTime(record[4]),
        timeEnd: formatTime(record[5]),
        note: record[8] || '',
        kmManual: record[13] === 'Y',
        kmValue: parseFloat(record[11]) || null,
        kmRoundTrip: true
      };
      
      this.editingRecord = record;
      this.showEditShiftDialog = true;
    },
    
    duplicateShift(record) {
      const worker = this.workers.find(w => w[1] === record[6]);
      const contract = this.contracts.find(c => c[1] === record[0]);
      const job = this.jobs.find(j => j[1] === record[3]);
      const place = this.places?.find(p => p[1] === record[14]) || null;
      
      this.newShift = {
        workerId: worker ? worker[0] : null,
        contractId: contract ? contract[0] : null,
        jobId: job ? job[0] : null,
        placeId: place ? place[0] : null,
        date: getTodayDate(),
        timeStart: '',
        timeEnd: '',
        note: record[8] || '',
        kmManual: record[13] === 'Y',
        kmValue: parseFloat(record[11]) || null,
        kmRoundTrip: true
      };
      
      this.showAddShiftDialog = true;
    },
    
    async saveNewShift() {
      if (!this.newShift.workerId || !this.newShift.contractId || !this.newShift.jobId || 
          !this.newShift.placeId || !this.newShift.timeStart || !this.newShift.timeEnd || !this.newShift.note?.trim()) {
        this.$emit('message', 'Vyplňte všechna povinná pole včetně poznámky');
        return;
      }
      
      const dateParts = this.newShift.date.split('. ').map(p => parseInt(p));
      const timeParts1 = this.newShift.timeStart.split(':');
      const timeParts2 = this.newShift.timeEnd.split(':');
      
      const timeFrom = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts1[0], timeParts1[1]).getTime();
      const timeTo = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts2[0], timeParts2[1]).getTime();
      
      const payload = {
        id_contract: this.newShift.contractId,
        id_worker: this.newShift.workerId,
        id_job: this.newShift.jobId,
        id_place: this.newShift.placeId,
        time_fr: timeFrom,
        time_to: timeTo,
        note: this.newShift.note
      };
      
      if (this.newShift.kmManual && this.newShift.kmValue) {
        const kmTotal = this.newShift.kmRoundTrip ? this.newShift.kmValue * 2 : this.newShift.kmValue;
        payload.km_jednosmer = this.newShift.kmValue;
        payload.km_celkem = kmTotal;
        payload.km_rucne = 'Y';
      }
      
      try {
        const res = await apiCall('saverecord', payload);
        if (res.code === '000') {
          this.$emit('message', 'Nová směna uložena');
          this.showAddShiftDialog = false;
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + (res.error || 'Neznámá chyba'));
        }
      } catch (error) {
        console.error('Save new shift error:', error);
        this.$emit('message', 'Chyba při ukládání nové směny');
      }
    },
    
    async saveEditShift() {
      if (!this.editShift.workerId || !this.editShift.contractId || !this.editShift.jobId || 
          !this.editShift.placeId || !this.editShift.timeStart || !this.editShift.timeEnd || !this.editShift.note?.trim()) {
        this.$emit('message', 'Vyplňte všechna povinná pole včetně poznámky');
        return;
      }
      
      const dateParts = this.editShift.date.split('. ').map(p => parseInt(p));
      const timeParts1 = this.editShift.timeStart.split(':');
      const timeParts2 = this.editShift.timeEnd.split(':');
      
      const timeFrom = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts1[0], timeParts1[1]).getTime();
      const timeTo = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts2[0], timeParts2[1]).getTime();
      
      const payload = {
        row_index: this.editingRecord[15],  // Předpokládám row_index v indexu 15 - uprav, jestli je jinde
        id_contract: this.editShift.contractId,
        id_worker: this.editShift.workerId,
        id_job: this.editShift.jobId,
        id_place: this.editShift.placeId,
        time_fr: timeFrom,
        time_to: timeTo,
        note: this.editShift.note
      };
      
      if (this.editShift.kmManual && this.editShift.kmValue) {
        const kmTotal = this.editShift.kmRoundTrip ? this.editShift.kmValue * 2 : this.editShift.kmValue;
        payload.km_jednosmer = this.editShift.kmValue;
        payload.km_celkem = kmTotal;
        payload.km_rucne = 'Y';
      }
      
      try {
        const res = await apiCall('updaterecord', payload);  // Používám 'updaterecord' - jestli není, změň na 'saverecord'
        if (res.code === '000') {
          this.$emit('message', 'Směna upravena');
          this.showEditShiftDialog = false;
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + (res.error || 'Neznámá chyba'));
        }
      } catch (error) {
        console.error('Save edit shift error:', error);
        this.$emit('message', 'Chyba při úpravě směny');
      }
    },
    
    async deleteRecord(record) {
      if (!confirm('Opravdu smazat tento záznam?')) return;
      
      try {
        const res = await apiCall('deleterecord', { row_index: record[15] });  // Uprav index, jestli je ID jinde
        if (res.code === '000') {
          this.$emit('message', 'Záznam smazán');
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + (res.error || 'Neznámá chyba'));
        }
      } catch (error) {
        console.error('Delete record error:', error);
        this.$emit('message', 'Chyba při mazání záznamu');
      }
    },
    
    openAddLunchDialog() {
      this.newLunch = {
        workerId: null,
        date: getTodayDate(),
        time: this.getCurrentTime()
      };
      this.showAddLunchDialog = true;
    },
    
    async saveNewLunch() {
      if (!this.newLunch.workerId) {
        this.$emit('message', 'Vyberte zaměstnance');
        return;
      }
      
      const dateParts = this.newLunch.date.split('. ').map(p => parseInt(p));
      const timeParts = this.newLunch.time.split(':');
      const timestamp = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1]).getTime();
      
      const worker = this.workers.find(w => w[0] === this.newLunch.workerId);
      if (!worker) return this.$emit('message', 'Neznámý zaměstnanec');
      
      try {
        const res = await apiCall('savelunch', {
          id_worker: this.newLunch.workerId,
          name_worker: worker[1],
          time: timestamp
        });
        if (res.code === '000') {
          this.$emit('message', 'Oběd přidán');
          this.showAddLunchDialog = false;
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + (res.error || 'Neznámá chyba'));
        }
      } catch (error) {
        console.error('Save lunch error:', error);
        this.$emit('message', 'Chyba při přidání oběda');
      }
    },
    
    openAddAdvanceDialog() {
      this.newAdvance = {
        workerId: null,
        amount: null,
        reason: '',
        date: getTodayDate()
      };
      this.showAddAdvanceDialog = true;
    },
    
    async saveNewAdvance() {
      if (!this.newAdvance.workerId || !this.newAdvance.amount || !this.newAdvance.reason.trim()) {
        this.$emit('message', 'Vyplňte všechna pole včetně důvodu');
        return;
      }
      
      const dateParts = this.newAdvance.date.split('. ').map(p => parseInt(p));
      const timestamp = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], 12, 0).getTime();
      
      const worker = this.workers.find(w => w[0] === this.newAdvance.workerId);
      if (!worker) return this.$emit('message', 'Neznámý zaměstnanec');
      
      try {
        const res = await apiCall('saveadvance', {
          id_worker: this.newAdvance.workerId,
          name_worker: worker[1],
          time: timestamp,
          payment: this.newAdvance.amount,
          payment_reason: this.newAdvance.reason
        });
        if (res.code === '000') {
          this.$emit('message', 'Záloha přidána');
          this.showAddAdvanceDialog = false;
          this.$emit('reload');
        } else {
          this.$emit('message', 'Chyba: ' + (res.error || 'Neznámá chyba'));
        }
      } catch (error) {
        console.error('Save advance error:', error);
        this.$emit('message', 'Chyba při přidání zálohy');
      }
    }
  },
  
  async mounted() {
    await this.loadWorkers();
  },
  
  template: `
    <div class="q-pa-md">
      <!-- Výběr data -->
      <q-input v-model="selectedDate" label="Vyberte datum" filled>
        <template v-slot:append>
          <q-icon name="event" class="cursor-pointer">
            <q-popup-proxy cover transition-show="flip-down" transition-hide="flip-up">
              <q-date v-model="selectedDate" mask="DD. MM. YYYY" />
            </q-popup-proxy>
          </q-icon>
        </template>
      </q-input>
      
      <!-- Tlačítka pro přidání -->
      <div class="row q-mt-md q-gutter-md">
        <q-btn color="primary" icon="add" label="Nová směna" @click="openAddShiftDialog" />
        <q-btn color="secondary" icon="restaurant" label="Nový oběd" @click="openAddLunchDialog" />
        <q-btn color="positive" icon="attach_money" label="Nová záloha" @click="openAddAdvanceDialog" />
      </div>
      
      <!-- Statistiky -->
      <q-separator spaced class="q-mt-md" />
      <div class="row q-col-gutter-md q-mt-md">
        <div class="col">
          <q-card flat bordered>
            <q-card-section class="text-center">
              <div class="text-caption">Celkem hodin</div>
              <div class="text-h5">{{ totalHours }}</div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col">
          <q-card flat bordered>
            <q-card-section class="text-center">
              <div class="text-caption">Pracovníků</div>
              <div class="text-h5">{{ uniqueWorkers }}</div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col">
          <q-card flat bordered>
            <q-card-section class="text-center">
              <div class="text-caption">Celkem km</div>
              <div class="text-h5">{{ totalKm }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>
      
      <!-- Seznam záznamů -->
      <q-separator spaced class="q-mt-md" />
      <div v-if="loading" class="text-center q-my-xl">
        <q-spinner color="primary" size="3em" />
        <div class="q-mt-sm">Načítám data...</div>
      </div>
      <div v-else-if="dayRecords.length === 0" class="text-center q-my-xl text-grey">
        Žádné záznamy pro vybraný den: {{ selectedDate }}
      </div>
      <q-list v-else bordered separator class="rounded-borders">
        <q-item v-for="rec in dayRecords" :key="rec[4]" clickable>
          <q-item-section avatar>
            <q-avatar color="primary" text-color="white">
              {{ rec[6]?.charAt(0)?.toUpperCase() || '?' }}
            </q-avatar>
          </q-item-section>
          
          <q-item-section>
            <q-item-label>{{ rec[6] || 'Neznámý' }} • {{ rec[0] || '-' }}</q-item-label>
            <q-item-label caption lines="2">
              {{ formatTime(rec[4]) }} - {{ formatTime(rec[5]) }} • {{ (parseFloat(rec[7]) || 0).toFixed(1) }} h
              <span v-if="rec[12]"> • {{ rec[12] }} km</span>
              <span v-if="rec[8]"> • Pozn.: {{ rec[8] }}</span>
            </q-item-label>
          </q-item-section>
          
          <q-item-section side class="row no-wrap">
            <q-btn flat dense round color="primary" icon="content_copy" @click.stop="duplicateShift(rec)">
              <q-tooltip>Duplikovat</q-tooltip>
            </q-btn>
            <q-btn flat dense round color="warning" icon="edit" @click.stop="openEditDialog(rec)">
              <q-tooltip>Upravit</q-tooltip>
            </q-btn>
            <q-btn flat dense round color="negative" icon="delete" @click.stop="deleteRecord(rec)">
              <q-tooltip>Smazat</q-tooltip>
            </q-btn>
          </q-item-section>
        </q-item>
      </q-list>
      
      <!-- Dialog pro novou směnu -->
      <q-dialog v-model="showAddShiftDialog">
        <q-card style="width: 500px; max-width: 80vw;">
          <q-card-section>
            <div class="text-h6">Nová směna</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <q-select v-model="newShift.workerId" :options="workerOptions" label="Zaměstnanec" filled />
            <q-select v-model="newShift.contractId" :options="contractOptions" label="Zakázka" filled class="q-mt-sm" />
            <q-select v-model="newShift.jobId" :options="jobOptions" label="Práce" filled class="q-mt-sm" />
            <q-select v-model="newShift.placeId" :options="placeOptions" label="Místo" filled class="q-mt-sm" />
            <q-input v-model="newShift.date" label="Datum" filled class="q-mt-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover>
                    <q-date v-model="newShift.date" mask="DD. MM. YYYY" />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            <q-input v-model="newShift.timeStart" label="Čas příchodu (HH:MM)" filled class="q-mt-sm" mask="time" />
            <q-input v-model="newShift.timeEnd" label="Čas odchodu (HH:MM)" filled class="q-mt-sm" mask="time" />
            <q-input v-model="newShift.note" label="Poznámka (povinná)" type="textarea" filled class="q-mt-sm" />
            <q-toggle v-model="newShift.kmManual" label="Ruční km" class="q-mt-sm" />
            <q-input v-if="newShift.kmManual" v-model.number="newShift.kmValue" label="Km (jednosměr)" type="number" filled class="q-mt-sm" />
            <q-toggle v-if="newShift.kmManual" v-model="newShift.kmRoundTrip" label="Zpáteční cesta (x2)" />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="negative" v-close-popup />
            <q-btn flat label="Uložit" color="primary" @click="saveNewShift" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- Dialog pro úpravu směny -->
      <q-dialog v-model="showEditShiftDialog">
        <q-card style="width: 500px; max-width: 80vw;">
          <q-card-section>
            <div class="text-h6">Upravit směnu</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <q-select v-model="editShift.workerId" :options="workerOptions" label="Zaměstnanec" filled />
            <q-select v-model="editShift.contractId" :options="contractOptions" label="Zakázka" filled class="q-mt-sm" />
            <q-select v-model="editShift.jobId" :options="jobOptions" label="Práce" filled class="q-mt-sm" />
            <q-select v-model="editShift.placeId" :options="placeOptions" label="Místo" filled class="q-mt-sm" />
            <q-input v-model="editShift.date" label="Datum" filled class="q-mt-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover>
                    <q-date v-model="editShift.date" mask="DD. MM. YYYY" />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            <q-input v-model="editShift.timeStart" label="Čas příchodu (HH:MM)" filled class="q-mt-sm" mask="time" />
            <q-input v-model="editShift.timeEnd" label="Čas odchodu (HH:MM)" filled class="q-mt-sm" mask="time" />
            <q-input v-model="editShift.note" label="Poznámka (povinná)" type="textarea" filled class="q-mt-sm" />
            <q-toggle v-model="editShift.kmManual" label="Ruční km" class="q-mt-sm" />
            <q-input v-if="editShift.kmManual" v-model.number="editShift.kmValue" label="Km (jednosměr)" type="number" filled class="q-mt-sm" />
            <q-toggle v-if="editShift.kmManual" v-model="editShift.kmRoundTrip" label="Zpáteční cesta (x2)" />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="negative" v-close-popup />
            <q-btn flat label="Uložit změny" color="primary" @click="saveEditShift" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- Dialog pro nový oběd -->
      <q-dialog v-model="showAddLunchDialog">
        <q-card style="width: 400px; max-width: 80vw;">
          <q-card-section>
            <div class="text-h6">Přidat oběd</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <q-select v-model="newLunch.workerId" :options="workerOptions" label="Zaměstnanec" filled />
            <q-input v-model="newLunch.date" label="Datum" filled class="q-mt-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover>
                    <q-date v-model="newLunch.date" mask="DD. MM. YYYY" />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            <q-input v-model="newLunch.time" label="Čas (HH:MM)" filled class="q-mt-sm" mask="time" />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="negative" v-close-popup />
            <q-btn flat label="Uložit" color="primary" @click="saveNewLunch" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- Dialog pro novou zálohu -->
      <q-dialog v-model="showAddAdvanceDialog">
        <q-card style="width: 400px; max-width: 80vw;">
          <q-card-section>
            <div class="text-h6">Přidat zálohu</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <q-select v-model="newAdvance.workerId" :options="workerOptions" label="Zaměstnanec" filled />
            <q-input v-model="newAdvance.date" label="Datum" filled class="q-mt-sm">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover>
                    <q-date v-model="newAdvance.date" mask="DD. MM. YYYY" />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            <q-input v-model.number="newAdvance.amount" label="Částka" type="number" filled class="q-mt-sm" />
            <q-input v-model="newAdvance.reason" label="Důvod (povinný)" filled class="q-mt-sm" />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Zrušit" color="negative" v-close-popup />
            <q-btn flat label="Uložit" color="primary" @click="saveNewAdvance" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  `
});
